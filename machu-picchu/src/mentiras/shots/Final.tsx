import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, ramp, windowIn } from "../../anim";
import { TruthTag } from "../../overlay/mentiras/TruthTag";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, projectToScreen } from "../../three/CameraRig";
import {
  CasaLights,
  CasaPhone,
  CasaRoom,
  Duvet,
  EYES,
  EarPhone,
  NUBI_SIT,
  PHONE_STAND,
  bedPlacement,
  nubiPoint,
} from "../../three/mentiras/Casa";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { EyeBags, Lids } from "../../three/tiempo/Office";
import { tagAt } from "../anchor";
import { FINAL } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";
import { MENTIRAS } from "../timeline";
import { EAR_RAISE, RUN_RATE, RunMarks, SLEEPY, camBed, mixCam, runPose, tagPoint } from "./Gancho";

// Shot "final" (FINAL.START → END): close to camera, Nubi sitting up in bed, playful: L18 "Ahora
// confiesa…" (leans in; points at its head on "cabeza"), then a cut to a 3/4 angle for the three
// options (the 2D cards pop in the top band: Nubi looks up at each, and does a passive-aggressive
// shrug for «no me pasa nada»). ARMS (cut, front): smug, chin up — "Yo nunca digo esa última."; TAG:
// «LA DIJO ESTA MAÑANA» slams over it; its eyes go up, then it turns on the tag, outraged: "¡A ti
// nadie te preguntó!", shaking a fin at it; SWAT: a big fin swing, the tag spins off. RING: the
// phone on the nightstand rings — cut to the high loop framing: Nubi dives for it, flops back on the
// pillow with the phone at its ear and starts fake-running: the last frame is the hook's first.

const FOV = 40;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const SIT_EYES = nubiPoint(NUBI_SIT, {}, EYES);
/** Front, medium-close, slow push (no cards yet). */
const camClose = (push: number): Cam => aim([0.4 - 0.2 * push, 2.5 - 0.1 * push, 7.6 - 0.8 * push], FOV, SIT_EYES, 540, 1000);
/** 3/4 from the left for the options (head under the cards' band). */
const camOptions = (push: number): Cam => aim([-2.6 + 0.2 * push, 2.5, 6.6 - 0.35 * push], FOV, SIT_EYES, 560, 1060);
/** Front, medium: room over the head for the tag. */
const camTag = (push: number): Cam => aim([0.5 - 0.1 * push, 2.8 - 0.05 * push, 9.4 - 0.45 * push], FOV, SIT_EYES, 530, 1030);
/** RING: high and wide on the bed and the nightstand (the phone buzzing), then into the loop framing. */
const camRing = (drift: number): Cam => aim([1.2 - 0.1 * drift, 6.0 - 0.2 * drift, 8.4 - 0.3 * drift], FOV, [0.95, 1.3, -0.8], 560, 960);

/** "Brrr" marks around the ringing phone (2D). */
const Buzz: React.FC<{ g: number; at: number; x: number; y: number }> = ({ g, at, x, y }) => {
  if (g < at) return null;
  const on = g % 4 < 3 ? 1 : 0.55;
  return (
    <svg width={360} height={240} viewBox="-180 -120 360 240" style={{ position: "absolute", left: x - 180, top: y - 120, opacity: on, overflow: "visible" }}>
      {[-1, 1].map((s) =>
        [0, 1, 2].map((k) => {
          const r = 60 + k * 30 + 6 * Math.sin((g - at) * 1.7 + k);
          return <path key={`${s}${k}`} d={`M ${s * r * 0.5} ${-r * 0.75} Q ${s * r} 0 ${s * r * 0.5} ${r * 0.75}`} fill="none" stroke="#FFFFFF" strokeWidth={10 - 2 * k} strokeLinecap="round" style={{ filter: "drop-shadow(0 3px 0 rgba(40,30,90,0.6))" }} />;
        }),
      )}
    </svg>
  );
};

export const FinalShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.final.from;
  const { START, END, OPT1, OPT2, OPT3, ARMS, L19, TAG, L20, SWAT, RING } = FINAL;
  const t = g / 30;
  const seam = g - END;
  const CONFIESA = MENTIRAS.wordAt("L18", 1);
  const CABEZA = MENTIRAS.wordAt("L18", 8);
  const NADA = MENTIRAS.wordAt("L18", 18);
  const NUNCA = MENTIRAS.wordAt("L19", 1);

  // ---- Segments (hard cuts).
  const segOptions = g >= OPT1 && g < ARMS;
  const segTag = g >= ARMS && g < RING;
  const segRing = g >= RING;

  // ---- Nubi, sitting up in bed: playful question → options → smug → tag → outrage → swat.
  const lean = windowIn(g, CONFIESA - 6, CONFIESA + 26, 7);
  const pointHead = windowIn(g, CABEZA - 4, CABEZA + 24, 5);
  const optHop = [OPT1, OPT2, OPT3].reduce((s, a) => s + (g >= a ? Math.max(0, Math.sin(((g - a) / 10) * Math.PI)) * (g < a + 10 ? 1 : 0) : 0), 0);
  const optIdx = g >= OPT3 ? 2 : g >= OPT2 ? 1 : g >= OPT1 ? 0 : -1;
  const lookCard = optIdx >= 0 ? windowIn(g, OPT1, OPT3 + 14, 4) : 0;
  const shrug = windowIn(g, OPT3 + 4, NADA + 10, 5);
  const shrugFins = g >= OPT3 + 4 ? Math.max(0, Math.sin(((g - OPT3 - 4) / 12) * Math.PI)) * (g < OPT3 + 16 ? 1 : 0) : 0;
  const smug = ramp(g, ARMS - 2, ARMS + 6, [0, 1], EASE_OUT) * (1 - ramp(g, TAG, TAG + 3));
  const nod = g >= NUNCA ? Math.max(0, Math.sin(((g - NUNCA) / 12) * Math.PI)) * (g < NUNCA + 12 ? 1 : 0) : 0;
  const shock = windowIn(g, TAG, TAG + 22, 3);
  const glare = ramp(g, TAG + 18, TAG + 28, [0, 1], EASE_IN_OUT) * (1 - ramp(g, SWAT + 8, SWAT + 16));
  const rant = g >= L20 && g < SWAT - 6 ? 1 : 0;
  const windUp = ramp(g, SWAT - 7, SWAT - 2, [0, 1], EASE_IN_OUT);
  const swing = ramp(g, SWAT - 2, SWAT + 1, [0, 1], EASE_IN);
  const settle = ramp(g, SWAT + 5, SWAT + 14, [0, 1], EASE_IN_OUT);
  const proud = ramp(g, SWAT + 8, SWAT + 14, [0, 1], EASE_OUT) * (1 - ramp(g, RING, RING + 3));
  const tagShake = g >= L20 - 4 && g < SWAT - 7 ? Math.sin(g * 1.25) : 0;

  let finR = 0.12 + 2.3 * pointHead + 1.0 * lookCard * (optIdx === 0 ? 1 : 0.6) + 0.9 * shrugFins;
  let finL = 0.08 + 0.7 * lookCard * (optIdx >= 1 ? 1 : 0) + 0.9 * shrugFins;
  if (smug > 0) {
    finR = lerp(finR, -0.45, smug);
    finL = lerp(finL, -0.45, smug);
  }
  if (g >= TAG) {
    finR = lerp(-0.45, 0.4, shock);
    finL = lerp(-0.45, 0.4, shock);
  }
  if (glare > 0) {
    finR = lerp(finR, 1.9 + 0.5 * tagShake, glare);
    finL = lerp(finL, 0.15, glare);
  }
  if (g >= SWAT - 7) {
    const swat = lerp(lerp(1.9, -0.65, windUp), 3.1, swing);
    finR = lerp(swat, 0.2, settle);
  }
  if (proud > 0) {
    // Dusting its fins off.
    const dust = Math.max(0, Math.sin((g - SWAT - 8) * 0.9));
    finR = lerp(finR, 0.35 + 0.35 * dust, proud);
    finL = lerp(finL, 0.35 + 0.35 * dust, proud);
  }
  const optLookX = [-0.35, 0.05, 0.4][Math.max(0, optIdx)];
  let sit: NubiPose = {
    pitch: 0.04 + 0.13 * lean - 0.13 * smug - 0.17 * glare - 0.1 * proud,
    hop: 0.3 + 0.55 * lean + 0.9 * optHop + 0.7 * shock * (g < TAG + 6 ? 1 : 0.3) + 0.35 * nod,
    squash: 1 - 0.06 * (g >= TAG && g < TAG + 4 ? 1 : 0) + 0.04 * smug,
    yaw: 0.28 * shrug + 0.22 * smug - 0.12 * swing * (1 - settle),
    roll: 0.12 * windUp * (1 - swing) - 0.24 * swing * (1 - settle) + (optIdx >= 0 ? 0.1 * optHop * (optIdx % 2 ? -1 : 1) : 0),
    finR,
    finL,
    lookX: lerp(lerp(optLookX * lookCard + 0.6 * shrug, -0.35, smug), 0, Math.max(shock, glare)),
    lookY: Math.max(0.65 * pointHead, 0.85 * lookCard * (1 - shrug), 0.95 * shock, 0.8 * glare),
    eyeScale: 1.05 + 0.1 * lean + 0.3 * shock - 0.1 * glare,
    blink: 0.8 * proud,
  };
  const talkK = g >= L20 ? 1.35 : g >= L19 - 2 ? 0.7 : 1;
  if (!segRing) sit = nubiTalk(g, sit, talkK);
  if (pointHead > 0.3 || lookCard > 0.3 || shock > 0.3 || glare > 0.3) {
    sit.lookY = Math.max(0.65 * pointHead, 0.85 * lookCard * (1 - shrug), 0.95 * shock, 0.8 * glare);
  }
  if (g >= SWAT - 7 || rant) sit.finR = finR + (rant ? 0.25 * (sit.hop ?? 0) * 0.3 : 0);
  const sitDroop = Math.max(0.3 * lean, 0.5 * shrug, 0.55 * smug, 0.32 * glare) * (1 - shock);

  // ---- RING: dive for the phone, flop back on the pillow, phone at the ear, fake-run (= the hook).
  const jolt = windowIn(g, RING, RING + 6, 2);
  const reach = ramp(g, RING + 3, RING + 10, [0, 1], EASE_OUT);
  const GRAB = RING + 10;
  const grabbed = g >= GRAB;
  const flop = ramp(g, GRAB, GRAB + 8, [0, 1], EASE_IN_OUT);
  const runK = ramp(g, GRAB + 6, GRAB + 12, [0, 1], EASE_IN_OUT);
  const place = bedPlacement(segRing ? flop : 0);
  let pose: NubiPose = sit;
  let nubiAt: Vec3 = place.position;
  let droop = sitDroop;
  if (segRing) {
    const run = runPose(seam, runK);
    const reachK = reach * (1 - flop);
    const dive: NubiPose = {
      pitch: place.pitch + 0.08 * reachK,
      hop: 0.3 + 1.1 * jolt,
      squash: 1 + 0.06 * jolt,
      roll: -0.22 * reachK,
      yaw: 0.4 * reachK,
      finR: lerp(lerp(0.2, 0.35, reachK), EAR_RAISE, flop),
      finL: 0.1 + 0.5 * jolt,
      lookX: lerp(0.85 * Math.max(jolt, reachK), run.lookX ?? 0, flop),
      lookY: lerp(-0.25 * reachK, run.lookY ?? 0, flop),
      eyeScale: lerp(1 + 0.3 * Math.max(jolt, reachK), run.eyeScale ?? 1, flop),
    };
    pose = runK > 0 ? mixPose(dive, run, runK) : dive;
    nubiAt = [place.position[0] + 0.38 * reachK, place.position[1], place.position[2]];
    droop = SLEEPY.droop * ramp(g, GRAB + 2, GRAB + 10);
  }

  // ---- Camera.
  let cam: Cam;
  if (segRing) cam = mixCam(camRing(ramp(g, RING, GRAB, [0, 1], (x) => x)), camBed(seam), ramp(g, GRAB + 1, END - 2, [0, 1], EASE_IN_OUT));
  else if (segTag) cam = camTag(ramp(g, ARMS, RING, [0, 1], (x) => x));
  else if (segOptions) cam = camOptions(ramp(g, OPT1, ARMS, [0, 1], (x) => x));
  else cam = camClose(ramp(g, START, OPT1, [0, 1], (x) => x));

  // ---- The phone on the nightstand: rings at RING (buzzing, screen on), grabbed at GRAB.
  const ringing = g >= RING && !grabbed;
  const buzz = ringing ? 1 : 0;
  const phoneAt: Vec3 = [PHONE_STAND[0] + 0.02 * buzz * Math.sin(g * 2.7), PHONE_STAND[1] + 0.015 * buzz * Math.abs(Math.sin(g * 3.9)), PHONE_STAND[2] + 0.02 * buzz * Math.cos(g * 3.1)];
  const phone2d = projectToScreen(cam, phoneAt, 1080, 1920);

  // ---- The tag.
  const tg = tagAt(cam, tagPoint(nubiAt, pose, 0, 0.12));

  return (
    <AbsoluteFill style={{ background: "#C3B3FF" }}>
      <Shake
        frame={g}
        impacts={[
          { at: TAG, amp: 9, dur: 12 },
          { at: SWAT, amp: 16, dur: 12 },
          { at: RING, amp: 4, dur: 8 },
        ]}
      >
        <Stage cam={cam} near={0.1} far={200}>
          <CasaLights keyFrom={segRing ? [-2, 9, 6] : segOptions ? [-6, 6, 7] : [-3, 6, 9]} />
          <CasaRoom t={t} beams={segRing ? 0.6 : 0} />
          <Duvet lie={segRing ? flop : 0} pedal={segRing ? runK : 0} phase={seam * RUN_RATE} bob={segRing ? 0.2 * (pose.hop ?? 0) * runK : 0} />
          {!grabbed ? (
            <group position={phoneAt} rotation={[-Math.PI / 2, 0, 0.45 + 0.05 * buzz * Math.sin(g * 4.3)]}>
              <CasaPhone screen={ringing ? "call" : "off"} glow={ringing ? 0.8 + 0.2 * Math.sin(g * 1.3) : 0} />
            </group>
          ) : null}
          <Nubi size={2} position={nubiAt} pose={pose} shadow={false} palette={{ eyeRough: 0.7 }} holdR={grabbed ? <EarPhone raise={pose.finR ?? EAR_RAISE} /> : undefined}>
            <Lids pose={pose} droop={droop} tilt={glare > 0.2 && !segRing ? -0.35 * glare : segRing ? 0.12 : 0} color={NUBI_GREEN} />
            {segRing ? <EyeBags pose={pose} color="#6D9F86" amount={SLEEPY.bags * ramp(g, GRAB + 2, GRAB + 10)} /> : null}
          </Nubi>
        </Stage>
        {ringing && !phone2d.behind ? <Buzz g={g} at={RING} x={phone2d.x} y={phone2d.y} /> : null}
        {segRing ? <RunMarks cam={cam} d={seam} k={runK} /> : null}
        {!segRing && !tg.behind ? (
          <TruthTag frame={g} at={TAG} out={SWAT + 16} swatAt={SWAT} lines={[{ text: "LA DIJO ESTA MAÑANA" }]} x={tg.x} y={tg.y} scale={tg.scale} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};

const mixPose = (a: NubiPose, b: NubiPose, k: number): NubiPose => {
  const out: NubiPose = {};
  const keys: (keyof NubiPose)[] = ["hop", "squash", "yaw", "pitch", "roll", "finL", "finR", "wiggle", "wigglePhase", "blink", "eyeScale", "lookX", "lookY"];
  for (const key of keys) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined && vb === undefined) continue;
    const def = key === "squash" || key === "eyeScale" ? 1 : 0;
    out[key] = lerp(va ?? def, vb ?? def, clamp01(k));
  }
  return out;
};
