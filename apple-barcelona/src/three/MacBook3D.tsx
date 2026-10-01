import React, {useMemo} from 'react';
import * as THREE from 'three';
import {roundedBox} from './Glass';

// MacBook modelada con primitivas: base y tapa de aluminio (metal pulido que refleja el
// entorno de estudio), teclado oscuro, trackpad y pantalla con contenido propio.
// `open` 0..1 abre la tapa sobre la bisagra; `glow` 0..1 enciende la pantalla.

const W = 3.2; // ancho
const D = 2.2; // profundidad
const BASE_H = 0.11;
const LID_T = 0.07;

const useScreenTexture = () =>
  useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 660;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0b0b0f';
    g.fillRect(0, 0, 1024, 660);
    const blob = (x: number, y: number, r: number, col: string) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(11,11,15,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 1024, 660);
    };
    blob(280, 200, 560, 'rgba(61,139,255,0.95)');
    blob(780, 500, 520, 'rgba(140,200,255,0.75)');
    // ventana de vidrio en pantalla
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = 3;
    const r = 26;
    const rr = (x: number, y: number, w: number, h: number) => {
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    };
    rr(170, 130, 684, 400);
    g.fill();
    g.stroke();
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(210 + i * 34, 170, 11, 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = 'rgba(255,255,255,0.85)';
    [0.62, 0.48, 0.55, 0.36].forEach((w, i) => {
      rr(220, 230 + i * 62, 584 * w, 26);
      g.fill();
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);

export const MacBook3D: React.FC<{open: number; glow: number}> = ({open, glow}) => {
  const screen = useScreenTexture();
  const base = useMemo(() => roundedBox(W, BASE_H, D, 0.05), []);
  const lid = useMemo(() => roundedBox(W, D, LID_T, 0.05), []);
  // cerrado: la tapa cae sobre la base (90°); abierto: inclinada hacia atrás (~-15°)
  const lidAngle = THREE.MathUtils.lerp(Math.PI / 2 - 0.04, -0.26, open);

  const alu = (
    <meshPhysicalMaterial color="#cfd2d8" metalness={1} roughness={0.26} clearcoat={0.4} clearcoatRoughness={0.2} envMapIntensity={1.2} />
  );

  return (
    <group>
      {/* Base */}
      <mesh geometry={base} position={[0, BASE_H / 2, 0]}>
        {alu}
      </mesh>
      {/* Teclado */}
      <mesh position={[0, BASE_H + 0.002, -0.28]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.86, D * 0.42]} />
        <meshStandardMaterial color="#141417" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* filas de teclas (relieve sutil) */}
      {Array.from({length: 5}, (_, row) => (
        <mesh key={row} position={[0, BASE_H + 0.006, -0.62 + row * 0.17]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W * 0.82, 0.12]} />
          <meshStandardMaterial color="#232327" roughness={0.55} metalness={0.3} />
        </mesh>
      ))}
      {/* Trackpad */}
      <mesh position={[0, BASE_H + 0.002, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.25, 0.72]} />
        <meshPhysicalMaterial color="#bfc2c8" metalness={0.9} roughness={0.18} />
      </mesh>
      {/* Tapa con bisagra en el borde trasero */}
      <group position={[0, BASE_H, -D / 2 + 0.02]} rotation={[lidAngle, 0, 0]}>
        <mesh geometry={lid} position={[0, D / 2, -LID_T / 2]}>
          {alu}
        </mesh>
        {/* Marco negro + pantalla */}
        <mesh position={[0, D / 2, 0.001]}>
          <planeGeometry args={[W * 0.97, D * 0.96]} />
          <meshStandardMaterial color="#060607" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0, D / 2 + 0.02, 0.003]}>
          <planeGeometry args={[W * 0.9, D * 0.86]} />
          <meshBasicMaterial map={screen} color={new THREE.Color(glow, glow, glow)} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
};
