import { NextResponse } from "next/server"

export async function POST() {
  try {
    const token = process.env.APIFY_API_TOKEN
    const groupUrls = process.env.GROUP_IDS

    if (!token || !groupUrls) {
      return NextResponse.json(
        { error: "Missing APIFY_API_TOKEN or GROUP_IDS" },
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
        body: JSON.stringify({ startUrls, resultsLimit, onlyPostsNewerThan: process.env.GROUPS_ONLY_POSTS_NEWER_THAN || null }),
      },
    )

    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { raw: text }
    }

    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
