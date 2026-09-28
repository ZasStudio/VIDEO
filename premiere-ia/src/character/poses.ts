import {BASE_POSE, SheepPose} from './Sheep';
import {BEAT} from '../theme';

type NumericKeys = {
  [K in keyof SheepPose]: SheepPose[K] extends number ? K : never;
}[keyof SheepPose];

const NUMERIC_KEYS = (Object.keys(BASE_POSE) as (keyof SheepPose)[]).filter(
  (k) => typeof BASE_POSE[k] === 'number',
) as NumericKeys[];

/** Blend two poses. Discrete fields (hand/mouth shapes) switch at t = 0.5. */
export const mixPose = (a: SheepPose, b: SheepPose, t: number): SheepPose => {
  const out: SheepPose = {...(t < 0.5 ? a : b)};
  for (const k of NUMERIC_KEYS) {
    (out[k] as number) = a[k] + (b[k] - a[k]) * t;
  }
  return out;
};

export const pose = (p: Partial<SheepPose>): SheepPose => ({...BASE_POSE, ...p});

const TAU = Math.PI * 2;

/** Groovy walk cycle, one step per beat. */
export const walkPose = (frame: number, extra: Partial<SheepPose> = {}): SheepPose => {
  const phase = (frame / (BEAT * 2)) * TAU;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return pose({
    y: -14 * Math.abs(Math.cos(phase)) + 4,
    lean: 5,
    head: 3 + 4 * Math.sin(phase * 2 + 0.6),
    nearHip: 30 * s,
    farHip: -30 * s,
    nearKnee: 10 + 34 * Math.max(0, -c),
    farKnee: 10 + 34 * Math.max(0, c),
    nearFoot: 18 * s,
    farFoot: -18 * s,
    nearShoulder: -34 * s,
    farShoulder: 34 * s,
    nearElbow: 26 + 14 * Math.max(0, -s),
    farElbow: 26 + 14 * Math.max(0, s),
    ear: 10 * Math.sin(phase * 2 - 1),
    tail: 12 * Math.sin(phase * 2),
    ...extra,
  });
};

/** Standing idle that nods to the beat. `energy` scales the bounce. */
export const idlePose = (
  frame: number,
  energy = 1,
  extra: Partial<SheepPose> = {},
): SheepPose => {
  const beatPhase = (frame / BEAT) * TAU;
  const bounce = 0.5 - 0.5 * Math.cos(beatPhase);
  return pose({
    y: 8 * energy * bounce,
    squash: 1 - 0.025 * energy * bounce,
    head: 6 * energy * bounce - 2,
    nearShoulder: -8 + 4 * energy * bounce,
    farShoulder: 8 - 4 * energy * bounce,
    nearElbow: 14 + 6 * energy * bounce,
    farElbow: 14 + 6 * energy * bounce,
    nearKnee: 4 + 8 * energy * bounce,
    farKnee: 4 + 8 * energy * bounce,
    nearHip: 4 + 4 * energy * bounce,
    farHip: -4 + 4 * energy * bounce,
    ear: -6 * energy * bounce,
    tail: 10 * Math.sin(beatPhase / 2),
    ...extra,
  });
};

/** Blink every ~3 s (deterministic). */
export const blinkAt = (frame: number, offset = 0): number => {
  const period = 97;
  const f = (frame + offset) % period;
  if (f < 3) return f / 3;
  if (f < 6) return 1 - (f - 3) / 3;
  return 0;
};

/** Mouth movement for "talking" while a speech bubble is active. */
export const talkAt = (frame: number): number => {
  const v =
    0.55 +
    0.3 * Math.sin(frame * 0.9) +
    0.2 * Math.sin(frame * 1.7 + 1.3) +
    0.1 * Math.sin(frame * 3.1);
  return Math.max(0, Math.min(1, v));
};
