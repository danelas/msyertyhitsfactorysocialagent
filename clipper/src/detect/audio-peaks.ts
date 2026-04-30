import { runFfmpeg } from "../util/ffmpeg.ts";

export type AudioPeak = {
  tSeconds: number;
  rmsDb: number;
  /** dB above the rolling baseline at this point */
  liftDb: number;
};

/**
 * Walk the source audio one second at a time, record the RMS level,
 * then find local maxima that stand out vs. the rolling baseline.
 *
 * These peaks are cheap "hype" signals — they don't tell you *what*
 * is happening, but they're a strong hint that *something* is.
 */
export async function findAudioPeaks(
  videoPath: string,
  opts: { sampleSeconds?: number; minLiftDb?: number; mergeWithinSeconds?: number } = {}
): Promise<AudioPeak[]> {
  const sampleSeconds = opts.sampleSeconds ?? 1;
  const minLiftDb = opts.minLiftDb ?? 6;
  const mergeWithinSeconds = opts.mergeWithinSeconds ?? 5;

  // 16k samples per "window" at 16kHz mono = 1 second.
  // We'll force ffmpeg to resample to 16kHz mono and chunk that.
  const samplesPerWindow = 16000 * sampleSeconds;

  const { stdout } = await runFfmpeg(
    [
      "-hide_banner",
      "-nostats",
      "-i", videoPath,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-af",
      `asetnsamples=n=${samplesPerWindow}:p=0,astats=metadata=1:reset=1,ametadata=mode=print:file=-:key=lavfi.astats.Overall.RMS_level`,
      "-f", "null",
      "-",
    ],
    { capture: "stdout" }
  );

  // ametadata prints alternating lines:
  //   frame:N    pts:M    pts_time:T
  //   lavfi.astats.Overall.RMS_level=-23.456
  const samples: { t: number; rmsDb: number }[] = [];
  let pendingT: number | null = null;
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const tMatch = line.match(/pts_time:([\d.]+)/);
    if (tMatch) {
      pendingT = parseFloat(tMatch[1]);
      continue;
    }
    const rmsMatch = line.match(/lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+|-?inf)/i);
    if (rmsMatch && pendingT !== null) {
      const v = rmsMatch[1] === "-inf" ? -120 : parseFloat(rmsMatch[1]);
      samples.push({ t: pendingT, rmsDb: v });
      pendingT = null;
    }
  }

  if (samples.length === 0) return [];

  // Rolling baseline = median of past 30 samples.
  const baselineWindow = 30;
  const baselines: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const start = Math.max(0, i - baselineWindow);
    const slice = samples.slice(start, i + 1).map((s) => s.rmsDb);
    slice.sort((a, b) => a - b);
    baselines.push(slice[Math.floor(slice.length / 2)]);
  }

  // A peak = sample whose lift over baseline is >= minLiftDb AND it's a
  // local max within +/- 3 samples.
  const peaks: AudioPeak[] = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const lift = samples[i].rmsDb - baselines[i];
    if (lift < minLiftDb) continue;
    const windowStart = Math.max(0, i - 3);
    const windowEnd = Math.min(samples.length - 1, i + 3);
    let isLocalMax = true;
    for (let j = windowStart; j <= windowEnd; j++) {
      if (j !== i && samples[j].rmsDb > samples[i].rmsDb) {
        isLocalMax = false;
        break;
      }
    }
    if (!isLocalMax) continue;
    peaks.push({ tSeconds: samples[i].t, rmsDb: samples[i].rmsDb, liftDb: lift });
  }

  // Merge peaks that are too close together — keep the loudest.
  peaks.sort((a, b) => a.tSeconds - b.tSeconds);
  const merged: AudioPeak[] = [];
  for (const p of peaks) {
    const last = merged[merged.length - 1];
    if (last && p.tSeconds - last.tSeconds < mergeWithinSeconds) {
      if (p.rmsDb > last.rmsDb) merged[merged.length - 1] = p;
    } else {
      merged.push(p);
    }
  }
  return merged;
}
