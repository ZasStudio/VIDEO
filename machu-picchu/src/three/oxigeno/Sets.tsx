import React, { useMemo } from "react";
import * as THREE from "three";
import { V3, canvasTexture, toy, useFontsReady, useRounded, wrap } from "../inca/kit";
import { Halo, drawO2 } from "./Props";

// Sets for the oxygen short. Centred at the origin, ground at y = 0, world units sized for
// Nubi at size ≈ 2 (2 wide, 2 tall). `t` is time in seconds (frame / fps).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
const texMat = (tex: THREE.Texture, rough = 0.6, glow = 0.14) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: glow });
    texMatCache.set(tex, m);
  }
  return m;
};

// =======================================================================================
// Lab

const tiles = () =>
  canvasTexture(
    "oxi-lab-tiles",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#C9D6DE";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#FFFFFF" : "#BDEFE0";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 14);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const wallTiles = () =>
  canvasTexture(
    "oxi-lab-wall",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#4FB8C6";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#6BCFD9" : "#62C6D2";
          ctx.beginPath();
          ctx.roundRect(i * 64 + 3, j * 64 + 3, 58, 58, 8);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const chalkboard = () =>
  canvasTexture("oxi-lab-chalkboard", 1024, 640, (ctx, W, H) => {
    ctx.fillStyle = "#1F4A3C";
    ctx.fillRect(0, 0, W, H);
    // Smudges.
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      ctx.beginPath();
      ctx.ellipse(80 + ((i * 173) % 900), 90 + ((i * 97) % 480), 120, 40, i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    drawO2(ctx, 330, 300, 330, "#FFFFFF");
    // O=O molecule doodle.
    ctx.strokeStyle = "#FFE45C";
    ctx.lineWidth = 12;
    for (const x of [680, 860]) {
      ctx.beginPath();
      ctx.arc(x, 210, 62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(742, 196);
    ctx.lineTo(798, 196);
    ctx.moveTo(742, 224);
    ctx.lineTo(798, 224);
    ctx.stroke();
    ctx.font = "84px 'Lilita One', sans-serif";
    ctx.fillStyle = "#FFE45C";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("O", 680, 214);
    ctx.fillText("O", 860, 214);
    ctx.font = "120px 'Luckiest Guy', 'Lilita One', sans-serif";
    ctx.fillStyle = "#8EF0C0";
    ctx.fillText("21%", 770, 410);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(90, 540);
    ctx.bezierCurveTo(300, 500, 600, 580, 940, 530);
    ctx.stroke();
    // Frame shadow.
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, W - 16, H - 16);
  });

const poster = () =>
  canvasTexture("oxi-lab-poster", 512, 384, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    const cols = ["#FF5A5F", "#FFC21A", "#3AC47D", "#3A8BFF", "#B06CFF", "#FF8A1F"];
    const cw = (W - 40) / 8;
    const layout = ["1......2", "11....11", "11111111", "11111111"];
    layout.forEach((row, j) => {
      for (let i = 0; i < 8; i++) {
        if (row[i] === ".") continue;
        const isO = j === 1 && i === 6;
        ctx.fillStyle = isO ? "#18B8B0" : cols[(i + j * 3) % cols.length];
        ctx.beginPath();
        ctx.roundRect(20 + i * cw + 3, 40 + j * 78 + 3, cw - 6, 72, 8);
        ctx.fill();
        if (isO) {
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "56px 'Lilita One', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("O", 20 + i * cw + cw / 2, 40 + j * 78 + 42);
        }
      }
    });
  });

/** Glass material (shared). */
let glassMat: THREE.MeshStandardMaterial | null = null;
const glass = () =>
  (glassMat ??= new THREE.MeshStandardMaterial({
    color: "#DDF6FF",
    roughness: 0.08,
    transparent: true,
    opacity: 0.38,
    emissive: new THREE.Color("#DDF6FF"),
    emissiveIntensity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));

/** Rising bubbles above a point: they grow and shrink along the way (no transparency). */
const Bubbles: React.FC<{ t: number; color: string; height?: number; count?: number; r?: number; seed?: number; spread?: number }> = ({
  t,
  color,
  height = 0.5,
  count = 5,
  r = 0.04,
  seed = 0,
  spread = 0.05,
}) => {
  const geo = useMemo(() => new THREE.SphereGeometry(1, 14, 10), []);
  const mat = toy(color, { rough: 0.2, glow: 0.45 });
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const p = wrap(i / count + t * 0.7 + seed * 0.13, 1);
        const s = r * Math.sin(Math.PI * p) * (0.7 + 0.3 * Math.sin(i * 2.3 + seed));
        if (s <= 0.002) return null;
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[Math.sin(i * 2.1 + seed + p * 5) * spread, p * height, Math.cos(i * 1.7 + seed) * spread * 0.5]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

type FlaskKind = "erlenmeyer" | "round" | "beaker" | "tube";

/** Glass lab vessel with coloured liquid and bubbles. Base at the origin. */
const Flask: React.FC<{ kind: FlaskKind; color: string; t: number; seed?: number; position: V3; scale?: number }> = ({
  kind,
  color,
  t,
  seed = 0,
  position,
  scale = 1,
}) => {
  const geos = useMemo(() => {
    const lathe = (p: [number, number][]) =>
      new THREE.LatheGeometry(
        p.map(([r, h]) => new THREE.Vector2(r, h)),
        28,
      );
    return {
      erlenmeyer: {
        glass: lathe([[0, 0], [0.26, 0], [0.28, 0.03], [0.09, 0.42], [0.08, 0.6], [0.1, 0.62]]),
        liquid: lathe([[0, 0.01], [0.25, 0.01], [0.26, 0.03], [0.14, 0.27], [0, 0.27]]),
        top: 0.62,
        surface: 0.27,
      },
      round: {
        glass: lathe([[0, 0], [0.12, 0.01], [0.24, 0.1], [0.27, 0.24], [0.22, 0.4], [0.08, 0.48], [0.07, 0.7], [0.09, 0.72]]),
        liquid: lathe([[0, 0.02], [0.12, 0.03], [0.23, 0.11], [0.26, 0.24], [0, 0.24]]),
        top: 0.72,
        surface: 0.24,
      },
      beaker: {
        glass: lathe([[0, 0], [0.2, 0], [0.21, 0.02], [0.21, 0.44], [0.23, 0.46]]),
        liquid: lathe([[0, 0.01], [0.2, 0.01], [0.2, 0.28], [0, 0.28]]),
        top: 0.46,
        surface: 0.28,
      },
      tube: {
        glass: lathe([[0, 0], [0.04, 0.01], [0.065, 0.06], [0.065, 0.62], [0.08, 0.63]]),
        liquid: lathe([[0, 0.01], [0.04, 0.015], [0.06, 0.06], [0.06, 0.38], [0, 0.38]]),
        top: 0.63,
        surface: 0.38,
      },
    };
  }, []);
  const g = geos[kind];
  const liquid = toy(color, { rough: 0.25, glow: 0.4 });
  return (
    <group position={position} scale={scale}>
      <mesh geometry={g.liquid} material={liquid} />
      <mesh geometry={g.glass} material={glass()} renderOrder={2} />
      <group position={[0, kind === "erlenmeyer" || kind === "round" ? g.top : g.surface, 0]}>
        <Bubbles t={t} color={color} seed={seed} height={kind === "tube" ? 0.3 : 0.55} r={kind === "tube" ? 0.03 : 0.05} count={kind === "tube" ? 3 : 5} />
      </group>
    </group>
  );
};

/** Wall beacon: base, red dome, rotating reflector and two sweeping light beams. */
const Beacon: React.FC<{ alarm: number; t: number }> = ({ alarm, t }) => {
  const geos = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.34, 0.38, 0.18, 28),
      dome: new THREE.SphereGeometry(0.3, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      domeWall: new THREE.CylinderGeometry(0.3, 0.3, 0.26, 28, 1, true),
      reflector: new THREE.CylinderGeometry(0.2, 0.2, 0.3, 20, 1, true, 0, Math.PI),
      bulb: new THREE.SphereGeometry(0.09, 14, 10),
      beam: new THREE.ConeGeometry(0.42, 1.8, 24, 1, true),
      bracket: new THREE.BoxGeometry(0.5, 0.16, 0.5),
    }),
    [],
  );
  const a = clamp01(alarm);
  const angle = t * 7;
  const pulse = 0.65 + 0.35 * Math.max(0, Math.cos(angle));
  const domeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#FF2A2A",
        roughness: 0.2,
        transparent: true,
        opacity: 0.8,
        emissive: new THREE.Color("#FF2020"),
      }),
    [],
  );
  domeMat.emissiveIntensity = 0.25 + 1.4 * a * pulse;
  const beamMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#FF3030",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  );
  beamMat.opacity = 0.22 * a;
  return (
    <group>
      <mesh geometry={geos.bracket} material={toy("#2B2F38")} position={[0, -0.08, -0.1]} />
      <mesh geometry={geos.base} material={toy("#3A3F4A", { rough: 0.4 })} position={[0, 0.09, 0]} />
      <group position={[0, 0.18, 0]}>
        <group rotation={[0, angle, 0]} position={[0, 0.15, 0]}>
          <mesh geometry={geos.reflector} material={toy("#FFD65A", { metal: 0.6, rough: 0.25, glow: 0.3, side: THREE.DoubleSide })} />
          <mesh geometry={geos.bulb} material={toy("#FFF3C0", { glow: 0.3 + a })} position={[0, 0, 0.05]} />
          {a > 0.01
            ? [0, Math.PI].map((r) => (
                <mesh key={r} geometry={geos.beam} material={beamMat} rotation={[0, r, Math.PI / 2]} position={[r === 0 ? 0.9 : -0.9, 0, 0]} />
              ))
            : null}
        </group>
        <mesh geometry={geos.domeWall} material={domeMat} position={[0, 0.13, 0]} />
        <mesh geometry={geos.dome} material={domeMat} position={[0, 0.26, 0]} />
      </group>
      <Halo color="#FF3030" size={1.8} opacity={0.7 * a * pulse} position={[0, 0.4, 0.25]} />
      {a > 0.01 ? <pointLight color="#FF2A2A" intensity={6 * a * pulse} distance={7} decay={1.4} position={[0, 0.4, 0.6]} /> : null}
    </group>
  );
};

const JARS: [number, number, number, string][] = [
  // [x, shelf, height, colour]
  [-5.2, 0, 0.5, "#FF5A5F"],
  [-4.7, 0, 0.36, "#FFC21A"],
  [-4.25, 0, 0.56, "#3A8BFF"],
  [-3.7, 0, 0.42, "#3AC47D"],
  [-3.15, 0, 0.3, "#B06CFF"],
  [-5.15, 1, 0.34, "#3AC47D"],
  [-4.6, 1, 0.48, "#FF8A1F"],
  [-3.95, 1, 0.4, "#FF5A5F"],
  [-3.4, 1, 0.52, "#3A8BFF"],
];

export const LAB_WALL_Z = -3.2;

/**
 * Cartoon science lab (13 wide, 8 deep, wall 9 tall at z = -3.2, tall enough for vertical framing): mint-and-white tiled floor,
 * teal tiled wainscot, a wooden-framed chalkboard with "O₂", a molecule and "21%" (centre, above
 * Nubi's head), shelves of coloured jars and a workbench with bubbling flasks on the
 * screen-left, a periodic-table poster and a red warning beacon on the screen-right.
 * Keep Nubi (size ≈ 2) around x ∈ [-1.5, 2.5], z ∈ [-1, 2] (the BigRedButton fits at x ≈ 1.6).
 * `t` seconds (bubbles, beacon spin), `alarm` 0..1 turns the beacon on (beams, glow, red light).
 */
export const Lab: React.FC<{ t?: number; alarm?: number }> = ({ t = 0, alarm = 0 }) => {
  const ready = useFontsReady();
  const floor = useRounded(13, 0.3, 8, 0.1, 2);
  const wall = useRounded(13, 9, 0.3, 0.06, 2);
  const wainscot = useRounded(13, 1.5, 0.06, 0.03, 2);
  const trim = useRounded(13.1, 0.14, 0.18, 0.05, 2);
  const benchTop = useRounded(3.4, 0.14, 1.3, 0.05, 2);
  const benchBody = useRounded(3.2, 1.0, 1.15, 0.06, 2);
  const drawer = useRounded(0.95, 0.4, 0.05, 0.04, 2);
  const handle = useRounded(0.34, 0.07, 0.07, 0.03, 2);
  const shelf = useRounded(2.9, 0.1, 0.55, 0.04, 2);
  const bracket = useRounded(0.08, 0.3, 0.45, 0.03, 2);
  const frame = useRounded(3.9, 2.55, 0.14, 0.08, 2);
  const tray = useRounded(3.2, 0.1, 0.2, 0.04, 2);
  const posterFrame = useRounded(1.9, 1.5, 0.08, 0.05, 2);
  const rack = useRounded(0.8, 0.08, 0.26, 0.03, 2);
  const chalk = useRounded(0.18, 0.05, 0.05, 0.02, 1);
  const mats = useMemo(() => {
    const f = tiles();
    f.repeat.set(13 / 1.4, 8 / 1.4);
    const w = wallTiles();
    w.repeat.set(13 / 1.2, 1.5 / 1.2);
    return {
      floor: texMat(f, 0.55, 0.12),
      wainscot: new THREE.MeshStandardMaterial({ map: w, roughness: 0.4, emissive: new THREE.Color("#ffffff"), emissiveMap: w, emissiveIntensity: 0.14 }),
    };
  }, []);
  const jarGeo = useMemo(() => new THREE.CylinderGeometry(0.17, 0.17, 1, 20), []);
  const lidGeo = useMemo(() => new THREE.CylinderGeometry(0.19, 0.19, 0.08, 20), []);
  const wood = toy("#C98B4E", { rough: 0.6 });
  const woodDark = toy("#A96E38", { rough: 0.6 });
  const Z = LAB_WALL_Z;
  return (
    <group>
      <mesh geometry={floor} material={mats.floor} position={[0, -0.15, Z + 4]} receiveShadow />
      <mesh geometry={wall} material={toy("#D8F1F6", { rough: 0.8, glow: 0.12 })} position={[0, 4.5, Z - 0.15]} receiveShadow />
      <mesh geometry={wainscot} material={mats.wainscot} position={[0, 0.75, Z + 0.03]} />
      <mesh geometry={trim} material={toy("#FFFFFF", { rough: 0.5 })} position={[0, 1.52, Z + 0.06]} />
      <mesh geometry={trim} material={toy("#2F8F9C", { rough: 0.5 })} position={[0, 0.07, Z + 0.06]} />

      {/* Chalkboard with O₂. */}
      <group position={[0.3, 3.95, Z + 0.1]}>
        <mesh geometry={frame} material={wood} />
        {ready ? (
          <mesh position={[0, 0, 0.075]}>
            <planeGeometry args={[3.6, 2.25]} />
            <meshStandardMaterial map={chalkboard()} roughness={0.9} emissive="#ffffff" emissiveMap={chalkboard()} emissiveIntensity={0.18} />
          </mesh>
        ) : null}
        <mesh geometry={tray} material={woodDark} position={[0, -1.3, 0.12]} />
        <mesh geometry={chalk} material={toy("#FFFFFF")} position={[0.9, -1.23, 0.15]} />
        <mesh geometry={chalk} material={toy("#FFE45C")} position={[1.2, -1.23, 0.13]} rotation={[0, 0.3, 0]} />
      </group>

      {/* Shelves with jars (screen-left). */}
      {[0, 1].map((k) => (
        <group key={k} position={[-4.2, 2.75 + k * 1.05, Z + 0.3]}>
          <mesh geometry={shelf} material={wood} />
          {[-1.1, 1.1].map((x) => (
            <mesh key={x} geometry={bracket} material={woodDark} position={[x, -0.18, -0.03]} />
          ))}
        </group>
      ))}
      {JARS.map(([x, s, h, c], i) => (
        <group key={i} position={[x, 2.8 + s * 1.05, Z + 0.32]}>
          <mesh geometry={jarGeo} material={toy(c, { rough: 0.3, glow: 0.3 })} position={[0, h / 2, 0]} scale={[0.85, h, 0.85]} />
          <mesh geometry={jarGeo} material={glass()} position={[0, h / 2 + 0.02, 0]} scale={[1, h + 0.06, 1]} renderOrder={2} />
          <mesh geometry={lidGeo} material={toy("#F4F7FA", { rough: 0.4 })} position={[0, h + 0.08, 0]} />
        </group>
      ))}

      {/* Workbench with bubbling flasks (screen-left). */}
      <group position={[-3.9, 0, Z + 0.95]}>
        <mesh geometry={benchBody} material={toy("#F4F7FA", { rough: 0.5, glow: 0.1 })} position={[0, 0.5, 0]} castShadow receiveShadow />
        {[-0.95, 0.1, 1.05].map((x) => (
          <group key={x} position={[x * 0.95, 0.72, 0.585]}>
            <mesh geometry={drawer} material={toy("#7FD8E0", { rough: 0.45 })} />
            <mesh geometry={handle} material={toy("#2B2F38", { rough: 0.4 })} position={[0, 0.05, 0.05]} />
          </group>
        ))}
        {[-0.95, 0.1, 1.05].map((x) => (
          <mesh key={x} geometry={drawer} material={toy("#7FD8E0", { rough: 0.45 })} position={[x * 0.95, 0.26, 0.585]} />
        ))}
        <mesh geometry={benchTop} material={toy("#2B3A4A", { rough: 0.4, glow: 0.1 })} position={[0, 1.07, 0]} castShadow />
        <group position={[0, 1.14, 0.1]}>
          <Flask kind="erlenmeyer" color="#3AE07D" t={t} seed={1} position={[-1.15, 0, 0.05]} scale={1.15} />
          <Flask kind="round" color="#C06CFF" t={t} seed={2} position={[-0.4, 0, -0.15]} scale={1.05} />
          <Flask kind="beaker" color="#3AA8FF" t={t} seed={3} position={[0.3, 0, 0.15]} scale={1.1} />
          {/* Test-tube rack. */}
          <group position={[1.1, 0, -0.1]}>
            <mesh geometry={rack} material={wood} position={[0, 0.04, 0]} />
            <mesh geometry={rack} material={wood} position={[0, 0.4, 0]} />
            {[
              [-0.25, "#FF5A5F"],
              [0, "#FFC21A"],
              [0.25, "#FF8A1F"],
            ].map(([x, c], i) => (
              <Flask key={i} kind="tube" color={c as string} t={t} seed={4 + i} position={[x as number, 0.08, 0]} />
            ))}
          </group>
        </group>
      </group>

      {/* Poster and beacon (screen-right). */}
      <group position={[4.4, 2.8, Z + 0.06]}>
        <mesh geometry={posterFrame} material={toy("#FFFFFF", { rough: 0.5 })} />
        {ready ? (
          <mesh position={[0, 0, 0.045]}>
            <planeGeometry args={[1.76, 1.32]} />
            <meshStandardMaterial map={poster()} roughness={0.7} emissive="#ffffff" emissiveMap={poster()} emissiveIntensity={0.15} />
          </mesh>
        ) : null}
      </group>
      <group position={[4.4, 4.7, Z + 0.3]}>
        <Beacon alarm={alarm} t={t} />
      </group>
    </group>
  );
};

// =======================================================================================
// Stage

/**
 * Round two-tier platform (radius 2.6, top at y = 0.36) for showing props on their own.
 * Place things on it at y = STAGE_TOP.
 */
export const STAGE_TOP = 0.36;
export const Stage: React.FC<{ color?: string; radius?: number }> = ({ color = "#FFB547", radius = 2.6 }) => {
  const geos = useMemo(
    () => ({
      low: new THREE.CylinderGeometry(radius + 0.25, radius + 0.35, 0.16, 64),
      high: new THREE.CylinderGeometry(radius, radius + 0.05, 0.2, 64),
      rim: new THREE.TorusGeometry(radius, 0.05, 8, 64),
    }),
    [radius],
  );
  return (
    <group>
      <mesh geometry={geos.low} material={toy("#FFFFFF", { rough: 0.5, glow: 0.1 })} position={[0, 0.08, 0]} receiveShadow />
      <mesh geometry={geos.high} material={toy(color, { rough: 0.45 })} position={[0, 0.26, 0]} receiveShadow castShadow />
      <mesh geometry={geos.rim} material={toy("#FFFFFF", { rough: 0.4 })} position={[0, 0.36, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
};

// =======================================================================================
// Sky and clouds

/** Puff layout of one cloud: [x, y, z, radius]. */
const CLOUD_SHAPES: [number, number, number, number][][] = [
  [
    [0, 0, 0, 0.75],
    [-0.8, -0.15, 0.1, 0.55],
    [0.8, -0.12, 0.05, 0.6],
    [0.3, 0.35, -0.1, 0.55],
    [-0.35, 0.28, 0.15, 0.45],
  ],
  [
    [0, 0, 0, 0.6],
    [-0.65, -0.1, 0, 0.45],
    [0.7, -0.08, 0.05, 0.5],
    [0.15, 0.3, 0, 0.42],
  ],
  [
    [0, 0, 0, 0.7],
    [-0.9, -0.12, 0.05, 0.5],
    [0.95, -0.15, 0, 0.5],
    [-0.35, 0.32, 0.05, 0.5],
    [0.45, 0.26, -0.05, 0.48],
    [1.5, -0.25, 0, 0.32],
  ],
];

/** One fluffy low-poly cloud (≈ 2.8 wide at scale 1, flat bottom). */
export const Cloud: React.FC<{ shape?: number; position?: V3; scale?: number }> = ({ shape = 0, position = [0, 0, 0], scale = 1 }) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const puffs = CLOUD_SHAPES[shape % CLOUD_SHAPES.length];
  return (
    <group position={position} scale={scale}>
      {puffs.map(([x, y, z, r], i) => (
        <mesh
          key={i}
          geometry={geo}
          material={toy(i % 2 ? "#F4F9FF" : "#FFFFFF", { rough: 0.9, flat: true, glow: 0.35 })}
          position={[x, y, z]}
          scale={[r * 1.1, r * 0.85, r]}
          rotation={[i, i * 0.7, 0]}
        />
      ))}
    </group>
  );
};

type CloudSpec = { x: number; y: number; z: number; s: number; shape: number };
const CLOUDS: CloudSpec[] = [
  { x: -10, y: 3.2, z: -6, s: 1.2, shape: 0 },
  { x: -4.5, y: 0.4, z: -3, s: 0.9, shape: 1 },
  { x: 1.5, y: 4.2, z: -8, s: 1.5, shape: 2 },
  { x: 6.5, y: 1.2, z: -4, s: 1.0, shape: 0 },
  { x: 11, y: 3.6, z: -7, s: 1.3, shape: 1 },
  { x: -7.5, y: -1.8, z: -2, s: 0.8, shape: 2 },
  { x: 3.5, y: -2.2, z: -1.5, s: 0.9, shape: 1 },
  { x: 9, y: -1.2, z: -5, s: 1.1, shape: 2 },
];

/**
 * Scrolling clouds for the plane scene: 8 fluffy low-poly clouds spread over `span` (24) along
 * x, y -2.2..4.2, z -1.5..-8 (behind a plane at z ≈ 0). They drift towards -x at `speed` world
 * units per second (nearer ones faster, for parallax) and wrap around seamlessly. `t` seconds.
 */
export const Clouds: React.FC<{ t?: number; speed?: number; span?: number }> = ({ t = 0, speed = 2, span = 24 }) => (
  <group>
    {CLOUDS.map((c, i) => {
      const par = 1 / (1 + Math.abs(c.z) * 0.12);
      const x = wrap(c.x - t * speed * par + span / 2, span) - span / 2;
      return <Cloud key={i} shape={c.shape} position={[x, c.y, c.z]} scale={c.s} />;
    })}
  </group>
);

const skyTexture = () =>
  canvasTexture("oxi-sky", 16, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2F8BFF");
    g.addColorStop(0.55, "#7CC4FF");
    g.addColorStop(1, "#D8F0FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

/**
 * Sky backdrop for the plane scene: a big blue gradient plane at z = -12 (40 × 30, unlit) plus
 * the scrolling Clouds. Put the plane near the origin. `t` seconds, `speed` cloud drift.
 */
export const Sky: React.FC<{ t?: number; speed?: number; backdrop?: boolean }> = ({ t = 0, speed = 2, backdrop = true }) => (
  <group>
    {backdrop ? (
      <mesh position={[0, 1, -12]}>
        <planeGeometry args={[40, 30]} />
        <meshBasicMaterial map={skyTexture()} toneMapped={false} />
      </mesh>
    ) : null}
    <Clouds t={t} speed={speed} />
  </group>
);
