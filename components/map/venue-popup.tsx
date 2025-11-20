"use client";

import { Popup } from "react-map-gl";
import type { Venue } from "@/lib/types";
import { Mood } from "@/app/page";
import { X, MapPin, Star } from "lucide-react";

interface VenuePopupProps {
  venue: Venue;
  onClose: () => void;
}

// Map moods to labels (matching the dial)
const MOOD_LABELS: Record<Exclude<Mood, null>, string> = {
  cocktails: "Nice cocktails",
  dive: "Dive loser",
  sports: "Sports",
  love: "Find love",
  dance: "Dance",
};

// Map moods to emojis
const MOOD_EMOJIS: Record<Exclude<Mood, null>, string> = {
  cocktails: "🍸",
  dive: "🍺",
  sports: "🏈",
  love: "💕",
  dance: "💃",
};

export function VenuePopup({ venue, onClose }: VenuePopupProps) {
  return (
    <Popup
      longitude={venue.coordinates.lng}
      latitude={venue.coordinates.lat}
      anchor="bottom"
      onClose={onClose}
      closeButton={false}
      maxWidth="320px"
      offset={25}
      className="venue-popup"
    >
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-primary/20 to-secondary/20 px-4 py-3 border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <h3 className="font-bold text-lg pr-6 mb-1">{venue.name}</h3>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>{venue.neighborhood}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Address */}
          <p className="text-sm text-muted-foreground">{venue.address}</p>

          {/* Moods */}
          <div className="flex flex-wrap gap-2">
            {venue.moods.map((mood) => (
              <span
                key={mood}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm"
              >
                <span>{MOOD_EMOJIS[mood as Exclude<Mood, null>]}</span>
                <span className="font-medium">
                  {MOOD_LABELS[mood as Exclude<Mood, null>]}
                </span>
              </span>
            ))}
          </div>

          {/* Rating (if available) */}
          {venue.rating && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-border">
              <Star className="w-4 h-4 fill-accent text-accent" />
              <span className="font-semibold">{venue.rating.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">rating</span>
            </div>
          )}

          {/* Price level (if available) */}
          {venue.priceLevel && (
            <div className="text-sm">
              <span className="font-medium">Price: </span>
              <span className="text-muted-foreground">
                {"$".repeat(venue.priceLevel)}
              </span>
            </div>
          )}
        </div>

        {/* Footer - Coming soon features */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border">
          <button className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors">
            View Details
          </button>
        </div>
      </div>
    </Popup>
  );
}
