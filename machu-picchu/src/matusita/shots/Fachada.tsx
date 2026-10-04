import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import {
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

// "Fachada" (LUGAR.START → RAISE), L02: "La Casa Matusita existe de verdad. Y por décadas, muchas
// personas evitaron mirar hacia ese segundo piso."
// Low-angle establishing shot of the house in the rain: Nubi small on the plaza kerb opposite
// (feet y ≈ 1262), its flashlight on, the beam across the wet road onto the shutter. Lightning at
// THUNDER (Nubi flinches). A slow push-in; on "segundo piso" the camera cranes up to the upper
// floor and "the" window glows dimly for ~12 frames at WINDOW, then goes dark. The sky band
// y 230-330 stays plain (a small 2D disclaimer).

const FOV = 34;
const N: Vec3 = NUBI_OPPOSITE;
const SIZE = 2;

/** Lightning: a double flash at THUNDER. */
export const thunderFlash = (g: number) => {
  const d = g - LUGAR.THUNDER;
  if (d < 0 || d > 24) return 0;
  const a = d < 3 ? 1 : d < 5 ? 0.25 : d < 8 ? 0.85 : 0;
  return Math.max(a, d >= 8 ? 0.6 * Math.exp(-(d - 8) / 4) : 0);
};

/** "The" window glowing dimly from inside (a warm, unsteady light) for ~12 frames. */
export const windowGlow = (g: number) => windowIn(g, LUGAR.WINDOW, LUGAR.WINDOW + 13, 3) * (0.75 + 0.25 * flicker(g, 11, 0.8));

export const FachadaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.fachada.from;
  const t = g / 30;
  const { START, THUNDER, L02, SEGUNDO, WINDOW, RAISE } = LUGAR;
  const flash = thunderFlash(g);

  // ---- Camera: low and wide, a slow push-in; on "segundo" it cranes up to the upper floor.
  const push = ramp(g, START, SEGUNDO, [0, 1], (x) => x);
  const low: Vec3 = [4.4 - 0.7 * push, 0.42 + 0.12 * push, 30.5 - 2.4 * push];
  const A: Cam = aim(low, FOV, N, 420 + 20 * push, 1262, 20);
  const crane = ramp(g, SEGUNDO - 12, WINDOW + 10, [0, 1], EASE_IN_OUT);
  const high: Vec3 = [2.6 - 0.2 * ramp(g, WINDOW + 10, RAISE), 3.3, 17.5 - 0.5 * ramp(g, WINDOW + 10, RAISE)];
  const B: Cam = aim(high, 28, [CASA_WINDOW[0], CASA_WINDOW[1] - 0.2, 0], 560, 820, 17);
  const cam: Cam = {
    position: lerp3(A.position, B.position, crane),
    target: lerp3(A.target, B.target, crane),
    fov: FOV + (28 - FOV) * crane,
  };

  // ---- Nubi on the kerb facing the house, the torch on the shutter; flinches at the thunder.
  const flinch = windowIn(g, THUNDER, THUNDER + 16, 3);
  const base: NubiPose = {
    hop: 1.1 * windowIn(g, THUNDER, THUNDER + 8, 2),
    squash: 1 - 0.08 * flinch,
    eyeScale: 1.1 + 0.3 * flinch,
    finR: 0.25,
    finL: -0.1 + 0.4 * flinch,
    pitch: -0.06,
    roll: 0.02 * Math.sin(t * 2.1) * flinch,
  };
  const pose = g >= L02 ? matusitaTalk(g, base, 0.35) : base;
  const rotY = Math.atan2(CASA_SHUTTER[0] + 1.2 - N[0], -N[2]);
  const nubi: NubiAt = { position: N, rotationY: rotY, size: SIZE, pose };
  const target: Vec3 = [CASA_SHUTTER[0] + 1.4 + 0.25 * Math.sin(t * 0.6), CURB + 1.5 + 0.15 * Math.sin(t * 0.43), 0];
  const aimed = torchAim(nubi, "R", target);
  const on = 0.92 + 0.08 * flicker(g, 5, 0.4);

  const lamp = lampFlicker(g) * (flash > 0.5 ? 0.6 : 1);
  const glow = windowGlow(g);
  return (
    <AbsoluteFill style={{ background: nightSky(flash * 0.8) }}>
      <Stage cam={cam} near={0.3} far={400}>
        <NightFog near={16} far={110} />
        <NightLights flash={flash} />
        <MatusitaStreet lamp={lamp} glow={glow} creak={0.04 * Math.sin(t * 0.8)} eye={cam.position} />
        <StreetReflection>
          <MatusitaStreet lamp={lamp} glow={glow} mirror />
          <Nubi size={SIZE} position={N} rotationY={rotY} pose={pose} shadow={false} holdR={<HeldTorch nubi={nubi} side="R" target={target} on={on} mirror />} />
        </StreetReflection>
        <Nubi size={SIZE} position={N} rotationY={rotY} pose={pose} shadowOpacity={0.5} holdR={<HeldTorch nubi={nubi} side="R" target={target} on={on} reach={13} intensity={40} beam={0.25} haze={0.22} />} />
        <Rain
          t={t}
          min={[-10, 0, 3]}
          size={[22, 11, 26]}
          count={3200}
          seed={7}
          opacity={0.3}
          px={2.4}
          lamp={lamp}
          flash={flash}
          torch={{ pos: aimed.lens, dir: aimed.dir, on, angle: 0.3 }}
          far={46}
        />
        <Splashes t={t} x0={-8} x1={12} z0={2.6} z1={27} count={420} opacity={0.3} lamp={lamp} />
        <Mist t={t} x0={-26} x1={26} z0={3} z1={13} count={14} opacity={0.13} />
      </Stage>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 62% at 50% 45%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
