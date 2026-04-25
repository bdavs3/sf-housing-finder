import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface MarketplacePhoto {
  image?: { uri?: string }
}

interface PdpField {
  display_label?: string | null
  icon_name?: string | null
}

interface MarketplaceDetail {
  display_label?: string | null
  section_type?: string
  pdp_fields?: PdpField[]
}

interface MarketplaceListing {
  id?: string
  listingTitle?: string
  description?: { text?: string }
  listingPrice?: { amount?: string }
  listingPhotos?: MarketplacePhoto[]
  primaryListingPhoto?: { photo_image_url?: string }
  itemUrl?: string
  timestamp?: string
  location?: {
    reverse_geocode?: {
      city?: string
      state?: string
    }
  }
  locationText?: { text?: string }
  details?: MarketplaceDetail[]
  postedAt?: string
  listedDate?: string
}

// Flatten all pdp_fields display_labels across all detail sections
function allLabels(details: MarketplaceDetail[]): string[] {
  return details.flatMap((d) => d.pdp_fields ?? []).map((f) => (f.display_label ?? "").toLowerCase())
}

function parseFlags(details: MarketplaceDetail[]): string[] {
  const flags: string[] = []
  const joined = allLabels(details).join(" ")

  if (joined.includes("dog and cat") || joined.includes("cat friendly") || joined.includes("cats allowed")) {
    flags.push("Cats OK")
  } else if (joined.includes("pet friendly") || joined.includes("pets allowed") || joined.includes("pets ok")) {
    flags.push("Pets OK")
  } else if (joined.includes("no pets")) {
    flags.push("No pets")
  }

  if (joined.includes("parking available") || joined.includes("off-street parking") || joined.includes("garage parking") || joined.includes("garage")) {
    flags.push("Parking")
  }
  if (joined.includes("furnished")) flags.push("Furnished")
  if (joined.includes("private bath") || joined.includes("en suite") || joined.includes("ensuite")) flags.push("Private bath")

  return flags
}

// Parse "Listed 3 days ago", "Listed over a week ago", etc. → ISO timestamp
function parsePostedAt(details: MarketplaceDetail[]): string | null {
  const labels = details.flatMap((d) => d.pdp_fields ?? []).map((f) => f.display_label ?? "")
  const clockLabel = labels.find((l) => /listed/i.test(l))
  if (!clockLabel) return null

  const exact = clockLabel.match(/listed (\d+) (hour|day|week)s? ago/i)
  if (exact) {
    const amount = parseInt(exact[1])
    const unit = exact[2].toLowerCase()
    const ms = unit === "hour" ? amount * 3_600_000 : unit === "day" ? amount * 86_400_000 : amount * 7 * 86_400_000
    return new Date(Date.now() - ms).toISOString()
  }

  // "Listed over a week ago" → ~8 days
  if (/over a week/i.test(clockLabel)) {
    return new Date(Date.now() - 8 * 86_400_000).toISOString()
  }

  return null
}

async function fetchDatasetItems(datasetId: string): Promise<MarketplaceListing[]> {
  const token = Deno.env.get("APIFY_API_TOKEN")
  const url = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&clean=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`)
  return res.json()
}

async function ingestListings(supabase: ReturnType<typeof createClient>, items: MarketplaceListing[]) {
  let inserted = 0

  for (const item of items) {
    if (!item.id) continue

    // Primary: listingPhotos[].image.uri; fallback: primaryListingPhoto.photo_image_url
    const imageUrls: string[] = (item.listingPhotos ?? [])
      .map((p) => p.image?.uri)
      .filter((u): u is string => Boolean(u) && !u.includes("facebook.com/"))

    if (imageUrls.length === 0 && item.primaryListingPhoto?.photo_image_url) {
      imageUrls.push(item.primaryListingPhoto.photo_image_url)
    }

    const details = item.details ?? []
    const flags = parseFlags(details)
    const postedAt = item.timestamp ?? item.postedAt ?? item.listedDate ?? parsePostedAt(details) ?? null
    const price = item.listingPrice?.amount ? Math.round(parseFloat(item.listingPrice.amount)) : null

    // City-level location as a neighborhood hint (Claude will refine for SF listings)
    const city = item.location?.reverse_geocode?.city ?? item.locationText?.text?.split(",")[0]?.trim() ?? null
    const state = item.location?.reverse_geocode?.state ?? null
    const neighborhood = city ? (state && state !== "CA" ? `${city}, ${state}` : city) : null

    const { data } = await supabase
      .from("listings")
      .upsert(
        {
          apify_id: `mp_${item.id}`,
          source: "marketplace",
          author_name: "Marketplace",
          group_title: "marketplace",
          post_url: item.itemUrl ?? null,
          posted_at: postedAt,
          raw_text: item.description?.text ?? null,
          image_urls: imageUrls,
          ocr_text: null,
          price_monthly: price,
          neighborhood,
          flags,
        },
        { onConflict: "apify_id", ignoreDuplicates: true },
      )
      .select("id")

    if (data && data.length > 0) inserted++
  }

  return inserted
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

  let items: MarketplaceListing[]

  // Apify webhook payload: { resource: { defaultDatasetId } }
  if (body && typeof body === "object" && !Array.isArray(body) && "resource" in (body as object)) {
    const datasetId = (body as { resource: { defaultDatasetId?: string } }).resource?.defaultDatasetId
    if (!datasetId) return new Response("No defaultDatasetId in resource payload", { status: 400 })
    items = await fetchDatasetItems(datasetId)
  // Direct { datasetId } call (e.g. from trigger-marketplace route)
  } else if (body && typeof body === "object" && !Array.isArray(body) && "datasetId" in (body as object)) {
    const datasetId = (body as { datasetId: string }).datasetId
    items = await fetchDatasetItems(datasetId)
  } else {
    items = Array.isArray(body) ? body : [body as MarketplaceListing]
  }

  const inserted = await ingestListings(supabase, items)
  console.log(`[ingest-marketplace] inserted=${inserted} of ${items.length}`)

  return new Response(JSON.stringify({ inserted, total: items.length }), {
    headers: { "Content-Type": "application/json" },
  })
})
