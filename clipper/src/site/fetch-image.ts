import { writeFile } from "node:fs/promises";
import { extname } from "node:path";

const VALID_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/**
 * Download a product image from the site to a local path.
 * Returns null if the fetch fails or the response isn't a usable image type.
 */
export async function downloadProductImage(
  imageUrl: string,
  outPath: string
): Promise<string | null> {
  try {
    const resp = await fetch(imageUrl, {
      headers: { "User-Agent": "MysteryHitsFactoryDailyAgent/1.0" },
    });
    if (!resp.ok) {
      console.warn(`[site-image] fetch failed: ${resp.status} ${imageUrl}`);
      return null;
    }
    const contentType = (resp.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (!VALID_IMAGE_TYPES.has(contentType)) {
      console.warn(`[site-image] unexpected content-type: ${contentType} for ${imageUrl}`);
      return null;
    }
    const buf = await resp.arrayBuffer();
    await writeFile(outPath, Buffer.from(buf));
    console.log(`[site-image] downloaded ${(buf.byteLength / 1024).toFixed(0)}KB → ${outPath}`);
    return outPath;
  } catch (err) {
    console.warn(`[site-image] error: ${(err as Error).message}`);
    return null;
  }
}

/** Map a URL's extension to a safe filename suffix. */
export function imageExtFromUrl(imageUrl: string): string {
  try {
    const u = new URL(imageUrl);
    const ext = extname(u.pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ext;
  } catch {}
  return ".jpg";
}
