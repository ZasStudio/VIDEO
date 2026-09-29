import React from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";
import { skyGradient } from "../three/World";
import {
  ChasquiHat,
  Chaquitaclla,
  EarSpools,
  FarmerBand,
  Mascaypacha,
  Pututu,
  QUIPU_HOLD_L,
  Quipu,
  Unku,
} from "../three/inca/Costumes";
import { Llama } from "../three/inca/Llama";
import { PapaBot } from "../three/inca/PapaBot";
import { PHONE_HOLD_R, Phone3D, PhoneScreen } from "../three/inca/Phone3D";
import { PotatoPlant, QhapaqNan, THRONE_SEAT, Terraces, ThroneRoom } from "../three/inca/Sets";

// Review sheet for the Inca-phone 3D props: Nubi in each outfit (front and back), the phone
// screens, the llamas and PapaBot, and small views of the three sets with Nubi in place.

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
      camera={{ position: cam.position, fov: cam.fov, near: 0.3, far: 900 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div
      style={{
        position: "absolute",
        left: 20,
        top: 14,
        fontFamily: FONT.fun,
        fontSize: 30,
        color: "#FFFFFF",
        textShadow: "0 3px 0 rgba(0,0,0,0.35)",
      }}
    >
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
          background: "rgba(0,0,0,0.35)",
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

const Lights: React.FC<{ sky?: string; ground?: string }> = ({ sky = "#FFF6E8", ground = "#6B4A33" }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9} color="#FFD2A0" />
  </>
);

type Outfit = "noble" | "chasqui" | "inca" | "farmer";

const Dressed: React.FC<{ kind: Outfit; size: number; position: Vec3; yaw: number; pose?: NubiPose; phone?: PhoneScreen }> = ({
  kind,
  size,
  position,
  yaw,
  pose = {},
  phone = "notifs",
}) => {
  const holdR =
    kind === "inca" ? (
      <group {...PHONE_HOLD_R}>
        <Phone3D screen={phone} glow={0.6} />
      </group>
    ) : kind === "farmer" ? (
      <Chaquitaclla />
    ) : null;
  const holdL =
    kind === "chasqui" ? (
      <group {...QUIPU_HOLD_L}>
        <Quipu swing={0.5} phase={1.2} />
      </group>
    ) : null;
  return (
    <Nubi size={size} position={position} rotationY={yaw} pose={pose} holdR={holdR} holdL={holdL}>
      <Unku variant={kind} />
      {kind === "chasqui" ? (
        <>
          <ChasquiHat />
          <Pututu strap />
        </>
      ) : null}
      {kind === "inca" ? (
        <>
          <Mascaypacha />
          <EarSpools />
        </>
      ) : null}
      {kind === "farmer" ? <FarmerBand /> : null}
    </Nubi>
  );
};

const OUTFITS: { kind: Outfit; pose: NubiPose }[] = [
  { kind: "noble", pose: { finL: 0.4, finR: 0.2 } },
  { kind: "chasqui", pose: { finL: 0.35, finR: 0.1, lookX: -0.2 } },
  { kind: "inca", pose: { finR: 0.55, lookX: 0.4, lookY: 0.2 } },
  { kind: "farmer", pose: { finR: 0.2, finL: -0.1 } },
];

const SCREENS: PhoneScreen[] = ["home", "chat", "notifs", "camera", "weather", "off"];

export const IncaPropsSheet: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(135deg, #2B1B4A 0%, #5A2A6E 50%, #8C3B3B 100%)" }}>
    {/* Nubi in the four outfits: front 3/4 (top) and back 3/4 (bottom). */}
    <Panel
      x={0}
      y={0}
      w={1150}
      h={600}
      background="linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #C98B4E 62%, #B8763B 100%)"
      title="VESTUARIO DE NUBI"
      cam={{ position: [0, 6.5, 30], target: [0, 1.6, 0], fov: 30 }}
      labels={[
        { text: "NOBLE", x: 205, y: 548 },
        { text: "CHASQUI + GORRO, PUTUTU, QUIPU", x: 425, y: 548 },
        { text: "INCA + MASCAYPACHA, OREJERAS", x: 690, y: 548 },
        { text: "CAMPESINO + VINCHA, CHAQUITACLLA", x: 945, y: 548 },
      ]}
    >
      <Lights />
      {OUTFITS.map((o, i) => (
        <Dressed key={o.kind} kind={o.kind} size={2.9} position={[-7.5 + i * 5, 1.2, 0]} yaw={[-0.35, -0.25, 0.25, 0.35][i]} pose={o.pose} />
      ))}
      {OUTFITS.map((o, i) => (
        <Dressed key={`b${o.kind}`} kind={o.kind} size={1.45} position={[-5.7 + i * 3.9, -3.5, 4]} yaw={[2.5, 2.2, -2.3, -2.6][i]} pose={o.pose} />
      ))}
    </Panel>

    {/* Phone screens (and the back). */}
    <Panel
      x={1150}
      y={0}
      w={770}
      h={600}
      background="radial-gradient(circle at 50% 40%, #3B4B8C 0%, #1B2140 100%)"
      title="PHONE3D"
      cam={{ position: [0, 0.1, 6.1], target: [0, 0.05, 0], fov: 30 }}
      labels={[
        ...SCREENS.slice(0, 4).map((s, i) => ({ text: s, x: 118 + i * 178, y: 268 })),
        ...SCREENS.slice(4).map((s, i) => ({ text: s, x: 118 + i * 178, y: 542 })),
        { text: "back", x: 118 + 2 * 178, y: 542 },
        { text: "home + glow", x: 118 + 3 * 178, y: 542 },
      ]}
    >
      <Lights sky="#E8F0FF" ground="#2A2F55" />
      {SCREENS.map((s, i) => (
        <group key={s} position={[-1.29 + (i % 4) * 0.86, i < 4 ? 0.62 : -0.66, 0]} rotation={[0, (i % 4) * 0.08 - 0.12, 0]}>
          <Phone3D screen={s} glow={s === "notifs" ? 0.5 : 0} badge={s === "home" ? 3 : undefined} />
        </group>
      ))}
      <group position={[-1.29 + 2 * 0.86, -0.66, 0]} rotation={[0.1, Math.PI - 0.45, 0]}>
        <Phone3D screen="home" />
      </group>
      <group position={[-1.29 + 3 * 0.86, -0.66, 0]} rotation={[0, -0.15, 0]}>
        <Phone3D screen="home" badge={12} glow={1} />
      </group>
    </Panel>

    {/* Llamas, PapaBot and Nubi for scale. */}
    <Panel
      x={0}
      y={600}
      w={780}
      h={480}
      background="linear-gradient(180deg, #7EC8FF 0%, #BFE6FF 60%, #7CC36A 60%, #5DA84F 100%)"
      title="LLAMAS Y PAPABOT"
      cam={{ position: [0.2, 3.6, 13.5], target: [0.2, 1.35, 0], fov: 30 }}
      labels={[
        { text: "llama café caminando", x: 150, y: 430 },
        { text: "llama blanca empujando (lean 1)", x: 395, y: 430 },
        { text: "PapaBot (talk 0.8)", x: 640, y: 430 },
      ]}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Llama color="brown" size={2.1} position={[-3.6, 0, -0.6]} rotationY={Math.PI / 2 - 0.25} pose={{ walk: 1, walkPhase: 1.1, neck: 0.1, blink: 0 }} />
      <Nubi size={2.1} position={[-0.9, 0.4, 0.6]} rotationY={0.4} pose={{ roll: 0.45, finL: 1.1, finR: 0.9, eyeScale: 1.35, lookX: 0.6 }}>
        <Unku variant="noble" />
      </Nubi>
      <Llama color="white" size={2.1} position={[1.0, 0, -0.2]} rotationY={-0.75} pose={{ lean: 1, neck: 0.65, headTurn: -0.25, ears: 1, blink: 0.1 }} />
      <PapaBot size={1.5} position={[4.3, 0, 0.2]} rotationY={-0.25} pose={{ talk: 0.8, glow: 1, hop: 0.6 }} />
    </Panel>

    {/* The three sets, framed roughly like the scenes, with Nubi in place. */}
    <Panel
      x={780}
      y={600}
      w={380}
      h={480}
      background="radial-gradient(circle at 50% 30%, #FFE08A 0%, #FFB02E 30%, #C2410C 68%, #3B0F05 100%)"
      title="THRONEROOM"
      cam={{ position: [2.2, 3.2, 12.5], target: [0, 2.7, 0], fov: 40 }}
    >
      <Lights sky="#FFF1D6" ground="#5A2A10" />
      <ThroneRoom />
      <Dressed kind="inca" size={2.0} position={THRONE_SEAT} yaw={0} pose={{ finR: 0.6, lookX: 0.4, lookY: 0.2 }} phone="chat" />
    </Panel>
    <Panel
      x={1160}
      y={600}
      w={380}
      h={480}
      background={skyGradient("day")}
      title="TERRACES"
      cam={{ position: [2.4, 4.4, 13], target: [0.2, 1.9, -1], fov: 40 }}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Terraces />
      <Dressed kind="farmer" size={1.9} position={[-0.7, 0, 1.6]} yaw={0.3} pose={{ finR: 0.3 }} />
      <PapaBot size={0.95} position={[0.9, 1.75, 1.9]} pose={{ talk: 0.6, glow: 1 }} />
      {(
        [
          [0.3, 0, 2.3],
          [1.0, 0, 2.0],
          [1.7, 0, 1.7],
          [2.4, 0, 1.4],
        ] as Vec3[]
      ).map((p, i) => (
        <group key={i} position={p}>
          <PotatoPlant seed={i + 3} />
        </group>
      ))}
    </Panel>
    <Panel
      x={1540}
      y={600}
      w={380}
      h={480}
      background={skyGradient("day")}
      title="QHAPAQ ÑAN"
      cam={{ position: [-1.6, 2.6, 12.5], target: [0.7, 1.9, 0], fov: 40 }}
    >
      <Lights sky="#F2F8FF" ground="#6B5A3A" />
      <QhapaqNan scroll={7.3} />
      <Dressed
        kind="chasqui"
        size={1.9}
        position={[0, 0, 0.3]}
        yaw={0.95}
        pose={{ hop: 1.2, pitch: 0.15, finL: 0.8, finR: -0.2, wiggle: 1, wigglePhase: 1.3 }}
      />
    </Panel>
  </AbsoluteFill>
);
