import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";
import { Upright } from "../inca/outfit";
import {
  CAN_HOLD,
  Faucet,
  GLASS_HOLD,
  Moth,
  NightCap,
  Pajamas,
  STUDIO_BED,
  STUDIO_FAUCET_KNOB,
  STUDIO_PLANT,
  STUDIO_PLANT_NUBI,
  STUDIO_SINK,
  STUDIO_SINK_RAISE,
  STUDIO_SINK_YAW,
  Studio,
  StudioLights,
  WaterGlass,
  WateringCan,
} from "../three/agua/Home";

// Review sheet for Nubi's home in the water short (1920 x 1080).
//   Frame 0: the studio (wide and at the sink), Nubi in bed in pyjamas, the props.
//   Frame 1: Nubi with the glass, with the watering can at the plant, the sink from above, nightcap flops.

export const AGUA_HOME_SHEET_FRAMES = 2;

type Cam = { position: Vec3; target: Vec3; fov: number };

const Panel: React.FC<{ x: number; y: number; w: number; h: number; cam: Cam; title: string; children: React.ReactNode }> = ({ x, y, w, h, cam, title, children }) => (
  <div style={{ position: "absolute", left: x + 6, top: y + 6, width: w - 12, height: h - 12, borderRadius: 22, overflow: "hidden", background: "linear-gradient(180deg,#FFE9D2,#F7C9A8)" }}>
    <ThreeCanvas
      width={w - 12}
      height={h - 12}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.05, far: 300 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 16, top: 10, fontFamily: FONT.fun, fontSize: 26, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.45)" }}>{title}</div>
  </div>
);

const T = 1.2;

const SheetA: React.FC = () => {
  const sinkPose: NubiPose = { finL: STUDIO_SINK_RAISE, lookX: -0.5, lookY: -0.3 };
  return (
    <>
      <Panel x={0} y={0} w={760} h={1080} title="Studio (wide)" cam={{ position: [0.6, 2.4, 10.5], target: [0, 1.5, -0.5], fov: 50 }}>
        <StudioLights />
        <Studio t={T} faucet={{ flow: 1 }} blanket={1} />
        <Nubi size={2} position={STUDIO_SINK} rotationY={STUDIO_SINK_YAW} pose={sinkPose} />
        <Nubi size={2} position={STUDIO_BED} pose={{ eyeScale: 1.2 }}>
          <Pajamas />
          <NightCap flop={0} />
        </Nubi>
      </Panel>
      <Panel x={760} y={0} w={580} h={540} title="Sink: finL on the knob, flow 1" cam={{ position: [1.6, 1.9, 1.6], target: [-1.2, 1.1, -2.2], fov: 42 }}>
        <StudioLights />
        <Studio t={T} faucet={{ flow: 1, handle: 1 }} />
        <Nubi size={2} position={STUDIO_SINK} rotationY={STUDIO_SINK_YAW} pose={sinkPose} />
      </Panel>
      <Panel x={1340} y={0} w={580} h={540} title="Bed: pyjamas + nightcap" cam={{ position: [1.9, 1.9, 2.6], target: [2.6, 1.2, -1.5], fov: 40 }}>
        <StudioLights />
        <Studio t={T} blanket={1} />
        <Nubi size={2} position={STUDIO_BED} pose={{ eyeScale: 1.35, finL: 0.6, finR: 0.6 }}>
          <Pajamas />
          <NightCap flop={0.3} />
        </Nubi>
      </Panel>
      <Panel x={760} y={540} w={1160} h={540} title="Faucet: off / sputter .35 / .7 / flow 1 · Glass: full / tilt / vanish .3 / empty · Can + dust · Moth" cam={{ position: [0, 0.75, 4.6], target: [0, 0.35, 0], fov: 32 }}>
        <StudioLights />
        {[
          { x: -2.6, s: {} },
          { x: -2.0, s: { sputter: 0.35 } },
          { x: -1.4, s: { sputter: 0.72 } },
          { x: -0.8, s: { flow: 1, handle: 1 } },
        ].map((f) => (
          <group key={f.x} position={[f.x, 0.3, 0]} rotation={[0, -0.9, 0]}>
            <Faucet {...f.s} t={T} floor={-0.3} />
          </group>
        ))}
        {[
          { x: -0.15, p: { fill: 0.8 } },
          { x: 0.25, p: { fill: 0.8, tilt: 0.7 } },
          { x: 0.65, p: { fill: 0.8, vanish: 0.3 } },
          { x: 1.05, p: { fill: 0.8, vanish: 1, tilt: Math.PI } },
        ].map((g) => (
          <group key={g.x} position={[g.x, 0.1, 0]}>
            <WaterGlass {...g.p} t={T} />
          </group>
        ))}
        <group position={[1.55, 0.1, 0]}>
          <WateringCan tilt={0.8} dust={1} t={T} />
        </group>
        <group position={[2.5, 0.6, 0.3]} rotation={[0.3, -0.3, 0]} scale={1.6}>
          <Moth fly={1} t={T} />
        </group>
        <group position={[2.5, 0.15, 0.3]} rotation={[0.5, 0.3, 0]} scale={1.6}>
          <Moth fly={0} t={T} />
        </group>
      </Panel>
    </>
  );
};

const SheetB: React.FC = () => {
  const glassPose: NubiPose = { finR: 1.0, pitch: -0.12, lookX: 0.3, lookY: 0.2 };
  const canPose: NubiPose = { finR: 0.75, lookX: 0.6, lookY: -0.2 };
  return (
    <>
      <Panel x={0} y={0} w={640} h={540} title="Glass (GLASS_HOLD, tilt 0.9)" cam={{ position: [1.9, 1.7, 3.6], target: [0.25, 1.15, 0], fov: 40 }}>
        <StudioLights />
        <Studio t={T} />
        <Nubi
          size={2}
          pose={glassPose}
          holdR={
            <Upright raise={glassPose.finR ?? 0}>
              <group {...GLASS_HOLD}>
                <WaterGlass fill={0.8} tilt={0.9} t={T} />
              </group>
            </Upright>
          }
        />
      </Panel>
      <Panel x={640} y={0} w={640} h={540} title="Can at the plant (CAN_HOLD, tilt .8, dust)" cam={{ position: [1.2, 1.6, 5.2], target: [3.0, 1.0, 1.1], fov: 40 }}>
        <StudioLights />
        <Studio t={T} wilt={0.2} />
        <Nubi
          size={2}
          position={STUDIO_PLANT_NUBI}
          rotationY={0.25}
          pose={canPose}
          holdR={
            <Upright raise={canPose.finR ?? 0}>
              <group {...CAN_HOLD}>
                <WateringCan tilt={0.8} dust={1} t={T} />
              </group>
            </Upright>
          }
        />
        <group position={[STUDIO_PLANT[0] - 0.7, STUDIO_PLANT[1] + 1.0, STUDIO_PLANT[2] + 0.5]} rotation={[0.2, 0.6, 0]}>
          <Moth fly={1} t={T} />
        </group>
      </Panel>
      <Panel x={1280} y={0} w={640} h={540} title="Sink from above (sputter .45)" cam={{ position: [-1.3, 2.3, -1.3], target: [-2.4, 0.75, -2.45], fov: 44 }}>
        <StudioLights />
        <Studio t={T} faucet={{ sputter: 0.45, shake: 0.6, handle: 1 }} />
        <Nubi size={2} position={STUDIO_SINK} rotationY={STUDIO_SINK_YAW} pose={{ finL: STUDIO_SINK_RAISE }} />
      </Panel>
      <Panel x={0} y={540} w={1280} h={540} title="Nightcap flop −1 / 0 / 0.6 / 1.2, pyjamas front and back" cam={{ position: [0, 1.3, 8.5], target: [0, 1.1, 0], fov: 30 }}>
        <StudioLights />
        {[-1, 0, 0.6, 1.2].map((fl, i) => (
          <Nubi key={fl} size={2} position={[-3.6 + i * 2.4, 0, 0]} rotationY={i === 3 ? Math.PI * 0.85 : 0} pose={{ eyeScale: i === 0 ? 1.4 : 1, finL: 0.3 }}>
            <Pajamas />
            <NightCap flop={fl} />
          </Nubi>
        ))}
      </Panel>
      <Panel x={1280} y={540} w={640} h={540} title="Kitchen window + faucet close" cam={{ position: [-1.0, 1.6, -0.6], target: [STUDIO_FAUCET_KNOB[0] - 0.4, 1.2, STUDIO_FAUCET_KNOB[2]], fov: 40 }}>
        <StudioLights />
        <Studio t={T} faucet={{ flow: 0.25, handle: 0.5 }} />
      </Panel>
    </>
  );
};

export const AguaHomeSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ background: "#2B2233" }}>{frame === 0 ? <SheetA /> : <SheetB />}</AbsoluteFill>;
};
