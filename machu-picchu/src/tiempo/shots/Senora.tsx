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
  HallLights,
  HallReflection,
  Hallway,
  Hearts,
  LADY_BUN_TOP,
  LADY_SIZE,
  Lady,
  LifeStream,
  Mop,
  Splashes,
} from "../../three/tiempo/Hallway";
import { blinkAt, finTipWorld, headTop } from "../../three/tiempo/Office";
import { SENORA } from "../beats";
import { LADY_EVENTS, NUBI_EVENTS, YEAR, ladySeconds, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { ladyTalk, tiempoTalk } from "../talk";

// Shot "senora" (SENORA.START → END): TIMECO's hallway at night (tall windows on the night city,
// wet shiny tiles that mirror everything, the vending machine under the red TIMECO neon, the
// "PISO MOJADO" sign).
// A (START → L09) wide: the old cleaning lady mops frantically, water flying, her counter red and
//   ticking (00:00:18 exactly on "dieciocho"); Nubi dashes in from the left at START+6 and skids
//   to a stop on L08, eyes huge. The camera creeps in.
// B (L09 → TOME−8) medium on her: tired, sad eyes, mopping slowly; a sigh on "alquiler".
// C (TOME−8 → END) the two-shot: Nubi stretches out its fin, the fins touch on TOME, a stream of
//   green life flows from Nubi to her (TOME → ANO+20) and warms the scene; at ANO her counter
//   jumps (+1 AÑO) and Nubi's pops −1 AÑO; at INVITO Nubi hops; at HUG she drops the mop and
//   hugs Nubi, hearts float up.
// The two counters are stacked (hers floats higher) so both stay readable side by side; they are
// kept inside x 60-940 and below y 460 (their popups included).

const FPS = 30;
const NUBI_SIZE = 2;
const SAFE_L = 60;
const SAFE_R = 940;

// ---- Where everyone stands ------------------------------------------------------------
const LADY_A: Vec3 = HALL_LADY;
const NUBI_A: Vec3 = [LADY_A[0] - 2.25, 0, LADY_A[2] + 0.35];
const NUBI_C: Vec3 = [-1.05, 0, 0.85];
const NUBI_C_YAW = 0.2;
const LADY_C_YAW = -0.26;
/** The touch: Nubi's screen-right fin and her screen-left fin meet; her spot is solved from it. */
const TOUCH_NUBI: NubiPose = { finR: 1.0, pitch: 0.03 };
const TOUCH_LADY: NubiPose = { finL: 1.2, pitch: 0.08, squash: 0.97 };
const TIP_N = finTipWorld(NUBI_C, NUBI_C_YAW, NUBI_SIZE, TOUCH_NUBI, "R");
const TIP_L0 = finTipWorld([0, 0, 0], LADY_C_YAW, LADY_SIZE, TOUCH_LADY, "L");
const LADY_C: Vec3 = [TIP_N[0] - TIP_L0[0] + 0.03, 0, TIP_N[2] - TIP_L0[2]];

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

/** Half the on-screen width of a life counter (to keep it inside the safe area). */
const counterHalf = (seconds: number, scale: number) => (seconds >= YEAR ? 300 : seconds >= 86400 ? 235 : 215) * scale;
const keepInside = <T extends { x: number; scale: number }>(c: T, seconds: number): T => {
  const h = counterHalf(seconds, c.scale);
  return { ...c, x: Math.min(SAFE_R - h, Math.max(SAFE_L + h, c.x)) };
};

export const SenoraShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.senora.from;
  const { START, END, L08, DIECIOCHO, L09, ALQUILER, TOME, ANO, INVITO, HUG } = SENORA;
  const t = g / FPS;
  const B0 = L09;
  const C0 = TOME - 8;
  const RUN0 = START + 6;
  const STOP = L08;
  const HUG0 = HUG - 6;

  // ---- Shared beats -----------------------------------------------------------------------
  const year = ramp(g, ANO, ANO + 14, [0, 1], EASE_OUT);
  const stream = windowIn(g, TOME, ANO + 20, 6);
  const hug = ramp(g, HUG0, HUG + 4, [0, 1], EASE_IN_OUT);
  const drop = ramp(g, HUG0, HUG0 + 9, [0, 1], (x) => x * x);
  const warm = ramp(g, TOME - 2, ANO + 12, [0, 1], EASE_IN_OUT);
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
      blink: Math.max(0.25, 0.75 * sigh, blinkAt(g, 41)),
      eyeScale: 0.95,
    };
    ladyYaw = -0.35;
    sad = 0.9;
  } else {
    ladyAt = lerp3(LADY_C, [LADY_C[0] - 0.4, 0, LADY_C[2] + 0.05], hug);
    ladyYaw = mix(LADY_C_YAW, -0.55, hug);
    const reach = ramp(g, C0, TOME, [0, 1], EASE_IN_OUT);
    const joy = windowIn(g, ANO, ANO + 18, 3);
    ladyBase = {
      ...mopping(stroke, 1 - 0.85 * year),
      finL: mix(mix(-0.1, TOUCH_LADY.finL ?? 0, reach), 0.5, year * (1 - stream)),
      squash: (TOUCH_LADY.squash ?? 1) + 0.06 * year + 0.05 * joy,
      hop: 0.9 * joy * Math.max(0, Math.sin((g - ANO) * 0.5)),
      lookX: -0.55,
      lookY: mix(-0.1, 0.15, year),
      eyeScale: mix(0.95, 1.2, year) + 0.15 * joy,
      blink: g < ANO ? Math.max(0.2, blinkAt(g, 41)) : blinkAt(g, 41),
    };
    if (g >= HUG0) {
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
    // A twinkle across her glasses as the year lands.
    glint = windowIn(g, ANO + 2, ANO + 16, 5);
  }
  const ladyTalks = g >= L09 && g < C0;
  const ladyPose = ladyTalks ? ladyTalk(g, ladyBase, 0.75) : ladyBase;
  if (ladyTalks) ladyPose.finR = ladyBase.finR;

  // The mop: head on the floor out to her screen-right, stick up to her fin tip.
  const mopTop = finTipWorld(ladyAt, ladyYaw, LADY_SIZE, ladyPose, "R");
  const headLocal: Vec3 = [0.95 + 0.34 * stroke, 0.0, 0.5 + 0.12 * Math.cos(g * rate)];
  const mopHead = add([ladyAt[0], 0, ladyAt[2]], rotY(headLocal, ladyYaw));
  const fallen: Vec3 = [mopHead[0] + 1.3, 0.06, mopHead[2] + 0.6];
  const mopTopNow = g >= HUG0 ? lerp3(mopTop, fallen, drop) : mopTop;
  const splash = g < B0 ? 1 : g < C0 ? 0.35 : 0;

  // ---- Nubi --------------------------------------------------------------------------
  let nubiAt: Vec3 = NUBI_A;
  let nubiYaw = 0.25;
  let nubiBase: NubiPose = {};
  let showNubi = true;
  const arrive = ramp(g, RUN0, STOP, [0, 1], (x) => 1 - (1 - x) * (1 - x));
  if (g < B0) {
    showNubi = g >= RUN0 - 1;
    nubiAt = lerp3([NUBI_A[0] - 4.6, 0, NUBI_A[2] + 0.2], NUBI_A, arrive);
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
      eyeScale: running ? 1.15 : 1.5,
      lookX: 0.55,
      lookY: running ? 0 : 0.3,
      roll: running * 0.06 * Math.sin(ph),
    };
    nubiYaw = mix(0.9, 0.3, arrive);
  } else if (g < C0) {
    showNubi = false;
  } else {
    nubiAt = lerp3(NUBI_C, [NUBI_C[0] + 0.22, 0, NUBI_C[2]], hug);
    nubiYaw = mix(NUBI_C_YAW, 0.55, hug);
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
    if (g >= HUG0) {
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
    if (g >= HUG0) nubiPose.finL = nubiBase.finL;
  }

  // ---- Cameras --------------------------------------------------------------------------
  let cam: Cam;
  if (g < B0) {
    // Wide, creeping in; a little push on the skid.
    const u = ramp(g, START, B0, [0, 1], (x) => x);
    const push = ramp(g, STOP - 2, STOP + 14, [0, 1], EASE_OUT);
    cam = aim(lerp3([-0.1, 1.9, 20.6], [-0.2, 1.8, 18.4], u * 0.75 + push * 0.25), 38, [NUBI_A[0] / 2 + LADY_A[0] / 2, 0, 0.7], 545, 1262);
  } else if (g < C0) {
    const u = ramp(g, B0, C0, [0, 1], (x) => x);
    cam = aim(lerp3([2.4, 1.5, 10.6], [2.2, 1.45, 9.7], u), 38, [LADY_A[0], 0.93, LADY_A[2]], 560, 1030);
  } else {
    const u = ramp(g, C0, END, [0, 1], EASE_IN_OUT);
    const mid: Vec3 = [(NUBI_C[0] + LADY_C[0]) / 2, 0, (NUBI_C[2] + LADY_C[2]) / 2];
    cam = aim(lerp3(add(mid, [0.35, 1.7, 16.8]), add(mid, [0.25, 1.55, 15.0]), u), 38, mid, 528, 1266);
  }

  // ---- Life counters --------------------------------------------------------------------
  const ladyS = LADY_SIZE / 10;
  const lift = g < B0 ? 0.78 * arrive : g < C0 ? 0 : 0.55;
  const ladyHead: Vec3 = [ladyAt[0], (ladyPose.hop ?? 0) * ladyS + LADY_BUN_TOP * ladyS * (ladyPose.squash ?? 1) - 0.12 * (ladyPose.pitch ?? 0) + 0.1 + lift, ladyAt[2]];
  const nubiHead = headTop(nubiAt, NUBI_SIZE, { ...nubiPose, hop: (nubiPose.hop ?? 0) * 0.5 }, 0.12);
  const ladySecs = ladySeconds(g);
  const nubiSecs = nubiSeconds(g);
  const ladyC = keepInside(counterAt(cam, ladyHead, { ref: 9, min: 0.85, max: 1.0 }), ladySecs);
  // Nubi's counter rides in with it on the dash (only kept inside the frame once it has stopped).
  const nubiRaw = counterAt(cam, nubiHead, { ref: 9, min: 0.85, max: 1.0 });
  const nubiC = g < STOP ? nubiRaw : keepInside(nubiRaw, nubiSecs);

  // ---- FX positions --------------------------------------------------------------------
  // The life leaves Nubi's side by its fin, crosses the touching fin tips and sinks into her apron.
  const nubiChest = add(nubiAt, rotY([0.84, 0.76, 0.85], nubiYaw));
  const streamEnd = add(ladyAt, rotY([-0.58, 0.42, 0.9], ladyYaw));
  const ladyChest = add(ladyAt, rotY([-0.1, 0.55, 0.9], ladyYaw));
  const touchTip = finTipWorld(nubiAt, nubiYaw, NUBI_SIZE, nubiPose, "R");
  const contact: Vec3 = [touchTip[0] + 0.02, touchTip[1] - 0.03, touchTip[2] + 0.05];
  const touchK = g >= C0 ? windowIn(g, TOME - 1, ANO + 22, 4) : 0;
  const flash = g >= TOME ? Math.max(0, 1 - (g - TOME) / 10) : 0;
  const burst = g >= ANO ? Math.max(0, 1 - (g - ANO) / 14) : 0;
  const pairMid: Vec3 = [(nubiAt[0] + ladyAt[0]) / 2, 0, (nubiAt[2] + ladyAt[2]) / 2];

  const actors = (
    <>
      <Lady position={ladyAt} rotationY={ladyYaw} pose={ladyPose} sad={sad} glint={glint} />
      <Mop head={mopHead} top={mopTopNow} />
      {showNubi ? <Nubi size={NUBI_SIZE} position={nubiAt} rotationY={nubiYaw} pose={nubiPose} shadowOpacity={0.4} /> : null}
    </>
  );
  const gift =
    g >= C0 ? (
      <LifeStream from={nubiChest} to={streamEnd} via={contact} t={t} amount={stream} width={0.09} onTop />
    ) : null;

  return (
    <AbsoluteFill style={{ background: HALL_BG }}>
      <Shake frame={g} impacts={[{ at: STOP, amp: 6, dur: 10 }, { at: ANO, amp: 5, dur: 10 }]}>
        <Stage cam={cam} near={0.1}>
          <HallLights />
          {/* The gift warms the scene: green light at the fins, then a warm glow on both faces. */}
          <pointLight position={[pairMid[0], 1.7, pairMid[2] + 1.6]} intensity={2.2 * stream} distance={5} decay={1.5} color="#7DFFAA" />
          <pointLight position={[pairMid[0] + 0.3, 5.5, pairMid[2] + 2.4]} intensity={4.5 * warm} distance={10} decay={1.1} color="#FFC98A" />
          <Hallway t={t} />
          {actors}
          <HallReflection t={t}>
            {actors}
            {g >= C0 ? <LifeStream from={nubiChest} to={streamEnd} via={contact} t={t} amount={stream * 0.35} width={0.09} /> : null}
          </HallReflection>
          <Splashes g={g} origin={mopHead} amount={splash} />
          <DustPuff frame={g} at={STOP} position={[NUBI_A[0], 0.02, NUBI_A[2]]} radius={1.0} color="#BFE3FF" count={12} />
          {g >= C0 ? (
            <>
              {gift}
              <Glow color="#6DFF9A" size={0.32 + 0.8 * flash + 0.06 * Math.sin(g * 0.7)} opacity={0.75 * touchK} position={contact} />
              <Twinkles frame={g} at={TOME} position={contact} radius={0.35} count={8} color="#D9FFE4" />
              {/* Her body fills up with green life while it flows in. */}
              <Glow color="#4DFF88" size={0.9 + 0.2 * Math.sin(g * 0.4)} opacity={0.2 * stream} position={ladyChest} />
              <Glow color="#5DFF95" size={1.6 * burst + 0.01} opacity={0.45 * burst} position={ladyChest} />
              <Twinkles frame={g} at={ANO} position={[ladyAt[0], 0.9, ladyAt[2]]} radius={1.0} count={14} color="#9DFFB8" />
              <Hearts g={g} at={HUG - 4} position={[pairMid[0] + 0.1, 1.05, pairMid[2] + 0.9]} count={12} every={1.5} spread={2.0} rise={1.5} />
            </>
          ) : null}
        </Stage>
        {!ladyC.behind ? <LifeCounter frame={g} seconds={ladySecs} {...ladyC} events={LADY_EVENTS} /> : null}
        {showNubi && !nubiC.behind ? (
          <LifeCounter frame={g} seconds={nubiSecs} {...nubiC} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
