"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Mood } from "@/lib/types";
import { MapPin, Flame, RefreshCcw, Map as MapIcon } from "lucide-react";
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
import { Search, X, LocateFixed, Loader2 } from "lucide-react";

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
  scale?: { mode: "relative"; minBusyNow: number; maxBusyNow: number; count: number };
  stale?: boolean;
  fallback?: "static";
  message?: string;
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
  const selectedVenueRef = useRef<VenueWithScore | null>(null);
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
  const [userLocationAccuracy, setUserLocationAccuracy] = useState<number | null>(null);
  const [userLocationUpdatedAt, setUserLocationUpdatedAt] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [placesVisible, setPlacesVisible] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const venuesPointsRef = useRef<
    Array<{
      id: string;
      lng: number;
      lat: number;
      name: string;
      neighborhood: string;
      address: string;
      meetingScore: number;
      isEnriched: boolean;
      rating: number | null;
      priceLevel: number | null;
      weight: number;
    }>
  >([]);

  useEffect(() => {
    selectedVenueRef.current = selectedVenue;
  }, [selectedVenue]);

  const venuesWithScores = useMemo(() => {
    return venues.map((venue) => {
      const scoreData: VenueScoreData = {
        venueType: venue.venueType ?? undefined,
        rating: venue.rating ?? undefined,
        noiseComplaints: venue.noiseComplaints ?? undefined,
        genderRatio: venue.genderRatio as any,
        reviewSentiment: venue.reviewSentiment as any,
      };

      const scoreBreakdown = calculateDynamicMeetingScore(scoreData, enabledFactors);

      return {
        ...venue,
        meetingScore: scoreBreakdown.total,
        scoreBreakdown,
      };
    });
  }, [venues, enabledFactors]);

  const selectVenue = (venue: VenueWithScore) => {
    setSelectedVenue(venue);
    setDrawerOpen(true);

    const m = map.current;
    if (m) {
      const currentZoom = m.getZoom();
      m.flyTo({
        center: [venue.coordinates.lng, venue.coordinates.lat],
        zoom: Math.max(currentZoom, 14),
      });
    }
  };

  const clearSearchAndSelection = () => {
    setSearchQuery("");
    setSearchResults([]);
    if (selectedVenue) {
      setSelectedVenue(null);
      setDrawerOpen(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 3200);
  };

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
      if (data.message) showToast(data.message);
      else if (data.stale) showToast("Showing cached hotspots.");
      else if (data.fallback === "static") showToast("Showing venue density.");
      else if (data.hasBestTimeKey && (data.geojson?.features?.length ?? 0) === 0) showToast("No hotspots returned. Tap refresh.");
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Failed to fetch live data");
      showToast("Hotspots unavailable. Tap refresh.");
    } finally {
      setLiveLoading(false);
    }
  }

  function requestLocation(opts?: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
  }): Promise<{ lat: number; lng: number; accuracy: number | null }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: typeof pos.coords.accuracy === "number" ? pos.coords.accuracy : null,
          }),
        (err) => {
          // Normalize common denial messages so we can show a friendly UX.
          if (err && (err as any).code === 1) {
            // PERMISSION_DENIED
            return reject(new Error("Location permission denied"));
          }
          return reject(new Error(err.message || "Location permission denied"));
        },
        // One-shot on demand. Defaults are battery-friendly unless overridden.
        {
          enableHighAccuracy: opts?.enableHighAccuracy ?? true,
          timeout: opts?.timeout ?? 8_000,
          maximumAge: opts?.maximumAge ?? 120_000,
        }
      );
    });
  }

  function makeCirclePolygon(lng: number, lat: number, radiusMeters: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
    // Approximate circle on Earth surface (good enough for 5–2000m)
    const earthRadius = 6378137; // meters
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;

    const latRad = toRad(lat);
    const lngRad = toRad(lng);
    const angular = radiusMeters / earthRadius;

    const coords: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const bearing = (2 * Math.PI * i) / steps;
      const sinLat = Math.sin(latRad);
      const cosLat = Math.cos(latRad);
      const sinAngular = Math.sin(angular);
      const cosAngular = Math.cos(angular);

      const lat2 = Math.asin(sinLat * cosAngular + cosLat * sinAngular * Math.cos(bearing));
      const lng2 =
        lngRad +
        Math.atan2(
          Math.sin(bearing) * sinAngular * cosLat,
          cosAngular - sinLat * Math.sin(lat2)
        );

      coords.push([toDeg(lng2), toDeg(lat2)]);
    }

    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [coords],
      },
    };
  }

  // Heatmap-first UX: fetch hotspots on load
  useEffect(() => {
    setLiveMode("hot");
    setDrawerMode("live");
    fetchLive("hot");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestAndCenterOnLocation = async () => {
    try {
      setHasRequestedLocation(true);

      // If we already have a recent fix, just recenter (fast + battery friendly).
      if (userLocation && userLocationUpdatedAt && Date.now() - userLocationUpdatedAt < 60_000) {
        map.current?.flyTo({
          center: [userLocation.lng, userLocation.lat],
          zoom: Math.max(map.current?.getZoom() ?? 11, 14),
        });
        return;
      }

      setLocating(true);

      // Geolocation requires a secure context (https) except on localhost.
      if (!window.isSecureContext) {
        showToast("Location requires HTTPS on iOS. Open the Vercel URL (or an HTTPS tunnel) and try again.");
        return;
      }

      // IMPORTANT: Trigger geolocation immediately on user tap.
      // Some browsers drop the permission prompt if you await before calling getCurrentPosition.
      // Also request a FRESH fix (no cache) so the dot matches the user's current position.
      const locPromise = requestLocation({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 });
      const loc = await locPromise;
      setUserLocation({ lat: loc.lat, lng: loc.lng });
      setUserLocationAccuracy(loc.accuracy);
      setUserLocationUpdatedAt(Date.now());

      if (loc.accuracy && loc.accuracy > 500) showToast(`Location updated (±${Math.round(loc.accuracy)}m).`);
      else showToast("Location updated.");

      // If Radar is active, refresh live data around you
      if (liveEnabled && liveMode === "radar") {
        await fetchLive("radar");
      }

      map.current?.flyTo({
        center: [loc.lng, loc.lat],
        zoom: Math.max(map.current?.getZoom() ?? 11, 14),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to get location";
      // Unify copy for blocked/denied so it’s actionable.
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")) {
        showToast("Location is off. Enable it in Safari settings.");
      } else {
        showToast("Couldn’t get location.");
      }
    } finally {
      setLocating(false);
    }
  };

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
      // Remove the compact attribution "i" button; we'll show a tiny custom attribution label instead.
      attributionControl: false,
    });

    map.current = newMap;

    newMap.on("load", () => {
      setMapLoaded(true);

      // Add GeoJSON source with clustering
      newMap.addSource("venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Live heat source (not clustered)
      newMap.addSource("live-venues", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // User location (blue dot + accuracy circle)
      newMap.addSource("user-location-point", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      newMap.addSource("user-location-accuracy", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Heat layer (hidden by default)
      newMap.addLayer({
        id: "live-heat",
        type: "heatmap",
        source: "live-venues",
        // Keep heatmap visible while zooming in (Mapbox hides heatmaps past maxzoom)
        maxzoom: 22,
        layout: {
          visibility: "none",
        },
        paint: {
          // Weight by busy-now (relative when available) so the map never "looks dead"
          // when the API returns data but values are low.
          "heatmap-weight": [
            "max",
            0.05,
            [
              "coalesce",
              ["get", "heatWeight"],
              ["/", ["get", "busyNow"], 100],
            ],
          ],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.8, 14, 1.2],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 42],
          "heatmap-opacity": 0.55,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(59,130,246,0)",
            0.05,
            "rgba(59,130,246,0.18)",
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
          // Default style (heatmap-first). NOTE: Mapbox requires ["zoom"] to be used only at the top level.
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            ["case", ["get", "isEnriched"], 3, 2],
            14,
            ["case", ["get", "isEnriched"], 4, 3],
            16,
            ["case", ["get", "isEnriched"], 5, 4],
          ],
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.35)",
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.22, 14, 0.35, 16, 0.45],
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

      // Selected venue highlight ring (kept visible even if Places toggled off)
      // Inserted right below labels so text remains readable.
      newMap.addLayer(
        {
          id: "selected-venue-ring",
          type: "circle",
          source: "venues",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], ""]],
          paint: {
            "circle-color": "rgba(0,0,0,0)",
            "circle-radius": 18,
            "circle-stroke-width": 4,
            "circle-stroke-color": "#a855f7",
            "circle-opacity": 1,
          },
        },
        "venue-labels"
      );

      // User location (Google Maps style) — keep ABOVE venue layers so it never gets hidden by clusters/points.
      newMap.addLayer({
        id: "user-location-accuracy-fill",
        type: "fill",
        source: "user-location-accuracy",
        paint: {
          "fill-color": "rgba(59,130,246,0.18)", // blue-500
          "fill-outline-color": "rgba(59,130,246,0.35)",
        },
      });
      newMap.addLayer({
        id: "user-location-accuracy-line",
        type: "line",
        source: "user-location-accuracy",
        paint: {
          "line-color": "rgba(59,130,246,0.45)",
          "line-width": 2,
        },
      });
      // Soft halo under the dot (improves visibility on busy maps)
      newMap.addLayer({
        id: "user-location-halo",
        type: "circle",
        source: "user-location-point",
        paint: {
          "circle-color": "rgba(59,130,246,0.25)",
          "circle-radius": 16,
          "circle-stroke-width": 0,
        },
      });
      newMap.addLayer({
        id: "user-location-dot",
        type: "circle",
        source: "user-location-point",
        paint: {
          "circle-color": "#3b82f6",
          "circle-radius": 7,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Click on venue → open drawer
      newMap.on("click", "unclustered-point", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;

        const props = feature.properties as any;

        // Find full venue data from ref (avoids stale closure)
        const venue = venuesRef.current.find((v) => v.id === props.id);
        if (venue) selectVenue(venue);
      });

      // Tap empty map (or start dragging) to dismiss venue detail so you can keep panning.
      const dismissIfSelected = () => {
        if (!selectedVenueRef.current) return;
        setSelectedVenue(null);
        setDrawerOpen(false);
      };

      newMap.on("click", (e) => {
        // If you tapped a venue dot, let the layer handler above run.
        const hit = newMap.queryRenderedFeatures(e.point, { layers: ["unclustered-point"] });
        if (hit.length > 0) return;
        dismissIfSelected();
      });
      newMap.on("dragstart", dismissIfSelected);

      // Cursor changes
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
  // Update GeoJSON source when venues change
  useEffect(() => {
    if (!map.current || !mapLoaded || venues.length === 0) return;

    const source = map.current.getSource("venues") as mapboxgl.GeoJSONSource;
    if (!source) return;

    // Update ref for click handler (avoids stale closure)
    venuesRef.current = venuesWithScores;

    // Build a precomputed list of point records used for viewport-based sampling.
    // This is what makes zooming feel "right": we sample from what's visible, not globally.
    const weightFor = (v: VenueWithScore) => {
      const score = typeof v.meetingScore === "number" ? v.meetingScore : 0;
      const rating = typeof v.rating === "number" ? v.rating : 0;
      const enriched = v.genderRatio || v.reviewSentiment || v.noiseComplaints ? 1 : 0;
      return score * 10 + rating * 2 + enriched;
    };

    venuesPointsRef.current = venuesWithScores
      .map((v) => ({
        id: v.id,
        lng: v.coordinates.lng,
        lat: v.coordinates.lat,
        name: v.name,
        neighborhood: v.neighborhood,
        address: v.address,
        meetingScore: v.meetingScore || 0,
        isEnriched: !!(v.genderRatio || v.reviewSentiment || v.noiseComplaints),
        rating: v.rating ?? null,
        priceLevel: v.priceLevel ?? null,
        weight: weightFor(v),
      }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    // Convert venues to GeoJSON features
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: venuesPointsRef.current.map((p) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.lng, p.lat],
        },
        properties: {
          id: p.id,
          name: p.name,
          address: p.address,
          neighborhood: p.neighborhood,
          meetingScore: p.meetingScore,
          isEnriched: p.isEnriched,
          rating: p.rating,
          priceLevel: p.priceLevel,
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
  }, [venuesWithScores, mapLoaded, selectedVenue, venues.length]);

  // Viewport-based dots: keep the map readable at low zoom, but show *more* dots as you zoom in.
  useEffect(() => {
    const m = map.current;
    if (!m || !mapLoaded) return;
    const src = m.getSource("venues") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      const pts = venuesPointsRef.current;
      if (!pts.length) return;

      const bounds = m.getBounds();
      if (!bounds) return;
      const w = window.innerWidth;
      const maxTotal = w < 640 ? 2500 : 5000; // denser, per your request

      const candidates = pts.filter(
        (p) =>
          p.lng >= bounds.getWest() &&
          p.lng <= bounds.getEast() &&
          p.lat >= bounds.getSouth() &&
          p.lat <= bounds.getNorth()
      );

      if (candidates.length === 0) {
        src.setData({ type: "FeatureCollection", features: [] });
        return;
      }

      // Pixel grid to avoid overplotting and to distribute dots across the viewport
      const cellPx = 18;
      const maxPerCell = 4;
      const buckets = new Map<string, typeof candidates>();

      for (const p of candidates) {
        const pt = m.project([p.lng, p.lat]);
        const x = Math.floor(pt.x / cellPx);
        const y = Math.floor(pt.y / cellPx);
        const key = `${x}:${y}`;
        const arr = buckets.get(key);
        if (arr) arr.push(p);
        else buckets.set(key, [p]);
      }

      // Keep top-weight per cell
      const keys = Array.from(buckets.keys());
      for (const k of keys) {
        const arr = buckets.get(k)!;
        arr.sort((a, b) => b.weight - a.weight);
        buckets.set(k, arr.slice(0, maxPerCell));
      }

      // Round-robin across cells for even distribution; higher weight cells still contribute first.
      keys.sort((a, b) => (buckets.get(b)![0]?.weight ?? 0) - (buckets.get(a)![0]?.weight ?? 0));
      const picked: any[] = [];
      let progressed = true;
      while (picked.length < maxTotal && progressed) {
        progressed = false;
        for (const k of keys) {
          const arr = buckets.get(k);
          if (!arr || arr.length === 0) continue;
          picked.push(arr.shift()!);
          progressed = true;
          if (picked.length >= maxTotal) break;
        }
      }

      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: picked.map((p: any) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
          properties: {
            id: p.id,
            name: p.name,
            address: p.address,
            neighborhood: p.neighborhood,
            meetingScore: p.meetingScore,
            isEnriched: p.isEnriched,
            rating: p.rating,
            priceLevel: p.priceLevel,
          },
        })),
      };

      src.setData(geojson);
    };

    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(update);
    };

    // Run once now + on movement
    scheduleUpdate();
    m.on("moveend", scheduleUpdate);
    m.on("zoomend", scheduleUpdate);

    return () => {
      m.off("moveend", scheduleUpdate);
      m.off("zoomend", scheduleUpdate);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [mapLoaded]);

  // Keep the selected ring synced with the selected venue (works for search + taps)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer("selected-venue-ring")) return;

    const id = selectedVenue?.id ?? "";
    map.current.setFilter("selected-venue-ring", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], id]]);
  }, [mapLoaded, selectedVenue]);

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

  // Update user location sources (dot + accuracy circle)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const pointSrc = map.current.getSource("user-location-point") as mapboxgl.GeoJSONSource | undefined;
    const accuracySrc = map.current.getSource("user-location-accuracy") as mapboxgl.GeoJSONSource | undefined;
    if (!pointSrc || !accuracySrc) return;

    if (!userLocation) {
      pointSrc.setData({ type: "FeatureCollection", features: [] });
      accuracySrc.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    pointSrc.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [userLocation.lng, userLocation.lat],
          },
        },
      ],
    });

    const accuracy = userLocationAccuracy ?? 0;
    if (accuracy > 0) {
      accuracySrc.setData({
        type: "FeatureCollection",
        features: [makeCirclePolygon(userLocation.lng, userLocation.lat, accuracy)],
      });
    } else {
      accuracySrc.setData({ type: "FeatureCollection", features: [] });
    }
  }, [mapLoaded, userLocation, userLocationAccuracy]);

  // Places toggle: show/hide the venue dot layers so the heatmap stays legible
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const visibility = placesVisible ? "visible" : "none";
    const layers = ["unclustered-point", "venue-labels"] as const;
    for (const layerId of layers) {
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }, [mapLoaded, placesVisible]);

  // Heatmap-first UX: dynamically soften dots when heatmap is ON, and strengthen when heatmap is OFF.
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    if (!map.current.getLayer("unclustered-point")) return;

    const radiusBase = liveEnabled ? { base: 2, enriched: 3 } : { base: 3, enriched: 5 };
    const opacity = liveEnabled ? { z10: 0.18, z14: 0.32, z16: 0.42 } : { z10: 0.55, z14: 0.75, z16: 0.9 };
    const stroke = liveEnabled ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.7)";

    map.current.setPaintProperty("unclustered-point", "circle-opacity", [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      opacity.z10,
      14,
      opacity.z14,
      16,
      opacity.z16,
    ]);
    map.current.setPaintProperty("unclustered-point", "circle-stroke-color", stroke);
    map.current.setPaintProperty("unclustered-point", "circle-radius", [
      "interpolate",
      ["linear"],
      ["zoom"],
      10,
      ["case", ["get", "isEnriched"], radiusBase.enriched, radiusBase.base],
      14,
      ["case", ["get", "isEnriched"], radiusBase.enriched + 1, radiusBase.base + 1],
      16,
      ["case", ["get", "isEnriched"], radiusBase.enriched + 2, radiusBase.base + 2],
    ]);
  }, [mapLoaded, liveEnabled]);

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
                  const q = query.toLowerCase();
                  const filtered = venuesWithScores.filter((v) => {
                    const name = v.name.toLowerCase();
                    const nbh = v.neighborhood.toLowerCase();
                    return name.includes(q) || nbh.includes(q);
                  });
                  setSearchResults(filtered.slice(0, 6));
                } else {
                  setSearchResults([]);
                }
              }}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-gray-400 text-sm"
              style={{ pointerEvents: 'auto' }}
            />
            {(searchQuery || selectedVenue) && (
              <button
                onClick={() => {
                  clearSearchAndSelection();
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
                    setSearchQuery("");
                    setSearchResults([]);
                    selectVenue(venue);
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
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <div className="glass-light rounded-full shadow-lg flex items-center gap-1 px-2 py-1">
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
          </div>

          {liveEnabled && (
            <div className="pointer-events-auto flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                {liveData?.updatedAt
                  ? `Updated ${new Date(liveData.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Updating…"}
              </span>
              <button
                className="p-1 hover:bg-black/5 rounded-full transition-colors disabled:opacity-60"
                disabled={liveLoading}
                onClick={() => fetchLive(liveMode)}
                title="Refresh"
              >
                <RefreshCcw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast (simple, temporary) */}
      {toastMessage && (
        <div className="absolute inset-x-0 bottom-0 z-[70] pb-[calc(env(safe-area-inset-bottom)+7rem)] pointer-events-none flex justify-center">
          <div className="pointer-events-auto glass-light rounded-full shadow-xl px-4 py-2 text-xs text-foreground flex items-center gap-3">
            <span className="max-w-[70vw] truncate">{toastMessage}</span>
            <button
              className="p-1 hover:bg-black/5 rounded-full transition-colors"
              onClick={() => setToastMessage(null)}
              title="Dismiss"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
              </div>
              </div>
      )}

      {/* Tiny attribution label (replaces Mapbox compact "i" control) */}
      <div className="absolute bottom-0 right-0 z-[40] pr-[calc(env(safe-area-inset-right)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pointer-events-none">
        <span className="text-[10px] text-black/40">© Mapbox © OpenStreetMap</span>
      </div>

      {/* Drawer component - slides up from bottom */}
      <Drawer
        open={drawerOpen}
        modal={false}
        shouldScaleBackground={false}
        onOpenChange={(open) => {
        console.log("🗂️ Drawer state changing to:", open);
        setDrawerOpen(open);
      }}
      >
        <div className="absolute inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pointer-events-none">
          {/* Center: venues pill (anchored to same baseline as GPS) */}
          <div className="flex justify-center">
            <div className="pointer-events-auto">
              <DrawerTrigger asChild>
                <button className="glass rounded-full px-6 py-3 hover:bg-white/95 transition-all shadow-xl">
                  <span className="text-sm font-semibold text-foreground">
                    {loading ? "Loading..." : `${venues.length} venues`}
                  </span>
                </button>
              </DrawerTrigger>
            </div>
          </div>

          {/* Far right: GPS (match venues pill height) */}
          <div className="absolute right-0 top-0 pr-[calc(env(safe-area-inset-right)+1rem)] pointer-events-auto">
            <button
              type="button"
              title="Current location"
              onClick={requestAndCenterOnLocation}
              disabled={locating}
              className={[
                "glass",
                "rounded-full",
                "px-4",
                "py-3",
                "hover:bg-white/95",
                "transition-all",
                "shadow-xl",
                "disabled:opacity-60",
                // Slow blink until first tap (permission prompt trigger)
                !hasRequestedLocation ? "animate-[pulse_2.8s_ease-in-out_infinite]" : "",
              ].join(" ")}
            >
              {locating ? <Loader2 className="w-5 h-5 animate-spin" /> : <LocateFixed className="w-5 h-5" />}
            </button>
          </div>
        </div>

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
                    {venuesWithScores
                      .slice()
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
                              selectVenue(venue);
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
