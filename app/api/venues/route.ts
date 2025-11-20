import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Venue } from "@/lib/types";
import { calculateMeetingScore, predictTonightActivity } from "@/lib/scoring";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mood = searchParams.get("mood");
    const minScore = searchParams.get("minScore");

    // Build query
    const where = mood
      ? {
          moods: {
            some: {
              mood: mood,
            },
          },
        }
      : {};

    // Fetch venues from database
    const venuesFromDb = await prisma.venue.findMany({
      where,
      include: {
        moods: true,
      },
    });

    // Transform and calculate scores
    const venuesWithScores = venuesFromDb
      .map((venue) => {
        // Calculate meeting score
        const scoreBreakdown = calculateMeetingScore({
          venueType: venue.venueType || undefined,
          rating: venue.rating || undefined,
          noiseComplaints: venue.noiseComplaints || undefined,
          genderRatio: venue.genderRatio
            ? (venue.genderRatio as any)
            : undefined,
          reviewSentiment: venue.reviewSentiment
            ? (venue.reviewSentiment as any)
            : undefined,
        });

        // Predict tonight's activity
        const activityPrediction = predictTonightActivity(
          venue.complaintPattern
        );

        return {
          id: venue.id,
          name: venue.name,
          coordinates: {
            lat: venue.lat,
            lng: venue.lng,
          },
          address: venue.address,
          neighborhood: venue.neighborhood,
          moods: venue.moods.map((m) => m.mood) as any[],
          rating: venue.rating ?? undefined,
          priceLevel: venue.priceLevel
            ? (venue.priceLevel as 1 | 2 | 3 | 4)
            : undefined,

          // Meeting potential data
          meetingScore: scoreBreakdown.total,
          scoreBreakdown,
          activityPrediction,
          noiseComplaints: venue.noiseComplaints,
          lastComplaint: venue.lastComplaint,

          createdAt: venue.createdAt,
          updatedAt: venue.updatedAt,
        };
      })
      .filter((venue) => {
        // Filter by minimum score if specified
        if (minScore && venue.meetingScore < parseInt(minScore)) {
          return false;
        }
        return true;
      })
      // Sort by meeting score (highest first)
      .sort((a, b) => b.meetingScore - a.meetingScore);

    return NextResponse.json({
      venues: venuesWithScores,
      total: venuesWithScores.length,
    });
  } catch (error) {
    console.error("Error fetching venues:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
