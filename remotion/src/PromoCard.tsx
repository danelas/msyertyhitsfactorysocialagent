import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const promoCardSchema = z.object({
  backgroundImage: z.string().describe("Filename in public/ — staged by the clipper"),
  hook: z.string(),
  body: z.string(),
  cta: z.string(),
  brandColor: zColor(),
});

export type PromoCardProps = z.infer<typeof promoCardSchema>;

const HOOK_END = 3;
const BODY_END = 8;

export const PromoCard: React.FC<PromoCardProps> = ({
  backgroundImage,
  hook,
  body,
  cta,
  brandColor,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();

  const hookFrames = HOOK_END * fps;
  const bodyStart = HOOK_END * fps;
  const bodyFrames = (BODY_END - HOOK_END) * fps;
  const ctaStart = BODY_END * fps;
  const ctaFrames = durationInFrames - ctaStart;

  // Slow zoom (Ken Burns) on the bg image so a static photo feels alive.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={staticFile(backgroundImage)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.42)" }} />

      <Sequence from={0} durationInFrames={hookFrames}>
        <BigText text={hook} brandColor={brandColor} position="top" />
      </Sequence>

      <Sequence from={bodyStart} durationInFrames={bodyFrames}>
        <BodyText text={body} />
      </Sequence>

      <Sequence from={ctaStart} durationInFrames={ctaFrames}>
        <BigText text={cta} brandColor={brandColor} position="bottom" />
      </Sequence>
    </AbsoluteFill>
  );
};

const BigText: React.FC<{ text: string; brandColor: string; position: "top" | "bottom" }> = ({
  text,
  brandColor,
  position,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inFrames = Math.round(0.25 * fps);
  const outFrames = Math.round(0.25 * fps);
  const opacity = interpolate(
    frame,
    [0, inFrames, durationInFrames - outFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const scale = interpolate(frame, [0, inFrames], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        justifyContent: position === "top" ? "flex-start" : "flex-end",
        alignItems: "center",
        padding: position === "top" ? "240px 60px 0" : "0 60px 260px",
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: brandColor,
          color: "#000",
          fontSize: 96,
          fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          padding: "30px 48px",
          borderRadius: 22,
          textTransform: "uppercase",
          letterSpacing: 2,
          boxShadow: "0 12px 0 rgba(0,0,0,0.7)",
          textAlign: "center",
          transform: `scale(${scale})`,
          lineHeight: 1.05,
          maxWidth: 920,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

const BodyText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const inFrames = Math.round(0.3 * fps);
  const outFrames = Math.round(0.3 * fps);
  const opacity = interpolate(
    frame,
    [0, inFrames, durationInFrames - outFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{ justifyContent: "center", alignItems: "center", padding: 80, opacity }}
    >
      <div
        style={{
          color: "#FFFFFF",
          fontSize: 70,
          fontWeight: 900,
          fontFamily: '"Arial Black", Impact, sans-serif',
          textAlign: "center",
          textShadow:
            "0 0 14px rgba(0,0,0,0.95), 5px 5px 0 #000, -5px -5px 0 #000, 5px -5px 0 #000, -5px 5px 0 #000",
          lineHeight: 1.15,
          textTransform: "uppercase",
          maxWidth: 920,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
