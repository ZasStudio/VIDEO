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
// phone… and takes a selfie with Nubi. "¿Tú tendrías un dinosaurio de mascota? ¡Te leo en los
// comentarios!"

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
  const cam = chase
    ? { position: [0.3, 1.9 + bob * 0.08, -3.2] as Vec3, target: [0.0, 1.5, 6] as Vec3, fov: 55, roll: Math.sin(g * 0.3) * 0.04 }
    : { position: [0.9, 2.6, -2.2] as Vec3, target: [0.0, 2.4, 6] as Vec3, fov: 52, roll: 0.03 };
  const rexGain = ramp(g, S.from, GRAB, [0, 1], EASE_IN_OUT);
  const rexZ = 5.2 - rexGain * 2.4;

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
    : dinoTalk(g, { finL: 0.9 + 0.1 * Math.sin(g * 0.5), finR: 0.5, eyeScale: 1.1, lookX: -0.2, hop: windowIn(g, CTA, END + 20, 5) * Math.abs(Math.sin(g * 0.3)) * 0.6 });

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
              position={[0.4, 0, rexZ]}
              rotationY={Math.PI}
              pose={{ walk: 1, walkPhase: g * 0.35, jaw: 0.5 + 0.3 * Math.sin(g * 0.3), lean: 0.4, neck: 0.3, armsWave: Math.sin(g * 0.6) }}
            />
            <SweatDrops frame={g} from={S.from} to={GRAB} position={[0, 2.0, 0]} spread={0.8} />
          </>
        ) : (
          <>
            {/* The T-Rex holds the phone now: its big grinning face fills the selfie, Nubi beside it. */}
            <TRex size={0.8} position={[0.6, 0, 4.2]} rotationY={Math.PI - 0.2} pose={{ jaw: 0.55, neck: 0.55, headPitch: -0.1, headYaw: 0.2, blink: g % 70 < 3 ? 1 : 0 }} />
            <group position={[-1.2, 0, 3.0]} rotation={[0, Math.PI - 0.3, 0]}>
              <Nubi size={2} pose={pose} shadowOpacity={0.4} />
            </group>
          </>
        )}
      </Stage>
      <SelfieUI frame={g} at={S.from} out={END + 20} recStart={S.from} flashAt={GRAB + 10} />
      {chase ? <ChaseVignette frame={g} from={S.from} to={GRAB} /> : null}
      <Flash frame={g} at={GRAB} dur={6} peak={0.6} />
      <DinoCTA frame={g} at={CTA} x={500} y={760} />
    </AbsoluteFill>
  );
};
