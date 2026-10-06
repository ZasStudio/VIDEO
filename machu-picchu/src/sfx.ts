// Sound effects: synthesized by scripts/generate-audio.mjs (public/audio/<name>.wav), plus the
// Magnific ones of each short ("<short>/<name>" -> public/<short>/sfx/<name>.wav).

/** File (in public/) of a sound effect. */
export const sfxFile = (sfx: string) => {
  const slash = sfx.indexOf("/");
  return slash > 0 ? `${sfx.slice(0, slash)}/sfx/${sfx.slice(slash + 1)}.wav` : `audio/${sfx}.wav`;
};

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
  // Effects generated with Magnific for the shorts: public/<short>/sfx/<name>.wav
  | `inca/${string}`
  | `oxigeno/${string}`
  | `dino/${string}`
  | `thanos/${string}`
  | `agua/${string}`
  | `tiempo/${string}`
  | `matusita/${string}`
  | `ia/${string}`
  | `dormir/${string}`;

/** [global frame, sound, volume, optional max length in frames, optional frames skipped at its start] */
export type Cue = [number, Sfx, number, number?, number?];
/** Looping ambience: [from, to, sound, volume, optional fade-out in frames (default 20)]. */
export type Bed = [number, number, Sfx, number, number?];

/** Length in frames of the looping beds (their files). */
export const BED_FRAMES: Partial<Record<Sfx, number>> = { rain: 180, rumble: 90, "inca/run": 90, "dino/city": 90, "thanos/battle": 150, "thanos/castle": 150, "agua/wind": 150, "agua/crowd": 150, "agua/stampede": 150, "tiempo/tick": 178, "tiempo/city": 300, "tiempo/office": 240, "tiempo/machine": 180, "tiempo/heartbeat": 120, "matusita/hum": 240, "matusita/rain": 297, "matusita/roomtone": 183, "matusita/vhs": 120, "ia/clock": 118, "ia/office": 180, "ia/night": 167 };
