import dotenv from "dotenv";
dotenv.config({ override: true });

import { scrapeSite, pickAnchorProduct } from "./site/scrape.ts";

/**
 * Dry-run debug for the scraper. Hits mysteryhitsfactory.com, prints what
 * Claude pulled out, shows which product the planner would anchor on.
 *
 * Use this to iterate on the scraper prompt without paying for the full
 * Remotion render + image-gen pipeline.
 */
async function main() {
  const ctx = await scrapeSite();
  console.log("\n=== siteContext ===\n");
  console.log(JSON.stringify(ctx, null, 2));

  const anchor = pickAnchorProduct(ctx);
  console.log("\n=== anchor product (what the daily post will be about) ===\n");
  console.log(anchor ? JSON.stringify(anchor, null, 2) : "(none — would fall back to evergreen content)");
}

main().catch((err) => {
  console.error("[scrape-debug] failed:", err);
  process.exit(1);
});
