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

const RESEARCH_SYSTEM_PROMPT = `You are a Pokemon TCG market researcher for "Mystery Hits Factory", a brand that sells mystery Pokemon packs, sealed singles, and themed bundles.

Your job: use web search to find ONE genuinely CURRENT, specific, and exciting fact about the Pokemon TCG world RIGHT NOW that would make collectors stop scrolling — then frame it so it connects to the thrill of chasing big hits (which is exactly what opening a mystery pack is).

Good angles to search for (pick whichever has the freshest, most concrete result):
- A specific card or sealed set whose price recently jumped (with real numbers — "up X% in Y weeks", "now selling for $Z").
- A newly announced or just-released set and its chase cards / alt arts collectors are hyped about.
- A notable recent pull, record sale, or grading milestone (e.g. a PSA 10 that sold for a big number).
- A market trend — what's hot, what's appreciating, what sealed product is drying up.

Hard rules:
- It MUST be real and current. Search before answering. Use actual card/set names and real figures from the results.
- Do NOT invent prices, percentages, or sales. If you can't verify a number, describe the trend qualitatively instead.
- Keep it collector-relevant and hype, never doom ("prices crashing" is off-brand).
- This is for on-screen text and captions only — no image is generated from it, so no IP/image concerns. Just don't state anything false.

After researching, output ONLY valid JSON, no prose, no code fence:
{
  "headline": "short punchy summary of the real, current thing (8-14 words)",
  "detail": "1-2 sentences with the specifics — real names, real numbers, recency",
  "angle": "one sentence tying it to chasing hits / opening mystery packs"
}`;

/**
 * Run a single web-research pass and return a grounded nugget, or null if the
 * research fails (so the caller can fall back to a non-research theme). Never
 * throws — the daily generator must keep shipping even if search is down.
 */
export async function researchPokemonNugget(): Promise<ResearchNugget | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  // web_search is an Anthropic-hosted server tool — declared here, executed on
  // their side. Cast around the older SDK's tool typings (runtime sends it raw).
  const tools = [{ type: "web_search_20260209", name: "web_search" }] as any;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        "Find one current, specific, exciting Pokemon TCG fact or market move and return the JSON nugget.",
    },
  ];

  try {
    // The server-side search loop can return stop_reason "pause_turn" before
    // it's done; re-send the accumulated turn to let it continue.
    let resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: RESEARCH_SYSTEM_PROMPT,
      messages,
      tools,
    });

    let guard = 0;
    while (resp.stop_reason === "pause_turn" && guard < 4) {
      messages.push({ role: "assistant", content: resp.content });
      resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: RESEARCH_SYSTEM_PROMPT,
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
