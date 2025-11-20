/**
 * Meeting Potential Scoring Algorithm
 *
 * Calculates a 0-100 composite score for each venue based on multiple signals
 */

export interface VenueScoreData {
  // Required
  venueType?: string;
  rating?: number;
  noiseComplaints?: number;

  // Optional (will use defaults if missing)
  genderRatio?: {
    male: number;
    female: number;
    confidence: "low" | "medium" | "high";
  };
  reviewSentiment?: {
    socialVibeScore?: number;
  };
}

export interface ScoreBreakdown {
  total: number;
  genderBalance: number;
  activityLevel: number;
  socialibility: number;
  quality: number;
  vibe: number;
}

/**
 * Venue type socialibility scores
 * Higher score = easier to talk/meet people
 */
const VENUE_TYPE_SCORES: { [key: string]: number } = {
  lounge: 90,
  "cocktail bar": 85,
  "cocktail lounge": 85,
  rooftop: 85,
  "wine bar": 80,
  bar: 70,
  pub: 65,
  "sports bar": 60,
  "dive bar": 50,
  nightclub: 40,
  club: 40,
};

/**
 * Calculate gender balance score (0-100)
 * For meeting women: Higher female % = better score
 * Optimal: 45-75% female (good odds without being overwhelming)
 */
function calculateGenderBalance(data: VenueScoreData): number {
  if (!data.genderRatio) {
    // Default assumption: slightly male-skewed (55/45)
    return 70;
  }

  const femalePercent = data.genderRatio.female;
  const confidence = data.genderRatio.confidence;

  // Apply confidence multiplier
  let confidenceMultiplier = 1.0;
  if (confidence === 'high') confidenceMultiplier = 1.2;
  else if (confidence === 'medium') confidenceMultiplier = 1.1;
  else confidenceMultiplier = 0.9; // Low confidence gets slight penalty

  // Sweet spot: 45-75% female
  if (femalePercent >= 45 && femalePercent <= 75) {
    return Math.min(100, Math.round(100 * confidenceMultiplier));
  }

  // Still good: 40-85% female
  if (femalePercent >= 40 && femalePercent <= 85) {
    return Math.min(100, Math.round(90 * confidenceMultiplier));
  }

  // Decent: 35-90% female
  if (femalePercent >= 35 && femalePercent <= 90) {
    return Math.min(100, Math.round(80 * confidenceMultiplier));
  }

  // Too male-dominated (<35% female) or too female (>90%)
  if (femalePercent < 35) {
    // Heavily penalize male-dominated venues
    return Math.round(femalePercent * confidenceMultiplier);
  }

  // Very high female % (>90%) is still good, just slightly less optimal
  return Math.min(100, Math.round(85 * confidenceMultiplier));
}

/**
 * Calculate activity level score (0-100)
 * Based on 311 noise complaints
 *
 * Sweet spot: 10-25 complaints in 90 days
 * - Too few = dead/boring
 * - Too many = complaints might indicate actual problems
 */
function calculateActivityLevel(data: VenueScoreData): number {
  const complaints = data.noiseComplaints || 0;

  // Sweet spot: 10-25 complaints
  if (complaints >= 10 && complaints <= 25) {
    return 100;
  }

  // Too few complaints = probably quiet/dead
  if (complaints < 10) {
    return complaints * 8; // 0 complaints = 0, 10 complaints = 80
  }

  // Too many complaints = might be problematic
  return Math.max(0, 100 - (complaints - 25) * 3);
}

/**
 * Calculate socialibility score (0-100)
 * Based on venue type - can you actually talk?
 */
function calculateSocialibility(data: VenueScoreData): number {
  if (!data.venueType) {
    return 60; // Default neutral score
  }

  const venueType = data.venueType.toLowerCase();

  // Check for exact match
  if (VENUE_TYPE_SCORES[venueType]) {
    return VENUE_TYPE_SCORES[venueType];
  }

  // Check for partial matches
  for (const [type, score] of Object.entries(VENUE_TYPE_SCORES)) {
    if (venueType.includes(type) || type.includes(venueType)) {
      return score;
    }
  }

  // Default: assume it's a regular bar
  return 60;
}

/**
 * Calculate quality score (0-100)
 * Based on overall rating
 */
function calculateQuality(data: VenueScoreData): number {
  if (!data.rating) {
    return 60; // Default neutral score
  }

  // Convert 0-5 rating to 0-100 score
  return (data.rating / 5) * 100;
}

/**
 * Calculate vibe score (0-100)
 * Based on NLP sentiment analysis of reviews
 */
function calculateVibe(data: VenueScoreData): number {
  if (!data.reviewSentiment?.socialVibeScore) {
    return 50; // Default neutral score
  }

  return data.reviewSentiment.socialVibeScore;
}

/**
 * Calculate composite meeting potential score
 *
 * Weights (optimized for finding women):
 * - Gender Balance: 40% (most important!)
 * - Social Vibe: 20% (can you actually talk?)
 * - Quality: 15% (venue rating)
 * - Socialibility: 15% (venue type)
 * - Activity Level: 10% (311 data - not always available)
 */
export function calculateMeetingScore(data: VenueScoreData): ScoreBreakdown {
  const genderBalance = calculateGenderBalance(data);
  const activityLevel = calculateActivityLevel(data);
  const socialibility = calculateSocialibility(data);
  const quality = calculateQuality(data);
  const vibe = calculateVibe(data);

  const total =
    genderBalance * 0.4 +
    vibe * 0.2 +
    quality * 0.15 +
    socialibility * 0.15 +
    activityLevel * 0.1;

  return {
    total: Math.round(total),
    genderBalance: Math.round(genderBalance),
    activityLevel: Math.round(activityLevel),
    socialibility: Math.round(socialibility),
    quality: Math.round(quality),
    vibe: Math.round(vibe),
  };
}

/**
 * Get score tier label with women emojis
 */
export function getScoreTier(score: number): {
  label: string;
  emoji: string;
  color: string;
} {
  if (score >= 90) {
    return { label: "Elite", emoji: "💃", color: "text-purple-400" }; // Dancing woman - best venues
  }
  if (score >= 80) {
    return { label: "Excellent", emoji: "👯", color: "text-pink-400" }; // Women dancing - great spots
  }
  if (score >= 70) {
    return { label: "Good", emoji: "🙋‍♀️", color: "text-blue-400" }; // Woman raising hand - solid choice
  }
  if (score >= 60) {
    return { label: "Decent", emoji: "👩", color: "text-cyan-400" }; // Woman - okay option
  }
  if (score >= 45) {
    return { label: "Mediocre", emoji: "🤷‍♀️", color: "text-gray-400" }; // Woman shrugging - meh
  }
  return { label: "Poor", emoji: "🚫", color: "text-red-400" }; // Not recommended
}

/**
 * Predict if venue will be active tonight based on complaint patterns
 */
export function predictTonightActivity(complaintPattern: any): {
  prediction: "High" | "Medium" | "Low";
  confidence: number;
  bestTime?: string;
} {
  if (!complaintPattern) {
    return { prediction: "Low", confidence: 0 };
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayCount = complaintPattern.byDayOfWeek?.[today] || 0;
  const peakHours = complaintPattern.peakHours || [];
  const consistencyScore = complaintPattern.consistencyScore || 0;

  // Determine prediction
  let prediction: "High" | "Medium" | "Low";
  if (todayCount >= 5 && consistencyScore >= 60) {
    prediction = "High";
  } else if (todayCount >= 2) {
    prediction = "Medium";
  } else {
    prediction = "Low";
  }

  // Best time is the first peak hour
  const bestTime = peakHours.length > 0 ? `${peakHours[0]}:00` : undefined;

  return {
    prediction,
    confidence: consistencyScore,
    bestTime,
  };
}
