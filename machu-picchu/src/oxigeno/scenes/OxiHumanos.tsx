import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { Card } from "../../overlay/Graphics";
import { NoO2Badge, PressurePop, StatusCard } from "../../overlay/oxigeno/OxiUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Island } from "../../three/Island";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { HUMANOS } from "../beats";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";

// Back to plain Nubi: a huge dramatic gasp, puffed up and holding its breath. "¿Y nosotros?
// Tranquilo: tu sangre guarda oxígeno para varios minutos." It relaxes. "Eso sí, tus oídos
// harían ¡pop!…" — POP! — "…porque el aire perdería de golpe parte de su presión."

const NUBI_AT: Vec3 = [0, 0, 1.2];
const CAM_A = { position: [0.2, 3.4, 12.8] as Vec3, target: [0.05, 1.25, 0] as Vec3 };
const CAM_B = { position: [0.1, 3.0, 11.2] as Vec3, target: [0.05, 1.2, 0] as Vec3 };

export const OxiHumanos: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.humanos;
  const g = frame + S.from;
  const { END, TRANQUILO, SANGRE, POP, GOLPE } = HUMANOS;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 40 };

  // Gasp and hold (puffed up, eyes wide, trembling) until "tranquilo", then deflates.
  const hold = windowIn(g, S.from + 2, TRANQUILO + 2, 5);
  const relief = ramp(g, TRANQUILO + 2, TRANQUILO + 14, [0, 1], EASE_OUT) * (1 - windowIn(g, POP - 2, POP + 16, 2));
  const dp = g - POP;
  const popK = dp >= 0 && dp < 18 ? Math.exp(-dp / 5) : 0;
  const pose = oxiTalk(g, {
    squash: 1 + hold * (0.16 + 0.02 * Math.sin(g * 1.7)) - relief * 0.03 + (dp >= 0 && dp < 10 ? 0.15 * Math.sin(dp * 0.9) * Math.exp(-dp / 4) : 0),
    eyeScale: 1 + hold * 0.4 + popK * 0.7,
    finL: hold * 0.7 + relief * 0.25 + popK * 1.1,
    finR: hold * 0.7 + relief * 0.25 + popK * 1.1,
    hop: popK * 4,
    roll: hold * 0.04 * Math.sin(g * 2.3),
    lookY: popK * 0.4,
  });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 36%, #9FD8FF 0%, #5B7CFF 34%, #6A3DE8 64%, #1B0F4A 100%)" }}>
      <AbsoluteFill style={{ background: `repeating-conic-gradient(from ${g * 0.25}deg at 50% 36%, rgba(255,255,255,0.08) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)` }} />
      <Shake frame={g} impacts={[{ at: S.from + 2, amp: 10, dur: 10 }, { at: POP, amp: 24, dur: 16 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#F3F6FF", "#3A2A7A", 1.35]} />
          <directionalLight position={[-6, 12, 10]} intensity={2.5} color="#FFF6E8" />
          <directionalLight position={[9, 4, -6]} intensity={1.1} color="#FF9AD5" />
          <group position={[0, -0.02, 0]}>
            <Island radius={4.4} />
          </group>
          <group position={NUBI_AT}>
            <Nubi size={2.4} pose={pose} shadowOpacity={0.4} />
          </group>
          <SweatDrops frame={g} from={S.from + 8} to={TRANQUILO} position={[NUBI_AT[0], 2.0, NUBI_AT[2] + 0.2]} spread={0.9} />
          <Twinkles frame={g} at={POP} position={[NUBI_AT[0], 2.0, NUBI_AT[2]]} radius={1.8} count={12} />
        </Stage>
        <StatusCard frame={g} at={SANGRE} out={POP - 6} x={540} y={430} icon="lungs" title="SANGRE Y PULMONES" sub="OXÍGENO PARA MINUTOS" tone="blue" />
        <PressurePop frame={g} at={POP} x={540} y={640} />
        <Card frame={g} at={GOLPE} out={END + 20} x={540} y={430} title="PRESIÓN −21 %" sub="COMO DESPEGAR EN AVIÓN" rotate={-4} gradient="linear-gradient(135deg, #FFB03A 0%, #FF6A00 100%)" />
      </Shake>
      <NoO2Badge frame={g} from={S.from} to={END + 10} x={900} y={200} />
    </AbsoluteFill>
  );
};
