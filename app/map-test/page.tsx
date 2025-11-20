"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function MapTestPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    console.log("=== MAPBOX TEST PAGE ===");
    console.log("Token exists:", !!token);
    console.log("Token value:", token?.substring(0, 20) + "...");

    if (!token) {
      console.error("❌ NEXT_PUBLIC_MAPBOX_TOKEN not found!");
      return;
    }

    mapboxgl.accessToken = token;

    if (!mapContainer.current) {
      console.error("❌ Map container ref is null!");
      return;
    }

    // Check container dimensions BEFORE creating map
    console.log("Container dimensions BEFORE map init:", {
      clientWidth: mapContainer.current.clientWidth,
      clientHeight: mapContainer.current.clientHeight,
      offsetWidth: mapContainer.current.offsetWidth,
      offsetHeight: mapContainer.current.offsetHeight,
    });

    try {
      console.log("Creating map...");

      const newMap = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-73.9712, 40.7831], // NYC
        zoom: 11,
      });

      map.current = newMap;
      console.log("✅ Map instance created");

      newMap.on("load", () => {
        console.log("✅ Map loaded successfully!");

        // Check dimensions after load
        const container = mapContainer.current;
        const canvas = container?.querySelector("canvas");

        console.log("After load - Container:", {
          width: container?.clientWidth,
          height: container?.clientHeight,
        });

        console.log("After load - Canvas:", {
          width: canvas?.width,
          height: canvas?.height,
          styleWidth: canvas?.style.width,
          styleHeight: canvas?.style.height,
        });
      });

      newMap.on("error", (e) => {
        console.error("❌ Mapbox error:", e);
      });

      // Add a marker to verify map is working
      new mapboxgl.Marker({ color: "#9333ea" })
        .setLngLat([-73.9712, 40.7831])
        .addTo(newMap);

      console.log("✅ Marker added");

    } catch (error) {
      console.error("❌ Error creating map:", error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      backgroundColor: "#1a1a2e",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{
        padding: "20px",
        color: "white",
        backgroundColor: "#16213e",
        fontFamily: "monospace"
      }}>
        <h1 style={{ margin: 0, marginBottom: "10px" }}>Mapbox GL Test Page</h1>
        <p style={{ margin: 0 }}>Check console for diagnostics. Map should appear below.</p>
      </div>

      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "600px",
          backgroundColor: "#0f3460",
          border: "2px solid #e94560"
        }}
      />

      <div style={{
        padding: "20px",
        color: "white",
        fontFamily: "monospace"
      }}>
        <p>If you see a dark map with NYC centered above, Mapbox is working!</p>
        <p>Expected: Dark themed map with a purple marker in the center</p>
      </div>
    </div>
  );
}
