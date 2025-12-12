"use client";

import { MapViewClean } from "@/components/map-view-clean";

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden" style={{ width: '100vw', height: '100dvh' }}>
      <MapViewClean mood={null} onBack={() => {}} />
    </main>
  );
}
