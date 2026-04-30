import OpenAI from "openai";
import { writeFile } from "node:fs/promises";

export async function generateImage(
  prompt: string,
  outPath: string,
  size: "1024x1792" | "1792x1024" | "1024x1024" = "1024x1792"
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  const client = new OpenAI({ apiKey });

  console.log(`[image] generating: ${prompt.slice(0, 100)}...`);
  const result = await client.images.generate({
    model: "dall-e-3",
    prompt,
    size,
    quality: "standard",
    response_format: "b64_json",
    n: 1,
  });
  const b64 = result.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image generation returned no data");
  await writeFile(outPath, Buffer.from(b64, "base64"));
  return outPath;
}
