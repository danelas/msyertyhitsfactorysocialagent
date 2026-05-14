import dotenv from "dotenv";
dotenv.config({ override: true });

import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { generatePromoVideo } from "./generate/index.ts";
import { postVideo, type Platform } from "./post/uploadpost.ts";
import { captionFor } from "./config.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const PLATFORMS: Platform[] = ["tiktok", "instagram", "facebook"];

/** Optional `--theme=<name>` override forces a specific content theme instead
 *  of using the day-index rotation. Useful for verifying a new theme
 *  (e.g. hit-spotlight) without waiting for it to come up naturally. */
const FORCE_THEME = (() => {
  const arg = process.argv.find((a) => a.startsWith("--theme="));
  return arg ? arg.slice("--theme=".length) : undefined;
})();

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const suffix = FORCE_THEME ? `-${FORCE_THEME}` : "";
  const workDir = resolve(process.cwd(), "work", `daily-${today}${suffix}`);
  await mkdir(workDir, { recursive: true });

  console.log(`[daily] generating promo content for ${today}${FORCE_THEME ? ` (forced theme: ${FORCE_THEME})` : ""}`);
  const { videoPath, plan } = await generatePromoVideo(workDir, "#FFD700", FORCE_THEME);
  console.log(`[daily] video ready: ${videoPath}`);

  if (DRY_RUN) {
    console.log("[daily] dry-run — skipping post");
    return;
  }

  for (const platform of PLATFORMS) {
    console.log(`[daily] posting to ${platform}`);
    const caption = captionFor(platform, plan.caption, plan.url);
    const result = await postVideo({
      caption,
      title: `${plan.hook} — Mystery Hits Factory`,
      mediaPath: videoPath,
      platforms: [platform],
    });
    console.log(`[daily]   ok:`, summarize(result));
  }
  console.log("[daily] done");
}

function summarize(r: unknown): string {
  if (typeof r === "string") return r.slice(0, 120);
  try {
    return JSON.stringify(r).slice(0, 200);
  } catch {
    return "(unserializable)";
  }
}

main().catch((err) => {
  console.error("[daily] failed:", err);
  process.exit(1);
});
