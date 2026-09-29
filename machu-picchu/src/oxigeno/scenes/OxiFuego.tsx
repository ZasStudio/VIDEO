import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Burst, Card } from "../../overlay/Graphics";
import { NoO2Badge } from "../../overlay/oxigeno/OxiUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Island } from "../../three/Island";
import { Campfire, Candle, CoffeeMug, Stove } from "../../three/oxigeno/Props";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { Upright } from "../../inca/outfit";
import { FUEGO } from "../beats";
import { Outfit } from "../outfit";
import { oxiTalk } from "../talk";
import { OXI, OXI_HEIGHT, OXI_WIDTH } from "../timeline";

// Nubi the firefighter among candles, a stove and a campfire, coffee in fin: "Primero: todo
// fuego se apagaría." Everything goes out at once; each one gets its label as it is named,
// and last of all the steam of Nubi's coffee dies: "¡hasta mi cafecito!"

const NUBI_AT: Vec3 = [0, 0, 1.2];
const CANDLES: Vec3[] = [
  [-2.3, 0, 0.2],
  [-1.85, 0, 0.75],
  [-2.65, 0, 1.0],
];
const STOVE_AT: Vec3 = [2.2, 0, 0.4];
const FIRE_AT: Vec3 = [1.4, 0, 2.6];
const CAM_A = { position: [0.3, 4.2, 14.6] as Vec3, target: [0.1, 1.2, 0] as Vec3 };
const CAM_B = { position: [0.2, 3.8, 13.2] as Vec3, target: [0.1, 1.15, 0] as Vec3 };

export const OxiFuego: React.FC = () => {
  const frame = useCurrentFrame();
  const S = OXI.SCENES.fuego;
  const g = frame + S.from;
  const { END, APAGARIA, VELAS, COCINAS, FOGATAS, HASTA, CAFECITO } = FUEGO;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 40 };
  const out = ramp(g, APAGARIA - 1, APAGARIA + 5);
  const flame = 1 - out;
  const smoke = ramp(g, APAGARIA, APAGARIA + 6) * (1 - ramp(g, APAGARIA + 50, APAGARIA + 90));
  const steam = 1 - ramp(g, CAFECITO - 2, CAFECITO + 6);

  // Proud firefighter, shocked when everything dies, then heartbroken over the coffee.
  const shock = windowIn(g, APAGARIA, HASTA - 4, 5);
  const sad = windowIn(g, HASTA, END + 20, 6);
  const mugUp = ramp(g, HASTA - 8, HASTA + 2, [0, 1], EASE_IN_OUT);
  const pose = oxiTalk(g, {
    eyeScale: 1 + shock * 0.35 - sad * 0.25,
    lookX: windowIn(g, VELAS - 2, COCINAS - 2, 4) * -0.8 + windowIn(g, COCINAS - 2, FOGATAS - 2, 4) * 0.8 + windowIn(g, FOGATAS - 2, HASTA - 2, 4) * 0.5,
    lookY: -0.3 * sad + windowIn(g, FOGATAS - 2, HASTA - 2, 4) * -0.4,
    finL: 0.3 + mugUp * 0.7,
    finR: shock * 0.9 - sad * 0.35,
    pitch: sad * 0.12,
    squash: 1 - sad * 0.05,
  });

  const label = (p: Vec3, dy = 0) => projectToScreen(cam, [p[0], p[1] + 1.4 + dy, p[2]], OXI_WIDTH, OXI_HEIGHT);
  const lc = label(CANDLES[0]);
  const ls = label(STOVE_AT);
  const lf = label(FIRE_AT, -0.4);
  const RED = "linear-gradient(135deg, #FF6A3D 0%, #E0322B 60%, #A3161B 100%)";

  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 36%, #FFC46B 0%, #FF7A45 30%, #D6336C 62%, #4C1D7A 100%)` }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, rgba(40,50,90,0) 0%, rgba(20,20,60,0.55) 100%)", opacity: out }} />
      <Shake frame={g} impacts={[{ at: APAGARIA, amp: 12, dur: 12 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#FFF3E6", "#6A2A7A", 1.3 - out * 0.25]} />
          <directionalLight position={[-6, 12, 10]} intensity={2.4} color="#FFF6E8" />
          <pointLight position={[0.5, 1.8, 1.8]} intensity={7 * flame} color="#FFA640" distance={9} />
          <group position={[0, -0.02, 0]}>
            <Island radius={4.8} />
          </group>
          {CANDLES.map((p, i) => (
            <group key={i} position={p} scale={0.9 - i * 0.1}>
              <Candle flame={flame} t={g + i * 7} smoke={smoke} />
            </group>
          ))}
          <group position={STOVE_AT} rotation={[0, -0.5, 0]}>
            <Stove flame={flame} t={g} />
          </group>
          <group position={FIRE_AT}>
            <Campfire flame={flame} t={g} smoke={smoke} />
          </group>
          <group position={NUBI_AT} rotation={[0, 0, 0]}>
            <Nubi
              size={2.1}
              pose={pose}
              shadowOpacity={0.4}
              holdL={
                <Upright raise={pose.finL ?? 0} side="L">
                  <group position={[-0.2, 0.9, 0.9]} scale={1.2}>
                    <CoffeeMug steam={steam} t={g} />
                  </group>
                </Upright>
              }
            >
              <Outfit kind="firefighter" />
            </Nubi>
          </group>
          <SweatDrops frame={g} from={CAFECITO + 4} to={END} position={[NUBI_AT[0], 1.6, NUBI_AT[2] + 0.2]} spread={0.7} />
        </Stage>
        <Burst frame={g} at={APAGARIA} x={540} y={900} color="#9FD8FF" size={700} />
        <Card frame={g} at={VELAS} out={END + 20} x={Math.max(220, lc.x)} y={lc.y - 60} title="VELAS" sub="APAGADAS" rotate={-5} gradient={RED} scale={0.8} />
        <Card frame={g} at={COCINAS} out={END + 20} x={Math.min(860, ls.x)} y={ls.y - 60} title="COCINA" sub="APAGADA" rotate={4} gradient={RED} scale={0.8} />
        <Card frame={g} at={FOGATAS} out={END + 20} x={Math.min(820, lf.x)} y={lf.y + 40} title="FOGATA" sub="APAGADA" rotate={-3} gradient={RED} scale={0.8} />
      </Shake>
      <NoO2Badge frame={g} from={S.from} to={END + 10} x={900} y={200} />
    </AbsoluteFill>
  );
};
