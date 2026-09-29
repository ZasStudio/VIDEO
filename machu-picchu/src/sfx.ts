// Sound effects: synthesized by scripts/generate-audio.mjs (public/audio/<name>.wav), plus the
// Magnific ones of the Inca-phone short ("inca/<name>" -> public/inca/sfx/<name>.wav).

/** File (in public/) of a sound effect. */
export const sfxFile = (sfx: string) => (sfx.startsWith("inca/") ? `inca/sfx/${sfx.slice(5)}.wav` : `audio/${sfx}.wav`);

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
  | "sparkle"
  // Effects generated with Magnific for the Inca-phone short: public/inca/sfx/<name>.wav
  | `inca/${string}`;

/** [global frame, sound, volume, optional max length in frames, optional frames skipped at its start] */
export type Cue = [number, Sfx, number, number?, number?];
/** Looping ambience: [from, to, sound, volume]. */
export type Bed = [number, number, Sfx, number];

/** Length in frames of the looping beds (their files). */
export const BED_FRAMES: Partial<Record<Sfx, number>> = { rain: 180, rumble: 90, "inca/run": 90 };
