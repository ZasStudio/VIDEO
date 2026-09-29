import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";
import { FireHelmet, Goggles, LabCoat, PilotCap } from "../three/oxigeno/Costumes";
import {
  BigRedButton,
  Campfire,
  Candle,
  CoffeeMug,
  MATCH_HOLD_R,
  Match,
  OxygenTank,
  PLANE_SEAT,
  Rocket,
  Stove,
  TANK_FRONT,
  TANK_HUG,
  ToyCar,
  ToyPlane,
} from "../three/oxigeno/Props";
import { Lab, STAGE_TOP, Sky, Stage } from "../three/oxigeno/Sets";

// Review sheet for the oxygen-short 3D props (1920 x 1080).
//   Frame 0: Nubi's outfits, the big red button, fire props lit and out.
//   Frame 1: plane (with pilot), car, rocket, oxygen tank (beside / hug), held match.
//   Frame 2: the Lab set (vertical framing, alarm on), the Lab wide, outfits from the back.

export const OXI_PROPS_SHEET_FRAMES = 3;

type Cam = { position: Vec3; target: Vec3; fov: number };

const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  cam: Cam;
  background: string;
  title: string;
  children: React.ReactNode;
  labels?: { text: string; x: number; y: number }[];
}> = ({ x, y, w, h, cam, background, title, children, labels = [] }) => (
  <div style={{ position: "absolute", left: x + 8, top: y + 8, width: w - 16, height: h - 16, borderRadius: 26, overflow: "hidden", background }}>
    <ThreeCanvas
      width={w - 16}
      height={h - 16}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 900 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 20, top: 14, fontFamily: FONT.fun, fontSize: 30, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>
      {title}
    </div>
    {labels.map((l) => (
      <div
        key={l.text}
        style={{
          position: "absolute",
          left: l.x,
          top: l.y,
          transform: "translateX(-50%)",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 17,
          color: "#FFFFFF",
          background: "rgba(0,0,0,0.38)",
          padding: "3px 10px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        {l.text}
      </div>
    ))}
  </div>
);

const Lights: React.FC<{ sky?: string; ground?: string }> = ({ sky = "#FFF6E8", ground = "#5A6A7A" }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9} color="#CFE8FF" />
  </>
);

type Outfit = "scientist" | "firefighter" | "pilot";

const Dressed: React.FC<{
  kind: Outfit;
  size: number;
  position: Vec3;
  yaw?: number;
  pose?: NubiPose;
  holdR?: React.ReactNode;
  flutter?: number;
  wind?: number;
}> = ({ kind, size, position, yaw = 0, pose = {}, holdR, flutter = 0.8, wind = 0.4 }) => (
  <Nubi size={size} position={position} rotationY={yaw} pose={pose} holdR={holdR}>
    {kind === "scientist" ? (
      <>
        <LabCoat />
        <Goggles />
      </>
    ) : null}
    {kind === "firefighter" ? <FireHelmet /> : null}
    {kind === "pilot" ? <PilotCap flutter={flutter} wind={wind} /> : null}
  </Nubi>
);

const LAB_BG = "linear-gradient(180deg, #CFEFF5 0%, #9FDCE6 60%, #6FB9C6 60%, #5AA3B0 100%)";
const WARM = "linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #C98B4E 62%, #B8763B 100%)";
const NIGHT = "linear-gradient(180deg, #2A2F55 0%, #3B4B8C 62%, #2A2F45 62%, #1D2033 100%)";
const DIM = "linear-gradient(180deg, #5B5F6E 0%, #7A7F8E 62%, #4A4D57 62%, #3A3C44 100%)";
const SKY_BG = "linear-gradient(180deg, #2F8BFF 0%, #7CC4FF 60%, #D8F0FF 100%)";

const T = 1.35;

const FIRE_ROW: { x: number; label: string }[] = [
  { x: -3.3, label: "Candle" },
  { x: -1.7, label: "Campfire" },
  { x: 0.1, label: "Stove" },
  { x: 1.6, label: "CoffeeMug" },
  { x: 2.9, label: "Match" },
];

const FireRow: React.FC<{ on: boolean }> = ({ on }) => {
  const flame = on ? 1 : 0;
  const smoke = on ? 0 : 1;
  return (
    <>
      <group position={[FIRE_ROW[0].x, 0, 0]} scale={1.4}>
        <Candle flame={flame} smoke={smoke} t={T} />
      </group>
      <group position={[FIRE_ROW[1].x, 0, 0]}>
        <Campfire flame={flame} smoke={smoke} t={T} />
      </group>
      <group position={[FIRE_ROW[2].x, 0, 0]}>
        <Stove flame={flame} t={T} />
      </group>
      <group position={[FIRE_ROW[3].x, 0, 0]} scale={1.5}>
        <CoffeeMug steam={on ? 1 : 0} t={T} />
      </group>
      <group position={[FIRE_ROW[4].x, 0.12 * 1.6, 0]} scale={1.6}>
        <Match flame={flame} smoke={smoke} t={T} />
      </group>
    </>
  );
};

const fireLabels = (w: number) => FIRE_ROW.map((f) => ({ text: f.label, x: w / 2 + f.x * (w / 8.6), y: 420 }));

const Overview: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={1150}
      h={560}
      background={LAB_BG}
      title="VESTUARIO: CIENTÍFICO / BOMBERO / PILOTO"
      cam={{ position: [0, 4.2, 22], target: [0, 1.8, 0], fov: 30 }}
      labels={[
        { text: "LabCoat + Goggles", x: 175, y: 480 },
        { text: "FireHelmet", x: 420, y: 480 },
        { text: "PilotCap (wind 0.4)", x: 665, y: 480 },
        { text: "PilotCap 3/4 (wind 1)", x: 925, y: 480 },
      ]}
    >
      <Lights />
      <Dressed kind="scientist" size={3.0} position={[-7.2, 0, 0]} yaw={-0.25} pose={{ finR: 0.2, lookX: 0.2 }} />
      <Dressed kind="firefighter" size={3.0} position={[-2.4, 0, 0]} yaw={-0.1} pose={{ finL: 0.3, eyeScale: 1.35 }} />
      <Dressed kind="pilot" size={3.0} position={[2.4, 0, 0]} yaw={0.1} pose={{ finR: 0.3, lookX: -0.2 }} />
      <Dressed kind="pilot" size={3.0} position={[7.2, 0, 0]} yaw={0.85} flutter={2.2} wind={1} pose={{ lookX: 0.4 }} />
    </Panel>
    <Panel
      x={1150}
      y={0}
      w={770}
      h={560}
      background={LAB_BG}
      title="BIGREDBUTTON (Nubi size 2)"
      cam={{ position: [0, 2.3, 11], target: [0, 1.05, 0], fov: 30 }}
      labels={[
        { text: "Nubi 2", x: 150, y: 480 },
        { text: "press 0", x: 375, y: 480 },
        { text: "press 1, glow 1", x: 600, y: 480 },
      ]}
    >
      <Lights />
      <Dressed kind="scientist" size={2} position={[-2.2, 0, 0]} yaw={0.35} pose={{ finR: 0.9, lookX: 0.6, lookY: 0.2 }} />
      <group position={[-0.1, 0, 0]} rotation={[0, -0.25, 0]}>
        <BigRedButton />
      </group>
      <group position={[2.1, 0, 0]} rotation={[0, -0.25, 0]}>
        <BigRedButton press={1} glow={1} />
      </group>
    </Panel>
    <Panel x={0} y={560} w={960} h={520} background={WARM} title="FUEGO: flame 1" cam={{ position: [0, 1.6, 9.5], target: [0, 0.55, 0], fov: 30 }} labels={fireLabels(944)}>
      <Lights />
      <FireRow on />
    </Panel>
    <Panel x={960} y={560} w={960} h={520} background={DIM} title="SIN OXÍGENO: flame 0, smoke 1" cam={{ position: [0, 1.6, 9.5], target: [0, 0.55, 0], fov: 30 }} labels={fireLabels(944)}>
      <Lights sky="#DDE3EE" />
      <FireRow on={false} />
    </Panel>
  </>
);

const Vehicles: React.FC = () => (
  <>
    <Panel x={0} y={0} w={960} h={540} background={SKY_BG} title="TOYPLANE + PILOTO (exhaust 1)" cam={{ position: [0.2, 1.2, 9], target: [0, 0.2, 0], fov: 30 }}>
      <Lights sky="#F4FBFF" />
      <Sky t={T} backdrop={false} />
      <group rotation={[0, -0.35, 0.05]} position={[0, 0, 0]}>
        <ToyPlane prop={0.6} exhaust={1} t={T} />
        <Dressed kind="pilot" size={PLANE_SEAT.size} position={PLANE_SEAT.position} yaw={0.35} flutter={2.4} wind={1} pose={{ finL: 0.5, finR: 0.3, lookX: 0.4 }} />
      </group>
    </Panel>
    <Panel
      x={960}
      y={0}
      w={960}
      h={540}
      background={SKY_BG}
      title="TOYCAR / ROCKET"
      cam={{ position: [0, 2.2, 13], target: [0, 1.2, 0], fov: 30 }}
      labels={[
        { text: "car exhaust 1", x: 190, y: 470 },
        { text: "rocket flame 1", x: 520, y: 470 },
        { text: "rocket flame 0", x: 790, y: 470 },
      ]}
    >
      <Lights sky="#F4FBFF" />
      <group position={[-3.2, 0, 0]} rotation={[0, -0.5, 0]}>
        <ToyCar exhaust={1} t={T} roll={0.4} />
      </group>
      <group position={[0.8, 1.5, 0]}>
        <Rocket flame={1} t={T} />
      </group>
      <group position={[3.6, 0.12, 0]}>
        <Rocket flame={0} t={T} />
      </group>
    </Panel>
    <Panel
      x={0}
      y={540}
      w={960}
      h={540}
      background={LAB_BG}
      title="OXYGENTANK (Nubi size 2)"
      cam={{ position: [-0.6, 2.2, 11.5], target: [-0.3, 1.0, 0], fov: 30 }}
      labels={[
        { text: "tank", x: 130, y: 470 },
        { text: "TANK_FRONT", x: 380, y: 470 },
        { text: "TANK_HUG (side)", x: 720, y: 470 },
      ]}
    >
      <Lights />
      <group position={[-3.6, 0, 0]} rotation={[0, 0.2, 0]}>
        <OxygenTank />
      </group>
      <group position={[-1.2, 0, 0]}>
        <Nubi size={2} pose={{ ...TANK_FRONT.pose, lookY: 0.3 }}>
          <LabCoat />
          <Goggles />
        </Nubi>
        <group position={TANK_FRONT.position}>
          <OxygenTank />
        </group>
      </group>
      <group position={[1.9, 0, 0]} rotation={[0, TANK_HUG.yaw, 0]}>
        <Nubi size={2} pose={{ ...TANK_HUG.pose, lookX: 0.4, eyeScale: 0.85 }}>
          <LabCoat />
          <Goggles />
        </Nubi>
        <group position={TANK_HUG.position} rotation={TANK_HUG.rotation}>
          <OxygenTank />
        </group>
      </group>
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background={NIGHT} title="EN LA ALETA: MATCH (MATCH_HOLD_R)" cam={{ position: [0, 1.8, 9], target: [0, 1.1, 0], fov: 30 }}>
      <Lights sky="#C8D4FF" ground="#2A2F45" />
      <Dressed
        kind="firefighter"
        size={2.2}
        position={[-1.3, 0, 0]}
        yaw={-0.15}
        pose={{ finR: 0.6, lookX: 0.6, lookY: 0.3 }}
        holdR={
          <group {...MATCH_HOLD_R}>
            <Match flame={1} t={T} />
          </group>
        }
      />
      <Dressed
        kind="scientist"
        size={2.2}
        position={[1.5, 0, 0]}
        yaw={-0.1}
        pose={{ finR: 0.3, eyeScale: 1.3, lookX: 0.4 }}
        holdR={
          <group {...MATCH_HOLD_R}>
            <Match flame={0} smoke={1} t={T} />
          </group>
        }
      />
    </Panel>
  </>
);

const SetsCloseUp: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background="#CFEFF5" title="LAB (alarm 1, vertical)" cam={{ position: [0.6, 2.6, 13.5], target: [0.4, 2.4, 0], fov: 42 }}>
      <hemisphereLight args={["#F4FBFF", "#5A6A7A", 1.2]} />
      <directionalLight position={[-6, 10, 8]} intensity={2.2} color="#FFF6E8" />
      <directionalLight position={[7, 4, -4]} intensity={0.8} color="#CFE8FF" />
      <Lab t={T} alarm={1} />
      <Dressed kind="scientist" size={2} position={[-0.6, 0, 0.8]} yaw={0.3} pose={{ finR: 1.0, eyeScale: 1.3, lookX: 0.6 }} />
      <group position={[1.3, 0, 0.6]} rotation={[0, -0.3, 0]}>
        <BigRedButton press={1} glow={1} />
      </group>
    </Panel>
    <Panel x={640} y={0} w={1280} h={560} background="#CFEFF5" title="LAB (alarm 0, wide)" cam={{ position: [0, 3.2, 14], target: [0, 2.3, 0], fov: 36 }}>
      <Lights />
      <Lab t={T + 0.4} alarm={0} />
      <Dressed kind="scientist" size={2} position={[-0.3, 0, 0.8]} yaw={0.1} pose={{ lookX: 0.3 }} />
      <group position={[1.6, 0, 0.6]} rotation={[0, -0.2, 0]}>
        <BigRedButton />
      </group>
      <group position={[2.9, 0, 0.9]}>
        <OxygenTank />
      </group>
    </Panel>
    <Panel x={640} y={560} w={640} h={520} background={WARM} title="STAGE + FUEGO" cam={{ position: [0, 2.6, 9], target: [0, 0.8, 0], fov: 32 }}>
      <Lights />
      <Stage />
      <group position={[0, STAGE_TOP, 0]}>
        <group position={[-1.7, 0, 0.4]} scale={1.3}>
          <Candle t={T} />
        </group>
        <group position={[-0.5, 0, -0.6]}>
          <Campfire t={T} />
        </group>
        <group position={[0.9, 0, -0.3]}>
          <Stove t={T} />
        </group>
        <group position={[1.7, 0, 0.8]} scale={1.3}>
          <CoffeeMug t={T} />
        </group>
      </group>
    </Panel>
    <Panel x={1280} y={560} w={640} h={520} background={LAB_BG} title="DE ESPALDAS" cam={{ position: [0, 3.2, 18], target: [0, 0.9, 0], fov: 30 }}>
      <Lights />
      <Dressed kind="scientist" size={2.2} position={[-2.7, 0, 0]} yaw={2.5} />
      <Dressed kind="firefighter" size={2.2} position={[0, 0, 0]} yaw={Math.PI - 0.6} />
      <Dressed kind="pilot" size={2.2} position={[2.7, 0, 0]} yaw={-2.4} wind={0.3} />
    </Panel>
  </>
);

export const OxiPropsSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #12324A 0%, #1E5A6E 50%, #2E7D6E 100%)" }}>
      {frame === 0 ? <Overview /> : frame === 1 ? <Vehicles /> : <SetsCloseUp />}
    </AbsoluteFill>
  );
};
