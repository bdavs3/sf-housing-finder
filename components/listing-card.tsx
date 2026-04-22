"use client"

import type { Listing } from "./listings-dashboard"
import { ExternalLink, MapPin } from "lucide-react"

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">Unscored</span>
    )
  const color = score >= 7 ? "bg-green-500" : score >= 4 ? "bg-yellow-500" : "bg-red-500"
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${color}`}>
      {score}/10
    </span>
  )
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

interface Props {
  listing: Listing
  onStatusChange: (id: string, status: Listing["status"]) => void
  onOpenLightbox: (urls: string[], idx: number) => void
}

export function ListingCard({ listing, onStatusChange, onOpenLightbox }: Props) {
  const images = listing.image_urls ?? []

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <ScoreBadge score={listing.ai_score} />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {listing.lease_type && listing.lease_type !== "unknown" && (
            <span className="capitalize border rounded px-1.5 py-0.5">{listing.lease_type}</span>
          )}
          {listing.post_url && (
            <a
              href={listing.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
              title="View original post"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        {listing.price_monthly ? (
          <span className="font-semibold">${listing.price_monthly.toLocaleString()}/mo</span>
        ) : (
          <span className="text-muted-foreground">Price unknown</span>
        )}
        {listing.neighborhood && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {listing.neighborhood}
          </span>
        )}
      </div>

      {listing.ai_summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{listing.ai_summary}</p>
      )}

      {images.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {images.slice(0, 4).map((url, i) => (
            <button
              key={i}
              onClick={() => onOpenLightbox(images, i)}
              className="shrink-0 w-16 h-16 rounded overflow-hidden border hover:opacity-80 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          {images.length > 4 && (
            <button
              onClick={() => onOpenLightbox(images, 4)}
              className="shrink-0 w-16 h-16 rounded border flex items-center justify-center text-xs text-muted-foreground bg-muted hover:bg-muted/80 transition-colors"
            >
              +{images.length - 4}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{listing.author_name ?? "Unknown author"}</span>
        <span>{formatDate(listing.posted_at)}</span>
      </div>

      <div className="flex gap-2 pt-0.5">
        {listing.status !== "read" && (
          <button
            onClick={() => onStatusChange(listing.id, "read")}
            className="flex-1 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
          >
            Mark Read
          </button>
        )}
        {listing.status !== "reached_out" && (
          <button
            onClick={() => onStatusChange(listing.id, "reached_out")}
            className="flex-1 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Reached Out
          </button>
        )}
        {listing.status !== "new" && (
          <button
            onClick={() => onStatusChange(listing.id, "new")}
            className="flex-1 py-1.5 text-xs rounded-md border hover:bg-muted transition-colors"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}
