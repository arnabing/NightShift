"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Mood } from "@/app/page";
import { ArrowLeft } from "lucide-react";
import type { Venue } from "@/lib/types";

// Dynamically import map components to prevent SSR
const MapContainer = dynamic(() => import("./map/map-container").then((mod) => ({ default: mod.MapContainer })), {
  ssr: false,
  loading: () => <div className="flex-1 flex items-center justify-center">Loading map...</div>,
});

const VenuePopup = dynamic(() => import("./map/venue-popup").then((mod) => ({ default: mod.VenuePopup })), {
  ssr: false,
});

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

      {/* Map Container */}
      <MapContainer
        venues={filteredVenues}
        onVenueClick={setSelectedVenue}
        selectedVenueId={selectedVenue?.id}
      />

      {/* Venue Popup */}
      {selectedVenue && (
        <VenuePopup venue={selectedVenue} onClose={() => setSelectedVenue(null)} />
      )}
    </div>
  );
}
