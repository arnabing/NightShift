#!/usr/bin/env tsx
/**
 * Google Places Nearby Search for NYC Bars
 *
 * Searches for bars in different NYC neighborhoods using Google Places Nearby Search.
 * Creates base layer venues with coordinates (no geocoding needed).
 *
 * Cost: ~$32 per 1,000 requests = $1.60 for 50 searches = ~1,000 bars
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// NYC neighborhoods with center coordinates
const NYC_NEIGHBORHOODS = [
  { name: "East Village", lat: 40.7264, lng: -73.9838 },
  { name: "West Village", lat: 40.7336, lng: -74.0027 },
  { name: "Lower East Side", lat: 40.7150, lng: -73.9843 },
  { name: "SoHo", lat: 40.7233, lng: -73.9985 },
  { name: "Greenwich Village", lat: 40.7336, lng: -74.0027 },
  { name: "Chelsea", lat: 40.7465, lng: -74.0014 },
  { name: "Hell's Kitchen", lat: 40.7638, lng: -73.9918 },
  { name: "Midtown", lat: 40.7549, lng: -73.9840 },
  { name: "Upper East Side", lat: 40.7736, lng: -73.9566 },
  { name: "Upper West Side", lat: 40.7870, lng: -73.9754 },
  { name: "Williamsburg", lat: 40.7081, lng: -73.9571 },
  { name: "Bushwick", lat: 40.6944, lng: -73.9213 },
  { name: "Park Slope", lat: 40.6710, lng: -73.9777 },
  { name: "DUMBO", lat: 40.7033, lng: -73.9881 },
  { name: "Astoria", lat: 40.7644, lng: -73.9235 },
  { name: "Long Island City", lat: 40.7447, lng: -73.9485 },
  { name: "Harlem", lat: 40.8116, lng: -73.9465 },
  { name: "Tribeca", lat: 40.7163, lng: -74.0086 },
  { name: "Financial District", lat: 40.7075, lng: -74.0089 },
  { name: "Murray Hill", lat: 40.7479, lng: -73.9757 },
];

interface GooglePlace {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types?: string[];
}

async function searchBarsInNeighborhood(
  neighborhood: { name: string; lat: number; lng: number },
  radius: number = 1500
): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY not set");
    return [];
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${neighborhood.lat},${neighborhood.lng}&radius=${radius}&type=bar&key=${GOOGLE_PLACES_API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results) {
      return data.results;
    } else {
      console.warn(`No results for ${neighborhood.name}: ${data.status}`);
      return [];
    }
  } catch (error) {
    console.error(`Error searching ${neighborhood.name}:`, error);
    return [];
  }
}

async function importBarsFromGoogle() {
  console.log("Searching for bars in NYC using Google Places...\n");

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("❌ GOOGLE_PLACES_API_KEY not set in environment");
    process.exit(1);
  }

  let totalImported = 0;
  let totalSkipped = 0;

  for (const neighborhood of NYC_NEIGHBORHOODS) {
    console.log(`\n📍 Searching ${neighborhood.name}...`);

    const bars = await searchBarsInNeighborhood(neighborhood);
    console.log(`   Found ${bars.length} bars`);

    for (const bar of bars) {
      // Check if venue already exists
      const existing = await prisma.venue.findFirst({
        where: {
          OR: [
            { googlePlaceId: bar.place_id },
            {
              AND: [
                { name: bar.name },
                { lat: { gte: bar.geometry.location.lat - 0.001, lte: bar.geometry.location.lat + 0.001 } },
                { lng: { gte: bar.geometry.location.lng - 0.001, lte: bar.geometry.location.lng + 0.001 } },
              ],
            },
          ],
        },
      });

      if (existing) {
        totalSkipped++;
        continue;
      }

      // Create new venue
      await prisma.venue.create({
        data: {
          name: bar.name,
          lat: bar.geometry.location.lat,
          lng: bar.geometry.location.lng,
          address: bar.vicinity || `${neighborhood.name}, NYC`,
          neighborhood: neighborhood.name,
          googlePlaceId: bar.place_id,
          rating: bar.rating,
          priceLevel: bar.price_level,
          dataLayer: "base",
        },
      });

      console.log(`   ✓ Imported: ${bar.name}`);
      totalImported++;
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   - Imported: ${totalImported} new bars`);
  console.log(`   - Skipped: ${totalSkipped} (already exist)`);
  console.log(`   - API calls: ${NYC_NEIGHBORHOODS.length}`);
  console.log(`   - Est. cost: $${(NYC_NEIGHBORHOODS.length * 0.032).toFixed(2)}`);

  // Get total count
  const totalVenues = await prisma.venue.count();
  console.log(`\n📊 Total venues in database: ${totalVenues}`);
}

// Run the script
importBarsFromGoogle()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
