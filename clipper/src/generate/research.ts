import Anthropic from "@anthropic-ai/sdk";

/**
 * A single, real, *current* Pokemon-TCG nugget surfaced by web research — a
 * price move, a set/news beat, a tournament chase card, a market trend. Used to
 * ground engagement-driven posts in something true and timely instead of
 * evergreen filler, then tied back to the thrill of cracking mystery packs.
 */
export type ResearchNugget = {
  /** Short, punchy summary of the real thing that's happening. */
  headline: string;
  /** 1-2 sentences with the specifics — card/set names, real numbers, dates. */
  detail: string;
  /** How it connects to chasing value / opening mystery packs (the brand hook). */
  angle: string;
};

/** What kind of real-world hook the research pass should chase. */
export type ResearchFocus = "market" | "fun-fact";

const BASE_PROMPT = `You are a Pokemon TCG content researcher for "Mystery Hits Factory", a brand that sells mystery Pokemon packs, sealed singles, and themed bundles. Use web search to ground your answer in something REAL and verifiable.`;

const FOCUS_PROMPT: Record<ResearchFocus, string> = {
  market: `Your job: find ONE genuinely CURRENT, specific, and exciting fact about the Pokemon TCG world RIGHT NOW that would make collectors stop scrolling — then frame it so it connects to the thrill of chasing big hits (which is exactly what opening a mystery pack is).

Good angles to search for (pick whichever has the freshest, most concrete result):
- A specific card or sealed set whose price recently jumped (with real numbers — "up X% in Y weeks", "now selling for $Z").
- A newly announced or just-released set and its chase cards / alt arts collectors are hyped about.
- A notable recent pull, record sale, or grading milestone (e.g. a PSA 10 that sold for a big number).
- A market trend — what's hot, what's appreciating, what sealed product is drying up.

It MUST be current. Use real figures from the results — do NOT invent prices, percentages, or sales. Keep it hype, never doom ("prices crashing" is off-brand).`,
  "fun-fact": `Your job: find ONE genuinely surprising, FUN, shareable Pokemon TCG fact that collectors would love and want to tag a friend over — then tie it lightly to the fun of the hobby / opening mystery packs.

Good angles to search for (pick whichever is most surprising and verifiable):
- Famous misprints or error cards (and what they're worth).
- The most valuable / record-sale cards and the wild prices they hit.
- Rarity oddities, ultra-short-print promos, or cards almost no one has.
- WOTC-era / first-edition history and lore most fans don't know.
- Printing quirks, secret rares, or weird set trivia.

It does NOT have to be breaking news, but it MUST be true — verify it with search and use real names/numbers. Make it a scroll-stopper, not a dry encyclopedia entry.`,
};

const OUTPUT_RULES = `Hard rules:
- It MUST be real. Search before answering and use actual card/set names and real figures from the results. If you can't verify a number, describe it qualitatively instead.
- This is for on-screen text and captions only — no image is generated from it, so no IP/image concerns. Just don't state anything false.

After researching, output ONLY valid JSON, no prose, no code fence:
{
  "headline": "short punchy summary of the real thing (8-14 words)",
  "detail": "1-2 sentences with the specifics — real names, real numbers",
  "angle": "one sentence tying it to the hobby / opening mystery packs"
}`;

function buildSystemPrompt(focus: ResearchFocus): string {
  return `${BASE_PROMPT}\n\n${FOCUS_PROMPT[focus]}\n\n${OUTPUT_RULES}`;
}

/**
 * Run a single web-research pass and return a grounded nugget, or null if the
 * research fails (so the caller can fall back to a non-research theme). Never
 * throws — the daily generator must keep shipping even if search is down.
 */
export async function researchPokemonNugget(
  focus: ResearchFocus = "market"
): Promise<ResearchNugget | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  // web_search is an Anthropic-hosted server tool — declared here, executed on
  // their side. Cast around the older SDK's tool typings (runtime sends it raw).
  const tools = [{ type: "web_search_20260209", name: "web_search" }] as any;

  const systemPrompt = buildSystemPrompt(focus);
  const userKickoff =
    focus === "fun-fact"
      ? "Find one surprising, verifiable, shareable Pokemon TCG fun fact and return the JSON nugget."
      : "Find one current, specific, exciting Pokemon TCG market move and return the JSON nugget.";
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userKickoff },
  ];

  try {
    // The server-side search loop can return stop_reason "pause_turn" before
    // it's done; re-send the accumulated turn to let it continue.
    let resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
      tools,
    });

    let guard = 0;
    // "pause_turn" (server-tool loop paused) isn't in this SDK version's
    // StopReason union, but the API does return it — compare as a string.
    while ((resp.stop_reason as string) === "pause_turn" && guard < 4) {
      messages.push({ role: "assistant", content: resp.content });
      resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools,
      });
      guard++;
    }

    const text = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[research] no JSON in response: ${text.slice(0, 200)}`);
      return null;
    }
    const nugget = JSON.parse(match[0]) as ResearchNugget;
    if (!nugget.headline || !nugget.detail) {
      console.warn(`[research] incomplete nugget, skipping`);
      return null;
    }
    console.log(`[research] nugget: ${nugget.headline}`);
    return nugget;
  } catch (err) {
    console.warn(`[research] failed: ${(err as Error).message}`);
    return null;
  }
}
