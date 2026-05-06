import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";

const wordSchema = z.object({
  text: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});

export const streamClipSchema = z.object({
  videoFile: z.string().describe("Filename of the source stream inside public/"),
  sourceStartSeconds: z.number().min(0).describe("Where in the source video to start"),
  clipLengthSeconds: z.number().min(5).max(90).describe("Output clip length"),
  hookText: z.string().describe("Hook overlay shown for the first 1.5s"),
  endCardLine1: z.string(),
  endCardLine2: z.string(),
  brandColor: zColor(),
  words: z
    .array(wordSchema)
    .describe("Word-level Whisper timestamps, clip-relative seconds"),
});

export type StreamClipProps = z.infer<typeof streamClipSchema>;

type Word = z.infer<typeof wordSchema>;

const HOOK_DURATION = 1.5;
const END_CARD_DURATION = 2.0;

export const StreamClip: React.FC<StreamClipProps> = ({
  videoFile,
  sourceStartSeconds,
  hookText,
  endCardLine1,
  endCardLine2,
  brandColor,
  words,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // No fade-in — video is visible from frame 0. Tiny fade-out so the cut
  // to a feed/end-card next isn't a hard pop.
  const fadeOutFrames = Math.round(0.25 * fps);
  const fadeOpacity = interpolate(
    frame,
    [0, durationInFrames - fadeOutFrames, durationInFrames],
    [1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const hookFrames = Math.round(HOOK_DURATION * fps);
  const endCardFrames = Math.round(END_CARD_DURATION * fps);
  const endCardStart = durationInFrames - endCardFrames;

  // Captions stop a bit before the end card so they don't fight for space.
  const captionCutoff = (durationInFrames - endCardFrames) / fps;
  const visibleWords = words.filter((w) => w.start < captionCutoff);
  const captionGroups = groupWords(visibleWords);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: fadeOpacity }}>
        <OffthreadVideo
          src={staticFile(videoFile)}
          startFrom={Math.round(sourceStartSeconds * fps)}
          endAt={Math.round(sourceStartSeconds * fps) + durationInFrames}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      <Sequence from={0} durationInFrames={hookFrames}>
        <HookOverlay text={hookText} brandColor={brandColor} />
      </Sequence>

      {captionGroups.map((g, i) => (
        <Sequence
          key={i}
          from={Math.round(g.start * fps)}
          durationInFrames={Math.max(1, Math.round((g.end - g.start) * fps))}
        >
          <CaptionOverlay text={g.text} />
        </Sequence>
      ))}

      <Sequence from={endCardStart} durationInFrames={endCardFrames}>
        <EndCard line1={endCardLine1} line2={endCardLine2} brandColor={brandColor} />
      </Sequence>
    </AbsoluteFill>
  );
};

function groupWords(words: Word[]): { text: string; start: number; end: number }[] {
  const groups: { text: string; start: number; end: number }[] = [];
  let current: Word[] = [];
  for (const w of words) {
    current.push(w);
    const dur = w.end - current[0].start;
    if (current.length >= 3 || dur >= 1.4) {
      groups.push({
        text: current.map((c) => c.text).join(" ").trim(),
        start: current[0].start,
        end: w.end,
      });
      current = [];
    }
  }
  if (current.length > 0) {
    groups.push({
      text: current.map((c) => c.text).join(" ").trim(),
      start: current[0].start,
      end: current[current.length - 1].end,
    });
  }
  return groups;
}

const HookOverlay: React.FC<{ text: string; brandColor: string }> = ({ text, brandColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  // No fade-in — hook is visible from the very first frame. Quick fade-out so
  // it doesn't pop off when the captions take over.
  const outFrames = Math.round(0.2 * fps);
  const opacity = interpolate(
    frame,
    [0, durationInFrames - outFrames, durationInFrames],
    [1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 200, opacity }}
    >
      <div
        style={{
          backgroundColor: brandColor,
          color: "#000",
          fontSize: 80,
          fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          padding: "24px 40px",
          borderRadius: 18,
          textTransform: "uppercase",
          letterSpacing: 2,
          boxShadow: "0 10px 0 rgba(0,0,0,0.7)",
          textAlign: "center",
          maxWidth: 900,
          lineHeight: 1.05,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const CaptionOverlay: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 360,
        paddingLeft: 60,
        paddingRight: 60,
      }}
    >
      <div
        style={{
          color: "#FFFFFF",
          fontSize: 92,
          fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          textAlign: "center",
          textShadow:
            "0 0 14px rgba(0,0,0,0.95), 5px 5px 0 #000, -5px -5px 0 #000, 5px -5px 0 #000, -5px 5px 0 #000",
          lineHeight: 1.05,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC<{ line1: string; line2: string; brandColor: string }> = ({
  line1,
  line2,
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inFrames = Math.round(0.25 * fps);
  const opacity = interpolate(frame, [0, inFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "rgba(0,0,0,0.86)",
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <div
        style={{
          color: brandColor,
          fontSize: 104,
          fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          textAlign: "center",
          textShadow: "0 0 18px rgba(0,0,0,0.95)",
          marginBottom: 36,
          padding: "0 60px",
          lineHeight: 1.05,
        }}
      >
        {line1}
      </div>
      <div
        style={{
          color: "#FFFFFF",
          fontSize: 60,
          fontWeight: 700,
          fontFamily: 'Arial, sans-serif',
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        {line2}
      </div>
    </AbsoluteFill>
  );
};
