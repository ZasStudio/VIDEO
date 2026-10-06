import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, keyframes, ramp, windowIn } from "../../anim";
import { MoneyCounter, SleepSensor } from "../../overlay/dormir/DormirUI";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  BED,
  BedSensor,
  Briefcase,
  EyeMode,
  HeroDuvet,
  NUBI_BED,
  NUBI_DUVET,
  NubiEyes,
  OfficeBedsLights,
  OfficeBedsSet,
  SENSOR_AT,
  SENSOR_LOCAL,
  Sleepers,
  SnotBubble,
  WORKER_BED,
  WORKER_DUVET,
  Zzz,
  bedHead,
  bodyPoint,
  climb,
  climbSteps,
  inBed,
} from "../../three/dormir/OfficeBeds";
import { SweatDrops, Worker } from "../../three/ia/Work";
import { PROBLEMA } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";
import { DORMIR, DORMIR_HEIGHT, DORMIR_WIDTH } from "../timeline";

// Shot "problema" (PROBLEMA.START → END): the two beds side by side, seen from the foot, a little
// above. Left: the colleague (the lilac Worker) fast asleep, snot bubble swelling, his counter at
// S/ 800 and climbing (+S/100 every 1.5 s). Right: Nubi "asleep" with theatrical fake snores and
// big Zs: its counter stuck at S/ 0.
// L06    «Pero había una condición: solo cobrabas dormido. Fingir no servía.» On FINGIR the sensor
//        on Nubi's headboard flashes red and buzzes («DESPIERTO», the 2D SleepSensor label), Nubi's
//        eyes pop open, the camera snaps in on it.
// L07    «Duérmete… duérmete…» eyes squeezed shut (> <), body tense, trembling, sweating, the camera
//        creeping in; GRITO «¡NO PIENSES EN EL DINERO!» it bolts up shouting (big stretch, shake)
//        and flops back; PEEK: one eye opens to check the counter… still S/ 0.

const FPS = 30;
const NUBI_SIZE = 2;
const CASE_REST: Vec3 = [NUBI_BED[0] - BED.w / 2 - 0.4, 0.41, NUBI_BED[2] - 0.55];
const STEP = 46;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const ProblemaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.problema.from;
  const { START, END, L06, FINGIR, L07, GRITO, PEEK } = PROBLEMA;
  const t = g / FPS;
  const DUERMETE2 = DORMIR.wordAt("L07", 1);
  const L07_END = DORMIR.lineEnd("L07");

  // ---- The colleague: deep asleep, breathing slowly, a snot bubble swelling and shrinking --------
  const wBr = Math.sin(((g - START) / 52) * Math.PI * 2);
  const wIn = inBed(WORKER_BED, 0);
  const wPose: NubiPose = { pitch: wIn.pitch + 0.03 * wBr, squash: 1 + 0.03 * wBr, roll: -0.05, yaw: 0.08, blink: 1 };
  const bubble = bodyPoint(wIn.position, 0, 2, wPose, [0.7, 4.9, 5.6]);
  const bubbleR = 0.06 + 0.3 * Math.pow(0.5 + 0.5 * wBr, 1.6);

  // ---- Nubi -----------------------------------------------------------------------------------
  const startle = keyframes(g, [FINGIR, FINGIR + 3, FINGIR + 14, L07 - 8, L07], [0, 1, 0.75, 0.6, 0]);
  const tense = ramp(g, L07, L07 + 10) * (1 - ramp(g, GRITO - 3, GRITO));
  const tense2 = ramp(g, DUERMETE2 - 4, DUERMETE2 + 20);
  const shout = ramp(g, GRITO - 3, GRITO + 2, [0, 1], EASE_OUT) * (1 - ramp(g, L07_END - 14, L07_END - 2, [0, 1], EASE_IN_OUT));
  const flop = ramp(g, L07_END - 14, L07_END - 2, [0, 1], EASE_IN_OUT);
  const up = 0.15 * startle + 0.72 * shout;
  const nIn = inBed(NUBI_BED, up, NUBI_SIZE);
  const fake = g < FINGIR ? 1 : 0;
  const fakeBr = Math.sin(((g - START) / 34) * Math.PI * 2);
  const tremble = (0.6 * tense + 0.9 * tense * tense2) * (1 - shout);
  const stretch = keyframes(g, [GRITO - 3, GRITO + 2, GRITO + 9, GRITO + 18], [0.86, 1.34, 1.12, 1.16]);
  let pose: NubiPose = {
    pitch: nIn.pitch - 0.03 * fakeBr * fake + 0.05 * tense,
    squash: (1 + 0.05 * fakeBr * fake - 0.08 * tense - 0.04 * tense2) * (shout > 0.01 ? mix(1, stretch, shout) : 1) * (1 - 0.06 * flop * (1 - ramp(g, L07_END + 2, L07_END + 10))),
    hop: 0.9 * startle * Math.max(0, 1 - (g - FINGIR) / 8) * (g >= FINGIR ? 1 : 0) + 0.12 * tremble * Math.abs(Math.sin(g * 2.7)),
    roll: 0.035 * tremble * Math.sin(g * 2.3),
    yaw: 0.025 * tremble * Math.sin(g * 3.1),
    finL: mix(0.05, -0.55, tense) + 1.2 * shout,
    finR: mix(0.05, -0.55, tense) + 1.2 * shout,
    eyeScale: 1 + 0.3 * startle,
    lookX: -0.45 * startle,
    lookY: 0.55 * startle,
  };
  if (g >= L06 - 2 && g < L07) pose = nubiTalk(g, pose, 0.35 * startle);
  if (g >= L07) pose = nubiTalk(g, pose, mix(0.5, 1.5, shout));
  // Eyes: shut (fake sleep) → wide open (the buzz) → squeezed (> <) → one eye peeks.
  let left: EyeMode = "closed";
  let right: EyeMode = "closed";
  let lookX = 0;
  let lookY = 0;
  let openR = 1;
  if (g >= FINGIR + 1 && g < L07 - 2) {
    left = "open";
    right = "open";
    lookX = mix(-0.6, -0.9, ramp(g, FINGIR + 16, FINGIR + 24));
    lookY = mix(0.65, 0.1, ramp(g, FINGIR + 16, FINGIR + 24));
    openR = 1.3 - 0.2 * ramp(g, FINGIR + 3, FINGIR + 12);
  } else if (g >= L07 - 2 && g < PEEK) {
    left = "squeeze";
    right = "squeeze";
  } else if (g >= PEEK) {
    // One eye pops open and rolls up to the counter: still S/ 0.
    right = "open";
    left = "closed";
    lookX = -0.1;
    lookY = 1.35 * ramp(g, PEEK + 1, PEEK + 5);
    openR = keyframes(g, [PEEK, PEEK + 3, PEEK + 7], [0.1, 1.25, 1.1]);
  }
  if (g >= PEEK) pose = { ...pose, pitch: (pose.pitch ?? 0) - 0.08 * ramp(g, PEEK + 1, PEEK + 6) };
  const nubiPose = pose;
  const nubiHead = bedHead(nIn.position, NUBI_SIZE, nubiPose, 0.5);
  const nubiAnchor = bedHead(nIn.position, NUBI_SIZE, nubiPose, 0.22);

  // ---- Sensor: red from the start (Nubi is awake); on FINGIR it strobes and buzzes ----------------
  const flash = windowIn(g, FINGIR, FINGIR + 26, 2) + 0.6 * windowIn(g, PEEK + 2, PEEK + 14, 2);
  const buzz = windowIn(g, FINGIR, FINGIR + 30, 2) + 0.8 * windowIn(g, GRITO, GRITO + 16, 2);

  // ---- Camera ---------------------------------------------------------------------------------------
  const MID: Vec3 = [-1.85, 1.55, 0.1];
  const FACE: Vec3 = [0.05, 1.65, 0.3];
  let cam: Cam;
  if (g < FINGIR) {
    const u = ramp(g, START, FINGIR, [0, 1], (x) => x);
    cam = aim(lerp3([-1.8, 8.7, 14.2], [-1.75, 8.2, 13.3], u), 44, MID, 510, 900);
  } else if (g < L07) {
    const u = ramp(g, FINGIR, FINGIR + 8, [0, 1], EASE_OUT);
    const v = ramp(g, FINGIR + 8, L07, [0, 1], (x) => x);
    const pos = lerp3(lerp3([-1.75, 8.2, 13.3], [-0.75, 6.0, 10.0], u), [-0.6, 5.7, 9.4], v);
    cam = aim(pos, 44, lerp3(MID, [-0.6, 1.6, 0.1], u), mix(510, 540, u), mix(900, 880, u));
  } else if (g < GRITO) {
    const u = ramp(g, L07, GRITO, [0, 1], EASE_IN_OUT);
    cam = aim(lerp3([-0.6, 5.7, 9.4], [0.0, 4.1, 6.4], u), 44, lerp3([-0.6, 1.6, 0.1], FACE, u), 540, mix(880, 900, u));
  } else {
    // The shout: the camera jumps back to fit the stretch (the shake does the punch), then creeps
    // back in for the peek.
    const back = ramp(g, GRITO - 2, GRITO + 8, [0, 1], EASE_OUT) * (1 - ramp(g, L07_END - 10, PEEK + 2, [0, 1], EASE_IN_OUT));
    const peek = ramp(g, PEEK, END, [0, 1], EASE_OUT);
    const pos = lerp3(lerp3([0.0, 4.1, 6.4], [0.15, 5.3, 9.0], back), [0.05, 3.7, 5.6], 0.45 * peek);
    cam = aim(pos, 44, [FACE[0], FACE[1] + 0.3 * back, FACE[2]], 540, mix(900, 940, back));
  }

  // ---- Counters and the sensor label ----------------------------------------------------------------
  const nubiC = counterAt(cam, nubiAnchor, { ref: 11, min: 0.72, max: 1.2 });
  const wHead = bedHead(wIn.position, 2, wPose, 0.5);
  const wC = counterAt(cam, bedHead(wIn.position, 2, wPose, 0.22), { ref: 11, min: 0.72, max: 1.2 });
  const wFade = wC.behind ? 0 : clamp01((wC.x - 90) / 60);
  const wSoles = climb(g, START - 20, 800, STEP);
  const wEvents = climbSteps(START - 20, STEP, START, END);
  const peekBump = keyframes(g, [PEEK + 3, PEEK + 6, PEEK + 12], [0, 1, 0]);
  const sensorScreen = projectToScreen(cam, SENSOR_AT, DORMIR_WIDTH, DORMIR_HEIGHT);
  // The «DESPIERTO» label sits on the sensor, left of Nubi's head; it slides further left (then down)
  // if it would cover Nubi's counter.
  const labelScale = Math.min(0.95, Math.max(0.72, counterAt(cam, SENSOR_AT).scale * 0.85));
  const lw = 400 * labelScale;
  const lh = 125 * labelScale;
  const cw = 300 * nubiC.scale;
  const ch = 120 * nubiC.scale;
  let labelX = sensorScreen.x - 0.25 * lw;
  let labelY = sensorScreen.y + 0.35 * lh;
  const hits = () => labelX + lw / 2 > nubiC.x - cw / 2 - 12 && labelX - lw / 2 < nubiC.x + cw / 2 + 12 && labelY > nubiC.y - ch - 12 && labelY - lh < nubiC.y + 12;
  if (hits()) labelX = Math.max(60 + lw / 2, nubiC.x - cw / 2 - lw / 2 - 14);
  if (hits()) labelY = nubiC.y + lh + 14;
  labelX = Math.min(940 - lw / 2, Math.max(60 + lw / 2, labelX));

  return (
    <AbsoluteFill style={{ background: "#E7ECF7" }}>
      <Shake frame={g} impacts={[{ at: FINGIR, amp: 6, dur: 12 }, { at: GRITO, amp: 16, dur: 18 }]}>
        <Stage cam={cam} near={0.1} far={80}>
          <OfficeBedsLights />
          <OfficeBedsSet lampGlow={[0, 1, 2]} />
          <Sleepers g={g} />
          <group position={WORKER_BED}>
            <HeroDuvet color={WORKER_DUVET} breathe={wBr} t={t} />
          </group>
          <Worker position={wIn.position} pose={wPose} droop={0} bags={0} shadowOpacity={0} />
          <SnotBubble at={bubble} r={bubbleR} />
          <Zzz g={g} at={[wHead[0] - 0.55, wHead[1] - 0.4, wHead[2] + 0.4]} from={START - 50} every={26} life={56} size={0.36} dir={-1} />
          <group position={NUBI_BED}>
            <HeroDuvet color={NUBI_DUVET} up={up} breathe={fake * fakeBr} t={t} />
            <group position={SENSOR_LOCAL}>
              <BedSensor state="awake" g={g} flash={flash} buzz={buzz} />
            </group>
          </group>
          <Nubi size={NUBI_SIZE} position={nIn.position} pose={nubiPose} shadow={false} hideEyes>
            <NubiEyes left={left} right={right} lookX={lookX} lookY={lookY} openL={1.3 - 0.2 * ramp(g, FINGIR + 3, FINGIR + 12)} openR={openR} />
          </Nubi>
          {/* Theatrical fake snores until the sensor catches it. */}
          <Zzz g={g} at={[nubiHead[0] + 0.5, nubiHead[1] - 0.4, nubiHead[2] + 0.4]} from={START - 40} to={FINGIR - 6} every={17} life={44} size={0.52} rise={1.35} />
          <SweatDrops g={g} from={DUERMETE2 - 6} to={GRITO + 20} head={[nubiHead[0], nubiHead[1] - 0.65, nubiHead[2] + 0.2]} every={5} seed={3} spread={1.2} />
          <group position={CASE_REST} rotation={[0, 0.1, 0]}>
            <Briefcase />
          </group>
        </Stage>
        {wFade > 0.02 ? <MoneyCounter frame={g} soles={wSoles} x={wC.x} y={wC.y} scale={wC.scale} state="earning" events={wEvents} opacity={wFade} /> : null}
        {nubiC.behind ? null : <MoneyCounter frame={g} soles={0} x={nubiC.x} y={nubiC.y} scale={nubiC.scale * (1 + 0.15 * peekBump)} state="zero" />}
        {sensorScreen.behind ? null : (
          <SleepSensor frame={g} x={labelX} y={labelY} scale={labelScale} state="awake" buzzAt={FINGIR} appear={FINGIR - 3} />
        )}
      </Shake>
    </AbsoluteFill>
  );
};
