import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, keyframes, pop, ramp, windowIn } from "../../anim";
import { Upright } from "../../inca/outfit";
import { MoneyCounter } from "../../overlay/dormir/DormirUI";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import {
  BED,
  BOSS_SPOT,
  BedSensor,
  Briefcase,
  HeroDuvet,
  NUBI_BED,
  NUBI_DUVET,
  NubiEyes,
  OfficeBedsLights,
  OfficeBedsSet,
  SENSOR_LOCAL,
  SLEEPERS,
  Sleepers,
  WORKER_BED,
  WORKER_DUVET,
  Zzz,
  bedHead,
  inBed,
  sleeperHead,
  sleeperSoles,
  trotPose,
} from "../../three/dormir/OfficeBeds";
import { BOSS_SIZE, Boss, BossMug, Worker } from "../../three/ia/Work";
import { finTipWorld } from "../../three/tiempo/Office";
import { Glow } from "../../three/thanos/FX";
import { OFICINA } from "../beats";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { jefeTalk, nubiTalk } from "../talk";
import { DORMIR } from "../timeline";

// Shot "oficina" (OFICINA.START → END): SIESTA S.A.C., the office where every desk is a bed.
// One continuous shot from the corridor, slightly above: the rows of beds behind (colleagues asleep,
// counters climbing), Nubi's bed in front (yellow duvet, the sleep sensor on its headboard) and the
// boss standing proudly in the corridor beside it with his red mug.
// START → DIVE   Nubi trots in late with a tiny briefcase, turns to its bed and crouches.
// DIVE           belly-flop dive into the bed (the briefcase lands by the nightstand); the duvet
//                whooshes over it: a wriggling mound. The sensor wakes up RED (awake).
// L03            the boss, outraged: «¡Nubi! ¿Por qué sigues despierto?» — the mound jumps, Nubi pops
//                out sitting up, eyes wide, shrinking under the boss's pointing fin.
// L04            «Perdón, jefe. Ya me pongo a trabajar.» sheepish bows; on "trabajar" a salute and it
//                flops back, eyes shut, duvet to the chin. Its counter appears: S/ 0.
// SNORE          (fake) snoring: big Zs, heaving duvet. NOD: the boss nods, proud, and sips.
// L05            «Por fin… talento reconocido.» (whispered V.O.): the camera pushes in on Nubi's smug
//                closed-eye smile (∩ ∩), a little wiggle under the duvet, a sparkle on "talento".

const FPS = 30;
const NUBI_SIZE = 2;
const HOLD: Vec3 = [0.2, -1.45, 0.55];
const WALK_FROM: Vec3 = [3.55, 0, 2.95];
const WALK_TO: Vec3 = [0.6, 0, 2.5];
/** Where the briefcase lands: on the floor between the beds, in front of Nubi's nightstand. */
const CASE_REST: Vec3 = [NUBI_BED[0] - BED.w / 2 - 0.4, 0.41, NUBI_BED[2] - 0.55];
const BOSS_RY = -0.95;
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

export const OficinaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.oficina.from;
  const { START, END, DIVE, L03, L04, SNORE, NOD, L05 } = OFICINA;
  const t = g / FPS;
  const LAND = DIVE + 9;
  const POP = L03 + 7;
  const TRABAJAR = DORMIR.wordAt("L04", 6);
  const LIE = TRABAJAR + 7;
  const TALENTO = DORMIR.wordAt("L05", 2);

  // ---- Nubi -----------------------------------------------------------------------------------
  let nubiAt: Vec3 = WALK_TO;
  let nubiRy = 0;
  let pose: NubiPose = {};
  let showNubi = true;
  let up = 0;
  let cover = 0;
  let squirm = 0;
  let jolt = 0;
  let holdCase = false;
  let eyes: React.ReactNode = null;
  if (g < DIVE) {
    // The trot in, then a quick turn to the bed and a crouch (anticipation).
    const u = ramp(g, START, DIVE - 3, [0, 1], (x) => x);
    const turn = ramp(g, DIVE - 7, DIVE, [0, 1], EASE_IN_OUT);
    const crouch = ramp(g, DIVE - 4, DIVE, [0, 1], EASE_OUT);
    const tr = trotPose(g * 0.95);
    nubiAt = lerp3(WALK_FROM, WALK_TO, u);
    nubiRy = mix(-1.2, -2.95, turn);
    pose = { ...tr, hop: (tr.hop ?? 0) * (1 - crouch), squash: mix(tr.squash ?? 1, 0.8, crouch), finL: mix(tr.finL ?? 0, -0.5, crouch), finR: mix(tr.finR ?? 0, -0.4, crouch), lookX: -0.35, lookY: -0.05, pitch: mix(0.12, 0.2, crouch) };
    holdCase = true;
  } else if (g < LAND) {
    // The dive: a belly-flop arc onto the bed, stretched, fins swept back.
    const u = (g - DIVE) / (LAND - DIVE);
    nubiAt = [mix(WALK_TO[0], 0.05, u), mix(0, 0.62, u) + 1.9 * 4 * u * (1 - u), mix(WALK_TO[2], -0.25, u)];
    nubiRy = -2.95 - 0.19 * u;
    pose = { pitch: 0.25 + 1.15 * u, squash: 1.18 - 0.1 * u, finL: -0.75, finR: -0.75, wiggle: 0.8, wigglePhase: g * 1.4, eyeScale: 1.2 };
  } else if (g < POP) {
    // Under the duvet: a wriggling mound; it jumps on "¡Nubi!".
    showNubi = g < LAND + 2;
    nubiAt = [0.05, 0.62, -0.25];
    nubiRy = -Math.PI;
    pose = { pitch: 1.4, squash: 0.8 };
    cover = pop(g, LAND, { damping: 13, stiffness: 260 });
    squirm = 1 - ramp(g, L03, L03 + 3);
    jolt = keyframes(g, [L03 + 1, L03 + 3, L03 + 7], [0, 1, 0.6]);
  } else {
    // Popped out, sitting up, facing the boss; L04 sheepish; then it flops back to "work".
    const out = pop(g, POP, { damping: 10, stiffness: 240 });
    const lie = ramp(g, LIE, LIE + 12, [0, 1], EASE_IN_OUT);
    up = clamp01(out) * (1 - lie) + Math.max(0, out - 1) * 0.8;
    cover = Math.max(0, 1 - ramp(g, POP, POP + 4, [0, 1], EASE_OUT));
    const bed = inBed(NUBI_BED, up, NUBI_SIZE);
    nubiAt = bed.position;
    const shocked = ramp(g, POP, POP + 4) * (1 - ramp(g, L04 - 6, L04 + 4));
    const shrink = ramp(g, DORMIR.wordAt("L03", 1), DORMIR.wordAt("L03", 4) + 6) * (1 - ramp(g, L04, L04 + 10));
    const salute = keyframes(g, [TRABAJAR - 3, TRABAJAR + 3, LIE + 2, LIE + 8], [0, 1, 1, 0]);
    const face = 1 - lie;
    let base: NubiPose = {
      pitch: bed.pitch + 0.1 * ramp(g, L04, L04 + 8) * face,
      yaw: 0.42 * face,
      lookX: 0.6 * face,
      lookY: 0.22 * face,
      eyeScale: 1 + 0.32 * shocked,
      squash: 1 - 0.07 * shrink - 0.04 * lie,
      finL: mix(-0.15 - 0.15 * shrink, 0.05, lie),
      finR: mix(-0.15 - 0.15 * shrink, 0.05, lie) + 1.35 * salute,
      roll: 0.025 * shrink * Math.sin(g * 2.1),
      blink: lie,
    };
    if (g >= L04 && g < LIE + 4) base = nubiTalk(g, base, 0.85 * face);
    if (g >= SNORE) {
      // Snoring (faking it): the body heaves with each big breath.
      const br = Math.sin(((g - SNORE) / 36) * Math.PI * 2);
      base = { ...base, squash: (base.squash ?? 1) * (1 + 0.035 * br), pitch: (base.pitch ?? 0) - 0.03 * br };
    }
    if (g >= L05) {
      // The smug wiggle: little side-to-side rolls, the talk (whispered) kept small.
      const sm = ramp(g, L05, L05 + 8);
      base = nubiTalk(g, { ...base, roll: 0.07 * sm * Math.sin((g - L05) * 0.32), yaw: 0.06 * sm * Math.sin((g - L05) * 0.21), finL: 0.25 * sm + 0.12 * Math.sin(g * 0.4), finR: 0.25 * sm + 0.12 * Math.sin(g * 0.4 + 2) }, 0.45);
      eyes = <NubiEyes left="happy" right="happy" />;
    }
    pose = base;
    if (lie > 0.5 && g < L05) eyes = <NubiEyes left="closed" right="closed" />;
  }
  const nubiPose: NubiPose = pose;

  // ---- The briefcase: in Nubi's fin, then tossed to the floor by the nightstand ------------------
  let caseNode: React.ReactNode = null;
  if (!holdCase) {
    const p0 = finTipWorld(WALK_TO, -2.95, NUBI_SIZE, { squash: 0.8, finR: -0.4, pitch: 0.2 }, "R");
    const u = ramp(g, DIVE, DIVE + 12, [0, 1], (x) => x);
    const land = g >= DIVE + 12;
    const p: Vec3 = land ? CASE_REST : [mix(p0[0], CASE_REST[0], u), mix(p0[1] - 0.1, CASE_REST[1], u) + 1.1 * 4 * u * (1 - u), mix(p0[2], CASE_REST[2], u)];
    const bounce = land ? Math.exp(-(g - DIVE - 12) * 0.35) * Math.abs(Math.sin((g - DIVE - 12) * 0.9)) * 0.08 : 0;
    caseNode = (
      <group position={[p[0], p[1] + bounce, p[2]]} rotation={[0, land ? 0.1 : -2.95 + 6.0 * u, land ? 0 : 0.6 * Math.sin(u * 7)]}>
        <Briefcase />
      </group>
    );
  }

  // ---- The sensor on Nubi's headboard: off until Nubi lands, then red (awake) ------------------------
  const sensorOn = g >= LAND + 1;
  const sensorPop = sensorOn ? pop(g, LAND + 1, { damping: 9, stiffness: 260 }) : 1;
  const sensorFlash = windowIn(g, LAND + 1, LAND + 12, 2) * 0.8 + windowIn(g, DORMIR.wordAt("L03", 4), DORMIR.wordAt("L03", 4) + 16, 3) * 0.7;

  // ---- The boss -------------------------------------------------------------------------------------
  const suspicious = ramp(g, LAND + 3, LAND + 10) * (1 - ramp(g, L03, L03 + 4));
  const outrage = ramp(g, L03 - 1, L03 + 3) * (1 - ramp(g, L04 - 4, L04 + 8, [0, 1], EASE_IN_OUT));
  const listen = ramp(g, L04 - 4, L04 + 8) * (1 - ramp(g, SNORE - 2, SNORE + 8));
  const proud = ramp(g, SNORE - 2, SNORE + 8);
  const sip0 = keyframes(g, [START, START + 4, START + 14, START + 22], [0.7, 1, 1, 0]);
  const sip1 = keyframes(g, [NOD + 20, NOD + 28, NOD + 46, NOD + 56], [0, 1, 1, 0]);
  const sip = Math.max(sip0, sip1);
  const nod = g >= NOD && g < NOD + 20 ? Math.max(0, Math.sin(((g - NOD) / 10) * Math.PI)) : 0;
  const shout = keyframes(g, [L03, L03 + 3, L03 + 10, L03 + 18], [0, 1, 0.6, 0]);
  // His eyes follow Nubi trotting past, then stay on the bed.
  const follow = g < LAND ? mix(0.35, -0.55, ramp(g, START + 2, LAND, [0, 1], EASE_IN_OUT)) : -0.55;
  let bBase: NubiPose = {
    pitch: -0.06 * proud + 0.06 * suspicious + 0.14 * outrage + 0.24 * nod + mix(0, -0.18, sip),
    roll: 0.07 * suspicious + 0.05 * listen,
    yaw: 0.12 * outrage,
    finL: -0.3 + 1.15 * outrage + 0.1 * shout,
    finR: mix(0.45, 1.25, sip),
    lookX: follow,
    lookY: 0.05 + 0.1 * outrage,
    eyeScale: 1 + 0.18 * outrage + 0.15 * shout,
    squash: 1 + 0.12 * shout + 0.02 * proud * Math.sin(g * 0.2),
    hop: 0.9 * shout,
    blink: 0.2 * sip,
  };
  if (g >= L03 && g < L04 + 4) bBase = jefeTalk(g, bBase, 1.15);
  const smug = g >= NOD ? mix(0.4, 0.78, Math.max(nod, sip1, ramp(g, NOD, NOD + 6) * 0.6)) : mix(mix(0.4, 0.62, suspicious), 0.12, outrage) + 0.2 * listen;
  const mug = (
    <Upright raise={bBase.finR ?? 0}>
      <group position={HOLD} scale={10 / BOSS_SIZE}>
        <BossMug />
      </group>
    </Upright>
  );

  // ---- Camera: the corridor two-shot, pushing in; on L05 it closes in on Nubi's smug face -----------
  const MID: Vec3 = [1.2, 1.25, -0.1];
  const FACE: Vec3 = [0.12, 1.6, 0.25];
  const uA = ramp(g, START, L03 + 30, [0, 1], EASE_IN_OUT);
  const uB = ramp(g, L03 + 30, L05, [0, 1], (x) => x);
  const uC = ramp(g, L05 + 6, END, [0, 1], EASE_IN_OUT);
  const posA = lerp3([2.5, 5.5, 13.6], [2.1, 4.7, 11.6], uA);
  const posB = lerp3(posA, [1.85, 4.35, 10.4], uB);
  const pos = lerp3(posB, [0.75, 3.15, 6.6], uC);
  const target = lerp3(MID, FACE, uC);
  const cam: Cam = aim(pos, 42, target, mix(560, 480, uC), mix(930, 900, uC));

  // ---- Counters ------------------------------------------------------------------------------------
  const nubiHead = bedHead(nubiAt, NUBI_SIZE, nubiPose, 0.5);
  const nubiC = counterAt(cam, nubiHead, { ref: 9, min: 0.6, max: 1.25 });
  const showNubiC = g >= SNORE - 6;
  const bg = SLEEPERS.map((b) => {
    const c = counterAt(cam, sleeperHead(b, g), { ref: 9, min: 0.42, max: 0.75 });
    const edge = clamp01((c.x - 150) / 50) * clamp01((850 - c.x) / 50) * clamp01((c.y - 300) / 40) * clamp01((1080 - c.y) / 60);
    // Keep clear of Nubi's own counter and of the boss's head.
    const clear = showNubiC ? clamp01((Math.hypot(c.x - nubiC.x, (c.y - nubiC.y) * 1.8) - 230) / 60) : 1;
    return { b, c, fade: c.behind ? 0 : edge * clear };
  });

  const sleeperZs = SLEEPERS.slice(0, 12).map((b) => {
    const h = sleeperHead(b, g);
    return <Zzz key={b.i} g={g} at={[h[0] + 0.35, h[1] - 0.45, h[2] + 0.3]} from={START - 60 + Math.floor((b.seed * 7) % 40)} every={44} life={60} size={0.32} dir={b.i % 2 ? 1 : -1} seed={b.seed} />;
  });

  return (
    <AbsoluteFill style={{ background: "#E7ECF7" }}>
      <Shake frame={g} impacts={[{ at: LAND, amp: 5, dur: 10 }, { at: L03 + 1, amp: 4, dur: 8 }]}>
        <Stage cam={cam} near={0.1} far={80}>
          <OfficeBedsLights />
          <OfficeBedsSet lampGlow={[0, 1, 4]} />
          <Sleepers g={g} />
          {sleeperZs}
          {/* Nubi's bed: duvet, sensor, Nubi, its Zs. */}
          <group position={NUBI_BED}>
            <HeroDuvet color={NUBI_DUVET} up={up} cover={cover} squirm={squirm} jolt={jolt} t={t} breathe={g >= SNORE ? Math.sin(((g - SNORE) / 36) * Math.PI * 2) : 0} />
            <group position={SENSOR_LOCAL}>
              <BedSensor state={sensorOn ? "awake" : "off"} g={g} flash={sensorFlash} pop={sensorPop} />
            </group>
          </group>
          {showNubi ? (
            <Nubi
              size={NUBI_SIZE}
              position={nubiAt}
              rotationY={nubiRy}
              pose={nubiPose}
              shadow={g < DIVE + 4}
              hideEyes={eyes !== null}
              holdR={
                holdCase ? (
                  <Upright raise={nubiPose.finR ?? 0}>
                    <group position={[0.3, -0.45, 0.5]} scale={10 / NUBI_SIZE}>
                      <Briefcase />
                    </group>
                  </Upright>
                ) : undefined
              }
            >
              {eyes}
            </Nubi>
          ) : null}
          {caseNode}
          <Zzz g={g} at={[nubiHead[0] + 0.45, nubiHead[1] - 0.35, nubiHead[2] + 0.4]} from={SNORE} every={18} life={46} size={0.5} rise={1.3} />
          {/* The colleague in the next bed (off to the left of this framing). */}
          <group position={WORKER_BED}>
            <HeroDuvet color={WORKER_DUVET} t={t} />
          </group>
          <Worker position={inBed(WORKER_BED, 0).position} pose={{ pitch: inBed(WORKER_BED, 0).pitch, blink: 1 }} droop={0} bags={0} shadowOpacity={0} />
          <Boss position={BOSS_SPOT} rotationY={BOSS_RY + 0.1 * outrage} pose={bBase} holdR={mug} smug={smug} />
          {/* A sparkle of pride on "talento". */}
          <Glow color="#FFF2A8" size={1.4 * windowIn(g, TALENTO - 2, TALENTO + 14, 4)} opacity={0.9} position={[FACE[0] + 0.85, FACE[1] + 0.75, FACE[2] + 0.5]} />
        </Stage>
        {bg.map(({ b, c, fade }) =>
          fade <= 0.02 ? null : <MoneyCounter key={b.i} frame={g} soles={sleeperSoles(b, g)} x={c.x} y={c.y} scale={c.scale} state="earning" opacity={fade} events={[]} />,
        )}
        {showNubiC && !nubiC.behind ? (
          <MoneyCounter frame={g} soles={0} x={nubiC.x} y={nubiC.y} scale={nubiC.scale} state="zero" appear={SNORE - 6} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
