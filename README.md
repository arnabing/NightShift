# NightShift 🌃

> Stop asking the groupchat, just check the map

**NightShift helps you find the best venues in NYC to meet women**, using real data and AI to score venues by meeting potential. No guesswork, no groupchat debates—just open the app and see where you should actually go tonight.

## The Problem

"Where should we go tonight?" is the most common question in the groupchat. Everyone has opinions, nobody has data. You waste 45 minutes debating bars, end up at the same place as last week, and wonder why you're surrounded by dudes watching basketball.

## The Solution

NightShift analyzes **311 noise complaint patterns** to predict which venues will be active tonight, combines that with gender ratio estimates from review NLP, and gives each venue a **Meeting Potential Score** (0-100) based on:

- **Gender Balance** (30%) - Estimated from review analysis
- **Activity Level** (25%) - Predicted from 311 complaint trends
- **Socialibility** (20%) - Can you actually talk? (lounges > nightclubs)
- **Quality** (15%) - Overall ratings
- **Vibe** (10%) - Sentiment analysis from reviews

## Key Innovation: Predictive 311 Analysis

Most apps tell you where it's busy *right now*. NightShift predicts where it *will be* busy by analyzing weekly 311 noise complaint patterns. If a bar gets complaints every Friday at 11PM for the last 10 weeks, we know to recommend it this Friday at 11PM.

## Features

- 📊 **Meeting Potential Scores** - 0-100 composite score for every venue
- 👥 **Gender Ratio Estimates** - Inferred from AI analysis of review text
- 🔮 **Activity Predictions** - Based on historical 311 complaint patterns
- ⏰ **Best Times to Go** - Peak hours when venues are consistently active
- 🗺️ **Interactive Map** - See all venues with real-time scores
- 💎 **Glass Morphism UI** - Beautiful nightlife-themed interface

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4 with custom nightlife theme
- **UI Components**: shadcn/ui
- **Map**: Mapbox GL JS with react-map-gl
- **Database**: Vercel Postgres + Prisma ORM
- **Deployment**: Vercel

## How It Works

1. **Collect 311 Noise Complaints** - Pull historical data from NYC 311 API
2. **Identify Activity Patterns** - Analyze complaint frequency by day/hour (e.g., every Friday 10PM-1AM)
3. **Analyze Reviews with Claude AI** - Extract gender ratio signals from Yelp/Foursquare reviews
4. **Calculate Meeting Scores** - Combine all signals into 0-100 composite score
5. **Predict Tonight** - Show venues likely to be active based on historical patterns

## Data Sources - Activity Hotspot Intelligence

**Foundation (FREE - Already Built):**
1. **NYC 311 API** - Noise complaints = activity proxy (free, public data)
2. **NYS Liquor Authority** - Complete list of all licensed NYC venues (free, public data)

**Activity Intelligence (Implementing Now):**
3. **Yelp Fusion API** - Reviews, gender mentions, social vibe (5K calls/day free)
4. **BestTime.app OR Google Places** - Real-time foot traffic, live busyness ($200/mo or $20/mo)
5. **Eventbrite API** - Tonight's events, ladies nights, mixers (free)
6. **Claude AI** - NLP analysis for gender ratios (~$5-10 one-time)

## Getting Started

### Prerequisites

1. **Mapbox Access Token**
   - Sign up at [mapbox.com](https://account.mapbox.com/)
   - Create a token with default public scopes

2. **Vercel Postgres Database** (for production)
   - Create a Vercel project
   - Add Vercel Postgres storage
   - Copy connection string

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
# Create .env.local and add:
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
DATABASE_URL=your_postgres_connection_string_here

# 3. Set up database (if using Vercel Postgres or local Postgres)
npm run db:push      # Push schema to database
npm run db:seed      # Seed with NYC venue data

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Deployment to Vercel

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Deploy
vercel

# 3. Add environment variables in Vercel dashboard:
# - NEXT_PUBLIC_MAPBOX_TOKEN
# - DATABASE_URL (automatically added if using Vercel Postgres)

# 4. Run database migrations and seed
# In Vercel dashboard, go to your project settings and run:
# npm run db:push && npm run db:seed
```

The app will automatically build and deploy on push to main branch.

## Design Philosophy

**Apple Maps-Inspired Interface:**
- Light, clean backgrounds for readability
- Glass morphism blur effects (frosted glass aesthetic)
- Minimal UI elements
- Bottom drawer for venue details (like Apple Maps)
- High-quality visuals and smooth animations

**User Experience:**
- Simple mood selection (5 options)
- Minimal friction (no login required initially)
- Mobile-first responsive design
- Real-time activity indicators ("Busy Now: 85%")
- Show users where fun is happening RIGHT NOW

## Roadmap

### Phase 1: UI Foundation ✅ COMPLETE
- [x] Landing page with mood selector
- [x] Glass morphism modal
- [x] Fender amp-style dial UI
- [x] Map view with venue list
- [x] Venue database (25 NYC venues seeded)
- [x] Mood-based filtering
- [x] Prisma + Vercel Postgres setup

### Phase 2: 311 Complaint Pipeline 🚧 IN PROGRESS
- [ ] Create data collection scripts for NYC 311 API
- [ ] Pull 90 days of noise complaint data
- [ ] Build complaint pattern analysis (weekly trends)
- [ ] Implement prediction algorithm (forecast busy nights)
- [ ] Add `noiseComplaints` and `complaintPattern` to Venue schema
- [ ] Create API endpoint: `/api/venues/predictions`

### Phase 3: Review NLP Analysis
- [ ] Set up Claude AI integration
- [ ] Fetch Yelp reviews for all venues (500/day rate limit)
- [ ] Implement gender ratio extraction from reviews
- [ ] Calculate socialibility scores from sentiment
- [ ] Add `genderRatio` and `reviewSentiment` to Venue schema
- [ ] Build review refresh pipeline (weekly cron job)

### Phase 4: Meeting Potential Scoring
- [ ] Implement composite scoring algorithm
- [ ] Add `meetingScore` calculation to all venues
- [ ] Create venue ranking system (top 10 by mood)
- [ ] Add filtering: "Show only 70+ scores"
- [ ] Display scores in map markers and venue cards

### Phase 5: UI Enhancements
- [ ] Replace venue list with real Mapbox integration
- [ ] Custom markers with meeting score indicators
- [ ] "Best time to go" display in venue details
- [ ] Activity prediction timeline (next 7 days)
- [ ] Filter by neighborhood, price level, score threshold

### Phase 6: Crowdsourcing (Future)
- [ ] User check-in flow
- [ ] Real-time gender ratio updates
- [ ] Gamification (points, badges)
- [ ] Share venue recommendations with friends

## Color Palette

```css
Primary: hsl(270 80% 60%)    /* Vibrant purple */
Secondary: hsl(240 70% 55%)  /* Electric blue */
Accent: hsl(320 75% 58%)     /* Hot pink/magenta */
Background: hsl(240 10% 8%)  /* Very dark blue-gray */
```

## License

ISC

## Contributing

Built with love for the NYC nightlife crew. PRs welcome!
