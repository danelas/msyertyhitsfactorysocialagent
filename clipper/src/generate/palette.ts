/**
 * Color schemes for the on-screen text chips / badges / accents. Rotated per
 * post so the feed isn't one flat color. A mix of cool gradients, flat Pokemon
 * type colors, and a premium "crown" scheme that matches the website. No yellow.
 */
export type Palette = {
  name: string;
  /** CSS background for hook / cta chips + badges (gradient or solid). */
  chipBg: string;
  /** Text color on the chip (contrast against chipBg). */
  chipText: string;
  /** Solid accent — VS badge, borders, dividers. */
  accent: string;
  /** Solid color for the statement-card background glow. */
  glow: string;
};

export const PALETTES: Palette[] = [
  // Cool gradients
  { name: "ocean", chipBg: "linear-gradient(135deg, #38bdf8, #1d4ed8)", chipText: "#ffffff", accent: "#38bdf8", glow: "#2563eb" },
  { name: "amethyst", chipBg: "linear-gradient(135deg, #c084fc, #6d28d9)", chipText: "#ffffff", accent: "#c084fc", glow: "#7c3aed" },
  { name: "ice", chipBg: "linear-gradient(135deg, #a5f3fc, #0891b2)", chipText: "#042f3a", accent: "#22d3ee", glow: "#06b6d4" },
  { name: "aurora", chipBg: "linear-gradient(135deg, #34d399, #0ea5e9)", chipText: "#04302a", accent: "#34d399", glow: "#10b981" },
  { name: "nightfall", chipBg: "linear-gradient(135deg, #818cf8, #1e1b4b)", chipText: "#ffffff", accent: "#818cf8", glow: "#6366f1" },
  // Flat Pokemon type colors
  { name: "water", chipBg: "#6890f0", chipText: "#ffffff", accent: "#6890f0", glow: "#4f7fe0" },
  { name: "grass", chipBg: "#5bbf5b", chipText: "#06270f", accent: "#5bbf5b", glow: "#3fae3f" },
  { name: "psychic", chipBg: "#f85888", chipText: "#ffffff", accent: "#f85888", glow: "#f0407a" },
  { name: "dragon", chipBg: "#7038f8", chipText: "#ffffff", accent: "#9a6bff", glow: "#7038f8" },
  // Premium / website look
  { name: "crown", chipBg: "linear-gradient(135deg, #f6f6f8, #cdd0d8)", chipText: "#0b0b0b", accent: "#dfe2ea", glow: "#8b93a7" },
];

/** Pick a palette deterministically from a seed (e.g. the day index). */
export function pickPalette(seed: number): Palette {
  const n = PALETTES.length;
  const i = ((Math.floor(seed) % n) + n) % n;
  return PALETTES[i];
}
