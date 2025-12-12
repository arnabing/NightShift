#!/usr/bin/env tsx
/**
 * Google Places Grid-Based Bar Search for NYC
 *
 * Uses a systematic grid pattern to find all bars in NYC.
 * - Dense grid in nightlife hotspots (East Village, Williamsburg, etc.)
 * - Medium grid in secondary areas
 * - Sparse grid in outer areas
 * - Pagination to get up to 60 results per search point
 *
 * Expected: 3,500-4,500 unique bars
 * Cost: $0 (within Google's $200/mo free tier)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Grid configuration for different density zones
interface GridZone {
  name: string;
  bounds: { sw: [number, number]; ne: [number, number] };
  gridSize: number; // in degrees (~111m per 0.001 lat)
  radius: number; // search radius in meters
}

const GRID_ZONES: GridZone[] = [
  // DENSE NIGHTLIFE - 350m grid, 350m radius
  {
    name: "East Village",
    bounds: { sw: [40.7220, -73.9920], ne: [40.7320, -73.9780] },
    gridSize: 0.0032,
    radius: 350,
  },
  {
    name: "West Village",
    bounds: { sw: [40.7280, -74.0080], ne: [40.7380, -73.9950] },
    gridSize: 0.0032,
    radius: 350,
  },
  {
    name: "Lower East Side",
    bounds: { sw: [40.7130, -73.9920], ne: [40.7220, -73.9780] },
    gridSize: 0.0032,
    radius: 350,
  },
  {
    name: "Williamsburg",
    bounds: { sw: [40.7050, -73.9680], ne: [40.7200, -73.9450] },
    gridSize: 0.0032,
    radius: 350,
  },
  {
    name: "Hell's Kitchen",
    bounds: { sw: [40.7550, -74.0000], ne: [40.7700, -73.9850] },
    gridSize: 0.0032,
    radius: 350,
  },
  {
    name: "Greenwich Village",
    bounds: { sw: [40.7280, -74.0050], ne: [40.7380, -73.9920] },
    gridSize: 0.0032,
    radius: 350,
  },

  // MEDIUM DENSITY - 500m grid, 500m radius
  {
    name: "SoHo/NoLita",
    bounds: { sw: [40.7180, -74.0050], ne: [40.7280, -73.9900] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Chelsea",
    bounds: { sw: [40.7380, -74.0080], ne: [40.7550, -73.9920] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Tribeca",
    bounds: { sw: [40.7130, -74.0150], ne: [40.7220, -74.0000] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Bushwick",
    bounds: { sw: [40.6880, -73.9350], ne: [40.7050, -73.9100] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Park Slope",
    bounds: { sw: [40.6650, -73.9900], ne: [40.6850, -73.9700] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Greenpoint",
    bounds: { sw: [40.7200, -73.9600], ne: [40.7350, -73.9400] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "DUMBO/Brooklyn Heights",
    bounds: { sw: [40.6900, -74.0050], ne: [40.7050, -73.9850] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Midtown East",
    bounds: { sw: [40.7480, -73.9800], ne: [40.7600, -73.9650] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Midtown West",
    bounds: { sw: [40.7480, -73.9950], ne: [40.7600, -73.9800] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Murray Hill/Kips Bay",
    bounds: { sw: [40.7380, -73.9850], ne: [40.7480, -73.9700] },
    gridSize: 0.0045,
    radius: 500,
  },
  {
    name: "Financial District",
    bounds: { sw: [40.7000, -74.0200], ne: [40.7130, -74.0000] },
    gridSize: 0.0045,
    radius: 500,
  },

  // SPARSE - 700m grid, 700m radius
  {
    name: "Upper East Side",
    bounds: { sw: [40.7600, -73.9750], ne: [40.7850, -73.9500] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Upper West Side",
    bounds: { sw: [40.7700, -73.9950], ne: [40.8000, -73.9650] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Harlem",
    bounds: { sw: [40.8000, -73.9650], ne: [40.8200, -73.9350] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Astoria",
    bounds: { sw: [40.7550, -73.9400], ne: [40.7800, -73.9100] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Long Island City",
    bounds: { sw: [40.7350, -73.9600], ne: [40.7550, -73.9350] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Crown Heights",
    bounds: { sw: [40.6650, -73.9600], ne: [40.6850, -73.9350] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Bed-Stuy",
    bounds: { sw: [40.6750, -73.9550], ne: [40.6950, -73.9250] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Fort Greene/Clinton Hill",
    bounds: { sw: [40.6850, -73.9850], ne: [40.7000, -73.9600] },
    gridSize: 0.0063,
    radius: 700,
  },
  {
    name: "Cobble Hill/Carroll Gardens",
    bounds: { sw: [40.6750, -74.0050], ne: [40.6900, -73.9850] },
    gridSize: 0.0063,
    radius: 700,
  },
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

interface SearchResponse {
  results: GooglePlace[];
  next_page_token?: string;
  status: string;
}

/**
 * Generate grid points for a zone
 */
function generateGridPoints(zone: GridZone): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const { sw, ne } = zone.bounds;

  for (let lat = sw[0]; lat <= ne[0]; lat += zone.gridSize) {
    for (let lng = sw[1]; lng <= ne[1]; lng += zone.gridSize) {
      points.push({ lat, lng });
    }
  }

  return points;
}

/**
 * Search for bars at a specific location with pagination
 */
async function searchBarsAtLocation(
  lat: number,
  lng: number,
  radius: number
): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY not set");
  }

  const allResults: GooglePlace[] = [];
  let pageToken: string | undefined;
  let pageCount = 0;

  do {
    const url = pageToken
      ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${pageToken}&key=${GOOGLE_PLACES_API_KEY}`
      : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=bar&key=${GOOGLE_PLACES_API_KEY}`;

    try {
      const response = await fetch(url);
      const data: SearchResponse = await response.json();

      if (data.status === "OK" && data.results) {
        allResults.push(...data.results);
      } else if (data.status === "ZERO_RESULTS") {
        break;
      } else if (data.status !== "OK") {
        console.warn(`  API status: ${data.status}`);
        break;
      }

      pageToken = data.next_page_token;
      pageCount++;

      // Google requires 2 second delay before using next_page_token
      if (pageToken) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  Error at ${lat},${lng}:`, error);
      break;
    }
  } while (pageToken && pageCount < 3); // Max 3 pages = 60 results

  return allResults;
}

/**
 * Determine neighborhood from coordinates
 */
function getNeighborhoodFromCoords(lat: number, lng: number): string {
  // Check which zone the coordinates fall into
  for (const zone of GRID_ZONES) {
    const { sw, ne } = zone.bounds;
    if (lat >= sw[0] && lat <= ne[0] && lng >= sw[1] && lng <= ne[1]) {
      return zone.name;
    }
  }
  return "NYC";
}

/**
 * Main import function
 */
async function importBarsFromGoogle() {
  console.log("🗺️  Google Places Grid-Based Bar Search");
  console.log("========================================\n");

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("❌ GOOGLE_PLACES_API_KEY not set in environment");
    process.exit(1);
  }

  // Calculate total grid points
  let totalPoints = 0;
  for (const zone of GRID_ZONES) {
    const points = generateGridPoints(zone);
    totalPoints += points.length;
  }
  console.log(`📍 Total search points: ${totalPoints}`);
  console.log(`📊 Estimated API calls: ${totalPoints * 3} (with pagination)`);
  console.log(`💰 Estimated cost: $${((totalPoints * 3 * 0.032)).toFixed(2)} (within free tier)\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalSearches = 0;
  const seenPlaceIds = new Set<string>();

  for (const zone of GRID_ZONES) {
    const gridPoints = generateGridPoints(zone);
    console.log(`\n📍 ${zone.name} (${gridPoints.length} points, ${zone.radius}m radius)`);

    for (let i = 0; i < gridPoints.length; i++) {
      const point = gridPoints[i];
      totalSearches++;

      process.stdout.write(`   [${i + 1}/${gridPoints.length}] Searching ${point.lat.toFixed(4)},${point.lng.toFixed(4)}...`);

      const bars = await searchBarsAtLocation(point.lat, point.lng, zone.radius);
      console.log(` found ${bars.length} bars`);

      for (const bar of bars) {
        // Skip if we've already seen this place_id in this run
        if (seenPlaceIds.has(bar.place_id)) {
          continue;
        }
        seenPlaceIds.add(bar.place_id);

        // Check if venue already exists in database
        const existing = await prisma.venue.findFirst({
          where: {
            OR: [
              { googlePlaceId: bar.place_id },
              {
                AND: [
                  { name: bar.name },
                  {
                    lat: {
                      gte: bar.geometry.location.lat - 0.0001,
                      lte: bar.geometry.location.lat + 0.0001,
                    },
                  },
                  {
                    lng: {
                      gte: bar.geometry.location.lng - 0.0001,
                      lte: bar.geometry.location.lng + 0.0001,
                    },
                  },
                ],
              },
            ],
          },
        });

        if (existing) {
          totalSkipped++;
          continue;
        }

        // Determine neighborhood
        const neighborhood = getNeighborhoodFromCoords(
          bar.geometry.location.lat,
          bar.geometry.location.lng
        );

        // Create new venue
        await prisma.venue.create({
          data: {
            name: bar.name,
            lat: bar.geometry.location.lat,
            lng: bar.geometry.location.lng,
            address: bar.vicinity || `${neighborhood}, NYC`,
            neighborhood,
            googlePlaceId: bar.place_id,
            rating: bar.rating,
            priceLevel: bar.price_level,
            dataLayer: "base",
          },
        });

        totalImported++;

        // Progress update every 100 imports
        if (totalImported % 100 === 0) {
          console.log(`\n   📊 Progress: ${totalImported} venues imported...`);
        }
      }

      // Rate limiting between searches
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   - Total searches: ${totalSearches}`);
  console.log(`   - Unique bars found: ${seenPlaceIds.size}`);
  console.log(`   - New venues imported: ${totalImported}`);
  console.log(`   - Skipped (already exist): ${totalSkipped}`);
  console.log(`   - Est. API cost: $${((totalSearches * 3 * 0.032)).toFixed(2)}`);

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
