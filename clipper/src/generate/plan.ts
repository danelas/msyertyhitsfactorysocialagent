import Anthropic from "@anthropic-ai/sdk";

export type ContentTheme = "live-promo" | "hobby-tip" | "intro" | "value-add";

export type ContentPlan = {
  theme: ContentTheme;
  hook: string;
  body: string;
  cta: string;
  imagePrompt: string;
  caption: string;
};

const THEME_DESCRIPTIONS: Record<ContentTheme, string> = {
  "live-promo":
    "Hype/promo for the Whatnot live show — drive viewers to come watch a Pokemon break tonight, reference scarcity/excitement of cracking sealed product live and pulling chase cards in real time.",
  "hobby-tip":
    "An educational or insightful tip about the Pokemon TCG hobby (grading, storage, set knowledge, vintage vs. modern, pack/box value, what makes a card a chase, common mistakes new collectors make).",
  intro:
    "Brand intro — who Mystery Hits Factory is, what we do (live Pokemon breaks, booster boxes, ETBs, mystery boxes, daily lives), why it's fun to be in the room when packs get ripped.",
  "value-add":
    "Genuine Pokemon-hobby value: a fact, a take, a perspective on the TCG that makes the hobby more interesting to a casual viewer (e.g., why WOTC era is special, what alt arts are, why sealed product holds value, etc.).",
};

const SYSTEM_PROMPT = `You write short, scroll-stopping social posts for "Mystery Hits Factory" — a Whatnot reseller doing live Pokemon TCG breaks and pack/box openings (booster boxes, ETBs, tins, vintage WOTC, modern sets).

Voice: hype but not corny. Knowledgeable about Pokemon TCG (sets, rarities, vintage vs. modern, chase cards). Fun. Like a real Pokemon dealer who's also good at TikTok.
Audience: Pokemon collectors and TCG fans on TikTok / IG / FB — mix of returning hobbyists, modern openers, and vintage chasers.

CRITICAL IP RULES for the imagePrompt — ZERO tolerance for anything that even *looks like* it could be Pokemon:
- NO Pokemon characters, creatures, silhouettes, or anything that a viewer could mistake for a Pokemon (no electric mice, no fire dragons, no water turtles, no fox/dog/cat-like creatures, no "mascot" creatures of any kind, no anime monsters).
- NO Pokemon logos, NO Pokeball iconography, NO Nintendo / Game Freak / Creatures branding.
- NO objects that read as "Pokemon TCG product" — no card layouts, no booster-pack shapes, no ETB-style boxes, no holographic-foil patterns evocative of Pokemon holos.
- NO creature, animal, character, or "mascot" imagery of ANY kind. Not even abstracted. Not even "inspired by." Zero.
- NO trading-card imagery at all (no card backs, no card stacks, no card-shaped objects).

ALLOWED aesthetic — pure abstract studio / brand backgrounds:
- Dramatic studio lighting on a solid color or gradient backdrop (deep gold, black, charcoal, deep red, midnight blue).
- Abstract geometric patterns, light rays, lens flares, soft volumetric fog, atmospheric glow.
- Metallic / brushed-gold textures (premium boutique feel) — but NOT iridescent rainbow foil.
- Clean minimalist scenes: a single light beam through fog, a warm spotlight on an empty stage, gradient sweep, smoke against deep color.
- Typography-friendly composition with strong negative space in the center for text overlays.

Tone: premium, theatrical, scroll-stopping — think high-end commercial / brand campaign aesthetic, NOT product photography. Always specify 9:16 vertical portrait composition.

Output ONLY valid JSON, no prose, no code fence:
{
  "hook": "3-6 word ALL-CAPS on-screen hook (super punchy, attention-grabbing — no period at end)",
  "body": "1 sentence (12-25 words) for the middle of the video — the actual point",
  "cta": "3-6 word ALL-CAPS call-to-action (e.g., JOIN US LIVE TONIGHT or WATCH THE NEXT BREAK)",
  "imagePrompt": "Image prompt following the IP rules above. Be specific about composition and lighting.",
  "caption": "1-2 sentence social caption. No hashtags, no @-handles — those are added per platform."
}`;

export async function planContent(theme: ContentTheme): Promise<ContentPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const userPrompt = `Theme: ${theme}
${THEME_DESCRIPTIONS[theme]}

Generate one post.`;

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
  const parsed = JSON.parse(jsonMatch[0]) as Omit<ContentPlan, "theme">;
  return { theme, ...parsed };
}

/**
 * Pick a theme deterministically for a given day so themes rotate evenly.
 * Live-promo shows up more often than other themes — that's the main driver
 * for getting people into the show.
 */
export function pickThemeForDay(date: Date = new Date()): ContentTheme {
  const rotation: ContentTheme[] = [
    "live-promo",
    "hobby-tip",
    "live-promo",
    "value-add",
    "live-promo",
    "hobby-tip",
    "intro",
  ];
  const dayIndex = Math.floor(date.getTime() / 86400000);
  const i = ((dayIndex % rotation.length) + rotation.length) % rotation.length;
  return rotation[i];
}
