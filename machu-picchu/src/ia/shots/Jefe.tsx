import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import {
  BOSS_AT,
  BOSS_RY,
  BOSS_SIZE,
  Boss,
  BossMug,
  MAX_CUPS,
  MONITOR_AT,
  MONITOR_RY,
  MONITOR_SCREEN,
  OfficeLights,
  OfficeSet,
  PaperCup,
  WORKER_AT,
  WORKER_RY,
  Worker,
} from "../../three/ia/Work";
import { mixHex } from "../../three/tiempo/Office";
import { JEFE } from "../beats";
import { SHOTS } from "../shots";
import { jefeTalk, trabajadorTalk } from "../talk";

// Shot "jefe" (JEFE.START → END), the office, with internal cuts:
// A (START → SLIDES) two-shot: the boss leans on the worker's desk sipping coffee and asks for
//   «una presentación rapidita» (L07); the worker looks up.
// B (SLIDES → COFFEE1) over the worker's head onto his monitor, almost square-on (the 2D layer
//   draws "Diapositiva 1 de 40" on it); Nubi's L08 plays over a slow push-in.
// C the montage, one cut each: COFFEE1 he gulps a coffee; COFFEE2 more cups, more wrecked, a cup
//   in each fin; SUNRISE the window floods the office orange, he is a slumped wreck.
// D (L09 → STARE) the two-shot again, morning: «¿Para cuándo la quería?» / «Era para ayer.»
// E (STARE → END) the worker stares straight into the camera, deadpan, tiny push-in.

const FPS = 30;
const HOLD: Vec3 = [0.2, -1.45, 0.55];

const typing = (g: number, speed: number, phase = 0): NubiPose => {
  const ph = (g / FPS) * 11 * speed + phase;
  return {
    finL: -0.3 - 0.35 * Math.max(0, Math.sin(ph)),
    finR: -0.3 - 0.35 * Math.max(0, Math.sin(ph + Math.PI * 0.9)),
    hop: 0.08 * Math.max(0, Math.sin(ph * 0.5)),
    pitch: 0.06,
    lookX: -0.2,
    lookY: -0.3,
  };
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const eyesOf = (p: Vec3, size = 2): Vec3 => [p[0], p[1] + 0.56 * size, p[2]];

export const JefeShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.jefe.from;
  const { START, END, L07, RAPIDITA, SLIDES, COFFEE1, COFFEE2, SUNRISE, L09, L10, STARE } = JEFE;
  const t = g / FPS;

  // ---- Time of day: night until the sunrise cut, then the window floods orange -----------
  const sun = g < SUNRISE ? 0 : ramp(g, SUNRISE, SUNRISE + 10, [0, 1], EASE_OUT);
  const night = g >= SLIDES && g < SUNRISE ? 1 : 0.4;
  const cups = g < COFFEE1 ? 1 : g < COFFEE2 ? 3 : g < SUNRISE ? 7 : MAX_CUPS;
  const cupPop = g < COFFEE1 ? 1 : pop(g, g < COFFEE2 ? COFFEE1 : g < SUNRISE ? COFFEE2 : SUNRISE);

  // ---- The worker -------------------------------------------------------------------------
  let wPose: NubiPose;
  let wRy = WORKER_RY;
  let droop = 0.3;
  let bags = 0.7;
  let wHoldR: React.ReactNode = null;
  let wHoldL: React.ReactNode = null;
  const cup = (tilt = 0) => (
    <group position={HOLD} scale={5} rotation={[0, 0, tilt]}>
      <PaperCup />
    </group>
  );
  if (g < SLIDES) {
    const up = ramp(g, L07 + 10, L07 + 18, [0, 1], EASE_OUT);
    const wince = keyframes(g, [RAPIDITA, RAPIDITA + 4, RAPIDITA + 14], [0, 1, 0.4]);
    const ty = typing(g, 0.8);
    wPose = {
      ...ty,
      finL: mix(ty.finL ?? 0, -0.15, up),
      finR: mix(ty.finR ?? 0, -0.15, up),
      lookX: mix(-0.2, 0.55, up),
      lookY: mix(-0.3, 0.3, up),
      squash: 1 - 0.06 * wince,
      eyeScale: 1 + 0.12 * wince,
      blink: 0.25,
    };
    wRy = mix(WORKER_RY, 0.55, up);
  } else if (g < COFFEE1) {
    // Back to the screen: slow, defeated typing.
    wPose = { ...typing(g, 0.5), blink: 0.35, squash: 0.97 };
    droop = 0.4;
    wHoldR = null;
  } else if (g < COFFEE2) {
    // Gulp: the cup goes up, eyes squeezed, head back.
    const d = g - COFFEE1;
    const lift = ramp(g, COFFEE1, COFFEE1 + 5, [0, 1], EASE_OUT);
    wPose = {
      finR: 1.45 * lift,
      finL: -0.2,
      pitch: -0.28 * lift,
      blink: 0.85,
      squash: 1 + 0.04 * Math.sin(d * 1.4),
      hop: 0.15 * Math.abs(Math.sin(d * 0.9)),
    };
    wRy = -0.15;
    droop = 0.4;
    bags = 0.9;
    wHoldR = cup(0.15);
  } else if (g < SUNRISE) {
    // Caffeinated: a cup in each fin, vibrating, eyes too wide.
    const d = g - COFFEE2;
    wPose = {
      finR: 0.55 + 0.1 * Math.sin(d * 3.1),
      finL: 0.5 + 0.1 * Math.sin(d * 2.7 + 1),
      roll: 0.05 * Math.sin(d * 4.3),
      hop: 0.1 * Math.abs(Math.sin(d * 3.7)),
      eyeScale: 1.32 + 0.06 * Math.sin(d * 5.1),
      lookX: 0.15 * Math.sin(d * 2.2),
      lookY: 0.1,
      blink: 0,
    };
    wRy = 0.2;
    droop = 0.15;
    bags = 1.25;
    wHoldR = (
      <Upright raise={wPose.finR ?? 0}>
        <group position={HOLD} scale={5}>
          <PaperCup />
        </group>
      </Upright>
    );
    wHoldL = (
      <Upright raise={wPose.finL ?? 0} side="L">
        <group position={HOLD} scale={5}>
          <PaperCup />
        </group>
      </Upright>
    );
  } else if (g < L09) {
    // Sunrise: a slumped wreck.
    const d = g - SUNRISE;
    wPose = { squash: 0.84, roll: 0.14, pitch: 0.12, finL: -0.55, finR: -0.55, blink: 0.55, lookY: -0.3, hop: 0, yaw: 0.04 * Math.sin(d * 0.2) };
    wRy = -0.1;
    droop = 0.7;
    bags = 1.4;
  } else if (g < STARE) {
    const base: NubiPose = { squash: 0.88, roll: 0.08, finL: -0.5, finR: -0.5, blink: 0.45, lookX: 0.45, lookY: 0.15 };
    // After «Era para ayer» the worker freezes.
    const shock = ramp(g, L10 + 12, L10 + 18);
    wPose = trabajadorTalk(g, base, 0.7);
    wPose = { ...wPose, eyeScale: 1 + 0.1 * shock };
    wRy = 0.5;
    droop = 0.6;
    bags = 1.4;
  } else {
    // The stare: dead still, straight down the lens.
    wPose = { squash: 0.9, finL: -0.5, finR: -0.5, blink: 0.42, lookX: 0, lookY: 0.05 };
    wRy = 0.05;
    droop = 0.55;
    bags = 1.4;
  }

  // ---- The boss -----------------------------------------------------------------------------
  const bossIn = g < SLIDES || (g >= L09 && g < STARE);
  let bPose: NubiPose = {};
  if (bossIn) {
    // Relaxed lean on the desk; sips between lines.
    const s0 = g < SLIDES ? START : L09;
    const sip = g < SLIDES ? keyframes(g, [s0, s0 + 3, L07 - 1, L07 + 4], [0.6, 1, 1, 0]) : keyframes(g, [L09 + 6, L09 + 12, L10 - 6, L10], [0, 1, 1, 0]);
    const sip2 = g >= SLIDES ? keyframes(g, [L10 + 22, L10 + 28], [0, 1]) : 0;
    const k = Math.max(sip, sip2);
    const base: NubiPose = {
      pitch: mix(0.1, -0.16, k),
      roll: 0.1,
      finL: -0.35,
      finR: mix(0.45, 1.25, k),
      lookX: -0.35,
      lookY: 0.05,
      blink: 0.15 * k,
    };
    bPose = jefeTalk(g, base, 0.9);
  }
  const mug = (
    <Upright raise={bPose.finR ?? 0}>
      <group position={HOLD} scale={10 / BOSS_SIZE}>
        <BossMug />
      </group>
    </Upright>
  );

  // ---- Cameras ------------------------------------------------------------------------------
  const wEyes = eyesOf(WORKER_AT);
  const mid: Vec3 = [1.25, 1.0, -2.2];
  let cam: Cam;
  if (g < SLIDES) {
    const u = ramp(g, START, SLIDES, [0, 1], (x) => x);
    cam = aim(lerp3([0.9, 3.3, 11.4], [1.0, 3.2, 10.8], u), 40, mid, 500, 960);
  } else if (g < COFFEE1) {
    // Over the worker's head onto the monitor, nearly square-on.
    const u = ramp(g, SLIDES, COFFEE1, [0, 1], EASE_IN_OUT);
    const scr: Vec3 = [MONITOR_AT[0], MONITOR_AT[1] + MONITOR_SCREEN.y, MONITOR_AT[2]];
    const n: Vec3 = [Math.sin(MONITOR_RY), 0, Math.cos(MONITOR_RY)];
    // Beside the worker's head (p: sideways, towards the open side of the office).
    const p: Vec3 = [-n[2], 0, n[0]];
    const dist = mix(3.1, 2.85, u);
    const side = mix(1.4, 1.3, u);
    const pos: Vec3 = [scr[0] + n[0] * dist + p[0] * side, scr[1] + mix(0.9, 0.85, u), scr[2] + n[2] * dist + p[2] * side];
    cam = aim(pos, 40, scr, 520, 660);
  } else if (g < COFFEE2) {
    const u = ramp(g, COFFEE1, COFFEE2, [0, 1], (x) => x);
    cam = aim(lerp3([1.6, 2.3, 4.6], [1.5, 2.25, 4.1], u), 40, wEyes, 500, 900);
  } else if (g < SUNRISE) {
    const u = ramp(g, COFFEE2, SUNRISE, [0, 1], (x) => x);
    cam = aim(lerp3([0.6, 1.9, 3.6], [0.58, 1.85, 3.1], u), 40, wEyes, 540, 880);
  } else if (g < L09) {
    const u = ramp(g, SUNRISE, L09, [0, 1], (x) => x);
    cam = aim(lerp3([0.2, 1.9, 5.6], [0.2, 1.85, 5.2], u), 40, wEyes, 560, 1020);
  } else if (g < STARE) {
    const u = ramp(g, L09, STARE, [0, 1], EASE_IN_OUT);
    cam = aim(lerp3([0.9, 3.2, 11.0], [1.05, 3.1, 10.2], u), 40, mid, 500, 960);
  } else {
    const u = ramp(g, STARE, END, [0, 1], (x) => x);
    cam = aim(lerp3([0.2, 1.65, 2.9], [0.2, 1.63, 2.55], u), 40, wEyes, 540, 860);
  }

  // Over-the-shoulder cheat: in B the worker steps a little aside (away from the camera), so his
  // head frames the monitor instead of hiding it.
  const inB = g >= SLIDES && g < COFFEE1;
  const workerAt: Vec3 = inB ? [WORKER_AT[0] + 0.62 * Math.cos(MONITOR_RY), 0, WORKER_AT[2] - 0.62 * Math.sin(MONITOR_RY)] : WORKER_AT;
  const bg = mixHex("#BFC8DA", "#FFC9A0", sun);
  const boss = bossIn ? <Boss position={BOSS_AT} rotationY={BOSS_RY} pose={bPose} holdR={mug} smug={0.4} /> : null;
  return (
    <AbsoluteFill style={{ background: bg }}>
      <Shake frame={g} impacts={[{ at: SUNRISE, amp: 4, dur: 8 }]}>
        <Stage cam={cam} near={0.1}>
          <OfficeLights sun={sun} night={night} />
          <OfficeSet sun={sun} cups={cups} cupPop={cupPop} t={t} front={g >= SLIDES && g < COFFEE1} />
          <Worker position={workerAt} rotationY={wRy} pose={wPose} droop={droop} bags={bags} holdR={wHoldR} holdL={wHoldL} shadowOpacity={0.25} />
          {boss}
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
