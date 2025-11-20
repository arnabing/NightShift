"use client";

import { Mood } from "@/app/page";
import { ArrowLeft } from "lucide-react";

interface MapViewProps {
  mood: Mood;
  onBack: () => void;
}

const moodLabels = {
  cocktails: "🍸 Nice cocktails",
  dive: "🍺 Dive loser",
  sports: "🏈 Sports",
  love: "💕 Find love",
  dance: "💃 Dance",
};

export function MapView({ mood, onBack }: MapViewProps) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="glass-light border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-2xl">{mood && moodLabels[mood]?.split(" ")[0]}</span>
            <h2 className="text-lg font-semibold">
              {mood && moodLabels[mood]?.substring(2)}
            </h2>
          </div>

          <div className="w-20" /> {/* Spacer for center alignment */}
        </div>
      </div>

      {/* Map Container - Placeholder */}
      <div className="flex-1 relative bg-background/50">
        {/* Placeholder content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="glass rounded-2xl p-8 max-w-md text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-2xl font-bold mb-2">Map Coming Soon</h3>
            <p className="text-muted-foreground mb-4">
              Interactive map with venue markers will appear here
            </p>
            <p className="text-sm text-muted-foreground">
              Showing venues for: <span className="text-primary font-semibold">{mood && moodLabels[mood]}</span>
            </p>
          </div>
        </div>

        {/* Grid overlay for visual interest */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>
    </div>
  );
}
