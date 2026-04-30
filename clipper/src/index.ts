import dotenv from "dotenv";
dotenv.config({ override: true });

import { resolve, basename, extname } from "node:path";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { findAudioPeaks } from "./detect/audio-peaks.ts";
import { transcribe } from "./detect/transcribe.ts";
import { rankMoments, type Moment } from "./detect/rank.ts";
import { probeDurationSeconds } from "./util/ffmpeg.ts";
import { renderStreamClip } from "./render/remotion.ts";
import { postVideo, type Platform } from "./post/uploadpost.ts";
import { SETTINGS, styleFor, captionFor } from "./config.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const PLATFORMS: Platform[] = ["tiktok", "instagram", "facebook"];

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function pickInputVideo(): Promise<string> {
  const explicit = argValue("input");
  if (explicit) {
    if (!existsSync(explicit)) throw new Error(`--input file not found: ${explicit}`);
    return resolve(explicit);
  }
  const inputDir = resolve(process.cwd(), "../input");
  if (!existsSync(inputDir)) {
    throw new Error(
      `No --input given and ../input/ doesn't exist. Drop a stream .mp4/.mov into the input/ folder, or pass --input=path/to/file.mp4.`
    );
  }
  const candidates = (await readdir(inputDir))
    .filter((f) => /\.(mp4|mov|mkv|webm)$/i.test(f))
    .map((f) => resolve(inputDir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (candidates.length === 0) {
    throw new Error(`No video files found in ${inputDir}. Drop a .mp4/.mov in there and re-run.`);
  }
  return candidates[0];
}

async function main() {
  const sourcePath = await pickInputVideo();
  const baseName = basename(sourcePath, extname(sourcePath));
  console.log(`[clip] source: ${sourcePath}`);
  console.log(`[clip] dry-run: ${DRY_RUN}`);

  const workDir = resolve(process.cwd(), "work", baseName);
  const outDir = resolve(process.cwd(), "../output", baseName);
  await mkdir(workDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const totalDuration = await probeDurationSeconds(sourcePath);
  console.log(`[clip] stream length: ${(totalDuration / 60).toFixed(1)} min`);

  console.log(`[clip] step 1/4: scanning audio peaks...`);
  const peaks = await findAudioPeaks(sourcePath);
  console.log(`[clip] found ${peaks.length} audio peaks`);

  console.log(`[clip] step 2/4: transcribing with Whisper...`);
  const transcript = await transcribe(sourcePath, workDir);
  await writeFile(
    resolve(workDir, "transcript.json"),
    JSON.stringify(transcript, null, 2),
    "utf8"
  );

  console.log(`[clip] step 3/4: ranking top ${SETTINGS.momentsPerStream} moments...`);
  const moments = await rankMoments(
    transcript,
    peaks,
    SETTINGS.momentsPerStream,
    totalDuration
  );
  await writeFile(
    resolve(workDir, "moments.json"),
    JSON.stringify(moments, null, 2),
    "utf8"
  );
  for (const m of moments) {
    console.log(
      `  • ${fmt(m.startSeconds)}-${fmt(m.endSeconds)} [${m.type}] (score ${m.score}) — ${m.hookPhrase}`
    );
  }

  console.log(`[clip] step 4/4: rendering ${moments.length} × ${PLATFORMS.length} clips and posting...`);
  // Stable staged filename so Remotion's video cache stays warm across renders.
  const stagedFilename = `${baseName}${extname(sourcePath)}`;

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];
    for (const platform of PLATFORMS) {
      const style = styleFor(platform);
      const outName = `clip-${String(i + 1).padStart(2, "0")}-${platform}.mp4`;
      const outPath = resolve(outDir, outName);
      console.log(`[clip] render ${outName}`);

      await renderStreamClip({
        sourceVideoPath: sourcePath,
        stagedFilename,
        moment,
        style,
        words: transcript.words,
        outPath,
      });

      if (DRY_RUN) {
        console.log(`[clip]   dry-run — skipping post`);
        continue;
      }
      const caption = captionFor(platform, moment);
      const result = await postVideo({
        caption,
        title: `${moment.hookPhrase} — Mystery Hits Factory`,
        mediaPath: outPath,
        platforms: [platform],
      });
      console.log(`[clip]   posted to ${platform}:`, summarizeResult(result));
    }
  }

  console.log(`[clip] done. Output: ${outDir}`);
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function summarizeResult(r: unknown): string {
  if (typeof r === "string") return r.slice(0, 120);
  try {
    return JSON.stringify(r).slice(0, 200);
  } catch {
    return "(unserializable)";
  }
}

main().catch((err) => {
  console.error("[clip] failed:", err);
  process.exit(1);
});
