# CLAUDE.md - NightShift AI Context

This file provides comprehensive context for AI assistants (like Claude) working on NightShift.

**Last Updated:** November 2025 | **Version:** 0.2.0

---

## Project Overview

**NightShift** is a dating venue discovery app for NYC that helps men find the best places to meet women. Unlike traditional nightlife apps that just list venues, NightShift uses data science and AI to calculate a "meeting potential" score for each venue based on multiple signals.

### Core Problem We're Solving

Men in NYC struggle to find venues with:
- Good gender ratios (not sausage fests)
- Active social scenes (not dead/empty)
- The right vibe for meeting people (not too loud, not too quiet)
- Appropriate crowd demographics (age, style, energy)

Traditional apps show ratings and reviews, but don't answer: **"Where can I actually meet someone tonight?"**

### Our Solution

Use free public data + AI to score venues on "meeting potential":

1. **NYC 311 Noise Complaints** - Predict which venues will be busy (KEY INNOVATION)
2. **Review Text Analysis (Claude NLP)** - Infer gender ratios and social vibe
3. **Venue Metadata (Yelp/Foursquare)** - Ratings, price, category
4. **Composite Scoring Algorithm** - Combine signals into 0-100 score

**Current Status:** ✅ Deployed to Vercel | ⏳ Building data pipeline

---

## KEY INNOVATION: Predictive Noise Complaint Analysis

### Why 311 Complaints are Brilliant

NYC's 311 Open Data portal provides free, unlimited access to citizen noise complaints with:
- Precise timestamps (down to the minute)
- Exact addresses and geocoordinates
- Complaint types ("Loud Music/Party", "Noise - Commercial")
- Historical data going back years
- Updated in real-time

**Key Insight:** Venues that consistently generate noise complaints on Friday/Saturday nights are **predictably active** venues.

### Complaint Pattern Analysis

```typescript
// Example: Venue with consistent weekend activity
{
  "venue": "Death & Co",
  "total_complaints_90d": 18,
  "friday_pattern": [2, 1, 3, 2, 2, 3, 1, 2, 3, 2],  // Last 10 Fridays
  "saturday_pattern": [3, 2, 3, 4, 2, 3, 3, 2, 4, 3], // Last 10 Saturdays
  "peak_hours": ["22:00", "23:00", "00:00", "01:00"],
  "consistency_score": 85,  // Very predictable
  "prediction": "High activity this Friday 10PM-1AM"
}
```

**This Approach is:**
1. **Free** - No API costs
2. **Accurate** - Real citizen reports
3. **Predictive** - Historical patterns forecast future activity
4. **Unique** - No competitor uses this data this way

---

## Data Strategy v2.0 - Live Intelligence First

### Core Philosophy
**Answer "Where should I go RIGHT NOW?" not "What's the algorithmic score?"**

We prioritize **live signals** (events happening tonight, current busyness) over **historical patterns** (review analysis, complaint patterns).

### Three-Tier Data Approach

#### TIER 1: Live Signals (What's Happening NOW) 🔴

1. **Eventbrite API** (FREE)
   - **What it tells us**: Ladies nights, singles mixers, DJ parties happening TONIGHT
   - **API**: `https://www.eventbriteapi.com/v3/events/search/`
   - **Rate Limit**: 1,000 requests/hour
   - **Update Frequency**: Daily at 6 PM
   - **Impact**: HIGH - Tells users exactly when to go
   - **Cost**: FREE
   - **To implement**: `scripts/data-collection/fetch-eventbrite.ts`

2. **Google Places Popular Times** (FREE)
   - **What it tells us**: "Busy right now" live indicator
   - **API**: Part of Place Details API
   - **Update Frequency**: Real-time on map load
   - **Impact**: HIGH - Shows current activity
   - **Cost**: FREE (within existing $200/mo credit)
   - **To implement**: Add `opening_hours` field to existing Google fetcher

#### TIER 2: Historical Activity Patterns (What Usually Happens) ✅

3. **NYC 311 Noise Complaints** (FREE - Already Built!)
   - **What it tells us**: Predictable weekend activity patterns
   - **API**: `https://data.cityofnewyork.us/resource/erm2-nwe9.json`
   - **Rate Limit**: 10,000/hour (50,000 with app token)
   - **Update Frequency**: Weekly
   - **Impact**: MEDIUM - Predicts busy nights
   - **Scripts**: ✅ `scripts/data-collection/fetch-311-complaints.ts`
   - **Key Insight**: Consistent complaints = predictable hotspots

#### TIER 3: Review Intelligence (Gender & Vibe Signals) ✅

4. **Google Places API** (FREE - Already Built!)
   - **What it tells us**: Gender keywords, vibe analysis, ratings
   - **API**: `https://maps.googleapis.com/maps/api/place`
   - **Rate Limit**: 1,000 QPS
   - **Coverage**: ~50% of venues have useful reviews
   - **Impact**: HIGH - Best gender ratio inference
   - **Cost**: ~$1-2 per 25 venues
   - **Scripts**: ✅ `scripts/data-collection/fetch-google-places.ts`

5. **Yelp Fusion API** (FREE - Already Built!)
   - **What it tells us**: Ratings, categories (no review text via API)
   - **API**: `https://api.yelp.com/v3/businesses/search`
   - **Free tier**: 5,000 calls/day
   - **Rate Limit**: 5 QPS
   - **Impact**: LOW - Backup ratings only
   - **Scripts**: ✅ `scripts/data-collection/fetch-yelp.ts`

6. **Foursquare API** (FREE - Ready!)
   - **What it tells us**: User tips (review text), popularity scores
   - **API**: `https://api.foursquare.com/v3/places/search`
   - **Free tier**: 950 calls/day
   - **Impact**: MEDIUM - Alternative to Google reviews
   - **Scripts**: ✅ `scripts/data-collection/fetch-foursquare.ts` (need API key)

#### TIER 4: Static Validation (One-Time Imports)

7. **NYC Cabaret License Data** (FREE)
   - **What it tells us**: Which venues legally have dancing/entertainment
   - **API**: `https://data.cityofnewyork.us/resource/n5mv-niye.json`
   - **Update Frequency**: Monthly
   - **Impact**: LOW - Validates "dance" mood venues
   - **To implement**: `scripts/data-collection/import-cabaret-licenses.ts`

#### TIER 5: AI Enhancement (Future - Phase 3)

8. **Claude API (Anthropic)** (SMALL COST)
   - **What it tells us**: Structured gender/vibe/age data from reviews
   - **Cost**: ~$5 one-time for 200 venues (Claude Haiku)
   - **To implement**: `scripts/ai/analyze-reviews.ts`

9. **Google Places AI Summaries** (EXPERIMENTAL)
   - **What it tells us**: AI-generated venue descriptions
   - **Status**: Beta access only
   - **Cost**: ~$40/month minimum (Advanced tier)
   - **Timeline**: When broadly available

### Deprecated/Removed Sources

- ~~BestTime.app~~ - Too expensive ($200/mo) when 311 data + Google Popular Times work
- ~~Scraping~~ - Against ToS, not scalable
- ~~Instagram/TikTok~~ - Requires scraping

---

## Meeting Potential Scoring Algorithm

### Composite Score Formula (0-100)

```typescript
const calculateMeetingPotential = (venue: Venue) => {
  // Gender Balance (30% weight) - Optimal: 40-60% female
  const femalePercent = venue.genderRatio.female;
  const genderBalance = femalePercent >= 40 && femalePercent <= 60
    ? 100
    : 100 - Math.abs(50 - femalePercent) * 2;

  // Activity Level (25% weight) - Based on 311 complaints
  const complaints = venue.noiseComplaints;
  const activityLevel = complaints >= 10 && complaints <= 25
    ? 100
    : complaints < 10 ? complaints * 8 : 100 - (complaints - 25) * 3;

  // Socialibility (20% weight) - Can you talk?
  const venueTypeScores = {
    lounge: 90, cocktail_bar: 85, rooftop: 85,
    bar: 70, sports_bar: 60, dive_bar: 50, nightclub: 40
  };
  const socialibility = venueTypeScores[venue.venueType] || 60;

  // Quality (15% weight) - Overall rating
  const quality = (venue.rating / 5) * 100;

  // Vibe (10% weight) - NLP sentiment
  const vibe = venue.reviewSentiment?.socialVibeScore || 50;

  return (
    genderBalance * 0.30 +
    activityLevel * 0.25 +
    socialibility * 0.20 +
    quality * 0.15 +
    vibe * 0.10
  );
};
```

### Score Interpretation
- **90-100:** Elite dating venue
- **75-89:** Excellent meeting potential
- **60-74:** Good option
- **45-59:** Mediocre
- **0-44:** Poor for meeting people

---

## Development Commands

```bash
# Install dependencies
npm install

# Database setup
npm run db:push          # Push schema to Postgres
npm run db:seed          # Seed initial venues

# Development
npm run dev              # Start dev server (localhost:3000)

# Build
npm run build            # Production build
npm start                # Start production server

# Data collection (to be added)
npm run fetch:311        # Pull 311 complaints
npm run fetch:yelp       # Pull Yelp data
npm run analyze:reviews  # Run Claude NLP analysis
npm run calc:scores      # Calculate meeting scores
```

---

## Tech Stack

- **Framework:** Next.js 16 with App Router (React 19)
- **Language:** TypeScript (strict mode)
- **Database:** Vercel Postgres + Prisma ORM
- **Styling:** Tailwind CSS v4
- **UI:** Custom glass morphism components
- **Icons:** Lucide React
- **Deployment:** Vercel
- **External Services:** Claude API, Yelp, Foursquare, NYC Open Data

---

## Database Schema

### Current Prisma Schema (Existing)

```prisma
model Venue {
  id                String          @id @default(cuid())
  name              String
  lat               Float
  lng               Float
  address           String
  neighborhood      String
  rating            Float?
  priceLevel        Int?            // 1-4

  moods             VenueMood[]
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
}

model VenueMood {
  id        String   @id @default(cuid())
  venueId   String
  venue     Venue    @relation(fields: [venueId], references: [id])
  mood      String   // "cocktails", "dive", "sports", "love", "dance"
}
```

### Needed Schema Additions (Phase 2)

```prisma
model Venue {
  // ... existing fields ...

  // External API IDs
  yelpId            String?         @unique
  googlePlaceId     String?         @unique
  foursquareId      String?         @unique
  liquorLicenseId   String?

  // Meeting potential scoring
  meetingScore      Float?          // 0-100 composite score
  genderRatio       Json?           // { male: 60, female: 40, confidence: "medium" }
  avgAge            Int?            // Average crowd age
  socialibilityScore Float?         // 0-100
  venueType         String?         // "bar", "lounge", "nightclub", etc.

  // 311 Complaint data (KEY FEATURE)
  noiseComplaints   Int?            @default(0)  // Last 90 days
  complaintPattern  Json?           // Weekly pattern data
  lastComplaint     DateTime?

  // Review sentiment (Claude NLP)
  reviewSentiment   Json?           // NLP analysis results

  // Data freshness
  dataLastFetched   DateTime?

  // Future: Crowdsourced data
  checkIns          CheckIn[]
}

model CheckIn {
  id                    String    @id @default(cuid())
  venueId               String
  venue                 Venue     @relation(fields: [venueId], references: [id])

  // Anonymous user reports
  reportedGenderRatio   Json?     // { male: 70, female: 30 }
  reportedCrowdLevel    Int?      // 0-100
  reportedAgeRange      String?   // "20s", "30s", "40s+"

  timestamp             DateTime  @default(now())

  @@index([venueId, timestamp])
}
```

---

## Implementation Roadmap

### ✅ Phase 0: Infrastructure (COMPLETE)
- [x] Next.js 16 app deployed to Vercel
- [x] Prisma + Vercel Postgres setup
- [x] Mood selector UI with Fender amp dial
- [x] Map view with Mapbox GL JS
- [x] Glass morphism design system
- [x] Interactive drawer for venue details

### ⏳ Phase 1: Light Mode Redesign + Real Data (THIS WEEK)

**Goal:** Apple Maps-style light interface + populate map with real activity data

#### Step 1: Visual Redesign (1-2 hours)
- [ ] Update `app/globals.css` - Light theme, white backgrounds, readable text
- [ ] Update `components/map-view-clean.tsx` - Light Mapbox style (`streets-v11`)
- [ ] Update `components/mood-selector.tsx` - Light theme
- [ ] Update `app/page.tsx` - Light gradients
- [ ] Polish glass morphism effects for light backgrounds

#### Step 2: Populate Real Venues (30 mins)
- [ ] Run `npm run fetch:liquor` - Import 100 real NYC bars from NYS database
- [ ] Run `npm run fetch:311` - Add 311 complaint activity patterns
- **Deliverable:** Map shows 100 real venues with activity data

#### Step 3: Yelp Integration (4 hours)
- [ ] Sign up for Yelp Fusion API (free tier)
- [ ] Create `scripts/data-collection/fetch-yelp.ts`
- [ ] Fetch venue details, reviews, photos
- [ ] Analyze reviews for gender/dating keywords
- [ ] Update database with confidence scores
- **Deliverable:** Gender signals, better venue photos, ratings

#### Step 4: Live Activity Data (4 hours)
**Option A: BestTime.app (recommended)**
- [ ] Sign up at besttime.app
- [ ] Create `scripts/data-collection/fetch-besttime.ts`
- [ ] Get real-time foot traffic for venues
- [ ] Add "Busy Now: 85%" indicator to map markers

**Option B: Google Places API (cheaper)**
- [ ] Enable Google Places API
- [ ] Fetch Popular Times data
- [ ] Get live busyness estimates

**Deliverable:** Live "hot right now" indicators on map

#### Step 5: Event Intelligence (3 hours)
- [ ] Sign up for Eventbrite API
- [ ] Create `scripts/data-collection/fetch-events.ts`
- [ ] Find events happening tonight at venues
- [ ] Show "Ladies Night Tonight" badges on markers
- **Deliverable:** Event-driven activity predictions

### 📅 Phase 2: API Integration (Week 2)

1. Yelp API integration
   - Fetch business data for top 200 venues
   - Store ratings, reviews (3 per venue), photos
   - Implement rate limiting (5 QPS)

2. Foursquare API integration
   - Fetch tips and tastes
   - Store popularity scores
   - Get pre-labeled categories ("date spot")

**Deliverable:** 200 venues with review data

### 🧠 Phase 3: AI Analysis (Week 2-3)

1. Claude NLP integration
   - Analyze review text for gender ratio signals
   - Extract age demographics
   - Determine social vibe scores
   - Cost: ~$5 for 200 venues

2. Scoring algorithm implementation
   - Calculate composite meeting potential scores
   - Store in database
   - Validate against manual inspection

**Deliverable:** 200 venues with AI-powered meeting scores

### 🎨 Phase 4: UI Enhancement (Week 3-4)

1. Update venue cards:
   - Meeting score badge (0-100)
   - Gender ratio indicator
   - "Best time to go" based on complaint patterns
   - Activity level indicator

2. Add filters and sorting:
   - Filter by meeting score threshold
   - Filter by neighborhood
   - Sort by meeting potential
   - Sort by activity level

3. Venue detail modal:
   - Score breakdown (show component scores)
   - Historical activity chart
   - Recent check-ins (future)

**Deliverable:** Rich UI showing all venue insights

### 🔄 Phase 5: Data Refresh (Week 4)

1. Vercel Cron jobs:
   - Weekly: 311 complaint refresh
   - Monthly: Yelp rating update
   - Monthly: Foursquare tip update
   - Quarterly: NLP re-analysis

**Deliverable:** Automated data pipeline

---

## Environment Variables Needed

```bash
# Database
DATABASE_URL=postgresql://...

# Mapbox (for map display)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.ey...

# Google Places API (reviews, ratings, popular times)
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
GOOGLE_PLACES_API_KEY=your_key_here  # Server-side

# Eventbrite API (events happening tonight)
EVENTBRITE_API_KEY=your_bearer_token

# Yelp Fusion API (backup ratings)
YELP_API_KEY=your_key_here

# Foursquare API (venue tips)
FOURSQUARE_API_KEY=your_key_here

# NYC Open Data (optional - for higher rate limits on 311/cabaret data)
NYC_OPEN_DATA_APP_TOKEN=your_token

# Claude API - Future Phase 3 (review analysis)
ANTHROPIC_API_KEY=sk-ant-...
```

### Getting API Keys

**Eventbrite** (High Priority):
1. Go to https://www.eventbrite.com/platform/api
2. Create a new app
3. Generate your personal OAuth token
4. Add to `.env.local`

**Google Places** (Already Have):
1. Go to https://console.cloud.google.com/
2. Enable Places API (New)
3. Create API key with Places API restrictions

**NYC Open Data** (Optional but Recommended):
1. Go to https://data.cityofnewyork.us/profile/edit/developer_settings
2. Create an app token
3. Increases rate limit from 1,000/day to 50,000/day

**Foursquare** (if not already set):
1. Go to https://foursquare.com/developers/
2. Create a new app
3. Get your API key

---

## Cost Summary

### One-Time Setup
- Geocoding (Mapbox): $0 (within free tier)
- NLP analysis (Claude): ~$5
- **Total: $5**

### Monthly Operating (MVP)
- All APIs: $0 (free tiers)
- Vercel Hosting: $0 (hobby tier)
- Vercel Postgres: $0 (hobby tier)
- **Total: $0/month**

### Optional Upgrades (Post-MVP)
- Google Places API: +$20/mo
- BestTime.app: +$49/mo
- Vercel Pro: +$20/mo

---

## Key Technical Decisions

**Q: Why no real-time foot traffic?**
A: BestTime.app costs $49-199/mo. For MVP, we use 311 complaint patterns (historical prediction) + crowdsourced check-ins. Gives 80% of value at $0 cost.

**Q: Why Claude over OpenAI?**
A: Better at nuanced analysis, has Vision API for photos, more affordable ($3/1M vs $15/1M).

**Q: Why start with 200 venues?**
A: Stays within all free tier limits, manageable for MVP, enough to validate approach.

**Q: Why focus on gender ratio?**
A: It's the #1 signal for meeting potential, no other app provides it, inferable from reviews, hugely valuable.

---

## Success Metrics

### MVP Launch (Week 4)
- [ ] 200+ venues with meeting scores
- [ ] 150+ venues with gender ratio estimates
- [ ] 100% venues have 311 complaint data
- [ ] Deployed to production
- [ ] Mobile-responsive UI

### Post-Launch (Month 1)
- [ ] 100+ daily active users
- [ ] 10+ crowdsourced check-ins/day
- [ ] Avg session time >3 minutes
- [ ] Page load <2 seconds

---

**For detailed API documentation, scoring algorithm details, and implementation guides, see the full research report in previous conversation context.**
