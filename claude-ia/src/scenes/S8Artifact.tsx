import React from 'react';
import {useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, appear, keyframes, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {motionBlur} from '../mg/Blur';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {Gauge, bar, glass} from '../mg/UI';
import {C, FONT} from '../theme';

// Un teléfono/tableta vacío se llena con una mini app (un artefacto) cuando la chispa lo toca;
// la tarjeta principal salta fuera y aparece "Artefactos / al instante".
export const S8_DURATION = 108;

const TW = 660;
const TH = 900;
const L = 540 - TW / 2;
const T = 760 - TH / 2;

const HeaderCard: React.FC<{w: number; h: number}> = ({w, h}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 26,
      background: `linear-gradient(120deg, ${C.amber} 0%, ${C.coral} 70%, ${C.rust} 100%)`,
      padding: '26px 30px',
      color: C.cocoa,
      fontFamily: FONT.sans,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 0 40px ${C.coral}88`,
    }}
  >
    <div style={{fontWeight: 800, fontSize: h * 0.2}}>Hola, Ana</div>
    <div style={{fontWeight: 600, fontSize: h * 0.12, marginTop: 4, opacity: 0.85}}>Tu informe está listo</div>
    <div style={{fontWeight: 800, fontSize: h * 0.26, marginTop: 8}}>+24%</div>
    <div style={{position: 'absolute', right: 24, top: 22}}>
      <Spark size={h * 0.34} color={C.white} glow={null} />
    </div>
  </div>
);

export const S8Artifact: React.FC = () => {
  const f = useCurrentFrame();
  const tabIn = ramp(f, 0, 12, [0, 1], EASE_OUT);
  const fill = (k: number) => ramp(f, 18 + k * 3, 30 + k * 3, [0, 1], EASE_OUT);
  const spX = keyframes(f, [2, 18], [1150, L + 30], EASE_IN_OUT);
  const spY = keyframes(f, [2, 18], [1500, T + TH - 30], EASE_IN_OUT);
  const spV = Math.sin(Math.PI * ramp(f, 2, 18));
  const lift = ramp(f, 50, 70, [0, 1], EASE_IN_OUT);
  const tabOut = ramp(f, 54, 70, [0, 1], EASE_IN_OUT);

  // tarjeta principal: en la pantalla -> sale inclinada hacia arriba
  const hcX = L + 30 + lift * (110 - (L + 30));
  const hcY = T + 30 + lift * (330 - (T + 30));

  return (
    <DarkBackdrop
      orbs={[
        {x: 540, y: 800, r: 680, color: 'rgba(217,119,87,0.3)', drift: 30},
        {x: 900, y: 400, r: 560, color: 'rgba(242,166,90,0.3)', kind: 'ring', drift: 40},
      ]}
    >
      {/* Mosaico de fondo */}
      <div style={{position: 'absolute', inset: 0, opacity: 0.5}}>
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2].map((c) => (
            <div
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: -80 + c * 420,
                top: -60 + r * 340,
                width: 416,
                height: 336,
                background: (r + c) % 2 ? 'rgba(255,200,170,0.035)' : 'rgba(0,0,0,0.12)',
              }}
            />
          )),
        )}
      </div>

      {/* Pantalla */}
      <div
        style={{
          position: 'absolute',
          left: L,
          top: T,
          width: TW,
          height: TH,
          ...glass(true, 1.3),
          borderRadius: 48,
          border: `2.5px solid ${C.glow}`,
          opacity: tabIn * (1 - tabOut),
          scale: String(0.92 + 0.08 * tabIn - 0.08 * tabOut),
          display: 'flex',
          flexDirection: 'column',
          padding: 30,
          gap: 22,
        }}
      >
        <div style={{height: 250}} />
        <div style={{display: 'flex', gap: 14, opacity: fill(2)}}>
          {[C.amber, 'rgba(255,235,220,0.25)', C.amber, 'rgba(255,235,220,0.25)'].map((c, i) => (
            <div key={i} style={{...bar(136, 40, c, {borderRadius: 10})}} />
          ))}
        </div>
        <div style={{display: 'flex', gap: 20, opacity: fill(3)}}>
          {[0.45, 0.82].map((v, i) => (
            <div key={i} style={{...glass(), width: 290, height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 22}}>
              <Gauge size={180} value={v * ramp(f, 30, 50)} />
            </div>
          ))}
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, opacity: fill(4)}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{...bar(`${[100, 80, 60][i]}%`, i === 0 ? 50 : 34, i === 0 ? C.white : 'rgba(255,235,220,0.18)', {borderRadius: 12})}} />
          ))}
        </div>
      </div>

      {/* Tarjeta principal (sale de la pantalla) */}
      <div
        style={{
          position: 'absolute',
          left: hcX,
          top: hcY,
          opacity: fill(1),
          rotate: `${-6 * lift}deg`,
          scale: String(1 + 0.3 * lift),
          transformOrigin: 'left top',
          filter: motionBlur(Math.sin(Math.PI * lift) * 0.5, 'y'),
        }}
      >
        <HeaderCard w={600} h={250} />
      </div>

      {/* Chispa */}
      <div
        style={{
          position: 'absolute',
          left: spX + lift * 560,
          top: spY - lift * 1020,
          translate: '-50% -50%',
          opacity: appear(f, 2).opacity,
          scale: String(Number(appear(f, 2).scale) * (1 - 0.45 * ramp(f, 18, 28))),
          filter: motionBlur(Math.max(spV, Math.sin(Math.PI * lift)) * 0.7, 'x'),
        }}
      >
        <Spark size={160} rotate={f * 5} />
      </div>

      <div style={{position: 'absolute', left: 90, top: 1300}}>
        <Line size={136} seed={13} segs={[{text: 'Artefactos', at: 60, weight: 800, color: C.glow, mode: 'scramble', speed: 1.2}]} />
        <Line size={112} seed={14} style={{marginTop: 6}} segs={[{text: 'al instante', at: 74, weight: 400, speed: 1.3}]} />
      </div>
    </DarkBackdrop>
  );
};
