import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Small 3D props built from primitives.

const Std: React.FC<{
  color: string;
  rough?: number;
  metal?: number;
  emissive?: number;
  flat?: boolean;
}> = ({ color, rough = 0.5, metal = 0, emissive = 0.12, flat = false }) => (
  <meshStandardMaterial
    color={color}
    roughness={rough}
    metalness={metal}
    emissive={color}
    emissiveIntensity={emissive}
    flatShading={flat}
  />
);

/** Wooden cart wheel. */
export const Wheel: React.FC = () => (
  <group>
    <mesh>
      <torusGeometry args={[1, 0.2, 12, 40]} />
      <Std color="#8A4B22" rough={0.7} />
    </mesh>
    <mesh>
      <torusGeometry args={[1.08, 0.08, 8, 40]} />
      <Std color="#3C3F46" metal={0.6} rough={0.35} />
    </mesh>
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
        <boxGeometry args={[0.14, 1.9, 0.12]} />
        <Std color="#A0602E" rough={0.7} />
      </mesh>
    ))}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.28, 0.28, 0.4, 20]} />
      <Std color="#5E3417" rough={0.6} />
    </mesh>
  </group>
);

/** Iron hammer / pick. */
export const IronHammer: React.FC = () => (
  <group rotation={[0, 0, -0.5]}>
    <mesh position={[0, -0.35, 0]}>
      <cylinderGeometry args={[0.12, 0.14, 2.1, 12]} />
      <Std color="#9A5A2A" rough={0.7} />
    </mesh>
    <mesh position={[0, 0.8, 0]}>
      <boxGeometry args={[1.5, 0.46, 0.46]} />
      <Std color="#8C939E" metal={0.85} rough={0.3} emissive={0.05} />
    </mesh>
    <mesh position={[0.86, 0.8, 0]} rotation={[0, 0, -Math.PI / 2]}>
      <coneGeometry args={[0.23, 0.5, 4]} />
      <Std color="#8C939E" metal={0.85} rough={0.3} emissive={0.05} />
    </mesh>
  </group>
);

/** Cement bag. */
export const CementBag: React.FC = () => {
  const geo = useMemo(() => new RoundedBoxGeometry(1.5, 1.9, 0.7, 4, 0.28), []);
  return (
    <group rotation={[0.1, -0.3, 0.1]}>
      <mesh geometry={geo}>
        <Std color="#D9CBB0" rough={0.9} />
      </mesh>
      <mesh position={[0, 0.1, 0.36]}>
        <boxGeometry args={[1.1, 0.5, 0.02]} />
        <Std color="#6E7480" rough={0.8} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1.2, 0.18, 0.5]} />
        <Std color="#C4B593" rough={0.9} />
      </mesh>
    </group>
  );
};

/** Red "prohibited" sign; `k` animates it in (0..1). */
export const NoSign: React.FC<{ k?: number; radius?: number }> = ({
  k = 1,
  radius = 1.45,
}) => (
  <group scale={Math.max(0.001, k)} position={[0, 0, 0.9]}>
    <mesh>
      <torusGeometry args={[radius, 0.2, 14, 48]} />
      <Std color="#FF2D2D" rough={0.3} emissive={0.35} />
    </mesh>
    <mesh rotation={[0, 0, -Math.PI / 4]}>
      <boxGeometry args={[radius * 2, 0.36, 0.3]} />
      <Std color="#FF2D2D" rough={0.3} emissive={0.35} />
    </mesh>
  </group>
);

/** Map pin (teardrop). Tip at the origin. */
export const MapPin: React.FC<{ color?: string }> = ({ color = "#FF2E4D" }) => (
  <group>
    <mesh position={[0, 3.1, 0]}>
      <sphereGeometry args={[1.5, 32, 24]} />
      <Std color={color} rough={0.25} emissive={0.25} />
    </mesh>
    <mesh position={[0, 1.35, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[1.28, 2.7, 32, 1, true]} />
      <Std color={color} rough={0.25} emissive={0.25} />
    </mesh>
    <mesh position={[0, 3.15, 1.25]}>
      <sphereGeometry args={[0.55, 24, 16]} />
      <Std color="#FFFFFF" rough={0.3} emissive={0.4} />
    </mesh>
  </group>
);

/** Golden Inti sun disk with rays and a simple face. */
export const IntiSun: React.FC<{ spin?: number }> = ({ spin = 0 }) => {
  const gold = "#FFC21A";
  return (
    <group>
      <group rotation={[0, 0, spin]}>
        {Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2;
          const long = i % 2 === 0;
          const r = long ? 2.55 : 2.35;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r, Math.sin(a) * r, -0.05]}
              rotation={[0, 0, a - Math.PI / 2]}
            >
              <coneGeometry args={[long ? 0.42 : 0.3, long ? 1.4 : 0.95, 4]} />
              <Std
                color={long ? gold : "#FF9F0A"}
                metal={0.6}
                rough={0.25}
                emissive={0.25}
              />
            </mesh>
          );
        })}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.5, 48]} />
        <Std color={gold} metal={0.65} rough={0.22} emissive={0.28} />
      </mesh>
      <mesh position={[0, 0, 0.26]}>
        <torusGeometry args={[1.55, 0.09, 10, 48]} />
        <Std color="#E08A00" metal={0.6} rough={0.3} />
      </mesh>
      {/* Face: eyes, nose and mouth in relief. */}
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 0.35, 0.3]}>
          <boxGeometry args={[0.42, 0.18, 0.12]} />
          <Std color="#C46A00" metal={0.5} rough={0.3} />
        </mesh>
      ))}
      <mesh position={[0, -0.05, 0.3]}>
        <boxGeometry args={[0.16, 0.5, 0.12]} />
        <Std color="#C46A00" metal={0.5} rough={0.3} />
      </mesh>
      <mesh position={[0, -0.62, 0.3]}>
        <boxGeometry args={[0.8, 0.16, 0.12]} />
        <Std color="#C46A00" metal={0.5} rough={0.3} />
      </mesh>
    </group>
  );
};

/** Small umbrella held above Clawd. Origin = top of the handle. */
export const Umbrella: React.FC<{ tilt?: number }> = ({ tilt = 0 }) => (
  <group rotation={[0, 0, tilt]}>
    <mesh position={[0, 0, 0]}>
      <cylinderGeometry args={[0.18, 0.18, 9, 8]} />
      <Std color="#3A2A1E" rough={0.6} />
    </mesh>
    <mesh position={[0, 5.4, 0]}>
      <coneGeometry args={[7.5, 2.6, 8, 1, true]} />
      <meshStandardMaterial
        color="#FF3D5A"
        roughness={0.45}
        emissive="#FF3D5A"
        emissiveIntensity={0.2}
        side={THREE.DoubleSide}
        flatShading
      />
    </mesh>
    <mesh position={[0, 6.9, 0]}>
      <sphereGeometry args={[0.35, 12, 8]} />
      <Std color="#FFD60A" />
    </mesh>
  </group>
);

/** Dark round hammerstone (harder than granite). */
export const HammerStone: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const s = 1 + 0.07 * Math.sin(p.getX(i) * 5 + p.getY(i) * 3);
      p.setXYZ(i, p.getX(i) * s * 1.15, p.getY(i) * s * 0.85, p.getZ(i) * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#3E3A36" roughness={0.6} flatShading />
    </mesh>
  );
};

/** Bronze chisel. */
export const Chisel: React.FC = () => (
  <group>
    <mesh>
      <boxGeometry args={[0.42, 2.6, 0.3]} />
      <Std color="#D08A2E" metal={0.8} rough={0.28} emissive={0.18} />
    </mesh>
    <mesh position={[0, -1.55, 0]} rotation={[0, Math.PI / 4, Math.PI]}>
      <coneGeometry args={[0.3, 0.55, 4]} />
      <Std color="#E9A548" metal={0.8} rough={0.25} emissive={0.2} />
    </mesh>
  </group>
);

/** Sheet of paper, slightly bent. */
export const Paper: React.FC<{ bend?: number }> = ({ bend = 0 }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.6, 2.1, 8, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, bend * (x * x) * 0.6);
    }
    g.computeVertexNormals();
    return g;
  }, [bend]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color="#FFFFFF"
        roughness={0.8}
        emissive="#FFFFFF"
        emissiveIntensity={0.25}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
