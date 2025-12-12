# NightShift

> Find the best bars to meet women in NYC. Stop asking the groupchat.

**Live:** [nightshift-djts.vercel.app](https://nightshift-djts.vercel.app)

## What It Does

NightShift shows you **3,937 NYC bars** on an interactive map with **Meeting Potential Scores** based on:
- Gender ratio estimates (from review analysis)
- Activity patterns (from 311 noise complaints)
- Venue type (lounges > nightclubs for actually talking)
- Ratings and vibe

Tap any venue to see details and open in Google Maps.

## Screenshots

| Map View | Venue Details |
|----------|---------------|
| Clustered markers, search, filters | Score breakdown, Google Maps link |

## Tech Stack

- **Next.js 16** (App Router, React 19)
- **Mapbox GL JS** (native clustering for 4k+ venues)
- **Vercel Postgres** + Prisma
- **Tailwind CSS v4** + shadcn/ui

## Quick Start

```bash
# Install
npm install

# Set up .env.local
NEXT_PUBLIC_MAPBOX_TOKEN=your_token
DATABASE_URL=your_postgres_url

# Run
npm run dev
```

## Data Sources

| Source | What We Get | Cost |
|--------|-------------|------|
| Google Places | 3,937 venues with ratings | ~$50 |
| NYC 311 API | Noise complaints = activity proxy | FREE |
| NYS Liquor Authority | 10k+ licensed bars | FREE |
| OpenAI | Gender/vibe from reviews | ~$5 |

## Features

- **Clustering**: Handles 4k venues smoothly (GPU-accelerated)
- **Search**: Find bars by name or neighborhood
- **Filters**: Toggle score factors (gender, activity, quality)
- **Drawer**: Venue details with Google Maps deep link
- **Mobile-first**: Designed for phone use

## Roadmap

### Done
- [x] 3,937 venues imported
- [x] Mapbox clustering
- [x] Meeting score algorithm
- [x] Search and filters
- [x] Venue drawer with Google Maps

### Next
- [ ] Heatmap layer ("hot areas" by time of day)
- [ ] Live busyness (Google Popular Times)
- [ ] Event integration (Eventbrite)
- [ ] More venues (NYS Liquor import)

## Development

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:push      # Push schema
npm run fetch:311    # Import 311 data
npm run fetch:google # Import Google Places
```

## Known Issues

- iOS Safari doesn't extend map behind notch/home indicator (Safari limitation)

## License

ISC
