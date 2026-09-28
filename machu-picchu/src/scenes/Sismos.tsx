import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  EASE_IN_OUT,
  EASE_OUT,
  pop,
  ramp,
  rand,
  windowIn,
  wordPulse,
} from "../anim";
import { Burst, Card } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { SCENES } from "../theme";
import { Clawd } from "../three/Clawd";
import { Vec3, lerp3, projectToScreen } from "../three/CameraRig";
import { Twinkles } from "../three/Effects3D";
import { Island } from "../three/Island";
import { BlockDef, WallMesh, buildWall } from "../three/Masonry";
import { LOOKS } from "../three/Text3D";
import { Shake, Stage } from "./common";

// 34-42 s: SECRETO #2: trapezoidal doors, walls leaning inwards, stones that "dance"
// in an earthquake and fall back into place.

const W = 8;
const H = 5.2;
const ROWS = 5;
const LEAN = 0.12;
const DOOR = { bottom: 1.9, top: 1.4, height: (H / ROWS) * 3 };
const DEPTH = 1.2;
const WALL_POS: Vec3 = [-W / 2 - 0.6, 0, -0.6];
const QUAKE_IN = 1166;
const SETTLE = 1216;

/** A glowing segment from a to b (wall-local 2D coords) that grows with k (0..1). */
const GlowLine: React.FC<{
  a: [number, number];
  b: [number, number];
  k: number;
  z: number;
  color: string;
}> = ({ a, b, k, z, color }) => {
  if (k <= 0) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const L = len * Math.min(1, k);
  const mx = a[0] + Math.cos(ang) * (L / 2);
  const my = a[1] + Math.sin(ang) * (L / 2);
  return (
    <group position={[mx, my, z]} rotation={[0, 0, ang]}>
      <mesh>
        <boxGeometry args={[L, 0.11, 0.05]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <boxGeometry args={[L + 0.1, 0.34, 0.02]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.35}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

const seq = (g: number, from: number, dur: number) =>
  ramp(g, from, from + dur, [0, 1], EASE_OUT);

export const Sismos: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.sismos.from;
  const wall = useMemo(
    () =>
      buildWall({
        width: W,
        height: H,
        rows: ROWS,
        seed: 34,
        lean: LEAN,
        door: DOOR,
        minBlock: 1.0,
        maxBlock: 1.9,
      }),
    [],
  );

  const quake = windowIn(g, QUAKE_IN, SETTLE, 3);
  const anim = (b: BlockDef) => {
    if (quake <= 0.001)
      return { pos: [0, 0, 0] as Vec3, rot: [0, 0, 0] as Vec3 };
    const ph = rand(b.index * 7) * Math.PI * 2;
    const f = 0.7 + rand(b.index * 3) * 0.5;
    const amp = quake * (0.12 + (0.1 * b.row) / ROWS);
    return {
      pos: [
        Math.sin(g * f * 1.3 + ph) * amp * 0.5,
        Math.abs(Math.sin(g * f + ph)) * amp * 1.6,
        Math.cos(g * f * 0.9 + ph) * amp * 0.3,
      ] as Vec3,
      rot: [0, 0, Math.sin(g * f * 1.1 + ph) * amp * 0.25] as Vec3,
    };
  };
  const islandShake: Vec3 = [
    Math.sin(g * 2.1) * 0.12 * quake,
    0,
    Math.cos(g * 1.7) * 0.05 * quake,
  ];

  const u = ramp(g, 1020, 1260, [0, 1], (x) => x);
  const orbit =
    ramp(g, 1100, 1150, [0, 1], EASE_IN_OUT) *
    (1 - ramp(g, 1210, 1240, [0, 1], EASE_IN_OUT));
  const base = lerp3([1.2, 3.1, 15.8], [0.6, 2.9, 13.6], u);
  const position: Vec3 = [
    base[0] - orbit * 5.5,
    base[1] + orbit * 0.6,
    base[2] - orbit * 1.2,
  ];
  const target: Vec3 = [-0.4 - orbit * 0.6, 2.55, 0];
  const cam = { position, target, fov: 38 };

  const z = WALL_POS[2] + DEPTH / 2 + 0.07;
  const cx = W / 2;
  const d0: [number, number] = [cx - DOOR.bottom / 2, 0];
  const d1: [number, number] = [cx - DOOR.top / 2, DOOR.height];
  const d2: [number, number] = [cx + DOOR.top / 2, DOOR.height];
  const d3: [number, number] = [cx + DOOR.bottom / 2, 0];
  const traceDoor = g >= 1088 && g < SETTLE - 50;
  const traceWall = g >= 1112 && g < QUAKE_IN;
  const talk = wordPulse(g, WORD_FRAMES);
  const cheer = windowIn(g, SETTLE + 2, 1260, 4);
  const check = pop(g, SETTLE + 4, { damping: 9, stiffness: 220 });
  const doorTop = projectToScreen(cam, [
    WALL_POS[0] + cx,
    DOOR.height + 0.6,
    z,
  ]);
  const lEdge = projectToScreen(cam, [
    WALL_POS[0] + LEAN * H * 0.5,
    H * 0.55,
    z,
  ]);
  const rEdge = projectToScreen(cam, [
    WALL_POS[0] + W - LEAN * H * 0.5,
    H * 0.55,
    z,
  ]);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 40%, #6FD3FF 0%, #3A6BFF 32%, #5B2BD6 64%, #1A0B4A 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${-g * 0.25}deg at 50% 40%, rgba(255,255,255,0.07) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake
        frame={g}
        impacts={[
          { at: 1020, amp: 18, dur: 14 },
          { at: QUAKE_IN, amp: 14, dur: SETTLE - QUAKE_IN },
          { at: SETTLE, amp: 12 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={["#EAF6FF", "#3A1E7A", 1.35]} />
          <directionalLight
            position={[-7, 12, 10]}
            intensity={2.5}
            color="#FFFFFF"
          />
          <directionalLight
            position={[9, 5, -6]}
            intensity={1.3}
            color="#7AE7FF"
          />
          <group position={islandShake}>
            <Island radius={7.8} grass="#5CC98A" />
            <group position={WALL_POS}>
              <WallMesh blocks={wall} depth={DEPTH} anim={anim} />
              {traceDoor ? (
                <>
                  <GlowLine
                    a={d0}
                    b={d1}
                    k={seq(g, 1090, 7)}
                    z={DEPTH / 2 + 0.07}
                    color="#FFE14D"
                  />
                  <GlowLine
                    a={d1}
                    b={d2}
                    k={seq(g, 1097, 5)}
                    z={DEPTH / 2 + 0.07}
                    color="#FFE14D"
                  />
                  <GlowLine
                    a={d2}
                    b={d3}
                    k={seq(g, 1102, 7)}
                    z={DEPTH / 2 + 0.07}
                    color="#FFE14D"
                  />
                </>
              ) : null}
              {traceWall ? (
                <>
                  <GlowLine
                    a={[0, 0]}
                    b={[LEAN * H, H]}
                    k={seq(g, 1122, 10)}
                    z={DEPTH / 2 + 0.07}
                    color="#4DFFB8"
                  />
                  <GlowLine
                    a={[W, 0]}
                    b={[W - LEAN * H, H]}
                    k={seq(g, 1122, 10)}
                    z={DEPTH / 2 + 0.07}
                    color="#4DFFB8"
                  />
                  {/* Plumb lines for comparison. */}
                  <GlowLine
                    a={[0, 0]}
                    b={[0, H + 0.4]}
                    k={seq(g, 1134, 8) * 0.999}
                    z={DEPTH / 2 + 0.05}
                    color="#FFFFFF"
                  />
                  <GlowLine
                    a={[W, 0]}
                    b={[W, H + 0.4]}
                    k={seq(g, 1134, 8) * 0.999}
                    z={DEPTH / 2 + 0.05}
                    color="#FFFFFF"
                  />
                </>
              ) : null}
            </group>
            <group position={[5.2, 0, 2.4]} rotation={[0, -0.5, 0]}>
              <Clawd
                size={2.2}
                pose={{
                  hat: 1,
                  squash:
                    1 -
                    0.06 * talk -
                    quake * 0.05 * Math.abs(Math.sin(g * 0.9)),
                  hop:
                    talk * 0.5 +
                    quake * Math.abs(Math.sin(g * 0.8)) * 1.6 +
                    cheer * Math.abs(Math.sin(g * 0.5)) * 1.3,
                  armL: 0.25 * talk + quake * 1.1 + cheer * 1.3,
                  armR: 0.25 * talk + quake * 1.1 + cheer * 1.3,
                  eyeScale: 1 + quake * 0.4 + cheer * 0.15,
                  lookX: -0.7,
                  roll: quake * Math.sin(g * 0.7) * 0.12,
                }}
              />
            </group>
          </group>
          <Twinkles
            frame={g}
            at={SETTLE}
            position={[-0.6, 2.6, 0.2]}
            radius={4.2}
            count={18}
          />
        </Stage>
        {traceDoor ? (
          <div
            style={{
              position: "absolute",
              left: doorTop.x,
              top: doorTop.y - 70,
              transform: `translate(-50%, -50%) scale(${pop(g, 1098) * (1 - ramp(g, 1156, 1162))})`,
            }}
          >
            <svg width={150} height={100} viewBox="0 0 150 100">
              <path
                d="M40 10 L110 10 L135 90 L15 90 Z"
                fill="rgba(255,225,77,0.25)"
                stroke="#FFE14D"
                strokeWidth={9}
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
        {traceWall
          ? [lEdge, rEdge].map((p, i) => {
              const k = pop(g, 1130 + i * 3) * (1 - ramp(g, 1158, 1164));
              const dir = i === 0 ? 1 : -1;
              return (
                <svg
                  key={i}
                  width={160}
                  height={90}
                  viewBox="0 0 160 90"
                  style={{
                    position: "absolute",
                    left: p.x - 80 - dir * 110,
                    top: p.y - 45,
                    transform: `scale(${k}) scaleX(${dir})`,
                  }}
                >
                  <path
                    d="M10 45 L120 45 M95 18 L130 45 L95 72"
                    stroke="#000"
                    strokeWidth={24}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 45 L120 45 M95 18 L130 45 L95 72"
                    stroke="#4DFFB8"
                    strokeWidth={13}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            })
          : null}
        {g >= SETTLE + 4 ? (
          <svg
            width={220}
            height={220}
            viewBox="0 0 100 100"
            style={{
              position: "absolute",
              left: 1500,
              top: 170,
              transform: `scale(${check * (1 - ramp(g, 1252, 1258))}) rotate(${(1 - check) * -40}deg)`,
            }}
          >
            <circle
              cx={50}
              cy={50}
              r={44}
              fill="#12B33B"
              stroke="#fff"
              strokeWidth={7}
            />
            <path
              d="M28 52 L44 67 L73 35"
              stroke="#fff"
              strokeWidth={12}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
        <Card
          frame={g}
          at={QUAKE_IN + 4}
          out={SETTLE - 4}
          x={1450}
          y={190}
          title="¡TERREMOTO!"
          rotate={-5}
          gradient="linear-gradient(135deg, #FF3B30 0%, #FF8A00 100%)"
        />
        <Burst
          frame={g}
          at={SETTLE}
          x={900}
          y={540}
          color="#4DFF7C"
          size={700}
        />
        {g < 1064 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={1022}
              out={1054}
              exit="up"
              lines={[
                { text: "SECRETO #2", size: 2.0, look: LOOKS.gold, y: 1.0 },
                {
                  text: "ANTISÍSMICO",
                  size: 1.2,
                  look: LOOKS.cyan,
                  y: -1.2,
                  delay: 13,
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
