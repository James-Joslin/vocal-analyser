/**
 * Generate a short random ID suitable for DOM keys.
 */
export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Current time in HH:MM:SS (24-hour) format.
 */
export function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

/**
 * Format seconds as "Xm Ys".
 */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${s}s`;
}

/**
 * Pre-authored dialogue injected during simulation mode.
 */
export const SIMULATION_LINES: ReadonlyArray<{
  text: string;
  sender: "speaker" | "responder";
}> = [
  { text: "Help me! I need immediate backup, things are collapsing!", sender: "speaker" },
  { text: "Acoustic coaching guidelines received. Engaging deep diagnostic checks.", sender: "responder" },
  { text: "My breathing pattern is steady now, starting the countdown.", sender: "speaker" },
  { text: "Hold on… there's a serious caution alert popping up on terminal!", sender: "speaker" },
  { text: "Breathing companion initiated. Relax your jaw muscles.", sender: "responder" },
  { text: "Okay, performing structured vocal pauses. Calm indicators active.", sender: "speaker" },
];

/**
 * Intervention suggestion pools keyed by detection source.
 */
export const INTERVENTION_SUGGESTIONS: Record<"acoustic" | "linguistic", readonly string[]> = {
  acoustic: [
    "Take a slow, deep breath. Focus on speaking from your diaphragm to relax vocal tension.",
    "Consider a short break: relax your neck, relax your jaw, and take two deep breaths.",
    "Take a deep breath and lower your vocal projection slightly to reduce throat strain.",
    "Ease your speaking tempo. Sip some water and introduce a 2-second silence.",
  ],
  linguistic: [
    "Take a deep breath and slow down. Focus on steadying your phrasing structure.",
    "Consider a short break. Allow yourself a brief pause before speaking further.",
    "Practice a quick 4-7-8 breathing loop to lower active stress hormones.",
    "Relax your posture and take a slow, measured deep breath to ground yourself.",
  ],
};


