import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0
  const tgrams = (s: string) => {
    const set = new Set<string>()
    const p = `  ${s.toLowerCase()}  `
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3))
    return set
  }
  const ta = tgrams(a), tb = tgrams(b)
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return (2 * common) / (ta.size + tb.size)
}

Deno.serve(async (req: Request) => {
  const { id } = await req.json() as { id: string }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { data: listing } = await supabase
    .from("listings")
    .select("raw_text, ocr_text, image_urls, author_name, posted_at, price_monthly, neighborhood, flags")
    .eq("id", id)
    .single()

  if (!listing) {
    return new Response("Not found", { status: 404 })
  }

  const weekAgo = new Date((listing.posted_at ? new Date(listing.posted_at) : new Date()).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: candidates } = await supabase
    .from("listings")
    .select("price_monthly, neighborhood, lease_type, move_in_date, ai_score, ai_summary, flags, raw_text")
    .eq("author_name", listing.author_name)
    .not("ai_score", "is", null)
    .neq("id", id)
    .gte("posted_at", weekAgo)

  const duplicate = candidates?.find((c) => trigramSim(c.raw_text ?? "", listing.raw_text ?? "") >= 0.8)

  if (duplicate) {
    console.log(`[score-listing] duplicate found, copying score for id=${id}`)
    await supabase.from("listings").update({
      price_monthly: duplicate.price_monthly,
      neighborhood: duplicate.neighborhood,
      lease_type: duplicate.lease_type,
      move_in_date: duplicate.move_in_date,
      ai_score: duplicate.ai_score,
      ai_summary: duplicate.ai_summary,
      flags: duplicate.flags,
    }).eq("id", id)
    return new Response(JSON.stringify(duplicate), { headers: { "Content-Type": "application/json" } })
  }

  const imageUrls: string[] = listing.image_urls ?? []
  console.log(`[score-listing] id=${id} images=${imageUrls.length}`)

  const imageBlocks: unknown[] = await Promise.all(
    imageUrls.slice(0, 4).map(async (url) => {
      try {
        const res = await fetch(url)
        if (!res.ok) {
          console.log(`[score-listing] image fetch failed: ${res.status} ${url.slice(0, 80)}`)
          return null
        }
        const buf = await res.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        const data = btoa(binary)
        const media_type = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]
        console.log(`[score-listing] image ok: ${media_type} ${Math.round(buf.byteLength / 1024)}kb`)
        return { type: "image", source: { type: "base64", media_type, data } }
      } catch (err) {
        console.log(`[score-listing] image error: ${err}`)
        return null
      }
    }),
  ).then((blocks) => blocks.filter(Boolean))

  console.log(`[score-listing] sending to claude: ${imageBlocks.length} images`)

  const structuredHints: string[] = []
  if (listing.price_monthly != null) structuredHints.push(`Price: $${listing.price_monthly}/month`)
  if (listing.neighborhood) structuredHints.push(`Neighborhood: ${listing.neighborhood}`)
  if (listing.flags?.length) structuredHints.push(`Known flags: ${listing.flags.join(", ")}`)

  const textBlock = {
    type: "text",
    text: [
      structuredHints.length ? `Pre-extracted structured data (treat as ground truth):\n${structuredHints.join("\n")}` : null,
      `Post text:\n${listing.raw_text ?? "(none)"}`,
      `OCR text from images:\n${listing.ocr_text ?? "(none)"}`,
    ].filter(Boolean).join("\n\n"),
  }

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [{ type: "text", text: atob(Deno.env.get("SCORING_PROMPT")!), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [...imageBlocks, textBlock] }],
    }),
  })

  if (!claudeRes.ok) {
    const body = await claudeRes.text()
    console.log(`[score-listing] anthropic error: ${claudeRes.status} ${body}`)
    return new Response(`Anthropic error: ${claudeRes.status} ${body}`, { status: 500 })
  }

  const response = await claudeRes.json()
  console.log(`[score-listing] claude stop_reason=${response.stop_reason} usage=${JSON.stringify(response.usage)}`)

  const content = response.content as Array<{ type: string; text: string }>
  const text = content[0]?.type === "text" ? content[0].text : ""
  console.log(`[score-listing] raw response: ${text.slice(0, 300)}`)

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.log(`[score-listing] no json found in response`)
    return new Response("Invalid AI response", { status: 500 })
  }

  let result: Record<string, unknown>
  try {
    result = JSON.parse(jsonMatch[0])
    console.log(`[score-listing] parsed ok: score=${result.ai_score} flags=${JSON.stringify(result.flags)}`)
  } catch (err) {
    console.log(`[score-listing] json parse error: ${err}`)
    return new Response("Failed to parse AI response", { status: 500 })
  }

  // Merge Claude's flags with any pre-extracted flags (e.g. from structured Marketplace data)
  const claudeFlags = Array.isArray(result.flags) ? result.flags as string[] : []
  const preFlags = listing.flags ?? []
  const mergedFlags = [...new Set([...preFlags, ...claudeFlags])]

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      // Fall back to pre-extracted value if Claude couldn't determine it from text
      price_monthly: (result.price_monthly as number) ?? listing.price_monthly ?? null,
      neighborhood: (result.neighborhood as string) ?? listing.neighborhood ?? null,
      lease_type: (result.lease_type as string) ?? "unknown",
      move_in_date: (result.move_in_date as string) ?? null,
      ai_score: (result.ai_score as number) ?? null,
      ai_summary: (result.ai_summary as string) ?? null,
      flags: mergedFlags,
    })
    .eq("id", id)

  if (updateError) {
    console.log(`[score-listing] db update error: ${updateError.message}`)
  } else {
    console.log(`[score-listing] db update ok: id=${id}`)
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  })
})
