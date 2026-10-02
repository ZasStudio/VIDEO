import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { Upright } from "../inca/outfit";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi } from "../three/Nubi";
import { BOTTLE_HUG, WaterBottle } from "../three/agua/Bottle";
import {
  ALLEY_A,
  ALLEY_B,
  BigDrop,
  Civilian,
  DropTrail,
  DryStreet,
  DumpsterCorner,
  FarCrowd,
  HIDE_SPOT,
  HOT_SKY,
  HotLights,
  POLE_SPOT,
  ThinPole,
  Tumbleweed,
  civilianIdle,
  civilianLook,
  civilianRun,
  civilianWalk,
  makeCrowd,
  turnTowards,
} from "../three/agua/Street";

// Review sheet for the water short's street (1920 x 1080).
//   Frame 0: the civilians: 16 looks (front, 3/4), poses (walk, idle/fan, turn, run), a staring crowd.
//   Frame 1: props: the thin pole (Nubi "hiding"), the dumpster corner, the drop trail, the big drop.
//   Frame 2: the dry street in vertical framing: down the street, alley B, the stare, the drone.

export const AGUA_STREET_SHEET_FRAMES = 3;

type Cam = { position: Vec3; target: Vec3; fov: number; roll?: number };

const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  cam: Cam;
  background: string;
  title: string;
  children: React.ReactNode;
}> = ({ x, y, w, h, cam, background, title, children }) => (
  <div style={{ position: "absolute", left: x + 6, top: y + 6, width: w - 12, height: h - 12, borderRadius: 22, overflow: "hidden", background }}>
    <ThreeCanvas
      width={w - 12}
      height={h - 12}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.05, far: 1500 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} roll={cam.roll ?? 0} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 18, top: 10, fontFamily: FONT.fun, fontSize: 26, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.4)" }}>{title}</div>
  </div>
);

const T = 1.3;
const NUBI_HUG = (
  <group {...BOTTLE_HUG}>
    <WaterBottle fill={1} glow={0.6} t={T} />
  </group>
);

const Civilians: React.FC = () => {
  const row = (from: number, yaw: number) =>
    Array.from({ length: 8 }).map((_, i) => {
      const look = civilianLook(from + i);
      return <Civilian key={i} look={look} position={[-10.5 + i * 3, 0, 0]} rotationY={yaw * (i % 2 ? -1 : 1)} pose={civilianIdle(T, i, i % 3 === 0 ? 1 : 0)} t={T + i * 0.3} />;
    });
  const stare = makeCrowd(14, 40, { area: [-6, -7, 6, 1], facing: 0, jitter: 0.5 });
  const cam: Vec3 = [0, 2.2, 9];
  return (
    <>
      <Panel x={0} y={0} w={960} h={540} background={HOT_SKY} title="CIVILES 0-7 (frente)" cam={{ position: [0, 4.2, 25], target: [0, 1.5, 0], fov: 30 }}>
        <HotLights />
        {row(0, 0)}
      </Panel>
      <Panel x={960} y={0} w={960} h={540} background={HOT_SKY} title="CIVILES 8-15 (3/4)" cam={{ position: [0, 4.2, 25], target: [0, 1.5, 0], fov: 30 }}>
        <HotLights />
        {row(8, 0.6)}
      </Panel>
      <Panel x={0} y={540} w={960} h={540} background={HOT_SKY} title="walk · idle/fan · turn 0 / 0.5 / 1 (a cámara) · run" cam={{ position: [0, 3.6, 22], target: [0, 1.3, 0], fov: 30 }}>
        <HotLights />
        {[0, 1].map((i) => (
          <Civilian key={i} look={civilianLook(20 + i)} position={[-10 + i * 2.6, 0, 0]} rotationY={Math.PI / 2} pose={civilianWalk(T + i * 0.1, i)} t={T} />
        ))}
        <Civilian look={civilianLook(22)} position={[-4.6, 0, 0]} pose={civilianIdle(T, 0, 1)} t={T} />
        {[0, 0.5, 1].map((k, i) => {
          const at: Vec3 = [-1.4 + i * 2.7, 0, 0];
          return <Civilian key={k} look={civilianLook(23 + i)} position={at} rotationY={Math.PI / 2} pose={turnTowards({ ...civilianWalk(T, 0, 0.3), eyeScale: 1 + 0.3 * k }, k, at, Math.PI / 2, [0, 3.6, 22])} t={T} thirst={1 - k * 0.5} />;
        })}
        {[0, 1].map((i) => (
          <Civilian key={i} look={civilianLook(27 + i)} position={[7.4 + i * 2.7, 0, 0]} rotationY={0.4} pose={civilianRun(T + i * 0.13, i * 2)} t={T} />
        ))}
      </Panel>
      <Panel x={960} y={540} w={960} h={540} background={HOT_SKY} title="TODOS MIRAN (makeCrowd + FarCrowd)" cam={{ position: cam, target: [0, 1.4, -3], fov: 40 }}>
        <HotLights />
        <FarCrowd t={T} spots={Array.from({ length: 30 }, (_, i) => [-11 + (i % 10) * 2.4 + (i % 3) * 0.3, -10 - Math.floor(i / 10) * 2.2] as [number, number])} lookAt={cam} />
        {stare.map((m, i) => (
          <Civilian key={i} look={m.look} position={m.at} rotationY={m.rotY} pose={turnTowards({ eyeScale: 1.3 }, 1, m.at, m.rotY, cam)} t={T} thirst={0.6} />
        ))}
      </Panel>
    </>
  );
};

const TRAIL: Vec3[] = [
  [-3.5, 0, 1.5],
  [-1.5, 0, 0.2],
  [0.5, 0, 0.8],
  [2.2, 0, -0.6],
  [3.8, 0, 0.3],
];

const Props: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={540} background={HOT_SKY} title="ThinPole + Nubi escondido" cam={{ position: [0.6, 2.4, 9], target: [0, 1.6, 0], fov: 34 }}>
      <HotLights />
      <ThinPole />
      <Nubi size={2} position={[0, 0, -0.9]} pose={{ blink: 1, squash: 0.92, finL: 0.25, finR: 0.25 }}>
        {NUBI_HUG}
      </Nubi>
      <group position={[-2.6, 0, -1]}>
        <ThinPole />
      </group>
    </Panel>
    <Panel x={640} y={0} w={640} h={540} background={HOT_SKY} title="Dumpster corner (callejón A)" cam={{ position: [-6.6, 4.6, 11.3], target: [-11.5, 1.2, 11.4], fov: 50 }}>
      <HotLights />
      <DryStreet t={T} />
      <DumpsterCorner lid={0.25} />
      <Nubi
        size={2}
        position={HIDE_SPOT}
        rotationY={Math.PI / 2}
        pose={{ squash: 0.95, finR: 1.0, eyeScale: 1.2 }}
        holdR={
          <Upright raise={0.6}>
            <group position={[0.45, -1.7, 0.75]} scale={4}>
              <WaterBottle fill={1} glow={0.4} cap={0.8} t={T} />
            </group>
          </Upright>
        }
      />
    </Panel>
    <Panel x={1280} y={0} w={640} h={540} background={HOT_SKY} title="Tumbleweed + EmptyPlanter (calle)" cam={{ position: [-1.5, 1.6, 15], target: [-4.5, 0.8, 8.5], fov: 40 }}>
      <HotLights />
      <DryStreet t={T} />
      <group position={[-4.2, 0, 9.2]}>
        <Tumbleweed t={T} />
      </group>
    </Panel>
    <Panel x={0} y={540} w={960} h={540} background="linear-gradient(180deg, #8C6A4A 0%, #6B4E36 100%)" title="DropTrail glow 0 / 0.6 / 1 (reveal 0.7 abajo)" cam={{ position: [0, 9, 6.5], target: [0, 0, -0.5], fov: 40 }}>
      <HotLights k={0.6} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#5A6070" roughness={0.9} />
      </mesh>
      {[0, 0.6, 1].map((g, i) => (
        <group key={g} position={[0, 0, -3 + i * 2.2]}>
          <DropTrail points={TRAIL} t={T} glow={g} />
        </group>
      ))}
      <group position={[0, 0, 3.8]}>
        <DropTrail points={TRAIL} t={T} glow={1} reveal={0.7} seed={4} />
      </group>
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background="radial-gradient(circle at 50% 40%, #FFE3B0 0%, #E89A55 100%)" title="BigDrop: 0 · 0.2 · 0.34 · 0.6 · 1 | splash 0.1 · 0.4 · 0.75" cam={{ position: [0, 0.75, 4.2], target: [0, 0.6, 0], fov: 36 }}>
      <HotLights />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#B88F66" roughness={0.9} />
      </mesh>
      {[
        [0, 0],
        [0.2, 0],
        [0.34, 0],
        [0.6, 0],
        [1, 0],
        [1, 0.1],
        [1, 0.4],
        [1, 0.75],
      ].map(([fall, splash], i) => (
        <group key={i} position={[-2.45 + i * 0.7, 1.2, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.3]} />
            <meshStandardMaterial color="#5B6270" />
          </mesh>
          <BigDrop t={T} fall={fall} splash={splash} height={1.2} size={0.12} />
        </group>
      ))}
    </Panel>
  </>
);

/** Path of the glowing trail for the drone shot: alley B → the pole → alley A → the dumpster. */
const DRONE_TRAIL: Vec3[] = [
  [7.6, 0.16, 11.4],
  [5.2, 0.16, 11.0],
  [3.4, 0.0, 9.6],
  [0.6, 0.0, 8.4],
  [-2.4, 0.0, 7.0],
  [-4.0, 0.16, 6.4],
  [-5.0, 0.16, 7.4],
  [-5.6, 0.16, 9.6],
  [-6.6, 0.16, 11.2],
  [-8.6, 0.16, 11.3],
  [-10.4, 0.16, 11.6],
];

const Sets: React.FC = () => {
  const walkers = makeCrowd(8, 60, { spots: [[4.3, 6], [5.2, 8.6], [4.6, 14.4], [5.5, 17], [4.0, 10.2], [5.4, 4.2], [4.4, 18.6], [5.6, 13] ], facing: 0 });
  const pov: Vec3 = [5.8, 1.15, 11.65];
  const stare = makeCrowd(16, 80, { area: [-1.5, 6.5, 4.2, 16.5], facing: Math.PI / 2, jitter: 0.6 });
  return (
    <>
      <Panel x={0} y={0} w={480} h={1080} background={HOT_SKY} title="calle → cámara (+z)" cam={{ position: [0.4, 1.5, -6], target: [0, 1.6, 12], fov: 50 }}>
        <HotLights />
        <DryStreet t={T} />
        <Nubi size={2} position={[0, 0, -1.5]} rotationY={Math.PI} pose={{ ...civilianRun(T, 0), finL: 0.25, finR: 0.25 }}>
          {NUBI_HUG}
        </Nubi>
      </Panel>
      <Panel x={480} y={0} w={480} h={1080} background={HOT_SKY} title="callejón B (salida)" cam={{ position: [-0.6, 1.9, 11.4], target: [6.4, 1.3, 11.8], fov: 50 }}>
        <HotLights />
        <DryStreet t={T} />
        {walkers.map((m, i) => (
          <Civilian key={i} look={m.look} position={m.at} rotationY={i % 2 ? Math.PI : 0} pose={civilianWalk(T, m.phase)} t={T} />
        ))}
        <Nubi size={2} position={[ALLEY_B[0] + 0.4, ALLEY_B[1], ALLEY_B[2]]} rotationY={-Math.PI / 2} pose={{ finL: 0.25, finR: 0.25, lookX: -0.3 }}>
          {NUBI_HUG}
        </Nubi>
      </Panel>
      <Panel x={960} y={0} w={480} h={1080} background={HOT_SKY} title="POV: todos miran" cam={{ position: pov, target: [-6, 1.4, 11.65], fov: 55 }}>
        <HotLights />
        <DryStreet t={T} />
        {stare.map((m, i) => (
          <Civilian key={i} look={m.look} position={m.at} rotationY={m.rotY} pose={turnTowards({ eyeScale: 1.32 }, 1, m.at, m.rotY, pov, m.look.size * 0.55)} t={T} thirst={0.5} />
        ))}
      </Panel>
      <Panel x={1440} y={0} w={480} h={1080} background={HOT_SKY} title="dron (roll 90°)" cam={{ position: [-1.2, 30, 9.3], target: [-1.2, 0, 9.2], fov: 50, roll: Math.PI / 2 }}>
        <HotLights />
        <DryStreet t={T} />
        <DropTrail points={DRONE_TRAIL} t={T} glow={1} size={1.6} spacing={0.6} />
        {DRONE_TRAIL.slice(0, 7).map((p, i) => (
          <Civilian key={i} look={civilianLook(90 + i)} position={[p[0] + 0.6, p[1], p[2] + 0.8]} rotationY={-Math.PI / 2} pose={civilianWalk(T, i)} t={T} />
        ))}
        <Nubi size={2} position={HIDE_SPOT} rotationY={Math.PI / 2} pose={{ squash: 0.9 }} />
        <group position={POLE_SPOT}>
          <mesh>
            <sphereGeometry args={[0.01]} />
          </mesh>
        </group>
        <group position={ALLEY_A}>
          <mesh>
            <sphereGeometry args={[0.01]} />
          </mesh>
        </group>
      </Panel>
    </>
  );
};

export const AguaStreetSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#2A1F1A" }}>
      {frame === 0 ? <Civilians /> : null}
      {frame === 1 ? <Props /> : null}
      {frame === 2 ? <Sets /> : null}
    </AbsoluteFill>
  );
};
