import { Composition, staticFile } from "remotion";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { BurstReel, BurstReelProps, FPS, SCENE_PAD_SECONDS } from "./BurstReel";

const defaultProps: BurstReelProps = {
  scenes: [
    {
      video: "assets/sample.mp4",
      audio: "assets/sample.mp3",
      text: "Sample voiceover text for preview.",
    },
  ],
  sceneDurations: [3],
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="BurstReel"
      component={BurstReel}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={90}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        const sceneDurations: number[] = [];
        for (const scene of props.scenes) {
          const d = await getAudioDurationInSeconds(staticFile(scene.audio));
          sceneDurations.push(d + SCENE_PAD_SECONDS);
        }
        const total = sceneDurations.reduce((a, b) => a + b, 0);
        return {
          durationInFrames: Math.max(1, Math.ceil(total * FPS)),
          props: { ...props, sceneDurations },
        };
      }}
    />
  );
};
