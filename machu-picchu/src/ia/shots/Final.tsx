import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, keyframes, ramp } from "../../anim";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { NUBI_SPOT, POWER_ON, STUDIO_BG, STUDIO_NUBI_PALETTE, SquintEyes, StudioStage } from "../../three/ia/Studio";
import { FINAL } from "../beats";
import { SHOTS } from "../shots";
import { nubiTalk } from "../talk";

// Shot "final" (FINAL.START → FINAL.CARD): Nubi hops up close to the camera in its fully lit
// studio, playful: "Confiesa: ¿qué fue lo último que le pediste a una IA?". The 2D layer pops three
// option cards in the band above it (y 260-560) — «TAREA» (left), «TRABAJO» (centre), «MENSAJES»
// (right) — and Nubi glances at each. On "como si fuera tuyo" it turns suspicious; at SQUINT one
// eye narrows to half its height with a head tilt (the "raised eyebrow"); «Te leo, poeta.» with
// a teasing lean towards the camera. Nubi's body stays between y ≈ 600 and 1150.

const FOV = 40;
const FRONT: Vec3 = [0.15, 0, 1.25];
const START_AT: Vec3 = [NUBI_SPOT[0], 0, 0.1];
const BODY: Vec3 = [FRONT[0], 1.24, FRONT[2]];
const C0: Cam = aim([0.35, 1.45, 10.5], FOV, BODY, 540, 880, 10);
const C1: Cam = aim([0.25, 1.4, 10.0], FOV, BODY, 540, 880, 10);

export const FinalShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.final.from;
  const t = g / 30;
  const { START, TAREA, TRABAJO, MENSAJE, TUYO, SQUINT, L15, CARD } = FINAL;

  const push = ramp(g, START, CARD, [0, 1], Easing.inOut(Easing.sin));
  const cam: Cam = { position: lerp3(C0.position, C1.position, push), target: lerp3(C0.target, C1.target, push), fov: FOV };

  // ---- Two hops towards the camera.
  const HOP_END = START + 22;
  const go = ramp(g, START, HOP_END, [0, 1], Easing.inOut(Easing.quad));
  const hopPh = ramp(g, START, HOP_END, [0, 2 * Math.PI], Easing.linear);
  const hopping = g < HOP_END ? Math.abs(Math.sin(hopPh)) : 0;
  const landSq = Math.sin(Math.PI * ramp(g, HOP_END - 1, HOP_END + 6, [0, 1], Easing.linear));
  // Teasing lean towards the camera on L15.
  const lean = ramp(g, L15 - 2, L15 + 10, [0, 1], EASE_OUT) * (1 - ramp(g, CARD - 8, CARD, [0, 1], EASE_IN_OUT));
  const at: Vec3 = [lerp(START_AT[0], FRONT[0], go), 0, lerp(START_AT[2], FRONT[2], go) + 0.12 * lean];

  // ---- Glances at the three cards (left, centre, right) as they pop up, then back to the camera.
  const k = (a: number) => [a - 3, a + 5, a + 26, a + 32];
  const lookX =
    keyframes(g, k(TAREA), [0, -0.75, -0.75, 0]) + keyframes(g, k(TRABAJO), [0, 0.0, 0.0, 0]) + keyframes(g, k(MENSAJE), [0, 0.75, 0.75, 0]);
  const lookUp = Math.max(keyframes(g, k(TAREA), [0, 1, 1, 0]), keyframes(g, k(TRABAJO), [0, 1, 1, 0]), keyframes(g, k(MENSAJE), [0, 1, 1, 0]));
  const bump = (a: number) => Math.sin(Math.PI * ramp(g, a - 2, a + 7, [0, 1], Easing.linear));
  const pops = bump(TAREA) + bump(TRABAJO) + bump(MENSAJE);
  const sus = ramp(g, TUYO - 14, TUYO + 4, [0, 1], EASE_IN_OUT);
  const squint = ramp(g, SQUINT - 2, SQUINT + 5, [0, 1], EASE_OUT) * (1 - ramp(g, CARD - 6, CARD, [0, 1], EASE_IN_OUT) * 0.5);
  const playful = 1 - sus;

  const base: NubiPose = {
    yaw: 0.12 * lookX + 0.05 * Math.sin(t * 1.4) * playful,
    roll: 0.05 * Math.sin(t * 2.2) * playful + 0.13 * squint,
    pitch: -0.08 * lookUp + 0.05 * sus + 0.12 * lean,
    hop: 2.0 * hopping + 0.8 * pops,
    squash: 1 - 0.12 * landSq + 0.04 * pops - 0.03 * sus,
    eyeScale: 1.08 * playful + 0.95 * sus + 0.12 * pops,
    lookX: lookX * 0.9 + 0.12 * sus,
    lookY: 0.75 * lookUp + 0.05,
    finL: 0.2 * playful + 0.25 * pops + 0.15 * hopping - 0.05 * sus,
    finR: 0.2 * playful + 0.25 * pops + 0.15 * hopping + 0.55 * lean,
    wiggle: 0.6 * hopping,
    wigglePhase: g * 0.6,
  };
  const pose = nubiTalk(g, base, 0.9);

  return (
    <AbsoluteFill style={{ background: STUDIO_BG }}>
      <StudioStage cam={cam} t={t} power={POWER_ON} lever={1}>
        <Nubi size={2} position={at} rotationY={-0.04} pose={pose} palette={STUDIO_NUBI_PALETTE} hideEyes shadowOpacity={0.4}>
          <SquintEyes pose={pose} squintL={squint} rough={STUDIO_NUBI_PALETTE.eyeRough} />
        </Nubi>
      </StudioStage>
    </AbsoluteFill>
  );
};

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
