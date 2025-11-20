#!/usr/bin/env tsx
/**
 * Foursquare Places API Integration
 *
 * Fetches venue data and tips/reviews from Foursquare to:
 * 1. Match venues by name and location
 * 2. Get venue tips (user reviews)
 * 3. Analyze for gender ratio signals
 * 4. Extract social vibe sentiment
 * 5. Update database with findings
 *
 * API Limits: 950 regular calls/day (free tier)
 * Note: Foursquare has pivoted to focus on location data,
 * so review/tip quality may vary
 */

import { prisma } from "../../lib/prisma";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = "https://api.foursquare.com/v3/places";

interface FoursquareVenue {
  fsq_id: string;
  name: string;
  location: {
    address?: string;
    locality?: string;
    region?: string;
  };
  categories: Array<{
    name: string;
  }>;
  rating?: number;
  price?: number; // 1-4
}

interface FoursquareTip {
  id: string;
  text: string;
  created_at: string;
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
 * Gender keywords to search for in tips/reviews
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
 * Search for venue on Foursquare by name and location
 */
async function searchFoursquareVenue(
  name: string,
  lat: number,
  lng: number
): Promise<FoursquareVenue | null> {
  if (!FOURSQUARE_API_KEY) {
    console.error("FOURSQUARE_API_KEY environment variable not set!");
    return null;
  }

  try {
    const url = new URL(`${FOURSQUARE_BASE}/search`);
    url.searchParams.set("query", name);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("radius", "50"); // 50 meters
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: FOURSQUARE_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Foursquare API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error(`Error searching Foursquare for ${name}:`, error);
    return null;
  }
}

/**
 * Fetch venue tips (user-generated content)
 */
async function fetchFoursquareTips(fsqId: string): Promise<FoursquareTip[]> {
  if (!FOURSQUARE_API_KEY) {
    return [];
  }

  try {
    const url = `${FOURSQUARE_BASE}/${fsqId}/tips`;

    const response = await fetch(url, {
      headers: {
        Authorization: FOURSQUARE_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`Foursquare tips API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error(`Error fetching Foursquare tips:`, error);
    return [];
  }
}

/**
 * Analyze tips for gender ratio signals
 */
function analyzeGenderRatio(tips: FoursquareTip[]): GenderAnalysis {
  let maleCount = 0;
  let femaleCount = 0;

  const allText = tips.map((t) => t.text.toLowerCase()).join(" ");

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
 * Analyze tips for social vibe
 */
function analyzeSocialVibe(
  tips: FoursquareTip[],
  rating?: number
): SocialVibeAnalysis {
  let socialCount = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  const allText = tips.map((t) => t.text.toLowerCase()).join(" ");

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
  let vibeScore = 50; // Default neutral

  // Use rating if available
  if (rating) {
    vibeScore = (rating / 10) * 100; // Foursquare uses 0-10 scale
  }

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
 * Main function to fetch and analyze Foursquare data
 */
async function fetchFoursquareData() {
  console.log("\n🔍 Starting Foursquare data collection...\n");
  console.log("=".repeat(80));

  if (!FOURSQUARE_API_KEY) {
    console.error("\n❌ ERROR: FOURSQUARE_API_KEY environment variable not set!");
    console.error("\nTo get a Foursquare API key:");
    console.error("1. Go to https://foursquare.com/developers/");
    console.error("2. Sign up and create a new app");
    console.error("3. Copy your API key");
    console.error("4. Add to .env.local: FOURSQUARE_API_KEY=your_key_here\n");
    console.error("Note: Free tier allows 950 calls/day\n");
    return;
  }

  // Fetch all venues from database
  const venues = await prisma.venue.findMany();
  console.log(`\nFound ${venues.length} venues to process\n`);

  let matchedCount = 0;
  let analyzedCount = 0;

  for (let i = 0; i < venues.length; i++) {
    const venue = venues[i];
    console.log(`\n[${i + 1}/${venues.length}] Processing: ${venue.name}`);

    // Search for venue on Foursquare
    const fsqVenue = await searchFoursquareVenue(venue.name, venue.lat, venue.lng);

    if (!fsqVenue) {
      console.log("  ❌ Not found on Foursquare");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Rate limit
      continue;
    }

    matchedCount++;
    console.log(`  ✓ Found on Foursquare`);

    // Fetch venue tips
    const tips = await fetchFoursquareTips(fsqVenue.fsq_id);

    if (tips.length === 0) {
      console.log("  ⚠️  No tips available");
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }

    console.log(`  ✓ Fetched ${tips.length} tips`);

    // Analyze gender ratio
    const genderAnalysis = analyzeGenderRatio(tips);
    console.log(`  ✓ Gender: ${genderAnalysis.estimatedFemalePercent}% female (confidence: ${genderAnalysis.confidence})`);
    console.log(`     - Female keywords: ${genderAnalysis.femaleKeywords}`);
    console.log(`     - Male keywords: ${genderAnalysis.maleKeywords}`);

    // Analyze social vibe
    const vibeAnalysis = analyzeSocialVibe(tips, fsqVenue.rating);
    console.log(`  ✓ Social vibe score: ${vibeAnalysis.socialVibeScore}/100`);
    console.log(`     - Social keywords: ${vibeAnalysis.socialKeywords}`);
    console.log(`     - Positive: ${vibeAnalysis.positiveKeywords}, Negative: ${vibeAnalysis.negativeKeywords}`);

    // Only update if we have better data than existing
    const existingGenderRatio = venue.genderRatio as any;
    const shouldUpdateGender =
      !existingGenderRatio ||
      existingGenderRatio.confidence === "low" && genderAnalysis.confidence !== "low";

    if (shouldUpdateGender) {
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          foursquareId: fsqVenue.fsq_id,
          genderRatio: {
            male: 100 - genderAnalysis.estimatedFemalePercent,
            female: genderAnalysis.estimatedFemalePercent,
            confidence: genderAnalysis.confidence,
            maleKeywords: genderAnalysis.maleKeywords,
            femaleKeywords: genderAnalysis.femaleKeywords,
            source: "foursquare",
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
      console.log(`  ✓ Updated database with new data`);
      analyzedCount++;
    } else {
      console.log(`  ⏭️  Skipped update (existing data is better)`);
    }

    // Rate limiting: 500ms between requests
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\n✅ Complete!`);
  console.log(`   Matched: ${matchedCount}/${venues.length} venues`);
  console.log(`   Updated: ${analyzedCount}/${venues.length} venues\n`);

  await prisma.$disconnect();
}

fetchFoursquareData().catch(console.error);
