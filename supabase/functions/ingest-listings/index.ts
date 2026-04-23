import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface ApifyAttachment {
  url?: string
  thumbnail?: string
  ocrText?: string
  image?: { uri?: string }
}

interface ApifyPost {
  legacyId: string
  user?: { name?: string }
  groupTitle?: string
  url?: string
  time?: string
  text?: string
  attachments?: ApifyAttachment[]
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

    const imageUrls = post.attachments
      ?.map((a) => a.image?.uri ?? a.url)
      .filter((u): u is string => Boolean(u) && !u.includes("facebook.com/")) ?? []
    const ocrText = post.attachments
      ?.map((a) => a.ocrText ?? "")
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
  let rawText: string
  try {
    rawText = await req.text()
    body = JSON.parse(rawText)
  } catch {
    return new Response("Invalid JSON", { status: 400 })
  }

  let posts: ApifyPost[]

  // Apify webhook payload has eventData.defaultDatasetId
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "resource" in (body as object)
  ) {
    const datasetId = (body as { resource: { defaultDatasetId?: string } }).resource
      ?.defaultDatasetId
    if (!datasetId) {
      return new Response("No defaultDatasetId in resource payload", { status: 400 })
    }
    posts = await fetchDatasetItems(datasetId)
  } else {
    // Direct array of posts (manual invocation)
    posts = Array.isArray(body) ? body : [body as ApifyPost]
  }

  const newIds = await ingestPosts(supabase, posts)

  // Fire scoring in the background, staggered 1.5s apart to stay under the
  // 50 RPM Claude rate limit when ingesting large batches.
  const scoringPromise = (async () => {
    for (let i = 0; i < newIds.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 7000))
      supabase.functions.invoke("score-listing", { body: { id: newIds[i] } })
    }
  })()
  try {
    EdgeRuntime.waitUntil(scoringPromise)
  } catch {
    // Local runtime may not support waitUntil; scoring fires and response returns
  }

  return new Response(JSON.stringify({ ingested: newIds.length }), {
    headers: { "Content-Type": "application/json" },
  })
})
