"use client";

import { Marker } from "react-map-gl";
import type { Venue } from "@/lib/types";
import { Mood } from "@/app/page";

interface VenueMarkerProps {
  venue: Venue;
  onClick?: (venue: Venue) => void;
  isSelected?: boolean;
}

// Map moods to emojis (matching the dial)
const MOOD_EMOJIS: Record<Exclude<Mood, null>, string> = {
  cocktails: "🍸",
  dive: "🍺",
  sports: "🏈",
  love: "💕",
  dance: "💃",
};

export function VenueMarker({ venue, onClick, isSelected }: VenueMarkerProps) {
  // Get primary mood emoji (first in array)
  const primaryMood = venue.moods[0];
  const emoji = primaryMood ? MOOD_EMOJIS[primaryMood as Exclude<Mood, null>] : "📍";

  return (
    <Marker
      longitude={venue.coordinates.lng}
      latitude={venue.coordinates.lat}
      anchor="bottom"
    >
      <button
        onClick={() => onClick?.(venue)}
        className={`
          group relative
          transition-all duration-300 transform
          ${isSelected ? "scale-125" : "scale-100 hover:scale-110"}
        `}
        aria-label={`${venue.name} - ${venue.neighborhood}`}
      >
        {/* Marker container with glass effect */}
        <div
          className={`
            relative px-3 py-2 rounded-full
            backdrop-blur-md border
            transition-all duration-300
            ${
              isSelected
                ? "bg-primary/90 border-primary neon-glow"
                : "bg-background/80 border-border/50 hover:bg-primary/70 hover:border-primary/50"
            }
          `}
        >
          {/* Emoji */}
          <span className="text-2xl leading-none block">{emoji}</span>

          {/* Multiple moods indicator */}
          {venue.moods.length > 1 && (
            <div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent border-2 border-background text-[10px] flex items-center justify-center font-bold"
              title={`${venue.moods.length} moods`}
            >
              {venue.moods.length}
            </div>
          )}
        </div>

        {/* Venue name label on hover */}
        <div
          className={`
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2
            px-3 py-1.5 rounded-lg
            bg-card/95 backdrop-blur-sm border border-border
            whitespace-nowrap text-sm font-medium
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            pointer-events-none
          `}
        >
          {venue.name}
          <div className="text-xs text-muted-foreground">{venue.neighborhood}</div>
        </div>

        {/* Pointing triangle for label */}
        <div
          className={`
            absolute bottom-full left-1/2 -translate-x-1/2 -mb-1
            w-2 h-2 rotate-45
            bg-card/95 border-r border-b border-border
            opacity-0 group-hover:opacity-100
            transition-opacity duration-200
            pointer-events-none
          `}
        />
      </button>
    </Marker>
  );
}
