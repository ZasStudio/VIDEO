import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, keyframes, ramp, windowIn } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import {
  DustMotes,
  EntranceHall,
  FallingDust,
  HALL,
  HALL_DOOR_OPEN,
  HALL_HOST,
  HALL_OUTSIDE,
  HallLights,
  HeldTorch,
  PressBadge,
  TVMic,
  dirTo,
  hallHandle,
  handheld,
} from "../../three/matusita/House";
import { finTipWorld } from "../../three/tiempo/Office";
import { RETO } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";
import { MATUSITA } from "../timeline";

// Shot "entrada" (RETO.START → END), camcorder footage from inside the hall, facing the door.
// A (→ SEMANA) the rusty door creaks open at OPEN: Nubi stands outside in the rain, backlit by the
//   orange street lamp; it hops in, flashlight on, mic in fin, PRENSA badge on its lanyard.
// B (SEMANA → SLAM) the cheesy TV host (L04): fins wide on "¡Una semana aquí!", a proud nod on
//   "Sin miedo", and on "Sin salir" it points its light back at the open door…
// C (SLAM → END) …which slams shut by itself: the orange light is cut, dust falls, the chandelier
//   swings, Nubi jumps and drops the mic. At RATTLE it tries the handle (locked), then turns back
//   to the camera for L05, deadpan (half-lidded eyes, a tiny shrug on "dignidad"); the camcorder
//   zooms in; on "linterna" its flashlight stutters and Nubi gives it a look.

const FPS = 30;
const SIZE = 2;
const BG = "#040508";
const FOV = 50;
const W = (i: number) => MATUSITA.wordAt("L04", i);
/** "Sin miedo." / the second "Sin" ("Sin salir.") / the "y" before "mi linterna". */
const MIEDO_W = W(3);
const SALIR_W = W(5);
const Y_W = MATUSITA.wordAt("L05", 9);

/** Where Nubi stands to try the handle: facing the door, the screen-left fin (finL) on it. */
const GRAB_POSE: NubiPose = { finL: 0.25 };
const GRAB_ROT = Math.PI;
const handle0 = hallHandle(0);
const grabTip = finTipWorld([0, 0, 0], GRAB_ROT, SIZE, GRAB_POSE, "L");
const GRAB: Vec3 = [handle0[0] - grabTip[0] - 0.05, 0, Math.max(-1.95, handle0[2] - grabTip[2] + 0.75)];
const CHANDELIER_AIM: Vec3 = [-0.35, 4.2, 1.4];

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const EntradaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.entrada.from;
  const t = g / FPS;
  const { START, OPEN, SEMANA, SLAM, RATTLE, L04, L05, DIGNIDAD, LINTERNA, END } = RETO;
  const HOP0 = OPEN + 9;
  const HOP1 = SEMANA - 1;
  const TURN_BACK = L05 + 2;

  // ---- The door -------------------------------------------------------------------------
  let door = keyframes(g, [OPEN, OPEN + 3, OPEN + 7, OPEN + 20], [0, -0.14, -0.17, HALL_DOOR_OPEN], EASE_IN_OUT);
  if (g >= SLAM - 4) {
    const k = ramp(g, SLAM - 4, SLAM, [0, 1], EASE_IN);
    door = HALL_DOOR_OPEN * (1 - k) - 0.05 * Math.sin(clamp01((g - SLAM) / 6) * Math.PI);
  }
  const rattle = windowIn(g, RATTLE + 7, TURN_BACK, 2);
  door += rattle * 0.012 * Math.sin(g * 2.6);
  const handle = rattle * (0.3 + 0.3 * Math.sin(g * 2.6));
  const streetK = clamp01(-door / 1.1);
  const swing = g >= SLAM ? 0.1 * Math.sin((g - SLAM) * 0.33) * Math.exp(-(g - SLAM) / 28) : 0.012 * Math.sin(t * 0.8);

  // ---- Nubi's path and turn ---------------------------------------------------------------
  const hopU = clamp01((g - HOP0) / (HOP1 - HOP0));
  let pos: Vec3 = lerp3(HALL_OUTSIDE, HALL_HOST, EASE_IN_OUT(hopU));
  pos[1] = mix(HALL_OUTSIDE[1], 0, clamp01(hopU * 1.6));
  let rotY = 0.08;
  const toDoor = ramp(g, RATTLE, RATTLE + 7, [0, 1], EASE_IN_OUT);
  const backU = ramp(g, TURN_BACK, TURN_BACK + 14, [0, 1], EASE_IN_OUT);
  if (g >= RATTLE) {
    pos = lerp3(HALL_HOST, GRAB, toDoor);
    rotY = mix(0.08, GRAB_ROT, toDoor);
    // Pulling at the handle.
    pos[2] += rattle * 0.05 * Math.sin(g * 2.6);
    // Turn back to the camera (the long way round: through screen-right) and step forward a little.
    rotY = mix(rotY, 0.12, backU);
    pos = lerp3(pos, [GRAB[0] + 0.2, 0, GRAB[2] + 0.55], ramp(g, TURN_BACK, TURN_BACK + 18, [0, 1], EASE_IN_OUT));
  }

  // ---- Nubi's pose ----------------------------------------------------------------------
  let base: NubiPose;
  let talk = 0;
  if (g < SLAM) {
    const hopping = hopU > 0 && hopU < 1;
    const hop = hopping ? 3.0 * Math.abs(Math.sin(hopU * Math.PI * 2)) : 0;
    const host = ramp(g, HOP1 - 2, SEMANA + 4, [0, 1], EASE_OUT);
    const wide = windowIn(g, SEMANA - 1, MIEDO_W - 6, 5);
    const nod = windowIn(g, MIEDO_W, MIEDO_W + 14, 4);
    const point = windowIn(g, SALIR_W - 2, SLAM - 1, 5);
    base = {
      hop: hop + 0.6 * windowIn(g, SEMANA - 1, SEMANA + 8, 3),
      squash: (hopping ? 1 + 0.12 * Math.cos(hopU * Math.PI * 4) : 1) * (1 + 0.04 * host),
      finL: mix(0.3, 0.6, host),
      finR: mix(0.15, 0.3, host) + 1.0 * wide - 0.35 * nod + 0.55 * point,
      pitch: -0.06 * host + 0.12 * nod,
      yaw: -0.25 * point,
      eyeScale: 1 + 0.15 * host,
      lookX: -0.25 * point,
      lookY: 0.1 * host,
      wiggle: hopping ? 0.7 : 0,
      wigglePhase: g * 0.6,
    };
    talk = g >= L04 ? 1.2 : 0;
  } else if (g < TURN_BACK) {
    const d = g - SLAM;
    const jump = d < 11 ? Math.sin((d / 11) * Math.PI) : 0;
    const land = windowIn(g, SLAM + 10, SLAM + 18, 3);
    const scared = 1 - ramp(g, RATTLE + 4, TURN_BACK, [0, 1]);
    base = {
      hop: 3.4 * jump,
      squash: 1 + 0.2 * jump - 0.16 * land,
      finL: mix(GRAB_POSE.finL ?? 0, 1.3, scared * (1 - toDoor)) + rattle * 0.15 * Math.sin(g * 2.6),
      finR: 1.2 * scared * (1 - toDoor) + 0.25 * toDoor,
      eyeScale: 1 + 0.55 * scared,
      roll: rattle * 0.045 * Math.sin(g * 2.6 + 0.6),
      wiggle: 0.8 * jump + 0.4 * rattle,
      wigglePhase: g * 0.8,
    };
  } else {
    // Deadpan: half-lidded eyes, drooping fins; a tiny shrug on "dignidad"; then the flashlight.
    const shrug = windowIn(g, DIGNIDAD - 2, DIGNIDAD + 16, 5);
    const look = windowIn(g, Y_W - 4, LINTERNA + 22, 6);
    const lift = windowIn(g, LINTERNA - 6, LINTERNA + 22, 6);
    base = {
      squash: 0.97,
      finL: -0.2 + 0.45 * shrug,
      finR: -0.05 + 0.45 * shrug + 0.65 * lift + 0.08 * lift * Math.sin(g * 2.9),
      hop: 0.35 * shrug,
      blink: 0.45,
      eyeScale: 0.96,
      lookX: 0.65 * look,
      lookY: 0.15 * look,
      pitch: 0.04,
    };
    talk = 0.55;
  }
  const pose = talk > 0 ? matusitaTalk(g, base, talk) : base;
  if (g >= TURN_BACK) pose.blink = Math.max(0.45, pose.blink ?? 0);
  if (g >= SLAM && g < TURN_BACK) pose.blink = 0;

  // ---- The flashlight (finR) ----------------------------------------------------------------
  const tip = finTipWorld(pos, rotY, SIZE, pose, "R");
  const floorAhead: Vec3 = [pos[0] + 1.3, 0, pos[2] + 2.4];
  let aimAt: Vec3 = floorAhead;
  if (g < SLAM) {
    const up = windowIn(g, SEMANA + 2, MIEDO_W - 4, 8);
    const back = windowIn(g, SALIR_W, SLAM + 2, 6);
    aimAt = lerp3(lerp3(floorAhead, CHANDELIER_AIM, up), [0.25, 1.6, HALL.zBack - 0.6], back);
  } else if (g < TURN_BACK) {
    const d = g - SLAM;
    aimAt = d < 10 ? [pos[0] + 1.2 * Math.sin(d * 0.9), 4.6, pos[2] + 1.5] : lerp3([pos[0] + 1.5, 1.0, pos[2] + 2], [handle0[0] - 0.3, 1.3, HALL.zBack], toDoor);
  } else {
    const lift = windowIn(g, LINTERNA - 6, LINTERNA + 22, 6);
    aimAt = lerp3([pos[0] + 1.6, 0, pos[2] + 1.8], [pos[0] + 1.4, 2.6, pos[2] + 2.2], lift);
  }
  // Power: steady, a jolt at the slam, the stutter on "linterna".
  let on = 1;
  if (g >= SLAM && g < SLAM + 6) on = [0.3, 1, 0.15, 0.7, 0.4, 1][g - SLAM];
  if (g >= LINTERNA - 1 && g < LINTERNA + 20) on = flicker(g, 5, 3.2) * (g < LINTERNA + 4 ? 0.2 : 1);
  if (g < OPEN + 4) on = 0.9;
  const torchDir = dirTo(tip, aimAt);
  const torchLen = 0.43;
  const lens: Vec3 = [tip[0] + torchDir[0] * torchLen, tip[1] + torchDir[1] * torchLen, tip[2] + torchDir[2] * torchLen];

  // ---- The microphone: held in finL until the slam, then it flies and clatters on the tiles ----
  const micTip0 = finTipWorld(HALL_HOST, 0.08, SIZE, { finL: 1.3 }, "L");
  const dropAge = (g - SLAM - 1) / FPS;
  const micFloor: Vec3 = [micTip0[0] - 0.55, 0.06, micTip0[2] + 0.75];
  let micWorld: { p: Vec3; r: Vec3 } | null = null;
  if (dropAge >= 0) {
    const T = 0.42;
    if (dropAge < T) {
      const u = dropAge / T;
      micWorld = {
        p: [mix(micTip0[0], micFloor[0], u), micTip0[1] + 0.25 + 2.2 * dropAge - 0.5 * 9.8 * dropAge * dropAge * 1.25, mix(micTip0[2], micFloor[2], u)],
        r: [u * 4.2, 0.3, u * 2.6],
      };
      micWorld.p[1] = Math.max(0.06, micWorld.p[1]);
    } else {
      const b = dropAge - T;
      const bounce = b < 0.18 ? Math.sin((b / 0.18) * Math.PI) * 0.08 : 0;
      micWorld = { p: [micFloor[0], micFloor[1] + bounce, micFloor[2]], r: [Math.PI / 2, 0.3, 2.6 + Math.min(b, 0.3) * 0.6] };
    }
  }

  // ---- Camera -----------------------------------------------------------------------------
  const shakeK = 1 + 0.8 * ramp(g, SLAM, SLAM + 6) * (1 - ramp(g, L05, L05 + 30));
  const wob = handheld(g, shakeK);
  const feet: Vec3 = [pos[0], Math.max(0, pos[1]), pos[2]];
  let cam: Cam;
  if (g < SEMANA) {
    const u = ramp(g, START, SEMANA, [0, 1], (x) => x);
    const p = lerp3([-0.6, 1.66, 9.2], [-0.5, 1.62, 8.5], u);
    const camPos: Vec3 = [p[0] + wob.pos[0], p[1] + wob.pos[1], p[2] + wob.pos[2]];
    const k = ramp(g, HOP0, HOP1, [0, 1], EASE_IN_OUT);
    const pt = lerp3([0.1, 0, HALL.zBack], HALL_HOST, k);
    cam = aim(camPos, FOV, [pt[0] + wob.look[0], pt[1] + wob.look[1], pt[2]], 540, mix(1170, 1262, k), 12, wob.roll);
  } else if (g < L05 + 6) {
    const u = ramp(g, SEMANA, L05, [0, 1], (x) => x);
    const p = lerp3([-0.5, 1.62, 8.5], [-0.4, 1.58, 7.8], u);
    const camPos: Vec3 = [p[0] + wob.pos[0], p[1] + wob.pos[1], p[2] + wob.pos[2]];
    cam = aim(camPos, FOV, [feet[0] + wob.look[0], feet[1] + wob.look[1], feet[2]], 560, 1262, 12, wob.roll);
  } else {
    // The camcorder zooms in on the deadpan face.
    const z = ramp(g, L05 + 6, L05 + 18, [0, 1], EASE_IN_OUT);
    const camPos: Vec3 = [-0.4 + wob.pos[0], 1.58 + wob.pos[1], 7.8 + wob.pos[2]];
    const eyes: Vec3 = [pos[0] + wob.look[0], 1.1 + wob.look[1], pos[2]];
    const wide = aim(camPos, FOV, [feet[0] + wob.look[0], feet[1] + wob.look[1], feet[2]], 560, 1262, 12, wob.roll);
    const close = aim(camPos, 36, eyes, 540, 800, 12, wob.roll);
    cam = z <= 0 ? wide : { position: camPos, target: lerp3(wide.target, close.target, z), fov: mix(FOV, 36, z), roll: wob.roll };
  }

  // On-camera light: a small lamp on the camcorder.
  const camLight = useMemo(() => new THREE.Object3D(), []);
  const camLamp: Vec3 = [cam.position[0] + 0.15, cam.position[1] - 0.12, cam.position[2] + 0.2];
  const lampAt: Vec3 = [pos[0], 1.3, pos[2] - 0.5];

  // Beams for the dust: the flashlight, and the street light through the door.
  const beam = { from: lens, dir: torchDir, angle: 0.3, reach: 7, on: on * 0.9 };
  const street = { from: [0.3, 3.4, HALL.zBack - 4.5] as Vec3, dir: dirTo([0.3, 3.4, HALL.zBack - 4.5], [0.1, 0, 0.6]), angle: 0.28, reach: 11, on: streetK * 0.8 };

  const mic = (
    <Upright raise={pose.finL ?? 0} side="L">
      <group position={[0.1, 0.1, 1.1]} rotation={[0.15, 0, -0.35]}>
        <TVMic />
      </group>
    </Upright>
  );

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Shake frame={g} impacts={[{ at: SLAM, amp: 22, dur: 14 }, { at: RATTLE + 8, amp: 4, dur: 10 }]}>
        <Stage cam={cam} near={0.05}>
          <HallLights street={streetK} />
          <spotLight position={camLamp} target={camLight} angle={0.6} penumbra={1} intensity={9} distance={0} decay={1.1} color="#E2E8FF" />
          <primitive object={camLight} position={lampAt} />
          <EntranceHall t={t} door={door} handle={handle} swing={swing} />
          <Nubi size={SIZE} position={pos} rotationY={rotY} pose={pose} shadowOpacity={0.55} holdL={g < SLAM + 1 ? mic : undefined}>
            <PressBadge swing={0.05 * Math.sin(t * 3) + 0.1 * windowIn(g, SLAM, SLAM + 14, 3) * Math.sin(g * 1.2)} />
          </Nubi>
          {micWorld ? (
            <group position={micWorld.p} rotation={micWorld.r} scale={SIZE / 10}>
              <group position={[0, -1.3, 0]}>
                <TVMic />
              </group>
            </group>
          ) : null}
          <HeldTorch from={tip} to={aimAt} on={on} reach={8} intensity={70} beam={0.26} scale={1.3} />
          <DustMotes t={t} min={[-3.2, 0.2, -2.9]} max={[3.2, 4.6, 4.2]} beam={beam} beam2={street} count={520} />
          <FallingDust age={(g - SLAM) / FPS} center={[0, HALL.height, HALL.zBack + 0.9]} area={[3.4, 1.6]} ceiling={HALL.height} />
          <FallingDust age={(g - SLAM - 2) / FPS} center={[0.1, 3.9, HALL.zBack + 0.2]} area={[2.0, 0.4]} ceiling={4.4} count={50} />
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
