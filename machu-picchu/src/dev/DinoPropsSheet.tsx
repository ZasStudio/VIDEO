import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";
import { CavemanOutfit, DeliveryOutfit, DinoKingOutfit, TouristOutfit } from "../three/dino/Costumes";
import {
  Asteroid,
  BONE_THRONE_SEAT,
  BoneThrone,
  CLUB_HOLD_R,
  Club,
  EarthGlobe,
  PIZZA_FRONT,
  PIZZA_FRONT_POSE,
  PIZZA_HOLD_R,
  PizzaBox,
  PottedPlant,
  RoadSign,
  Telescope,
  telescopeEyepiece,
} from "../three/dino/Props";
import { BRACHIO_SPOT, CityStreet, GiantWall, PrehistoricValley, SpaceBackdrop, VALLEY_NUBI } from "../three/dino/Sets";

// Review sheet for the dinosaur-short 3D props (1920 x 1080).
//   Frame 0: Nubi's four outfits: front, 3/4, back, and eye checks (roar, big eyes, looks).
//   Frame 1: asteroid, telescope, road sign, pizza box (held two ways), potted plant, club.
//   Frame 2: bone throne with the dino king, the space shot (Earth, asteroid missing it).
//   Frame 3: the three sets in vertical framing (city street, prehistoric valley, space).
//   Frame 4: overviews: the street from above with a 7-tall T-Rex block, the giant wall, the valley.

export const DINO_PROPS_SHEET_FRAMES = 5;

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

const Lights: React.FC<{ sky?: string; ground?: string; k?: number }> = ({ sky = "#FFF6E8", ground = "#5A6A7A", k = 1 }) => (
  <>
    <hemisphereLight args={[sky, ground, 1.3 * k]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4 * k} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9 * k} color="#CFE8FF" />
  </>
);

type Outfit = "tourist" | "delivery" | "caveman" | "king";

const Dressed: React.FC<{
  kind: Outfit;
  size: number;
  position: Vec3;
  yaw?: number;
  pose?: NubiPose;
  roar?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
}> = ({ kind, size, position, yaw = 0, pose = {}, roar = 0, holdR, holdL }) => (
  <Nubi size={size} position={position} rotationY={yaw} pose={pose} holdR={holdR} holdL={holdL}>
    {kind === "tourist" ? <TouristOutfit /> : null}
    {kind === "delivery" ? <DeliveryOutfit /> : null}
    {kind === "caveman" ? <CavemanOutfit /> : null}
    {kind === "king" ? <DinoKingOutfit roar={roar} /> : null}
  </Nubi>
);

const OUTFITS: Outfit[] = ["tourist", "delivery", "caveman", "king"];
const OUTFIT_LABELS = ["TouristOutfit", "DeliveryOutfit", "CavemanOutfit", "DinoKingOutfit"];

const SKY = "linear-gradient(180deg, #BDEBFF 0%, #8FD3F5 60%, #6CC08A 60%, #4FA56E 100%)";
const WARM = "linear-gradient(180deg, #FFE6B8 0%, #F7C27A 62%, #C98B4E 62%, #B8763B 100%)";
const DUSK = "linear-gradient(180deg, #3B2A6B 0%, #8A4FB8 62%, #3A2A4E 62%, #2A1F3A 100%)";
const SPACE = "radial-gradient(circle at 50% 40%, #1B2660 0%, #050819 80%)";
const CITY_BG = "linear-gradient(180deg, #7CC4FF 0%, #BDE6FF 70%, #FFE8C8 100%)";
const VALLEY_BG = "linear-gradient(180deg, #5FB7F0 0%, #A8DDF5 55%, #FFE3B0 100%)";

const T = 1.35;
const clubHold = (
  <group {...CLUB_HOLD_R}>
    <Club />
  </group>
);

const outfitLabels = (w: number, y: number, xs: number[], span: number) =>
  OUTFIT_LABELS.map((text, i) => ({ text, x: w / 2 + xs[i] * (w / span), y }));

const Costumes: React.FC = () => {
  const xs = [-7.2, -2.4, 2.4, 7.2];
  return (
    <>
      <Panel x={0} y={0} w={960} h={540} background={SKY} title="VESTUARIO: FRENTE" cam={{ position: [0, 4.4, 26], target: [0, 1.9, 0], fov: 30 }} labels={outfitLabels(944, 470, xs, 21.5)}>
        <Lights />
        {OUTFITS.map((k, i) => (
          <Dressed key={k} kind={k} size={3} position={[xs[i], 0, 0]} holdR={k === "caveman" ? clubHold : undefined} pose={k === "caveman" ? { finR: 0.5 } : {}} />
        ))}
      </Panel>
      <Panel x={960} y={0} w={960} h={540} background={SKY} title="3/4" cam={{ position: [0, 4.4, 26], target: [0, 1.9, 0], fov: 30 }} labels={outfitLabels(944, 470, xs, 21.5)}>
        <Lights />
        {OUTFITS.map((k, i) => (
          <Dressed key={k} kind={k} size={3} position={[xs[i], 0, 0]} yaw={i % 2 ? -0.65 : 0.65} pose={{ lookX: i % 2 ? -0.4 : 0.4 }} holdR={k === "caveman" ? clubHold : undefined} />
        ))}
      </Panel>
      <Panel x={0} y={540} w={960} h={540} background={WARM} title="DE ESPALDAS" cam={{ position: [0, 5.2, 26], target: [0, 1.9, 0], fov: 30 }} labels={outfitLabels(944, 470, xs, 21.5)}>
        <Lights />
        {OUTFITS.map((k, i) => (
          <Dressed key={k} kind={k} size={3} position={[xs[i], 0, 0]} yaw={Math.PI + (i % 2 ? -0.7 : 0.7)} />
        ))}
      </Panel>
      <Panel
        x={960}
        y={540}
        w={960}
        h={540}
        background={DUSK}
        title="OJOS LIBRES: roar 0 / roar 1 / ojos grandes"
        cam={{ position: [0, 3.2, 17], target: [0, 1.6, 0], fov: 30 }}
        labels={[
          { text: "king roar 0", x: 118, y: 470 },
          { text: "king roar 1, eyes 1.35", x: 350, y: 470 },
          { text: "tourist lookX -1", x: 590, y: 470 },
          { text: "delivery eyes 1.35", x: 815, y: 470 },
        ]}
      >
        <Lights sky="#FFE8F4" ground="#3A2A4E" />
        <Dressed kind="king" size={2.4} position={[-5.4, 0, 0]} yaw={0.15} />
        <Dressed kind="king" size={2.4} position={[-1.8, 0, 0]} roar={1} pose={{ eyeScale: 1.35, lookY: 0.4, finL: 0.8, finR: 0.8 }} />
        <Dressed kind="tourist" size={2.4} position={[1.8, 0, 0]} pose={{ lookX: -1, eyeScale: 1.2, lookY: -0.3 }} />
        <Dressed kind="delivery" size={2.4} position={[5.4, 0, 0]} yaw={-0.2} pose={{ eyeScale: 1.35, lookY: 0.4 }} />
      </Panel>
    </>
  );
};

/** Quaternion turning local +z (an asteroid's flight direction) towards `dir`. */
const flyTo = (x: number, y: number, z: number) =>
  new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(x, y, z).normalize());

const TILT = 0.55;
const EYE = telescopeEyepiece(TILT);

const PropsA: React.FC = () => (
  <>
    <Panel
      x={0}
      y={0}
      w={960}
      h={540}
      background={SPACE}
      title="ASTEROID (fire 1 / hacia cámara / fire 0)"
      cam={{ position: [0, 0.6, 14], target: [0, 0.2, 0], fov: 30 }}
      labels={[
        { text: "side, size 1.4", x: 380, y: 470 },
        { text: "towards +z", x: 110, y: 470 },
        { text: "fire 0", x: 830, y: 470 },
      ]}
    >
      <Lights k={0.9} />
      <SpaceBackdrop t={T} sun={false} />
      <group position={[-1.6, 1.0, 0]} quaternion={flyTo(-1, -0.28, 0.12)}>
        <Asteroid size={1.4} fire={1} t={T} />
      </group>
      <group position={[-5.0, -1.3, 1]} quaternion={flyTo(0.12, 0.08, 1)}>
        <Asteroid size={1.2} fire={1} t={T + 0.4} />
      </group>
      <group position={[4.9, -1.5, 0]}>
        <Asteroid size={0.9} fire={0} t={T} />
      </group>
    </Panel>
    <Panel x={960} y={0} w={480} h={540} background={DUSK} title="TELESCOPE" cam={{ position: [3.6, 2.6, 11.2], target: [-0.1, 1.1, 0], fov: 30 }}>
      <Lights sky="#FFE8F4" ground="#3A2A4E" />
      <group position={[0.7, 0, 0]}>
        <Telescope tilt={TILT} />
      </group>
      <Dressed kind="tourist" size={2} position={[0.7 + EYE[0] - 0.95, 0, 0]} yaw={Math.PI / 2} pose={{ pitch: 0.05, finR: 0.3 }} />
    </Panel>
    <Panel x={1440} y={0} w={480} h={540} background={CITY_BG} title="ROADSIGN" cam={{ position: [0, 2.2, 12.5], target: [0, 1.85, 0], fov: 30 }}>
      <Lights />
      <group position={[0.8, 0, 0]}>
        <RoadSign />
      </group>
      <Dressed kind="tourist" size={2} position={[-1.45, 0, 0.9]} yaw={0.45} pose={{ lookY: 0.8, lookX: 0.6 }} />
    </Panel>
    <Panel
      x={0}
      y={540}
      w={960}
      h={540}
      background={WARM}
      title="PIZZABOX (open 0 / 0.5 / 1) + PIZZA_HOLD_R / PIZZA_FRONT"
      cam={{ position: [0, 3.4, 13], target: [0, 0.9, 0], fov: 30 }}
      labels={[
        { text: "open 0", x: 110, y: 470 },
        { text: "open 0.5", x: 250, y: 470 },
        { text: "open 1", x: 395, y: 470 },
        { text: "PIZZA_HOLD_R", x: 560, y: 470 },
        { text: "PIZZA_FRONT", x: 835, y: 470 },
      ]}
    >
      <Lights />
      <group position={[-4.5, 0, 0.3]} rotation={[0, 0.3, 0]}>
        <PizzaBox open={0} />
      </group>
      <group position={[-2.6, 0, 0]} rotation={[0, 0.15, 0]}>
        <PizzaBox open={0.5} />
      </group>
      <group position={[-0.7, 0, 0.2]} rotation={[0, -0.1, 0]}>
        <PizzaBox open={1} />
      </group>
      <Dressed
        kind="delivery"
        size={2}
        position={[1.1, 0, 0]}
        yaw={-0.15}
        pose={{ finR: 0.9, lookX: 0.5, lookY: 0.2 }}
        holdR={
          <group {...PIZZA_HOLD_R}>
            <PizzaBox />
          </group>
        }
      />
      <group position={[4.7, 0, 0]} rotation={[0, -0.2, 0]}>
        <Dressed kind="delivery" size={2} position={[0, 0, 0]} pose={{ ...PIZZA_FRONT_POSE, eyeScale: 1.2 }} />
        <group {...PIZZA_FRONT}>
          <PizzaBox />
        </group>
      </group>
    </Panel>
    <Panel
      x={960}
      y={540}
      w={480}
      h={540}
      background={SKY}
      title="POTTEDPLANT"
      cam={{ position: [0, 1.6, 8.2], target: [0, 0.55, 0], fov: 30 }}
      labels={[
        { text: "wilt 0", x: 105, y: 470 },
        { text: "0.5", x: 232, y: 470 },
        { text: "1", x: 358, y: 470 },
      ]}
    >
      <Lights />
      {[0, 0.5, 1].map((w, i) => (
        <group key={w} position={[(i - 1) * 1.15 - 0.1, 0, 0]} scale={1.1}>
          <PottedPlant wilt={w} />
        </group>
      ))}
    </Panel>
    <Panel x={1440} y={540} w={480} h={540} background={VALLEY_BG} title="CLUB (CLUB_HOLD_R)" cam={{ position: [0.6, 2.3, 10.8], target: [0.4, 1.3, 0], fov: 30 }}>
      <Lights />
      <Dressed kind="caveman" size={2} position={[-0.4, 0, 0]} yaw={-0.25} pose={{ finR: 0.6, finL: 0.2, lookX: 0.5 }} holdR={clubHold} />
      <group position={[1.9, 0.13, 0.4]} rotation={[0, 0, -0.2]}>
        <Club />
      </group>
    </Panel>
  </>
);

const PropsB: React.FC = () => (
  <>
    <Panel x={0} y={0} w={960} h={1080} background={DUSK} title="BONETHRONE + DINO KING (BONE_THRONE_SEAT)" cam={{ position: [3.4, 3.6, 12], target: [0, 2.7, 0], fov: 38 }}>
      <Lights sky="#FFE8F4" ground="#3A2A4E" />
      <BoneThrone />
      <Dressed kind="king" size={2} position={BONE_THRONE_SEAT} roar={0.35} pose={{ finL: 0.7, finR: 0.7, lookX: 0.3 }} />
    </Panel>
    <Panel x={960} y={0} w={960} h={540} background={SPACE} title="ESPACIO: EL ASTEROIDE NO LE DA A LA TIERRA" cam={{ position: [0, 0.4, 13], target: [0, 0, 0], fov: 34 }}>
      <hemisphereLight args={["#DDEBFF", "#20264A", 1.4]} />
      <directionalLight position={[-8, 4, 6]} intensity={2.6} color="#FFF3DC" />
      <SpaceBackdrop t={T} />
      <group position={[2.4, -0.9, -2]} scale={2.6}>
        <EarthGlobe spin={0.25} />
      </group>
      <group position={[-2.8, 1.6, 1.5]} quaternion={flyTo(-0.9, -0.25, 0.5)}>
        <Asteroid size={0.8} fire={1} t={T} />
      </group>
    </Panel>
    <Panel x={960} y={540} w={480} h={540} background={SPACE} title="EARTHGLOBE spin 0" cam={{ position: [0, 0, 6.2], target: [0, 0, 0], fov: 30 }}>
      <hemisphereLight args={["#DDEBFF", "#20264A", 1.4]} />
      <directionalLight position={[-6, 4, 6]} intensity={2.4} color="#FFF3DC" />
      <EarthGlobe spin={0} />
    </Panel>
    <Panel x={1440} y={540} w={480} h={540} background={SPACE} title="spin -1.66 (África)" cam={{ position: [0, 0, 6.2], target: [0, 0, 0], fov: 30 }}>
      <hemisphereLight args={["#DDEBFF", "#20264A", 1.4]} />
      <directionalLight position={[-6, 4, 6]} intensity={2.4} color="#FFF3DC" />
      <EarthGlobe spin={-1.66} />
    </Panel>
  </>
);

const SetsVertical: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background={CITY_BG} title="CITYSTREET + GIANTWALL" cam={{ position: [0, 2.7, 15.5], target: [0, 5.4, -20], fov: 62 }}>
      <Lights />
      <CityStreet t={T} />
      <group position={[-5.0, 0.16, 7.2]} rotation={[0, 0.35, 0]}>
        <RoadSign />
      </group>
      <Dressed
        kind="delivery"
        size={2}
        position={[0.4, 0, 4.2]}
        yaw={-0.1}
        pose={{ finR: 0.9, lookX: 0.4 }}
        holdR={
          <group {...PIZZA_HOLD_R}>
            <PizzaBox />
          </group>
        }
      />
    </Panel>
    <Panel x={640} y={0} w={640} h={1080} background={VALLEY_BG} title="PREHISTORICVALLEY" cam={{ position: [0, 3.4, 15], target: [0, 6.8, -30], fov: 62 }}>
      <Lights />
      <PrehistoricValley t={T} />
      <Dressed kind="caveman" size={2} position={VALLEY_NUBI} yaw={0.2} pose={{ finR: 0.6, lookX: 0.3 }} holdR={clubHold} />
    </Panel>
    <Panel x={1280} y={0} w={640} h={1080} background={SPACE} title="SPACEBACKDROP + TIERRA" cam={{ position: [0, 0, 16], target: [0, 0.4, 0], fov: 52 }}>
      <hemisphereLight args={["#DDEBFF", "#20264A", 1.4]} />
      <directionalLight position={[-8, 4, 6]} intensity={2.6} color="#FFF3DC" />
      <SpaceBackdrop t={T} />
      <group position={[0.3, -3.9, -2]} scale={3.4}>
        <EarthGlobe spin={0.1} />
      </group>
      <group position={[-1.6, 4.6, 1]} quaternion={flyTo(0.45, -0.3, 0.84)}>
        <Asteroid size={1.1} fire={1} t={T} />
      </group>
    </Panel>
  </>
);

/** Translucent block standing in for a dinosaur's bounding box (layout check). */
const Marker: React.FC<{ size: Vec3; position: Vec3; color: string }> = ({ size, position, color }) => (
  <group position={position}>
    <mesh>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
    </mesh>
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
      <lineBasicMaterial color={color} />
    </lineSegments>
  </group>
);

const Overviews: React.FC = () => (
  <>
    <Panel x={0} y={0} w={960} h={1080} background={CITY_BG} title="CITYSTREET desde arriba (bloque T-Rex 3 × 7 × 12)" cam={{ position: [16, 34, 24], target: [0, 0, -12], fov: 46 }}>
      <Lights />
      <CityStreet t={T + 5} />
      <Marker size={[3, 7, 12]} position={[0, 3.5, -12]} color="#FF3B30" />
      <Dressed kind="tourist" size={2} position={[0, 0, 4]} />
    </Panel>
    <Panel x={960} y={0} w={960} h={540} background={CITY_BG} title="GIANTWALL (height 16) + Nubi + bloque T-Rex" cam={{ position: [0, 6.5, 34], target: [0, 7.5, 0], fov: 36 }}>
      <Lights />
      <GiantWall t={T} />
      <Marker size={[3, 7, 12]} position={[8, 3.5, 8]} color="#FF3B30" />
      <Dressed kind="tourist" size={2} position={[-2, 0, 5]} />
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background={VALLEY_BG} title={`VALLEY desde arriba (bloque braquiosaurio 14 alto en ${BRACHIO_SPOT.join(", ")})`} cam={{ position: [46, 36, 26], target: [0, 4, -40], fov: 44 }}>
      <Lights />
      <PrehistoricValley t={T} />
      <Marker size={[5, 14, 14]} position={[BRACHIO_SPOT[0], 7, BRACHIO_SPOT[2]]} color="#2EE06A" />
      <Dressed kind="caveman" size={2} position={VALLEY_NUBI} />
    </Panel>
  </>
);

export const DinoPropsSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #12324A 0%, #1E5A6E 50%, #2E7D6E 100%)" }}>
      {frame === 0 ? <Costumes /> : frame === 1 ? <PropsA /> : frame === 2 ? <PropsB /> : frame === 3 ? <SetsVertical /> : <Overviews />}
    </AbsoluteFill>
  );
};
