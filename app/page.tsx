"use client";

import { MapViewClean } from "@/components/map-view-clean";

export default function Home() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      <MapViewClean mood={null} onBack={() => {}} />
    </main>
  );
}
