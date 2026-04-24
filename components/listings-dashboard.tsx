"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ListingCard } from "./listing-card"
import { Home, RefreshCw, Star, TrendingUp, Wand2 } from "lucide-react"

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
  move_in_date: string | null
  flags: string[]
  favorited: boolean
}

function trigramSim(a: string, b: string): number {
  if (!a || !b) return 0
  const tgrams = (s: string) => {
    const set = new Set<string>()
    const p = `  ${s.toLowerCase()}  `
    for (let i = 0; i < p.length - 2; i++) set.add(p.slice(i, i + 3))
    return set
  }
  const ta = tgrams(a), tb = tgrams(b)
  let common = 0
  for (const t of ta) if (tb.has(t)) common++
  return (2 * common) / (ta.size + tb.size)
}

const supabase = createClient()

export function ListingsDashboard() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [scrapeMsg, setScrapeMsg] = useState("")
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"recent" | "score">("recent")
  const [scrapeStatus, setScrapeStatus] = useState<"idle" | "scraping">("idle")

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
      .in("lease_type", ["long-term", "unknown"])
      .lte("price_monthly", 2000)
      .not("flags", "cs", '{"Seeking housing"}')
      .order("posted_at", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) console.error("Supabase error:", error)
        const kept: Listing[] = []
        for (const listing of (data as Listing[]) ?? []) {
          const isDupe = kept.some((k) => {
            if (k.author_name !== listing.author_name) return false
            const daysDiff = Math.abs(new Date(k.posted_at ?? 0).getTime() - new Date(listing.posted_at ?? 0).getTime()) / 86400000
            if (daysDiff > 7) return false
            return trigramSim(k.raw_text ?? "", listing.raw_text ?? "") >= 0.8
          })
          if (!isDupe) kept.push(listing)
        }
        setListings(kept)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    supabase.from("scrape_status").select("status").eq("id", 1).single().then(({ data }) => {
      if (data) setScrapeStatus(data.status as "idle" | "scraping")
    })

    const statusChannel = supabase
      .channel("scrape-status-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scrape_status" }, (payload) => {
        setScrapeStatus(payload.new.status as "idle" | "scraping")
      })
      .subscribe()

    return () => { supabase.removeChannel(statusChannel) }
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel("listings-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "listings" }, (payload) => {
        const updated = payload.new as Listing
        if ((updated.lease_type === "long-term" || updated.lease_type === "unknown") && (updated.price_monthly ?? Infinity) <= 2000 && !updated.flags?.includes("Seeking housing")) {
          setListings((prev) => {
            const idx = prev.findIndex((l) => l.id === updated.id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = updated
              return next
            }
            return [updated, ...prev]
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const toggleFavorited = async (id: string, favorited: boolean) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, favorited } : l)))
    await supabase.from("listings").update({ favorited }).eq("id", id)
  }

  const triggerScore = async () => {
    await fetch("/api/score", { method: "POST" })
  }

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
      <header className="border-b px-4 md:px-6 py-4 flex items-center justify-between gap-3">
        <h1 className="hidden md:block text-xl font-bold shrink-0">SF Housing Finder</h1>
        <Home className="block md:hidden w-5 h-5 shrink-0" />
        <div className="flex items-center gap-3 min-w-0">
          {scrapeStatus === "scraping" && (
            <span className="text-xs text-muted-foreground shrink-0 animate-pulse">scraping...</span>
          )}
          {scrapeMsg && <span className="hidden md:block text-xs text-muted-foreground max-w-xs truncate">{scrapeMsg}</span>}
          <span className="text-xs text-muted-foreground shrink-0">{listings.length} listings</span>
          <button
            onClick={() => setSortBy((v) => v === "recent" ? "score" : "recent")}
            className={`shrink-0 transition-colors ${sortBy === "score" ? "text-blue-400" : "text-muted-foreground hover:text-foreground"}`}
            title={sortBy === "score" ? "Sort by most recent" : "Sort by best score"}
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`shrink-0 transition-colors ${favoritesOnly ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`}
            title={favoritesOnly ? "Show all" : "Show favorites"}
          >
            <Star className={`w-4 h-4 ${favoritesOnly ? "fill-yellow-400" : ""}`} />
          </button>
          <button
            onClick={triggerScore}
            className="shrink-0 flex items-center gap-2 bg-secondary text-secondary-foreground px-3 md:px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors"
            title="Score unscored listings"
          >
            <Wand2 className="w-4 h-4" />
            <span className="hidden md:inline">Score</span>
          </button>
          <button
            onClick={triggerScrape}
            disabled={scraping}
            className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground px-3 md:px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${scraping ? "animate-spin" : ""}`} />
            <span className="hidden md:inline">Scrape Now</span>
          </button>
        </div>
      </header>

      <main className="px-6 py-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-20">Loading...</p>
        ) : (
          (() => {
            const filtered = favoritesOnly ? listings.filter((l) => l.favorited) : listings
            const visible = sortBy === "score"
              ? [...filtered].sort((a, b) => (b.ai_score ?? -1) - (a.ai_score ?? -1))
              : filtered
            return visible.length === 0 ? (
              <p className="text-center text-muted-foreground py-20">No listings found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                {visible.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onToggleFavorited={toggleFavorited}
                    onOpenLightbox={(urls, idx) => setLightbox({ urls, idx })}
                  />
                ))}
              </div>
            )
          })()
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
