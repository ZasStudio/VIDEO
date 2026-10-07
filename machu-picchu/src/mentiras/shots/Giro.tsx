import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, projectToScreen } from "../../three/CameraRig";
import { Chico } from "../../three/ia/Rooms";
import {
  CHICO_RUG,
  CasaLights,
  CasaRoom,
  CheeseString,
  Duvet,
  EYES,
  HEAD_TOP,
  Halo,
  M,
  MOUTH,
  NUBI_RUG,
  OnFin,
  PizzaBox,
  finTip,
  nubiPoint,
} from "../../three/mentiras/Casa";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { Lids } from "../../three/tiempo/Office";
import { tagAt } from "../anchor";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";
import { amigoTalk, nubiTalk } from "../talk";
import { mixCam, tagPoint } from "./Gancho";

// Shot "giro" (GIRO.START → END): Nubi stands on the bedroom rug, proud, fins on its hips: "Encontré
// la solución: no volver a mentir." (SOLUCION: a golden halo pings over its head). BOX: the friend
// (Chico) steps into the foreground holding the EMPTY pizza box open towards us — cut to his accusing
// close-up for "¿Te comiste mi pizza?" (he jabs the box at us). SILENCIO: back on the two-shot, Nubi
// is frozen and an empty tag tries to load over its head (no lie, no truth) and gives up at NADA.
// SILBA: Nubi looks away and whistles (music notes), a string of melted cheese stuck on its fin —
// insert on the cheese during the voice-over L17 — then a smug side-eye to camera; Chico glares.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Chico faces us, turned a little towards Nubi (screen-left). */
const CHICO_YAW = -0.45;
/** Whistling, Nubi turns its face away (screen-left): the fin with the cheese swings to the front. */
const WHISTLE_YAW = -0.6;
const NUBI_EYES = nubiPoint(NUBI_RUG, {}, EYES);
/** Nubi's body centre (stays put when it turns its face away). */
const NUBI_MID: Vec3 = [NUBI_RUG[0], 1.1, NUBI_RUG[2]];

/** Nubi alone, medium, centred. */
const camSolo = (push: number): Cam => aim([NUBI_RUG[0] + 0.2, 2.0 - 0.05 * push, NUBI_RUG[2] + 8.8 - 0.6 * push], FOV, NUBI_EYES, 540, 980);
/** The two-shot: Nubi left of centre, Chico in the right foreground with the box. */
const camTwo = (push: number): Cam => aim([0.1 - 0.05 * push, 2.8 - 0.05 * push, 14.2 - 0.4 * push], FOV, NUBI_MID, 465, 930);

/** 2D music notes rising from a screen point (whistling). */
const Notes: React.FC<{ g: number; from: number; x: number; y: number; on: number; scale?: number }> = ({ g, from, x, y, on, scale = 1 }) => {
  if (g < from || on <= 0.01) return null;
  const every = 11;
  const life = 42;
  const items: React.ReactNode[] = [];
  for (let n = Math.max(0, Math.floor((g - from - life) / every)); n <= Math.floor((g - from) / every); n++) {
    const a = (g - from - n * every) / life;
    if (a < 0 || a > 1) continue;
    const double = n % 2 === 1;
    const col = ["#FFFFFF", "#FFE14D", "#7FE0FF"][n % 3];
    const px = x - (30 + 120 * a) * scale + 26 * Math.sin(a * 7 + n) * scale;
    const py = y - (20 + 300 * a) * scale;
    items.push(
      <svg
        key={n}
        width={70 * scale}
        height={90 * scale}
        viewBox="0 0 70 90"
        style={{
          position: "absolute",
          left: px - 35 * scale,
          top: py - 45 * scale,
          opacity: on * Math.min(1, a * 6) * (1 - clamp01((a - 0.65) / 0.35)),
          transform: `rotate(${-14 + 18 * Math.sin(a * 5 + n)}deg) scale(${0.7 + 0.5 * Math.min(1, a * 3)})`,
          overflow: "visible",
        }}
      >
        <g fill={col} stroke="#2A1F4D" strokeWidth={5} strokeLinejoin="round">
          {double ? (
            <>
              <path d="M18 18 L58 8 L58 64 A11 9 -20 1 1 50 56 L50 26 L26 32 L26 72 A11 9 -20 1 1 18 64 Z" />
            </>
          ) : (
            <path d="M30 10 L38 10 Q40 26 60 34 Q50 36 38 30 L38 70 A13 10 -20 1 1 30 62 Z" />
          )}
        </g>
      </svg>,
    );
  }
  return <>{items}</>;
};

/** 2D four-point sparkles popping around a screen point. */
const Sparkles: React.FC<{ g: number; at: number; x: number; y: number }> = ({ g, at, x, y }) => {
  if (g < at || g > at + 30) return null;
  const pts: [number, number, number][] = [
    [-150, -40, 0],
    [140, -70, 3],
    [-90, -150, 6],
    [110, 40, 4],
  ];
  return (
    <>
      {pts.map(([dx, dy, delay], i) => {
        const k = pop(g, at + delay, { damping: 10, stiffness: 260, mass: 0.5 });
        const fade = 1 - ramp(g, at + delay + 14, at + delay + 22);
        const s = 70 * k * fade;
        if (s <= 1) return null;
        return (
          <svg key={i} width={s} height={s} viewBox="-10 -10 20 20" style={{ position: "absolute", left: x + dx - s / 2, top: y + dy - s / 2, transform: `rotate(${(g - at) * 4}deg)` }}>
            <path d="M0 -10 Q1.6 -1.6 10 0 Q1.6 1.6 0 10 Q-1.6 1.6 -10 0 Q-1.6 -1.6 0 -10 Z" fill="#FFF3A0" stroke="#FFB800" strokeWidth={0.8} />
          </svg>
        );
      })}
    </>
  );
};

/** A 2D sweat drop sliding down beside a head. */
const Sweat: React.FC<{ g: number; at: number; until: number; x: number; y: number }> = ({ g, at, until, x, y }) => {
  if (g < at || g > until + 8) return null;
  const k = pop(g, at, { damping: 12, stiffness: 220 });
  const slide = ramp(g, at + 4, until, [0, 40], EASE_IN_OUT);
  const o = 1 - ramp(g, until, until + 8);
  return (
    <svg width={56} height={80} viewBox="0 0 56 80" style={{ position: "absolute", left: x - 28, top: y - 40 + slide, opacity: o, transform: `scale(${k})` }}>
      <path d="M28 4 Q46 36 46 52 A18 18 0 1 1 10 52 Q10 36 28 4 Z" fill="#8FE3FF" stroke="#2A6FB0" strokeWidth={4} />
      <ellipse cx={21} cy={52} rx={5} ry={8} fill="#FFFFFF" opacity={0.85} />
    </svg>
  );
};

export const GiroShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.giro.from;
  const { START, END, SOLUCION, BOX, L16, SILENCIO, SILBA, NADA, L17 } = GIRO;
  const t = g / 30;

  // ---- Cuts: Nubi alone → (Chico steps in) two-shot → Chico's close-up → two-shot → cheese insert → two-shot.
  const CLOSE_IN = L16 + 4;
  const INSERT_IN = L17 + 9;
  const INSERT_OUT = L17 + 37;
  const shotClose = g >= CLOSE_IN && g < SILENCIO;
  const shotInsert = g >= INSERT_IN && g < INSERT_OUT;

  // ---- Nubi: proud → notices the box → frozen → whistling, looking away → smug side-eye.
  const proud = 1 - ramp(g, BOX + 4, BOX + 14, [0, 1], EASE_IN_OUT);
  const notice = ramp(g, BOX + 4, BOX + 10, [0, 1], EASE_OUT);
  const frozen = g >= SILENCIO && g < SILBA ? 1 : 0;
  const whistle = ramp(g, SILBA, SILBA + 8, [0, 1], EASE_IN_OUT);
  const sideEye = ramp(g, INSERT_OUT + 4, INSERT_OUT + 12, [0, 1], EASE_IN_OUT);
  const gulp = windowIn(g, L16 + 40, L16 + 50, 3);
  const sway = Math.sin((g - SILBA) * 0.2);
  const breathe = Math.sin(t * 2.2);
  let nubi: NubiPose = {
    pitch: -0.1 * proud + 0.02 * notice * (1 - whistle),
    squash: 1 + 0.04 * proud + 0.012 * breathe * (1 - frozen) - 0.06 * gulp,
    hop: 0.15 * proud,
    finL: lerp(lerp(-0.85, -0.35, notice), -1.15, whistle),
    finR: lerp(lerp(-0.85, -0.35, notice), -1.0, whistle),
    lookX: lerp(0.65 * notice, lerp(-0.55, 0.95, sideEye), whistle),
    lookY: lerp(0.15 * proud, lerp(0.75, 0.05, sideEye), whistle),
    eyeScale: lerp(1.05 + 0.15 * notice + 0.15 * frozen, 0.95, whistle),
    yaw: whistle * (WHISTLE_YAW + 0.06 * sway),
    roll: whistle * 0.065 * sway,
    wiggle: 0.12 * whistle,
    wigglePhase: g * 0.25,
  };
  if (g < BOX) nubi = nubiTalk(g, nubi);
  const nubiDroop = lerp(0.18 * proud, lerp(0.15, 0.5, sideEye), whistle);

  // ---- The halo ping on "la solución".
  const haloK = g >= SOLUCION ? pop(g, SOLUCION, { damping: 9, stiffness: 200, mass: 0.6 }) * (1 - ramp(g, SOLUCION + 34, SOLUCION + 44, [0, 1], EASE_IN_OUT)) : 0;
  const haloAt = nubiPoint(NUBI_RUG, nubi, [0, HEAD_TOP[1] + 2.0, 0]);

  // ---- Chico: steps in with the box, accuses, glares (and taps impatiently).
  const enter = ramp(g, BOX, BOX + 11, [0, 1], EASE_OUT);
  const walking = g < BOX + 11 ? 1 - enter : 0;
  const chicoX = lerp(4.6, CHICO_RUG[0], enter);
  const glare = ramp(g, L16 + 50, L16 + 60, [0, 1], EASE_IN_OUT);
  const tap = g >= SILBA ? Math.abs(Math.sin((g - SILBA) * 0.3)) : 0;
  let chico: NubiPose = {
    hop: 1.2 * walking * Math.abs(Math.sin(g * 0.9)) + 0.25 * tap,
    roll: 0.1 * walking * Math.sin(g * 0.9),
    pitch: 0.05 + 0.06 * glare,
    finL: 0.3,
    finR: -0.2,
    lookX: lerp(0.15, -0.75, glare),
    lookY: 0,
    eyeScale: 0.95,
    wiggle: walking,
    wigglePhase: g * 0.9,
  };
  if (g >= L16 - 2 && g < L16 + 60) chico = amigoTalk(g, chico, 1.1);
  chico.finL = 0.3 + 0.15 * (chico.hop ?? 0) * 0.3;
  // The free fin jabs at the box on the stressed words.
  const jab = g >= L16 && g < L16 + 58 ? Math.max(0, Math.sin((g - L16) * 0.55)) : 0;
  chico.finR = -0.2 + 0.85 * jab;
  const boxThrust = (chico.hop ?? 0) * 0.25 + 0.8 * jab;

  // ---- Cameras.
  const toTwo = ramp(g, BOX - 2, BOX + 8, [0, 1], EASE_IN_OUT);
  const pushTwo = ramp(g, BOX, END, [0, 1], (x) => x);
  let cam = mixCam(camSolo(ramp(g, START, BOX, [0, 1], (x) => x)), camTwo(pushTwo), toTwo);
  // (During the cheese insert Chico steps a little aside, out of the close-up's way: a cheat.)
  const chicoAt: Vec3 = [chicoX + (shotInsert ? 0.9 : 0), 0, CHICO_RUG[2]];
  if (shotClose) {
    const ce = nubiPoint(chicoAt, chico, EYES, CHICO_YAW);
    const k = ramp(g, CLOSE_IN, SILENCIO, [0, 1], (x) => x);
    cam = aim([ce[0] - 1.9 - 0.1 * k, ce[1] + 0.6, ce[2] + 7.4 - 0.7 * k], FOV, [ce[0] - 0.1, ce[1] - 0.3, ce[2]], 560, 940);
  }
  // Insert: the fin with the cheese (the camera aims at the fin tip of the unswayed pose).
  const tipBase = nubiPoint(NUBI_RUG, { yaw: WHISTLE_YAW }, finTip(-1.0));
  if (shotInsert) {
    const k = ramp(g, INSERT_IN, INSERT_OUT, [0, 1], (x) => x);
    cam = aim([tipBase[0] + 0.8 - 0.1 * k, tipBase[1] + 1.0, tipBase[2] + 5.0 - 0.35 * k], FOV, [tipBase[0], tipBase[1] - 0.25, tipBase[2]], 700, 760);
  }

  // ---- 2D anchors.
  const tg = tagAt(cam, tagPoint(NUBI_RUG, nubi, 0, 0.12));
  const mouth = projectToScreen(cam, nubiPoint(NUBI_RUG, nubi, [MOUTH[0] - 1.2, MOUTH[1], MOUTH[2]]), 1080, 1920);
  const halo2d = projectToScreen(cam, haloAt, 1080, 1920);
  const side = projectToScreen(cam, nubiPoint(NUBI_RUG, nubi, [-5.7, 8.4, 3.2]), 1080, 1920);
  const notesOn = shotInsert ? 0 : whistle;

  return (
    <AbsoluteFill style={{ background: "#C3B3FF" }}>
      <Shake frame={g} impacts={[{ at: CLOSE_IN, amp: 4, dur: 8 }]}>
        <Stage cam={cam} near={0.1} far={200}>
          <CasaLights keyFrom={[-3, 6.5, 10]} />
          <CasaRoom t={t} />
          <Duvet lie={0} />
          <Nubi
            size={2}
            position={NUBI_RUG}
            pose={nubi}
            palette={{ eyeRough: 0.7 }}
            shadowOpacity={0.3}
            holdR={
              <OnFin raise={nubi.finR ?? 0} offset={[0.1, -0.3, 0.6]}>
                <CheeseString t={t} sway={whistle * sway} />
              </OnFin>
            }
          >
            <Lids pose={nubi} droop={nubiDroop} tilt={0.1 * whistle} color={NUBI_GREEN} />
          </Nubi>
          <group position={[haloAt[0], haloAt[1], haloAt[2]]}>
            <Halo k={haloK} spin={t * 2} />
          </group>
          {g >= BOX - 1 ? (
            <Chico
              position={chicoAt}
              rotationY={CHICO_YAW}
              pose={chico}
              eyeRough={0.7}
            >
              {/* The empty box, held out in front, open towards us. */}
              <group position={[0, 2.9 + 1.2 * boxThrust, 6.4 + 2.5 * boxThrust]} rotation={[1.1 - 0.15 * boxThrust, Math.PI, 0]} scale={M * 0.85}>
                <PizzaBox open={2.25} />
              </group>
              <Lids pose={chico} droop={0.25 + 0.25 * glare} tilt={-0.32} color="#6EC1FF" />
            </Chico>
          ) : null}
        </Stage>
        {!halo2d.behind ? <Sparkles g={g} at={SOLUCION + 1} x={halo2d.x} y={halo2d.y} /> : null}
        {!shotClose && !shotInsert && !side.behind ? <Sweat g={g} at={SILENCIO + 1} until={SILBA + 14} x={side.x} y={side.y} /> : null}
        {!mouth.behind ? <Notes g={g} from={SILBA + 2} x={mouth.x} y={mouth.y} on={notesOn} scale={shotClose ? 0 : 1} /> : null}
        {!shotClose && !shotInsert && !tg.behind ? <TruthTag frame={g} at={SILENCIO} out={NADA} loading x={tg.x} y={tg.y} scale={tg.scale} /> : null}
      </Shake>
    </AbsoluteFill>
  );
};
