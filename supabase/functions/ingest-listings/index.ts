import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface ApifyMedia {
  url: string
  thumbnail?: string
  ocrText?: string
}

interface ApifyPost {
  legacyId: string
  user?: { name?: string }
  groupTitle?: string
  url?: string
  time?: string
  text?: string
  media?: ApifyMedia[]
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  let posts: ApifyPost[]
  try {
    const body = await req.json()
    posts = Array.isArray(body) ? body : [body]
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  const newIds: string[] = []

  for (const post of posts) {
    if (!post.legacyId) continue

    const imageUrls = post.media?.map((m) => m.url).filter(Boolean) ?? []
    const ocrText =
      post.media
        ?.map((m) => m.ocrText ?? "")
        .filter(Boolean)
        .join("\n") ?? ""

    const { data } = await supabase
      .from("listings")
      .upsert(
        {
          apify_id: post.legacyId,
          author_name: post.user?.name ?? null,
          group_title: post.groupTitle ?? null,
          post_url: post.url ?? null,
          posted_at: post.time ? new Date(post.time).toISOString() : null,
          raw_text: post.text ?? null,
          image_urls: imageUrls,
          ocr_text: ocrText || null,
        },
        { onConflict: "apify_id", ignoreDuplicates: true },
      )
      .select("id")

    if (data && data.length > 0) {
      newIds.push(data[0].id)
    }
  }

  await Promise.all(
    newIds.map((id) => supabase.functions.invoke("score-listing", { body: { id } })),
  )

  return new Response(JSON.stringify({ ingested: newIds.length }), {
    headers: { "Content-Type": "application/json" },
  })
})
