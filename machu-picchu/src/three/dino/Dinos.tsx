import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BlobShadow } from "../BlobShadow";
import { V3, eulerY, noise3, toy } from "../inca/kit";

// Cartoon dinosaurs for "¿Y si los dinosaurios nunca se hubieran extinguido?": chunky vinyl-toy
// creatures (rounded boxes, capsule chains, flat saturated colours with a little emissive,
// round black eyes with a white glint), comedic rather than scary.
//
// Units follow the oxygen props: WORLD units sized for Nubi at size 2 (Nubi is then 2 wide and
// 1.98 tall), ground at y = 0, and every creature faces +z. `size` is a plain scale factor: at
// size 1 each dinosaur has its canonical size next to a Nubi of size 2:
//   TRex      6.9 tall (top of the eye bumps) ≈ 3.5x Nubi; ≈ 9.3 long (snout to tail), 3.6 wide.
//   Raptor    2.0 tall (top of the head)      ≈ 1x Nubi (turkey-sized); crest tip ≈ 2.3, ≈ 3.7 long.
//   Brachio   15.8 tall (top of the head)     ≈ 8x Nubi; ≈ 19 long, back ≈ 9.
//   Trike     2.4 tall (top of the frill)     ≈ 1.2x Nubi; ≈ 4 long (beak to tail).
//   BabyDino  1.39 tall (top of the head)     ≈ 0.7x Nubi; ≈ 1.3 long.
// Next to a Nubi of another size s, multiply `size` by s / 2.
//
// Animation only comes from props (`pose`); geometries and materials are cached and shared.
// Common pose conventions: `blink` 0 = open, 1 = closed; yaw > 0 turns towards +x (screen
// right when the creature faces the camera); pitch > 0 tips the snout down; walk / run cycles
// take an amplitude 0..1 and a phase in radians (one stride of each leg per 2π). Feet stay on
// the ground through the cycles (the body drops to the lowest foot).

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const PI = Math.PI;

// =======================================================================================
// Geometry kit (cached per shape and shared between instances; never mutate the results).

const geoCache = new Map<string, THREE.BufferGeometry>();
const cachedGeo = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
};

/** Unit sphere; scale the mesh into ellipsoids. */
const sphere = () => cachedGeo("sphere", () => new THREE.SphereGeometry(1, 40, 28));
/** Upper unit hemisphere (flat side down), for eyelids. */
const dome = () => cachedGeo("dome", () => new THREE.SphereGeometry(1, 32, 12, 0, PI * 2, 0, PI / 2));
/** Low-poly puff for breath fog. */
const puff = () => cachedGeo("puff", () => new THREE.IcosahedronGeometry(1, 2));

/** Lathe profile of a sphere-swept cone along +y (see `taper`). */
const taperProfile = (r0: number, r1: number, len: number) => {
  const phi = Math.asin(clamp((r0 - r1) / len, -0.97, 0.97));
  const pts: THREE.Vector2[] = [];
  const n0 = Math.max(6, Math.round(((phi + PI / 2) / PI) * 20));
  const n1 = Math.max(6, Math.round(((PI / 2 - phi) / PI) * 20));
  for (let i = 0; i <= n0; i++) {
    const a = -PI / 2 + (i / n0) * (phi + PI / 2);
    pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)));
  }
  // A few points along the straight flank so long cones shade evenly.
  const ax = r0 * Math.cos(phi);
  const ay = r0 * Math.sin(phi);
  const bx = r1 * Math.cos(phi);
  const by = len + r1 * Math.sin(phi);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    pts.push(new THREE.Vector2(ax + (bx - ax) * t, ay + (by - ay) * t));
  }
  for (let i = 0; i <= n1; i++) {
    const a = phi + (i / n1) * (PI / 2 - phi);
    pts.push(new THREE.Vector2(r1 * Math.cos(a), len + r1 * Math.sin(a)));
  }
  pts[0].x = 0;
  pts[pts.length - 1].x = 0;
  return pts;
};

/**
 * Sphere-swept cone along +y: a ball of radius r0 at the origin and one of radius r1 at
 * y = len, joined by their tangent cone. Chained end to end with matching radii they bend at
 * the joints without seams (necks, tails, legs).
 */
const taper = (r0: number, r1: number, len: number) =>
  cachedGeo(`taper|${r0}|${r1}|${len}`, () => new THREE.LatheGeometry(taperProfile(r0, r1, len), 32));

/** A taper bent by `bend` radians towards +z over its length: horns, claws, spikes, feathers. */
const horn = (r0: number, r1: number, len: number, bend: number) =>
  cachedGeo(`horn|${r0}|${r1}|${len}|${bend}`, () => {
    const lathe = new THREE.LatheGeometry(taperProfile(r0, r1, len), 20);
    lathe.deleteAttribute("normal");
    lathe.deleteAttribute("uv");
    const g = mergeVertices(lathe);
    if (Math.abs(bend) > 1e-4) {
      const R = len / bend;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const th = p.getY(i) / R;
        const z = p.getZ(i);
        p.setXYZ(i, x, (R - z) * Math.sin(th), R - (R - z) * Math.cos(th));
      }
    }
    g.computeVertexNormals();
    return g;
  });

type Deform = (v: THREE.Vector3, w: number, h: number, d: number) => void;

/** Rounded box with evenly subdivided faces (so it can be deformed), shared vertices. */
const box = (key: string, w: number, h: number, d: number, r: number, deform?: Deform) =>
  cachedGeo(`box|${key}|${w}|${h}|${d}|${r}`, () => {
    const step = Math.min(r / 2.6, Math.min(w, h, d) / 5);
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
      if (deform) deform(v, w, h, d);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.deleteAttribute("normal");
    g.deleteAttribute("uv");
    const m = mergeVertices(g);
    m.computeVertexNormals();
    return m;
  });

/** Narrows the box towards +z: width × (1 - k) at the front. */
const taperZ =
  (k: number, drop = 0): Deform =>
  (v, _w, h, d) => {
    const t = clamp01(v.z / d + 0.5);
    v.x *= 1 - k * t;
    // Optionally lower the top towards the front (a sloping snout).
    if (drop) v.y -= drop * t * clamp01(v.y / h + 0.5);
  };

/** Lumpy unit sphere (fluffy feathers): pushed out along its normals by seeded noise. */
const fluff = (amp: number, freq: number, seed: number) =>
  cachedGeo(`fluff|${amp}|${freq}|${seed}`, () => {
    const ico = new THREE.IcosahedronGeometry(1, 14);
    ico.deleteAttribute("normal");
    ico.deleteAttribute("uv");
    const g = mergeVertices(ico);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n1 = noise3(v.x * freq + seed, v.y * freq, v.z * freq);
      const n2 = noise3(v.x * freq * 2.3, v.y * freq * 2.3 + seed, v.z * freq * 2.3);
      // Ridged: soft round tufts separated by creases.
      const k = 0.6 * (1 - 2 * Math.abs(n1)) + 0.4 * n2;
      v.multiplyScalar(1 + amp * k);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });

/** Scalloped half-fan outline (triceratops frill): radius R with `bumps` round lobes. */
const frillGeo = (R: number, bumps: number, amp: number) =>
  cachedGeo(`frill|${R}|${bumps}|${amp}`, () => {
    const a0 = -0.42;
    const a1 = PI + 0.42;
    const s = new THREE.Shape();
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const a = a0 + ((a1 - a0) * i) / N;
      const u = ((a - a0) / (a1 - a0)) * bumps;
      const r = R * (1 + amp * Math.sqrt(Math.abs(Math.sin(u * PI))));
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    }
    s.lineTo(0, -R * 0.45);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.07 * R,
      bevelEnabled: true,
      bevelThickness: 0.05 * R,
      bevelSize: 0.05 * R,
      bevelSegments: 3,
      curveSegments: 4,
    });
    g.translate(0, 0, -0.035 * R);
    g.computeVertexNormals();
    return g;
  });

// =======================================================================================
// Shared parts

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit flat colour (eye glints). Cached; never mutate. */
const basic = (color: string) => {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    basicCache.set(color, m);
  }
  return m;
};

const eyeMat = () => toy("#141414", { rough: 0.2, glow: 0 });

type Seg = { r0: number; r1: number; len: number; rot?: V3; stretch?: number };

/**
 * Chain of tapers along +y: each segment starts at the tip of the previous one, turned by its
 * own `rot`. `deco(i, seg)` adds meshes in segment i's frame; `tip` renders at the far end.
 */
const Chain: React.FC<{
  segs: Seg[];
  mat: THREE.Material;
  deco?: (i: number, s: Seg) => React.ReactNode;
  tip?: React.ReactNode;
  from?: number;
}> = ({ segs, mat, deco, tip, from = 0 }) => {
  const s = segs[from];
  if (!s) return <>{tip}</>;
  const k = s.stretch ?? 1;
  return (
    <group rotation={s.rot ?? [0, 0, 0]}>
      <mesh geometry={taper(s.r0, s.r1, s.len)} material={mat} scale={[1, k, 1]} castShadow />
      {deco ? deco(from, s) : null}
      <group position={[0, s.len * k, 0]}>
        <Chain segs={segs} mat={mat} deco={deco} tip={tip} from={from + 1} />
      </group>
    </group>
  );
};

/** Ellipsoid shorthand. */
const Ell: React.FC<{ m: THREE.Material; p?: V3; r: V3; rot?: V3; geo?: THREE.BufferGeometry }> = ({
  m,
  p = [0, 0, 0],
  r,
  rot = [0, 0, 0],
  geo,
}) => <mesh geometry={geo ?? sphere()} material={m} position={p} rotation={rot} scale={r} castShadow />;

type Lid = { mat: THREE.Material; cover: number; tilt: number };

/**
 * Glossy round black eye with a white glint, looking along its local +z. `r` is the eye's
 * half-height; blink squashes it into a line (like Nubi's). An optional lid (skin coloured)
 * covers its top `cover` fraction with a tilted edge (sleepy, sly or angry looks) and closes
 * with the blink.
 */
const Eye: React.FC<{
  r: number;
  position: V3;
  rotation?: V3;
  blink?: number;
  depth?: number;
  wide?: number;
  glints?: 1 | 2;
  lid?: Lid;
}> = ({ r, position, rotation = [0, 0, 0], blink = 0, depth = 0.55, wide = 0.86, glints = 1, lid }) => {
  const b = clamp01(blink);
  const sy = lid ? Math.max(0.1, 1 - b * 0.6) : Math.max(0.1, 1 - b);
  const gz = (gx: number, gy: number) => depth * r * Math.sqrt(Math.max(0, 1 - (gx / wide) ** 2 - gy ** 2));
  const cover = lid ? lid.cover + (1 - lid.cover) * b : 0;
  // Keep the glint under the lid's edge.
  const gy = lid ? Math.min(0.36, 0.72 - 2 * lid.cover) : 0.36;
  return (
    <group position={position} rotation={rotation}>
      <group scale={[1, sy, 1]}>
        <mesh geometry={sphere()} material={eyeMat()} scale={[r * wide, r, r * depth]} />
        <mesh
          geometry={sphere()}
          material={basic("#FFFFFF")}
          position={[-0.3 * r, gy * r, gz(0.3, gy)]}
          scale={[0.23 * r, 0.23 * r, 0.07 * r]}
        />
        {glints === 2 ? (
          <mesh
            geometry={sphere()}
            material={basic("#FFFFFF")}
            position={[0.3 * r, -0.32 * r, gz(0.3, 0.32)]}
            scale={[0.11 * r, 0.11 * r, 0.05 * r]}
          />
        ) : null}
      </group>
      {lid ? (
        <group rotation={[0, 0, lid.tilt]}>
          <mesh
            geometry={dome()}
            material={lid.mat}
            position={[0, r * (1 - 2 * cover), 0]}
            scale={[r * wide * 1.22, r * 1.25, r * depth * 1.3]}
          />
        </group>
      ) : null}
    </group>
  );
};

/**
 * Breath fog: a snort of puffs shooting along +z from the origin, growing and fading.
 * `progress` 0..1 runs one snort (nothing at 0 and 1).
 */
const Breath: React.FC<{
  progress: number;
  count?: number;
  dist?: number;
  r0?: number;
  r1?: number;
  spread?: number;
  seed?: number;
}> = ({ progress, count = 8, dist = 1.4, r0 = 0.06, r1 = 0.34, spread = 0.3, seed = 0 }) => {
  const mats = useMemo(
    () =>
      Array.from(
        { length: count },
        () =>
          new THREE.MeshStandardMaterial({
            color: "#F4F8FF",
            roughness: 1,
            transparent: true,
            depthWrite: false,
            emissive: new THREE.Color("#FFFFFF"),
            emissiveIntensity: 0.5,
          }),
      ),
    [count],
  );
  const p = clamp01(progress);
  if (p <= 0.001 || p >= 0.999) return null;
  return (
    <group>
      {mats.map((m, i) => {
        const delay = (i / count) * 0.32;
        const q = clamp01((p - delay) / 0.68);
        if (q <= 0 || q >= 1) return null;
        const e = 1 - (1 - q) ** 2.4;
        const a = i * 2.39996 + seed;
        const lat = 0.35 + 0.65 * (((i * 0.618 + seed * 0.37) % 1 + 1) % 1);
        const x = Math.cos(a) * spread * e * lat;
        const y = Math.sin(a) * spread * 0.55 * e * lat + 0.18 * q * q;
        const z = dist * e * (0.7 + 0.3 * Math.sin(i * 1.7 + seed));
        const r = (r0 + (r1 - r0) * e) * (0.8 + 0.25 * Math.cos(i * 2.1 + seed));
        m.opacity = 0.9 * Math.min(1, q * 8) * (1 - q) ** 1.2;
        return <mesh key={i} geometry={puff()} material={m} position={[x, y, z]} scale={r} rotation={[i, i * 1.3, 0]} />;
      })}
    </group>
  );
};

/** Pose of a leg in its side plane: absolute angles about x (0 = +y, π = straight down). */
const fk = (lens: number[], angles: number[]) => {
  let y = 0;
  let z = 0;
  for (let i = 0; i < lens.length; i++) {
    y += lens[i] * Math.cos(angles[i]);
    z += lens[i] * Math.sin(angles[i]);
  }
  return { y, z };
};

// =======================================================================================
// T-REX

export type TRexPose = {
  /** Walk cycle amplitude 0..1 and phase (radians): a heavy, waddling stride. */
  walk?: number;
  walkPhase?: number;
  /** Mouth: 0 = closed (a toothy grin), 1 = wide open. */
  jaw?: number;
  /** Head turn (radians): > 0 turns towards +x (screen right when it faces the camera). */
  headYaw?: number;
  /** Head nod (radians): > 0 snout down, < 0 snout up. */
  headPitch?: number;
  /** Neck bend -1..1: > 0 forward and down (to sniff at Nubi), < 0 back and up. */
  neck?: number;
  /** 0..1 tilts the torso forward over the hips (up to ~30°); the tail rises to balance. */
  lean?: number;
  /** Tail swish -1..1: > 0 swings the tip towards +x. */
  tail?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** 0..1: the neck stretches up and forward, the snout lifts, the jaw opens wide, arms up. */
  roar?: number;
  /** Tiny-arm flap -1..1 (0 = rest, 1 = both arms up, -1 = tucked in): drive with a sine. */
  armsWave?: number;
  /** 0..1 progress of one snort: puffs of breath fog shoot out of the nostrils. */
  snort?: number;
};

const REX = {
  skin: "#2EB872",
  dark: "#1A8C5A",
  belly: "#FFA235",
  claw: "#FFF3D6",
  mouth: "#D8386A",
  throat: "#8E1C45",
  tongue: "#FF7EA8",
  tooth: "#FFFFFF",
  nostril: "#11573A",
};

const rexMats = () => ({
  skin: toy(REX.skin, { rough: 0.42, glow: 0.14 }),
  dark: toy(REX.dark, { rough: 0.45, glow: 0.12 }),
  belly: toy(REX.belly, { rough: 0.45, glow: 0.16 }),
  claw: toy(REX.claw, { rough: 0.35, glow: 0.18 }),
  mouth: toy(REX.mouth, { rough: 0.5, glow: 0.14 }),
  throat: toy(REX.throat, { rough: 0.6, glow: 0.1 }),
  tongue: toy(REX.tongue, { rough: 0.4, glow: 0.16 }),
  tooth: toy(REX.tooth, { rough: 0.3, glow: 0.22 }),
  nostril: toy(REX.nostril, { rough: 0.5, glow: 0 }),
});

// Head space: origin at the neck joint (the back-bottom of the head), +z along the snout.
const REX_SNOUT = { w: 1.5, h: 0.78, d: 1.95, r: 0.36, k: 0.16, p: [0, 0.4, 1.58] as V3 };
const REX_JAW = { hinge: [0, 0.1, 0.55] as V3, w: 1.22, h: 0.42, d: 1.9, r: 0.2, k: 0.2, p: [0, -0.16, 0.98] as V3 };
const rexSnoutHalf = (z: number) =>
  (REX_SNOUT.w / 2) * (1 - REX_SNOUT.k * clamp01((z - REX_SNOUT.p[2]) / REX_SNOUT.d + 0.5));
const rexJawHalf = (z: number) => (REX_JAW.w / 2) * (1 - REX_JAW.k * clamp01((z - REX_JAW.p[2]) / REX_JAW.d + 0.5));

const REX_TOP_TEETH: V3[] = [
  ...[1.08, 1.52, 1.96].flatMap((z) => [-1, 1].map((s): V3 => [s * (rexSnoutHalf(z) - 0.11), 0.1, z])),
  ...[-1, 1].flatMap((s): V3[] => [
    [s * 0.41, 0.1, 2.3],
    [s * 0.15, 0.1, 2.42],
  ]),
];
const REX_LOW_TEETH: V3[] = [
  ...[0.85, 1.3].flatMap((z) => [-1, 1].map((s): V3 => [s * (rexJawHalf(z) - 0.11), 0.0, z])),
  ...[-1, 1].flatMap((s): V3[] => [
    [s * 0.32, 0.0, 1.7],
    [s * 0.12, 0.0, 1.81],
  ]),
];
const REX_NOSTRILS: V3[] = [
  [-0.24, 0.775, 2.3],
  [0.24, 0.775, 2.3],
];

/** Where things held in the T-Rex's jaws sit (head space): between the front teeth. */
export const TREX_BITE: V3 = [0, 0.05, 2.2];

/**
 * First-person camera for <TRexHead>, in head space at size 1 (trexHeadCamera turns it into
 * world space): just above and behind the eye bumps, looking out over the snout, which runs up
 * the bottom of the frame between the two eye bumps with the nostrils in view. Nothing is
 * closer than ≈ 0.7, so the scenes' default near plane (0.5) is fine.
 */
export const TREX_HEAD_FP = { position: [0, 1.8, -0.2] as V3, target: [0, 1.0, 6.0] as V3, fov: 60 };

/**
 * World camera ({position, target, fov}) for the first-person shot, given how the <TRexHead> is
 * placed (same position / rotation / yaw / pitch / size props: pass the same object to both). Pitch the head down (pitch > 0) to look
 * down at something on the ground: the snout then points at it from the bottom of the frame.
 * Feed the result to CameraRig; move the head and the camera follows.
 */
export const trexHeadCamera = (
  head: { position?: V3; rotation?: V3; yaw?: number; pitch?: number; size?: number },
  fp = TREX_HEAD_FP,
) => {
  const [rp, ry, rr] = head.rotation ?? [0, 0, 0];
  const mtx = new THREE.Matrix4().compose(
    new THREE.Vector3(...(head.position ?? [0, 0, 0])),
    // Same order as <TRexHead>: turn (yaw) first, then nod (pitch) about the head's own x axis.
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rp + (head.pitch ?? 0), ry + (head.yaw ?? 0), rr, "YXZ")),
    new THREE.Vector3().setScalar(head.size ?? 1),
  );
  const p = new THREE.Vector3(...fp.position).applyMatrix4(mtx);
  const t = new THREE.Vector3(...fp.target).applyMatrix4(mtx);
  return { position: [p.x, p.y, p.z] as V3, target: [t.x, t.y, t.z] as V3, fov: fp.fov };
};

const RexHeadModel: React.FC<{
  jaw: number;
  blink: number;
  roar: number;
  snort: number;
  children?: React.ReactNode;
}> = ({ jaw, blink, roar, snort, children }) => {
  const m = rexMats();
  const open = clamp01(Math.max(jaw, roar));
  const jawAngle = 0.62 * open + 0.2 * clamp01(roar);
  const tooth = horn(0.1, 0.05, 0.16, 0);
  const lowTooth = horn(0.09, 0.045, 0.12, 0);
  const spike = horn(0.16, 0.05, 0.26, 0.5);
  return (
    <group>
      <mesh geometry={box("rex-cranium", 1.8, 1.16, 1.62, 0.5)} material={m.skin} position={[0, 0.48, 0.38]} castShadow />
      <mesh
        geometry={box("rex-snout", REX_SNOUT.w, REX_SNOUT.h, REX_SNOUT.d, REX_SNOUT.r, taperZ(REX_SNOUT.k))}
        material={m.skin}
        position={REX_SNOUT.p}
        castShadow
      />
      {/* Inside of the mouth: palate and throat (hidden while the jaw is shut). */}
      <Ell m={m.mouth} p={[0, 0.03, 1.55]} r={[0.5, 0.05, 0.82]} />
      <Ell m={m.throat} p={[0, 0.12, 0.85]} r={[0.5, 0.26, 0.32]} />
      {REX_TOP_TEETH.map((p, i) => (
        <mesh key={`t${i}`} geometry={tooth} material={m.tooth} position={p} rotation={[PI, 0, 0]} />
      ))}
      {/* Eye bumps on top of the head, big round eyes on their fronts. */}
      {[-1, 1].map((s) => (
        <group key={`e${s}`}>
          <Ell m={m.skin} p={[s * 0.5, 0.98, 0.98]} r={[0.4, 0.37, 0.4]} />
          <Eye r={0.25} position={[s * 0.55, 1.02, 1.3]} rotation={[0, s * 0.32, 0]} blink={blink} depth={0.5} />
        </group>
      ))}
      {REX_NOSTRILS.map((p, i) => (
        <Ell key={`n${i}`} m={m.nostril} p={p} r={[0.085, 0.05, 0.1]} rot={[0.3, 0, 0]} />
      ))}
      {/* Two spikes run on from the neck over the back of the head. */}
      <mesh geometry={spike} material={m.dark} position={[0, 0.95, -0.2]} rotation={[-0.35, PI, 0]} />
      <mesh geometry={spike} material={m.dark} position={[0, 0.55, -0.5]} rotation={[-1.0, PI, 0]} scale={0.9} />
      <group position={REX_JAW.hinge} rotation={[jawAngle, 0, 0]}>
        <mesh
          geometry={box("rex-jaw", REX_JAW.w, REX_JAW.h, REX_JAW.d, REX_JAW.r, taperZ(REX_JAW.k))}
          material={m.skin}
          position={REX_JAW.p}
          castShadow
        />
        {/* Orange chin, pink floor and tongue. */}
        <Ell m={m.belly} p={[0, -0.21, 0.9]} r={[0.46, 0.18, 0.86]} />
        <Ell m={m.mouth} p={[0, 0.055, 1.0]} r={[0.42, 0.04, 0.76]} />
        <Ell m={m.tongue} p={[0, 0.09 + 0.06 * roar, 0.92]} r={[0.32, 0.1, 0.56]} rot={[-0.12 * roar, 0, 0]} />
        {REX_LOW_TEETH.map((p, i) => (
          <mesh key={`l${i}`} geometry={lowTooth} material={m.tooth} position={p} />
        ))}
      </group>
      {children ? <group position={TREX_BITE}>{children}</group> : null}
      {/* Always mounted (Breath draws nothing at 0), so snorts reuse their materials. */}
      {REX_NOSTRILS.map((p, i) => (
        <group key={`b${i}`} position={[p[0], p[1] + 0.02, p[2] + 0.06]} rotation={[0.22, (i ? 1 : -1) * 0.38, 0]}>
          <Breath progress={snort} seed={i * 3.1} />
        </group>
      ))}
    </group>
  );
};

// Body space (size 1). The torso leans about REX_HIP.
const REX_HIP: V3 = [0, 2.2, -0.2];
const REX_BODY = { p: [0, 2.55, -0.3] as V3, r0: 1.45, r1: 1.02, len: 1.87, tilt: 0.48 };
/** Top of the body (the chest ball), where the neck starts. */
const REX_NECK_BASE: V3 = [
  0,
  REX_BODY.p[1] + REX_BODY.len * Math.cos(REX_BODY.tilt),
  REX_BODY.p[2] + REX_BODY.len * Math.sin(REX_BODY.tilt),
];
const REX_NECK_TILT = 0.36;
const REX_NECK = [
  { r0: 1.0, r1: 0.88, len: 0.8 },
  { r0: 0.88, r1: 0.78, len: 0.62 },
];
/** Shoulders of the tiny arms: on the chest, 0.8 to each side. */
const REX_SHOULDER = (() => {
  const t = 0.82;
  const y = REX_BODY.p[1] + t * REX_BODY.len * Math.cos(REX_BODY.tilt);
  const zc = REX_BODY.p[2] + t * REX_BODY.len * Math.sin(REX_BODY.tilt);
  const r = REX_BODY.r0 + (REX_BODY.r1 - REX_BODY.r0) * t;
  return { x: 0.8, y, z: zc + Math.sqrt(r * r - 0.8 * 0.8) - 0.04 };
})();
const REX_LEG = { x: 0.95, y: 2.25, z: -0.25, thigh: 1.05, shin: 0.85, a1: PI - 0.35, knee: 0.7 };
const REX_ANKLE_REST = fk([REX_LEG.thigh, REX_LEG.shin], [REX_LEG.a1, REX_LEG.a1 + REX_LEG.knee]);

/** The T-Rex head joint (neck tip) in TRex space at size 1, rest pose. */
export const TREX_HEAD_JOINT: V3 = [
  0,
  REX_NECK_BASE[1] + (REX_NECK[0].len + REX_NECK[1].len) * Math.cos(REX_NECK_TILT),
  REX_NECK_BASE[2] + (REX_NECK[0].len + REX_NECK[1].len) * Math.sin(REX_NECK_TILT),
];
/** Height of the T-Rex at size 1 (top of the eye bumps, rest pose): ≈ 3.5x Nubi at size 2. */
export const TREX_HEIGHT = TREX_HEAD_JOINT[1] + 1.38;

/**
 * Big friendly T-Rex: jade green with an orange belly, throat and chin, a row of dark green
 * spikes, a boxy head with eye bumps and a hinged jaw (rounded white teeth, pink tongue),
 * comically tiny arms, big three-toed feet and a thick tail. See TREX_HEIGHT (≈ 6.9 at size 1,
 * 3.5x Nubi at size 2), TREX_HEAD_JOINT and TREX_BITE (`children` sit in its jaws).
 */
export const TRex: React.FC<{
  size?: number;
  pose?: TRexPose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: V3;
  rotationY?: number;
  /** Objects held in its jaws (head space at TREX_BITE: +z along the snout). */
  children?: React.ReactNode;
}> = ({ size = 1, pose = {}, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0, children }) => {
  const {
    walk = 0,
    walkPhase = 0,
    jaw = 0,
    headYaw = 0,
    headPitch = 0,
    neck = 0,
    lean = 0,
    tail = 0,
    blink = 0,
    roar = 0,
    armsWave = 0,
    snort = 0,
  } = pose;
  const m = rexMats();
  const w = clamp01(walk);
  const R = clamp01(roar);
  const nb = clamp(neck, -1, 1);

  // Legs: swing from the hip, the knee folds while the foot is in the air.
  const legs = [1, -1].map((sgn, i) => {
    const ph = walkPhase + i * PI;
    const swing = w * 0.42 * Math.sin(ph);
    const lift = w * Math.max(0, Math.cos(ph));
    const a1 = REX_LEG.a1 - swing - lift * 0.3;
    const knee = REX_LEG.knee + lift * 0.8;
    return { sgn, a1, knee, lift, ankle: fk([REX_LEG.thigh, REX_LEG.shin], [a1, a1 + knee]) };
  });
  const rootY = REX_ANKLE_REST.y - Math.min(...legs.map((l) => l.ankle.y));

  const torsoPitch = clamp01(lean) * 0.5 + R * 0.1 + w * 0.06;
  const roll = w * 0.06 * Math.cos(walkPhase);
  const neckRoot = REX_NECK_TILT + nb * 0.35 + R * 0.3;
  const neck2 = nb * 0.3 - R * 0.12;
  const stretch = 1 + 0.25 * R;
  const headLevel = -(torsoPitch + neckRoot + neck2);
  const pitch = headPitch + nb * 0.3 + clamp01(lean) * 0.25 - R * 0.4 + w * 0.04 * Math.sin(walkPhase * 2);
  const sway = clamp(tail, -1, 1) + w * 0.35 * Math.sin(walkPhase);
  const wave = clamp(armsWave, -1, 1);
  const armUp = PI - 0.75 - 1.25 * wave - 0.7 * R;
  const fore = -(0.95 + 0.45 * wave + 0.3 * R);
  const spike = horn(0.22, 0.06, 0.34, 0.55);

  const tailSegs: Seg[] = [
    { r0: 1.12, r1: 0.86, len: 1.3, rot: [-(PI / 2 + 0.36), 0, -sway * 0.1] },
    { r0: 0.86, r1: 0.6, len: 1.2, rot: [0.08, 0, -sway * 0.16] },
    { r0: 0.6, r1: 0.37, len: 1.1, rot: [0.12, 0, -sway * 0.2] },
    { r0: 0.37, r1: 0.15, len: 1.0, rot: [0.2, 0, -sway * 0.24] },
  ];

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={size}>
      {shadow ? (
        <group position={[0, 0, -0.9]}>
          <BlobShadow radius={2.9} stretch={1.55} opacity={shadowOpacity} />
        </group>
      ) : null}
      <group position={[0, rootY, 0]}>
        {legs.map(({ sgn, a1, knee, lift }) => (
          <group key={sgn} position={[sgn * REX_LEG.x, REX_LEG.y, REX_LEG.z]}>
            <group rotation={[a1, 0, 0]}>
              <mesh geometry={taper(0.86, 0.56, REX_LEG.thigh)} material={m.skin} castShadow />
              <group position={[0, REX_LEG.thigh, 0]} rotation={[knee, 0, 0]}>
                <mesh geometry={taper(0.56, 0.42, REX_LEG.shin)} material={m.skin} castShadow />
                {/* Foot: kept level, toes dip while it swings forward. */}
                <group position={[0, REX_LEG.shin, 0]} rotation={[-(a1 + knee) + lift * 0.3, 0, 0]}>
                  <mesh geometry={box("rex-foot", 0.98, 0.46, 1.42, 0.22)} material={m.skin} position={[0, -0.235, 0.32]} castShadow />
                  {[-1, 0, 1].map((t) => (
                    <group key={t} position={[t * 0.31, -0.26, 0.98 + (t === 0 ? 0.06 : 0)]}>
                      <Ell m={m.skin} r={[0.22, 0.2, 0.23]} />
                      <mesh geometry={horn(0.1, 0.03, 0.2, 0.9)} material={m.claw} position={[0, -0.03, 0.16]} rotation={[PI / 2, 0, 0]} />
                    </group>
                  ))}
                </group>
              </group>
            </group>
          </group>
        ))}
        <group position={REX_HIP} rotation={[torsoPitch, 0, roll]}>
          <group position={[-REX_HIP[0], -REX_HIP[1], -REX_HIP[2]]}>
            {/* Pear-shaped body with the orange belly bulging out of its front. */}
            <group position={REX_BODY.p} rotation={[REX_BODY.tilt, 0, 0]}>
              <mesh geometry={taper(REX_BODY.r0, REX_BODY.r1, REX_BODY.len)} material={m.skin} castShadow />
              <mesh geometry={taper(1.26, 0.86, REX_BODY.len)} material={m.belly} position={[0, 0.08, 0.3]} />
              {[0.3, 0.95, 1.6].map((y, i) => (
                <mesh
                  key={i}
                  geometry={spike}
                  material={m.dark}
                  position={[0, y, -(REX_BODY.r0 + (REX_BODY.r1 - REX_BODY.r0) * (y / REX_BODY.len)) + 0.08]}
                  rotation={[-PI / 2 - 0.25, PI, 0]}
                  scale={1.05 - i * 0.06}
                />
              ))}
            </group>
            {/* Tiny arms. */}
            {[1, -1].map((sgn) => (
              <group key={sgn} position={[sgn * REX_SHOULDER.x, REX_SHOULDER.y, REX_SHOULDER.z]} rotation={[armUp, 0, -sgn * 0.3]}>
                <mesh geometry={taper(0.2, 0.16, 0.38)} material={m.skin} castShadow />
                <group position={[0, 0.38, 0]} rotation={[fore, 0, 0]}>
                  <mesh geometry={taper(0.16, 0.13, 0.32)} material={m.skin} castShadow />
                  {[-1, 1].map((f) => (
                    <mesh
                      key={f}
                      geometry={horn(0.07, 0.022, 0.15, 0.7)}
                      material={m.claw}
                      position={[f * 0.06, 0.34, 0]}
                      rotation={[0.25, 0, -f * 0.35]}
                    />
                  ))}
                </group>
              </group>
            ))}
            {/* Neck and head. */}
            <group position={REX_NECK_BASE}>
              <Chain
                mat={m.skin}
                segs={[
                  { ...REX_NECK[0], rot: [neckRoot, 0, 0], stretch },
                  { ...REX_NECK[1], rot: [neck2, 0, 0], stretch },
                ]}
                deco={(i, s) => (
                  <>
                    <mesh geometry={taper(s.r0 * 0.84, s.r1 * 0.84, s.len)} material={m.belly} position={[0, 0, s.r0 * 0.22]} scale={[1, stretch, 1]} />
                    <mesh geometry={spike} material={m.dark} position={[0, s.len * 0.55 * stretch, -s.r0 * 0.9]} rotation={[-PI / 2 - 0.3, PI, 0]} scale={0.85 - i * 0.08} />
                  </>
                )}
                tip={
                  <group rotation={[headLevel, 0, 0]}>
                    <group rotation={[0, headYaw, 0]}>
                      <group rotation={[pitch, 0, 0]}>
                        <RexHeadModel jaw={jaw} blink={blink} roar={R} snort={snort}>
                          {children}
                        </RexHeadModel>
                      </group>
                    </group>
                  </group>
                }
              />
            </group>
            {/* Thick tail with spikes along the top. */}
            <group position={[0, 2.55, -1.05]}>
              <Chain
                mat={m.skin}
                segs={tailSegs}
                deco={(i, s) => (
                  <mesh
                    geometry={spike}
                    material={m.dark}
                    position={[0, s.len * 0.5, (s.r0 + s.r1) * 0.5 - 0.06]}
                    rotation={[PI / 2 - 0.25, PI, 0]}
                    scale={1 - i * 0.18}
                  />
                )}
              />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * The T-Rex head alone (same model and scale as <TRex size>), origin at the neck joint, facing
 * +z, with a short neck stub hanging down-back (`neck` false hides it). Made for the
 * FIRST-PERSON shot: put the camera at TREX_HEAD_FP (head space) so the snout fills the bottom
 * of the frame. `snort` 0..1 runs one snort: two puffs of breath fog from the nostrils.
 * `children` sit in its jaws (TREX_BITE).
 */
export const TRexHead: React.FC<{
  size?: number;
  jaw?: number;
  blink?: number;
  snort?: number;
  /** Turn (radians, > 0 towards +x) and nod (radians, > 0 snout down), applied yaw first. */
  yaw?: number;
  pitch?: number;
  /**
   * Alternative to yaw / pitch: [pitch, yaw, roll] applied in "YXZ" order (turn first, then
   * nod about the head's own x axis, then roll), added to them. E.g. [0.6, Math.PI, 0] faces
   * -z and looks down.
   */
  rotation?: V3;
  neck?: boolean;
  position?: V3;
  children?: React.ReactNode;
}> = ({ size = 1, jaw = 0, blink = 0, snort = 0, yaw = 0, pitch = 0, rotation = [0, 0, 0], neck = true, position = [0, 0, 0], children }) => {
  const m = rexMats();
  return (
    <group position={position} rotation={[0, rotation[1] + yaw, 0]}>
      <group rotation={[rotation[0] + pitch, 0, rotation[2]]} scale={size}>
        {neck ? (
          <group rotation={[PI + REX_NECK_TILT, 0, 0]}>
            <mesh geometry={taper(0.78, 0.92, 1.5)} material={m.skin} />
            <mesh geometry={taper(0.66, 0.78, 1.5)} material={m.belly} position={[0, 0, -0.2]} />
          </group>
        ) : null}
        <RexHeadModel jaw={jaw} blink={blink} roar={0} snort={snort}>
          {children}
        </RexHeadModel>
      </group>
    </group>
  );
};

// =======================================================================================
// RAPTOR

export type RaptorPose = {
  /** Run cycle amplitude 0..1 and phase (radians). */
  run?: number;
  runPhase?: number;
  /** Mouth: 0 = closed (two little fangs peek out), 1 = wide open. */
  jaw?: number;
  /** Head turn (radians): > 0 towards +x. */
  headYaw?: number;
  /** Head nod (radians): > 0 snout down. */
  headPitch?: number;
  /** Tail swish -1..1: > 0 swings the fan towards +x. */
  tail?: number;
  /** 0 = open, 1 = closed (the sly lids come down). */
  blink?: number;
  /** 0..1 crouches, ready to pounce: hips drop, tail up, wings out. */
  crouch?: number;
  /** 0..1 lunges the head forward (neck stretched, body tipped forward, wings flared). */
  snatch?: number;
};

const RAP = {
  feather: "#C8702C",
  dark: "#7B3D19",
  mid: "#A0521F",
  cream: "#FFE1AE",
  ruff: "#FF8F2E",
  gold: "#FFC23A",
  skin: "#FFB93A",
  claw: "#3E2F2A",
  mouth: "#D8386A",
  throat: "#8E1C45",
  tongue: "#FF7EA8",
  tip: "#1FC7C9",
  crest: ["#FF3D6E", "#FF9A1F", "#FFD12E", "#1FC7C9", "#3C6BFF"],
};

const rapMats = () => ({
  feather: toy(RAP.feather, { rough: 0.7, glow: 0.14 }),
  dark: toy(RAP.dark, { rough: 0.7, glow: 0.12 }),
  mid: toy(RAP.mid, { rough: 0.7, glow: 0.13 }),
  cream: toy(RAP.cream, { rough: 0.7, glow: 0.16 }),
  ruff: toy(RAP.ruff, { rough: 0.7, glow: 0.16 }),
  gold: toy(RAP.gold, { rough: 0.7, glow: 0.16 }),
  skin: toy(RAP.skin, { rough: 0.45, glow: 0.14 }),
  claw: toy(RAP.claw, { rough: 0.35, glow: 0.05 }),
  mouth: toy(RAP.mouth, { rough: 0.5, glow: 0.14 }),
  throat: toy(RAP.throat, { rough: 0.6, glow: 0.1 }),
  tongue: toy(RAP.tongue, { rough: 0.4, glow: 0.16 }),
  tooth: toy("#FFFFFF", { rough: 0.3, glow: 0.22 }),
  tip: toy(RAP.tip, { rough: 0.6, glow: 0.2 }),
  crest: RAP.crest.map((c) => toy(c, { rough: 0.6, glow: 0.2 })),
  nostril: toy("#4A2410", { rough: 0.5, glow: 0 }),
});

/** Euler that turns the local +y into `y` and the local +z into (the part of) `z` normal to it. */
const basisEuler = (y: THREE.Vector3, z: THREE.Vector3): V3 => {
  const Y = y.clone().normalize();
  const Z = z.clone().sub(Y.clone().multiplyScalar(z.dot(Y))).normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  const e = new THREE.Euler().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  return [e.x, e.y, e.z];
};

const RAP_LEG = { x: 0.26, z: 0.02, lens: [0.38, 0.42, 0.3], a1: PI - 0.55, knee: 1.1, ankle: -0.85, toeR: 0.045 };
const RAP_HIP_REST = RAP_LEG.toeR - fk(RAP_LEG.lens, [RAP_LEG.a1, RAP_LEG.a1 + RAP_LEG.knee, RAP_LEG.a1 + RAP_LEG.knee + RAP_LEG.ankle]).y;
const RAP_NECK_BASE: V3 = [0, 1.26, 0.52];
const RAP_NECK = [
  { r0: 0.2, r1: 0.17, len: 0.27 },
  { r0: 0.17, r1: 0.15, len: 0.22 },
];
const RAP_NECK_ROT = [0.3, -0.35];
const RAP_BODY = { p: [0, 1.12, 0.12] as V3, r: [0.44, 0.44, 0.7] as V3, tilt: -0.15 };

/** Raptor snout and lower jaw (head space: origin at the neck tip, +z along the snout). */
const RAP_SNOUT = { w: 0.25, h: 0.17, d: 0.6, r: 0.075, k: 0.42, p: [0, -0.005, 0.4] as V3 };
const RAP_JAW = { hinge: [0, -0.07, 0.14] as V3, w: 0.2, h: 0.08, d: 0.54, r: 0.035, k: 0.45, p: [0, -0.03, 0.28] as V3 };
const rapSnoutHalf = (z: number) =>
  (RAP_SNOUT.w / 2) * (1 - RAP_SNOUT.k * clamp01((z - RAP_SNOUT.p[2]) / RAP_SNOUT.d + 0.5));
const rapJawHalf = (z: number) => (RAP_JAW.w / 2) * (1 - RAP_JAW.k * clamp01((z - RAP_JAW.p[2]) / RAP_JAW.d + 0.5));

/**
 * Raptor mouth attachment. <Raptor> already renders its `children` AT the bite point: their
 * origin is `position` (head space: between the front teeth), +z runs along the snout, +y up,
 * raptor units (world units at size 1, scaled with `size`), and they follow snatch / yaw /
 * pitch. So do not add `position` again inside the children. A flat box held by its near edge:
 * <Raptor pose={{ jaw: 0.25 }}><group position={[0, 0, depth / 2 - 0.05]}><Box /></group></Raptor>
 * (thickness up to ≈ 0.12; jaw ≈ 0.25 so the teeth grip it). `rest` is the bite point in Raptor
 * space in the rest pose (at size 1), for placing a box that is about to be snatched.
 */
export const RAPTOR_MOUTH: { position: V3; rest: V3 } = { position: [0, -0.085, 0.62], rest: [0, 0, 0] };

// Rest pose: body pitched by 0.06 about the hip, head level: bite point in Raptor space.
RAPTOR_MOUTH.rest = (() => {
  const [a, b] = RAP_NECK_ROT;
  const ny = RAP_NECK_BASE[1] + RAP_NECK[0].len * Math.cos(a) + RAP_NECK[1].len * Math.cos(a + b);
  const nz = RAP_NECK_BASE[2] + RAP_NECK[0].len * Math.sin(a) + RAP_NECK[1].len * Math.sin(a + b);
  const bp = 0.06;
  const hy = ny - RAP_HIP_REST;
  return [
    0,
    RAP_HIP_REST + hy * Math.cos(bp) - nz * Math.sin(bp) + RAPTOR_MOUTH.position[1],
    hy * Math.sin(bp) + nz * Math.cos(bp) + RAPTOR_MOUTH.position[2],
  ];
})();

const RAP_TOP_TEETH: { p: V3; len: number }[] = [
  ...[0.3, 0.44].flatMap((z) => [-1, 1].map((s) => ({ p: [s * (rapSnoutHalf(z) - 0.03), -0.075, z] as V3, len: 0.03 }))),
  // Two little fangs that peek over the lip even with the mouth shut.
  ...[-1, 1].map((s) => ({ p: [s * 0.074, -0.075, 0.54] as V3, len: 0.036 })),
];
const RAP_LOW_TEETH: V3[] = [0.2, 0.32].flatMap((z) => [-1, 1].map((s): V3 => [s * (rapJawHalf(z) - 0.028), 0.0, z]));

/** Feathers of the back cape: shingled rows lying on the body, tips lifted, pointing back. */
const RAP_CAPE: { p: V3; rot: V3; len: number; w: number; row: number }[] = (() => {
  const [rx, ry, rz] = RAP_BODY.r;
  const rows: [number, number[]][] = [
    [0.36, [-0.95, -0.32, 0.32, 0.95]],
    [0.1, [-1.15, -0.58, 0, 0.58, 1.15]],
    [-0.17, [-0.95, -0.32, 0.32, 0.95]],
    [-0.42, [-0.55, 0, 0.55]],
  ];
  return rows.flatMap(([zc, thetas], row) =>
    thetas.map((th) => {
      const s = Math.sqrt(1 - (zc / rz) ** 2);
      const p = new THREE.Vector3(rx * s * Math.sin(th), ry * s * Math.cos(th), zc);
      const n = new THREE.Vector3(p.x / (rx * rx), p.y / (ry * ry), p.z / (rz * rz)).normalize();
      const back = new THREE.Vector3(0, 0, -1);
      back.sub(n.clone().multiplyScalar(back.dot(n))).normalize();
      const dir = back.clone().add(n.clone().multiplyScalar(0.1));
      p.addScaledVector(n, -0.03);
      return { p: [p.x, p.y, p.z] as V3, rot: basisEuler(dir, n), len: 0.42 - row * 0.03, w: 0.22 - row * 0.02, row };
    }),
  );
})();

/** Neck ruff: a collar of pointed feathers round the back and sides of the neck base. */
const RAP_RUFF: { p: V3; rot: V3; k: number }[] = Array.from({ length: 11 }, (_, k) => {
  const psi = -2.0 + (k / 10) * 4.0;
  const out = new THREE.Vector3(Math.sin(psi), 0, -Math.cos(psi));
  const dir = out.clone().multiplyScalar(0.8).add(new THREE.Vector3(0, -0.55, -0.3));
  const p = out.clone().multiplyScalar(0.17).add(new THREE.Vector3(0, 0.17, 0.05));
  return { p: [p.x, p.y, p.z] as V3, rot: basisEuler(dir, out), k };
});

/**
 * A feather: flat paddle with a rounded tip, base at the origin, along +y, bent by `bend`
 * towards +z; `flat` is its thin axis. `tipM` paints the last fifth in another colour.
 */
const Feather: React.FC<{
  len: number;
  w: number;
  m: THREE.Material;
  tipM?: THREE.Material;
  bend?: number;
  flat?: "x" | "z";
  thin?: number;
  /** Leaf shape: widest at the base, pointed tip (for shingled mantles). */
  pointed?: boolean;
}> = ({ len, w, m, tipM, bend = 0, flat = "x", thin = 0.36, pointed = false }) => {
  const L = len - w * 0.5;
  if (pointed) {
    return (
      <group scale={flat === "x" ? [thin, 1, 1] : [1, 1, thin]}>
        <mesh geometry={horn(w * 0.5, w * 0.2, L, bend)} material={m} castShadow />
      </group>
    );
  }
  const sc: V3 = flat === "x" ? [thin, 1, 1] : [1, 1, thin];
  const s0 = L * 0.78;
  const th = bend ? (s0 / L) * bend : 0;
  const R = bend ? L / bend : 0;
  const cap: V3 = bend ? [0, R * Math.sin(th), R * (1 - Math.cos(th))] : [0, s0, 0];
  return (
    <group scale={sc}>
      <mesh geometry={horn(w * 0.22, w * 0.5, L, bend)} material={m} castShadow />
      {tipM ? <mesh geometry={horn(w * 0.45, w * 0.54, L * 0.22, bend * 0.22)} material={tipM} position={cap} rotation={[th, 0, 0]} /> : null}
    </group>
  );
};

/**
 * Velociraptor as the real animal: turkey-sized and feathered. A fluffy caramel body under a
 * cape of dark shingled feathers, cream chest and throat, an orange collar ruff, a rainbow
 * crest, feathered arms folded like little wings (teal-tipped), a stiff banded tail ending in a
 * fan of teal-tipped feathers, yellow scaly legs with the raised sickle claw, and sly half-lidded
 * eyes over a grin with two little fangs. At size 1 the top of its head is ≈ 2.0 (Nubi's height
 * at size 2: turkey-sized next to him), the crest tip ≈ 2.3; ≈ 3.7 long from snout to tail fan.
 * `children` render in its jaws: see RAPTOR_MOUTH.
 */
export const Raptor: React.FC<{
  size?: number;
  pose?: RaptorPose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: V3;
  rotationY?: number;
  children?: React.ReactNode;
}> = ({ size = 1, pose = {}, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0, children }) => {
  const { run = 0, runPhase = 0, jaw = 0, headYaw = 0, headPitch = 0, tail = 0, blink = 0, crouch = 0, snatch = 0 } = pose;
  const m = rapMats();
  const r = clamp01(run);
  const c = clamp01(crouch);
  const sn = clamp01(snatch);

  const legs = [1, -1].map((sgn, i) => {
    const ph = runPhase + i * PI;
    const swing = r * 0.8 * Math.sin(ph);
    const lift = r * Math.max(0, Math.cos(ph));
    const a1 = RAP_LEG.a1 - swing - lift * 0.35 - c * 0.45;
    const a2 = a1 + RAP_LEG.knee + lift * 0.9 + c * 0.9;
    const a3 = a2 + RAP_LEG.ankle - lift * 0.55 - c * 0.45;
    const ball = fk(RAP_LEG.lens, [a1, a2, a3]);
    return { sgn, a1, a2, a3, lift, ball };
  });
  const hipY = RAP_LEG.toeR - Math.min(...legs.map((l) => l.ball.y)) + r * 0.05 * Math.max(0, Math.sin(runPhase * 2));

  const bp = 0.06 + r * 0.2 + c * 0.16 + sn * 0.3;
  const nRoot = RAP_NECK_ROT[0] + sn * 0.95 + c * 0.35 - r * 0.1;
  const n2 = RAP_NECK_ROT[1] + sn * 0.25;
  const stretch = 1 + 0.6 * sn;
  const headLevel = -(bp + nRoot + n2);
  const pitch = headPitch + c * 0.12 - sn * 0.12 + r * 0.05 * Math.sin(runPhase * 2);
  const sway = clamp(tail, -1, 1) * 0.6 + r * 0.25 * Math.sin(runPhase);
  const tailUp = 0.12 + c * 0.3 + sn * 0.12 - bp * 0.5;
  const flap = r * 0.35 * (0.5 + 0.5 * Math.sin(runPhase * 2)) + c * 0.35 + sn * 0.75;
  const jawAngle = 0.75 * clamp01(jaw);

  const tailSegs: Seg[] = [
    { r0: 0.27, r1: 0.2, len: 0.5, rot: [-(PI / 2 - tailUp), 0, -sway * 0.25] },
    { r0: 0.2, r1: 0.13, len: 0.48, rot: [0.05, 0, -sway * 0.3] },
    { r0: 0.13, r1: 0.07, len: 0.42, rot: [0.08, 0, -sway * 0.35] },
  ];
  const band = cachedGeo("rap-band", () => new THREE.TorusGeometry(1, 0.13, 10, 28));

  const head = (
    <group>
      {/* Feathered head: caramel crown, cream cheeks and chin, long low snout. */}
      <Ell m={m.feather} geo={fluff(0.03, 2.4, 3)} p={[0, 0.08, 0.04]} r={[0.24, 0.22, 0.27]} />
      <Ell m={m.cream} geo={fluff(0.03, 2.6, 9)} p={[0, -0.02, 0.1]} r={[0.2, 0.13, 0.22]} />
      <mesh
        geometry={box("rap-snout", RAP_SNOUT.w, RAP_SNOUT.h, RAP_SNOUT.d, RAP_SNOUT.r, taperZ(RAP_SNOUT.k, 0.025))}
        material={m.feather}
        position={RAP_SNOUT.p}
        castShadow
      />
      <Ell m={m.mouth} p={[0, -0.08, 0.38]} r={[0.075, 0.014, 0.24]} />
      <Ell m={m.throat} p={[0, -0.06, 0.2]} r={[0.09, 0.05, 0.07]} />
      {RAP_TOP_TEETH.map((t, i) => (
        <mesh key={`t${i}`} geometry={horn(0.02, 0.009, t.len, 0)} material={m.tooth} position={t.p} rotation={[PI, 0, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <Ell key={`n${s}`} m={m.nostril} p={[s * 0.034, 0.052, 0.64]} r={[0.01, 0.007, 0.018]} rot={[0.4, s * 0.3, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <Eye
          key={`e${s}`}
          r={0.12}
          position={[s * 0.15, 0.14, 0.2]}
          rotation={[0, s * 0.45, 0]}
          blink={blink}
          depth={0.6}
          lid={{ mat: m.feather, cover: 0.3, tilt: s * 0.1 }}
        />
      ))}
      {/* Rainbow crest swept back over the head. */}
      {m.crest.map((mat, i) => (
        <group key={`c${i}`} position={[0, 0.25 - i * 0.012, 0.1 - i * 0.055]} rotation={[-0.3 - i * 0.26, 0, (i % 2 ? 1 : -1) * 0.12]}>
          <Feather len={0.38 - Math.abs(i - 1.5) * 0.035} w={0.1} m={mat} bend={-0.55} thin={0.45} />
        </group>
      ))}
      <group position={RAP_JAW.hinge} rotation={[jawAngle, 0, 0]}>
        <mesh
          geometry={box("rap-jaw", RAP_JAW.w, RAP_JAW.h, RAP_JAW.d, RAP_JAW.r, taperZ(RAP_JAW.k))}
          material={m.cream}
          position={RAP_JAW.p}
          castShadow
        />
        <Ell m={m.mouth} p={[0, 0.012, 0.27]} r={[0.065, 0.012, 0.21]} />
        <Ell m={m.tongue} p={[0, 0.022, 0.24]} r={[0.05, 0.022, 0.16]} />
        {RAP_LOW_TEETH.map((p, i) => (
          <mesh key={`l${i}`} geometry={horn(0.018, 0.008, 0.028, 0)} material={m.tooth} position={p} />
        ))}
      </group>
      {children ? <group position={RAPTOR_MOUTH.position}>{children}</group> : null}
    </group>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={size}>
      {shadow ? (
        <group position={[0, 0, -0.3]}>
          <BlobShadow radius={0.9} stretch={1.9} opacity={shadowOpacity} />
        </group>
      ) : null}
      {/* Legs: fluffy drumsticks, yellow scaly shins, two toes down and the sickle claw raised. */}
      {legs.map(({ sgn, a1, a2, a3, lift }) => (
        <group key={sgn} position={[sgn * RAP_LEG.x, hipY, RAP_LEG.z]}>
          <group rotation={[a1, 0, 0]}>
            <mesh geometry={taper(0.1, 0.08, RAP_LEG.lens[0])} material={m.skin} />
            <Ell m={m.feather} geo={fluff(0.06, 2.4, 5 + sgn)} p={[sgn * 0.02, 0.17, 0]} r={[0.19, 0.27, 0.23]} />
            <group position={[0, 0.3, -0.12]} rotation={[0.9, 0, 0]}>
              <Feather len={0.22} w={0.11} m={m.dark} flat="x" />
            </group>
            <group position={[0, RAP_LEG.lens[0], 0]} rotation={[a2 - a1, 0, 0]}>
              <mesh geometry={taper(0.08, 0.06, RAP_LEG.lens[1])} material={m.skin} castShadow />
              <group position={[0, RAP_LEG.lens[1], 0]} rotation={[a3 - a2, 0, 0]}>
                <mesh geometry={taper(0.06, 0.05, RAP_LEG.lens[2])} material={m.skin} castShadow />
                {/* Toe frame: +y forward along the ground, +z down. */}
                <group position={[0, RAP_LEG.lens[2], 0]} rotation={[PI / 2 + lift * 0.9 - a3, 0, 0]}>
                  {[-1, 1].map((t) => (
                    <group key={t} rotation={[0, 0, -t * 0.2 - sgn * 0.08]}>
                      <mesh geometry={taper(0.045, 0.034, 0.17)} material={m.skin} />
                      <mesh geometry={horn(0.032, 0.008, 0.07, 1.2)} material={m.claw} position={[0, 0.2, 0]} />
                    </group>
                  ))}
                  <group position={[-sgn * 0.055, 0.0, -0.02]}>
                    <Ell m={m.skin} r={[0.045, 0.05, 0.05]} />
                    <mesh geometry={horn(0.038, 0.009, 0.2, 2.1)} material={m.claw} position={[0, 0.0, -0.03]} rotation={[-PI / 2 + 0.25, 0, 0]} />
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      ))}
      <group position={[0, hipY, 0]} rotation={[bp, 0, 0]}>
        <group position={[0, -RAP_HIP_REST, 0]}>
          {/* Body: caramel fluff, cream chest, a cape of dark feathers over the back. */}
          <group position={RAP_BODY.p} rotation={[RAP_BODY.tilt, 0, 0]}>
            <Ell m={m.feather} geo={fluff(0.045, 2.2, 1)} r={RAP_BODY.r} />
            {RAP_CAPE.map((f, i) => (
              <group key={i} position={f.p} rotation={f.rot}>
                <Feather len={f.len} w={f.w} m={f.row % 2 ? m.mid : m.dark} flat="z" thin={0.3} bend={-0.15} pointed />
              </group>
            ))}
          </group>
          <Ell m={m.cream} geo={fluff(0.05, 2.4, 4)} p={[0, 1.0, 0.36]} r={[0.35, 0.34, 0.5]} rot={[-0.35, 0, 0]} />
          {/* Wings: folded feather fans on the flanks, little clawed hands out front. */}
          {[1, -1].map((sgn) => (
            <group key={sgn} position={[sgn * 0.38, 1.22, 0.42]} rotation={[-flap * 0.35, 0, -sgn * (0.12 + flap * 0.9)]}>
              <Ell m={m.feather} geo={fluff(0.05, 2.6, 7)} p={[sgn * 0.05, -0.05, -0.04]} r={[0.09, 0.15, 0.22]} rot={[0.35, 0, 0]} />
              {[0, 1, 2, 3].map((k) => (
                <group key={k} position={[sgn * (0.1 + k * 0.015), -0.08 - k * 0.012, 0.08 - k * 0.055]} rotation={[-(PI / 2 + 0.04 + k * 0.09), 0, -sgn * (0.14 + k * 0.04)]}>
                  <Feather len={0.46 + k * 0.05} w={0.15} m={k % 2 ? m.dark : m.feather} tipM={k % 2 ? m.tip : m.gold} flat="x" bend={-0.2} thin={0.3} />
                </group>
              ))}
              <group rotation={[PI - 1.0, 0, -sgn * 0.15]}>
                <mesh geometry={taper(0.055, 0.045, 0.2)} material={m.feather} />
                {[-1, 0, 1].map((f) => (
                  <mesh key={f} geometry={horn(0.022, 0.008, 0.07, 0.9)} material={m.claw} position={[f * 0.03, 0.24, 0]} rotation={[0.3, 0, -f * 0.3]} />
                ))}
              </group>
            </group>
          ))}
          {/* Neck (cream throat) with the orange collar ruff, then the head. */}
          <group position={RAP_NECK_BASE}>
            {RAP_RUFF.map((f) => (
              <group key={f.k} position={f.p} rotation={f.rot}>
                <Feather len={0.23} w={0.12} m={f.k % 2 ? m.ruff : m.gold} flat="z" thin={0.5} bend={0.35} />
              </group>
            ))}
            <Chain
              mat={m.feather}
              segs={[
                { ...RAP_NECK[0], rot: [nRoot, 0, 0], stretch },
                { ...RAP_NECK[1], rot: [n2, 0, 0], stretch },
              ]}
              deco={(_i, s) => <mesh geometry={taper(s.r0 * 0.78, s.r1 * 0.78, s.len)} material={m.cream} position={[0, 0, s.r0 * 0.3]} scale={[1, stretch, 1]} />}
              tip={
                <group rotation={[headLevel, 0, 0]}>
                  <group rotation={[0, headYaw, 0]}>
                    <group rotation={[pitch, 0, 0]}>{head}</group>
                  </group>
                </group>
              }
            />
          </group>
          {/* Stiff feathered tail ending in a fan. */}
          <group position={[0, 1.18, -0.48]}>
            <Chain
              mat={m.feather}
              segs={tailSegs}
              deco={(i, s) => (
                <>
                  {i < 2 ? (
                    <mesh geometry={band} material={m.dark} position={[0, s.len * 0.62, 0]} rotation={[PI / 2, 0, 0]} scale={[(s.r0 + s.r1) * 0.47, (s.r0 + s.r1) * 0.47, 0.7]} />
                  ) : null}
                  {i >= 1
                    ? [-1, 1].map((side) =>
                        [0, 1].map((k) => (
                          <group key={`${side}${k}`} position={[side * s.r1 * 0.6, s.len * (0.35 + k * 0.45), 0]} rotation={[0, 0, side * (1.15 - k * 0.2 - (i - 1) * 0.25)]}>
                            <Feather len={0.28 + (i - 1) * 0.08 + k * 0.04} w={0.12} m={(k + i) % 2 ? m.dark : m.feather} flat="z" />
                          </group>
                        )),
                      )
                    : null}
                </>
              )}
              tip={
                <group>
                  {[-2, -1, 0, 1, 2].map((k) => (
                    <group key={k} rotation={[0, 0, k * 0.36]}>
                      <Feather len={0.5 - Math.abs(k) * 0.05} w={0.14} m={Math.abs(k) === 1 ? m.dark : m.feather} tipM={m.tip} flat="z" />
                    </group>
                  ))}
                </group>
              }
            />
          </group>
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// BRACHIOSAURUS

export type BrachioPose = {
  /** Walk cycle amplitude 0..1 and phase (radians): slow, heavy steps. */
  walk?: number;
  walkPhase?: number;
  /** Neck bend -1..1: > 0 swings the head forward and down (to peek at street level), < 0 back. */
  neck?: number;
  /** Head turn (radians): > 0 towards +x. */
  headYaw?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
};

const BRA = {
  skin: "#8F93F2",
  dark: "#6B67D6",
  belly: "#D8DAFF",
  nail: "#FFF3DE",
  blush: "#FF9EC8",
  mouth: "#3E3585",
};

const BRA_NECK_BASE: V3 = [0, 7.9, 2.7];
const BRA_NECK: Seg[] = [
  { r0: 1.6, r1: 1.28, len: 1.6 },
  { r0: 1.28, r1: 1.02, len: 1.5 },
  { r0: 1.02, r1: 0.84, len: 1.4 },
  { r0: 0.84, r1: 0.72, len: 1.25 },
  { r0: 0.72, r1: 0.66, len: 1.15 },
];
/** Rest bends: leans forward out of the shoulders, then curves back up like a swan. */
const BRA_NECK_REST = [0.55, -0.12, -0.14, -0.14, -0.12];
const BRA_LEGS = [
  // x, top y, z, upper, lower, radii (top, knee, ankle), gait phase
  { x: 1.5, y: 6.2, z: 2.3, l1: 2.85, l2: 2.5, r: [1.2, 1.0, 0.92], ph: 0 },
  { x: -1.5, y: 6.2, z: 2.3, l1: 2.85, l2: 2.5, r: [1.2, 1.0, 0.92], ph: PI },
  { x: 1.55, y: 5.5, z: -2.5, l1: 2.4, l2: 2.25, r: [1.45, 1.05, 0.95], ph: PI },
  { x: -1.55, y: 5.5, z: -2.5, l1: 2.4, l2: 2.25, r: [1.45, 1.05, 0.95], ph: 0 },
];
const BRA_SPOTS: V3[] = [
  [0.3, 0.9, 0.3],
  [-0.42, 0.82, 0.38],
  [0.55, 0.75, -0.3],
  [-0.2, 0.93, -0.3],
  [0.12, 0.8, -0.62],
  [-0.6, 0.66, -0.1],
  [0.68, 0.6, 0.35],
  [-0.5, 0.6, -0.55],
];

/**
 * Gentle giant brachiosaurus: periwinkle blue with lilac spots and a pale belly, a long
 * swan-curved neck, a big cute head with the nasal dome, big eyes, pink cheeks and a smile,
 * pillar legs with cream toenails. At size 1 the top of its head is ≈ 15.8 (8x Nubi at size 2),
 * its back ≈ 9, it is ≈ 19 long (the head ≈ 4.8 in front of its origin, the tail tip ≈ 12.3
 * behind) and ≈ 5 wide: for city streets and prehistoric backdrops.
 */
export const Brachio: React.FC<{
  size?: number;
  pose?: BrachioPose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: V3;
  rotationY?: number;
}> = ({ size = 1, pose = {}, shadow = true, shadowOpacity = 0.3, position = [0, 0, 0], rotationY = 0 }) => {
  const { walk = 0, walkPhase = 0, neck = 0, headYaw = 0, blink = 0 } = pose;
  const w = clamp01(walk);
  const nb = clamp(neck, -1, 1);
  const skin = toy(BRA.skin, { rough: 0.5, glow: 0.14 });
  const dark = toy(BRA.dark, { rough: 0.5, glow: 0.12 });
  const belly = toy(BRA.belly, { rough: 0.5, glow: 0.14 });
  const nail = toy(BRA.nail, { rough: 0.4, glow: 0.16 });

  const legs = BRA_LEGS.map((L) => {
    const ph = walkPhase + L.ph;
    const swing = w * 0.2 * Math.sin(ph);
    const lift = w * Math.max(0, Math.cos(ph));
    const a1 = PI - swing;
    const knee = lift * 0.35;
    const ank = fk([L.l1, L.l2], [a1, a1 + knee]);
    // The ankle ball sits 0.85 above the ground at rest.
    return { L, a1, knee, lift, need: 0.85 - L.y - ank.y };
  });
  const rootY = Math.max(...legs.map((l) => l.need));

  const segs: Seg[] = BRA_NECK.map((s, i) => ({
    ...s,
    rot: [BRA_NECK_REST[i] + nb * 0.3, 0, w * 0.02 * Math.sin(walkPhase + i * 0.6)],
  }));
  const total = segs.reduce((a, s) => a + (s.rot ? s.rot[0] : 0), 0);
  const headLevel = -total + nb * 0.35;
  const smile = cachedGeo("bra-smile", () => new THREE.TorusGeometry(0.3, 0.045, 8, 24, 1.7));

  const head = (
    <group rotation={[0, headYaw, 0]}>
      <mesh geometry={box("bra-head", 1.55, 1.25, 1.6, 0.58)} material={skin} position={[0, 0.5, 0.45]} castShadow />
      <mesh geometry={box("bra-snout", 1.34, 0.84, 1.1, 0.4, taperZ(0.1))} material={skin} position={[0, 0.24, 1.4]} castShadow />
      {/* Nasal dome between and in front of the eyes, nostrils on top. */}
      <Ell m={skin} p={[0, 1.0, 0.88]} r={[0.52, 0.46, 0.62]} rot={[0.25, 0, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Eye r={0.27} position={[s * 0.63, 0.72, 0.56]} rotation={[0, s * 0.66, 0]} blink={blink} depth={0.5} />
          <Ell m={toy(BRA.blush, { rough: 0.6, glow: 0.25 })} p={[s * 0.62, 0.24, 1.36]} r={[0.07, 0.13, 0.22]} rot={[0, s * 0.3, 0]} />
          <Ell m={toy(BRA.mouth, { rough: 0.5, glow: 0 })} p={[s * 0.16, 1.3, 1.22]} r={[0.07, 0.035, 0.09]} rot={[-0.5, 0, 0]} />
        </group>
      ))}
      <mesh geometry={smile} material={toy(BRA.mouth, { rough: 0.5, glow: 0 })} position={[0, 0.27, 1.9]} rotation={[-0.45, 0, -PI / 2 - 0.85]} />
    </group>
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={size}>
      {shadow ? (
        <group position={[0, 0, -0.5]}>
          <BlobShadow radius={4.4} stretch={2.0} opacity={shadowOpacity} />
        </group>
      ) : null}
      <group position={[0, rootY, 0]}>
        {legs.map(({ L, a1, knee, lift }, i) => (
          <group key={i} position={[L.x, L.y, L.z]}>
            <group rotation={[a1, 0, 0]}>
              <mesh geometry={taper(L.r[0], L.r[1], L.l1)} material={skin} castShadow />
              <group position={[0, L.l1, 0]} rotation={[knee, 0, 0]}>
                <mesh geometry={taper(L.r[1], L.r[2], L.l2)} material={skin} castShadow />
                <group position={[0, L.l2, 0]} rotation={[-(a1 + knee) + lift * 0.15, 0, 0]}>
                  <mesh
                    geometry={cachedGeo("bra-pad", () => new THREE.CylinderGeometry(1, 1.06, 1, 32))}
                    material={skin}
                    position={[0, -0.55, 0.05]}
                    scale={[L.r[2] * 1.18, 0.6, L.r[2] * 1.22]}
                  />
                  {[-1, 0, 1].map((t) => (
                    <Ell key={t} m={nail} p={[t * 0.5, -0.66, L.r[2] * 1.14]} r={[0.22, 0.19, 0.15]} rot={[0, t * 0.5, 0]} />
                  ))}
                </group>
              </group>
            </group>
          </group>
        ))}
        {/* Barrel body, shoulders high; pale belly; lilac spots on the back. */}
        <group position={[0, 6.75, 0]} rotation={[-0.1, 0, 0]}>
          <Ell m={skin} r={[2.55, 2.45, 4.1]} />
          <Ell m={belly} p={[0, -0.5, 0.2]} r={[2.25, 2.05, 3.7]} />
          <group scale={[2.55, 2.45, 4.1]}>
            {BRA_SPOTS.map((d, i) => {
              const v = new THREE.Vector3(...d).normalize();
              return (
                <mesh
                  key={i}
                  geometry={sphere()}
                  material={dark}
                  position={[v.x, v.y, v.z]}
                  rotation={eulerY(v.x, v.y, v.z)}
                  scale={[0.1 + (i % 3) * 0.02, 0.03, 0.08 + (i % 2) * 0.03]}
                />
              );
            })}
          </group>
        </group>
        {/* Long neck. */}
        <group position={BRA_NECK_BASE}>
          <Chain
            mat={skin}
            segs={segs}
            deco={(i, s) =>
              i % 2 === 0 ? <Ell m={dark} p={[0, s.len * 0.5, -s.r0 * 0.93]} r={[s.r0 * 0.3, s.r0 * 0.3, 0.07]} rot={[0.2, 0, 0]} /> : null
            }
            tip={<group rotation={[headLevel, 0, 0]}>{head}</group>}
          />
        </group>
        {/* Tail. */}
        <group position={[0, 6.35, -3.5]}>
          <Chain
            mat={skin}
            segs={[
              { r0: 1.6, r1: 1.2, len: 2.1, rot: [-(PI / 2 + 0.42), 0, w * 0.03 * Math.sin(walkPhase)] },
              { r0: 1.2, r1: 0.84, len: 2.0, rot: [0.06, 0, w * 0.04 * Math.sin(walkPhase - 0.5)] },
              { r0: 0.84, r1: 0.54, len: 1.9, rot: [0.1, 0, w * 0.05 * Math.sin(walkPhase - 1)] },
              { r0: 0.54, r1: 0.3, len: 1.7, rot: [0.12, 0, w * 0.06 * Math.sin(walkPhase - 1.5)] },
              { r0: 0.3, r1: 0.13, len: 1.4, rot: [0.14, 0, w * 0.08 * Math.sin(walkPhase - 2)] },
            ]}
            deco={(i, s) => (i % 2 === 1 ? <Ell m={dark} p={[0, s.len * 0.5, s.r0 * 0.93]} r={[s.r0 * 0.34, s.r0 * 0.34, 0.07]} /> : null)}
          />
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// TRICERATOPS

export type TrikePose = {
  /** Walk cycle amplitude 0..1 and phase (radians): a bouncy little trot. */
  walk?: number;
  walkPhase?: number;
  /** Head turn (radians): > 0 towards +x. */
  headYaw?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
};

const TRI = {
  skin: "#34BEDD",
  belly: "#C4F1FB",
  dark: "#1E98BB",
  frill: "#FF8A1E",
  rim: "#FFD23A",
  horn: "#FFF1D2",
  beak: "#FFC56B",
  blush: "#FF9EB5",
};

const TRI_LEGS = [
  { x: 0.52, z: 0.5, ph: 0 },
  { x: -0.52, z: 0.5, ph: PI },
  { x: 0.56, z: -0.74, ph: PI },
  { x: -0.56, z: -0.74, ph: 0 },
];

/**
 * Cute triceratops: turquoise with a pale belly, a big orange frill with a scalloped yellow rim
 * and yellow spots, three cream horns, a little beak and pink cheeks, four stumpy legs. At
 * size 1 it is ≈ 2.4 tall to the top of the frill (1.2x Nubi at size 2) and ≈ 4 long.
 */
export const Trike: React.FC<{
  size?: number;
  pose?: TrikePose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: V3;
  rotationY?: number;
}> = ({ size = 1, pose = {}, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0 }) => {
  const { walk = 0, walkPhase = 0, headYaw = 0, blink = 0 } = pose;
  const w = clamp01(walk);
  const skin = toy(TRI.skin, { rough: 0.45, glow: 0.14 });
  const belly = toy(TRI.belly, { rough: 0.5, glow: 0.14 });
  const dark = toy(TRI.dark, { rough: 0.45, glow: 0.12 });
  const hornM = toy(TRI.horn, { rough: 0.35, glow: 0.18 });
  const LEG = 0.36;
  const legs = TRI_LEGS.map((L) => {
    const ph = walkPhase + L.ph;
    const swing = w * 0.4 * Math.sin(ph);
    const lift = w * 0.1 * Math.max(0, Math.cos(ph));
    return { L, swing, lift };
  });
  // Diagonal pairs swing by the same angle: drop the body so the planted feet stay down.
  const rootY = -LEG * (1 - Math.cos(w * 0.4 * Math.sin(walkPhase)));
  const bounce = w * 0.04 * Math.abs(Math.sin(walkPhase));
  const nod = w * 0.06 * Math.sin(walkPhase * 2);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={size}>
      {shadow ? (
        <group position={[0, 0, -0.05]}>
          <BlobShadow radius={1.15} stretch={1.45} opacity={shadowOpacity} />
        </group>
      ) : null}
      <group position={[0, rootY + bounce, 0]}>
        {legs.map(({ L, swing, lift }, i) => (
          <group key={i} position={[L.x, 0.66 + lift, L.z]} rotation={[PI - swing, 0, 0]}>
            <mesh geometry={taper(0.29, 0.26, LEG)} material={skin} castShadow />
            <group position={[0, LEG, 0]} rotation={[-(PI - swing), 0, 0]}>
              <mesh geometry={cachedGeo("tri-pad", () => new THREE.CylinderGeometry(1, 1.05, 1, 28))} material={skin} position={[0, -0.18, 0.02]} scale={[0.3, 0.24, 0.31]} />
              {[-1, 0, 1].map((t) => (
                <Ell key={t} m={hornM} p={[t * 0.15, -0.23, 0.27]} r={[0.075, 0.07, 0.06]} rot={[0, t * 0.5, 0]} />
              ))}
            </group>
          </group>
        ))}
        <Ell m={skin} p={[0, 1.0, -0.12]} r={[0.8, 0.68, 1.12]} />
        <Ell m={belly} p={[0, 0.86, -0.07]} r={[0.7, 0.55, 1.0]} />
        {[0.2, -0.25, -0.7].map((z, i) => (
          <Ell key={i} m={dark} p={[0, 1.66 - i * 0.02 - Math.abs(z) * 0.1, z]} r={[0.16 - i * 0.02, 0.1, 0.18 - i * 0.02]} />
        ))}
        <group position={[0, 0.95, -1.05]}>
          <Chain
            mat={skin}
            segs={[
              { r0: 0.36, r1: 0.24, len: 0.45, rot: [-(PI / 2 + 0.35), 0, -w * 0.25 * Math.sin(walkPhase)] },
              { r0: 0.24, r1: 0.09, len: 0.42, rot: [0.18, 0, -w * 0.3 * Math.sin(walkPhase - 0.6)] },
            ]}
          />
        </group>
        {/* Head: skull, beak, horns, frill. */}
        <group position={[0, 1.12, 0.82]} rotation={[nod, headYaw, 0]}>
          <mesh geometry={box("tri-skull", 0.95, 0.82, 0.9, 0.34)} material={skin} position={[0, 0.08, 0.32]} castShadow />
          <mesh geometry={box("tri-snout", 0.64, 0.5, 0.56, 0.2, taperZ(0.25))} material={skin} position={[0, -0.08, 0.82]} castShadow />
          <mesh geometry={horn(0.15, 0.05, 0.2, 1.3)} material={toy(TRI.beak, { rough: 0.4, glow: 0.16 })} position={[0, -0.1, 1.02]} rotation={[PI / 2, 0, 0]} scale={[1.1, 1, 1]} />
          <mesh geometry={horn(0.09, 0.03, 0.2, 0.5)} material={hornM} position={[0, 0.16, 0.9]} rotation={[0.35, 0, 0]} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh geometry={horn(0.1, 0.035, 0.6, 0.55)} material={hornM} position={[s * 0.24, 0.42, 0.45]} rotation={[0.75, 0, -s * 0.18]} />
              <Eye r={0.15} position={[s * 0.34, 0.2, 0.62]} rotation={[0, s * 0.55, 0]} blink={blink} />
              <Ell m={toy(TRI.blush, { rough: 0.6, glow: 0.25 })} p={[s * 0.33, -0.08, 0.84]} r={[0.05, 0.08, 0.12]} rot={[0, s * 0.5, 0]} />
            </group>
          ))}
          <group position={[0, 0.25, -0.1]} rotation={[-0.55, 0, 0]}>
            <mesh geometry={frillGeo(1.08, 7, 0.09)} material={toy(TRI.rim, { rough: 0.45, glow: 0.2 })} position={[0, 0, -0.05]} castShadow />
            <mesh geometry={frillGeo(0.92, 7, 0.06)} material={toy(TRI.frill, { rough: 0.45, glow: 0.18 })} position={[0, 0, 0.03]} />
            {[
              [-0.52, 0.5],
              [0.52, 0.5],
              [0, 0.78],
            ].map(([x, y], i) => (
              <Ell key={i} m={toy(TRI.rim, { rough: 0.45, glow: 0.2 })} p={[x, y, 0.1]} r={[0.13, 0.13, 0.03]} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// BABY T-REX

export type BabyDinoPose = {
  /** Vertical hop (world units at size 1); it stretches a little in the air. */
  hop?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** Head tilt (radians), cute puppy tilt: > 0 tips the top of the head towards -x. */
  headTilt?: number;
  /** Tail wag -1..1: > 0 swings the tip towards +x. */
  tail?: number;
  /** Mouth 0..1 (a tiny "rawr" with two little teeth). */
  jaw?: number;
  /** 1 = rest, < 1 squashed, > 1 stretched (volume preserved, pivot at the feet). */
  squash?: number;
};

const BABY = {
  skin: "#B6E88C",
  belly: "#FFF3BD",
  spike: "#FFB870",
  blush: "#FF9EB5",
  claw: "#FFF8E6",
  mouth: "#D8386A",
  tongue: "#FF8FB0",
};

/**
 * Adorable baby T-Rex pet: pistachio green, a huge head with huge sparkly eyes and pink
 * cheeks, a cream belly, peach spikes, tiny arms and stubby feet. ≈ 1.39 tall at size 1
 * (0.7x Nubi at size 2).
 */
export const BabyDino: React.FC<{
  size?: number;
  pose?: BabyDinoPose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: V3;
  rotationY?: number;
}> = ({ size = 1, pose = {}, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0 }) => {
  const { hop = 0, blink = 0, headTilt = 0, tail = 0, jaw = 0, squash = 1 } = pose;
  const skin = toy(BABY.skin, { rough: 0.42, glow: 0.16 });
  const belly = toy(BABY.belly, { rough: 0.45, glow: 0.16 });
  const spikeM = toy(BABY.spike, { rough: 0.45, glow: 0.18 });
  const claw = toy(BABY.claw, { rough: 0.4, glow: 0.18 });
  const h = Math.max(0, hop);
  const sq = Math.max(0.4, squash) * (1 + Math.min(0.1, h * 0.3));
  const sx = 1 / Math.sqrt(sq);
  const dangle = Math.min(0.5, h * 1.6);
  const wag = clamp(tail, -1, 1);
  const spike = horn(0.07, 0.02, 0.1, 0.5);
  const jawAngle = 0.55 * clamp01(jaw);

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={size}>
      {shadow ? <BlobShadow radius={0.55 - Math.min(0.2, h * 0.3)} stretch={1.1} opacity={shadowOpacity * Math.max(0.35, 1 - h * 0.8)} /> : null}
      <group position={[0, h, 0]} scale={[sx, sq, sx]}>
        {[-1, 1].map((s) => (
          <group key={s}>
            <Ell m={skin} p={[s * 0.19, 0.28, -0.02]} r={[0.16, 0.17, 0.17]} />
            <group position={[s * 0.21, 0.13, -0.02]} rotation={[dangle, 0, 0]}>
              <mesh geometry={box("baby-foot", 0.21, 0.13, 0.32, 0.06)} material={skin} position={[0, -0.065, 0.09]} castShadow />
              {[-1, 0, 1].map((t) => (
                <Ell key={t} m={claw} p={[t * 0.065, -0.085, 0.25]} r={[0.03, 0.03, 0.03]} />
              ))}
            </group>
          </group>
        ))}
        <group position={[0, 0.4, -0.04]} rotation={[0.22, 0, 0]}>
          <mesh geometry={taper(0.34, 0.27, 0.3)} material={skin} castShadow />
          <mesh geometry={taper(0.27, 0.2, 0.3)} material={belly} position={[0, 0.02, 0.13]} />
          {[0.05, 0.28].map((y, i) => (
            <mesh key={i} geometry={spike} material={spikeM} position={[0, y, -(0.33 - y * 0.25)]} rotation={[-PI / 2 - 0.25, PI, 0]} />
          ))}
        </group>
        {[-1, 1].map((s) => (
          <group key={`a${s}`} position={[s * 0.2, 0.58, 0.2]} rotation={[PI - 0.9, 0, -s * 0.35]}>
            <mesh geometry={taper(0.055, 0.045, 0.13)} material={skin} />
            <Ell m={claw} p={[0, 0.17, 0]} r={[0.03, 0.035, 0.03]} />
          </group>
        ))}
        <group position={[0, 0.36, -0.28]}>
          <Chain
            mat={skin}
            segs={[
              { r0: 0.2, r1: 0.13, len: 0.24, rot: [-(PI / 2 + 0.3), 0, -wag * 0.35] },
              { r0: 0.13, r1: 0.055, len: 0.24, rot: [0.45, 0, -wag * 0.45] },
            ]}
            deco={(i, s) => <mesh geometry={spike} material={spikeM} position={[0, s.len * 0.5, (s.r0 + s.r1) * 0.5 - 0.02]} rotation={[PI / 2 - 0.25, PI, 0]} scale={0.9 - i * 0.2} />}
          />
        </group>
        {/* Huge head. */}
        <group position={[0, 0.76, 0.06]} rotation={[0, 0, -headTilt]}>
          <Ell m={skin} p={[0, 0.28, 0.02]} r={[0.35, 0.32, 0.33]} />
          <mesh geometry={box("baby-snout", 0.46, 0.26, 0.36, 0.12)} material={skin} position={[0, 0.12, 0.3]} castShadow />
          <Ell m={toy(BABY.mouth, { rough: 0.5, glow: 0.14 })} p={[0, 0.0, 0.3]} r={[0.16, 0.02, 0.14]} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Eye r={0.125} position={[s * 0.155, 0.33, 0.29]} rotation={[0, s * 0.3, 0]} blink={blink} glints={2} depth={0.5} />
              <Ell m={toy(BABY.blush, { rough: 0.6, glow: 0.3 })} p={[s * 0.25, 0.14, 0.33]} r={[0.07, 0.045, 0.03]} rot={[0, s * 0.55, 0]} />
              <Ell m={toy("#4E7A3A", { rough: 0.5, glow: 0 })} p={[s * 0.06, 0.24, 0.47]} r={[0.018, 0.012, 0.02]} />
            </group>
          ))}
          {[0, 1].map((i) => (
            <mesh key={i} geometry={spike} material={spikeM} position={[0, 0.56 - i * 0.12, -0.12 - i * 0.14]} rotation={[-0.3 - i * 0.55, PI, 0]} scale={1 - i * 0.1} />
          ))}
          <group position={[0, 0.02, 0.14]} rotation={[jawAngle, 0, 0]}>
            <mesh geometry={box("baby-jaw", 0.4, 0.1, 0.3, 0.045)} material={skin} position={[0, -0.03, 0.15]} castShadow />
            <Ell m={toy(BABY.tongue, { rough: 0.4, glow: 0.16 })} p={[0, 0.02, 0.14]} r={[0.1, 0.02, 0.1]} />
            {[-1, 1].map((s) => (
              <mesh key={s} geometry={horn(0.022, 0.01, 0.03, 0)} material={claw} position={[s * 0.08, 0.02, 0.26]} />
            ))}
          </group>
        </group>
      </group>
    </group>
  );
};
