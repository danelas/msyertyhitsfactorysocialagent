import type { Moment } from "./detect/rank.ts";

export type Platform = "tiktok" | "instagram" | "facebook";

export const SETTINGS = {
  momentsPerStream: 3,
  remotionDir: "../remotion",
};

export function whatnotHandle() {
  return process.env.WHATNOT_HANDLE ?? "mysteryhitsfactory";
}
export function tiktokHandle() {
  return process.env.TIKTOK_HANDLE ?? "mystery.hits.factory";
}
export function instagramHandle() {
  return process.env.INSTAGRAM_HANDLE ?? "mystery.hits.factory";
}
export function facebookPage() {
  return process.env.FACEBOOK_PAGE ?? "Mystery Hits Factory";
}

export type PlatformStyle = {
  platform: Platform;
  endCardLine1: string;
  endCardLine2: string;
  brandColor: string;
};

export function styleFor(platform: Platform): PlatformStyle {
  switch (platform) {
    case "tiktok":
      return {
        platform,
        endCardLine1: `@${tiktokHandle()}`,
        endCardLine2: "follow for more pulls",
        brandColor: "#FFD700",
      };
    case "instagram":
      return {
        platform,
        endCardLine1: "live on Whatnot",
        endCardLine2: `@${whatnotHandle()}`,
        brandColor: "#FFD700",
      };
    case "facebook":
      return {
        platform,
        endCardLine1: facebookPage(),
        endCardLine2: "live every day on Whatnot",
        brandColor: "#FFD700",
      };
  }
}

export function captionFor(platform: Platform, moment: Moment): string {
  const base = moment.caption.trim();
  switch (platform) {
    case "tiktok":
      return [
        base,
        ``,
        `follow @${tiktokHandle()} — live every day on Whatnot 🔴`,
        ``,
        `#whatnot #sportscards #cardbreaks #cardcollector #thehobby #pull #foryou #fyp`,
      ].join("\n");
    case "instagram":
      return [
        base,
        ``,
        `Catch the live show on Whatnot — @${whatnotHandle()}`,
        ``,
        `#whatnot #sportscards #cardbreaks #boxbreak #cardcollector #thehobby #sportscardsforsale #cardsoftiktok`,
      ].join("\n");
    case "facebook":
      return [
        base,
        ``,
        `${facebookPage()} — live every day on Whatnot. Search "${whatnotHandle()}" on Whatnot to join.`,
      ].join("\n");
  }
}
