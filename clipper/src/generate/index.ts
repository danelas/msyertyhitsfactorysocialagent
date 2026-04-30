import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pickThemeForDay, planContent, type ContentPlan } from "./plan.ts";
import { generateImage } from "./image.ts";

const REMOTION_DIR = resolve(process.cwd(), "../remotion");
const REMOTION_PUBLIC = resolve(REMOTION_DIR, "public");

export type GenerateResult = {
  videoPath: string;
  imagePath: string;
  plan: ContentPlan;
};

/**
 * Plan a fresh promo post, generate a background image, render a captioned
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

  const stamp = Date.now();
  const imageName = `promo-${stamp}.png`;
  const imagePath = resolve(workDir, imageName);
  await generateImage(plan.imagePrompt, imagePath, "1024x1792");

  // Stage into remotion/public/ so staticFile() can find it.
  const stagedPath = resolve(REMOTION_PUBLIC, imageName);
  await copyFile(imagePath, stagedPath);

  const props = {
    backgroundImage: imageName,
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

  await writeFile(resolve(workDir, "plan.json"), JSON.stringify(plan, null, 2), "utf8");
  return { videoPath, imagePath, plan };
}
