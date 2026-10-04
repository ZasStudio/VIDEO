import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import { CURB, HeldTorch, MatusitaStreet, Mist, NightFog, NightLights, NubiAt, Rain, Splashes, StreetReflection, lampFlicker, nightSky, torchAim } from "../../three/matusita/Street";
import { GANCHO } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";

// "Ojos" (GANCHO.START → END), L01 whispered: "Hay una casa en Lima donde, según la leyenda,
// alguien intentó pasar siete días… y no aguantó ni dos horas."
// Black, a low hum. At LIGHT the flashlight clicks on under Nubi's face (it stutters once): the
// scary under-light shows only the front of its face and its eyes; the rest of the body is a
// silhouette with a cold rim. Slow push-in. Far behind it, the dark silhouette of the house and the
// orange lamp at its corner through faint rain. Nubi whispers (small body motion), eyes shifting:
// a nervous glance left and right before it speaks, a look aside on "Lima", wide on "siete días",
// a sceptical squint on "ni dos horas". Eyes around y 700-880; y 230-470 and 960-1180 stay calm.

const FOV = 40;
/** Nubi on the plaza, far in front of the house (which stands at z ≤ 0). */
const N: Vec3 = [-0.4, CURB, 34];
/** Between the eyes (the face's front plane). */
const EYES: Vec3 = [N[0], CURB + 1.1, N[2] + 0.92];
const SIZE = 2;

/** The torch clicks on at LIGHT with one stutter, then holds with a faint flicker. */
const torchOn = (g: number) => {
  const d = g - GANCHO.LIGHT;
  if (d < 0) return 0;
  if (d < 2) return 1;
  if (d < 4) return 0.12;
  return 0.9 + 0.1 * flicker(g, 3, 0.35);
};

export const OjosShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.ojos.from;
  const t = g / 30;
  const { START, END, LIGHT, L01, LIMA, SIETE, DOS } = GANCHO;
  const on = torchOn(g);

  // ---- Camera: a slow push-in on the face, a hint of handheld drift.
  const u = ramp(g, START, END, [0, 1], (x) => x);
  const d = 8.6 - 1.9 * EASE_IN_OUT(u);
  const camPos: Vec3 = [N[0] + 0.35 - 0.45 * u + 0.02 * Math.sin(t * 0.9), CURB + 1.45 + 0.02 * Math.sin(t * 1.3 + 1), EYES[2] + d];
  const cam: Cam = aim(camPos, FOV, EYES, 540, 790, d);

  // ---- Nubi: faces the camera, the torch in its right fin pointing up past its face.
  const glanceL = windowIn(g, LIGHT + 10, LIGHT + 26, 4);
  const glanceR = windowIn(g, LIGHT + 30, L01 + 4, 4);
  const aside = windowIn(g, LIMA - 2, LIMA + 26, 6);
  const wide = windowIn(g, SIETE - 2, SIETE + 44, 5);
  const squint = ramp(g, DOS - 2, DOS + 8);
  const startle = windowIn(g, LIGHT, LIGHT + 8, 2);
  const base: NubiPose = {
    lookX: -0.75 * glanceL + 0.7 * glanceR - 0.55 * aside + 0.25 * squint + 0.06 * Math.sin(t * 0.7),
    lookY: -0.12 + 0.1 * wide - 0.08 * squint,
    eyeScale: 1.05 + 0.2 * wide - 0.24 * squint + 0.08 * startle,
    finR: -0.05 + 0.03 * Math.sin(t * 1.1),
    finL: -0.12 + 0.18 * squint,
    squash: 1 - 0.02 * squint + 0.04 * startle,
    roll: 0.03 * squint,
    pitch: 0.04,
  };
  const pose = matusitaTalk(g, base, 0.5);
  const nubi: NubiAt = { position: N, rotationY: Math.atan2(camPos[0] - N[0], camPos[2] - N[2]), size: SIZE, pose };
  // The torch points up and a little in front of the face (from the fin tip).
  const hold = torchAim(nubi, "R", [0, 0, 0]).grip;
  const torchTarget: Vec3 = [hold[0] - 0.35, hold[1] + 1.2, hold[2] + 0.55];
  const aimed = torchAim(nubi, "R", torchTarget);

  const lamp = lampFlicker(g) * 0.85;
  const black = 1 - ramp(g, LIGHT - 1, LIGHT, [0, 1], (x) => x);

  const set = <MatusitaStreet lamp={lamp} eye={camPos} />;
  return (
    <AbsoluteFill style={{ background: nightSky(0) }}>
      <Stage cam={cam} near={0.2} far={400}>
        <NightFog near={5} far={46} />
        <NightLights k={0.07} rim={0} />
        {/* A cold rim from behind (directional: it shines from this point towards the world origin,
            i.e. from the house's side towards the camera): the silhouette's top and side edges. */}
        <directionalLight position={[-8, 6, -30]} intensity={0.9} color="#8EA4FF" />
        <FaceLight on={on} />
        {set}
        <StreetReflection>
          <MatusitaStreet lamp={lamp} mirror />
          <Nubi size={SIZE} position={N} rotationY={nubi.rotationY} pose={pose} shadow={false} holdR={<HeldTorch nubi={nubi} side="R" target={torchTarget} on={on} mirror />} />
        </StreetReflection>
        <Nubi size={SIZE} position={N} rotationY={nubi.rotationY} pose={pose} shadowOpacity={0.5} holdR={<HeldTorch nubi={nubi} side="R" target={torchTarget} on={on} reach={6} intensity={14} beam={0.2} />}>
          <EyeGlints pose={pose} on={on} />
        </Nubi>
        <Rain t={t} min={[N[0] - 5, 0, N[2] - 6]} size={[10, 7, 12]} count={1300} seed={3} opacity={0.34} px={2.4} lamp={lamp} torch={{ pos: aimed.lens, dir: aimed.dir, on: on * 0.8, angle: 0.3 }} />
        <Splashes t={t} x0={N[0] - 5} x1={N[0] + 5} z0={N[2] - 8} z1={N[2] + 4} count={140} opacity={0.22} lamp={lamp} />
        <Mist t={t} x0={-20} x1={20} z0={6} z1={26} count={10} opacity={0.12} />
      </Stage>
      {/* Vignette: the face is the light. */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 52% at 50% 46%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.8) 100%)" }} />
      {/* The top of Nubi's head falls into darkness (only the under-lit face reads). */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 22%, rgba(0,0,0,0) 38%)" }} />
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </AbsoluteFill>
  );
};

/** The torch's spill on the face: a warm spot from just below and in front of it. */
const FaceLight: React.FC<{ on: number }> = ({ on }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <spotLight position={[N[0] + 0.1, CURB + 0.42, N[2] + 1.3]} target={target} angle={0.8} penumbra={1} intensity={9 * on} distance={2.8} decay={2} color="#FFD49A" />
      <primitive object={target} position={[N[0], CURB + 2.3, N[2] + 0.55]} />
      <pointLight position={[N[0] + 0.9, CURB + 0.6, N[2] + 1.0]} intensity={0.5 * on} distance={1.8} decay={1.5} color="#FFC27A" />
    </>
  );
};

const glintMat = new THREE.MeshBasicMaterial({ color: "#FFF1D6", transparent: true, toneMapped: false, depthWrite: false });
const glintGeo = new THREE.CircleGeometry(1, 16);
/** Little warm catchlights low in each eye (the light comes from below), in Nubi's model units. */
const EyeGlints: React.FC<{ pose: NubiPose; on: number }> = ({ pose, on }) => {
  const eyeScale = pose.eyeScale ?? 1;
  const eyeH = Math.max(0.1, (1 - (pose.blink ?? 0)) * eyeScale);
  if (on < 0.05 || eyeH < 0.4) return null;
  glintMat.opacity = 0.85 * on;
  const ex = (pose.lookX ?? 0) * 0.5;
  const ey = (pose.lookY ?? 0) * 0.4;
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={glintGeo} material={glintMat} position={[side * 2.3 + ex + 0.18, 5.5 + ey - 0.52 * eyeH, 4.73]} scale={[0.17, 0.12 * Math.min(1, eyeH), 1]} />
      ))}
    </>
  );
};
