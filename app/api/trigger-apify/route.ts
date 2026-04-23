import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/client"

export async function POST() {
  try {
    const token = process.env.APIFY_API_TOKEN
    const groupUrls = process.env.APIFY_GROUP_URLS

    if (!token || !groupUrls) {
      return NextResponse.json(
        { error: "Missing APIFY_API_TOKEN or APIFY_GROUP_URLS" },
        { status: 500 },
      )
    }

    const startUrls = groupUrls.split(",").map((g) => ({
      url: g.trim().startsWith("http")
        ? g.trim()
        : `https://www.facebook.com/groups/${g.trim()}`,
    }))

    const resultsLimit = 500;

    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~facebook-groups-scraper/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrls, resultsLimit, onlyPostsNewerThan: "25 hours" }),
      },
    )

    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    if (res.ok) {
      const runId = (data as { data?: { id?: string } })?.data?.id ?? null
      const supabase = createClient()
      await supabase.from("scrape_status").update({
        status: "scraping",
        run_id: runId,
        started_at: new Date().toISOString(),
        post_count: null,
      }).eq("id", 1)
    }

    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
