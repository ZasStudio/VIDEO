import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry } from "../noise";
import { V3, canvasTexture, gold, goldDark, toy, useFontsReady, useRounded } from "../inca/kit";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { NUBI_BODY } from "../inca/Costumes";
import { drawPizzaSlice } from "./Props";

// Costumes for the dinosaur short ("¿Y si los dinosaurios nunca se hubieran extinguido?").
// Every piece is in Nubi's model space (body 10 wide, y 2.5..9.9, front face z = +4.4) and is a
// child of <Nubi> with no transform, so it follows hop and squash:
//   <Nubi size={2} pose={pose}><TouristOutfit /></Nubi>
// Nubi's eyes (x = ±2.3, y 4.6..6.4 at rest, 4.3..6.7 with eyeScale 1.35, front at z = 4.7) are
// never covered: nothing crosses the front face in |x| < 3.5, 4.25 < y < 7.1, and pieces that
// come close to that region (collars, band tops) stay behind the eye bars (z < 4.7).

// =======================================================================================
// Band geometry: a sleeve round the rounded body at a height range, a little bigger than the
// body, with the texture running continuously round it (u = arc length, one tile per face with
// tiles = 4, so a motif painted at x = 0 of the tile sits in the middle of every face).

type RingPt = { x: number; z: number; nx: number; nz: number };

/** Points round the body's cross-section from the front centre towards +x, with normals. */
const ringPath = (step = 0.3, seg = 8): RingPt[] => {
  const { a, b, r } = NUBI_BODY;
  const pts: RingPt[] = [];
  const line = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let i = 0; i < n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, z: z0 + ((z1 - z0) * i) / n, nx, nz });
  };
  const corner = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i < seg; i++) {
      const t = a0 + ((a1 - a0) * i) / seg;
      pts.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t), nx: Math.cos(t), nz: Math.sin(t) });
    }
  };
  line(0, b, a - r, b, 0, 1);
  corner(a - r, b - r, Math.PI / 2, 0);
  line(a, b - r, a, -(b - r), 1, 0);
  corner(a - r, -(b - r), 0, -Math.PI / 2);
  line(a - r, -b, -(a - r), -b, 0, -1);
  corner(-(a - r), -(b - r), -Math.PI / 2, -Math.PI);
  line(-a, -(b - r), -a, b - r, -1, 0);
  corner(-(a - r), b - r, -Math.PI, -Math.PI * 1.5);
  line(-(a - r), b, 0, b, 0, 1);
  pts.push({ x: 0, z: b, nx: 0, nz: 1 });
  return pts;
};

const RING = ringPath();
const ARC = RING.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + Math.hypot(p.x - RING[i - 1].x, p.z - RING[i - 1].z));
  return acc;
}, []);
const PERIMETER = ARC[ARC.length - 1];
/** Width of one texture tile in model units: a quarter of the body's perimeter (one per face). */
const TILE = PERIMETER / 4;

type BandSpec = {
  y0: number;
  y1: number;
  /** Outward offset from the body surface at the bottom / top edge. */
  t0: number;
  t1: number;
  /** Extra outward puff at mid height (soft fabric look). */
  bulge?: number;
  rows?: number;
  tiles?: number;
  /** Zigzag hem: points `depth` long, about every `period` units round the body. */
  hem?: { period: number; depth: number };
  capTop?: number;
  capBottom?: number;
};

const bandGeometry = (s: BandSpec) => {
  const rows = s.rows ?? 6;
  const tiles = s.tiles ?? 4;
  const bulge = s.bulge ?? 0;
  const N = RING.length;
  const H = s.y1 - s.y0;
  const tAt = (v: number) => s.t0 + (s.t1 - s.t0) * v + bulge * Math.sin(Math.PI * v);
  const slope = (v: number) => (s.t1 - s.t0 + bulge * Math.PI * Math.cos(Math.PI * v)) / H;
  const depth = s.hem ? s.hem.depth : 0;
  const count = s.hem ? Math.max(1, Math.round(PERIMETER / s.hem.period)) : 1;
  const drop = (i: number) => {
    if (!s.hem) return 0;
    const f = (ARC[i] / PERIMETER) * count;
    return depth * (1 - Math.abs(2 * (f - Math.floor(f)) - 1));
  };
  const yMin = s.y0 - depth;
  const vOf = (y: number) => (y - yMin) / (s.y1 - yMin);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const t = tAt(v);
    const k = slope(v);
    for (let i = 0; i < N; i++) {
      const p = RING[i];
      const y = s.y0 + H * v - (j === 0 ? drop(i) : 0);
      pos.push(p.x + p.nx * t, y, p.z + p.nz * t);
      n.set(p.nx, -k, p.nz).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push((ARC[i] / PERIMETER) * tiles, vOf(y));
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      idx.push(A, A + 1, A + N + 1, A, A + N + 1, A + N);
    }
  }
  const cap = (row: number, tOut: number, tIn: number, up: boolean) => {
    const base = pos.length / 3;
    for (let i = 0; i < N; i++) {
      const p = RING[i];
      const y = pos[(row * N + i) * 3 + 1];
      pos.push(p.x + p.nx * tOut, y, p.z + p.nz * tOut, p.x + p.nx * tIn, y, p.z + p.nz * tIn);
      nrm.push(0, up ? 1 : -1, 0, 0, up ? 1 : -1, 0);
      const u = (ARC[i] / PERIMETER) * tiles;
      uv.push(u, vOf(y), u, vOf(y));
    }
    for (let i = 0; i < N - 1; i++) {
      const o = base + i * 2;
      if (up) idx.push(o, o + 2, o + 3, o, o + 3, o + 1);
      else idx.push(o, o + 3, o + 2, o, o + 1, o + 3);
    }
  };
  cap(rows, tAt(1), -(s.capTop ?? 0.3), true);
  cap(0, tAt(0), -(s.capBottom ?? 0.5), false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

/** Height of the band's texture (including the hem) for a spec. */
const bandTexH = (s: BandSpec) => s.y1 - s.y0 + (s.hem ? s.hem.depth : 0);

// =======================================================================================
// Fabric textures, painted in model units (PX pixels per unit).

const PX = 100;
type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, W: number, H: number) => void;

const fabric = (key: string, w: number, h: number, paint: Painter, wrapT = false) =>
  canvasTexture(
    `dino-fabric|${key}`,
    w * PX,
    h * PX,
    (ctx) => {
      ctx.scale(PX, PX);
      paint(ctx, w, h);
    },
    { wrapS: true, wrapT },
  );

const fabricMats = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Fabric material for a texture (an emissive map keeps the colours bright). Cached. */
const fabricMat = (tex: THREE.Texture, rough = 0.8, glow = 0.16) => {
  let m = fabricMats.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });
    fabricMats.set(tex, m);
  }
  return m;
};

/** Runs `fn` shifted by -W, 0 and +W so shapes that cross a tile edge wrap seamlessly. */
const tiled = (W: number, fn: (dx: number) => void) => {
  fn(-W);
  fn(0);
  fn(W);
};

const leafShape = (ctx: Ctx, x: number, y: number, len: number, w: number, rot: number, color: string) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-len * 0.1, 0);
  ctx.quadraticCurveTo(len * 0.45, -w, len, 0);
  ctx.quadraticCurveTo(len * 0.45, w, -len * 0.1, 0);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = w * 0.14;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len * 0.85, 0);
  ctx.stroke();
  ctx.restore();
};

const hibiscus = (ctx: Ctx, x: number, y: number, r: number, petal: string, heart: string, rot: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.56, r * 0.44, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFE45C";
  ctx.lineWidth = r * 0.1;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(r * 0.6, -r * 0.42);
  ctx.stroke();
  ctx.fillStyle = "#FFE45C";
  ctx.beginPath();
  ctx.arc(r * 0.64, -r * 0.45, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** Hawaiian shirt: big hibiscus flowers over palm leaves on a bright blue ground. */
const paintHawaii: Painter = (ctx, W, H) => {
  ctx.fillStyle = "#2A7BFF";
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry(404);
  for (let i = 0; i < 12; i++) {
    const x = (i / 12) * W + rnd() * 0.6;
    const y = 0.2 + rnd() * (H - 0.4);
    const len = 0.85 + rnd() * 0.45;
    const rot = rnd() * Math.PI * 2;
    const c = i % 2 ? "#17B85C" : "#0C9147";
    tiled(W, (dx) => leafShape(ctx, x + dx, y, len, len * 0.34, rot, c));
  }
  const petals = ["#FF4FA0", "#FFD23F", "#FFFFFF", "#FF7A3D", "#FF4FA0", "#FFFFFF"];
  const hearts = ["#C2185B", "#FF7A3D", "#FF4FA0", "#B8321A", "#C2185B", "#FF7A3D"];
  const perRow = 5;
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < perRow; i++) {
      const x = ((i + (row ? 0.5 : 0)) / perRow) * W + (rnd() - 0.5) * 0.3;
      const y = H * (row ? 0.7 : 0.3) + (rnd() - 0.5) * 0.2;
      const r = 0.42 + rnd() * 0.1;
      const rot = rnd() * Math.PI;
      const k = (row * perRow + i) % petals.length;
      tiled(W, (dx) => hibiscus(ctx, x + dx, y, r, petals[k], hearts[k], rot));
    }
  }
};

/** Pizza-delivery polo: red with a white collar stripe, a white chest stripe and a white hem. */
const paintUniform: Painter = (ctx, W, H) => {
  ctx.fillStyle = "#E3262B";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, 0.3);
  ctx.fillRect(0, H * 0.5, W, 0.32);
  ctx.fillRect(0, H - 0.2, W, 0.2);
  ctx.fillStyle = "#A8141B";
  ctx.fillRect(0, 0.3, W, 0.05);
  ctx.fillRect(0, H * 0.5 - 0.06, W, 0.06);
  ctx.fillRect(0, H * 0.5 + 0.32, W, 0.06);
};

/** Leopard print: broken dark rosettes round orange centres on golden fur. */
const paintLeopard =
  (seed: number, density = 2.4): Painter =>
  (ctx, W, H) => {
    ctx.fillStyle = "#F4B23E";
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(seed);
    const n = Math.max(3, Math.round(W * H * density));
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 0.15 + rnd() * 0.12;
      const rot = rnd() * Math.PI * 2;
      const gaps = 2 + Math.floor(rnd() * 2);
      tiled(W, (dx) => {
        ctx.fillStyle = "#DC8526";
        ctx.beginPath();
        ctx.ellipse(x + dx, y, r * 0.78, r * 0.66, rot, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#3A2213";
        ctx.lineWidth = r * 0.42;
        for (let k = 0; k < gaps; k++) {
          const a0 = rot + (k / gaps) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(x + dx, y, r, r * 0.86, 0, a0, a0 + (Math.PI * 2) / gaps - 0.7);
          ctx.stroke();
        }
      });
    }
    for (let i = 0; i < n; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 0.04 + rnd() * 0.04;
      tiled(W, (dx) => {
        ctx.fillStyle = "#3A2213";
        ctx.beginPath();
        ctx.arc(x + dx, y, r, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  };

/** Ermine: white fur with little black tails, for the royal cape's collar. */
const paintErmine: Painter = (ctx, W, H) => {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);
  const cols = Math.round(W / 1.1);
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < cols; i++) {
      const x = ((i + (row % 2) * 0.5) / cols) * W;
      const y = ((row + 0.5) / 3) * H;
      tiled(W, (dx) => {
        ctx.fillStyle = "#15151A";
        ctx.beginPath();
        ctx.ellipse(x + dx, y + 0.08, 0.09, 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const [ox, oy] of [
          [-0.13, -0.2],
          [0, -0.26],
          [0.13, -0.2],
        ]) {
          ctx.beginPath();
          ctx.arc(x + dx + ox, y + oy, 0.045, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
};

const shirtTexture = (h: number) => fabric(`hawaii-${h.toFixed(2)}`, TILE, h, paintHawaii);
const leopardTexture = (w: number, h: number, seed: number) =>
  fabric(`leopard-${w.toFixed(2)}x${h.toFixed(2)}-${seed}`, w, h, paintLeopard(seed));

// =======================================================================================
// Tourist: bucket hat, camera on a strap, Hawaiian shirt

const SHIRT_BAND: BandSpec = { y0: 2.0, y1: 4.3, t0: 0.5, t1: 0.12, bulge: 0.07, rows: 8 };
const HAT = "#EFCF8E";
const HAT_BAND = "#FF4FA0";

/** Bucket-hat crown (r, y) from the base up, and the brim as a closed loop (drawn double-sided). */
const HAT_CROWN: [number, number][] = [
  [4.66, 0],
  [4.62, 0.14],
  [4.46, 1.2],
  [4.22, 2.0],
  [3.72, 2.34],
  [2.6, 2.48],
  [0, 2.52],
];
const HAT_BRIM: [number, number][] = [
  [4.35, 0.42],
  [5.6, 0.26],
  [7.0, -0.46],
  [7.32, -0.7],
  [7.16, -0.9],
  [5.5, -0.08],
  [4.35, 0.12],
  [4.35, 0.42],
];
/** Where the camera body's centre sits (model units): on the chest, below the eyes. */
const CAMERA_AT: V3 = [0, 3.42, 5.34];

const lathe = (p: [number, number][], seg = 48) =>
  new THREE.LatheGeometry(
    p.map(([r, h]) => new THREE.Vector2(r, h)),
    seg,
  );

/** Chunky retro camera: black body with a tan leather band, chrome top, big blue lens. */
const TouristCamera: React.FC = () => {
  const body = useRounded(2.5, 1.3, 1.05, 0.26, 3);
  const leather = useRounded(2.54, 0.62, 1.09, 0.1, 2);
  const top = useRounded(2.3, 0.28, 0.96, 0.1, 2);
  const finder = useRounded(0.72, 0.36, 0.62, 0.1, 2);
  const flash = useRounded(0.46, 0.3, 0.1, 0.06, 2);
  const geos = useMemo(
    () => ({
      barrel: new THREE.CylinderGeometry(0.6, 0.64, 0.56, 32),
      ring: new THREE.TorusGeometry(0.53, 0.09, 10, 32),
      glass: new THREE.CircleGeometry(0.46, 32),
      glint: new THREE.CircleGeometry(0.14, 16),
      button: new THREE.CylinderGeometry(0.17, 0.17, 0.16, 16),
      lug: new THREE.TorusGeometry(0.15, 0.055, 8, 16),
    }),
    [],
  );
  const black = toy("#262A33", { rough: 0.4, glow: 0.08 });
  const chrome = toy("#DCE3EA", { metal: 0.7, rough: 0.25, glow: 0.14 });
  return (
    <group position={CAMERA_AT}>
      <mesh geometry={body} material={black} castShadow />
      <mesh geometry={leather} material={toy("#A8672F", { rough: 0.7 })} position={[0, -0.1, 0]} />
      <mesh geometry={top} material={chrome} position={[0, 0.72, 0]} />
      <mesh geometry={finder} material={black} position={[-0.62, 0.92, -0.04]} />
      <mesh geometry={geos.button} material={toy("#E8383D", { rough: 0.35 })} position={[0.72, 0.92, 0]} />
      <mesh geometry={flash} material={toy("#FFFFFF", { glow: 0.45 })} position={[0.82, 0.36, 0.54]} />
      {/* Lens barrel with a chrome ring and glossy blue glass. */}
      <group position={[0.12, -0.08, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geos.barrel} material={toy("#3A3F4A", { rough: 0.45 })} position={[0, 0.28, 0]} />
      </group>
      <mesh geometry={geos.ring} material={chrome} position={[0.12, -0.08, 1.08]} />
      <mesh geometry={geos.glass} material={toy("#5CC8FF", { rough: 0.1, glow: 0.45 })} position={[0.12, -0.08, 1.06]} />
      <mesh geometry={geos.glint} material={toy("#FFFFFF", { glow: 0.9 })} position={[-0.04, 0.1, 1.09]} scale={[1, 0.7, 1]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.lug} material={chrome} position={[s * 1.3, 0.48, 0]} rotation={[0, Math.PI / 2, 0]} />
      ))}
    </group>
  );
};

/** Neck strap path: camera lugs, along the chest below the eyes, up the sides, over the top. */
const strapPoints = () => {
  const [cx, cy, cz] = CAMERA_AT;
  const half: [number, number, number][] = [
    [cx + 1.34, cy + 0.46, cz],
    [2.2, 3.9, 4.98],
    [3.3, 3.98, 4.76],
    [4.4, 4.08, 4.66],
    [5.02, 4.32, 4.26],
    [5.22, 5.3, 3.5],
    [5.24, 7.0, 2.9],
    [5.2, 8.6, 2.4],
    [5.02, 9.86, 2.0],
    [3.6, 10.14, 1.6],
  ];
  const right = half.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const left = half.map(([x, y, z]) => new THREE.Vector3(-x, y, z)).reverse();
  return [...left, new THREE.Vector3(0, 10.18, 1.4), ...right];
};

/**
 * Tourist: a khaki bucket hat with a pink band on top (brim at y ≈ 9.0–9.9, well above the
 * eyes), a chunky retro camera hanging on a red strap on the chest (camera y 2.8..4.2, between
 * and below the eyes; the strap runs along the chest under the eyes and up the sides) and a
 * blue Hawaiian shirt with hibiscus flowers round the lower body (y 2.0..4.3, top behind the
 * eye bars). Child of <Nubi>; no transform needed.
 */
export const TouristOutfit: React.FC = () => {
  const geos = useMemo(
    () => ({
      shirt: bandGeometry(SHIRT_BAND),
      crown: lathe(HAT_CROWN),
      brim: lathe(HAT_BRIM),
      band: new THREE.CylinderGeometry(4.56, 4.7, 0.62, 48, 1, true),
      strap: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strapPoints()), 160, 0.16, 8, false),
    }),
    [],
  );
  const hat = toy(HAT, { rough: 0.75, glow: 0.16, side: THREE.DoubleSide });
  return (
    <group>
      <mesh geometry={geos.shirt} material={fabricMat(shirtTexture(bandTexH(SHIRT_BAND)))} castShadow />
      <mesh geometry={geos.strap} material={toy("#E0322B", { rough: 0.6 })} />
      <TouristCamera />
      <group position={[0, 9.58, -0.1]} rotation={[-0.07, 0, 0.04]} scale={[1.16, 1, 1.06]}>
        <mesh geometry={geos.crown} material={hat} castShadow />
        <mesh geometry={geos.brim} material={hat} castShadow />
        <mesh geometry={geos.band} material={toy(HAT_BAND, { rough: 0.6, glow: 0.18, side: THREE.DoubleSide })} position={[0, 0.48, 0]} />
      </group>
    </group>
  );
};

// =======================================================================================
// Pizza delivery: red cap with a pizza logo, red-and-white uniform with a "PIZZA" badge

const DELIVERY_RED = "#E3262B";
const UNIFORM_BAND: BandSpec = { y0: 2.0, y1: 4.36, t0: 0.5, t1: 0.16, bulge: 0.06, rows: 8 };

const capLogoTexture = () =>
  canvasTexture("dino-cap-logo", 256, 256, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = DELIVERY_RED;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 16, 0, Math.PI * 2);
    ctx.stroke();
    drawPizzaSlice(ctx, W / 2, H / 2 + 4, 150);
  });

const badgeTexture = () =>
  canvasTexture("dino-pizza-badge", 640, 200, (ctx, W, H) => {
    ctx.fillStyle = DELIVERY_RED;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 44);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(12, 12, W - 24, H - 24, 34);
    ctx.fill();
    drawPizzaSlice(ctx, 108, H / 2 + 2, 132);
    ctx.font = "150px 'Luckiest Guy', 'Lilita One', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    ctx.fillText("PIZZA", 402, H / 2 + 22);
    ctx.fillStyle = DELIVERY_RED;
    ctx.fillText("PIZZA", 396, H / 2 + 16);
  });

const texMats = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
const printMat = (tex: THREE.Texture, glow = 0.22) => {
  let m = texMats.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.5,
      transparent: true,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });
    texMats.set(tex, m);
  }
  return m;
};

/** Baseball-cap bill: a D shape curving down at the sides and dipping a little at the front. */
const billGeometry = () => {
  const s = new THREE.Shape();
  s.moveTo(-4.3, 0);
  s.lineTo(4.3, 0);
  s.bezierCurveTo(4.45, 1.7, 2.9, 2.95, 0, 3.05);
  s.bezierCurveTo(-2.9, 2.95, -4.45, 1.7, -4.3, 0);
  let g: THREE.BufferGeometry = new THREE.ExtrudeGeometry(s, {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 2,
    curveSegments: 24,
  });
  // Shape y → +z (forward), extrusion → -y (down).
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    p.setY(i, p.getY(i) - 0.032 * x * x - 0.1 * z);
  }
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  g.computeVertexNormals();
  return g;
};

/**
 * Pizza delivery: a red baseball cap (crown over the top of the body from y 8.1, bill sticking
 * out 3 units over the face at y ≈ 8.3, two units above the eyes) with a round pizza logo on the
 * front, and a red polo with white stripes round the lower body (y 2.0..4.36, collar behind the
 * eye bars) with a big "PIZZA" badge on the chest (y 2.5..3.6, centred between the eyes' x).
 * Child of <Nubi>; no transform needed.
 */
export const DeliveryOutfit: React.FC = () => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      uniform: bandGeometry(UNIFORM_BAND),
      collar: bandGeometry({ y0: 4.02, y1: 4.38, t0: 0.2, t1: 0.2, bulge: 0.03, rows: 2 }),
      dome: new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      button: new THREE.SphereGeometry(0.5, 20, 12),
      bill: billGeometry(),
      logo: new THREE.CircleGeometry(0.82, 40),
    }),
    [],
  );
  const shell = useRounded(10.6, 2.6, 9.4, 0.8, 5);
  const plate = useRounded(3.4, 1.16, 0.14, 0.12, 2);
  const red = toy(DELIVERY_RED, { rough: 0.45, glow: 0.16 });
  return (
    <group>
      <mesh geometry={geos.uniform} material={fabricMat(fabric("uniform", TILE, bandTexH(UNIFORM_BAND), paintUniform))} castShadow />
      <mesh geometry={geos.collar} material={toy("#FFFFFF", { rough: 0.7, glow: 0.12 })} />
      {/* Badge on the chest, tilted with the flare of the polo. */}
      <group position={[0, 3.05, 4.88]} rotation={[0.14, 0, 0]}>
        <mesh geometry={plate} material={toy("#FFFFFF", { rough: 0.5 })} />
        {ready ? (
          <mesh position={[0, 0, 0.075]}>
            <planeGeometry args={[3.3, 1.03]} />
            <primitive object={printMat(badgeTexture())} attach="material" />
          </mesh>
        ) : null}
      </group>
      {/* Cap. */}
      <mesh geometry={shell} material={red} position={[0, 9.4, -0.02]} castShadow />
      <mesh geometry={geos.dome} material={red} position={[0, 10.45, -0.1]} scale={[4.95, 1.3, 4.45]} castShadow />
      <mesh geometry={geos.button} material={red} position={[0, 11.72, -0.1]} scale={[1, 0.5, 1]} />
      <mesh geometry={geos.bill} material={red} position={[0, 8.56, 4.3]} castShadow />
      <mesh geometry={geos.logo} material={printMat(capLogoTexture(), 0.25)} position={[0, 9.42, 4.7]} />
    </group>
  );
};

// =======================================================================================
// Caveman: leopard-print one-shoulder tunic, bone in a little topknot

const TUNIC_BAND: BandSpec = {
  y0: 2.15,
  y1: 4.32,
  t0: 0.55,
  t1: 0.14,
  bulge: 0.07,
  rows: 8,
  hem: { period: 0.95, depth: 0.5 },
};

/** A cartoon bone along x, `len` long between the knob centres. */
export const Bone: React.FC<{ len?: number; radius?: number; color?: string }> = ({ len = 3.9, radius = 0.26, color = "#F6ECD4" }) => {
  const geos = useMemo(
    () => ({
      shaft: new THREE.CylinderGeometry(1, 1, 1, 14),
      knob: new THREE.SphereGeometry(1, 18, 12),
    }),
    [],
  );
  const mat = toy(color, { rough: 0.55, glow: 0.2 });
  return (
    <group>
      <mesh geometry={geos.shaft} material={mat} rotation={[0, 0, Math.PI / 2]} scale={[radius, len, radius]} castShadow />
      {[-1, 1].flatMap((s) =>
        [-1, 1].map((k) => (
          <mesh key={`${s}${k}`} geometry={geos.knob} material={mat} position={[(s * len) / 2, k * radius * 1.05, 0]} scale={radius * 1.62} />
        )),
      )}
    </group>
  );
};

/** One-shoulder strap over the screen-right top edge: [position, rotation, size, texture size]. */
const SHOULDER_X = 4.0;
const STRAP_W = 1.05;
const STRAP_PIECES: { p: V3; r: V3; size: V3; tex: [number, number]; seed: number }[] = [
  { p: [SHOULDER_X, 6.775, 4.52], r: [0, 0, 0], size: [STRAP_W, 5.15, 0.2], tex: [STRAP_W, 5.15], seed: 21 },
  { p: [SHOULDER_X, 9.795, 4.295], r: [Math.PI / 4, 0, 0], size: [STRAP_W, 0.2, 1.0], tex: [STRAP_W, 1.0], seed: 23 },
  { p: [SHOULDER_X, 10.0, 0], r: [0, 0, 0], size: [STRAP_W, 0.2, 7.6], tex: [STRAP_W, 7.6], seed: 22 },
  { p: [SHOULDER_X, 9.795, -4.295], r: [-Math.PI / 4, 0, 0], size: [STRAP_W, 0.2, 1.0], tex: [STRAP_W, 1.0], seed: 23 },
  { p: [SHOULDER_X, 6.775, -4.52], r: [0, 0, 0], size: [STRAP_W, 5.15, 0.2], tex: [STRAP_W, 5.15], seed: 24 },
];

const StrapPiece: React.FC<{ piece: (typeof STRAP_PIECES)[number] }> = ({ piece }) => {
  const geo = useRounded(piece.size[0], piece.size[1], piece.size[2], 0.08, 2);
  return (
    <mesh
      geometry={geo}
      material={fabricMat(leopardTexture(piece.tex[0], piece.tex[1], piece.seed))}
      position={piece.p}
      rotation={piece.r}
      castShadow
    />
  );
};

/**
 * Caveman: a leopard-print tunic round the lower body (y 1.65..4.32 with a zigzag hem over the
 * tops of the legs) with a one-shoulder strap over the screen-right top edge (on the front face
 * at x 3.5..4.5, outside the eyes), and a little brown topknot on top of the head with a big bone
 * stuck through it (y 10..11.8). Child of <Nubi>; no transform needed. Hold the Club (Props) in
 * holdR for the full look.
 */
export const CavemanOutfit: React.FC = () => {
  const geos = useMemo(
    () => ({
      tunic: bandGeometry(TUNIC_BAND),
      bun: new THREE.SphereGeometry(1.2, 22, 14),
      lock: new THREE.ConeGeometry(0.36, 1.35, 12),
      tie: new THREE.TorusGeometry(0.55, 0.17, 10, 24),
    }),
    [],
  );
  const hair = toy("#4A2C1A", { rough: 0.8, glow: 0.12 });
  const locks: [number, number][] = [
    [-0.72, 0.18],
    [-0.36, -0.16],
    [0, 0.12],
    [0.36, -0.14],
    [0.72, 0.18],
  ];
  return (
    <group>
      <mesh geometry={geos.tunic} material={fabricMat(leopardTexture(TILE, bandTexH(TUNIC_BAND), 11))} castShadow />
      {STRAP_PIECES.map((piece, i) => (
        <StrapPiece key={i} piece={piece} />
      ))}
      <group position={[0.2, 9.9, 0.3]}>
        <mesh geometry={geos.bun} material={hair} position={[0, 0.45, 0]} scale={[1.1, 0.78, 1]} castShadow />
        {locks.map(([rz, rx], i) => (
          <mesh
            key={i}
            geometry={geos.lock}
            material={toy(i % 2 ? "#5B3822" : "#4A2C1A", { rough: 0.8, glow: 0.12 })}
            position={[Math.sin(rz) * 0.55, 1.35 + Math.cos(rz) * 0.1, rx]}
            rotation={[rx, 0, -rz]}
          />
        ))}
        <mesh geometry={geos.tie} material={toy("#E0A33A", { rough: 0.7 })} position={[0, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <group position={[0, 0.66, 0.05]} rotation={[0.1, 0.35, 0.22]}>
          <Bone len={3.9} radius={0.26} />
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// Dino king: green dinosaur hood, orange back spikes, gold crown, red royal cape

const HOOD = "#3DBA5C";
const HOOD_DARK = "#2A8F45";
const SPIKE = "#FF8A1F";
const CAPE_RED = "#D7263D";
/** The hood's upper jaw pivots here (model units); `roar` tilts it up round the x axis. */
const JAW_PIVOT: V3 = [0, 9.35, 4.3];
const CAPE = { top: 7.35, phi0: 0.34, cols: 32, rows: 16 };

/** A point on the cape: u 0..1 from the screen-right edge round the back, v 0..1 top to hem. */
const capeAt = (u: number, v: number) => {
  const phi = CAPE.phi0 + (Math.PI - 2 * CAPE.phi0) * u;
  const side = Math.abs(u - 0.5) * 2;
  const yBot = 0.5 + 2.4 * side * side;
  const y = CAPE.top + (yBot - CAPE.top) * v;
  const A = 5.45 + 1.35 * v;
  const B = 5.0 + 1.3 * v;
  const fold = 1 + 0.045 * v * Math.sin(u * Math.PI * 8);
  return new THREE.Vector3(A * Math.cos(phi) * fold, y, -B * Math.sin(phi) * fold - 0.05);
};

const capeGeometry = () => {
  const { cols, rows } = CAPE;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= cols; i++) {
      const p = capeAt(i / cols, j / rows);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const d = a + cols + 1;
      const c = d + 1;
      idx.push(a, c, b, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** Gold trim down one edge of the cape, along the hem and up the other edge. */
const capeTrimCurve = () => {
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j <= 8; j++) pts.push(capeAt(0, j / 8));
  for (let i = 1; i <= 24; i++) pts.push(capeAt(i / 24, 1));
  for (let j = 7; j >= 0; j--) pts.push(capeAt(1, j / 8));
  return new THREE.CatmullRomCurve3(pts);
};

const COLLAR_R = 0.55;
const collarCurve = () => {
  const pts: THREE.Vector3[] = [];
  const a0 = CAPE.phi0 - 0.03;
  const a1 = Math.PI - a0;
  for (let i = 0; i <= 24; i++) {
    const phi = a0 + ((a1 - a0) * i) / 24;
    pts.push(new THREE.Vector3(5.55 * Math.cos(phi), CAPE.top + 0.05, -5.08 * Math.sin(phi) - 0.05));
  }
  return new THREE.CatmullRomCurve3(pts);
};

/** Rounded dinosaur back plate, 1 tall (apex at +y), 0.8 wide at the base, thin along x. */
const spikeGeometry = () => {
  const s = new THREE.Shape();
  s.moveTo(-0.4, 0);
  s.quadraticCurveTo(-0.28, 0.55, 0, 1);
  s.quadraticCurveTo(0.28, 0.55, 0.4, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.08,
    bevelSegments: 3,
    curveSegments: 10,
  });
  g.translate(0, 0, -0.11);
  g.rotateY(Math.PI / 2);
  return g;
};

/** [position, x rotation (apex tilt, 0 = up, -π/2 = straight back), height]. */
const SPIKES: [V3, number, number][] = [
  [[0, 10.85, -2.0], 0, 1.65],
  [[0, 10.8, -3.45], -0.3, 1.5],
  [[0, 10.38, -4.62], -0.87, 1.35],
  [[0, 9.2, -4.98], -Math.PI / 2, 1.25],
  [[0, 8.1, -4.82], -Math.PI / 2 - 0.3, 1.05],
  [[0, 6.1, -5.26], -Math.PI / 2 - 0.19, 1.0],
  [[0, 4.7, -5.53], -Math.PI / 2 - 0.19, 0.85],
  [[0, 3.3, -5.79], -Math.PI / 2 - 0.19, 0.7],
];

/** Front teeth then side teeth under the upper jaw: [x, z (jaw space), size]. */
const TEETH: [number, number, number][] = [
  [-3.0, 4.0, 0.9],
  [-1.5, 4.12, 1.0],
  [0, 4.16, 1.05],
  [1.5, 4.12, 1.0],
  [3.0, 4.0, 0.9],
  [-3.62, 2.8, 0.82],
  [3.62, 2.8, 0.82],
  [-3.66, 1.55, 0.72],
  [3.66, 1.55, 0.72],
];

const Crown: React.FC = () => {
  const geos = useMemo(
    () => ({
      band: new THREE.CylinderGeometry(2.0, 1.88, 1.05, 40, 1, true),
      rim: new THREE.TorusGeometry(1.93, 0.15, 10, 40),
      point: new THREE.ConeGeometry(0.42, 1.1, 16),
      ball: new THREE.SphereGeometry(0.24, 16, 10),
      jewel: new THREE.SphereGeometry(0.36, 18, 12),
      velvet: new THREE.SphereGeometry(1.86, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    }),
    [],
  );
  const band = toy("#FFC21A", { metal: 0.6, rough: 0.28, glow: 0.26, side: THREE.DoubleSide });
  const n = 6;
  const jewels: [number, string][] = [
    [0, "#E8203A"],
    [1.05, "#2F7BFF"],
    [-1.05, "#1FC96B"],
  ];
  return (
    <group>
      <mesh geometry={geos.velvet} material={toy(CAPE_RED, { rough: 0.85, glow: 0.18 })} position={[0, 0.3, 0]} scale={[1, 0.72, 1]} />
      <mesh geometry={geos.band} material={band} position={[0, 0.52, 0]} castShadow />
      <mesh geometry={geos.rim} material={goldDark()} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.rim} material={gold()} position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.03, 1.03, 0.8]} />
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * 1.96, 1.52, Math.cos(a) * 1.96]}>
            <mesh geometry={geos.point} material={gold()} />
            <mesh geometry={geos.ball} material={gold()} position={[0, 0.62, 0]} />
          </group>
        );
      })}
      {jewels.map(([a, c]) => (
        <mesh
          key={a}
          geometry={geos.jewel}
          material={toy(c, { rough: 0.15, glow: 0.35 })}
          position={[Math.sin(a) * 2.02, 0.55, Math.cos(a) * 2.02]}
          rotation={[0, a, 0]}
          scale={[1, 1, 0.55]}
        />
      ))}
    </group>
  );
};

const HoodEye: React.FC<{ side: 1 | -1 }> = ({ side }) => {
  const geos = useMemo(
    () => ({
      ball: new THREE.SphereGeometry(1, 28, 20),
    }),
    [],
  );
  return (
    <group position={[side * 3.05, 10.9, 2.95]} rotation={[-0.15, side * 0.28, 0]}>
      <mesh geometry={geos.ball} material={toy(HOOD, { rough: 0.6, glow: 0.14 })} position={[0, -0.45, -0.15]} scale={[1.45, 0.9, 1.2]} />
      <mesh geometry={geos.ball} material={toy("#FFFFFF", { rough: 0.3, glow: 0.2 })} scale={[1.18, 1.26, 1.0]} />
      <mesh geometry={geos.ball} material={toy("#151515", { rough: 0.25 })} position={[-side * 0.08, 0.05, 0.62]} scale={[0.62, 0.72, 0.5]} />
      <mesh geometry={geos.ball} material={toy("#FFFFFF", { glow: 0.9 })} position={[-side * 0.28 - 0.1, 0.38, 1.02]} scale={0.2} />
    </group>
  );
};

/**
 * Dino king: a green dinosaur mascot hood over the top of the head (lower rim at y ≈ 7.5 on the
 * face, above the eyes) with big googly eyes on top, nostrils and an upper jaw jutting out over
 * the face whose big rounded teeth end above the eyes (tips at y ≈ 7.4); orange plates down the
 * back (over the hood and on down the cape), a gold crown on top (y 10.9..13.1) and a red royal
 * cape with an ermine collar hanging behind the body (sides behind the fins, hem at y 0.5 at the
 * back rising to 2.9 at the edges, clear of the legs). `roar` 0..1 lifts the jaw wide open
 * (showing the pink palate and mouth). Child of <Nubi>; no transform needed.
 */
export const DinoKingOutfit: React.FC<{ roar?: number }> = ({ roar = 0 }) => {
  const geos = useMemo(() => {
    const collar = collarCurve();
    const tooth = new THREE.LatheGeometry(
      [
        [0, -0.85],
        [0.1, -0.8],
        [0.2, -0.68],
        [0.3, -0.46],
        [0.35, -0.2],
        [0.36, 0],
      ].map(([r, h]) => new THREE.Vector2(r, h)),
      16,
    );
    return {
      tooth,
      spike: spikeGeometry(),
      cape: capeGeometry(),
      trim: new THREE.TubeGeometry(capeTrimCurve(), 120, 0.16, 8, false),
      collar: new THREE.TubeGeometry(collar, 64, COLLAR_R, 14, false),
      collarEnd: new THREE.SphereGeometry(COLLAR_R, 18, 12),
      collarEnds: [collar.getPoint(0), collar.getPoint(1)],
      clasp: new THREE.CylinderGeometry(0.46, 0.46, 0.16, 24),
      nostril: new THREE.SphereGeometry(0.3, 14, 10),
      spot: new THREE.SphereGeometry(1, 16, 10),
    };
  }, []);
  const cranium = useRounded(11.0, 3.8, 9.9, 1.5, 5);
  const mouth = useRounded(7.6, 2.3, 0.3, 0.12, 2);
  const snout = useRounded(8.4, 2.15, 4.7, 0.95, 5);
  const palate = useRounded(7.5, 0.3, 4.0, 0.14, 2);
  const green = toy(HOOD, { rough: 0.6, glow: 0.14 });
  const dark = toy(HOOD_DARK, { rough: 0.6, glow: 0.12 });
  const spike = toy(SPIKE, { rough: 0.45, glow: 0.2 });
  const tooth = toy("#FFFFFF", { rough: 0.3, glow: 0.22 });
  const r = Math.max(0, Math.min(1, roar));
  return (
    <group>
      {/* Hood. */}
      <mesh geometry={cranium} material={green} position={[0, 9.05, -0.05]} castShadow />
      <mesh geometry={mouth} material={toy("#B8233F", { rough: 0.7, glow: 0.14 })} position={[0, 8.75, 4.78]} />
      {(
        [
          [-5.45, 9.2, -1.6, 0.55],
          [5.45, 9.4, -2.4, 0.45],
          [-4.2, 10.9, -3.0, 0.5],
          [4.4, 10.9, 0.2, 0.4],
        ] as [number, number, number, number][]
      ).map(([x, y, z, s], i) => (
        <mesh key={i} geometry={geos.spot} material={dark} position={[x, y, z]} scale={[x > 5 || x < -5 ? 0.12 : s, y > 10.5 ? 0.1 : s, s]} />
      ))}
      <HoodEye side={-1} />
      <HoodEye side={1} />
      {/* Upper jaw: lifts round its back edge with `roar`. */}
      <group position={JAW_PIVOT} rotation={[-(0.08 + 0.5 * r), 0, 0]}>
        <mesh geometry={snout} material={green} position={[0, -0.4, 2.15]} castShadow />
        <mesh geometry={palate} material={toy("#FF8FA3", { rough: 0.6, glow: 0.18 })} position={[0, -1.44, 2.25]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geos.nostril} material={toy("#1F6B35", { rough: 0.6 })} position={[s * 1.25, 0.62, 4.15]} scale={[1.3, 0.75, 0.6]} />
        ))}
        {TEETH.map(([x, z, k], i) => (
          <mesh key={i} geometry={geos.tooth} material={tooth} position={[x, -1.45, z]} scale={k} />
        ))}
      </group>
      {/* Crown, a little askew. */}
      <group position={[0, 10.9, 0.8]} rotation={[0.06, 0, 0.1]}>
        <Crown />
      </group>
      {/* Back plates. */}
      {SPIKES.map(([p, rx, h], i) => (
        <group key={i} position={p} rotation={[rx, 0, 0]} scale={h}>
          <mesh geometry={geos.spike} material={spike} castShadow />
        </group>
      ))}
      {/* Royal cape with an ermine collar and gold trim. */}
      <mesh geometry={geos.cape} material={toy(CAPE_RED, { rough: 0.7, glow: 0.16, side: THREE.DoubleSide })} castShadow />
      <mesh geometry={geos.trim} material={gold()} />
      <mesh geometry={geos.collar} material={fabricMat(fabric("ermine", 13.5, COLLAR_R * Math.PI * 2, paintErmine), 0.9, 0.18)} castShadow />
      {geos.collarEnds.map((p, i) => (
        <group key={i} position={p}>
          <mesh geometry={geos.collarEnd} material={fabricMat(fabric("ermine", 13.5, COLLAR_R * Math.PI * 2, paintErmine), 0.9, 0.18)} />
          <mesh geometry={geos.clasp} material={gold()} position={[i === 0 ? 0.42 : -0.42, 0, 0.1]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      ))}
    </group>
  );
};
