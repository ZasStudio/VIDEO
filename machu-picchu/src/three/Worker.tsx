import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Voxel Inca worker in an unku (tunic), ~1.9 units tall, facing +x (walking direction).

const TUNICS = ["#D62839", "#1E6BFF", "#F2A71B", "#1FA35B", "#8E3CCB"];
const SKIN = "#B87A4B";

export const Worker: React.FC<{
  phase: number;
  walk?: number;
  lean?: number;
  pull?: number;
  variant?: number;
  bob?: number;
}> = ({ phase, walk = 1, lean = 0.35, pull = 1, variant = 0, bob = 0 }) => {
  const geos = useMemo(
    () => ({
      body: new RoundedBoxGeometry(0.62, 0.95, 0.8, 2, 0.12),
      head: new RoundedBoxGeometry(0.56, 0.56, 0.56, 2, 0.1),
      hair: new RoundedBoxGeometry(0.6, 0.2, 0.6, 2, 0.06),
      limb: new RoundedBoxGeometry(0.22, 0.62, 0.24, 2, 0.08),
      band: new THREE.BoxGeometry(0.64, 0.16, 0.82),
    }),
    [],
  );
  const tunic = TUNICS[variant % TUNICS.length];
  const mats = useMemo(
    () => ({
      tunic: new THREE.MeshStandardMaterial({
        color: tunic,
        roughness: 0.8,
        emissive: tunic,
        emissiveIntensity: 0.12,
      }),
      band: new THREE.MeshStandardMaterial({
        color: "#FFF1D0",
        roughness: 0.8,
      }),
      skin: new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({
        color: "#1A1411",
        roughness: 0.6,
      }),
      leg: new THREE.MeshStandardMaterial({ color: "#6B4A33", roughness: 0.8 }),
    }),
    [tunic],
  );
  const s1 = Math.sin(phase) * walk;
  const s2 = Math.sin(phase + Math.PI) * walk;
  const y = Math.abs(Math.sin(phase)) * 0.06 * walk + bob;
  return (
    <group position={[0, y, 0]}>
      {/* Legs swing around the hip. */}
      <group position={[0, 0.62, 0.17]} rotation={[0, 0, s1 * 0.6]}>
        <mesh
          geometry={geos.limb}
          material={mats.leg}
          position={[0, -0.3, 0]}
        />
      </group>
      <group position={[0, 0.62, -0.17]} rotation={[0, 0, s2 * 0.6]}>
        <mesh
          geometry={geos.limb}
          material={mats.leg}
          position={[0, -0.3, 0]}
        />
      </group>
      <group position={[0, 0.62, 0]} rotation={[0, 0, -lean]}>
        <mesh
          geometry={geos.body}
          material={mats.tunic}
          position={[0, 0.45, 0]}
        />
        <mesh
          geometry={geos.band}
          material={mats.band}
          position={[0, 0.3, 0]}
        />
        <mesh
          geometry={geos.head}
          material={mats.skin}
          position={[0.04, 1.2, 0]}
        />
        <mesh
          geometry={geos.hair}
          material={mats.hair}
          position={[0.0, 1.46, 0]}
        />
        <mesh position={[0.29, 1.24, 0.12]}>
          <boxGeometry args={[0.04, 0.08, 0.08]} />
          <meshBasicMaterial color="#1A1411" />
        </mesh>
        <mesh position={[0.29, 1.24, -0.12]}>
          <boxGeometry args={[0.04, 0.08, 0.08]} />
          <meshBasicMaterial color="#1A1411" />
        </mesh>
        {/* Arms reach back to hold the rope over the shoulder. */}
        <group
          position={[0.05, 0.78, 0.44]}
          rotation={[0, 0, 1.9 * pull + s1 * 0.1]}
        >
          <mesh
            geometry={geos.limb}
            material={mats.skin}
            position={[0, -0.3, 0]}
          />
        </group>
        <group
          position={[0.05, 0.78, -0.44]}
          rotation={[0, 0, 1.7 * pull + s2 * 0.1]}
        >
          <mesh
            geometry={geos.limb}
            material={mats.skin}
            position={[0, -0.3, 0]}
          />
        </group>
      </group>
    </group>
  );
};
