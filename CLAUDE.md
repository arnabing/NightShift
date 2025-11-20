# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NightShift is a NYC nightlife guide that helps users find venues based on their mood. The core UX is a Fender amp-style dial for selecting vibes ("Nice cocktails", "Dive loser", "Sports", "Find love", "Dance"), followed by a map view showing relevant venues.

**Current Status**: MVP phase with landing page and mood selector completed. Map integration and venue data seeding are next priorities.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (opens on http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Tech Stack

- **Framework**: Next.js 16 with App Router (React 19)
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS v4 (using PostCSS plugin)
- **UI Components**: shadcn/ui (New York style)
- **Deployment Target**: Vercel
- **Future**: Vercel Postgres for database

## Architecture

### File Structure

```
app/
├── layout.tsx          # Root layout with dark mode, Inter font
├── page.tsx            # Main page - state manager for mood selection flow
└── globals.css         # Theme variables, glass morphism, neon effects

components/
├── mood-selector.tsx   # Glass morphism modal with dial and "Let's Go" button
├── mood-dial.tsx       # SVG-based Fender amp dial (circular mood selector)
└── map-view.tsx        # Map view shown after mood selection

lib/
└── utils.ts            # cn() helper for Tailwind class merging
```

### Component Flow

1. **app/page.tsx** manages global state:
   - `selectedMood`: Current mood selection ("cocktails" | "dive" | "sports" | "love" | "dance" | null)
   - `showMap`: Boolean to toggle between MoodSelector and MapView
   - Handles transitions with 300ms delays for animations

2. **MoodSelector** contains:
   - Glass morphism modal wrapper
   - MoodDial component for interactive selection
   - "Let's Go" button that triggers transition to map

3. **MoodDial** features:
   - SVG-based circular dial (360x360 viewBox)
   - 5 mood options positioned around circle with trigonometry
   - Center knob with pointer that animates to selected mood
   - Tick marks for each mood position

### State Management

State is lifted to `app/page.tsx` and flows down via props. No global state management library is used.

### Type System

- `Mood` type defined in `app/page.tsx`: `"cocktails" | "dive" | "sports" | "love" | "dance" | null`
- All components use TypeScript with strict mode
- Import alias `@/*` maps to root directory

## Styling System

### Theme

The app uses a custom nightlife theme defined in `app/globals.css`:
- **Primary**: `hsl(270 80% 60%)` - Vibrant purple for main accents
- **Secondary**: `hsl(240 70% 55%)` - Electric blue
- **Accent**: `hsl(320 75% 58%)` - Hot pink/magenta
- **Background**: `hsl(240 10% 8%)` - Very dark blue-gray

All colors use CSS custom properties (e.g., `hsl(var(--primary))`).

### Custom Classes

- `.glass` - Glass morphism with backdrop blur for modals
- `.glass-light` - Lighter variant of glass morphism
- `.nyc-background` - Subtle NYC skyline SVG pattern
- `.neon-glow` - Purple neon box-shadow effect
- `.neon-text` - Purple neon text-shadow effect

### shadcn/ui Configuration

Configured in `components.json`:
- Style: "new-york"
- Base color: "zinc"
- Uses CSS variables for theming
- Component aliases: `@/components`, `@/lib/utils`, `@/components/ui`

## Design Philosophy

**Nightlife Aesthetic:**
- Dark mode always enabled (set in `app/layout.tsx`)
- High contrast for readability in dim lighting
- Glass morphism effects for depth
- Neon purple/blue accents for energy
- Ambient gradient overlays on backgrounds

**Copy Tone:**
- Casual, bro-friendly language ("Stop asking the groupchat, just check the map")
- Playful mood labels ("Dive loser", "Find love")

**Mobile-First:**
- Responsive breakpoints using Tailwind's `md:` prefix
- Touch-friendly button sizes
- No authentication required for MVP

## Planned Data Architecture

The app will integrate multiple data sources:

1. **NYC 311 API** - Noise complaints (indicates busy/loud venues)
2. **NYS Liquor Authority** - All licensed venues database
3. **Yelp Fusion API** - Reviews and ratings
4. **BestTime.app** - Foot traffic data
5. **AI Analysis** - Claude API for review sentiment analysis
6. **Crowdsourcing** - User-submitted reports (Phase 3)

These will populate the map view with venue markers and demographic indicators.

## Next Development Priorities

Per the roadmap in README.md:

**Phase 1 (Current MVP):**
- ✅ Landing page with mood selector
- ✅ Glass morphism modal
- ✅ Fender amp-style dial UI
- 🚧 Map integration
- 🚧 Venue data seeding

**Phase 2:** Data layer integration (APIs listed above)

**Phase 3:** Crowdsourcing and gamification

**Phase 4:** User accounts and social features
