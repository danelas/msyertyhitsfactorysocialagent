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
  /** "product" = product photo + sequenced hook/body/cta (sales posts).
   *  "statement" = bold branded fact/poll/quiz card (engagement posts). */
  variant: z.enum(["product", "statement"]).default("product"),
  /** Category badge shown on statement cards, e.g. "DID YOU KNOW?". */
  label: z.string().default(""),
});

export type PromoCardProps = z.infer<typeof promoCardSchema>;

const HOOK_END = 3;
const BODY_END = 8;

export const PromoCard: React.FC<PromoCardProps> = (props) => {
  if (props.variant === "statement") {
    return <StatementCard {...props} />;
  }
  return <ProductCard {...props} />;
};

const ProductCard: React.FC<PromoCardProps> = ({
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

  // Slow zoom (Ken Burns) — applied only to the blurred backdrop so the sharp
  // product layer never drifts out of frame.
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Blurred fill: a cover-cropped, blurred copy of the same image fills the
          9:16 frame so off-ratio product photos don't leave black bars — without
          cropping the actual product (that's the contained layer below). */}
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Img
          src={staticFile(backgroundImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(36px) brightness(0.55)",
            transform: "scale(1.2)",
          }}
        />
      </AbsoluteFill>
      {/* Sharp product, fully contained — never cropped, whatever its ratio.
          Bounded to a center safe zone (clear top/bottom bands) so the hook and
          CTA text sit on the blurred fill above/below rather than over the
          product. */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "640px 44px 520px",
        }}
      >
        <Img
          src={staticFile(backgroundImage)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.22)" }} />

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
  // Hold solid for the first N frames, then fade out at the very end so the
  // handoff to the next text block isn't a hard pop. No fade-in — the text
  // is visible from the very first frame of its sequence.
  const outFrames = Math.round(0.2 * fps);
  const opacity = interpolate(
    frame,
    [0, durationInFrames - outFrames, durationInFrames],
    [1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return (
    <AbsoluteFill
      style={{
        justifyContent: position === "top" ? "flex-start" : "flex-end",
        alignItems: "center",
        padding: position === "top" ? "160px 60px 0" : "0 60px 260px",
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
          lineHeight: 1.05,
          maxWidth: 920,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** "#FFD700" → "rgba(255,215,0,a)". Falls back to brand gold on parse fail. */
function hexA(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,215,0,${a})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * Engagement layout — a bold, branded fact / poll / quiz card. No product photo:
 * a dark dramatic background with a gold glow, a category badge ("DID YOU
 * KNOW?"), the hook as a big headline, the body as supporting text, and a CTA
 * pinned at the bottom. Reads as a static card, so nothing is sequenced.
 */
const StatementCard: React.FC<PromoCardProps> = ({
  backgroundImage,
  hook,
  body,
  cta,
  brandColor,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.1]);
  const enter = interpolate(frame, [0, Math.round(0.5 * fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // CTA lands a beat later so the eye reads the fact/question first.
  const ctaIn = interpolate(
    frame,
    [Math.round(1.2 * fps), Math.round(1.8 * fps)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {/* Faint blurred texture from the staged image so the card isn't flat. */}
      <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: 0.18 }}>
        <Img
          src={staticFile(backgroundImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(40px) saturate(1.3)",
          }}
        />
      </AbsoluteFill>
      {/* Gold glow up top + dark vignette below for legibility. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 28%, ${hexA(
            brandColor,
            0.3
          )}, rgba(0,0,0,0) 55%), radial-gradient(circle at 50% 115%, rgba(0,0,0,0.92), rgba(0,0,0,0.35))`,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "150px 70px 320px",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        {label ? (
          <div
            style={{
              backgroundColor: brandColor,
              color: "#000",
              fontSize: 46,
              fontWeight: 900,
              fontFamily: '"Arial Black", Impact, sans-serif',
              letterSpacing: 4,
              textTransform: "uppercase",
              padding: "16px 42px",
              borderRadius: 999,
              marginBottom: 60,
              boxShadow: "0 8px 0 rgba(0,0,0,0.6)",
            }}
          >
            {label}
          </div>
        ) : null}
        <div
          style={{
            color: "#fff",
            fontSize: 104,
            fontWeight: 900,
            fontFamily: '"Arial Black", Impact, sans-serif',
            textAlign: "center",
            textTransform: "uppercase",
            lineHeight: 1.04,
            maxWidth: 950,
            textShadow: "0 4px 28px rgba(0,0,0,0.85)",
          }}
        >
          {hook}
        </div>
        {body ? (
          <div
            style={{
              color: "#ededed",
              fontSize: 52,
              fontWeight: 700,
              fontFamily: "Arial, sans-serif",
              textAlign: "center",
              lineHeight: 1.25,
              maxWidth: 880,
              marginTop: 46,
              textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            }}
          >
            {body}
          </div>
        ) : null}
      </AbsoluteFill>

      {/* CTA pinned to the bottom band. */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 60px 190px",
          opacity: ctaIn,
          transform: `translateY(${(1 - ctaIn) * 24}px)`,
        }}
      >
        <div
          style={{
            backgroundColor: brandColor,
            color: "#000",
            fontSize: 60,
            fontWeight: 900,
            fontFamily: '"Arial Black", Impact, sans-serif',
            textTransform: "uppercase",
            letterSpacing: 2,
            padding: "26px 52px",
            borderRadius: 22,
            boxShadow: "0 12px 0 rgba(0,0,0,0.7)",
            textAlign: "center",
            maxWidth: 920,
          }}
        >
          {cta}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const BodyText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const outFrames = Math.round(0.2 * fps);
  const opacity = interpolate(
    frame,
    [0, durationInFrames - outFrames, durationInFrames],
    [1, 1, 0],
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
