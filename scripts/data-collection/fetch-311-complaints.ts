/**
 * NYC 311 Noise Complaint Data Fetcher
 *
 * Fetches noise complaint data from NYC Open Data API and analyzes patterns
 * to predict venue activity levels.
 *
 * API Docs: https://dev.socrata.com/foundry/data.cityofnewyork.us/erm2-nwe9
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// NYC 311 API endpoint
const API_BASE = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

// Complaint types that indicate nightlife activity
const NIGHTLIFE_COMPLAINT_TYPES = [
  "Noise - Commercial",
  "Noise - Street/Sidewalk",
  "Noise - House of Worship",
  "Noise, Barking Dog (NR5)",
  "Drinking",
  "Disorderly Youth",
];

interface Complaint {
  unique_key: string;
  created_date: string;
  complaint_type: string;
  descriptor: string;
  incident_address: string;
  latitude: string;
  longitude: string;
  borough: string;
}

interface ComplaintPattern {
  total: number;
  byDayOfWeek: { [day: string]: number };
  byHour: { [hour: string]: number };
  fridays: number[];
  saturdays: number[];
  peakHours: string[];
  consistencyScore: number;
}

/**
 * Calculate distance between two coordinates in meters
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Fetch 311 complaints for a specific location within radius
 */
async function fetchComplaints(
  lat: number,
  lng: number,
  radiusMeters: number = 50,
  daysBack: number = 90
): Promise<Complaint[]> {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - daysBack);
  const dateFilter = ninetyDaysAgo.toISOString().split("T")[0];

  // Build SODA query
  const where = `created_date >= '${dateFilter}'`;
  const limit = 10000;

  const url = `${API_BASE}?$where=${encodeURIComponent(where)}&$limit=${limit}`;

  console.log(`Fetching 311 complaints from ${dateFilter}...`);

  try {
    const response = await fetch(url, {
      headers: {
        "X-App-Token": process.env.NYC_OPEN_DATA_APP_TOKEN || "",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const allComplaints: Complaint[] = await response.json();

    // Filter to complaints near venue
    const nearby = allComplaints.filter((complaint) => {
      if (!complaint.latitude || !complaint.longitude) return false;
      const cLat = parseFloat(complaint.latitude);
      const cLng = parseFloat(complaint.longitude);
      if (isNaN(cLat) || isNaN(cLng)) return false;

      const distance = getDistance(lat, lng, cLat, cLng);
      return distance <= radiusMeters;
    });

    return nearby;
  } catch (error) {
    console.error("Error fetching 311 data:", error);
    return [];
  }
}

/**
 * Analyze complaint patterns to predict activity
 */
function analyzePattern(complaints: Complaint[]): ComplaintPattern {
  const byDayOfWeek: { [day: string]: number } = {};
  const byHour: { [hour: string]: number } = {};
  const fridays: number[] = Array(10).fill(0);
  const saturdays: number[] = Array(10).fill(0);

  complaints.forEach((complaint) => {
    const date = new Date(complaint.created_date);
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    const hour = date.getHours().toString().padStart(2, "0");

    byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
    byHour[hour] = (byHour[hour] || 0) + 1;

    // Track last 10 Fridays/Saturdays
    if (day === "Friday") {
      const weekIndex = Math.floor(
        (Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (weekIndex < 10) {
        fridays[weekIndex]++;
      }
    }
    if (day === "Saturday") {
      const weekIndex = Math.floor(
        (Date.now() - date.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      if (weekIndex < 10) {
        saturdays[weekIndex]++;
      }
    }
  });

  // Find peak hours (hours with >10% of complaints)
  const totalComplaints = complaints.length;
  const peakHours = Object.entries(byHour)
    .filter(([_, count]) => count / totalComplaints > 0.1)
    .map(([hour]) => hour)
    .sort();

  // Calculate consistency score (lower variance = more predictable)
  const avgFriday = fridays.reduce((a, b) => a + b, 0) / fridays.length;
  const avgSaturday = saturdays.reduce((a, b) => a + b, 0) / saturdays.length;
  const varianceFri =
    fridays.reduce((sum, val) => sum + Math.pow(val - avgFriday, 2), 0) /
    fridays.length;
  const varianceSat =
    saturdays.reduce((sum, val) => sum + Math.pow(val - avgSaturday, 2), 0) /
    saturdays.length;
  const avgVariance = (varianceFri + varianceSat) / 2;
  const consistencyScore = Math.max(0, 100 - avgVariance * 10);

  return {
    total: complaints.length,
    byDayOfWeek,
    byHour,
    fridays: fridays.reverse(), // Most recent first
    saturdays: saturdays.reverse(),
    peakHours,
    consistencyScore: Math.round(consistencyScore),
  };
}

/**
 * Update all venues with 311 complaint data
 */
async function updateAllVenues() {
  console.log("Starting 311 complaint data collection...\n");

  const venues = await prisma.venue.findMany({
    select: { id: true, name: true, lat: true, lng: true, address: true },
  });

  console.log(`Found ${venues.length} venues to process\n`);

  let processed = 0;
  let updated = 0;

  for (const venue of venues) {
    console.log(`[${processed + 1}/${venues.length}] Processing: ${venue.name}`);

    // Fetch complaints near venue
    const complaints = await fetchComplaints(venue.lat, venue.lng);

    if (complaints.length > 0) {
      const pattern = analyzePattern(complaints);
      const lastComplaint = new Date(
        Math.max(...complaints.map((c) => new Date(c.created_date).getTime()))
      );

      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          noiseComplaints: pattern.total,
          complaintPattern: pattern as any,
          lastComplaint,
          dataLastFetched: new Date(),
        },
      });

      console.log(
        `  ✓ ${pattern.total} complaints, consistency: ${pattern.consistencyScore}%`
      );
      updated++;
    } else {
      console.log(`  - No complaints found`);
    }

    processed++;

    // Rate limiting: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`\n✓ Complete! Updated ${updated}/${venues.length} venues`);
}

// Run the script
updateAllVenues()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
