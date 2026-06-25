import { Composition } from "remotion";
import { StreamClip, streamClipSchema } from "./StreamClip";
import { PromoCard, promoCardSchema } from "./PromoCard";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StreamClip"
        component={StreamClip}
        durationInFrames={FPS * 30}
        fps={FPS}
        width={1080}
        height={1920}
        schema={streamClipSchema}
        defaultProps={{
          videoFile: "source.mp4",
          sourceStartSeconds: 0,
          clipLengthSeconds: 30,
          hookText: "INSANE PULL",
          endCardLine1: "@mystery.hits.factory",
          endCardLine2: "follow for more",
          brandColor: "#FFD700" as const,
          words: [],
        }}
        calculateMetadata={({ props }) => ({
          durationInFrames: Math.max(1, Math.round(props.clipLengthSeconds * FPS)),
        })}
      />
      <Composition
        id="PromoCard"
        component={PromoCard}
        durationInFrames={FPS * 12}
        fps={FPS}
        width={1080}
        height={1920}
        schema={promoCardSchema}
        defaultProps={{
          backgroundImage: "promo.png",
          hook: "OPEN BOXES LIVE",
          body: "Every night we crack packs and pull hits in front of the camera — come watch.",
          cta: "JOIN US TONIGHT",
          brandColor: "#38bdf8" as const,
          variant: "product" as const,
          label: "",
          optionA: "",
          optionB: "",
          chipBg: "linear-gradient(135deg, #38bdf8, #1d4ed8)",
          chipText: "#ffffff",
          accent: "#38bdf8",
          glow: "#2563eb",
        }}
      />
    </>
  );
};
