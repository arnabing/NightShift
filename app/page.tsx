"use client";

import { useState } from "react";
import { MoodSelector } from "@/components/mood-selector";
import { MapViewClean } from "@/components/map-view-clean";

export type Mood = "cocktails" | "dive" | "sports" | "love" | "dance" | null;

export default function Home() {
  const [selectedMood, setSelectedMood] = useState<Mood>(null);
  const [showMap, setShowMap] = useState(false);

  const handleMoodSelect = (mood: Mood) => {
    setSelectedMood(mood);
    // Animate transition to map
    setTimeout(() => {
      setShowMap(true);
    }, 300);
  };

  const handleBack = () => {
    setShowMap(false);
    setTimeout(() => {
      setSelectedMood(null);
    }, 300);
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden nyc-background">
      {/* Light gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-white to-background" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {!showMap ? (
          <MoodSelector onSelect={handleMoodSelect} />
        ) : (
          <MapViewClean mood={selectedMood} onBack={handleBack} />
        )}
      </div>

      {/* Subtle ambient glow effects for light mode */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
    </main>
  );
}
