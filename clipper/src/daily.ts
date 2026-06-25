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

  const failed: string[] = [];
  for (const platform of PLATFORMS) {
    console.log(`[daily] posting to ${platform}`);
    const caption = captionFor(platform, plan.caption, plan.url);
    try {
      const result = await postVideo({
        caption,
        title: `${plan.hook} — Mystery Hits Factory`,
        mediaPath: videoPath,
        platforms: [platform],
      });
      // Upload-Post returns HTTP 200 even when a platform didn't actually post
      // (not connected, expired token, media rejected) — inspect the body.
      const outcome = inspectResult(platform, result);
      if (outcome.ok) {
        console.log(`[daily]   ✓ ${platform} posted:`, outcome.detail);
      } else {
        failed.push(platform);
        console.error(`[daily]   ✗ ${platform} did NOT post — ${outcome.detail}`);
        console.error(`[daily]     full response:`, safeJson(result));
      }
    } catch (err) {
      failed.push(platform);
      console.error(`[daily]   ✗ ${platform} errored — ${(err as Error).message}`);
    }
  }

  if (failed.length) {
    console.error(
      `[daily] ${failed.length}/${PLATFORMS.length} platforms did not post: ${failed.join(", ")}. ` +
        `Check the Upload-Post profile "${process.env.UPLOAD_POST_USER}" has ${failed.join(" / ")} ` +
        `connected with a valid (non-expired) token — for Instagram, it must be a Business/Creator ` +
        `account linked to a Facebook Page.`
    );
    process.exit(1);
  }
  console.log("[daily] done — all platforms posted");
}

type PlatformOutcome = { ok: boolean; detail: string };

/**
 * Upload-Post replies 200 with a per-platform results map; a single platform
 * can still have failed. Treat any explicit failure signal we recognize as
 * not-posted. When the shape is unfamiliar we assume success (don't false-alarm).
 */
function inspectResult(platform: string, result: unknown): PlatformOutcome {
  if (result == null || typeof result !== "object") {
    return { ok: true, detail: String(result).slice(0, 160) };
  }
  const r = result as Record<string, any>;
  const node = r.results?.[platform] ?? r[platform] ?? null;
  const failed =
    r.success === false ||
    node?.success === false ||
    Boolean(node?.error) ||
    (Array.isArray(r.errors) && r.errors.length > 0);
  const detail = safeJson(node ?? r).slice(0, 300);
  return { ok: !failed, detail };
}

function safeJson(r: unknown): string {
  if (typeof r === "string") return r;
  try {
    return JSON.stringify(r);
  } catch {
    return "(unserializable)";
  }
}

main().catch((err) => {
  console.error("[daily] failed:", err);
  process.exit(1);
});
