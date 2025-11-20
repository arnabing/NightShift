"use client";

import { Mood } from "@/app/page";

interface MoodDialProps {
  selectedMood: Mood;
  onMoodChange: (mood: Mood) => void;
}

const moods = [
  { id: "cocktails" as Mood, emoji: "🍸", label: "Nice cocktails" },
  { id: "dive" as Mood, emoji: "🍺", label: "Dive loser" },
  { id: "sports" as Mood, emoji: "🏈", label: "Sports" },
  { id: "love" as Mood, emoji: "💕", label: "Find love" },
  { id: "dance" as Mood, emoji: "💃", label: "Dance" },
];

export function MoodDial({ selectedMood, onMoodChange }: MoodDialProps) {
  const radius = 140;
  const centerX = 180;
  const centerY = 180;

  // Calculate positions for moods in a circle
  const getMoodPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2; // Start at top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x, y, angle: (angle * 180) / Math.PI };
  };

  return (
    <div className="relative w-full max-w-md aspect-square flex items-center justify-center">
      {/* SVG Dial */}
      <svg
        viewBox="0 0 360 360"
        className="w-full h-full"
        style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}
      >
        {/* Outer ring - Fender amp style */}
        <circle
          cx={centerX}
          cy={centerY}
          r={radius + 30}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r={radius + 35}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Inner dial plate */}
        <defs>
          <radialGradient id="dialGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(var(--card))" />
            <stop offset="100%" stopColor="hsl(var(--background))" />
          </radialGradient>
        </defs>
        <circle
          cx={centerX}
          cy={centerY}
          r={radius}
          fill="url(#dialGradient)"
          stroke="hsl(var(--border))"
          strokeWidth="3"
        />

        {/* Center knob */}
        <circle
          cx={centerX}
          cy={centerY}
          r="20"
          fill="hsl(var(--muted))"
          stroke="hsl(var(--border))"
          strokeWidth="2"
        />
        <circle
          cx={centerX}
          cy={centerY}
          r="12"
          fill="hsl(var(--background))"
        />

        {/* Tick marks around the dial */}
        {moods.map((_, index) => {
          const { angle } = getMoodPosition(index, moods.length);
          const tickAngle = (angle * Math.PI) / 180;
          const tickStartRadius = radius - 15;
          const tickEndRadius = radius - 5;

          const x1 = centerX + tickStartRadius * Math.cos(tickAngle);
          const y1 = centerY + tickStartRadius * Math.sin(tickAngle);
          const x2 = centerX + tickEndRadius * Math.cos(tickAngle);
          const y2 = centerY + tickEndRadius * Math.sin(tickAngle);

          return (
            <line
              key={`tick-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              opacity="0.5"
            />
          );
        })}

        {/* Selection indicator - pointer from center */}
        {selectedMood && (
          <g>
            {(() => {
              const selectedIndex = moods.findIndex(
                (m) => m.id === selectedMood
              );
              const { angle } = getMoodPosition(selectedIndex, moods.length);
              const pointerAngle = (angle * Math.PI) / 180;
              const pointerLength = 80;

              const x = centerX + pointerLength * Math.cos(pointerAngle);
              const y = centerY + pointerLength * Math.sin(pointerAngle);

              return (
                <>
                  <line
                    x1={centerX}
                    y1={centerY}
                    x2={x}
                    y2={y}
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="neon-glow"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="hsl(var(--primary))"
                    className="neon-glow"
                  />
                </>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Mood options positioned around the dial */}
      {moods.map((mood, index) => {
        const { x, y } = getMoodPosition(index, moods.length);
        const isSelected = selectedMood === mood.id;

        return (
          <button
            key={mood.id}
            onClick={() => onMoodChange(mood.id)}
            className={`
              absolute group
              transition-all duration-300 transform
              ${isSelected ? "scale-125" : "scale-100 hover:scale-110"}
            `}
            style={{
              left: `${(x / 360) * 100}%`,
              top: `${(y / 360) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className={`
              flex flex-col items-center gap-1
              ${isSelected ? "opacity-100" : "opacity-60 group-hover:opacity-100"}
            `}
            >
              <div
                className={`
                text-4xl md:text-5xl transition-all duration-300
                ${isSelected ? "neon-glow brightness-125 saturate-150" : ""}
              `}
              >
                {mood.emoji}
              </div>
              <span
                className={`
                text-xs font-medium whitespace-nowrap
                ${
                  isSelected
                    ? "text-primary font-bold"
                    : "text-muted-foreground"
                }
              `}
              >
                {mood.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
