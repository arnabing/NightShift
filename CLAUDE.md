# CLAUDE.md - NightShift AI Context

This file provides comprehensive context for AI assistants (like Claude) working on NightShift.

**Last Updated:** December 2025 | **Version:** 2.0.0

---

## Current State (December 2025)

### What's Built
- **3,937 venues** in database (Google Places NYC grid search)
- **Mapbox GL JS** map with native clustering (handles 4k+ venues smoothly)
- **Two-layer architecture**: base layer (all venues) + enriched layer (scored venues)
- **Meeting Score algorithm** with toggleable factors
- **Drawer UI** for venue details with "Open in Google Maps" deep link
- **Search bar** for finding venues by name/neighborhood
- **Layer filter** to toggle score factors on/off

### Tech Stack
- **Framework:** Next.js 16.0.10 with App Router (React 19)
- **Database:** Vercel Postgres + Prisma ORM
- **Map:** Mapbox GL JS with GeoJSON source + clustering
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Deployment:** Vercel (auto-deploy on push to main)

### Known Issues
- **iOS Safari edge-to-edge**: Map doesn't extend behind notch/home indicator. Tried multiple approaches (viewport-fit: cover, 100svh, position: fixed, themeColor). Needs PWA manifest or more research.

---

## Project Overview

**NightShift** is a dating venue discovery app for NYC that helps men find the best places to meet women. Unlike traditional nightlife apps that just list venues, NightShift uses data science and AI to calculate a "meeting potential" score for each venue.

### Core Problem
Men in NYC struggle to find venues with:
- Good gender ratios (not sausage fests)
- Active social scenes (not dead/empty)
- The right vibe for meeting people

### Our Solution
Use free public data + AI to score venues on "meeting potential":
1. **NYC 311 Noise Complaints** - Predict which venues will be busy
2. **Google Places Reviews** - Infer gender ratios and social vibe via OpenAI
3. **Composite Scoring** - Combine signals into 0-10 score

---

## Database Schema (Current)

```prisma
model Venue {
  id                String    @id @default(cuid())
  name              String
  lat               Float
  lng               Float
  address           String
  neighborhood      String

  // External IDs
  yelpId            String?   @unique
  googlePlaceId     String?   @unique
  foursquareId      String?   @unique
  liquorLicenseId   String?

  // Ratings & metadata
  rating            Float?
  priceLevel        Int?
  venueType         String?

  // Meeting score data
  meetingScore      Float?
  genderRatio       Json?     // { male: 60, female: 40, confidence: "medium" }
  noiseComplaints   Int?      @default(0)
  complaintPattern  Json?
  reviewSentiment   Json?     // OpenAI analysis results

  // Two-layer architecture
  dataLayer         String    @default("base")  // "base" | "enriched"
  enrichedAt        DateTime?
  dataLastFetched   DateTime?

  // AI insights
  aiSummary         Json?
  aiParsedData      Json?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  moods             VenueMood[]

  @@index([lat, lng])
  @@index([meetingScore])
  @@index([dataLayer])
}
```

---

## Data Pipeline (Built)

### Scripts Available
```bash
npm run fetch:311        # NYC 311 noise complaints
npm run fetch:google     # Google Places venue data
npm run fetch:yelp       # Yelp ratings (backup)
npm run fetch:liquor     # NYS Liquor Authority venues (FREE geocoding via Census)
```

### Data Sources
| Source | Status | Venues | Cost |
|--------|--------|--------|------|
| Google Places (grid search) | ✅ Built | 3,937 | ~$50 |
| NYC 311 Complaints | ✅ Built | Activity data | FREE |
| NYS Liquor Authority | ✅ Built | 10k+ licenses | FREE |
| OpenAI Review Analysis | ✅ Built | Gender/vibe | ~$5 |
| Yelp Fusion | ✅ Built | Backup | FREE |

---

## Meeting Score Algorithm

```typescript
// 0-10 scale, toggleable factors
const calculateMeetingScore = (venue, enabledFactors) => {
  let score = 5; // baseline

  if (enabledFactors.genderBalance && venue.genderRatio) {
    // +2 for good ratio, -2 for bad
    const femalePercent = venue.genderRatio.female;
    score += (femalePercent >= 40 && femalePercent <= 60) ? 2 : -1;
  }

  if (enabledFactors.activityLevel && venue.noiseComplaints) {
    // More complaints = more active
    score += Math.min(venue.noiseComplaints / 10, 2);
  }

  if (enabledFactors.quality && venue.rating) {
    score += (venue.rating - 3) * 0.5; // 4.5 rating = +0.75
  }

  // ... more factors

  return Math.max(0, Math.min(10, score));
};
```

---

## Development Commands

```bash
# Development
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build

# Database
npm run db:push          # Push schema to Postgres
npm run db:seed          # Seed initial venues

# Data collection
npm run fetch:311        # Pull 311 complaints
npm run fetch:google     # Pull Google Places data
npm run fetch:yelp       # Pull Yelp data
npm run fetch:liquor     # Import NYS liquor licenses
```

---

## Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...

# Data collection
GOOGLE_PLACES_API_KEY=your_key
YELP_API_KEY=your_key
OPENAI_API_KEY=your_key

# Optional
NYC_OPEN_DATA_APP_TOKEN=your_token  # Higher rate limits
```

---

## Architecture Decisions

### Why Mapbox GeoJSON + Clustering?
- DOM markers break at 500+ venues (3-5 second render)
- GeoJSON source is GPU-accelerated (~50ms for 4k venues)
- Built-in clustering handles zoom levels automatically

### Why Two-Layer Architecture?
- **Base layer**: All 4k venues as gray dots (tap -> Google Maps)
- **Enriched layer**: Scored venues with colors (tap -> drawer with score)
- Can add heatmap overlay for "hot areas" later

### Why Google Maps Deep Links?
- No API cost for directions/details
- Opens native app on mobile
- Users already trust Google Maps for reviews/photos

---

## Next Steps

### Immediate (This Week)
1. **Fix iOS edge-to-edge** - Research PWA manifest approach or accept Safari limitation
2. **Add heatmap layer** - Show "hot areas" based on 311 + time of day
3. **Import more venues** - Run NYS Liquor script for 5k+ bars

### Phase 2: Live Intelligence
1. Add Google Popular Times ("Busy now" indicator)
2. Eventbrite integration (ladies nights, events)
3. Time-based scoring (Friday 10pm > Tuesday 2pm)

### Phase 3: Gender Intelligence
1. Run OpenAI analysis on remaining venues
2. Add confidence indicators to scores
3. Filter: "Show only bars likely to have women"

---

## File Structure

```
/app
  /api/venues/route.ts    # GET venues with filtering
  /page.tsx               # Main map view
  /layout.tsx             # Root layout with viewport meta
  /globals.css            # Tailwind + Mapbox styles

/components
  /map-view-clean.tsx     # Main map component (700+ lines)
  /ui/drawer.tsx          # shadcn drawer

/lib
  /scoring.ts             # Meeting score algorithm
  /types/index.ts         # TypeScript types

/scripts/data-collection
  /fetch-311-complaints.ts
  /fetch-google-places.ts
  /fetch-yelp.ts
  /fetch-nys-liquor.ts

/prisma
  /schema.prisma          # Database schema
```

---

## iOS Edge-to-Edge Attempts (Failed)

Tried these approaches to make map extend behind notch:
1. `viewport-fit: cover` in viewport meta - partial
2. `100svh` / `100dvh` / `-webkit-fill-available` - no effect
3. `position: fixed` on Mapbox elements - no effect
4. `themeColor: #000000` - no effect
5. Black background on html/body - fills gaps but map doesn't extend

**Conclusion**: iOS Safari in browser mode doesn't fully support edge-to-edge for web apps. May need PWA with `display: fullscreen` in manifest, or accept the limitation.
