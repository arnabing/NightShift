/**
 * NYS Liquor Authority Data Fetcher
 *
 * Fetches all licensed bars/nightlife venues in NYC from the
 * New York State Liquor Authority database.
 *
 * API Docs: https://data.ny.gov/Economic-Development/Liquor-Authority-Current-List-of-Active-Licenses/hrvs-fxs2
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NYS Liquor Authority API endpoint
const API_BASE = "https://data.ny.gov/resource/hrvs-fxs2.json";

// License types that indicate nightlife venues
const NIGHTLIFE_LICENSE_TYPES = [
  "OP", // On Premises Liquor
  "RW", // Restaurant Wine
  "RL", // Restaurant Liquor
  "CL", // Club Liquor
  "TW", // Tavern Wine
];

// NYC counties
const NYC_COUNTIES = ["New York", "Kings", "Queens", "Bronx", "Richmond"];

interface LiquorLicense {
  license_serial_number: string;
  license_type_code: string;
  premises_name: string;
  premises_address: string;
  premises_city: string;
  premises_county: string;
  premises_zip: string;
  license_status: string;
}

/**
 * Determine neighborhood from address/zip (simplified)
 */
function getNeighborhood(address: string, city: string, county: string): string {
  // Manhattan
  if (county === "New York") {
    if (address.includes("E ") || address.includes("East")) {
      if (address.match(/E [1-9]\d? St/)) return "East Village";
      if (address.match(/E [2-9]\d St/)) return "Gramercy";
    }
    if (address.includes("W ") || address.includes("West")) {
      if (address.match(/W [1-9]\d? St/)) return "West Village";
      if (address.match(/W [4-5]\d St/)) return "Hell's Kitchen";
    }
    if (address.includes("Bleecker") || address.includes("MacDougal"))
      return "Greenwich Village";
    if (address.includes("Houston")) return "SoHo";
    return "Manhattan";
  }

  // Brooklyn
  if (county === "Kings") {
    if (city.includes("Williamsburg")) return "Williamsburg";
    if (city.includes("Bushwick")) return "Bushwick";
    if (city.includes("Park Slope")) return "Park Slope";
    return "Brooklyn";
  }

  // Other boroughs
  if (county === "Queens") return "Queens";
  if (county === "Bronx") return "Bronx";
  if (county === "Richmond") return "Staten Island";

  return city || "NYC";
}

/**
 * Geocode an address using US Census Bureau Geocoder (FREE, no API key needed)
 * https://geocoding.geo.census.gov/geocoder/
 */
async function geocodeAddress(
  address: string,
  city: string,
  state: string = "NY"
): Promise<{ lat: number; lng: number } | null> {
  const fullAddress = `${address}, ${city}, ${state}`;
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(fullAddress)}&benchmark=Public_AR_Current&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.result?.addressMatches?.[0]) {
      const match = data.result.addressMatches[0];
      return {
        lat: match.coordinates.y,
        lng: match.coordinates.x,
      };
    }
  } catch (error) {
    console.error(`Geocoding error for ${address}:`, error);
  }

  return null;
}

/**
 * Fetch liquor licenses from NYS database
 */
async function fetchLiquorLicenses(): Promise<LiquorLicense[]> {
  console.log("Fetching liquor licenses from NYS database...");

  // Build query for active nightlife licenses in NYC
  const where = `license_status = 'Active' AND (${NIGHTLIFE_LICENSE_TYPES.map(
    (type) => `license_type_code = '${type}'`
  ).join(" OR ")}) AND (${NYC_COUNTIES.map(
    (county) => `premises_county = '${county}'`
  ).join(" OR ")})`;

  const url = `${API_BASE}?$where=${encodeURIComponent(where)}&$limit=10000`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const licenses: LiquorLicense[] = await response.json();
    console.log(`✓ Found ${licenses.length} active nightlife licenses in NYC\n`);

    return licenses;
  } catch (error) {
    console.error("Error fetching liquor licenses:", error);
    return [];
  }
}

/**
 * Import venues from liquor licenses
 */
async function importVenuesFromLicenses() {
  console.log("Starting venue import from NYS Liquor Authority...\n");

  const licenses = await fetchLiquorLicenses();

  if (licenses.length === 0) {
    console.log("No licenses found. Exiting.");
    return;
  }

  let imported = 0;
  let skipped = 0;
  let geocoded = 0;

  for (const license of licenses) {
    // Check if venue already exists
    const existing = await prisma.venue.findFirst({
      where: {
        OR: [
          { liquorLicenseId: license.license_serial_number },
          {
            AND: [
              { name: license.premises_name },
              { address: { contains: license.premises_address } },
            ],
          },
        ],
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Geocode address
    const coords = await geocodeAddress(
      license.premises_address,
      license.premises_city
    );

    if (!coords) {
      console.log(`⚠️  Could not geocode: ${license.premises_name}`);
      skipped++;
      continue;
    }

    geocoded++;

    // Create venue
    const neighborhood = getNeighborhood(
      license.premises_address,
      license.premises_city,
      license.premises_county
    );

    await prisma.venue.create({
      data: {
        name: license.premises_name,
        lat: coords.lat,
        lng: coords.lng,
        address: `${license.premises_address}, ${license.premises_city}, NY ${license.premises_zip}`,
        neighborhood,
        liquorLicenseId: license.license_serial_number,
        dataLayer: "base", // Mark as base layer venue
      },
    });

    console.log(
      `✓ [${imported + 1}] Imported: ${license.premises_name} (${neighborhood})`
    );
    imported++;

    // Rate limiting: wait 100ms between geocoding requests (Census is lenient)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Limit to 5000 new venues for full NYC coverage
    if (imported >= 5000) {
      console.log("\n⚠️  Reached import limit of 5000 venues");
      break;
    }

    // Progress update every 100 venues
    if (imported % 100 === 0) {
      console.log(`\n📊 Progress: ${imported} venues imported...\n`);
    }
  }

  console.log(`\n✓ Complete!`);
  console.log(`  - Imported: ${imported} new venues`);
  console.log(`  - Geocoded: ${geocoded} addresses`);
  console.log(`  - Skipped: ${skipped} (already exist or couldn't geocode)`);
}

// Run the script
importVenuesFromLicenses()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
