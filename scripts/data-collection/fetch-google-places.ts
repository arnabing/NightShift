#!/usr/bin/env tsx
/**
 * Google Places API Integration
 *
 * Fetches venue data and reviews from Google Places to:
 * 1. Match venues by name and location
 * 2. Get up to 5 reviews per venue (Google Places limit)
 * 3. Analyze reviews for gender ratio signals
 * 4. Extract social vibe sentiment
 * 5. Update database with findings
 *
 * API Costs:
 * - Place Search: $0.032 per request (Nearby Search)
 * - Place Details: $0.017 per request (includes reviews)
 * - Total for 25 venues: ~$1.25
 *
 * Monthly limits: $200 free credit = ~4,000 venues/month
 */

import { prisma } from "../../lib/prisma";

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

interface GooglePlace {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  types: string[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
}

interface GenderAnalysis {
  maleKeywords: number;
  femaleKeywords: number;
  totalKeywords: number;
  estimatedFemalePercent: number;
  confidence: "low" | "medium" | "high";
}

interface SocialVibeAnalysis {
  socialKeywords: number;
  positiveKeywords: number;
  negativeKeywords: number;
  socialVibeScore: number;
}

/**
 * Gender keywords to search for in reviews
 */
const GENDER_KEYWORDS = {
  female: [
    "girl", "girls", "woman", "women", "lady", "ladies",
    "female", "females", "she", "her", "girlfriend", "wife",
    "daughter", "sister", "chick", "chicks", "babe", "babes",
  ],
  male: [
    "guy", "guys", "man", "men", "male", "males", "dude", "dudes",
    "he", "him", "his", "boyfriend", "husband", "son", "brother",
    "bro", "bros",
  ],
};

/**
 * Social vibe keywords
 */
const VIBE_KEYWORDS = {
  social: [
    "meet", "meeting", "social", "friendly", "conversation", "chat",
    "talk", "talking", "mingle", "mingling", "crowd", "vibe",
  ],
  positive: [
    "fun", "great", "awesome", "amazing", "love", "loved",
    "fantastic", "excellent", "perfect", "best",
  ],
  negative: [
    "crowded", "loud", "noisy", "packed", "aggressive",
    "pushy", "uncomfortable", "awkward",
  ],
};

/**
 * Search for venue on Google Places by name and location
 */
async function searchGooglePlace(
  name: string,
  lat: number,
  lng: number
): Promise<GooglePlace | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.error("GOOGLE_PLACES_API_KEY environment variable not set!");
    return null;
  }

  try {
    // Use Nearby Search to find the venue
    const url = new URL(`${GOOGLE_PLACES_BASE}/nearbysearch/json`);
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", "50"); // 50 meters
    url.searchParams.set("keyword", name);
    url.searchParams.set("type", "bar|night_club|restaurant");
    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`Google Places API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error(`Error searching Google Places for ${name}:`, error);
    return null;
  }
}

/**
 * Fetch place details including reviews
 */
async function fetchPlaceDetails(placeId: string): Promise<GoogleReview[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    return [];
  }

  try {
    const url = new URL(`${GOOGLE_PLACES_BASE}/details/json`);
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("fields", "reviews,rating,user_ratings_total,price_level");
    url.searchParams.set("key", GOOGLE_PLACES_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error(`Google Place Details API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.result?.reviews || [];
  } catch (error) {
    console.error(`Error fetching Google Place details:`, error);
    return [];
  }
}

/**
 * Analyze reviews for gender ratio signals
 */
function analyzeGenderRatio(reviews: GoogleReview[]): GenderAnalysis {
  let maleCount = 0;
  let femaleCount = 0;

  const allText = reviews.map((r) => r.text.toLowerCase()).join(" ");

  // Count keyword occurrences
  GENDER_KEYWORDS.female.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches) femaleCount += matches.length;
  });

  GENDER_KEYWORDS.male.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches) maleCount += matches.length;
  });

  const totalKeywords = maleCount + femaleCount;

  // Calculate estimated female percentage
  let estimatedFemalePercent = 45; // Default assumption: slightly male-skewed
  if (totalKeywords > 0) {
    estimatedFemalePercent = Math.round((femaleCount / totalKeywords) * 100);
  }

  // Determine confidence based on sample size
  let confidence: "low" | "medium" | "high" = "low";
  if (totalKeywords >= 20) confidence = "high";
  else if (totalKeywords >= 10) confidence = "medium";

  return {
    maleKeywords: maleCount,
    femaleKeywords: femaleCount,
    totalKeywords,
    estimatedFemalePercent,
    confidence,
  };
}

/**
 * Analyze reviews for social vibe
 */
function analyzeSocialVibe(reviews: GoogleReview[]): SocialVibeAnalysis {
  let socialCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  const allText = reviews.map((r) => r.text.toLowerCase()).join(" ");

  // Count keyword occurrences
  VIBE_KEYWORDS.social.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches) socialCount += matches.length;
  });

  VIBE_KEYWORDS.positive.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches) positiveCount += matches.length;
  });

  VIBE_KEYWORDS.negative.forEach((keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, "gi");
    const matches = allText.match(regex);
    if (matches) negativeCount += matches.length;
  });

  // Calculate social vibe score (0-100)
  // Base score from average rating
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  let vibeScore = (avgRating / 5) * 100;

  // Adjust based on keywords
  if (socialCount > 0) vibeScore += 10;
  if (positiveCount > negativeCount) vibeScore += 5;
  if (negativeCount > positiveCount) vibeScore -= 10;

  vibeScore = Math.max(0, Math.min(100, vibeScore)); // Clamp 0-100

  return {
    socialKeywords: socialCount,
    positiveKeywords: positiveCount,
    negativeKeywords: negativeCount,
    socialVibeScore: Math.round(vibeScore),
  };
}

/**
 * Map Google Places types to venue types
 */
function mapGoogleTypesToVenueType(types: string[]): string {
  const typeMap: { [key: string]: string } = {
    night_club: "Nightclub",
    bar: "Bar",
    restaurant: "Restaurant",
    cafe: "Cafe",
    liquor_store: "Liquor Store",
  };

  for (const type of types) {
    if (typeMap[type]) return typeMap[type];
  }

  return "Bar"; // Default
}

/**
 * Main function to fetch and analyze Google Places data
 */
async function fetchGooglePlacesData() {
  console.log("\n🔍 Starting Google Places data collection...\n");
  console.log("=" .repeat(80));

  if (!GOOGLE_PLACES_API_KEY) {
    console.error("\n❌ ERROR: GOOGLE_PLACES_API_KEY environment variable not set!");
    console.error("\nTo get a Google Places API key:");
    console.error("1. Go to https://console.cloud.google.com/");
    console.error("2. Create a new project (or select existing)");
    console.error("3. Enable 'Places API'");
    console.error("4. Go to 'Credentials' → 'Create Credentials' → 'API Key'");
    console.error("5. Copy your API key");
    console.error("6. Add to .env.local: GOOGLE_PLACES_API_KEY=your_key_here\n");
    console.error("Note: You get $200/month free credit (~4,000 venues)\n");
    return;
  }

  // Fetch all venues from database
  const venues = await prisma.venue.findMany();
  console.log(`\nFound ${venues.length} venues to process\n`);

  let matchedCount = 0;
  let analyzedCount = 0;
  let totalCost = 0;

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    console.log(`\n[${i + 1}/${venues.length}] Processing: ${venue.name}`);

    // Search for venue on Google Places
    const googlePlace = await searchGooglePlace(venue.name, venue.lat, venue.lng);
    totalCost += 0.032; // Nearby Search cost

    if (!googlePlace) {
      console.log("  ❌ Not found on Google Places");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit
      continue;
    }

    matchedCount++;
    console.log(`  ✓ Found on Google Places (${googlePlace.user_ratings_total || 0} reviews)`);

    // Fetch place details including reviews
    const reviews = await fetchPlaceDetails(googlePlace.place_id);
    totalCost += 0.017; // Place Details cost

    if (reviews.length === 0) {
      console.log("  ⚠️  No reviews available");
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    console.log(`  ✓ Fetched ${reviews.length} reviews`);

    // Analyze gender ratio
    const genderAnalysis = analyzeGenderRatio(reviews);
    console.log(`  ✓ Gender: ${genderAnalysis.estimatedFemalePercent}% female (confidence: ${genderAnalysis.confidence})`);
    console.log(`     - Female keywords: ${genderAnalysis.femaleKeywords}`);
    console.log(`     - Male keywords: ${genderAnalysis.maleKeywords}`);

    // Analyze social vibe
    const vibeAnalysis = analyzeSocialVibe(reviews);
    console.log(`  ✓ Social vibe score: ${vibeAnalysis.socialVibeScore}/100`);
    console.log(`     - Social keywords: ${vibeAnalysis.socialKeywords}`);
    console.log(`     - Positive: ${vibeAnalysis.positiveKeywords}, Negative: ${vibeAnalysis.negativeKeywords}`);

    // Update database
    await prisma.venue.update({
      where: { id: venue.id },
      data: {
        googlePlaceId: googlePlace.place_id,
        rating: googlePlace.rating,
        priceLevel: googlePlace.price_level || null,
        venueType: mapGoogleTypesToVenueType(googlePlace.types),
        genderRatio: {
          male: 100 - genderAnalysis.estimatedFemalePercent,
          female: genderAnalysis.estimatedFemalePercent,
          confidence: genderAnalysis.confidence,
          maleKeywords: genderAnalysis.maleKeywords,
          femaleKeywords: genderAnalysis.femaleKeywords,
          reviewCount: googlePlace.user_ratings_total || 0,
          reviewTexts: reviews.map(r => r.text), // Save review text for LLM analysis
        },
        reviewSentiment: {
          socialVibeScore: vibeAnalysis.socialVibeScore,
          socialKeywords: vibeAnalysis.socialKeywords,
          positiveKeywords: vibeAnalysis.positiveKeywords,
          negativeKeywords: vibeAnalysis.negativeKeywords,
        },
        dataLastFetched: new Date(),
      },
    });

    analyzedCount++;
    console.log(`  ✓ Updated database`);

    // Rate limiting: 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Complete!`);
  console.log(`   Matched: ${matchedCount}/${venues.length} venues`);
  console.log(`   Analyzed: ${analyzedCount}/${venues.length} venues with reviews`);
  console.log(`   Estimated cost: $${totalCost.toFixed(2)}\n`);

  await prisma.$disconnect();
}

fetchGooglePlacesData().catch(console.error);
