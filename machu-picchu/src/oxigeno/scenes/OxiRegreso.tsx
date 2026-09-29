import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Burst, Confetti, Flash } from "../../overlay/Graphics";
import { O2Gauge } from "../../overlay/oxigeno/OxiUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Candle, Match } from "../../three/oxigeno/Props";
import { Lab } from "../../three/oxigeno/Sets";
import { Nubi } from "../../three/Nubi";
import { Upright } from "../../inca/outfit";
import { REGRESO } from "../beats";
import { Outfit } from "../outfit";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";

// POP: the oxygen is back and the gauge climbs to 21 %. "Y cuando el oxígeno volviera… nada
// se encendería solo." Nubi stares at a candle: nothing. "¡Habría que prender todo otra vez!"
// A first match fails, the second one lights, and the candle is lit again.

const NUBI_AT: Vec3 = [-0.6, 0, 1.0];
const CANDLE_AT: Vec3 = [0.75, 0, 1.4];
const CAM_A = { position: [0.4, 2.2, 8.4] as Vec3, target: [0.1, 1.2, 0] as Vec3 };
const CAM_B = { position: [0.3, 2.0, 7.4] as Vec3, target: [0.1, 1.15, 0] as Vec3 };

export const OxiRegreso: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.regreso;
  const g = frame + S.from;
  const { END, BACK, NADA, HABRIA, STRIKE1, STRIKE2, LIT } = REGRESO;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 42 };

  const joy = windowIn(g, BACK, BACK + 26, 4);
  const wait = windowIn(g, NADA - 8, HABRIA - 2, 6);
  const strike = (at: number) => (g >= at - 6 && g < at + 6 ? Math.sin(((g - at + 6) / 12) * Math.PI) : 0);
  const matchOn = g >= STRIKE2 - 6 && g < LIT + 30 ? 1 : 0;
  const matchFlame = ramp(g, STRIKE2, STRIKE2 + 3) * (1 - ramp(g, LIT + 20, LIT + 28));
  const candle = ramp(g, LIT, LIT + 5);
  const happy = windowIn(g, LIT, END + 20, 5);
  const pose = oxiTalk(g, {
    hop: joy * Math.abs(Math.sin((g - BACK) * 0.4)) * 2 + happy * Math.abs(Math.sin((g - LIT) * 0.35)) * 0.8,
    finL: joy * 1.1,
    finR: joy * 1.1 + (matchOn || g >= STRIKE1 - 6 ? 0.55 : 0) - strike(STRIKE1) * 0.5 - strike(STRIKE2) * 0.5 + happy * 0.3,
    lookX: wait * 0.7 + windowIn(g, HABRIA, LIT + 10, 4) * 0.5,
    lookY: wait * -0.35,
    eyeScale: 1 + joy * 0.3 - wait * 0.15 + happy * 0.15,
    yaw: wait * 0.3,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #1D2B64 0%, #2E6BD8 60%, #7FD1FF 100%)" }}>
      <Shake frame={g} impacts={[{ at: BACK, amp: 16, dur: 14 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#F4F8FF", "#3A3A5A", 1.35]} />
          <directionalLight position={[-5, 9, 8]} intensity={2.4} color="#FFF6E8" />
          <pointLight position={[CANDLE_AT[0], 1.4, CANDLE_AT[2] + 0.5]} intensity={5 * candle} color="#FFA640" distance={6} />
          <Lab t={g} alarm={0} />
          <group position={CANDLE_AT} scale={1.1}>
            <Candle flame={candle} t={g} smoke={ramp(g, STRIKE1, STRIKE1 + 4) * (1 - ramp(g, STRIKE1 + 14, STRIKE1 + 30))} />
          </group>
          <group position={NUBI_AT} rotation={[0, 0.25, 0]}>
            <Nubi
              size={2.0}
              pose={pose}
              shadowOpacity={0.4}
              holdR={
                g >= STRIKE1 - 8 && g < LIT + 30 ? (
                  <Upright raise={pose.finR ?? 0}>
                    <group position={[0.3, 0.8, 0.8]} rotation={[0, 0, -0.5]}>
                      <Match flame={matchFlame} t={g} smoke={g >= STRIKE1 && g < STRIKE2 - 6 ? 1 : 0} />
                    </group>
                  </Upright>
                ) : null
              }
            >
              <Outfit kind="scientist" />
            </Nubi>
          </group>
          <Twinkles frame={g} at={LIT} position={[CANDLE_AT[0], 1.3, CANDLE_AT[2]]} radius={0.8} count={10} />
        </Stage>
        <O2Gauge frame={g} at={S.from} out={NADA - 6} x={540} y={520} scale={0.9} from={0} to={21} dropAt={-100} dropDur={1} riseAt={BACK} riseDur={20} />
        <Burst frame={g} at={BACK} x={540} y={900} color="#7CF03C" size={760} />
        <Confetti frame={g} at={BACK} count={80} />
      </Shake>
      <Flash frame={g} at={BACK} dur={8} peak={0.7} />
    </AbsoluteFill>
  );
};
