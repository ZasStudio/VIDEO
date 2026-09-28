import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry } from "./noise";

// Inca polygonal masonry: blocks that tessellate perfectly (shared kinked boundaries and
// slanted joints), extruded with a bevel so every stone gets the typical "pillow" face.

export type Pt = [number, number];
export type BlockDef = {
  poly: Pt[];
  cx: number;
  cy: number;
  row: number;
  index: number;
};

export type WallOpts = {
  width: number;
  height: number;
  rows: number;
  seed: number;
  /** Inward lean of the side edges (x offset per unit of height). */
  lean?: number;
  /** Trapezoidal opening centred at x = width / 2. */
  door?: { bottom: number; top: number; height: number };
  minBlock?: number;
  maxBlock?: number;
};

const interpY = (nodes: Pt[], x: number) => {
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x0, y0] = nodes[i];
    const [x1, y1] = nodes[i + 1];
    if (x >= x0 - 1e-9 && x <= x1 + 1e-9) {
      const t = (x - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return nodes[x < nodes[0][0] ? 0 : nodes.length - 1][1];
};

export type Wall = BlockDef[] & {
  /** y of the boundary between row r-1 and row r at x. */
  boundaryY: (r: number, x: number) => number;
};

export const buildWall = (o: WallOpts): Wall => {
  const rnd = mulberry(o.seed);
  const lean = o.lean ?? 0;
  const minB = o.minBlock ?? 1.1;
  const maxB = o.maxBlock ?? 2.3;
  const rowH = o.height / o.rows;
  // Row boundaries as polylines with a few kinks.
  const bounds: Pt[][] = [];
  for (let r = 0; r <= o.rows; r++) {
    const y = r * rowH;
    if (r === 0 || r === o.rows) {
      bounds.push([
        [-5, y],
        [o.width + 5, y],
      ]);
      continue;
    }
    const nodes: Pt[] = [[-5, y]];
    let x = 0.4 + rnd() * 0.8;
    const doorTop = o.door && Math.abs(y - o.door.height) < 1e-6;
    while (x < o.width - 0.4) {
      const jitter = (rnd() - 0.5) * rowH * 0.34;
      // Keep the lintel's underside straight over the doorway.
      const overDoor =
        doorTop && Math.abs(x - o.width / 2) < o.door!.top / 2 + 0.5;
      if (!overDoor) nodes.push([x, y + jitter]);
      x += 0.8 + rnd() * 1.1;
    }
    nodes.push([o.width + 5, y]);
    bounds.push(nodes);
  }
  const leftAt = (y: number) => lean * y;
  const rightAt = (y: number) => o.width - lean * y;
  const blocks: BlockDef[] = [];
  let index = 0;
  for (let r = 0; r < o.rows; r++) {
    const bot = bounds[r];
    const top = bounds[r + 1];
    const yb = r * rowH;
    const yt = (r + 1) * rowH;
    // Horizontal spans of this row (split by the door opening if any).
    const spans: { l: (y: number) => number; r: (y: number) => number }[] = [];
    const d = o.door;
    if (d && yb < d.height - 1e-6) {
      const cx = o.width / 2;
      const doorL = (y: number) =>
        cx - (d.bottom / 2 + ((d.top - d.bottom) / 2) * (y / d.height));
      const doorR = (y: number) =>
        cx + (d.bottom / 2 + ((d.top - d.bottom) / 2) * (y / d.height));
      spans.push({ l: leftAt, r: doorL });
      spans.push({ l: doorR, r: rightAt });
    } else {
      spans.push({ l: leftAt, r: rightAt });
    }
    for (const span of spans) {
      // Joints: [bottomX, topX] pairs; the span edges are the first and last joints.
      const joints: [number, number][] = [[span.l(yb), span.l(yt)]];
      const width = span.r(yb) - span.l(yb);
      let acc = 0;
      const lintelRow = d && Math.abs(yb - d.height) < 1e-6;
      if (lintelRow) {
        // One long lintel block spanning the doorway.
        const half = d.top / 2 + 0.55;
        joints.push([o.width / 2 - half - 0.05, o.width / 2 - half + 0.05]);
        joints.push([o.width / 2 + half + 0.05, o.width / 2 + half - 0.05]);
      }
      while (!lintelRow) {
        const step = minB + rnd() * (maxB - minB);
        if (acc + step > width - minB * 0.8) break;
        acc += step;
        const xb = span.l(yb) + acc;
        const slant = (rnd() - 0.5) * 0.7;
        joints.push([
          xb,
          xb +
            slant +
            (span.l(yt) - span.l(yb)) * (1 - acc / width) +
            (span.r(yt) - span.r(yb)) * (acc / width),
        ]);
      }
      joints.push([span.r(yb), span.r(yt)]);
      for (let j = 0; j < joints.length - 1; j++) {
        const [bl, tl] = joints[j];
        const [br, tr] = joints[j + 1];
        const poly: Pt[] = [];
        poly.push([bl, interpY(bot, bl)]);
        for (const n of bot)
          if (n[0] > bl + 0.05 && n[0] < br - 0.05) poly.push([n[0], n[1]]);
        poly.push([br, interpY(bot, br)]);
        poly.push([tr, interpY(top, tr)]);
        for (let k = top.length - 1; k >= 0; k--) {
          const n = top[k];
          if (n[0] < tr - 0.05 && n[0] > tl + 0.05) poly.push([n[0], n[1]]);
        }
        poly.push([tl, interpY(top, tl)]);
        let cx = 0;
        let cy = 0;
        for (const p of poly) {
          cx += p[0];
          cy += p[1];
        }
        cx /= poly.length;
        cy /= poly.length;
        blocks.push({ poly, cx, cy, row: r, index: index++ });
      }
    }
  }
  return Object.assign(blocks, {
    boundaryY: (r: number, x: number) => interpY(bounds[r], x),
  });
};

let graniteTexture: THREE.CanvasTexture | null = null;
export const getGraniteTexture = () => {
  if (graniteTexture) return graniteTexture;
  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c9c2b6";
  ctx.fillRect(0, 0, S, S);
  const rnd = mulberry(99);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    ctx.fillStyle =
      v < 0.45
        ? `rgba(90,86,80,${0.25 + rnd() * 0.35})`
        : v < 0.8
          ? `rgba(255,252,245,${0.3 + rnd() * 0.4})`
          : `rgba(160,120,95,${0.3 + rnd() * 0.3})`;
    const r = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    ctx.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2);
    ctx.fill();
  }
  graniteTexture = new THREE.CanvasTexture(canvas);
  graniteTexture.wrapS = THREE.RepeatWrapping;
  graniteTexture.wrapT = THREE.RepeatWrapping;
  graniteTexture.colorSpace = THREE.SRGBColorSpace;
  graniteTexture.repeat.set(0.5, 0.5);
  return graniteTexture;
};

/** Geometry for one block, centred on its centroid (so it can be animated around it). */
export const blockGeometry = (
  b: BlockDef,
  depth: number,
  gap = 0.035,
  bevel = 0.14,
) => {
  const shape = new THREE.Shape(
    b.poly.map(([x, y]) => new THREE.Vector2(x - b.cx, y - b.cy)),
  );
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel - gap / 2,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geo.translate(0, 0, -(depth - bevel * 2) / 2);
  geo.computeVertexNormals();
  return geo;
};

const TINTS = ["#FFFFFF", "#F3EEE6", "#E9E4DA", "#F7F2EA", "#E2DDD4"];

export const useGraniteMaterials = () =>
  useMemo(() => {
    const tex = getGraniteTexture();
    return TINTS.map(
      (t) =>
        new THREE.MeshStandardMaterial({
          color: t,
          map: tex,
          roughness: 0.82,
          metalness: 0,
        }),
    );
  }, []);

export type BlockAnim = {
  pos: [number, number, number];
  rot: [number, number, number];
  scale?: number;
  visible?: boolean;
};

/** Renders a wall; `anim(b)` returns each block's offset from its resting place. */
export const WallMesh: React.FC<{
  blocks: BlockDef[];
  depth?: number;
  anim?: (b: BlockDef) => BlockAnim;
}> = ({ blocks, depth = 1.1, anim }) => {
  const geos = useMemo(
    () => blocks.map((b) => blockGeometry(b, depth)),
    [blocks, depth],
  );
  const mats = useGraniteMaterials();
  return (
    <group>
      {blocks.map((b, i) => {
        const a = anim
          ? anim(b)
          : {
              pos: [0, 0, 0] as [number, number, number],
              rot: [0, 0, 0] as [number, number, number],
            };
        if (a.visible === false) return null;
        return (
          <mesh
            key={i}
            geometry={geos[i]}
            material={mats[b.index % mats.length]}
            position={[b.cx + a.pos[0], b.cy + a.pos[1], a.pos[2]]}
            rotation={a.rot}
            scale={a.scale ?? 1}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
};
