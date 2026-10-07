import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import {
  CasaLights,
  CasaPhone,
  CasaRoom,
  Duvet,
  EYES,
  EarPhone,
  HEAD_TOP,
  LIE_PITCH,
  NUBI_LIE,
  NUBI_SIT,
  PHONE_STAND,
  duvetHeight,
  nubiPoint,
} from "../../three/mentiras/Casa";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { EyeBags, Lids } from "../../three/tiempo/Office";
import { tagAt } from "../anchor";
import { GANCHO } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot 1 "gancho" (GANCHO.START → END): THE HOOK. Frame 0 is already in action: Nubi lies back in
// bed under the duvet, phone at its ear, eyes half shut and puffy, FAKE-PANTING: its body bobs and
// its legs pedal under the duvet (two bumps running) during "¡Sí, sí! Ya estoy llegando". High
// from the foot of the bed, slow push-in. TAG: «ACABA DE DESPERTAR» slams over its head (a shake,
// dust puffs off the duvet); LOOK: it freezes, the pedalling stops, its eyes roll up to the tag,
// horrified. L02 (hard cut, on the action): it sits up facing us, the tag still over its head, and
// asks the question; CABEZA: it points up at the tag; DURE (punch-in): deadpan, a slow blink.
// The first frame matches the last of "final" (camBed, runPose): the video loops.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Pedalling of the fake run (radians per frame). */
export const RUN_RATE = 0.42;
/** Fin raise that holds the phone at Nubi's ear. */
export const EAR_RAISE = 2.3;

/**
 * Nubi lying back in bed, fake-running on the phone: `d` = frames from the loop seam (hook:
 * g − GANCHO.START; final: g − FINAL.END), so the motion is continuous across the loop; `k` 0..1.
 */
export const runPose = (d: number, k = 1): NubiPose => {
  const ph = d * RUN_RATE;
  return {
    pitch: LIE_PITCH + 0.035 * k * Math.sin(ph * 2),
    hop: k * (0.2 + 0.4 * Math.abs(Math.sin(ph))),
    squash: 1 + k * 0.05 * Math.sin(ph * 2 + 0.6),
    roll: 0.05 * k * Math.sin(ph),
    yaw: 0.05 * k * Math.sin(ph + 0.4),
    finR: EAR_RAISE + 0.1 * k * Math.sin(ph * 2),
    finL: 0.2 + 0.6 * k * Math.sin(ph + Math.PI),
    blink: 0,
    eyeScale: 0.95,
    lookX: 0.3,
    lookY: -0.15,
  };
};
/** The duvet over the running legs. */
export const runDuvet = (d: number, k: number, pose: NubiPose) => ({ lie: 1, pedal: k, phase: d * RUN_RATE, bob: 0.2 * (pose.hop ?? 0) });
/** Puffy, half-shut eyes of the just-woken Nubi. */
export const SLEEPY = { droop: 0.55, bags: 0.6 };

const LIE_EYES = nubiPoint(NUBI_LIE, { pitch: LIE_PITCH }, EYES);
/** The loop framing: high from the foot of the bed, on the phone side; a slow push-in. */
export const camBed = (d: number): Cam => {
  const k = d / 110;
  const pos: Vec3 = [0.9 - 0.3 * k, 9.6 - 0.55 * k, 4.9 - 0.75 * k];
  return aim(pos, FOV, LIE_EYES, 500, 915);
};

const SIT_EYES = nubiPoint(NUBI_SIT, {}, EYES);
/** In front of the bed, Nubi sitting up (medium shot, room for the tag above its head). */
const camFront = (push: number): Cam => aim([0.5 - 0.15 * push, 2.7 - 0.1 * push, 8.6 - 0.7 * push], FOV, SIT_EYES, 520, 1010);
/** The deadpan punch-in. */
const camDeadpan = (push: number): Cam => aim([0.3, 2.45, 6.4 - 0.25 * push], FOV, SIT_EYES, 520, 1050);

/** Where the tag over a Nubi points: just above the top of its head (along its body, then up). */
export const tagPoint = (position: Vec3, pose: NubiPose, rotationY = 0, up = 0.12): Vec3 => {
  const p = nubiPoint(position, pose, [HEAD_TOP[0], HEAD_TOP[1] + 0.4, HEAD_TOP[2]], rotationY);
  return [p[0], p[1] + up, p[2]];
};

/**
 * 2D "running" marks beside the pedalling knees under the duvet (cartoon speed strokes that flick
 * on the knee going up). `d` = frames from the loop seam, `k` 0..1 the run.
 */
export const RunMarks: React.FC<{ cam: Cam; d: number; k: number }> = ({ cam, d, k }) => {
  if (k <= 0.05) return null;
  const ph = d * RUN_RATE;
  return (
    <>
      {[-1, 1].map((side) => {
        const up = Math.sin(ph + (side > 0 ? Math.PI : 0));
        if (up < 0.15) return null;
        const lz = 0.42 + 0.16 * Math.cos(ph + (side > 0 ? Math.PI : 0));
        const knee: Vec3 = [side * 0.4, duvetHeight(side * 0.4, lz, 1) + 0.3 * up, lz];
        const p = projectToScreen(cam, knee, 1080, 1920);
        if (p.behind) return null;
        const o = k * Math.min(1, (up - 0.15) * 3);
        return (
          <svg key={side} width={260} height={260} viewBox="-100 -100 200 200" style={{ position: "absolute", left: p.x - 130 + side * 120, top: p.y - 150, opacity: o, overflow: "visible" }}>
            {[0, 1, 2].map((j) => (
              <path
                key={j}
                d={`M ${side * (8 + 22 * j)} ${-40 + 12 * j} Q ${side * (26 + 22 * j)} ${-4 + 6 * j} ${side * (8 + 22 * j)} ${32 - 4 * j}`}
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={11 - 2 * j}
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 3px 0 rgba(120,40,80,0.55))" }}
              />
            ))}
          </svg>
        );
      })}
    </>
  );
};

/** 2D dust puffs bursting off the duvet (`age` frames since the slam). */
const Puffs: React.FC<{ cam: Cam; points: Vec3[]; age: number }> = ({ cam, points, age }) => {
  if (age < 0 || age > 18) return null;
  const k = age / 18;
  return (
    <>
      {points.map((pt, i) => {
        const p = projectToScreen(cam, pt, 1080, 1920);
        if (p.behind) return null;
        const dir = i % 2 ? 1 : -1;
        return [0, 1, 2].map((j) => {
          const r = (26 + 16 * j) * (0.4 + 1.1 * Math.sqrt(k));
          return (
            <div
              key={`${i}-${j}`}
              style={{
                position: "absolute",
                left: p.x + dir * (30 + 50 * k) * (j - 0.6) - r,
                top: p.y - 60 * k - 18 * j - r,
                width: r * 2,
                height: r * 2,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 4px 0 rgba(200,170,220,0.6)",
                opacity: (1 - k) * 0.95,
              }}
            />
          );
        });
      })}
    </>
  );
};

export const GanchoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.gancho.from;
  const { START, END, L01, TAG, LOOK, L02, CABEZA, DURE } = GANCHO;
  const t = g / 30;
  const d = g - START;
  const sitting = g >= L02;

  // ---- Part 1: in bed, on the phone, fake-running; the tag; the freeze.
  const freeze = ramp(g, LOOK - 2, LOOK + 3, [0, 1], EASE_OUT);
  const runK = 1 - freeze;
  const slam = g >= TAG ? windowIn(g, TAG, TAG + 7, 2) : 0;
  const horror = ramp(g, LOOK, LOOK + 6, [0, 1], EASE_OUT);
  const run = runPose(d, runK);
  let lying: NubiPose = {
    ...run,
    squash: (run.squash ?? 1) * (1 - 0.1 * slam) + 0.05 * horror,
    hop: (run.hop ?? 0) + 0.6 * slam + 0.3 * horror,
    eyeScale: lerp(0.95, 1.32, horror) + 0.15 * slam,
    lookX: lerp(0.3, 0, horror),
    lookY: lerp(-0.15, 1, horror),
    // A tiny tremble once frozen.
    roll: (run.roll ?? 0) + 0.012 * horror * Math.sin(g * 2.1),
  };
  if (g >= L01 && g < TAG + 4) lying = nubiTalk(g, lying, 0.7);
  lying.lookX = lerp(0.3, 0, horror);
  lying.lookY = lerp(-0.15, 1, horror);
  lying.finR = EAR_RAISE + 0.1 * runK * Math.sin(d * RUN_RATE * 2) + 0.15 * slam;
  const droop = SLEEPY.droop * (1 - Math.max(horror, slam));

  // ---- Part 2: sitting up, to camera.
  const up = pop(g, L02, { damping: 12, stiffness: 200, mass: 0.6 });
  const point = windowIn(g, CABEZA - 3, CABEZA + 30, 6);
  const pointPump = g >= CABEZA ? Math.max(0, Math.sin(((g - CABEZA) / 9) * Math.PI)) * (1 - ramp(g, CABEZA + 18, CABEZA + 26)) : 0;
  const deadpan = ramp(g, DURE - 2, DURE + 4, [0, 1], EASE_OUT);
  // Slow blink on "Yo no duré…": closes, holds, opens.
  const slowBlink = g >= DURE + 4 ? Math.min(ramp(g, DURE + 4, DURE + 12, [0, 1], EASE_IN_OUT), 1 - ramp(g, DURE + 18, DURE + 28, [0, 1], EASE_IN_OUT)) : 0;
  let seated: NubiPose = {
    pitch: lerp(-0.45, 0.03, clamp01(up)),
    hop: 0.25 + 0.5 * (1 - clamp01(up)) + 0.4 * pointPump,
    squash: 1 + 0.06 * (up - 1),
    finR: 0.1 + 1.8 * point,
    roll: 0.1 * point,
    finL: 0.05,
    lookY: 0.75 * point,
    lookX: 0,
    eyeScale: 1.05 + 0.1 * point,
  };
  seated = nubiTalk(g, seated, lerp(1, 0.25, deadpan));
  if (point > 0.3) {
    seated.finR = 0.1 + 1.8 * point + 0.35 * pointPump;
    seated.lookY = 0.75 * point;
  }
  if (deadpan > 0) {
    seated.blink = Math.max(seated.blink ?? 0, slowBlink);
    seated.lookX = 0;
    seated.yaw = (seated.yaw ?? 0) * (1 - deadpan);
  }
  const seatedDroop = 0.18 + 0.32 * deadpan;

  const pose = sitting ? seated : lying;
  const nubiAt: Vec3 = sitting ? NUBI_SIT : NUBI_LIE;

  // ---- Camera: high on the bed with a slow push → (cut) front → (cut) deadpan punch-in.
  let cam: Cam;
  if (!sitting) cam = camBed(d);
  else if (g < DURE) cam = camFront(ramp(g, L02, DURE, [0, 1], (x) => x));
  else cam = camDeadpan(ramp(g, DURE, END, [0, 1], (x) => x));

  // ---- The tag, anchored just above the head.
  const tg = tagAt(cam, tagPoint(nubiAt, pose, 0, sitting ? 0.12 : 0.2));

  // ---- Dust puffs off the duvet when the tag slams.
  const puffPts: Vec3[] = [
    [-1.15, duvetHeight(-1.15, -0.2, 1) + 0.05, -0.2],
    [1.2, duvetHeight(1.2, -0.1, 1) + 0.05, -0.1],
    [-0.75, duvetHeight(-0.75, 0.55, 1) + 0.05, 0.55],
    [0.8, duvetHeight(0.8, 0.6, 1) + 0.05, 0.6],
  ];

  return (
    <AbsoluteFill style={{ background: "#C3B3FF" }}>
      <Shake frame={g} impacts={[{ at: TAG, amp: 9, dur: 12 }]}>
        <Stage cam={cam} near={0.1} far={200}>
          <CasaLights keyFrom={sitting ? [-3, 6, 9] : [-2, 9, 6]} />
          <CasaRoom t={t} beams={sitting ? 0 : 0.6} />
          {sitting ? (
            <>
              <Duvet lie={0} />
              <group position={PHONE_STAND} rotation={[-Math.PI / 2, 0, 0.45]}>
                <CasaPhone screen="off" />
              </group>
            </>
          ) : (
            <Duvet {...runDuvet(d, runK, lying)} />
          )}
          <Nubi size={2} position={nubiAt} pose={pose} shadow={false} palette={{ eyeRough: 0.7 }} holdR={sitting ? undefined : <EarPhone raise={pose.finR ?? EAR_RAISE} />}>
            <Lids pose={pose} droop={sitting ? seatedDroop : droop} tilt={sitting ? 0 : 0.12} color={NUBI_GREEN} />
            {!sitting ? <EyeBags pose={pose} color="#6D9F86" amount={SLEEPY.bags * (1 - horror)} /> : null}
          </Nubi>
        </Stage>
        {!sitting ? <RunMarks cam={cam} d={d} k={runK * (1 - slam)} /> : null}
        {!sitting ? <Puffs cam={cam} points={puffPts} age={g - TAG} /> : null}
        {!tg.behind ? <TruthTag frame={g} at={TAG} out={END - 10} lines={[{ text: "ACABA DE DESPERTAR" }]} x={tg.x} y={tg.y} scale={tg.scale} /> : null}
      </Shake>
    </AbsoluteFill>
  );
};

/** Camera blend helper (exported for the loop in "final"). */
export const mixCam = (a: Cam, b: Cam, k: number): Cam => ({ position: lerp3(a.position, b.position, k), target: lerp3(a.target, b.target, k), fov: lerp(a.fov, b.fov, k) });
