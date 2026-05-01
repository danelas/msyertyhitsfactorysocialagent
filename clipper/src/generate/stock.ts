import { readdir, copyFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { existsSync } from "node:fs";

const STOCK_DIR = resolve(process.cwd(), "../stock");
const REMOTION_PUBLIC = resolve(process.cwd(), "../remotion/public");
const VALID_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

/**
 * Pick a random user-uploaded stock photo, stage it into remotion/public/,
 * and return the staged filename for the Remotion comp's staticFile() lookup.
 *
 * Returns null if the stock/ folder is empty — the caller should fall back
 * to AI image generation in that case.
 */
export async function pickAndStageStockPhoto(): Promise<string | null> {
  if (!existsSync(STOCK_DIR)) return null;

  const entries = await readdir(STOCK_DIR);
  const photos = entries.filter(
    (f) => !f.startsWith(".") && VALID_EXTS.has(extname(f).toLowerCase())
  );
  if (photos.length === 0) return null;

  const pick = photos[Math.floor(Math.random() * photos.length)];
  const stagedName = `stock-${Date.now()}${extname(pick)}`;

  await mkdir(REMOTION_PUBLIC, { recursive: true });
  await copyFile(resolve(STOCK_DIR, pick), resolve(REMOTION_PUBLIC, stagedName));
  console.log(`[stock] selected ${pick} (1 of ${photos.length}) → public/${stagedName}`);
  return stagedName;
}
