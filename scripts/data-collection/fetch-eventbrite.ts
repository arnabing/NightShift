#!/usr/bin/env tsx
/**
 * Eventbrite API Integration
 *
 * Fetches nightlife events happening tonight to:
 * 1. Find ladies nights, singles mixers, DJ parties
 * 2. Match events to venues by location (within 50m)
 * 3. Store event information in venue records
 * 4. Update hasEventTonight flag for quick filtering
 *
 * API Details:
 * - Free tier: 1,000 requests/hour
 * - Rate limit: Generous for small scale
 * - No cost for basic event searches
 *
 * Update Frequency: Daily at 6 PM (when people plan their night)
 */

import { prisma } from "../../lib/prisma";

const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
const EVENTBRITE_BASE = "https://www.eventbriteapi.com/v3";

interface EventbriteEvent {
  id: string;
  name: {
    text: string;
    html: string;
  };
  description?: {
    text: string;
    html: string;
  };
  start: {
    timezone: string;
    local: string;
    utc: string;
  };
  end: {
    timezone: string;
    local: string;
    utc: string;
  };
  url: string;
  logo?: {
    url: string;
  };
  venue_id?: string;
  category_id?: string;
  subcategory_id?: string;
}

interface EventbriteVenue {
  id: string;
  name: string;
  address: {
    address_1: string;
    address_2?: string;
    city: string;
    region: string;
    postal_code: string;
    country: string;
    latitude: string;
    longitude: string;
  };
}

interface EventMatch {
  eventName: string;
  eventUrl: string;
  eventTime: string;
  eventEndTime: string;
  eventType: string; // "Ladies Night", "Singles Mixer", "Party", etc.
  eventDescription?: string;
}

/**
 * Keywords to identify event types
 */
const EVENT_TYPE_KEYWORDS = {
  ladiesNight: ["ladies night", "ladies' night", "ladies only", "girls night"],
  singlesMixer: ["singles", "mixer", "speed dating", "meet", "mingle"],
  party: ["party", "celebration", "bash", "festivity"],
  dance: ["dance", "dancing", "dj", "dj night", "club night"],
  live_music: ["live music", "band", "performance", "concert"],
};

/**
 * Nightlife category IDs on Eventbrite
 */
const NIGHTLIFE_CATEGORIES = ["105", "116"]; // Music, Community

/**
 * Search for nightlife events happening tonight in NYC
 */
async function searchEventbriteEvents(
  location: string = "New York, NY",
  radiusKm: number = 15
): Promise<EventbriteEvent[]> {
  if (!EVENTBRITE_API_KEY) {
    throw new Error("EVENTBRITE_API_KEY environment variable is not set");
  }

  // Tonight's date range (9 PM to 4 AM)
  const start = new Date();
  start.setHours(21, 0, 0, 0); // 9 PM tonight

  const end = new Date(start);
  end.setHours(28, 0, 0, 0); // 4 AM next day (28 = 24 + 4)

  const url = new URL(`${EVENTBRITE_BASE}/events/search/`);
  url.searchParams.set("location.address", location);
  url.searchParams.set("location.within", `${radiusKm}km`);
  url.searchParams.set("start_date.range_start", start.toISOString());
  url.searchParams.set("start_date.range_end", end.toISOString());
  url.searchParams.set("categories", NIGHTLIFE_CATEGORIES.join(","));
  url.searchParams.set("status", "live");
  url.searchParams.set("page_size", "100"); // Max results

  console.log(`🔍 Searching Eventbrite for tonight's events (${start.toLocaleTimeString()} - ${end.toLocaleTimeString()})`);

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${EVENTBRITE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Eventbrite API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.events?.length || 0} events`);
    return data.events || [];
  } catch (error) {
    console.error("❌ Error fetching Eventbrite events:", error);
    return [];
  }
}

/**
 * Get venue details from Eventbrite
 */
async function getEventbriteVenue(venueId: string): Promise<EventbriteVenue | null> {
  if (!EVENTBRITE_API_KEY || !venueId) return null;

  const url = `${EVENTBRITE_BASE}/venues/${venueId}/`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${EVENTBRITE_API_KEY}`,
      },
    });

    if (!response.ok) return null;

    const venue = await response.json();
    return venue;
  } catch (error) {
    console.error(`❌ Error fetching venue ${venueId}:`, error);
    return null;
  }
}

/**
 * Classify event type based on name and description
 */
function classifyEventType(event: EventbriteEvent): string {
  const searchText = `${event.name.text} ${event.description?.text || ""}`.toLowerCase();

  // Check for ladies night (highest priority)
  if (EVENT_TYPE_KEYWORDS.ladiesNight.some((keyword) => searchText.includes(keyword))) {
    return "Ladies Night";
  }

  // Check for singles mixer
  if (EVENT_TYPE_KEYWORDS.singlesMixer.some((keyword) => searchText.includes(keyword))) {
    return "Singles Mixer";
  }

  // Check for dance event
  if (EVENT_TYPE_KEYWORDS.dance.some((keyword) => searchText.includes(keyword))) {
    return "Dance Party";
  }

  // Check for live music
  if (EVENT_TYPE_KEYWORDS.live_music.some((keyword) => searchText.includes(keyword))) {
    return "Live Music";
  }

  // Check for party
  if (EVENT_TYPE_KEYWORDS.party.some((keyword) => searchText.includes(keyword))) {
    return "Party";
  }

  return "Event";
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
 * Match event to nearest venue in database
 */
async function matchEventToVenue(
  event: EventbriteEvent
): Promise<{ venueId: string; distance: number } | null> {
  if (!event.venue_id) return null;

  // Get Eventbrite venue details
  const eventbriteVenue = await getEventbriteVenue(event.venue_id);
  if (!eventbriteVenue || !eventbriteVenue.address.latitude) return null;

  const eventLat = parseFloat(eventbriteVenue.address.latitude);
  const eventLng = parseFloat(eventbriteVenue.address.longitude);

  // Find all venues in database
  const venues = await prisma.venue.findMany({
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
    },
  });

  // Find closest venue (within 50 meters)
  let closestVenue: { venueId: string; distance: number } | null = null;
  let minDistance = 50; // 50 meter threshold

  for (const venue of venues) {
    const distance = calculateDistance(venue.lat, venue.lng, eventLat, eventLng);
    if (distance < minDistance) {
      minDistance = distance;
      closestVenue = {
        venueId: venue.id,
        distance,
      };
    }
  }

  if (closestVenue) {
    console.log(
      `  ✅ Matched event "${event.name.text}" to venue (${closestVenue.distance.toFixed(0)}m away)`
    );
  }

  return closestVenue;
}

/**
 * Format event time for display
 */
function formatEventTime(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const startFormatted = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const endFormatted = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🎉 Eventbrite Event Fetcher\n");
  console.log("=" .repeat(80));

  // Search for events
  const events = await searchEventbriteEvents("Manhattan, NY");

  if (events.length === 0) {
    console.log("\n📭 No events found for tonight");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📅 Processing ${events.length} events...\n`);

  let eventsMatched = 0;
  let eventsSkipped = 0;

  // Clear all existing event data (fresh start each day)
  await prisma.venue.updateMany({
    data: {
      events: null,
    },
  });

  // Process each event
  for (const event of events) {
    const eventType = classifyEventType(event);

    console.log(`\n🎪 ${event.name.text}`);
    console.log(`   Type: ${eventType}`);
    console.log(`   Time: ${formatEventTime(event.start.local, event.end.local)}`);

    // Try to match to a venue
    const match = await matchEventToVenue(event);

    if (!match) {
      console.log(`   ❌ No matching venue found`);
      eventsSkipped++;
      continue;
    }

    // Store event data in venue
    const eventMatch: EventMatch = {
      eventName: event.name.text,
      eventUrl: event.url,
      eventTime: formatEventTime(event.start.local, event.end.local),
      eventEndTime: event.end.local,
      eventType,
      eventDescription: event.description?.text?.substring(0, 200), // First 200 chars
    };

    await prisma.venue.update({
      where: { id: match.venueId },
      data: {
        events: eventMatch as any,
      },
    });

    eventsMatched++;
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Event matching complete!`);
  console.log(`   ${eventsMatched} events matched to venues`);
  console.log(`   ${eventsSkipped} events skipped (no matching venue)`);

  // Show summary of venues with events
  const venuesWithEvents = await prisma.venue.findMany({
    where: {
      events: {
        not: null,
      },
    },
    select: {
      name: true,
      neighborhood: true,
      events: true,
    },
  });

  if (venuesWithEvents.length > 0) {
    console.log(`\n🎯 Venues with events tonight:\n`);
    for (const venue of venuesWithEvents) {
      const event = venue.events as any;
      console.log(`   📍 ${venue.name} (${venue.neighborhood})`);
      console.log(`      🎉 ${event.eventType}: ${event.eventName}`);
      console.log(`      ⏰ ${event.eventTime}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
