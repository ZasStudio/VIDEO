import {useThree} from '@react-three/fiber';
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

// Iluminación de estudio para materiales de vidrio y aluminio: un mapa de entorno
// generado en memoria (RoomEnvironment, sin descargas) + luces suaves de color.
export const Studio: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.9;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.05;
    pmrem.dispose();
  }, [gl, scene]);
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 6, 5]} intensity={1.6} />
      <pointLight position={[-4, 1, 3]} intensity={20} color="#3D8BFF" distance={14} />
      <pointLight position={[4, -1, 2]} intensity={14} color="#9CCBFF" distance={14} />
    </>
  );
};

/** Fondo de escena (en espacio de pantalla) con brillos de color: el vidrio lo refracta. */
export const GlowBackground: React.FC = () => {
  const scene = useThree((s) => s.scene);
  useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 540;
    c.height = 960;
    const g = c.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, 960);
    bg.addColorStop(0, '#0B2A63');
    bg.addColorStop(0.3, '#071A3D');
    bg.addColorStop(0.7, '#030914');
    bg.addColorStop(1, '#000000');
    g.fillStyle = bg;
    g.fillRect(0, 0, 540, 960);
    const blob = (x: number, y: number, r: number, col: string) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 540, 960);
    };
    blob(120, 160, 360, 'rgba(61,139,255,0.45)');
    blob(450, 430, 260, 'rgba(140,200,255,0.20)');
    blob(270, 820, 300, 'rgba(30,80,200,0.18)');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, [scene]);
  return null;
};
