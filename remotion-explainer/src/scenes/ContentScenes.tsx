import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { Background } from "../components/Background";
import { AnimatedText } from "../components/AnimatedText";
import { SectionTitle, NumberCounter } from "../components/Shared";
import { FONT_SIZES, SPRING_SMOOTH } from "../constants";
import type { SceneProps } from "./types";

export const ConceptScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { headline, subheadline, bodyText } = sceneData.onScreenText;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 140px", gap: 28 }}>
        <SectionTitle text={headline || sceneData.title} accentColor={colorScheme.primary} delay={5} />
        {subheadline && <AnimatedText delay={15}><div style={{ fontSize: FONT_SIZES.subtitle, color: colorScheme.secondary, fontWeight: 600, lineHeight: 1.4, maxWidth: 1200 }}>{subheadline}</div></AnimatedText>}
        {bodyText && <AnimatedText delay={25}><div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 1100 }}>{bodyText}</div></AnimatedText>}
        <div style={{ position: "absolute", right: 80, top: "50%", transform: "translateY(-50%)", width: 6, height: interpolate(spring({ frame, fps, delay: 10, config: SPRING_SMOOTH }), [0, 1], [0, 300]), backgroundColor: `${colorScheme.primary}30`, borderRadius: 3 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ExampleScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const { bigNumber, bigNumberLabel, bodyText, headline } = sceneData.onScreenText;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 140px", gap: 36 }}>
        {headline && <AnimatedText delay={0}><div style={{ fontSize: FONT_SIZES.subtitle, color: colorScheme.muted, fontWeight: 500, textAlign: "center" }}>{headline}</div></AnimatedText>}
        {bigNumber && <NumberCounter value={bigNumber} label={bigNumberLabel} color={colorScheme.primary} delay={10} />}
        {bodyText && <AnimatedText delay={35}><div style={{ fontSize: FONT_SIZES.body, color: "rgba(255,255,255,0.7)", textAlign: "center", maxWidth: 1000, lineHeight: 1.6 }}>{bodyText}</div></AnimatedText>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const QuoteScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { quoteText, quoteAuthor } = sceneData.onScreenText;
  const markP = spring({ frame, fps, delay: 0, config: { damping: 14, stiffness: 120 } });
  const textP = spring({ frame, fps, delay: 10, config: SPRING_SMOOTH });
  const authP = spring({ frame, fps, delay: 25, config: SPRING_SMOOTH });

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 180px" }}>
        <div style={{ fontSize: 200, fontWeight: 800, color: `${colorScheme.primary}30`, lineHeight: 0.8, opacity: markP, transform: `scale(${interpolate(markP, [0, 1], [0.5, 1])})`, marginBottom: -20 }}>"</div>
        {quoteText && <div style={{ fontSize: FONT_SIZES.subtitle + 4, fontWeight: 500, color: colorScheme.text, textAlign: "center", lineHeight: 1.6, fontStyle: "italic", opacity: textP, transform: `translateY(${interpolate(textP, [0, 1], [20, 0])}px)`, maxWidth: 1100 }}>{quoteText}</div>}
        {quoteAuthor && <div style={{ fontSize: FONT_SIZES.body, color: colorScheme.primary, marginTop: 32, fontWeight: 600, opacity: authP }}>— {quoteAuthor}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
