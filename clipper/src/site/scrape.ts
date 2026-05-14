import Anthropic from "@anthropic-ai/sdk";

const SITE_URL = "https://mysteryhitsfactory.com";
const HTML_BUDGET_BYTES = 120_000;

export type SiteProduct = {
  name: string;
  url: string;
  imageUrl?: string;
  price?: string;
  tier?: string;
  /** Free-text time signal — "ends tonight", "2 hours left", or ISO timestamp if site exposes one. */
  endsAt?: string;
  /** Short blurb if the site has one — e.g. "guaranteed $300+ value". */
  blurb?: string;
};

export type SiteContext = {
  activeDrops: SiteProduct[];      // time-limited live drops
  featuredProducts: SiteProduct[]; // anything featured on the homepage
  recentInventory: SiteProduct[];  // sealed singles in stock (named sets)
  themedPacks: SiteProduct[];      // themed bundles (Mew Pack, etc.)
  /** Real chase pulls customers have hit out of MHF packs — used as social proof. */
  showcaseHits: SiteProduct[];
  hasGiveaway: boolean;
  fetchedAt: string;
};

/**
 * Known showcase hits we always want available to the content planner, even if
 * the live scrape misses the randomizer / hits section. Order matters — the
 * first entry is treated as the headline hit on cold days.
 */
const KNOWN_SHOWCASE_HITS: SiteProduct[] = [
  {
    name: "Charizard ex Ultra Rare PSA 10",
    url: "https://mysteryhitsfactory.com",
    price: "$230",
    blurb: "Top hit pulled from a Mystery Hits Factory pack — graded PSA 10, valued at $230.",
  },
];

const SCRAPER_SYSTEM_PROMPT = `Extract product data from this Mystery Hits Factory homepage HTML. Mystery Hits Factory is a Pokemon TCG brand selling mystery packs, sealed singles, and themed bundles.

Return ONLY a JSON object, no prose, no code fence:
{
  "activeDrops": [
    {"name": "Vault Drop #14", "url": "https://mysteryhitsfactory.com/...", "imageUrl": "https://...", "price": "$249", "tier": "Vault", "endsAt": "ends tonight", "blurb": "guaranteed $300+ value"}
  ],
  "featuredProducts": [...same shape...],
  "recentInventory": [...sealed booster packs / singles, named sets like Crown Zenith, Silver Tempest, Stellar Crown...],
  "themedPacks": [...themed bundles like Mew Pack, Triple Hit Bundle...],
  "showcaseHits": [
    {"name": "Charizard ex Ultra Rare PSA 10", "url": "https://mysteryhitsfactory.com", "imageUrl": "https://...", "price": "$230", "blurb": "top pull from a mystery pack"}
  ],
  "hasGiveaway": true | false
}

Rules:
- Convert ALL relative URLs to absolute (prepend https://mysteryhitsfactory.com).
- Skip nav links, footer, social-media links, legal pages.
- Only return entries that look like real products / drops with at least a name and a URL.
- If you can't determine a field, omit it entirely (don't return null/empty strings).
- Distinguish:
    "activeDrops" = time-limited drops with countdown/end-time signals.
    "featuredProducts" = highlighted items without a deadline.
    "recentInventory" = sealed singles with set names.
    "themedPacks" = bundles named after a theme.
    "showcaseHits" = real chase cards customers have pulled out of MHF packs — usually shown in a "Recent Hits", "Top Hits", or randomizer section on the homepage. These are graded slabs / chase pulls used as social proof, NOT products for sale. Capture the card name, price/value, and image URL when present.
- Cap each list at 6 items max.`;

export async function scrapeSite(): Promise<SiteContext> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  console.log(`[site] fetching ${SITE_URL}...`);
  const resp = await fetch(SITE_URL, {
    headers: { "User-Agent": "MysteryHitsFactoryDailyAgent/1.0" },
  });
  if (!resp.ok) {
    throw new Error(`Site fetch failed: ${resp.status} ${resp.statusText}`);
  }
  const html = await resp.text();
  const trimmed = html.length > HTML_BUDGET_BYTES ? html.slice(0, HTML_BUDGET_BYTES) : html;
  console.log(`[site] got ${html.length} bytes (using ${trimmed.length})`);

  const client = new Anthropic({ apiKey });
  const result = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SCRAPER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: `HTML:\n${trimmed}` }],
  });

  const text = result.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON in scraper response:\n${text.slice(0, 500)}`);
  }
  const data = JSON.parse(match[0]) as Omit<SiteContext, "fetchedAt">;

  const ctx: SiteContext = {
    activeDrops: data.activeDrops ?? [],
    featuredProducts: data.featuredProducts ?? [],
    recentInventory: data.recentInventory ?? [],
    themedPacks: data.themedPacks ?? [],
    showcaseHits: mergeShowcaseHits(data.showcaseHits ?? []),
    hasGiveaway: data.hasGiveaway ?? false,
    fetchedAt: new Date().toISOString(),
  };
  console.log(
    `[site] parsed: ${ctx.activeDrops.length} drops, ${ctx.featuredProducts.length} featured, ${ctx.recentInventory.length} inventory, ${ctx.themedPacks.length} themed, ${ctx.showcaseHits.length} hits, giveaway=${ctx.hasGiveaway}`
  );
  return ctx;
}

/**
 * Ensure every known showcase hit is present in context, even when the scraper
 * misses the randomizer/hits section. Scraped entries win on name collision so
 * a fresher imageUrl/price from the live site overrides the hardcoded fallback.
 */
function mergeShowcaseHits(scraped: SiteProduct[]): SiteProduct[] {
  const byName = new Map<string, SiteProduct>();
  for (const hit of KNOWN_SHOWCASE_HITS) byName.set(hit.name.toLowerCase(), hit);
  for (const hit of scraped) byName.set(hit.name.toLowerCase(), hit);
  return Array.from(byName.values());
}

/** Try the scrape but never throw — daily generator must continue if site is down. */
export async function scrapeSiteSafely(): Promise<SiteContext | null> {
  try {
    return await scrapeSite();
  } catch (err) {
    console.warn(`[site] scrape failed, falling back to no-context mode: ${(err as Error).message}`);
    // Still surface known showcase hits so content planning has something to work with.
    return {
      activeDrops: [],
      featuredProducts: [],
      recentInventory: [],
      themedPacks: [],
      showcaseHits: [...KNOWN_SHOWCASE_HITS],
      hasGiveaway: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

