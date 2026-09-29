import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Burst } from "../../overlay/Graphics";
import { MenuCard, RoarWaves } from "../../overlay/dino/DinoUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { TRex } from "../../three/dino/Dinos";
import { BONE_THRONE_SEAT, BoneThrone } from "../../three/dino/Props";
import { PrehistoricValley } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { REY } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO, DINO_HEIGHT, DINO_WIDTH } from "../timeline";

// Nubi as the dinosaur king on a throne of bones, a T-Rex guard behind: "En este mundo, los
// dinosaurios mandarían…" ROAAAR! "…y nosotros seríamos el snack." — the menu of the day.

const THRONE_AT: Vec3 = [0, 0, 1.0];
const CAM_A = { position: [0.3, 2.8, 12.6] as Vec3, target: [0.0, 2.3, 0] as Vec3 };
const CAM_B = { position: [0.2, 2.5, 10.6] as Vec3, target: [0.0, 2.2, 0] as Vec3 };

export const DinoRey: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.rey;
  const g = frame + S.from;
  const t = g / 30;
  const { END, ROAR, SNACK } = REY;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 42 };
  const roar = windowIn(g, ROAR - 3, ROAR + 22, 4);
  const nervous = ramp(g, ROAR + 26, SNACK, [0, 1], EASE_IN_OUT);
  const seat: Vec3 = [THRONE_AT[0] + BONE_THRONE_SEAT[0], THRONE_AT[1] + BONE_THRONE_SEAT[1], THRONE_AT[2] + BONE_THRONE_SEAT[2]];
  const pose = dinoTalk(g, {
    finL: 0.3 + roar * 0.9,
    finR: 0.3 + roar * 0.9 - nervous * 0.3,
    squash: 1 + roar * 0.1,
    eyeScale: 1 + roar * 0.25 + nervous * 0.3,
    lookX: nervous * 0.5,
    pitch: -roar * 0.15,
  });
  const mouth = projectToScreen(cam, [seat[0], seat[1] + 1.6, seat[2]], DINO_WIDTH, DINO_HEIGHT);

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #3B0F1F 0%, #9C2A2A 40%, #FF7A3D 80%, #FFC46B 100%)" }}>
      <Shake frame={g} impacts={[{ at: S.from + 2, amp: 6, dur: 10 }, { at: ROAR, amp: 28, dur: 22 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#FFE1C8", "#4A1A2A", 1.2]} />
          <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFD9B0" />
          <directionalLight position={[6, 3, -6]} intensity={1.2} color="#FF6A3D" />
          <PrehistoricValley t={t} />
          <TRex
            size={0.75}
            position={[2.4, 0, -2.2]}
            rotationY={-0.4}
            pose={{ roar: roar, jaw: 0.1 + roar * 0.9, tail: Math.sin(g * 0.06) * 0.4, blink: g % 90 < 3 ? 1 : 0, headYaw: -0.3 }}
          />
          <group position={THRONE_AT}>
            <BoneThrone />
          </group>
          <group position={seat}>
            <Nubi size={2} pose={pose} shadow={false}>
              <Outfit kind="king" roar={roar} />
            </Nubi>
          </group>
          <Twinkles frame={g} at={S.from + 2} position={[seat[0], seat[1] + 2.2, seat[2]]} radius={1.4} count={12} color="#FFE27A" />
          <SweatDrops frame={g} from={ROAR + 30} to={END} position={[seat[0], seat[1] + 2.0, seat[2] + 0.2]} spread={0.8} />
        </Stage>
        <Burst frame={g} at={ROAR} x={500} y={mouth.y} color="#FF4B3E" size={700} />
        <RoarWaves frame={g} at={ROAR} x={500} y={Math.max(420, mouth.y - 80)} />
        <MenuCard frame={g} at={SNACK - 22} out={END + 20} x={500} y={640} stampAt={SNACK + 8} scale={0.85} />
      </Shake>
    </AbsoluteFill>
  );
};
