"use client";

import { MapViewClean } from "@/components/map-view-clean";

export default function Home() {
  return (
    <main className="fixed inset-0 overflow-hidden" style={{ width: '100%', height: '100%' }}>
      <MapViewClean mood={null} onBack={() => {}} />
    </main>
  );
}
