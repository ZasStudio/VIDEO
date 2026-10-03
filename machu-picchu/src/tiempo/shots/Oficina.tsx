import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { Upright } from "../../inca/outfit";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  COWORKER_SIZE,
  Coworker,
  EnviarButton,
  MUG_HOLD,
  Mug,
  OFFICE,
  OFFICE_COWORKER,
  OFFICE_NUBI,
  OFFICE_WORKERS,
  Office,
  OfficeCrowd,
  OfficeLights,
  RubberStamp,
  StampHit,
  StampPaper,
  finTipWorld,
  headTop,
  stampSpot,
  workerHead,
  workerPose,
} from "../../three/tiempo/Office";
import { OFICINA } from "../beats";
import { COWORKER_EVENTS, LifeEvent, NUBI_EVENTS, coworkerSeconds, extraSeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { coworkerTalk, tiempoTalk } from "../talk";

// Shot "oficina" (OFICINA.START → END): TIMECO's open-plan office.
// A (START → L06+20) the wide establishing shot: rows of desks, workers typing, three of them
//   stamping "LISTO" (+00:05:00 on their counters), the giant clock, the logo, the windows.
// B (→ BELL) the two-shot: Nubi at its desk beside the coworker. The working day in a time-lapse
//   (LAPSE → LAPSE_END): the clock spins 9:00 → 17:00, the windows go from morning to sunset,
//   everyone types in fast-forward, every counter drops 8 hours. At DIA the rule lightbox
//   "8 H DE TRABAJO = +1 DÍA DE VIDA" lights up (the lead's sticker covers y 260-460 then: the
//   clock has risen out of that band by DIA).
// C (BELL → END) the bell rings; the coworker slams ENVIAR and stretches; his counter pops
//   "+00:03:00" at REWARD; the PRODUCTIVIDAD screen shows "2%"; he turns to Nubi for L07; Nubi
//   stares at the tiny reward.

const FPS = 30;
const NUBI_SIZE = 2;
/** Workers who stamp a paper in the wide shot (index into OFFICE_WORKERS, frames after START). */
const STAMPERS: [number, number][] = [
  [12, 7],
  [22, 15],
  [13, 23],
];
/** Extras right behind the double desk: in the two-shots their desks stay empty (clear counters). */
const BEHIND = [12, 13, 21, 22, 23];
/** The coworker's counter floats a little higher than Nubi's (they stand side by side). */
const CW_LIFT = 0.9;
/** The coworker slams ENVIAR with his screen-left fin, twisted towards it. */
const SLAM_POSE: NubiPose = { finL: -0.75, yaw: 0.45, pitch: 0.1 };
const ENVIAR_TIP = finTipWorld(OFFICE_COWORKER, 0, COWORKER_SIZE, SLAM_POSE, "L");
const ENVIAR_AT: Vec3 = [ENVIAR_TIP[0], OFFICE.deskTop, ENVIAR_TIP[2]];

const mix = (a: number, b: number, k: number) => a + (b - a) * k;

/** Fins tapping on the keyboard (rate in taps per second-ish), eyes on the monitor at `look`. */
const typing = (g: number, speed: number, phase: number, look: number): NubiPose => {
  const ph = (g / FPS) * 11 * speed + phase;
  return {
    finL: -0.3 - 0.45 * Math.max(0, Math.sin(ph)),
    finR: -0.3 - 0.45 * Math.max(0, Math.sin(ph + Math.PI * 0.9)),
    hop: 0.12 * Math.max(0, Math.sin(ph * 0.5)) * Math.min(2.5, speed),
    pitch: 0.07,
    lookX: look,
    lookY: -0.3,
  };
};

export const OficinaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.oficina.from;
  const { START, END, L06, LAPSE, LAPSE_END, DIA, BELL, REWARD, L07, PRODUCTIVO } = OFICINA;
  const t = g / FPS;
  const A_END = L06 + 20;

  // ---- The working day -----------------------------------------------------------------
  const lapse = clamp01((g - LAPSE) / (LAPSE_END - LAPSE));
  const hours = 9 + 8 * lapse + (g - START) / FPS / 3600;
  const day = lapse * lapse * (3 - 2 * lapse);
  const ff = windowIn(g, LAPSE, LAPSE_END + 3, 6);
  const ring = windowIn(g, BELL, BELL + 30, 2);
  // The rule's neon stutters on at DIA.
  const flicker = g < DIA ? 0 : g < DIA + 9 ? [1, 0.2, 1, 0, 0.7, 1, 0.4, 1, 1][g - DIA] : 1;
  const prod: 0 | 1 = g >= REWARD + 4 ? 1 : 0;
  const prodPop = g >= REWARD + 4 ? Math.max(0, 1 - (g - REWARD - 4) / 10) : 0;
  const stamps: StampHit[] = STAMPERS.map(([worker, d]) => ({ worker, at: START + d }));

  // ---- Nubi -----------------------------------------------------------------------------
  const tired = ramp(g, LAPSE_END - 6, LAPSE_END + 4, [0, 1], EASE_OUT) * (1 - ramp(g, BELL, BELL + 6));
  const perk = ramp(g, BELL, BELL + 6, [0, 1], EASE_OUT);
  const watch = ramp(g, REWARD - 4, REWARD + 6, [0, 1], EASE_IN_OUT);
  const deflate = ramp(g, L07 + 20, L07 + 40, [0, 1], EASE_IN_OUT);
  const dia = windowIn(g, DIA - 2, LAPSE_END - 2, 6);
  let nubiBase: NubiPose;
  if (g < BELL) {
    const ty = typing(g, 1 + 3.2 * ff, 0.6, -0.5);
    nubiBase = {
      ...ty,
      finL: (ty.finL ?? 0) * (1 - tired) - 0.45 * tired,
      finR: (ty.finR ?? 0) * (1 - tired) - 0.45 * tired,
      squash: 1 - 0.07 * tired,
      blink: 0.5 * tired,
      lookX: mix(-0.5, 0, Math.max(dia, tired)),
      lookY: mix(-0.3, 0.1, dia),
      eyeScale: 1 + 0.12 * dia,
      yaw: -0.15 * (1 - dia) + 0.12 * Math.sin(t * 7) * ff,
    };
    if (g < LAPSE) nubiBase = { ...nubiBase, lookX: -0.2, lookY: 0, yaw: 0.05 };
  } else {
    nubiBase = {
      finL: -0.2 + 0.25 * perk - 0.35 * deflate,
      finR: -0.2 + 0.35 * perk - 0.35 * deflate,
      hop: 0.6 * perk * Math.max(0, 1 - (g - BELL) / 8),
      squash: 1 + 0.03 * perk - 0.06 * deflate,
      yaw: 0.35 * watch,
      lookX: 0.75 * watch,
      lookY: 0.15 + 0.45 * watch * (1 - 0.4 * deflate),
      eyeScale: 1.08 + 0.17 * watch - 0.3 * deflate,
      blink: g >= PRODUCTIVO && g < PRODUCTIVO + 5 ? 0.9 : 0,
    };
  }
  const nubiPose = g >= L06 && g < BELL ? tiempoTalk(g, nubiBase, 0.8) : nubiBase;
  if (g >= L06 && g < BELL) {
    // Keep typing under the talking motion.
    nubiPose.finL = nubiBase.finL;
    nubiPose.finR = nubiBase.finR;
  }

  // ---- The coworker ---------------------------------------------------------------------
  const slamUp = ramp(g, BELL, BELL + 3, [0, 1], EASE_OUT);
  const SLAM = BELL + 4;
  const slamHit = g >= SLAM ? Math.exp(-(g - SLAM) * 0.35) : 0;
  const slamK = windowIn(g, BELL - 1, SLAM + 6, 2);
  const stretch = windowIn(g, SLAM + 5, L07 - 6, 5);
  const turn = ramp(g, L07 - 8, L07 + 2, [0, 1], EASE_IN_OUT);
  const sip = windowIn(g, PRODUCTIVO + 4, END + 10, 6);
  const droop = mix(0.45, 0.72, day) + 0.1 * turn;
  let cwBase: NubiPose;
  if (g < BELL) {
    const ty = typing(g, 0.9 + 3.6 * ff, 2.1, 0.55);
    // One fin types, the other holds the coffee (quick sips in the time-lapse).
    const sipFF = ff * Math.max(0, Math.sin(t * 9.5)) ** 4;
    cwBase = { ...ty, finR: 0.05 + 0.9 * sipFF, yaw: 0.12 + 0.2 * Math.sin(t * 6) * ff, blink: g < LAPSE ? 0 : 0.15, lookX: 0.55 * (1 - sipFF), lookY: -0.3 + 0.2 * sipFF };
  } else {
    cwBase = {
      finL: mix(mix(-0.2, 1.2, slamUp) - 1.95 * slamHit, 1.45, stretch) * (1 - turn * 0.6) + (1 - slamK) * (1 - stretch) * -0.2,
      finR: mix(0.05, 1.35, stretch) + 0.75 * sip,
      yaw: mix(SLAM_POSE.yaw ?? 0, 0, 1 - slamK) * (1 - stretch) - 0.6 * turn,
      pitch: 0.1 * slamK - 0.08 * stretch,
      squash: 1 - 0.06 * slamHit + 0.13 * stretch,
      hop: 0.5 * stretch,
      roll: 0.05 * stretch * Math.sin(t * 5),
      blink: Math.max(0.95 * stretch, 0.1),
      lookX: -0.7 * turn,
      lookY: 0.05 * turn + 0.25 * sip,
      eyeScale: 0.95,
    };
  }
  const cwPose = g >= L07 ? coworkerTalk(g, cwBase, 0.55) : cwBase;
  if (g >= L07) {
    cwPose.finR = cwBase.finR;
    cwPose.yaw = (cwBase.yaw ?? 0) + 0.04 * Math.sin(t * 2);
  }
  const press = g >= SLAM ? Math.exp(-(g - SLAM) * 0.12) : 0;
  const glowBtn = g >= SLAM ? Math.max(0, 1 - (g - SLAM) / 18) : 0;

  // ---- Cameras --------------------------------------------------------------------------
  let cam: Cam;
  const sweepA = ramp(g, START, A_END, [0, 1], (x) => x);
  if (g < A_END) {
    cam = aim(lerp3([0.2, 7.6, 10.8], [0.1, 7.2, 9.9], sweepA), 52, [0, 0.6, -3.6], 520, 1135);
  } else if (g < BELL) {
    // Crane up as the day goes by: the spinning clock rises behind the lead's sticker by DIA and
    // the rule lightbox under it comes into view just as it lights up.
    const u = ramp(g, A_END, DIA - 3, [0, 1], EASE_IN_OUT);
    const v = ramp(g, DIA - 3, BELL, [0, 1], (x) => x);
    const pos = lerp3(lerp3([-1.0, 2.5, 15.0], [-1.0, 6.7, 15.2], u), [-1.0, 6.8, 14.7], v);
    cam = aim(pos, 38, [OFFICE_NUBI[0], 1.0, OFFICE_NUBI[2]], 310, 1085);
  } else {
    const u = ramp(g, BELL, END, [0, 1], (x) => x);
    cam = aim(lerp3([1.6, 4.2, 15.0], [1.4, 4.0, 13.8], u), 38, [0, 1.0, OFFICE_COWORKER[2]], 520, mix(1085, 1100, u));
  }

  // ---- Life counters --------------------------------------------------------------------
  type Tag = { key: string; d: number; node: React.ReactNode };
  const tags: Tag[] = [];
  const dist = (p: Vec3) => Math.hypot(p[0] - cam.position[0], p[1] - cam.position[1], p[2] - cam.position[2]);
  const hide = g < A_END ? [] : BEHIND;
  OFFICE_WORKERS.forEach((w, i) => {
    if (hide.includes(i)) return;
    const hit = stamps.find((s) => s.worker === i);
    const p = workerHead(w, g, ff, hit?.at);
    const c = counterAt(cam, p, { ref: 9, min: 0.5, max: 0.65 });
    if (c.behind || c.x < -120 || c.x > 1200 || c.y < 60 || c.y > 1500) return;
    const events: LifeEvent[] = hit ? [{ at: hit.at, text: "+00:05:00", tone: "tiny" }] : [];
    const secs = extraSeconds(w.seed, g) + (hit && g >= hit.at ? 300 : 0);
    // Behind the two of them (shots B and C) the extras' counters step back a little.
    const opacity = g < A_END ? 1 : 0.72;
    tags.push({ key: `w${i}`, d: dist(p), node: <LifeCounter key={`w${i}`} frame={g} seconds={secs} {...c} events={events} opacity={opacity} /> });
  });
  const nubiHead = headTop(OFFICE_NUBI, NUBI_SIZE, nubiPose, 0.12);
  const cwHead = headTop(OFFICE_COWORKER, COWORKER_SIZE, cwPose, 0.12 + (g < A_END ? 1.6 : CW_LIFT));
  const mainOpts = { ref: 9, min: 0.85, max: 1.1 };
  const nubiC = counterAt(cam, nubiHead, mainOpts);
  const cwC = counterAt(cam, cwHead, mainOpts);
  const mains: Tag[] = [
    {
      key: "nubi",
      d: dist(nubiHead),
      node: nubiC.behind ? null : (
        <LifeCounter key="nubi" frame={g} seconds={nubiSeconds(g)} {...nubiC} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} />
      ),
    },
    { key: "cw", d: dist(cwHead), node: cwC.behind ? null : <LifeCounter key="cw" frame={g} seconds={coworkerSeconds(g)} {...cwC} events={COWORKER_EVENTS} /> },
  ];
  tags.sort((a, b) => b.d - a.d);
  mains.sort((a, b) => b.d - a.d);

  // ---- Props in fins and on desks -------------------------------------------------------
  const mug = (
    <Upright raise={cwPose.finR ?? 0}>
      <group position={MUG_HOLD.position} scale={MUG_HOLD.scale}>
        <Mug t={t} steam={1 - 0.6 * ff} />
      </group>
    </Upright>
  );

  return (
    <AbsoluteFill style={{ background: "#B9C5D8" }}>
      <Shake frame={g} impacts={[{ at: BELL, amp: 7, dur: 12 }, { at: SLAM, amp: 9, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <OfficeLights day={day} />
          <Office t={t} day={day} hours={hours} ring={ring} clockBlur={ff} rule={flicker} prod={prod} prodPop={prodPop} />
          <OfficeCrowd g={g} ff={ff} stamps={stamps} hide={hide} />
          {stamps.map((s) => {
            const w = OFFICE_WORKERS[s.worker];
            const spot = stampSpot(w, s.at);
            const pose = workerPose(w, g, ff, s.at);
            const tip = finTipWorld(w.at, 0, w.size, pose, "R");
            const held = g > s.at - 16 && g < s.at + 16;
            return (
              <group key={s.worker}>
                <group position={spot}>
                  <StampPaper stamped={g >= s.at ? 1 : 0} yaw={0.2} />
                </group>
                {held ? (
                  <group position={[tip[0], Math.max(OFFICE.deskTop + 0.01, tip[1] - 0.32), tip[2]]}>
                    <RubberStamp />
                  </group>
                ) : null}
              </group>
            );
          })}
          <Nubi size={NUBI_SIZE} position={OFFICE_NUBI} pose={nubiPose} shadowOpacity={0.3} />
          <Coworker position={OFFICE_COWORKER} pose={cwPose} droop={droop} holdR={mug} shadowOpacity={0.3} />
          <group position={ENVIAR_AT}>
            <EnviarButton press={press} glow={glowBtn} />
          </group>
        </Stage>
        {tags.map((x) => x.node)}
        {mains.map((x) => x.node)}
      </Shake>
    </AbsoluteFill>
  );
};

