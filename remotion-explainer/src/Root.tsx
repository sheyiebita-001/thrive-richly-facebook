import React from "react";
import { Composition, CalculateMetadataFunction, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { FinancialExplainer, type FinancialExplainerProps } from "./FinancialExplainer";
import { getAudioDuration } from "./get-audio-duration";
import { FPS, WIDTH, HEIGHT, TRANSITION_DURATION_FRAMES, SCENE_PADDING_FRAMES } from "./constants";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const defaultScript = {
  topic: "Preview",
  description: "Preview composition",
  targetDurationMinutes: 1,
  hasVoiceover: false,
  colorScheme: { primary: "#3b82f6", secondary: "#10b981", background: "#0a0a0a", text: "#ffffff", muted: "#94a3b8" },
  scenes: [{
    id: "scene-01-intro",
    type: "intro" as const,
    title: "Financial Explainer Preview",
    narration: "Welcome to the preview.",
    onScreenText: { headline: "Financial Explainer", subheadline: "Generate a real script to see the full video" },
    transitionToNext: "fade" as const,
  }],
};

const calculateMetadata: CalculateMetadataFunction<FinancialExplainerProps> = async ({ props }) => {
  const { script } = props;
  let sceneDurationsInFrames: number[];

  if (script.hasVoiceover) {
    // Voiceover mode: measure actual MP3 durations
    try {
      const durations = await Promise.all(
        script.scenes.map((scene) =>
          getAudioDuration(staticFile(`voiceover/current/${scene.id}.mp3`))
        )
      );
      sceneDurationsInFrames = durations.map((s) => Math.ceil(s * FPS) + SCENE_PADDING_FRAMES);
    } catch {
      // Fallback to word-count estimation
      sceneDurationsInFrames = script.scenes.map((s) => {
        const words = s.narration.trim().split(/\s+/).length;
        return Math.max(8 * FPS, Math.ceil((words / 2.5) * FPS)) + SCENE_PADDING_FRAMES;
      });
    }
  } else if (script.sceneDurations && script.sceneDurations.length === script.scenes.length) {
    // Text-only mode: use pre-computed durations from orchestrator
    sceneDurationsInFrames = script.sceneDurations.map((s) => s * FPS + SCENE_PADDING_FRAMES);
  } else {
    // Fallback: estimate from word count
    sceneDurationsInFrames = script.scenes.map((s) => {
      const words = s.narration.trim().split(/\s+/).length;
      return Math.max(8 * FPS, Math.ceil((words / 2.5) * FPS)) + SCENE_PADDING_FRAMES;
    });
  }

  const overlap = (script.scenes.length - 1) * TRANSITION_DURATION_FRAMES;
  const totalFrames = sceneDurationsInFrames.reduce((a, b) => a + b, 0) - overlap;

  return {
    durationInFrames: totalFrames,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    props: { ...props, sceneDurationsInFrames },
  };
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="FinancialExplainer"
      component={FinancialExplainer}
      durationInFrames={5 * FPS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={{ script: defaultScript }}
      calculateMetadata={calculateMetadata}
      defaultCodec="h264"
    />
  );
};
