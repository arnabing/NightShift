# NightShift Data Pipeline v3.0

**Last Updated:** November 2025 - OpenAI Integration

## 🎯 What Changed

We shifted from a complex weighted algorithm to an **LLM-powered intelligence** approach that answers: **"Where should I go to meet women?"**

### Before (v1.0):
- ❌ Complex 5-factor weighted score
- ❌ Missing data caused bad scores
- ❌ Simple keyword matching ("girl" vs "guy")
- ❌ Users didn't understand "socialibility score"

### After (v2.0):
- ❌ Attempted live event signals (Eventbrite deprecated)
- ❌ Attempted cabaret licenses (no GPS data)
- ✅ Reality check: Most APIs don't exist or cost money

### After (v3.0 - Current):
- ✅ **OpenAI-powered review analysis** ($0.60 per 1,000 venues!)
- ✅ Structured data extraction (gender ratio, age, vibe, timing)
- ✅ Show what we KNOW with confidence levels
- ✅ Scale to 1,500+ venues with NYS Liquor Authority data

---

## 📊 Data Sources v3.0

### 1. OpenAI Review Analysis (LLM INTELLIGENCE) 🤖 ✅ IMPLEMENTED
**Script:** `scripts/ai/analyze-reviews-openai.ts`

**What it does:**
- Analyzes venue reviews using OpenAI gpt-4o-mini
- Extracts structured data: gender ratio, age range, social vibe, meeting potential
- Provides confidence levels for all estimates
- Stores in venue `aiParsedData` field
- Updates `genderRatio`, `meetingScore`, `socialibilityScore` fields

**How to run:**
```bash
# Analyze all venues with reviews
npm run analyze:openai

# Test on first 10 venues
npm run analyze:openai -- --limit 10 --test

# Analyze specific venues
npm run analyze:openai -- --ids venue1,venue2,venue3
```

**Required env var:**
```bash
OPENAI_API_KEY=sk-proj-...
```

**Get API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Add to `.env.local`

**Cost:**
- **$0.0006 per venue**
- 1,000 venues = $0.60
- 10,000 venues = $6.00

**Output structure:**
```json
{
  "genderRatio": {
    "estimatedFemalePercent": 55,
    "estimatedMalePercent": 45,
    "confidence": "high",
    "reasoning": "Multiple reviews mention balanced crowd..."
  },
  "socialVibe": {
    "overallScore": 85,
    "isDateFriendly": true,
    "conversationFriendly": true,
    "crowdDescription": "young professionals",
    "ageRange": "20s-30s"
  },
  "meetingPotential": {
    "score": 78,
    "bestNights": ["Friday", "Saturday"],
    "bestTimeOfNight": "10PM-midnight",
    "prosForMeeting": ["Good gender balance", "Easy to talk"],
    "consForMeeting": ["Can get crowded after midnight"]
  }
}
```

---

### 2. NYS Liquor Authority Database (VENUE DISCOVERY) 🍺 ✅ WORKING
**Script:** `scripts/data-collection/fetch-nys-liquor.ts`

**What it does:**
- Imports all active NYC bars/nightclubs from NY State Liquor Authority
- Filters for nightlife licenses (On Premises, Club, Tavern, Restaurant)
- Geocodes addresses using Mapbox API
- Can import up to 1,500 venues (recently increased from 100)

**How to run:**
```bash
npm run fetch:liquor
```

**Coverage:**
- Manhattan, Brooklyn, Queens, Bronx, Staten Island
- ~10,000 active liquor licenses in NYC
- Script limit: 1,500 venues (configurable)

**Cost:** FREE (both NYS API and Mapbox within free tier)

---

## 🗄️ Database Schema Updates

**New fields added to `Venue` model:**

```prisma
// OpenAI-generated insights (v3.0) ✅ IN USE
aiParsedData Json? // Structured review analysis from OpenAI
// Stores: genderRatio, socialVibe, meetingPotential objects

// Enhanced scoring fields (populated by OpenAI)
meetingScore       Float?  // 0-100 composite score
socialibilityScore Float?  // 0-100 from OpenAI analysis
avgAge             Int?    // Estimated from age range
reviewSentiment    Json?   // Enriched with OpenAI insights

// Legacy/deprecated fields (kept for backwards compatibility)
events             Json?   // Eventbrite (deprecated - API removed 2020)
cabaretLicense     Boolean? @default(false) // NYC data lacks GPS coords
popularTimes       Json?   // Google doesn't expose this
aiSummary          Json?   // Google AI summaries (not publicly available)
```

**To apply schema changes:**
```bash
npm run db:push
```

---

## 🚀 NPM Scripts (v3.0)

```bash
# Venue Discovery
npm run fetch:liquor         # Import bars from NYS Liquor Authority (1,500 venues)

# Data Enrichment
npm run fetch:google         # Google Places reviews + ratings
npm run fetch:311            # NYC 311 noise complaints (activity proxy)
npm run fetch:foursquare     # Foursquare venue tips
npm run fetch:yelp           # Yelp ratings (backup)

# AI Analysis ✨ NEW
npm run analyze:openai       # OpenAI review analysis (LLM intelligence)

# Full Pipeline
npm run data:collect         # Run all steps: liquor → 311 → google → foursquare → yelp → openai
```

**Typical workflow:**
```bash
# 1. Import venues (one-time or monthly)
npm run fetch:liquor

# 2. Enrich with review data
npm run fetch:google

# 3. Add activity patterns
npm run fetch:311

# 4. Optional: Add Foursquare tips
npm run fetch:foursquare

# 5. Run AI analysis (the magic!)
npm run analyze:openai
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
