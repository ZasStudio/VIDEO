import React, { useMemo } from "react";
import * as THREE from "three";
import { canvasTexture, gold, goldDark, toy, useFontsReady, useRounded } from "../inca/kit";
import { NUBI_BODY } from "../inca/Costumes";

// Costumes for the oxygen short. Every piece is in Nubi's model space (body 10 wide, y 2.5..9.9,
// front face z = +4.4) and is a child of <Nubi> with no transform, so it follows hop and squash.
// Nubi's eyes (x = ±2.3, y 4.6..6.4 at rest, up to 4.3..6.7 with eyeScale 1.35) stay free:
// nothing here crosses the region |x| < 3.05, 4.25 < y < 6.8 on the front face, and pieces
// that come close sit behind the eye bars (z < 4.7).

// ---------------------------------------------------------------------------------------
// Sleeve geometry around the rounded body (same cross-section as inca/Costumes' bands), with
// an optional opening at the front (|x| < gap on the front face) for open coats.

type RingPt = { x: number; z: number; nx: number; nz: number };

const ringPath = (seg: number, gap: number): RingPt[] => {
  const { a, b, r } = NUBI_BODY;
  const pts: RingPt[] = [{ x: gap, z: b, nx: 0, nz: 1 }];
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
  pts.push({ x: -gap, z: b, nx: 0, nz: 1 });
  return pts;
};

type Sleeve = { y0: number; y1: number; t0: number; t1: number; bulge?: number; rows?: number; gap?: number };

const sleeveGeometry = (s: Sleeve) => {
  const rows = s.rows ?? 5;
  const bulge = s.bulge ?? 0;
  const path = ringPath(8, s.gap ?? 0);
  const N = path.length;
  const H = s.y1 - s.y0;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const tAt = (v: number) => s.t0 + (s.t1 - s.t0) * v + bulge * Math.sin(Math.PI * v);
  const slope = (v: number) => (s.t1 - s.t0 + bulge * Math.PI * Math.cos(Math.PI * v)) / H;
  const n = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const t = tAt(v);
    const k = slope(v);
    for (const p of path) {
      pos.push(p.x + p.nx * t, s.y0 + H * v, p.z + p.nz * t);
      n.set(p.nx, -k, p.nz).normalize();
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      idx.push(A, A + 1, A + N + 1, A, A + N + 1, A + N);
    }
  }
  const cap = (y: number, tOut: number, up: boolean) => {
    const base = pos.length / 3;
    for (const p of path) {
      pos.push(p.x + p.nx * tOut, y, p.z + p.nz * tOut, p.x - p.nx * 0.4, y, p.z - p.nz * 0.4);
      nrm.push(0, up ? 1 : -1, 0, 0, up ? 1 : -1, 0);
    }
    for (let i = 0; i < N - 1; i++) {
      const o = base + i * 2;
      if (up) idx.push(o, o + 2, o + 3, o, o + 3, o + 1);
      else idx.push(o, o + 3, o + 2, o, o + 1, o + 3);
    }
  };
  cap(s.y1, tAt(1), true);
  cap(s.y0, tAt(0), false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
};

/** Flat outline (x, y in model units) extruded towards +z from z0 by depth, softly bevelled. */
const panelGeometry = (pts: [number, number][], z0: number, depth: number, bevel = 0.06) => {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
  });
  g.translate(0, 0, z0);
  return g;
};

const mirrorX = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]).reverse();

// ---------------------------------------------------------------------------------------
// Lab coat

const COAT = "#F4F7FA";
const COAT_SHADE = "#DCE5EC";

/**
 * White lab coat: a skirt-like band round the lower body (y 2.0 → 4.3) with two buttons in the
 * middle, the open coat round the sides and back up to y 8.9, front panels and folded lapels
 * at the front sides (inner edge at |x| ≥ 3.05, so the eyes and the green face stay free), a
 * collar round the top edge and a breast pocket on the screen-left with a blue and a red pen.
 * Child of <Nubi>; no transform needed. The fins come out through the coat like arms.
 */
export const LabCoat: React.FC = () => {
  const geos = useMemo(() => {
    const panelR: [number, number][] = [
      [3.05, 4.15],
      [4.75, 4.15],
      [4.75, 8.95],
      [3.55, 8.95],
    ];
    const lapelR: [number, number][] = [
      [3.55, 8.95],
      [4.7, 8.95],
      [4.7, 7.9],
      [3.35, 6.8],
    ];
    const collarR: [number, number][] = [
      [3.35, 9.05],
      [4.85, 9.05],
      [4.85, 9.95],
      [3.1, 9.95],
      [2.7, 8.6],
    ];
    return {
      skirt: sleeveGeometry({ y0: 2.0, y1: 4.3, t0: 0.5, t1: 0.16, bulge: 0.08, rows: 6 }),
      upper: sleeveGeometry({ y0: 4.2, y1: 9.0, t0: 0.16, t1: 0.16, bulge: 0.05, rows: 6, gap: 4.1 }),
      collarBand: sleeveGeometry({ y0: 8.95, y1: 9.75, t0: 0.26, t1: 0.36, rows: 3, gap: 4.1 }),
      panelR: panelGeometry(panelR, 4.44, 0.12),
      panelL: panelGeometry(mirrorX(panelR), 4.44, 0.12),
      lapelR: panelGeometry(lapelR, 4.62, 0.08),
      lapelL: panelGeometry(mirrorX(lapelR), 4.62, 0.08),
      collarR: panelGeometry(collarR, 4.5, 0.1),
      collarL: panelGeometry(mirrorX(collarR), 4.5, 0.1),
      button: new THREE.CylinderGeometry(0.26, 0.26, 0.14, 20),
      pen: new THREE.CylinderGeometry(0.15, 0.15, 1.3, 14),
      penCap: new THREE.CylinderGeometry(0.16, 0.16, 0.5, 14),
      clip: new THREE.BoxGeometry(0.08, 0.5, 0.06),
      penTop: new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    };
  }, []);
  const pocket = useRounded(1.7, 1.3, 0.16, 0.08, 2);
  const pocketFlap = useRounded(1.78, 0.26, 0.2, 0.08, 2);
  const white = toy(COAT, { rough: 0.7, glow: 0.1, side: THREE.DoubleSide });
  const shade = toy(COAT_SHADE, { rough: 0.7, glow: 0.1 });
  const pens: [number, string][] = [
    [-3.95, "#2F6BFF"],
    [-3.4, "#E8383D"],
  ];
  return (
    <group>
      <mesh geometry={geos.skirt} material={white} castShadow />
      <mesh geometry={geos.upper} material={white} castShadow />
      <mesh geometry={geos.collarBand} material={white} />
      <mesh geometry={geos.panelR} material={white} />
      <mesh geometry={geos.panelL} material={white} />
      <mesh geometry={geos.lapelR} material={shade} />
      <mesh geometry={geos.lapelL} material={shade} />
      <mesh geometry={geos.collarR} material={white} />
      <mesh geometry={geos.collarL} material={white} />
      {[2.75, 3.65].map((y) => (
        <mesh key={y} geometry={geos.button} material={toy("#9AA8B5", { rough: 0.4 })} position={[0, y, 4.84]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      {/* Breast pocket with pens, low on the screen-left, well outside the eye. */}
      {pens.map(([x, c]) => (
        <group key={x} position={[x, 3.85, 4.86]}>
          <mesh geometry={geos.pen} material={toy(c, { rough: 0.35 })} position={[0, -0.25, 0]} />
          <mesh geometry={geos.penCap} material={toy(c, { rough: 0.35 })} position={[0, 0.3, 0]} />
          <mesh geometry={geos.penTop} material={toy(c, { rough: 0.35 })} position={[0, 0.55, 0]} />
          <mesh geometry={geos.clip} material={toy("#D9E1EA", { metal: 0.6, rough: 0.3 })} position={[0, 0.2, 0.17]} />
        </group>
      ))}
      <mesh geometry={pocket} material={shade} position={[-3.65, 3.05, 4.84]} />
      <mesh geometry={pocketFlap} material={white} position={[-3.65, 3.62, 4.9]} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// Safety goggles pushed up onto the head

/**
 * Big round safety goggles pushed up onto the top of the head: an orange strap round the top
 * edge of the body (y 9.05 → 9.5) and two chunky lenses lying on the top, tilted towards the
 * camera. Well above the eyes. Child of <Nubi>; no transform needed.
 */
export const Goggles: React.FC<{ color?: string }> = ({ color = "#FF8A1F" }) => {
  const geos = useMemo(
    () => ({
      strap: sleeveGeometry({ y0: 9.05, y1: 9.5, t0: 0.18, t1: 0.18, bulge: 0.04, rows: 3 }),
      cup: new THREE.CylinderGeometry(1.45, 1.55, 0.6, 36),
      rim: new THREE.TorusGeometry(1.42, 0.22, 12, 40),
      lens: new THREE.CylinderGeometry(1.25, 1.25, 0.1, 36),
      glint: new THREE.CircleGeometry(0.34, 18),
      bridge: new THREE.CylinderGeometry(0.28, 0.28, 0.9, 14),
      buckle: new THREE.BoxGeometry(0.34, 0.9, 1.1),
    }),
    [],
  );
  const frame = toy(color, { rough: 0.35, glow: 0.16 });
  const lens = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#9FE6FF",
        roughness: 0.08,
        emissive: new THREE.Color("#9FE6FF"),
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  );
  return (
    <group>
      <mesh geometry={geos.strap} material={toy("#2B2F38", { rough: 0.6 })} />
      {/* Strap buckles where it meets the goggles' sides. */}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.buckle} material={frame} position={[s * 5.2, 9.28, 2.6]} />
      ))}
      <group position={[0, 10.2, 2.7]} rotation={[0.85, 0, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 1.72, 0, 0]}>
            <mesh geometry={geos.cup} material={frame} castShadow />
            <mesh geometry={geos.rim} material={frame} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={geos.lens} material={lens} position={[0, 0.3, 0]} />
            <mesh geometry={geos.glint} material={toy("#FFFFFF", { glow: 0.8 })} position={[-0.45, 0.37, -0.45]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.6, 1]} />
          </group>
        ))}
        <mesh geometry={geos.bridge} material={frame} position={[0, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} />
      </group>
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// Firefighter helmet

const helmetBadge = () =>
  canvasTexture("oxi-helmet-badge", 256, 256, (ctx, W, H) => {
    ctx.fillStyle = "#16181D";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFD65A";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "170px 'Luckiest Guy', 'Lilita One', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("1", W / 2 + 4, H / 2 + 18);
  });

/**
 * Classic red firefighter helmet sitting on top of the body: glossy dome with a comb and two
 * side ribs, a wide brim that runs long at the back and dips down, and a gold shield on the
 * front with a black "1" disc. The brim sits at y ≈ 9.3 (3 units above the eyes).
 * Child of <Nubi>; no transform needed.
 */
export const FireHelmet: React.FC<{ color?: string }> = ({ color = "#E3262B" }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => {
    const dome = new THREE.SphereGeometry(1, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    // Brim: ellipse in plan, front edge just past the face, long tail at the back that dips.
    const brimShape = new THREE.Shape();
    brimShape.absellipse(0, 1.9, 6.4, 7.1, 0, Math.PI * 2, false, 0);
    const brim = new THREE.ExtrudeGeometry(brimShape, {
      depth: 0.32,
      bevelEnabled: true,
      bevelSize: 0.14,
      bevelThickness: 0.12,
      bevelSegments: 3,
      curveSegments: 48,
    });
    brim.rotateX(-Math.PI / 2);
    const p = brim.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i);
      const x = p.getX(i);
      const back = Math.max(0, -z - 3.2);
      const side = Math.max(0, Math.abs(x) - 5.3);
      p.setY(i, p.getY(i) - 0.045 * back * back - 0.12 * side * side + (z > 4.6 ? (z - 4.6) * 0.2 : 0));
    }
    brim.computeVertexNormals();
    // Comb / ribs: a half-elliptic arch over the dome.
    const arch = (rz: number, ry: number, th: number, depth: number) => {
      const s = new THREE.Shape();
      s.absellipse(0, 0, rz + th, ry + th, 0, Math.PI, false, 0);
      s.lineTo(-rz, 0);
      s.absellipse(0, 0, rz, ry, Math.PI, 0, true, 0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 40 });
      g.translate(0, 0, -depth / 2);
      g.rotateY(Math.PI / 2);
      return g;
    };
    const shield = new THREE.Shape();
    shield.moveTo(0, -1.55);
    shield.quadraticCurveTo(1.35, -1.0, 1.45, 0.2);
    shield.quadraticCurveTo(1.5, 1.2, 0.95, 1.55);
    shield.quadraticCurveTo(0.45, 1.25, 0, 1.6);
    shield.quadraticCurveTo(-0.45, 1.25, -0.95, 1.55);
    shield.quadraticCurveTo(-1.5, 1.2, -1.45, 0.2);
    shield.quadraticCurveTo(-1.35, -1.0, 0, -1.55);
    const shieldGeo = new THREE.ExtrudeGeometry(shield, { depth: 0.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 3, curveSegments: 16 });
    return {
      dome,
      brim,
      comb: arch(4.95, 3.05, 0.35, 0.9),
      rib: arch(5.05, 3.05, 0.2, 0.45),
      shield: shieldGeo,
      disc: new THREE.CircleGeometry(0.95, 36),
      holder: new THREE.SphereGeometry(0.45, 18, 12),
    };
  }, []);
  const red = toy(color, { rough: 0.25, glow: 0.16 });
  return (
    <group>
      <mesh geometry={geos.brim} material={red} position={[0, 9.25, 0]} castShadow />
      <group position={[0, 9.5, -0.3]}>
        <mesh geometry={geos.dome} material={red} scale={[5.3, 3.0, 5.0]} castShadow />
        <mesh geometry={geos.comb} material={red} />
        {[-0.62, 0.62].map((a) => (
          <group key={a} rotation={[0, a, 0]}>
            <mesh geometry={geos.rib} material={red} scale={[1.02, 1, 1]} />
          </group>
        ))}
      </group>
      {/* Gold front shield on a little holder. */}
      <mesh geometry={geos.holder} material={goldDark()} position={[0, 11.9, 4.05]} scale={[1.2, 0.8, 0.8]} />
      <group position={[0, 11.0, 4.55]} rotation={[-0.32, 0, 0]}>
        <mesh geometry={geos.shield} material={gold()} castShadow />
        {ready ? <mesh geometry={geos.disc} position={[0, 0.02, 0.32]} material={badgeMat()} /> : null}
      </group>
    </group>
  );
};

let badgeMatCache: THREE.MeshStandardMaterial | null = null;
const badgeMat = () =>
  (badgeMatCache ??= new THREE.MeshStandardMaterial({
    map: helmetBadge(),
    roughness: 0.4,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: helmetBadge(),
    emissiveIntensity: 0.2,
  }));

// ---------------------------------------------------------------------------------------
// Aviator cap, goggles and scarf

const LEATHER = "#8B5A2B";
const LEATHER_DARK = "#6B4020";
const FLEECE = "#F3E6C8";

/**
 * Brown leather aviator cap over the top of the body with a cream fleece rim (y ≈ 8.0), ear
 * flaps on both sides (down to y 6.1, outside the eyes and above the fins), brass aviator
 * goggles resting on the cap's front, and a white scarf round the lower body (y 3.3 → 4.25,
 * behind the eye bars) knotted at the screen-right front corner with a two-part tail.
 * `flutter` = scarf phase (radians, e.g. frame * 0.45) and `wind` 0..1 how far the tail streams
 * out sideways (0 = hangs down, 1 = flies horizontally); `side` = 1 knot and tail on the
 * screen-right, -1 screen-left (point it away from the direction of travel). `scarf` = false
 * leaves the scarf out. Child of <Nubi>; no transform needed.
 */
export const PilotCap: React.FC<{ flutter?: number; wind?: number; side?: 1 | -1; scarf?: boolean }> = ({
  flutter = 0,
  wind = 0.4,
  side = 1,
  scarf = true,
}) => {
  const geos = useMemo(
    () => ({
      rim: sleeveGeometry({ y0: 7.75, y1: 8.4, t0: 0.5, t1: 0.42, bulge: 0.12, rows: 4 }),
      strap: sleeveGeometry({ y0: 8.6, y1: 9.3, t0: 0.55, t1: 0.52, rows: 3 }),
      scarf: sleeveGeometry({ y0: 3.3, y1: 4.25, t0: 0.32, t1: 0.2, bulge: 0.16, rows: 5 }),
      lensCup: new THREE.CylinderGeometry(1.08, 1.12, 0.6, 32),
      lensRim: new THREE.TorusGeometry(1.0, 0.17, 12, 40),
      lens: new THREE.CircleGeometry(0.92, 32),
      glint: new THREE.CircleGeometry(0.26, 16),
      bridge: new THREE.CylinderGeometry(0.2, 0.2, 1.0, 12),
      buckle: new THREE.TorusGeometry(0.34, 0.09, 8, 4),
    }),
    [],
  );
  const shell = useRounded(10.7, 2.4, 9.5, 0.95, 5);
  const seam = useRounded(0.45, 0.3, 9.2, 0.14, 2);
  const flap = useRounded(0.5, 2.6, 2.7, 0.24, 3);
  const flapFleece = useRounded(0.35, 2.85, 2.95, 0.26, 3);
  const knot = useRounded(1.6, 1.4, 1.1, 0.5, 3);
  const tailSeg = useRounded(1.7, 1.5, 0.26, 0.12, 2);
  const leather = toy(LEATHER, { rough: 0.55, glow: 0.14 });
  const leatherDark = toy(LEATHER_DARK, { rough: 0.6, glow: 0.12 });
  const fleece = toy(FLEECE, { rough: 0.9, glow: 0.16 });
  const cloth = toy("#FFFFFF", { rough: 0.8, glow: 0.12, side: THREE.DoubleSide });
  const brass = toy("#D9A441", { metal: 0.55, rough: 0.3, glow: 0.18 });
  const lensMat = toy("#8FDFFF", { rough: 0.08, glow: 0.35 });
  const w = Math.max(0, Math.min(1, wind));
  // Tail: hangs down (angle 0) → flies out sideways (π/2) with the wind, waving with `flutter`.
  const base = 0.25 + w * 1.15;
  const amp = 0.12 + 0.22 * w;
  return (
    <group>
      <mesh geometry={shell} material={leather} position={[0, 9.1, 0]} castShadow />
      <mesh geometry={seam} material={leatherDark} position={[0, 10.3, 0]} />
      <mesh geometry={geos.rim} material={fleece} />
      <mesh geometry={geos.strap} material={leatherDark} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 5.3, 7.3, 0.9]}>
          <mesh geometry={flapFleece} material={fleece} position={[-s * 0.05, -0.1, 0]} />
          <mesh geometry={flap} material={leather} position={[s * 0.12, 0, 0]} castShadow />
          <mesh geometry={geos.buckle} material={brass} position={[s * 0.4, -0.7, 0.3]} rotation={[0, s * Math.PI / 2, Math.PI / 4]} />
        </group>
      ))}
      {/* Aviator goggles resting on the cap's front. */}
      <group position={[0, 9.0, 4.85]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 1.6, 0, 0]}>
            <mesh geometry={geos.lensCup} material={brass} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.1]} />
            <mesh geometry={geos.lensRim} material={brass} position={[0, 0, 0.42]} />
            <mesh geometry={geos.lens} material={lensMat} position={[0, 0, 0.41]} />
            <mesh geometry={geos.glint} material={toy("#FFFFFF", { glow: 0.8 })} position={[-0.32, 0.32, 0.43]} scale={[1, 0.65, 1]} />
          </group>
        ))}
        <mesh geometry={geos.bridge} material={brass} position={[0, 0.05, 0.25]} rotation={[0, 0, Math.PI / 2]} />
      </group>
      {scarf ? (
        <group>
          <mesh geometry={geos.scarf} material={cloth} castShadow />
          <group scale={[side, 1, 1]}>
            <group position={[4.35, 3.75, 4.3]}>
              <mesh geometry={knot} material={cloth} />
              <group position={[0.2, -0.2, 0.25]} rotation={[0, -0.35, base + Math.sin(flutter) * amp]}>
                <mesh geometry={tailSeg} material={cloth} position={[0, -0.75, 0]} />
                <group position={[0, -1.4, 0]} rotation={[0, 0, Math.sin(flutter - 1.1) * amp * 1.6 + w * 0.15]}>
                  <mesh geometry={tailSeg} material={cloth} position={[0, -0.72, 0]} scale={[0.92, 1, 1]} />
                  <group position={[0, -1.38, 0]} rotation={[0, 0, Math.sin(flutter - 2.2) * amp * 2 + w * 0.1]}>
                    <mesh geometry={tailSeg} material={cloth} position={[0, -0.6, 0]} scale={[0.82, 0.85, 1]} />
                    {[-0.5, 0, 0.5].map((x) => (
                      <mesh key={x} geometry={tailSeg} material={toy("#E8383D", { rough: 0.8 })} position={[x, -1.2, 0]} scale={[0.14, 0.18, 0.9]} />
                    ))}
                  </group>
                </group>
              </group>
            </group>
          </group>
        </group>
      ) : null}
    </group>
  );
};
