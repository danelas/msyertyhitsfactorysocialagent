import dotenv from "dotenv";
dotenv.config({ override: true });

import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { generatePromoVideo } from "./generate/index.ts";
import { postVideo, type Platform } from "./post/uploadpost.ts";
import { captionFor } from "./config.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const PLATFORMS: Platform[] = ["tiktok", "instagram", "facebook"];

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const workDir = resolve(process.cwd(), "work", `daily-${today}`);
  await mkdir(workDir, { recursive: true });

  console.log(`[daily] generating promo content for ${today}`);
  const { videoPath, plan } = await generatePromoVideo(workDir);
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
