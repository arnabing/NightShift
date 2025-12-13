import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBestTimeVenueFilter } from "@/lib/besttime";

function numParam(url: URL, key: string, fallback: number): number {
  const raw = url.searchParams.get(key);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function strParam(url: URL, key: string, fallback: string): string {
  return url.searchParams.get(key) ?? fallback;
}

function approxLatLngBounds(lat: number, lng: number, radiusMeters: number) {
  // Approx conversions, good enough for short distances:
  const metersPerDegLat = 111_320;
  const metersPerDegLng = Math.cos((lat * Math.PI) / 180) * 111_320;
  const dLat = radiusMeters / metersPerDegLat;
  const dLng = radiusMeters / Math.max(1e-6, metersPerDegLng);
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLng: lng - dLng,
    maxLng: lng + dLng,
  };
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371e3;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = strParam(url, "mode", "hot"); // "hot" | "radar"
  const limit = Math.max(1, Math.min(500, numParam(url, "limit", mode === "radar" ? 80 : 250)));
  const debug = url.searchParams.get("debug") === "1";

  const apiKeyPrivate = process.env.BESTTIME_API_KEY_PRIVATE;

  // If BestTime key missing, return empty hotspot payload.
  if (!apiKeyPrivate) {
    return NextResponse.json({
      mode,
      hasBestTimeKey: false,
      updatedAt: new Date().toISOString(),
      venues: [],
      geojson: { type: "FeatureCollection", features: [] },
    });
  }

  // Hot mode: pick a nightlife-ish subset citywide using your existing signals (meetingScore + complaints + rating).
  // Radar mode: venues near a lat/lng center.
  let venues: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string;
    neighborhood: string;
    meetingScore: number | null;
    rating: number | null;
    noiseComplaints: number | null;
    venueType: string | null;
  }> = [];

  if (mode === "radar") {
    const lat = numParam(url, "lat", NaN);
    const lng = numParam(url, "lng", NaN);
    const radiusMeters = Math.max(200, Math.min(10_000, numParam(url, "radiusMeters", 2500)));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Missing lat/lng for radar mode" }, { status: 400 });
    }

    const b = approxLatLngBounds(lat, lng, radiusMeters);
    const raw = await prisma.venue.findMany({
      where: {
        lat: { gte: b.minLat, lte: b.maxLat },
        lng: { gte: b.minLng, lte: b.maxLng },
      },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        address: true,
        neighborhood: true,
        meetingScore: true,
        rating: true,
        noiseComplaints: true,
        venueType: true,
      },
      take: Math.min(800, limit * 12),
    });

    venues = raw
      .map((v) => ({
        ...v,
        dist: haversineMeters({ lat, lng }, { lat: v.lat, lng: v.lng }),
      }))
      .filter((v) => v.dist <= radiusMeters)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map(({ dist: _dist, ...v }) => v);
  } else {
    // hot (citywide) subset
    venues = await prisma.venue.findMany({
      where: {
        // Prefer enriched venues first (if present), otherwise fallback to anything with activity/ratings.
        OR: [
          { meetingScore: { not: null } },
          { noiseComplaints: { gt: 5 } },
          { rating: { gte: 4.2 } },
        ],
      },
      orderBy: [
        { meetingScore: "desc" },
        { noiseComplaints: "desc" },
        { rating: "desc" },
      ],
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        address: true,
        neighborhood: true,
        meetingScore: true,
        rating: true,
        noiseComplaints: true,
        venueType: true,
      },
      take: limit,
    });
  }

  // NYC-wide (hot): BestTime Venue Filter (Radar) over a NYC grid.
  // This yields forecasted "busy now" values that are much more available than Live.
  const nycCenters =
    mode === "hot"
      ? [
          { lat: 40.758, lng: -73.985 }, // Midtown
          { lat: 40.7306, lng: -73.9866 }, // Union Sq
          { lat: 40.7128, lng: -74.006 }, // FiDi
          { lat: 40.7812, lng: -73.9665 }, // UWS
          { lat: 40.8075, lng: -73.9626 }, // Harlem
          { lat: 40.745, lng: -73.948 }, // LIC
          { lat: 40.764, lng: -73.923 }, // Astoria
          { lat: 40.708, lng: -73.957 }, // Williamsburg
          { lat: 40.6782, lng: -73.9442 }, // Brooklyn
          { lat: 40.6501, lng: -73.9496 }, // Flatbush
        ]
      : [];

  let hotspotPoints: Array<{ venueId: string; name: string; address: string | null; lat: number; lng: number; now: number }> = [];

  if (mode === "hot") {
    if (debug) {
      // Debug: attempt a single Venue Filter call and return the raw payload head.
      const c = { lat: 40.758, lng: -73.985 };
      const btUrl = new URL("https://besttime.app/api/v1/venues/filter");
      btUrl.searchParams.set("api_key_private", apiKeyPrivate);
      btUrl.searchParams.set("busy_min", "25");
      btUrl.searchParams.set("busy_max", "100");
      btUrl.searchParams.set("types", "BAR,NIGHT_CLUB");
      btUrl.searchParams.set("lat", String(c.lat));
      btUrl.searchParams.set("lng", String(c.lng));
      btUrl.searchParams.set("radius", "5000");
      btUrl.searchParams.set("order_by", "now");
      btUrl.searchParams.set("order", "desc");
      btUrl.searchParams.set("foot_traffic", "both");
      btUrl.searchParams.set("limit", String(limit));
      btUrl.searchParams.set("page", "0");

      const res = await fetch(btUrl.toString(), { headers: { accept: "application/json" }, cache: "no-store" });
      const text = await res.text();
      const redacted = btUrl.toString().replace(apiKeyPrivate, "REDACTED");
      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
      return NextResponse.json({
        debug: true,
        requestUrl: redacted,
        status: res.status,
        topKeys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 30) : null,
        venuesLen: parsed?.venues?.length ?? null,
        window: parsed?.window ?? null,
        firstVenueKeys: parsed?.venues?.[0] ? Object.keys(parsed.venues[0]).slice(0, 50) : null,
        firstVenue: parsed?.venues?.[0] ?? null,
        textHead: text.slice(0, 400),
      });
    }

    const results = await Promise.all(
      nycCenters.map((c) =>
        getBestTimeVenueFilter({
          apiKeyPrivate,
          lat: c.lat,
          lng: c.lng,
          radiusMeters: 5000,
          types: "BAR,NIGHT_CLUB",
          footTraffic: "both",
          busyMin: 25,
          busyMax: 100,
          orderBy: "now",
          order: "desc",
          limit: limit,
        })
      )
    );

    const dedup = new Map<string, { venueId: string; name: string; address: string | null; lat: number; lng: number; now: number }>();
    for (const batch of results) {
      for (const v of batch) {
        if (!v.venueId || v.lat === null || v.lng === null || v.now === null) continue;
        const existing = dedup.get(v.venueId);
        const candidate = {
          venueId: v.venueId,
          name: v.name,
          address: v.address,
          lat: v.lat,
          lng: v.lng,
          now: v.now,
        };
        if (!existing || candidate.now > existing.now) dedup.set(v.venueId, candidate);
      }
    }
    hotspotPoints = Array.from(dedup.values()).sort((a, b) => b.now - a.now).slice(0, limit);
  }

  // GeoJSON for map heat/markers
  const busyValues = hotspotPoints.map((v) => v.now).filter((n) => Number.isFinite(n));
  const maxBusyNow = busyValues.length ? Math.max(...busyValues) : 0;
  const minBusyNow = busyValues.length ? Math.min(...busyValues) : 0;

  const geojson = {
    type: "FeatureCollection" as const,
    features: hotspotPoints.map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] as [number, number] },
        properties: {
          id: v.venueId,
          name: v.name,
          busyNow: v.now,
          // Relative scale so there's always visible color when data exists.
          // Clamped floor prevents "looks empty" when all values are low.
          heatWeight: maxBusyNow > 0 ? Math.max(0.12, v.now / maxBusyNow) : 0,
        },
      })),
  };

  return NextResponse.json({
    mode,
    hasBestTimeKey: true,
    updatedAt: new Date().toISOString(),
    scale: {
      mode: "relative" as const,
      minBusyNow,
      maxBusyNow,
      count: hotspotPoints.length,
    },
    venues: hotspotPoints.map((v) => ({
      id: v.venueId,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      address: v.address ?? "",
      neighborhood: "NYC",
      venueType: null,
      meetingScore: null,
      rating: null,
      noiseComplaints: null,
      live: { available: false, liveBusyness: null, forecastBusyness: v.now },
    })),
    geojson,
  });
}


