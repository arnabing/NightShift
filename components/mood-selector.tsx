"use client";

import { useState } from "react";
import { Mood } from "@/lib/types";
import { MoodDial } from "./mood-dial";

interface MoodSelectorProps {
  onSelect: (mood: Mood) => void;
}

export function MoodSelector({ onSelect }: MoodSelectorProps) {
  const [selectedMood, setSelectedMood] = useState<Mood>(null);

  const handleDialChange = (mood: Mood) => {
    setSelectedMood(mood);
  };

  const handleLetGo = () => {
    if (selectedMood) {
      onSelect(selectedMood);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      {/* Glass morphism modal */}
      <div className="glass rounded-3xl p-8 md:p-12 max-w-2xl w-full shadow-2xl animate-in fade-in zoom-in duration-500">
        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-4xl md:text-6xl font-bold mb-3 neon-text">
            NightShift
          </h1>
          <p className="text-muted-foreground text-lg md:text-xl">
            Stop asking the groupchat, just check the map
          </p>
        </div>

        {/* Mood Dial */}
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted-foreground mb-6 md:mb-8">
            What&apos;s the vibe tonight?
          </p>

          <MoodDial
            selectedMood={selectedMood}
            onMoodChange={handleDialChange}
          />

          {/* Let's go button */}
          <button
            onClick={handleLetGo}
            disabled={!selectedMood}
            className={`
              mt-8 md:mt-12 px-8 py-4 rounded-full font-semibold text-lg
              transition-all duration-300 transform
              ${
                selectedMood
                  ? "bg-primary text-primary-foreground neon-glow hover:scale-105 active:scale-95"
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              }
            `}
          >
            Let&apos;s Go
          </button>
        </div>

        {/* Tagline */}
        <p className="text-center text-xs text-muted-foreground mt-8 md:mt-12">
          Find where the action is in NYC
        </p>
      </div>
    </div>
  );
}
