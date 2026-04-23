"use client"

import type { Listing } from "./listings-dashboard"
import { ExternalLink } from "lucide-react"

function ScoreInline({ score }: { score: number | null }) {
  if (score === null)
    return <span className="shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground font-bold">?</span>
  const bg = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500"
  return (
    <span className={`shrink-0 w-5 h-5 rounded-full ${bg} flex items-center justify-center text-white font-bold text-[10px]`}>
      {score}
    </span>
  )
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return ""
  const d = new Date(dateStr)
  const opts = { timeZone: "America/Denver" }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...opts }) +
    " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...opts })
}

interface Props {
  listing: Listing
  onOpenLightbox: (urls: string[], idx: number) => void
}

export function ListingCard({ listing, onOpenLightbox }: Props) {
  const images = listing.image_urls ?? []

  return (
    <div className="flex items-stretch gap-4 border-b hover:bg-muted/10 transition-colors">
      {images.length > 0 ? (
        <button
          onClick={() => onOpenLightbox(images, 0)}
          className="shrink-0 w-36 self-stretch overflow-hidden hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="shrink-0 w-28" />
      )}

      <div className="flex-1 min-w-0 py-4 pr-6">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <ScoreInline score={listing.ai_score} />
          <span className="font-semibold text-sm">{listing.author_name ?? "Unknown"}</span>
          {listing.price_monthly && (
            <span className="text-sm font-medium text-foreground">
              ${listing.price_monthly.toLocaleString()}/mo
            </span>
          )}
          {listing.neighborhood && (
            <span className="text-sm text-muted-foreground">· {listing.neighborhood}</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
            {formatDateTime(listing.posted_at)}
          </span>
          {listing.post_url && (
            <a
              href={listing.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {listing.ai_summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{listing.ai_summary}</p>
        )}
      </div>
    </div>
  )
}
