"use client";

import { useState, useCallback } from "react";
import Map, { NavigationControl, GeolocateControl } from "react-map-gl";
import type { ViewState } from "react-map-gl";
import { DEFAULT_VIEWPORT } from "@/lib/types";
import type { Venue } from "@/lib/types";
import { VenueMarker } from "./venue-marker";
import "mapbox-gl/dist/mapbox-gl.css";

interface MapContainerProps {
  venues: Venue[];
  onVenueClick?: (venue: Venue) => void;
  selectedVenueId?: string | null;
}

export function MapContainer({
  venues,
  onVenueClick,
  selectedVenueId,
}: MapContainerProps) {
  const [viewState, setViewState] = useState<ViewState>({
    ...DEFAULT_VIEWPORT,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const handleMove = useCallback((evt: { viewState: ViewState }) => {
    setViewState(evt.viewState);
  }, []);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!mapboxToken) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass p-8 rounded-xl">
          <p className="text-destructive font-semibold mb-2">
            Mapbox token not configured
          </p>
          <p className="text-muted-foreground text-sm">
            Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <Map
        {...viewState}
        onMove={handleMove}
        mapboxAccessToken={mapboxToken}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: "100%", height: "100%" }}
        reuseMaps
      >
        {/* Navigation controls (zoom in/out) */}
        <NavigationControl position="top-right" showCompass={false} />

        {/* Geolocation control */}
        <GeolocateControl
          position="top-right"
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation
        />

        {/* Venue markers */}
        {venues.map((venue) => (
          <VenueMarker
            key={venue.id}
            venue={venue}
            onClick={onVenueClick}
            isSelected={venue.id === selectedVenueId}
          />
        ))}
      </Map>
    </div>
  );
}
