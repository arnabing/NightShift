import { Mood } from "@/app/page";

// Geographic coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Venue identifier
export type VenueId = string;

// Core venue data structure
export interface Venue {
  id: VenueId;
  name: string;
  coordinates: Coordinates;
  address: string;
  neighborhood: string;
  moods: Mood[]; // Can match multiple moods (e.g., cocktails + love)

  // Optional metadata (Phase 2+)
  noiseComplaints?: number;
  rating?: number;
  priceLevel?: 1 | 2 | 3 | 4;
  footTraffic?: {
    current: number;
    typical: number;
    peak: number;
  };

  // Crowdsourced data (Phase 3)
  demographics?: {
    malePercent: number;
    femalePercent: number;
    avgAge: number;
  };

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;
}

// Map marker with interaction state
export interface MapMarker {
  venue: Venue;
  isHighlighted: boolean;
}

// Map viewport bounds
export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

// API response for venue queries
export interface VenueQueryResponse {
  venues: Venue[];
  total: number;
  bounds?: MapBounds;
}

// Map viewport state
export interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

// NYC center coordinates
export const NYC_CENTER: Coordinates = {
  lat: 40.7589,
  lng: -73.9851,
};

// Default map viewport
export const DEFAULT_VIEWPORT: MapViewport = {
  latitude: NYC_CENTER.lat,
  longitude: NYC_CENTER.lng,
  zoom: 13,
};
