import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pickThemeForDay, pickAnchorForTheme, planContent, isResearchTheme, researchFocusForTheme, type ContentPlan, type ContentTheme } from "./plan.ts";
import { generateImage } from "./image.ts";
import { pickAndStageStockPhoto } from "./stock.ts";
import { researchPokemonNugget, type ResearchNugget } from "./research.ts";
import { pickPalette } from "./palette.ts";
import { scrapeSiteSafely, type SiteContext, type SiteProduct } from "../site/scrape.ts";
import { downloadProductImage, imageExtFromUrl } from "../site/fetch-image.ts";

/**
 * Pick any product on the site that exposes an image, so even evergreen posts
 * (which have no anchor product) can still lead with a real product photo
 * rather than a stock/AI background. Ordered by how product-forward each bucket
 * is: live drops → featured → themed packs → inventory → showcase hits.
 */
function firstProductWithImage(siteContext: SiteContext | null): SiteProduct | null {
  if (!siteContext) return null;
  const buckets = [
    siteContext.activeDrops,
    siteContext.featuredProducts,
    siteContext.themedPacks,
    siteContext.recentInventory,
    siteContext.showcaseHits,
  ];
  for (const bucket of buckets) {
    const hit = bucket.find((p) => p.imageUrl);
    if (hit) return hit;
  }
  return null;
}

/**
 * Map a theme to its Remotion card style. Interactive engagement themes render
 * as a bold branded "statement" card (with a category badge) instead of a
 * product-photo card, so the feed has visually distinct formats.
 */
function cardStyleForTheme(theme: ContentTheme): {
  variant: "product" | "statement" | "versus";
  label: string;
} {
  switch (theme) {
    case "fun-fact":
      return { variant: "statement", label: "DID YOU KNOW?" };
    case "poll-debate":
      // Upgraded to the split "versus" card when the plan yields two options
      // (see below); falls back to this statement card otherwise.
      return { variant: "statement", label: "YOU DECIDE" };
    case "quiz":
      return { variant: "statement", label: "QUIZ TIME" };
    case "nostalgia":
      return { variant: "statement", label: "REMEMBER THIS?" };
    default:
      return { variant: "product", label: "" };
  }
}

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
  brandColor: string = "#FFD700",
  forceTheme?: string
): Promise<GenerateResult> {
  if (!existsSync(REMOTION_DIR)) {
    throw new Error(`Remotion dir not found at ${REMOTION_DIR}`);
  }
  await mkdir(workDir, { recursive: true });
  await mkdir(REMOTION_PUBLIC, { recursive: true });

  const siteContext = await scrapeSiteSafely();
  const theme: ContentTheme = forceTheme
    ? (forceTheme as ContentTheme)
    : pickThemeForDay(siteContext);
  const anchorProduct = pickAnchorForTheme(theme, siteContext);
  console.log(`[generate] theme: ${theme}`);
  if (anchorProduct) {
    console.log(`[generate] anchor: ${anchorProduct.name} (${anchorProduct.url})`);
  }

  // Research-driven themes pull a real, current market nugget from the web
  // first. If research fails, plan without it (the prompt still produces a
  // valid post, just without the live hook).
  let research: ResearchNugget | null = null;
  if (isResearchTheme(theme)) {
    const focus = researchFocusForTheme(theme);
    console.log(`[generate] researching Pokemon ${focus} for ${theme}...`);
    research = await researchPokemonNugget(focus);
  }

  const plan = await planContent(theme, siteContext, anchorProduct, research);
  console.log(`[generate] hook: ${plan.hook}`);
  console.log(`[generate] body: ${plan.body}`);
  console.log(`[generate] cta:  ${plan.cta}`);

  const stamp = Date.now();
  let imageStagedName: string | null = null;
  let imageSource: ImageSource = "ai";

  // 1. Site product image. Prefer this post's anchor product, but on
  //    non-anchored (evergreen) days fall back to ANY site product that
  //    exposes an image so the feed still leads with real product photos.
  const imageProduct = anchorProduct?.imageUrl
    ? anchorProduct
    : firstProductWithImage(siteContext);
  if (imageProduct?.imageUrl) {
    const ext = imageExtFromUrl(imageProduct.imageUrl);
    const candidate = `site-${stamp}${ext}`;
    const stagedPath = resolve(REMOTION_PUBLIC, candidate);
    const ok = await downloadProductImage(imageProduct.imageUrl, stagedPath);
    if (ok) {
      imageStagedName = candidate;
      imageSource = "site-product";
      console.log(
        `[generate] using site product image${
          imageProduct === anchorProduct ? "" : ` (${imageProduct.name})`
        }`
      );
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

  let { variant, label } = cardStyleForTheme(theme);
  const optionA = (plan.optionA ?? "").trim();
  const optionB = (plan.optionB ?? "").trim();
  // poll-debate gets the split "VS" card when both choices came back; otherwise
  // it stays on the statement card so we never render a half-empty versus.
  if (theme === "poll-debate" && optionA && optionB) {
    variant = "versus";
  }
  // Rotate the text-chip color scheme per day so the feed varies between cool
  // gradients, Pokemon type colors, and the premium website look.
  const palette = pickPalette(Math.floor(Date.now() / 86400000));
  const props = {
    backgroundImage: imageStagedName,
    hook: plan.hook,
    body: plan.body,
    cta: plan.cta,
    brandColor: palette.accent,
    chipBg: palette.chipBg,
    chipText: palette.chipText,
    accent: palette.accent,
    glow: palette.glow,
    variant,
    label,
    optionA,
    optionB,
  };
  console.log(
    `[generate] card variant: ${variant}${label ? ` (${label})` : ""} · palette: ${palette.name}`
  );
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
      { ...plan, imageSource, imageStagedName, anchorProduct, research, siteFetchedAt: siteContext?.fetchedAt },
      null,
      2
    ),
    "utf8"
  );

  return { videoPath, imageSource, imageStagedName, plan };
}
