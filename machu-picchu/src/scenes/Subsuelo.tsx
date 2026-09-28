import React, { useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  EASE_IN,
  EASE_IN_OUT,
  EASE_OUT,
  pop,
  ramp,
  rand,
  windowIn,
  wordPulse,
} from "../anim";
import { Burst } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { WORD_FRAMES } from "../script";
import { SCENES } from "../theme";
import { Clawd } from "../three/Clawd";
import { Vec3, lerp3 } from "../three/CameraRig";
import { Twinkles } from "../three/Effects3D";
import { Umbrella } from "../three/Props";
import {
  BigStones,
  DRAIN,
  GrassTop,
  LAYERS,
  LOWER,
  LayerBlock,
  LowerStep,
  RetainingWall,
  SLAB,
  WALL_X,
} from "../three/Terrace";
import { LOOKS, Text3D, measureText3D } from "../three/Text3D";
import { Shake, Stage } from "./common";

// 42-52 s: SECRETO #3: terraces are built in layers so water drains; 60 % of the work is
// underground and there are 129 drainage channels.

const DROPS = {
  stones: 1300,
  gravel: 1306,
  sand: 1312,
  soil: 1318,
  grass: 1324,
};
const NAMED = { stones: 1334, gravel: 1342, sand: 1350, soil: 1361 };

const dropOffset = (g: number, at: number) =>
  g < at - 8 ? null : ramp(g, at - 8, at, [7, 0], EASE_IN);

const Underside: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.ConeGeometry(1, 1, 4, 3);
    g.rotateY(Math.PI / 4);
    g.rotateX(Math.PI);
    return g;
  }, []);
  return (
    <mesh geometry={geo} position={[2.55, -6.3, 0]} scale={[10.4, 4.2, 3.0]}>
      <meshStandardMaterial color="#5B5249" roughness={1} flatShading />
    </mesh>
  );
};

type Drop = { x: number; start: number; speed: number };

export const Subsuelo: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SCENES.subsuelo.from;

  // Camera.
  const A = {
    position: [2.4, 3.6, 21.5] as Vec3,
    target: [2.2, -1.6, 0] as Vec3,
  };
  const B = {
    position: [1.0, 2.6, 18.8] as Vec3,
    target: [1.7, -1.9, 0] as Vec3,
  };
  const Cc = {
    position: [6.2, 3.2, 12.8] as Vec3,
    target: [6.4, -2.9, 0] as Vec3,
  };
  const kB = ramp(g, 1296, 1330, [0, 1], EASE_IN_OUT);
  const kC = ramp(g, 1478, 1506, [0, 1], EASE_IN_OUT);
  let position = lerp3(A.position, B.position, kB);
  let target = lerp3(A.target, B.target, kB);
  position = lerp3(position, Cc.position, kC);
  target = lerp3(target, Cc.target, kC);
  const cam = { position, target, fov: 38 };

  const glow = (key: keyof typeof NAMED) => {
    const d = g - NAMED[key];
    return d < 0 ? 0 : Math.exp(-d / 10) * (0.6 + 0.4 * Math.cos(d * 0.6));
  };

  // Rain on top, water filtering down the cut face and out of the weep hole.
  const raining = windowIn(g, 1370, 1470, 6) + windowIn(g, 1512, 1560, 6);
  const drops: Drop[] = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: -3.8 + rand(i * 3) * 7.8,
        start: 1380 + i * 4.2,
        speed: 0.08 + rand(i * 5) * 0.04,
      })),
    [],
  );
  const waterPath = (d: Drop): Vec3 | null => {
    const t = g - d.start;
    if (t < 0) return null;
    // Speed depends on the layer: slow in soil/sand, fast in gravel/stones.
    let y = -0.1;
    let tt = t;
    const legs: [number, number][] = [
      [-0.9, 0.06],
      [-1.6, 0.08],
      [-2.6, 0.16],
      [-3.1, 0.2],
    ];
    for (const [yEnd, v] of legs) {
      const need = (y - yEnd) / (v + d.speed * 0.3);
      if (tt < need)
        return [
          d.x + Math.sin(t * 0.4 + d.x) * 0.08,
          y - tt * (v + d.speed * 0.3),
          SLAB.z1 + 0.06,
        ];
      tt -= need;
      y = yEnd;
    }
    // Along the stone layer towards the weep hole.
    const vx = 0.35;
    const dist = WALL_X + 0.9 - d.x;
    if (tt < dist / vx)
      return [d.x + tt * vx, -3.1 + Math.sin(tt) * 0.05, SLAB.z1 + 0.06];
    tt -= dist / vx;
    // Spout into the channel.
    if (tt < 10)
      return [DRAIN.x + tt * 0.1, DRAIN.y - tt * tt * 0.006, DRAIN.z];
    return null;
  };
  const flow = ramp(g, 1418, 1446, [0, 1], EASE_OUT);

  const percent = Math.round(
    interpolate(g, [1414, 1428], [0, 60], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    }),
  );
  const canales = Math.round(
    interpolate(g, [1488, 1506], [0, 129], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    }),
  );
  const talk = wordPulse(g, WORD_FRAMES);
  const point = windowIn(g, 1330, 1372, 5);
  const umbrellaK = pop(g, 1512, { damping: 11, stiffness: 180 });
  const labelsOut = ramp(g, 1402, 1410);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 48% 36%, #9DFFE6 0%, #22C9B6 28%, #0E7C9C 60%, #0A2448 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.2}deg at 48% 36%, rgba(255,255,255,0.07) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake
        frame={g}
        impacts={[
          { at: 1260, amp: 18, dur: 14 },
          { at: DROPS.stones, amp: 7 },
          { at: DROPS.gravel, amp: 5 },
          { at: DROPS.sand, amp: 5 },
          { at: DROPS.soil, amp: 5 },
        ]}
      >
        <Stage cam={cam}>
          <hemisphereLight args={["#F0FFFB", "#0A3A5A", 1.35]} />
          <directionalLight
            position={[-6, 12, 12]}
            intensity={2.5}
            color="#FFFFFF"
          />
          <directionalLight
            position={[10, 4, -6]}
            intensity={1.1}
            color="#9DFFE6"
          />
          <Underside />
          <RetainingWall />
          <LowerStep flow={flow} frame={g} />
          {LAYERS.map((L) => {
            const off = dropOffset(g, DROPS[L.key]);
            if (off === null) return null;
            return (
              <LayerBlock
                key={L.key}
                k={L.key}
                y0={L.y0}
                y1={L.y1}
                x0={SLAB.x0}
                x1={SLAB.x1}
                glow={glow(L.key)}
                drop={off}
              />
            );
          })}
          {dropOffset(g, DROPS.stones) !== null ? (
            <BigStones
              drop={dropOffset(g, DROPS.stones)!}
              glow={glow("stones")}
            />
          ) : null}
          {dropOffset(g, DROPS.grass) !== null ? (
            <GrassTop drop={dropOffset(g, DROPS.grass)!} />
          ) : null}
          {/* Layer names, right-aligned to the left of the cut. */}
          {LAYERS.map((L) => {
            const k =
              pop(g, NAMED[L.key], { damping: 11, stiffness: 220 }) *
              (1 - labelsOut);
            if (k < 0.01) return null;
            const size = 0.56;
            const w = measureText3D(L.label, size).width;
            return (
              <group
                key={L.key}
                position={[
                  SLAB.x0 - 0.35 - w / 2,
                  (L.y0 + L.y1) / 2 - 0.05,
                  SLAB.z1,
                ]}
                scale={k}
              >
                <Text3D text={L.label} size={size} look={LOOKS.white} />
              </group>
            );
          })}
          {/* Rain. */}
          {raining > 0.01
            ? Array.from({ length: 40 }).map((_, i) => {
                const period = 16;
                const ph = ((g + rand(i) * period) % period) / period;
                const x = -4.2 + rand(i * 7) * 13.6;
                const z = -1.8 + rand(i * 11) * 3.6;
                const top = x > WALL_X ? LOWER.top : 0;
                const y = top + (1 - ph) * 7;
                return (
                  <mesh key={i} position={[x, y, z]} scale={raining}>
                    <boxGeometry args={[0.04, 0.42, 0.04]} />
                    <meshBasicMaterial
                      color="#BFEFFF"
                      transparent
                      opacity={0.75}
                    />
                  </mesh>
                );
              })
            : null}
          {drops.map((d, i) => {
            const p = waterPath(d);
            if (!p) return null;
            return (
              <mesh key={i} position={p}>
                <sphereGeometry args={[0.16, 12, 8]} />
                <meshStandardMaterial
                  color="#35B6FF"
                  emissive="#35B6FF"
                  emissiveIntensity={0.9}
                  roughness={0.2}
                />
              </mesh>
            );
          })}
          <group
            position={[8.3, LOWER.top, 0.6]}
            rotation={[0, -0.45 + ramp(g, 1478, 1500) * 0.3, 0]}
          >
            <Clawd
              size={1.8}
              pose={{
                hat: 1,
                squash: 1 - 0.06 * talk,
                hop: talk * 0.5,
                armL: point * 0.6 + talk * 0.2,
                reachL: point * 1.4,
                armR: umbrellaK > 0.01 ? 1.0 : talk * 0.25,
                lookX: -0.8 + ramp(g, 1478, 1500) * 0.8,
              }}
            >
              {umbrellaK > 0.01 ? (
                <group
                  position={[4.83, 13.6, 0.4]}
                  rotation={[0.08, 0, 0.51]}
                  scale={1.25 * umbrellaK}
                >
                  <Umbrella />
                </group>
              ) : null}
            </Clawd>
          </group>
          <Twinkles
            frame={g}
            at={1540}
            position={[8.1, LOWER.top + 1.5, 1.2]}
            radius={2.4}
            count={12}
          />
        </Stage>
        <Burst frame={g} at={1418} x={560} y={300} color="#4FE3FF" size={560} />
        <Burst frame={g} at={1494} x={540} y={300} color="#4FE3FF" size={520} />
        {g < 1300 || g >= 1410 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={1262}
              out={1292}
              exit="up"
              lines={[
                { text: "SECRETO #3", size: 2.0, look: LOOKS.gold, y: 1.0 },
                {
                  text: "BAJO TIERRA",
                  size: 1.2,
                  look: LOOKS.cyan,
                  y: -1.2,
                  delay: 13,
                },
              ]}
            />
            <TitleSlam
              frame={g}
              at={1416}
              out={1474}
              exit="shrink"
              lines={[
                {
                  text: `${percent}%`,
                  size: 2.2,
                  look: LOOKS.cyan,
                  y: 2.55,
                  x: -4.6,
                },
                {
                  text: "BAJO TIERRA",
                  size: 0.72,
                  look: LOOKS.white,
                  y: 0.85,
                  x: -4.6,
                  delay: 12,
                },
              ]}
            />
            <TitleSlam
              frame={g}
              at={1490}
              out={1552}
              exit="shrink"
              lines={[
                {
                  text: `${canales}`,
                  size: 2.1,
                  look: LOOKS.cyan,
                  y: 2.55,
                  x: -4.4,
                },
                {
                  text: "CANALES",
                  size: 0.8,
                  look: LOOKS.white,
                  y: 0.9,
                  x: -4.4,
                  delay: 10,
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
