import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { NoO2Badge, StatusCard } from "../../overlay/oxigeno/OxiUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { PLANE_SEAT, Rocket, ToyPlane } from "../../three/oxigeno/Props";
import { Clouds } from "../../three/oxigeno/Sets";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { MOTORES } from "../beats";
import { Outfit } from "../outfit";
import { oxiTalk } from "../talk";
import { OXI } from "../timeline";

// Nubi the pilot rides its little plane: "Los motores de combustión se ahogarían: autos y
// aviones, apagados en pleno viaje." The engine coughs and dies and the plane glides.
// "¿Los cohetes? Ellos no: ¡llevan su propio oxígeno!" — a rocket roars past.

const CAM = { position: [0, 0.9, 9.4] as Vec3, target: [0, 0.3, 0] as Vec3, fov: 40 };

export const OxiMotores: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.motores;
  const g = frame + S.from;
  const { END, AUTOS, AVIONES, APAGADOS, COHETES, ELLOS, LLEVAN } = MOTORES;

  // Engine: spins, coughs from "aviones" and dies by "apagados".
  const DIE = APAGADOS + 4;
  const engine = 1 - ramp(g, AVIONES, DIE);
  const cough = g >= AVIONES && g < DIE ? Math.abs(Math.sin((g - AVIONES) * 0.9)) : 0;
  let prop = 0;
  for (let f = S.from; f < g; f++) prop += 0.9 * (1 - ramp(f, AVIONES, DIE + 20));
  const glide = ramp(g, DIE, END, [0, 1], EASE_IN_OUT);
  const bob = Math.sin(g * 0.12) * 0.12 * (1 - glide * 0.5);
  const planeY = 0.2 + bob - glide * 0.9 + cough * 0.05;
  const pitch = -0.05 - glide * 0.22 + cough * 0.06 * Math.sin(g * 2.1);
  const roll = Math.sin(g * 0.07) * 0.06;

  // The rocket shoots up on the right from "cohetes".
  const rk = ramp(g, COHETES - 4, LLEVAN + 24, [0, 1], (x) => x);
  const rocketPos: Vec3 = [1.9 - rk * 0.4, -6 + rk * 14, -1.5];

  const worry = windowIn(g, AVIONES, COHETES - 4, 6);
  const envy = windowIn(g, COHETES, END + 20, 6);
  const pose = oxiTalk(g, {
    finL: 0.6 * (1 - worry) + worry * 1.1 * Math.abs(Math.sin(g * 0.4)),
    finR: 0.4 + envy * 0.6,
    eyeScale: 1 + worry * 0.35 + envy * 0.2,
    lookX: envy * 0.8,
    lookY: envy * ramp(g, COHETES, LLEVAN + 20, [-0.2, 0.9]),
    pitch: -pitch,
  });

  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg, #3FA9FF 0%, #8FD3FF 55%, #E9F7FF 100%)" }}>
      <Shake frame={g} impacts={[{ at: DIE, amp: 8, dur: 10 }, { at: COHETES, amp: 16, dur: 20 }]}>
        <Stage cam={CAM}>
          <hemisphereLight args={["#FFFFFF", "#7FB8E8", 1.4]} />
          <directionalLight position={[-6, 10, 8]} intensity={2.3} color="#FFF6E8" />
          <Clouds t={g / 30 * (1 - glide * 0.6)} />
          <group position={[0, planeY, 0]} rotation={[0, -0.55, 0]}>
            <group rotation={[pitch, 0, roll]}>
              <ToyPlane prop={prop} exhaust={engine * (0.6 + 0.4 * cough)} t={g / 30} />
              <group rotation={[0, 0.55, 0]}>
                <Nubi position={PLANE_SEAT.position} size={PLANE_SEAT.size} pose={pose} shadow={false}>
                  <Outfit kind="pilot" flutter={g * 0.45} />
                </Nubi>
              </group>
            </group>
          </group>
          <SweatDrops frame={g} from={AVIONES + 6} to={COHETES} position={[0, planeY + 1.8, 0.4]} spread={0.5} />
          {rk > 0 && rk < 1 ? (
            <group position={rocketPos} rotation={[0, 0, 0.06]} scale={1.1}>
              <Rocket flame={1} t={g / 30} />
            </group>
          ) : null}
        </Stage>
        <StatusCard frame={g} at={AUTOS} out={APAGADOS + 18} x={540} y={420} icon="engine" title="AUTOS" sub="MOTOR APAGADO" tone="red" />
        <StatusCard frame={g} at={APAGADOS} out={ELLOS - 4} x={540} y={620} icon="engine" title="AVIONES" sub="A PLANEAR…" tone="red" />
        <StatusCard frame={g} at={LLEVAN} out={END + 20} x={540} y={420} icon="rocket" title="COHETES: OK" sub="LLEVAN SU PROPIO OXÍGENO" tone="green" />
      </Shake>
      <NoO2Badge frame={g} from={S.from} to={END + 10} x={900} y={200} />
    </AbsoluteFill>
  );
};
