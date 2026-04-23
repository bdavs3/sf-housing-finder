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

async function fetchDatasetItems(datasetId: string): Promise<ApifyPost[]> {
  const token = Deno.env.get("APIFY_API_TOKEN")
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`)
  return res.json()
}

async function ingestPosts(supabase: ReturnType<typeof createClient>, posts: ApifyPost[]) {
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

  return newIds
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  let posts: ApifyPost[]

  // Apify webhook payload has eventData.defaultDatasetId
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "eventData" in (body as object)
  ) {
    const datasetId = (body as { eventData: { defaultDatasetId?: string } }).eventData
      ?.defaultDatasetId
    if (!datasetId) {
      return new Response("No defaultDatasetId in webhook payload", { status: 400 })
    }
    posts = await fetchDatasetItems(datasetId)
  } else {
    // Direct array of posts (manual invocation)
    posts = Array.isArray(body) ? body : [body as ApifyPost]
  }

  const newIds = await ingestPosts(supabase, posts)

  // Fire scoring in the background — waitUntil keeps them alive in production,
  // but we return the response regardless so the webhook always gets a 200.
  const scoringPromise = Promise.all(
    newIds.map((id) => supabase.functions.invoke("score-listing", { body: { id } })),
  )
  try {
    EdgeRuntime.waitUntil(scoringPromise)
  } catch {
    // Local runtime may not support waitUntil; scoring fires and response returns
  }

  return new Response(JSON.stringify({ ingested: newIds.length }), {
    headers: { "Content-Type": "application/json" },
  })
})
