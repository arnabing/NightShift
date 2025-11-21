# NightShift Data Pipeline v2.0

**Last Updated:** November 2025

## 🎯 What Changed

We shifted from a complex weighted algorithm to a **live intelligence** approach that answers: **"Where should I go RIGHT NOW?"**

### Before (v1.0):
- ❌ Complex 5-factor weighted score
- ❌ Missing data caused bad scores
- ❌ Users didn't understand "socialibility score"
- ❌ No live signals, only historical data

### After (v2.0):
- ✅ Live event signals (ladies nights, mixers)
- ✅ Show what we KNOW, not what we guess
- ✅ Simple intelligence cards instead of complex scores
- ✅ Real-time + historical patterns

---

## 📊 New Data Sources Implemented

### 1. Eventbrite API (LIVE SIGNALS) 🔴
**Script:** `scripts/data-collection/fetch-eventbrite.ts`

**What it does:**
- Searches for nightlife events happening tonight (9 PM - 4 AM)
- Finds ladies nights, singles mixers, DJ parties
- Matches events to venues by GPS coordinates (within 50m)
- Stores in venue `events` field

**How to run:**
```bash
npm run fetch:eventbrite
```

**Required env var:**
```bash
EVENTBRITE_API_KEY=your_bearer_token
```

**Get API key:**
1. Go to https://www.eventbrite.com/platform/api
2. Create a new app
3. Generate personal OAuth token

**Event types detected:**
- 🎉 Ladies Night
- 💕 Singles Mixer
- 💃 Dance Party
- 🎵 Live Music
- 🎊 Party

---

### 2. NYC Cabaret Licenses (VALIDATION)
**Script:** `scripts/data-collection/import-cabaret-licenses.ts`

**What it does:**
- One-time/monthly import of NYC cabaret licenses
- Identifies venues with legal dancing/entertainment permits
- Validates "dance" mood venues
- Stores in `cabaretLicense` and `cabaretLicenseType` fields

**How to run:**
```bash
npm run import:cabaret
```

**Optional env var (for higher rate limits):**
```bash
NYC_OPEN_DATA_APP_TOKEN=your_token
```

**License types:**
- **Class 1 Cabaret:** Full entertainment + dancing (best for dance venues)
- **Class 2 Cabaret:** DJ/recorded music only

---

## 🗄️ Database Schema Updates

**New fields added to `Venue` model:**

```prisma
// Live event data (Eventbrite)
events Json? // Tonight's events {eventName, eventUrl, eventTime, eventType}

// NYC Cabaret licenses (static validation)
cabaretLicense     Boolean? @default(false)
cabaretLicenseType String?  // "Class 1 Cabaret", "Class 2 Cabaret"

// Google Popular Times (future)
popularTimes Json? // Hourly busyness patterns

// AI-generated insights (future Phase 3)
aiSummary    Json? // Google AI summary
aiParsedData Json? // Claude-extracted structured data
```

**To apply schema changes:**
```bash
npm run db:push
```

---

## 🚀 New NPM Scripts

```bash
# NEW: Fetch live event data
npm run fetch:eventbrite    # Eventbrite events for tonight
npm run fetch:live           # Alias for fetch:eventbrite

# NEW: Import static data
npm run import:cabaret       # NYC cabaret licenses (run once/month)

# UPDATED: Collect all data
npm run data:collect         # Runs all data sources including Eventbrite

# Existing scripts still work
npm run fetch:google         # Google Places reviews
npm run fetch:yelp           # Yelp ratings
npm run fetch:311            # NYC 311 complaints
npm run fetch:foursquare     # Foursquare tips
```

---

## 📝 Updated Documentation

### [ALGORITHM.md](./ALGORITHM.md)
- New "Data Sources v2.0" section
- Tier 1: Live Activity Signals (Eventbrite, Google Popular Times)
- Tier 2: Historical Patterns (311 complaints)
- Tier 3: Review Intelligence (Google, Yelp, Foursquare)
- New "Signal-Based Intelligence" approach

### [CLAUDE.md](./CLAUDE.md)
- Updated "Data Strategy v2.0" section
- Three-tier data approach
- New environment variables section
- API key setup instructions

---

## 🎯 Next Steps

### Phase 1: Data Collection (Ready Now!) ✅
```bash
# 1. Get Eventbrite API key
# Visit: https://www.eventbrite.com/platform/api
# Add to .env.local: EVENTBRITE_API_KEY=your_token

# 2. Import cabaret licenses (one-time)
npm run import:cabaret

# 3. Fetch tonight's events
npm run fetch:eventbrite

# 4. View in database
# Venues with events will have `events` field populated
# Venues with licenses will have `cabaretLicense=true`
```

### Phase 2: UI Updates (Next Task)
- [ ] Update venue cards to show event badges
- [ ] Add "🎉 Event Tonight" filter
- [ ] Show event details in venue drawer
- [ ] Update map markers with event indicators

### Phase 3: Live Intelligence Display
- [ ] "GO NOW" recommendations for venues with events
- [ ] "Usually busy on Fridays 10PM-1AM" from 311 data
- [ ] "👯 Good gender balance" from review analysis
- [ ] Confidence indicators for data quality

---

## 🔧 Troubleshooting

### Eventbrite API Returns No Events
**Problem:** No events found for tonight
**Solution:**
- Eventbrite searches might be empty on weekday early hours
- Test on Friday/Saturday evenings for best results
- Expand search radius: Change `radiusKm` parameter in script

### Cabaret Import Finds No Matches
**Problem:** 0 licenses matched to venues
**Solution:**
- Run `npm run fetch:liquor` first to populate venue database
- NYC cabaret data only covers Manhattan/popular boroughs
- Matching threshold is 100m - adjust if needed

### Database URL Not Set
**Problem:** `Missing required environment variable: DATABASE_URL`
**Solution:**
```bash
# Copy from Vercel dashboard
vercel env pull .env.local
```

---

## 📊 Data Flow Architecture

```
User Opens App
      ↓
  Map Loads
      ↓
API: GET /api/venues?mood=love
      ↓
Backend Fetches from Database:
  - Basic venue data (name, location, rating)
  - events field (from Eventbrite)
  - cabaretLicense (from NYC Open Data)
  - noiseComplaints (from 311)
  - genderRatio (from Google reviews)
      ↓
Backend Calculates Intelligence:
  - hasEventTonight: !!venue.events
  - eventType: venue.events.eventType
  - weekendActivity: from complaintPattern
  - dataQuality: count of available signals
      ↓
Frontend Displays:
  - 🎉 Event badge if hasEventTonight
  - 🔥 Activity indicator if weekendActivity > 70
  - 👯 Gender balance if confidence > 50%
  - Score (1-10) based on available signals
```

---

## 💡 Design Philosophy

### Why Live Signals First?
**Traditional apps:** Show ratings, reviews, photos (all historical)
**NightShift v2:** Show what's happening RIGHT NOW

**Example intelligence card:**
```
🎉 Ladies Night Tonight 9PM-2AM
🔥 Usually packed on Fridays 10PM-1AM
⭐ 4.7 rating · $$ · Cocktail Bar
👯 Good gender balance (55% female)
💃 Has cabaret license (dancing allowed)
```

### Why Simplify Scoring?
Users don't care about:
- "This venue scored 74.3 on our proprietary algorithm"
- "Socialibility: 85/100"
- "Gender Balance weighted at 40%"

Users DO care about:
- "Is there an event tonight?"
- "Will it be busy?"
- "Are there women there?"
- "Is it a good vibe?"

---

## 📈 Success Metrics

### After Phase 1 (Data Collection)
- ✅ 2 new data sources integrated
- ✅ 6 new database fields
- ✅ Updated documentation
- ✅ New npm scripts

### After Phase 2 (UI Updates)
- [ ] Users can filter by "Has event tonight"
- [ ] Event details shown in venue cards
- [ ] Map markers show event indicators
- [ ] Live intelligence replaces complex scores

### After Phase 3 (Full Intelligence)
- [ ] Real-time busyness from Google Popular Times
- [ ] AI-analyzed reviews from Claude API
- [ ] Confidence scores for all recommendations
- [ ] "GO NOW" vs "Usually good on weekends" distinction

---

**For questions or issues, see [CLAUDE.md](./CLAUDE.md) for full context and implementation details.**
