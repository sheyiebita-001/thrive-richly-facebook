import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { WIDTH, SPRING_SMOOTH, FONT_SIZES } from "../constants";

// === ProgressBar ===
export const ProgressBar: React.FC<{ color?: string }> = ({ color = "#3b82f6" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const w = interpolate(frame, [0, durationInFrames], [0, WIDTH], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, width: WIDTH, height: 4, backgroundColor: "rgba(255,255,255,0.1)" }}>
      <div style={{ width: w, height: "100%", backgroundColor: color, borderRadius: "0 2px 2px 0" }} />
    </div>
  );
};

// === SectionTitle ===
export const SectionTitle: React.FC<{ text: string; accentColor?: string; delay?: number }> = ({
  text,
  accentColor = "#3b82f6",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const textP = spring({ frame, fps, delay, config: SPRING_SMOOTH });
  const lineP = spring({ frame, fps, delay: delay + 8, config: SPRING_SMOOTH });

  return (
    <div style={{ opacity: textP, transform: `translateY(${interpolate(textP, [0, 1], [20, 0])}px)` }}>
      <div style={{ width: interpolate(lineP, [0, 1], [0, 80]), height: 4, backgroundColor: accentColor, borderRadius: 2, marginBottom: 16 }} />
      <div style={{ fontSize: FONT_SIZES.title, fontWeight: 700, color: "#ffffff", lineHeight: 1.2 }}>{text}</div>
    </div>
  );
};

// === NumberCounter ===
export const NumberCounter: React.FC<{ value: string; label?: string; color?: string; delay?: number }> = ({
  value,
  label,
  color = "#3b82f6",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const match = value.match(/^([^0-9]*)([0-9,.]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const numericStr = match?.[2] ?? value;
  const suffix = match?.[3] ?? "";
  const numericValue = parseFloat(numericStr.replace(/,/g, ""));
  const decimals = numericStr.includes(".") ? (numericStr.split(".")[1]?.length ?? 0) : 0;

  const delayedFrame = Math.max(0, frame - delay);
  const progress = interpolate(delayedFrame, [0, 2 * fps], [0, 1], { easing: Easing.out(Easing.quad), extrapolateRight: "clamp" });
  const opacity = interpolate(delayedFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const display = isNaN(numericValue)
    ? value
    : prefix + (numericValue * progress).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + suffix;

  return (
    <div style={{ textAlign: "center", opacity }}>
      <div style={{ fontSize: FONT_SIZES.bigNumber, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{display}</div>
      {label && <div style={{ fontSize: FONT_SIZES.subtitle, color: "rgba(255,255,255,0.7)", marginTop: 12, fontWeight: 500 }}>{label}</div>}
    </div>
  );
};
