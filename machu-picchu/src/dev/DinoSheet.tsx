import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3, projectToScreen } from "../three/CameraRig";
import { Nubi } from "../three/Nubi";
import {
  BabyDino,
  Brachio,
  RAPTOR_MOUTH,
  Raptor,
  TREX_HEIGHT,
  TRex,
  TRexHead,
  Trike,
  trexHeadCamera,
} from "../three/dino/Dinos";

// Review sheet for the dinosaurs (1920 x 1080). Nubi is always at size 2 for scale.
//   Frame 0: lineup with height guides, the T-Rex roaring at Nubi, the brachiosaurus for scale.
//   Frame 1: T-Rex details (grin, open jaw, walk / lean / arms), raptor poses (rest, crouch,
//            run, snatch with a box in its jaws), triceratops and baby.
//   Frame 2: first-person framing through TRexHead (vertical), brachio neck poses, profiles.

export const DINO_SHEET_FRAMES = 4;

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
  near?: number;
}> = ({ x, y, w, h, cam, background, title, children, labels = [], near = 0.1 }) => (
  <div style={{ position: "absolute", left: x + 8, top: y + 8, width: w - 16, height: h - 16, borderRadius: 26, overflow: "hidden", background }}>
    <ThreeCanvas
      width={w - 16}
      height={h - 16}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near, far: 900 }}
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

const Lights: React.FC<{ sky?: string; ground?: string }> = ({ sky = "#FFF6E8", ground = "#5C7A3A" }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9} color="#FFD2A0" />
  </>
);

const Ground: React.FC<{ color?: string; radius?: number }> = ({ color = "#7CC36A", radius = 60 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
    <circleGeometry args={[radius, 64]} />
    <meshStandardMaterial color={color} roughness={1} emissive={color} emissiveIntensity={0.08} />
  </mesh>
);

/** Thin horizontal guide at a given height (z = 0 plane). */
const Guide: React.FC<{ y: number; color: string; width?: number; x?: number }> = ({ y, color, width = 40, x = 0 }) => (
  <mesh position={[x, y, 0]}>
    <boxGeometry args={[width, 0.035, 0.035]} />
    <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.8} />
  </mesh>
);

/** Placeholder pizza box (0.72 x 0.1 x 0.72), centred at the origin. */
const PizzaBox: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[0.72, 0.1, 0.72]} />
      <meshStandardMaterial color="#F2E3C6" roughness={0.8} emissive="#F2E3C6" emissiveIntensity={0.12} />
    </mesh>
    <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.22, 32]} />
      <meshStandardMaterial color="#E8383D" roughness={0.6} emissive="#E8383D" emissiveIntensity={0.2} />
    </mesh>
  </group>
);

/** Box held by its near edge in the raptor's jaws (see RAPTOR_MOUTH). */
const heldBox = (
  <group position={[0, 0, 0.36 - 0.05]} rotation={[0.08, 0, 0]}>
    <PizzaBox />
  </group>
);

const SKY = "linear-gradient(180deg, #7EC8FF 0%, #BFE6FF 58%, #9BD67E 58%, #6DB356 100%)";
const WARM = "linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #C98B4E 62%, #B8763B 100%)";
const JUNGLE = "linear-gradient(180deg, #FFD58A 0%, #FFB36B 40%, #8FD18A 40%, #4E9F55 100%)";
const DUSK = "linear-gradient(180deg, #5B6BD6 0%, #B58BE8 55%, #F2A7C3 100%)";
const PLAIN = "radial-gradient(circle at 50% 40%, #FFF4DE 0%, #F2D3A0 100%)";

// ---------------------------------------------------------------------------------------

const LINEUP_CAM: Cam = { position: [0.3, 3.8, 21], target: [0.3, 3.2, 0], fov: 30 };
const LINEUP: { text: string; x: number; el: React.ReactNode }[] = [
  { text: "Baby", x: -11.2, el: <BabyDino position={[-11.2, 0, 0]} rotationY={0.35} pose={{ headTilt: 0.2 }} /> },
  { text: "Nubi 2", x: -9.0, el: <Nubi size={2} position={[-9.0, 0, 0]} rotationY={0.2} /> },
  { text: "Raptor", x: -6.6, el: <Raptor position={[-6.6, 0, 0]} rotationY={0.5} /> },
  { text: "Trike", x: -3.2, el: <Trike position={[-3.2, 0, 0]} rotationY={0.6} /> },
  { text: "TRex", x: 2.8, el: <TRex position={[2.8, 0, 0]} rotationY={-0.45} /> },
  { text: "Raptor (lado)", x: 8.6, el: <Raptor position={[8.6, 0, 0]} rotationY={-Math.PI / 2} pose={{ headYaw: 0.4 }} /> },
  { text: "Nubi 2 ", x: 11.4, el: <Nubi size={2} position={[11.4, 0, 0]} rotationY={-0.3} /> },
];

const Lineup: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={1920}
      h={600}
      background={SKY}
      title={`TAMAÑOS vs NUBI size 2 (guías: 1.98 = Nubi, 6.93 = 3.5x; T-Rex ${TREX_HEIGHT.toFixed(2)})`}
      cam={LINEUP_CAM}
      labels={LINEUP.map((l) => ({ text: l.text, x: projectToScreen(LINEUP_CAM, [l.x, 0, 0], 1904, 584).x, y: 530 }))}
    >
      <Lights />
      <Ground />
      <Guide y={1.98} color="#FFFFFF" />
      <Guide y={6.93} color="#FF3D6E" />
      <Guide y={1.39} color="#FFE14D" width={2.4} x={-11.2} />
      <Guide y={2.38} color="#FFE14D" width={3} x={-3.2} />
      {LINEUP.map((l) => (
        <React.Fragment key={l.text}>{l.el}</React.Fragment>
      ))}
    </Panel>
    <Panel
      x={0}
      y={600}
      w={960}
      h={480}
      background={JUNGLE}
      title="T-REX: roar 1, armsWave 1  (Nubi asustado)"
      cam={{ position: [4.5, 4.2, 17], target: [0.8, 3.6, 0], fov: 34 }}
    >
      <Lights />
      <Ground color="#78B85E" />
      <TRex position={[-1.2, 0, -1.5]} rotationY={0.45} pose={{ roar: 1, armsWave: 1, tail: -0.4, blink: 0 }} />
      <Nubi size={2} position={[3.6, 0, 3.2]} rotationY={-0.7} pose={{ eyeScale: 1.4, finL: 1.1, finR: 1.1, roll: 0.15, squash: 0.92 }} />
    </Panel>
    <Panel
      x={960}
      y={600}
      w={960}
      h={480}
      background={DUSK}
      title="BRACHIO size 1 + T-REX + NUBI (guía 15.84 = 8x)"
      cam={{ position: [16, 8.5, 48], target: [2, 8.2, 0], fov: 30 }}
    >
      <Lights sky="#F4F0FF" />
      <Ground color="#86C07A" radius={120} />
      <Guide y={15.84} color="#FF3D6E" />
      <Brachio position={[-2, 0, -2]} rotationY={0.9} />
      <TRex position={[8.5, 0, 2]} rotationY={-0.6} />
      <Nubi size={2} position={[4.6, 0, 5]} rotationY={0.2} />
    </Panel>
  </>
);

const Details: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={640}
      h={540}
      background={PLAIN}
      title="TREX cabeza: jaw 0 (sonrisa)"
      cam={{ position: [3.2, 6.6, 7.2], target: [0.1, 5.7, 1.4], fov: 32 }}
    >
      <Lights />
      <TRex rotationY={0.25} pose={{ headYaw: 0.2 }} />
    </Panel>
    <Panel
      x={640}
      y={0}
      w={640}
      h={540}
      background={PLAIN}
      title="TREX: jaw 1, snort 0.45 (perfil)"
      cam={{ position: [8.5, 5.9, 3.6], target: [0, 5.2, 1.6], fov: 34 }}
    >
      <Lights />
      <TRex rotationY={0} pose={{ jaw: 1, snort: 0.45, headPitch: -0.1 }} />
    </Panel>
    <Panel
      x={1280}
      y={0}
      w={640}
      h={540}
      background={SKY}
      title="TREX: walk 1, lean 0.6, neck 0.6, arms -1"
      cam={{ position: [9, 4.0, 13], target: [0, 3.1, 0], fov: 34 }}
    >
      <Lights />
      <Ground />
      <TRex rotationY={0.9} pose={{ walk: 1, walkPhase: 1.3, lean: 0.6, neck: 0.6, armsWave: -1, tail: 0.7 }} />
      <Nubi size={2} position={[3.4, 0, 4.2]} rotationY={-0.8} pose={{ eyeScale: 1.3, finR: 0.6 }} />
    </Panel>
    <Panel
      x={0}
      y={540}
      w={640}
      h={540}
      background={JUNGLE}
      title="RAPTOR: reposo / crouch 1"
      cam={{ position: [0.4, 1.6, 7.6], target: [0.1, 1.05, 0], fov: 32 }}
      labels={[
        { text: "reposo + Nubi 2", x: 180, y: 470 },
        { text: "crouch 1, tail 0.6", x: 450, y: 470 },
      ]}
    >
      <Lights />
      <Ground color="#78B85E" />
      <Nubi size={2} position={[-2.3, 0, -0.6]} rotationY={0.4} pose={{ lookX: 0.4 }} />
      <Raptor position={[-0.5, 0, 0.3]} rotationY={0.35} />
      <Raptor position={[1.7, 0, 0]} rotationY={-0.9} pose={{ crouch: 1, tail: 0.6, headYaw: 0.4, blink: 0.2 }} />
    </Panel>
    <Panel
      x={640}
      y={540}
      w={640}
      h={540}
      background={WARM}
      title="RAPTOR: run 1 / snatch 1 + caja en la boca"
      cam={{ position: [0.3, 1.9, 8.2], target: [0.2, 1.1, 0], fov: 32 }}
      labels={[
        { text: "run 1 (perfil)", x: 170, y: 470 },
        { text: "snatch 1, jaw 0.25 + caja", x: 440, y: 470 },
      ]}
    >
      <Lights />
      <Raptor position={[-1.4, 0, 0]} rotationY={Math.PI / 2} pose={{ run: 1, runPhase: 0.6 }} />
      <Raptor position={[1.2, 0, -0.4]} rotationY={-0.8} pose={{ snatch: 1, jaw: 0.25 }}>
        {heldBox}
      </Raptor>
    </Panel>
    <Panel
      x={1280}
      y={540}
      w={640}
      h={540}
      background={SKY}
      title="TRIKE / BABYDINO"
      cam={{ position: [0.5, 2.2, 9.2], target: [0.3, 1.1, 0], fov: 32 }}
      labels={[
        { text: "Trike", x: 130, y: 470 },
        { text: "Trike walk 1", x: 300, y: 470 },
        { text: "Baby hop / jaw 1", x: 505, y: 470 },
      ]}
    >
      <Lights />
      <Ground />
      <Trike position={[-2.2, 0, 0]} rotationY={0.5} />
      <Trike position={[0.2, 0, -0.8]} rotationY={-Math.PI / 2 + 0.3} pose={{ walk: 1, walkPhase: 1.0, headYaw: 0.3 }} />
      <BabyDino position={[2.1, 0, 0.6]} rotationY={-0.35} pose={{ hop: 0.25, tail: 0.7, headTilt: -0.25 }} />
      <BabyDino position={[3.1, 0, 0.9]} rotationY={-0.6} pose={{ jaw: 1, blink: 0, tail: -0.5 }} />
    </Panel>
  </>
);

// First-person framing: the T-Rex looks down at Nubi; the camera is its eyes.
const FP_HEAD = { position: [0, 5.5, 0] as Vec3, rotation: [0.45, 0, 0] as Vec3, size: 1 };
const FP_CAM = trexHeadCamera(FP_HEAD);

const FirstPerson: React.FC = () => (
  <>
    <Panel x={0} y={0} w={608} h={1080} background={SKY} title="PRIMERA PERSONA (TRexHead)" cam={FP_CAM} near={0.05}>
      <Lights />
      <Ground />
      <TRexHead {...FP_HEAD} snort={0.22} />
      <Nubi size={2} position={[0.1, 0, 14]} rotationY={Math.PI} pose={{ eyeScale: 1.35, finL: 0.9, finR: 0.9, lookY: 0.6 }} />
      <Nubi size={2} position={[-3.6, 0, 18]} rotationY={Math.PI + 0.4} />
      <BabyDino position={[2.6, 0, 15.5]} rotationY={Math.PI - 0.5} />
      {[
        [-4, 7],
        [4.5, 8],
        [-5, 14],
        [5, 15],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]} scale={[1.1, 0.8, 1.1]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color="#3E9A4A" roughness={0.9} emissive="#3E9A4A" emissiveIntensity={0.1} />
        </mesh>
      ))}
    </Panel>
    <Panel
      x={608}
      y={0}
      w={656}
      h={540}
      background={DUSK}
      title="TREXHEAD desde fuera (FP cam = punto rojo)"
      cam={{ position: [7, 8.5, 6], target: [0, 5.8, 2.2], fov: 34 }}
    >
      <Lights />
      <Ground />
      <TRexHead {...FP_HEAD} snort={0.4} jaw={0.3} />
      <mesh position={FP_CAM.position}>
        <sphereGeometry args={[0.08, 16, 12]} />
        <meshBasicMaterial color="#FF2A2A" />
      </mesh>
    </Panel>
    <Panel
      x={1264}
      y={0}
      w={656}
      h={540}
      background={DUSK}
      title="BRACHIO: neck 1 / neck -0.6 + walk"
      cam={{ position: [2, 7.5, 50], target: [2, 7.5, 0], fov: 30 }}
    >
      <Lights sky="#F4F0FF" />
      <Ground color="#86C07A" radius={120} />
      <Brachio position={[-8, 0, -4]} rotationY={Math.PI / 2 - 0.2} pose={{ neck: 1, headYaw: -0.4 }} />
      <Brachio position={[11, 0, -6]} rotationY={-Math.PI / 2 + 0.3} pose={{ neck: -0.6, walk: 1, walkPhase: 1.2, blink: 1 }} />
      <Nubi size={2} position={[0, 0, 6]} />
    </Panel>
    <Panel
      x={608}
      y={540}
      w={656}
      h={540}
      background={PLAIN}
      title={`RAPTOR: boca (RAPTOR_MOUTH ${RAPTOR_MOUTH.rest.map((v) => v.toFixed(2)).join(", ")})`}
      cam={{ position: [1.8, 2.1, 3.2], target: [0, 1.6, 0.6], fov: 34 }}
    >
      <Lights />
      <Raptor rotationY={0.2} pose={{ jaw: 0.25, headYaw: 0.2 }}>
        {heldBox}
      </Raptor>
    </Panel>
    <Panel
      x={1264}
      y={540}
      w={656}
      h={540}
      background={PLAIN}
      title="PERFILES: TREX / TRIKE / BABY / RAPTOR (espalda)"
      cam={{ position: [0, 3.6, 22], target: [0, 3, 0], fov: 30 }}
    >
      <Lights />
      <TRex position={[-2.6, 0, 0]} rotationY={Math.PI / 2} />
      <Trike position={[3.6, 0, 1]} rotationY={-Math.PI / 2} />
      <BabyDino position={[6.1, 0, 2]} rotationY={-Math.PI / 2} />
      <Raptor position={[5, 0, -2.5]} rotationY={Math.PI - 0.5} />
    </Panel>
  </>
);

const CloseUps: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={540} background={PLAIN} title="TREX jaw 0.5 (3/4)" cam={{ position: [3.6, 6.4, 6.0], target: [0, 5.6, 1.9], fov: 32 }}>
      <Lights />
      <TRex rotationY={0.1} pose={{ jaw: 0.5 }} />
    </Panel>
    <Panel x={640} y={0} w={640} h={540} background={PLAIN} title="TREX jaw 1 (frente)" cam={{ position: [0.8, 6.2, 9.0], target: [0, 5.4, 1.9], fov: 32 }}>
      <Lights />
      <TRex rotationY={0} pose={{ jaw: 1 }} />
    </Panel>
    <Panel x={1280} y={0} w={640} h={540} background={PLAIN} title="RAPTOR cabeza (frente / lado)" cam={{ position: [0.4, 1.8, 4.4], target: [0.4, 1.35, 0], fov: 30 }}>
      <Lights />
      <Raptor position={[-0.25, 0, 0]} rotationY={0.25} />
      <Raptor position={[0.95, 0, -0.3]} rotationY={-Math.PI / 2} pose={{ jaw: 0.6 }} />
    </Panel>
    <Panel x={0} y={540} w={640} h={540} background={PLAIN} title="RAPTOR lado (ala) / arriba" cam={{ position: [3.2, 1.9, 0.6], target: [0, 1.05, 0.1], fov: 34 }}>
      <Lights />
      <Raptor rotationY={0} pose={{ tail: 0.3 }} />
    </Panel>
    <Panel x={640} y={540} w={640} h={540} background={PLAIN} title="BABY / TRIKE caras" cam={{ position: [0.2, 1.4, 5.2], target: [0.2, 1.0, 0], fov: 32 }}>
      <Lights />
      <BabyDino position={[-0.9, 0, 0.6]} rotationY={0.3} pose={{ jaw: 0.8 }} />
      <Trike position={[0.9, 0, -0.4]} rotationY={-0.35} />
    </Panel>
    <Panel x={1280} y={540} w={640} h={540} background={DUSK} title="BRACHIO cabeza" cam={{ position: [6, 16.5, 12], target: [0, 14.8, 3.8], fov: 30 }}>
      <Lights sky="#F4F0FF" />
      <Brachio />
    </Panel>
  </>
);

export const DinoSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #123A2A 0%, #1E6E4E 50%, #7A8C2E 100%)" }}>
      {frame === 0 ? <Lineup /> : frame === 1 ? <Details /> : frame === 2 ? <FirstPerson /> : <CloseUps />}
    </AbsoluteFill>
  );
};
