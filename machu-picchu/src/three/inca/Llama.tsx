import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BlobShadow } from "../BlobShadow";
import { noise3, toy, useRounded } from "./kit";

// A cute toy llama: woolly body and neck, a big head with banana ears, Nubi-style black eyes,
// four legs with hooves, a fluffy tail and optional Andean ear tassels.
// Model units are Nubi's (size / 10 scaling, like <Nubi size>): the top of the head is at
// y ≈ 12 (1.6x Nubi's 7.4-tall body, about 1.2x Nubi's full height of 9.9), the ear tips reach
// ≈ 14 and the body is 7 long. It faces +z (like Nubi), feet on y = 0.

export type LlamaPose = {
  /** Walk cycle amplitude 0..1 and phase (radians). */
  walk?: number;
  walkPhase?: number;
  /** Neck bend: > 0 bends forward and down (up to ~1), < 0 back. */
  neck?: number;
  /** Head turn around the neck (radians): > 0 turns towards +x (screen right when facing the camera). */
  headTurn?: number;
  /** 0..1 tilts the whole llama forward over its front hooves (up to ~25°): the shove. */
  lean?: number;
  /** Vertical hop in model units. */
  hop?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** Ear angle: 0 = up, 1 = pinned back (sassy), < 0 = perked forward. */
  ears?: number;
};

type LlamaColor = "white" | "brown" | "cream";

const PALETTE: Record<LlamaColor, { wool: string; skin: string; muzzle: string; hoof: string; inner: string }> = {
  white: { wool: "#FBF6EE", skin: "#F1E7D8", muzzle: "#FFE3CF", hoof: "#6B5444", inner: "#FFB0C0" },
  brown: { wool: "#A96C3B", skin: "#8C592F", muzzle: "#EBCBA2", hoof: "#3B2A1E", inner: "#F2A0A6" },
  cream: { wool: "#F1DDB2", skin: "#E2C999", muzzle: "#FFF0D8", hoof: "#6B5444", inner: "#FFB0C0" },
};

const TASSEL = ["#FF3D8B", "#FFC21A", "#22B573", "#1E6BFF", "#E0322B"];

// Internally the llama is built facing +x; the outer group turns it to face +z.
const HIP_Y = 3.5;
const LEGS: [number, number, number][] = [
  // x, z, gait phase (diagonal pairs move together)
  [2.2, 1.3, 0],
  [2.2, -1.3, Math.PI],
  [-2.3, 1.3, Math.PI],
  [-2.3, -1.3, 0],
];
const NECK_PIVOT: [number, number, number] = [2.2, 5.9, 0];
const FRONT_HOOF_X = 2.75;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Rounded box with evenly subdivided faces (unlike RoundedBoxGeometry), shared vertices. */
const denseRoundedBox = (w: number, h: number, d: number, r: number, step: number) => {
  const g = new THREE.BoxGeometry(
    w,
    h,
    d,
    Math.max(2, Math.round(w / step)),
    Math.max(2, Math.round(h / step)),
    Math.max(2, Math.round(d / step)),
  );
  const p = g.attributes.position;
  const ix = w / 2 - r;
  const iy = h / 2 - r;
  const iz = d / 2 - r;
  const v = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.set(clamp(v.x, -ix, ix), clamp(v.y, -iy, iy), clamp(v.z, -iz, iz));
    v.sub(q);
    const len = v.length();
    if (len > 1e-6) v.multiplyScalar(r / len);
    v.add(q);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
};

const woolCache = new Map<string, THREE.BufferGeometry>();
/** Lumpy wool: a dense rounded box pushed out along its normals by seeded noise. */
const woolGeometry = (w: number, h: number, d: number, r: number, amp: number, freq: number, seed: number) => {
  const key = [w, h, d, r, amp, freq, seed].join("|");
  const hit = woolCache.get(key);
  if (hit) return hit;
  const g = denseRoundedBox(w, h, d, r, 0.22);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 0.7 * noise3(x * freq + seed, y * freq, z * freq) + 0.3 * noise3(x * freq * 2.3, y * freq * 2.3 + seed, z * freq * 2.3);
    const b = amp * (0.35 + k);
    p.setXYZ(i, x + n.getX(i) * b, y + n.getY(i) * b, z + n.getZ(i) * b);
  }
  g.computeVertexNormals();
  woolCache.set(key, g);
  return g;
};

/** Banana ear: a rounded block curving its tip inwards and a little forward. Base at y = 0. */
const earGeometry = (w: number, h: number, d: number, r: number) => {
  const g = denseRoundedBox(w, h, d, r, 0.12);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const yn = (p.getY(i) + h / 2) / h;
    // Taper towards the tip, then bend.
    const k = 1 - 0.35 * yn * yn;
    p.setX(i, p.getX(i) * k + 0.18 * yn * yn);
    p.setZ(i, p.getZ(i) * k - 0.38 * yn * yn);
    p.setY(i, p.getY(i) + h / 2);
  }
  g.computeVertexNormals();
  return g;
};

export const Llama: React.FC<{
  color?: LlamaColor;
  size?: number;
  pose?: LlamaPose;
  /** Colourful Andean ear tassels (default on). */
  tassels?: boolean;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: [number, number, number];
  rotationY?: number;
}> = ({ color = "white", size = 2, pose = {}, tassels = true, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0 }) => {
  const { walk = 0, walkPhase = 0, neck = 0, headTurn = 0, lean = 0, hop = 0, blink = 0, ears = 0 } = pose;
  const pal = PALETTE[color];

  const geos = useMemo(
    () => ({
      body: woolGeometry(6.6, 3.9, 4.5, 1.6, 0.3, 0.75, 1),
      neck: woolGeometry(2.2, 4.9, 2.2, 0.95, 0.22, 0.9, 2),
      thigh: woolGeometry(1.7, 1.7, 1.65, 0.7, 0.16, 1.1, 3),
      tail: woolGeometry(1.2, 1.4, 1.1, 0.5, 0.16, 1.3, 4),
      tuft: woolGeometry(1.95, 1.0, 1.85, 0.46, 0.15, 1.4, 5),
      pom: woolGeometry(0.86, 0.86, 0.86, 0.4, 0.08, 2.6, 6),
      ear: earGeometry(0.68, 2.3, 0.46, 0.24),
      inner: earGeometry(0.26, 1.6, 0.28, 0.1),
      strand: new THREE.CylinderGeometry(0.09, 0.09, 0.85, 6),
    }),
    [],
  );
  const shin = useRounded(0.95, 2.6, 0.95, 0.36);
  const hoof = useRounded(1.08, 0.52, 1.08, 0.2);
  const head = useRounded(3.1, 2.6, 2.5, 0.85);
  const muzzle = useRounded(1.5, 1.35, 1.85, 0.55);
  const eye = useRounded(0.26, 0.86, 0.52, 0.12);
  const nostril = useRounded(0.11, 0.22, 0.14, 0.045, 2);

  const wool = toy(pal.wool, { rough: 0.9, glow: 0.12 });
  const skin = toy(pal.skin, { rough: 0.7, glow: 0.12 });
  const muzzleMat = toy(pal.muzzle, { rough: 0.6, glow: 0.14 });
  const hoofMat = toy(pal.hoof, { rough: 0.5, glow: 0.05 });
  const innerMat = toy(pal.inner, { rough: 0.6, glow: 0.2 });
  const eyeMat = toy("#151515", { rough: 0.3, glow: 0 });

  const s = size / 10;
  const bob = walk * 0.2 * Math.abs(Math.cos(walkPhase));
  const nod = walk * 0.05 * Math.sin(walkPhase * 2);
  const eyeH = Math.max(0.1, 1 - blink);
  const neckBend = -neck * 0.6 + nod;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={s}>
      {shadow ? (
        <group position={[0, 0, 0.4 + lean * 1.2]}>
          <BlobShadow radius={4.6 - Math.min(2, hop * 0.2)} stretch={1.35} opacity={shadowOpacity * Math.max(0.35, 1 - hop * 0.06)} />
        </group>
      ) : null}
      {/* Turn the +x-facing build to face +z. */}
      <group rotation={[0, -Math.PI / 2, 0]}>
        <group position={[0, hop, 0]}>
          {/* Lean pivots on the front hooves. */}
          <group position={[FRONT_HOOF_X, 0, 0]} rotation={[0, 0, -lean * 0.44]}>
            <group position={[-FRONT_HOOF_X, bob, 0]}>
              {LEGS.map(([x, z, ph], i) => {
                const swing = walk * 0.45 * Math.sin(walkPhase + ph);
                const lift = walk * 0.3 * Math.max(0, Math.cos(walkPhase + ph));
                return (
                  <group key={i} position={[x, HIP_Y - bob + lift, z]} rotation={[0, 0, swing]}>
                    <mesh geometry={geos.thigh} material={wool} position={[0, -0.25, 0]} castShadow />
                    <mesh geometry={shin} material={skin} position={[0, -1.7, 0]} castShadow />
                    <mesh geometry={hoof} material={hoofMat} position={[0.06, -3.24, 0]} />
                  </group>
                );
              })}
              <mesh geometry={geos.body} material={wool} position={[-0.15, 5.0, 0]} castShadow />
              <mesh geometry={geos.tail} material={wool} position={[-3.5, 6.2, 0]} rotation={[walk * 0.3 * Math.sin(walkPhase), 0, 0.5]} castShadow />
              <group position={NECK_PIVOT} rotation={[0, 0, neckBend - 0.08]}>
                <mesh geometry={geos.neck} material={wool} position={[0.25, 2.0, 0]} castShadow />
                {/* Head: counter-rotates a little so it doesn't point at the ground. */}
                <group position={[0.5, 4.0, 0]} rotation={[0, 0, -neckBend * 0.55 + 0.08]}>
                  <group rotation={[0, headTurn, 0]}>
                    <mesh geometry={head} material={skin} position={[0.5, 0.65, 0]} castShadow />
                    <mesh geometry={muzzle} material={muzzleMat} position={[1.95, 0.12, 0]} />
                    {[-1, 1].map((k) => (
                      <mesh key={`n${k}`} geometry={nostril} material={eyeMat} position={[2.7, 0.38, k * 0.36]} rotation={[k * 0.25, 0, 0]} />
                    ))}
                    {/* Nubi-style eyes on the front corners, readable from the front and the side. */}
                    {[-1, 1].map((k) => (
                      <mesh
                        key={`e${k}`}
                        geometry={eye}
                        material={eyeMat}
                        position={[1.76, 0.95, k * 0.99]}
                        rotation={[0, -k * 0.72, 0]}
                        scale={[1, eyeH, 1]}
                      />
                    ))}
                    <mesh geometry={geos.tuft} material={wool} position={[0.35, 2.05, 0]} />
                    {[-1, 1].map((k) => (
                      <group key={`ear${k}`} position={[-0.05, 1.75, k * 0.82]} rotation={[k * 0.32, 0, ears * 0.7]}>
                        <group scale={[1, 1, k]}>
                          <mesh geometry={geos.ear} material={skin} castShadow />
                          <mesh geometry={geos.inner} material={innerMat} position={[0.25, 0.32, 0]} />
                        </group>
                        {tassels ? (
                          <group position={[0, 0.62, k * 0.38]}>
                            <mesh geometry={geos.pom} material={toy(TASSEL[k > 0 ? 0 : 3], { rough: 0.9, glow: 0.2 })} />
                            {[0, 1, 2].map((j) => (
                              <mesh
                                key={j}
                                geometry={geos.strand}
                                material={toy(TASSEL[(j + (k > 0 ? 1 : 2)) % TASSEL.length], { rough: 0.9, glow: 0.2 })}
                                position={[(j - 1) * 0.18, -0.68, k * 0.06]}
                                rotation={[0, 0, (j - 1) * 0.25]}
                              />
                            ))}
                          </group>
                        ) : null}
                      </group>
                    ))}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
