import Anthropic from "@anthropic-ai/sdk";
import type { SiteContext, SiteProduct } from "../site/scrape.ts";

export type ContentTheme =
  | "live-drop-urgency"
  | "tier-spotlight"
  | "new-arrival"
  | "giveaway-hype"
  | "seller-supply"
  | "hit-spotlight"
  | "hobby-tip"
  | "intro"
  | "value-add";

export type ContentPlan = {
  theme: ContentTheme;
  hook: string;
  body: string;
  cta: string;
  imagePrompt: string;
  caption: string;
  /** Specific URL to drop into the caption when the post is anchored on a product. */
  url?: string;
};

const THEME_DESCRIPTIONS: Record<ContentTheme, string> = {
  "live-drop-urgency":
    "Time-pressured push to a specific live drop on the site. Lead with countdown / scarcity / dollar-value urgency. Reference the drop by name and price.",
  "tier-spotlight":
    "Educate viewers on what's actually inside ONE specific tier (Standard / Premium / Deluxe / Graded / Elite / Vault). Make it sound like a deal, not a sales pitch.",
  "new-arrival":
    "Inventory news — a specific sealed Pokemon set just landed (Crown Zenith, Silver Tempest, Stellar Crown, etc.). Treat it like a bulletin: limited stock, get them now.",
  "giveaway-hype":
    "Drive engagement to the SpinFREE / giveaway feature on the site. Free entry framing, FOMO-friendly, low-friction CTA.",
  "seller-supply":
    "Pitch to Whatnot sellers, break-show hosts, and other Pokemon resellers — our mystery packs are built to be cracked on stream. Reference guaranteed minimums, hit ratios, and how a stocked tier lineup makes for great live content. Speak peer-to-peer to other sellers, not as a competing seller.",
  "hit-spotlight":
    "Social proof: spotlight a REAL chase card a customer actually pulled out of one of our mystery packs. Use the anchor product's exact card name and dollar value. Frame it as 'this came out of one of our packs' — proof that big hits are live, not just marketing. Do NOT describe it as a product for sale; it's a past pull. Drive viewers to grab a pack and chase one themselves.",
  "hobby-tip":
    "An educational or insightful tip about the Pokemon TCG hobby (grading, storage, set knowledge, vintage vs. modern, pack/box value, what makes a card a chase, common mistakes new collectors make).",
  intro:
    "Brand intro — who Mystery Hits Factory is, what we do (mystery Pokemon packs across six tiers, sealed singles, themed bundles, drops on mysteryhitsfactory.com), why it's fun.",
  "value-add":
    "Genuine Pokemon-hobby value: a fact, a take, a perspective on the TCG that makes the hobby more interesting to a casual viewer (e.g., why WOTC era is special, what alt arts are, why sealed product holds value, etc.).",
};

const SYSTEM_PROMPT = `You write short, scroll-stopping social posts for "Mystery Hits Factory" — a Pokemon TCG mystery-pack maker and website (mysteryhitsfactory.com) that sells:
- Six-tier mystery packs: Standard ($9.99), Premium, Deluxe, Graded, Elite, Vault ($249, guaranteed minimum value)
- Time-limited Live Drops (e.g. Vault Drop #14, Mew Drop #2)
- Sealed singles in named sets (Crown Zenith, Silver Tempest, Stellar Crown, etc.)
- Themed packs and bundles (Mew Pack, Triple Hit Bundle)
- A SpinFREE / giveaway feature

NEVER frame Mystery Hits Factory as a Whatnot seller, a live breaker, a Whatnot host, or as running live breaks. We do NOT sell on Whatnot. No "watch our live", no "join our break", no "live every day on Whatnot", no @-handle for a Whatnot show.

The primary audience is Pokemon collectors. Mystery Hits Factory packs are ALSO stocked by Whatnot sellers / break-show hosts who source crack-ready inventory — but that's only one ad angle and only relevant when the theme explicitly calls for it (theme: "seller-supply"). For every other theme, write to collectors directly and do NOT mention Whatnot sellers or break shops.

Voice: hype but not corny. Knowledgeable about Pokemon TCG (sets, rarities, vintage vs. modern, chase cards). Fun. Like a real Pokemon pack maker who's also good at TikTok.
Audience: Pokemon collectors and TCG fans on TikTok / IG / FB — mix of returning hobbyists, modern openers, and vintage chasers.

CRITICAL IP RULES for the imagePrompt (used as a fallback when the post has no specific product image):
- NO Pokemon characters, creatures, silhouettes, or anything a viewer could mistake for a Pokemon (no electric mice, fire dragons, water turtles, fox/dog/cat creatures, "mascot" creatures, anime monsters).
- NO Pokemon logos, Pokeball iconography, Nintendo / Game Freak / Creatures branding.
- NO card layouts, booster-pack shapes, ETB-style boxes, holographic-foil patterns evocative of Pokemon holos.
- NO creature, animal, character, or "mascot" imagery of ANY kind. Not even abstracted.
- NO trading-card imagery at all.

ALLOWED imagePrompt aesthetic — pure abstract studio / brand backgrounds:
- Dramatic studio lighting on a solid color or gradient backdrop (deep gold, black, charcoal, deep red, midnight blue).
- Abstract geometric patterns, light rays, lens flares, soft volumetric fog, atmospheric glow.
- Metallic / brushed-gold textures.
- Typography-friendly composition with strong negative space in the center for text overlays.
- Always specify 9:16 vertical portrait composition.

Output ONLY valid JSON, no prose, no code fence:
{
  "hook": "3-6 word ALL-CAPS on-screen hook (super punchy, no period)",
  "body": "1 sentence (12-25 words) — the actual point",
  "cta": "3-6 word ALL-CAPS call-to-action",
  "imagePrompt": "Background prompt following the IP rules above.",
  "caption": "1-2 sentence social caption. No hashtags, no @-handles — those are added per platform."
}

When site context is provided, use the SPECIFIC product/drop name in the hook and body. Use real prices, real tier names, real urgency signals. Don't invent details.`;

function buildSiteContextLines(
  siteContext: SiteContext | null,
  anchorProduct: SiteProduct | null
): string {
  if (!siteContext) return "";
  const lines: string[] = [];
  if (anchorProduct) {
    lines.push(`Anchor product (use this in the post):`);
    lines.push(`- Name: ${anchorProduct.name}`);
    if (anchorProduct.tier) lines.push(`- Tier: ${anchorProduct.tier}`);
    if (anchorProduct.price) lines.push(`- Price: ${anchorProduct.price}`);
    if (anchorProduct.endsAt) lines.push(`- Ends: ${anchorProduct.endsAt}`);
    if (anchorProduct.blurb) lines.push(`- Blurb: ${anchorProduct.blurb}`);
    if (anchorProduct.url) lines.push(`- URL: ${anchorProduct.url}`);
  }
  if (siteContext.recentInventory.length > 0) {
    lines.push(``, `Other inventory you can mention if relevant:`);
    for (const p of siteContext.recentInventory.slice(0, 5)) {
      lines.push(`- ${p.name}${p.price ? ` (${p.price})` : ""}`);
    }
  }
  return lines.join("\n");
}

export async function planContent(
  theme: ContentTheme,
  siteContext: SiteContext | null = null,
  anchorProduct: SiteProduct | null = null
): Promise<ContentPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const ctxLines = buildSiteContextLines(siteContext, anchorProduct);
  const userPrompt =
    `Theme: ${theme}\n${THEME_DESCRIPTIONS[theme]}\n\n` +
    (ctxLines ? `Site context:\n${ctxLines}\n\n` : "") +
    `Generate one post.`;

  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Could not find JSON in Claude response:\n${text}`);
  const parsed = JSON.parse(jsonMatch[0]) as Omit<ContentPlan, "theme" | "url">;
  return { theme, ...parsed, url: anchorProduct?.url };
}

/**
 * Build the rotation pool for a given day, mixing site-driven themes (only when
 * the site actually has backing data) with evergreen fallbacks. Each viable
 * theme appears once — no consecutive duplicates — so consecutive days cycle
 * through different content angles.
 */
function buildThemeRotation(siteContext: SiteContext | null): ContentTheme[] {
  const rotation: ContentTheme[] = [];
  if (siteContext?.activeDrops.length) rotation.push("live-drop-urgency");
  if (siteContext?.themedPacks.length || siteContext?.recentInventory.length) {
    rotation.push("new-arrival");
  }
  if (siteContext?.hasGiveaway) rotation.push("giveaway-hype");
  if (siteContext?.showcaseHits.length) rotation.push("hit-spotlight");
  // Always-viable themes
  rotation.push("tier-spotlight");
  rotation.push("seller-supply");
  rotation.push("hobby-tip");
  rotation.push("value-add");
  rotation.push("intro");
  return rotation;
}

/**
 * Pick today's theme. Rotates through every viable angle so consecutive days
 * never get the same theme even when the site state is stable.
 */
export function pickThemeForDay(
  siteContext: SiteContext | null,
  date: Date = new Date()
): ContentTheme {
  const rotation = buildThemeRotation(siteContext);
  const dayIndex = Math.floor(date.getTime() / 86400000);
  const i = ((dayIndex % rotation.length) + rotation.length) % rotation.length;
  return rotation[i];
}

/**
 * Pick the anchor product for today's chosen theme. Themes that aren't
 * product-specific (tier-spotlight, evergreen) return null. For product
 * themes, rotates within the available list by day so a day-2 post doesn't
 * land on the same drop as day-1.
 */
export function pickAnchorForTheme(
  theme: ContentTheme,
  siteContext: SiteContext | null,
  date: Date = new Date()
): SiteProduct | null {
  if (!siteContext) return null;
  const dayIndex = Math.floor(date.getTime() / 86400000);

  let sources: SiteProduct[][];
  switch (theme) {
    case "live-drop-urgency":
      sources = [siteContext.activeDrops];
      break;
    case "new-arrival":
      sources = [siteContext.themedPacks, siteContext.recentInventory];
      break;
    case "hit-spotlight":
      sources = [siteContext.showcaseHits];
      break;
    default:
      // tier-spotlight, giveaway-hype, seller-supply, hobby-tip, value-add, intro
      // — these aren't anchored on a specific product
      return null;
  }

  for (const source of sources) {
    if (source.length > 0) {
      return source[((dayIndex % source.length) + source.length) % source.length];
    }
  }
  return null;
}
