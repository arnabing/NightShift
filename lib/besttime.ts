type BestTimeLiveResponse =
  | {
      status?: string;
      venue_live_busyness?: number;
      venue_live_busyness_available?: boolean;
      venue_forecasted_busyness?: number;
      venue_name?: string;
      venue_address?: string;
      // BestTime responses sometimes include error/status text fields
      error?: string;
      message?: string;
    }
  | Record<string, unknown>;

export type BestTimeLiveResult = {
  available: boolean;
  liveBusyness: number | null; // 0..100
  forecastBusyness: number | null; // 0..100
  raw?: unknown;
};

type CacheEntry = { expiresAt: number; value: BestTimeLiveResult };

const liveCache = new Map<string, CacheEntry>();

type GenericCacheEntry<T> = { expiresAt: number; value: T };
const genericCache = new Map<string, GenericCacheEntry<any>>();

function cacheGet(key: string): BestTimeLiveResult | null {
  const entry = liveCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    liveCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key: string, value: BestTimeLiveResult, ttlMs: number) {
  liveCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function cacheGetGeneric<T>(key: string): T | null {
  const entry = genericCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    genericCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function cacheSetGeneric<T>(key: string, value: T, ttlMs: number) {
  genericCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function clamp01to100(n: unknown): number | null {
  if (typeof n !== "number" || Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * BestTime "live" lookup by venue name/address.
 * This is intentionally simple and cached; production usage should also persist IDs where possible.
 *
 * Docs entrypoint: https://besttime.app/api/v1/docs
 */
export async function getBestTimeLiveByName(params: {
  apiKeyPrivate: string;
  venueName: string;
  venueAddress: string;
  cacheTtlMs?: number;
}): Promise<BestTimeLiveResult> {
  const cacheTtlMs = params.cacheTtlMs ?? 2 * 60 * 1000; // 2m
  const cacheKey = `name:${params.venueName}__addr:${params.venueAddress}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // Common BestTime pattern used in their examples/docs:
  // GET https://besttime.app/api/v1/forecasts/live?api_key_private=...&venue_name=...&venue_address=...
  const url = new URL("https://besttime.app/api/v1/forecasts/live");
  url.searchParams.set("api_key_private", params.apiKeyPrivate);
  url.searchParams.set("venue_name", params.venueName);
  url.searchParams.set("venue_address", params.venueAddress);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { "accept": "application/json" },
    // Keep it snappy: this is called fan-out for multiple venues
    cache: "no-store",
  });

  let data: BestTimeLiveResponse | null = null;
  try {
    data = (await res.json()) as BestTimeLiveResponse;
  } catch {
    data = null;
  }

  const liveBusyness =
    data && typeof data === "object"
      ? clamp01to100((data as any).venue_live_busyness)
      : null;
  const available =
    data && typeof data === "object"
      ? Boolean((data as any).venue_live_busyness_available)
      : false;
  const forecastBusyness =
    data && typeof data === "object"
      ? clamp01to100((data as any).venue_forecasted_busyness)
      : null;

  const result: BestTimeLiveResult = {
    available: Boolean(available && liveBusyness !== null),
    liveBusyness,
    forecastBusyness,
    raw: data ?? undefined,
  };

  cacheSet(cacheKey, result, cacheTtlMs);
  return result;
}

export type BestTimeVenueFilterVenue = {
  venueId: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  now: number | null; // forecasted busy now (0..100)
  live: number | null; // optional live foot traffic (0..100+) when requested
  raw?: unknown;
};

/**
 * BestTime Venue Filter (Radar) endpoint.
 * This is the tool BestTime recommends for “busy bars in an area” style queries.
 *
 * Docs: https://documentation.besttime.app/#input-attributes-venue-filter
 */
export async function getBestTimeVenueFilter(params: {
  apiKeyPrivate: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  types?: string; // e.g. "BAR,NIGHT_CLUB"
  footTraffic?: "limited" | "day" | "both";
  busyMin?: number; // 0..100
  busyMax?: number; // 0..100
  orderBy?: string; // e.g. "now"
  order?: "asc" | "desc";
  limit?: number;
  page?: number;
  includeLive?: boolean;
  liveRefresh?: boolean;
  cacheTtlMs?: number;
}): Promise<BestTimeVenueFilterVenue[]> {
  const cacheTtlMs = params.cacheTtlMs ?? 5 * 60 * 1000; // 5m
  const cacheKey = `vf:${params.lat.toFixed(4)},${params.lng.toFixed(4)}:${params.radiusMeters}:${params.types ?? ""}:${params.footTraffic ?? ""}:${params.busyMin ?? ""}:${params.busyMax ?? ""}:${params.orderBy ?? ""}:${params.order ?? ""}:${params.limit ?? ""}:${params.page ?? ""}:${params.includeLive ? 1 : 0}:${params.liveRefresh ? 1 : 0}`;
  const cached = cacheGetGeneric<BestTimeVenueFilterVenue[]>(cacheKey);
  if (cached) return cached;

  // Endpoint name per docs nav: "Query filtered venues (Radar)" / "Venue Filter"
  // BestTime commonly uses query params for auth & filters.
  const url = new URL("https://besttime.app/api/v1/venues/filter");
  url.searchParams.set("api_key_private", params.apiKeyPrivate);
  url.searchParams.set("lat", String(params.lat));
  url.searchParams.set("lng", String(params.lng));
  url.searchParams.set("radius", String(params.radiusMeters));
  if (params.types) url.searchParams.set("types", params.types);
  if (params.footTraffic) url.searchParams.set("foot_traffic", params.footTraffic);
  if (params.busyMin !== undefined) url.searchParams.set("busy_min", String(params.busyMin));
  if (params.busyMax !== undefined) url.searchParams.set("busy_max", String(params.busyMax));
  if (params.orderBy) url.searchParams.set("order_by", params.orderBy);
  if (params.order) url.searchParams.set("order", params.order);
  if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
  if (params.page !== undefined) url.searchParams.set("page", String(params.page));
  if (params.includeLive) url.searchParams.set("live", "true");
  if (params.liveRefresh) url.searchParams.set("live_refresh", "true");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const timeLocalIndex: number | null =
    data && typeof data === "object" && typeof data.window?.time_local_index === "number"
      ? data.window.time_local_index
      : null;

  const list: any[] =
    data && typeof data === "object"
      ? (data.venues ?? data.results ?? data.data ?? [])
      : [];

  const venues: BestTimeVenueFilterVenue[] = Array.isArray(list)
    ? list.map((v) => {
        const venueId = String(v.venue_id ?? v.venueId ?? v.id ?? "");
        const name = String(v.venue_name ?? v.name ?? "");
        const address = (v.venue_address ?? v.address ?? null) as string | null;
        const lat = typeof v.venue_lat === "number" ? v.venue_lat : typeof v.lat === "number" ? v.lat : null;
        const lng = typeof v.venue_lng === "number" ? v.venue_lng : typeof v.lng === "number" ? v.lng : null;
        let now = clamp01to100(v.now ?? v.venue_now ?? v.busy_now ?? v.current_hour ?? null);
        if (
          now === null &&
          timeLocalIndex !== null &&
          Array.isArray(v.day_raw) &&
          timeLocalIndex >= 0 &&
          timeLocalIndex < v.day_raw.length
        ) {
          now = clamp01to100(v.day_raw[timeLocalIndex]);
        }
        // Live can exceed 100% per docs, so don't clamp aggressively; still keep it sane-ish.
        const live = typeof v.live === "number" ? Math.round(v.live) : typeof v.venue_live === "number" ? Math.round(v.venue_live) : null;
        return { venueId, name, address, lat, lng, now, live, raw: v };
      })
    : [];

  cacheSetGeneric(cacheKey, venues, cacheTtlMs);
  return venues;
}

export async function promisePool<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await mapper(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
  return results;
}


