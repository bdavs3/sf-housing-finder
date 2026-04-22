import { NextResponse } from "next/server"

export async function POST() {
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

  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~facebook-groups-scraper/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startUrls }),
    },
  )

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
