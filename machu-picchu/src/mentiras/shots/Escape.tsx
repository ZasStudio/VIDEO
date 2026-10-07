import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Lids } from "../../three/dormir/Street";
import { CALLE, CALLE_SKY, CAP_HOLE, Amigo, CafeChair, CafeTable, CalleLights, CalleStreet, MenuBoard, NubiCap, SneakerDisplay } from "../../three/mentiras/Calle";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { tagAt } from "../anchor";
import { ESCAPE } from "../beats";
import { SHOTS } from "../shots";
import { amigoTalk, nubiTalk } from "../talk";
import { MENTIRAS } from "../timeline";

// Shot "escape" (ESCAPE.START → END, 9.1 s). The café terrace on a sunny morning. Frame 0 is
// already moving: Nubi struts in from the right wearing a big blue cap pulled down to its eyes (its
// anti-tag shield) while the friend sits at the table, drumming his fins and tapping a foot, a
// tower of empty cups beside him. L03 whispered to camera, smug, Nubi taps the cap on "preparado".
// L04 the friend glares: "¿Y por qué llegaste tarde?". CUT closer on Nubi: L05 "Había tráfico."
// (chest out). The crown bulges… TAG: the truth tag rips UP through the cap (torn flaps, shreds, a
// burst of light, shake) «SE QUEDÓ VIENDO VIDEOS»; DETAIL1 «DE GATITOS» (Nubi grabs the cap),
// DETAIL2 «POR 3 HORAS» (it yanks the cap down over its eyes: no use); the friend's lids drop.
// CUT close: L06 whispered to camera, annoyed, pointing up at the tag. Tag out at END − 8.
//
// Cameras: A two-shot from the front right (arrival, L03, L04, slow push); B closer on Nubi
// (L05, the rip, the details; the friend on the left edge); C close on Nubi for L06.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const TABLE = CALLE.table;
const FRIEND: Vec3 = [CALLE.chairL[0] + 0.02, CALLE.seat, CALLE.chairL[2] + 0.08];
const FRIEND_YAW = 0.6;
const NUBI_END: Vec3 = [-0.92, 0, 0.12];
const NUBI_IN: Vec3 = [1.25, 0, 0.75];

// Word beats (from the voice timing, never hard-coded).
const PREPARADO = MENTIRAS.wordAt("L03", 3);
const TRAFICO = MENTIRAS.wordAt("L05", 1);
const DETALLES = MENTIRAS.wordAt("L06", 4);
const L03_END = MENTIRAS.lineEnd("L03");
const L06_END = MENTIRAS.lineEnd("L06");

export const EscapeShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.escape.from;
  const { START, END, L03, L04, L05, TAG, DETAIL1, DETAIL2, L06 } = ESCAPE;
  const t = g / 30;

  const CUT_B = L05 - 2;
  /** A quick cut to the friend's unimpressed face after the last detail, then close on Nubi. */
  const CUT_R = DETAIL2 + 5;
  const CUT_C = L06 - 2;
  const ARRIVE = L03 + 3;

  // ---- Nubi: the strut in, the whisper and the tap, L05, the rip, the tug, the annoyed whisper.
  const walk = ramp(g, START, ARRIVE, [0, 1], (x) => x);
  const walking = g < ARRIVE ? 1 : 0;
  const wk = EASE_OUT(walk);
  const nubiPos: Vec3 = [lerp(NUBI_IN[0], NUBI_END[0], wk), 0, lerp(NUBI_IN[2], NUBI_END[2], wk)];
  const step = Math.abs(Math.sin((g - START) * 0.5));
  const toCam = ramp(g, ARRIVE - 6, ARRIVE + 4, [0, 1], EASE_IN_OUT);
  const toFriend = ramp(g, L03_END - 2, L04 - 2, [0, 1], EASE_IN_OUT) * (1 - ramp(g, L05 - 6, L05 + 2, [0, 1], EASE_IN_OUT));
  const whisper = windowIn(g, L03 - 2, L03_END + 2, 5);
  const tapK = keyframes(g, [PREPARADO - 8, PREPARADO - 2, PREPARADO + 1, PREPARADO + 4, PREPARADO + 7, PREPARADO + 14], [0, 1, 0.75, 1, 0.75, 0]);
  const tapDip = windowIn(g, PREPARADO, PREPARADO + 3, 1) + windowIn(g, PREPARADO + 4, PREPARADO + 7, 1);
  const proud = windowIn(g, L05 - 2, TAG - 6, 4);
  const nod = windowIn(g, TRAFICO, TRAFICO + 10, 3) * Math.sin(((g - TRAFICO) / 10) * Math.PI);
  const bulge = ramp(g, TAG - 7, TAG, [0, 1], (x) => x * x) * (g < TAG ? 1 : 0);
  const rip = g >= TAG ? pop(g, TAG, { damping: 8, stiffness: 260, mass: 0.6 }) : 0;
  const ripAge = g >= TAG ? g - TAG : -1;
  const jolt = windowIn(g, TAG, TAG + 8, 1);
  const shock = ramp(g, TAG - 5, TAG + 1) * (1 - ramp(g, L06 - 6, L06 + 4, [0, 1], EASE_IN_OUT));
  const lookUp = windowIn(g, TAG + 3, DETAIL2 - 2, 4);
  const flinch1 = windowIn(g, DETAIL1, DETAIL1 + 6, 1);
  const grab = ramp(g, DETAIL1 + 1, DETAIL1 + 7, [0, 1], EASE_OUT) * (1 - ramp(g, CUT_C - 2, CUT_C + 6, [0, 1], EASE_IN_OUT));
  const tug = ramp(g, DETAIL2 - 1, DETAIL2 + 4, [0, 1], EASE_OUT) * (1 - ramp(g, CUT_C, CUT_C + 10, [0, 1], EASE_IN_OUT));
  const tremble = tug * Math.sin(g * 2.1);
  const annoyed = ramp(g, CUT_C - 1, L06 + 4, [0, 1], EASE_OUT);
  const pointUp = windowIn(g, DETALLES - 12, L06_END + 4, 5);
  const pull = Math.max(tug * (1 + 0.08 * Math.sin(g * 1.7)), 0.12 * annoyed);

  let yaw = lerp(-0.75, 0.32, toCam) - 0.85 * toFriend;
  yaw += 0.05 * Math.sin(g * 0.09) * (1 - walking);
  const nubiBase: NubiPose = {
    hop: walking * step * 1.5 * (1 - 0.6 * walk) + 2.2 * jolt + 0.6 * flinch1,
    squash: 1 - 0.05 * walking * (1 - step) + 0.05 * proud - 0.14 * jolt * (g < TAG + 3 ? 1 : -0.6) - 0.1 * tug - 0.04 * bulge,
    yaw,
    pitch: 0.07 * whisper - 0.1 * proud + 0.1 * nod - 0.06 * walking + 0.1 * annoyed - 0.08 * lookUp,
    roll: walking * 0.07 * Math.sin((g - START) * 0.5) + 0.04 * tremble,
    finR: 0.22 * walking * Math.sin((g - START) * 0.5) - 0.35 * proud + grab * 1.55 + 0.15 * tremble + pointUp * 1.9,
    finL: -0.22 * walking * Math.sin((g - START) * 0.5) + 2.4 * tapK - 0.35 * proud + grab * 1.55 - 0.15 * tremble + 0.12 * annoyed,
    wiggle: walking * 0.85 + 0.3 * jolt,
    wigglePhase: (g - START) * 0.65,
    eyeScale: 1 + 0.32 * shock + 0.15 * jolt - 0.05 * whisper,
    lookX: -0.45 * toFriend + 0.2 * (1 - toCam),
    lookY: 0.7 * lookUp - 0.1 * whisper,
  };
  const talked = nubiTalk(g, nubiBase, g < L05 ? 0.75 : 0.85);
  const nubiPose: NubiPose = shock > 0.2 ? { ...talked, blink: 0 } : talked;
  const smug = (1 - shock) * (g < L06 - 4 ? 0.42 : 0);
  const nubiDroop = smug + 0.34 * annoyed;
  const nubiTilt = smug > 0.2 ? 0.12 : -0.32;

  // ---- The friend: waiting (drumming, tapping a foot, bored lids), glares, asks, looks up at the
  // tag, then his lids drop all the way (unimpressed).
  const waiting = 1 - ramp(g, ARRIVE - 8, ARRIVE + 2);
  const drum = (ph: number) => Math.max(0, Math.sin(g * 0.95 + ph)) ** 2;
  const footTap = Math.max(0, Math.sin(g * 0.55)) ** 6;
  const glare = ramp(g, ARRIVE - 6, ARRIVE + 4) * (1 - ramp(g, TAG, TAG + 6));
  const upAtTag = windowIn(g, TAG + 2, DETAIL2 + 2, 4);
  const unimpressed = ramp(g, DETAIL2 - 2, DETAIL2 + 8, [0, 1], EASE_IN_OUT);
  /** In the reaction shot he turns to us, deadpan. */
  const deadpan = ramp(g, DETAIL2 + 4, DETAIL2 + 12, [0, 1], EASE_IN_OUT);
  const friendBase: NubiPose = {
    finL: -0.12 + 0.32 * drum(0) * waiting + 0.2 * glare,
    finR: -0.12 + 0.32 * drum(Math.PI * 0.9) * waiting + 0.2 * glare,
    wiggle: 0.55 * footTap * waiting + 0.25 * footTap * (1 - waiting) * (1 - unimpressed),
    wigglePhase: 1.3,
    pitch: 0.04 + 0.06 * glare * windowIn(g, L04, L04 + 30, 6) - 0.06 * upAtTag,
    yaw: 0.04 * Math.sin(t * 0.8) - 0.5 * deadpan,
    roll: 0.03 * Math.sin(t * 1.1) * waiting,
    lookX: (0.55 * (1 - waiting) + 0.35 * waiting * Math.sin(t * 0.7) + 0.25 * upAtTag) * (1 - deadpan),
    lookY: -0.1 * waiting + 0.65 * upAtTag - 0.15 * unimpressed,
    eyeScale: 1 + 0.18 * windowIn(g, TAG, TAG + 10, 2),
    squash: 1 + 0.02 * Math.sin(t * 2),
  };
  const friendPose = amigoTalk(g, friendBase, 0.95);
  const friendDroop = Math.max(0.5 * waiting, 0.42 * glare, 0.58 * unimpressed) * (1 - 0.8 * upAtTag * (1 - unimpressed));
  const friendTilt = glare > 0.5 && unimpressed < 0.5 ? -0.28 : 0.06;

  // ---- Cameras.
  const pushA = ramp(g, START, CUT_B, [0, 1], (x) => x);
  const camA = aim([lerp(-0.9, -1.1, pushA), 2.45, lerp(12.9, 12.1, pushA)], FOV, [TABLE[0] + 0.2, 0.05, TABLE[2] + 0.25], 540, 1240);
  const pushB = ramp(g, CUT_B, CUT_C, [0, 1], (x) => x);
  const nubiEyes: Vec3 = [NUBI_END[0], 1.12, NUBI_END[2]];
  const camB = aim([lerp(0.35, 0.2, pushB), 1.95, lerp(8.9, 8.4, pushB)], FOV, nubiEyes, 548, 1035);
  const friendEyes: Vec3 = [FRIEND[0], FRIEND[1] + 1.12, FRIEND[2]];
  const camR = aim([-1.65, 2.2, 9.4 - 0.4 * ramp(g, CUT_R, CUT_C, [0, 1], (x) => x)], FOV, friendEyes, 740, 960);
  const pushC = ramp(g, CUT_C, END, [0, 1], (x) => x);
  const camC = aim([lerp(-0.45, -0.55, pushC), 1.2, lerp(7.3, 6.9, pushC)], FOV, nubiEyes, 540, 1060);
  const cam: Cam = g < CUT_B ? camA : g < CUT_R ? camB : g < CUT_C ? camR : camC;

  // ---- The truth tag, rising out of the torn cap.
  const s = (nubiPose.squash ?? 1) * (1 - 0.07 * pull);
  const holeY = 0.2 * ((nubiPose.hop ?? 0) + s * (CAP_HOLE - 1.2 * pull)) + 0.1;
  const tg = tagAt(cam, [nubiPos[0] - 0.03, holeY, nubiPos[2] - 0.03], { max: g >= CUT_C ? 1.0 : 1.1 });

  return (
    <AbsoluteFill style={{ background: CALLE_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: TAG, amp: 16, dur: 14 },
          { at: DETAIL1, amp: 5, dur: 8 },
          { at: DETAIL2, amp: 7, dur: 9 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={120}>
          <CalleLights />
          <CalleStreet />
          <group position={CALLE.pedestal}>
            <SneakerDisplay t={t} />
          </group>
          <group position={TABLE}>
            <CafeTable />
          </group>
          <group position={CALLE.chairL} rotation={[0, FRIEND_YAW, 0]}>
            <CafeChair />
          </group>
          <group position={[CALLE.chairR[0] - 0.2, 0, CALLE.chairR[2] - 0.45]} rotation={[0, -0.45, 0]}>
            <CafeChair />
          </group>
          <group position={[-4.25, 0, 0.55]} rotation={[0, 0.35, 0]}>
            <MenuBoard />
          </group>
          <Amigo position={FRIEND} rotationY={FRIEND_YAW} pose={friendPose} shadow={false} droop={friendDroop} tilt={friendTilt} />
          <Nubi size={2} position={nubiPos} pose={nubiPose} shadowOpacity={0.4} palette={{ eyeRough: 0.6 }}>
            <NubiCap bulge={bulge} rip={rip} ripAge={ripAge} pull={pull} tap={tapDip} wobble={g} />
            <Lids pose={nubiPose} droop={nubiDroop * (1 - 0.6 * pull)} tilt={nubiTilt} color={NUBI_GREEN} />
          </Nubi>
        </Stage>
        {!tg.behind && g >= TAG - 1 && (g < CUT_R || g >= CUT_C) ? (
          <TruthTag
            frame={g}
            at={TAG}
            out={END - 8}
            entrance="rise"
            lines={[{ text: "SE QUEDÓ VIENDO VIDEOS" }, { text: "DE GATITOS", at: DETAIL1 }, { text: "POR 3 HORAS", at: DETAIL2 }]}
            x={tg.x}
            y={tg.y}
            scale={tg.scale}
          />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
