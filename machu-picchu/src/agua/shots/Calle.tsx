import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { SweatDrops } from "../../inca/effects";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { Nubi, NubiPose } from "../../three/Nubi";
import { BOTTLE_HUG, WaterBottle } from "../../three/agua/Bottle";
import {
  Chaser,
  Civilian,
  DryStreet,
  FarCrowd,
  HOT_SKY,
  HotLights,
  POLE_HIDE,
  StreetChase,
  Tumbleweed,
  alongPath,
  chaserSpot,
  civilianLook,
  civilianRun,
  civilianWalk,
  streetGroundY,
  turnTowards,
} from "../../three/agua/Street";
import { PELIGRO } from "../beats";

const AGUA_ALLEY_Z = 11.65;
import { SHOTS } from "../shots";
import { aguaTalk } from "../talk";

// "Peligro": Nubi steps out of alley B onto the busy sidewalk hugging the glowing bottle. Record
// scratch: everyone freezes mid-step, then every head turns to it (cut to Nubi's point of view: the
// whole crowd staring into the camera). "Mi error fue mostrarla. De pronto… tenía demasiados
// amigos." They creep closer, eyes wide. Nubi bolts (the flash-forward chase), hides behind a
// lamp post far too thin, eyes shut ("Si yo no los veo… ellos tampoco."), a fin taps it, it runs.

const Y = 0.16;
/** Nubi on the sidewalk at alley B's mouth, facing the street (−x). */
const NUBI_AT: Vec3 = [5.25, Y, 11.5];
const NUBI_FROM: Vec3 = [8.9, Y, 11.6];
/** Point-of-view camera (Nubi's eyes, a touch higher so the back rows show). */
const POV: Vec3 = [5.0, 2.7, 11.5];
/** People walking by on the sidewalk in the first shot: [x, z at SILENCE, direction]. */
const WALKERS: [number, number, 1 | -1][] = [
  [4.3, 10.0, 1],
  [5.75, 14.2, -1],
  [2.4, 9.4, -1],
  [4.7, 15.6, -1],
  [1.6, 9.0, 1],
  [5.9, 8.0, 1],
];
/** The dash to the thin pole and on (the crowd's trail positions extend past the pole). */
const DASH: Vec3[] = [
  [5.25, Y, 11.5],
  [4.35, Y, 8.4],
  [POLE_HIDE[0], Y, POLE_HIDE[2]],
  [POLE_HIDE[0], Y, 0.5],
];
const DASH_LEN = Math.hypot(0.9, 3.1) + Math.hypot(4.35 - POLE_HIDE[0], 8.4 - POLE_HIDE[2]);
/** Nubi's escape at RUN: across the road towards alley A. */
const ESCAPE: Vec3[] = [
  [POLE_HIDE[0], Y, POLE_HIDE[2]],
  [1.6, 0, 7.6],
  [-2.5, 0, 10.2],
  [-6.6, Y, 11.5],
];

// The crowd in rows in front of Nubi (distance along −x, z offsets), walking along the street
// (±z) until the silence.
const ROWS: [number, number[]][] = [
  [5.8, [-1.05, 1.1]],
  [7.2, [-2.0, -0.25, 1.55]],
  [8.7, [-2.7, -1.05, 0.6, 2.25]],
  [10.3, [-3.4, -1.85, -0.3, 1.25, 2.8]],
];
type Member = { look: ReturnType<typeof civilianLook>; d: number; z: number; dir: 1 | -1; phase: number; r: number; wave: boolean };
const MEMBERS: Member[] = ROWS.flatMap(([d, zs], ri) =>
  zs.map((z, k) => {
    const i = ri * 5 + k;
    const r = ((i * 37) % 11) / 11;
    return { look: civilianLook(300 + i), d: d + (r - 0.5) * 0.5, z: NUBI_AT[2] + z, dir: (i % 2 ? 1 : -1) as 1 | -1, phase: i * 1.7, r, wave: i % 3 === 1 };
  }),
);
const FAR_SPOTS: [number, number][] = Array.from({ length: 18 }, (_, i) => [-4.3 - (i % 3) * 0.9 - ((i * 7) % 3) * 0.2, 7.2 + Math.floor(i / 3) * 1.45 + (i % 2) * 0.4]);

/** Around the pole: where each member ends up (relative to POLE_HIDE), member 0 is the tapper. */
const CIRCLE: [number, number][] = [
  [1.95, -0.1],
  [-2.1, 1.2],
  [2.05, 1.6],
  [-2.9, 2.7],
  [-1.9, 3.9],
  [1.85, 3.4],
  [-3.6, 4.6],
  [-2.6, 5.8],
  [1.75, 5.6],
  [-3.4, 7.2],
  [-1.4, -1.2],
  [1.6, -1.6],
  [-2.9, -0.4],
  [0.2, -2.4],
];

const CHASERS: Chaser[] = MEMBERS.map((m, i) => ({
  look: m.look,
  lag: 1.4 + i * 0.42 + m.r * 0.3,
  side: (i % 2 ? 1 : -1) * (0.5 + m.r * 1.1),
  phase: m.phase,
  delay: m.r * 0.35,
  from: [0, 0, 0],
}));

/** Creeping closer: four small steps between MOSTRARLA and AMIGOS, one more after. */
const creep = (g: number) => {
  const { MOSTRARLA, AMIGOS } = PELIGRO;
  const span = (AMIGOS - MOSTRARLA) / 4;
  let c = 0;
  for (let s = 0; s < 4; s++) c += 0.3 * ramp(g, MOSTRARLA + 6 + s * span, MOSTRARLA + 13 + s * span, [0, 1], EASE_IN_OUT);
  c += 0.4 * ramp(g, AMIGOS + 3, AMIGOS + 11, [0, 1], EASE_IN_OUT);
  return c;
};
/** 0..1 while a creep step is under way (legs paddle, a little hop). */
const stepping = (g: number) => {
  const { MOSTRARLA, AMIGOS } = PELIGRO;
  const span = (AMIGOS - MOSTRARLA) / 4;
  let a = 0;
  for (let s = 0; s < 4; s++) a = Math.max(a, windowIn(g, MOSTRARLA + 6 + s * span, MOSTRARLA + 13 + s * span, 3));
  return Math.max(a, windowIn(g, AMIGOS + 3, AMIGOS + 11, 3));
};

const memberSpot = (m: Member, g: number): Vec3 => {
  const { SILENCE } = PELIGRO;
  const walk = Math.min(g, SILENCE) - SILENCE;
  const x = NUBI_AT[0] - m.d + creep(g) * (0.8 + 0.4 * m.r);
  const z = m.z + m.dir * 1.0 * (walk / 30);
  return [x, streetGroundY(x, z), z];
};

export const CalleShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.calle.from;
  const t = g / 30;
  const { OUT, SILENCE, TURN, L12, MOSTRARLA, AMIGOS, CHASE, POLE, L13, FIN, RUN } = PELIGRO;
  const tFrozen = Math.min(g, SILENCE) / 30;

  // ---- Nubi
  const out = ramp(g, OUT, OUT + 12, [0, 1], EASE_IN_OUT);
  const dashK = ramp(g, CHASE, POLE, [0, 1], (x) => 1 - Math.pow(1 - x, 2.2));
  const lead = DASH_LEN * dashK;
  const escK = ramp(g, RUN, RUN + 8, [0, 1], (x) => x * x);
  let nubiAt: Vec3;
  let nubiRot = -Math.PI / 2;
  let pose: NubiPose;
  const hug = { finL: 0.24, finR: 0.24 };
  if (g < CHASE) {
    nubiAt = [NUBI_FROM[0] + (NUBI_AT[0] - NUBI_FROM[0]) * out, Y, NUBI_FROM[2] + (NUBI_AT[2] - NUBI_FROM[2]) * out];
    const walking = g < SILENCE ? windowIn(g, OUT - 2, OUT + 14, 4) : 0;
    const nervous = ramp(g, TURN, TURN + 10);
    const base: NubiPose = {
      ...civilianWalk(Math.min(t, tFrozen), 0, walking),
      ...hug,
      eyeScale: 1 + 0.12 * ramp(g, SILENCE, SILENCE + 6) + 0.18 * nervous,
      lookX: nervous * 0.55 * Math.sin(g * 0.13),
      squash: 1 - 0.05 * nervous,
    };
    pose = aguaTalk(g, base, 0.8);
  } else if (g < RUN) {
    const p = alongPath(DASH, lead);
    nubiAt = p.p;
    const running = 1 - ramp(g, POLE - 3, POLE + 2);
    // At the pole: turns to face the crowd (+z), shrinks, eyes shut until the tap.
    const atPole = ramp(g, POLE - 2, POLE + 4);
    nubiRot = running > 0.5 ? p.yaw : 0;
    const tap = ramp(g, FIN + 1, FIN + 4);
    const base: NubiPose = {
      ...civilianRun(t, 0, running),
      ...hug,
      squash: 1 - 0.1 * atPole + 0.08 * tap,
      blink: atPole * (1 - tap),
      eyeScale: 1.2 + 0.35 * tap,
      hop: (civilianRun(t, 0, running).hop ?? 0) + 1.6 * windowIn(g, FIN + 1, FIN + 9, 3),
      lookX: -0.7 * tap,
    };
    pose = g >= L13 && g < FIN ? aguaTalk(g, base, 0.45) : base;
    pose = { ...pose, blink: Math.max(pose.blink ?? 0, atPole * (1 - tap)) };
  } else {
    const p = alongPath(ESCAPE, escK * 16);
    nubiAt = p.p;
    nubiRot = p.yaw;
    pose = { ...civilianRun(t, 0, 1), ...hug, eyeScale: 1.5 };
  }

  // ---- Shots
  let cam: Cam;
  let shot: "out" | "pov" | "nubi" | "chase" | "pole";
  if (g < TURN) {
    shot = "out";
    cam = aim([-0.4, 2.0, 14.9], 48, [6.2, 0.95, AGUA_ALLEY_Z], 540, 880);
  } else if (g < MOSTRARLA) {
    shot = "pov";
    cam = aim(POV, 60, [-3.5, 1.1, NUBI_AT[2]], 540, 820);
  } else if (g < AMIGOS) {
    shot = "nubi";
    const push = ramp(g, MOSTRARLA, AMIGOS, [0, 1], (x) => x);
    // High over the crowd's heads (they fill the bottom of the frame), pushing in slowly.
    cam = aim([-0.4 + push * 0.9, 4.1 - push * 0.3, 12.2], 42, [NUBI_AT[0], Y + 1.05, NUBI_AT[2]], 540, 760);
  } else if (g < CHASE) {
    shot = "pov";
    cam = aim(POV, 60, [-3.5, 1.05, NUBI_AT[2]], 540, 840);
  } else if (g < POLE) {
    shot = "chase";
    cam = aim([2.0, 1.45, 0.2], 50, [POLE_HIDE[0], 1.15, POLE_HIDE[2] + 2.0], 540, 900);
  } else {
    shot = "pole";
    cam = aim([3.3, 1.75, 14.6], 46, [POLE_HIDE[0], Y + 1.0, POLE_HIDE[2]], 540, 820);
  }

  // ---- The crowd
  const turnTarget: Vec3 = shot === "pov" ? POV : [nubiAt[0], nubiAt[1] + 1.1, nubiAt[2]];
  const wide = ramp(g, TURN, TURN + 8) * 0.3 + 0.1 * ramp(g, AMIGOS, AMIGOS + 8);
  const walkers =
    shot === "out"
      ? WALKERS.map(([x, z0, dir], i) => {
          const z = z0 + dir * 1.1 * ((Math.min(g, SILENCE) - SILENCE) / 30);
          const look = civilianLook(330 + i);
          const w = civilianWalk(tFrozen, i * 1.9, g < SILENCE ? 1 : 0.85);
          const at: Vec3 = [x, streetGroundY(x, z), z];
          const rot = dir > 0 ? 0 : Math.PI;
          const k = ramp(g, SILENCE + 2 + i, SILENCE + 7 + i);
          return <Civilian key={`w${i}`} look={look} position={at} rotationY={rot} pose={turnTowards({ ...w, hop: g < SILENCE ? w.hop : 0, eyeScale: 1 + 0.3 * k }, k * 0.35, at, rot, [nubiAt[0], 1.2, nubiAt[2]])} t={tFrozen} />;
        })
      : null;
  const crowd =
    shot === "out" ? null : g < CHASE ? (
      MEMBERS.map((m, i) => {
        const at = memberSpot(m, g);
        const rot = m.dir > 0 ? 0 : Math.PI;
        const st = stepping(g);
        const walkPose = civilianWalk(tFrozen, m.phase, g < SILENCE ? 1 : 0.85);
        const k = ramp(g, TURN + m.r * 3, TURN + 6 + m.r * 3);
        const base: NubiPose = {
          ...walkPose,
          hop: (walkPose.hop ?? 0) * (g < SILENCE ? 1 : k > 0 ? 0 : 1) + st * 0.5,
          wiggle: g < SILENCE ? walkPose.wiggle : st * 0.8,
          eyeScale: 1.05 + wide + 0.05 * Math.sin(g * 0.2 + i),
          finR: m.wave && g >= AMIGOS ? 0.85 + 0.3 * Math.sin(g * 0.6 + i) : walkPose.finR,
        };
        const pose2 = turnTowards(base, k, at, rot, turnTarget, m.look.size * 0.55);
        return <Civilian key={i} look={m.look} position={at} rotationY={rot} pose={{ ...pose2, lookX: (pose2.lookX ?? 0) * (1 - k * 0.6) }} t={tFrozen} thirst={1 - k * 0.4} />;
      })
    ) : g < POLE ? (
      <StreetChase
        t={t}
        path={DASH}
        lead={lead}
        chasers={CHASERS.map((c, i) => ({ ...c, from: memberSpot(MEMBERS[i], CHASE) }))}
        flood={ramp(g, CHASE, POLE + 6, [0, 1], (x) => x)}
        relFrom={false}
        target={nubiAt}
      />
    ) : (
      MEMBERS.map((m, i) => {
        const c: Chaser = { ...CHASERS[i], from: memberSpot(m, CHASE) };
        const from = chaserSpot(c, DASH, DASH_LEN, ramp(POLE, CHASE, POLE + 6, [0, 1], (x) => x), false).p;
        const spot = CIRCLE[i % CIRCLE.length];
        const sx = POLE_HIDE[0] + spot[0];
        const sz = POLE_HIDE[2] + spot[1];
        const arrive = ramp(g, POLE + m.r * 8, POLE + 16 + m.r * 12, [0, 1], EASE_IN_OUT);
        const x = from[0] + (sx - from[0]) * arrive;
        const z = from[2] + (sz - from[2]) * arrive;
        const at: Vec3 = [x, streetGroundY(x, z), z];
        const runAmt = 1 - arrive;
        const look = g >= RUN ? nubiAt : [POLE_HIDE[0], 1.2, POLE_HIDE[2]];
        const isTapper = i === 0;
        const tap = isTapper ? windowIn(g, FIN - 7, FIN + 6, 4) : 0;
        const base: NubiPose = {
          ...civilianRun(t, m.phase, runAmt),
          eyeScale: 1.35 + 0.05 * Math.sin(g * 0.15 + i),
          finL: isTapper ? -0.15 + 0.75 * tap : civilianRun(t, m.phase, runAmt).finL,
          pitch: 0.12 * (1 - runAmt),
        };
        const rot = isTapper && arrive > 0.95 ? -0.2 : Math.atan2(look[0] - x, look[2] - z);
        const p2 = isTapper ? { ...base, lookX: -0.8, lookY: -0.1 } : turnTowards(base, 1, at, rot, look as Vec3, m.look.size * 0.55);
        return <Civilian key={i} look={m.look} position={at} rotationY={rot} pose={p2} t={t} thirst={0.7} />;
      })
    );

  const silenceTilt = windowIn(g, SILENCE, TURN + 2, 2);
  return (
    <AbsoluteFill style={{ background: HOT_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: SILENCE, amp: 6, dur: 8 },
          { at: CHASE + 1, amp: 10, dur: 14 },
          { at: FIN + 2, amp: 7, dur: 8 },
        ]}
      >
        <Stage cam={{ ...cam, roll: (cam.roll ?? 0) + silenceTilt * 0.015 }}>
          <HotLights />
          <DryStreet t={t} />
          {crowd}
          {walkers}
          {shot === "pov" ? (
            <FarCrowd t={tFrozen} spots={FAR_SPOTS} lookAt={g >= TURN + 4 ? POV : undefined} facing={Math.PI / 2} seed={21} />
          ) : null}
          {shot === "out" && g >= SILENCE - 2 ? (
            <group position={[0.4, 0, 14.6]} rotation={[0, -0.25, 0]}>
              <Tumbleweed t={(g - SILENCE + 2) / 30} speed={2.6} radius={0.42} />
            </group>
          ) : null}
          {shot !== "pov" ? (
            <Nubi size={2} position={nubiAt} rotationY={nubiRot} pose={pose} shadowOpacity={0.4}>
              <group {...BOTTLE_HUG}>
                <WaterBottle fill={1} glow={0.6} t={t} />
              </group>
            </Nubi>
          ) : null}
          {shot === "nubi" ? <SweatDrops frame={g} from={L12 + 10} to={AMIGOS} position={[nubiAt[0] - 0.3, 2.0, nubiAt[2]]} spread={1.1} /> : null}
          {shot === "pole" ? <DustPuff frame={g} at={RUN} position={[POLE_HIDE[0], Y, POLE_HIDE[2]]} radius={1.2} /> : null}
          {shot === "chase" ? <DustPuff frame={g} at={POLE - 2} position={[POLE_HIDE[0], Y, POLE_HIDE[2]]} radius={1.0} /> : null}
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
