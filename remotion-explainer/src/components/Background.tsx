import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { ColorScheme } from "../schemas";

export const Background: React.FC<{ colorScheme: ColorScheme }> = ({ colorScheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = interpolate(frame, [0, 10 * fps], [135, 145], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{ background: `linear-gradient(${angle}deg, ${colorScheme.background} 0%, #0d1117 50%, ${colorScheme.background} 100%)` }}
    />
  );
};
