import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { Glow } from "../../three/thanos/FX";
import {
  HALL_BG,
  HALL_LADY,
  Hallway,
  HallLights,
  Hearts,
  LADY_BUN_TOP,
  LADY_SIZE,
  Lady,
  LifeStream,
  Mop,
  blinkAt,
  finTipWorld,
  headTop,
} from "../../three/tiempo/Office";
import { SENORA } from "../beats";
import { LADY_EVENTS, NUBI_EVENTS, ladySeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { ladyTalk, tiempoTalk } from "../talk";

// Shot "senora" (SENORA.START → END): TIMECO's hallway at night.
// A (START → L09) wide: the old cleaning lady mops frantically on the wet tiles, her counter red
//   and ticking (00:00:18 exactly on "dieciocho"); Nubi rushes in from the left at START+6 and
//   stops, shocked, for L08.
// B (L09 → TOME−8) closer on her: tired, sad eyes, still mopping, for L09.
// C (TOME−8 → END) the two-shot: Nubi holds out its fin, the fins touch at TOME, a stream of green
//   life flows from Nubi to her (TOME → ANO+20); at ANO her counter jumps (+1 AÑO) and Nubi's pops
//   −1 AÑO; at INVITO Nubi hops; at HUG she drops the mop and hugs Nubi, hearts float up.
// The two counters are stacked (hers floats a little higher) so both stay readable side by side.

const FPS = 30;
const NUBI_SIZE = 2;
/** Her counter floats a little above her bun when Nubi stands beside her. */
const LADY_LIFT = 0.75;

// ---- Where everyone stands ------------------------------------------------------------
const LADY_A: Vec3 = HALL_LADY;
const NUBI_A: Vec3 = [LADY_A[0] - 2.4, 0, LADY_A[2] + 0.35];
const NUBI_C: Vec3 = [-0.9, 0, 0.8];
const NUBI_C_YAW = 0.38;
const LADY_C_YAW = -0.42;
/** The touch: Nubi's screen-right fin and her screen-left fin meet; her spot is solved from it. */
const TOUCH_NUBI: NubiPose = { finR: 0.55, pitch: 0.04 };
const TOUCH_LADY: NubiPose = { finL: 1.05, pitch: 0.1, squash: 0.97 };
const TIP_N = finTipWorld(NUBI_C, NUBI_C_YAW, NUBI_SIZE, TOUCH_NUBI, "R");
const TIP_L0 = finTipWorld([0, 0, 0], LADY_C_YAW, LADY_SIZE, TOUCH_LADY, "L");
const LADY_C: Vec3 = [TIP_N[0] - TIP_L0[0] + 0.04, 0, TIP_N[2] - TIP_L0[2]];

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const rotY = (v: Vec3, a: number): Vec3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** The lady mopping: hunched, the mop in her screen-right fin swinging with `stroke` (−1..1). */
const mopping = (stroke: number, hunch: number): NubiPose => ({
  pitch: 0.17 * hunch,
  squash: 1 - 0.05 * hunch,
  finR: 0.32 + 0.2 * stroke,
  finL: -0.12 - 0.08 * stroke,
  roll: -0.05 * stroke,
  yaw: 0.1 * stroke,
  lookX: 0.25,
  lookY: -0.45 * hunch,
});

export const SenoraShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.senora.from;
  const { START, END, L08, DIECIOCHO, L09, ALQUILER, TOME, ANO, INVITO, HUG } = SENORA;
  const t = g / FPS;
  const B0 = L09;
  const C0 = TOME - 8;
  const RUN0 = START + 6;
  const STOP = L08;

  // ---- Shared beats -----------------------------------------------------------------------
  const year = ramp(g, ANO, ANO + 14, [0, 1], EASE_OUT);
  const stream = windowIn(g, TOME, ANO + 20, 6);
  const hug = ramp(g, HUG - 4, HUG + 6, [0, 1], EASE_IN_OUT);
  const drop = ramp(g, HUG - 4, HUG + 5, [0, 1], (x) => x * x);
  // Mop strokes: frantic in A, tired in B and C, none once she lets go.
  const rate = g < B0 ? 0.62 : 0.3;
  const stroke = Math.sin(g * rate) * (g < C0 ? 1 : 0.55 * (1 - stream) * (1 - year * 0.6));

  // ---- The lady -----------------------------------------------------------------------
  let ladyAt: Vec3 = LADY_A;
  let ladyYaw = 0.15;
  let ladyBase: NubiPose;
  let sad = 0.6;
  let glint = 0;
  if (g < B0) {
    const glance = windowIn(g, L08 + 6, B0 + 4, 6);
    ladyBase = { ...mopping(stroke, 1), lookX: mix(0.25, -0.7, glance), lookY: mix(-0.45, -0.1, glance), blink: blinkAt(g, 41) };
    ladyYaw = mix(0.15, -0.3, glance);
    sad = 0.55;
  } else if (g < C0) {
    const sigh = windowIn(g, ALQUILER - 2, ALQUILER + 16, 6);
    ladyBase = {
      ...mopping(stroke, 1),
      lookX: -0.55,
      lookY: -0.05 - 0.25 * sigh,
      squash: 0.95 - 0.05 * sigh,
      blink: Math.max(0.3, 0.75 * sigh, blinkAt(g, 41)),
      eyeScale: 0.92,
    };
    ladyYaw = -0.35;
    sad = 0.9;
  } else {
    ladyAt = lerp3(LADY_C, [LADY_C[0] - 0.42, 0, LADY_C[2] + 0.05], hug);
    ladyYaw = mix(LADY_C_YAW, -0.8, hug);
    const reach = ramp(g, C0, TOME, [0, 1], EASE_IN_OUT);
    const pop = windowIn(g, ANO, ANO + 16, 3);
    ladyBase = {
      ...mopping(stroke, 1 - 0.85 * year),
      finL: mix(mix(-0.1, TOUCH_LADY.finL ?? 0, reach), 0.5, year * (1 - stream)),
      squash: (TOUCH_LADY.squash ?? 1) + 0.06 * year + 0.05 * pop,
      hop: 0.8 * pop * Math.max(0, Math.sin((g - ANO) * 0.5)),
      lookX: -0.55,
      lookY: mix(-0.1, 0.15, year),
      eyeScale: mix(0.95, 1.18, year) + 0.15 * pop,
      blink: g < ANO ? Math.max(0.25, blinkAt(g, 41)) : blinkAt(g, 41),
    };
    if (g >= HUG - 4) {
      ladyBase = {
        ...ladyBase,
        finL: mix(ladyBase.finL ?? 0, 1.35, hug),
        finR: mix(ladyBase.finR ?? 0, 1.1, hug),
        roll: mix(0, 0.14, hug),
        pitch: mix(ladyBase.pitch ?? 0, -0.05, hug),
        blink: mix(0, 0.88, hug),
        hop: 0.5 * hug * Math.max(0, Math.sin((g - HUG) * 0.6)),
      };
    }
    sad = 0.85 * (1 - year);
    glint = year > 0 ? 0.5 + 0.5 * Math.sin(g * 0.5) : 0;
  }
  const ladyPose = g >= L09 && g < C0 ? ladyTalk(g, ladyBase, 0.75) : ladyBase;
  if (g >= L09 && g < C0) ladyPose.finR = ladyBase.finR;

  // The mop: head on the floor out to her screen-right, stick up to her fin tip.
  const mopTop = finTipWorld(ladyAt, ladyYaw, LADY_SIZE, ladyPose, "R");
  const headLocal: Vec3 = [0.95 + 0.34 * stroke, 0.0, 0.5 + 0.12 * Math.cos(g * rate)];
  const mopHead = add([ladyAt[0], 0, ladyAt[2]], rotY(headLocal, ladyYaw));
  const fallen: Vec3 = [mopHead[0] + 1.3, 0.06, mopHead[2] + 0.6];
  const mopTopNow = g >= HUG - 4 ? lerp3(mopTop, fallen, drop) : mopTop;

  // ---- Nubi --------------------------------------------------------------------------
  let nubiAt: Vec3 = NUBI_A;
  let nubiYaw = 0.25;
  let nubiBase: NubiPose = {};
  let showNubi = true;
  if (g < B0) {
    const run = ramp(g, RUN0, STOP, [0, 1], (x) => 1 - (1 - x) * (1 - x));
    showNubi = g >= RUN0 - 1;
    nubiAt = lerp3([NUBI_A[0] - 4.2, 0, NUBI_A[2] + 0.2], NUBI_A, run);
    const skid = g >= STOP ? Math.exp(-(g - STOP) * 0.25) : 0;
    const ph = t * 14;
    const running = g < STOP ? 1 : 0;
    nubiBase = {
      hop: running * Math.abs(Math.sin(ph)) * 1.8,
      pitch: running * 0.2 - 0.16 * skid,
      squash: 1 + running * 0.08 * Math.cos(ph * 2) - 0.12 * skid,
      wiggle: running,
      wigglePhase: ph * 2,
      finL: running * (0.5 + 0.4 * Math.sin(ph)) + (1 - running) * (0.85 + 0.1 * Math.sin(g * 0.4)),
      finR: running * (0.5 - 0.4 * Math.sin(ph)) + (1 - running) * (0.7 + 0.35 * windowIn(g, DIECIOCHO - 6, DIECIOCHO + 20, 5)),
      eyeScale: running ? 1.15 : 1.45,
      lookX: 0.55,
      lookY: running ? 0 : 0.35,
      roll: running * 0.06 * Math.sin(ph),
    };
    nubiYaw = mix(0.9, 0.3, run);
  } else if (g < C0) {
    showNubi = false;
  } else {
    nubiAt = lerp3(NUBI_C, [NUBI_C[0] + 0.22, 0, NUBI_C[2]], hug);
    nubiYaw = mix(NUBI_C_YAW, 0.7, hug);
    const reach = ramp(g, C0, TOME, [0, 1], EASE_IN_OUT);
    const offer = 1 - ramp(g, ANO + 20, ANO + 28, [0, 1], EASE_IN_OUT);
    const hopK = g >= INVITO && g < INVITO + 14 ? Math.sin((Math.PI * (g - INVITO)) / 14) : 0;
    const happy = ramp(g, INVITO - 2, INVITO + 4, [0, 1], EASE_OUT) * (1 - hug);
    nubiBase = {
      finR: mix(0.1, TOUCH_NUBI.finR ?? 0, reach) * offer + (1 - offer) * (0.25 + 0.9 * happy),
      finL: -0.1 + 0.95 * happy,
      pitch: TOUCH_NUBI.pitch,
      hop: 2.6 * hopK,
      squash: 1 + 0.08 * hopK - 0.05 * (g >= INVITO + 13 && g < INVITO + 18 ? 1 : 0),
      lookX: 0.5,
      lookY: 0.05 + 0.25 * windowIn(g, ANO - 2, ANO + 24, 4),
      eyeScale: 1.1 + 0.15 * happy,
      wiggle: 0.6 * happy,
      wigglePhase: g * 0.6,
    };
    if (g >= HUG - 4) {
      nubiBase = {
        ...nubiBase,
        finR: mix(nubiBase.finR ?? 0, 1.25, hug),
        finL: mix(nubiBase.finL ?? 0, 0.55, hug),
        roll: mix(0, -0.12, hug),
        blink: mix(0, 0.85, hug),
        squash: 1 - 0.04 * hug,
      };
    }
  }
  const nubiTalks = (g >= L08 && g < B0) || g >= TOME - 1;
  const nubiPose = nubiTalks ? tiempoTalk(g, nubiBase, 0.8) : nubiBase;
  if (g >= C0) {
    // The fin stays on hers while the year flows; the hug keeps its shape.
    nubiPose.finR = nubiBase.finR;
    if (g >= HUG - 4) nubiPose.finL = nubiBase.finL;
  }

  // ---- Cameras --------------------------------------------------------------------------
  let cam: Cam;
  if (g < B0) {
    const u = ramp(g, START, B0, [0, 1], (x) => x);
    cam = aim(lerp3([0.2, 2.8, 18.2], [0.1, 2.6, 16.6], u), 38, [LADY_A[0] - 1.2, 0, LADY_A[2] + 0.2], 490, 1262);
  } else if (g < C0) {
    const u = ramp(g, B0, C0, [0, 1], (x) => x);
    cam = aim(lerp3([1.9, 1.55, 7.9], [1.8, 1.5, 7.2], u), 38, [LADY_A[0], 0.9, LADY_A[2]], 575, 1010);
  } else {
    const u = ramp(g, C0, END, [0, 1], EASE_IN_OUT);
    const mid: Vec3 = [(NUBI_C[0] + LADY_C[0]) / 2, 0, (NUBI_C[2] + LADY_C[2]) / 2];
    cam = aim(lerp3([0.4, 2.5, 16.0], [0.3, 2.3, 14.6], u), 38, mid, 505, 1262);
  }

  // ---- Life counters --------------------------------------------------------------------
  const ladyS = LADY_SIZE / 10;
  const ladyHead: Vec3 = [
    ladyAt[0],
    (ladyPose.hop ?? 0) * ladyS + LADY_BUN_TOP * ladyS * (ladyPose.squash ?? 1) + 0.1 + (showNubi ? LADY_LIFT : 0),
    ladyAt[2],
  ];
  const nubiHead = headTop(nubiAt, NUBI_SIZE, nubiPose, 0.12);
  const ladyC = counterAt(cam, ladyHead, { ref: 9, min: 0.85, max: 1.1 });
  const nubiC = counterAt(cam, nubiHead, { ref: 9, min: 0.85, max: 1.1 });

  // ---- FX positions --------------------------------------------------------------------
  const nubiChest = add(nubiAt, rotY([0.35, 1.05, 0.6], nubiYaw));
  const ladyChest = add(ladyAt, rotY([-0.2, 0.8, 0.5], ladyYaw));
  const touchTip = finTipWorld(nubiAt, nubiYaw, NUBI_SIZE, nubiPose, "R");
  const touchK = g >= C0 ? windowIn(g, TOME - 1, ANO + 22, 4) : 0;
  const flash = g >= TOME ? Math.max(0, 1 - (g - TOME) / 10) : 0;
  const burst = g >= ANO ? Math.max(0, 1 - (g - ANO) / 14) : 0;

  return (
    <AbsoluteFill style={{ background: HALL_BG }}>
      <Shake frame={g} impacts={[{ at: STOP, amp: 6, dur: 10 }, { at: ANO, amp: 5, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <HallLights />
          <Hallway t={t} />
          <Lady position={ladyAt} rotationY={ladyYaw} pose={ladyPose} sad={sad} glint={glint} />
          <Mop head={mopHead} top={mopTopNow} />
          {showNubi ? <Nubi size={NUBI_SIZE} position={nubiAt} rotationY={nubiYaw} pose={nubiPose} shadowOpacity={0.4} /> : null}
          <DustPuff frame={g} at={STOP} position={[NUBI_A[0], 0.02, NUBI_A[2]]} radius={1.0} color="#C9D4F0" count={10} />
          {g >= C0 ? (
            <>
              <LifeStream from={nubiChest} to={ladyChest} t={t} amount={stream} lift={0.5} />
              <Glow color="#6DFF9A" size={0.6 + 0.9 * flash + 0.12 * Math.sin(g * 0.7)} opacity={0.8 * touchK} position={touchTip} />
              <Glow color="#8DFFB0" size={2.6 * burst + 0.01} opacity={0.75 * burst} position={ladyChest} />
              <Twinkles frame={g} at={ANO} position={[ladyAt[0], 0.9, ladyAt[2]]} radius={1.0} count={14} color="#9DFFB8" />
              <Hearts g={g} at={HUG} position={[(nubiAt[0] + ladyAt[0]) / 2, 1.9, (nubiAt[2] + ladyAt[2]) / 2 + 0.3]} count={8} />
            </>
          ) : null}
        </Stage>
        {!ladyC.behind ? <LifeCounter frame={g} seconds={ladySeconds(g)} {...ladyC} events={LADY_EVENTS} /> : null}
        {showNubi && !nubiC.behind ? (
          <LifeCounter frame={g} seconds={nubiSeconds(g)} {...nubiC} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
