import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"
import Anthropic from "npm:@anthropic-ai/sdk"

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

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") })

  const userContent: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `Post text:\n${listing.raw_text ?? "(none)"}\n\nOCR text from images:\n${listing.ocr_text ?? "(none)"}`,
    },
  ]

  const imageUrls: string[] = ((listing.image_urls as string[]) ?? []).slice(0, 3)
  for (const url of imageUrls) {
    userContent.push({ type: "image", source: { type: "url", url } })
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        // @ts-ignore cache_control is supported at runtime
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return new Response("Invalid AI response", { status: 500 })
  }

  let result: Record<string, unknown>
  try {
    result = JSON.parse(jsonMatch[0])
  } catch {
    return new Response("Failed to parse AI response", { status: 500 })
  }

  await supabase
    .from("listings")
    .update({
      price_monthly: (result.price_monthly as number) ?? null,
      neighborhood: (result.neighborhood as string) ?? null,
      lease_type: (result.lease_type as string) ?? "unknown",
      ai_score: (result.ai_score as number) ?? null,
      ai_summary: (result.ai_summary as string) ?? null,
    })
    .eq("id", id)

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  })
})
