import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, appear, clamp01, pop, rand} from '../anim';
import {FPS} from '../edit';
import {C} from '../theme';
import {BlackStage, Highlight, PINK, SyncLine, Twinkle, YELLOW, revealAt, t0, useMs} from './Kit';

// Interludio 1 — "…poder comprarme una herramienta de trabajo que realmente necesitaba."
// Un portátil se abre en 3D, la pantalla se enciende y suelta destellos en "trabajo".

const Laptop: React.FC<{open: number; glow: number}> = ({open, glow}) => {
  const f = useCurrentFrame();
  const angle = -86 + 96 * open; // cerrado (de canto) -> abierto con leve inclinación
  return (
    <div style={{position: 'relative', width: 720, height: 520, perspective: 1600}}>
      {/* Tapa */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 20,
          width: 600,
          height: 400,
          borderRadius: 26,
          background: '#141417',
          border: '3px solid #3a3a40',
          transformOrigin: '50% 100%',
          transform: `rotateX(${angle}deg)`,
          boxShadow: `0 0 ${80 * glow}px rgba(255,143,163,${0.45 * glow})`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 16,
            borderRadius: 12,
            background: `radial-gradient(ellipse at 30% 30%, rgba(255,143,163,${0.9 * glow}) 0%, transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(255,212,59,${0.75 * glow}) 0%, transparent 55%), #0d0d10`,
          }}
        >
          {/* barra de ventana y renglones que aparecen */}
          <div style={{display: 'flex', gap: 8, padding: 16, opacity: glow}}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div key={c} style={{width: 14, height: 14, borderRadius: 7, background: c}} />
            ))}
          </div>
          {[0.7, 0.5, 0.62, 0.4].map((w, i) => (
            <div
              key={i}
              style={{
                margin: '14px 26px 0',
                height: 14,
                borderRadius: 7,
                width: `${w * 100 * clamp01(glow * 1.6 - i * 0.2)}%`,
                background: 'rgba(255,255,255,0.75)',
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 26,
              width: 120,
              height: 120,
              borderRadius: 24,
              background: `conic-gradient(from ${f * 4}deg, ${PINK}, ${YELLOW}, ${PINK})`,
              opacity: glow,
              filter: 'blur(1px)',
            }}
          />
        </div>
      </div>
      {/* Base */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 418,
          width: 720,
          height: 46,
          clipPath: 'polygon(6% 0, 94% 0, 100% 70%, 98% 100%, 2% 100%, 0 70%)',
          background: 'linear-gradient(180deg, #5a5a62 0%, #2a2a30 60%, #18181c 100%)',
        }}
      />
      <div style={{position: 'absolute', left: 300, top: 420, width: 120, height: 8, borderRadius: 4, background: '#16161a'}} />
    </div>
  );
};

export const MGTool: React.FC = () => {
  const f = useCurrentFrame();
  const ms = useMs();
  const tTool = t0('una herramienta');
  const tWork = t0('de trabajo');
  const openF = Math.round(((tTool - 250) / 1000) * FPS);
  const open = pop(f, openF, {damping: 16, stiffness: 90, mass: 0.9});
  const glow = EASE_OUT(clamp01((ms - tTool - 200) / 600));
  // el portátil (cerrado) aparece en cuanto empieza el interludio; se abre con "una herramienta"
  const lap = appear(f, Math.round(((t0('poder comprarme') - 300) / 1000) * FPS), 0.85);
  const burstMs = ms - tWork - 250;
  const hl = revealAt(ms, tWork + 120, 360);

  return (
    <BlackStage>
      <div style={{position: 'absolute', top: 240, left: 0, right: 0}}>
        <SyncLine phrase="poder comprarme" size={58} weight={600} color="rgba(255,255,255,0.7)" />
      </div>

      <div style={{position: 'absolute', left: 180, top: 420, opacity: lap.opacity, scale: lap.scale}}>
        <Laptop open={open} glow={glow} />
        {/* destellos en "trabajo" */}
        {Array.from({length: 9}, (_, i) => {
          const a = rand(i + 3) * Math.PI * 2;
          const d = EASE_OUT(clamp01(burstMs / 900)) * (260 + rand(i + 9) * 200);
          const o = burstMs > 0 ? 1 - clamp01((burstMs - 500) / 500) : 0;
          return (
            <div key={i} style={{position: 'absolute', left: 360 + Math.cos(a) * d, top: 220 + Math.sin(a) * d * 0.8, opacity: o}}>
              <Twinkle size={26 + rand(i) * 30} color={i % 2 ? YELLOW : PINK} rotate={burstMs * 0.2} />
            </div>
          );
        })}
      </div>

      <div style={{position: 'absolute', top: 1080, left: 0, right: 0}}>
        <SyncLine phrase="una herramienta" size={116} />
      </div>
      <div style={{position: 'absolute', top: 1220, left: 0, right: 0, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 800, fontSize: 116, letterSpacing: '-0.02em'}}>
        <span style={{opacity: revealAt(ms, tWork), display: 'inline-block', translate: `0px ${(1 - revealAt(ms, tWork)) * 40}px`}}>
          <Highlight p={hl} color={YELLOW}>
            <span style={{color: hl > 0.5 ? '#111' : C.white, padding: '0 0.1em'}}>de trabajo</span>
          </Highlight>
        </span>
      </div>
      <div style={{position: 'absolute', top: 1420, left: 0, right: 0}}>
        <SyncLine phrase="que realmente necesitaba" display={['que', 'realmente', 'necesitaba.']} size={60} weight={600} color="rgba(255,255,255,0.75)" />
      </div>
    </BlackStage>
  );
};
