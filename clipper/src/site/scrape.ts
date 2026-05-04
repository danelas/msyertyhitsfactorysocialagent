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
  hasGiveaway: boolean;
  fetchedAt: string;
};

const SCRAPER_SYSTEM_PROMPT = `Extract product data from this Mystery Hits Factory homepage HTML. Mystery Hits Factory is a Pokemon TCG reseller selling mystery packs, sealed singles, and themed bundles.

Return ONLY a JSON object, no prose, no code fence:
{
  "activeDrops": [
    {"name": "Vault Drop #14", "url": "https://mysteryhitsfactory.com/...", "imageUrl": "https://...", "price": "$249", "tier": "Vault", "endsAt": "ends tonight", "blurb": "guaranteed $300+ value"}
  ],
  "featuredProducts": [...same shape...],
  "recentInventory": [...sealed booster packs / singles, named sets like Crown Zenith, Silver Tempest, Stellar Crown...],
  "themedPacks": [...themed bundles like Mew Pack, Triple Hit Bundle...],
  "hasGiveaway": true | false
}

Rules:
- Convert ALL relative URLs to absolute (prepend https://mysteryhitsfactory.com).
- Skip nav links, footer, social-media links, legal pages.
- Only return entries that look like real products / drops with at least a name and a URL.
- If you can't determine a field, omit it entirely (don't return null/empty strings).
- Distinguish: "activeDrops" = time-limited drops with countdown/end-time signals. "featuredProducts" = highlighted items without a deadline. "recentInventory" = sealed singles with set names. "themedPacks" = bundles named after a theme.
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
    hasGiveaway: data.hasGiveaway ?? false,
    fetchedAt: new Date().toISOString(),
  };
  console.log(
    `[site] parsed: ${ctx.activeDrops.length} drops, ${ctx.featuredProducts.length} featured, ${ctx.recentInventory.length} inventory, ${ctx.themedPacks.length} themed, giveaway=${ctx.hasGiveaway}`
  );
  return ctx;
}

/** Try the scrape but never throw — daily generator must continue if site is down. */
export async function scrapeSiteSafely(): Promise<SiteContext | null> {
  try {
    return await scrapeSite();
  } catch (err) {
    console.warn(`[site] scrape failed, falling back to no-context mode: ${(err as Error).message}`);
    return null;
  }
}

