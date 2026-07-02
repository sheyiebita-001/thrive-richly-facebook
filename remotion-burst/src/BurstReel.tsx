import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

export const FPS = 30;
export const SCENE_PAD_SECONDS = 0.35;

export type BurstScene = {
  video: string; // path under public/, e.g. "assets/p1s1.mp4"; empty string = solid background
  audio: string; // path under public/, e.g. "assets/p1s1.mp3"
  text: string; // the voiceover text, shown as captions
};

export type BurstReelProps = {
  scenes: BurstScene[];
  sceneDurations: number[]; // seconds, filled in by calculateMetadata
};

const WORDS_PER_GROUP = 3;

const Captions: React.FC<{ text: string; durationInFrames: number }> = ({
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(/\s+/).filter(Boolean);
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_GROUP) {
    groups.push(words.slice(i, i + WORDS_PER_GROUP).join(" "));
  }
  if (groups.length === 0) return null;
  const framesPerGroup = durationInFrames / groups.length;
  const idx = Math.min(groups.length - 1, Math.floor(frame / framesPerGroup));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 84,
          lineHeight: 1.15,
          color: "#FFFFFF",
          textAlign: "center",
          textTransform: "uppercase",
          padding: "0 60px",
          textShadow:
            "0 0 24px rgba(0,0,0,0.9), 3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000",
        }}
      >
        {groups[idx]}
      </div>
    </AbsoluteFill>
  );
};

export const BurstReel: React.FC<BurstReelProps> = ({
  scenes,
  sceneDurations,
}) => {
  let offset = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#101820" }}>
      {scenes.map((scene, i) => {
        const durationInFrames = Math.max(
          1,
          Math.round((sceneDurations[i] ?? 3) * FPS),
        );
        const from = offset;
        offset += durationInFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            {scene.video ? (
              <OffthreadVideo
                src={staticFile(scene.video)}
                muted
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : null}
            {/* darken for caption legibility */}
            <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.35)" }} />
            <Audio src={staticFile(scene.audio)} />
            <Captions text={scene.text} durationInFrames={durationInFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
