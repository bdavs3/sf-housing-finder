"use client"

import { useState } from "react"
import type { Listing } from "./listings-dashboard"
import { ExternalLink, Mail, MailOpen, Star, X } from "lucide-react"

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
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <div className="flex items-center border-b hover:bg-muted/10 transition-colors">
        {images.length > 0 ? (
          <button
            onClick={() => onOpenLightbox(images, 0)}
            className="shrink-0 w-24 h-24 md:w-28 md:h-28 m-3 rounded overflow-hidden hover:opacity-80 transition-opacity"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="shrink-0 w-8 md:w-10" />
        )}

        <div className="flex-1 min-w-0 py-3 px-3 md:py-4 md:px-4">
          {/* Row 1: score + author name + (desktop: price, neighborhood, date, icons) */}
          <div className="flex items-center gap-1.5 mb-0.5 overflow-hidden">
            <ScoreInline score={listing.ai_score} />
            <span className={`text-sm truncate font-semibold ${isUnread ? "text-blue-400" : "text-foreground"}`}>
              {listing.author_name ?? "Unknown"}
            </span>
            {listing.price_monthly && (
              <span className="hidden md:inline text-sm shrink-0 text-foreground font-medium">
                ${listing.price_monthly.toLocaleString()}/mo
              </span>
            )}
            {listing.neighborhood && (
              <span className="hidden md:inline text-sm text-muted-foreground shrink-0">· {listing.neighborhood}</span>
            )}
            {listing.move_in_date && (
              <span className="hidden md:inline text-sm text-muted-foreground shrink-0">· {listing.move_in_date}</span>
            )}
            <span className="hidden md:inline ml-auto text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {formatDateTime(listing.posted_at)}
            </span>
            <div className="hidden md:block md:hidden" />
            {listing.post_url && (
              <a href={listing.post_url} target="_blank" rel="noopener noreferrer" className="hidden md:inline shrink-0 text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => onStatusChange(listing.id, isUnread ? "read" : "new")} className="hidden md:inline shrink-0 text-muted-foreground hover:text-foreground transition-colors" title={isUnread ? "Mark as read" : "Mark as unread"}>
              {isUnread ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onToggleFavorited(listing.id, !listing.favorited)} className={`hidden md:inline shrink-0 transition-colors ${listing.favorited ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`} title={listing.favorited ? "Unfavorite" : "Favorite"}>
              <Star className={`w-3.5 h-3.5 ${listing.favorited ? "fill-yellow-400" : ""}`} />
            </button>
          </div>

          {/* Row 2 (mobile only): price + move_in_date + icons */}
          <div className="flex md:hidden items-center gap-1.5 mb-1">
            {listing.price_monthly && (
              <span className="text-sm shrink-0 text-foreground font-medium">
                ${listing.price_monthly.toLocaleString()}/mo
              </span>
            )}
            {listing.move_in_date && (
              <span className="text-xs shrink-0 text-muted-foreground">· {listing.move_in_date}</span>
            )}
            <div className="ml-auto" />
            {listing.post_url && (
              <a href={listing.post_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => onStatusChange(listing.id, isUnread ? "read" : "new")} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" title={isUnread ? "Mark as read" : "Mark as unread"}>
              {isUnread ? <Mail className="w-3.5 h-3.5" /> : <MailOpen className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => onToggleFavorited(listing.id, !listing.favorited)} className={`shrink-0 transition-colors ${listing.favorited ? "text-yellow-400" : "text-muted-foreground hover:text-foreground"}`} title={listing.favorited ? "Unfavorite" : "Favorite"}>
              <Star className={`w-3.5 h-3.5 ${listing.favorited ? "fill-yellow-400" : ""}`} />
            </button>
          </div>

          {/* Neighborhood + date on mobile only */}
          <div className="flex items-center gap-2 mb-1 md:hidden">
            {listing.neighborhood && (
              <span className="text-xs text-muted-foreground">{listing.neighborhood}</span>
            )}
            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              {formatDateTime(listing.posted_at)}
            </span>
          </div>

          {listing.ai_summary && (
            <p
              className="text-sm leading-relaxed text-foreground cursor-pointer md:cursor-default"
              onClick={() => setShowModal(true)}
            >
              <span className="md:hidden">
                {listing.ai_summary.length > 100 ? listing.ai_summary.slice(0, 100) + "…" : listing.ai_summary}
              </span>
              <span className="hidden md:inline">{listing.ai_summary}</span>
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-background rounded-t-2xl md:rounded-xl w-full md:max-w-lg p-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className={`text-sm ${isUnread ? "font-bold" : "font-semibold"}`}>
                  {listing.author_name ?? "Unknown"}
                  {listing.price_monthly && <span className="ml-2 font-medium">${listing.price_monthly.toLocaleString()}/mo</span>}
                </p>
                {listing.neighborhood && <p className="text-xs text-muted-foreground mt-0.5">{listing.neighborhood}</p>}
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground ml-4 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{listing.ai_summary}</p>
          </div>
        </div>
      )}
    </>
  )
}
