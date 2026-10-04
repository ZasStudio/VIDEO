import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import {
  CASA_EYES,
  CASA_SHUTTER,
  CASA_WINDOW,
  CURB,
  HeldTorch,
  MatusitaStreet,
  Mist,
  NUBI_OPPOSITE,
  NightFog,
  NightLights,
  NubiAt,
  Rain,
  Splashes,
  StreetReflection,
  lampFlicker,
  nightSky,
  torchAim,
} from "../../three/matusita/Street";
import { LUGAR } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";

// "Ventana" (LUGAR.RAISE → END), L03 whispered: "Porque decían que… a veces algo miraba de vuelta."
//   A  RAISE → POV: low, behind Nubi (over its shoulder): it raises the flashlight from the shutter
//      up the facade to "the" window; the beam cuts through the rain and lands on the shutters; a
//      slow push-in. At EYES two faint pale eyes open in the dark gap of the window; the torch
//      stutters, Nubi freezes and trembles; at EYES_OFF the eyes blink out.
//   B  POV → END: the reverse, from inside the window (through the torn curtain), a long lens down
//      on Nubi in the rain: it stares up at us, eyes wide, trembling.

const N: Vec3 = NUBI_OPPOSITE;
const SIZE = 2;
/** The cut to the window's point of view, once the eyes have gone. */
const POV = LUGAR.EYES_OFF + 4;

/** The eyes in the window: open slowly at EYES, blink out at EYES_OFF. */
export const ventanaEyes = (g: number) => ramp(g, LUGAR.EYES, LUGAR.EYES + 10, [0, 1], EASE_OUT) * (1 - ramp(g, LUGAR.EYES_OFF, LUGAR.EYES_OFF + 3, [0, 1], (x) => x));

export const VentanaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.ventana.from;
  const t = g / 30;
  const { RAISE, L03, EYES, EYES_OFF, END } = LUGAR;
  const eyes = ventanaEyes(g);

  // ---- Nubi raises the torch from the shutter to the window; freezes when the eyes show.
  const raise = ramp(g, RAISE, RAISE + 22, [0, 1], EASE_IN_OUT);
  const frozen = ramp(g, EYES + 2, EYES + 6);
  const tremble = frozen * (0.6 + 0.4 * ramp(g, EYES + 6, EYES_OFF));
  const shiver = Math.sin(g * 2.7) * tremble;
  const win: Vec3 = [CASA_WINDOW[0] - 0.12, CASA_WINDOW[1] + 0.15, 0.05];
  const from: Vec3 = [CASA_SHUTTER[0] + 1.4, CURB + 1.5, 0];
  const target: Vec3 = [
    from[0] + (win[0] - from[0]) * raise + 0.04 * shiver,
    from[1] + (win[1] - from[1]) * raise + 0.1 * Math.sin(t * 1.3) * (1 - frozen) + 0.05 * shiver,
    0.05,
  ];
  const talk = 0.4 * (1 - frozen);
  const base: NubiPose = {
    finR: 0.25 + 0.75 * raise,
    finL: -0.1 - 0.25 * frozen,
    pitch: -0.08 - 0.1 * raise - 0.05 * frozen,
    squash: 1 - 0.07 * frozen,
    roll: 0.03 * shiver,
    yaw: 0.02 * Math.sin(g * 3.1) * tremble,
    eyeScale: 1.1 + 0.4 * frozen,
    lookY: 0.4 * raise,
  };
  const pose = matusitaTalk(g, base, talk);
  const rotY = Math.atan2(win[0] - N[0], win[2] - N[2]);
  const nubi: NubiAt = { position: N, rotationY: rotY, size: SIZE, pose };
  const aimed = torchAim(nubi, "R", target);
  // The torch stutters when the eyes open.
  const on = (0.92 + 0.08 * flicker(g, 9, 0.4)) * (g >= EYES + 1 && g < EYES + 9 ? 0.35 + 0.65 * flicker(g, 21, 3) : 1);

  // ---- Cameras.
  let cam: Cam;
  const pov = g >= POV;
  if (!pov) {
    const u = ramp(g, RAISE, POV, [0, 1], (x) => x);
    const pos: Vec3 = lerp3([N[0] - 1.25, 0.62, N[2] + 5.4], [N[0] - 1.0, 0.74, N[2] + 4.6], EASE_IN_OUT(u));
    cam = aim(pos, 30, CASA_EYES, 600, 600, 17);
  } else {
    const u = ramp(g, POV, END, [0, 1], (x) => x);
    const pos: Vec3 = [CASA_EYES[0] + 0.02 * Math.sin(t * 9), CASA_EYES[1] - 0.05, -0.15];
    cam = aim(pos, 24 - 3 * u, [N[0], CURB + 1.15, N[2]], 540, 880, 12);
  }
  // In the POV Nubi stares up at the window: eyes wide, trembling, the torch dipped in shock.
  const povPose: NubiPose = { ...pose, pitch: -0.32, lookY: 0.9, eyeScale: 1.55, roll: 0.05 * Math.sin(g * 2.9), finR: 0.7, finL: -0.35, squash: 0.92 };
  const nubiPose = pov ? povPose : pose;
  const nubiAt: NubiAt = { ...nubi, pose: nubiPose };
  const torchTarget: Vec3 = pov ? [win[0] + 0.6, win[1] - 1.6, 0] : target;
  const lamp = lampFlicker(g);

  const holdR = <HeldTorch nubi={nubiAt} side="R" target={torchTarget} on={on} reach={14} intensity={46} beam={pov ? 0.08 : 0.24} angle={0.26} />;
  return (
    <AbsoluteFill style={{ background: nightSky(0) }}>
      <Shake frame={g} impacts={[{ at: EYES + 1, amp: 5, dur: 10 }]}>
        <Stage cam={cam} near={pov ? 0.05 : 0.3} far={400}>
          <NightFog near={16} far={110} />
          <NightLights />
          <MatusitaStreet lamp={lamp} eyes={pov ? 0 : eyes} creak={0.05 * Math.sin(t * 0.9)} eye={cam.position} />
          <StreetReflection>
            <MatusitaStreet lamp={lamp} mirror />
            <Nubi size={SIZE} position={N} rotationY={rotY} pose={nubiPose} shadow={false} holdR={<HeldTorch nubi={nubiAt} side="R" target={torchTarget} on={on} mirror />} />
          </StreetReflection>
          <Nubi size={SIZE} position={N} rotationY={rotY} pose={nubiPose} shadowOpacity={0.5} holdR={holdR} />
          <Rain
            t={t}
            min={pov ? [-4, 0, 1] : [-6, 0, 2]}
            size={pov ? [12, 9, 14] : [14, 10, 20]}
            count={2600}
            seed={11}
            opacity={0.3}
            px={2.4}
            lamp={lamp}
            torch={{ pos: aimed.lens, dir: aimed.dir, on, angle: 0.26 }}
            far={40}
          />
          <Splashes t={t} x0={-6} x1={8} z0={2.6} z1={20} count={320} opacity={0.3} lamp={lamp} />
          <Mist t={t} x0={-26} x1={26} z0={3} z1={13} count={14} opacity={0.12} />
        </Stage>
      </Shake>
      <AbsoluteFill
        style={{
          background: pov
            ? "radial-gradient(ellipse 60% 48% at 50% 46%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%)"
            : "radial-gradient(ellipse 85% 62% at 50% 42%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      {/* A beat of black on the cut: the reverse lands like a jolt. */}
      <AbsoluteFill style={{ background: "#000", opacity: windowIn(g, POV - 1, POV + 2, 1) * 0.9 }} />
    </AbsoluteFill>
  );
};
