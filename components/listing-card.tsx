"use client"

import type { Listing } from "./listings-dashboard"
import { ExternalLink, Mail, MailOpen, Star } from "lucide-react"

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
  onStatusChange: (id: string, status: Listing["status"]) => void
  onToggleFavorited: (id: string, favorited: boolean) => void
  onOpenLightbox: (urls: string[], idx: number) => void
}

export function ListingCard({ listing, onStatusChange, onToggleFavorited, onOpenLightbox }: Props) {
  const images = listing.image_urls ?? []
  const isUnread = listing.status === "new"

  return (
    <div className="flex items-stretch border-b hover:bg-muted/10 transition-colors">
      {images.length > 0 ? (
        <button
          onClick={() => onOpenLightbox(images, 0)}
          className="shrink-0 w-28 self-stretch overflow-hidden hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
        </button>
      ) : (
        <div className="shrink-0 w-28" />
      )}

      <div className="flex-1 min-w-0 py-4 px-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <ScoreInline score={listing.ai_score} />
          <span className={`text-sm ${isUnread ? "font-bold" : "font-semibold"}`}>
            {listing.author_name ?? "Unknown"}
          </span>
          {listing.price_monthly && (
            <span className={`text-sm text-foreground ${isUnread ? "font-bold" : "font-medium"}`}>
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
          <button
            onClick={() => onStatusChange(listing.id, isUnread ? "read" : "new")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={isUnread ? "Mark as read" : "Mark as unread"}
          >
            {isUnread ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggleFavorited(listing.id, !listing.favorited)}
            className={`transition-colors ${listing.favorited ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`}
            title={listing.favorited ? "Unfavorite" : "Favorite"}
          >
            <Star className={`w-3.5 h-3.5 ${listing.favorited ? "fill-yellow-400" : ""}`} />
          </button>
        </div>

        {listing.ai_summary && (
          <p className={`text-sm leading-relaxed ${isUnread ? "text-foreground" : "text-muted-foreground"}`}>
            {listing.ai_summary}
          </p>
        )}
      </div>
    </div>
  )
}
