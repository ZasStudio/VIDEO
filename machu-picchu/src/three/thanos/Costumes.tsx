import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry } from "../noise";
import { NUBI_BODY } from "../inca/Costumes";
import { GOLD, V3, canvasTexture, glowTexture, goldDark, paintGeo, shadeHex, toy, vertexMat } from "../inca/kit";
import { NUBI_FIN_TIP, NubiPalette, NubiPose } from "../Nubi";

// Cast and costumes for the Thanos short ("¿Y si Thanos NUNCA chasqueaba los dedos?").
// Every character is a Nubi-shaped vinyl toy in its own colours wearing its suit:
//   <Nubi size={2} palette={CAST.spider} hideEyes pose={p}><SpiderSuit pose={p} /></Nubi>
// Nubi itself keeps its mint green (no palette) and just puts the costume on.
// Every piece is in Nubi's model space (body 10 wide, x −5..5, y 2.5..9.9, front face z = +4.4)
// and is a child of <Nubi> with no transform, so it follows hop and squash. Costumes Nubi wears
// with its own eyes (Thor, Cap, Strange) never cover the eye region (|x| < 3.5, 4.25 < y < 7.1
// on the front face; pieces close to it stay behind the eye bars, z < 4.7). Masks that replace
// the eyes (Iron, Spider, Panther, Star-Lord, Doom) draw their own and the scene passes hideEyes;
// they take the same `pose` as <Nubi> so their eyes still blink and widen.
// Capes take `t` (seconds) and `wind` 0..1 (0 = hangs and sways, 1 = streams straight back).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
/** Lazily built value shared by every instance (static geometry). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const TMP_COLOR = new THREE.Color();

// =======================================================================================
// Palettes

/**
 * Colours of the Nubi-shaped cast, for <Nubi palette>. Nubi itself (the hero who puts the
 * costumes on) keeps no palette. Pair each with its costume: thanos → ThanosArmor (size 3),
 * spider → SpiderSuit, panther → PantherSuit, witch → WitchOutfit, groot → GrootLook,
 * starlord → StarLordOutfit, falcon → FalconOutfit, doom → DoomArmor; `outrider` is a spare
 * grey-violet minion palette.
 */
export const CAST = {
  thanos: { body: "#8C5BC4", legs: "#2B3B8F" },
  spider: { body: "#D9232E", fins: "#2457D6", legs: "#2457D6" },
  panther: { body: "#1F1E28", legs: "#18171F" },
  witch: { body: "#C81E45", legs: "#8A1031" },
  groot: { body: "#8B5A2F", fins: "#80522B", legs: "#6A4324", eyes: "#FFB21E", eyeGlow: 0.3 },
  starlord: { body: "#B65A3E", legs: "#4E2A20" },
  falcon: { body: "#8E99A6", fins: "#646E7B", legs: "#4D5662" },
  doom: { body: "#5A626D", fins: "#7B8693", legs: "#474E58" },
  outrider: { body: "#6F6A86", legs: "#3F3B52", eyes: "#FFE45C", eyeGlow: 0.6 },
} satisfies Record<string, NubiPalette>;

/** Body colours for ArmyCrowd: Thanos' minions and the heroes' armies (Wakanda, Asgard...). */
export const ARMY_COLORS = {
  villains: ["#6F6A86", "#5C5873", "#7D6A9E", "#4F566A", "#8C5BC4"],
  heroes: ["#3B3550", "#C9D2DC", "#D9232E", "#2457D6", "#E2A93B", "#2F9E5C", "#8E99A6"],
  wakanda: ["#2B2838", "#3B3550", "#6B4FA0", "#2B2838"],
  asgard: ["#C9D2DC", "#B8C2CC", "#D9A441", "#9AA4AF"],
};

// =======================================================================================
// The body's cross-section: a ring of points from the front centre towards +x (screen-right),
// round the back and back to the front centre, with outward normals. Arc length s runs the same
// way: s = x on the front face (x ≥ 0), the right side starts at s ≈ 5.34.

type RingPt = { x: number; z: number; nx: number; nz: number };

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
/** One texture tile per face (a quarter of the perimeter): a motif at x = 0 sits mid-face. */
const TILE = PERIMETER / 4;
const CORNER_ARC = (Math.PI / 2) * NUBI_BODY.r;
/** Arc length of the point at height z on the right side face. */
const sRight = (z: number) => NUBI_BODY.a - NUBI_BODY.r + CORNER_ARC + (NUBI_BODY.b - NUBI_BODY.r - z);

/** Point on the ring at arc length s (wraps). */
const ringAt = (s: number): RingPt => {
  const w = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  let i = 0;
  while (i < ARC.length - 2 && ARC[i + 1] < w) i++;
  const f = (w - ARC[i]) / Math.max(1e-6, ARC[i + 1] - ARC[i]);
  const a = RING[i];
  const b = RING[i + 1];
  const nx = a.nx + (b.nx - a.nx) * f;
  const nz = a.nz + (b.nz - a.nz) * f;
  const l = Math.hypot(nx, nz) || 1;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, nx: nx / l, nz: nz / l };
};

/** The ring rotated to start and end at the back centre (keeps seams at the back). */
const RING_BACK = (() => {
  const k = RING.findIndex((p) => Math.abs(p.x) < 1e-6 && p.z < 0);
  return [...RING.slice(k, RING.length - 1), ...RING.slice(0, k + 1)];
})();

/** 1 on the front face, fading to 0 round the front corners (0 on the sides and back). */
const frontness = (p: RingPt) => smooth(0.5, 0.97, p.nz);

/** Closed curve round the body at height y, offset t from the surface (trims, chains). */
const ringCurve = (y: number, t: number) =>
  new THREE.CatmullRomCurve3(
    RING_BACK.slice(0, -1)
      .filter((_, i) => i % 2 === 0)
      .map((p) => new THREE.Vector3(p.x + p.nx * t, y, p.z + p.nz * t)),
    true,
  );

// =======================================================================================
// Bands: sleeves round the body at a height range with the texture running round them.

type BandSpec = {
  y0: number;
  y1: number;
  /** Outward offset from the body at the bottom / top edge. */
  t0: number;
  t1: number;
  /** Extra outward puff at mid height. */
  bulge?: number;
  rows?: number;
  tiles?: number;
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
      pos.push(p.x + p.nx * t, s.y0 + H * v, p.z + p.nz * t);
      n.set(p.nx, -k, p.nz).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push((ARC[i] / PERIMETER) * tiles, v);
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
    const y = s.y0 + H * (row / rows);
    for (let i = 0; i < N; i++) {
      const p = RING[i];
      pos.push(p.x + p.nx * tOut, y, p.z + p.nz * tOut, p.x + p.nx * tIn, y, p.z + p.nz * tIn);
      nrm.push(0, up ? 1 : -1, 0, 0, up ? 1 : -1, 0);
      const u = (ARC[i] / PERIMETER) * tiles;
      uv.push(u, row / rows, u, row / rows);
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

/** Outward offset of a band's surface at height y. */
const bandT = (s: BandSpec, y: number) => {
  const v = (y - s.y0) / (s.y1 - s.y0);
  return s.t0 + (s.t1 - s.t0) * v + (s.bulge ?? 0) * Math.sin(Math.PI * v);
};
/** x rotation that lays a front-facing badge flat on a band's front at height y. */
const bandTilt = (s: BandSpec, y: number) => {
  const H = s.y1 - s.y0;
  const v = (y - s.y0) / H;
  return Math.atan((s.t1 - s.t0 + (s.bulge ?? 0) * Math.PI * Math.cos(Math.PI * v)) / H);
};
/** Where a badge sits on a band's front centre at height y (lift = gap above the surface). */
const onBand = (s: BandSpec, y: number, x = 0, lift = 0.02) => ({
  position: [x, y, NUBI_BODY.front + bandT(s, y) + lift] as V3,
  rotation: [bandTilt(s, y), 0, 0] as V3,
});

// =======================================================================================
// Head shells (helmets, caps, hoods): a wall round the body from a lower edge that can vary
// round the head (high over the face, lower at the sides) up to `wall`, then a dome.

type ShellPt = [number, number, number];
type ShellSpec = {
  /** Height of the lower edge at each point round the body. */
  low: (p: RingPt) => number;
  /** Top of the straight wall, where the dome starts curving in. */
  wall: number;
  /** Offset of the wall from the body. */
  t: number;
  /** Dome rings above the wall: [scale towards the centre, offset, y]. */
  dome: ShellPt[];
  wallRows?: number;
  /** Radius of a rolled rim along the lower edge (0 = none). */
  rim?: number;
};

const headShell = (s: ShellSpec) => {
  const N = RING_BACK.length;
  const W = s.wallRows ?? 5;
  const pos: number[] = [];
  const idx: number[] = [];
  const lows = RING_BACK.map(s.low);
  for (let j = 0; j <= W; j++) {
    RING_BACK.forEach((p, i) => {
      const y = lows[i] + (s.wall - lows[i]) * (j / W);
      pos.push(p.x + p.nx * s.t, y, p.z + p.nz * s.t);
    });
  }
  for (const [k, t, y] of s.dome) for (const p of RING_BACK) pos.push(p.x * k + p.nx * t, y, p.z * k + p.nz * t);
  const rows = W + 1 + s.dome.length;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      const B = A + N;
      idx.push(A, A + 1, B + 1, A, B + 1, B);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  shell.setIndex(idx);
  shell.computeVertexNormals();
  // Weld the normals along the seam at the back so it shades smoothly.
  const nrm = shell.attributes.normal as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let j = 0; j < rows; j++) {
    const a = j * N;
    const b = j * N + N - 1;
    n.set(nrm.getX(a) + nrm.getX(b), nrm.getY(a) + nrm.getY(b), nrm.getZ(a) + nrm.getZ(b)).normalize();
    nrm.setXYZ(a, n.x, n.y, n.z);
    nrm.setXYZ(b, n.x, n.y, n.z);
  }
  let rim: THREE.BufferGeometry | null = null;
  if (s.rim) {
    const pts = RING_BACK.slice(0, -1)
      .filter((_, i) => i % 2 === 0)
      .map((p) => new THREE.Vector3(p.x + p.nx * s.t, s.low(p), p.z + p.nz * s.t));
    rim = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, s.rim, 8, true);
  }
  return { shell, rim };
};

// =======================================================================================
// Wrapped plates: a thick panel following the body between two arc lengths (cheek flaps,
// straps, side armour), with a lower and upper edge that can vary along it.

type PlateSpec = {
  s0: number;
  s1: number;
  bottom: (f: number) => number;
  top: (f: number) => number;
  /** Gap between the body and the plate's inner face. */
  t: number;
  /** Thickness. */
  th: number;
  /** Extra outward lean by height (e.g. a flap flaring out above the head). */
  flare?: (y: number) => number;
  /** Backward (−z) sweep by height. */
  sweep?: (y: number) => number;
  cols?: number;
  rows?: number;
};

const wrapPlate = (o: PlateSpec) => {
  const cols = o.cols ?? 18;
  const rows = o.rows ?? 10;
  const flare = o.flare ?? (() => 0);
  const sweep = o.sweep ?? (() => 0);
  const ring = Array.from({ length: cols + 1 }, (_, i) => ringAt(o.s0 + ((o.s1 - o.s0) * i) / cols));
  const at = (i: number, j: number, off: number): V3 => {
    const f = i / cols;
    const p = ring[i];
    const y = o.bottom(f) + (o.top(f) - o.bottom(f)) * (j / rows);
    const d = o.t + flare(y) + off;
    return [p.x + p.nx * d, y, p.z + p.nz * d - sweep(y)];
  };
  const pos: number[] = [];
  const idx: number[] = [];
  const grid = (off: number, flip: boolean) => {
    const base = pos.length / 3;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push(...at(i, j, off));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = base + j * (cols + 1) + i;
        const b = a + 1;
        const c = a + cols + 1;
        const d = c + 1;
        if (flip) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
  };
  const strip = (pts: [number, number][], flip: boolean) => {
    const base = pos.length / 3;
    for (const [i, j] of pts) pos.push(...at(i, j, o.th), ...at(i, j, 0));
    for (let k = 0; k < pts.length - 1; k++) {
      const a = base + k * 2;
      if (flip) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  };
  grid(o.th, false);
  grid(0, true);
  strip(Array.from({ length: cols + 1 }, (_, i) => [i, 0]), false);
  strip(Array.from({ length: cols + 1 }, (_, i) => [i, rows]), true);
  strip(Array.from({ length: rows + 1 }, (_, j) => [0, j]), true);
  strip(Array.from({ length: rows + 1 }, (_, j) => [cols, j]), false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// =======================================================================================
// Flat shapes: rounded polygons extruded into soft toy plates (masks, badges, lenses).

type P2 = [number, number];

/** Adds a polygon with rounded corners (radius r, or one per corner) to a shape or a hole. */
const roundPath = <T extends THREE.Path>(target: T, pts: P2[], r: number | number[]) => {
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const rr = Array.isArray(r) ? r[i] : r;
    const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) || 1;
    const k0 = Math.min(rr, d0 / 2) / d0;
    const k2 = Math.min(rr, d2 / 2) / d2;
    const ax = p1[0] + (p0[0] - p1[0]) * k0;
    const ay = p1[1] + (p0[1] - p1[1]) * k0;
    if (i === 0) target.moveTo(ax, ay);
    else target.lineTo(ax, ay);
    target.quadraticCurveTo(p1[0], p1[1], p1[0] + (p2[0] - p1[0]) * k2, p1[1] + (p2[1] - p1[1]) * k2);
  }
  target.closePath();
  return target;
};
const roundShape = (pts: P2[], r: number | number[]) => roundPath(new THREE.Shape(), pts, r);
const roundHole = (pts: P2[], r: number | number[]) => roundPath(new THREE.Path(), pts, r);

/** Mirrors the right half of a symmetric outline (listed from the bottom centre up to the top centre). */
const mirrorHalf = (half: P2[]): P2[] => {
  const left = half
    .slice(1, -1)
    .reverse()
    .map(([x, y]) => [-x, y] as P2);
  return [...half, ...left];
};

/** Extruded plate: back face at z = 0, front at depth + 2 * bevel. */
const plate = (shape: THREE.Shape, depth: number, bevel: number, curveSegments = 10) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments,
  });
  g.translate(0, 0, bevel);
  return g;
};

/** Merges geometries into one (non-indexed, keeping only the listed attributes). */
const merge = (geos: THREE.BufferGeometry[], keep: string[] = ["position", "normal"]) => {
  const prepared = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!keep.includes(name)) n.deleteAttribute(name);
    n.clearGroups();
    return n;
  });
  return mergeGeometries(prepared, false)!;
};

/** Small round studs (rivets) at the given points, as one geometry. */
const rivets = (pts: V3[], r = 0.13) =>
  merge(
    pts.map((p) => {
      const g = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      g.rotateX(Math.PI / 2);
      g.translate(p[0], p[1], p[2]);
      return g;
    }),
  );

/** Tube along a curve whose radius tapers from r0 to r1 (branches, horns). */
const taperTube = (curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, segs = 16, radial = 8) => {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos: number[] = [];
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, p);
    const r = r0 + (r1 - r0) * t;
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let k = 0; k <= radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(p.x + r * (c * N.x + s * B.x), p.y + r * (c * N.y + s * B.y), p.z + r * (c * N.z + s * B.z));
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * (radial + 1) + k;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

// =======================================================================================
// Materials and textures

const metal = (color: string, side: THREE.Side = THREE.FrontSide) => toy(color, { metal: 0.55, rough: 0.3, glow: 0.2, side });
const goldMat = (side: THREE.Side = THREE.FrontSide) => toy(GOLD, { metal: 0.6, rough: 0.28, glow: 0.26, side });
const DS = THREE.DoubleSide;

const PX = 100;
type Ctx = CanvasRenderingContext2D;
type Painter = (ctx: Ctx, W: number, H: number) => void;

/** Fabric texture painted in model units (PX px per unit), wrapping round a band. */
const fabric = (key: string, w: number, h: number, paint: Painter) =>
  canvasTexture(
    `thanos-fabric|${key}`,
    w * PX,
    h * PX,
    (ctx) => {
      ctx.scale(PX, PX);
      paint(ctx, w, h);
    },
    { wrapS: true },
  );

const fabricMats = new Map<string, THREE.MeshStandardMaterial>();
/** Fabric material for a texture (an emissive map keeps the colours bright). Cached. */
const fabricMat = (tex: THREE.Texture, rough = 0.75, glow = 0.16, metalness = 0) => {
  const key = `${tex.uuid}|${rough}|${glow}|${metalness}`;
  let m = fabricMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      metalness,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });
    fabricMats.set(key, m);
  }
  return m;
};

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Glowing part: an unlit colour between `dark` (level 0) and `bright` (level 1). Per instance. */
const useLitMat = (dark: string, bright: string, level: number, opacity = 1) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true }), []);
  mat.color.set(dark).lerp(TMP_COLOR.set(bright), clamp01(level));
  mat.opacity = opacity;
  return mat;
};

/** Soft additive glow (a camera-facing sprite). */
const Halo: React.FC<{ color: string; size: number; opacity: number; position?: V3 }> = ({ color, size, opacity, position }) => {
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [color],
  );
  mat.opacity = clamp01(opacity);
  return <sprite material={mat} position={position} scale={[size, size, 1]} visible={opacity > 0.003 && size > 0.01} />;
};

/** Lens scale [x, y] from a Nubi pose, for masks that draw their own eyes (blink, eyeScale). */
const lensScale = (pose?: NubiPose): [number, number] => {
  const k = Math.max(0.85, Math.min(1.25, pose?.eyeScale ?? 1));
  return [k, k * Math.max(0.1, 1 - clamp01(pose?.blink ?? 0))];
};

// =======================================================================================
// Capes: a sheet hanging round the back from a top edge, rebuilt in place every frame.

type CapeSpec = {
  /** Height of the top edge. */
  top: number;
  /** Where the cape starts round the sides (radians from +x; larger = narrower). */
  phi0: number;
  /** Hem height at the back centre and at the two edges. */
  hemBack: number;
  hemSide: number;
  /** Squircle half-axes round the body at the top, and how much they grow to the hem. */
  A: number;
  B: number;
  grow: number;
  /** Squircle exponent at the top / at the hem (< 1 squarer, hugs the body's corners). */
  e0: number;
  e1: number;
  /** Soft vertical folds (count round the cape). */
  folds: number;
  cols?: number;
  rows?: number;
};

const squircle = (phi: number, A: number, B: number, e: number): [number, number] => {
  const c = Math.cos(phi);
  return [A * Math.sign(c) * Math.pow(Math.abs(c), e), -B * Math.pow(Math.abs(Math.sin(phi)), e)];
};

/** Cape point (u 0..1 from the screen-right edge round the back, v 0..1 top to hem). */
const capePoint = (s: CapeSpec, u: number, v: number, t: number, wind: number, out: THREE.Vector3) => {
  const phi = s.phi0 + (Math.PI - 2 * s.phi0) * u;
  const side = Math.abs(u - 0.5) * 2;
  const yBot = s.hemBack + (s.hemSide - s.hemBack) * side * side;
  const y0 = s.top + (yBot - s.top) * v;
  const [x0, z0] = squircle(phi, s.A + s.grow * v, s.B + s.grow * v, s.e0 + (s.e1 - s.e0) * v);
  const fold = 1 + 0.05 * v * Math.sin(u * Math.PI * s.folds);
  const x = x0 * fold;
  const z = z0 * fold - 0.05;
  const w = clamp01(wind);
  const len = Math.hypot(x, z) || 1;
  const ox = x / len;
  const oz = z / len;
  // Ripples travelling down the cape (bigger and faster with wind).
  const ph = t * (2.3 + 4.4 * w);
  const amp = (0.13 + 0.75 * w) * v;
  const r = amp * (0.7 * Math.sin(ph - v * 5.2 + u * 2.7) + 0.3 * Math.sin(ph * 0.61 + u * 8.3 - v * 1.6 + 1.1));
  // Wind swings the cape back (−z) round its top edge (at rest it just sways); the ripples
  // follow the swung sheet's normal so a streaming cape still waves up and down.
  const drop = s.top - y0;
  const beta = w * (0.5 + 0.62 * v) + 0.05 * Math.sin(t * 1.3 + u * 1.5);
  const cb = Math.cos(beta);
  const sb = Math.sin(beta);
  out.set(x + ox * r, s.top - drop * cb - oz * sb * r, z - drop * sb + oz * cb * r);
};

const useCape = (s: CapeSpec, t: number, wind: number) => {
  const cols = s.cols ?? 30;
  const rows = s.rows ?? 16;
  const geo = useMemo(() => {
    const idx: number[] = [];
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
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((cols + 1) * (rows + 1) * 3), 3));
    g.setIndex(idx);
    return g;
  }, [cols, rows]);
  useMemo(() => {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const v3 = new THREE.Vector3();
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        capePoint(s, i / cols, j / rows, t, wind, v3);
        p.setXYZ(j * (cols + 1) + i, v3.x, v3.y, v3.z);
      }
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }, [geo, s, t, wind, cols, rows]);
  return geo;
};

/** A fluttering cape: `outer` colour outside, `inner` lining inside. */
const Cape: React.FC<{ spec: CapeSpec; t: number; wind: number; outer: string; inner: string; rough?: number }> = ({
  spec,
  t,
  wind,
  outer,
  inner,
  rough = 0.7,
}) => {
  const geo = useCape(spec, t, wind);
  return (
    <group>
      <mesh geometry={geo} material={toy(outer, { rough, glow: 0.16, side: THREE.FrontSide })} castShadow />
      <mesh geometry={geo} material={toy(inner, { rough, glow: 0.14, side: THREE.BackSide })} />
    </group>
  );
};

// =======================================================================================
// Skins: a shell hugging the whole rounded body with a painted texture atlas (one region per
// face), for suits printed all over (web lines, bark, panther pattern). Painters work in model
// units with y down: front/back/side regions are 10 (8.8 for the side) x 7.4 with y = 0 at the
// top edge (model y 9.9); the side region has the front edge at x = 0; the top region is 10 x 8.8
// with the front edge at the bottom.

type SkinRegion = "front" | "back" | "side" | "top" | "bottom";
type SkinPainter = (ctx: Ctx, region: SkinRegion, w: number, h: number) => void;
const SKIN_PX = 64;
const SKIN_RECTS: Record<SkinRegion, [number, number, number, number]> = {
  front: [0.5, 0.5, 10, 7.4],
  back: [11.5, 0.5, 10, 7.4],
  side: [22.5, 0.5, 8.8, 7.4],
  top: [0.5, 8.9, 10, 8.8],
  bottom: [11.5, 8.9, 10, 8.8],
};
const SKIN_W = 31.8;
const SKIN_H = 18.2;

const skinGeometry = once(() => {
  const pad = 0.035;
  const g = new RoundedBoxGeometry(10 + 2 * pad, 7.4 + 2 * pad, 8.8 + 2 * pad, 5, 0.6 + pad).toNonIndexed();
  g.translate(0, 6.2, 0);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let tri = 0; tri < p.count; tri += 3) {
    let ax = 0;
    let ay = 0;
    let az = 0;
    for (let k = 0; k < 3; k++) {
      ax += n.getX(tri + k);
      ay += n.getY(tri + k);
      az += n.getZ(tri + k);
    }
    const m = Math.max(Math.abs(ax), Math.abs(ay), Math.abs(az));
    const region: SkinRegion =
      m === Math.abs(az) ? (az > 0 ? "front" : "back") : m === Math.abs(ax) ? "side" : ay > 0 ? "top" : "bottom";
    const [rx, ry, rw, rh] = SKIN_RECTS[region];
    for (let k = 0; k < 3; k++) {
      const x = p.getX(tri + k);
      const y = p.getY(tri + k);
      const z = p.getZ(tri + k);
      let lu = 0;
      let lv = 0;
      if (region === "front") [lu, lv] = [x + 5, 9.9 - y];
      else if (region === "back") [lu, lv] = [5 - x, 9.9 - y];
      else if (region === "side") [lu, lv] = [4.4 - z, 9.9 - y];
      else if (region === "top") [lu, lv] = [x + 5, z + 4.4];
      else [lu, lv] = [x + 5, 4.4 - z];
      lu = Math.max(0, Math.min(rw, lu));
      lv = Math.max(0, Math.min(rh, lv));
      uv[(tri + k) * 2] = (rx + lu) / SKIN_W;
      uv[(tri + k) * 2 + 1] = 1 - (ry + lv) / SKIN_H;
    }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
});

const skinMat = (key: string, paint: SkinPainter) =>
  fabricMat(
    canvasTexture(`thanos-skin|${key}`, SKIN_W * SKIN_PX, SKIN_H * SKIN_PX, (ctx) => {
      ctx.scale(SKIN_PX, SKIN_PX);
      for (const region of Object.keys(SKIN_RECTS) as SkinRegion[]) {
        const [rx, ry, rw, rh] = SKIN_RECTS[region];
        ctx.save();
        ctx.translate(rx, ry);
        ctx.beginPath();
        ctx.rect(-0.45, -0.45, rw + 0.9, rh + 0.9);
        ctx.clip();
        paint(ctx, region, rw, rh);
        ctx.restore();
      }
    }),
    0.42,
    0.14,
  );

const Skin: React.FC<{ name: string; paint: SkinPainter }> = ({ name, paint }) => (
  <mesh geometry={skinGeometry()} material={skinMat(name, paint)} castShadow />
);

// =======================================================================================
// Fin tips (for effects at the "hands")

const FIN_PIVOT = new THREE.Vector3(NUBI_BODY.a - 0.2, 5.0, 0.3);
/**
 * Where the tip of a fin is in model space for a given raise (the same value as NubiPose
 * finR / finL), side 1 = screen-right (finR), -1 = screen-left (finL). Matches Nubi's holdR/holdL.
 */
export const nubiFinTip = (raise: number, side: 1 | -1): V3 => {
  const v = new THREE.Vector3(...NUBI_FIN_TIP).applyEuler(new THREE.Euler(0, -0.12, raise * 0.55)).add(FIN_PIVOT);
  return [v.x * side, v.y, v.z];
};

// =======================================================================================
// Thanos: gold crown helmet with a crest and cheek flaps, grooved chin, navy suit with gold

const THANOS_NAVY = "#2B3B8F";
const THANOS_SKIN_DARK = shadeHex(CAST.thanos.body, -0.17, 0.02);
const THANOS_SUIT: BandSpec = { y0: 2.0, y1: 3.25, t0: 0.5, t1: 0.2, bulge: 0.05, rows: 5 };
const THANOS_LOW = (p: RingPt) => {
  const f = frontness(p);
  const peak = Math.max(0, 1 - Math.abs(p.x) / 1.3) * f;
  return 7.2 + (7.8 - 7.2) * f - 0.45 * peak;
};

const thanosGeos = once(() => {
  const helmet = headShell({
    low: THANOS_LOW,
    wall: 9.3,
    t: 0.3,
    rim: 0.2,
    dome: [
      [1, 0.32, 9.65],
      [0.985, 0.3, 10.05],
      [0.94, 0.26, 10.4],
      [0.84, 0.2, 10.66],
      [0.66, 0.13, 10.84],
      [0.4, 0.06, 10.94],
      [0, 0, 10.98],
    ],
  });
  // Crest: a rounded fin over the middle of the helmet, drawn side-on (z, y) and extruded in x.
  const crestPts: P2[] = [
    [4.5, 7.35],
    [5.08, 7.65],
    [5.15, 9.3],
    [4.75, 10.55],
    [3.55, 11.45],
    [1.5, 11.95],
    [-0.7, 11.9],
    [-2.8, 11.45],
    [-4.35, 10.6],
    [-5.1, 9.4],
    [-5.12, 8.2],
    [-4.6, 7.95],
    [-4.3, 9.6],
    [-3.0, 10.45],
    [-1.0, 10.85],
    [1.2, 10.85],
    [3.2, 10.45],
    [4.35, 9.4],
    [4.35, 7.7],
  ];
  const crest = plate(roundShape(crestPts, 0.5), 0.8, 0.2);
  crest.rotateY(-Math.PI / 2);
  crest.translate(0.6, 0, 0);
  // Cheek flaps wrap the front corners from the jaw up past the top, flaring out into horns.
  const flap = wrapPlate({
    s0: 3.8,
    s1: sRight(2.4),
    bottom: (f) => 3.75 + 1.1 * f,
    top: (f) => 9.3 + 1.9 * Math.exp(-(((f - 0.6) / 0.26) ** 2)),
    t: 0.36,
    th: 0.3,
    flare: (y) => Math.max(0, y - 9.5) * 0.4,
    sweep: (y) => Math.max(0, y - 9.5) * 0.85,
    cols: 22,
    rows: 16,
  });
  const ridge = new THREE.CapsuleGeometry(0.17, 0.95, 4, 10);
  const brow = new THREE.CapsuleGeometry(0.27, 1.45, 4, 12);
  brow.rotateZ(Math.PI / 2);
  const chestShape = roundShape(
    [
      [0, -0.6],
      [1.4, -0.3],
      [2.05, 0.5],
      [-2.05, 0.5],
      [-1.4, -0.3],
    ],
    0.18,
  );
  const pauldron = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  pauldron.rotateZ(-Math.PI / 2);
  return {
    helmet,
    crest,
    flap,
    ridge,
    brow,
    suit: bandGeometry(THANOS_SUIT),
    trim: new THREE.TubeGeometry(ringCurve(THANOS_SUIT.y1, bandT(THANOS_SUIT, THANOS_SUIT.y1)), 160, 0.13, 8, true),
    chest: plate(chestShape, 0.12, 0.08),
    gem: new THREE.SphereGeometry(0.3, 18, 12),
    pauldron,
    pauldronRim: new THREE.TorusGeometry(1, 0.12, 8, 32),
  };
});

const paintThanosSuit: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, THANOS_NAVY);
  // Quilted ribs.
  const n = 16;
  for (let i = 0; i < n; i++) rect(ctx, (i / n) * W, 0, 0.06, H, "rgba(10,18,60,0.45)");
  rect(ctx, 0, H - 0.16, W, 0.16, "#1C2766");
};

/**
 * Thanos (use with palette CAST.thanos, ideally at size 3 next to Nubi at size 2): a gold
 * crown-like helmet over the top of the head (front edge at y 7.8 with a small peak to 7.35,
 * above the eyes) with a chunky crest on top (up to y 12.15) and cheek flaps down the front corners
 * (|x| > 3.8, from the jaw at y 3.75) that sweep back into two horns past the top (≈ y 11.2), four chin
 * ridges under the eyes (|x| ≤ 1.2, y 3.2..4.4), heavy brows above the eyes and a navy suit band
 * (y 2..3.25) with a gold trim, a gold chest plate with a little gem, and round gold pauldrons
 * over the fins. `brow` -1..1 tilts the brows (1 = angry, 0 = flat, -1 = worried).
 * Thanos keeps his own (Nubi) eyes: no hideEyes.
 */
export const ThanosArmor: React.FC<{ brow?: number }> = ({ brow = 0.6 }) => {
  const g = thanosGeos();
  const goldDS = goldMat(DS);
  const skinDark = toy(THANOS_SKIN_DARK, { rough: 0.45, glow: 0.14 });
  const chest = onBand(THANOS_SUIT, 2.62);
  const tilt = 0.32 * Math.max(-1, Math.min(1, brow));
  return (
    <group>
      <mesh geometry={g.helmet.shell} material={goldDS} castShadow />
      {g.helmet.rim ? <mesh geometry={g.helmet.rim} material={goldDark()} /> : null}
      <mesh geometry={g.crest} material={goldMat()} castShadow />
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh geometry={g.flap} material={goldDS} castShadow />
          {/* Pauldron over the fin root. */}
          <group position={[4.98, 6.85, 0.3]}>
            <mesh geometry={g.pauldron} material={goldMat()} scale={[0.62, 0.9, 1.65]} castShadow />
            <mesh geometry={g.pauldronRim} material={goldDark()} rotation={[0, Math.PI / 2, 0]} scale={[1.65, 0.9, 1]} />
          </group>
        </group>
      ))}
      {/* Chin ridges and brows (skin, a shade darker). */}
      {[-1.05, -0.35, 0.35, 1.05].map((x) => (
        <mesh key={x} geometry={g.ridge} material={skinDark} position={[x, 3.82, 4.4]} scale={[1, 1 - Math.abs(x) * 0.12, 1]} />
      ))}
      {[1, -1].map((s) => (
        <mesh key={s} geometry={g.brow} material={skinDark} position={[s * 2.3, 7.2, 4.47]} rotation={[0, 0, s * tilt]} />
      ))}
      {/* Suit. */}
      <mesh geometry={g.suit} material={fabricMat(fabric("thanos-suit", TILE, THANOS_SUIT.y1 - THANOS_SUIT.y0, paintThanosSuit), 0.6)} castShadow />
      <mesh geometry={g.trim} material={goldMat()} />
      <group position={chest.position} rotation={chest.rotation}>
        <mesh geometry={g.chest} material={goldMat()} />
        <mesh geometry={g.gem} material={toy("#4AA8FF", { rough: 0.15, glow: 0.45 })} position={[0, 0.02, 0.3]} scale={[1, 0.8, 0.55]} />
      </group>
    </group>
  );
};

/** Top of Thanos' crest in model units (for effects above his head). */
export const THANOS_CREST_TOP: V3 = [0, 12.15, 1.0];

// =======================================================================================
// Thor: red cape, dark armour with six silver discs, silver winged helmet

const THOR_BAND: BandSpec = { y0: 2.0, y1: 4.3, t0: 0.5, t1: 0.12, bulge: 0.07, rows: 8 };
/** Cape shared by Thor (red), measured round the back: hem 0.55 at the back, 2.6 at the edges. */
export const CAPE_THOR: CapeSpec = {
  top: 7.3,
  phi0: 0.2,
  hemBack: 0.55,
  hemSide: 1.9,
  A: 5.5,
  B: 5.05,
  grow: 2.2,
  e0: 0.34,
  e1: 0.55,
  folds: 8,
};
const THOR_DISCS: [number, number][] = [
  [-2.55, 3.62],
  [0, 3.62],
  [2.55, 3.62],
  [-2.55, 2.64],
  [0, 2.64],
  [2.55, 2.64],
];

const thorGeos = once(() => {
  const feather = new THREE.SphereGeometry(1, 18, 12);
  feather.translate(0, 1, 0);
  return {
    band: bandGeometry(THOR_BAND),
    trim: new THREE.TubeGeometry(ringCurve(4.25, 0.15), 160, 0.08, 6, true),
    helmet: headShell({
      low: (p) => 7.4 + 0.85 * frontness(p),
      wall: 9.3,
      t: 0.3,
      rim: 0.19,
      dome: [
        [1, 0.32, 9.65],
        [0.985, 0.3, 10.1],
        [0.94, 0.26, 10.5],
        [0.84, 0.2, 10.82],
        [0.66, 0.13, 11.02],
        [0.4, 0.06, 11.13],
        [0, 0, 11.17],
      ],
    }),
    strap: wrapPlate({ s0: 3.95, s1: sRight(-3.2), bottom: () => 6.7, top: () => 7.45, t: 0.03, th: 0.16, cols: 24, rows: 2 }),
    disc: new THREE.SphereGeometry(0.56, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
    discRim: new THREE.TorusGeometry(0.52, 0.07, 8, 28),
    feather,
    boss: new THREE.SphereGeometry(0.42, 18, 12),
  };
});

const paintThorArmour: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, "#2F333D");
  // Quilted scale rows.
  for (let row = 0; row < 6; row++) {
    const y = 0.15 + row * 0.38;
    for (let i = 0; i < 18; i++) {
      const x = ((i + (row % 2) * 0.5) / 18) * W;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.ellipse(x, y, 0.22, 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  rect(ctx, 0, H - 0.14, W, 0.14, "#22252C");
};

const THOR_SILVER = "#D3DAE2";

/**
 * Thor's outfit for Nubi (mint, own eyes): a dark quilted armour band round the lower body
 * (y 2..4.3, top behind the eye bars) with six domed silver discs on the front (two rows of
 * three, all below y 4.2), a silver helmet over the top of the head (front edge at y 8.25, two
 * units above the eyes) with a white wing on each side pointing up and back, and a red cape
 * hanging from under the helmet round the back (CAPE_THOR), fluttering with `t` and `wind`, held
 * by red straps round the sides (y 6.7..7.45, above the fins) fastened with silver discs at the
 * front corners (x ±4.2, y 7.1, outside the eyes).
 */
export const ThorOutfit: React.FC<{ t: number; wind?: number }> = ({ t, wind = 0.25 }) => {
  const g = thorGeos();
  const silver = metal(THOR_SILVER);
  const feather = toy("#F4F7FA", { rough: 0.4, glow: 0.2 });
  return (
    <group>
      <mesh geometry={g.band} material={fabricMat(fabric("thor-armour", TILE, THOR_BAND.y1 - THOR_BAND.y0, paintThorArmour), 0.5)} castShadow />
      <mesh geometry={g.trim} material={silver} />
      {THOR_DISCS.map(([x, y]) => {
        const at = onBand(THOR_BAND, y, x, -0.04);
        return (
          <group key={`${x}|${y}`} position={at.position} rotation={at.rotation}>
            <mesh geometry={g.disc} material={silver} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]} />
            <mesh geometry={g.discRim} material={metal("#9AA5B1")} />
          </group>
        );
      })}
      {/* Cape straps round the sides, fastened with silver discs at the front corners. */}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh geometry={g.strap} material={toy("#D0182F", { rough: 0.7, glow: 0.16, side: DS })} />
          <group position={[4.2, 7.08, 4.62]}>
            <mesh geometry={g.disc} material={silver} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]} />
            <mesh geometry={g.discRim} material={metal("#9AA5B1")} />
          </group>
        </group>
      ))}
      <mesh geometry={g.helmet.shell} material={metal(THOR_SILVER, DS)} castShadow />
      {g.helmet.rim ? <mesh geometry={g.helmet.rim} material={metal("#A3AEBA")} /> : null}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]} position={[0, 0, 0]}>
          <group position={[5.35, 8.9, 0.7]}>
            <mesh geometry={g.boss} material={silver} scale={[0.75, 1.05, 1.05]} />
            {[0, 1, 2].map((k) => (
              <mesh
                key={k}
                geometry={g.feather}
                material={feather}
                rotation={[-0.32 - k * 0.45, 0, -0.38]}
                scale={[0.46, 1.6 - k * 0.22, 0.15]}
                position={[0.15, 0.05, -k * 0.14]}
              />
            ))}
          </group>
        </group>
      ))}
      <Cape spec={CAPE_THOR} t={t} wind={wind} outer="#D0182F" inner="#8E0B20" />
    </group>
  );
};

// =======================================================================================
// Shield hero (Cap): blue helmet with small white wings, blue top with a white star, stripes

const CAP_BLUE = "#2457D6";
const CAP_BAND: BandSpec = { y0: 2.0, y1: 4.3, t0: 0.5, t1: 0.12, bulge: 0.07, rows: 8 };

const starShape = (R: number, r: number) => {
  const pts: P2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return roundShape(pts, 0.05);
};

const capGeos = once(() => {
  // Wing decal: three feathers pointing back (+a = towards the back), drawn side-on.
  const wing = roundShape(
    [
      [-0.35, -0.45],
      [0.6, -0.55],
      [1.55, -0.5],
      [1.05, -0.2],
      [1.95, -0.05],
      [1.35, 0.22],
      [2.25, 0.48],
      [0.6, 0.62],
      [-0.35, 0.45],
    ],
    0.12,
  );
  const w = plate(wing, 0.1, 0.05);
  w.rotateY(Math.PI / 2);
  return {
    band: bandGeometry(CAP_BAND),
    helmet: headShell({
      low: (p) => 7.2 + 0.8 * frontness(p),
      wall: 9.3,
      t: 0.28,
      rim: 0.16,
      dome: [
        [1, 0.3, 9.65],
        [0.985, 0.28, 10.05],
        [0.94, 0.24, 10.42],
        [0.84, 0.19, 10.7],
        [0.66, 0.12, 10.9],
        [0.4, 0.06, 11.0],
        [0, 0, 11.04],
      ],
    }),
    wing: w,
    star: plate(starShape(0.66, 0.28), 0.08, 0.06),
  };
});

const paintCapTop: Painter = (ctx, W, H) => {
  const split = 1.3;
  rect(ctx, 0, 0, W, split, CAP_BLUE);
  rect(ctx, 0, 0, W, 0.09, "#1A44B0");
  rect(ctx, 0, split, W, 0.1, "#FFFFFF");
  const n = 22;
  for (let i = 0; i < n; i++) rect(ctx, (i / n) * W, split + 0.1, W / n + 0.003, H - split - 0.1, i % 2 ? "#FFFFFF" : "#D9232E");
  rect(ctx, 0, H - 0.1, W, 0.1, "#B51C26");
};

/**
 * Shield hero for Nubi (mint, own eyes): a blue helmet over the top of the head (front edge at
 * y 8.0, above the eyes; sides down to 7.2) with a small white wing on each side, and a band
 * round the lower body (y 2..4.3, top behind the eye bars): blue on top with a white star on the
 * chest (centre x 0, y 3.55, below and between the eyes), red and white stripes at the belly.
 */
export const CapOutfit: React.FC = () => {
  const g = capGeos();
  const star = onBand(CAP_BAND, 3.52);
  return (
    <group>
      <mesh geometry={g.band} material={fabricMat(fabric("cap-top", TILE, CAP_BAND.y1 - CAP_BAND.y0, paintCapTop), 0.6)} castShadow />
      <group position={star.position} rotation={star.rotation}>
        <mesh geometry={g.star} material={toy("#FFFFFF", { rough: 0.3, glow: 0.22 })} />
      </group>
      <mesh geometry={g.helmet.shell} material={toy(CAP_BLUE, { rough: 0.3, glow: 0.16, side: DS })} castShadow />
      {g.helmet.rim ? <mesh geometry={g.helmet.rim} material={toy("#1C47B8", { rough: 0.35 })} /> : null}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh geometry={g.wing} material={toy("#FFFFFF", { rough: 0.35, glow: 0.22 })} position={[5.2, 8.4, 2.0]} rotation={[0.2, -0.5, 0]} scale={1.3} />
        </group>
      ))}
    </group>
  );
};

// =======================================================================================
// Armor hero (Iron): red helmet, gold faceplate with glowing slit eyes, arc reactor

const IRON_RED = "#D3202C";
const IRON_GOLD = "#F2B33D";
const IRON_BAND: BandSpec = { y0: 2.0, y1: 3.8, t0: 0.5, t1: 0.18, bulge: 0.06, rows: 6 };
const IRON_EYE: P2[] = [
  [-0.95, -0.2],
  [0.82, -0.12],
  [1.06, 0.12],
  [0.9, 0.34],
  [-0.95, 0.1],
];
/** Arc reactor centre on the chest (model units); it faces +z, tilted back by IRON_REACTOR_TILT. */
export const IRON_REACTOR: V3 = [0, 2.95, NUBI_BODY.front + bandT(IRON_BAND, 2.95) + 0.05];
export const IRON_REACTOR_TILT = bandTilt(IRON_BAND, 2.95);

const ironGeos = once(() => {
  const face = roundShape(
    mirrorHalf([
      [0, 3.66],
      [1.25, 3.72],
      [2.5, 4.0],
      [3.65, 4.95],
      [4.2, 6.15],
      [4.2, 8.05],
      [3.9, 8.5],
      [0, 8.5],
    ]),
    0.32,
  );
  const eye = roundShape(IRON_EYE, 0.07);
  const recess = plate(eye, 0.04, 0.04);
  recess.scale(1.2, 1.45, 1);
  const line = (x0: number, y0: number, x1: number, y1: number, w = 0.09) => {
    const g = new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), w, 0.06);
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return g;
  };
  return {
    helmet: headShell({
      low: (p) => 6.95 + (8.55 - 6.95) * frontness(p),
      wall: 9.3,
      t: 0.3,
      rim: 0.19,
      dome: [
        [1, 0.32, 9.65],
        [0.985, 0.3, 10.05],
        [0.94, 0.26, 10.42],
        [0.84, 0.2, 10.7],
        [0.66, 0.13, 10.9],
        [0.4, 0.06, 11.0],
        [0, 0, 11.04],
      ],
    }),
    face: plate(face, 0.16, 0.07),
    eye: plate(eye, 0.05, 0.035),
    recess,
    lines: merge([
      line(-1.2, 4.55, 1.2, 4.55),
      line(-1.2, 4.6, -1.05, 4.05),
      line(1.2, 4.6, 1.05, 4.05),
      line(-2.75, 6.05, -2.15, 4.75),
      line(2.75, 6.05, 2.15, 4.75),
      line(-0.18, 8.35, -0.18, 7.2, 0.07),
      line(0.18, 8.35, 0.18, 7.2, 0.07),
    ]),
    band: bandGeometry(IRON_BAND),
    ear: new THREE.CylinderGeometry(1.0, 1.0, 0.24, 36),
    earIn: new THREE.CylinderGeometry(0.55, 0.62, 0.18, 30),
    ring: new THREE.TorusGeometry(0.6, 0.11, 10, 36),
    disc: new THREE.CylinderGeometry(0.6, 0.6, 0.12, 36),
    core: new THREE.CircleGeometry(0.44, 32),
    coreRing: new THREE.TorusGeometry(0.3, 0.05, 6, 28),
    shoulder: new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  };
});

const paintIronBody: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, IRON_RED);
  // Gold abdominal plates on the lower half, with seams.
  const top = 0.78;
  rect(ctx, 0, top, W, H - top, IRON_GOLD);
  rect(ctx, 0, top - 0.05, W, 0.05, "#8E1218");
  const n = 12;
  for (let i = 0; i < n; i++) rect(ctx, (i / n) * W + W / n / 2, top, 0.05, H - top, "#B9822A");
  rect(ctx, 0, top + (H - top) / 2, W, 0.05, "#B9822A");
  rect(ctx, 0, 0, W, 0.07, "#A5141D");
  rect(ctx, 0, H - 0.1, W, 0.1, "#A5141D");
};

/**
 * Armor hero for Nubi (scene passes hideEyes; Nubi stays mint round the armour): a red helmet over
 * the top of the head (front edge y 8.55, sides down to 6.95) with round red ear plates, a gold
 * faceplate over the face (|x| ≤ 4.2, y 3.66..8.5) with two glowing white-blue slit eyes (centres
 * x ±1.95, y 6.45), a red chest band with gold abdominal plates (y 2..3.8) and a glowing arc
 * reactor on the chest (IRON_REACTOR). `charge` 0..1 brightens the reactor (and the eyes a
 * little) for the beam; `pose` (the same one given to <Nubi>) makes the slit eyes blink / widen.
 */
export const IronOutfit: React.FC<{ charge?: number; pose?: NubiPose }> = ({ charge = 0, pose }) => {
  const g = ironGeos();
  const c = clamp01(charge);
  const eyeMat = useLitMat("#BFEFFF", "#FFFFFF", 0.4 + 0.6 * c);
  const coreMat = useLitMat("#9FE6FF", "#FFFFFF", 0.35 + 0.65 * c);
  const [sx, sy] = lensScale(pose);
  const red = toy(IRON_RED, { rough: 0.28, glow: 0.16 });
  const goldPlate = toy(IRON_GOLD, { metal: 0.55, rough: 0.28, glow: 0.22 });
  return (
    <group>
      <mesh geometry={g.helmet.shell} material={toy(IRON_RED, { rough: 0.28, glow: 0.16, side: DS })} castShadow />
      {g.helmet.rim ? <mesh geometry={g.helmet.rim} material={toy("#A9161F", { rough: 0.3 })} /> : null}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={[5.32, 7.75, 1.7]} rotation={[0, 0, -Math.PI / 2]}>
            <mesh geometry={g.ear} material={red} />
            <mesh geometry={g.earIn} material={goldPlate} position={[0, 0.12, 0]} />
          </group>
          {/* Red shoulder plate over the fin root. */}
          <mesh geometry={g.shoulder} material={red} position={[4.95, 6.75, 0.3]} rotation={[0, 0, -Math.PI / 2]} scale={[0.85, 0.55, 1.6]} castShadow />
        </group>
      ))}
      <mesh geometry={g.face} material={goldPlate} position={[0, 0, 4.4]} castShadow />
      <mesh geometry={g.lines} material={toy("#9A6418", { rough: 0.5 })} position={[0, 0, 4.69]} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * 1.95, 6.45, 4.62]} scale={[s * sx, sy, 1]}>
          <mesh geometry={g.recess} material={toy("#1A1F26", { rough: 0.5 })} position={[0, 0, 0.02]} />
          <mesh geometry={g.eye} material={eyeMat} position={[0, 0, 0.06]} />
        </group>
      ))}
      <Halo color="#9FE8FF" size={1.5 + 0.8 * c} opacity={0.25 + 0.35 * c} position={[1.95, 6.5, 5.0]} />
      <Halo color="#9FE8FF" size={1.5 + 0.8 * c} opacity={0.25 + 0.35 * c} position={[-1.95, 6.5, 5.0]} />
      {/* Chest. */}
      <mesh geometry={g.band} material={fabricMat(fabric("iron-body", TILE, IRON_BAND.y1 - IRON_BAND.y0, paintIronBody), 0.35, 0.18, 0.3)} castShadow />
      <group position={IRON_REACTOR} rotation={[IRON_REACTOR_TILT, 0, 0]}>
        <mesh geometry={g.disc} material={toy("#2A3440", { rough: 0.4 })} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.04]} />
        <mesh geometry={g.ring} material={metal("#C9D2DC")} />
        <mesh geometry={g.core} material={coreMat} position={[0, 0, 0.04]} />
        <mesh geometry={g.coreRing} material={toy("#E8FCFF", { glow: 0.9 })} position={[0, 0, 0.07]} />
        <Halo color="#7FDFFF" size={1.8 + 4.2 * c} opacity={0.35 + 0.6 * c} position={[0, 0, 0.3]} />
        <Halo color="#FFFFFF" size={0.8 + 1.6 * c} opacity={0.3 + 0.6 * c} position={[0, 0, 0.35]} />
      </group>
    </group>
  );
};

// =======================================================================================
// Mage (Strange): blue tunic, red cloak with a tall collar, golden amulet with a green glow

const STRANGE_TUNIC: BandSpec = { y0: 2.0, y1: 4.3, t0: 0.5, t1: 0.12, bulge: 0.07, rows: 8 };
export const CAPE_STRANGE: CapeSpec = {
  top: 7.55,
  phi0: 0.2,
  hemBack: 0.35,
  hemSide: 1.2,
  A: 5.5,
  B: 5.05,
  grow: 2.0,
  e0: 0.34,
  e1: 0.58,
  folds: 9,
};
/** Amulet centre on the chest (model units). */
export const STRANGE_AMULET: V3 = [0, 3.5, NUBI_BODY.front + bandT(STRANGE_TUNIC, 3.5) + 0.12];
const STRANGE_RED = "#C8102E";
const STRANGE_RED_IN = "#6E0A1A";

/** Tall stiff collar round the back of the head: a flared sheet from y 7.5 up to ≈ 11.6..12.7. */
const collarGeometry = () => {
  const cols = 28;
  const rows = 6;
  const phiC = 0.16;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const phi = phiC + (Math.PI - 2 * phiC) * u;
      const side = Math.abs(u - 0.5) * 2;
      const yTop = 11.5 + 1.25 * Math.pow(side, 3);
      const y = 7.4 + (yTop - 7.4) * v;
      const [x, z] = squircle(phi, 5.55 + 1.35 * v * v, 5.1 + 1.0 * v * v, 0.34 + 0.2 * v);
      pos.push(x, y, z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const d = a + cols + 1;
      const c = d + 1;
      idx.push(a, b, c, a, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const top: THREE.Vector3[] = [];
  for (let i = 0; i <= cols; i++) {
    const k = rows * (cols + 1) + i;
    top.push(new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]));
  }
  return { collar: g, edge: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(top), 80, 0.12, 6, false) };
};

const strangeGeos = once(() => {
  const lid = new THREE.TorusGeometry(0.42, 0.075, 8, 24, Math.PI);
  return {
    tunic: bandGeometry(STRANGE_TUNIC),
    ...collarGeometry(),
    disc: new THREE.CylinderGeometry(0.66, 0.66, 0.14, 36),
    ring: new THREE.TorusGeometry(0.66, 0.1, 10, 36),
    lid,
    gem: new THREE.SphereGeometry(0.26, 20, 14),
    clasp: new THREE.SphereGeometry(0.4, 18, 12),
  };
});

const paintTunic: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, "#22357E");
  // Wrap-over front panel: a lighter blue diagonal on each face.
  ctx.fillStyle = "#2D4FA8";
  ctx.beginPath();
  ctx.moveTo(-W * 0.05, 0);
  ctx.lineTo(W * 0.18, 0);
  ctx.lineTo(-W * 0.12, H);
  ctx.lineTo(-W * 0.4, H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.95, 0);
  ctx.lineTo(W * 1.18, 0);
  ctx.lineTo(W * 0.88, H);
  ctx.lineTo(W * 0.6, H);
  ctx.closePath();
  ctx.fill();
  // Sash belt with straps.
  rect(ctx, 0, 1.25, W, 0.5, "#B07A35");
  rect(ctx, 0, 1.25, W, 0.06, "#7A4E1E");
  rect(ctx, 0, 1.69, W, 0.06, "#7A4E1E");
  for (let i = 0; i < 6; i++) rect(ctx, ((i + 0.25) / 6) * W, 1.25, 0.14, 0.5, "#6A3F16");
  rect(ctx, 0, H - 0.12, W, 0.12, "#18275E");
};

/**
 * Mage for Nubi (mint, own eyes): a dark-blue wrap tunic round the lower body (y 2..4.3, top
 * behind the eye bars) with a golden-brown sash, the golden amulet with a soft green gem on the
 * chest (STRANGE_AMULET, below and between the eyes), and a red cloak (CAPE_STRANGE, hem almost
 * on the ground) whose tall stiff collar stands up behind the head and flares out (y 7.4 up to
 * 12.7 at its front tips, all of it behind z ≈ -2.4 so it never hides the face). `glow` 0..1
 * brightens the green gem. Cloak flutters with `t` / `wind`.
 */
export const StrangeOutfit: React.FC<{ t: number; wind?: number; glow?: number }> = ({ t, wind = 0.3, glow = 0.5 }) => {
  const g = strangeGeos();
  const k = clamp01(glow);
  const gemMat = useLitMat("#1F9E55", "#B6FFD0", 0.35 + 0.6 * k);
  const amuletGold = goldMat();
  return (
    <group>
      <mesh geometry={g.tunic} material={fabricMat(fabric("strange-tunic", TILE, STRANGE_TUNIC.y1 - STRANGE_TUNIC.y0, paintTunic), 0.7)} castShadow />
      <group position={STRANGE_AMULET} rotation={[bandTilt(STRANGE_TUNIC, 3.5), 0, 0]}>
        <mesh geometry={g.disc} material={amuletGold} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.06]} />
        <mesh geometry={g.ring} material={goldDark()} />
        <mesh geometry={g.lid} material={amuletGold} position={[0, 0, 0.06]} scale={[1.15, 0.62, 1]} />
        <mesh geometry={g.lid} material={amuletGold} position={[0, 0, 0.06]} rotation={[0, 0, Math.PI]} scale={[1.15, 0.62, 1]} />
        <mesh geometry={g.gem} material={gemMat} position={[0, 0, 0.08]} scale={[1, 1, 0.55]} />
        <Halo color="#3DFF8F" size={1.6 + 1.6 * k} opacity={0.18 + 0.4 * k} position={[0, 0, 0.35]} />
      </group>
      <Cape spec={CAPE_STRANGE} t={t} wind={wind} outer={STRANGE_RED} inner={STRANGE_RED_IN} />
      <mesh geometry={g.collar} material={toy(STRANGE_RED, { rough: 0.6, glow: 0.16, side: THREE.BackSide })} castShadow />
      <mesh geometry={g.collar} material={toy(STRANGE_RED_IN, { rough: 0.6, glow: 0.14, side: THREE.FrontSide })} />
      <mesh geometry={g.edge} material={toy("#E0283F", { rough: 0.5 })} />
      {[1, -1].map((s) => (
        <mesh key={s} geometry={g.clasp} material={amuletGold} position={[s * 5.55, 7.55, -2.2]} />
      ))}
    </group>
  );
};

// =======================================================================================
// Spider: web lines all round the red body, black spider emblem, big white lenses

const WEB_INK = "#151217";

/** Spider web radiating from (cx, cy): spokes and sagging rings. */
const drawWeb = (ctx: Ctx, cx: number, cy: number, spokes: number, rings: number[], lw: number, rot = 0) => {
  ctx.strokeStyle = WEB_INK;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const R = 14;
  for (let k = 0; k < spokes; k++) {
    const a = rot + (k / spokes) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  for (const r of rings) {
    ctx.beginPath();
    for (let k = 0; k <= spokes; k++) {
      const a0 = rot + (k / spokes) * Math.PI * 2;
      const a1 = rot + ((k + 1) / spokes) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      if (k === 0) ctx.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
      if (k < spokes) ctx.quadraticCurveTo(cx + Math.cos(am) * r * 0.86, cy + Math.sin(am) * r * 0.86, cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    ctx.stroke();
  }
};

const drawSpiderEmblem = (ctx: Ctx, x: number, y: number, k: number) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.strokeStyle = WEB_INK;
  ctx.fillStyle = WEB_INK;
  ctx.lineWidth = 0.09;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of [-1, 1]) {
    const legs: P2[][] = [
      [
        [0.1, -0.15],
        [0.5, -0.5],
        [0.65, -0.95],
      ],
      [
        [0.14, -0.05],
        [0.68, -0.22],
        [0.98, -0.6],
      ],
      [
        [0.14, 0.08],
        [0.68, 0.24],
        [0.98, 0.62],
      ],
      [
        [0.1, 0.18],
        [0.5, 0.52],
        [0.62, 0.98],
      ],
    ];
    for (const leg of legs) {
      ctx.beginPath();
      ctx.moveTo(s * leg[0][0], leg[0][1]);
      ctx.lineTo(s * leg[1][0], leg[1][1]);
      ctx.lineTo(s * leg[2][0], leg[2][1]);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(0, 0.12, 0.2, 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -0.34, 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const paintSpider: SkinPainter = (ctx, region, w, h) => {
  rect(ctx, -1, -1, w + 2, h + 2, CAST.spider.body);
  const rings = [0.75, 1.55, 2.45, 3.45, 4.55, 5.75, 7.05];
  if (region === "front") {
    drawWeb(ctx, 5, 4.3, 16, rings, 0.075, Math.PI / 16);
    drawSpiderEmblem(ctx, 5, 6.5, 0.95);
  } else if (region === "back") {
    drawWeb(ctx, 5, 3.4, 14, rings, 0.075);
    drawSpiderEmblem(ctx, 5, 5.6, 1.25);
  } else if (region === "side") {
    drawWeb(ctx, 4.4, 3.5, 14, rings, 0.075);
  } else if (region === "top") {
    drawWeb(ctx, 5, 4.4, 16, rings, 0.075, Math.PI / 16);
  }
};

/** Spider lens: a teardrop whose round end is at the outer top and whose point is at the inner bottom. */
const spiderLensShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-1.15, -0.8);
  s.bezierCurveTo(-1.05, 0.2, -0.35, 0.95, 0.45, 0.95);
  s.bezierCurveTo(1.15, 0.95, 1.35, 0.25, 1.05, -0.35);
  s.bezierCurveTo(0.75, -0.95, -0.35, -1.0, -1.15, -0.8);
  return s;
};

const spiderGeos = once(() => {
  const outline = plate(spiderLensShape(), 0.1, 0.04, 24);
  outline.translate(-0.08, 0, 0);
  outline.scale(1.2, 1.24, 1);
  outline.translate(0.08, 0, 0);
  return { outline, lens: plate(spiderLensShape(), 0.1, 0.05, 24) };
});

/** Lens centres of the Spider mask (model units, the screen-right one; mirror x for the other). */
export const SPIDER_LENS: V3 = [2.3, 5.75, 4.45];

/**
 * Spider suit (use with palette CAST.spider and hideEyes): black web lines printed all round the
 * red body (radiating from between the lenses on the face, from the middle of each side, the back
 * and the top; fins and legs stay blue from the palette), a small black spider on the chest (and a
 * bigger one on the back) and big white lenses with thick black outlines (centres x ±2.3, y 5.75).
 * `pose` (the same one given to <Nubi>): blink narrows the lenses, eyeScale widens them.
 */
export const SpiderSuit: React.FC<{ pose?: NubiPose }> = ({ pose }) => {
  const g = spiderGeos();
  const [sx, sy] = lensScale(pose);
  return (
    <group>
      <Skin name="spider" paint={paintSpider} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * SPIDER_LENS[0], SPIDER_LENS[1], SPIDER_LENS[2]]} scale={[s * sx, sy, 1]}>
          <mesh geometry={g.outline} material={toy(WEB_INK, { rough: 0.35, glow: 0.05 })} />
          <mesh geometry={g.lens} material={toy("#F8FAFC", { rough: 0.15, glow: 0.32 })} position={[0, 0, 0.06]} />
        </group>
      ))}
    </group>
  );
};

// =======================================================================================
// Panther: black suit with silver lines and a claw necklace, small ears, white lenses

const PANTHER_BLACK = CAST.panther.body;
const PANTHER_SILVER = "#C9D0DA";
const PANTHER_PURPLE = "#A66BFF";
/** The necklace runs round the body at y 3.95 and dips into a V on the chest (to 3.35). */
const NECK_Y = 3.95;
const neckY = (x: number, front: number) => NECK_Y - 0.6 * front * Math.max(0, 1 - Math.abs(x) / 4.6);

const paintPanther: SkinPainter = (ctx, region, w, h) => {
  rect(ctx, -1, -1, w + 2, h + 2, PANTHER_BLACK);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const line = (pts: P2[], color: string, lw: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  // Faint triangle weave everywhere.
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 0.03;
  for (let x = -2; x < w + 2; x += 0.9) {
    ctx.beginPath();
    ctx.moveTo(x, -1);
    ctx.lineTo(x + h + 2, h + 1);
    ctx.moveTo(x, h + 1);
    ctx.lineTo(x + h + 2, -1);
    ctx.stroke();
  }
  const neck = 9.9 - NECK_Y;
  if (region === "front") {
    const v = (x: number) => 9.9 - neckY(x - 5, 1);
    // Mask: a ridge down the forehead and brows sweeping over the lenses.
    line([[5, 0.3], [5, 3.0]], PANTHER_SILVER, 0.06);
    for (const s of [-1, 1]) {
      line([[5 + s * 0.25, 2.9], [5 + s * 1.6, 2.55], [5 + s * 3.4, 2.75], [5 + s * 4.4, 3.4]], PANTHER_SILVER, 0.06);
      line([[5 + s * 0.6, 2.2], [5 + s * 2.4, 1.6], [5 + s * 4.6, 1.9]], PANTHER_PURPLE, 0.05);
      line([[5 + s * 3.7, 4.0], [5 + s * 3.9, 5.3]], PANTHER_SILVER, 0.05);
    }
    // Chest: chevrons following the necklace's V.
    for (let k = 0; k < 2; k++) {
      const d = 0.42 + k * 0.36;
      line([[0.2, v(0.2) + d], [5, v(5) + d], [9.8, v(9.8) + d]], k ? PANTHER_PURPLE : PANTHER_SILVER, 0.055);
    }
  } else if (region === "side" || region === "back") {
    line([[-0.5, neck + 0.6], [w / 2, neck + 1.2], [w + 0.5, neck + 0.6]], PANTHER_SILVER, 0.05);
    line([[-0.5, neck + 1.1], [w / 2, neck + 1.7], [w + 0.5, neck + 1.1]], PANTHER_PURPLE, 0.045);
    line([[w / 2, 0.4], [w / 2, neck - 0.6]], "rgba(201,208,218,0.6)", 0.04);
  } else if (region === "top") {
    line([[5, 8.8], [5, 1.2]], PANTHER_SILVER, 0.06);
    line([[3.0, 8.8], [2.2, 3.5]], PANTHER_PURPLE, 0.045);
    line([[7.0, 8.8], [7.8, 3.5]], PANTHER_PURPLE, 0.045);
  }
};

const pantherLensShape = () => {
  const s = new THREE.Shape();
  s.moveTo(-1.12, -0.22);
  s.quadraticCurveTo(-0.15, 0.72, 1.2, 0.42);
  s.quadraticCurveTo(0.35, -0.68, -1.12, -0.22);
  return s;
};

const pantherGeos = once(() => {
  const claw = (w: number, l: number) =>
    plate(
      roundShape(
        [
          [-w / 2, 0],
          [w / 2, 0],
          [0.04, -l],
          [-0.02, -l],
        ],
        [0.05, 0.05, 0.1, 0.02],
      ),
      0.05,
      0.035,
      6,
    );
  const small = claw(0.3, 0.46);
  const claws: THREE.BufferGeometry[] = [];
  const n = 30;
  for (let i = 0; i < n; i++) {
    const p = ringAt((i / n) * PERIMETER);
    const g = (i === 0 ? claw(0.46, 0.78) : small).clone();
    g.rotateX(-0.15);
    g.rotateY(Math.atan2(p.nx, p.nz));
    g.translate(p.x + p.nx * 0.12, neckY(p.x, frontness(p)) - 0.04, p.z + p.nz * 0.12);
    claws.push(g);
  }
  const chainPts = RING_BACK.slice(0, -1)
    .filter((_, i) => i % 2 === 0)
    .map((p) => new THREE.Vector3(p.x + p.nx * 0.12, neckY(p.x, frontness(p)), p.z + p.nz * 0.12));
  const outline = plate(pantherLensShape(), 0.08, 0.04, 20);
  outline.scale(1.16, 1.3, 1);
  const ear = roundShape(
    [
      [-0.75, 0],
      [0.75, 0],
      [0.08, 1.35],
    ],
    [0.2, 0.2, 0.22],
  );
  const earIn = roundShape(
    [
      [-0.38, 0.18],
      [0.38, 0.18],
      [0.05, 0.92],
    ],
    0.1,
  );
  return {
    claws: merge(claws),
    chain: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chainPts, true), 200, 0.09, 6, true),
    outline,
    lens: plate(pantherLensShape(), 0.1, 0.05, 20),
    ear: plate(ear, 0.4, 0.1),
    earIn: plate(earIn, 0.04, 0.03),
  };
});

/**
 * Panther suit (use with palette CAST.panther and hideEyes): fine silver and purple lines printed
 * over the near-black body (mask ridges on the face, chevrons on the chest), a silver necklace of
 * small claws round the body (y 3.95, dipping into a V on the chest to 3.35 with a bigger claw in
 * the middle), two small pointed ears on top (x ±3.3) and
 * white cat-eye lenses outlined in silver (centres x ±2.2, y 5.85). `pose` blinks / widens them.
 */
export const PantherSuit: React.FC<{ pose?: NubiPose }> = ({ pose }) => {
  const g = pantherGeos();
  const [sx, sy] = lensScale(pose);
  const silver = metal(PANTHER_SILVER);
  return (
    <group>
      <Skin name="panther" paint={paintPanther} />
      <mesh geometry={g.chain} material={silver} />
      <mesh geometry={g.claws} material={toy("#C3CAD3", { metal: 0.65, rough: 0.28, glow: 0.18 })} />
      {[1, -1].map((s) => (
        <group key={s}>
          <group position={[s * 2.2, 5.85, 4.44]} scale={[s * sx, sy, 1]}>
            <mesh geometry={g.outline} material={silver} />
            <mesh geometry={g.lens} material={toy("#F6F8FB", { rough: 0.15, glow: 0.4 })} position={[0, 0, 0.05]} />
          </group>
          <group position={[s * 3.25, 9.55, 1.2]} rotation={[-0.1, 0, -s * 0.2]} scale={1.15}>
            <mesh geometry={g.ear} material={toy(PANTHER_BLACK, { rough: 0.42, glow: 0.14 })} position={[0, 0, -0.3]} castShadow />
            <mesh geometry={g.earIn} material={toy(PANTHER_PURPLE, { rough: 0.4, glow: 0.35 })} position={[0, 0, 0.29]} />
          </group>
        </group>
      ))}
    </group>
  );
};

// =======================================================================================
// Witch: pointed tiara, long coat, red hex energy at the fin tips

export const CAPE_WITCH: CapeSpec = {
  top: 7.7,
  phi0: 0.08,
  hemBack: 0.12,
  hemSide: 0.5,
  A: 5.5,
  B: 5.1,
  grow: 2.1,
  e0: 0.34,
  e1: 0.6,
  folds: 11,
  cols: 34,
  rows: 18,
};

const witchGeos = once(() => {
  // Centre piece: a point down onto the forehead and a tall point up over the head.
  const centre = roundShape(
    [
      [0, -0.82],
      [0.72, 0],
      [0.95, 0.38],
      [0.42, 1.2],
      [0.1, 3.3],
      [-0.1, 3.3],
      [-0.42, 1.2],
      [-0.95, 0.38],
      [-0.72, 0],
    ],
    [0.08, 0.15, 0.15, 0.35, 0.06, 0.06, 0.35, 0.15, 0.15],
  );
  // Side prongs sweeping up and out like horns.
  const horn = roundShape(
    [
      [-0.5, 0],
      [0.55, 0],
      [0.85, 0.9],
      [1.0, 1.9],
      [0.95, 2.75],
      [0.62, 2.05],
      [0.25, 1.4],
      [-0.1, 1.0],
    ],
    [0.12, 0.12, 0.35, 0.3, 0.04, 0.3, 0.3, 0.2],
  );
  return {
    circlet: bandGeometry({ y0: 8.25, y1: 8.8, t0: 0.14, t1: 0.14, bulge: 0.04, rows: 3 }),
    centre: plate(centre, 0.14, 0.06),
    horn: plate(horn, 0.12, 0.06),
    gem: new THREE.SphereGeometry(0.26, 18, 12),
  };
});

/** Red hex energy: a glowing core with swirling wisps and sparks. Centred at the origin. */
export const HexGlow: React.FC<{ hex: number; t: number; color?: string }> = ({ hex, t, color = "#FF2D55" }) => {
  const geos = useMemo(
    () => ({
      wisp: new THREE.TorusGeometry(1, 0.09, 6, 40, Math.PI * 1.3),
      spark: new THREE.SphereGeometry(0.16, 8, 6),
    }),
    [],
  );
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [color],
  );
  const k = clamp01(hex);
  mat.opacity = 0.9 * k;
  if (k <= 0.001) return null;
  return (
    <group scale={0.5 + 0.5 * k}>
      <Halo color={color} size={8} opacity={0.75 * k} />
      <Halo color={color} size={4} opacity={0.9 * k} />
      <Halo color="#FFD6DE" size={1.8} opacity={k} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          geometry={geos.wisp}
          material={mat}
          rotation={[t * (1.7 + i * 0.6) + i * 2.1, t * (1.1 + i * 0.4) + i, t * 2.3 + i * 1.7]}
          scale={1.1 + i * 0.3}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = t * (2.6 + (i % 3) * 0.7) + i * 0.8;
        const r = 1.6 + 0.5 * Math.sin(t * 3.1 + i * 2.3);
        return <mesh key={i} geometry={geos.spark} material={mat} position={[Math.cos(a) * r, Math.sin(a * 1.3) * r * 0.7, Math.sin(a) * r * 0.6]} />;
      })}
    </group>
  );
};

/**
 * Scarlet witch (use with palette CAST.witch, own eyes): a dark-red tiara above the eyes (circlet
 * y 8.25..8.8 round the head, a point down onto the forehead to y 7.5, a tall central point up to
 * y 11.65 and two side points up to y 11.05), a
 * long wine-red coat hanging round the back almost to the ground (CAPE_WITCH, fluttering with
 * `t` / `wind`) and `hex` 0..1 red energy glowing at both fin tips. Pass the pose's finL / finR so
 * the glow follows the fins (or put <HexGlow> in holdR / holdL instead and leave hex at 0).
 */
export const WitchOutfit: React.FC<{ t: number; wind?: number; hex?: number; finL?: number; finR?: number }> = ({
  t,
  wind = 0.3,
  hex = 0,
  finL = 0,
  finR = 0,
}) => {
  const g = witchGeos();
  const tiara = toy("#7C0B25", { metal: 0.45, rough: 0.28, glow: 0.2 });
  return (
    <group>
      <mesh geometry={g.circlet} material={tiara} />
      <mesh geometry={g.centre} material={tiara} position={[0, 8.35, 4.5]} castShadow />
      <mesh geometry={g.gem} material={toy("#FF4D6D", { rough: 0.12, glow: 0.5 })} position={[0, 8.55, 4.8]} scale={[0.8, 1.0, 0.45]} />
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh geometry={g.horn} material={tiara} position={[2.2, 8.32, 4.47]} castShadow />
        </group>
      ))}
      <Cape spec={CAPE_WITCH} t={t} wind={wind} outer="#7A0E2B" inner="#C2203F" rough={0.6} />
      {hex > 0 ? (
        <>
          <group position={nubiFinTip(finR, 1)}>
            <HexGlow hex={hex} t={t} />
          </group>
          <group position={nubiFinTip(finL, -1)}>
            <HexGlow hex={hex} t={t + 1.7} />
          </group>
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Groot: bark grain all over, little branches with leaves on top

const BARK = CAST.groot.body;
const BARK_DARK = "#5A3818";
const BARK_LIGHT = "#A8743F";

const paintBark: SkinPainter = (ctx, region, w, h) => {
  rect(ctx, -1, -1, w + 2, h + 2, BARK);
  const rnd = mulberry(region.length * 97 + 13);
  ctx.lineCap = "round";
  // Eyes on the face push the grain round them.
  const eyes: P2[] = region === "front" ? [[2.7, 4.4], [7.3, 4.4]] : [];
  const bend = (x: number, y: number): P2 => {
    let px = x;
    for (const [ex, ey] of eyes) {
      const dx = x - ex;
      const dy = (y - ey) * 0.75;
      const d = Math.hypot(dx, dy);
      if (d < 1.6) px += (dx >= 0 ? 1 : -1) * (1.6 - d) * 0.7;
    }
    return [px, y];
  };
  const along = region === "top" || region === "bottom";
  const len = along ? h : h;
  for (let i = 0; i < 46; i++) {
    const x0 = rnd() * (w + 1) - 0.5;
    const phase = rnd() * 6;
    const amp = 0.08 + rnd() * 0.12;
    const dark = rnd() < 0.62;
    ctx.strokeStyle = dark ? BARK_DARK : BARK_LIGHT;
    ctx.globalAlpha = dark ? 0.75 : 0.5;
    ctx.lineWidth = dark ? 0.06 + rnd() * 0.07 : 0.05 + rnd() * 0.05;
    ctx.beginPath();
    for (let y = -0.4; y <= len + 0.4; y += 0.2) {
      const [px, py] = bend(x0 + Math.sin(y * 1.2 + phase) * amp, y);
      if (y === -0.4) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Knots.
  const knots = region === "front" ? 1 : 2;
  for (let k = 0; k < knots; k++) {
    const x = region === "front" ? 8.3 : 1.5 + rnd() * (w - 3);
    const y = region === "front" ? 1.3 : 1.5 + rnd() * (h - 3);
    ctx.fillStyle = BARK_DARK;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.32, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BARK_LIGHT;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.5, 0.75, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (region === "front") {
    // A brow ridge over the eyes.
    ctx.strokeStyle = BARK_DARK;
    ctx.lineWidth = 0.14;
    ctx.globalAlpha = 0.8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(5 + s * 1.3, 2.7);
      ctx.quadraticCurveTo(5 + s * 2.4, 2.25, 5 + s * 3.5, 2.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
};

type Branch = { pts: V3[]; r: number; leaves: { at: V3; rot: V3; s: number }[] };
const BRANCHES: Branch[] = [
  {
    pts: [
      [-2.4, 9.6, 0.6],
      [-2.7, 10.9, 0.85],
      [-3.5, 12.0, 0.7],
    ],
    r: 0.34,
    leaves: [
      { at: [-3.55, 12.05, 0.7], rot: [0.3, 0.2, 0.7], s: 1 },
      { at: [-3.0, 11.45, 0.85], rot: [-0.2, 0.4, -0.6], s: 0.8 },
    ],
  },
  {
    pts: [
      [0.3, 9.6, 1.1],
      [0.15, 11.4, 1.5],
      [0.55, 12.9, 1.3],
    ],
    r: 0.4,
    leaves: [
      { at: [0.6, 12.95, 1.3], rot: [0.2, 0.1, -0.3], s: 1.15 },
      { at: [0.0, 12.3, 1.5], rot: [-0.1, -0.5, 0.9], s: 0.9 },
      { at: [0.45, 11.7, 1.45], rot: [0.2, 0.6, -1.0], s: 0.75 },
    ],
  },
  {
    pts: [
      [2.6, 9.6, -0.6],
      [3.05, 10.8, -0.5],
      [3.95, 11.6, -0.85],
    ],
    r: 0.3,
    leaves: [
      { at: [4.0, 11.65, -0.85], rot: [0.1, -0.3, -0.9], s: 0.95 },
      { at: [3.35, 11.05, -0.5], rot: [-0.3, 0.2, 0.5], s: 0.7 },
    ],
  },
  {
    pts: [
      [-0.9, 9.6, -2.3],
      [-1.2, 10.7, -2.6],
      [-0.85, 11.5, -3.3],
    ],
    r: 0.26,
    leaves: [{ at: [-0.85, 11.55, -3.3], rot: [-0.5, 0.2, 0.3], s: 0.85 }],
  },
];

const grootGeos = once(() => {
  const leaf = new THREE.SphereGeometry(1, 14, 8);
  leaf.scale(0.62, 0.15, 0.34);
  leaf.translate(0.5, 0, 0);
  return {
    branches: merge(BRANCHES.map((b) => taperTube(new THREE.CatmullRomCurve3(b.pts.map((p) => new THREE.Vector3(...p))), b.r, b.r * 0.35, 14, 8))),
    leaf,
  };
});

/**
 * Groot (use with palette CAST.groot, own amber eyes): bark grain printed all over the body (the
 * grain bends round the eyes, with a brow ridge and a knot) and four little branches sprouting from
 * the top (up to y ≈ 13) with green leaves. `t` (seconds) makes the leaves sway a little.
 */
export const GrootLook: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const g = grootGeos();
  const wood = toy(shadeHex(BARK, -0.05), { rough: 0.8, glow: 0.12 });
  const leafA = toy("#62C24A", { rough: 0.5, glow: 0.18 });
  const leafB = toy("#3F9E3A", { rough: 0.5, glow: 0.16 });
  return (
    <group>
      <Skin name="groot" paint={paintBark} />
      <mesh geometry={g.branches} material={wood} castShadow />
      {BRANCHES.flatMap((b, i) =>
        b.leaves.map((l, k) => (
          <group key={`${i}-${k}`} position={l.at} rotation={[l.rot[0], l.rot[1], l.rot[2] + 0.12 * Math.sin(t * 2.1 + i * 1.3 + k)]}>
            <mesh geometry={g.leaf} material={(i + k) % 2 ? leafB : leafA} scale={l.s * 1.25} castShadow />
          </group>
        )),
      )}
    </group>
  );
};

// =======================================================================================
// Star-Lord: dark helmet-mask with glowing red lenses and silver cheek ridges, leather jacket

const SL_JACKET: BandSpec = { y0: 2.0, y1: 4.0, t0: 0.5, t1: 0.16, bulge: 0.07, rows: 7 };
const SL_METAL = "#454B54";
const SL_LENS: P2[] = [
  [-0.95, -0.12],
  [-0.75, -0.6],
  [0.85, -0.58],
  [1.3, 0.0],
  [1.12, 0.62],
  [-0.9, 0.38],
];

const starlordGeos = once(() => {
  const mask = roundShape(
    mirrorHalf([
      [0, 3.82],
      [2.1, 3.85],
      [3.55, 4.6],
      [4.05, 6.0],
      [3.95, 8.35],
      [0, 8.35],
    ]),
    0.42,
  );
  const lens = roundShape(SL_LENS, 0.32);
  const frame = plate(lens, 0.08, 0.05);
  frame.scale(1.14, 1.2, 1);
  const rib = new RoundedBoxGeometry(1.3, 0.2, 0.22, 2, 0.08);
  const ribs: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const g = rib.clone();
      g.rotateZ(s * (0.32 - k * 0.04));
      g.translate(s * (2.75 + k * 0.06), 4.5 + k * 0.42, 0);
      ribs.push(g);
    }
  }
  const slot = new RoundedBoxGeometry(1.25, 0.12, 0.1, 1, 0.04);
  return {
    helmet: headShell({
      low: (p) => 6.9 + (8.2 - 6.9) * frontness(p),
      wall: 9.3,
      t: 0.28,
      rim: 0.17,
      dome: [
        [1, 0.3, 9.65],
        [0.985, 0.28, 10.05],
        [0.94, 0.24, 10.42],
        [0.84, 0.19, 10.7],
        [0.66, 0.12, 10.9],
        [0.4, 0.06, 11.0],
        [0, 0, 11.04],
      ],
    }),
    mask: plate(mask, 0.18, 0.07),
    frame,
    lens: plate(lens, 0.08, 0.05),
    ribs: merge(ribs),
    vent: new RoundedBoxGeometry(1.7, 0.85, 0.16, 2, 0.12),
    slots: merge([-0.22, 0, 0.22].map((y) => slot.clone().translate(0, y, 0))),
    ear: new THREE.CylinderGeometry(0.95, 0.95, 0.3, 32),
    earIn: new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24),
    band: bandGeometry(SL_JACKET),
  };
});

const paintJacket: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, "#7A2A1C");
  // Leather panels: darker seams and a collar row.
  for (let i = 0; i < 4; i++) rect(ctx, (i / 4) * W + W * 0.38, 0, 0.06, H, "#55190F");
  rect(ctx, 0, 0, W, 0.34, "#5E1E13");
  rect(ctx, 0, 0.34, W, 0.05, "#3E120A");
  rect(ctx, 0, H * 0.62, W, 0.05, "#55190F");
  // Stitches.
  ctx.fillStyle = "rgba(255,210,170,0.35)";
  for (let x = 0; x < W; x += 0.22) ctx.fillRect(x, H * 0.62 + 0.12, 0.1, 0.03);
  rect(ctx, 0, H - 0.12, W, 0.12, "#4A150C");
};

/**
 * Star-Lord (use with palette CAST.starlord and hideEyes): a dark metal helmet over the top of the
 * head with silver ear discs, a mask over the face (|x| ≤ 4.05, y 3.82..8.35) with two big glowing
 * red lenses (centres x ±2.05, y 6.45) in silver frames, three silver ridges on each cheek and a
 * mouth vent, and a red-brown leather jacket band (y 2..4). `glow` 0..1 lens brightness; `pose`
 * (the same one given to <Nubi>) blinks / widens the lenses.
 */
export const StarLordOutfit: React.FC<{ pose?: NubiPose; glow?: number }> = ({ pose, glow = 1 }) => {
  const g = starlordGeos();
  const k = clamp01(glow);
  const lensMat = useLitMat("#5A0B0B", "#FF3A2E", 0.35 + 0.65 * k);
  const [sx, sy] = lensScale(pose);
  const dark = toy(SL_METAL, { metal: 0.45, rough: 0.35, glow: 0.14 });
  const silver = metal("#C9D0D8");
  return (
    <group>
      <mesh geometry={g.helmet.shell} material={toy(SL_METAL, { metal: 0.45, rough: 0.35, glow: 0.14, side: DS })} castShadow />
      {g.helmet.rim ? <mesh geometry={g.helmet.rim} material={silver} /> : null}
      <mesh geometry={g.mask} material={dark} position={[0, 0, 4.4]} castShadow />
      <mesh geometry={g.ribs} material={silver} position={[0, 0, 4.72]} />
      <mesh geometry={g.vent} material={silver} position={[0, 4.35, 4.72]} />
      <mesh geometry={g.slots} material={toy("#1A1D22", { rough: 0.6 })} position={[0, 4.35, 4.79]} />
      {[1, -1].map((s) => (
        <group key={s}>
          <group position={[s * 2.05, 6.45, 4.66]} scale={[s * sx, sy, 1]}>
            <mesh geometry={g.frame} material={silver} />
            <mesh geometry={g.lens} material={lensMat} position={[0, 0, 0.05]} />
          </group>
          <Halo color="#FF3B2F" size={2.4} opacity={0.3 * k * sy} position={[s * 2.1, 6.45, 5.1]} />
          <group position={[s * 5.32, 6.6, 1.0]} rotation={[0, 0, -s * Math.PI / 2]}>
            <mesh geometry={g.ear} material={silver} />
            <mesh geometry={g.earIn} material={dark} position={[0, 0.12, 0]} />
          </group>
        </group>
      ))}
      <mesh geometry={g.band} material={fabricMat(fabric("starlord-jacket", TILE, SL_JACKET.y1 - SL_JACKET.y0, paintJacket), 0.55)} castShadow />
    </group>
  );
};

// =======================================================================================
// Falcon: red goggles over the eyes, metal wings on the back that open

const FALCON_FRAME = "#2C3138";
const FALCON_BAND: BandSpec = { y0: 2.0, y1: 3.55, t0: 0.5, t1: 0.16, bulge: 0.06, rows: 6 };
const VISOR: P2[] = mirrorHalf([
  [0, 4.95],
  [1.05, 4.28],
  [2.75, 4.18],
  [3.9, 4.75],
  [4.3, 5.8],
  [4.15, 6.85],
  [0, 6.98],
]);
/** Wing feathers: length of each, from the leading (top) feather down. */
const FEATHERS = [9.8, 9.1, 8.3, 7.5, 6.6, 5.7, 4.8];
/** Shoulder pivot of the screen-right wing (mirror x for the other). */
export const FALCON_WING_PIVOT: V3 = [2.6, 8.6, -5.75];

const falconGeos = once(() => {
  const outer = roundShape(VISOR, 0.35);
  const inner = VISOR.map(([x, y]) => [x * 0.9, 5.6 + (y - 5.6) * 0.8] as P2);
  outer.holes.push(roundHole(inner, 0.3));
  const lens = new THREE.ShapeGeometry(roundShape(inner, 0.3), 12);
  const glint = new THREE.ShapeGeometry(
    roundShape(
      [
        [-3.2, 6.25],
        [-2.2, 6.45],
        [-2.55, 6.6],
        [-3.3, 6.45],
      ],
      0.08,
    ),
  );
  // Broad metal feathers (base at the origin, pointing +x) that overlap into a solid fan.
  const feathers = FEATHERS.map((L, k) => {
    const w0 = 1.9 - k * 0.05;
    const w1 = 1.6 - k * 0.06;
    return plate(
      roundShape(
        [
          [0, -w0 / 2],
          [L * 0.8, -w1 / 2],
          [L, -0.05],
          [L * 0.86, w1 / 2],
          [0, w0 / 2],
        ],
        [0.3, 0.35, 0.25, 0.35, 0.3],
      ),
      0.08,
      0.05,
      6,
    );
  });
  const chevron = roundShape(
    [
      [0, -0.55],
      [1.5, 0.35],
      [1.5, 0.75],
      [0, -0.12],
      [-1.5, 0.75],
      [-1.5, 0.35],
    ],
    0.08,
  );
  return {
    frame: plate(outer, 0.12, 0.05, 16),
    lens,
    glint,
    strap: wrapPlate({ s0: 4.45, s1: PERIMETER - 4.45, bottom: () => 6.3, top: () => 7.05, t: 0.04, th: 0.12, cols: 90, rows: 1 }),
    band: bandGeometry(FALCON_BAND),
    chevron: plate(chevron, 0.06, 0.04),
    pack: new RoundedBoxGeometry(6.6, 5.4, 1.5, 3, 0.5),
    joint: new THREE.CylinderGeometry(0.55, 0.55, 0.9, 20),
    feathers,
    stripe: plate(
      roundShape(
        [
          [0, -0.2],
          [2.6, -0.14],
          [3.0, 0.05],
          [2.6, 0.2],
          [0, 0.2],
        ],
        0.08,
      ),
      0.03,
      0.02,
      6,
    ),
  };
});

const paintFalconSuit: Painter = (ctx, W, H) => {
  rect(ctx, 0, 0, W, H, "#3A414B");
  rect(ctx, 0, 0, W, 0.08, "#262B32");
  rect(ctx, 0, H * 0.55, W, 0.12, "#D9232E");
  rect(ctx, 0, H - 0.1, W, 0.1, "#262B32");
};

/**
 * Falcon (use with palette CAST.falcon, own eyes): red goggles over the eyes (a translucent red
 * visor in a dark frame, |x| ≤ 4.3, y 4.2..7.0, so Nubi's eyes show through and still blink) with
 * a strap round the head (y 6.3..7.05), a dark flight-suit band (y 2..3.55) with a red stripe and
 * a red chevron on the chest, and a backpack with two metal wings (seven broad feathers each, the
 * top one with a red stripe). `open` 0..1: 0 = folded short on the backpack, 0.5 = slid out,
 * 1 = fanned wide open (≈ 23 units across, tips up to y ≈ 12);
 * `flap` -1..1 adds a wing beat.
 */
export const FalconOutfit: React.FC<{ open?: number; flap?: number }> = ({ open = 0, flap = 0 }) => {
  const g = falconGeos();
  const lensMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#FF2A2A",
        roughness: 0.08,
        emissive: new THREE.Color("#FF1A1A"),
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
      }),
    [],
  );
  // The feathers slide out of the pack first, then fan open.
  const ext = 0.42 + 0.58 * smooth(0, 0.6, clamp01(open));
  const o = smooth(0.15, 1, clamp01(open));
  const steel = toy("#B5BFCA", { metal: 0.6, rough: 0.3, glow: 0.2 });
  const steelDark = toy("#8C97A3", { metal: 0.6, rough: 0.3, glow: 0.18 });
  const chest = onBand(FALCON_BAND, 2.95);
  return (
    <group>
      <mesh geometry={g.frame} material={toy(FALCON_FRAME, { rough: 0.35, glow: 0.1 })} position={[0, 0, 4.72]} castShadow />
      <mesh geometry={g.lens} material={lensMat} position={[0, 0, 4.86]} />
      <mesh geometry={g.glint} material={toy("#FFFFFF", { glow: 0.8 })} position={[0, 0, 4.88]} />
      <mesh geometry={g.strap} material={toy(FALCON_FRAME, { rough: 0.5, glow: 0.1, side: DS })} />
      <mesh geometry={g.band} material={fabricMat(fabric("falcon-suit", TILE, FALCON_BAND.y1 - FALCON_BAND.y0, paintFalconSuit), 0.5)} castShadow />
      <group position={chest.position} rotation={chest.rotation}>
        <mesh geometry={g.chevron} material={toy("#E0262F", { rough: 0.35, glow: 0.2 })} />
      </group>
      <mesh geometry={g.pack} material={toy("#3A414B", { rough: 0.45, glow: 0.1 })} position={[0, 6.9, -5.0]} castShadow />
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <group position={FALCON_WING_PIVOT}>
            <mesh geometry={g.joint} material={steelDark} rotation={[Math.PI / 2, 0, 0]} />
            {FEATHERS.map((L, k) => {
              // Folded: stacked almost straight down the back. Open: fanned out sideways.
              const closed = -1.52 + 0.03 * k;
              const spread = 0.36 - 0.19 * k;
              const a = closed + (spread - closed) * o + flap * 0.3 * o * (1 + 0.12 * k);
              return (
                <group key={k} rotation={[0, 0, a]} position={[0, 0, -0.2 - k * 0.1]} scale={[ext, 1, 1]}>
                  <mesh geometry={g.feathers[k]} material={k % 2 ? steelDark : steel} castShadow />
                  {k === 0 ? <mesh geometry={g.stripe} material={toy("#E0262F", { rough: 0.35, glow: 0.2 })} position={[L - 3.3, 0.12, 0.17]} /> : null}
                  {k === 0 ? <mesh geometry={g.stripe} material={toy("#E0262F", { rough: 0.35, glow: 0.2 })} position={[L - 3.3, 0.12, -0.03]} rotation={[Math.PI, 0, 0]} /> : null}
                </group>
              );
            })}
          </group>
        </group>
      ))}
    </group>
  );
};

// =======================================================================================
// Doctor Doom: riveted metal mask with eye slits and glowing green eyes, green hooded cloak

const DOOM_STEEL = "#A9B3BE";
const DOOM_GREEN = "#1F5A33";
const DOOM_GREEN_IN = "#12361F";
const DOOM_TUNIC: BandSpec = { y0: 2.0, y1: 3.3, t0: 0.5, t1: 0.22, bulge: 0.05, rows: 5 };
export const CAPE_DOOM: CapeSpec = {
  top: 7.0,
  phi0: 0.28,
  hemBack: 0.35,
  hemSide: 1.6,
  A: 5.6,
  B: 5.15,
  grow: 1.6,
  e0: 0.34,
  e1: 0.58,
  folds: 9,
};
/** Glowing eye centres behind Doom's slits (screen-right; mirror x). */
export const DOOM_EYE: V3 = [1.85, 6.4, 4.47];
const DOOM_SLIT: P2[] = [
  [0.9, 6.18],
  [2.8, 6.36],
  [2.8, 6.76],
  [0.9, 6.56],
];

const doomGeos = once(() => {
  const mask = roundShape(
    mirrorHalf([
      [0, 3.22],
      [2.95, 3.25],
      [3.75, 4.1],
      [3.85, 8.85],
      [0, 8.85],
    ]),
    0.38,
  );
  mask.holes.push(roundHole(DOOM_SLIT, 0.1));
  mask.holes.push(roundHole(DOOM_SLIT.map(([x, y]) => [-x, y] as P2).reverse(), 0.1));
  mask.holes.push(
    roundHole(
      [
        [-1.2, 4.0],
        [1.2, 4.0],
        [1.2, 4.48],
        [-1.2, 4.48],
      ],
      0.12,
    ),
  );
  const brow = roundShape(
    [
      [-3.6, 7.18],
      [-0.6, 6.98],
      [0, 6.8],
      [0.6, 6.98],
      [3.6, 7.18],
      [3.6, 7.72],
      [-3.6, 7.72],
    ],
    [0.12, 0.2, 0.15, 0.2, 0.12, 0.1, 0.1],
  );
  const nose = roundShape(
    [
      [-0.38, 4.95],
      [0.38, 4.95],
      [0.2, 6.7],
      [-0.2, 6.7],
    ],
    0.12,
  );
  const bars = merge([-0.8, -0.4, 0, 0.4, 0.8].map((x) => new THREE.BoxGeometry(0.14, 0.5, 0.14).translate(x, 4.24, 0)));
  const studs: V3[] = [];
  for (const s of [-1, 1]) {
    for (const y of [3.95, 4.75, 5.55, 6.35]) studs.push([s * 3.4, y, 0]);
    studs.push([s * 2.4, 3.6, 0]);
  }
  for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) studs.push([x, 8.35, 0]);
  const browStuds: V3[] = [-3.1, 3.1].map((x) => [x, 7.45, 0]);
  const side = wrapPlate({ s0: 3.98, s1: sRight(2.05), bottom: () => 3.3, top: () => 6.35, t: 0.04, th: 0.2, cols: 14, rows: 4 });
  const sideStuds: V3[] = [];
  for (const y of [3.65, 6.0]) {
    for (const s of [4.3, 6.6]) {
      const p = ringAt(s);
      sideStuds.push([p.x + p.nx * 0.24, y, p.z + p.nz * 0.24]);
    }
  }
  const glow = new THREE.CircleGeometry(0.5, 24);
  return {
    mask: plate(mask, 0.2, 0.07, 12),
    backing: new THREE.PlaneGeometry(7.0, 3.4),
    brow: plate(brow, 0.14, 0.06),
    nose: plate(nose, 0.18, 0.08),
    bars,
    studs: rivets(studs, 0.13),
    browStuds: rivets(browStuds, 0.12),
    side,
    sideStuds: rivets(sideStuds, 0.12),
    grooves: merge(
      [-1, 1].map((s) => {
        const g = new THREE.BoxGeometry(0.08, 1.7, 0.05);
        g.rotateZ(s * 0.08);
        g.translate(s * 2.55, 4.55, 0);
        return g;
      }),
    ),
    glow,
    hood: headShell({
      low: (p) => 6.6 + (8.72 - 6.6) * frontness(p) * smooth(4.55, 3.85, Math.abs(p.x)),
      wall: 9.3,
      t: 0.5,
      rim: 0.3,
      dome: [
        [1, 0.52, 9.75],
        [0.975, 0.5, 10.35],
        [0.92, 0.45, 10.85],
        [0.8, 0.37, 11.25],
        [0.6, 0.26, 11.55],
        [0.35, 0.14, 11.72],
        [0, 0, 11.78],
      ],
    }),
    tunic: bandGeometry(DOOM_TUNIC),
    belt: bandGeometry({ y0: 2.5, y1: 2.88, t0: 0.46, t1: 0.42, rows: 2 }),
    buckle: new THREE.CylinderGeometry(0.42, 0.42, 0.14, 28),
    buckleRing: new THREE.TorusGeometry(0.42, 0.07, 8, 28),
  };
});

/**
 * Doctor Doom (use with palette CAST.doom and hideEyes): a riveted steel mask over the face
 * (|x| ≤ 3.85, y 3.22..8.85) with a heavy V brow, a nose ridge, two eye slits (centres x ±1.85,
 * y 6.45) and a barred mouth slot; glowing green eyes behind the slits; a dark-green hood over the
 * top of the head framing the mask (rolled edge, peak at y 11.8) that becomes a cape at the back
 * (CAPE_DOOM, fluttering with `t` / `wind`); steel side plates with rivets beside the mask and a
 * green tunic with a belt and a round brass buckle. `eyeGlow` 0..1: 0 = dark slits, 1 = bright
 * green glow (the reveal). `pose` (the same given to <Nubi>): lookX / lookY move the glowing eyes
 * along the slits, blink narrows them, eyeScale sizes them.
 */
export const DoomArmor: React.FC<{ t: number; wind?: number; eyeGlow?: number; pose?: NubiPose }> = ({
  t,
  wind = 0.2,
  eyeGlow = 1,
  pose,
}) => {
  const g = doomGeos();
  const e = clamp01(eyeGlow);
  const eyeMat = useLitMat("#0B120D", "#7CFF8A", e);
  const steel = toy(DOOM_STEEL, { metal: 0.6, rough: 0.32, glow: 0.16 });
  const steelDark = toy("#7E8893", { metal: 0.6, rough: 0.35, glow: 0.14 });
  const [sx, sy] = lensScale(pose);
  const lx = Math.max(-1, Math.min(1, pose?.lookX ?? 0)) * 0.42;
  const ly = Math.max(-1, Math.min(1, pose?.lookY ?? 0)) * 0.05;
  return (
    <group>
      {/* Dark backing seen through the slits, the glowing eyes and the mask. */}
      <mesh geometry={g.backing} material={toy("#07090B", { rough: 0.9, glow: 0 })} position={[0, 5.6, 4.425]} />
      {[1, -1].map((s) => (
        <group key={s} position={[s * DOOM_EYE[0] + lx, DOOM_EYE[1] + ly, DOOM_EYE[2]]} rotation={[0, 0, s * 0.095]}>
          <mesh geometry={g.glow} material={eyeMat} scale={[1.55 * sx, 0.36 * sy, 1]} />
        </group>
      ))}
      <mesh geometry={g.mask} material={steel} position={[0, 0, 4.42]} castShadow />
      <mesh geometry={g.bars} material={steelDark} position={[0, 0, 4.6]} />
      <mesh geometry={g.brow} material={steel} position={[0, 0, 4.68]} castShadow />
      <mesh geometry={g.nose} material={steel} position={[0, 0, 4.68]} />
      <mesh geometry={g.grooves} material={toy("#4E5660", { rough: 0.5 })} position={[0, 0, 4.77]} />
      <mesh geometry={g.studs} material={steelDark} position={[0, 0, 4.76]} />
      <mesh geometry={g.browStuds} material={steelDark} position={[0, 0, 4.98]} />
      {e > 0 ? (
        <>
          <Halo color="#5CFF6E" size={2.6 * e} opacity={0.75 * e} position={[DOOM_EYE[0] + lx, DOOM_EYE[1], 5.2]} />
          <Halo color="#5CFF6E" size={2.6 * e} opacity={0.75 * e} position={[-DOOM_EYE[0] + lx, DOOM_EYE[1], 5.2]} />
        </>
      ) : null}
      {[1, -1].map((s) => (
        <group key={s} scale={[s, 1, 1]}>
          <mesh geometry={g.side} material={toy(DOOM_STEEL, { metal: 0.6, rough: 0.32, glow: 0.16, side: DS })} />
          <mesh geometry={g.sideStuds} material={steelDark} />
        </group>
      ))}
      {/* Hood and cloak. */}
      <mesh geometry={g.hood.shell} material={toy(DOOM_GREEN, { rough: 0.8, glow: 0.14, side: DS })} castShadow />
      {g.hood.rim ? <mesh geometry={g.hood.rim} material={toy("#174A29", { rough: 0.8, glow: 0.12 })} castShadow /> : null}
      <Cape spec={CAPE_DOOM} t={t} wind={wind} outer={DOOM_GREEN} inner={DOOM_GREEN_IN} rough={0.8} />
      {/* Tunic and belt. */}
      <mesh geometry={g.tunic} material={toy(DOOM_GREEN, { rough: 0.8, glow: 0.14 })} castShadow />
      <mesh geometry={g.belt} material={toy("#4A3222", { rough: 0.6, glow: 0.12 })} />
      <group position={[0, 2.69, NUBI_BODY.front + 0.5]}>
        <mesh geometry={g.buckle} material={toy("#C99A3A", { metal: 0.6, rough: 0.3, glow: 0.2 })} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={g.buckleRing} material={toy("#8F6A22", { metal: 0.6, rough: 0.3 })} position={[0, 0, 0.07]} />
      </group>
    </group>
  );
};

// =======================================================================================
// Army crowd: many small simplified Nubi-like soldiers as two instanced meshes

/** Unit model (Nubi model units): coloured parts (body, legs, fins) take the instance colour. */
const crowdGeos = (helmet: string, crest: string, spears: boolean) => {
  const white = (g: THREE.BufferGeometry) => paintGeo(g, "#ffffff");
  const body = new RoundedBoxGeometry(10, 7.4, 8.8, 2, 0.75).translate(0, 6.2, 0);
  const legs: THREE.BufferGeometry[] = [];
  const LEG: [number, number, number][] = [
    [-1.3, 1.6, 0],
    [1.3, 1.6, 0],
    [-2.4, 1.2, -0.72],
    [2.4, 1.2, 0.72],
    [-2.6, -0.9, -1.72],
    [2.6, -0.9, 1.72],
  ];
  for (const [x, z, a] of LEG) {
    const g = new RoundedBoxGeometry(1.95, 2.6, 3.9, 1, 0.4);
    g.translate(0, 1.3, 1.95);
    g.rotateY(a);
    g.translate(x, 0, z);
    legs.push(g);
  }
  const fins = [-1, 1].map((s) => {
    const g = new RoundedBoxGeometry(2.6, 2.3, 2.6, 1, 0.5);
    g.translate(s * 6.0, 5.0, 0.3);
    return g;
  });
  const coloured = merge([body, ...legs, ...fins].map(white), ["position", "normal", "color"]);
  const paint = (g: THREE.BufferGeometry, c: string) => paintGeo(g, c);
  const fixed: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) fixed.push(paint(new RoundedBoxGeometry(1.05, 1.75, 0.5, 1, 0.2).translate(s * 2.3, 5.5, 4.45), "#151515"));
  const dome = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.scale(5.7, 2.5, 5.0);
  dome.translate(0, 9.0, 0);
  fixed.push(paint(dome, helmet));
  fixed.push(paint(new THREE.CylinderGeometry(5.75, 5.75, 0.6, 24, 1).scale(1, 1, 0.88).translate(0, 9.1, 0), shadeHex(helmet, -0.12)));
  fixed.push(paint(new RoundedBoxGeometry(0.9, 1.8, 6.4, 1, 0.35).translate(0, 11.35, -0.3), crest));
  if (spears) {
    fixed.push(paint(new THREE.CylinderGeometry(0.22, 0.22, 16, 6).translate(6.9, 7.0, 1.7), "#7A4E2A"));
    fixed.push(paint(new THREE.ConeGeometry(0.6, 1.9, 6).translate(6.9, 15.9, 1.7), "#DDE3EA"));
  }
  return { coloured, fixed: merge(fixed, ["position", "normal", "color"]) };
};

const crowdMat = once(() => vertexMat(0.45, false, 0.14));

type CrowdUnit = { x: number; z: number; color: number; phase: number; yaw: number; k: number; at: number };

/**
 * A cheap crowd of small Nubi-like soldiers (rounded body, two eyes, a helmet with a crest and an
 * optional spear) for wide shots of armies: two InstancedMeshes, geometry built once, only the
 * instance matrices change per frame. World units of the parent group.
 * - `positions` [x, z][] places one soldier at each point; otherwise `count` soldiers fill `area`
 *   [x0, z0, x1, z1] on a jittered grid (deterministic with `seed`).
 * - `colors`: body colours picked per soldier (see ARMY_COLORS); `helmet` / `crest` colours.
 * - `size`: body width of one soldier (like Nubi's size; default 0.9). `facing`: yaw (radians,
 *   0 = facing +z) with a little per-soldier jitter.
 * - `t` (seconds) and `march` 0..1: bobbing walk (hop, sway and squash, phase-shifted per soldier).
 * - `reveal` 0..1: soldiers pop in one by one in a seeded order (1 = all visible), handy for
 *   armies streaming out of portals.
 * - `shadow`: soft blob shadows under each soldier.
 */
export const ArmyCrowd: React.FC<{
  t: number;
  count?: number;
  positions?: [number, number][];
  area?: [number, number, number, number];
  colors?: string[];
  helmet?: string;
  crest?: string;
  spears?: boolean;
  march?: number;
  size?: number;
  seed?: number;
  facing?: number;
  reveal?: number;
  shadow?: boolean;
}> = ({
  t,
  count = 120,
  positions,
  area = [-20, -20, 20, 0],
  colors = ARMY_COLORS.villains,
  helmet = "#C9D2DC",
  crest = "#D9232E",
  spears = true,
  march = 1,
  size = 0.9,
  seed = 7,
  facing = 0,
  reveal = 1,
  shadow = true,
}) => {
  const [ax0, az0, ax1, az1] = area;
  const units = useMemo<CrowdUnit[]>(() => {
    const rnd = mulberry(seed);
    let pts: [number, number][];
    if (positions && positions.length) pts = positions;
    else {
      const w = Math.abs(ax1 - ax0) || 1;
      const d = Math.abs(az1 - az0) || 1;
      const cols = Math.max(1, Math.round(Math.sqrt((count * w) / d)));
      const rows = Math.max(1, Math.ceil(count / cols));
      const cw = (ax1 - ax0) / cols;
      const cd = (az1 - az0) / rows;
      pts = [];
      for (let i = 0; i < count; i++) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        pts.push([ax0 + (c + 0.5 + (rnd() - 0.5) * 0.55) * cw, az0 + (r + 0.5 + (rnd() - 0.5) * 0.55) * cd]);
      }
    }
    return pts.map(([x, z]) => ({
      x,
      z,
      color: Math.floor(rnd() * 1e6),
      phase: rnd() * Math.PI * 2,
      yaw: (rnd() - 0.5) * 0.25,
      k: 0.92 + rnd() * 0.16,
      at: rnd() * 0.96,
    }));
  }, [positions, count, ax0, az0, ax1, az1, seed]);
  const geos = useMemo(() => crowdGeos(helmet, crest, spears), [helmet, crest, spears]);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#000000", map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.32 }),
    [],
  );
  const shadowGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const fixedRef = useRef<THREE.InstancedMesh>(null);
  const shadowRef = useRef<THREE.InstancedMesh>(null);
  const n = units.length;
  useLayoutEffect(() => {
    const m = bodyRef.current;
    if (!m) return;
    const c = new THREE.Color();
    units.forEach((u, i) => m.setColorAt(i, c.set(colors[u.color % colors.length])));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [units, colors]);
  useLayoutEffect(() => {
    const mats = [bodyRef.current, fixedRef.current];
    const sh = shadowRef.current;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const mk = clamp01(march);
    units.forEach((u, i) => {
      // Pop in with a little overshoot (ease-out-back) once `reveal` passes this soldier's turn.
      const r = clamp01((reveal - u.at) / 0.04);
      const pop = r >= 1 ? 1 : 1 + 2.70158 * (r - 1) ** 3 + 1.70158 * (r - 1) ** 2;
      const s = (size / 10) * u.k * Math.max(0, pop);
      const ph = t * 7.5 + u.phase;
      const bob = mk * Math.abs(Math.sin(ph)) * 1.4;
      const squash = 1 + mk * 0.06 * Math.cos(ph * 2);
      e.set(0, facing + u.yaw, mk * 0.07 * Math.sin(ph));
      q.setFromEuler(e);
      p.set(u.x, bob * s, u.z);
      sc.set(s / Math.sqrt(squash), s * squash, s / Math.sqrt(squash));
      m4.compose(p, q, sc);
      for (const mesh of mats) mesh?.setMatrixAt(i, m4);
      if (sh) {
        const k = s * 15 * (1 - 0.04 * bob);
        m4.compose(p.set(u.x, 0.02, u.z), q.identity(), sc.set(k, 1, k * 0.85));
        sh.setMatrixAt(i, m4);
      }
    });
    for (const mesh of [...mats, sh]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  }, [units, t, march, size, facing, reveal]);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[geos.coloured, crowdMat(), n]} frustumCulled={false} castShadow />
      <instancedMesh ref={fixedRef} args={[geos.fixed, crowdMat(), n]} frustumCulled={false} />
      {shadow ? <instancedMesh ref={shadowRef} args={[shadowGeo, shadowMat, n]} frustumCulled={false} renderOrder={1} /> : null}
    </group>
  );
};

// =======================================================================================
// Anchors

/**
 * Highest point of each costume in model units (multiply by size / 10 for world units), for
 * placing effects or labels above the heads. Nubi's bare body top is 9.9.
 */
export const COSTUME_TOP = {
  thanos: 12.15,
  thor: 11.7,
  cap: 11.05,
  iron: 11.05,
  strange: 12.7,
  spider: 9.95,
  panther: 10.9,
  witch: 11.7,
  groot: 13.4,
  starlord: 11.05,
  /** Wings closed; with open = 1 the wing tips reach y ≈ 12 and x ≈ ±11.5. */
  falcon: 9.95,
  doom: 11.8,
};

/** Recommended sizes (body width in world units): Thanos looms over the size-2 heroes. */
export const CAST_SIZE = { thanos: 3, hero: 2 };
