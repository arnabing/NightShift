# NightShift Meeting Potential Algorithm

**Last Updated:** January 2025
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

## 📊 Data Sources

### Currently Implemented ✅

1. **Google Places API** ($1.02 for 25 venues) - PRIMARY SOURCE
   - Reviews with full text for gender analysis
   - 13/25 venues matched
   - Up to 5 reviews per venue
   - Best source for gender keywords
   - **Status:** ✅ Working

2. **Foursquare API** (Free - 950 calls/day) - SUPPLEMENTAL
   - Venue tips (user-generated content)
   - Alternative review source
   - Smart update: only overwrites if better data
   - **Status:** 🔄 Ready to run (need API key)

3. **Yelp Fusion API** (Free - 5,000 calls/day) - BACKUP
   - Business ratings and categories
   - 6/25 venues matched
   - No review text (API restricted)
   - Used for backup ratings only
   - **Status:** ✅ Working

4. **NYC 311 Open Data** (Free) - ACTIVITY PROXY
   - Noise complaints in last 90 days
   - 7/25 venues with data
   - Not reliable proxy for busyness
   - Weighted at only 10%
   - **Status:** ✅ Working

### Missing Data Sources 🔴

5. **Real-Time Foot Traffic**
   - Google Popular Times (free but hard to access)
   - BestTime.app ($20/month)
   - Alternative: Instagram check-ins?
   - **Status:** ❌ Not implemented

6. **Events Calendar**
   - Eventbrite API (ladies nights, mixers)
   - Venue websites (weekly schedules)
   - Instagram/social media scraping
   - **Status:** ❌ Not implemented

### Data Collection Commands

```bash
# Run all data sources in sequence (recommended order)
npm run data:collect

# Or run individually:
npm run fetch:google      # Google Places (primary)
npm run fetch:foursquare  # Foursquare (supplemental)
npm run fetch:yelp        # Yelp (backup ratings)
npm run fetch:311         # NYC 311 complaints
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
