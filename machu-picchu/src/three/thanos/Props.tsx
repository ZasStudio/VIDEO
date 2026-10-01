import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mulberry } from "../noise";
import { V3, noise3, toy } from "../inca/kit";
import { Smoke } from "../oxigeno/Props";
import { Glow, LightningBolt, Sparks, getUnitRing, makeRingMaterial } from "./FX";

// Props for the Thanos short. Everything is in WORLD units sized for Nubi at size 2 (Nubi is then
// 2 wide and ≈ 2 tall: body top at y = 1.98), ground at y = 0, front = +z. If a character is drawn
// at another size s, wrap a prop in <group scale={s / 2}>.
//
// Held props go in a fin tip. All *_HOLD transforms are in UPRIGHT fin-tip space (model units,
// 1 world unit at size 2 = 5 model units), i.e. inside <Upright raise={finR}> from
// src/inca/outfit.tsx, so the prop stays upright and facing the camera whatever the fin raise:
//   <Nubi pose={{ finR }} holdR={<Upright raise={finR}><group {...HAMMER_HOLD}><Mjolnir /></group></Upright>} />
// The *_HOLD_L twins go in holdL with <Upright raise={finL} side="L">.
// `t` is time in seconds (frame / fps).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

type Hold = { position: V3; rotation: V3; scale: number | V3 };
/** Mirror of a right-fin hold for the left fin (x and the y/z turns flipped). */
const mirrorHold = (h: Hold): Hold => ({
  position: [-h.position[0], h.position[1], h.position[2]],
  rotation: [h.rotation[0], -h.rotation[1], -h.rotation[2]],
  scale: h.scale,
});

const roundBox = (w: number, h: number, d: number, r: number, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

// =======================================================================================
// Infinity gauntlet

/** Stone colours: index, middle, ring, pinky knuckles, the thumb, the back of the hand. */
export const STONE_COLORS = {
  purple: "#A63CFF",
  blue: "#2F86FF",
  red: "#FF2B3D",
  orange: "#FF8A1A",
  green: "#22E06A",
  yellow: "#FFD21A",
};

const GOLD_C = "#F4B41E";
const GOLD_DARK_C = "#C47F0C";
const DEAD_GOLD = "#8D7A55";
const DEAD_GOLD_DARK = "#6A5A3E";

type FingerSpec = { x: number; w: number; d: number; lens: [number, number, number] };
/** Index → pinky (the thumb is at +x: a left hand seen from its back, which faces +z). */
const FINGERS: FingerSpec[] = [
  { x: 0.226, w: 0.146, d: 0.16, lens: [0.2, 0.14, 0.12] },
  { x: 0.076, w: 0.15, d: 0.162, lens: [0.22, 0.15, 0.13] },
  { x: -0.074, w: 0.145, d: 0.158, lens: [0.2, 0.14, 0.12] },
  { x: -0.222, w: 0.132, d: 0.148, lens: [0.16, 0.12, 0.105] },
];
const PALM = { w: 0.64, h: 0.52, d: 0.27, y: 0.4 };
const KNUCKLE_Y = 0.66;
const THUMB_BASE: V3 = [0.29, 0.3, -0.11];
const THUMB_LENS: [number, number] = [0.27, 0.22];

type HandPose = { curls: [number, number, number][]; spread: number[]; thumb: V3; thumbCurl: number };
/** Ready to snap: fingers up, the middle one bent onto the thumb, ring and pinky curled a bit. */
const POSE_READY: HandPose = {
  curls: [
    [0.1, 0.12, 0.08],
    [0.45, 0.55, 0.35],
    [0.55, 0.65, 0.45],
    [0.62, 0.7, 0.5],
  ],
  spread: [-0.08, -0.01, 0.04, 0.09],
  thumb: [-0.326, 0.913, -0.245],
  thumbCurl: 0.1,
};
/** After the snap: the middle finger slammed into the palm, the thumb flicked up and out. */
const POSE_SNAP: HandPose = {
  curls: [
    [0.18, 0.22, 0.14],
    [1.5, 1.45, 0.9],
    [0.75, 0.85, 0.6],
    [0.8, 0.9, 0.6],
  ],
  spread: [-0.12, 0.0, 0.05, 0.1],
  thumb: [0.14, 0.97, -0.17],
  thumbCurl: 0.02,
};
/** Relaxed, half open (lying on the altar, held limp). */
const POSE_RELAX: HandPose = {
  curls: [
    [0.25, 0.3, 0.2],
    [0.3, 0.35, 0.22],
    [0.35, 0.4, 0.25],
    [0.42, 0.45, 0.28],
  ],
  spread: [-0.14, -0.04, 0.05, 0.14],
  thumb: [0.62, 0.72, -0.3],
  thumbCurl: 0.25,
};

const blendPose = (a: HandPose, b: HandPose, k: number): HandPose => ({
  curls: a.curls.map((c, i) => [lerp(c[0], b.curls[i][0], k), lerp(c[1], b.curls[i][1], k), lerp(c[2], b.curls[i][2], k)] as [number, number, number]),
  spread: a.spread.map((s, i) => lerp(s, b.spread[i], k)),
  thumb: [lerp(a.thumb[0], b.thumb[0], k), lerp(a.thumb[1], b.thumb[1], k), lerp(a.thumb[2], b.thumb[2], k)],
  thumbCurl: lerp(a.thumbCurl, b.thumbCurl, k),
});

type GauntletMats = {
  gold: THREE.MeshStandardMaterial;
  goldDark: THREE.MeshStandardMaterial;
  core: THREE.MeshStandardMaterial;
  crack: THREE.MeshStandardMaterial;
  stones: Record<keyof typeof STONE_COLORS, THREE.MeshStandardMaterial>;
};

const metal = (c: string, rough: number, glow: number) =>
  new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: rough, emissive: new THREE.Color(c), emissiveIntensity: glow });

let gemGeo: THREE.BufferGeometry | null = null;
/** Faceted cabochon (unit radius, flat back at z = 0, dome towards +z). */
const getGemGeo = () => {
  if (gemGeo) return gemGeo;
  const g = new THREE.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2);
  gemGeo = g;
  return g;
};

type GauntletGeos = {
  palm: THREE.BufferGeometry;
  dome: THREE.BufferGeometry;
  ridge: THREE.BufferGeometry;
  knuckle: THREE.BufferGeometry;
  thumbKnuckle: THREE.BufferGeometry;
  seg: THREE.BufferGeometry[][];
  joint: THREE.BufferGeometry;
  thumbSeg: THREE.BufferGeometry[];
  cuff: THREE.BufferGeometry;
  band: THREE.BufferGeometry;
  rivet: THREE.BufferGeometry;
  setting: THREE.BufferGeometry;
  bigSetting: THREE.BufferGeometry;
  stub: THREE.BufferGeometry;
  shard: THREE.BufferGeometry;
  crackBit: THREE.BufferGeometry;
};

let gauntletGeos: GauntletGeos | null = null;
const getGauntletGeos = (): GauntletGeos => {
  if (gauntletGeos) return gauntletGeos;
  const stub = new THREE.IcosahedronGeometry(1, 0);
  const sp = stub.attributes.position;
  const rnd = mulberry(77);
  for (let i = 0; i < sp.count; i++) sp.setXYZ(i, sp.getX(i) * (0.75 + rnd() * 0.5), sp.getY(i) * (0.75 + rnd() * 0.5), sp.getZ(i) * (0.75 + rnd() * 0.5));
  stub.computeVertexNormals();
  gauntletGeos = {
    palm: roundBox(PALM.w, PALM.h, PALM.d, 0.11, 4),
    dome: new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2),
    ridge: roundBox(0.62, 0.085, 0.085, 0.038, 3),
    knuckle: roundBox(0.142, 0.115, 0.115, 0.048, 3),
    thumbKnuckle: roundBox(0.15, 0.17, 0.17, 0.065, 3),
    seg: FINGERS.map((f) => f.lens.map((l, i) => roundBox(f.w * (1 - 0.05 * i), l + 0.02, f.d * (1 - 0.05 * i), i === 2 ? 0.062 : 0.04, 3))),
    joint: new THREE.CylinderGeometry(1, 1, 1, 16).rotateZ(Math.PI / 2),
    thumbSeg: [roundBox(0.16, THUMB_LENS[0] + 0.02, 0.15, 0.05, 3), roundBox(0.145, THUMB_LENS[1] + 0.02, 0.135, 0.065, 3)],
    cuff: new THREE.LatheGeometry(
      (
        [
          [0.0, -0.22],
          [0.2, -0.22],
          [0.245, -0.2],
          [0.262, -0.14],
          [0.248, -0.02],
          [0.232, 0.08],
          [0.25, 0.15],
          [0.0, 0.15],
        ] as [number, number][]
      ).map(([r, h]) => new THREE.Vector2(r, h)),
      40,
    ),
    band: new THREE.TorusGeometry(1, 0.1, 8, 40).rotateX(Math.PI / 2),
    rivet: new THREE.SphereGeometry(1, 10, 8),
    setting: new THREE.TorusGeometry(1, 0.2, 8, 24),
    bigSetting: new THREE.TorusGeometry(1, 0.13, 8, 36),
    stub,
    shard: new THREE.TetrahedronGeometry(1, 0),
    crackBit: new THREE.BoxGeometry(1, 1, 1),
  };
  return gauntletGeos;
};

/** Jagged crack polylines on the back plate (gauntlet space, z = front of the plate). */
const CRACKS: [number, number][][] = [
  [
    [0.17, 0.6],
    [0.13, 0.54],
    [0.15, 0.49],
    [0.1, 0.44],
    [0.11, 0.38],
    [0.07, 0.34],
  ],
  [
    [0.13, 0.54],
    [0.2, 0.5],
    [0.22, 0.44],
    [0.28, 0.4],
  ],
  [
    [0.07, 0.6],
    [0.03, 0.56],
    [-0.03, 0.57],
    [-0.09, 0.52],
    [-0.12, 0.54],
  ],
  [
    [0.11, 0.44],
    [0.04, 0.46],
  ],
];

const Finger: React.FC<{ spec: FingerSpec; segs: THREE.BufferGeometry[]; joint: THREE.BufferGeometry; curl: [number, number, number]; spread: number; mats: GauntletMats }> = ({
  spec,
  segs,
  joint,
  curl,
  spread,
  mats,
}) => {
  const [l0, l1, l2] = spec.lens;
  const jr = spec.d * 0.44;
  return (
    <group position={[spec.x, KNUCKLE_Y - 0.02, 0]} rotation={[-curl[0], 0, spread]}>
      <mesh geometry={segs[0]} material={mats.gold} position={[0, l0 / 2, 0]} castShadow />
      <mesh geometry={joint} material={mats.goldDark} position={[0, l0, 0]} scale={[spec.w * 0.5, jr, jr]} />
      <group position={[0, l0, 0]} rotation={[-curl[1], 0, 0]}>
        <mesh geometry={segs[1]} material={mats.gold} position={[0, l1 / 2, 0]} castShadow />
        <mesh geometry={joint} material={mats.goldDark} position={[0, l1, 0]} scale={[spec.w * 0.48, jr * 0.94, jr * 0.94]} />
        <group position={[0, l1, 0]} rotation={[-curl[2], 0, 0]}>
          <mesh geometry={segs[2]} material={mats.gold} position={[0, l2 / 2, 0]} castShadow />
        </group>
      </group>
    </group>
  );
};

/** Where the knocked-off knuckle chunk sits on the gauntlet (gauntlet space, scale 1). */
export const GAUNTLET_CHUNK_AT: V3 = [0.2, KNUCKLE_Y, 0.1];

const STONE_KEYS: (keyof typeof STONE_COLORS)[] = ["purple", "blue", "red", "orange"];

const stoneMats = () => {
  const out = {} as Record<keyof typeof STONE_COLORS, THREE.MeshStandardMaterial>;
  (Object.keys(STONE_COLORS) as (keyof typeof STONE_COLORS)[]).forEach((k) => {
    out[k] = new THREE.MeshStandardMaterial({ color: STONE_COLORS[k], roughness: 0.12, metalness: 0.1, flatShading: true, emissive: new THREE.Color(STONE_COLORS[k]), emissiveIntensity: 0.6 });
  });
  return out;
};

const deadStone = (c: string) => {
  const col = new THREE.Color(c);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.25, 0.2);
};

const KNUCKLE_STONE_R = 0.056;
const BIG_STONE: V3 = [0.1, 0.125, 0.065];
const YV = new THREE.Vector3(0, 1, 0);

/**
 * The golden gauntlet: a chunky toy glove-hand (worn on a fin tip) with six stones — purple,
 * blue, red and orange on the index → pinky knuckles, green on the thumb's knuckle and a big
 * yellow one on the back of the hand. A LEFT hand: its back (and the stones) faces +z, fingers
 * point +y, the thumb is on the +x side. Origin = middle of the wrist cuff (where the fin goes in).
 * At scale 1 it is ≈ 1.3 tall (cuff bottom −0.22 → fingertips ≈ 1.1) and 0.75 wide (thumb incl.).
 *   stones 0..1  stone glow (0 = coloured but unlit)
 *   power  0..1  energy aura: halo, crackling arcs between the stones, rising sparkles
 *   broken 0..1  the knuckle chunk over the index finger is gone (purple stone with it), cracks
 *                grow across the back plate, the blue stone dims, a broken arc fizzles at the
 *                break and a wisp of smoke rises (> 0.15 = chunk missing)
 *   snap   0..1  ready-to-snap (fingers up, middle finger bent onto the thumb) → snapped
 *                (middle finger slammed into the palm, thumb flicked up and out)
 *   relax  0..1  fingers fall half open (lying on the altar / held limp; blends over snap)
 *   dead   0..1 (or boolean) stones dark, gold dull
 */
export const InfinityGauntlet: React.FC<{
  stones?: number;
  power?: number;
  broken?: number;
  snap?: number;
  relax?: number;
  dead?: number | boolean;
  t?: number;
}> = ({ stones = 1, power = 0, broken = 0, snap = 0, relax = 0, dead = 0, t = 0 }) => {
  const geos = getGauntletGeos();
  const mats = useMemo<GauntletMats>(
    () => ({
      gold: metal(GOLD_C, 0.3, 0.24),
      goldDark: metal(GOLD_DARK_C, 0.34, 0.2),
      core: new THREE.MeshStandardMaterial({ color: "#3B2A22", roughness: 0.8, flatShading: true, emissive: new THREE.Color("#3B2A22"), emissiveIntensity: 0.1 }),
      crack: new THREE.MeshStandardMaterial({ color: "#1A0E08", roughness: 0.9, emissive: new THREE.Color("#000000") }),
      stones: stoneMats(),
    }),
    [],
  );
  const d = clamp01(typeof dead === "boolean" ? (dead ? 1 : 0) : dead);
  const br = clamp01(broken);
  const chunkGone = br > 0.15;
  const pw = clamp01(power) * (1 - d);
  const glow = clamp01(stones) * (1 - d);
  // Gold: bright toy gold → dull brass.
  mats.gold.color.set(GOLD_C).lerp(new THREE.Color(DEAD_GOLD), d);
  mats.gold.emissive.copy(mats.gold.color);
  mats.gold.emissiveIntensity = lerp(0.24, 0.07, d) + 0.1 * pw;
  mats.gold.roughness = lerp(0.3, 0.62, d);
  mats.goldDark.color.set(GOLD_DARK_C).lerp(new THREE.Color(DEAD_GOLD_DARK), d);
  mats.goldDark.emissive.copy(mats.goldDark.color);
  mats.goldDark.emissiveIntensity = lerp(0.2, 0.05, d);
  const pulse = 0.85 + 0.15 * Math.sin(t * 5.5);
  const stoneGlow: Record<string, number> = {};
  (Object.keys(STONE_COLORS) as (keyof typeof STONE_COLORS)[]).forEach((k, i) => {
    const m = mats.stones[k];
    let g = glow * (0.9 + 0.1 * Math.sin(t * 4 + i * 1.7)) * (1 + 0.5 * pw * pulse);
    if (k === "blue") g *= 1 - 0.75 * br;
    stoneGlow[k] = g;
    const base = new THREE.Color(STONE_COLORS[k]);
    m.color.copy(base).lerp(deadStone(STONE_COLORS[k]), d);
    m.emissive.copy(base).lerp(new THREE.Color("#000000"), d);
    m.emissiveIntensity = 0.15 + 0.85 * g;
  });
  const pose = blendPose(blendPose(POSE_READY, POSE_SNAP, smooth(snap)), POSE_RELAX, smooth(relax));
  if (br > 0) {
    // The index finger is knocked askew.
    pose.curls[0] = [pose.curls[0][0] + 0.3 * br, pose.curls[0][1] + 0.15 * br, pose.curls[0][2]];
    pose.spread[0] -= 0.1 * br;
  }
  const thumbQ = new THREE.Quaternion().setFromUnitVectors(YV, new THREE.Vector3(...pose.thumb).normalize());
  const halo = (key: keyof typeof STONE_COLORS, size: number) => (
    <Glow color={STONE_COLORS[key]} size={size * (0.7 + 0.4 * Math.min(1.5, stoneGlow[key]))} opacity={0.55 * Math.min(1, stoneGlow[key])} position={[0, 0, 0.05]} />
  );
  const knuckleStone = (i: number) => {
    const key = STONE_KEYS[i];
    if (i === 0 && chunkGone) return null;
    const f = FINGERS[i];
    return (
      <group key={key} position={[f.x, KNUCKLE_Y + 0.004, 0.142]}>
        <mesh geometry={geos.setting} material={mats.goldDark} scale={KNUCKLE_STONE_R * 1.12} />
        <mesh geometry={getGemGeo()} material={mats.stones[key]} scale={[KNUCKLE_STONE_R, KNUCKLE_STONE_R, KNUCKLE_STONE_R * 0.8]} />
        {halo(key, 0.3)}
      </group>
    );
  };
  const step = Math.floor(t * 12);
  const fizz = chunkGone && d < 0.5 && hash(step * 0.71) < 0.45;
  return (
    <group>
      {/* Cuff with bands and rivets. */}
      <mesh geometry={geos.cuff} material={mats.gold} scale={[1, 1, 0.82]} castShadow />
      {[-0.16, 0.1].map((y) => (
        <mesh key={y} geometry={geos.band} material={mats.goldDark} position={[0, y, 0]} scale={[y < 0 ? 0.262 : 0.24, 0.3, (y < 0 ? 0.262 : 0.24) * 0.82]} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <mesh key={i} geometry={geos.rivet} material={mats.goldDark} position={[Math.sin(a) * 0.256, -0.07, Math.cos(a) * 0.256 * 0.82]} scale={0.02} />;
      })}
      {/* Back of the hand: domed plate and the big yellow stone. */}
      <mesh geometry={geos.palm} material={mats.gold} position={[0, PALM.y, 0]} castShadow />
      <mesh geometry={geos.dome} material={mats.gold} position={[0, PALM.y - 0.02, PALM.d / 2 - 0.02]} scale={[0.25, 0.21, 0.07]} />
      <group position={[0, PALM.y - 0.02, PALM.d / 2 + 0.04]}>
        <mesh geometry={geos.bigSetting} material={mats.goldDark} scale={[BIG_STONE[0] * 1.12, BIG_STONE[1] * 1.1, 0.1]} />
        <mesh geometry={getGemGeo()} material={mats.stones.yellow} scale={BIG_STONE} />
        {halo("yellow", 0.5)}
      </group>
      {/* Knuckle ridge and knuckle plates (the index one is the chunk that breaks off). */}
      <mesh geometry={geos.ridge} material={mats.goldDark} position={[chunkGone ? -0.07 : 0, KNUCKLE_Y - 0.035, 0.07]} scale={[chunkGone ? 0.77 : 1, 1, 1]} />
      {FINGERS.map((f, i) => (i === 0 && chunkGone ? null : <mesh key={i} geometry={geos.knuckle} material={mats.gold} position={[f.x, KNUCKLE_Y, 0.08]} castShadow />))}
      {[0, 1, 2, 3].map(knuckleStone)}
      {/* Fingers. */}
      {FINGERS.map((f, i) => (
        <Finger key={i} spec={f} segs={geos.seg[i]} joint={geos.joint} curl={pose.curls[i]} spread={pose.spread[i]} mats={mats} />
      ))}
      {/* Thumb on the +x side; its knuckle carries the green stone. */}
      <mesh geometry={geos.thumbKnuckle} material={mats.gold} position={[0.28, 0.3, 0.0]} rotation={[0, 0, -0.35]} castShadow />
      <group position={[0.335, 0.3, 0.075]} rotation={[0, 0.45, 0]}>
        <mesh geometry={geos.setting} material={mats.goldDark} scale={0.05 * 1.12} />
        <mesh geometry={getGemGeo()} material={mats.stones.green} scale={[0.05, 0.05, 0.04]} />
        {halo("green", 0.28)}
      </group>
      <group position={THUMB_BASE} quaternion={thumbQ}>
        <mesh geometry={geos.thumbSeg[0]} material={mats.gold} position={[0, THUMB_LENS[0] / 2, 0]} castShadow />
        <mesh geometry={geos.joint} material={mats.goldDark} position={[0, THUMB_LENS[0], 0]} scale={[0.075, 0.066, 0.066]} />
        <group position={[0, THUMB_LENS[0], 0]} rotation={[-pose.thumbCurl, 0, 0]}>
          <mesh geometry={geos.thumbSeg[1]} material={mats.gold} position={[0, THUMB_LENS[1] / 2, 0]} castShadow />
        </group>
      </group>
      {/* Damage: the torn hole where the chunk was, shards, cracks, a fizzling arc and smoke. */}
      {br > 0 ? (
        <group>
          {chunkGone ? (
            <>
              <mesh geometry={geos.stub} material={mats.core} position={[0.2, KNUCKLE_Y - 0.01, 0.07]} scale={[0.09, 0.065, 0.065]} rotation={[0.4, 0.3, 0.2]} />
              {[
                [0.28, 0.67, 0.08, 0.038, 0.3],
                [0.14, 0.68, 0.09, 0.033, 1.2],
                [0.22, 0.6, 0.12, 0.03, 2.1],
                [0.3, 0.61, 0.05, 0.027, 2.9],
              ].map(([x, y, z, s, r], i) => (
                <mesh key={i} geometry={geos.shard} material={mats.gold} position={[x, y, z]} scale={s} rotation={[r, r * 1.3, r * 0.7]} />
              ))}
            </>
          ) : null}
          {CRACKS.map((path, ci) => {
            const grow = clamp01(br * 1.6 - ci * 0.15);
            const n = Math.max(0, Math.round((path.length - 1) * grow));
            return Array.from({ length: n }).map((_, i) => {
              const [x0, y0] = path[i];
              const [x1, y1] = path[i + 1];
              const len = Math.hypot(x1 - x0, y1 - y0);
              // Ride on the dome where it bulges.
              const z = PALM.d / 2 + 0.03 + 0.03 * Math.max(0, 1 - Math.hypot((x0 + x1) / 2 / 0.25, ((y0 + y1) / 2 - PALM.y + 0.02) / 0.21));
              return (
                <mesh
                  key={`${ci}-${i}`}
                  geometry={geos.crackBit}
                  material={mats.crack}
                  position={[(x0 + x1) / 2, (y0 + y1) / 2, z]}
                  rotation={[0, 0, Math.atan2(y1 - y0, x1 - x0)]}
                  scale={[len + 0.01, 0.017, 0.016]}
                />
              );
            });
          })}
          {fizz ? (
            <LightningBolt from={[0.2, 0.68, 0.13]} to={[0.28 + 0.05 * hash(step), 0.8 + 0.06 * hash(step + 3), 0.17]} t={t} seed={step % 5} width={0.05} forks={1} flares={false} color="#B9A6FF" />
          ) : null}
          {chunkGone ? (
            <group position={[0.2, 0.69, 0.08]}>
              <Smoke t={t} amount={br * (1 - d * 0.5)} height={0.7} r0={0.025} r1={0.09} count={9} speed={0.35} wobble={0.06} drift={0.15} color="#6E6670" opacity={0.6} seed={4} />
            </group>
          ) : null}
        </group>
      ) : null}
      {/* Power aura. */}
      {pw > 0.01 ? <GauntletAura t={t} power={pw} /> : null}
    </group>
  );
};

/** Stone points for the aura's arcs (gauntlet space). */
const AURA_POINTS: V3[] = [
  [0.226, KNUCKLE_Y, 0.18],
  [0.076, KNUCKLE_Y, 0.18],
  [-0.074, KNUCKLE_Y, 0.18],
  [-0.222, KNUCKLE_Y, 0.18],
  [0.0, PALM.y - 0.02, 0.22],
  [0.34, 0.3, 0.12],
];
const AURA_COLORS = [STONE_COLORS.purple, STONE_COLORS.blue, STONE_COLORS.red, STONE_COLORS.orange, STONE_COLORS.yellow, STONE_COLORS.green];

const GauntletAura: React.FC<{ t: number; power: number }> = ({ t, power }) => {
  const step = Math.floor(t * 9);
  const arcs = [0, 1, 2].map((i) => {
    const a = Math.floor(hash(step * 3.1 + i * 7.7) * 6);
    const b = (a + 1 + Math.floor(hash(step * 5.3 + i * 2.9) * 5)) % 6;
    return { a, b, seed: (step * 3 + i) % 6 };
  });
  return (
    <group>
      <Glow color="#B65CFF" size={1.9 * (0.75 + 0.25 * power)} opacity={0.32 * power * (0.85 + 0.15 * Math.sin(t * 7))} position={[0, 0.5, -0.05]} />
      {arcs.map((arc, i) => (
        <LightningBolt key={i} from={AURA_POINTS[arc.a]} to={AURA_POINTS[arc.b]} t={t + i * 0.37} seed={arc.seed} width={0.06} forks={1} jag={1.4} flares={false} color={AURA_COLORS[arc.a]} amount={power} />
      ))}
      <group position={[0, -0.1, 0]}>
        <Sparks mode="rise" count={40} seed={21} time={t} width={0.026} tail={0.12} life={1.1} speed={0.9} spread={0.05} box={[0.95, 1.5, 0.55]} head="#FFFFFF" tailColor="#C77DFF" opacity={power} />
      </group>
    </group>
  );
};

/**
 * The knuckle chunk the hammer knocks off (gold plate with the purple stone and a jagged dark
 * break underneath), in gauntlet units: draw it with the gauntlet's scale. Its rest pose on the
 * gauntlet is GAUNTLET_CHUNK_AT (start it there, then send it flying). `stones` 0..1 glow.
 */
export const GauntletChunk: React.FC<{ stones?: number; t?: number }> = ({ stones = 1, t = 0 }) => {
  const geos = getGauntletGeos();
  const mats = useMemo(
    () => ({
      gold: metal(GOLD_C, 0.3, 0.24),
      goldDark: metal(GOLD_DARK_C, 0.34, 0.2),
      core: new THREE.MeshStandardMaterial({ color: "#3B2A22", roughness: 0.8, flatShading: true, emissive: new THREE.Color("#3B2A22"), emissiveIntensity: 0.1 }),
      stone: new THREE.MeshStandardMaterial({ color: STONE_COLORS.purple, roughness: 0.12, flatShading: true, emissive: new THREE.Color(STONE_COLORS.purple), emissiveIntensity: 1 }),
    }),
    [],
  );
  const g = clamp01(stones) * (0.85 + 0.15 * Math.sin(t * 9));
  mats.stone.emissiveIntensity = 0.15 + 0.85 * g;
  return (
    <group>
      <mesh geometry={geos.knuckle} material={mats.gold} position={[0.026, 0, -0.02]} scale={[1.1, 1, 1]} castShadow />
      <mesh geometry={geos.ridge} material={mats.goldDark} position={[0.02, -0.035, -0.03]} scale={[0.26, 1, 1]} />
      <mesh geometry={geos.stub} material={mats.core} position={[0.0, -0.015, -0.075]} scale={[0.085, 0.06, 0.045]} rotation={[0.3, 0.6, 0.1]} />
      <group position={[0.026, 0.004, 0.042]}>
        <mesh geometry={geos.setting} material={mats.goldDark} scale={KNUCKLE_STONE_R * 1.12} />
        <mesh geometry={getGemGeo()} material={mats.stone} scale={[KNUCKLE_STONE_R, KNUCKLE_STONE_R, KNUCKLE_STONE_R * 0.8]} />
        <Glow color={STONE_COLORS.purple} size={0.3} opacity={0.6 * g} position={[0, 0, 0.05]} />
      </group>
    </group>
  );
};

/**
 * Gauntlet on the right (screen-right) fin, in upright fin-tip space (inside <Upright>): the
 * cuff swallows the fin tip, the hand stands upright beside the head with its back (all six
 * stones) to the camera. Scale 5.5: ≈ 7.2 model units tall — on Thanos at size 3 that is ≈ 2.2
 * world units (about a size-2 Nubi's body); on Nubi at size 2, ≈ 1.45.
 */
export const GAUNTLET_HOLD: Hold = { position: [1.0, 0.7, 0.6], rotation: [0.04, -0.2, -0.05], scale: 5.5 };
/** Left-fin twin: mirrored, so it becomes a right hand with the thumb still outwards. */
export const GAUNTLET_HOLD_L: Hold = { position: [-1.0, 0.7, 0.6], rotation: [0.04, 0.2, 0.05], scale: [-5.5, 5.5, 5.5] };
/**
 * GAUNTLET_HOLD for use directly in holdR WITHOUT <Upright>: it undoes the fin turn for the given
 * raise itself (pass the same finR as the pose).
 */
export const gauntletHold = (raise = 1): Hold => {
  const qUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -raise * 0.55)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.12, 0)));
  const p = new THREE.Vector3(...GAUNTLET_HOLD.position).applyQuaternion(qUp);
  const e = new THREE.Euler().setFromQuaternion(qUp.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...GAUNTLET_HOLD.rotation))));
  return { position: [p.x, p.y, p.z], rotation: [e.x, e.y, e.z], scale: GAUNTLET_HOLD.scale };
};

/** Euler for a frame given where the gauntlet's thumb (+x), fingers (+y) and back (+z) should point. */
const basisEuler = (x: V3, y: V3, z: V3): V3 => {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x).normalize(), new THREE.Vector3(...y).normalize(), new THREE.Vector3(...z).normalize());
  const e = new THREE.Euler().setFromRotationMatrix(m);
  return [e.x, e.y, e.z];
};

/**
 * Gauntlet lying palm-down on the altar: stones up, fingers pointing to the left (−x) and a
 * little back, thumb towards the camera; use it with relax ≈ 1. Inside
 * <group position={ALTAR_TOP}> (Sets): <group {...GAUNTLET_LYING}><InfinityGauntlet dead relax={1} />.
 * Scale 1.7 (as worn by Thanos at size 3): ≈ 2.1 long, 1.3 wide, 0.75 high.
 */
export const GAUNTLET_LYING: Hold = {
  position: [0.55, 0.37, 0.05],
  rotation: basisEuler([0.26, -0.1, 0.96], [-0.96, -0.12, 0.25], [-0.09, 0.99, 0.12]),
  scale: 1.7,
};

// =======================================================================================
// Hammer

const STEEL = "#A7B2C2";
const STEEL_DARK = "#7E8A9C";
const LEATHER = "#7A4526";
const LEATHER_LIGHT = "#9C5E34";

const HAMMER = { head: { w: 0.64, h: 0.36, d: 0.36, y: 0.64 }, handleTop: 0.46, handleBottom: -0.3, r: 0.052 };

/** Arc endpoints round the hammer head (hammer space) for the crackle. */
const HEAD_ARCS: [V3, V3][] = [
  [
    [-0.33, 0.78, 0.12],
    [-0.5, 0.95, 0.2],
  ],
  [
    [0.33, 0.52, -0.1],
    [0.52, 0.42, 0.05],
  ],
  [
    [0.1, 0.83, 0.18],
    [0.18, 1.05, 0.12],
  ],
  [
    [-0.2, 0.46, 0.19],
    [-0.3, 0.3, 0.3],
  ],
  [
    [0.28, 0.8, 0.19],
    [0.45, 0.98, 0.1],
  ],
  [
    [-0.1, 0.62, 0.19],
    [0.15, 0.7, 0.19],
  ],
];

/**
 * The thunder hammer: a square steel head (0.64 × 0.36 × 0.36, long side along x, a plain
 * face to ±z with a raised border and a round boss, end faces with bevelled panels), a collar,
 * a leather-wrapped handle and a steel pommel with a hanging wrist strap. ≈ 1.15 long along +y;
 * the origin is the grip (the handle runs from y −0.3 to the head at 0.46). `crackle` 0..1:
 * electric arcs dance over the head with a blue glow (`t` seconds animates them).
 */
export const Mjolnir: React.FC<{ crackle?: number; t?: number; strapSwing?: number }> = ({ crackle = 0, t = 0, strapSwing = 0 }) => {
  const geos = useMemo(() => {
    const { w, h, d } = HAMMER.head;
    // Leather wrap: a helix of rounded ribbon round the handle.
    const turns = 9;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 24; i++) {
      const u = i / (turns * 24);
      const a = u * turns * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * HAMMER.r * 1.02, lerp(HAMMER.handleBottom + 0.07, HAMMER.handleTop - 0.05, u), Math.sin(a) * HAMMER.r * 1.02));
    }
    const strap = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.33, 0),
      new THREE.Vector3(0.05, -0.43, 0.02),
      new THREE.Vector3(0.07, -0.55, 0.03),
      new THREE.Vector3(0.0, -0.63, 0.04),
      new THREE.Vector3(-0.07, -0.55, 0.03),
      new THREE.Vector3(-0.05, -0.43, 0.02),
      new THREE.Vector3(0, -0.33, 0),
    ]);
    return {
      head: roundBox(w, h, d, 0.05, 4),
      endPanel: roundBox(0.05, h - 0.06, d - 0.06, 0.02, 2),
      faceBorder: roundBox(w - 0.1, h - 0.08, 0.02, 0.012, 2),
      faceInner: roundBox(w - 0.16, h - 0.14, 0.024, 0.01, 2),
      boss: new THREE.CylinderGeometry(0.07, 0.075, 0.03, 24).rotateX(Math.PI / 2),
      bossRing: new THREE.TorusGeometry(0.095, 0.012, 8, 28),
      topBand: roundBox(w + 0.012, 0.04, d + 0.012, 0.018, 2),
      collar: new THREE.CylinderGeometry(0.078, 0.07, 0.07, 20),
      handle: new THREE.CylinderGeometry(HAMMER.r, HAMMER.r * 0.95, HAMMER.handleTop - HAMMER.handleBottom, 18),
      wrap: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.014, 6, false),
      pommel: new THREE.CylinderGeometry(0.072, 0.06, 0.06, 20),
      pommelCap: new THREE.SphereGeometry(0.072, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      ring: new THREE.TorusGeometry(0.03, 0.01, 8, 16),
      strap: new THREE.TubeGeometry(strap, 40, 0.016, 6, true),
    };
  }, []);
  const mats = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.62, roughness: 0.26, emissive: new THREE.Color(STEEL), emissiveIntensity: 0.18 }),
      steelDark: toy(STEEL_DARK, { metal: 0.6, rough: 0.3, glow: 0.16 }),
      leather: toy(LEATHER, { rough: 0.7, glow: 0.16 }),
      leatherLight: toy(LEATHER_LIGHT, { rough: 0.65, glow: 0.16 }),
    }),
    [],
  );
  const k = clamp01(crackle);
  const flick = 0.8 + 0.2 * hash(Math.floor(t * 20));
  mats.steel.emissive.set(STEEL).lerp(new THREE.Color("#8FD8FF"), k * 0.7);
  mats.steel.emissiveIntensity = 0.18 + 0.5 * k * flick;
  const { w, h, d, y } = HAMMER.head;
  const step = Math.floor(t * 10);
  const handleLen = HAMMER.handleTop - HAMMER.handleBottom;
  return (
    <group>
      {/* Head. */}
      <group position={[0, y, 0]}>
        <mesh geometry={geos.head} material={mats.steel} castShadow />
        {[-1, 1].map((s) => (
          <mesh key={`e${s}`} geometry={geos.endPanel} material={mats.steelDark} position={[(s * w) / 2, 0, 0]} />
        ))}
        {[-1, 1].map((s) => (
          <group key={`f${s}`} position={[0, 0, (s * d) / 2]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <mesh geometry={geos.faceBorder} material={mats.steelDark} position={[0, 0, 0.004]} />
            <mesh geometry={geos.faceInner} material={mats.steel} position={[0, 0, 0.008]} />
            <mesh geometry={geos.boss} material={mats.steelDark} position={[0, 0, 0.02]} />
            <mesh geometry={geos.bossRing} material={mats.steelDark} position={[0, 0, 0.022]} />
          </group>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`b${s}`} geometry={geos.topBand} material={mats.steelDark} position={[0, (s * h) / 2 - s * 0.05, 0]} />
        ))}
      </group>
      <mesh geometry={geos.collar} material={mats.steelDark} position={[0, HAMMER.handleTop - 0.01, 0]} />
      {/* Handle. */}
      <mesh geometry={geos.handle} material={mats.leather} position={[0, HAMMER.handleBottom + handleLen / 2, 0]} castShadow />
      <mesh geometry={geos.wrap} material={mats.leatherLight} />
      <mesh geometry={geos.pommel} material={mats.steelDark} position={[0, HAMMER.handleBottom - 0.01, 0]} />
      <mesh geometry={geos.pommelCap} material={mats.steel} position={[0, HAMMER.handleBottom - 0.035, 0]} scale={[1, 0.6, 1]} />
      <mesh geometry={geos.ring} material={mats.steelDark} position={[0, HAMMER.handleBottom - 0.085, 0]} rotation={[0, Math.PI / 2, 0]} />
      <group position={[0, HAMMER.handleBottom - 0.07, 0]} rotation={[0.2 * strapSwing, 0, 0.35 * strapSwing]}>
        <mesh geometry={geos.strap} material={mats.leather} position={[0, 0.33 - 0.035, 0]} scale={[1, 1, 0.5]} />
      </group>
      {/* Crackle. */}
      {k > 0.01 ? (
        <group>
          <Glow color="#7FD3FF" size={1.6} opacity={0.55 * k * flick} position={[0, y, 0]} />
          {[0, 1, 2].map((i) => {
            const [a, b] = HEAD_ARCS[(step + i * 2) % HEAD_ARCS.length];
            return <LightningBolt key={i} from={a} to={b} t={t + i * 0.21} seed={(step + i) % 6} width={0.07} forks={1} jag={1.3} flares={false} amount={k} />;
          })}
        </group>
      ) : null}
    </group>
  );
};

/**
 * Hammer in a fin (upright fin-tip space): gripped in front of the tip, head up, leaning a touch
 * outwards; scale 6.5 (≈ 1.5 long for Nubi at size 2).
 */
export const HAMMER_HOLD: Hold = { position: [0.2, 0.1, 1.1], rotation: [0.08, 0.15, -0.12], scale: 6.5 };
export const HAMMER_HOLD_L: Hold = mirrorHold(HAMMER_HOLD);

// =======================================================================================
// Star shield

const SHIELD_R = 0.55;
const SHIELD_BANDS: [number, string][] = [
  [0.205, "#1E5BD8"],
  [0.31, "#E3262B"],
  [0.425, "#F4F4F6"],
  [SHIELD_R + 0.01, "#E3262B"],
];

/** Shield dish: a lathe facing +z with crisp colour bands (non-indexed, coloured per face). */
const shieldDish = () => {
  const prof: THREE.Vector2[] = [];
  const N = 44;
  for (let i = 0; i <= N; i++) {
    const r = (i / N) * SHIELD_R;
    prof.push(new THREE.Vector2(r, 0.07 * (1 - (r / SHIELD_R) ** 2)));
  }
  const lathe = new THREE.LatheGeometry(prof, 64);
  lathe.rotateX(Math.PI / 2);
  // Smooth normals come from the indexed lathe; the copy is non-indexed for per-face colours.
  const g = lathe.toNonIndexed();
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    let r = 0;
    for (let k = 0; k < 3; k++) r += Math.hypot(p.getX(f + k), p.getY(f + k)) / 3;
    c.set(SHIELD_BANDS.find(([rr]) => r < rr)?.[1] ?? "#E3262B");
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
};

const starShape = (ro: number, ri: number) => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? ri : ro;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
};

/**
 * Round star shield, diameter 1.1 (radius 0.55), face to +z: red / white / red rings, a blue
 * centre and a raised white five-point star, a red rolled rim, a grey back with leather straps.
 * Origin = centre of the dish's back.
 */
export const StarShield: React.FC = () => {
  const geos = useMemo(
    () => ({
      dish: shieldDish(),
      back: new THREE.CircleGeometry(SHIELD_R, 48).rotateY(Math.PI),
      rim: new THREE.TorusGeometry(SHIELD_R, 0.028, 10, 64),
      star: new THREE.ExtrudeGeometry(starShape(0.18, 0.074), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 4 }),
      strap: roundBox(0.5, 0.06, 0.02, 0.008, 2),
      grip: new THREE.CylinderGeometry(0.02, 0.02, 0.22, 10),
    }),
    [],
  );
  const dishMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.25, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.16, side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif",
      );
    };
    m.customProgramCacheKey = () => "thanos-shield-dish";
    return m;
  }, []);
  return (
    <group>
      <mesh geometry={geos.dish} material={dishMat} castShadow />
      <mesh geometry={geos.back} material={toy("#8E96A3", { metal: 0.5, rough: 0.4 })} position={[0, 0, -0.002]} />
      <mesh geometry={geos.rim} material={toy("#C81E24", { metal: 0.3, rough: 0.3, glow: 0.18 })} />
      <mesh geometry={geos.star} material={toy("#FFFFFF", { metal: 0.2, rough: 0.25, glow: 0.22 })} position={[0, 0, 0.062]} />
      {[-0.1, 0.1].map((y) => (
        <mesh key={y} geometry={geos.strap} material={toy("#6B3E1E", { rough: 0.7 })} position={[0, y, -0.03]} />
      ))}
      <mesh geometry={geos.grip} material={toy("#4A2A16", { rough: 0.7 })} position={[0.2, 0, -0.05]} />
    </group>
  );
};

/**
 * Shield on a fin (upright fin-tip space), shown face-on to the camera in front of the fin tip
 * and a little outwards; scale 5 (≈ 1.1 across for Nubi at size 2).
 */
export const SHIELD_HOLD: Hold = { position: [-0.4, 0.4, 3.9], rotation: [0, -0.2, 0.05], scale: 5 };
export const SHIELD_HOLD_L: Hold = mirrorHold(SHIELD_HOLD);

// =======================================================================================
// Rock

let plainRockGeo: THREE.BufferGeometry | null = null;
/** Lumpy low-poly rock, radius ≈ 1, flat grey faces. */
const getPlainRock = () => {
  if (plainRockGeo) return plainRockGeo;
  const g = new THREE.IcosahedronGeometry(1, 2).toNonIndexed();
  const p = g.attributes.position;
  const d = new THREE.Vector3();
  const cache = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const key = `${d.x.toFixed(4)}|${d.y.toFixed(4)}|${d.z.toFixed(4)}`;
    let r = cache.get(key);
    if (r === undefined) {
      r = 1 + 0.17 * noise3(d.x * 1.4 + 3.1, d.y * 1.4, d.z * 1.4 - 1.1) + 0.06 * noise3(d.x * 3.6, d.y * 3.6 + 2, d.z * 3.6);
      cache.set(key, r);
    }
    p.setXYZ(i, d.x * r * 1.12, d.y * r * 0.82, d.z * r);
  }
  const pal = ["#8F9298", "#7D8087", "#A3A6AC", "#878A90", "#6F7279"].map((c) => new THREE.Color(c));
  const col = new Float32Array(p.count * 3);
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const n = noise3(cx * 2.2, cy * 2.2 + 4, cz * 2.2);
    const c = pal[Math.max(0, Math.min(pal.length - 1, Math.floor((n + 0.6) * 3.6)))];
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  plainRockGeo = g;
  return g;
};

const rockMatCache = new Map<string, THREE.MeshStandardMaterial>();
const rockMat = (tint: string) => {
  let m = rockMatCache.get(tint);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, color: tint, roughness: 0.85, flatShading: true, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.14 });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb * diffuse;\n#endif",
      );
    };
    m.customProgramCacheKey = () => "thanos-rock";
    rockMatCache.set(tint, m);
  }
  return m;
};

/**
 * A plain grey rock (the comedy prop): lumpy, flat-shaded, `size` = width (default 0.36, fits a
 * fin), resting on y = 0 (origin at the bottom). `tint` multiplies its greys (e.g. "#E8C9A8"
 * for a dusty desert rock to trip over). `seed` turns it to show another side.
 */
export const Rock: React.FC<{ size?: number; seed?: number; tint?: string }> = ({ size = 0.36, seed = 0, tint = "#FFFFFF" }) => {
  const s = size / 2.24;
  return (
    <group rotation={[0, seed * 2.4, 0]}>
      <mesh geometry={getPlainRock()} material={rockMat(tint)} position={[0, 0.78 * s, 0]} scale={s} castShadow receiveShadow />
    </group>
  );
};

/** Rock held up proudly on a fin (upright fin-tip space), scale 6.5 (≈ 0.47 across at size 2). */
export const ROCK_HOLD: Hold = { position: [0.4, 0.75, 1.9], rotation: [0.15, 0.3, 0], scale: 6.5 };
export const ROCK_HOLD_L: Hold = mirrorHold(ROCK_HOLD);

// =======================================================================================
// Portal

const PORTAL_INNER_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const PORTAL_INNER_FRAG = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uRim;
uniform float uR;
uniform float uOpacity;
uniform float uTime;
varying vec2 vP;
void main() {
  float r = length(vP) / max(uR, 1e-3);
  if (r > 1.0) discard;
  float y = clamp(vP.y / max(uR, 1e-3) * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uBottom, uTop, smoothstep(0.15, 1.0, y));
  // A far horizon of soft hills, and a bright glow along it.
  float hx = vP.x / max(uR, 1e-3);
  float hill = 0.4 + 0.035 * sin(hx * 7.0 + 1.3) + 0.025 * sin(hx * 17.0);
  float land = smoothstep(hill + 0.01, hill - 0.01, y);
  col = mix(col, uBottom * 0.62, land);
  col += uTop * 0.35 * exp(-pow((y - hill) * 14.0, 2.0));
  // Shimmering rim.
  float th = atan(vP.y, vP.x);
  float rim = smoothstep(0.72, 0.98, r) * (0.75 + 0.25 * sin(th * 14.0 + uTime * 5.0));
  col = mix(col, uRim, rim * 0.55);
  float a = (1.0 - smoothstep(0.9, 1.0, r)) * uOpacity;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

const PORTAL_ORANGE = "#FF8A1A";

/**
 * Sorcerer-style portal: a ring of orange sparks spinning in the xy plane (facing +z, centred
 * on the origin), short arcs whizzing round it and sparks flung off tangentially that fall away,
 * with a soft glow band. `radius` world units (2 = doorway for Nubi, 12+ = giant portal for an
 * army); `open` 0..1: 0..0.35 a spark draws the circle, then it settles to full size and the
 * inside fades in (> 0.45); run it back to 0 to close. `inner`: false = see-through ring,
 * true = a soft sunny "other place" (gradient sky, far hills), or [sky top, ground] colours.
 * `t` = scene clock (spin). `spin` rad/s (sign = direction), `sparks` density factor (1 = default).
 */
export const Portal: React.FC<{ radius?: number; open?: number; t?: number; inner?: boolean | [string, string]; spin?: number; sparks?: number; color?: string }> = ({
  radius = 2,
  open = 1,
  t = 0,
  inner = false,
  spin = 2.6,
  sparks = 1,
  color = PORTAL_ORANGE,
}) => {
  const mats = useMemo(
    () => ({
      band: makeRingMaterial(color, "#FFE9A8"),
      haze: makeRingMaterial(color, "#000000"),
      inner: new THREE.ShaderMaterial({
        vertexShader: PORTAL_INNER_VERT,
        fragmentShader: PORTAL_INNER_FRAG,
        uniforms: {
          uTop: { value: new THREE.Color("#9FE3FF") },
          uBottom: { value: new THREE.Color("#FFD27A") },
          uRim: { value: new THREE.Color("#FFB347") },
          uR: { value: 1 },
          uOpacity: { value: 1 },
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    }),
    [color],
  );
  const innerGeo = useMemo(() => new THREE.CircleGeometry(1, 96), []);
  const o = clamp01(open);
  if (o <= 0.003) return null;
  const arc = clamp01(o / 0.35);
  const rr = lerp(0.82, 1, smooth((o - 0.15) / 0.45));
  const inK = smooth((o - 0.45) / 0.4);
  const big = radius > 6;
  const flick = 0.9 + 0.1 * Math.sin(t * 23) * Math.sin(t * 13.7);
  const bu = mats.band.uniforms;
  bu.uR.value = rr / 1.3;
  bu.uW.value = 0.026;
  bu.uOpacity.value = (arc >= 1 ? 1 : 0.6) * flick * Math.min(1, o * 3);
  bu.uTime.value = t;
  bu.uWobble.value = 0.35;
  const hu = mats.haze.uniforms;
  hu.uR.value = rr / 1.3;
  hu.uW.value = 0.11;
  hu.uOpacity.value = 0.22 * Math.min(1, o * 2);
  hu.uTime.value = t * 0.7;
  hu.uWobble.value = 0.2;
  if (inner) {
    const [top, bottom] = inner === true ? ["#9FE3FF", "#FFD27A"] : inner;
    (mats.inner.uniforms.uTop.value as THREE.Color).set(top);
    (mats.inner.uniforms.uBottom.value as THREE.Color).set(bottom);
    mats.inner.uniforms.uR.value = rr * 0.985;
    mats.inner.uniforms.uOpacity.value = inK;
    mats.inner.uniforms.uTime.value = t;
  }
  const density = Math.max(0.2, sparks);
  const nOrbit = Math.round((big ? 520 : 300) * density);
  const nFly = Math.round((big ? 260 : 150) * density);
  const sw = big ? 0.016 : 0.03;
  // While the circle is being drawn the band only covers the drawn arc: mask it with sparks only.
  return (
    <group scale={radius}>
      {inner && inK > 0.01 ? <mesh geometry={innerGeo} material={mats.inner} renderOrder={3} /> : null}
      {arc >= 1 ? (
        <>
          <mesh geometry={getUnitRing()} material={mats.haze} scale={1.3} renderOrder={5} />
          <mesh geometry={getUnitRing()} material={mats.band} scale={1.3} rotation={[0, 0, t * spin]} renderOrder={6} />
        </>
      ) : null}
      <Sparks mode="orbit" count={nOrbit} seed={big ? 31 : 32} time={t} width={sw * 1.15} tail={0.32} spin={spin} spread={0.09} open={rr} arc={arc} head="#FFF4C8" tailColor={color} opacity={flick} />
      <Sparks
        mode="fly"
        count={nFly}
        seed={big ? 33 : 34}
        time={t}
        width={sw}
        tail={0.05}
        life={0.55}
        speed={1.15}
        gravity={2.6}
        spread={0.55}
        spin={spin}
        open={rr}
        arc={arc}
        head="#FFF4C8"
        tailColor={color}
        opacity={Math.min(1, o * 2)}
      />
      {/* The spark drawing the circle while it opens. */}
      {arc < 1 ? (
        <Glow color={color} size={0.5} opacity={1} position={[Math.cos(arc * Math.PI * 2 + t * spin) * rr, Math.sin(arc * Math.PI * 2 + t * spin) * rr, 0.02]} />
      ) : null}
      <Glow color={color} size={2.9 * rr} opacity={0.22 * o} />
    </group>
  );
};

/** The portal's spark orange (for matching glows in a scene). */
export const PORTAL_COLOR = PORTAL_ORANGE;
