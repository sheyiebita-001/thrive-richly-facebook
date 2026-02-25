import React from "react";
import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { AnimatedText } from "../components/AnimatedText";
import { SectionTitle } from "../components/Shared";
import { BarChart, LineChart, PieChart } from "../components/Charts";
import { ComparisonCard, IconBullet } from "../components/Cards";
import { FONT_SIZES } from "../constants";
import type { SceneProps } from "./types";

export const ComparisonScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const { comparisonLeft, comparisonRight, headline } = sceneData.onScreenText;
  if (!comparisonLeft || !comparisonRight) return null;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 100px", gap: 40 }}>
        {headline && <AnimatedText delay={0}><div style={{ fontSize: FONT_SIZES.title, fontWeight: 700, color: colorScheme.text, textAlign: "center" }}>{headline}</div></AnimatedText>}
        <ComparisonCard left={comparisonLeft} right={comparisonRight} delay={12} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ChartScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const { chartType, chartData, chartTitle, headline, bodyText } = sceneData.onScreenText;
  if (!chartData || chartData.length === 0) return null;

  const chart = chartType === "line" ? <LineChart data={chartData} title={chartTitle} accentColor={colorScheme.primary} delay={15} />
    : chartType === "pie" ? <PieChart data={chartData} title={chartTitle} delay={15} />
    : <BarChart data={chartData} title={chartTitle} accentColor={colorScheme.primary} delay={15} />;

  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 100px", gap: 30 }}>
        {headline && <AnimatedText delay={0}><div style={{ fontSize: FONT_SIZES.title, fontWeight: 700, color: colorScheme.text, textAlign: "center" }}>{headline}</div></AnimatedText>}
        {chart}
        {bodyText && <AnimatedText delay={40}><div style={{ fontSize: FONT_SIZES.caption, color: "rgba(255,255,255,0.5)", textAlign: "center", maxWidth: 900 }}>{bodyText}</div></AnimatedText>}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const KeyPointScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const { headline, bulletPoints } = sceneData.onScreenText;
  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 160px", gap: 36 }}>
        <SectionTitle text={headline || sceneData.title} accentColor={colorScheme.primary} delay={5} />
        {bulletPoints && bulletPoints.length > 0 && <IconBullet items={bulletPoints} accentColor={colorScheme.primary} delay={15} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const RecapScene: React.FC<SceneProps> = ({ sceneData, colorScheme }) => {
  const { headline, bulletPoints } = sceneData.onScreenText;
  return (
    <AbsoluteFill>
      <Background colorScheme={colorScheme} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "80px 160px", gap: 36 }}>
        <SectionTitle text={headline || "Key Takeaways"} accentColor={colorScheme.secondary} delay={5} />
        {bulletPoints && bulletPoints.length > 0 && <IconBullet items={bulletPoints} accentColor={colorScheme.secondary} delay={15} numbered />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
