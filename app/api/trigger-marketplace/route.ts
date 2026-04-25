import { NextResponse } from "next/server"

export async function POST() {
  try {
    const token = process.env.APIFY_API_TOKEN
    if (!token) {
      return NextResponse.json({ error: "Missing APIFY_API_TOKEN" }, { status: 500 })
    }

    const startUrls = [
      { url: "https://www.facebook.com/marketplace/sanfrancisco/propertyrentals" },
    ]

    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-marketplace-scraper/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls,
          resultsLimit: process.env.MARKETPLACE_RESULTS_LIMIT ? parseInt(process.env.MARKETPLACE_RESULTS_LIMIT) : 50,
          includeListingDetails: true,
        }),
      },
    )

    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    if (!res.ok) {
      const msg =
        (data as { error?: { message?: string } })?.error?.message ??
        (data as { message?: string })?.message ??
        text
      return NextResponse.json({ error: `Apify error ${res.status}: ${msg}` }, { status: res.status })
    }

    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
