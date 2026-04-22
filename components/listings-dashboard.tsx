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

type StatusFilter = "new" | "read" | "reached_out"
type LeaseFilter = "all" | "long-term" | "sublet"

const supabase = createClient()

export function ListingsDashboard() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new")
  const [minScore, setMinScore] = useState(1)
  const [maxPrice, setMaxPrice] = useState("")
  const [leaseFilter, setLeaseFilter] = useState<LeaseFilter>("all")
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null)

  useEffect(() => {
    supabase
      .from("listings")
      .select("*")
      .order("ai_score", { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setListings((data as Listing[]) ?? [])
        setLoading(false)
      })
  }, [])

  const updateStatus = async (id: string, status: Listing["status"]) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
    await supabase.from("listings").update({ status }).eq("id", id)
  }

  const triggerScrape = async () => {
    setScraping(true)
    setScrapeMsg("")
    try {
      const res = await fetch("/api/trigger-apify", { method: "POST" })
      const data = await res.json()
      setScrapeMsg(
        res.ok
          ? `Run started: ${data.data?.id ?? "ok"}`
          : `Error: ${data.error?.message ?? data.message ?? "unknown"}`,
      )
    } catch {
      setScrapeMsg("Failed to start scrape")
    }
    setScraping(false)
  }

  const filtered = listings.filter((l) => {
    if (l.status !== statusFilter) return false
    if (l.ai_score !== null && l.ai_score < minScore) return false
    if (maxPrice !== "" && l.price_monthly !== null && l.price_monthly > Number(maxPrice)) return false
    if (leaseFilter !== "all" && l.lease_type !== leaseFilter) return false
    return true
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">SF Housing Finder</h1>
        <div className="flex items-center gap-3">
          {scrapeMsg && <span className="text-xs text-muted-foreground max-w-xs truncate">{scrapeMsg}</span>}
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

      <div className="px-6 py-3 border-b flex flex-wrap gap-3 items-center bg-muted/30">
        <div className="flex gap-1">
          {(["new", "read", "reached_out"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
            >
              {s === "reached_out" ? "Reached Out" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">Min score: {minScore}</span>
          <input
            type="range"
            min={1}
            max={10}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-24 accent-primary"
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Max $</span>
          <input
            type="number"
            placeholder="No limit"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-24 px-2 py-1 rounded-md border bg-background text-sm"
          />
        </div>

        <div className="flex gap-1">
          {(["all", "long-term", "sublet"] as LeaseFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setLeaseFilter(t)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                leaseFilter === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-muted-foreground border"
              }`}
            >
              {t === "all" ? "All types" : t}
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} listings</span>
      </div>

      <main className="px-6 py-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-20">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-20">No listings match your filters.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                onStatusChange={updateStatus}
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
