import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_OUT, appear, clamp01, pop, rand} from '../anim';
import {FPS} from '../edit';
import {ToolScene3D} from '../three/ToolScene3D';
import {BLUE, BlackStage, Hairline, SKY, SyncLine, Twinkle, revealAt, t0, useMs} from './Kit';

// Interludio 1 — "…poder comprarme una herramienta de trabajo que realmente necesitaba."
// MacBook 3D de aluminio que se abre entre objetos de vidrio; jerarquía: etiqueta pequeña,
// línea ligera, "de trabajo" enorme con degradado y cierre en serif cursiva.

export const MGTool: React.FC = () => {
  const f = useCurrentFrame();
  const ms = useMs();
  const tTool = t0('una herramienta');
  const tWork = t0('de trabajo');
  const openF = Math.round(((tTool - 250) / 1000) * FPS);
  const open = pop(f, openF, {damping: 16, stiffness: 90, mass: 0.9});
  const glow = EASE_OUT(clamp01((ms - tTool - 200) / 600));
  const lapF = Math.round(((t0('poder comprarme') - 300) / 1000) * FPS);
  const lap = appear(f, lapF, 0.85);
  const burstMs = ms - tWork - 250;

  return (
    <BlackStage>
      <div style={{position: 'absolute', inset: 0, opacity: lap.opacity}}>
        <ToolScene3D open={open} glow={glow} enterFrame={lapF} />
      </div>
      {/* destellos en "trabajo" */}
      {Array.from({length: 9}, (_, i) => {
        const a = rand(i + 3) * Math.PI * 2;
        const d = EASE_OUT(clamp01(burstMs / 900)) * (240 + rand(i + 9) * 180);
        const o = burstMs > 0 ? 1 - clamp01((burstMs - 500) / 500) : 0;
        return (
          <div key={i} style={{position: 'absolute', left: 540 + Math.cos(a) * d, top: 560 + Math.sin(a) * d * 0.7, opacity: o}}>
            <Twinkle size={18 + rand(i) * 22} color={i % 2 ? SKY : '#FFFFFF'} rotate={burstMs * 0.2} />
          </div>
        );
      })}

      <div style={{position: 'absolute', top: 1010, left: 0, right: 0}}>
        <SyncLine phrase="poder comprarme" tone="label" size={30} />
        <SyncLine phrase="una herramienta" tone="light" size={78} style={{marginTop: 22}} />
        <SyncLine phrase="de trabajo" display={['de', 'trabajo']} size={176} grad="all" style={{marginTop: 4}} />
        <div style={{marginTop: 26}}>
          <Hairline p={revealAt(ms, tWork + 200, 500)} width={180} color={BLUE} />
        </div>
        <SyncLine
          phrase="que realmente necesitaba"
          display={['que', 'realmente', 'necesitaba.']}
          tone="serif"
          size={60}
          style={{marginTop: 22, color: 'rgba(255,255,255,0.82)'}}
        />
      </div>
    </BlackStage>
  );
};
