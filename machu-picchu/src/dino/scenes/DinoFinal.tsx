import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Flash } from "../../overlay/Graphics";
import { ChaseVignette, DinoCTA } from "../../overlay/dino/DinoUI";
import { SelfieUI } from "../../overlay/inca/PhoneUI";
import { Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { TRex } from "../../three/dino/Dinos";
import { PrehistoricValley } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { FINAL } from "../beats";
import { dinoTalk } from "../talk";
import { DINO } from "../timeline";

// First person through Nubi's own phone (front camera), running flat out with a T-Rex right
// behind: "Sería increíble… ¡pero prefiero verlos desde una pantalla!" The T-Rex grabs the
// phone… and takes a photo with Nubi, who poses on a rock. "¿Tú tendrías un dinosaurio de
// mascota? ¡Te leo en los comentarios!"

// The photo: framed low, under the question, with Nubi's face just above the captions.
const ROCK_AT: Vec3 = [-0.7, 0, 0.2];
const ROCK_H = 0.6;
const REX_AT: Vec3 = [1.4, 0, 3.4];
const PHOTO_CAM = { position: [0.3, 2.1, -9.5] as Vec3, target: [-0.983, 3.475, 6] as Vec3, fov: 54, roll: 0.03 };

export const DinoFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.final;
  const g = frame + S.from;
  const t = g / 30;
  const { END, GRAB, CTA } = FINAL;
  const chase = g < GRAB;

  // Running: Nubi and the camera stay put while the valley streams past towards +z.
  const run = (g - S.from) * 0.12;
  const bob = Math.abs(Math.sin(g * 0.45));
  // A wide-angle front camera at arm's length: Nubi's face mid-frame, the jaws right behind it.
  const cam = chase
    ? { position: [0.25, 1.56 + bob * 0.06, -5.4] as Vec3, target: [0.05, 1.56, 6] as Vec3, fov: 60, roll: Math.sin(g * 0.3) * 0.04 }
    : PHOTO_CAM;
  const rexGain = ramp(g, S.from, GRAB, [0, 1], EASE_IN_OUT);
  const rexZ = 5.6 - rexGain * 1.0;

  const pose = chase
    ? dinoTalk(g, {
        hop: bob * 1.2,
        wiggle: 1,
        wigglePhase: g * 1.3,
        finL: 0.3 + 0.6 * Math.sin(g * 0.45),
        finR: 0.9,
        eyeScale: 1.35,
        lookX: 0.1,
        lookY: 0.1,
        pitch: -0.1,
      })
    : dinoTalk(g, {
        finL: 1.0 + 0.1 * Math.sin(g * 0.5),
        finR: 0.35 + 0.65 * ramp(g, GRAB + 2, GRAB + 8),
        eyeScale: 1.15 + 0.25 * Math.exp(-(g - GRAB) / 8),
        lookX: 0.1,
        lookY: 0.1,
        hop: windowIn(g, CTA, END + 20, 5) * Math.abs(Math.sin(g * 0.3)) * 0.5,
      });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #FF9A5A 0%, #FFC97A 45%, #FFE9B0 100%)" }}>
      <Stage cam={cam} near={0.05}>
        <hemisphereLight args={["#FFF1D6", "#5A7A3A", 1.3]} />
        <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#FFE8C8" />
        <group position={[0, 0, chase ? run : Math.min(run, (GRAB - S.from) * 0.12)]}>
          <PrehistoricValley t={t} />
        </group>
        {chase ? (
          <>
            <group position={[0, 0, 0]} rotation={[0, Math.PI, 0]}>
              <Nubi size={2} pose={pose} shadowOpacity={0.4} />
            </group>
            <TRex
              size={0.8}
              position={[0.5, 0, rexZ]}
              rotationY={Math.PI}
              pose={{ walk: 1, walkPhase: g * 0.35, jaw: 0.55 + 0.3 * Math.sin(g * 0.3), lean: 0.6, neck: 0.7, armsWave: Math.sin(g * 0.6) }}
            />
            <SweatDrops frame={g} from={S.from} to={GRAB} position={[0, 2.0, 0]} spread={0.8} />
          </>
        ) : (
          <>
            {/* The T-Rex has the phone now: it bends down next to Nubi, grinning for the photo. */}
            <TRex
              size={0.8}
              position={REX_AT}
              rotationY={Math.PI + 0.25}
              pose={{ jaw: 0.3, neck: 1, lean: 1, headPitch: -0.2, headYaw: -0.15, tail: Math.sin(g * 0.12) * 0.6, armsWave: 0.6 + 0.2 * Math.sin(g * 0.4), blink: g % 70 < 3 ? 1 : 0 }}
            />
            <mesh position={[ROCK_AT[0], ROCK_H / 2 - 0.02, ROCK_AT[2]]} castShadow receiveShadow>
              <cylinderGeometry args={[1.05, 1.3, ROCK_H, 9]} />
              <meshStandardMaterial color="#8A7F72" roughness={0.9} flatShading emissive="#8A7F72" emissiveIntensity={0.08} />
            </mesh>
            <group position={[ROCK_AT[0], ROCK_H, ROCK_AT[2]]} rotation={[0, Math.PI + 0.15, 0]}>
              <Nubi size={2} pose={pose} shadowOpacity={0.4} />
            </group>
          </>
        )}
      </Stage>
      {/* The phone view ends with the photo; then the question takes the screen. */}
      <SelfieUI frame={g} at={S.from} out={GRAB + 18} recStart={S.from} flashAt={GRAB + 10} />
      {chase ? <ChaseVignette frame={g} from={S.from} to={GRAB} /> : null}
      <Flash frame={g} at={GRAB} dur={6} peak={0.6} />
      <DinoCTA frame={g} at={CTA} x={500} y={525} scale={0.8} />
    </AbsoluteFill>
  );
};
