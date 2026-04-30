import OpenAI from "openai";
import { createReadStream, statSync } from "node:fs";
import { resolve } from "node:path";
import { runFfmpeg } from "../util/ffmpeg.ts";

export type TranscriptSegment = { start: number; end: number; text: string };
export type TranscriptWord = { start: number; end: number; word: string };

export type Transcript = {
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  fullText: string;
};

const WHISPER_FILE_LIMIT_BYTES = 24 * 1024 * 1024; // 25MB API cap, give headroom

export async function transcribe(videoPath: string, workDir: string): Promise<Transcript> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const audioPath = resolve(workDir, "audio.mp3");
  console.log(`[transcribe] extracting compressed audio for Whisper...`);
  // 24kbps mono mp3 — ~10MB/hr. Keeps a 2-hour stream under 25MB.
  await runFfmpeg([
    "-y",
    "-i", videoPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "24k",
    audioPath,
  ]);

  const size = statSync(audioPath).size;
  if (size > WHISPER_FILE_LIMIT_BYTES) {
    throw new Error(
      `Audio still ${(size / 1024 / 1024).toFixed(1)}MB after compression — Whisper limit is 25MB. ` +
        `For streams >2hrs, we need to add chunked transcription (not in v1).`
    );
  }

  console.log(`[transcribe] uploading ${(size / 1024 / 1024).toFixed(1)}MB to Whisper...`);
  const client = new OpenAI({ apiKey });
  const result = (await client.audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["segment", "word"],
  })) as unknown as {
    text: string;
    segments?: Array<{ start: number; end: number; text: string }>;
    words?: Array<{ start: number; end: number; word: string }>;
  };

  const segments = (result.segments ?? []).map((s) => ({
    start: s.start,
    end: s.end,
    text: s.text.trim(),
  }));
  const words = (result.words ?? []).map((w) => ({
    start: w.start,
    end: w.end,
    word: w.word,
  }));
  console.log(`[transcribe] got ${segments.length} segments, ${words.length} words`);
  return { segments, words, fullText: result.text };
}

/** Slice word-level timestamps to a clip range and rebase to clip-relative. */
export function wordsForClip(
  words: TranscriptWord[],
  clipStart: number,
  clipEnd: number
): { start: number; end: number; text: string }[] {
  return words
    .filter((w) => w.end > clipStart && w.start < clipEnd)
    .map((w) => ({
      start: Math.max(0, w.start - clipStart),
      end: Math.min(clipEnd - clipStart, w.end - clipStart),
      text: w.word.trim(),
    }))
    .filter((w) => w.text.length > 0 && w.end > w.start);
}
