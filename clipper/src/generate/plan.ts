import Anthropic from "@anthropic-ai/sdk";
import type { SiteContext, SiteProduct } from "../site/scrape.ts";
import type { ResearchNugget, ResearchFocus } from "./research.ts";

export type ContentTheme =
  | "live-drop-urgency"
  | "tier-spotlight"
  | "new-arrival"
  | "giveaway-hype"
  | "seller-supply"
  | "hobby-tip"
  | "intro"
  | "value-add"
  | "market-watch"
  | "set-buzz"
  | "fun-fact"
  | "poll-debate"
  | "nostalgia"
  | "quiz";

/** Themes that need a fresh web-research nugget before planning. */
export const RESEARCH_THEMES: ContentTheme[] = ["market-watch", "set-buzz", "fun-fact"];

export function isResearchTheme(theme: ContentTheme): boolean {
  return RESEARCH_THEMES.includes(theme);
}

/** What angle the web-research pass should chase for a given research theme. */
export function researchFocusForTheme(theme: ContentTheme): ResearchFocus {
  return theme === "fun-fact" ? "fun-fact" : "market";
}

export type ContentPlan = {
  theme: ContentTheme;
  hook: string;
  body: string;
  cta: string;
  imagePrompt: string;
  caption: string;
  /** Specific URL to drop into the caption when the post is anchored on a product. */
  url?: string;
  /** For this-or-that poll posts (poll-debate): the two choices. Empty otherwise. */
  optionA?: string;
  optionB?: string;
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
  "hobby-tip":
    "An educational or insightful tip about the Pokemon TCG hobby (grading, storage, set knowledge, vintage vs. modern, pack/box value, what makes a card a chase, common mistakes new collectors make).",
  intro:
    "Brand intro — who Mystery Hits Factory is, what we do (mystery Pokemon packs across six tiers, sealed singles, themed bundles, drops on mysteryhitsfactory.com), why it's fun.",
  "value-add":
    "Genuine Pokemon-hobby value: a fact, a take, a perspective on the TCG that makes the hobby more interesting to a casual viewer (e.g., why WOTC era is special, what alt arts are, why sealed product holds value, etc.).",
  "market-watch":
    "Research-driven market beat: lead with a SPECIFIC, current price move or value trend from the provided research nugget (real card/set names, real numbers). Frame it as proof that the chase is live and worth riding — and a mystery pack is the fun, affordable way to chase that upside. Engagement-bait: invite viewers to react ('would you pull this?', 'who's holding this set?').",
  "set-buzz":
    "Research-driven hype on a specific current/just-dropped set or chase card from the provided research nugget. What's hot right now and why collectors care. Tie it to grabbing a mystery pack to chase that exact set's hits. Ask a question that drives comments.",
  "fun-fact":
    "A genuinely surprising, shareable Pokemon TCG fact from the provided research nugget (real and verifiable — misprints, rarity oddities, record sales, WOTC-era lore, printing quirks, the most valuable cards). Pure scroll-stopper: lead with the wild fact, make people want to tag a friend. Tie it back lightly to the fun of the hobby / opening packs. Keep the CTA soft and product-forward but secondary to the fact.",
  "poll-debate":
    "Engagement bait: a fun this-or-that that Pokemon fans will argue about in the comments (e.g. 'Charizard or Blastoise?', 'Vintage or modern?', 'WOTC or modern alt arts?'). The hook IS the question (short, ALL-CAPS). Fill optionA and optionB with the two competing choices (1-3 words each, e.g. 'CHARIZARD' / 'BLASTOISE'). The cta is an engagement prompt like 'COMMENT YOUR PICK' or 'DROP YOUR ANSWER' — NOT a product CTA. Keep the body to one short line of context or leave it light.",
  nostalgia:
    "Relatable throwback that hits the feels — ripping packs as a kid, chasing the holo Charizard, the smell of a fresh booster, trading at lunch. Make returning collectors feel seen and nudge them that the thrill is one pack away. Warm, not salesy; soft pack CTA.",
  quiz:
    "Interactive challenge that makes viewers comment their answer: 'Can you name this set from one card?', 'Guess the chase card', 'How many of these can you name?'. Frame it as a fun test of Pokemon knowledge. The hook is the challenge; soft pack CTA at the end.",
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

CTA + caption rules — these posts exist to drive sales, so make the ask product-forward:
- The cta is ALWAYS a concrete action toward the product/site: "GRAB A PACK", "SHOP THE DROP", "OPEN ONE TODAY", "CLAIM YOURS", "PULL ONE NOW". Never a soft/branding cta like "FOLLOW US" or "STAY TUNED".
- When an anchor product is provided, the caption must reference THAT product by name and push the viewer to shop it (the specific product URL is appended automatically — write the caption so the link is the obvious next step, e.g. "Grab the Vault Drop before it's gone 👇").
- When there's no anchor product, still close on a clear shop-the-packs CTA pointing to mysteryhitsfactory.com.
- Keep it natural, not spammy — one strong CTA, not three.
- EXCEPTION — poll-debate posts: the cta is an engagement prompt ("COMMENT YOUR PICK", "DROP YOUR ANSWER"), not a product CTA. Drive the comment, not the sale.

Output ONLY valid JSON, no prose, no code fence:
{
  "hook": "3-6 word ALL-CAPS on-screen hook (super punchy, no period)",
  "body": "1 sentence (12-25 words) — the actual point",
  "cta": "3-6 word ALL-CAPS call-to-action (product-forward per CTA rules; engagement prompt for poll-debate)",
  "imagePrompt": "Background prompt following the IP rules above.",
  "caption": "1-2 sentence social caption that lands on a product CTA. No hashtags, no @-handles, no raw URL — those are added per platform.",
  "optionA": "poll-debate ONLY: first choice, 1-3 words ALL-CAPS. Empty string for every other theme.",
  "optionB": "poll-debate ONLY: second choice, 1-3 words ALL-CAPS. Empty string for every other theme."
}

When site context is provided, use the SPECIFIC product/drop name in the hook and body. Use real prices, real tier names, real urgency signals. Don't invent details.

When a research nugget is provided, the hook and body MUST be built on its real, current facts (the specific card/set names and numbers it contains) — that's what makes the post credible and exciting. Then bridge to the brand: opening a mystery pack is how you chase exactly that kind of hit. Do not contradict or exaggerate the nugget.`;

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
  anchorProduct: SiteProduct | null = null,
  research: ResearchNugget | null = null
): Promise<ContentPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  const ctxLines = buildSiteContextLines(siteContext, anchorProduct);
  const researchLines = research
    ? [
        `Research nugget (build the post on these REAL, current facts):`,
        `- Headline: ${research.headline}`,
        `- Detail: ${research.detail}`,
        `- Brand angle: ${research.angle}`,
      ].join("\n")
    : "";
  const userPrompt =
    `Theme: ${theme}\n${THEME_DESCRIPTIONS[theme]}\n\n` +
    (researchLines ? `${researchLines}\n\n` : "") +
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
  // Product-anchored themes — each of these pulls a real product (and its
  // image) into the post. These should dominate the feed.
  const product: ContentTheme[] = [];
  if (siteContext?.activeDrops.length) product.push("live-drop-urgency");
  if (
    siteContext?.themedPacks.length ||
    siteContext?.recentInventory.length ||
    siteContext?.featuredProducts.length
  ) {
    product.push("new-arrival");
  }
  // tier-spotlight now anchors on a real tier pack (see pickAnchorForTheme),
  // so it counts as product content.
  product.push("tier-spotlight");

  // Engagement angles — built to drive comments, shares, and tags. Some are
  // grounded in fresh web research (market-watch, set-buzz, fun-fact); the rest
  // are interactive formats (polls, nostalgia, quizzes). These keep the feed
  // varied and stop it reading as one long ad. Two land per cycle.
  const engagement: ContentTheme[] = [
    "fun-fact",
    "poll-debate",
    "market-watch",
    "nostalgia",
    "set-buzz",
    "quiz",
  ];

  // Evergreen, non-product angles — kept as a minority so the feed stays
  // product-led instead of drifting into generic hobby content.
  const evergreen: ContentTheme[] = [];
  if (siteContext?.hasGiveaway) evergreen.push("giveaway-hype");
  evergreen.push("seller-supply");
  evergreen.push("hobby-tip");
  evergreen.push("value-add");
  evergreen.push("intro");

  // If the site gave us nothing, fall back to engagement + evergreen so we
  // still ship — these themes don't need site data.
  if (product.length === 0) return [...engagement, ...evergreen];

  // Product-led but lively: each cycle runs the product themes, then TWO
  // engagement angles (so the feed always has fresh comment-bait), then a single
  // evergreen palate cleanser. Rotate the product order each cycle so the same
  // theme never lands two days running at a cycle boundary.
  const rotation: ContentTheme[] = [];
  const cycles = Math.max(engagement.length, evergreen.length);
  let e = 0;
  for (let c = 0; c < cycles; c++) {
    const offset = c % product.length;
    rotation.push(...product.slice(offset), ...product.slice(0, offset));
    rotation.push(engagement[e % engagement.length]);
    rotation.push(engagement[(e + 1) % engagement.length]);
    e += 2;
    rotation.push(evergreen[c % evergreen.length]);
  }
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
      sources = [siteContext.activeDrops, siteContext.featuredProducts];
      break;
    case "new-arrival":
      sources = [
        siteContext.themedPacks,
        siteContext.recentInventory,
        siteContext.featuredProducts,
      ];
      break;
    case "tier-spotlight":
    case "market-watch":
    case "set-buzz":
      // tier-spotlight and the market research themes still drive viewers to buy
      // a pack — anchor on a real product so the post carries an actual product
      // image and a shoppable URL instead of an abstract background.
      sources = [
        siteContext.featuredProducts,
        siteContext.themedPacks,
        siteContext.recentInventory,
        siteContext.activeDrops,
      ];
      break;
    default:
      // giveaway-hype, seller-supply, hobby-tip, value-add, intro, and the
      // interactive engagement themes (fun-fact, poll-debate, nostalgia, quiz)
      // aren't tied to a specific product — they fall back to any site product
      // image, then stock/AI, for visual variety.
      return null;
  }

  for (const source of sources) {
    if (source.length > 0) {
      return source[((dayIndex % source.length) + source.length) % source.length];
    }
  }
  return null;
}
