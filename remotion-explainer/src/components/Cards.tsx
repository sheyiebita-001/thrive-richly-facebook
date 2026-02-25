import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { SPRING_SMOOTH, STAGGER_DELAY_FRAMES, FONT_SIZES } from "../constants";

// === ComparisonCard ===
type Side = { title: string; points: string[]; color: string };

const Card: React.FC<{ side: Side; delay: number; dir: "left" | "right" }> = ({ side, delay, dir }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, delay, config: SPRING_SMOOTH });
  const startX = dir === "left" ? -60 : 60;

  return (
    <div style={{ flex: 1, opacity: p, transform: `translateX(${startX * (1 - p)}px)`, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 40, border: `2px solid ${side.color}33` }}>
      <div style={{ fontSize: FONT_SIZES.subtitle, fontWeight: 700, color: side.color, marginBottom: 24, textAlign: "center" }}>{side.title}</div>
      {side.points.map((pt, i) => {
        const bp = spring({ frame, fps, delay: delay + 10 + i * STAGGER_DELAY_FRAMES, config: SPRING_SMOOTH });
        return (
          <div key={i} style={{ opacity: bp, transform: `translateY(${10 * (1 - bp)}px)`, fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.85)", marginBottom: 14, display: "flex", gap: 12 }}>
            <span style={{ color: side.color, fontSize: 20, lineHeight: "32px" }}>●</span>
            <span style={{ lineHeight: "32px" }}>{pt}</span>
          </div>
        );
      })}
    </div>
  );
};

export const ComparisonCard: React.FC<{ left: Side; right: Side; delay?: number }> = ({ left, right, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vsP = spring({ frame, fps, delay: delay + 5, config: { damping: 14, stiffness: 120 } });

  return (
    <div style={{ display: "flex", gap: 40, alignItems: "stretch", width: "100%", maxWidth: 1400 }}>
      <Card side={left} delay={delay} dir="left" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: vsP, transform: `scale(${vsP})` }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.3)", letterSpacing: 4 }}>VS</div>
      </div>
      <Card side={right} delay={delay + 8} dir="right" />
    </div>
  );
};

// === IconBullet ===
export const IconBullet: React.FC<{ items: string[]; accentColor?: string; delay?: number; numbered?: boolean }> = ({
  items, accentColor = "#3b82f6", delay = 0, numbered = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {items.map((item, i) => {
        const p = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES, config: SPRING_SMOOTH });
        const iconS = spring({ frame, fps, delay: delay + i * STAGGER_DELAY_FRAMES, config: { damping: 14, stiffness: 120 } });
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [30, 0])}px)` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${accentColor}20`, border: `2px solid ${accentColor}50`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${iconS})`, flexShrink: 0 }}>
              <span style={{ color: accentColor, fontSize: 20, fontWeight: 700 }}>{numbered ? i + 1 : "✓"}</span>
            </div>
            <span style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.9)", lineHeight: 1.4 }}>{item}</span>
          </div>
        );
      })}
    </div>
  );
};
