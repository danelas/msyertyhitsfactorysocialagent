import Anthropic from "@anthropic-ai/sdk";
import type { Transcript } from "./transcribe.ts";
import type { AudioPeak } from "./audio-peaks.ts";

export type MomentType = "pack-pull" | "interaction" | "reaction" | "banter";

export type Moment = {
  startSeconds: number;
  endSeconds: number;
  type: MomentType;
  hookPhrase: string;
  caption: string;
  score: number;
};

const SYSTEM_PROMPT = `You are a short-form video editor for "Mystery Hits Factory" — a Whatnot reseller doing live Pokemon TCG breaks and pack/box openings (booster boxes, ETBs, tins, vintage WOTC, modern sets).

Your job: read a transcript of a Whatnot live stream and pick the BEST short moments to repost on TikTok / Instagram / Facebook to drive viewers back to the live show.

A great clip is:
- A pack/box pull where the host reacts to a hit — alt arts, full arts, secret rares, special illustration rares, rainbow rares, gold cards, anything chase, anything graded that just got cracked, vintage WOTC pulls
- Direct interaction with a viewer ("[name], that one is yours!", answering by name, banter, calling out a regular)
- A strong, in-the-moment emotional reaction — surprise, hype, disbelief, "no way", "let's go"
- A clean, complete thought (not mid-sentence, not mid-auctioneer-chant)

Pokemon-specific signal words that almost always indicate a hit:
- Specific Pokemon names called out with excitement (Charizard, Pikachu, Mewtwo, Lugia, Umbreon, etc.)
- Set/rarity terms ("alt art", "full art", "secret rare", "rainbow rare", "special illustration", "hyper rare", "gold", "1st edition", "shadowless", "WOTC")
- Grading mentions ("PSA 10", "BGS 9.5", "CGC", "slab", "gem mint")
- Pack-opening sounds ("oh my god", "no way", screams, gasps)

Avoid:
- Long auction chants ("five-five, six, six, going once...")
- Dead air or technical issues
- Mid-sentence cuts
- Repetitive sales calls
- Anything where the host is just describing inventory generically

Each clip should be 15-45 seconds. Snap start/end to natural sentence boundaries — give 1-3 seconds of lead-in before the punchline, and let the reaction breathe.

Pick NON-OVERLAPPING moments, ordered best first.

Return ONLY a JSON array, no prose, no code fence. Each item:
{
  "startSeconds": number,
  "endSeconds": number,
  "type": "pack-pull" | "interaction" | "reaction" | "banter",
  "hookPhrase": "3-6 word teaser shown on-screen as the opening hook (ALL CAPS, punchy)",
  "caption": "1-2 sentence social caption (no hashtags, no @handles — those are added later)",
  "score": number 1-10
}`;

export async function rankMoments(
  transcript: Transcript,
  peaks: AudioPeak[],
  topN: number,
  totalDurationSeconds: number
): Promise<Moment[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const peakBuckets = new Set(peaks.map((p) => Math.round(p.tSeconds)));
  const lines = transcript.segments.map((s) => {
    const hot =
      peakBuckets.has(Math.round(s.start)) ||
      peakBuckets.has(Math.round(s.end)) ||
      peakBuckets.has(Math.round((s.start + s.end) / 2))
        ? " [LOUD]"
        : "";
    return `${formatTime(s.start)}-${formatTime(s.end)}${hot}: ${s.text}`;
  });

  const userPrompt =
    `Total stream length: ${formatTime(totalDurationSeconds)}\n` +
    `[LOUD] = audio peak detected at that segment.\n\n` +
    `Pick the top ${topN} clips. Return JSON array only.\n\n` +
    `Transcript:\n${lines.join("\n")}`;

  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Could not find JSON array in Claude response:\n${text}`);
  }
  const parsed = JSON.parse(jsonMatch[0]) as Moment[];

  // Clamp ranges into the actual stream and enforce length bounds.
  const cleaned = parsed
    .map((m) => {
      const start = Math.max(0, Math.min(m.startSeconds, totalDurationSeconds - 5));
      const end = Math.max(start + 8, Math.min(m.endSeconds, totalDurationSeconds));
      const length = end - start;
      const trimmed =
        length > 45 ? { ...m, startSeconds: start, endSeconds: start + 45 } :
        length < 15 ? { ...m, startSeconds: start, endSeconds: Math.min(start + 15, totalDurationSeconds) } :
        { ...m, startSeconds: start, endSeconds: end };
      return trimmed;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return cleaned;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
