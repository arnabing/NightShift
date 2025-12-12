# NightShift Live Data Strategy

**Document Version:** 1.0
**Date:** December 2025
**Status:** RECOMMENDATION

---

## Executive Summary

NightShift needs live data to answer: **"Where are the women RIGHT NOW?"**

**The Hard Truth:** No API provides real-time gender data. The winning strategy combines:
1. Historical gender prediction (we have this)
2. Live busyness signals (add BestTime)
3. Event intelligence (add Eventbrite)

**Recommendation:** BestTime.app ($49/mo) + Eventbrite (FREE)

---

## The Problem

Current NightShift data is **historical only**:
- 311 complaints → patterns from past 90 days
- Google reviews → gender keywords from old reviews
- OpenAI analysis → inference from historical text

**What's missing:** Real-time "this bar is packed RIGHT NOW" signal

---

## API Evaluation Matrix

| API | Truly Live? | Gender Signal? | Bar Coverage | Cost | Verdict |
|-----|-------------|----------------|--------------|------|---------|
| **BestTime.app** | ✅ Yes | ❌ No | ~80% of bars | $49-199/mo | **RECOMMENDED** |
| **Eventbrite** | ✅ Yes (events) | ✅ "Ladies Night" | ~10% of bars | FREE | **RECOMMENDED** |
| **Google Popular Times** | ⚠️ Semi | ❌ No | ~30-40% of bars | FREE | Spotty coverage |
| **Mapbox Movement** | ✅ Yes | ❌ No | Citywide only | ~$500/mo | Overkill |
| **Placer.ai** | ❌ No | ❌ No | Enterprise | $1k+/mo | Not for MVP |
| **SafeGraph** | ❌ No | ❌ No | Enterprise | $500+/mo | Not for MVP |

---

## Why NOT Google Popular Times (FREE)

I initially recommended this, but here's the honest truth:

| Issue | Impact |
|-------|--------|
| Only ~30-40% of NYC bars have data | Most venues show nothing |
| Biased toward restaurants | Bars underrepresented |
| "Live" requires high foot traffic | Small bars excluded |
| Historical patterns, not real-time | Shows typical, not actual |

**Bottom line:** Free but unreliable. You'd show "no data" for most bars.

---

## RECOMMENDED STACK

### 1. BestTime.app — $49/month (PRIORITY)

**What it does:**
- Real-time foot traffic per venue
- "Busy now: 75%" indicator
- Hourly patterns + live deviation
- ~80% coverage of NYC bars

**Pricing tiers:**
| Plan | Venues/Day | Cost | Best For |
|------|------------|------|----------|
| Starter | 100 | $49/mo | MVP testing |
| Growth | 500 | $99/mo | Full NYC coverage |
| Scale | 2,000 | $199/mo | Multiple cities |

**API Example:**
```typescript
// Get live busyness for a venue
const response = await fetch(
  `https://besttime.app/api/v1/forecasts/live?api_key_private=${API_KEY}&venue_name=${encodeURIComponent(venueName)}&venue_address=${encodeURIComponent(address)}`
);

// Response includes:
// - venue_live_busyness: 0-100 current occupancy
// - venue_live_busyness_available: boolean
// - venue_forecasted_busyness: predicted for this hour
```

**Why BestTime over Google:**
- Actually built for nightlife/bars
- Higher coverage (~80% vs ~30%)
- True real-time, not historical patterns
- $49/mo is negligible for product validation

---

### 2. Eventbrite API — FREE (HIGH VALUE)

**What it does:**
- Events happening TONIGHT at/near venues
- Detects "Ladies Night", "Singles Mixer", "Speed Dating"
- Only source with actual gender signal

**Why it matters:**
- Ladies nights = guaranteed good gender ratio
- Singles events = people who WANT to meet
- DJ nights = high activity indicator

**API Example:**
```typescript
// Search events near a location tonight
const url = `https://www.eventbriteapi.com/v3/events/search/`;
const params = {
  'location.latitude': venue.lat,
  'location.longitude': venue.lng,
  'location.within': '0.5km',
  'start_date.keyword': 'today',
  'categories': '103,110', // Nightlife, Food & Drink
};

// Response includes event names we can parse for:
// - "Ladies Night" → genderBoost = 1.5
// - "Singles Mixer" → genderBoost = 1.3
// - "DJ Night" → activityBoost = 1.2
```

**Limitations:**
- Only ~10% of bars list events on Eventbrite
- Better for clubs/larger venues
- Use as bonus signal, not primary

---

## NOT RECOMMENDED

### ❌ Mapbox Movement (~$500/mo)
- **Why skip:** Citywide heatmaps, not venue-level
- **Problem:** Shows "crowds in East Village" not "PHD Rooftop is packed"
- **Cost:** Enterprise pricing overkill for our use case

### ❌ Placer.ai / SafeGraph ($1k+/mo)
- **Why skip:** Enterprise sales process, historical data
- **Problem:** Not real-time, requires contracts
- **When to reconsider:** Series A funding

### ❌ Google Popular Times (FREE)
- **Why skip:** Spotty coverage (~30-40%), not truly live
- **Problem:** Most bars show "no data available"
- **When to reconsider:** Never (BestTime is better)

### ❌ Custom GPS Tracking
- **Why skip:** Cold start problem, privacy concerns
- **Problem:** Need massive user base first
- **When to reconsider:** 100k+ DAU

---

## Implementation Plan

### Phase 1: BestTime Integration (3-4 hours)

**Files to create/modify:**
1. `scripts/data-collection/fetch-besttime.ts` — New script
2. `prisma/schema.prisma` — Already has `popularTimes` field
3. `lib/scoring.ts` — Add live busyness to score calculation
4. `components/map-view-clean.tsx` — Show "Busy Now" badge

**Data flow:**
```
BestTime API → fetch-besttime.ts → DB (popularTimes JSON) → API → Map UI
```

**Cron schedule:** Every 30 minutes during peak hours (6pm-2am)

---

### Phase 2: Eventbrite Integration (2-3 hours)

**Files to create/modify:**
1. `scripts/data-collection/fetch-eventbrite.ts` — New script
2. `prisma/schema.prisma` — Already has `events` field
3. `lib/scoring.ts` — Add event boost to score
4. `components/map-view-clean.tsx` — Show "🎉 Event Tonight" badge

**Event parsing logic:**
```typescript
const detectEventType = (eventName: string) => {
  const lower = eventName.toLowerCase();
  if (lower.includes('ladies') || lower.includes('women')) return 'ladies_night';
  if (lower.includes('singles') || lower.includes('speed dating')) return 'singles';
  if (lower.includes('dj') || lower.includes('dance')) return 'dj_night';
  return 'general';
};
```

**Cron schedule:** Daily at 5pm (before nightlife hours)

---

### Phase 3: Live Hot Score Formula (1-2 hours)

**Update `lib/scoring.ts`:**

```typescript
export const calculateLiveHotScore = (venue: Venue): number => {
  // Base meeting score (historical)
  const baseScore = venue.meetingScore || 50;

  // Live busyness multiplier (BestTime)
  const busyness = venue.popularTimes?.currentBusyness || 50;
  const busyMultiplier = 0.5 + (busyness / 100); // 0.5x to 1.5x

  // Event boost (Eventbrite)
  const eventType = venue.events?.tonight?.type;
  const eventMultiplier = {
    'ladies_night': 1.5,
    'singles': 1.4,
    'dj_night': 1.2,
    'general': 1.1,
    undefined: 1.0
  }[eventType] || 1.0;

  // Time-of-week boost
  const now = new Date();
  const isWeekendNight = (now.getDay() >= 5 || now.getDay() === 0) && now.getHours() >= 20;
  const timeMultiplier = isWeekendNight ? 1.2 : 1.0;

  // Combined score
  return Math.min(100, baseScore * busyMultiplier * eventMultiplier * timeMultiplier);
};
```

**Result:** Venues bubble up when they're:
- Historically good (meetingScore)
- Currently busy (BestTime)
- Have events tonight (Eventbrite)
- On a weekend night (time boost)

---

## Cost Summary

| Item | Monthly Cost | Notes |
|------|--------------|-------|
| BestTime Starter | $49 | 100 venues/day |
| Eventbrite | $0 | 1,000 req/hour free |
| **Total** | **$49/mo** | |

**ROI justification:** $49/mo is 1 cocktail. If live data increases engagement by 10%, it's worth 100x that.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Venues with live data | 0% | 80%+ |
| "Busy now" indicator shown | Never | During peak hours |
| Event badges shown | Never | 5-10% of venues |
| User engagement (session time) | Baseline | +20% |

---

## Next Steps

1. **Sign up for BestTime.app** — Get API key ($49/mo Starter plan)
2. **Sign up for Eventbrite API** — Free developer account
3. **Implement Phase 1** — BestTime integration (3-4 hours)
4. **Implement Phase 2** — Eventbrite integration (2-3 hours)
5. **Implement Phase 3** — Live hot score formula (1-2 hours)
6. **Set up Vercel cron** — Auto-refresh during peak hours

**Total implementation time:** 6-9 hours
**Total monthly cost:** $49
