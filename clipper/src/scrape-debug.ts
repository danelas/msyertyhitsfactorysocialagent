import dotenv from "dotenv";
dotenv.config({ override: true });

import { scrapeSite } from "./site/scrape.ts";
import { pickThemeForDay, pickAnchorForTheme } from "./generate/plan.ts";

/**
 * Dry-run debug for the scraper + planner picks. Hits mysteryhitsfactory.com,
 * prints what Claude pulled out, shows which theme + anchor product TODAY's
 * post would land on. Useful for previewing without paying for the full
 * Remotion render + image-gen pipeline.
 */
async function main() {
  const ctx = await scrapeSite();
  console.log("\n=== siteContext ===\n");
  console.log(JSON.stringify(ctx, null, 2));

  const theme = pickThemeForDay(ctx);
  const anchor = pickAnchorForTheme(theme, ctx);
  console.log(`\n=== today's plan ===`);
  console.log(`theme:  ${theme}`);
  console.log(`anchor: ${anchor ? JSON.stringify(anchor, null, 2) : "(none — generic copy)"}`);
}

main().catch((err) => {
  console.error("[scrape-debug] failed:", err);
  process.exit(1);
});
