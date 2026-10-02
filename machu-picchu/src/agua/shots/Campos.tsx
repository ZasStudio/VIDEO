import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp } from "../../anim";
import { Stage, pathCam } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { FARM_HAZE, FarmLights, Farmland } from "../../three/agua/Outdoors";
import { PROBLEMA } from "../beats";
import { SHOTS } from "../shots";

// Shot 7, "Sin agua, los cultivos se perderían…": a fast drone time-lapse over the fields. The
// camera sweeps round and down over the four plots while they wither (wilt 0 → 1): crops droop
// and yellow then brown, the channels drain, the soil cracks; cloud shadows race and the sun
// crosses the sky. No Nubi. The lead's fact card sits at y 240-500 (sky / far hills there).

const SKY_GREEN = `linear-gradient(180deg, #2F86DD 0%, #69B4EE 20%, #BFE1F2 30%, ${FARM_HAZE} 36%, ${FARM_HAZE} 100%)`;
const SKY_DRY = "linear-gradient(180deg, #4F8FD0 0%, #9CC3DE 20%, #EBD9B0 30%, #F0DCAE 36%, #F0DCAE 100%)";

export const CamposShot: React.FC = () => {
  const frame = useCurrentFrame();
  const S = SHOTS.campos;
  const g = frame + S.from;
  const t = g / 30;
  const { L06 } = PROBLEMA;
  const wilt = ramp(g, L06 + 6, S.to - 8, [0, 1], EASE_IN_OUT);
  const u = ramp(g, S.from, S.to, [0, 1], (x) => x);
  const path = pathCam([
    [74, 40, 58],
    [52, 33, 72],
    [24, 27, 78],
    [-6, 24, 76],
  ]);
  const look = pathCam([
    [6, 0, -4],
    [2, 0, 0],
    [-2, 0, 2],
    [-6, 0, 2],
  ]);
  const position: Vec3 = path(u);
  const target: Vec3 = look(u);
  // Time-lapse clock for the clouds and the windmill (the voice-over keeps real time).
  const lapse = t * 7;
  return (
    <AbsoluteFill style={{ background: SKY_GREEN }}>
      <AbsoluteFill style={{ background: SKY_DRY, opacity: wilt }} />
      <Stage cam={{ position, target, fov: 50, roll: -0.04 + 0.05 * u }} near={0.5} far={900}>
        <FarmLights sun={0.12 + 0.76 * u} />
        <Farmland wilt={wilt} t={lapse} fog={[80, 380]} />
      </Stage>
      {/* Warm, dusty grade creeping in as it dries. */}
      <AbsoluteFill style={{ background: "rgba(255,170,70,0.12)", mixBlendMode: "multiply", opacity: wilt }} />
    </AbsoluteFill>
  );
};
