import { rand } from "./anim";
import { ClawdPose } from "./three/Clawd";
import { accentIndex, talking, voiceAccent, voiceLevel } from "./timeline";

// Clawd has no mouth: while its voice plays, the body does the talking. Every syllable
// accent gives a small hop and squash, the nubs gesture (alternating sides), the body
// sways and leans in, and it blinks in the pauses.

/** Adds speech motion to a base pose. `strength` 0..1 scales it (e.g. when tiny on screen). */
export const talkPose = (g: number, base: ClawdPose = {}, strength = 1): ClawdPose => {
  const lvl = voiceLevel(g) * strength;
  const acc = voiceAccent(g, 4) * strength;
  const act = talking(g) * strength;
  const idx = accentIndex(g);
  // Every accent picks a gesture: left nub, right nub or both (deterministic per accent).
  const pick = rand(idx * 7.31);
  const left = pick < 0.4 || pick > 0.8 ? 1 : 0;
  const right = pick >= 0.4 ? 1 : 0;
  const gesture = acc * 0.6;
  // Blink in pauses (and now and then while talking).
  const blinkSeed = Math.floor(g / 50);
  const blinkAt = blinkSeed * 50 + Math.floor(rand(blinkSeed) * 40);
  const blink = g >= blinkAt && g < blinkAt + 3 ? 1 : 0;
  return {
    ...base,
    squash: (base.squash ?? 1) * (1 - 0.05 * lvl + 0.07 * acc + 0.012 * Math.sin(g * 0.18)),
    hop: (base.hop ?? 0) + acc * 0.75,
    armL: (base.armL ?? 0) + left * gesture + act * 0.1,
    armR: (base.armR ?? 0) + right * gesture + act * 0.1,
    roll: (base.roll ?? 0) + Math.sin(g * 0.11) * 0.05 * act,
    pitch: (base.pitch ?? 0) + 0.05 * act - acc * 0.04,
    yaw: (base.yaw ?? 0) + Math.sin(g * 0.07) * 0.06 * act,
    blink: Math.max(base.blink ?? 0, blink),
  };
};
