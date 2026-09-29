import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ramp, windowIn } from "../../anim";
import { Burst } from "../../overlay/Graphics";
import { Countdown5 } from "../../overlay/oxigeno/OxiUI";
import { TitleCanvas, TitleSlam } from "../../overlay/TitleOverlay";
import { SMOOTH, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { BigRedButton } from "../../three/oxigeno/Props";
import { Lab } from "../../three/oxigeno/Sets";
import { Nubi } from "../../three/Nubi";
import { LOOKS } from "../../three/Text3D";
import { INTRO } from "../beats";
import { Outfit } from "../outfit";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";

// "¿Qué pasaría si todo el oxígeno de la Tierra desapareciera… por solo cinco segundos?"
// Nubi the scientist in the lab, one fin hovering mischievously over the big red button.

export const LAB_NUBI: Vec3 = [-1.3, 0, 0.9];
export const LAB_BUTTON: Vec3 = [0.45, 0, 1.0];
export const LAB_NUBI_SIZE = 2.0;
export const LAB_CAM_A = { position: [0.1, 2.7, 12.2] as Vec3, target: [-0.86, 1.35, 0] as Vec3 };
export const LAB_CAM_B = { position: [0.0, 2.5, 11.0] as Vec3, target: [-0.92, 1.2, 0] as Vec3 };

export const OxiIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.intro;
  const g = frame + S.from;
  const { END, OXIGENO, DESAPARECIERA, CINCO } = INTRO;

  const u = ramp(g, S.from, END, [0, 1], SMOOTH);
  const cam = { position: lerp3(LAB_CAM_A.position, LAB_CAM_B.position, u), target: lerp3(LAB_CAM_A.target, LAB_CAM_B.target, u), fov: 42 };

  // Hovers a fin over the button, rubbing "hands", then a sly look to camera on "cinco".
  const hover = windowIn(g, DESAPARECIERA - 6, END + 20, 6);
  const sly = windowIn(g, CINCO - 4, END + 20, 5);
  const pose = oxiTalk(g, {
    finR: 0.35 + hover * (0.55 + 0.12 * Math.sin(g * 0.5)),
    finL: 0.2 + 0.25 * windowIn(g, OXIGENO - 4, DESAPARECIERA, 5),
    yaw: 0.25 * hover * (1 - sly),
    lookX: 0.6 * hover * (1 - sly),
    lookY: -0.3 * hover * (1 - sly),
    eyeScale: 1 - 0.25 * sly,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1D2B64 0%, #2E6BD8 60%, #7FD1FF 100%)" }}>
      <Stage cam={cam}>
        <hemisphereLight args={["#F4F8FF", "#3A3A5A", 1.3]} />
        <directionalLight position={[-5, 9, 8]} intensity={2.4} color="#FFF6E8" />
        <directionalLight position={[6, 4, -4]} intensity={0.9} color="#9FD8FF" />
        <Lab t={g / 30} alarm={0} />
        <group position={LAB_BUTTON} rotation={[0, -0.35, 0]}>
          <BigRedButton press={0} glow={0.4 + 0.3 * Math.sin(g * 0.2)} />
        </group>
        <group position={LAB_NUBI} rotation={[0, 0.25, 0]}>
          <Nubi size={LAB_NUBI_SIZE} pose={pose} shadowOpacity={0.4}>
            <Outfit kind="scientist" />
          </Nubi>
        </group>
      </Stage>
      <TitleCanvas>
        <TitleSlam
          frame={g}
          at={-16}
          out={CINCO - 16}
          exit="up"
          lines={[
            { text: "¿Y SI DESAPARECE", size: 0.46, look: LOOKS.white, y: 4.3, delay: 0 },
            { text: "EL OXÍGENO", size: 0.68, look: LOOKS.cyan, y: 3.35, delay: 4 },
            { text: "POR 5 SEGUNDOS?", size: 0.5, look: LOOKS.red, y: 2.45, delay: 8 },
          ]}
        />
      </TitleCanvas>
      <Burst frame={g} at={CINCO} x={540} y={520} color="#FF4B3E" size={640} />
      <Countdown5 frame={g} at={CINCO} x={540} y={520} />
    </AbsoluteFill>
  );
};
