import { speech } from "../talk";
import { NubiPose } from "../three/Nubi";
import { SPEAKER } from "./timeline";

// Nubi, the coworker and the old lady talk with their bodies (no mouths), each on its own lines.
const talker =
  (track: (typeof SPEAKER)[keyof typeof SPEAKER]) =>
  (g: number, base: NubiPose = {}, strength = 1): NubiPose => {
    const { lvl, acc, act, left, right, blink } = speech(track, g, strength);
    const flap = acc * 0.85;
    return {
      ...base,
      squash: (base.squash ?? 1) * (1 - 0.05 * lvl + 0.08 * acc + 0.012 * Math.sin(g * 0.18)),
      hop: (base.hop ?? 0) + acc * 0.9,
      finL: (base.finL ?? 0) + left * flap + act * 0.12,
      finR: (base.finR ?? 0) + right * flap + act * 0.12,
      roll: (base.roll ?? 0) + Math.sin(g * 0.11) * 0.05 * act,
      pitch: (base.pitch ?? 0) + 0.05 * act - acc * 0.04,
      yaw: (base.yaw ?? 0) + Math.sin(g * 0.07) * 0.06 * act,
      wiggle: Math.max(base.wiggle ?? 0, act * 0.35),
      wigglePhase: base.wigglePhase ?? g * 0.35,
      blink: Math.max(base.blink ?? 0, blink),
    };
  };

/** Nubi's talking body motion (on its own lines), added to a base pose. */
export const tiempoTalk = talker(SPEAKER.nubi);
/** The coworker's talking body motion (on his line). */
export const coworkerTalk = talker(SPEAKER.companero);
/** The old lady's talking body motion (on her line). */
export const ladyTalk = talker(SPEAKER.senora);
