import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, keyframes, pop, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { NubiEyes, Sparkle } from "../../three/dormir/OfficeBeds";
import { Lids, nubiPoint } from "../../three/dormir/Street";
import { Chica, HeldPhone } from "../../three/ia/Rooms";
import { SweatDrops } from "../../three/ia/Work";
import {
  BowTie,
  CITA_BG,
  CitaChair,
  CitaLights,
  CitaRoom,
  CitaTable,
  DATE_LID,
  DATE_RY,
  DATE_SEAT,
  HeartFin,
  NUBI_RY,
  NUBI_SEAT,
  Quiff,
  SEAT_Y,
} from "../../three/mentiras/Cita";
import { tagAt } from "../anchor";
import { CITA } from "../beats";
import { SHOTS } from "../shots";
import { citaTalk, nubiTalk } from "../talk";
import { MENTIRAS } from "../timeline";

// Shot "cita" (CITA.START → END, 9.8 s): the candlelit date. Hard cuts on the beats:
// A (START → L11)  two-shot across the table, the candle between them, a slow push-in. Frame 0: she's
//                  already reading Nubi's message on her phone (BUBBLE: the 2D chat bubble pops over
//                  her side, y 260–640 stays calm); her lids sink; L10 «¿Usas esa frase con todo el
//                  mundo?» with the phone lowered, suspicious.
// B (L11 → C)      medium on Nubi, very elegant (bow tie, quiff, sitting bolt upright): «No, solo
//                  contigo.» with its fin on its heart and a wink (sparkle) on "contigo". TAG: record
//                  scratch, «LA COPIÓ Y PEGÓ» slams over its head, it freezes mid-wink; DETAIL «A 7
//                  PERSONAS»; the candle flame shrinks to a sad little dot; a sweat drop.
// C (C → D)        her close-up: dead-pan, lids half down, one slow blink. At STAND she starts to rise.
// D (D → END)      the two-shot again, favouring Nubi (the tag stays over its head): her chair scrapes
//                  back, she hops down with her phone, turns her back and walks out of frame right.
//                  L12 Nubi reaching after her: «¡Pero contigo le puse un corazón!». By LEAVE it's
//                  alone with the candle. The tag leaves at END − 6.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const NUBI_SIZE = 2;
/** Model-space point between the eyes. */
const EYES_LOCAL: Vec3 = [0, 5.5, 4.4];
/** World points between the eyes of the two, seated (camera targets). */
const N_EYES: Vec3 = [NUBI_SEAT[0] + 0.88 * Math.sin(NUBI_RY), NUBI_SEAT[1] + 1.1, NUBI_SEAT[2] + 0.88 * Math.cos(NUBI_RY)];
const D_EYES: Vec3 = [DATE_SEAT[0] + 0.88 * Math.sin(DATE_RY), DATE_SEAT[1] + 1.1, DATE_SEAT[2] + 0.88 * Math.cos(DATE_RY)];
/** She walks out towards the back right (the restaurant's door). */
const WALK_DIR: Vec3 = [0.94, 0, -0.34];

export const CitaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.cita.from;
  const { START, END, BUBBLE, L10, L11, TAG, DETAIL, STAND, L12, LEAVE } = CITA;
  const CONTIGO = MENTIRAS.wordAt("L11", 2);
  const WINK = CONTIGO + 3;
  const CUT_C = DETAIL + 13;
  const CUT_D = STAND + 8;
  const TAG_OUT = END - 6;
  const t = g / 30;

  // ---- The candle: steady and romantic, then the record scratch kills the mood.
  const flame = g < TAG ? 1 : g < DETAIL ? lerp(1, 0.55, ramp(g, TAG, TAG + 4, [0, 1], EASE_OUT)) + 0.25 * Math.sin((g - TAG) * 2.1) * (1 - ramp(g, TAG, TAG + 10)) : lerp(0.55, 0.22, ramp(g, DETAIL, DETAIL + 8, [0, 1], EASE_OUT));

  // ---- The date (Chica) ------------------------------------------------------------------------
  const rise = ramp(g, STAND, STAND + 9, [0, 1], EASE_OUT);
  const hopDown = ramp(g, STAND + 7, STAND + 15, [0, 1], EASE_IN_OUT);
  const turnAway = ramp(g, STAND + 12, STAND + 22, [0, 1], EASE_IN_OUT);
  const walkU = Math.max(0, g - (STAND + 20));
  const walking = g >= STAND + 20;
  const walkD = walkU * 0.045;
  const readK = 1 - ramp(g, L10 - 4, L10 + 6, [0, 1], EASE_IN_OUT);
  const narrow = ramp(g, BUBBLE + 10, BUBBLE + 22, [0, 1], EASE_OUT);
  const scan = ((g - START) % 8) / 8;
  let dPose: NubiPose = {
    lookX: lerp(-0.55, 0.85, readK),
    lookY: lerp(0.05, 0.45 - 0.25 * scan, readK),
    pitch: lerp(-0.02, -0.08, readK),
    yaw: 0,
    roll: 0,
    finR: lerp(0.55, 1.2, readK),
    finL: -0.15,
    squash: 1 + 0.01 * Math.sin(t * 2),
    blink: 0,
  };
  if (g >= L10 - 4 && g < CUT_C) dPose = citaTalk(g, dPose, 0.8);
  if (g >= CUT_C) {
    // Dead-pan: perfectly still, one slow blink, then she rises.
    const slowBlink = keyframes(g, [CUT_C + 2, CUT_C + 5, CUT_C + 9], [0, 1, 0]);
    dPose = { lookX: -0.35, lookY: 0.02, pitch: -0.02, finR: 0.55, finL: -0.15, blink: slowBlink, squash: 1 };
  }
  if (g >= STAND) {
    dPose = {
      ...dPose,
      hop: 1.6 * Math.sin(Math.PI * hopDown) + 0.6 * rise * (1 - hopDown),
      squash: 1 + 0.06 * rise * (1 - hopDown),
      finR: lerp(0.55, 0.9, rise),
      pitch: lerp(-0.02, -0.16, turnAway),
      blink: lerp(dPose.blink ?? 0, 0.75, turnAway),
      lookX: lerp(-0.35, 0, turnAway),
    };
  }
  if (walking) {
    const ph = walkU * 0.75;
    dPose = {
      ...dPose,
      hop: 0.35 * Math.abs(Math.sin(ph)),
      squash: 1 + 0.04 * Math.sin(ph * 2),
      roll: 0.07 * Math.sin(ph),
      wiggle: 0.9,
      wigglePhase: ph * 2,
      finL: -0.1 + 0.2 * Math.sin(ph),
    };
  }
  const dateLid = g < BUBBLE ? 0.15 : lerp(0.15, 0.55, narrow) + (g >= CUT_C ? 0.08 : 0);
  const dateAt: Vec3 = [
    DATE_SEAT[0] + 0.55 * hopDown + WALK_DIR[0] * walkD,
    lerp(SEAT_Y, 0, hopDown),
    DATE_SEAT[2] + 0.35 * hopDown + WALK_DIR[2] * walkD,
  ];
  const dateRy = lerp(DATE_RY, Math.atan2(WALK_DIR[0], WALK_DIR[2]), turnAway);
  const chairPush = ramp(g, STAND - 1, STAND + 7, [0, 1], EASE_OUT);
  const datePhone = (
    <HeldPhone raise={dPose.finR ?? 0} turn={lerp(-0.6, -0.15, 1 - readK)} tilt={lerp(0.35, 0.15, readK)} caseColor="#FF5C93" scale={1.25} on={1} glow={0.4 * readK} />
  );

  // ---- Nubi ---------------------------------------------------------------------------------------
  // Bolt upright and smug at first; the smooth line with the fin on the heart and the wink; frozen by
  // the tag; then desperate.
  const heartOn = ramp(g, L11 + 10, L11 + 16, [0, 1], EASE_OUT) * (1 - ramp(g, TAG, TAG + 5, [0, 1], EASE_IN));
  const wink = windowIn(g, WINK, TAG - 2, 2);
  const freeze = g >= TAG ? pop(g, TAG, { damping: 8, stiffness: 300 }) : 0;
  const sink = ramp(g, DETAIL, DETAIL + 10, [0, 1], EASE_OUT);
  const uhoh = windowIn(g, MENTIRAS.wordAt("L10", 4), L10 + 60, 6);
  const reach = ramp(g, L12 - 4, L12 + 6, [0, 1], EASE_OUT);
  const alone = ramp(g, LEAVE - 8, LEAVE + 6, [0, 1], EASE_IN_OUT);
  const breathe = Math.sin(t * 2.1);
  let nPose: NubiPose = {
    squash: 1.035 + 0.01 * breathe,
    pitch: -0.05,
    roll: 0,
    yaw: 0,
    finL: -0.1,
    finR: 0.1,
    lookX: 0.55,
    lookY: 0.05,
    blink: 0,
    eyeScale: 1 + 0.12 * uhoh,
  };
  if (g >= L11) {
    nPose = { ...nPose, pitch: -0.1, roll: 0.05 * heartOn, finR: lerp(0.1, -2.9, Math.min(1, heartOn * 3)), finL: lerp(-0.1, 0.35, heartOn), lookX: 0.25 };
    if (g < TAG) nPose = nubiTalk(g, nPose, 0.6);
  }
  if (g >= TAG) {
    nPose = {
      squash: 1.035 - 0.08 * (1 - clamp01(freeze)) - 0.06 * sink,
      pitch: -0.1 + 0.08 * sink,
      roll: 0,
      yaw: 0,
      finL: lerp(0.35, -0.3, ramp(g, TAG, TAG + 6)),
      finR: lerp(-2.9, -0.3, ramp(g, TAG, TAG + 6, [0, 1], EASE_OUT)),
      lookX: lerp(0, 0.6, sink),
      lookY: 0.05,
      blink: 0,
      eyeScale: 1.3 - 0.1 * sink,
    };
  }
  if (g >= L12 - 4) {
    const k = reach * (1 - 0.6 * alone);
    nPose = {
      ...nPose,
      roll: -0.12 * k,
      yaw: 0.25 * k,
      finR: lerp(-0.3, 1.05, k) - 0.9 * alone,
      finL: lerp(-0.3, 0.4, k) - 0.6 * alone,
      eyeScale: 1.28,
      lookX: 0.85 * (1 - alone) + 0.1,
      lookY: 0.1 - 0.35 * alone,
      squash: 1 - 0.1 * alone,
    };
    nPose = nubiTalk(g, nPose, 1 - alone);
  }
  const winkL = wink > 0.5 ? "happy" : "open";
  const nubiOpen = Math.max(0.1, (nPose.eyeScale ?? 1) * (1 - (nPose.blink ?? 0)));

  // ---- Cameras (aimed at the seated eye points, so the pose never shakes the framing) -------------
  let cam: Cam;
  let shot: "A" | "B" | "C" | "D";
  if (g < L11) {
    // Two-shot across the table, the candle between them; slow push-in holding her face in place.
    shot = "A";
    const u = ramp(g, START, L11, [0, 1], (x) => x);
    cam = aim(lerp3([0.25, 2.12, 12.9], [0.4, 2.05, 11.5], u), FOV, D_EYES, 660, 1040);
  } else if (g < CUT_C) {
    // Medium on Nubi from her side; a punch-in on the tag.
    shot = "B";
    const u = ramp(g, L11, CUT_C, [0, 1], (x) => x);
    const punch = ramp(g, TAG, TAG + 3, [0, 1], EASE_OUT);
    const dir: Vec3 = [0.45, 0, 0.89];
    const dist = 8.7 - 0.5 * u - 0.7 * punch;
    cam = aim([N_EYES[0] + dir[0] * dist, N_EYES[1] + 0.38, N_EYES[2] + dir[2] * dist], FOV, N_EYES, 500, 1035);
  } else if (g < CUT_D) {
    // Her close-up, dead-pan.
    shot = "C";
    const u = ramp(g, CUT_C, CUT_D, [0, 1], (x) => x);
    const dist = 6.3 - 0.3 * u;
    cam = aim([D_EYES[0] - 0.45 * dist, D_EYES[1] + 0.3, D_EYES[2] + 0.89 * dist], FOV, D_EYES, 540, 980);
  } else {
    // The two-shot again, favouring Nubi (the tag stays over its head) while she walks out.
    shot = "D";
    const u = ramp(g, CUT_D, END, [0, 1], (x) => x);
    cam = aim(lerp3([-0.2, 2.1, 12.4], [-0.3, 2.05, 11.5], u), FOV, N_EYES, 470, 1040);
  }

  // ---- The truth tag over Nubi (not in her close-up). ---------------------------------------------
  const head = nubiPoint(NUBI_SEAT, NUBI_RY, NUBI_SIZE, nPose, [0, 11.2, 1.4]);
  const tag = tagAt(cam, head, { ref: 9, min: 0.7, max: 1.05 });
  const tagX = Math.min(890 - 310 * tag.scale, Math.max(110 + 310 * tag.scale, tag.x));
  const showTag = shot !== "C" && !tag.behind && g >= TAG - 1;
  const nEyes = nubiPoint(NUBI_SEAT, NUBI_RY, NUBI_SIZE, nPose, EYES_LOCAL);

  const sparkleAt = nubiPoint(NUBI_SEAT, NUBI_RY, NUBI_SIZE, nPose, [-2.3, 6.6, 5.0]);
  const sparkle = windowIn(g, WINK, WINK + 14, 3);

  return (
    <AbsoluteFill style={{ background: CITA_BG }}>
      <Shake
        frame={g}
        impacts={[
          { at: TAG, amp: 16, dur: 12 },
          { at: DETAIL, amp: 7, dur: 9 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={120}>
          <CitaLights g={g} candle={flame} />
          <CitaRoom g={g} lights={lerp(1, 0.7, ramp(g, TAG, TAG + 6))} />
          <CitaTable g={g} flame={flame} />
          <group position={[NUBI_SEAT[0], 0, NUBI_SEAT[2]]} rotation={[0, NUBI_RY, 0]}>
            <CitaChair />
          </group>
          <group position={[DATE_SEAT[0], 0, DATE_SEAT[2]]} rotation={[0, DATE_RY, 0]}>
            <CitaChair push={chairPush} />
          </group>
          <Nubi size={NUBI_SIZE} position={NUBI_SEAT} rotationY={NUBI_RY} pose={nPose} shadow={false} hideEyes>
            <NubiEyes left={winkL} right="open" lookX={nPose.lookX} lookY={nPose.lookY} openL={nubiOpen} openR={nubiOpen} rough={0.75} />
            <Lids pose={nPose} droop={g < TAG ? 0.32 + 0.15 * heartOn : 0.05} tilt={-0.05} color={NUBI_GREEN} />
            <BowTie wiggle={g >= TAG ? Math.exp(-(g - TAG) / 6) * Math.sin((g - TAG) * 1.4) : 0} />
            <Quiff />
            <HeartFin on={heartOn} pat={0.5 + 0.5 * Math.sin(t * 9)} />
          </Nubi>
          {sparkle > 0 ? <Sparkle at={sparkleAt} size={0.55 * sparkle} spin={t * 3} /> : null}
          {g >= TAG + 4 && g < CUT_C ? <SweatDrops g={g} from={TAG + 4} to={CUT_C} head={[nEyes[0] + 0.2, nEyes[1] + 0.7, nEyes[2]]} every={7} seed={3} spread={0.6} /> : null}
          {walkD < 5 ? (
            <Chica position={dateAt} rotationY={dateRy} pose={dPose} shadow={false} holdR={datePhone} eyeRough={0.75}>
              <Lids pose={dPose} droop={dateLid} tilt={-0.12} color={DATE_LID} />
            </Chica>
          ) : null}
        </Stage>
        {showTag ? (
          <TruthTag
            frame={g}
            at={TAG}
            out={TAG_OUT}
            lines={[{ text: "LA COPIÓ Y PEGÓ" }, { text: "A 7 PERSONAS", at: DETAIL }]}
            x={tagX}
            y={tag.y}
            scale={tag.scale}
          />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
