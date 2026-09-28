import React, { useMemo } from "react";
import * as THREE from "three";
import { getStoneTexture } from "./Citadel";
import { mulberry } from "./noise";

// Cutaway of an Inca terrace: layered fill (stones, gravel, sand, topsoil) behind a stone
// retaining wall, with a lower terrace step and a drainage channel.

export type LayerKey = "stones" | "gravel" | "sand" | "soil";

export const LAYERS: {
  key: LayerKey;
  label: string;
  y0: number;
  y1: number;
  base: string;
}[] = [
  { key: "stones", label: "PIEDRAS", y0: -4.2, y1: -2.6, base: "#5E554C" },
  { key: "gravel", label: "GRAVA", y0: -2.6, y1: -1.6, base: "#9C9689" },
  { key: "sand", label: "ARENA", y0: -1.6, y1: -0.9, base: "#E2C487" },
  { key: "soil", label: "TIERRA", y0: -0.9, y1: -0.12, base: "#6B4428" },
];

export const SLAB = { x0: -4.5, x1: 4.5, z0: -2, z1: 2 };
export const WALL_X = 4.5; // retaining wall from 4.5 to 5.4
export const LOWER = { x0: 5.4, x1: 9.6, top: -3.3 };
/** Weep hole in the retaining wall, at the level of the stone layer. */
export const DRAIN = { x: 5.4, y: -3.0, z: 1.55 };

const texCache = new Map<string, THREE.CanvasTexture>();
const layerTexture = (key: LayerKey) => {
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry(key.length * 31 + 7);
  if (key === "gravel") {
    ctx.fillStyle = "#8f897d";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) {
      const l = 45 + rnd() * 35;
      ctx.fillStyle = `hsl(35, ${6 + rnd() * 10}%, ${l}%)`;
      ctx.beginPath();
      ctx.ellipse(
        rnd() * S,
        rnd() * S,
        3 + rnd() * 6,
        2 + rnd() * 5,
        rnd() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  } else if (key === "sand") {
    ctx.fillStyle = "#E2C487";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle =
        rnd() < 0.5 ? "rgba(160,120,60,0.35)" : "rgba(255,245,210,0.5)";
      ctx.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
    }
  } else if (key === "soil") {
    ctx.fillStyle = "#6B4428";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle =
        rnd() < 0.6 ? "rgba(40,22,10,0.5)" : "rgba(150,100,60,0.45)";
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, 1 + rnd() * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#3E362F";
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 26; i++) {
      const l = 45 + rnd() * 25;
      ctx.fillStyle = `hsl(30, 8%, ${l}%)`;
      ctx.beginPath();
      ctx.ellipse(
        rnd() * S,
        rnd() * S,
        18 + rnd() * 22,
        14 + rnd() * 16,
        rnd() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
};

/** A single layer block; `glow` (0..1) brightens it when it is being named. */
export const LayerBlock: React.FC<{
  k: LayerKey;
  y0: number;
  y1: number;
  x0: number;
  x1: number;
  glow?: number;
  drop?: number;
}> = ({ k, y0, y1, x0, x1, glow = 0, drop = 0 }) => {
  const mat = useMemo(() => {
    const tex = layerTexture(k).clone();
    tex.needsUpdate = true;
    tex.repeat.set((x1 - x0) / 3, (y1 - y0) / 3);
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 1,
      emissive: new THREE.Color("#FFFFFF"),
      emissiveIntensity: 0,
    });
  }, [k, x0, x1, y0, y1]);
  mat.emissiveIntensity = glow * 0.35;
  return (
    <mesh
      position={[(x0 + x1) / 2, (y0 + y1) / 2 + drop, (SLAB.z0 + SLAB.z1) / 2]}
      receiveShadow
      castShadow
    >
      <boxGeometry args={[x1 - x0, y1 - y0, SLAB.z1 - SLAB.z0]} />
      <primitive object={mat} attach="material" />
    </mesh>
  );
};

/** Big round stones embedded in the bottom layer's cut face. */
export const BigStones: React.FC<{ drop?: number; glow?: number }> = ({
  drop = 0,
  glow = 0,
}) => {
  const stones = useMemo(() => {
    const rnd = mulberry(77);
    const list: { p: [number, number, number]; s: number }[] = [];
    for (let x = SLAB.x0 + 0.5; x < SLAB.x1 - 0.3; x += 0.85 + rnd() * 0.3) {
      for (let y = -3.85; y < -2.8; y += 0.72) {
        list.push({
          p: [
            x + (rnd() - 0.5) * 0.25,
            y + (rnd() - 0.5) * 0.15,
            SLAB.z1 - 0.05,
          ],
          s: 0.36 + rnd() * 0.12,
        });
      }
    }
    return list;
  }, []);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 1), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8C8579",
        roughness: 0.85,
        flatShading: true,
        emissive: new THREE.Color("#FFFFFF"),
        emissiveIntensity: 0,
      }),
    [],
  );
  mat.emissiveIntensity = glow * 0.3;
  return (
    <group position={[0, drop, 0]}>
      {stones.map((st, i) => (
        <mesh
          key={i}
          geometry={geo}
          material={mat}
          position={st.p}
          scale={[st.s * 1.15, st.s, st.s * 0.8]}
        />
      ))}
    </group>
  );
};

export const GrassTop: React.FC<{
  drop?: number;
  x0?: number;
  x1?: number;
  y?: number;
}> = ({ drop = 0, x0 = SLAB.x0, x1 = SLAB.x1, y = -0.12 }) => {
  const tufts = useMemo(() => {
    const rnd = mulberry(12 + Math.round(x0));
    const list: [number, number, number][] = [];
    for (let i = 0; i < 26; i++)
      list.push([
        x0 + 0.3 + rnd() * (x1 - x0 - 0.6),
        y + 0.12,
        SLAB.z0 + 0.3 + rnd() * (SLAB.z1 - SLAB.z0 - 0.6),
      ]);
    return list;
  }, [x0, x1, y]);
  return (
    <group position={[0, drop, 0]}>
      <mesh position={[(x0 + x1) / 2, y + 0.07, 0]} receiveShadow>
        <boxGeometry args={[x1 - x0, 0.16, SLAB.z1 - SLAB.z0]} />
        <meshStandardMaterial
          color="#5DC04A"
          roughness={0.95}
          emissive="#5DC04A"
          emissiveIntensity={0.1}
        />
      </mesh>
      {tufts.map((p, i) => (
        <mesh key={i} position={[p[0], p[1] + 0.2, p[2]]} rotation={[0, i, 0]}>
          <coneGeometry args={[0.12, 0.45, 4]} />
          <meshStandardMaterial
            color={i % 2 ? "#3FA83A" : "#7AD94F"}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </group>
  );
};

/** Stone retaining wall between the upper fill and the lower step (with a drain hole). */
export const RetainingWall: React.FC = () => {
  const mat = useMemo(() => {
    const t = getStoneTexture().clone();
    t.needsUpdate = true;
    t.repeat.set(0.35, 3.2);
    return new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: t,
      roughness: 0.9,
    });
  }, []);
  return (
    <group>
      <mesh
        position={[WALL_X + 0.45, -1.85, 0]}
        material={mat}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[0.9, 4.9, SLAB.z1 - SLAB.z0]} />
      </mesh>
      {/* Weep hole. */}
      <mesh position={[WALL_X + 0.92, DRAIN.y, DRAIN.z]}>
        <boxGeometry args={[0.06, 0.34, 0.42]} />
        <meshStandardMaterial color="#1B1612" />
      </mesh>
    </group>
  );
};

/** Lower terrace step with a stone drainage channel on top. */
export const LowerStep: React.FC<{ flow: number; frame: number }> = ({
  flow,
  frame,
}) => {
  const waterMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2FB2FF",
        roughness: 0.15,
        emissive: new THREE.Color("#2FB2FF"),
        emissiveIntensity: 0.7,
      }),
    [],
  );
  const len = LOWER.x1 - LOWER.x0;
  return (
    <group>
      <LayerBlock
        k="soil"
        y0={-4.2}
        y1={LOWER.top - 0.12}
        x0={LOWER.x0}
        x1={LOWER.x1}
      />
      <GrassTop x0={LOWER.x0} x1={LOWER.x1} y={LOWER.top - 0.12} />
      {/* Channel walls along the front edge. */}
      <mesh position={[LOWER.x0 + len / 2, LOWER.top + 0.18, SLAB.z1 - 0.18]}>
        <boxGeometry args={[len, 0.36, 0.14]} />
        <meshStandardMaterial color="#B9B2A6" roughness={0.9} />
      </mesh>
      <mesh position={[LOWER.x0 + len / 2, LOWER.top + 0.18, SLAB.z1 - 0.72]}>
        <boxGeometry args={[len, 0.36, 0.14]} />
        <meshStandardMaterial color="#B9B2A6" roughness={0.9} />
      </mesh>
      <mesh position={[LOWER.x0 + len / 2, LOWER.top + 0.03, SLAB.z1 - 0.45]}>
        <boxGeometry args={[len, 0.06, 0.5]} />
        <meshStandardMaterial color="#8D867A" roughness={0.9} />
      </mesh>
      {flow > 0 ? (
        <group>
          <mesh
            position={[
              LOWER.x0 + (len * flow) / 2,
              LOWER.top + 0.12,
              SLAB.z1 - 0.45,
            ]}
            material={waterMat}
          >
            <boxGeometry args={[len * flow, 0.1, 0.4]} />
          </mesh>
          {/* Moving highlights on the water. */}
          {Array.from({ length: 6 }).map((_, i) => {
            const x =
              LOWER.x0 + ((((frame * 0.12 + i * 0.7) % len) + len) % len);
            if (x > LOWER.x0 + len * flow) return null;
            return (
              <mesh
                key={i}
                position={[
                  x,
                  LOWER.top + 0.18,
                  SLAB.z1 - 0.45 + ((i % 3) - 1) * 0.1,
                ]}
              >
                <boxGeometry args={[0.35, 0.02, 0.05]} />
                <meshBasicMaterial color="#DFF6FF" />
              </mesh>
            );
          })}
        </group>
      ) : null}
    </group>
  );
};
