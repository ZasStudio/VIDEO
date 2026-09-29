import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_OUT, ramp, windowIn } from "../../anim";
import { Card, Flash } from "../../overlay/Graphics";
import { AlarmOverlay, O2Gauge } from "../../overlay/oxigeno/OxiUI";
import { Shake, Stage } from "../../scenes/common";
import { lerp3 } from "../../three/CameraRig";
import { BigRedButton } from "../../three/oxigeno/Props";
import { Lab } from "../../three/oxigeno/Sets";
import { Nubi } from "../../three/Nubi";
import { BOTON } from "../beats";
import { Outfit } from "../outfit";
import { SPEAKER } from "../timeline";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";
import { LAB_BUTTON, LAB_CAM_B, LAB_NUBI, LAB_NUBI_SIZE } from "./OxiIntro";

// Press! The air is sucked out of the lab, the alarm wails, the O₂ gauge drops to 0 %.
// "No, no te convertirías en polvo. Pero mira esto."

export const OxiBoton: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.boton;
  const g = frame + S.from;
  const { END, PRESS, ALARM, CERO, POLVO, MIRA } = BOTON;

  const wind = ramp(g, S.from, PRESS, [0, 1], EASE_IN);
  const press = g < PRESS ? 0 : Math.max(0, 1 - Math.max(0, g - PRESS - 6) / 8);
  const suck = windowIn(g, PRESS, PRESS + 22, 3);
  const push = ramp(g, MIRA - 4, END, [0, 1], EASE_OUT);
  const cam = {
    position: lerp3(LAB_CAM_B.position, [-0.3, 2.3, 9.2], push),
    target: lerp3(LAB_CAM_B.target, [-1.14, 0.99, 0], push),
    fov: 42,
  };
  const alarm = SPEAKER.sistema.voiceLevel(g);

  // Winds up and slams the button with the right fin, stretched by the suction, then calm.
  const pose = oxiTalk(g, {
    finR: g < PRESS ? 0.35 + wind * 0.9 : Math.max(-0.2, 1.25 - (g - PRESS) * 0.25),
    finL: suck * 0.9,
    squash: 1 + suck * 0.12 * Math.sin((g - PRESS) * 0.9),
    wiggle: suck,
    wigglePhase: g * 1.4,
    yaw: g < PRESS + 6 ? 0.35 : 0.1 * (1 - push),
    lookX: g < PRESS + 6 ? 0.6 : 0,
    eyeScale: 1 + suck * 0.5 + windowIn(g, ALARM, CERO + 12, 4) * 0.2,
    lookY: windowIn(g, ALARM, CERO + 10, 4) * 0.5,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1D2B64 0%, #2E6BD8 60%, #7FD1FF 100%)" }}>
      <Shake frame={g} impacts={[{ at: PRESS, amp: 26, dur: 22 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#F4F8FF", "#3A3A5A", 1.3 - 0.35 * Math.min(1, alarm + (g > PRESS ? 0.3 : 0))]} />
          <directionalLight position={[-5, 9, 8]} intensity={2.4} color="#FFF6E8" />
          <pointLight position={[0, 4, 3]} intensity={g > PRESS ? 6 + 6 * Math.sin(g * 0.5) : 0} color="#FF2D2D" distance={14} />
          <Lab t={g / 30} alarm={g > PRESS ? 1 : 0} />
          <group position={LAB_BUTTON} rotation={[0, -0.35, 0]}>
            <BigRedButton press={press} glow={g < PRESS ? 0.8 : 0.3} />
          </group>
          <group position={LAB_NUBI} rotation={[0, 0.25, 0]}>
            <Nubi size={LAB_NUBI_SIZE} pose={pose} shadowOpacity={0.4}>
              <Outfit kind="scientist" />
            </Nubi>
          </group>
        </Stage>
        <O2Gauge frame={g} at={PRESS + 3} out={END + 10} x={560} y={600} scale={0.72} dropAt={PRESS + 6} dropDur={CERO - PRESS - 6} />
        <Card frame={g} at={POLVO} out={MIRA - 2} x={540} y={930} title="¡MITO!" sub="NO TE HACES POLVO" rotate={-4} gradient="linear-gradient(135deg, #FF6A3D 0%, #E0322B 60%, #A3161B 100%)" />
      </Shake>
      <AlarmOverlay frame={g} from={PRESS + 4} to={END + 30} />
      <Flash frame={g} at={PRESS} dur={7} peak={0.55} color="#FFE3E3" />
    </AbsoluteFill>
  );
};
