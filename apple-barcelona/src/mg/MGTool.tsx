import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, appear, clamp01, pop, rand} from '../anim';
import {FPS} from '../edit';
import {C} from '../theme';
import {ToolScene3D} from '../three/ToolScene3D';
import {BlackStage, Highlight, PINK, SyncLine, Twinkle, YELLOW, revealAt, t0, useMs} from './Kit';

// Interludio 1 — "…poder comprarme una herramienta de trabajo que realmente necesitaba."
// MacBook 3D de aluminio que se abre entre objetos de vidrio; la pantalla se enciende y suelta destellos en "trabajo".

export const MGTool: React.FC = () => {
  const f = useCurrentFrame();
  const ms = useMs();
  const tTool = t0('una herramienta');
  const tWork = t0('de trabajo');
  const openF = Math.round(((tTool - 250) / 1000) * FPS);
  const open = pop(f, openF, {damping: 16, stiffness: 90, mass: 0.9});
  const glow = EASE_OUT(clamp01((ms - tTool - 200) / 600));
  // el portátil (cerrado) aparece en cuanto empieza el interludio; se abre con "una herramienta"
  const lapF = Math.round(((t0('poder comprarme') - 300) / 1000) * FPS);
  const lap = appear(f, lapF, 0.85);
  const burstMs = ms - tWork - 250;
  const hl = revealAt(ms, tWork + 120, 360);

  return (
    <BlackStage>
      <div style={{position: 'absolute', top: 240, left: 0, right: 0}}>
        <SyncLine phrase="poder comprarme" size={58} weight={600} color="rgba(255,255,255,0.7)" />
      </div>

      <div style={{position: 'absolute', inset: 0, opacity: lap.opacity}}>
        <ToolScene3D open={open} glow={glow} enterFrame={lapF} />
      </div>
      <div style={{position: 'absolute', left: 180, top: 420}}>
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
