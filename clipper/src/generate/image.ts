import OpenAI from "openai";
import { writeFile } from "node:fs/promises";

/**
 * Hard guard appended to every generated-image prompt. The AI image is a pure
 * background only — it must never render anything that looks like a real
 * product (a mystery pack, pouch, bag, box, tin, booster, or card), which would
 * fabricate a fake-looking Mystery Hits Factory product. Abstract backdrop only.
 */
const BACKGROUND_ONLY_GUARD =
  " ABSOLUTE CONSTRAINTS: This is an empty abstract background ONLY. Do NOT render any product, packaging, or object — no mystery pack, pouch, bag, blind bag, foil bag, box, ETB, tin, booster pack, card pack, trading card, or anything resembling merchandise a brand would sell. No Pokemon characters, creatures, logos, Pokeballs, or card/foil imagery. Just a clean studio backdrop with empty negative space in the center for text. No objects of any kind.";

export async function generateImage(
  prompt: string,
  outPath: string,
  size: "1024x1792" | "1792x1024" | "1024x1024" = "1024x1792"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const client = new OpenAI({ apiKey });

  const mappedSize: "1024x1024" | "1024x1536" | "1536x1024" =
    size === "1024x1792" ? "1024x1536" : size === "1792x1024" ? "1536x1024" : "1024x1024";

  const guardedPrompt = `${prompt}${BACKGROUND_ONLY_GUARD}`;
  console.log(`[image] generating: ${prompt.slice(0, 100)}...`);
  const result = await client.images.generate({
    model: "gpt-image-1",
    prompt: guardedPrompt,
    size: mappedSize,
    quality: "medium",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no data");
  await writeFile(outPath, Buffer.from(b64, "base64"));
  return outPath;
}
