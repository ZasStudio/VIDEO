import React, { useMemo } from "react";
import * as THREE from "three";
import { mulberry } from "../noise";
import { BlobShadow } from "../BlobShadow";
import { canvasTexture, glowTexture, noise3, toy, useRounded } from "./kit";

// PapaBot: a potato that works as a voice assistant. Lumpy speckled potato body, two black
// Nubi-style eyes, pink blush and a floating cyan light ring that pulses while it talks.
// No mouth: like Nubi, it talks by bouncing (drive `hop` / `squash` with the voice).
// Model units like Nubi's (size = body width in world units, model scaled by size / 10): the
// potato is ≈10.5 wide, 7.2 tall and 8.2 deep, sitting on y = 0; the ring floats at y ≈ 10.

export type PapaBotPose = {
  hop?: number;
  /** 1 = rest, < 1 squashed, > 1 stretched (volume preserved, pivot at the bottom). */
  squash?: number;
  /** 0 = open, 1 = closed. */
  blink?: number;
  /** Brightness of the light ring and its beam (0 = off, 1 = normal, up to ~1.5). */
  glow?: number;
  /** Voice level 0..1: the ring swells and its segments light up. */
  talk?: number;
};

const P = { rx: 5.0, ry: 3.6, rz: 4.1, cy: 3.55 };

/** Radial lumpiness of the potato for a unit direction. */
const lump = (x: number, y: number, z: number) =>
  (1 + 0.1 * noise3(x * 1.1 + 3, y * 1.1, z * 1.1) + 0.04 * noise3(x * 2.9, y * 2.9 + 7, z * 2.9)) * (1 + 0.07 * x - 0.03 * y * x);

/** Point on the potato surface in the direction of the ellipsoid point (x, y, z). */
const surfacePoint = (x: number, y: number, front = 1) => {
  const ux = x / P.rx;
  const uy = y / P.ry;
  const uz = Math.sqrt(Math.max(0.02, 1 - ux * ux - uy * uy)) * front;
  const d = new THREE.Vector3(ux, uy, uz).normalize();
  const k = lump(d.x, d.y, d.z);
  const p = new THREE.Vector3(d.x * P.rx * k, d.y * P.ry * k, d.z * P.rz * k);
  const n = new THREE.Vector3(p.x / (P.rx * P.rx), p.y / (P.ry * P.ry), p.z / (P.rz * P.rz)).normalize();
  return { p, n };
};

/** Equirectangular potato skin: warm brown, blotches, speckles and a few "eyes". */
const potatoTexture = () =>
  canvasTexture("inca-potato-skin", 1024, 512, (ctx, W, H) => {
    const rnd = mulberry(61);
    ctx.fillStyle = "#C88A4A";
    ctx.fillRect(0, 0, W, H);
    // Stretch marks near the poles so spots stay round on the sphere.
    const spot = (u: number, v: number, r: number, color: string) => {
      const lat = (v / H - 0.5) * Math.PI;
      const sx = 1 / Math.max(0.25, Math.cos(lat));
      ctx.fillStyle = color;
      for (const du of [-W, 0, W]) {
        ctx.beginPath();
        ctx.ellipse(u + du, v, r * sx, r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (let i = 0; i < 70; i++) spot(rnd() * W, rnd() * H, 30 + rnd() * 60, rnd() < 0.5 ? "rgba(150,95,45,0.18)" : "rgba(230,175,110,0.2)");
    for (let i = 0; i < 520; i++) spot(rnd() * W, rnd() * H, 1.5 + rnd() * 3.5, rnd() < 0.75 ? "rgba(110,62,26,0.55)" : "rgba(245,205,150,0.5)");
    for (let i = 0; i < 14; i++) {
      const u = rnd() * W;
      const v = H * (0.2 + rnd() * 0.6);
      spot(u, v, 12, "rgba(235,190,130,0.55)");
      spot(u, v, 6.5, "rgba(95,52,20,0.8)");
    }
  });

export const PapaBot: React.FC<{
  size?: number;
  pose?: PapaBotPose;
  shadow?: boolean;
  shadowOpacity?: number;
  position?: [number, number, number];
  rotationY?: number;
}> = ({ size = 2, pose = {}, shadow = true, shadowOpacity = 0.35, position = [0, 0, 0], rotationY = 0 }) => {
  const { hop = 0, squash = 1, blink = 0, glow = 1, talk = 0 } = pose;
  const geos = useMemo(() => {
    const body = new THREE.SphereGeometry(1, 96, 64);
    // Poles at the potato's ends (±x), where the texture pinch is least visible.
    body.rotateZ(Math.PI / 2);
    const p = body.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = lump(x, y, z);
      let py = y * P.ry * k;
      // Flatten the bottom so it sits.
      const floor = -P.ry * 0.86;
      if (py < floor) py = floor + (py - floor) * 0.25;
      p.setXYZ(i, x * P.rx * k, py + P.cy, z * P.rz * k);
    }
    body.computeVertexNormals();
    const ring = new THREE.TorusGeometry(3.1, 0.24, 14, 96);
    ring.rotateX(Math.PI / 2);
    const ringThin = new THREE.TorusGeometry(3.7, 0.07, 8, 96);
    ringThin.rotateX(Math.PI / 2);
    const disc = new THREE.CircleGeometry(3.4, 48);
    disc.rotateX(-Math.PI / 2);
    const beam = new THREE.CylinderGeometry(3.0, 1.2, 2.4, 40, 1, true);
    // A light ray lying in the ring plane, pointing outwards (+x), base at the origin.
    const seg = new THREE.CapsuleGeometry(0.13, 1, 3, 8);
    seg.rotateZ(Math.PI / 2);
    seg.translate(0.5, 0, 0);
    return { body, ring, ringThin, disc, beam, blush: new THREE.SphereGeometry(1, 20, 12), seg };
  }, []);
  const eye = useRounded(1.1, 1.8, 0.5, 0.22);

  const features = useMemo(() => {
    const eyes = [-1, 1].map((k) => surfacePoint(k * 1.75, 0.85));
    const blush = [-1, 1].map((k) => surfacePoint(k * 3.15, -0.25));
    const q = (n: THREE.Vector3) => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return {
      eyes: eyes.map(({ p, n }) => ({ p: p.clone().addScaledVector(n, 0.02).add(new THREE.Vector3(0, P.cy, 0)), q: q(n) })),
      blush: blush.map(({ p, n }) => ({ p: p.clone().add(new THREE.Vector3(0, P.cy, 0)), q: q(n) })),
    };
  }, []);

  const skin = useMemo(() => {
    const tex = potatoTexture();
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.78,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: 0.13,
    });
  }, []);
  const mats = useMemo(
    () => ({
      ring: new THREE.MeshBasicMaterial({ color: "#46F2FF", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      thin: new THREE.MeshBasicMaterial({ color: "#8FF8FF", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      seg: new THREE.MeshBasicMaterial({ color: "#E6FFFF", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      halo: new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#3FE8FF", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
      beam: new THREE.MeshBasicMaterial({
        color: "#3FE8FF",
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    }),
    [],
  );
  const g = Math.max(0, glow);
  const tk = Math.max(0, Math.min(1, talk));
  mats.ring.opacity = Math.min(1, g * (0.75 + 0.25 * tk));
  mats.thin.opacity = Math.min(1, g * (0.3 + 0.4 * tk));
  mats.seg.opacity = Math.min(1, g * (0.35 + 0.65 * tk));
  mats.halo.opacity = Math.min(1, g * (0.35 + 0.35 * tk));
  mats.beam.opacity = Math.min(1, g * (0.07 + 0.08 * tk));

  const s = size / 10;
  const sq = Math.max(0.3, squash);
  const sx = 1 / Math.sqrt(sq);
  const eyeH = Math.max(0.1, 1 - blink);
  const ringScale = 1 + 0.14 * tk;
  const SEGS = 12;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={s}>
      {shadow ? <BlobShadow radius={6 - Math.min(2.5, hop * 0.25)} opacity={shadowOpacity * Math.max(0.35, 1 - hop * 0.06)} /> : null}
      <group position={[0, hop, 0]}>
        <group scale={[sx, sq, sx]}>
          <mesh geometry={geos.body} material={skin} castShadow />
          {features.eyes.map((e, i) => (
            <group key={i} position={e.p} quaternion={e.q}>
              <mesh geometry={eye} material={toy("#151515", { rough: 0.3, glow: 0 })} scale={[1, eyeH, 1]} />
            </group>
          ))}
          {features.blush.map((b, i) => (
            <mesh key={i} geometry={geos.blush} material={toy("#FF8FA8", { rough: 0.5, glow: 0.35 })} position={b.p} quaternion={b.q} scale={[0.78, 0.42, 0.16]} />
          ))}
        </group>
        {/* Voice-assistant light ring floating above (not squashed, just carried by the hop). */}
        {g > 0.001 ? (
          <group position={[0, 10.1 + tk * 0.3, 0]}>
            <mesh geometry={geos.beam} material={mats.beam} position={[0, -1.35, 0]} renderOrder={2} />
            {/* Tilted towards the camera so it reads as a ring, not a line. */}
            <group rotation={[0.38, 0, 0]}>
              <mesh geometry={geos.disc} material={mats.halo} scale={ringScale * 1.3} renderOrder={2} />
              <group scale={ringScale}>
                <mesh geometry={geos.ring} material={mats.ring} renderOrder={3} />
                <mesh geometry={geos.ringThin} material={mats.thin} renderOrder={3} />
                {Array.from({ length: SEGS }).map((_, i) => {
                  const a = (i / SEGS) * Math.PI * 2;
                  const len = 0.15 + tk * (0.45 + 0.5 * Math.abs(Math.sin(i * 1.7 + tk * 3)));
                  return (
                    <group key={i} rotation={[0, -a, 0]}>
                      <mesh geometry={geos.seg} material={mats.seg} position={[3.45, 0, 0]} scale={[len, 1, 1]} renderOrder={4} />
                    </group>
                  );
                })}
              </group>
            </group>
          </group>
        ) : null}
      </group>
    </group>
  );
};
