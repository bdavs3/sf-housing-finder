import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const SYSTEM_PROMPT = "<Redacted>"

Deno.serve(async (req: Request) => {
  const { id } = await req.json()

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  const { data: listing } = await supabase
    .from("listings")
    .select("raw_text, ocr_text, image_urls")
    .eq("id", id)
    .single()

  if (!listing) {
    return new Response("Not found", { status: 404 })
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

  const textBlock = {
    type: "text",
    text: `Post text:\n${listing.raw_text ?? "(none)"}\n\nOCR text from images:\n${listing.ocr_text ?? "(none)"}`,
  }

  let response: Record<string, unknown>
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: [...imageBlocks, textBlock] }],
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      console.log(`[score-listing] anthropic error: ${res.status} ${body}`)
      return new Response(`Anthropic error: ${res.status} ${body}`, { status: 500 })
    }
    response = await res.json()
  } catch (err) {
    console.log(`[score-listing] anthropic error: ${err}`)
    return new Response(`Anthropic error: ${err}`, { status: 500 })
  }

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

  await supabase
    .from("listings")
    .update({
      price_monthly: (result.price_monthly as number) ?? null,
      neighborhood: (result.neighborhood as string) ?? null,
      lease_type: (result.lease_type as string) ?? "unknown",
      move_in_date: (result.move_in_date as string) ?? null,
      ai_score: (result.ai_score as number) ?? null,
      ai_summary: (result.ai_summary as string) ?? null,
      flags: Array.isArray(result.flags) ? result.flags : [],
    })
    .eq("id", id)

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  })
})
