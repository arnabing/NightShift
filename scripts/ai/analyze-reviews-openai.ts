/**
 * OpenAI Review Analysis Script
 *
 * Analyzes venue reviews using OpenAI gpt-4o-mini to extract:
 * - Gender ratio estimates
 * - Age range
 * - Social vibe scores
 * - Meeting potential
 * - Best times to visit
 *
 * Cost: ~$0.0006 per venue (gpt-4o-mini)
 * Processing: ~10 venues/second
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface ReviewAnalysis {
  genderRatio: {
    estimatedFemalePercent: number; // 0-100
    estimatedMalePercent: number;   // 0-100
    confidence: 'low' | 'medium' | 'high';
    reasoning: string;
  };
  socialVibe: {
    overallScore: number; // 0-100
    isDateFriendly: boolean;
    conversationFriendly: boolean;
    crowdDescription: string;
    ageRange: string; // "20s", "30s", "40s+", "mixed"
  };
  meetingPotential: {
    score: number; // 0-100
    bestNights: string[]; // ["Friday", "Saturday"]
    bestTimeOfNight: string; // "10PM-1AM"
    prosForMeeting: string[];
    consForMeeting: string[];
  };
}

async function analyzeVenueReviews(
  venueName: string,
  reviews: string[]
): Promise<ReviewAnalysis> {
  const prompt = `You are analyzing venue reviews for a dating app that helps men find bars/clubs with good gender ratios and social atmospheres.

Venue: ${venueName}

Reviews:
${reviews.map((r, i) => `${i+1}. ${r}`).join('\n\n')}

Analyze these reviews and provide:
1. Estimated gender ratio (what % are female vs male patrons?)
2. Social vibe (how easy is it to meet people and have conversations?)
3. Meeting potential (is this a good place for meeting women?)

Be honest and specific. If reviews don't mention gender, use context clues (mentions of dates, couples, girls' nights, etc.).

Respond in JSON format with this EXACT structure:
{
  "genderRatio": {
    "estimatedFemalePercent": <number 0-100>,
    "estimatedMalePercent": <number 0-100>,
    "confidence": "low" | "medium" | "high",
    "reasoning": "<brief explanation of what signals you used>"
  },
  "socialVibe": {
    "overallScore": <number 0-100, where 100 is highly social/easy to meet people>,
    "isDateFriendly": <boolean>,
    "conversationFriendly": <boolean, can you talk or is it too loud?>,
    "crowdDescription": "<2-3 word description like 'young professionals', 'college crowd', 'mixed ages'>",
    "ageRange": "<20s|30s|40s+|mixed>"
  },
  "meetingPotential": {
    "score": <number 0-100, overall rating for meeting women>,
    "bestNights": ["<day>"],
    "bestTimeOfNight": "<time range like '10PM-1AM' or 'happy hour' or 'late night'>",
    "prosForMeeting": ["<specific pro from reviews>"],
    "consForMeeting": ["<specific con from reviews, or 'none mentioned' if unclear>"]
  }
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-5-nano-2025-08-07',
    messages: [
      {
        role: 'system',
        content: 'You are a venue analysis expert specializing in social dynamics and gender demographics. Respond only with valid JSON.'
      },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3 // Lower = more consistent
  });

  return JSON.parse(response.choices[0].message.content || '{}');
}

async function processVenues(options: {
  limit?: number;
  offset?: number;
  venueIds?: string[];
  testMode?: boolean;
}) {
  const { limit, offset = 0, venueIds, testMode = false } = options;

  console.log('🤖 OpenAI Review Analysis Starting...\n');

  // Build query
  const where: any = {
    OR: [
      { googlePlaceId: { not: null } },
      { foursquareId: { not: null } },
      { yelpId: { not: null } }
    ]
  };

  // Filter by specific IDs if provided
  if (venueIds && venueIds.length > 0) {
    where.id = { in: venueIds };
  }

  // In test mode, skip already analyzed venues
  if (!testMode) {
    where.aiParsedData = null;
  }

  const venues = await prisma.venue.findMany({
    where,
    skip: offset,
    take: limit,
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${venues.length} venues to analyze\n`);

  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalCost = 0;

  for (const venue of venues) {
    // Skip if already analyzed (double check)
    if (!testMode && venue.aiParsedData) {
      console.log(`⏭️  Skipping ${venue.name} (already analyzed)`);
      skipped++;
      continue;
    }

    // Collect all available review text
    const reviews: string[] = [];

    // Extract reviews from genderRatio JSON field
    if (venue.genderRatio) {
      const genderData = venue.genderRatio as any;
      if (genderData.reviewTexts && Array.isArray(genderData.reviewTexts)) {
        reviews.push(...genderData.reviewTexts);
      }
    }

    // Extract reviews from reviewSentiment if available
    if (venue.reviewSentiment) {
      const sentimentData = venue.reviewSentiment as any;
      if (sentimentData.reviewTexts && Array.isArray(sentimentData.reviewTexts)) {
        reviews.push(...sentimentData.reviewTexts);
      }
    }

    if (reviews.length === 0) {
      console.log(`⚠️  No reviews for ${venue.name} - skipping`);
      skipped++;
      continue;
    }

    // Deduplicate reviews
    const uniqueReviews = [...new Set(reviews)];

    console.log(`\n[${processed + 1}/${venues.length}] 📍 ${venue.name}`);
    console.log(`  📝 ${uniqueReviews.length} reviews available`);

    try {
      const analysis = await analyzeVenueReviews(venue.name, uniqueReviews);

      // Estimate cost (gpt-4o-mini pricing)
      // Input: $0.150 per 1M tokens, Output: $0.600 per 1M tokens
      const inputTokens = JSON.stringify(uniqueReviews).length / 4; // Rough estimate: 4 chars = 1 token
      const outputTokens = 500; // JSON response ~500 tokens
      const cost = (inputTokens * 0.15 / 1_000_000) + (outputTokens * 0.60 / 1_000_000);
      totalCost += cost;

      // Update database
      await prisma.venue.update({
        where: { id: venue.id },
        data: {
          aiParsedData: analysis as any,
          genderRatio: {
            ...(venue.genderRatio as any || {}),
            female: analysis.genderRatio.estimatedFemalePercent,
            male: analysis.genderRatio.estimatedMalePercent,
            confidence: analysis.genderRatio.confidence,
            source: 'openai',
            reasoning: analysis.genderRatio.reasoning
          },
          meetingScore: analysis.meetingPotential.score,
          avgAge: analysis.socialVibe.ageRange === '20s' ? 25 :
                  analysis.socialVibe.ageRange === '30s' ? 35 :
                  analysis.socialVibe.ageRange === '40s+' ? 45 : null,
          socialibilityScore: analysis.socialVibe.overallScore,
          reviewSentiment: {
            ...(venue.reviewSentiment as any || {}),
            socialVibeScore: analysis.socialVibe.overallScore,
            isDateFriendly: analysis.socialVibe.isDateFriendly,
            conversationFriendly: analysis.socialVibe.conversationFriendly,
            crowdDescription: analysis.socialVibe.crowdDescription,
            bestNights: analysis.meetingPotential.bestNights,
            bestTimeOfNight: analysis.meetingPotential.bestTimeOfNight
          },
          dataLastFetched: new Date()
        }
      });

      console.log(`  ✅ Gender: ${analysis.genderRatio.estimatedFemalePercent}% female (${analysis.genderRatio.confidence} confidence)`);
      console.log(`  ✅ Meeting Score: ${analysis.meetingPotential.score}/100`);
      console.log(`  ✅ Social Vibe: ${analysis.socialVibe.overallScore}/100`);
      console.log(`  ✅ Best: ${analysis.meetingPotential.bestNights.join(', ')} ${analysis.meetingPotential.bestTimeOfNight}`);
      console.log(`  💰 Cost: $${cost.toFixed(4)}`);

      processed++;

      // Rate limiting: OpenAI allows 3,500 RPM on free tier
      // 100ms delay = 10 req/sec = 600 req/min (well under limit)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.error(`  ❌ Error analyzing ${venue.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ OpenAI Analysis Complete!\n`);
  console.log(`   📊 Processed: ${processed} venues`);
  console.log(`   ⏭️  Skipped: ${skipped} venues (no reviews or already analyzed)`);
  console.log(`   ❌ Errors: ${errors} venues`);
  console.log(`   💰 Total cost: $${totalCost.toFixed(2)}`);
  console.log(`   💵 Avg cost per venue: $${(totalCost / Math.max(processed, 1)).toFixed(4)}\n`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: any = {
  testMode: args.includes('--test'),
  limit: undefined,
  offset: 0,
  venueIds: undefined
};

// Parse --limit
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  options.limit = parseInt(args[limitIndex + 1]);
}

// Parse --offset
const offsetIndex = args.indexOf('--offset');
if (offsetIndex !== -1 && args[offsetIndex + 1]) {
  options.offset = parseInt(args[offsetIndex + 1]);
}

// Parse --ids (comma-separated venue IDs)
const idsIndex = args.indexOf('--ids');
if (idsIndex !== -1 && args[idsIndex + 1]) {
  options.venueIds = args[idsIndex + 1].split(',');
}

// Run
processVenues(options)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
