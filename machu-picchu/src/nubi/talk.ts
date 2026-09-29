import { speech } from "../talk";
import { NubiPose } from "../three/Nubi";
import { NUBI } from "./timeline";

// Nubi has no mouth either: while its voice plays, the body does the talking. Every
// syllable accent gives a small hop and squash, a fin flaps (alternating sides), the legs
// paddle, the body sways and leans in, and it blinks in the pauses.

/** Adds speech motion to a base pose. `strength` 0..1 scales it. */
export const nubiTalk = (g: number, base: NubiPose = {}, strength = 1): NubiPose => {
  const { lvl, acc, act, left, right, blink } = speech(NUBI, g, strength);
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
