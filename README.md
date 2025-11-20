# NightShift 🌃

> Stop asking the groupchat, just check the map

A NYC nightlife guide that helps you find the hottest spots based on your mood. Built for the boys who can't decide where to go.

## Features

- 🎨 **Mood-Based Discovery** - Select your vibe with a Fender amp-style dial
- 🗺️ **Interactive Map** - See venues with demographic indicators (coming soon)
- 🔥 **Crowdsourced Data** - Real-time reports from users
- 📊 **Multi-Source Intelligence** - Combining 311 complaints, reviews, and foot traffic data
- 💎 **Glass Morphism UI** - Beautiful nightlife-themed interface

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS v4 with custom nightlife theme
- **UI Components**: shadcn/ui
- **Map**: Mapbox GL JS with react-map-gl
- **Database**: Vercel Postgres + Prisma ORM
- **Deployment**: Vercel

## Mood Options

- 🍸 **Nice cocktails** - Upscale bars, rooftops, lounges
- 🍺 **Dive loser** - Dive bars, cheap drinks, casual vibes
- 🏈 **Sports** - Sports bars, watch parties
- 💕 **Find love** - Best spots to meet people
- 💃 **Dance** - Clubs, dance venues, DJ sets

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

**Nightlife Theme:**
- Dark background with neon purple/blue accents
- Glass morphism effects for modals
- Subtle NYC skyline in background
- High contrast for easy reading in dim light

**User Experience:**
- Simple mood selection (5 options)
- Minimal friction (no login required initially)
- Mobile-first responsive design
- Fun, bro-friendly copy

## Roadmap

### Phase 1: MVP ✅ COMPLETE
- [x] Landing page with mood selector
- [x] Glass morphism modal
- [x] Fender amp-style dial UI
- [x] Mapbox GL JS integration
- [x] Interactive venue markers with emoji indicators
- [x] Venue database (25 NYC venues seeded)
- [x] Mood-based filtering
- [x] Prisma + Vercel Postgres setup

### Phase 2: Data Layer
- [ ] NYC 311 noise complaint integration
- [ ] Yelp/Google reviews AI analysis
- [ ] BestTime.app foot traffic data
- [ ] NYS Liquor Authority venue database
- [ ] Demographic inference algorithms

### Phase 3: Crowdsourcing
- [ ] User check-in flow
- [ ] Gamification (points, badges)
- [ ] Personality questions
- [ ] Real-time data aggregation

### Phase 4: Polish
- [ ] User accounts
- [ ] Save favorites
- [ ] Share with friends
- [ ] Push notifications

## Data Sources

1. **NYC 311 API** - Noise complaints (free)
2. **NYS Liquor Authority** - All licensed venues (free)
3. **Yelp Fusion API** - Reviews and ratings (free tier)
4. **BestTime.app** - Foot traffic data ($9/mo)
5. **AI Analysis** - Claude API for review analysis (~$20 one-time)
6. **Crowdsourcing** - User-submitted reports (free)

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
