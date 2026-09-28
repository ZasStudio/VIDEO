import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Small geometry helpers: colored boxes and gabled roofs merged into single meshes.

export const paint = (
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
) => {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
};

export const box = (
  w: number,
  h: number,
  d: number,
  color: THREE.ColorRepresentation,
  pos: [number, number, number],
  rotY = 0,
) => {
  const g = new THREE.BoxGeometry(w, h, d);
  paint(g, color);
  const m = new THREE.Matrix4()
    .makeRotationY(rotY)
    .setPosition(pos[0], pos[1], pos[2]);
  g.applyMatrix4(m);
  return g;
};

/** Gabled roof: slopes along x, stone gables facing ±z. */
export const roof = (
  w: number,
  h: number,
  d: number,
  thatch: THREE.ColorRepresentation,
  gable: THREE.ColorRepresentation,
  pos: [number, number, number],
  rotY = 0,
) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) p.setX(i, 0);
  }
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z (4 vertices each).
  const t = new THREE.Color(thatch);
  const s = new THREE.Color(gable);
  const colors = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const face = Math.floor(i / 4);
    const c = face >= 4 ? s : t;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  g.applyMatrix4(
    new THREE.Matrix4()
      .makeRotationY(rotY)
      .setPosition(pos[0], pos[1] + h / 2, pos[2]),
  );
  return g;
};

export const merge = (geos: THREE.BufferGeometry[]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(ng.attributes)) {
      if (key !== "position" && key !== "normal" && key !== "color")
        ng.deleteAttribute(key);
    }
    return ng;
  });
  const merged = mergeGeometries(clean, false);
  if (!merged) throw new Error("mergeGeometries failed");
  return merged;
};

export const shade = (color: THREE.ColorRepresentation, amount: number) => {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amount)));
  return c;
};
