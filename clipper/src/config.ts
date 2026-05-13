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
        endCardLine1: `@${instagramHandle()}`,
        endCardLine2: "mysteryhitsfactory.com",
        brandColor: "#FFD700",
      };
    case "facebook":
      return {
        platform,
        endCardLine1: facebookPage(),
        endCardLine2: "mysteryhitsfactory.com",
        brandColor: "#FFD700",
      };
  }
}

/**
 * Build the per-platform caption.
 *
 * @param url Optional product URL — if provided, gets dropped in front of the
 *   show CTA so the post links to a specific drop / product. If omitted,
 *   captions just point to the brand handle / store generally.
 */
export function captionFor(
  platform: Platform,
  baseCaption: string,
  url?: string
): string {
  const base = baseCaption.trim();
  const link = url ?? "mysteryhitsfactory.com";
  switch (platform) {
    case "tiktok":
      return [
        base,
        ``,
        `🔗 ${link}`,
        `follow @${tiktokHandle()} for daily Pokemon hits`,
        ``,
        `#pokemon #pokemoncards #pokemontcg #pokemoncommunity #pokemonbreaks #mysterypack #poketuber #pull #foryou #fyp`,
      ].join("\n");
    case "instagram":
      return [
        base,
        ``,
        `🔗 ${link}`,
        `Mystery Pokemon packs at mysteryhitsfactory.com`,
        ``,
        `#pokemon #pokemontcg #pokemoncards #pokemoncommunity #boosterbox #etb #mysterypack #poketuber #pokemoncardsforsale #pokemoncollector #thehobby`,
      ].join("\n");
    case "facebook":
      return [
        base,
        ``,
        `Shop the next drop: ${link}`,
        `${facebookPage()} — mystery Pokemon packs, sealed singles, and themed bundles at mysteryhitsfactory.com.`,
      ].join("\n");
  }
}
