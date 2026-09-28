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
} from "../anim";
import { Burst, Card } from "../overlay/Graphics";
import { TitleCanvas, TitleSlam } from "../overlay/TitleOverlay";
import { talkPose } from "../talk";
import { SCENES, lineEnd, lineStart, wordAt, wordEnd } from "../timeline";
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

// SECRETO #3: terraces are built in layers so water drains; 60 % of the work is
// underground and there are 129 drainage channels. Each layer drops in as Clawd names it.

const FALL = 10;
const dropOffset = (g: number, at: number) =>
  g < at - FALL ? null : ramp(g, at - FALL, at, [7, 0], EASE_IN);

/** Glowing outline of the empty terrace fill, split into the layer bands ("por capas"). */
const GhostSlab: React.FC<{ k: number; bands: number[]; fade: number }> = ({
  k,
  bands,
  fade,
}) => {
  if (k <= 0 || fade <= 0) return null;
  const x0 = SLAB.x0;
  const x1 = SLAB.x1;
  const y0 = LAYERS[0].y0;
  const y1 = LAYERS[LAYERS.length - 1].y1;
  const z = SLAB.z1 + 0.04;
  const color = "#9DFFE6";
  const bar = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    o: number,
  ) => (
    <mesh key={key} position={[x, y, z]}>
      <boxGeometry args={[Math.max(0.001, w), Math.max(0.001, h), 0.04]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={o * fade}
        toneMapped={false}
      />
    </mesh>
  );
  const w = (x1 - x0) * k;
  const h = (y1 - y0) * k;
  const t = 0.09;
  return (
    <group>
      {/* Frame draws itself from the bottom-left corner. */}
      {bar("b", x0 + w / 2, y0, w, t, 1)}
      {bar("l", x0, y0 + h / 2, t, h, 1)}
      {bar("t", x1 - w / 2, y1, w, t, 1)}
      {bar("r", x1, y1 - h / 2, t, h, 1)}
      {bar("fill", (x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, 0.12 * k)}
      {LAYERS.slice(1).map((L, i) =>
        bands[i] > 0
          ? bar(
              L.key,
              x0 + ((x1 - x0) * bands[i]) / 2,
              L.y0,
              (x1 - x0) * bands[i],
              0.05,
              0.8,
            )
          : null,
      )}
    </group>
  );
};

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
  const S = SCENES.subsuelo;
  const g = frame + S.from;
  const END = S.from + S.duration;
  // Cues from the narration.
  const T1 = wordAt("L16", 0) + 3;
  const T2 = wordAt("L16", 3) + 2;
  const TITLE_OUT = lineEnd("L16") + 6;
  const GHOST = lineStart("L17") - 6;
  const CAPAS = wordAt("L17", 4);
  // Each layer lands a few frames after its name starts ("piedras grandes, grava, arena... y tierra").
  const DROPS = {
    stones: wordAt("L17", 6) + 6,
    gravel: wordAt("L17", 8) + 6,
    sand: wordAt("L17", 9) + 6,
    soil: wordAt("L17", 11) + 6,
    grass: wordAt("L17", 11) + 20,
  };
  const NAMED = {
    stones: DROPS.stones + 2,
    gravel: DROPS.gravel + 2,
    sand: DROPS.sand + 2,
    soil: DROPS.soil + 2,
  };
  const RAIN = wordAt("L18", 2) - 4;
  const LLUVIA = wordAt("L18", 5);
  const FILTRA = wordAt("L18", 7);
  const SAFE = wordAt("L18", 11);
  const P60 = wordAt("L19", 4);
  const P60_SUB = wordAt("L19", 11);
  const C129 = wordAt("L19", 14);
  const C129_SUB = wordAt("L19", 16);
  const PAN = wordAt("L19", 12);

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
  // Closer look at the cut face while the water filters down.
  const D = {
    position: [3.4, 1.6, 15.2] as Vec3,
    target: [2.9, -2.3, 0] as Vec3,
  };
  const kB = ramp(g, GHOST - 4, CAPAS + 10, [0, 1], EASE_IN_OUT);
  const kD =
    ramp(g, lineStart("L18") - 10, LLUVIA + 6, [0, 1], EASE_IN_OUT) *
    (1 - ramp(g, lineStart("L19") - 16, P60 - 4, [0, 1], EASE_IN_OUT));
  const kC = ramp(g, PAN, C129 + 4, [0, 1], EASE_IN_OUT);
  let position = lerp3(A.position, B.position, kB);
  let target = lerp3(A.target, B.target, kB);
  position = lerp3(position, D.position, kD);
  target = lerp3(target, D.target, kD);
  position = lerp3(position, Cc.position, kC);
  target = lerp3(target, Cc.target, kC);
  // Slow drift so the long shot keeps breathing.
  const drift = ramp(g, S.from, END, [0, 1], (x) => x);
  position = [
    position[0] + Math.sin(drift * Math.PI) * 0.5,
    position[1] + Math.sin(drift * Math.PI * 2) * 0.12,
    position[2] - drift * 0.8,
  ];
  const cam = { position, target, fov: 38 };
  const ghostK = ramp(g, GHOST, GHOST + 22, [0, 1], EASE_OUT);
  const bands = LAYERS.slice(1).map((_, i) =>
    ramp(g, CAPAS + i * 6, CAPAS + i * 6 + 12, [0, 1], EASE_OUT),
  );
  const ghostFade = 1 - ramp(g, DROPS.soil, DROPS.soil + 14);

  const glow = (key: keyof typeof NAMED) => {
    const d = g - NAMED[key];
    return d < 0 ? 0 : Math.exp(-d / 10) * (0.6 + 0.4 * Math.cos(d * 0.6));
  };

  // Rain on top, water filtering down the cut face and out of the weep hole.
  const raining = windowIn(g, RAIN, END + 30, 10);
  // Drops keep soaking through for as long as it rains.
  const drops: Drop[] = useMemo(() => {
    const from = wordAt("L18", 5);
    const to = SCENES.subsuelo.from + SCENES.subsuelo.duration - 70;
    const n = Math.max(14, Math.floor((to - from) / 8));
    return Array.from({ length: n }, (_, i) => ({
      x: -3.8 + rand(i * 3) * 7.8,
      start: from + (i < 8 ? i * 4.2 : 8 * 4.2 + (i - 8) * 9 + rand(i * 13) * 4),
      speed: 0.08 + rand(i * 5) * 0.04,
    }));
  }, []);
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
  const flow = ramp(g, FILTRA, wordAt("L18", 9) + 20, [0, 1], EASE_OUT);

  const percent = Math.round(
    interpolate(g, [P60, wordAt("L19", 6) + 4], [0, 60], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    }),
  );
  const canales = Math.round(
    interpolate(g, [C129, wordAt("L19", 15) + 6], [0, 129], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE_OUT,
    }),
  );
  const point = windowIn(g, wordAt("L17", 6) - 6, wordEnd("L17", 11) + 12, 8);
  const umbrellaK = pop(g, LLUVIA, { damping: 12, stiffness: 150 });
  // Names leave before the camera moves in on the water.
  const labelsOut = ramp(g, lineStart("L18") - 14, lineStart("L18") - 2);
  const turn = ramp(g, PAN, C129 + 10);
  const cheer = windowIn(g, wordEnd("L19", 18), END + 20, 8);

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
          { at: S.from, amp: 16, dur: 14 },
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
          <GhostSlab k={ghostK} bands={bands} fade={ghostFade} />
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
            rotation={[0, -0.45 + turn * 0.3, 0]}
          >
            <Clawd
              size={1.8}
              pose={{
                ...talkPose(g, {
                  hat: 1,
                  armL: point * 0.6 + cheer * 1.1,
                  reachL: point * 1.4,
                  lookX: -0.8 + turn * 0.8,
                  hop: cheer * Math.abs(Math.sin((g - wordEnd("L19", 18)) * 0.3)) * 0.8,
                }),
                // The right nub holds the umbrella still once it is open.
                ...(umbrellaK > 0.01 ? { armR: 1.0 } : {}),
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
            at={C129_SUB}
            position={[8.1, LOWER.top + 1.5, 1.2]}
            radius={2.4}
            count={12}
          />
        </Stage>
        <Card
          frame={g}
          at={SAFE}
          out={lineEnd("L18") + 14}
          x={1350}
          y={190}
          title="¡SIN DAÑOS!"
          sub="EL AGUA SE VA"
          rotate={3}
          gradient="linear-gradient(135deg, #22C9B6 0%, #0E7C9C 100%)"
        />
        <Burst frame={g} at={P60} x={560} y={300} color="#4FE3FF" size={560} />
        <Burst frame={g} at={C129} x={540} y={300} color="#4FE3FF" size={520} />
        {g < TITLE_OUT + 14 || g >= P60 - 14 ? (
          <TitleCanvas>
            <TitleSlam
              frame={g}
              at={T1}
              out={TITLE_OUT}
              exit="up"
              lines={[
                { text: "SECRETO #3", size: 2.0, look: LOOKS.gold, y: 1.0 },
                {
                  text: "BAJO TIERRA",
                  size: 1.2,
                  look: LOOKS.cyan,
                  y: -1.2,
                  delay: T2 - T1,
                },
              ]}
            />
            <TitleSlam
              frame={g}
              at={P60}
              out={wordAt("L19", 13) - 8}
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
                  delay: P60_SUB - P60,
                },
              ]}
            />
            <TitleSlam
              frame={g}
              at={C129}
              out={END - 14}
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
                  delay: C129_SUB - C129,
                },
              ]}
            />
          </TitleCanvas>
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};
