// Sound effects synthesized by scripts/generate-audio.mjs (public/audio/<name>.wav).

export type Sfx =
  | "impact"
  | "whoosh"
  | "whoosh-short"
  | "pop"
  | "ding"
  | "tick"
  | "riser"
  | "rumble"
  | "rain"
  | "thunder"
  | "stone-thud"
  | "stone-clack"
  | "paper"
  | "rope"
  | "sparkle";

/** [global frame, sound, volume, optional max length in frames] */
export type Cue = [number, Sfx, number, number?];
/** Looping ambience: [from, to, sound, volume]. */
export type Bed = [number, number, Sfx, number];

/** Length in frames of the looping beds (their files). */
export const BED_FRAMES: Partial<Record<Sfx, number>> = { rain: 180, rumble: 90 };
