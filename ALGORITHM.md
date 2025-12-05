# NightShift Meeting Potential Algorithm

**Last Updated:** Nov 2025
**Version:** 1.0 (Beta)

## 🎯 Goal

Calculate a 0-100 score for each NYC nightlife venue that predicts how likely you are to **meet women** there tonight.

---

## 📊 Current Algorithm (v1.0)

### Score Breakdown

The **Meeting Potential Score** is a weighted composite of 5 factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Gender Balance** | 40% | Female-to-male ratio at the venue |
| **Social Vibe** | 20% | How easy is it to talk and socialize? |
| **Quality** | 15% | Overall venue rating (Google/Yelp) |
| **Socialibility** | 15% | Venue type (lounge vs nightclub) |
| **Activity Level** | 10% | Historical noise complaints (proxy for busyness) |

**Formula:**
```
Meeting Score = (Gender × 0.4) + (Vibe × 0.2) + (Quality × 0.15) + (Socialibility × 0.15) + (Activity × 0.1)
```

---

## 🔢 Factor Details

### 1. Gender Balance (40%) - Most Important

**What it measures:** Percentage of female patrons based on review analysis

**Scoring:**
- **45-75% female** = 100 points (+ confidence bonus)
- **40-85% female** = 90 points
- **35-90% female** = 80 points
- **<35% female** = Heavily penalized (score = female %)
- **>90% female** = 85 points (slightly less optimal)

**Confidence Multiplier:**
- **High confidence** (20+ gender keywords): 1.2x bonus
- **Medium confidence** (10-19 keywords): 1.1x bonus
- **Low confidence** (<10 keywords): 0.9x penalty

**Data Source:** Google Places reviews analyzed for gender keywords
- Female keywords: "girl", "girls", "woman", "women", "lady", "ladies", "female", "she", "her", "girlfriend", "wife"
- Male keywords: "guy", "guys", "man", "men", "male", "dude", "he", "him", "boyfriend", "husband", "bro"

**Example:**
- **Doc Holliday's**: 91% female, HIGH confidence → 100 × 1.2 = **100 points** (capped at 100)
- But overall score is 74 due to low social vibe (56/100)

---

### 2. Social Vibe (20%)

**What it measures:** Sentiment analysis of reviews for social atmosphere

**Scoring:** 0-100 based on keyword analysis

**Keywords:**
- **Social (+10)**: "meet", "social", "friendly", "conversation", "chat", "talk", "mingle", "crowd"
- **Positive (+5)**: "fun", "great", "awesome", "amazing", "love", "fantastic", "excellent"
- **Negative (-10)**: "crowded", "loud", "noisy", "packed", "aggressive", "pushy", "uncomfortable"

**Base Score:** Average rating / 5 × 100

**Example:**
- **Death & Co**: 100/100 vibe (5★ rating + many positive keywords)
- **Doc Holliday's**: 56/100 vibe (4.1★ + mixed keywords)

---

### 3. Quality (15%)

**What it measures:** Overall venue rating from Google Places / Yelp

**Scoring:** Simple conversion
```
Quality Score = (Rating / 5) × 100
```

**Examples:**
- 5.0★ rating = 100 points
- 4.5★ rating = 90 points
- 4.0★ rating = 80 points
- 3.5★ rating = 70 points

---

### 4. Socialibility (15%)

**What it measures:** How easy is it to talk to strangers based on venue type?

**Venue Type Scores:**
- **Lounge**: 90 (quiet, conversation-friendly)
- **Cocktail Bar**: 85 (good balance)
- **Rooftop**: 85 (open, social atmosphere)
- **Wine Bar**: 80
- **Bar**: 70 (standard, moderate noise)
- **Pub**: 65
- **Sports Bar**: 60 (TV noise, distracted)
- **Dive Bar**: 50 (very loud, casual)
- **Nightclub**: 40 (too loud to talk)

**Default:** 60 if venue type unknown

---

### 5. Activity Level (10%) - Least Important

**What it measures:** NYC 311 noise complaints in last 90 days (proxy for busyness)

**Scoring:**
- **10-25 complaints** = 100 points (sweet spot: busy but not problematic)
- **<10 complaints** = `complaints × 8` (might be dead)
- **>25 complaints** = Penalized (might indicate actual problems)

**Issues with this metric:**
- Only 7 out of 25 venues have complaint data
- Not all busy venues generate complaints
- Weighted at only 10% to minimize impact

**Example:**
- **Doc Holliday's**: 0 complaints = **0 points** (dragging down overall score)
- **Peculier Pub**: 0 complaints but still scores 80 overall

---

## 🏆 Score Tiers

| Score | Tier | Emoji | Color | Meaning |
|-------|------|-------|-------|---------|
| 90-100 | Elite | 💎 | Purple/Pink | Exceptional venue for meeting women |
| 75-89 | Excellent | 🔥 | Orange/Red | Great choice, highly recommended |
| 60-74 | Good | ✨ | Blue/Cyan | Solid option, worth checking out |
| 45-59 | Mediocre | 😐 | Gray | Meh, not ideal |
| 0-44 | Poor | 💀 | Dark Gray | Avoid for meeting people |

---

## 📈 Current Top 10 Venues

Based on real data as of Jan 2025:

| Rank | Venue | Score | Gender | Vibe | Rating | Notes |
|------|-------|-------|--------|------|--------|-------|
| 1 | Death & Co | 82 | 45% (low) | 100 | 4.5★ | High vibe compensates |
| 2 | Julius' Bar | 81 | 45% (low) | 100 | 4.5★ | Perfect vibe |
| 3 | Output | 81 | **55% (med)** | 99 | 4.1★ | Good gender balance! |
| 4 | The Dead Rabbit | 81 | 45% (low) | 100 | 4.7★ | Top rated |
| 5 | Peculier Pub | 80 | 45% (low) | 100 | 4.4★ | - |
| 6 | Employees Only | 80 | 45% (low) | 86 | 4.3★ | - |
| 7 | Brooklyn Mirage | 77 | 45% (low) | 70 | 4.7★ | - |
| 8 | Boxers HK | 77 | 45% (low) | 91 | 4.0★ | - |
| ... | ... | ... | ... | ... | ... | ... |
| 18 | **Doc Holliday's** | 74 | **91% (HIGH)** | 56 | 4.1★ | Best gender ratio but low vibe! |

---

## 🤔 Known Issues & Questions

### Issue #1: Gender Balance Not Dominating Enough?

**Problem:** Doc Holliday's has 91% female (HIGH confidence) but ranks #18 with 74 points.

**Why?** Its social vibe score (56/100) is dragging it down despite perfect gender ratio.

**Question:** Should we increase gender balance weight from 40% to 50%? Or should 90%+ female actually be ideal?

---

### Issue #2: Social Vibe Over-Weighted?

**Problem:** Venues with 45% female but 100 vibe (Death & Co) are beating venues with 91% female and 56 vibe (Doc Holliday's).

**Question:** Is "easy to talk" more important than having women there? Or should gender always win?

---

### Issue #3: Default 45% Female Assumption

**Problem:** 12 venues have no gender data, so they default to 45% female (low confidence).

**Why?** Google Places API didn't return enough reviews, or reviews didn't mention gender.

**Solutions:**
- Scrape more reviews from multiple sources
- Use Yelp data (but API is limited)
- Manually curate known venues
- Weight missing data differently?

---

### Issue #4: Activity Level (311 Complaints) Unreliable

**Problem:** Only 7 out of 25 venues have complaint data.

**Why?** Not all busy venues generate complaints. Residential neighborhoods report more.

**Current Fix:** Reduced weight to 10% (from original 25%)

**Question:** Should we remove this factor entirely and find better proxy for "busyness"?

---

### Issue #5: No Time-of-Day Data

**Problem:** Algorithm doesn't account for when to go.

**Examples:**
- Rooftop bars are great at sunset, dead at 2am
- Nightclubs are empty before 11pm
- Dive bars peak at happy hour

**Question:** Should we add "Best Time" recommendations based on 311 complaint patterns?

---

## 🎛️ Algorithm Tuning Options

### Option A: Increase Gender Weight
```
Gender: 50% (↑ from 40%)
Vibe: 15% (↓ from 20%)
Quality: 15%
Socialibility: 15%
Activity: 5% (↓ from 10%)
```

**Effect:** Doc Holliday's (91% female) would jump to #1-3

---

### Option B: Penalize Low Vibe More
```
If vibe < 60 AND gender > 70%:
  Apply 0.9x penalty to final score
```

**Effect:** Doc Holliday's stays lower despite high female ratio

---

### Option C: Confidence Matters More
```
High confidence: 1.5x bonus (↑ from 1.2x)
Medium confidence: 1.3x bonus (↑ from 1.1x)
Low confidence: 0.7x penalty (↓ from 0.9x)
```

**Effect:** Rewards venues with real data, penalizes assumptions

---

### Option D: Remove Activity Level Entirely
```
Gender: 45% (↑ from 40%)
Vibe: 25% (↑ from 20%)
Quality: 15%
Socialibility: 15%
Activity: 0% (REMOVED)
```

**Effect:** Focus purely on what matters: gender, vibe, quality

---

## 📊 Data Sources (v2.1 - Reality Check)

### Core Philosophy: Show What We KNOW, Not What We Guess

**Reality:** Most "live" APIs don't exist or cost money. We focus on high-quality review intelligence + historical patterns.

**Goal:** Accurately predict "Where are women tonight?" using the best available free data sources.

---

### Tier 1: Review Intelligence 🎯 PRIMARY SOURCE

#### 1. **Google Places API** (Free tier) ✅ WORKING
   - **What it tells us:** Gender keywords, vibe analysis, ratings, venue type
   - **Current:** Simple keyword matching (91% female at Doc Holliday's)
   - **Next step:** LLM analysis for deeper insights
   - **Coverage:** 13/25 venues matched, need to expand
   - **Impact:** HIGH - Best gender ratio inference
   - **Action:** Increase from 5 → 15 reviews per venue
   - **Cost:** ~$5-10/month for 200 venues

#### 2. **OpenAI API (gpt-4o-mini)** - LLM REVIEW ANALYSIS ✅ IMPLEMENTED
   - **What it tells us:** Structured extraction from reviews:
     - Gender ratio with confidence levels
     - Age range (20s, 30s, 40s+)
     - Vibe classification (social/loud/quiet/upscale/casual)
     - Best time to visit
     - Crowd type (professionals, students, tourists, locals)
     - Meeting potential score (pros/cons)
   - **How:** Batch process reviews per venue through OpenAI gpt-4o-mini
   - **Example prompt:** "Analyze these bar reviews and extract: 1) estimated male/female ratio, 2) typical age range, 3) social vibe (1-10), 4) best time to visit, 5) meeting potential"
   - **Status:** ✅ Script created → Ready to run
   - **Command:** `npm run analyze:openai`
   - **Cost:** $0.0006 per venue = **$0.60 for 1,000 venues**
   - **Processing:** ~2 minutes for 1,000 venues (10 req/sec)
   - **ROI:** Massively improves gender detection accuracy at negligible cost

#### 3. **Foursquare Places API** (Free - 950 calls/day) 🔄 READY TO ADD
   - **What it tells us:** User tips mentioning crowd demographics
   - **Coverage:** Good in NYC
   - **Impact:** MEDIUM - Alternative to Google reviews
   - **Action:** Add script to fetch tips + run through Claude
   - **Cost:** FREE

#### 4. **Yelp Fusion API** (Free - 5,000 calls/day) ✅ WORKING
   - **What it tells us:** Ratings, categories, business status
   - **Limitation:** No review text via API
   - **Impact:** LOW - Backup ratings only
   - **Cost:** FREE

---

### Tier 2: Activity Patterns 📊 BUSYNESS PROXY

#### 5. **NYC 311 Noise Complaints** (Free) ✅ WORKING
   - **What it tells us:** Historical weekend activity patterns
   - **Logic:** Friday 11PM complaints = venue is busy = more people
   - **Data:** Last 90 days, peak hours, day-of-week patterns
   - **Coverage:** 7/25 venues → expand to all
   - **Impact:** MEDIUM - Predicts busy nights
   - **Cost:** FREE

---

### Tier 3: Future Enhancements 🚀 LATER

#### 6. **Instagram Location Tags** (Via Apify - $5-10/month)
   - **What it tells us:** Photo volume = activity level
   - **Method:** Weekly scrape of top 50 venues
   - **Impact:** MEDIUM - Visual validation
   - **Status:** Phase 2 (requires budget)
   - **Cost:** $5-10/month

#### 7. **BestTime.app** (Paid - $9-49/month)
   - **What it tells us:** Real-time + historical busyness
   - **Why skip for now:** 311 data gives similar signal for free
   - **Status:** Phase 2 (if we get funding)
   - **Cost:** $9+/month

#### 8. **Google Places AI Summaries** (Not Available)
   - **Status:** ❌ Limited beta access only
   - **Issue:** New Google Places API (2024-2025) does NOT include AI summaries in public release
   - **Alternative:** Use Claude to summarize Google reviews ourselves
   - **Cost:** N/A (unavailable)
   - **Timeline:** Phase 3 (when/if Google opens access)

---

### ❌ What We Tried (Doesn't Work)

#### **Eventbrite API** - DEPRECATED
   - **Issue:** Public search endpoint removed in 2020
   - **Alternative:** Manual venue partnerships for event data
   - **Status:** Removed from codebase

#### **NYC Cabaret Licenses** - NO GPS DATA
   - **Issue:** Datasets lack venue coordinates for matching
   - **Status:** Removed from codebase

#### **Google Popular Times** - NOT IN API
   - **Issue:** Google doesn't expose popular times data officially
   - **Workaround:** 311 complaints serve as activity proxy
   - **Status:** Use 311 data instead

---

## 🚀 New Simplified Approach: Signal-Based Intelligence

### The Problem with v1.0
- ❌ Complex 5-factor weighted algorithm
- ❌ Missing data caused bad scores
- ❌ Users don't care about "socialibility score"
- ❌ Over-engineered for sparse data

### The v2.0 Solution: Show What We Know

**Instead of calculating a "meeting potential score", we show live intelligence:**

```typescript
interface VenueIntelligence {
  // 🔴 LIVE (what's happening RIGHT NOW)
  hasEventTonight: boolean;
  eventName?: string;               // "Ladies Night"
  eventTime?: string;               // "9 PM - 2 AM"
  currentBusyness?: number;         // 0-100 (Google Popular Times)

  // 📊 HISTORICAL (patterns from data)
  weekendActivity: number;          // 0-100 (from 311 data)
  peakHours: string[];              // ["10 PM", "11 PM", "12 AM"]
  consistencyScore: number;         // How reliable is this pattern?

  // ⭐ QUALITY (venue characteristics)
  rating: number;                   // 4.7 stars
  venueType: string;                // "Cocktail Bar"
  priceLevel: number;               // 1-4 ($-$$$$)

  // 👯 GENDER (from review analysis - when available)
  genderRatio?: {
    female: number;
    confidence: "high" | "medium" | "low";
  };

  // 🎯 AI INSIGHTS (future)
  vibe?: string;                    // "Upscale", "Casual"
  ageRange?: string;                // "20s-30s"
  crowdDescription?: string;        // AI summary

  // 📈 CONFIDENCE
  dataQuality: number;              // 0-100 (how much do we know?)
}
```

### Simple Scoring Logic

```typescript
function shouldIGoHere(intel: VenueIntelligence): string {
  // LIVE SIGNAL = instant recommendation
  if (intel.hasEventTonight && intel.eventName?.includes("ladies")) {
    return "🎉 GO NOW - Ladies night tonight!";
  }

  if (intel.currentBusyness > 75) {
    return "🔥 GO NOW - Busy right now!";
  }

  // HISTORICAL + QUALITY
  if (intel.weekendActivity > 70 && intel.rating > 4.5) {
    return "✨ Usually great on weekends";
  }

  // GENDER SIGNAL (if we have it)
  if (intel.genderRatio && intel.genderRatio.female > 50) {
    return "👯 Good gender balance";
  }

  // DEFAULT
  return "📍 Solid option";
}
```

---

### Data Collection Commands

```bash
# NEW: Fetch all live signals
npm run fetch:live          # Eventbrite events + Google busyness

# Historical patterns
npm run fetch:311           # NYC 311 complaints
npm run fetch:google        # Google Places reviews
npm run fetch:yelp          # Yelp ratings
npm run fetch:foursquare    # Foursquare tips

# One-time imports
npm run import:cabaret      # NYC cabaret licenses

# Run everything
npm run data:collect        # Runs all scripts in optimal order
```

---

## 💡 Feedback Needed

### Questions for Friends/Testers:

1. **What matters most to you?**
   - Gender ratio (lots of women there)
   - Vibe (easy to talk and socialize)
   - Quality (nice venue, good drinks)
   - Activity level (busy but not packed)

2. **Is 91% female TOO high?**
   - Would you rather go to a 55% female venue with great vibe?
   - Or a 91% female venue that's quiet/boring?

3. **Does venue type matter?**
   - Do you prefer cocktail lounges (quiet, talk-friendly)?
   - Or nightclubs (loud, dance-focused)?

4. **Should we show "Best Time to Go"?**
   - Example: "Output is best on Saturdays 11pm-1am"

5. **What's missing?**
   - Age range (21-25 vs 30-40)?
   - Dress code (casual vs upscale)?
   - Cover charge / price range?
   - Distance from you?

---

## 🚀 Next Steps

1. **Get feedback** on current algorithm
2. **Tune weights** based on real-world testing
3. **Add more data sources** (Foursquare, Instagram, events)
4. **Collect more reviews** for better gender analysis
5. **Add time-of-day predictions**
6. **Test with real users** in NYC

---

## 📝 Change Log

### v1.0 (Jan 2025)
- Initial algorithm with 5 factors
- Gender balance weighted at 40%
- Google Places reviews as primary source
- Color-coded map markers
- Top 3 venue badges

---

## 📧 Feedback

Share this doc with friends and send feedback to: [your email/form]

Or open an issue on GitHub: [repo link]

**Let's build the best algorithm together!** 🎉
