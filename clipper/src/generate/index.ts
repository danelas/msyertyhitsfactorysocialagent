import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pickThemeForDay, planContent, type ContentPlan } from "./plan.ts";
import { generateImage } from "./image.ts";
import { pickAndStageStockPhoto } from "./stock.ts";
import { scrapeSiteSafely, pickAnchorProduct } from "../site/scrape.ts";
import { downloadProductImage, imageExtFromUrl } from "../site/fetch-image.ts";

const REMOTION_DIR = resolve(process.cwd(), "../remotion");
const REMOTION_PUBLIC = resolve(REMOTION_DIR, "public");

export type ImageSource = "site-product" | "stock" | "ai";

export type GenerateResult = {
  videoPath: string;
  imageSource: ImageSource;
  imageStagedName: string;
  plan: ContentPlan;
};

/**
 * Plan a fresh promo post and render it as a 12s 9:16 video.
 *
 * Flow:
 *   1. Scrape mysteryhitsfactory.com (best effort — failures fall through silently)
 *   2. Pick a theme that fits whatever the site is currently pushing
 *   3. Ask Claude to write hook/body/cta/caption with site context as input
 *   4. Pick a background image — site product image first, then stock/, then AI
 *   5. Render via Remotion
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

  const siteContext = await scrapeSiteSafely();
  const anchorProduct = siteContext ? pickAnchorProduct(siteContext) : null;
  const theme = pickThemeForDay(siteContext);
  console.log(`[generate] theme: ${theme}`);
  if (anchorProduct) {
    console.log(`[generate] anchor: ${anchorProduct.name} (${anchorProduct.url})`);
  }

  const plan = await planContent(theme, siteContext, anchorProduct);
  console.log(`[generate] hook: ${plan.hook}`);
  console.log(`[generate] body: ${plan.body}`);
  console.log(`[generate] cta:  ${plan.cta}`);

  const stamp = Date.now();
  let imageStagedName: string | null = null;
  let imageSource: ImageSource = "ai";

  // 1. Site product image (preferred when we have an anchor product with imageUrl)
  if (anchorProduct?.imageUrl) {
    const ext = imageExtFromUrl(anchorProduct.imageUrl);
    const candidate = `site-${stamp}${ext}`;
    const stagedPath = resolve(REMOTION_PUBLIC, candidate);
    const ok = await downloadProductImage(anchorProduct.imageUrl, stagedPath);
    if (ok) {
      imageStagedName = candidate;
      imageSource = "site-product";
      console.log(`[generate] using site product image`);
    } else {
      console.log(`[generate] site image download failed, trying stock/`);
    }
  }

  // 2. User stock photo
  if (!imageStagedName) {
    const stockStaged = await pickAndStageStockPhoto();
    if (stockStaged) {
      imageStagedName = stockStaged;
      imageSource = "stock";
      console.log(`[generate] using user stock photo`);
    }
  }

  // 3. AI fallback (locked to abstract studio backgrounds)
  if (!imageStagedName) {
    console.log(`[generate] no site or stock image — generating AI background`);
    const aiName = `promo-ai-${stamp}.png`;
    const stagedPath = resolve(REMOTION_PUBLIC, aiName);
    await generateImage(plan.imagePrompt, stagedPath, "1024x1792");
    imageStagedName = aiName;
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
    JSON.stringify(
      { ...plan, imageSource, imageStagedName, anchorProduct, siteFetchedAt: siteContext?.fetchedAt },
      null,
      2
    ),
    "utf8"
  );

  return { videoPath, imageSource, imageStagedName, plan };
}
