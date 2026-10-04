import React, { useMemo } from "react";
import * as THREE from "three";

// Nubi's flashlight, shared by every shot of the Casa Matusita short: a small torch whose lens
// glows, a real spot light that lights the set, and a soft visible beam (fades along its length).
// Local axes: the torch points along +Z from its origin (the grip end); hold it from there.

const BEAM_VERT = /* glsl */ `
  varying float vT;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vT = position.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }
`;
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uHalf;
  varying float vT;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    // vT runs from +uHalf (lens) to -uHalf (far end) on the cone geometry.
    float t = clamp((uHalf - vT) / (2.0 * uHalf), 0.0, 1.0);
    float along = pow(1.0 - t, 1.6);
    float rim = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
    gl_FragColor = vec4(uColor, uOpacity * along * rim);
  }
`;

/**
 * on: 0..1 (multiplies the lens glow, the light and the beam; flicker it by driving `on`).
 * reach: how far the light and the beam go (world units). angle: half-angle of the cone (rad).
 * intensity: spot light strength at on = 1 (tune per set). beam: visible beam opacity.
 */
export const Flashlight: React.FC<{
  on?: number;
  reach?: number;
  angle?: number;
  color?: string;
  intensity?: number;
  beam?: number;
  scale?: number;
}> = ({ on = 1, reach = 9, angle = 0.32, color = "#FFE9B8", intensity = 60, beam = 0.22, scale = 1 }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const beamGeo = useMemo(() => {
    const radius = Math.tan(angle) * reach;
    const g = new THREE.ConeGeometry(radius, reach, 40, 1, true);
    return g;
  }, [angle, reach]);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: beam }, uHalf: { value: reach / 2 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [color, beam, reach],
  );
  beamMat.uniforms.uOpacity.value = beam * on;
  const lens = 0.075 * scale;
  return (
    <group scale={1}>
      {/* The torch: grip, head, lens. */}
      <mesh position={[0, 0, 0.16 * scale]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05 * scale, 0.055 * scale, 0.32 * scale, 18]} />
        <meshStandardMaterial color="#2B2F3A" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.36 * scale]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[lens * 1.25, 0.06 * scale, 0.12 * scale, 20]} />
        <meshStandardMaterial color="#3A3F4D" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.425 * scale]}>
        <circleGeometry args={[lens * 1.1, 24]} />
        <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(0.25 + 0.75 * on)} toneMapped={false} />
      </mesh>
      {on > 0.01 ? (
        <>
          <spotLight
            position={[0, 0, 0.43 * scale]}
            target={target}
            angle={angle}
            penumbra={0.45}
            distance={reach * 1.6}
            decay={1.4}
            intensity={intensity * on}
            color={color}
          />
          <primitive object={target} position={[0, 0, reach]} />
          {/* The visible beam: a cone whose apex sits on the lens. */}
          <mesh geometry={beamGeo} material={beamMat} position={[0, 0, 0.43 * scale + reach / 2]} rotation={[-Math.PI / 2, 0, 0]} />
          <pointLight position={[0, 0, 0.6 * scale]} intensity={1.2 * on} distance={1.4} color={color} />
        </>
      ) : null}
    </group>
  );
};

/** A believable flicker for `on`: mostly lit, with short dips and stutters (deterministic). */
export const flicker = (g: number, seed = 1, amount = 1) => {
  const h = (n: number) => {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const step = Math.floor(g / 2);
  const dip = h(step) < 0.18 * amount ? 0.15 + 0.5 * h(step + 3) : 1;
  return Math.max(0, Math.min(1, dip * (0.9 + 0.1 * h(g * 0.37))));
};
