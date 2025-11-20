"use client";

import { useState, useEffect, useRef } from "react";
import { Mood } from "@/app/page";
import { ArrowLeft, MapPin } from "lucide-react";
import type { Venue } from "@/lib/types";
import { getScoreTier } from "@/lib/scoring";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface MapViewProps {
  mood: Mood;
  onBack: () => void;
}

interface VenueWithScore extends Venue {
  meetingScore?: number;
  scoreBreakdown?: {
    total: number;
    genderBalance: number;
    activityLevel: number;
    socialibility: number;
    quality: number;
    vibe: number;
  };
  activityPrediction?: {
    prediction: "High" | "Medium" | "Low";
    confidence: number;
    bestTime?: string;
  };
  noiseComplaints?: number;
  lastComplaint?: Date;
}

const moodLabels = {
  cocktails: "🍸 Nice cocktails",
  dive: "🍺 Dive loser",
  sports: "🏈 Sports",
  love: "💕 Find love",
  dance: "💃 Dance",
};

export function MapViewClean({ mood, onBack }: MapViewProps) {
  const [selectedVenue, setSelectedVenue] = useState<VenueWithScore | null>(null);
  const [venues, setVenues] = useState<VenueWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Fetch venues from API
  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const url = mood ? `/api/venues?mood=${mood}` : "/api/venues";
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch venues");
        const data = await response.json();
        setVenues(data.venues || []);
      } catch (err) {
        console.error("Error fetching venues:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, [mood]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set!");
      return;
    }

    mapboxgl.accessToken = token;

    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12", // Light, clean map style
      center: [-73.9712, 40.7831],
      zoom: 11,
    });

    map.current = newMap;
    newMap.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when venues change
  useEffect(() => {
    if (!map.current || venues.length === 0) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add new markers with women emojis and minimal design
    venues.forEach((venue) => {
      const tier = venue.meetingScore ? getScoreTier(venue.meetingScore) : null;
      const score = venue.meetingScore || 0;

      // Simple color scale for score badge
      let bgColor = "bg-gray-500"; // Default
      if (score >= 80) {
        bgColor = "bg-purple-500"; // Elite/Excellent
      } else if (score >= 70) {
        bgColor = "bg-blue-500"; // Good
      } else if (score >= 60) {
        bgColor = "bg-cyan-500"; // Decent
      }

      const el = document.createElement("div");
      el.className = "custom-marker";
      el.style.cssText = "cursor: pointer;";
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; pointer-events: auto;">
          <div style="font-size: 32px; margin-bottom: 2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
            ${tier?.emoji || "📍"}
          </div>
          <div class="${bgColor}" style="color: white; font-size: 13px; padding: 4px 10px; border-radius: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            ${score}
          </div>
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedVenue(venue);
        setDrawerOpen(true);
        map.current?.flyTo({
          center: [venue.coordinates.lng, venue.coordinates.lat],
          zoom: 14,
        });
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([venue.coordinates.lng, venue.coordinates.lat])
        .addTo(map.current!);

      markers.current.push(marker);
    });

    // Fit map to show all markers
    if (venues.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      venues.forEach((venue) => {
        bounds.extend([venue.coordinates.lng, venue.coordinates.lat]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
  }, [venues]);

  const getPriceSymbol = (level: number) => "$".repeat(level);

  console.log("🎨 MapViewClean render - venues:", venues.length, "loading:", loading, "drawerOpen:", drawerOpen);

  return (
    <div className="fixed inset-0 w-full h-full">
      {/* Map as background - NOTHING can cover it */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Back button with frosted glass effect */}
      <button
        onClick={() => {
          console.log("⬅️ Back button clicked");
          onBack();
        }}
        className="absolute top-4 left-4 z-50 glass-light rounded-full p-3 hover:bg-white/90 transition-all shadow-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <ArrowLeft className="w-5 h-5 text-foreground" />
      </button>

      {/* Drawer component - slides up from bottom */}
      <Drawer open={drawerOpen} onOpenChange={(open) => {
        console.log("🗂️ Drawer state changing to:", open);
        setDrawerOpen(open);
      }}>
        <DrawerTrigger asChild>
          <button
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-full px-6 py-3 hover:bg-white/95 transition-all shadow-xl"
            style={{ pointerEvents: 'auto' }}
          >
            <span className="text-sm font-semibold text-foreground">
              {loading ? "Loading..." : `${venues.length} venues`}
            </span>
          </button>
        </DrawerTrigger>

        <DrawerContent className="max-h-[80vh] bg-white/95 backdrop-blur-xl shadow-2xl">
          <DrawerHeader>
            <DrawerTitle>
              {selectedVenue ? selectedVenue.name : `${venues.length} Venues`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-8">
            {/* Venue list sorted by score */}
            <div className="grid gap-3">
              {[...venues]
                .sort((a, b) => (b.meetingScore || 0) - (a.meetingScore || 0))
                .map((venue, index) => {
                  const tier = venue.meetingScore ? getScoreTier(venue.meetingScore) : null;
                  const score = venue.meetingScore || 0;

                  // Badge color based on score - simple, minimal
                  let badgeColor = "bg-gray-100 text-gray-700";
                  if (score >= 80) badgeColor = "bg-purple-500 text-white";
                  else if (score >= 70) badgeColor = "bg-blue-500 text-white";
                  else if (score >= 60) badgeColor = "bg-cyan-500 text-white";

                  return (
                    <button
                      key={venue.id}
                      onClick={() => {
                        console.log("🏢 Venue clicked:", venue.name);
                        setSelectedVenue(venue);
                      }}
                      className="text-left p-4 rounded-lg border border-border/50 hover:bg-accent transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{tier?.emoji || "📍"}</span>
                            <h3 className="font-semibold">{venue.name}</h3>
                            {index < 3 && (
                              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-semibold">
                                TOP {index + 1}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>{venue.neighborhood}</span>
                          </div>
                        </div>
                        {venue.meetingScore !== undefined && (
                          <div className={`${badgeColor} text-2xl font-bold px-4 py-2 rounded-full shadow-md`}>
                            {venue.meetingScore}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
