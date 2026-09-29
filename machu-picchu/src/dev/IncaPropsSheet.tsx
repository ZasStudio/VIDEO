import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
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
  PUTUTU_HOLD_R,
  Pututu,
  QUIPU_HIP_R,
  QUIPU_HOLD_L,
  Quipu,
  Unku,
} from "../three/inca/Costumes";
import { Llama } from "../three/inca/Llama";
import { PapaBot } from "../three/inca/PapaBot";
import { GiantPhone, PHONE_HOLD_R, Phone3D, PhoneScreen } from "../three/inca/Phone3D";
import { PotatoPlant, QhapaqNan, THRONE_SEAT, Terraces, ThroneRoom } from "../three/inca/Sets";

// Review sheet for the Inca-phone 3D props (1920 x 1080).
//   Frame 0: overview of every piece.
//   Frame 1: Nubi's four outfits, front and back.
//   Frame 2: llamas (with Nubi for scale, and the shove), PapaBot, held props, the giant phone.
//   Frame 3: the three sets through the Inca-short scene cameras (vertical framing).

export const INCA_PROPS_SHEET_FRAMES = 4;

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

const Lights: React.FC<{ sky?: string; ground?: string }> = ({ sky = "#FFF6E8", ground = "#6B4A33" }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9} color="#FFD2A0" />
  </>
);

type Outfit = "noble" | "chasqui" | "inca" | "farmer";

/** Nubi in an outfit, with the recommended held props (phone, quipu, chaquitaclla). */
const Dressed: React.FC<{
  kind: Outfit;
  size: number;
  position: Vec3;
  yaw: number;
  pose?: NubiPose;
  phone?: PhoneScreen;
}> = ({ kind, size, position, yaw, pose = {}, phone = "notifs" }) => {
  const holdR =
    kind === "inca" ? (
      <group {...PHONE_HOLD_R}>
        <Phone3D screen={phone} glow={0.6} />
      </group>
    ) : kind === "farmer" ? (
      <Chaquitaclla />
    ) : null;
  return (
    <Nubi size={size} position={position} rotationY={yaw} pose={pose} holdR={holdR}>
      <Unku variant={kind} />
      {kind === "chasqui" ? (
        <>
          <ChasquiHat />
          {/* As in the short: conch on the left hip, quipu on the right hip. */}
          <Pututu strap side={-1} />
          <group {...QUIPU_HIP_R}>
            <Quipu swing={0.4} phase={1.2} />
          </group>
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

const OUTFITS: { kind: Outfit; label: string; pose: NubiPose }[] = [
  { kind: "noble", label: "NOBLE: UNKU", pose: { finL: 0.4, finR: 0.2 } },
  { kind: "chasqui", label: "CHASQUI: UNKU, GORRO, PUTUTU, QUIPU", pose: { finL: 0.25, finR: 0.1, lookX: -0.2 } },
  { kind: "inca", label: "INCA: UNKU, MASCAYPACHA, OREJERAS", pose: { finR: 0.55, lookX: 0.4, lookY: 0.2 } },
  { kind: "farmer", label: "CAMPESINO: UNKU, VINCHA, CHAQUITACLLA", pose: { finR: 0.2, finL: -0.1 } },
];

const SCREENS: PhoneScreen[] = ["home", "chat", "notifs", "camera", "weather", "off"];
const PLANTS: Vec3[] = [
  [0.3, 0, 2.3],
  [1.0, 0, 2.0],
  [1.7, 0, 1.7],
  [2.4, 0, 1.4],
];

const WARM = "linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #C98B4E 62%, #B8763B 100%)";
const MEADOW = "linear-gradient(180deg, #7EC8FF 0%, #BFE6FF 60%, #7CC36A 60%, #5DA84F 100%)";
const THRONE_BG = "radial-gradient(circle at 50% 30%, #FFE08A 0%, #FFB02E 30%, #C2410C 68%, #3B0F05 100%)";

const Overview: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={1150}
      h={600}
      background={WARM}
      title="VESTUARIO DE NUBI"
      cam={{ position: [0, 5.2, 25], target: [0, 1.9, 0], fov: 30 }}
      labels={OUTFITS.map((o, i) => ({ text: o.label.split(":")[0], x: 170 + i * 272, y: 520 }))}
    >
      <Lights />
      {OUTFITS.map((o, i) => (
        <Dressed key={o.kind} kind={o.kind} size={3.3} position={[-8.1 + i * 5.4, 0, 0]} yaw={[-0.3, -0.2, 0.2, -0.3][i]} pose={o.pose} />
      ))}
    </Panel>
    <Panel
      x={1150}
      y={0}
      w={770}
      h={600}
      background="radial-gradient(circle at 50% 40%, #3B4B8C 0%, #1B2140 100%)"
      title="PHONE3D"
      cam={{ position: [0, 0.05, 5.9], target: [0, 0.0, 0], fov: 30 }}
      labels={[
        ...SCREENS.slice(0, 4).map((s, i) => ({ text: s, x: 119 + i * 178, y: 272 })),
        ...SCREENS.slice(4).map((s, i) => ({ text: s, x: 119 + i * 178, y: 512 })),
        { text: "back", x: 119 + 2 * 178, y: 512 },
        { text: "home + glow", x: 119 + 3 * 178, y: 512 },
      ]}
    >
      <Lights sky="#E8F0FF" ground="#2A2F55" />
      {SCREENS.map((s, i) => (
        <group key={s} position={[-1.26 + (i % 4) * 0.84, i < 4 ? 0.66 : -0.62, 0]} rotation={[0, (i % 4) * 0.08 - 0.12, 0]}>
          <Phone3D screen={s} glow={s === "notifs" ? 0.5 : 0} badge={s === "home" ? 3 : undefined} />
        </group>
      ))}
      <group position={[-1.26 + 2 * 0.84, -0.62, 0]} rotation={[0.1, Math.PI - 0.45, 0]}>
        <Phone3D screen="home" />
      </group>
      <group position={[-1.26 + 3 * 0.84, -0.62, 0]} rotation={[0, -0.15, 0]}>
        <Phone3D screen="home" badge={12} glow={1} />
      </group>
    </Panel>
    <Panel
      x={0}
      y={600}
      w={780}
      h={480}
      background={MEADOW}
      title="LLAMAS Y PAPABOT"
      cam={{ position: [0.6, 3.4, 13], target: [0.6, 1.4, 0], fov: 30 }}
      labels={[
        { text: "caminando", x: 150, y: 422 },
        { text: "empujando (lean 1)", x: 380, y: 422 },
        { text: "PapaBot hablando", x: 610, y: 422 },
      ]}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Llama color="brown" size={2.2} position={[-3.3, 0, -0.4]} rotationY={Math.PI / 2 - 0.2} pose={{ walk: 1, walkPhase: 1.1, neck: 0.1 }} />
      <Llama color="white" size={2.2} position={[0.7, 0, 0]} rotationY={-0.55} pose={{ lean: 1, neck: 0.6, headTurn: -0.2, ears: 1 }} />
      <PapaBot size={1.7} position={[4.4, 0, 0.3]} rotationY={-0.25} pose={{ talk: 0.8, glow: 1, hop: 0.5 }} />
    </Panel>
    <Panel x={780} y={600} w={380} h={480} background={THRONE_BG} title="THRONEROOM" cam={{ position: [2.2, 3.2, 12.5], target: [0, 2.7, 0], fov: 40 }}>
      <Lights sky="#FFF1D6" ground="#5A2A10" />
      <ThroneRoom />
      <Dressed kind="inca" size={2.0} position={THRONE_SEAT} yaw={0} pose={{ finR: 0.6, lookX: 0.4, lookY: 0.2 }} phone="chat" />
    </Panel>
    <Panel x={1160} y={600} w={380} h={480} background={skyGradient("day")} title="TERRACES" cam={{ position: [2.4, 4.4, 13], target: [0.2, 1.9, -1], fov: 40 }}>
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Terraces />
      <Dressed kind="farmer" size={1.9} position={[-0.7, 0, 1.6]} yaw={-0.2} pose={{ finR: 0.3 }} />
      <PapaBot size={0.95} position={[0.9, 1.75, 1.9]} pose={{ talk: 0.6, glow: 1 }} />
      {PLANTS.map((p, i) => (
        <group key={i} position={p}>
          <PotatoPlant seed={i + 3} />
        </group>
      ))}
    </Panel>
    <Panel x={1540} y={600} w={380} h={480} background={skyGradient("day")} title="QHAPAQ ÑAN" cam={{ position: [-1.6, 2.6, 12.5], target: [0.7, 1.9, 0], fov: 40 }}>
      <Lights sky="#F2F8FF" ground="#6B5A3A" />
      <QhapaqNan scroll={7.3} />
      <Dressed kind="chasqui" size={1.9} position={[0, 0, 0.3]} yaw={0.95} pose={{ hop: 1.2, pitch: 0.15, finL: 0.8, finR: -0.2, wiggle: 1, wigglePhase: 1.3 }} />
    </Panel>
  </>
);

const OutfitsCloseUp: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={1920}
      h={620}
      background={WARM}
      title="VESTUARIO: DE FRENTE"
      cam={{ position: [0, 3.6, 14.5], target: [0, 2.0, 0], fov: 30 }}
      labels={OUTFITS.map((o, i) => ({ text: o.label, x: [290, 730, 1175, 1615][i], y: 556 }))}
    >
      <Lights />
      {OUTFITS.map((o, i) => (
        <Dressed key={o.kind} kind={o.kind} size={3.5} position={[-8.7 + i * 5.8, 0, 0]} yaw={[-0.25, -0.15, 0.15, -0.3][i]} pose={o.pose} />
      ))}
    </Panel>
    <Panel x={0} y={620} w={1920} h={460} background={WARM} title="DE ESPALDAS" cam={{ position: [0, 3.2, 11.5], target: [0, 1.75, 0], fov: 30 }}>
      <Lights />
      {OUTFITS.map((o, i) => (
        <Dressed key={o.kind} kind={o.kind} size={3.0} position={[-9.3 + i * 6.2, 0, 0]} yaw={[2.6, 2.3, -2.3, -2.6][i]} pose={o.pose} />
      ))}
    </Panel>
  </>
);

const CharactersCloseUp: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={960}
      h={540}
      background={MEADOW}
      title="LLAMAS vs NUBI (MISMO SIZE)"
      cam={{ position: [0, 3.6, 13.5], target: [0, 1.5, 0], fov: 30 }}
      labels={[
        { text: "blanca, de frente", x: 210, y: 478 },
        { text: "Nubi size 2.2", x: 470, y: 478 },
        { text: "café, walk 1", x: 730, y: 478 },
      ]}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Llama color="white" size={2.2} position={[-3.4, 0, 0]} rotationY={0.25} pose={{ headTurn: 0.15, blink: 0 }} />
      <Nubi size={2.2} position={[0, 0, 0.5]} pose={{ lookX: -0.3 }}>
        <Unku variant="noble" />
      </Nubi>
      <Llama color="cream" size={2.2} position={[3.6, 0, -0.5]} rotationY={-Math.PI / 2 + 0.35} pose={{ walk: 1, walkPhase: 2.2, neck: -0.1, ears: -0.3 }} tassels={false} />
    </Panel>
    <Panel
      x={960}
      y={0}
      w={960}
      h={540}
      background="linear-gradient(160deg, #2E8BFF 0%, #7B61FF 100%)"
      title="EL EMPUJÓN (lean 1, neck 0.6, ears 1)"
      cam={{ position: [0.6, 2.2, 11], target: [0.4, 1.4, 0], fov: 30 }}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Nubi size={2.1} position={[-1.45, 0.3, 0.1]} rotationY={0.15} pose={{ roll: 0.45, finL: 1.2, finR: 1.0, eyeScale: 1.4, lookX: 0.7 }}>
        <Unku variant="noble" />
      </Nubi>
      <Llama color="white" size={2.0} position={[0.95, 0, -0.55]} rotationY={-1.2} pose={{ lean: 1, neck: 0.6, headTurn: 0.35, ears: 1 }} />
    </Panel>
    <Panel
      x={0}
      y={540}
      w={640}
      h={540}
      background="radial-gradient(circle at 50% 35%, #BFF6FF 0%, #5BB8E8 55%, #2A5C9A 100%)"
      title="PAPABOT (talk 1, glow 1.2)"
      cam={{ position: [0, 4.6, 12.5], target: [0, 1.25, 0], fov: 30 }}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <PapaBot size={2.2} position={[-1.3, 0, 0]} rotationY={0.2} pose={{ talk: 1, glow: 1.2, hop: 0.8, squash: 1.06 }} />
      <PapaBot size={1.2} position={[2.0, 0, 0.6]} rotationY={-0.4} pose={{ talk: 0, glow: 0.6, blink: 1, squash: 0.9 }} />
    </Panel>
    <Panel
      x={640}
      y={540}
      w={640}
      h={540}
      background={WARM}
      title="EN LA ALETA: PHONE / PUTUTU / QUIPU"
      cam={{ position: [-0.2, 2.7, 12.5], target: [-0.2, 1.3, 0], fov: 30 }}
    >
      <Lights />
      <Nubi
        size={2.2}
        position={[-2.0, 0, 0]}
        rotationY={-0.15}
        pose={{ finR: 0.7, lookX: 0.6, lookY: 0.3 }}
        holdR={
          <group {...PHONE_HOLD_R}>
            <Phone3D screen="chat" glow={0.7} />
          </group>
        }
      >
        <Unku variant="inca" />
        <Mascaypacha />
        <EarSpools />
      </Nubi>
      <Nubi
        size={2.2}
        position={[1.1, 0, 0]}
        rotationY={0.1}
        pose={{ finR: 0.9, finL: 0.3, lookX: 0.3 }}
        holdR={
          <group {...PUTUTU_HOLD_R}>
            <Pututu />
          </group>
        }
        holdL={
          <group {...QUIPU_HOLD_L}>
            <Quipu swing={-0.4} phase={0.6} />
          </group>
        }
      >
        <Unku variant="chasqui" />
        <ChasquiHat />
      </Nubi>

    </Panel>
    <Panel
      x={1280}
      y={540}
      w={640}
      h={540}
      background={skyGradient("day")}
      title="CHAQUITACLLA / GIANTPHONE"
      cam={{ position: [0, 2.5, 12], target: [0, 1.5, 0], fov: 30 }}
    >
      <Lights sky="#F4FBFF" ground="#5C7A3A" />
      <Nubi size={2.1} position={[-1.7, 0, 0]} rotationY={-0.3} pose={{ finR: 0.15 }} holdR={<Chaquitaclla />}>
        <Unku variant="farmer" />
        <FarmerBand />
      </Nubi>
      <Nubi
        size={2.1}
        position={[1.5, 0, 0]}
        rotationY={-0.1}
        pose={{ finR: 0.8, finL: 0.8, eyeScale: 1.3, lookX: 0.5, lookY: 0.5, squash: 0.9 }}
        holdR={
          <group position={[0.9, -0.4, 0.9]}>
            <GiantPhone height={8} screen="home" glow={0.8} />
          </group>
        }
      >
        <Unku variant="noble" />
      </Nubi>
    </Panel>
  </>
);

const SetsCloseUp: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background={THRONE_BG} title="THRONEROOM (cámara IncaThrone)" cam={{ position: [0.5, 2.2, 8.6], target: [0.1, 2.6, 0], fov: 42 }}>
      <hemisphereLight args={["#FFF1D6", "#5A2A10", 1.25]} />
      <directionalLight position={[-5, 9, 8]} intensity={2.4} color="#FFF4E0" />
      <directionalLight position={[6, 4, -5]} intensity={1.0} color="#FFB36B" />
      <ThroneRoom flicker={3} />
      <Dressed kind="inca" size={2.0} position={THRONE_SEAT} yaw={0} pose={{ finR: 0.55, lookX: 0.4 }} phone="notifs" />
    </Panel>
    <Panel x={640} y={0} w={640} h={1080} background={skyGradient("day")} title="TERRACES (cámara IncaPapa)" cam={{ position: [0.7, 2.6, 9.4], target: [0.3, 2.3, 0], fov: 42 }}>
      <hemisphereLight args={["#F4FBFF", "#5C7A3A", 1.3]} />
      <directionalLight position={[-6, 10, 8]} intensity={2.5} color="#FFF6E4" />
      <directionalLight position={[7, 4, -4]} intensity={0.9} color="#BFE3FF" />
      <Terraces />
      <Dressed kind="farmer" size={1.9} position={[-0.7, 0, 1.6]} yaw={0.3} pose={{ finR: 0.35, finL: 0.25 }} />
      <PapaBot size={0.95} position={[0.9, 1.75, 1.9]} pose={{ talk: 0.5, glow: 1 }} />
      {PLANTS.map((p, i) => (
        <group key={i} position={p}>
          <PotatoPlant seed={i + 3} />
        </group>
      ))}
    </Panel>
    <Panel x={1280} y={0} w={640} h={1080} background={skyGradient("day")} title="QHAPAQ ÑAN (cámara IncaChasqui)" cam={{ position: [-1.1, 2.0, 9.2], target: [0.7, 2.1, 0], fov: 42 }}>
      <hemisphereLight args={["#F2F8FF", "#6B5A3A", 1.3]} />
      <directionalLight position={[-6, 10, 8]} intensity={2.5} color="#FFF4E0" />
      <directionalLight position={[7, 4, -4]} intensity={0.9} color="#FFD2A0" />
      <QhapaqNan scroll={23.5} />
      <Dressed kind="chasqui" size={1.9} position={[0, 0, 0.3]} yaw={0.95} pose={{ hop: 1.0, pitch: 0.15, finL: 0.9, finR: -0.1, wiggle: 1, wigglePhase: 1.3 }} />
    </Panel>
  </>
);

export const IncaPropsSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #2B1B4A 0%, #5A2A6E 50%, #8C3B3B 100%)" }}>
      {frame === 0 ? <Overview /> : frame === 1 ? <OutfitsCloseUp /> : frame === 2 ? <CharactersCloseUp /> : <SetsCloseUp />}
    </AbsoluteFill>
  );
};
