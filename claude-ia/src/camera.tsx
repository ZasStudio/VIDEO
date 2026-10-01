import {CameraMotionBlur} from '@remotion/motion-blur';
import React from 'react';
import {AbsoluteFill, Easing, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, clamp01} from './anim';
import {DURATIONS, STARTS} from './timeline';

// Cámara virtual + director de motion blur.
//
// Como en la referencia (motion de After Effects grabado en pantalla), cada corte tiene impulso:
// la escena que sale ACELERA fuera de cuadro (barrido o zoom) y la que entra llega todavía
// en movimiento y FRENA con una cola larga (expo-out). El motion blur real (varias sub-muestras
// por frame) se activa solo en las ventanas rápidas para no multiplicar el costo de render.

type Move = 'whipUp' | 'whipLeft' | 'zoom' | 'none';

/** Transición de cámara hacia la escena i (la 0 no tiene). */
const MOVES: Move[] = [
  'none', // 01 Chispa
  'zoom', // 02 Anillos (el anillo se expande hacia la cámara)
  'whipUp', // 03 Pensar
  'whipLeft', // 04 Chat (sigue la estela que sale hacia la derecha)
  'none', // 05 Razona (círculo crema propio)
  'whipUp', // 06 Cinta
  'zoom', // 07 Juntos
  'zoom', // 08 Tablero
  'whipLeft', // 09 Artefactos
  'whipUp', // 10 Claras
  'zoom', // 11 Lejos
  'whipLeft', // 12 Entiende (continúa la pastilla que entra por la derecha)
  'zoom', // 13 Cierre
];

const OUT = 8; // frames de aceleración antes del corte
const IN = 18; // frames de frenado después del corte
const WHIP_Y = 760;
const WHIP_X = 640;

const accel = Easing.bezier(0.55, 0, 1, 0.45); // ease-in fuerte: la cámara se lanza hacia el corte
const settle = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)); // expo-out: frenado largo

type Cam = {x: number; y: number; scale: number; rot: number};

const moveAt = (move: Move, phase: 'out' | 'in', k: number): Cam => {
  // k: 0..1 de intensidad (out: 0 -> 1 al llegar al corte, in: 1 -> 0 al asentarse)
  const s = phase === 'out' ? 1 : -1;
  switch (move) {
    case 'whipUp':
      return {x: 0, y: -s * WHIP_Y * k, scale: 1 + 0.06 * k, rot: -1.6 * s * k};
    case 'whipLeft':
      return {x: -s * WHIP_X * k, y: 0, scale: 1 + 0.06 * k, rot: 1.8 * s * k};
    case 'zoom':
      return phase === 'out'
        ? {x: 0, y: 0, scale: 1 + 0.65 * k, rot: 2.5 * k}
        : {x: 0, y: 0, scale: 1 + 0.4 * k, rot: -2.5 * k};
    default:
      return {x: 0, y: 0, scale: 1, rot: 0};
  }
};

/** Envuelve una escena: transición de entrada/salida + deriva suave de cámara (nunca queda quieta). */
export const SceneCamera: React.FC<{index: number; children: React.ReactNode}> = ({index, children}) => {
  const f = useCurrentFrame();
  const dur = DURATIONS[index];
  const inMove = MOVES[index];
  const outMove = MOVES[index + 1] ?? 'none';

  const kIn = 1 - settle(clamp01(f / IN));
  const kOut = accel(clamp01((f - (dur - OUT)) / OUT));
  const a = moveAt(inMove, 'in', kIn);
  const b = moveAt(outMove, 'out', kOut);

  // Deriva: un push-in lento y una flotación muy leve, como una cámara en mano estabilizada.
  const push = 1 + 0.035 * EASE_IN_OUT(clamp01(f / dur));
  const fx = Math.sin((f + index * 37) / 41) * 6;
  const fy = Math.cos((f + index * 23) / 53) * 8;
  const fr = Math.sin((f + index * 11) / 71) * 0.35;

  return (
    <AbsoluteFill
      style={{
        translate: `${a.x + b.x + fx}px ${a.y + b.y + fy}px`,
        rotate: `${a.rot + b.rot + fr}deg`,
        scale: String(a.scale * b.scale * push),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Ventanas locales (por escena) con movimiento rápido que merecen motion blur real. */
const FAST_LOCAL: Record<number, [number, number][]> = {
  0: [[96, 122]], // chispa vuela al anillo
  1: [[24, 50]], // mancha de luz
  2: [[76, 108]], // chispa florece y sale disparada
  3: [[54, 80], [114, 144]], // chispa entra rebotando, círculo crema
  4: [[0, 36]], // chispa escribe RAZONA
  6: [[8, 52], [72, 84]], // cursores entran, letras de "juntos", clic
  7: [[0, 34], [64, 90]], // tarjetas vuelan
  8: [[0, 22], [48, 72]], // chispa entra, tarjeta salta
  9: [[12, 48]], // estela
  10: [[82, 108]], // pastilla
  12: [[48, 68]], // arco de tinta
};

const WINDOWS: [number, number][] = [
  ...MOVES.flatMap((m, i): [number, number][] => (m === 'none' || i === 0 ? [] : [[STARTS[i] - OUT - 1, STARTS[i] + 12]])),
  ...Object.entries(FAST_LOCAL).flatMap(([i, ws]) => ws.map(([a, b]): [number, number] => [STARTS[Number(i)] + a, STARTS[Number(i)] + b])),
];

const isFast = (frame: number) => WINDOWS.some(([a, b]) => frame >= a && frame <= b);

/**
 * Activa CameraMotionBlur (8 sub-muestras, obturador de 220°) solo en las ventanas rápidas.
 * Se aplica sobre toda la serie de escenas, así las sub-muestras cruzan los cortes como en cine.
 */
export const MotionBlurDirector: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  return isFast(frame) ? (
    <CameraMotionBlur samples={8} shutterAngle={220}>
      {children}
    </CameraMotionBlur>
  ) : (
    <AbsoluteFill>{children}</AbsoluteFill>
  );
};
