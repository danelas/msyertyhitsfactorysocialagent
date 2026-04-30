import { spawn } from "node:child_process";

export type FfmpegResult = { stdout: string; stderr: string };

export async function runFfmpeg(
  args: string[],
  opts: { capture?: "stdout" | "stderr" | "both" } = {}
): Promise<FfmpegResult> {
  return runTool("ffmpeg", args, opts);
}

export async function runFfprobe(
  args: string[],
  opts: { capture?: "stdout" | "stderr" | "both" } = {}
): Promise<FfmpegResult> {
  return runTool("ffprobe", args, opts);
}

function runTool(
  tool: "ffmpeg" | "ffprobe",
  args: string[],
  opts: { capture?: "stdout" | "stderr" | "both" }
): Promise<FfmpegResult> {
  const capture = opts.capture ?? "both";
  return new Promise((resolvePromise, rejectPromise) => {
    const proc = spawn(tool, args, { shell: false });
    let stdout = "";
    let stderr = "";
    if (capture === "stdout" || capture === "both") {
      proc.stdout.on("data", (d) => (stdout += d.toString()));
    }
    if (capture === "stderr" || capture === "both") {
      proc.stderr.on("data", (d) => (stderr += d.toString()));
    }
    proc.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        rejectPromise(
          new Error(
            `${tool} not found on PATH. Install ffmpeg (Windows: \`winget install ffmpeg\` or grab a build from https://www.gyan.dev/ffmpeg/builds/), then restart your shell.`
          )
        );
      } else {
        rejectPromise(err);
      }
    });
    proc.on("exit", (code) => {
      if (code === 0) resolvePromise({ stdout, stderr });
      else
        rejectPromise(
          new Error(`${tool} exited ${code}: ${stderr.slice(-1000) || stdout.slice(-1000)}`)
        );
    });
  });
}

export async function probeDurationSeconds(file: string): Promise<number> {
  const { stdout } = await runFfprobe(
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { capture: "stdout" }
  );
  const duration = parseFloat(stdout.trim());
  if (!isFinite(duration)) throw new Error(`bad ffprobe duration output: ${stdout}`);
  return duration;
}
