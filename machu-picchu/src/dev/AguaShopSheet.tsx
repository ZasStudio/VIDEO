import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { Upright } from "../inca/outfit";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi } from "../three/Nubi";
import { BOTTLE_HOLD, WaterBottle } from "../three/agua/Bottle";
import {
  ALLEY_BG,
  ALLEY_COUNTER,
  ALLEY_NUBI,
  ALLEY_SAFE,
  ALLEY_SELLER,
  ALLEY_TABLE_TOP,
  Alley,
  AlleyLights,
  COIN,
  Coin,
  DentedCan,
  Lemon,
  PAPER_HOLD,
  PAPER_HUG,
  PENCIL_HOLD,
  Pencil,
  PortraitPaper,
  Potato,
  SAFE_BOTTLE,
  SUPER_BG,
  SUPER_CASE,
  Safe,
  Seller,
  ShoppingCart,
  SuperLights,
  Supermarket,
  Tumbleweed,
} from "../three/agua/Shops";

// Review sheet (1920 x 1080) for the water short's shops: supermarket, jewellery case and potato,
// alley, safe, the seller's outfit, coins and the portrait.
//   Frame 0: aisle (vertical framing), the case close-up, the alley seen from the street, the seller.
//   Frame 1: the safe closed / unlocking / open, the seller from three sides with tears, the
//            leftovers and props, the alley two-shot.
export const AGUA_SHOP_SHEET_FRAMES = 2;

type Cam = { position: Vec3; target: Vec3; fov: number };

const Panel: React.FC<{ x: number; y: number; w: number; h: number; cam: Cam; background: string; title: string; children: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  cam,
  background,
  title,
  children,
}) => (
  <div style={{ position: "absolute", left: x + 6, top: y + 6, width: w - 12, height: h - 12, borderRadius: 22, overflow: "hidden", background }}>
    <ThreeCanvas
      width={w - 12}
      height={h - 12}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.05, far: 400 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 16, top: 10, fontFamily: FONT.fun, fontSize: 26, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.45)" }}>{title}</div>
  </div>
);

const Studio: React.FC = () => (
  <>
    <hemisphereLight args={["#FFF6E8", "#5A6A7A", 1.3]} />
    <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
    <directionalLight position={[7, 4, -4]} intensity={0.9} color="#CFE8FF" />
  </>
);

const STUDIO_BG = "linear-gradient(180deg, #5B5F8E 0%, #8A7FB0 62%, #4A4D67 62%, #3A3C54 100%)";
const T = 1.3;

export const AguaShopSheet: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame === 0) {
    return (
      <AbsoluteFill style={{ background: "#14121C" }}>
        <Panel x={0} y={0} w={480} h={1080} background={SUPER_BG} title="Supermarket" cam={{ position: [0.3, 1.9, 8.5], target: [0, 1.25, -8], fov: 52 }}>
          <SuperLights t={T} flicker={0.6} />
          <Supermarket t={T} flicker={0.6} tumble={0.35} />
          <Nubi size={2} position={[0, 0, 3.6]} rotationY={Math.PI - 0.3} pose={{ wiggle: 0.6, wigglePhase: 2 }} />
        </Panel>
        <Panel x={480} y={0} w={480} h={1080} background={SUPER_BG} title="JewelryCase + lasers" cam={{ position: [1.3, 1.75, SUPER_CASE[2] + 3.6], target: [0.1, 1.2, SUPER_CASE[2]], fov: 42 }}>
          <SuperLights t={T} flicker={0.3} />
          <Supermarket t={T} flicker={0.3} />
          <Nubi size={2} position={[-0.95, 0, SUPER_CASE[2] + 1.9]} rotationY={0.5} pose={{ eyeScale: 1.3, finL: 0.6, finR: 0.8, hop: 0.6 }} />
        </Panel>
        <Panel x={960} y={0} w={480} h={1080} background={ALLEY_BG} title="Alley from the street" cam={{ position: [0.2, 1.25, 5.5], target: [0.3, 1.25, -4], fov: 50 }}>
          <AlleyLights t={T} />
          <Alley t={T} />
          <Seller position={ALLEY_SELLER} rotationY={-0.5} pose={{ finR: 0.9, roll: 0.08, yaw: 0.1 }} t={T} />
          <group position={ALLEY_SAFE}>
            <Safe open={1} t={T}>
              <group position={SAFE_BOTTLE.position} scale={SAFE_BOTTLE.scale}>
                <WaterBottle glow={0.6} t={T} />
              </group>
            </Safe>
          </group>
        </Panel>
        <Panel x={1440} y={0} w={480} h={1080} background={STUDIO_BG} title="Seller + props" cam={{ position: [0, 1.6, 6.4], target: [0, 1.25, 0], fov: 40 }}>
          <Studio />
          <Seller position={[0, 0, 0]} rotationY={0.25} pose={{ finR: 0.5, finL: 0.2 }} tears={1} t={T} holdR={<Upright raise={0.5}><group {...PAPER_HOLD}><PortraitPaper /></group></Upright>} />
          {[-0.5, -0.15, 0.2].map((x, i) => (
            <group key={i} position={[x - 0.3, 0, 1.6]} rotation={[0.7, 0, 0]}>
              <Coin />
            </group>
          ))}
          <group position={[0.75, 0.6, 1.4]} rotation={[0, 0, 0.5]}>
            <Pencil />
          </group>
        </Panel>
      </AbsoluteFill>
    );
  }
  const half = 540;
  return (
    <AbsoluteFill style={{ background: "#14121C" }}>
      <Panel x={0} y={0} w={960} h={half} background={ALLEY_BG} title="Safe: closed / unlocking / open" cam={{ position: [0, 1.4, 5.6], target: [0, 0.75, 0], fov: 40 }}>
        <AlleyLights t={T} />
        {[-1.7, 0, 1.7].map((x, i) => (
          <group key={x} position={[x, 0, 0]} rotation={[0, -x * 0.12, 0]}>
            <Safe open={[0, 0.45, 1][i]} t={T}>
              <group position={SAFE_BOTTLE.position} scale={SAFE_BOTTLE.scale}>
                <WaterBottle glow={i === 2 ? 0.7 : 0} t={T} />
              </group>
            </Safe>
          </group>
        ))}
      </Panel>
      <Panel x={960} y={0} w={960} h={half} background={STUDIO_BG} title="Seller: tears 0.3 / sob / back" cam={{ position: [0, 1.5, 9.2], target: [0, 1.15, 0], fov: 36 }}>
        <Studio />
        <Seller position={[-2.6, 0, 0]} rotationY={0.5} tears={0.3} t={T} pose={{ roll: -0.08 }} />
        <Seller position={[0, 0, 0]} tears={1} t={T} pose={{ finL: 0.4, finR: 0.4 }}>
          <group position={PAPER_HUG.position} rotation={PAPER_HUG.rotation} scale={PAPER_HUG.scale}>
            <PortraitPaper />
          </group>
        </Seller>
        <Seller position={[2.6, 0, 0]} rotationY={Math.PI - 0.6} t={T} />
      </Panel>
      <Panel x={0} y={half} w={960} h={half} background={STUDIO_BG} title="Potato, can, lemon, tumbleweed, cart, coins" cam={{ position: [0, 1.0, 3.4], target: [0, 0.35, 0], fov: 40 }}>
        <Studio />
        <group position={[-0.2, 0, 0.3]} scale={1.4}>
          <Potato t={T} />
        </group>
        <group position={[-1.1, 0, 0.6]} rotation={[0, -0.6, 0]} scale={1.6}>
          <DentedCan />
        </group>
        <group position={[0.75, 0, 0.8]} scale={1.6}>
          <Lemon />
        </group>
        <group position={[1.5, 0.33, -0.2]}>
          <Tumbleweed />
        </group>
        <group position={[-1.9, 0, -0.6]} rotation={[0, 0.7, 0]} scale={0.8}>
          <ShoppingCart />
        </group>
        {[0, 1, 2].map((i) => (
          <group key={i} position={[0.4 + i * 0.36, i === 2 ? 0.25 : 0, 1.2]} rotation={i === 2 ? [1.2, 0, 0] : [0, 0, 0]}>
            <Coin />
          </group>
        ))}
        <group position={[1.6, 0.42, 0.9]} scale={0.9}>
          <PortraitPaper sketch={0.8} />
        </group>
      </Panel>
      <Panel x={960} y={half} w={960} h={half} background={ALLEY_BG} title="Alley two-shot" cam={{ position: [0, 2.3, 6.5], target: [0, 1.0, -3.2], fov: 36 }}>
        <AlleyLights t={T} />
        <Alley t={T} />
        <Nubi
          size={2}
          position={ALLEY_NUBI}
          rotationY={Math.PI / 2 - 0.45}
          pose={{ finR: 0.6 }}
          holdR={
            <Upright raise={0.6}>
              <group {...PENCIL_HOLD}>
                <Pencil />
              </group>
            </Upright>
          }
        />
        <Seller
          position={ALLEY_SELLER}
          rotationY={-Math.PI / 2 + 0.45}
          t={T}
          pose={{ finL: 0.5 }}
          holdL={
            <Upright raise={0.5} side="L">
              <group {...BOTTLE_HOLD} position={[-BOTTLE_HOLD.position[0], BOTTLE_HOLD.position[1], BOTTLE_HOLD.position[2]]}>
                <WaterBottle glow={0.5} t={T} />
              </group>
            </Upright>
          }
        />
        <group position={ALLEY_SAFE}>
          <Safe open={0.6} t={T} />
        </group>
        {[-0.25, 0, 0.22].map((x, i) => (
          <group key={i} position={[ALLEY_COUNTER[0] + x, ALLEY_TABLE_TOP, ALLEY_COUNTER[2] + 0.1 * i]}>
            <Coin />
          </group>
        ))}
        <group position={[ALLEY_COUNTER[0], ALLEY_TABLE_TOP + COIN.h, ALLEY_COUNTER[2]]} />
      </Panel>
    </AbsoluteFill>
  );
};
