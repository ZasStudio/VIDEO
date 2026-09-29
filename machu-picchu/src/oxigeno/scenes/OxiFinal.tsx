import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { ExperimentCTA, O2Gauge } from "../../overlay/oxigeno/OxiUI";
import { Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { OxygenTank } from "../../three/oxigeno/Props";
import { Lab } from "../../three/oxigeno/Sets";
import { Nubi } from "../../three/Nubi";
import { FINAL } from "../beats";
import { Outfit } from "../outfit";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";

// "Cinco segundos sin oxígeno no destruyen el mundo…" Nubi hugs an oxygen tank, the gauge
// back at 21 %. "…pero sí lo dejan en silencio." The lab dims and hushes. Then: "¿Qué otro
// experimento imposible hago? ¡Te leo en los comentarios!"

const NUBI_AT: Vec3 = [-0.5, 0, 0.9];
const TANK_AT: Vec3 = [-0.5, 0, 1.75];
const CAM_A = { position: [0.3, 2.3, 9.2] as Vec3, target: [0.0, 1.2, 0] as Vec3 };
const CAM_B = { position: [0.2, 2.6, 10.6] as Vec3, target: [0.2, 1.1, 0] as Vec3 };

export const OxiFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.final;
  const g = frame + S.from;
  const { END, PERO, L10_END, CTA_START, TE } = FINAL;

  const u = ramp(g, CTA_START - 10, CTA_START + 20, [0, 1], EASE_IN_OUT);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 42 };
  const hush = windowIn(g, PERO - 2, L10_END + 6, 8);
  const hug = 1 - ramp(g, CTA_START - 6, CTA_START + 6);
  const point = ramp(g, TE - 6, TE + 4, [0, 1], EASE_IN_OUT);
  const pose = oxiTalk(g, {
    finL: hug * -0.15 + point * 0.2,
    finR: hug * -0.15 + point * (0.9 + 0.1 * Math.sin((g - TE) * 0.7)),
    squash: 1 + hug * 0.03 * Math.sin(g * 0.2),
    eyeScale: 1 - hush * 0.35 + point * 0.15,
    lookX: point * 0.6,
    yaw: point * 0.3,
    hop: point * Math.abs(Math.sin((g - TE) * 0.3)) * 0.8,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1D2B64 0%, #2E6BD8 60%, #7FD1FF 100%)" }}>
      <Stage cam={cam}>
        <hemisphereLight args={["#F4F8FF", "#3A3A5A", 1.35 - hush * 0.6]} />
        <directionalLight position={[-5, 9, 8]} intensity={2.4 - hush * 1.2} color="#FFF6E8" />
        <Lab t={g * (1 - hush)} alarm={0} />
        <group position={NUBI_AT} rotation={[0, 0.2, 0]}>
          <Nubi size={2.0} pose={pose} shadowOpacity={0.4}>
            <Outfit kind="scientist" />
          </Nubi>
        </group>
        {hug > 0.01 ? (
          <group position={TANK_AT} scale={hug}>
            <OxygenTank />
          </group>
        ) : null}
        <Twinkles frame={g} at={S.from + 2} position={[TANK_AT[0], 1.2, TANK_AT[2]]} radius={1.2} count={12} color="#9FF3FF" />
      </Stage>
      <O2Gauge frame={g} at={S.from + 2} out={PERO - 4} x={780} y={430} scale={0.6} from={21} to={21} dropAt={-100} dropDur={1} />
      <AbsoluteFill style={{ background: "#050A20", opacity: hush * 0.35, pointerEvents: "none" }} />
      <ExperimentCTA frame={g} at={CTA_START - 4} x={580} y={620} />
    </AbsoluteFill>
  );
};
