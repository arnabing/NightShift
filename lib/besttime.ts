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


