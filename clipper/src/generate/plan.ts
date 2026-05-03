import Anthropic from "@anthropic-ai/sdk";
import type { SiteContext, SiteProduct } from "../site/scrape.ts";

export type ContentTheme =
  | "live-drop-urgency"
  | "tier-spotlight"
  | "new-arrival"
  | "giveaway-hype"
  | "live-promo"
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
  "live-promo":
    "Hype/promo for the Whatnot live show — drive viewers to come watch a Pokemon break tonight, reference scarcity/excitement of cracking sealed product live and pulling chase cards in real time.",
  "hobby-tip":
    "An educational or insightful tip about the Pokemon TCG hobby (grading, storage, set knowledge, vintage vs. modern, pack/box value, what makes a card a chase, common mistakes new collectors make).",
  intro:
    "Brand intro — who Mystery Hits Factory is, what we do (live Pokemon breaks, mystery packs across six tiers, sealed singles, themed bundles), why it's fun.",
  "value-add":
    "Genuine Pokemon-hobby value: a fact, a take, a perspective on the TCG that makes the hobby more interesting to a casual viewer (e.g., why WOTC era is special, what alt arts are, why sealed product holds value, etc.).",
};

const SYSTEM_PROMPT = `You write short, scroll-stopping social posts for "Mystery Hits Factory" — a Whatnot Pokemon TCG reseller and a website (mysteryhitsfactory.com) that sells:
- Six-tier mystery packs: Standard ($9.99), Premium, Deluxe, Graded, Elite, Vault ($249, guaranteed minimum value)
- Time-limited Live Drops (e.g. Vault Drop #14, Mew Drop #2)
- Sealed singles in named sets (Crown Zenith, Silver Tempest, Stellar Crown, etc.)
- Themed packs and bundles (Mew Pack, Triple Hit Bundle)
- A SpinFREE / giveaway feature
- Daily Whatnot live breaks

Voice: hype but not corny. Knowledgeable about Pokemon TCG (sets, rarities, vintage vs. modern, chase cards). Fun. Like a real Pokemon dealer who's also good at TikTok.
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
 * Pick today's theme. If site context offers a hook (active drop, themed pack,
 * giveaway, fresh inventory) we lean into it; otherwise we cycle through
 * generic themes by day-of-year.
 */
export function pickThemeForDay(
  siteContext: SiteContext | null,
  date: Date = new Date()
): ContentTheme {
  const dayIndex = Math.floor(date.getTime() / 86400000);

  // Site-driven themes win when available — they're more specific and convert better.
  if (siteContext) {
    if (siteContext.activeDrops.length > 0) return "live-drop-urgency";
    // Rotate the secondary site themes so we don't post the same thing every day
    const siteRotation: ContentTheme[] = [];
    if (siteContext.themedPacks.length > 0) siteRotation.push("new-arrival");
    if (siteContext.recentInventory.length > 0) siteRotation.push("new-arrival");
    if (siteContext.hasGiveaway) siteRotation.push("giveaway-hype");
    siteRotation.push("tier-spotlight");
    if (siteRotation.length > 0) {
      const i = ((dayIndex % siteRotation.length) + siteRotation.length) % siteRotation.length;
      return siteRotation[i];
    }
  }

  // No site signal — fall back to evergreen rotation.
  const rotation: ContentTheme[] = [
    "live-promo",
    "hobby-tip",
    "live-promo",
    "value-add",
    "live-promo",
    "hobby-tip",
    "intro",
  ];
  const i = ((dayIndex % rotation.length) + rotation.length) % rotation.length;
  return rotation[i];
}
