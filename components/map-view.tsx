"use client";

import { useState } from "react";
import { Mood } from "@/app/page";
import { ArrowLeft, MapPin } from "lucide-react";
import type { Venue } from "@/lib/types";

interface MapViewProps {
  mood: Mood;
  onBack: () => void;
}

const moodLabels = {
  cocktails: "🍸 Nice cocktails",
  dive: "🍺 Dive loser",
  sports: "🏈 Sports",
  love: "💕 Find love",
  dance: "💃 Dance",
};

// Test venues for MVP - will be replaced with API data
const TEST_VENUES: Venue[] = [
  {
    id: "1",
    name: "Death & Co",
    coordinates: { lat: 40.7264, lng: -73.9838 },
    address: "433 E 6th St, New York, NY 10009",
    neighborhood: "East Village",
    moods: ["cocktails", "love"],
    rating: 4.5,
    priceLevel: 3,
  },
  {
    id: "2",
    name: "Employees Only",
    coordinates: { lat: 40.7343, lng: -74.0021 },
    address: "510 Hudson St, New York, NY 10014",
    neighborhood: "West Village",
    moods: ["cocktails"],
    rating: 4.6,
    priceLevel: 3,
  },
  {
    id: "3",
    name: "Marie's Crisis",
    coordinates: { lat: 40.7338, lng: -74.0020 },
    address: "59 Grove St, New York, NY 10014",
    neighborhood: "West Village",
    moods: ["dive", "love"],
    rating: 4.4,
    priceLevel: 1,
  },
  {
    id: "4",
    name: "Peculier Pub",
    coordinates: { lat: 40.7298, lng: -73.9974 },
    address: "145 Bleecker St, New York, NY 10012",
    neighborhood: "Greenwich Village",
    moods: ["dive", "sports"],
    rating: 4.2,
    priceLevel: 2,
  },
  {
    id: "5",
    name: "Boxers HK",
    coordinates: { lat: 40.7618, lng: -73.9896 },
    address: "742 9th Ave, New York, NY 10019",
    neighborhood: "Hell's Kitchen",
    moods: ["sports", "love"],
    rating: 4.3,
    priceLevel: 2,
  },
  {
    id: "6",
    name: "House of Yes",
    coordinates: { lat: 40.7090, lng: -73.9345 },
    address: "2 Wyckoff Ave, Brooklyn, NY 11237",
    neighborhood: "Bushwick",
    moods: ["dance", "love"],
    rating: 4.5,
    priceLevel: 2,
  },
  {
    id: "7",
    name: "Output",
    coordinates: { lat: 40.7213, lng: -73.9584 },
    address: "74 Wythe Ave, Brooklyn, NY 11249",
    neighborhood: "Williamsburg",
    moods: ["dance"],
    rating: 4.4,
    priceLevel: 3,
  },
];

export function MapView({ mood, onBack }: MapViewProps) {
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // Filter venues by selected mood
  const filteredVenues = mood
    ? TEST_VENUES.filter((venue) => venue.moods.includes(mood))
    : TEST_VENUES;

  const getPriceSymbol = (level: number) => "$".repeat(level);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="glass-light border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{mood && moodLabels[mood]?.split(" ")[0]}</span>
            <h2 className="text-lg font-semibold">
              {mood && moodLabels[mood]?.substring(2)}
            </h2>
          </div>

          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </div>

      {/* Venue List - Temporary placeholder until map is ready */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6 glass-light rounded-lg p-4 border border-border/50">
            <p className="text-sm text-muted-foreground text-center">
              Interactive map coming soon! Here are {filteredVenues.length} venues matching your vibe:
            </p>
          </div>

          <div className="grid gap-4">
            {filteredVenues.map((venue) => (
              <button
                key={venue.id}
                onClick={() => setSelectedVenue(venue)}
                className="glass-light rounded-xl p-5 border border-border/50 hover:border-primary/50 transition-all text-left hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{venue.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4" />
                      <span>{venue.neighborhood}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{venue.address}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-sm font-medium">⭐ {venue.rating}</div>
                    <div className="text-sm text-muted-foreground">
                      {venue.priceLevel ? getPriceSymbol(venue.priceLevel) : "N/A"}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedVenue(null)}
        >
          <div
            className="glass-light rounded-2xl p-6 max-w-md w-full border border-border/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold">{selectedVenue.name}</h2>
              <button
                onClick={() => setSelectedVenue(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedVenue.neighborhood}</p>
                  <p className="text-sm text-muted-foreground">{selectedVenue.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <div>
                  <span className="text-sm text-muted-foreground">Rating</span>
                  <p className="font-semibold">⭐ {selectedVenue.rating}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Price</span>
                  <p className="font-semibold">
                    {selectedVenue.priceLevel ? getPriceSymbol(selectedVenue.priceLevel) : "N/A"}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-sm text-muted-foreground">Vibes</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedVenue.moods
                    .filter((m): m is Exclude<Mood, null> => m !== null)
                    .map((m) => (
                      <span
                        key={m}
                        className="px-3 py-1 rounded-full bg-primary/10 text-sm"
                      >
                        {moodLabels[m]}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
