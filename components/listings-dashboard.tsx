"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ListingCard } from "./listing-card"
import { RefreshCw } from "lucide-react"

export type Listing = {
  id: string
  created_at: string
  posted_at: string | null
  apify_id: string | null
  author_name: string | null
  group_title: string | null
  post_url: string | null
  raw_text: string | null
  image_urls: string[] | null
  ocr_text: string | null
  price_monthly: number | null
  neighborhood: string | null
  lease_type: "long-term" | "sublet" | "unknown" | null
  ai_score: number | null
  ai_summary: string | null
  status: "new" | "read" | "reached_out"
}

const supabase = createClient()

export function ListingsDashboard() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState("")
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null)
      if (e.key === "ArrowLeft") setLightbox((p) => p ? { ...p, idx: (p.idx - 1 + p.urls.length) % p.urls.length } : null)
      if (e.key === "ArrowRight") setLightbox((p) => p ? { ...p, idx: (p.idx + 1) % p.urls.length } : null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    supabase
      .from("listings")
      .select("*")
      .eq("lease_type", "long-term")
      .lte("price_monthly", 2000)
      .order("ai_score", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) console.error("Supabase error:", error)
        setListings((data as Listing[]) ?? [])
        setLoading(false)
      })
  }, [])

  const triggerScrape = async () => {
    setScraping(true)
    setScrapeMsg("")
    try {
      const res = await fetch("/api/trigger-apify", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setScrapeMsg(`Run started: ${data.data?.id ?? data.id ?? "ok"}`)
      } else {
        const msg =
          data?.error?.message ?? data?.error ?? data?.message ?? data?.raw ?? JSON.stringify(data)
        setScrapeMsg(`Apify error ${res.status}: ${msg}`)
      }
    } catch (err) {
      setScrapeMsg(`Failed: ${String(err)}`)
    }
    setScraping(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">SF Housing Finder</h1>
        <div className="flex items-center gap-3">
          {scrapeMsg && <span className="text-xs text-muted-foreground max-w-xs truncate">{scrapeMsg}</span>}
          <span className="text-xs text-muted-foreground">{listings.length} listings</span>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${scraping ? "animate-spin" : ""}`} />
            Scrape Now
          </button>
        </div>
      </header>

      <main className="px-6 py-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-20">Loading...</p>
        ) : listings.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No listings found.</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onOpenLightbox={(urls, idx) => setLightbox({ urls, idx })}
              />
            ))}
          </div>
        )}
      </main>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl leading-none p-2"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
          {lightbox.urls.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white text-4xl leading-none px-3 py-2 hover:bg-white/10 rounded"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((p) =>
                    p ? { ...p, idx: (p.idx - 1 + p.urls.length) % p.urls.length } : null,
                  )
                }}
              >
                ‹
              </button>
              <button
                className="absolute right-4 text-white text-4xl leading-none px-3 py-2 hover:bg-white/10 rounded"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((p) => (p ? { ...p, idx: (p.idx + 1) % p.urls.length } : null))
                }}
              >
                ›
              </button>
            </>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.urls[lightbox.idx]}
            alt=""
            className="max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <span className="absolute bottom-4 text-white/60 text-sm">
            {lightbox.idx + 1} / {lightbox.urls.length}
          </span>
        </div>
      )}
    </div>
  )
}
