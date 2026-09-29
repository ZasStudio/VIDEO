import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, pop, ramp, windowIn } from "../../anim";
import { Flash } from "../../overlay/Graphics";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { TRex } from "../../three/dino/Dinos";
import { RoadSign } from "../../three/dino/Props";
import { CityStreet } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { CIUDAD } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO } from "../timeline";

// Nubi the tourist in a city of the dinosaur age: "Las ciudades tendrían muros gigantes y
// parques con seguridad extrema…" A T-Rex stomps down the street, blocking it. "…y señales de
// «No alimentar al T-Rex»." The sign pops up; the T-Rex sniffs it; Nubi snaps a photo.

const NUBI_AT: Vec3 = [-1.0, 0, 4.0];
const SIGN_AT: Vec3 = [1.9, 0, 2.6];
const CAM_A = { position: [0.2, 2.6, 14.6] as Vec3, target: [0.0, 4.4, -20] as Vec3 };
const CAM_B = { position: [0.1, 2.4, 13.4] as Vec3, target: [0.0, 4.2, -20] as Vec3 };

export const DinoCiudad: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.ciudad;
  const g = frame + S.from;
  const t = g / 30;
  const { END, MUROS, SENALES, TREX } = CIUDAD;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const lookWall = windowIn(g, MUROS - 6, SENALES - 10, 10);
  const cam = {
    position: lerp3(CAM_A.position, CAM_B.position, u),
    target: [0, 4.3 + lookWall * 5, -20] as Vec3,
    fov: 50,
  };

  // The T-Rex strolls up the street, then leans down to sniff the sign.
  const walkIn = ramp(g, S.from, SENALES, [0, 1], (x) => x);
  const sniff = ramp(g, SENALES + 10, TREX + 4, [0, 1], EASE_IN_OUT);
  const rexPos: Vec3 = [0.8, 0, -12 + walkIn * 8];
  const rexPose = {
    walk: 1 - ramp(g, SENALES - 6, SENALES + 4),
    walkPhase: g * 0.16,
    neck: sniff * 0.8,
    headYaw: sniff * 0.35,
    headPitch: sniff * 0.3,
    jaw: 0.15 + 0.1 * Math.sin(g * 0.1),
    tail: Math.sin(g * 0.07) * 0.4,
    blink: g % 83 < 3 ? 1 : 0,
    armsWave: sniff * Math.sin(g * 0.5) * 0.4,
  };

  const signK = pop(g, SENALES, { damping: 9, stiffness: 180 });
  const photo = windowIn(g, TREX - 10, END + 20, 5);
  const pose = dinoTalk(g, {
    finR: photo * 1.0,
    finL: windowIn(g, SENALES, TREX - 10, 5) * 0.9,
    lookX: 0.35,
    lookY: 0.55 + lookWall * 0.3,
    eyeScale: 1.1 + windowIn(g, MUROS - 4, MUROS + 20, 5) * 0.3,
    yaw: -0.2,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #3FA9FF 0%, #8FD3FF 60%, #DFF4FF 100%)" }}>
      <Shake frame={g} impacts={[{ at: S.from + 20, amp: 8, dur: 10 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#FFFFFF", "#7F8FA8", 1.3]} />
          <directionalLight position={[-6, 12, 8]} intensity={2.4} color="#FFF6E8" />
          <CityStreet t={t} />
          <TRex size={0.95} position={rexPos} rotationY={0.1} pose={rexPose} />
          <DustPuff frame={g} at={S.from + 20} position={[rexPos[0] - 0.8, 0, rexPos[2] + 1]} radius={1.6} />
          {signK > 0.01 ? (
            <group position={SIGN_AT} rotation={[0, -0.35, 0]} scale={Math.max(0.001, signK)}>
              <RoadSign text="NO ALIMENTAR AL T-REX" />
            </group>
          ) : null}
          <group position={NUBI_AT} rotation={[0, 0.35, 0]}>
            <Nubi size={2} pose={pose} shadowOpacity={0.4}>
              <Outfit kind="tourist" />
            </Nubi>
          </group>
        </Stage>
      </Shake>
      <Flash frame={g} at={TREX + 6} dur={8} peak={0.8} />
    </AbsoluteFill>
  );
};
