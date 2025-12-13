"use client";

import { useState, useEffect, useRef } from "react";
import { Mood } from "@/lib/types";
import { ArrowLeft, MapPin, Flame, RefreshCcw, Map as MapIcon } from "lucide-react";
import type { Venue as PrismaVenue } from "@prisma/client";
import { getScoreTier, calculateDynamicMeetingScore, type EnabledFactors, type VenueScoreData } from "@/lib/scoring";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Search, X } from "lucide-react";

interface MapViewProps {
  mood: Mood;
  onBack: () => void;
}

interface Venue extends Omit<PrismaVenue, 'meetingScore'> {
  coordinates: {
    lat: number;
    lng: number;
  };
  meetingScore?: number;
}

interface VenueWithScore extends Venue {
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
}

type LiveVenue = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  neighborhood: string;
  venueType: string | null;
  meetingScore: number | null;
  rating: number | null;
  noiseComplaints: number | null;
  live: { available: boolean; liveBusyness: number | null; forecastBusyness: number | null };
};

type LiveResponse = {
  mode: "hot" | "radar";
  hasBestTimeKey: boolean;
  updatedAt: string;
  venues: LiveVenue[];
  geojson: GeoJSON.FeatureCollection;
};

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
  const [drawerMode, setDrawerMode] = useState<"venues" | "live">("venues");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VenueWithScore[]>([]);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [liveMode, setLiveMode] = useState<"hot" | "radar">("hot");
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveData, setLiveData] = useState<LiveResponse | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [placesVisible, setPlacesVisible] = useState(true);
  const [enabledFactors, setEnabledFactors] = useState<EnabledFactors>({
    genderBalance: true,
    socialVibe: true,
    quality: true,
    socialibility: true,
    activityLevel: true,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const venuesRef = useRef<VenueWithScore[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  async function fetchLive(mode: "hot" | "radar") {
    try {
      setLiveLoading(true);
      setLiveError(null);

      const qs = new URLSearchParams();
      qs.set("mode", mode);
      qs.set("limit", mode === "radar" ? "80" : "250");

      if (mode === "radar") {
        const loc = userLocation;
        if (!loc) throw new Error("Location not available");
        qs.set("lat", String(loc.lat));
        qs.set("lng", String(loc.lng));
        qs.set("radiusMeters", "2500");
      }

      const res = await fetch(`/api/live?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch live data");
      const data = (await res.json()) as LiveResponse;
      setLiveData(data);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Failed to fetch live data");
    } finally {
      setLiveLoading(false);
    }
  }

  function requestLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(err.message || "Location permission denied")),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
      );
    });
  }

  // Heatmap-first UX: fetch hotspots on load
  useEffect(() => {
    setLiveMode("hot");
    setDrawerMode("live");
    fetchLive("hot");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch ALL venues (base layer shows everything, not filtered by mood)
  useEffect(() => {
    async function fetchVenues() {
      try {
        setLoading(true);
        // Fetch all venues for base layer - mood filtering will be done in Phase 2 heatmap
        const response = await fetch("/api/venues");
        if (!response.ok) throw new Error("Failed to fetch venues");
        const data = await response.json();
        console.log("📍 Fetched venues:", data.venues?.length || 0);
        setVenues(data.venues || []);
      } catch (err) {
        console.error("Error fetching venues:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVenues();
  }, []);

  // Initialize map with clustering layers
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
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-73.9712, 40.7831],
      zoom: 11,
    });

    map.current = newMap;

    newMap.on("load", () => {
      setMapLoaded(true);

      // Add GeoJSON source with clustering
      newMap.addSource("venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Live heat source (not clustered)
      newMap.addSource("live-venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Heat layer (hidden by default)
      newMap.addLayer({
        id: "live-heat",
        type: "heatmap",
        source: "live-venues",
        maxzoom: 15,
        layout: {
          visibility: "none",
        },
        paint: {
          // Weight by forecasted busy-now 0..100 → 0..1
          "heatmap-weight": ["/", ["get", "busyNow"], 100],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 42],
          "heatmap-opacity": 0.55,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(59,130,246,0)",
            0.2,
            "rgba(59,130,246,0.35)",
            0.4,
            "rgba(147,51,234,0.45)",
            0.65,
            "rgba(236,72,153,0.55)",
            0.85,
            "rgba(245,158,11,0.7)",
            1,
            "rgba(239,68,68,0.75)",
          ],
        },
      });

      // Layer 1: Cluster circles
      // Glass shadow underlay (helps legibility on light map)
      newMap.addLayer({
        id: "clusters-shadow",
        type: "circle",
        source: "venues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "rgba(0,0,0,0.18)",
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20, // small clusters
            10, 26, // medium
            50, 34, // large
          ],
          "circle-blur": 0.6,
        },
      });

      newMap.addLayer({
        id: "clusters",
        type: "circle",
        source: "venues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "rgba(15,23,42,0.55)", // slate-900 glass (high contrast on light map)
            10, "rgba(15,23,42,0.50)", // medium
            50, "rgba(15,23,42,0.45)", // large
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18, // small clusters
            10, 24, // medium
            50, 32, // large
          ],
          "circle-opacity": 1,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "rgba(255,255,255,0.65)",
          // Soft edge to mimic iOS glass depth
          "circle-blur": 0.15,
        },
      });

      // Layer 2: Cluster count labels
      // Text shadow underlay (pseudo drop-shadow)
      newMap.addLayer({
        id: "cluster-count-shadow",
        type: "symbol",
        source: "venues",
        filter: ["has", "point_count"],
        layout: {
          "text-field": [
            "format",
            ["get", "point_count_abbreviated"],
            { "font-scale": 1.0 },
            "\n",
            {},
            "🍸",
            { "font-scale": 0.7 },
          ],
          "text-size": 11,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-offset": [0, 0.12],
          "text-justify": "center",
          "text-line-height": 1.0,
        },
        paint: {
          "text-color": "rgba(0,0,0,0.35)",
          "text-halo-color": "rgba(0,0,0,0)",
          "text-halo-width": 0,
        },
      });

      newMap.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "venues",
        filter: ["has", "point_count"],
        layout: {
          "text-field": [
            "format",
            ["get", "point_count_abbreviated"],
            { "font-scale": 1.0 },
            "\n",
            {},
            "🍸",
            { "font-scale": 0.7 },
          ],
          "text-size": 11,
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-justify": "center",
          "text-line-height": 1.0,
        },
        paint: {
          "text-color": "rgba(255,255,255,0.98)", // white for contrast
          "text-halo-color": "rgba(0,0,0,0.25)",
          "text-halo-width": 0.8,
          "text-halo-blur": 0.4,
        },
      });

      // Layer 3: Unclustered points (base layer - small gray dots)
      newMap.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "venues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["get", "isEnriched"],
            // Enriched venues: colored by score
            [
              "step",
              ["get", "meetingScore"],
              "#6b7280", // gray for low scores
              6, "#06b6d4", // cyan for 6+
              7, "#3b82f6", // blue for 7+
              8, "#a855f7", // purple for 8+
            ],
            // Base venues: subtle gray
            "#9ca3af",
          ],
          "circle-radius": [
            "case",
            ["get", "isEnriched"],
            10, // larger for enriched
            6, // smaller for base
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Layer 4: Venue name labels (high zoom only)
      newMap.addLayer({
        id: "venue-labels",
        type: "symbol",
        source: "venues",
        filter: ["!", ["has", "point_count"]],
        minzoom: 15,
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-max-width": 8,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });

      // Click on cluster → zoom in
      newMap.on("click", "clusters", (e) => {
        const features = newMap.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (!clusterId) return;

        (newMap.getSource("venues") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || !zoom) return;
            newMap.easeTo({
              center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
              zoom: zoom,
            });
          }
        );
      });

      // Click on venue → open drawer
      newMap.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties as any;
        const coords = (feature.geometry as GeoJSON.Point).coordinates;

        // Find full venue data from ref (avoids stale closure)
        const venue = venuesRef.current.find((v) => v.id === props.id);
        if (venue) {
          // Close any open popup and marker
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          if (markerRef.current) {
            markerRef.current.remove();
            markerRef.current = null;
          }

          setSelectedVenue(venue);
          setDrawerMode("venues");
          setDrawerOpen(true);
          // Only zoom in if needed, never zoom out
          const currentZoom = newMap.getZoom();
          newMap.flyTo({
            center: coords as [number, number],
            zoom: Math.max(currentZoom, 14),
          });
        }
      });

      // Cursor changes
      newMap.on("mouseenter", "clusters", () => {
        newMap.getCanvas().style.cursor = "pointer";
      });
      newMap.on("mouseleave", "clusters", () => {
        newMap.getCanvas().style.cursor = "";
      });
      newMap.on("mouseenter", "unclustered-point", () => {
        newMap.getCanvas().style.cursor = "pointer";
      });
      newMap.on("mouseleave", "unclustered-point", () => {
        newMap.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Recalculate venue scores based on enabled factors
  const getVenuesWithDynamicScores = () => {
    return venues.map((venue) => {
      // Convert venue to VenueScoreData format (null to undefined conversion)
      const scoreData: VenueScoreData = {
        venueType: venue.venueType ?? undefined,
        rating: venue.rating ?? undefined,
        noiseComplaints: venue.noiseComplaints ?? undefined,
        genderRatio: venue.genderRatio as any,
        reviewSentiment: venue.reviewSentiment as any,
      };

      // Calculate dynamic score based on enabled factors
      const scoreBreakdown = calculateDynamicMeetingScore(scoreData, enabledFactors);

      return {
        ...venue,
        meetingScore: scoreBreakdown.total,
        scoreBreakdown,
      };
    });
  };

  // Update GeoJSON source when venues change
  useEffect(() => {
    if (!map.current || !mapLoaded || venues.length === 0) return;

    const source = map.current.getSource("venues") as mapboxgl.GeoJSONSource;
    if (!source) return;

    const venuesWithScores = getVenuesWithDynamicScores();

    // Update ref for click handler (avoids stale closure)
    venuesRef.current = venuesWithScores;

    // Convert venues to GeoJSON features
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: venuesWithScores.map((venue) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [venue.coordinates.lng, venue.coordinates.lat],
        },
        properties: {
          id: venue.id,
          name: venue.name,
          address: venue.address,
          neighborhood: venue.neighborhood,
          meetingScore: venue.meetingScore || 0,
          isEnriched: !!(venue.genderRatio || venue.reviewSentiment || venue.noiseComplaints),
          rating: venue.rating,
          priceLevel: venue.priceLevel,
        },
      })),
    };

    console.log("🗺️ Updating map source with", geojson.features.length, "venues");
    source.setData(geojson);

    // Fit map to show all venues on initial load
    if (venuesWithScores.length > 0 && !selectedVenue) {
      const bounds = new mapboxgl.LngLatBounds();
      venuesWithScores.forEach((venue) => {
        bounds.extend([venue.coordinates.lng, venue.coordinates.lat]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 13 });
    }
  }, [venues, enabledFactors, mapLoaded]);

  // Update Live GeoJSON source + heat layer visibility
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const src = map.current.getSource("live-venues") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData(liveData?.geojson ?? { type: "FeatureCollection", features: [] });

    const visibility = liveEnabled ? "visible" : "none";
    if (map.current.getLayer("live-heat")) {
      map.current.setLayoutProperty("live-heat", "visibility", visibility);
    }
  }, [mapLoaded, liveData, liveEnabled]);

  // Places toggle: show/hide the venue dot layers so the heatmap stays legible
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const visibility = placesVisible ? "visible" : "none";
    const layers = ["clusters", "cluster-count", "unclustered-point", "venue-labels"] as const;
    for (const layerId of layers) {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }, [mapLoaded, placesVisible]);

  const getPriceSymbol = (level: number) => "$".repeat(level);

  console.log("🎨 MapViewClean render - venues:", venues.length, "loading:", loading, "drawerOpen:", drawerOpen);

  return (
    <div className="fixed inset-0" style={{ width: '100%', height: '100%' }}>
      {/* Map as background - extends behind iOS safe areas */}
      <div
        ref={mapContainer}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0
        }}
      />

      {/* Top overlays (safe-area padded; map stays full-bleed) */}
      <div className="absolute inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pointer-events-none">
        <div className="relative h-14">
          {/* Back button with frosted glass effect */}
          <button
            onClick={() => {
              console.log("⬅️ Back button clicked");
              onBack();
            }}
            className="absolute left-4 top-4 glass-light rounded-full p-3 hover:bg-white/90 transition-all shadow-lg pointer-events-auto"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>

          {/* Search bar - center top */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 w-48 pointer-events-auto">
            <div className="relative">
          <div className="glass-light rounded-full shadow-lg flex items-center px-3 h-11">
            <Search className="w-5 h-5 text-gray-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search bars..."
              value={searchQuery}
              onChange={(e) => {
                const query = e.target.value;
                setSearchQuery(query);
                if (query.length > 0) {
                  const filtered = venues.filter((v) =>
                    v.name.toLowerCase().includes(query.toLowerCase()) ||
                    v.neighborhood.toLowerCase().includes(query.toLowerCase())
                  );
                  setSearchResults(filtered.slice(0, 5));
                } else {
                  setSearchResults([]);
                }
              }}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-gray-400 text-sm"
              style={{ pointerEvents: 'auto' }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
                style={{ pointerEvents: 'auto' }}
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 glass rounded-xl shadow-xl overflow-hidden" style={{ pointerEvents: 'auto' }}>
              {searchResults.map((venue) => (
                <button
                  key={venue.id}
                  onClick={() => {
                    setSelectedVenue(venue);
                    setSearchQuery("");
                    setSearchResults([]);

                    // Fly to venue
                    map.current?.flyTo({
                      center: [venue.coordinates.lng, venue.coordinates.lat],
                      zoom: 15,
                    });

                    // Remove existing popup and marker
                    if (popupRef.current) {
                      popupRef.current.remove();
                    }
                    if (markerRef.current) {
                      markerRef.current.remove();
                    }

                    // Create a custom pin marker at the venue location
                    const markerEl = document.createElement('div');
                    markerEl.className = 'selected-marker';
                    markerEl.innerHTML = `
                      <div style="position: relative; width: 40px; height: 48px;">
                        <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <linearGradient id="pin-gradient" x1="0" y1="0" x2="0" y2="48">
                              <stop offset="0%" stop-color="#a855f7"/>
                              <stop offset="100%" stop-color="#7c3aed"/>
                            </linearGradient>
                            <filter id="shadow" x="-20%" y="-10%" width="140%" height="130%">
                              <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
                            </filter>
                          </defs>
                          <path d="M20 0C9 0 0 9 0 20c0 13 20 28 20 28s20-15 20-28C40 9 31 0 20 0z" fill="url(#pin-gradient)" filter="url(#shadow)"/>
                          <circle cx="20" cy="17" r="10" fill="white"/>
                        </svg>
                        <span style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 16px;">🍸</span>
                      </div>
                    `;
                    markerEl.style.cssText = `cursor: pointer;`;
                    markerEl.addEventListener('click', () => {
                      // Just open drawer, keep marker visible
                      setDrawerOpen(true);
                    });

                    markerRef.current = new mapboxgl.Marker({
                      element: markerEl,
                      anchor: 'bottom'  // Pin tip at exact location
                    })
                      .setLngLat([venue.coordinates.lng, venue.coordinates.lat])
                      .addTo(map.current!);

                    // Show popup with venue name (clickable to open drawer)
                    const popupContent = document.createElement('div');
                    popupContent.innerHTML = `
                      <div style="padding: 10px 14px; font-weight: 600; font-size: 14px; cursor: pointer;">
                        ${venue.name}
                      </div>
                    `;
                    popupContent.addEventListener('click', () => {
                      setDrawerOpen(true);
                    });

                    popupRef.current = new mapboxgl.Popup({
                      closeButton: false,
                      closeOnClick: false,
                      offset: [0, -48],  // Position above the 48px tall marker
                      className: 'venue-popup',
                    })
                      .setLngLat([venue.coordinates.lng, venue.coordinates.lat])
                      .setDOMContent(popupContent)
                      .addTo(map.current!);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-black/5 transition-colors border-b border-black/5 last:border-b-0"
                >
                  <div className="font-medium text-foreground text-sm">{venue.name}</div>
                  <div className="text-xs text-gray-500">{venue.neighborhood}</div>
                </button>
              ))}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Live controls (glass) */}
      <div className="absolute inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+4.5rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pointer-events-none flex justify-center">
        <div className="pointer-events-auto glass-light rounded-full shadow-lg flex items-center gap-1 px-2 py-1">
          <button
            className={`rounded-full px-3 py-2 text-xs font-semibold transition-all flex items-center gap-2 ${
              liveEnabled ? "bg-white/90" : "hover:bg-white/70"
            }`}
            onClick={async () => {
              const next = !liveEnabled;
              setLiveEnabled(next);
              if (next) {
                setLiveMode("hot");
                setDrawerMode("live");
                setSelectedVenue(null);
                setDrawerOpen(true);
                await fetchLive("hot");
              }
            }}
          >
            <Flame className="w-4 h-4" />
            Hotspots
          </button>

          <button
            className={`rounded-full px-3 py-2 text-xs font-semibold transition-all flex items-center gap-2 ${
              placesVisible ? "bg-white/90" : "hover:bg-white/70"
            }`}
            onClick={() => setPlacesVisible((v) => !v)}
          >
            <MapIcon className="w-4 h-4" />
            Places
          </button>

          <button
            className="rounded-full px-3 py-2 text-xs font-semibold hover:bg-white/70 transition-all flex items-center gap-2 disabled:opacity-50"
            disabled={!liveEnabled || liveLoading}
            onClick={async () => {
              if (!liveEnabled) return;
              await fetchLive(liveMode);
            }}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer component - slides up from bottom */}
      <Drawer open={drawerOpen} onOpenChange={(open) => {
        console.log("🗂️ Drawer state changing to:", open);
        setDrawerOpen(open);
      }}>
        <DrawerTrigger asChild>
          <div className="absolute inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pointer-events-none flex justify-center">
            <button className="glass rounded-full px-6 py-3 hover:bg-white/95 transition-all shadow-xl pointer-events-auto">
              <span className="text-sm font-semibold text-foreground">
                {loading ? "Loading..." : `${venues.length} venues`}
              </span>
            </button>
          </div>
        </DrawerTrigger>

        <DrawerContent className="max-h-[50vh] bg-white/95 backdrop-blur-xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
          {selectedVenue ? (
            // Single venue detail view
            <div className="p-6">
              <DrawerTitle className="text-xl font-bold mb-1">{selectedVenue.name}</DrawerTitle>
              <p className="text-gray-600 mb-1">{selectedVenue.address}</p>
              <p className="text-gray-500 text-sm mb-4">{selectedVenue.neighborhood}</p>

              {/* Show score if enriched */}
              {selectedVenue.meetingScore !== undefined && selectedVenue.meetingScore > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm text-gray-500">Meeting Score:</span>
                  <span className={`px-3 py-1 rounded-full text-white font-bold ${
                    selectedVenue.meetingScore >= 8 ? 'bg-purple-500' :
                    selectedVenue.meetingScore >= 7 ? 'bg-blue-500' :
                    selectedVenue.meetingScore >= 6 ? 'bg-cyan-500' : 'bg-gray-500'
                  }`}>
                    {selectedVenue.meetingScore}
                  </span>
                </div>
              )}

              <button
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                onClick={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selectedVenue.name} ${selectedVenue.address}`)}`;
                  window.open(url, '_blank');
                }}
              >
                <MapPin className="w-5 h-5" />
                Open in Google Maps
              </button>

              <button
                className="w-full mt-2 text-gray-500 hover:text-gray-700 py-2 text-sm"
                onClick={() => setSelectedVenue(null)}
              >
                ← Back to list
              </button>
            </div>
          ) : (
            drawerMode === "live" ? (
              <>
                <DrawerHeader>
                  <DrawerTitle className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Flame className="w-5 h-5 text-foreground" />
                      Live {liveMode === "radar" ? "Radar" : "Hot Now"}
                    </span>
                    {liveData?.updatedAt && (
                      <span className="text-xs font-medium text-muted-foreground">
                        Updated {new Date(liveData.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </DrawerTitle>
                </DrawerHeader>

                <div className="overflow-y-auto px-4 pb-8">
                  {!liveEnabled && (
                    <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
                      Turn on <span className="font-semibold text-foreground">Live</span> to see foot traffic.
                    </div>
                  )}

                  {liveEnabled && liveLoading && (
                    <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
                      Fetching live data…
                    </div>
                  )}

                  {liveEnabled && liveError && (
                    <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
                      {liveError}
                    </div>
                  )}

                  {liveEnabled && liveData && !liveData.hasBestTimeKey && (
                    <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
                      Missing <span className="font-semibold text-foreground">BESTTIME_API_KEY_PRIVATE</span>. Live data will show once it’s set.
                    </div>
                  )}

                  <div className="grid gap-3 mt-4">
                    {(liveData?.venues ?? []).slice(0, 60).map((v) => {
                      const busy = v.live.forecastBusyness;
                      const badge = busy === null ? "—" : `${busy}%`;
                      const badgeTone =
                        busy === null
                          ? "bg-gray-100 text-gray-700"
                          : busy >= 80
                            ? "bg-red-500 text-white"
                            : busy >= 60
                              ? "bg-orange-500 text-white"
                              : busy >= 40
                                ? "bg-purple-500 text-white"
                                : "bg-blue-500 text-white";

                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            map.current?.flyTo({ center: [v.lng, v.lat], zoom: 14 });
                          }}
                          className="text-left p-4 rounded-lg border border-border/50 hover:bg-accent transition-all"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">📍</span>
                                <h3 className="font-semibold">{v.name}</h3>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                <span>{v.neighborhood}</span>
                              </div>
                            </div>
                            <div className={`${badgeTone} text-lg font-bold px-3 py-1 rounded-full shadow-md`}>
                              {badge}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              // Venue list view
              <>
                <DrawerHeader>
                  <DrawerTitle>{venues.length} Venues</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-8">
                  <div className="grid gap-3">
                    {getVenuesWithDynamicScores()
                      .sort((a, b) => (b.meetingScore || 0) - (a.meetingScore || 0))
                      .map((venue, index) => {
                        const tier = venue.meetingScore ? getScoreTier(venue.meetingScore) : null;
                        const score = venue.meetingScore || 0;

                        let badgeColor = "bg-gray-100 text-gray-700";
                        if (score >= 8) badgeColor = "bg-purple-500 text-white";
                        else if (score >= 7) badgeColor = "bg-blue-500 text-white";
                        else if (score >= 6) badgeColor = "bg-cyan-500 text-white";

                        return (
                          <button
                            key={venue.id}
                            onClick={() => {
                              setDrawerMode("venues");
                              setSelectedVenue(venue);
                              map.current?.flyTo({
                                center: [venue.coordinates.lng, venue.coordinates.lat],
                                zoom: 14,
                              });
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
                              {score > 0 && (
                                <div className={`${badgeColor} text-2xl font-bold px-4 py-2 rounded-full shadow-md`}>
                                  {score}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </>
            )
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
