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

CRITICAL IP RULES for the imagePrompt:
- NO actual Pokemon characters, names, or silhouettes (no Pikachu, Charizard, Eevee, etc. — even vague references). NO Pokemon logos. NO official-looking Pokemon TCG card layouts. NO Nintendo/Game Freak/Creatures branding.
- Use ABSTRACT trading-card-collector aesthetics only:
  * Stacks of unbranded cards (no faces, no names — just card backs or generic holo patterns)
  * Holographic / rainbow foil textures and gradients
  * Sealed booster pack shapes (NO Pokemon branding — generic mystery-pack vibe, plain colored foil wrappers)
  * Closed boxes with question marks or generic "MYSTERY" / "HITS" type wording
  * Golden card-shaped objects, glowing edges, dramatic studio lighting
  * Color palette can lean red/yellow/blue (collector vibe) but no Pokeball iconography
- Always specify 9:16 vertical portrait composition with dramatic lighting.

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
