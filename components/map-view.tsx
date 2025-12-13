"use client";

import { useState, useEffect, useRef } from "react";
import { Mood } from "@/lib/types";
import { ArrowLeft, MapPin, TrendingUp, Loader2, Map as MapIcon, List } from "lucide-react";
import type { Venue } from "@/lib/types";
import { getScoreTier } from "@/lib/scoring";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

// Test venues for fallback - will be replaced with API data
const TEST_VENUES: VenueWithScore[] = [
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
  const [selectedVenue, setSelectedVenue] = useState<VenueWithScore | null>(null);
  const [venues, setVenues] = useState<VenueWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  // Fetch venues from API
  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        const url = mood
          ? `/api/venues?mood=${mood}`
          : "/api/venues";

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("Failed to fetch venues");
        }

        const data = await response.json();
        setVenues(data.venues || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching venues:", err);
        setError("Failed to load venues");
        // Fallback to test venues
        setVenues(
          mood
            ? TEST_VENUES.filter((v) => v.moods.includes(mood))
            : TEST_VENUES
        );
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
    console.log("Initializing map with token:", token?.substring(0, 10) + "...");

    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set!");
      return;
    }

    // DIAGNOSTIC: Check container dimensions
    if (mapContainer.current) {
      const rect = mapContainer.current.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(mapContainer.current);
      console.log("🔍 Map container dimensions:", {
        clientWidth: mapContainer.current.clientWidth,
        clientHeight: mapContainer.current.clientHeight,
        offsetWidth: mapContainer.current.offsetWidth,
        offsetHeight: mapContainer.current.offsetHeight,
        boundingRect: {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        },
        computedStyle: {
          width: computedStyle.width,
          height: computedStyle.height,
          display: computedStyle.display,
          position: computedStyle.position
        }
      });

      if (mapContainer.current.clientHeight === 0) {
        console.error("❌ CRITICAL: Map container has zero height! This will cause the map to be invisible.");
      }
    }

    // DIAGNOSTIC: Check parent container
    const parentElement = mapContainer.current.parentElement;
    if (parentElement) {
      const parentRect = parentElement.getBoundingClientRect();
      console.log("🔍 Parent container (flex-1) dimensions:", {
        clientWidth: parentElement.clientWidth,
        clientHeight: parentElement.clientHeight,
        boundingRect: {
          width: parentRect.width,
          height: parentRect.height
        },
        computedStyle: {
          display: window.getComputedStyle(parentElement).display,
          flex: window.getComputedStyle(parentElement).flex,
          height: window.getComputedStyle(parentElement).height
        }
      });

      if (parentElement.clientHeight === 0) {
        console.error("❌ CRITICAL: Parent container (flex-1) has zero height!");
      }
    }

    mapboxgl.accessToken = token;

    try {
      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-73.9712, 40.7831], // NYC center
        zoom: 11,
      });

      // Store reference immediately so markers can be added
      map.current = newMap;

      newMap.addControl(new mapboxgl.NavigationControl(), "top-right");

      // DIAGNOSTIC: Check canvas after map creation
      setTimeout(() => {
        const canvas = mapContainer.current?.querySelector('canvas');
        if (canvas) {
          console.log("🔍 Map canvas element:", {
            width: canvas.width,
            height: canvas.height,
            style: {
              width: canvas.style.width,
              height: canvas.style.height,
              display: canvas.style.display,
              visibility: canvas.style.visibility
            },
            offsetParent: canvas.offsetParent,
            isVisible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
          });

          if (canvas.width === 0 || canvas.height === 0) {
            console.error("❌ CRITICAL: Canvas has zero dimensions!");
          }
        } else {
          console.error("❌ No canvas element found in map container!");
        }
      }, 100);

      newMap.on('load', () => {
        console.log("✅ Map loaded and ready");

        // DIAGNOSTIC: Check map container and canvas after load
        const container = mapContainer.current;
        const canvas = container?.querySelector('canvas');

        console.log("🔍 Map load diagnostics:", {
          mapExists: !!newMap,
          containerExists: !!container,
          containerDimensions: container ? {
            width: container.clientWidth,
            height: container.clientHeight
          } : null,
          canvasExists: !!canvas,
          canvasDimensions: canvas ? {
            width: canvas.width,
            height: canvas.height,
            styleWidth: canvas.style.width,
            styleHeight: canvas.style.height
          } : null,
          mapSize: newMap.getContainer().getBoundingClientRect()
        });
      });

      newMap.on('error', (e) => {
        console.error("❌ Mapbox GL error:", e);
      });
    } catch (error) {
      console.error("Error initializing map:", error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Add ResizeObserver to handle dynamic container resizing
  useEffect(() => {
    if (!mapContainer.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        console.log("📐 Map container resized:", { width, height });
        if (map.current && height > 0) {
          map.current.resize();
        }
      }
    });

    resizeObserver.observe(mapContainer.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Update markers when venues change
  useEffect(() => {
    if (!map.current || venues.length === 0) {
      console.log("Skipping markers - map:", !!map.current, "venues:", venues.length);
      return;
    }

    console.log("Adding", venues.length, "markers to map");

    // Ensure map is resized (in case container changed size)
    map.current.resize();

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add new markers
    venues.forEach((venue) => {
      const tier = venue.meetingScore ? getScoreTier(venue.meetingScore) : null;

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "custom-marker";
      el.innerHTML = `
        <div class="flex flex-col items-center cursor-pointer transition-transform hover:scale-110">
          <div class="text-2xl">${tier?.emoji || "📍"}</div>
          <div class="bg-black/80 text-white text-xs px-2 py-1 rounded-full font-bold">
            ${venue.meetingScore || "?"}
          </div>
        </div>
      `;

      el.addEventListener("click", () => {
        setSelectedVenue(venue);
        map.current?.flyTo({
          center: [venue.coordinates.lng, venue.coordinates.lat],
          zoom: 14,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
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

  return (
    <div className="flex-1 flex flex-col h-screen">
      {/* Header */}
      <div className="glass-light border-b border-border/50 flex-shrink-0">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("map")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === "map" ? (
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : null}

          {error && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
              <div className="glass-light rounded-lg p-4 border border-destructive/50">
                <p className="text-sm text-destructive text-center">
                  {error} - showing fallback data
                </p>
              </div>
            </div>
          )}

          <div ref={mapContainer} className="absolute inset-0 z-0" style={{ minHeight: '100%' }} />

          {!loading && venues.length > 0 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none">
              <div className="glass-light rounded-lg p-4 border border-border/50 pointer-events-auto">
                <p className="text-sm text-muted-foreground text-center">
                  Found {venues.length} venues sorted by meeting potential
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5">
          <div className="max-w-4xl mx-auto px-4 py-8">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="mb-6 glass-light rounded-lg p-4 border border-destructive/50">
                <p className="text-sm text-destructive text-center">
                  {error} - showing fallback data
                </p>
              </div>
            ) : (
              <div className="mb-6 glass-light rounded-lg p-4 border border-border/50">
                <p className="text-sm text-muted-foreground text-center">
                  Found {venues.length} venues sorted by meeting potential
                </p>
              </div>
            )}

            <div className="grid gap-4">
              {venues.map((venue) => {
              const tier = venue.meetingScore
                ? getScoreTier(venue.meetingScore)
                : null;

              return (
                <button
                  key={venue.id}
                  onClick={() => setSelectedVenue(venue)}
                  className="glass-light rounded-xl p-5 border border-border/50 hover:border-primary/50 transition-all text-left hover:scale-[1.02] hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{venue.name}</h3>
                        {tier && (
                          <span className={`text-sm ${tier.color}`}>
                            {tier.emoji}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{venue.neighborhood}</span>
                        {venue.activityPrediction && (
                          <>
                            <span>•</span>
                            <TrendingUp className="w-4 h-4" />
                            <span className={
                              venue.activityPrediction.prediction === "High"
                                ? "text-green-400"
                                : venue.activityPrediction.prediction === "Medium"
                                ? "text-yellow-400"
                                : "text-gray-400"
                            }>
                              {venue.activityPrediction.prediction} activity tonight
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{venue.address}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {venue.meetingScore !== undefined && (
                        <div className="text-2xl font-bold text-primary">
                          {venue.meetingScore}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {venue.rating ? `⭐ ${venue.rating}` : ""}
                        {venue.rating && venue.priceLevel ? " • " : ""}
                        {venue.priceLevel ? getPriceSymbol(venue.priceLevel) : ""}
                      </div>
                    </div>
                  </div>
                </button>
              );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Venue Detail Modal */}
      {selectedVenue && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedVenue(null)}
        >
          <div
            className="glass-light rounded-2xl p-6 max-w-md w-full border border-border/50 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedVenue.name}</h2>
                {selectedVenue.meetingScore !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-3xl font-bold text-primary">
                      {selectedVenue.meetingScore}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      meeting score
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedVenue(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Location */}
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedVenue.neighborhood}</p>
                  <p className="text-sm text-muted-foreground">{selectedVenue.address}</p>
                </div>
              </div>

              {/* Basic Info */}
              <div className="flex items-center gap-4 pt-2">
                {selectedVenue.rating && (
                  <div>
                    <span className="text-sm text-muted-foreground">Rating</span>
                    <p className="font-semibold">⭐ {selectedVenue.rating}</p>
                  </div>
                )}
                {selectedVenue.priceLevel && (
                  <div>
                    <span className="text-sm text-muted-foreground">Price</span>
                    <p className="font-semibold">
                      {getPriceSymbol(selectedVenue.priceLevel)}
                    </p>
                  </div>
                )}
                {selectedVenue.noiseComplaints !== undefined && (
                  <div>
                    <span className="text-sm text-muted-foreground">Activity</span>
                    <p className="font-semibold">{selectedVenue.noiseComplaints} reports</p>
                  </div>
                )}
              </div>

              {/* Activity Prediction */}
              {selectedVenue.activityPrediction && (
                <div className="pt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Tonight&apos;s Prediction</span>
                  </div>
                  <p className={`text-lg font-semibold ${
                    selectedVenue.activityPrediction.prediction === "High"
                      ? "text-green-400"
                      : selectedVenue.activityPrediction.prediction === "Medium"
                      ? "text-yellow-400"
                      : "text-gray-400"
                  }`}>
                    {selectedVenue.activityPrediction.prediction} Activity
                  </p>
                  {selectedVenue.activityPrediction.bestTime && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Best time: {selectedVenue.activityPrediction.bestTime}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Confidence: {selectedVenue.activityPrediction.confidence}%
                  </p>
                </div>
              )}

              {/* Score Breakdown */}
              {selectedVenue.scoreBreakdown && (
                <div className="pt-2">
                  <span className="text-sm font-medium mb-2 block">Score Breakdown</span>
                  <div className="space-y-2">
                    {[
                      { label: "Gender Balance", value: selectedVenue.scoreBreakdown.genderBalance, weight: "30%" },
                      { label: "Activity Level", value: selectedVenue.scoreBreakdown.activityLevel, weight: "25%" },
                      { label: "Socialibility", value: selectedVenue.scoreBreakdown.socialibility, weight: "20%" },
                      { label: "Quality", value: selectedVenue.scoreBreakdown.quality, weight: "15%" },
                      { label: "Vibe", value: selectedVenue.scoreBreakdown.vibe, weight: "10%" },
                    ].map(({ label, value, weight }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-28">{label} ({weight})</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vibes */}
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
