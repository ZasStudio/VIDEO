import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi } from "../three/Nubi";
import {
  COAST_FLAT_Y,
  Coast,
  CoastLights,
  FARM_SKY,
  FarmLights,
  Farmland,
  GiantShip,
  HeatShimmer,
  PLAYA_WALK,
  SHIP_NUBI,
  SHIP_SPOT,
  coastSky,
} from "../three/agua/Outdoors";

// Review sheet for the water short's outdoor sets (1920 x 1080, three 9:16-ish panels per frame).
//   Frame 0: Coast from the air, water 1 / 0.5 / 0 (boats float, drop, lie on the cracked seabed).
//   Frame 1: down on the seabed: the playa walk (towards the old shore), Nubi's view up at the
//            GiantShip leaning over it, tiny Nubi under the ship.
//   Frame 2: Farmland wilt 0 / 0.5 / 1 (drone view).
//   Frame 3: GiantShip alone (tilt 0 / 1) and the seabed props close up.

export const AGUA_OUTDOOR_SHEET_FRAMES = 4;

type Cam = { position: Vec3; target: Vec3; fov: number };

const Panel: React.FC<{ i: number; cam: Cam; background: string; title: string; children: React.ReactNode }> = ({ i, cam, background, title, children }) => (
  <div style={{ position: "absolute", left: i * 640 + 6, top: 6, width: 628, height: 1068, borderRadius: 22, overflow: "hidden", background }}>
    <ThreeCanvas
      width={628}
      height={1068}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 1500 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 20, top: 14, fontFamily: FONT.fun, fontSize: 30, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.45)" }}>{title}</div>
  </div>
);

const T = 2.3;
const F = COAST_FLAT_Y;
const AERIAL: Cam = { position: [0, 95, 150], target: [0, -12, -40], fov: 50 };
const WALK: Cam = { position: [2.5, F + 2.4, -46], target: [-1.5, F + 4.2, -14], fov: 50 };
const POV: Cam = { position: [SHIP_NUBI[0], F + 1.6, SHIP_NUBI[2]], target: [SHIP_NUBI[0] - 1, F + 15, SHIP_NUBI[2] - 9], fov: 72 };
const WIDE: Cam = { position: [14, F + 3, 6], target: [3, F + 9, -44], fov: 46 };

const Frame0: React.FC = () => (
  <>
    {[1, 0.5, 0].map((w, i) => (
      <Panel key={w} i={i} cam={AERIAL} background={coastSky(0.2)} title={`COAST water ${w}`}>
        <CoastLights />
        <Coast water={w} t={T} rush={w === 0.5 ? 1 : 0} />
        <GiantShip position={SHIP_SPOT} tilt={w === 0 ? 1 : 0} float={w === 1 ? 7 : 0} t={T} />
        {w === 0 ? <HeatShimmer t={T} position={[0, F, -30]} width={120} height={10} /> : null}
      </Panel>
    ))}
  </>
);

const Frame1: React.FC = () => (
  <>
    <Panel i={0} cam={WALK} background={coastSky(0.55)} title="PLAYA: walk (PLAYA_WALK)">
      <CoastLights />
      <Coast water={0} t={T} fog={[50, 320]} />
      <GiantShip position={SHIP_SPOT} tilt={1} t={T} creak={1} />
      <Nubi size={2} position={[PLAYA_WALK.from[0] + 1, F, PLAYA_WALK.from[2] - 8]} rotationY={0.1} pose={{ wiggle: 1, wigglePhase: 1.3, hop: 0.6 }} />
      <HeatShimmer t={T} position={[0, F, -10]} width={70} height={7} />
    </Panel>
    <Panel i={1} cam={POV} background={coastSky(0.95)} title="POV up at the ship (SHIP_NUBI)">
      <CoastLights />
      <Coast water={0} t={T} fog={[50, 320]} />
      <GiantShip position={SHIP_SPOT} tilt={1} t={T} creak={1} />
    </Panel>
    <Panel i={2} cam={WIDE} background={coastSky(0.6)} title="WIDE: tiny Nubi, huge ship">
      <CoastLights />
      <Coast water={0} t={T} fog={[50, 320]} />
      <GiantShip position={SHIP_SPOT} tilt={1} t={T} creak={1} />
      <Nubi size={2} position={SHIP_NUBI} rotationY={0.3} pose={{ eyeScale: 0.85, blink: 0.25 }} />
    </Panel>
  </>
);

const FARM_CAM: Cam = { position: [62, 46, 74], target: [2, 0, 4], fov: 46 };

const Frame2: React.FC = () => (
  <>
    {[0, 0.5, 1].map((w, i) => (
      <Panel key={w} i={i} cam={FARM_CAM} background={FARM_SKY} title={`FARMLAND wilt ${w}`}>
        <FarmLights sun={0.2 + w * 0.6} />
        <Farmland wilt={w} t={T + i} />
      </Panel>
    ))}
  </>
);

const Frame3: React.FC = () => (
  <>
    <Panel i={0} cam={{ position: [60, 20, 70], target: [0, 12, 0], fov: 45 }} background={coastSky(0.6)} title="SHIP tilt 0 (float 0)">
      <CoastLights />
      <GiantShip tilt={0} t={T} />
    </Panel>
    <Panel i={1} cam={{ position: [-50, 14, 62], target: [0, 11, 0], fov: 45 }} background={coastSky(0.6)} title="SHIP tilt 1, sand, chain">
      <CoastLights />
      <GiantShip tilt={1} t={T} creak={1} />
      <Nubi size={2} position={[-6, 0, 21]} />
    </Panel>
    <Panel i={2} cam={{ position: [4, F + 6, -12], target: [-1, F, -30], fov: 50 }} background={coastSky(0.3)} title="SEABED PROPS (anchor, chest, bones)">
      <CoastLights />
      <Coast water={0} t={T} fog={[50, 320]} />
    </Panel>
  </>
);

export const AguaOutdoorSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#1B1F2A" }}>
      {frame === 0 ? <Frame0 /> : frame === 1 ? <Frame1 /> : frame === 2 ? <Frame2 /> : <Frame3 />}
    </AbsoluteFill>
  );
};
