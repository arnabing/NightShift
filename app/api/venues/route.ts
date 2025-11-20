import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Venue } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mood = searchParams.get("mood");

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
      orderBy: {
        name: "asc",
      },
    });

    // Transform to match our Venue type
    const venues: Venue[] = venuesFromDb.map((venue) => ({
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
      priceLevel: venue.priceLevel ? (venue.priceLevel as 1 | 2 | 3 | 4) : undefined,
      createdAt: venue.createdAt,
      updatedAt: venue.updatedAt,
    }));

    return NextResponse.json({
      venues,
      total: venues.length,
    });
  } catch (error) {
    console.error("Error fetching venues:", error);
    return NextResponse.json(
      { error: "Failed to fetch venues" },
      { status: 500 }
    );
  }
}
