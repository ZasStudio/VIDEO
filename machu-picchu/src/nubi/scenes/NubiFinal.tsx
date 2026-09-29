import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { Burst, Confetti, Flash } from "../../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../../overlay/TitleOverlay";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Nubi } from "../../three/Nubi";
import { LOOKS } from "../../three/Text3D";
import { Atmosphere, World } from "../../three/World";
import { nubiTalk } from "../talk";
import { NUBI } from "../timeline";
import { NUBI_SIZE, NUBI_SPOT, NUBI_YAW } from "./NubiHook";

// Golden hour: "¡Por eso sigue en pie!" Nubi jumps on "sigue", where the music hits.

const CAM_A = { position: [3.8, 2.4, 33.5] as Vec3, target: [2.1, -0.2, 0] as Vec3 };
const CAM_B = { position: [3.75, 2.3, 32.2] as Vec3, target: [2.1, -0.1, 0] as Vec3 };

export const NubiFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const S = NUBI.SCENES.final;
  const g = frame + S.from;
  const END = S.from + S.duration;
  const POR = NUBI.wordAt("L04", 0);
  const HIT = NUBI.hitFrame;
  const EN = NUBI.wordAt("L04", 3);

  const u = ramp(g, S.from, END, [0, 1], SMOOTH);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 45 };

  const JUMP = 16;
  const inJump = g >= HIT && g < HIT + JUMP;
  const jump = inJump ? Math.sin(((g - HIT) / JUMP) * Math.PI) : 0;
  const wave = windowIn(g, HIT + JUMP, END + 20, 6);
  const pose = inJump
    ? { hop: jump * 14, squash: 1.1, finL: 1.3, finR: 1.3, eyeScale: 1.3 }
    : nubiTalk(g, {
        finR: wave * (1.1 + 0.35 * Math.sin((g - HIT) * 0.55)),
        finL: wave * 0.4,
        hop: wave * Math.abs(Math.sin((g - HIT) * 0.28)) * 0.8,
        eyeScale: 1 + wave * 0.15,
        lookY: 0.15,
      });

  return (
    <AbsoluteFill>
      <Shake frame={g} impacts={[{ at: S.from, amp: 10, dur: 12 }, { at: HIT, amp: 22, dur: 18 }]}>
        <AbsoluteFill style={{ filter: "saturate(1.25) contrast(1.06) brightness(1.08)" }}>
          <Stage cam={cam}>
            <Atmosphere variant="golden" sunPos={[-120, 55, 70]} fogNear={130} fogFar={620} />
            <World frame={g} variant="golden" />
            <group position={NUBI_SPOT} rotation={[0, NUBI_YAW, 0]}>
              <Nubi size={NUBI_SIZE} pose={pose} shadowOpacity={0.45} />
            </group>
            <Twinkles frame={g} at={HIT} position={[NUBI_SPOT[0], 2.6, NUBI_SPOT[2]]} radius={2.4} count={14} color="#FFF3A0" />
          </Stage>
        </AbsoluteFill>
        <Burst frame={g} at={HIT} x={540} y={560} color="#FFD60A" size={700} />
        <TitleCanvas>
          <TitleSlam
            frame={g}
            at={POR + 2}
            out={END + 30}
            lines={[
              { text: "¡POR ESO", size: 0.7, look: LOOKS.white, y: 4.0 },
              { text: "SIGUE", size: 1.35, look: LOOKS.gold, y: 2.7, delay: HIT - POR - 2 },
              { text: "EN PIE!", size: 1.1, look: LOOKS.gold, y: 1.4, delay: EN - POR },
            ]}
          />
        </TitleCanvas>
        <Confetti frame={g} at={HIT} count={130} />
      </Shake>
      <Flash frame={g} at={HIT} dur={8} peak={0.65} />
      <Flash frame={g} at={S.from} dur={8} peak={0.7} />
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(255,140,60,0) 45%, rgba(255,120,60,0.2) 100%)",
          opacity: ramp(g, S.from, S.from + 30, [0, 1], EASE_OUT),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
