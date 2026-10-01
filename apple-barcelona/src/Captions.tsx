import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_OUT, clamp01} from './anim';
import {FPS} from './edit';
import {C, FONT, TEXT_SHADOW} from './theme';
import {PAGES} from './words';

// Subtítulos tipo karaoke: 2–3 palabras por página, la palabra que se está diciendo en amarillo,
// las palabras clave del mensaje en rosa. Cada página entra con un pequeño ascenso + desenfoque.


export const Captions: React.FC<{holes: [number, number][]}> = ({holes}) => {
  const f = useCurrentFrame();
  const ms = (f / FPS) * 1000;
  if (holes.some(([a, b]) => ms >= a && ms < b)) return null;
  const idx = PAGES.findIndex((p, i) => ms >= p.startMs && ms < (PAGES[i + 1]?.startMs ?? p.endMs + 600));
  if (idx < 0) return null;
  const page = PAGES[idx];
  const local = ms - page.startMs;
  const p = EASE_OUT(clamp01(local / 220));

  return (
    <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center'}}>
      <div
        style={{
          position: 'absolute',
          top: 1270,
          left: 60,
          right: 60,
          textAlign: 'center',
          fontFamily: FONT.sans,
          fontWeight: 800,
          fontSize: 78,
          lineHeight: 1.12,
          letterSpacing: '-0.01em',
          color: C.white,
          textShadow: TEXT_SHADOW,
          opacity: p,
          translate: `0px ${(1 - p) * 26}px`,
          scale: String(0.94 + 0.06 * p),
          filter: p < 0.98 ? `blur(${(1 - p) * 8}px)` : undefined,
        }}
      >
        {page.words.map((w, i) => {
          const active = ms >= w.startMs && ms < (page.words[i + 1]?.startMs ?? page.endMs + 400);
          const said = ms >= w.startMs;
          const pulse = active ? EASE_OUT(clamp01((ms - w.startMs) / 160)) : 1;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                margin: '0 0.17em',
                transformOrigin: '50% 60%',
                color: active ? C.active : w.key ? C.key : C.white,
                opacity: said ? 1 : 0.55,
                scale: active ? String(1.08 - 0.03 * pulse) : '1',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
