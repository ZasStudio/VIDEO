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
      <pointLight position={[-4, 1, 3]} intensity={18} color="#FF8FA3" distance={14} />
      <pointLight position={[4, -1, 2]} intensity={14} color="#FFD43B" distance={14} />
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
    g.fillStyle = '#050506';
    g.fillRect(0, 0, 540, 960);
    const blob = (x: number, y: number, r: number, col: string) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(5,5,6,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 540, 960);
    };
    blob(110, 260, 330, 'rgba(255,143,163,0.50)');
    blob(440, 420, 300, 'rgba(255,212,59,0.36)');
    blob(270, 760, 320, 'rgba(110,140,255,0.22)');
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
  }, [scene]);
  return null;
};
