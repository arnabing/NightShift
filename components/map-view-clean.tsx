"use client";

import { useState, useEffect, useRef } from "react";
import { Mood } from "@/lib/types";
import { ArrowLeft, MapPin, Layers } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  const [layerFilterOpen, setLayerFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VenueWithScore[]>([]);
  const [enabledFactors, setEnabledFactors] = useState<EnabledFactors>({
    genderBalance: true,
    socialVibe: true,
    quality: true,
    socialibility: true,
    activityLevel: true,
  });
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoaded = useRef(false);
  const venuesRef = useRef<VenueWithScore[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

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
      mapLoaded.current = true;

      // Add GeoJSON source with clustering
      newMap.addSource("venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Layer 1: Cluster circles
      newMap.addLayer({
        id: "clusters",
        type: "circle",
        source: "venues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#94a3b8", // slate-400 for small
            10, "#64748b", // slate-500 for medium
            50, "#475569", // slate-600 for large
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18, // small clusters
            10, 24, // medium
            50, 32, // large
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Layer 2: Cluster count labels
      newMap.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "venues",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
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
      mapLoaded.current = false;
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
    if (!map.current || !mapLoaded.current || venues.length === 0) return;

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
  }, [venues, enabledFactors]);

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

      {/* Search bar - center top */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-48">
        <div className="relative">
          <div className="glass-light rounded-full shadow-lg flex items-center px-3 h-11">
            <Search className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
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

      {/* Layer filter button - Google Maps style */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setLayerFilterOpen(!layerFilterOpen)}
          className="glass-light rounded-full p-3 hover:bg-white/90 transition-all shadow-lg"
          style={{ pointerEvents: 'auto' }}
        >
          <Layers className="w-5 h-5 text-foreground" />
        </button>

        {/* Layer filter dropdown */}
        {layerFilterOpen && (
          <div className="absolute top-14 right-0 glass rounded-lg p-4 shadow-xl min-w-[260px]" style={{ pointerEvents: 'auto' }}>
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground mb-3">Score Factors</div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="gender"
                  checked={enabledFactors.genderBalance}
                  onCheckedChange={(checked) => setEnabledFactors({ ...enabledFactors, genderBalance: !!checked })}
                />
                <Label htmlFor="gender" className="text-sm text-foreground cursor-pointer">
                  Gender Demographics
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="vibe"
                  checked={enabledFactors.socialVibe}
                  onCheckedChange={(checked) => setEnabledFactors({ ...enabledFactors, socialVibe: !!checked })}
                />
                <Label htmlFor="vibe" className="text-sm text-foreground cursor-pointer">
                  Social Atmosphere
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="quality"
                  checked={enabledFactors.quality}
                  onCheckedChange={(checked) => setEnabledFactors({ ...enabledFactors, quality: !!checked })}
                />
                <Label htmlFor="quality" className="text-sm text-foreground cursor-pointer">
                  Quality Ratings
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="venueType"
                  checked={enabledFactors.socialibility}
                  onCheckedChange={(checked) => setEnabledFactors({ ...enabledFactors, socialibility: !!checked })}
                />
                <Label htmlFor="venueType" className="text-sm text-foreground cursor-pointer">
                  Venue Type
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="activity"
                  checked={enabledFactors.activityLevel}
                  onCheckedChange={(checked) => setEnabledFactors({ ...enabledFactors, activityLevel: !!checked })}
                />
                <Label htmlFor="activity" className="text-sm text-foreground cursor-pointer">
                  NYC 311 Activity
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>

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

        <DrawerContent className="max-h-[50vh] bg-white/95 backdrop-blur-xl shadow-2xl">
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
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
