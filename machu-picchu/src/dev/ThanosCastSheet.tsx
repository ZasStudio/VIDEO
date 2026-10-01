import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3, projectToScreen } from "../three/CameraRig";
import { Nubi, NubiPalette, NubiPose } from "../three/Nubi";
import {
  ARMY_COLORS,
  ArmyCrowd,
  CAST,
  CapOutfit,
  DoomArmor,
  FalconOutfit,
  GrootLook,
  IronOutfit,
  PantherSuit,
  SpiderSuit,
  StarLordOutfit,
  StrangeOutfit,
  ThanosArmor,
  ThorOutfit,
  WitchOutfit,
} from "../three/thanos/Costumes";

// Review sheet for the Thanos-short cast (1920 x 1080). Heroes at size 2, Thanos at size 3.
//   Frame 0: the whole cast in a lineup, front and 3/4.
//   Frame 1: backs (capes, wings) and capes fluttering at wind 0.15 and 1.
//   Frame 2: face close-ups: Nubi's own eyes in Thor / Cap / Strange (big, looking round), the
//            drawn eyes of the masks (blink, charge), Doom eyeGlow 0 vs 1.
//   Frame 3: Thanos (size 3) next to Nubi (size 2), the ArmyCrowd (150), Falcon wings open
//            0 / 0.5 / 1, Witch hex 0 / 0.5 / 1, Iron charge and a phone-sized vertical crop.

export const THANOS_CAST_SHEET_FRAMES = 7;

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
      camera={{ position: cam.position, fov: cam.fov, near: 0.1, far: 1200 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 20, top: 14, fontFamily: FONT.fun, fontSize: 28, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.35)" }}>
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
          fontSize: 15,
          color: "#FFFFFF",
          background: "rgba(0,0,0,0.38)",
          padding: "3px 8px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        {l.text}
      </div>
    ))}
  </div>
);

const Lights: React.FC<{ sky?: string; ground?: string; k?: number }> = ({ sky = "#FFF6E8", ground = "#4A4060", k = 1 }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3 * k]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4 * k} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9 * k} color="#D8C8FF" />
  </>
);

const Ground: React.FC<{ color?: string; radius?: number }> = ({ color = "#6E5A8E", radius = 80 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
    <circleGeometry args={[radius, 64]} />
    <meshStandardMaterial color={color} roughness={1} emissive={color} emissiveIntensity={0.08} />
  </mesh>
);

/** Thin horizontal guide at a given height (z = 0 plane). */
const Guide: React.FC<{ y: number; color: string; width?: number; x?: number }> = ({ y, color, width = 40, x = 0 }) => (
  <mesh position={[x, y, 0]}>
    <boxGeometry args={[width, 0.03, 0.03]} />
    <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.8} />
  </mesh>
);

type Who = "nubi" | "thor" | "cap" | "iron" | "strange" | "spider" | "panther" | "witch" | "groot" | "starlord" | "falcon" | "doom" | "thanos";

const PALETTE: Partial<Record<Who, NubiPalette>> = {
  spider: CAST.spider,
  panther: CAST.panther,
  witch: CAST.witch,
  groot: CAST.groot,
  starlord: CAST.starlord,
  falcon: CAST.falcon,
  doom: CAST.doom,
  thanos: CAST.thanos,
};
const HIDE_EYES: Who[] = ["iron", "spider", "panther", "starlord", "doom"];

type Extra = { charge?: number; eyeGlow?: number; hex?: number; open?: number; brow?: number; wind?: number };

const T = 1.3;

const Character: React.FC<{ who: Who; position: Vec3; yaw?: number; pose?: NubiPose; size?: number; t?: number; extra?: Extra }> = ({
  who,
  position,
  yaw = 0,
  pose = {},
  size,
  t = T,
  extra = {},
}) => {
  const wind = extra.wind ?? 0.25;
  const costume =
    who === "thor" ? (
      <ThorOutfit t={t} wind={wind} />
    ) : who === "cap" ? (
      <CapOutfit />
    ) : who === "iron" ? (
      <IronOutfit charge={extra.charge ?? 0} pose={pose} />
    ) : who === "strange" ? (
      <StrangeOutfit t={t} wind={wind} />
    ) : who === "spider" ? (
      <SpiderSuit pose={pose} />
    ) : who === "panther" ? (
      <PantherSuit pose={pose} />
    ) : who === "witch" ? (
      <WitchOutfit t={t} wind={wind} hex={extra.hex ?? 0} finL={pose.finL} finR={pose.finR} />
    ) : who === "groot" ? (
      <GrootLook t={t} />
    ) : who === "starlord" ? (
      <StarLordOutfit pose={pose} />
    ) : who === "falcon" ? (
      <FalconOutfit open={extra.open ?? 0} />
    ) : who === "doom" ? (
      <DoomArmor t={t} wind={wind} eyeGlow={extra.eyeGlow ?? 1} pose={pose} />
    ) : who === "thanos" ? (
      <ThanosArmor brow={extra.brow} />
    ) : null;
  return (
    <Nubi
      size={size ?? (who === "thanos" ? 3 : 2)}
      position={position}
      rotationY={yaw}
      pose={pose}
      palette={PALETTE[who]}
      hideEyes={HIDE_EYES.includes(who)}
    >
      {costume}
    </Nubi>
  );
};

const NAMES: Record<Who, string> = {
  nubi: "Nubi",
  thor: "Thor",
  cap: "Cap",
  iron: "Iron",
  strange: "Strange",
  spider: "Spider",
  panther: "Panther",
  witch: "Witch",
  groot: "Groot",
  starlord: "StarLord",
  falcon: "Falcon",
  doom: "Doom",
  thanos: "Thanos (3)",
};

const ROW_A: Who[] = ["nubi", "thor", "cap", "iron", "strange", "spider", "panther"];
const ROW_B: Who[] = ["witch", "groot", "starlord", "falcon", "doom", "thanos", "nubi"];
const rowX = (row: Who[]) => row.map((w, i) => -8.7 + i * 2.9 + (w === "thanos" ? 0.35 : 0) + (row === ROW_B && w === "nubi" ? 0.55 : 0));

const STAGE = "linear-gradient(180deg, #2A1F4E 0%, #5B3F9A 58%, #3B2A62 58%, #2A1F48 100%)";
const SKY = "linear-gradient(180deg, #7EC8FF 0%, #BFE6FF 58%, #8C7BC0 58%, #6E5A8E 100%)";
const WARM = "linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #B08AC9 62%, #8A6AA8 100%)";
const PLAIN = "radial-gradient(circle at 50% 40%, #FFF4DE 0%, #E8CFA0 100%)";
const NIGHT = "radial-gradient(circle at 50% 35%, #3A3070 0%, #120E2A 100%)";

const ROW_CAM: Cam = { position: [0, 2.7, 11.6], target: [0, 1.45, 0], fov: 30 };
const rowLabels = (row: Who[], w: number, cam: Cam) =>
  row.map((who, i) => ({ text: `${NAMES[who]}${i === row.length - 1 && who === "nubi" ? " " : ""}`, x: projectToScreen(cam, [rowX(row)[i], 0, 0.6], w - 16, 524).x, y: 478 }));

const Row: React.FC<{ row: Who[]; y: number; title: string; bg: string; view: "front" | "34" | "back" }> = ({ row, y, title, bg, view }) => (
  <Panel x={0} y={y} w={1920} h={540} background={bg} title={title} cam={ROW_CAM} labels={rowLabels(row, 1920, ROW_CAM)}>
    <Lights />
    <Ground />
    {row.map((who, i) => (
      <Character
        key={`${who}${i}`}
        who={who}
        position={[rowX(row)[i], 0, 0]}
        yaw={view === "front" ? 0 : view === "34" ? (i % 2 ? -0.62 : 0.62) : Math.PI + (i % 2 ? -0.5 : 0.5)}
        pose={view === "34" ? { lookX: i % 2 ? -0.4 : 0.4, finR: who === "witch" ? 0.7 : 0.15, finL: who === "witch" ? 0.4 : 0 } : {}}
        extra={view === "34" ? { open: 1, hex: 0.8, charge: 0.5 } : {}}
      />
    ))}
  </Panel>
);

const Lineup: React.FC = () => (
  <>
    <Row row={ROW_A} y={0} bg={SKY} view="front" title="REPARTO: FRENTE (size 2)" />
    <Row row={ROW_B} y={540} bg={STAGE} view="front" title="FRENTE (Thanos size 3, Nubi 2 para escala)" />
  </>
);

const Lineup34: React.FC = () => (
  <>
    <Row row={ROW_A} y={0} bg={SKY} view="34" title="3/4 (Iron charge 0.5)" />
    <Row row={ROW_B} y={540} bg={STAGE} view="34" title="3/4 (Falcon open 1, Witch hex 0.8)" />
  </>
);

const CAPED: Who[] = ["thor", "strange", "witch", "doom"];
const CAPE_X = [-4.95, -1.65, 1.65, 4.95];
const CAPE_CAM: Cam = { position: [-6.5, 4.6, -11.5], target: [0, 1.4, 0], fov: 32 };
const SIDE_CAM: Cam = { position: [13, 2.6, 1.5], target: [0, 1.3, 0], fov: 32 };

const Backs: React.FC = () => (
  <>
    <Row row={ROW_A} y={0} bg={WARM} view="back" title="DE ESPALDAS" />
    <Panel x={0} y={540} w={640} h={540} background={SKY} title="CAPAS wind 0.15" cam={CAPE_CAM}>
      <Lights />
      <Ground />
      {CAPED.map((who, i) => (
        <Character key={who} who={who} position={[CAPE_X[i], 0, 0]} yaw={0.2} extra={{ wind: 0.15 }} />
      ))}
    </Panel>
    <Panel x={640} y={540} w={640} h={540} background={SKY} title="CAPAS wind 1" cam={CAPE_CAM}>
      <Lights />
      <Ground />
      {CAPED.map((who, i) => (
        <Character key={who} who={who} position={[CAPE_X[i], 0, 0]} yaw={0.2} extra={{ wind: 1 }} pose={{ pitch: 0.12 }} />
      ))}
    </Panel>
    <Panel x={1280} y={540} w={640} h={540} background={SKY} title="PERFIL wind 0.15 / 0.5 / 1" cam={SIDE_CAM}>
      <Lights />
      <Ground />
      {[0.15, 0.5, 1].map((w, i) => (
        <Character key={w} who={i === 1 ? "strange" : "thor"} position={[0, 0, 3.3 - i * 3.3]} yaw={Math.PI / 2 - 0.15} extra={{ wind: w }} t={T + i * 0.4} />
      ))}
    </Panel>
  </>
);

const BacksB: React.FC = () => (
  <>
    <Row row={ROW_B} y={0} bg={WARM} view="back" title="DE ESPALDAS (alas cerradas)" />
    <Panel x={0} y={540} w={960} h={540} background={SKY} title="FALCON espalda open 0 / 0.5 / 1" cam={{ position: [0, 2.6, -14], target: [0, 1.4, 0], fov: 32 }}>
      <Lights />
      <Ground />
      {[0, 0.5, 1].map((o, i) => (
        <Character key={o} who="falcon" position={[(1 - i) * 3.6, 0, 0]} yaw={Math.PI} extra={{ open: o }} />
      ))}
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background={STAGE} title="CAPAS 3/4 frente wind 0.6" cam={{ position: [5.5, 3.2, 12], target: [0, 1.4, 0], fov: 32 }}>
      <Lights />
      <Ground />
      {CAPED.map((who, i) => (
        <Character key={who} who={who} position={[CAPE_X[i] * 0.9, 0, -i * 0.6]} yaw={-0.5} extra={{ wind: 0.6 }} t={T + i * 0.3} pose={{ finR: 0.4 }} />
      ))}
    </Panel>
  </>
);

const FACE_CAM: Cam = { position: [0, 1.55, 12.6], target: [0, 1.2, 0], fov: 30 };
const FACE_X = [-2.45, 0, 2.45];
const faceLabels = (texts: string[]) => texts.map((text, i) => ({ text, x: projectToScreen(FACE_CAM, [FACE_X[i], 0, 0], 624, 524).x, y: 470 }));

const FacePanel: React.FC<{ x: number; y: number; title: string; items: { who: Who; pose?: NubiPose; extra?: Extra; label: string; yaw?: number }[]; bg?: string }> = ({
  x,
  y,
  title,
  items,
  bg = PLAIN,
}) => (
  <Panel x={x} y={y} w={640} h={540} background={bg} title={title} cam={FACE_CAM} labels={faceLabels(items.map((i) => i.label))}>
    <Lights sky={bg === NIGHT ? "#C8C0FF" : "#FFF6E8"} k={bg === NIGHT ? 0.8 : 1} />
    {items.map((it, i) => (
      <Character key={i} who={it.who} position={[FACE_X[i], 0, 0]} yaw={it.yaw ?? (i - 1) * -0.18} pose={it.pose} extra={it.extra} />
    ))}
  </Panel>
);

const Faces: React.FC = () => (
  <>
    <FacePanel
      x={0}
      y={0}
      title="OJOS DE NUBI LIBRES"
      items={[
        { who: "thor", pose: { eyeScale: 1.35, lookY: 0.9 }, label: "Thor eyes 1.35, lookY 1" },
        { who: "cap", pose: { eyeScale: 1.35, lookX: -1, lookY: -0.8 }, label: "Cap lookX -1, Y -0.8" },
        { who: "strange", pose: { eyeScale: 1.3, lookX: 1, lookY: 0.6 }, label: "Strange look 1, 0.6" },
      ]}
    />
    <FacePanel
      x={640}
      y={0}
      title="IRON: charge 0 / 1, blink"
      bg={NIGHT}
      items={[
        { who: "iron", extra: { charge: 0 }, label: "charge 0" },
        { who: "iron", extra: { charge: 1 }, pose: { eyeScale: 1.2 }, label: "charge 1, eyes 1.2" },
        { who: "iron", pose: { blink: 0.8 }, label: "blink 0.8" },
      ]}
    />
    <FacePanel
      x={1280}
      y={0}
      title="SPIDER / PANTHER lentes"
      items={[
        { who: "spider", label: "Spider" },
        { who: "spider", pose: { blink: 0.55, eyeScale: 0.9 }, label: "blink 0.55" },
        { who: "panther", pose: { eyeScale: 1.2 }, label: "Panther eyes 1.2" },
      ]}
    />
    <FacePanel
      x={0}
      y={540}
      title="DOOM eyeGlow 0 / 1 (+ lookX)"
      bg={NIGHT}
      items={[
        { who: "doom", extra: { eyeGlow: 0 }, label: "eyeGlow 0" },
        { who: "doom", extra: { eyeGlow: 1 }, label: "eyeGlow 1" },
        { who: "doom", extra: { eyeGlow: 0.6 }, pose: { lookX: -1, blink: 0.3 }, label: "0.6, lookX -1" },
      ]}
    />
    <FacePanel
      x={640}
      y={540}
      title="STARLORD / GROOT / WITCH"
      items={[
        { who: "starlord", label: "StarLord" },
        { who: "groot", pose: { eyeScale: 1.25, lookY: 0.4 }, label: "Groot eyes 1.25" },
        { who: "witch", pose: { lookX: -0.6, eyeScale: 1.2 }, label: "Witch" },
      ]}
    />
    <Panel x={1280} y={540} w={640} h={540} background={PLAIN} title="THANOS brow 1 / -1 + FALCON" cam={{ position: [0, 2.0, 12.5], target: [0, 1.7, 0], fov: 30 }}>
      <Lights />
      <Character who="thanos" position={[-1.7, 0, 0]} yaw={0.2} extra={{ brow: 1 }} />
      <Character who="thanos" position={[1.9, 0, -1]} yaw={-0.2} extra={{ brow: -1 }} pose={{ eyeScale: 1.3 }} />
      <Character who="falcon" position={[0.2, 0, 2.6]} yaw={-0.1} pose={{ lookX: 0.6, eyeScale: 1.2 }} />
    </Panel>
  </>
);

const SCALE_CAM: Cam = { position: [0.6, 3.4, 15], target: [0.4, 2.0, 0], fov: 30 };

const ScaleAndArmy: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={960}
      h={540}
      background={STAGE}
      title="ESCALA: Thanos size 3 vs Nubi size 2 (guías 1.98 / 2.97 / top 3.7)"
      cam={SCALE_CAM}
    >
      <Lights />
      <Ground />
      <Guide y={1.98} color="#FFFFFF" />
      <Guide y={2.97} color="#FFE14D" />
      <Guide y={3.7} color="#FF3D6E" />
      <Character who="thanos" position={[1.6, 0, -0.6]} yaw={-0.35} extra={{ brow: 0.8 }} pose={{ finL: 0.5 }} />
      <Character who="nubi" position={[-1.9, 0, 0.8]} yaw={0.45} pose={{ eyeScale: 1.3, lookY: 0.6, lookX: 0.5 }} />
      <Character who="thor" position={[-4.2, 0, -0.2]} yaw={0.6} pose={{ lookX: 0.6 }} />
    </Panel>
    <Panel x={960} y={0} w={960} h={540} background={NIGHT} title="ARMYCROWD 150 (march 1) + ejército héroes" cam={{ position: [0, 9, 26], target: [0, 0.5, -8], fov: 40 }}>
      <Lights sky="#C8C0FF" k={0.9} />
      <Ground color="#4A3E6A" radius={120} />
      <ArmyCrowd t={T} count={150} area={[-16, -24, 0, -4]} colors={ARMY_COLORS.villains} facing={0.35} march={1} size={0.9} seed={3} />
      <ArmyCrowd t={T} count={60} area={[3, -20, 16, -4]} colors={ARMY_COLORS.heroes} helmet="#E2A93B" crest="#2457D6" facing={-0.35} spears={false} reveal={0.7} size={0.9} seed={11} />
      <Character who="nubi" position={[0, 0, 4]} yaw={0} />
    </Panel>
    <Panel
      x={0}
      y={540}
      w={640}
      h={540}
      background={SKY}
      title="FALCON open 0 / 0.5 / 1"
      cam={{ position: [0, 1.8, 15], target: [0, 1.3, 0], fov: 30 }}
      labels={[
        { text: "open 0", x: 120, y: 470 },
        { text: "open 0.5", x: 312, y: 470 },
        { text: "open 1", x: 500, y: 470 },
      ]}
    >
      <Lights />
      {[0, 0.5, 1].map((o, i) => (
        <Character key={o} who="falcon" position={[(i - 1) * 3.9, 0, 0]} extra={{ open: o }} yaw={(1 - i) * 0.25} />
      ))}
    </Panel>
    <Panel
      x={640}
      y={540}
      w={640}
      h={540}
      background={NIGHT}
      title="WITCH hex 0 / 0.5 / 1"
      cam={{ position: [0, 1.6, 12], target: [0, 1.2, 0], fov: 30 }}
      labels={[
        { text: "hex 0", x: 130, y: 470 },
        { text: "hex 0.5 fins 0.5", x: 312, y: 470 },
        { text: "hex 1 fins 1", x: 495, y: 470 },
      ]}
    >
      <Lights sky="#FFC8D8" k={0.85} />
      {[0, 0.5, 1].map((h, i) => (
        <Character key={h} who="witch" position={[(i - 1) * 3.0, 0, 0]} extra={{ hex: h }} pose={{ finL: h, finR: h, eyeScale: 1 + h * 0.2 }} t={T + i} />
      ))}
    </Panel>
    <Panel x={1280} y={540} w={360} h={540} background={STAGE} title="TELÉFONO" cam={{ position: [0, 2.6, 17], target: [0, 2.1, 0], fov: 40 }}>
      <Lights />
      <Ground />
      <Character who="thanos" position={[0.4, 0, -2.5]} />
      <Character who="iron" position={[-1.7, 0, 0.6]} yaw={0.3} extra={{ charge: 1 }} pose={{ finR: 0.9 }} />
      <Character who="spider" position={[1.8, 0, 0.8]} yaw={-0.3} />
      <Character who="doom" position={[0, 0, 3.2]} yaw={0} extra={{ eyeGlow: 1 }} />
    </Panel>
    <Panel x={1640} y={540} w={280} h={540} background={SKY} title="TIRA" cam={{ position: [0, 3.2, 20], target: [0, 2.6, 0], fov: 40 }}>
      <Lights />
      <Ground />
      <Character who="cap" position={[-1.3, 0, 0]} yaw={0.2} />
      <Character who="strange" position={[1.3, 0, 0]} yaw={-0.2} />
      <Character who="groot" position={[-1.2, 0, 3]} yaw={0.2} />
      <Character who="panther" position={[1.2, 0, 3]} yaw={-0.2} />
    </Panel>
  </>
);


const Debug: React.FC = () => (
  <>
    <Panel x={0} y={0} w={960} h={540} background={SKY} title="DBG falcon front open 1 / 0.5" cam={{ position: [0, 1.6, 12], target: [0, 1.3, 0], fov: 30 }}>
      <Lights />
      <Character who="falcon" position={[-1.8, 0, 0]} extra={{ open: 1 }} />
      <Character who="falcon" position={[1.9, 0, 0]} extra={{ open: 0.5 }} />
    </Panel>
    <Panel x={960} y={0} w={960} h={540} background={SKY} title="DBG falcon back open 1 / 0" cam={{ position: [0, 2.2, -12], target: [0, 1.3, 0], fov: 30 }}>
      <Lights />
      <Character who="falcon" position={[1.8, 0, 0]} extra={{ open: 1 }} />
      <Character who="falcon" position={[-1.9, 0, 0]} extra={{ open: 0 }} />
    </Panel>
    <Panel x={0} y={540} w={960} h={540} background={SKY} title="DBG capes side wind 0.15 / 1" cam={{ position: [16, 2.4, 2], target: [0, 1.2, 0], fov: 30 }}>
      <Lights />
      <Character who="thor" position={[0, 0, 3]} yaw={0} extra={{ wind: 0.15 }} />
      <Character who="thor" position={[0, 0, -3]} yaw={0} extra={{ wind: 1 }} />
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background={STAGE} title="DBG thanos / panther / witch" cam={{ position: [0, 2.2, 12], target: [0, 1.6, 0], fov: 30 }}>
      <Lights />
      <Character who="thanos" position={[-2.0, 0, -1]} yaw={0.3} />
      <Character who="panther" position={[1.0, 0, 1]} yaw={-0.2} />
      <Character who="witch" position={[3.2, 0, 0]} yaw={-0.3} extra={{ hex: 1 }} pose={{ finR: 0.8, finL: 0.3 }} />
    </Panel>
  </>
);

export const ThanosCastSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1B1240 0%, #3B2A72 50%, #6B3FA0 100%)" }}>
      {frame === 0 ? <Lineup /> : frame === 1 ? <Lineup34 /> : frame === 2 ? <Backs /> : frame === 3 ? <BacksB /> : frame === 4 ? <Faces /> : frame === 5 ? <ScaleAndArmy /> : <Debug />}
    </AbsoluteFill>
  );
};
