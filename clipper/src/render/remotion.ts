import { spawn } from "node:child_process";
import { copyFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { existsSync } from "node:fs";
import type { Moment } from "../detect/rank.ts";
import type { PlatformStyle } from "../config.ts";
import { wordsForClip, type TranscriptWord } from "../detect/transcribe.ts";

const REMOTION_DIR = resolve(process.cwd(), "../remotion");
const REMOTION_PUBLIC = resolve(REMOTION_DIR, "public");

export type RenderInput = {
  sourceVideoPath: string;
  /** Stable filename used inside remotion/public — same source = same staged filename. */
  stagedFilename: string;
  moment: Moment;
  style: PlatformStyle;
  words: TranscriptWord[];
  outPath: string;
};

let stagedSourceCache: string | null = null;

/**
 * Stage the source video into remotion/public/ exactly once per run, then
 * spawn `npx remotion render` with the StreamClip composition. Each call
 * produces one rendered .mp4 at outPath.
 */
export async function renderStreamClip(input: RenderInput): Promise<string> {
  if (!existsSync(REMOTION_DIR)) {
    throw new Error(`Remotion dir not found at ${REMOTION_DIR}`);
  }
  await mkdir(REMOTION_PUBLIC, { recursive: true });
  const stagedPath = resolve(REMOTION_PUBLIC, input.stagedFilename);
  if (stagedSourceCache !== stagedPath) {
    console.log(`[render] staging source → public/${input.stagedFilename}`);
    await copyFile(input.sourceVideoPath, stagedPath);
    stagedSourceCache = stagedPath;
  }

  const clipLength = input.moment.endSeconds - input.moment.startSeconds;
  const clipWords = wordsForClip(
    input.words,
    input.moment.startSeconds,
    input.moment.endSeconds
  );

  const props = {
    videoFile: input.stagedFilename,
    sourceStartSeconds: input.moment.startSeconds,
    clipLengthSeconds: clipLength,
    hookText: input.moment.hookPhrase,
    endCardLine1: input.style.endCardLine1,
    endCardLine2: input.style.endCardLine2,
    brandColor: input.style.brandColor,
    words: clipWords,
  };

  await mkdir(dirname(input.outPath), { recursive: true });
  const propsPath = resolve(dirname(input.outPath), `${basename(input.outPath, ".mp4")}.props.json`);
  await writeFile(propsPath, JSON.stringify(props), "utf8");

  await new Promise<void>((res, rej) => {
    const proc = spawn(
      "npx",
      ["remotion", "render", "StreamClip", input.outPath, `--props=${propsPath}`],
      { cwd: REMOTION_DIR, stdio: "inherit", shell: true }
    );
    proc.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`remotion exited ${code}`))
    );
  });

  return input.outPath;
}
