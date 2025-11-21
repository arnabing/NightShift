#!/usr/bin/env tsx
/**
 * NYC Cabaret License Data Import
 *
 * One-time/monthly import of NYC cabaret licenses to:
 * 1. Identify which venues have legal entertainment/dancing permits
 * 2. Validate "dance" mood venues
 * 3. Add credibility to venue database
 *
 * API Details:
 * - Free NYC Open Data
 * - Rate limit: 1,000/day (50,000 with app token)
 * - No cost
 *
 * License Types:
 * - Class 1 Cabaret: Full cabaret (live entertainment + dancing)
 * - Class 2 Cabaret: Limited cabaret (DJ/recorded music only)
 */

import { prisma } from "../../lib/prisma";

const NYC_OPEN_DATA_BASE = "https://data.cityofnewyork.us/resource";
const NYC_OPEN_DATA_APP_TOKEN = process.env.NYC_OPEN_DATA_APP_TOKEN;

interface CabaretLicense {
  license_number: string;
  license_status: string;
  license_expiration_date: string;
  license_issuance_date: string;
  license_type: string;
  business_name: string;
  street_number?: string;
  street_name?: string;
  borough: string;
  zip_code?: string;
  latitude?: string;
  longitude?: string;
  location?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

/**
 * Fetch all active cabaret licenses from NYC Open Data
 */
async function fetchCabaretLicenses(): Promise<CabaretLicense[]> {
  const url = new URL(`${NYC_OPEN_DATA_BASE}/n5mv-niye.json`);

  // Query parameters
  url.searchParams.set("$where", "license_status='ACTIVE'");
  url.searchParams.set("$limit", "50000"); // Get all active licenses

  // Optional: Add app token for higher rate limits
  if (NYC_OPEN_DATA_APP_TOKEN) {
    url.searchParams.set("$$app_token", NYC_OPEN_DATA_APP_TOKEN);
  }

  console.log("🔍 Fetching NYC cabaret licenses...");

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`NYC Open Data API error: ${response.status} ${response.statusText}`);
    }

    const licenses: CabaretLicense[] = await response.json();
    console.log(`✅ Found ${licenses.length} active cabaret licenses`);
    return licenses;
  } catch (error) {
    console.error("❌ Error fetching cabaret licenses:", error);
    return [];
  }
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Match cabaret license to venue by location
 */
async function matchLicenseToVenue(
  license: CabaretLicense
): Promise<{ venueId: string; distance: number } | null> {
  // Must have coordinates
  if (!license.latitude || !license.longitude) return null;

  const licenseLat = parseFloat(license.latitude);
  const licenseLng = parseFloat(license.longitude);

  // Sanity check coordinates
  if (isNaN(licenseLat) || isNaN(licenseLng)) return null;

  // Find all venues in database
  const venues = await prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
    },
  });

  // Find closest venue (within 100 meters)
  let closestVenue: { venueId: string; distance: number } | null = null;
  let minDistance = 100; // 100 meter threshold

  for (const venue of venues) {
    const distance = calculateDistance(venue.lat, venue.lng, licenseLat, licenseLng);
    if (distance < minDistance) {
      minDistance = distance;
      closestVenue = {
        venueId: venue.id,
        distance,
      };
    }
  }

  return closestVenue;
}

/**
 * Normalize license type for storage
 */
function normalizeLicenseType(licenseType: string): string {
  if (licenseType.includes("Class 1")) return "Class 1 Cabaret";
  if (licenseType.includes("Class 2")) return "Class 2 Cabaret";
  if (licenseType.toLowerCase().includes("cabaret")) return "Cabaret";
  return licenseType;
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🎭 NYC Cabaret License Importer\n");
  console.log("=" .repeat(80));

  // Fetch licenses
  const licenses = await fetchCabaretLicenses();

  if (licenses.length === 0) {
    console.log("\n❌ No licenses found");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📋 Processing ${licenses.length} licenses...\n`);

  let matched = 0;
  let unmatched = 0;

  // Filter for Manhattan only (where most nightlife is)
  const manhattanLicenses = licenses.filter(
    (license) => license.borough.toLowerCase() === "manhattan"
  );

  console.log(`📍 Focusing on ${manhattanLicenses.length} Manhattan licenses\n`);

  // Process each license
  for (const license of manhattanLicenses) {
    const match = await matchLicenseToVenue(license);

    if (match) {
      const normalizedType = normalizeLicenseType(license.license_type);

      // Update venue with cabaret license info
      await prisma.venue.update({
        where: { id: match.venueId },
        data: {
          cabaretLicense: true,
          cabaretLicenseType: normalizedType,
        },
      });

      matched++;

      if (matched <= 10) {
        // Show first 10 matches
        const venue = await prisma.venue.findUnique({
          where: { id: match.venueId },
          select: { name: true, neighborhood: true },
        });
        console.log(`✅ ${venue?.name} (${venue?.neighborhood})`);
        console.log(`   License: ${normalizedType}`);
        console.log(`   Match distance: ${match.distance.toFixed(0)}m\n`);
      }
    } else {
      unmatched++;
    }
  }

  console.log("=".repeat(80));
  console.log(`\n✅ Import complete!`);
  console.log(`   ${matched} licenses matched to venues`);
  console.log(`   ${unmatched} licenses unmatched (no nearby venue in database)`);

  // Show summary
  const venuesWithLicenses = await prisma.venue.findMany({
    where: {
      cabaretLicense: true,
    },
    select: {
      name: true,
      neighborhood: true,
      cabaretLicenseType: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  console.log(`\n🎭 Venues with cabaret licenses (${venuesWithLicenses.length} total):\n`);

  // Group by license type
  const class1 = venuesWithLicenses.filter((v) => v.cabaretLicenseType?.includes("Class 1"));
  const class2 = venuesWithLicenses.filter((v) => v.cabaretLicenseType?.includes("Class 2"));

  console.log(`   Class 1 Cabaret (full entertainment + dancing): ${class1.length}`);
  console.log(`   Class 2 Cabaret (DJ/recorded music): ${class2.length}\n`);

  if (class1.length > 0) {
    console.log(`   💃 Class 1 Venues (Perfect for "dance" mood):`);
    class1.slice(0, 10).forEach((v) => {
      console.log(`      - ${v.name} (${v.neighborhood})`);
    });
    if (class1.length > 10) {
      console.log(`      ... and ${class1.length - 10} more`);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
