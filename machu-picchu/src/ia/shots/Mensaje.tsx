import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Cam, aim } from "../../thanos/camera";
import { CameraRig, Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { BOY, BoyLights, BoyRoom, Chico, HeldThing, JuiceBox, M, Phone, typingFins } from "../../three/ia/Rooms";
import { MENSAJE } from "../beats";
import { SHOTS } from "../shots";
import { chicoTalk } from "../talk";

// "mensaje" (MENSAJE.START → MENSAJE.END, ~10.8 s): SPLIT SCREEN. Two half-height canvases of the
// boy's room (the 2D layer adds the «CON IA» / «SIN IA» labels and the chat bubbles).
//   • Top (y 0–960) "CON IA": the boy relaxed on his stool, swivelled away from the desk, leaning
//     back, fins folded, sipping a juice box, while the laptop beside him writes on its own (its
//     glow pulses as if writing a poem). On SI a smug little shrug. Body ≈ x 230–620, y 420–860;
//     the laptop ≈ x 640–860, y 640–760.
//   • Bottom (y 960–1920) "SIN IA": the same boy at the desk with the laptop CLOSED, hunched over
//     his phone. Thinks hard (fins up at his head, a tiny sway), types «Hola… ¿ya comiste?» (L02,
//     chicoTalk), SENT (a hopeful hop), waits; at SI her «Sí» arrives: he freezes, eyes wide, then
//     deflates (squash); crickets; L04 «Ya no sé cómo seguir» and he slumps onto the desk. His
//     head and the phone stay in y ≈ 1000–1200, above the captions (they cover his lower body).

const W = 1080;
const H = 960;
const FOV_FULL = 44;
/** Vertical fov of a half-height canvas showing the central band of a full-frame camera. */
const halfFov = (fovFull: number) => (2 * Math.atan(Math.tan((fovFull * Math.PI) / 360) / 2) * 180) / Math.PI;
/** Aims a half-height camera so `point` lands at SCREEN (sx, sy) of the composition, the half's
 *  top edge being at `top` (0 or 960). */
const halfAim = (pos: Vec3, point: Vec3, sx: number, sy: number, top: number): Cam => {
  const c = aim(pos, FOV_FULL, point, sx, sy - top + (1920 - H) / 2, 14);
  return { ...c, fov: halfFov(FOV_FULL) };
};

const HalfStage: React.FC<{ top: number; cam: Cam; children: React.ReactNode }> = ({ top, cam, children }) => (
  <div style={{ position: "absolute", left: 0, top, width: W, height: H, overflow: "hidden" }}>
    <ThreeCanvas width={W} height={H} flat gl={{ antialias: true, alpha: true }} camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 200 }} style={{ position: "absolute", inset: 0 }}>
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} roll={cam.roll ?? 0} />
      {children}
    </ThreeCanvas>
  </div>
);

/** Where his body centre sits (for aiming): above the stool. */
const BODY: Vec3 = [BOY.sit[0], BOY.sit[1] + 1.0, BOY.sit[2]];

export const MensajeShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.mensaje.from;
  const t = g / 30;
  const { START, END, L02, SENT, L03, SI, L04 } = MENSAJE;

  // =====================================================================================
  // Top: CON IA — relaxed, the laptop does the work.
  const drift = ramp(g, START, END, [0, 1], (x) => x);
  const topCam = halfAim(lerp3([2.3, 3.7, 12.4], [2.2, 3.6, 11.6], drift), BODY, 400, 640, 0);
  const sipAt = [START + 40, L03 + 30, L04 + 20];
  const sip = Math.max(...sipAt.map((s) => windowIn(g, s, s + 34, 8)));
  const shrug = g >= SI + 4 ? windowIn(g, SI + 4, SI + 26, 6) : 0;
  const breathe = Math.sin(t * 2.2);
  const relaxed: NubiPose = {
    pitch: -0.2 + 0.015 * breathe - 0.05 * sip,
    yaw: 0.05 * Math.sin(t * 0.9),
    roll: 0.05 + 0.02 * Math.sin(t * 1.3),
    blink: 0.5 - 0.15 * shrug,
    eyeScale: 0.95,
    lookX: -0.2 * shrug,
    lookY: 0.15,
    squash: 1 - 0.035 + 0.015 * breathe + 0.04 * shrug,
    finL: -0.4 + 0.65 * shrug,
    finR: -0.1 + 0.85 * sip + 0.45 * shrug,
    wiggle: 0.35,
    wigglePhase: t * 4,
    hop: 0.2 * shrug,
  };
  // The laptop "writes the poem": a pulsing glow.
  const poem = 1.35 + 0.3 * Math.sin(t * 7) + 0.15 * Math.sin(t * 17);

  // =====================================================================================
  // Bottom: SIN IA — the phone, the "Sí", the slump.
  const think = 1 - ramp(g, L02 - 6, L02 + 2);
  const typeK = Math.max(windowIn(g, L02 - 2, L02 + 9, 3), windowIn(g, L02 + 15, SENT - 2, 3));
  const sentHop = g >= SENT ? Math.sin(Math.PI * ramp(g, SENT, SENT + 10, [0, 1], (x) => x)) : 0;
  const waiting = ramp(g, SENT + 6, SENT + 14) * (1 - ramp(g, SI - 2, SI));
  const freeze = g >= SI ? pop(g, SI, { damping: 9, stiffness: 300 }) : 0;
  const deflate = ramp(g, SI + 12, SI + 22, [0, 1], EASE_OUT);
  const slump = ramp(g, L04 + 24, L04 + 40, [0, 1], EASE_IN_OUT);
  const bump = g >= L04 + 38 ? Math.exp(-(g - L04 - 38) / 3) * Math.sin((g - L04 - 38) * 1.6) : 0;
  const fins = typingFins(g, typeK, -0.05, 1.1);
  const sway = Math.sin(t * 3.1);
  const fidget = Math.max(0, Math.sin(t * 2.6)) ** 6;
  let hunched: NubiPose = {
    pitch: 0.18 + 0.04 * sway * think + 0.5 * slump + 0.04 * bump,
    yaw: 0.06 * sway * think,
    roll: 0.07 * sway * think + 0.03 * fidget * waiting,
    lookY: -0.55 + 0.25 * freeze * (1 - slump) - 0.2 * slump,
    lookX: 0.05,
    eyeScale: 0.82 * think + (1 - think) * (1.05 + 0.1 * waiting) + 0.4 * freeze * (1 - deflate) + -0.25 * deflate * (1 - think),
    blink: 0.35 * deflate + 0.4 * slump,
    squash: 1 + 0.03 * sway * think + 0.05 * sentHop - 0.02 * freeze * (1 - deflate) - 0.16 * deflate - 0.04 * slump,
    hop: 0.9 * sentHop + 0.35 * fidget * waiting,
    finL: 1.45 * think + (1 - think) * fins.l + 0.15 * sentHop - 0.45 * deflate - 0.2 * slump,
    finR: 1.35 * think + (1 - think) * fins.r + 0.4 * sentHop - 0.45 * deflate - 0.2 * slump,
    wiggle: 0.4 * waiting,
    wigglePhase: t * 6,
  };
  if (g >= L02 && g < SENT + 4) hunched = chicoTalk(g, hunched, 0.45);
  if (g >= L04) hunched = chicoTalk(g, hunched, 0.4 * (1 - slump) + 0.15);
  // The camera: a slow creep in; a small snap closer on the «Sí».
  const creep = ramp(g, START, SI, [0, 0.5], (x) => x) + ramp(g, SI, SI + 8, [0, 0.5], EASE_OUT);
  const botCam = halfAim(lerp3([2.4, 3.9, 15.2], [2.3, 3.6, 13.2], creep), BODY, 450, 1135, 960);
  const phoneOn = 1;

  return (
    <AbsoluteFill style={{ background: "#BFE6FF" }}>
      <HalfStage top={0} cam={topCam}>
        <BoyLights screen={0.6 + 0.4 * (poem - 1)} keyFrom={[9, 8, 6]} />
        <BoyRoom t={t} laptopGlow={poem} laptopTurn={0.55} stoolYaw={-0.95} />
        <Chico
          position={[BOY.sit[0] - 0.05, BOY.sit[1], BOY.sit[2]]}
          rotationY={BOY.face - 0.95}
          pose={relaxed}
          shadow={false}
          holdR={
            <HeldThing raise={relaxed.finR ?? 0} scale={1.2} lift={0}>
              <JuiceBox />
            </HeldThing>
          }
        />
      </HalfStage>
      <HalfStage top={960} cam={botCam}>
        <BoyLights screen={1.2} screenAt={[BOY.sit[0] + 1.2, BOY.sit[1] + 0.4, BOY.sit[2] + 0.6]} keyFrom={[9, 8, 6]} />
        <BoyRoom t={t} laptopOpen={0} laptopGlow={0} />
        <Chico position={BOY.sit} rotationY={BOY.face} pose={hunched} shadow={false}>
          <group position={[0.6, 4.2 + 0.1 * Math.sin(t * 9) * typeK, 6.6]} rotation={[-0.75, 0.2, 0]} scale={M}>
            <group scale={1.35}>
              <Phone on={phoneOn} caseColor="#2F3A56" accent="#34C759" />
            </group>
          </group>
        </Chico>
      </HalfStage>
      {/* A thin divider between the halves. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 957, height: 6, background: "#FFFFFF" }} />
    </AbsoluteFill>
  );
};
