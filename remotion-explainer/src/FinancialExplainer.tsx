import React from "react";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { ProgressBar } from "./components/Shared";
import { IntroScene, OutroScene } from "./scenes/IntroOutro";
import { ConceptScene, ExampleScene, QuoteScene } from "./scenes/ContentScenes";
import { ComparisonScene, ChartScene, KeyPointScene, RecapScene } from "./scenes/DataScenes";
import { TRANSITION_DURATION_FRAMES, VOICE_VOLUME } from "./constants";
import type { VideoScript, Scene, ColorScheme } from "./schemas";

export type FinancialExplainerProps = {
  script: VideoScript;
  sceneDurationsInFrames?: number[];
};

const SceneRenderer: React.FC<{ scene: Scene; colorScheme: ColorScheme }> = ({ scene, colorScheme }) => {
  const props = { sceneData: scene, colorScheme };
  switch (scene.type) {
    case "intro": return <IntroScene {...props} />;
    case "concept": return <ConceptScene {...props} />;
    case "example": return <ExampleScene {...props} />;
    case "comparison": return <ComparisonScene {...props} />;
    case "chart": return <ChartScene {...props} />;
    case "keypoints": return <KeyPointScene {...props} />;
    case "quote": return <QuoteScene {...props} />;
    case "recap": return <RecapScene {...props} />;
    case "outro": return <OutroScene {...props} />;
    default: return <ConceptScene {...props} />;
  }
};

function getTransition(type: string) {
  switch (type) {
    case "slide": return slide();
    case "wipe": return wipe();
    default: return fade();
  }
}

export const FinancialExplainer: React.FC<FinancialExplainerProps> = ({ script, sceneDurationsInFrames }) => {
  const { fps } = useVideoConfig();
  const durations = sceneDurationsInFrames || script.scenes.map(() => 5 * fps);
  const hasVoiceover = script.hasVoiceover === true;

  return (
    <AbsoluteFill style={{ backgroundColor: script.colorScheme.background }}>
      <TransitionSeries>
        {script.scenes.map((scene, i) => (
          <React.Fragment key={scene.id}>
            <TransitionSeries.Sequence durationInFrames={durations[i]} premountFor={fps}>
              {/* Only include audio if voiceover was generated */}
              {hasVoiceover && (
                <Audio src={staticFile(`voiceover/current/${scene.id}.mp3`)} volume={VOICE_VOLUME} />
              )}
              <SceneRenderer scene={scene} colorScheme={script.colorScheme} />
            </TransitionSeries.Sequence>
            {i < script.scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={getTransition(scene.transitionToNext)}
                timing={linearTiming({ durationInFrames: TRANSITION_DURATION_FRAMES })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>
      <ProgressBar color={script.colorScheme.primary} />
    </AbsoluteFill>
  );
};
