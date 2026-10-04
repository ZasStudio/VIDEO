import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, keyframes, ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  CORRIDOR,
  CORRIDOR_STAIRS_TOP,
  CORRIDOR_WINDOW_C,
  Corridor,
  CorridorLights,
  DustMotes,
  FallingDust,
  HeldTorch,
  PressBadge,
  ShadowFigure,
  WallShadows,
  dirTo,
  handheld,
} from "../../three/matusita/House";
import { finTipWorld } from "../../three/tiempo/Office";
import { MIEDO } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";

// Shot "pasillo" (MIEDO.START → END), camcorder footage in the long hallway.
// A (→ STEPS + 8) behind Nubi, looking down the hallway (photos on the left, the staircase on the
//   right, the moonlit window at the end). THUMP: a heavy thump upstairs, dust rains from the
//   ceiling, Nubi flinches and its light jumps up the staircase into the dark; then it lowers it
//   and creeps on. ADELANTE: the light sweeps ahead — photos, stairs, window: nobody. STEPS:
//   footsteps behind; Nubi freezes.
// B (→ END) the camcorder, beside it, frames Nubi against the photo wall; the little lamp on the
//   camcorder throws Nubi's shadow on the wall. L07: Nubi turns slowly to look behind (at us).
//   SHADOW: the lamp stutters and, beside Nubi's shadow, there is a second, taller one that
//   belongs to nobody; it leans in and reaches towards Nubi's shadow while Nubi stays frozen.
//   RUN: Nubi bolts out of frame; the tall shadow stays a beat longer.

const FPS = 30;
const SIZE = 2;
const BG = "#030407";
const FOV = 50;
/** Nubi's walk down the hallway (start, stop). */
const P0: Vec3 = [-0.85, 0, 1.7];
const P1: Vec3 = [-1.0, 0, -1.4];
/** The camcorder for part B (beside the right wall, looking at the photo wall). */
const CAM_B: Vec3 = [3.3, 1.45, 3.4];
/** Where the owner of the second shadow would stand (nobody is there). */
const STRANGER: Vec3 = [-1.85, 0, -3.3];
const FACE_CAM = Math.atan2(CAM_B[0] - P1[0], CAM_B[2] - P1[2]);

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
/** Piecewise path through points at frames (eased between each pair). */
const path = (g: number, frames: number[], pts: Vec3[]): Vec3 => [0, 1, 2].map((i) => keyframes(g, frames, pts.map((p) => p[i]), EASE_IN_OUT)) as Vec3;

export const PasilloShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.pasillo.from;
  const t = g / FPS;
  const { START, END, THUMP, L06, ADELANTE, STEPS, L07, SHADOW, RUN } = MIEDO;
  const CUT = STEPS + 8;
  const WALK0 = L06 + 24;
  const B = g >= CUT;

  // ---- Where Nubi is, where it faces -----------------------------------------------------------
  const walkU = ramp(g, WALK0, STEPS, [0, 1], (x) => x);
  const walking = g > WALK0 && g < STEPS;
  const phase = (g - WALK0) * 0.3;
  const runU = ramp(g, RUN, RUN + 9, [0, 1], EASE_IN);
  let pos: Vec3 = lerp3(P0, P1, walkU * walkU * (3 - 2 * walkU) * 0.35 + walkU * 0.65);
  if (g >= RUN) pos = lerp3(P1, [P1[0] + 0.9, 0, P1[2] + 5.2], runU);
  const flinchTurn = ramp(g, THUMP + 1, THUMP + 5, [0, 1], EASE_OUT) * (1 - ramp(g, L06 + 18, L06 + 40, [0, 1], EASE_IN_OUT));
  const turn = ramp(g, L07 - 2, SHADOW - 4, [0, 1], EASE_IN_OUT);
  let rotY = Math.PI - 0.6 * flinchTurn;
  if (B) rotY = mix(Math.PI, FACE_CAM, turn);
  if (g >= RUN) rotY = mix(FACE_CAM, 0.15, ramp(g, RUN, RUN + 4));

  // ---- Pose -----------------------------------------------------------------------------------
  const dThump = g - THUMP;
  const jump = dThump >= 0 && dThump < 9 ? Math.sin((dThump / 9) * Math.PI) : 0;
  const land = windowIn(g, THUMP + 8, THUMP + 15, 2);
  const startled = windowIn(g, THUMP, L06 + 36, 4);
  const frozen = ramp(g, STEPS - 2, STEPS + 4);
  const tremble = Math.sin(g * 2.3) * 0.5 + Math.sin(g * 3.7) * 0.5;
  const dread = ramp(g, SHADOW - 2, SHADOW + 6);
  const glance = ramp(g, RUN - 11, RUN - 5, [0, 1], EASE_IN_OUT);
  let base: NubiPose = {
    hop: 2.2 * jump + (walking ? 0.3 * Math.abs(Math.sin(phase)) : 0),
    squash: 1 + 0.14 * jump - 0.12 * land - (walking ? 0.03 * Math.abs(Math.sin(phase)) : 0) - 0.06 * frozen - 0.04 * dread,
    finL: -0.1 + 0.9 * jump - 0.25 * startled - 0.25 * frozen - 0.15 * dread,
    finR: 0.35 + 0.5 * flinchTurn - 0.1 * frozen,
    roll: (walking ? 0.03 * Math.sin(phase) : 0) + (0.015 * frozen + 0.01 * dread) * tremble,
    eyeScale: 1 + 0.45 * startled + 0.25 * frozen + 0.12 * dread,
    lookY: 0.4 * flinchTurn,
    lookX: 0.85 * glance,
    wiggle: walking ? 0.5 : 0.25 * jump,
    wigglePhase: phase * 2,
  };
  if (g >= RUN) {
    const r = clamp01((g - RUN) / 8);
    base = {
      hop: 1.4 * Math.abs(Math.sin((g - RUN) * 0.7)),
      squash: 1.12,
      finL: 1.1,
      finR: 1.2,
      eyeScale: 1.6,
      lookX: 0.85 * (1 - r),
      wiggle: 1,
      wigglePhase: g * 1.2,
      pitch: 0.18,
    };
  }
  const talk = g >= L07 && g < SHADOW ? 0.5 : g >= L06 && g < STEPS ? 0.3 : 0;
  const pose = talk > 0 ? matusitaTalk(g, base, talk) : base;
  if (g >= STEPS - 2 && g < RUN) pose.blink = 0;

  // ---- The flashlight (finR) --------------------------------------------------------------------
  const tip = finTipWorld(pos, rotY, SIZE, pose, "R");
  const ahead: Vec3 = [pos[0] + 0.45, 0.15, pos[2] - 6.5];
  const shiver: Vec3 = [0.06 * Math.sin(g * 1.9), 0.05 * Math.sin(g * 2.7), 0];
  let aimAt: Vec3 = ahead;
  if (!B) {
    const up = ramp(g, THUMP + 1, THUMP + 4, [0, 1], EASE_OUT) * (1 - ramp(g, L06 + 14, L06 + 42, [0, 1], EASE_IN_OUT));
    aimAt = lerp3(ahead, add(CORRIDOR_STAIRS_TOP, shiver, 1.5), up);
    if (g >= ADELANTE - 2) {
      const win: Vec3 = [CORRIDOR_WINDOW_C[0], CORRIDOR_WINDOW_C[1] - 0.5, CORRIDOR_WINDOW_C[2] + 0.6];
      aimAt = add(path(g, [ADELANTE - 2, ADELANTE + 9, ADELANTE + 21, ADELANTE + 33], [ahead, [-2.3, 2.0, -6.6], [1.3, 0.8, -6.8], win]), shiver, frozen);
    }
  } else if (g < RUN) {
    const face: Vec3 = [Math.sin(rotY), 0, Math.cos(rotY)];
    aimAt = add([pos[0] + face[0] * 2.6, 0.05, pos[2] + face[2] * 2.6], shiver, 1 + dread);
  } else {
    aimAt = [pos[0] + Math.sin(g * 0.9) * 2, 1.2 + Math.sin(g * 1.3) * 1.4, pos[2] + 3];
  }
  let on = 1;
  if (dThump >= 0 && dThump < 6) on = [0.4, 1, 0.2, 0.8, 0.5, 1][dThump];
  // The camcorder's own little lamp; it stutters when the second shadow arrives.
  let lamp = 1;
  const dS = g - SHADOW;
  if (dS >= -3 && dS < 5) {
    lamp = [0.4, 0.08, 0.55, 0.05, 0.3, 0.9, 0.7, 1][dS + 3];
    on = Math.min(on, 0.35 + 0.65 * lamp);
  }
  const torchDir = dirTo(tip, aimAt);
  const lens = add(tip, torchDir, 0.45);

  // ---- Cameras ------------------------------------------------------------------------------------
  let cam: Cam;
  if (!B) {
    const wob = handheld(g, 1.1);
    const camPos: Vec3 = [pos[0] + 2.0 + wob.pos[0], 1.95 + wob.pos[1], pos[2] + 6.8 + wob.pos[2]];
    cam = aim(camPos, FOV, [pos[0] + wob.look[0], wob.look[1], pos[2]], 430, 1258, 12, wob.roll);
  } else {
    const wob = handheld(g, 1.6 + 0.8 * dread);
    const camPos = add(CAM_B, wob.pos);
    cam = aim(camPos, FOV, [P1[0] + wob.look[0], wob.look[1], P1[2]], 330, 1258, 12, wob.roll);
  }
  const fwd = dirTo(cam.position, cam.target);
  const flat = Math.hypot(fwd[0], fwd[2]) || 1;
  const f2: Vec3 = [fwd[0] / flat, 0, fwd[2] / flat];
  const left: Vec3 = [f2[2], 0, -f2[0]];
  // The camcorder lamp sits behind and below the lens (B: also off to the left), so the shadows it
  // throws land beside Nubi on the photo wall.
  const lampPos: Vec3 = B ? add(add(add(cam.position, f2, -1.2), left, 0.9), [0, -0.75, 0]) : add(add(cam.position, f2, -0.9), [0.2, -0.35, 0]);
  const lampTarget = useMemo(() => new THREE.Object3D(), []);
  const lampAim: Vec3 = B ? [CORRIDOR.x0, 1.6, -3.0] : [pos[0], 0.9, pos[2] - 2];

  // ---- The shadows on the photo wall ------------------------------------------------------------
  const figures: ShadowFigure[] = [{ kind: "nubi", position: pos, rotationY: rotY, size: SIZE, pose, torch: [tip, lens] }];
  if (B && g >= SHADOW) {
    const lean = 0.24 * ramp(g, SHADOW + 4, RUN - 2, [0, 1], EASE_IN_OUT) - 0.08 * ramp(g, RUN + 3, END, [0, 1], EASE_IN_OUT);
    figures.push({
      kind: "stranger",
      position: add(STRANGER, [0, 0, -0.5 * (1 - ramp(g, SHADOW, SHADOW + 7, [0, 1], EASE_OUT))]),
      height: 3.5,
      lean,
      bend: 0.38 * ramp(g, SHADOW + 8, RUN, [0, 1], EASE_IN_OUT),
      reach: ramp(g, SHADOW + 10, RUN + 2, [0, 1], EASE_IN_OUT) * (1 - 0.6 * ramp(g, RUN + 6, END)),
      side: -1,
      breathe: 0.012 * Math.sin(t * 2.2),
    });
  }
  // Nubi's flashlight washes the shadow out where it hits the wall.
  const fill: { at: Vec3; radius: number; strength: number }[] = [];
  if (torchDir[0] < -0.05) {
    const s = (CORRIDOR.x0 - lens[0]) / torchDir[0];
    if (s > 0 && s < 9) fill.push({ at: add(lens, torchDir, s), radius: 0.3 + s * 0.32, strength: on * 0.85 });
  }

  // ---- Dust: the flashlight beam and the moonlight from the end window ----------------------------
  const beam = { from: lens, dir: torchDir, angle: 0.3, reach: 10, on: on * 0.9 };
  const moonFrom: Vec3 = [CORRIDOR_WINDOW_C[0], CORRIDOR_WINDOW_C[1], CORRIDOR.zEnd];
  const moon = { from: moonFrom, dir: dirTo(moonFrom, [CORRIDOR_WINDOW_C[0] + 0.2, 0, CORRIDOR.zEnd + 3.6]), angle: 0.25, reach: 6, on: 0.8 };

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Shake frame={g} impacts={[{ at: THUMP, amp: 18, dur: 14 }, { at: RUN, amp: 8, dur: 10 }, { at: SHADOW, amp: 3, dur: 6 }]}>
        <Stage cam={cam} near={0.05}>
          <CorridorLights />
          <spotLight position={lampPos} target={lampTarget} angle={B ? 0.55 : 0.5} penumbra={0.75} intensity={(B ? 30 : 16) * lamp} distance={0} decay={1.25} color="#E4E8F4" />
          <primitive object={lampTarget} position={lampAim} />
          <Corridor />
          <WallShadows wallX={CORRIDOR.x0} z0={6} z1={-10} height={CORRIDOR.height} light={lampPos} figures={figures} opacity={(B ? 0.86 : 0.6) * lamp} blur={0.045} fill={fill} />
          <Nubi size={SIZE} position={pos} rotationY={rotY} pose={pose} shadowOpacity={0.5}>
            <PressBadge swing={0.05 * Math.sin(t * 3.1) + 0.12 * jump} />
          </Nubi>
          <HeldTorch from={tip} to={aimAt} on={on} reach={12} intensity={90} beam={0.24} scale={1.3} />
          <DustMotes t={t} min={[-2.3, 0.1, -13]} max={[2.3, 4.4, 4.5]} beam={beam} beam2={moon} count={650} />
          <FallingDust age={(g - THUMP) / FPS} center={[pos[0] + 0.4, CORRIDOR.height, pos[2] - 1.2]} area={[3.2, 3.0]} ceiling={CORRIDOR.height} count={110} />
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
