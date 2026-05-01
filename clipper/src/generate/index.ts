import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pickThemeForDay, planContent, type ContentPlan } from "./plan.ts";
import { generateImage } from "./image.ts";
import { pickAndStageStockPhoto } from "./stock.ts";

const REMOTION_DIR = resolve(process.cwd(), "../remotion");
const REMOTION_PUBLIC = resolve(REMOTION_DIR, "public");

export type GenerateResult = {
  videoPath: string;
  /** Where the chosen background lives — either user stock or generated */
  imageSource: "stock" | "ai";
  imageStagedName: string;
  plan: ContentPlan;
};

/**
 * Plan a fresh promo post, pick a background (preferring user-uploaded stock
 * photos in stock/, falling back to AI generation), then render a captioned
 * 9:16 video. Used by the daily cron when no fresh stream is available.
 */
export async function generatePromoVideo(
  workDir: string,
  brandColor: string = "#FFD700"
): Promise<GenerateResult> {
  if (!existsSync(REMOTION_DIR)) {
    throw new Error(`Remotion dir not found at ${REMOTION_DIR}`);
  }
  await mkdir(workDir, { recursive: true });
  await mkdir(REMOTION_PUBLIC, { recursive: true });

  const theme = pickThemeForDay();
  console.log(`[generate] theme: ${theme}`);
  const plan = await planContent(theme);
  console.log(`[generate] hook: ${plan.hook}`);
  console.log(`[generate] body: ${plan.body}`);
  console.log(`[generate] cta:  ${plan.cta}`);

  let imageStagedName: string;
  let imageSource: "stock" | "ai";

  const stockStaged = await pickAndStageStockPhoto();
  if (stockStaged) {
    imageStagedName = stockStaged;
    imageSource = "stock";
    console.log(`[generate] using user stock photo — skipping AI image gen`);
  } else {
    console.log(`[generate] stock/ is empty — generating AI background`);
    const stamp = Date.now();
    imageStagedName = `promo-ai-${stamp}.png`;
    const stagedPath = resolve(REMOTION_PUBLIC, imageStagedName);
    await generateImage(plan.imagePrompt, stagedPath, "1024x1792");
    imageSource = "ai";
  }

  const props = {
    backgroundImage: imageStagedName,
    hook: plan.hook,
    body: plan.body,
    cta: plan.cta,
    brandColor,
  };
  const propsPath = resolve(workDir, "props.json");
  await writeFile(propsPath, JSON.stringify(props), "utf8");

  const videoPath = resolve(workDir, "promo.mp4");
  await new Promise<void>((res, rej) => {
    const proc = spawn(
      "npx",
      ["remotion", "render", "PromoCard", videoPath, `--props=${propsPath}`],
      { cwd: REMOTION_DIR, stdio: "inherit", shell: true }
    );
    proc.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`remotion exited ${code}`))
    );
  });

  await writeFile(
    resolve(workDir, "plan.json"),
    JSON.stringify({ ...plan, imageSource, imageStagedName }, null, 2),
    "utf8"
  );
  return { videoPath, imageSource, imageStagedName, plan };
}
