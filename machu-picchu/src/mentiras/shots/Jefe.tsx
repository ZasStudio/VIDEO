import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, keyframes, pop, ramp, windowIn } from "../../anim";
import { Upright } from "../../inca/outfit";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { Lids, nubiPoint } from "../../three/dormir/Street";
import { BOSS_SIZE, Boss } from "../../three/ia/Work";
import {
  BOSS_DOOR,
  Backpack,
  CHAIR_SEAT,
  CHAIR_SPOTS,
  ClosedLaptop,
  DOOR,
  FrontWindows,
  OFI,
  OFI_BG,
  OficinaLights,
  OficinaSet,
  PackedWorker,
  faceDoor,
} from "../../three/mentiras/Oficina";
import { tagAt } from "../anchor";
import { JEFE } from "../beats";
import { SHOTS } from "../shots";
import { jefeTalk, nubiTalk } from "../talk";
import { MENTIRAS } from "../timeline";

// Shot "jefe" (JEFE.START → END, 8.2 s): 6:00 pm at the office. Cuts and moves on the beats:
// W (START → B)      high wide from the room towards the exit door (wall clock at 6:00, the green
//                    «SALIDA» sign, the golden hallway beyond): frame 0, Nubi and two co-workers are
//                    already trotting happily to the door, backpacks on. BLOCK: the boss slides into
//                    the doorway from the side (skid, overshoot), fins wide, a laptop under one fin;
//                    everyone screeches to a halt. The top band (y 230–400) stays calm for the badge.
// B (L13 → GROAN)    medium on the boss framed between two backpacks: «Una reunión rapidita. Cinco
//                    minutos.» (cheerful, the free fin up on "cinco"; the workers perk up, hopeful).
//                    TAG: «TRAJO 68 DIAPOSITIVAS» slams over his head (punch-in); the projector
//                    screen behind clicks on at «1 / 68».
// GROAN              the camera pulls back up to the wide: everyone droops (lids down, slumped) and
//                    walks slowly BACKWARDS to their chairs, in sync; DETAIL «Y PREGUNTAS AL FINAL»
//                    appends; they plop into the chairs.
// CU (L14 → END)     close-up on Nubi slumped in its chair, the sunset windows behind: whispered to
//                    camera «La mentira más peligrosa de todas.»; DUN: the light dims, a slow push-in.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const BOSS_EYES: Vec3 = [DOOR.x, 1.2, BOSS_DOOR[2]];
const HEAD_LOCAL: Vec3 = [0, 11.2, 1.4];

type Walker = { start: Vec3; halt: Vec3; chair: [number, number]; nubi: boolean; pack: string; delay: number };
const WALKERS: Walker[] = [
  { start: [-2.25, 0, 1.45], halt: [-2.2, 0, 0.35], chair: CHAIR_SPOTS[0], nubi: false, pack: "#E8473C", delay: 2 },
  { start: [-0.95, 0, 1.3], halt: [-0.95, 0, 0.12], chair: CHAIR_SPOTS[1], nubi: true, pack: "#FFC83D", delay: 0 },
  { start: [2.15, 0, 1.45], halt: [2.15, 0, 0.3], chair: CHAIR_SPOTS[2], nubi: false, pack: "#3D7BE8", delay: 1 },
];

/** The wide: high and far on a long lens (so the walkers and the boss read at similar sizes);
 * `push` 0..1 creeps in. */
const WIDE_FOV = 28;
const camWide = (push: number): Cam => aim(lerp3([0.35, 7.6, 19.5], [0.35, 7.3, 18.3], push), WIDE_FOV, BOSS_EYES, 560, 850);

export const JefeShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.jefe.from;
  const { START, BLOCK, L13, TAG, GROAN, DETAIL, L14, DUN } = JEFE;
  const CINCO = MENTIRAS.wordAt("L13", 3);
  const CUT_B = L13 + 6;
  const RETREAT = GROAN + 5;
  const SIT = L14 - 8;
  const t = g / 30;

  // ---- The boss: slides into the doorway, blocks it, talks; oblivious and cheerful. ---------------
  const slide = ramp(g, BLOCK - 3, BLOCK + 3, [0, 1], EASE_OUT);
  const settle = g >= BLOCK + 3 ? Math.exp(-(g - BLOCK - 3) / 4) * Math.sin((g - BLOCK - 3) * 0.9) : 0;
  const stepIn = ramp(g, BLOCK + 4, BLOCK + 10, [0, 1], EASE_IN_OUT);
  const bossAt: Vec3 = [DOOR.x + 2.6 * (1 - slide) - 0.18 * settle, 0, lerp(OFI.zBack - 0.55, BOSS_DOOR[2], stepIn)];
  const wide = ramp(g, BLOCK + 2, BLOCK + 8, [0, 1], EASE_OUT);
  const fiveUp = windowIn(g, CINCO - 2, CINCO + 26, 5);
  let bPose: NubiPose = {
    roll: -0.32 * (1 - slide) + 0.2 * settle,
    pitch: -0.05,
    hop: 0.6 * Math.abs(settle),
    squash: 1 - 0.08 * Math.abs(settle) + 0.03 * Math.sin(t * 3) * (g > BLOCK + 10 ? 1 : 0),
    finL: lerp(0.3, 1.0, wide) + 0.55 * fiveUp,
    finR: lerp(0.2, 0.42, wide),
    eyeScale: 1.15,
    lookX: 0,
    lookY: -0.05,
    wiggle: 0.8 * (1 - slide),
    wigglePhase: g * 1.4,
  };
  if (g >= L13 - 2) bPose = jefeTalk(g, bPose, 0.9);
  if (g >= TAG) {
    // He beams, oblivious: a happy little bounce now and then.
    const beam = Math.max(0, Math.sin((g - TAG) * 0.35));
    bPose = { ...bPose, hop: (bPose.hop ?? 0) + 0.35 * beam, squash: (bPose.squash ?? 1) * (1 + 0.03 * beam) };
  }
  const laptop = (
    <Upright raise={bPose.finR ?? 0}>
      <group position={[0.2, -1.9, 1.4]} rotation={[0, -0.25, 0.06]} scale={10 / BOSS_SIZE}>
        <ClosedLaptop />
      </group>
    </Upright>
  );

  // ---- The walkers: trot to the door, screech, listen, perk up, droop, walk back, sit. ------------
  const walkers = WALKERS.map((w) => {
    const haltAt = BLOCK + 6 + w.delay;
    const ry = faceDoor(w.halt[0], w.halt[2]);
    let at: Vec3;
    let pose: NubiPose;
    let droop = w.nubi ? 0 : 0.12;
    let bounce = 0;
    if (g < haltAt) {
      const k = (haltAt - g) / (haltAt - START);
      at = lerp3(w.halt, w.start, k);
      const ph = (g - START) * 0.78 + w.delay * 0.9;
      pose = {
        hop: 0.85 * Math.abs(Math.sin(ph)),
        squash: 1 + 0.06 * Math.sin(ph * 2 + 0.6),
        roll: 0.08 * Math.sin(ph),
        pitch: 0.06,
        wiggle: 1,
        wigglePhase: ph * 2,
        finL: 0.45 + 0.55 * Math.sin(ph),
        finR: 0.45 - 0.55 * Math.sin(ph),
        eyeScale: 1,
      };
      bounce = Math.abs(Math.sin(ph));
    } else {
      // Screech: lean back hard, squash, a little skid forward, then stand frozen.
      const d = g - haltAt;
      const skid = ramp(g, haltAt, haltAt + 5, [0, 1], EASE_OUT);
      const shock = windowIn(g, haltAt, haltAt + 22, 3);
      const hope = windowIn(g, CINCO, CINCO + 24, 6);
      const freeze = g >= TAG ? 1 - clamp01(pop(g, TAG, { damping: 9, stiffness: 320 })) : 0;
      const sag = ramp(g, GROAN, GROAN + 8, [0, 1], EASE_OUT);
      const back = ramp(g, RETREAT, SIT, [0, 1], (x) => x);
      const sit = ramp(g, SIT, SIT + 7, [0, 1], EASE_IN_OUT);
      const standAt: Vec3 = [w.chair[0], 0, w.chair[1] - 0.2];
      const fwd: Vec3 = [Math.sin(ry) * 0.22 * skid * (1 - back), 0, Math.cos(ry) * 0.22 * skid * (1 - back)];
      const base = lerp3(w.halt, standAt, back);
      at = [lerp(base[0] + fwd[0], w.chair[0], sit), CHAIR_SEAT * sit, lerp(base[2] + fwd[2], w.chair[1], sit)];
      // Backwards steps, all in sync.
      const step = g >= RETREAT && g < SIT ? (g - RETREAT) * 0.42 : 0;
      pose = {
        pitch: -0.32 * Math.exp(-d / 3) * (1 - skid * 0.4) + 0.24 * sag,
        squash: 1 - 0.14 * Math.exp(-d / 2.5) + 0.05 * hope - 0.06 * freeze - 0.18 * sag + 0.04 * Math.sin(step * 2) * (1 - sit),
        hop: 0.5 * hope + 0.3 * Math.abs(Math.sin(step)) * (1 - sit) + 1.4 * Math.sin(Math.PI * sit),
        roll: 0.13 * Math.sin(step) + (w.delay - 1) * 0.04 * sag,
        finL: 0.85 * shock + 0.3 * hope - 0.95 * sag,
        finR: 0.85 * shock + 0.3 * hope - 0.95 * sag,
        eyeScale: 1 + 0.35 * shock,
        wiggle: g >= RETREAT && g < SIT ? 0.6 : 0,
        wigglePhase: -step * 2,
        blink: 0,
      };
      droop = (w.nubi ? 0 : 0.12) + 0.72 * sag;
    }
    return { w, at, ry, pose, droop, bounce };
  });

  // ---- Nubi's close-up (L14): slumped back in its chair, whispering to camera. ---------------------
  const nubiChairAt: Vec3 = [CHAIR_SPOTS[1][0], CHAIR_SEAT, CHAIR_SPOTS[1][1]];
  const nubiChairRy = faceDoor(CHAIR_SPOTS[1][0], CHAIR_SPOTS[1][1]);
  const dim = ramp(g, DUN, DUN + 8, [0, 1], EASE_OUT);
  const inCU = g >= L14;
  let cuPose: NubiPose = { squash: 0.9, pitch: -0.14, roll: 0.05, finL: -0.55, finR: -0.55, lookX: 0, lookY: 0.02, blink: 0, eyeScale: 1 };
  cuPose = nubiTalk(g, cuPose, 0.45);
  cuPose = { ...cuPose, pitch: (cuPose.pitch ?? 0) - 0.06 * dim, eyeScale: 1 + 0.08 * dim };

  // ---- Cameras ---------------------------------------------------------------------------------------
  // The medium on the boss blocking the doorway (the halted workers are "behind the camera": they
  // aren't drawn in this angle).
  const camB = (u: number, punch: number): Cam => {
    const pos = lerp3([0.6, 1.78, 4.4], [0.6, 1.74, 3.7], u);
    return aim([pos[0], pos[1], pos[2] - 0.55 * punch], FOV, BOSS_EYES, 540, 1060);
  };
  const cuDir: Vec3 = [Math.sin(nubiChairRy), 0, Math.cos(nubiChairRy)];
  const cuEyes = nubiPoint(nubiChairAt, nubiChairRy, 2, {}, [0, 5.5, 4.4]);
  let cam: Cam;
  let shot: "W" | "B" | "CU";
  if (g < CUT_B) {
    shot = "W";
    cam = camWide(ramp(g, START, CUT_B, [0, 1], (x) => x));
  } else if (g < GROAN) {
    shot = "B";
    cam = camB(ramp(g, CUT_B, TAG, [0, 1], (x) => x), ramp(g, TAG, TAG + 3, [0, 1], EASE_OUT));
  } else if (g < L14) {
    // Hard cut back to the wide: the slow, sad, synchronized retreat.
    shot = "W";
    cam = camWide(1 - ramp(g, GROAN, L14, [0, 0.6], (x) => x));
  } else {
    shot = "CU";
    const push = ramp(g, L14, DUN, [0, 0.35], (x) => x) + ramp(g, DUN, DUN + 14, [0, 0.65], EASE_IN_OUT);
    const dist = 6.4 - 1.4 * push;
    cam = aim([cuEyes[0] + cuDir[0] * dist, cuEyes[1] + 0.32 - 0.08 * push, cuEyes[2] + cuDir[2] * dist], FOV, cuEyes, 540, 1000);
  }

  // ---- The truth tag over the boss (until the close-up). -------------------------------------------
  const bossRy = -0.12;
  const head = nubiPoint(bossAt, bossRy, BOSS_SIZE, bPose, HEAD_LOCAL);
  const tag = tagAt(cam, head, { ref: 9, min: 0.7, max: 0.92 });
  const tagX = Math.min(890 - 350 * tag.scale, Math.max(110 + 350 * tag.scale, tag.x));
  const showTag = shot !== "CU" && !tag.behind && g >= TAG - 1;
  const slideOn = ramp(g, TAG + 3, TAG + 9);

  return (
    <AbsoluteFill style={{ background: OFI_BG }}>
      <Shake
        frame={g}
        impacts={[
          { at: BLOCK + 3, amp: 7, dur: 9 },
          { at: TAG, amp: 15, dur: 12 },
          { at: DETAIL, amp: 6, dur: 9 },
          { at: DUN, amp: 5, dur: 10 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={120}>
          <OficinaLights sun={1} dim={inCU ? dim : 0} />
          <OficinaSet g={g} sun={1} slide={slideOn} />
          {inCU ? <FrontWindows dusk={0.65 * dim} /> : null}
          {g >= BLOCK - 3 && !inCU ? <Boss position={bossAt} rotationY={bossRy} pose={bPose} smug={0} holdR={laptop} /> : null}
          {inCU ? (
            <>
              <Nubi size={2} position={nubiChairAt} rotationY={nubiChairRy} pose={cuPose} shadow={false} palette={{ eyeRough: 0.7 }}>
                <Lids pose={cuPose} droop={0.62 + 0.12 * dim} tilt={0.1} color={NUBI_GREEN} />
                <Backpack color="#FFC83D" />
              </Nubi>
            </>
          ) : shot === "B" ? null : (
            walkers.map(({ w, at, ry, pose, droop, bounce }, i) =>
              w.nubi ? (
                <Nubi key={i} size={2} position={at} rotationY={ry} pose={pose} shadowOpacity={0.25} palette={{ eyeRough: 0.7 }}>
                  <Lids pose={pose} droop={droop} tilt={0.1} color={NUBI_GREEN} />
                  <Backpack color={w.pack} bounce={bounce} />
                </Nubi>
              ) : (
                <PackedWorker key={i} position={at} rotationY={ry} pose={pose} droop={droop} bags={0.6 + 0.5 * clamp01((droop - 0.12) / 0.72)} pack={w.pack} bounce={bounce} />
              ),
            )
          )}
        </Stage>
        {showTag ? (
          <TruthTag
            frame={g}
            at={TAG}
            lines={[{ text: "TRAJO 68 DIAPOSITIVAS" }, { text: "Y PREGUNTAS AL FINAL", at: DETAIL }]}
            x={tagX}
            y={tag.y}
            scale={tag.scale}
          />
        ) : null}
        {/* The "dun dun duuun": a dark vignette closes in on Nubi's face. */}
        {inCU && dim > 0 ? (
          <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 62% 42% at 50% 50%, rgba(20,8,40,0) 55%, rgba(20,8,40,0.6) 100%)", opacity: dim * keyframes(g, [DUN, DUN + 6], [0.6, 1]) }} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
