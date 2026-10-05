import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, keyframes, pop, ramp } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { BED_DESK, Bedroom, BedroomLights, LAPTOP_AT, LAPTOP_RY, Laptop, STUDENT_AT, STUDENT_RY, Student, SweatDrops } from "../../three/ia/Work";
import { mixHex } from "../../three/tiempo/Office";
import { TAREA } from "../beats";
import { SHOTS } from "../shots";
import { estudianteTalk } from "../talk";

// Shot "tarea" (TAREA.START → END): 11:58 P.M., the student's desk at night (the 2D layer draws
// the «11:58 P. M. — ENTREGA: 12:00» badge in the top band, the error card and the typed words).
// A (START → L05) wide: he types his request to the AI, confident; at ERROR the laptop's light on
//   his face flashes red and he recoils, horrified.
// B (L05 → TYPE) the camera pushes in on his panic: fins on his head, sweat drops flying; on
//   AHORA he glances at the wall clock.
// C (TYPE → END) medium-wide again (clock visible): frantic typing; at L06 he jumps up proudly,
//   fins raised («¡Ya tengo cuatro palabras!»); at MIDNIGHT the clock hits 12:00 and he face-plants
//   on the desk (thud, books jump).

const FPS = 30;
const SCREEN_CHAT = "#DCE8FF";
const SCREEN_RED = "#FF3B3B";
const SCREEN_DOC = "#F6F7FF";

/** Fins tapping on the keyboard, eyes on the laptop. */
const typing = (g: number, speed: number, phase = 0): NubiPose => {
  const ph = (g / FPS) * 11 * speed + phase;
  return {
    finL: -0.25 - 0.45 * Math.max(0, Math.sin(ph)),
    finR: -0.25 - 0.45 * Math.max(0, Math.sin(ph + Math.PI * 0.9)),
    hop: 0.12 * Math.max(0, Math.sin(ph * 0.5)) * Math.min(2.5, speed),
    pitch: 0.06,
    lookX: -0.15,
    lookY: -0.35,
  };
};

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const TareaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.tarea.from;
  const { START, END, ERROR, L05, AHORA, TYPE, L06, MIDNIGHT } = TAREA;
  const t = g / FPS;

  // ---- Clock: 11:58:00 at START, 12:00:00 exactly at MIDNIGHT --------------------------------
  const seconds = g < MIDNIGHT ? (120 * (g - START)) / (MIDNIGHT - START) : 120 + (g - MIDNIGHT) / FPS;
  const ring = g >= MIDNIGHT ? 1 - clamp01((g - MIDNIGHT) / 16) : 0;

  // ---- Face-plant: tips forward over the desk edge, bounces once, lies still -----------------
  const FALL = MIDNIGHT + 3;
  const HIT = MIDNIGHT + 8;
  const fall =
    g < FALL ? 0 : g < HIT ? 1.32 * ramp(g, FALL, HIT, [0, 1], EASE_IN) : keyframes(g, [HIT, HIT + 3, HIT + 7], [1.32, 1.18, 1.3], EASE_IN_OUT);
  const thud = g >= HIT ? Math.abs(Math.sin((g - HIT) * 0.55)) * Math.exp(-(g - HIT) * 0.22) : 0;

  // ---- The student ---------------------------------------------------------------------------
  let pose: NubiPose;
  let ry = STUDENT_RY;
  let back = 0;
  if (g < ERROR) {
    // Confident typing, a little bounce; a cheeky "Enter" with the right fin just before ERROR.
    const ty = typing(g, 1.1);
    const enter = keyframes(g, [ERROR - 7, ERROR - 4, ERROR - 1], [0, 1, 0]);
    pose = { ...ty, finR: mix(ty.finR ?? 0, 0.55, enter), hop: (ty.hop ?? 0) + 0.25 * Math.abs(Math.sin(t * 6)), eyeScale: 0.92, pitch: -0.04 };
  } else if (g < L05) {
    const k = pop(g, ERROR + 1, { damping: 9, stiffness: 220 });
    const d = g - ERROR;
    pose = {
      hop: 1.6 * Math.exp(-d * 0.18) * Math.abs(Math.sin(d * 0.35)) + 0.2,
      squash: 1 + 0.16 * Math.exp(-d * 0.15),
      finL: 0.95 * k,
      finR: 0.95 * k,
      pitch: -0.2 * k,
      roll: 0.03 * Math.sin(g * 1.9),
      eyeScale: 1 + 0.45 * k,
      lookX: -0.25,
      lookY: -0.15,
    };
    back = 0.16 * k;
  } else if (g < TYPE) {
    // Panic: fins clutch his head, eyes huge, trembling; glances at the clock on "ahora sí".
    const clutch = ramp(g, L05, L05 + 10, [0, 1], EASE_OUT);
    const glance = keyframes(g, [AHORA - 4, AHORA + 2, AHORA + 26, AHORA + 32], [0, 1, 1, 0]);
    pose = {
      hop: 0.25 + 0.15 * Math.abs(Math.sin(g * 1.3)),
      squash: 0.96 + 0.04 * Math.sin(g * 0.9),
      finL: mix(0.95, 2.05, clutch) + 0.08 * Math.sin(g * 1.7),
      finR: mix(0.95, 2.05, clutch) + 0.08 * Math.sin(g * 1.9 + 1),
      roll: 0.045 * Math.sin(g * 1.6),
      pitch: mix(-0.2, -0.05, clutch),
      yaw: mix(0, 0.42, glance),
      eyeScale: 1.38 + 0.08 * glance,
      lookX: mix(-0.2, -0.85, glance),
      lookY: mix(-0.1, 0.6, glance),
    };
    back = 0.16 * (1 - clutch * 0.6);
  } else if (g < L06) {
    // Frantic typing, leaning in.
    const ty = typing(g, 3.4, 0.4);
    const lean = ramp(g, TYPE, TYPE + 6);
    pose = { ...ty, pitch: 0.16 * lean, eyeScale: 1.25, roll: 0.03 * Math.sin(g * 2.3), squash: 0.97 };
    back = 0.06 * (1 - lean);
  } else {
    // «¡Ya tengo cuatro palabras!»: turns to the camera, jumps up, fins raised, chest out.
    const up = pop(g, L06, { damping: 8, stiffness: 160 });
    const proud = ramp(g, L06, L06 + 6);
    const freeze = ramp(g, MIDNIGHT - 1, MIDNIGHT + 2);
    const base: NubiPose = {
      hop: 1.4 * Math.max(0, Math.sin(Math.min(Math.PI, ((g - L06) / 14) * Math.PI))) + 0.15,
      squash: 1 + 0.08 * up,
      finL: 1.25 * up,
      finR: 1.25 * up,
      pitch: -0.14 * proud,
      eyeScale: 1.08,
      blink: 0.35 * proud,
    };
    pose = g < MIDNIGHT ? estudianteTalk(g, base, 1.1) : { ...base, blink: 0, eyeScale: 1.35, lookX: -0.7, lookY: 0.55, hop: 0.15 };
    if (g >= FALL) pose = { ...pose, finL: -0.45, finR: -0.45, blink: 1, eyeScale: 1, lookX: 0, lookY: 0, squash: 1 - 0.1 * thud };
    ry = mix(STUDENT_RY, 0, proud) * (1 - freeze) + 0 * freeze;
  }
  const studentPos: Vec3 = [STUDENT_AT[0], 0, STUDENT_AT[2] - back];
  const hinge: Vec3 = [studentPos[0], BED_DESK.top, studentPos[2] + 0.88];
  const head: Vec3 = [studentPos[0], 1.95 + (pose.hop ?? 0) * 0.2, studentPos[2]];

  // ---- The laptop's screen -------------------------------------------------------------------
  const de = g - ERROR;
  const flash = de < 0 ? 0 : de < 14 ? (de % 4 < 2 ? 1 : 0.35) : 0.7;
  const dm = g - MIDNIGHT;
  const midFlash = dm < 0 ? 0 : dm % 4 < 2 ? 1 : 0.4;
  let screen = SCREEN_CHAT;
  let screenK = 1.6;
  if (g >= ERROR && g < TYPE) {
    screen = mixHex(SCREEN_CHAT, SCREEN_RED, de < 14 ? flash : 0.9);
    screenK = 1.6 + 7 * flash;
  } else if (g >= TYPE && g < MIDNIGHT) {
    screen = SCREEN_DOC;
    screenK = 2.0;
  } else if (g >= MIDNIGHT) {
    screen = SCREEN_RED;
    screenK = 1.5 + 3.5 * midFlash;
  }

  // ---- Camera --------------------------------------------------------------------------------
  const eyes: Vec3 = [STUDENT_AT[0], 1.15, STUDENT_AT[2]];
  const wideA = (u: number): Cam => aim(lerp3([0.9, 2.9, 8.6], [0.85, 2.8, 8.1], u), 40, eyes, 600, 1010);
  let cam: Cam;
  if (g < L05) {
    cam = wideA(ramp(g, START, L05, [0, 1], (x) => x));
  } else if (g < TYPE) {
    const u = ramp(g, L05 + 4, AHORA + 20, [0, 1], EASE_IN_OUT);
    const pos = lerp3([0.85, 2.8, 8.1], [0.55, 2.0, 3.4], u);
    cam = aim(pos, 40, [eyes[0], eyes[1] - 0.05, eyes[2]], mix(600, 545, u), mix(1010, 930, u));
  } else {
    const u = ramp(g, TYPE, END, [0, 1], (x) => x);
    cam = aim(lerp3([-0.4, 3.6, 7.0], [-0.3, 3.5, 6.5], u), 40, [0.05, 1.0, -1.9], 560, 1000);
  }

  return (
    <AbsoluteFill style={{ background: "#0C1230" }}>
      <Shake
        frame={g}
        impacts={[
          { at: ERROR, amp: 8, dur: 10 },
          { at: HIT, amp: 26, dur: 14 },
        ]}
      >
        <Stage cam={cam} near={0.1}>
          <BedroomLights screen={screen} screenK={screenK} />
          <Bedroom seconds={seconds} t={t} jump={thud} clockShake={ring} />
          <group position={LAPTOP_AT} rotation={[0, LAPTOP_RY, 0]}>
            <Laptop screen={screen} glow={g >= ERROR && g < TYPE ? 1.4 : 1} />
          </group>
          <group position={hinge} rotation={[0, -0.5 * clamp01(fall), 0]}>
            <group rotation={[fall, 0, 0.18 * fall]}>
              <group rotation={[0, 0.5 * clamp01(fall), 0]}>
                <group position={[-hinge[0], -hinge[1], -hinge[2]]}>
                  <Student position={studentPos} rotationY={ry} pose={pose} shadowOpacity={0.25} />
                </group>
              </group>
            </group>
          </group>
          <SweatDrops g={g} from={L05 + 6} to={L06 - 2} head={head} every={3} seed={3} />
          <SweatDrops g={g} from={ERROR + 4} to={ERROR + 14} head={head} every={3} seed={7} />
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};
