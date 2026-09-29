import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry } from "../noise";
import { V3, canvasTexture, gold, goldDark, shadeHex, toy, useRounded, vertexMat } from "./kit";

// Inca costumes for Nubi. Every piece is in Nubi's model space (body 10 wide, y 2.5..9.9,
// front face z = +4.4) and is meant to be passed as a child of <Nubi>, so it follows the hop
// and squash. The eyes (x = ±2.3, y = 4.6..6.4 on the front face) are always left free.
// Held props (Pututu, Quipu, Chaquitaclla) are built for <Nubi holdR/holdL> (fin-tip space).

/** Nubi's body cross-section in model units (see Nubi.tsx). */
export const NUBI_BODY = { a: 5, b: 4.4, r: 0.6, bottom: 2.5, top: 9.9, front: 4.4 };

// ---------------------------------------------------------------------------------------
// Band geometry: a sleeve that wraps the rounded body at a height range, a little bigger than
// the body, with the texture running continuously around it (u = arc length).

type RingPt = { x: number; z: number; nx: number; nz: number };

/** Points around the body's rounded rectangle, from the front centre towards +x, with normals. */
const ringPath = (seg: number): RingPt[] => {
  const { a, b, r } = NUBI_BODY;
  const pts: RingPt[] = [{ x: 0, z: b, nx: 0, nz: 1 }];
  const corner = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i <= seg; i++) {
      const t = a0 + (a1 - a0) * (i / seg);
      pts.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t), nx: Math.cos(t), nz: Math.sin(t) });
    }
  };
  corner(a - r, b - r, Math.PI / 2, 0);
  corner(a - r, -(b - r), 0, -Math.PI / 2);
  corner(-(a - r), -(b - r), -Math.PI / 2, -Math.PI);
  corner(-(a - r), b - r, -Math.PI, -Math.PI * 1.5);
  pts.push({ x: 0, z: b, nx: 0, nz: 1 });
  return pts;
};

type BandSpec = {
  y0: number;
  y1: number;
  /** Outward offset from the body surface at the bottom / top edge. */
  t0: number;
  t1: number;
  /** Extra outward puff at mid height (soft fabric look). */
  bulge?: number;
  rows?: number;
  /** Texture repeats around the body; 4 = one tile centred on each face. */
  tiles?: number;
  /** How far the top / bottom caps reach into the body (< 0.6). */
  capTop?: number;
  capBottom?: number;
};

const bandGeometry = (s: BandSpec) => {
  const rows = s.rows ?? 6;
  const tiles = s.tiles ?? 4;
  const bulge = s.bulge ?? 0;
  const path = ringPath(10);
  const N = path.length;
  const H = s.y1 - s.y0;
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const tAt = (v: number) => s.t0 + (s.t1 - s.t0) * v + bulge * Math.sin(Math.PI * v);
  const slope = (v: number) => (s.t1 - s.t0 + bulge * Math.PI * Math.cos(Math.PI * v)) / H;
  const uRow = (t: number) => {
    const us = [0];
    let acc = 0;
    for (let i = 1; i < N; i++) {
      const p0 = path[i - 1];
      const p1 = path[i];
      acc += Math.hypot(p1.x + p1.nx * t - (p0.x + p0.nx * t), p1.z + p1.nz * t - (p0.z + p0.nz * t));
      us.push(acc);
    }
    return us.map((u) => (u / acc) * tiles);
  };
  const n = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const y = s.y0 + H * v;
    const t = tAt(v);
    const k = slope(v);
    const us = uRow(t);
    for (let i = 0; i < N; i++) {
      const p = path[i];
      pos.push(p.x + p.nx * t, y, p.z + p.nz * t);
      n.set(p.nx, -k, p.nz).normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(us[i], v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      idx.push(A, A + 1, A + N + 1, A, A + N + 1, A + N);
    }
  }
  const cap = (y: number, tOut: number, tIn: number, up: boolean, v: number) => {
    const base = pos.length / 3;
    const us = uRow(tOut);
    for (let i = 0; i < N; i++) {
      const p = path[i];
      pos.push(p.x + p.nx * tOut, y, p.z + p.nz * tOut, p.x + p.nx * tIn, y, p.z + p.nz * tIn);
      nrm.push(0, up ? 1 : -1, 0, 0, up ? 1 : -1, 0);
      uv.push(us[i], v, us[i], v);
    }
    for (let i = 0; i < N - 1; i++) {
      const o0 = base + i * 2;
      if (up) idx.push(o0, o0 + 2, o0 + 3, o0, o0 + 3, o0 + 1);
      else idx.push(o0, o0 + 3, o0 + 2, o0, o0 + 1, o0 + 3);
    }
  };
  cap(s.y1, tAt(1), -(s.capTop ?? 0.3), true, 1);
  cap(s.y0, tAt(0), -(s.capBottom ?? 0.5), false, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
};

// ---------------------------------------------------------------------------------------
// Woven textures. Painted in model units (128 px per unit); one tile spans a quarter of the
// body's perimeter (9.5 units), so a motif drawn at x = 0 sits in the middle of every face.

const PX = 128;
const TILE = 9.5;
const INK = "#161212";
const RED = "#C8102E";
const TGOLD = "#F2B705";
const CREAM = "#F6F0E2";
const TURQ = "#17AFA0";

type Ctx = CanvasRenderingContext2D;

const textile = (key: string, h: number, paint: (ctx: Ctx, W: number, H: number) => void) =>
  canvasTexture(
    `inca-textile|${key}`,
    TILE * PX,
    h * PX,
    (ctx) => {
      ctx.scale(PX, PX);
      paint(ctx, TILE, h);
    },
    { wrapS: true },
  );

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Runs `fn(dx)` again shifted by ±W when the shape crosses a tile edge. */
const wrapped = (W: number, x: number, w: number, fn: (dx: number) => void) => {
  fn(0);
  if (x < 0) fn(W);
  if (x + w > W) fn(-W);
};

// Tocapu motifs as tiny grids: "." = ground, "1" = figure, "2" = accent.
const MOTIFS: string[][] = [
  ["...1...", "..111..", ".11211.", "1122211", ".11211.", "..111..", "...1..."],
  ["1111111", "1.....1", "1.222.1", "1.2.2.1", "1.222.1", "1.....1", "1111111"],
  ["1.1.", ".1.1", "1.1.", ".1.1"],
  ["11.....", "111....", ".111...", "..121..", "...111.", "....111", ".....11"],
  ["..111..", "..121..", "1112111", "1222221", "1112111", "..121..", "..111.."],
  ["11...11", "111.111", ".11211.", "..222..", ".11211.", "111.111", "11...11"],
  ["111...", "111...", "111...", "...222", "...222", "...222"],
  ["1......", "11.....", "111....", "1112111", "....111", ".....11", "......1"],
];

const drawMotif = (ctx: Ctx, x: number, y: number, s: number, rows: string[], pal: string[]) => {
  const n = rows.length;
  const c = s / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      ctx.fillStyle = pal[ch === "." ? 0 : Number(ch)];
      ctx.fillRect(x + i * c - 0.003, y + j * c - 0.003, c + 0.006, c + 0.006);
    }
  }
};

/** A row of little stepped pyramids (3 steps) along the whole tile. */
const stepRow = (ctx: Ctx, W: number, y: number, h: number, count: number, color: string, down = false) => {
  const w = W / count;
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 3; k++) {
      const sw = w * (0.86 - k * 0.28);
      const sy = down ? y + (k * h) / 3 : y + h - ((k + 1) * h) / 3;
      ctx.fillRect(i * w + (w - sw) / 2, sy, sw, h / 3 + 0.004);
    }
  }
};

const diamondRow = (ctx: Ctx, W: number, y: number, h: number, count: number, colors: string[], wScale = 0.92) => {
  const w = W / count;
  for (let i = 0; i < count; i++) {
    const cx = i * w + w / 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(cx - (w / 2) * wScale, y + h / 2);
    ctx.lineTo(cx, y);
    ctx.lineTo(cx + (w / 2) * wScale, y + h / 2);
    ctx.lineTo(cx, y + h);
    ctx.closePath();
    ctx.fill();
  }
};

const zigzagLine = (ctx: Ctx, W: number, y: number, amp: number, count: number, color: string, width: number) => {
  const w = W / count;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "miter";
  ctx.beginPath();
  for (let i = -1; i <= count + 1; i++) {
    ctx.lineTo(i * w, y + amp);
    ctx.lineTo(i * w + w / 2, y - amp);
  }
  ctx.stroke();
};

export type UnkuVariant = "noble" | "chasqui" | "inca" | "farmer";

// The unku band is 2.3 tall (y 2.0 → 4.3); its top 0.4 sits under the belt (y 3.9 → 4.38).
// The belt's front (z = 4.64) stays behind the eye bars (z = 4.7), so even wide-open eyes that
// reach down to it are drawn over it. Painters work in band units, y = 0 at the top edge.
const UNKU = { y0: 2.0, y1: 4.3 };
const UNKU_H = UNKU.y1 - UNKU.y0;
const BELT = { y0: 3.9, y1: 4.38 };
const BELT_H = BELT.y1 - BELT.y0;

const INCA_PALS = [
  [INK, TGOLD, RED],
  [TGOLD, INK, RED],
  [RED, TGOLD, INK],
  [TGOLD, RED, INK],
  [INK, RED, TGOLD],
  [CREAM, INK, RED],
];

/** One row of tocapu squares of size s at y, n per tile, square 0 centred on the tile edge. */
const tocapuRow = (ctx: Ctx, W: number, y: number, s: number, n: number, pals: string[][], frame: string, offset = 0) => {
  const sp = W / n;
  for (let i = 0; i < n; i++) {
    const x = i * sp - s / 2;
    wrapped(W, x - 0.05, s + 0.1, (dx) => {
      rect(ctx, x + dx - 0.04, y - 0.04, s + 0.08, s + 0.08, frame);
      drawMotif(ctx, x + dx, y, s, MOTIFS[(i + offset) % MOTIFS.length], pals[((i + offset) * 5) % pals.length]);
    });
  }
};

const paintUnku: Record<UnkuVariant, (ctx: Ctx, W: number, H: number) => void> = {
  // Sapa Inca: a row of big tocapus in gold, red and black on crimson, a checker band and a
  // black hem with gold steps.
  inca: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#9E1027");
    rect(ctx, 0, 0.46, W, 0.05, TGOLD);
    tocapuRow(ctx, W, 0.6, 0.86, 10, INCA_PALS, INK);
    rect(ctx, 0, 1.53, W, 0.05, TGOLD);
    const c = W / 40;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 40; i++) rect(ctx, i * c, 1.64 + row * c, c + 0.004, c + 0.004, (row + i) % 2 ? TGOLD : INK);
    }
    rect(ctx, 0, 2.14, W, H - 2.14, INK);
    stepRow(ctx, W, 2.13, 0.16, 20, TGOLD, true);
  },
  // Chasqui: black-and-white checkerboard with a red stepped yoke, red hem with white steps.
  chasqui: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, CREAM);
    const c = W / 30;
    const top = 0.1;
    const rows = 5;
    for (let row = 0; row < rows; row++) {
      for (let i = 0; i < 30; i++) {
        if ((row + i) % 2 === 0) rect(ctx, i * c - 0.003, top + row * c - 0.003, c + 0.006, c + 0.006, INK);
      }
    }
    const steps: [number, number, number][] = [
      [1.3, 0.1, 0.62],
      [0.95, 0.72, 0.24],
      [0.6, 0.96, 0.24],
      [0.25, 1.2, 0.24],
    ];
    for (const [hw, y, h] of steps) wrapped(W, -hw, hw * 2, (dx) => rect(ctx, dx - hw, y, hw * 2, h, "#D7263D"));
    const redTop = top + rows * c;
    rect(ctx, 0, redTop, W, H - redTop, "#D7263D");
    rect(ctx, 0, redTop, W, 0.05, INK);
    stepRow(ctx, W, redTop + 0.13, 0.26, 24, CREAM);
    rect(ctx, 0, H - 0.08, W, 0.08, INK);
  },
  // Farmer: plain earthy brown weave with a single ochre stripe.
  farmer: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#8B5A2E");
    for (let y = 0; y < H; y += 0.075) rect(ctx, 0, y, W, 0.026, "rgba(55,28,10,0.16)");
    const rnd = mulberry(33);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = rnd() < 0.5 ? "rgba(40,20,8,0.18)" : "rgba(210,160,100,0.16)";
      ctx.fillRect(rnd() * W, rnd() * H, 0.05 + rnd() * 0.08, 0.02);
    }
    rect(ctx, 0, 1.16, W, 0.045, "#F0DDB0");
    rect(ctx, 0, 1.205, W, 0.34, "#DFA53E");
    rect(ctx, 0, 1.545, W, 0.045, "#F0DDB0");
    rect(ctx, 0, H - 0.13, W, 0.13, "#5E3A1C");
  },
  // Noble: red with a yellow band of turquoise stepped diamonds and a turquoise hem.
  noble: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#D42A3C");
    rect(ctx, 0, 0.47, W, 0.05, CREAM);
    rect(ctx, 0, 0.58, W, 0.86, "#FFC21A");
    const n = 10;
    const sp = W / n;
    const s = 0.74;
    for (let i = 0; i < n; i++) {
      const x = i * sp - s / 2;
      wrapped(W, x, s, (dx) => drawMotif(ctx, x + dx, 0.64, s, MOTIFS[0], ["#FFC21A", TURQ, "#D42A3C"]));
    }
    rect(ctx, 0, 1.5, W, 0.05, CREAM);
    stepRow(ctx, W, 1.6, 0.2, 20, "#FFC21A");
    rect(ctx, 0, 1.84, W, H - 1.84, TURQ);
    stepRow(ctx, W, 1.9, 0.3, 20, "#FFC21A");
    rect(ctx, 0, H - 0.07, W, 0.07, "#D42A3C");
  },
};

const paintBelt: Record<UnkuVariant, (ctx: Ctx, W: number, H: number) => void> = {
  inca: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, INK);
    diamondRow(ctx, W, 0.07, H - 0.14, 20, [TGOLD]);
    diamondRow(ctx, W, 0.17, H - 0.34, 20, [RED], 0.45);
    rect(ctx, 0, 0, W, 0.045, TGOLD);
    rect(ctx, 0, H - 0.045, W, 0.045, TGOLD);
  },
  chasqui: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#D7263D");
    zigzagLine(ctx, W, H / 2, 0.11, 20, CREAM, 0.07);
    rect(ctx, 0, 0, W, 0.05, INK);
    rect(ctx, 0, H - 0.05, W, 0.05, INK);
  },
  noble: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#FFC21A");
    diamondRow(ctx, W, 0.07, H - 0.14, 20, [TURQ, "#D42A3C"]);
    rect(ctx, 0, 0, W, 0.05, "#D42A3C");
    rect(ctx, 0, H - 0.05, W, 0.05, "#D42A3C");
  },
  farmer: (ctx, W, H) => {
    rect(ctx, 0, 0, W, H, "#EAD7AE");
    const p = W / 38;
    ctx.fillStyle = "#6B4424";
    for (let i = -2; i < 40; i++) {
      const x = i * p;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + p * 0.5, H);
      ctx.lineTo(x + p * 0.5 + H, 0);
      ctx.lineTo(x + H, 0);
      ctx.closePath();
      ctx.fill();
    }
  },
};

/** The woven unku texture for a variant (also handy for banners and tapestries). */
export const unkuTexture = (variant: UnkuVariant) => textile(`unku-${variant}`, UNKU_H, paintUnku[variant]);
const beltTexture = (variant: UnkuVariant) => textile(`belt-${variant}`, BELT_H, paintBelt[variant]);

const textileMats = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Fabric material for a woven texture (emissive map keeps the colours bright). */
export const textileMat = (tex: THREE.Texture, rough = 0.85) => {
  let m = textileMats.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: 0.16,
    });
    textileMats.set(tex, m);
  }
  return m;
};

/**
 * Inca tunic as a woven band round the lower body (y 2.0 → 4.38, flaring like a little skirt
 * over the tops of the legs) with a chumpi belt on top. Child of <Nubi>; no transform needed.
 * The eyes stay free (the belt ends 0.25 below them and sits behind the eye bars).
 */
export const Unku: React.FC<{ variant: UnkuVariant }> = ({ variant }) => {
  const geo = useMemo(
    () => bandGeometry({ y0: UNKU.y0, y1: UNKU.y1, t0: 0.5, t1: 0.1, bulge: 0.07, rows: 8, capBottom: 0.55 }),
    [],
  );
  const beltGeo = useMemo(
    () => bandGeometry({ y0: BELT.y0, y1: BELT.y1, t0: 0.2, t1: 0.2, bulge: 0.04, rows: 4 }),
    [],
  );
  return (
    <group>
      <mesh geometry={geo} material={textileMat(unkuTexture(variant))} castShadow />
      <mesh geometry={beltGeo} material={textileMat(beltTexture(variant), 0.75)} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// Feathers: a flattened, slightly curled ellipsoid, 1 tall with its base at the origin.

const featherCache = new Map<string, THREE.BufferGeometry>();
const featherGeometry = (base: string, tip: string, tipFrom: number) => {
  const key = `${base}|${tip}|${tipFrom}`;
  const hit = featherCache.get(key);
  if (hit) return hit;
  const g = new THREE.SphereGeometry(0.5, 16, 20);
  const p = g.attributes.position;
  const cb = new THREE.Color(base);
  const ct = new THREE.Color(tip);
  const c = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const yn = p.getY(i) + 0.5;
    p.setX(i, p.getX(i) * (0.4 + 0.8 * yn) * 0.5);
    p.setZ(i, p.getZ(i) * 0.14 - 0.24 * yn * yn);
    p.setY(i, yn);
    c.copy(cb).lerp(ct, Math.max(0, Math.min(1, (yn - tipFrom) / 0.06)));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  featherCache.set(key, g);
  return g;
};

const Feather: React.FC<{
  geo: THREE.BufferGeometry;
  position: V3;
  height: number;
  width?: number;
  fan?: number;
  tilt?: number;
  glow?: number;
}> = ({ geo, position, height, width = 1, fan = 0, tilt = -0.2, glow = 0.12 }) => (
  <group position={position} rotation={[tilt, 0, fan]}>
    <mesh geometry={geo} material={vertexMat(0.6, false, glow)} scale={[height * 0.5 * width, height, height * 0.62]} />
  </group>
);

// ---------------------------------------------------------------------------------------

const bandPaint = {
  chasquiHat: (ctx: Ctx, W: number, H: number) => {
    rect(ctx, 0, 0, W, H, CREAM);
    const n = 12;
    const w = W / n;
    ctx.fillStyle = "#D7263D";
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const sw = w * (0.7 - k * 0.22);
        const x = i * w - sw / 2;
        wrapped(W, x, sw, (dx) => ctx.fillRect(x + dx, H - 0.14 - (k + 1) * 0.16, sw, 0.165));
      }
    }
    rect(ctx, 0, 0, W, 0.07, INK);
    rect(ctx, 0, H - 0.1, W, 0.1, INK);
  },
  // Llawt'u: multicolour braid (chevron strands) between gold edges.
  llawtu: (ctx: Ctx, W: number, H: number) => {
    const colors = ["#E0322B", "#FFC21A", "#1FA35B", "#1E6BFF", "#F7F1E3", "#FF4F9A"];
    const n = 36;
    const p = W / n;
    const m = H / 2;
    ctx.lineWidth = 0.025;
    ctx.strokeStyle = "rgba(20,10,10,0.45)";
    for (let i = -6; i < n + 6; i++) {
      const x = i * p;
      ctx.fillStyle = colors[((i % 6) + 6) % 6];
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, m);
        ctx.lineTo(x + p, m);
        ctx.lineTo(x + p + m, m + dir * m);
        ctx.lineTo(x + m, m + dir * m);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    rect(ctx, 0, 0, W, 0.08, TGOLD);
    rect(ctx, 0, H - 0.08, W, 0.08, TGOLD);
  },
  farmerBand: (ctx: Ctx, W: number, H: number) => {
    rect(ctx, 0, 0, W, H, "#B5462A");
    zigzagLine(ctx, W, H / 2, 0.13, 24, "#F1E3C3", 0.075);
    rect(ctx, 0, 0, W, 0.06, "#5A3620");
    rect(ctx, 0, H - 0.06, W, 0.06, "#5A3620");
  },
};

/**
 * Chasqui headband with a fan of white plumes on top. Child of <Nubi>; no transform needed.
 * `sway` (-1..1) tips the plumes, e.g. sin(frame * 0.4) * 0.4 while running.
 */
export const ChasquiHat: React.FC<{ sway?: number }> = ({ sway = 0 }) => {
  const band = useMemo(() => bandGeometry({ y0: 8.8, y1: 9.6, t0: 0.2, t1: 0.2, bulge: 0.05, rows: 4 }), []);
  const clasp = useRounded(2.7, 0.7, 1.2, 0.3);
  const claspBand = useRounded(2.8, 0.2, 1.3, 0.09);
  const tex = textile("chasqui-hat", 0.8, bandPaint.chasquiHat);
  const geo = featherGeometry("#FFFFFF", "#E9E4D8", 0.86);
  const n = 7;
  return (
    <group>
      <mesh geometry={band} material={textileMat(tex)} />
      {Array.from({ length: n }).map((_, i) => {
        const k = i - (n - 1) / 2;
        return (
          <Feather
            key={i}
            geo={geo}
            position={[k * 0.36, 10.05, 2.85 - Math.abs(k) * 0.1]}
            height={3.7 - Math.abs(k) * 0.3}
            width={1.05}
            fan={-k * 0.21 - sway * 0.12}
            tilt={-0.24 + sway * 0.1}
            glow={0.2}
          />
        );
      })}
      <mesh geometry={clasp} material={toy("#D7263D", { rough: 0.7 })} position={[0, 10.1, 2.9]} />
      <mesh geometry={claspBand} material={gold()} position={[0, 10.05, 2.9]} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// Pututu: conch-shell trumpet. Canonical shell: axis along x, mouthpiece (spire) at -x,
// flared pink lip facing +z, origin at the widest point, 3.5 long.

const PUTUTU_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.11, 0.05],
  [0.19, 0.22],
  [0.29, 0.5],
  [0.42, 0.86],
  [0.56, 1.22],
  [0.68, 1.56],
  [0.74, 1.84],
  [0.71, 2.1],
  [0.61, 2.42],
  [0.47, 2.74],
  [0.33, 3.0],
  [0.21, 3.24],
  [0.11, 3.42],
  [0.0, 3.5],
];
const SHOULDER = 1.84;

const profileR = (h: number) => {
  for (let i = 0; i < PUTUTU_PROFILE.length - 1; i++) {
    const [r0, h0] = PUTUTU_PROFILE[i];
    const [r1, h1] = PUTUTU_PROFILE[i + 1];
    if (h >= h0 && h <= h1) return r0 + ((r1 - r0) * (h - h0)) / (h1 - h0);
  }
  return 0;
};

const KNOBS = [0, 1, 2, 3, 4, 5, 6].map((i) => (i / 7) * Math.PI * 2 + 0.3);

const PututuShell: React.FC = () => {
  const geos = useMemo(() => {
    const body = new THREE.LatheGeometry(
      PUTUTU_PROFILE.map(([r, h]) => new THREE.Vector2(r, h)),
      36,
    );
    body.translate(0, -SHOULDER, 0);
    body.rotateZ(-Math.PI / 2);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 90; i++) {
      const s = i / 90;
      const h = 0.14 + 1.62 * s;
      const r = profileR(h) + 0.015;
      const a = s * Math.PI * 2 * 3.2;
      pts.push(new THREE.Vector3(h - SHOULDER, Math.cos(a) * r, Math.sin(a) * r));
    }
    const ridge = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 180, 0.075, 8, false);
    const knob = new THREE.ConeGeometry(0.16, 0.42, 8);
    const lip = new THREE.SphereGeometry(1, 24, 16);
    const mouth = new THREE.CylinderGeometry(0.12, 0.13, 0.34, 14);
    const ring = new THREE.TorusGeometry(0.14, 0.045, 8, 20);
    const bind = new THREE.TorusGeometry(0.71, 0.06, 8, 36);
    return { body, ridge, knob, lip, mouth, ring, bind };
  }, []);
  const shell = toy("#F4E4C4", { rough: 0.42, glow: 0.18, side: THREE.DoubleSide });
  return (
    <group>
      <mesh geometry={geos.body} material={shell} castShadow />
      <mesh geometry={geos.ridge} material={toy("#D8A266", { rough: 0.5 })} />
      {KNOBS.map((a, i) => {
        const dir = new THREE.Vector3(-0.4, Math.cos(a), Math.sin(a)).normalize();
        const p = new THREE.Vector3(-0.08, Math.cos(a) * 0.66, Math.sin(a) * 0.66).addScaledVector(dir, 0.14);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        return <mesh key={i} geometry={geos.knob} material={toy("#EBD3A8", { rough: 0.5 })} position={p} quaternion={q} />;
      })}
      {/* Flared pink lip (the opening) on the front side. */}
      <mesh geometry={geos.lip} material={toy("#FF93AA", { rough: 0.35, glow: 0.24 })} position={[0.62, -0.05, 0.5]} rotation={[0, 0.22, 0.08]} scale={[1.22, 0.62, 0.32]} />
      <mesh geometry={geos.lip} material={toy("#C84A6E", { rough: 0.4 })} position={[0.66, -0.05, 0.74]} rotation={[0, 0.22, 0.08]} scale={[0.92, 0.2, 0.1]} />
      {/* Mouthpiece at the spire. */}
      <mesh geometry={geos.mouth} material={toy("#6B3E1E", { rough: 0.6 })} position={[-SHOULDER - 0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={geos.ring} material={gold()} position={[-SHOULDER + 0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      {/* Cord binding (where a strap ties on). */}
      <mesh geometry={geos.bind} material={toy("#7A4A24", { rough: 0.8 })} position={[-0.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[1, 0.95, 0.95]} />
    </group>
  );
};

// Hanging layout: shell in front of the fin at hip height on the right side of the body.
const HANG = (() => {
  const D = new THREE.Vector3(0.22, -1, 0.3).normalize();
  const want = new THREE.Vector3(0.55, 0, 0.85);
  const Z = want.addScaledVector(D, -want.dot(D)).normalize();
  const Y = new THREE.Vector3().crossVectors(Z, D);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(D, Y, Z));
  const origin = new THREE.Vector3(5.82, 3.5, 2.72);
  const ringPt = origin.clone().addScaledVector(D, -0.3);
  const anchor = new THREE.Vector3(5.12, 4.45, 2.55);
  const cordLen = anchor.distanceTo(ringPt);
  const cordMid = anchor.clone().add(ringPt).multiplyScalar(0.5);
  const cordQ = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    ringPt.clone().sub(anchor).normalize(),
  );
  return { q, origin, anchor, cordLen, cordMid, cordQ };
})();

const STRAP_Z = 2.55;
const TOP_DIAG = Math.atan2(STRAP_Z * 2, 8.8);

const PututuStrap: React.FC<{ swing: number }> = ({ swing }) => {
  const side = useMemo(() => new THREE.BoxGeometry(0.1, 5.1, 0.55), []);
  const edge = useMemo(() => new THREE.BoxGeometry(0.1, 0.95, 0.55), []);
  const top = useMemo(() => new THREE.BoxGeometry(Math.hypot(8.8, STRAP_Z * 2), 0.1, 0.55), []);
  const cord = useMemo(() => new THREE.CylinderGeometry(0.08, 0.08, 1, 8), []);
  const knot = useRounded(0.42, 0.42, 0.7, 0.16);
  const strap = toy("#8A5530", { rough: 0.8 });
  const a = HANG.anchor;
  return (
    <group>
      <mesh geometry={side} material={strap} position={[5.06, 6.85, STRAP_Z]} />
      <mesh geometry={edge} material={strap} position={[4.86, 9.76, STRAP_Z]} rotation={[0, 0, Math.PI / 4]} />
      <mesh geometry={top} material={strap} position={[0, 9.97, 0]} rotation={[0, -TOP_DIAG, 0]} />
      <mesh geometry={edge} material={strap} position={[-4.86, 9.76, -STRAP_Z]} rotation={[0, 0, -Math.PI / 4]} />
      <mesh geometry={side} material={strap} position={[-5.06, 6.85, -STRAP_Z]} />
      <mesh geometry={knot} material={strap} position={[a.x + 0.08, a.y, a.z]} />
      {/* The shell swings on its cord around the knot. */}
      <group position={a} rotation={[swing * 0.25, 0, swing * 0.4]}>
        <group position={[-a.x, -a.y, -a.z]}>
          <mesh geometry={cord} material={strap} position={HANG.cordMid} quaternion={HANG.cordQ} scale={[1, HANG.cordLen, 1]} />
          <group position={HANG.origin} quaternion={HANG.q}>
            <PututuShell />
          </group>
        </group>
      </group>
    </group>
  );
};

/**
 * Conch-shell trumpet.
 * - Held (default): the bare shell, 3.5 long, mouthpiece towards -x (towards Nubi in holdR)
 *   and the pink lip facing the camera; origin at the shell's widest point. See PUTUTU_HOLD_R.
 * - `strap`: child of <Nubi>; hangs on a strap at the side of the body (screen-right, or
 *   screen-left with side = -1), in front of the fin. `swing` (-1..1) swings it on its cord.
 */
export const Pututu: React.FC<{ strap?: boolean; side?: 1 | -1; swing?: number }> = ({
  strap = false,
  side = 1,
  swing = 0,
}) => {
  if (!strap) return <PututuShell />;
  return (
    <group scale={[side, 1, 1]}>
      <PututuStrap swing={swing} />
    </group>
  );
};

/** Pututu raised like a trumpet in <Nubi holdR>: spread as a group's props around <Pututu />. */
export const PUTUTU_HOLD_R = { position: [0.2, 0.35, 0.55] as V3, rotation: [0.15, -0.25, 0.55] as V3, scale: 1 };

// ---------------------------------------------------------------------------------------
// Quipu: knotted cords hanging from a main cord. Origin at the middle of the main cord.

const QUIPU_COLORS = ["#E0322B", "#FFC21A", "#F4EEDC", "#1FA35B", "#1E6BFF", "#8A5A32", "#FF4F9A", "#FF8A1F"];
const QUIPU_HALF = 2.15;
const sag = (x: number) => -0.16 * (1 - (x / QUIPU_HALF) ** 2);

type QCord = { x: number; len: number; color: string; knot: string; knots: number[]; amp: number };

const quipuCords = (): QCord[] => {
  const rnd = mulberry(1532);
  return QUIPU_COLORS.map((color, i) => {
    const len = 1.9 + rnd() * 1.0;
    const count = 1 + Math.floor(rnd() * 3.99);
    const knots: number[] = [];
    for (let k = 0; k < count; k++) knots.push(0.22 + (0.7 * (k + rnd() * 0.6)) / count);
    return { x: -1.75 + i * 0.5, len, color, knot: shadeHex(color, -0.1), knots, amp: 0.8 + rnd() * 0.4 };
  });
};

/**
 * Quipu: a cream main cord (4.3 wide) with 8 coloured pendant cords (1.9–2.9 long) and knots.
 * `swing` (-1..1) sways the cords; with `phase` (radians) the sway runs along them as a wave.
 * In a fin: see QUIPU_HOLD_L (held by the middle of the main cord).
 */
export const Quipu: React.FC<{ swing?: number; phase?: number }> = ({ swing = 0, phase }) => {
  const cords = useMemo(quipuCords, []);
  const geos = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const x = -QUIPU_HALF + (i / 20) * QUIPU_HALF * 2;
      pts.push(new THREE.Vector3(x, sag(x), 0));
    }
    return {
      main: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.12, 10, false),
      cord: new THREE.CylinderGeometry(0.068, 0.068, 1, 8),
      knot: new THREE.SphereGeometry(0.16, 14, 10),
      end: new THREE.SphereGeometry(0.21, 14, 10),
    };
  }, []);
  const mainMat = toy("#EAD9B5", { rough: 0.8 });
  return (
    <group>
      <mesh geometry={geos.main} material={mainMat} castShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.end} material={mainMat} position={[s * QUIPU_HALF, 0, 0]} />
      ))}
      {cords.map((c, i) => {
        const a = swing * 0.32 * c.amp * (phase === undefined ? 1 : Math.sin(phase - i * 0.55));
        const L1 = c.len * 0.5;
        const mat = toy(c.color, { rough: 0.75 });
        const kmat = toy(c.knot, { rough: 0.7 });
        const seg = (from: number) =>
          c.knots
            .filter((f) => f * c.len >= from && f * c.len < from + L1)
            .map((f, k) => (
              <mesh key={k} geometry={geos.knot} material={kmat} position={[0, -(f * c.len - from), 0]} scale={[1, 0.78, 1]} />
            ));
        return (
          <group key={i} position={[c.x, sag(c.x), 0]} rotation={[a * 0.3, 0, a]}>
            <mesh geometry={geos.knot} material={mat} scale={[1.05, 1.3, 1.05]} />
            <mesh geometry={geos.cord} material={mat} position={[0, -L1 / 2, 0]} scale={[1, L1, 1]} />
            {seg(0)}
            <group position={[0, -L1, 0]} rotation={[a * 0.2, 0, a * 0.6]}>
              <mesh geometry={geos.cord} material={mat} position={[0, -L1 / 2, 0]} scale={[1, L1, 1]} />
              {seg(L1)}
              <mesh geometry={geos.knot} material={kmat} position={[0, -L1, 0]} scale={[0.8, 1.1, 0.8]} />
            </group>
          </group>
        );
      })}
    </group>
  );
};

/** Quipu in <Nubi holdL>, held by the middle of its main cord, clear of the body. */
export const QUIPU_HOLD_L = { position: [-1.2, 0.1, 0.3] as V3, rotation: [0, 0.2, 0] as V3, scale: 0.9 };

// ---------------------------------------------------------------------------------------

/**
 * Mascaypacha, the Sapa Inca's headdress: braided multicolour llawt'u round the top of the
 * body, the red borla fringe over the top of the face (ending well above the eyes), a small
 * gold plate and three black-and-white feathers on top. Child of <Nubi>; no transform needed.
 * `sway` (-1..1) swings the fringe a little.
 */
export const Mascaypacha: React.FC<{ sway?: number }> = ({ sway = 0 }) => {
  const band = useMemo(() => bandGeometry({ y0: 8.65, y1: 9.65, t0: 0.26, t1: 0.26, bulge: 0.08, rows: 5 }), []);
  const bar = useRounded(6.1, 0.3, 0.36, 0.12);
  const tassel = useMemo(() => new THREE.CapsuleGeometry(0.17, 0.78, 4, 12), []);
  const cap = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 0.26, 12), []);
  const plate = useRounded(1.8, 1.3, 0.22, 0.1);
  const disc = useMemo(() => new THREE.CylinderGeometry(0.42, 0.42, 0.1, 28), []);
  const ring = useMemo(() => new THREE.TorusGeometry(0.52, 0.06, 8, 32), []);
  const feather = featherGeometry("#1B1B1B", "#FFFFFF", 0.66);
  const wool = toy("#D8102A", { rough: 0.85, glow: 0.18 });
  const tex = textile("llawtu", 1.0, bandPaint.llawtu);
  return (
    <group>
      <mesh geometry={band} material={textileMat(tex)} castShadow />
      <mesh geometry={bar} material={gold()} position={[0, 8.56, 4.6]} />
      {Array.from({ length: 13 }).map((_, i) => {
        const x = -2.7 + i * 0.45;
        return (
          <group key={i} position={[x, 8.43, 4.6]} rotation={[sway * 0.12, 0, sway * 0.06]}>
            <mesh geometry={cap} material={gold()} position={[0, -0.13, 0]} />
            <mesh geometry={tassel} material={wool} position={[0, -0.82, -0.03]} scale={[1, 1, 0.85]} />
          </group>
        );
      })}
      <group position={[0, 10.45, 3.05]} rotation={[-0.15, 0, 0]}>
        <mesh geometry={plate} material={gold()} />
        <mesh geometry={disc} material={goldDark()} position={[0, 0.02, 0.12]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={ring} material={gold()} position={[0, 0.02, 0.13]} />
      </group>
      {[-1, 0, 1].map((k) => (
        <Feather
          key={k}
          geo={feather}
          position={[k * 0.55, 10.3, 2.75]}
          height={k === 0 ? 3.4 : 2.8}
          fan={-k * 0.3}
          tilt={-0.12}
          glow={0.1}
        />
      ))}
    </group>
  );
};

/**
 * Gold ear spools (the "orejones" discs) on both sides of the body, above the fins, turned a
 * little towards the camera. Child of <Nubi>; no transform needed.
 */
export const EarSpools: React.FC = () => {
  const geos = useMemo(
    () => ({
      disc: new THREE.CylinderGeometry(1.08, 1.08, 0.3, 40),
      ring: new THREE.TorusGeometry(0.8, 0.13, 10, 40),
      boss: new THREE.CylinderGeometry(0.4, 0.46, 0.26, 28),
    }),
    [],
  );
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.12, 7.55, 0.5]} rotation={[0, -side * 0.42, 0]}>
          <mesh geometry={geos.disc} material={gold()} rotation={[0, 0, Math.PI / 2]} castShadow />
          <mesh geometry={geos.ring} material={goldDark()} position={[side * 0.16, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={geos.boss} material={gold()} position={[side * 0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
        </group>
      ))}
    </group>
  );
};

/** Simple woven headband with a knot and two tails on the screen-left side. Child of <Nubi>. */
export const FarmerBand: React.FC = () => {
  const band = useMemo(() => bandGeometry({ y0: 8.95, y1: 9.55, t0: 0.16, t1: 0.16, bulge: 0.04, rows: 3 }), []);
  const knot = useRounded(0.7, 0.66, 0.7, 0.26);
  const tail = useRounded(0.42, 1.5, 0.14, 0.06);
  const tex = textile("farmer-band", 0.6, bandPaint.farmerBand);
  const cloth = toy("#B5462A", { rough: 0.85 });
  return (
    <group>
      <mesh geometry={band} material={textileMat(tex)} />
      <group position={[-5.2, 9.25, 2.4]}>
        <mesh geometry={knot} material={cloth} />
        <mesh geometry={tail} material={cloth} position={[-0.3, -0.8, 0.18]} rotation={[0.08, 0, -0.38]} />
        <mesh geometry={tail} material={cloth} position={[-0.05, -0.86, -0.16]} rotation={[-0.08, 0, -0.12]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------------------

/**
 * Chaquitaclla, the Andean foot plough: a long wooden pole (≈12.8 tall with the handle), a bent
 * handle on top, a footrest peg tied near the bottom and a pointed bronze blade. The origin is
 * the grip, so it drops straight into <Nubi holdR={<Chaquitaclla />}>: the pole stands upright
 * through the fin with the blade tip just touching the ground (at rest) and the peg pointing
 * outwards. For holdL wrap it in <group rotation={[0, Math.PI, 0]}> so the peg points out.
 */
export const Chaquitaclla: React.FC = () => {
  const geos = useMemo(() => {
    const blade = new THREE.Shape();
    blade.moveTo(-0.46, 0);
    blade.lineTo(0.46, 0);
    blade.quadraticCurveTo(0.5, -0.75, 0, -1.45);
    blade.quadraticCurveTo(-0.5, -0.75, -0.46, 0);
    const bladeGeo = new THREE.ExtrudeGeometry(blade, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 2,
      curveSegments: 10,
    });
    bladeGeo.translate(0, 0, -0.05);
    return {
      pole: new THREE.CylinderGeometry(0.2, 0.24, 10.6, 12),
      handle: new THREE.CylinderGeometry(0.19, 0.21, 1.75, 10),
      joint: new THREE.SphereGeometry(0.235, 14, 10),
      knob: new THREE.SphereGeometry(0.31, 14, 10),
      peg: new THREE.CylinderGeometry(0.15, 0.17, 1.6, 10),
      rope: new THREE.TorusGeometry(0.27, 0.075, 8, 20),
      blade: bladeGeo,
    };
  }, []);
  const wood = toy("#A36A33", { rough: 0.7 });
  const woodDark = toy("#7E4A22", { rough: 0.7 });
  const rope = toy("#DDBB7E", { rough: 0.85 });
  const HAND = new THREE.Vector2(-0.6, 0.8);
  return (
    <group>
      <mesh geometry={geos.pole} material={wood} position={[0, 1.85, 0]} castShadow />
      <mesh geometry={geos.joint} material={woodDark} position={[0, 7.12, 0]} />
      <mesh
        geometry={geos.handle}
        material={woodDark}
        position={[HAND.x * 0.85, 7.12 + HAND.y * 0.85, 0]}
        rotation={[0, 0, Math.atan2(-HAND.x, HAND.y)]}
        castShadow
      />
      <mesh geometry={geos.knob} material={woodDark} position={[HAND.x * 1.75, 7.12 + HAND.y * 1.75, 0]} />
      <mesh geometry={geos.peg} material={woodDark} position={[0.82, -2.5, 0]} rotation={[0, 0, -1.45]} castShadow />
      {[-2.36, -2.62].map((y) => (
        <mesh key={y} geometry={geos.rope} material={rope} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <mesh geometry={geos.blade} material={toy("#CD8B3E", { metal: 0.6, rough: 0.3, glow: 0.2 })} position={[0, -3.2, 0]} castShadow />
      {[-3.12, -3.36].map((y) => (
        <mesh key={y} geometry={geos.rope} material={rope} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  );
};
