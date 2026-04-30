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
    "Hype/promo for the Whatnot live show — drive viewers to come watch a break tonight, reference scarcity/excitement of live pulls.",
  "hobby-tip":
    "An educational or insightful tip about the trading-card hobby (grading, storage, value, what to look for, common mistakes new collectors make).",
  intro:
    "Brand intro — who Mystery Hits Factory is, what we do (live breaks, packs, mystery boxes, daily lives), why it's fun to be in the room.",
  "value-add":
    "Genuine hobby value: a fact, a take, a perspective that makes the trading-card hobby more interesting to a casual viewer.",
};

const SYSTEM_PROMPT = `You write short, scroll-stopping social posts for "Mystery Hits Factory" — a Whatnot reseller doing live sports/trading-card breaks and pack openings.

Voice: hype but not corny. Knowledgeable. Fun. Like a real card dealer who's also good at TikTok.
Audience: card collectors, hobbyists, casual sports fans on TikTok / IG / FB.

CRITICAL IP RULES for the imagePrompt:
- NO real player names, NO real team logos, NO real brand names (Topps, Panini, Upper Deck, etc.), NO real-looking athlete portraits.
- Generic trading-card aesthetic only — stacks of unbranded cards, abstract holographic foil patterns, golden card backs, mystery-box vibe, dramatic lighting, premium feel.
- Always specify a 9:16 vertical portrait composition.

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
