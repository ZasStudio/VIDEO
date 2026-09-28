import React, { useMemo } from "react";
import * as THREE from "three";
import { C } from "../theme";
import { box, merge, roof, shade } from "./geo";
import { mulberry } from "./noise";
import { CAKE, PLATEAU, cakeLevel } from "./terrain";

// The citadel: stepped terraces (stone walls + grass) and the urban sector on top.

let stoneTexture: THREE.CanvasTexture | null = null;
/** Irregular ashlar pattern for terrace walls. */
export const getStoneTexture = () => {
  if (stoneTexture) return stoneTexture;
  const W = 256;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#6f685e";
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry(7);
  const rows = 3;
  const rh = H / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 20;
    while (x < W) {
      const w = 18 + rnd() * 26;
      const l = 62 + rnd() * 16;
      ctx.fillStyle = `hsl(38, ${8 + rnd() * 8}%, ${l}%)`;
      const pad = 1.6;
      ctx.beginPath();
      ctx.roundRect(x + pad, r * rh + pad, w - pad * 2, rh - pad * 2, 3);
      ctx.fill();
      x += w;
    }
  }
  stoneTexture = new THREE.CanvasTexture(canvas);
  stoneTexture.wrapS = THREE.RepeatWrapping;
  stoneTexture.wrapT = THREE.RepeatWrapping;
  stoneTexture.colorSpace = THREE.SRGBColorSpace;
  stoneTexture.anisotropy = 4;
  return stoneTexture;
};

const ellipseShape = (
  a: number,
  b: number,
  cx: number,
  cz: number,
  segments = 96,
) => {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Slightly squarish ellipse, like the real contour-following terraces.
    const c = Math.cos(t);
    const s = Math.sin(t);
    const k = 0.8;
    const x = cx + b * Math.sign(c) * Math.pow(Math.abs(c), k);
    const z = cz + a * Math.sign(s) * Math.pow(Math.abs(s), k);
    // Shape Y maps to world -Z after rotating the extrusion upwards.
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  return shape;
};

const Terraces: React.FC = () => {
  const { geos, grass, stone } = useMemo(() => {
    const tex = getStoneTexture();
    tex.repeat.set(0.25, 1.1);
    const grassMat = new THREE.MeshStandardMaterial({
      color: C.grass,
      roughness: 0.95,
      flatShading: true,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: tex,
      roughness: 0.9,
    });
    const list: { geo: THREE.ExtrudeGeometry; y: number }[] = [];
    for (let i = 0; i < CAKE.levels; i++) {
      const L = cakeLevel(i);
      const bottom = PLATEAU.y - 1.2;
      const depth = L.y - bottom;
      const geo = new THREE.ExtrudeGeometry(
        ellipseShape(L.a, L.b, L.cx, L.cz),
        { depth, bevelEnabled: false, curveSegments: 1 },
      );
      geo.rotateX(-Math.PI / 2);
      list.push({ geo, y: bottom });
    }
    return { geos: list, grass: grassMat, stone: stoneMat };
  }, []);
  return (
    <group>
      {geos.map((g, i) => (
        <mesh
          key={i}
          geometry={g.geo}
          material={[grass, stone]}
          position={[0, g.y, 0]}
          receiveShadow
          castShadow
        />
      ))}
    </group>
  );
};

type Building = {
  x: number;
  z: number;
  w: number;
  l: number;
  h: number;
  rot: number;
  roofed: boolean;
};

export const citadelBuildings = (): Building[] => {
  const rnd = mulberry(1911);
  const list: Building[] = [];
  const top = cakeLevel(0);
  const cols = [-8.3, -5.1, 5.1, 8.3];
  for (const x of cols) {
    for (let z = -20; z <= 20; z += 3.4) {
      const jx = x + (rnd() - 0.5) * 0.6;
      const jz = z + (rnd() - 0.5) * 0.8;
      const inside =
        Math.pow(jx / (top.b - 1.9), 2) + Math.pow(jz / (top.a - 2.2), 2) < 1;
      if (!inside) continue;
      // Leave room for the Intihuatana hill (north-west).
      if (jx < 0 && jz < -12) continue;
      if (rnd() < 0.18) continue;
      const rot = rnd() < 0.7 ? 0 : Math.PI / 2;
      list.push({
        x: jx,
        z: jz,
        w: 2.1 + rnd() * 0.5,
        l: 2.6 + rnd() * 0.5,
        h: 1.25 + rnd() * 0.4,
        rot,
        roofed: rnd() < 0.55,
      });
    }
  }
  return list;
};

const Buildings: React.FC = () => {
  const { walls, roofs } = useMemo(() => {
    const rnd = mulberry(1450);
    const wallGeos: THREE.BufferGeometry[] = [];
    const roofGeos: THREE.BufferGeometry[] = [];
    const T = 0.26;
    for (const b of citadelBuildings()) {
      const col = shade(C.stone, (rnd() - 0.5) * 0.1);
      const cos = Math.cos(b.rot);
      const sin = Math.sin(b.rot);
      const place = (lx: number, lz: number): [number, number, number] => [
        b.x + lx * cos + lz * sin,
        b.h / 2,
        b.z - lx * sin + lz * cos,
      ];
      wallGeos.push(box(b.w, b.h, T, col, place(0, b.l / 2 - T / 2), b.rot));
      wallGeos.push(box(b.w, b.h, T, col, place(0, -b.l / 2 + T / 2), b.rot));
      wallGeos.push(
        box(T, b.h, b.l - 2 * T, col, place(b.w / 2 - T / 2, 0), b.rot),
      );
      wallGeos.push(
        box(T, b.h, b.l - 2 * T, col, place(-b.w / 2 + T / 2, 0), b.rot),
      );
      // Dark floor so empty rooms read as ruins from above.
      wallGeos.push(
        box(
          b.w - 2 * T,
          0.06,
          b.l - 2 * T,
          shade(C.grassDark, -0.05),
          place(0, 0),
          b.rot,
        ),
      );
      if (b.roofed) {
        const rh = 1.1 + rnd() * 0.3;
        const p = place(0, 0);
        roofGeos.push(
          roof(
            b.w + 0.45,
            rh,
            b.l + 0.1,
            shade(C.thatch, (rnd() - 0.5) * 0.08),
            col,
            [p[0], b.h, p[2]],
            b.rot,
          ),
        );
      }
    }
    // Intihuatana: a stepped hill with the carved stone on top.
    const ix = -5.6;
    const iz = -17.2;
    wallGeos.push(box(5.4, 0.9, 5.4, C.stoneDark, [ix, 0.45, iz]));
    wallGeos.push(box(5.5, 0.08, 5.5, C.grass, [ix, 0.92, iz]));
    wallGeos.push(box(3.8, 0.9, 3.8, C.stoneDark, [ix, 1.35, iz]));
    wallGeos.push(box(3.9, 0.08, 3.9, C.grass, [ix, 1.82, iz]));
    wallGeos.push(box(2.3, 0.8, 2.3, C.stoneDark, [ix, 2.2, iz]));
    wallGeos.push(box(0.8, 0.9, 0.6, C.stone, [ix, 3.05, iz]));
    return {
      walls: merge(wallGeos),
      roofs: roofGeos.length ? merge(roofGeos) : null,
    };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        flatShading: true,
      }),
    [],
  );
  return (
    <group>
      <mesh geometry={walls} material={mat} castShadow receiveShadow />
      {roofs ? (
        <mesh geometry={roofs} material={mat} castShadow receiveShadow />
      ) : null}
    </group>
  );
};

export const Citadel: React.FC = () => (
  <group>
    <Terraces />
    <Buildings />
  </group>
);
