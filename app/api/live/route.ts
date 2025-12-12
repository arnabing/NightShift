import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getBestTimeLiveByName, promisePool } from "@/lib/besttime";

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
  const limit = Math.max(1, Math.min(300, numParam(url, "limit", mode === "radar" ? 40 : 120)));
  const concurrency = Math.max(1, Math.min(20, numParam(url, "concurrency", 10)));

  const apiKeyPrivate = process.env.BESTTIME_API_KEY_PRIVATE;

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

  const live = await promisePool(
    venues,
    concurrency,
    async (v): Promise<{ venueId: string; available: boolean; liveBusyness: number | null; forecastBusyness: number | null }> => {
      if (!apiKeyPrivate) {
        return { venueId: v.id, available: false, liveBusyness: null, forecastBusyness: null };
      }

      try {
        const r = await getBestTimeLiveByName({
          apiKeyPrivate,
          venueName: v.name,
          venueAddress: v.address,
        });
        return {
          venueId: v.id,
          available: r.available,
          liveBusyness: r.liveBusyness,
          forecastBusyness: r.forecastBusyness,
        };
      } catch {
        return { venueId: v.id, available: false, liveBusyness: null, forecastBusyness: null };
      }
    }
  );

  const liveById = new Map(live.map((x) => [x.venueId, x]));

  const venuesWithLive = venues.map((v) => {
    const l = liveById.get(v.id) ?? { available: false, liveBusyness: null, forecastBusyness: null };
    return {
      id: v.id,
      name: v.name,
      lat: v.lat,
      lng: v.lng,
      address: v.address,
      neighborhood: v.neighborhood,
      venueType: v.venueType,
      meetingScore: v.meetingScore,
      rating: v.rating,
      noiseComplaints: v.noiseComplaints,
      live: l,
    };
  });

  // Sort by live busyness when available, otherwise by fallback signals
  venuesWithLive.sort((a, b) => {
    const aLive = a.live.liveBusyness ?? -1;
    const bLive = b.live.liveBusyness ?? -1;
    if (aLive !== bLive) return bLive - aLive;
    const aFallback = (a.meetingScore ?? 0) + (a.noiseComplaints ?? 0) / 10 + (a.rating ?? 0);
    const bFallback = (b.meetingScore ?? 0) + (b.noiseComplaints ?? 0) / 10 + (b.rating ?? 0);
    return bFallback - aFallback;
  });

  // GeoJSON for map heat/markers
  const geojson = {
    type: "FeatureCollection" as const,
    features: venuesWithLive
      .filter((v) => v.live.liveBusyness !== null)
      .map((v) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [v.lng, v.lat] as [number, number] },
        properties: {
          id: v.id,
          name: v.name,
          liveBusyness: v.live.liveBusyness,
          available: v.live.available,
        },
      })),
  };

  return NextResponse.json({
    mode,
    hasBestTimeKey: Boolean(apiKeyPrivate),
    updatedAt: new Date().toISOString(),
    venues: venuesWithLive,
    geojson,
  });
}


