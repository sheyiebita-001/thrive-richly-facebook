import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { SPRING_SMOOTH, SPRING_BOUNCY, FONT_SIZES } from "../constants";
import type { SceneProps } from "./types";

export const IntroScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleP = spring({ frame, fps, delay: 8, config: SPRING_BOUNCY });
  const subP = spring({ frame, fps, delay: 20, config: SPRING_SMOOTH });
  const lineP = spring({ frame, fps, delay: 14, config: SPRING_SMOOTH });
  const { headline, subheadline, bodyText } = sceneData.onScreenText;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 120 }}>
        <div style={{ width: interpolate(lineP, [0, 1], [0, 120]), height: 4, backgroundColor: colorScheme.primary, borderRadius: 2, marginBottom: 32 }} />
        <div style={{ fontSize: FONT_SIZES.hero, fontWeight: 800, color: colorScheme.text, textAlign: "center", lineHeight: 1.15, opacity: titleP, transform: `scale(${interpolate(titleP, [0, 1], [0.85, 1])})`, maxWidth: 1400 }}>
          {headline || sceneData.title}
        </div>
        {subheadline && (
          <div style={{ fontSize: FONT_SIZES.subtitle, color: colorScheme.muted, textAlign: "center", marginTop: 24, opacity: subP, transform: `translateY(${interpolate(subP, [0, 1], [20, 0])}px)`, maxWidth: 1100, lineHeight: 1.5 }}>
            {subheadline}
          </div>
        )}
        {bodyText && (
          <div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.6)", textAlign: "center", marginTop: 20, opacity: subP, maxWidth: 900, lineHeight: 1.6 }}>
            {bodyText}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const OutroScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoP = spring({ frame, fps, delay: 0, config: SPRING_BOUNCY });
  const textP = spring({ frame, fps, delay: 10, config: SPRING_SMOOTH });
  const ctaP = spring({ frame, fps, delay: 20, config: SPRING_BOUNCY });
  const { headline, subheadline, bodyText } = sceneData.onScreenText;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 140px", gap: 28 }}>
        <div style={{ fontSize: FONT_SIZES.hero, fontWeight: 800, color: colorScheme.primary, opacity: logoP, transform: `scale(${interpolate(logoP, [0, 1], [0.8, 1])})` }}>Thrive Richly</div>
        <div style={{ fontSize: FONT_SIZES.subtitle, color: colorScheme.text, textAlign: "center", opacity: textP, transform: `translateY(${interpolate(textP, [0, 1], [15, 0])}px)`, maxWidth: 900, lineHeight: 1.5 }}>
          {headline || "Like, Subscribe & Share"}
        </div>
        {subheadline && <div style={{ fontSize: FONT_SIZES.body, color: colorScheme.muted, textAlign: "center", opacity: textP, maxWidth: 800 }}>{subheadline}</div>}
        <div style={{ marginTop: 20, padding: "18px 60px", backgroundColor: colorScheme.primary, borderRadius: 50, opacity: ctaP, transform: `scale(${interpolate(ctaP, [0, 1], [0.7, 1])})` }}>
          <span style={{ fontSize: FONT_SIZES.body, fontWeight: 700, color: "#ffffff" }}>{bodyText || "Subscribe for More"}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
