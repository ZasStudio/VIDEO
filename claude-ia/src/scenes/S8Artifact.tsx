import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {EASE_IN_OUT, EASE_OUT, keyframes, pop, ramp} from '../anim';
import {DarkBackdrop} from '../mg/Backdrop';
import {Spark} from '../mg/Spark';
import {Line} from '../mg/Text';
import {Gauge, bar, glass} from '../mg/UI';
import {C, FONT} from '../theme';

// Una "tableta" vacía se llena con una mini app (un artefacto) cuando la chispa la toca;
// la tarjeta principal salta fuera y aparece "Artefactos al instante".
export const S8_DURATION = 108;

const TW = 680;
const TH = 440;

const HeaderCard: React.FC<{w: number; h: number}> = ({w, h}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 20,
      background: `linear-gradient(120deg, ${C.amber} 0%, ${C.coral} 70%, ${C.rust} 100%)`,
      padding: '18px 22px',
      color: C.cocoa,
      fontFamily: FONT.sans,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: `0 0 30px ${C.coral}88`,
    }}
  >
    <div style={{fontWeight: 800, fontSize: h * 0.2}}>Hola, Ana</div>
    <div style={{fontWeight: 600, fontSize: h * 0.13, marginTop: 4, opacity: 0.85}}>Tu informe está listo</div>
    <div style={{fontWeight: 800, fontSize: h * 0.26, marginTop: 6}}>+24%</div>
    <div style={{position: 'absolute', right: 18, top: 16}}>
      <Spark size={h * 0.4} color={C.white} glow={null} />
    </div>
  </div>
);

export const S8Artifact: React.FC = () => {
  const f = useCurrentFrame();
  const tabIn = ramp(f, 0, 12, [0, 1], EASE_OUT);
  const fill = (k: number) => ramp(f, 18 + k * 3, 30 + k * 3, [0, 1], EASE_OUT);
  const spX = keyframes(f, [2, 18], [1760, 650], EASE_IN_OUT);
  const spY = keyframes(f, [2, 18], [760, 720], EASE_IN_OUT);
  const lift = ramp(f, 50, 70, [0, 1], EASE_IN_OUT);
  const tabOut = ramp(f, 54, 70);

  const L = 960 - TW / 2;
  const T = 520 - TH / 2;
  // tarjeta principal: en la tableta -> sale inclinada hacia la derecha
  const hcX = L + 84 + lift * (1300 - (L + 84));
  const hcY = T + 20 + lift * (380 - (T + 20));

  return (
    <DarkBackdrop
      orbs={[
        {x: 960, y: 560, r: 600, color: 'rgba(217,119,87,0.3)', drift: 30},
        {x: 1500, y: 300, r: 500, color: 'rgba(242,166,90,0.3)', kind: 'ring', drift: 40},
      ]}
    >
      {/* Mosaico de fondo como la referencia */}
      <AbsoluteFill style={{opacity: 0.5}}>
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2, 3, 4].map((c) => (
            <div
              key={`${r}-${c}`}
              style={{
                position: 'absolute',
                left: -120 + c * 440,
                top: -60 + r * 300,
                width: 436,
                height: 296,
                background: (r + c) % 2 ? 'rgba(255,200,170,0.035)' : 'rgba(0,0,0,0.12)',
              }}
            />
          )),
        )}
      </AbsoluteFill>

      {/* Tableta */}
      <div
        style={{
          position: 'absolute',
          left: L,
          top: T,
          width: TW,
          height: TH,
          ...glass(true, 1.3),
          border: `2.5px solid ${C.glow}`,
          opacity: tabIn * (1 - tabOut),
          transform: `scale(${0.9 + 0.1 * tabIn - 0.1 * tabOut})`,
          display: 'flex',
          padding: 20,
          gap: 18,
        }}
      >
        <div style={{width: 46, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', opacity: fill(0)}}>
          <Spark size={34} color={C.amber} glow={null} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{width: 24, height: 24, borderRadius: 12, background: i === 0 ? C.white : 'rgba(255,235,220,0.3)'}} />
          ))}
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 16}}>
          <div style={{height: 150}} />
          <div style={{display: 'flex', gap: 12, opacity: fill(2)}}>
            {[C.amber, 'rgba(255,235,220,0.25)', C.amber, 'rgba(255,235,220,0.25)'].map((c, i) => (
              <div key={i} style={{...bar(70, 30, c, {borderRadius: 8})}} />
            ))}
          </div>
          <div style={{display: 'flex', gap: 16, opacity: fill(3)}}>
            {[0.45, 0.82].map((v, i) => (
              <div key={i} style={{...glass(), width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 18}}>
                <Gauge size={120} value={v * ramp(f, 30, 50)} />
              </div>
            ))}
          </div>
        </div>
        <div style={{width: 150, display: 'flex', flexDirection: 'column', gap: 14, opacity: fill(4)}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{...bar('100%', i === 2 ? 56 : 34, i === 2 ? C.white : 'rgba(255,235,220,0.18)', {borderRadius: 10})}} />
          ))}
        </div>
      </div>

      {/* Tarjeta principal (sale de la tableta) */}
      <div
        style={{
          position: 'absolute',
          left: hcX,
          top: hcY,
          opacity: fill(1),
          transform: `rotate(${-7 * lift}deg) scale(${1 + 0.45 * lift})`,
          transformOrigin: 'left top',
        }}
      >
        <HeaderCard w={340} h={150} />
      </div>

      {/* Chispa */}
      <div
        style={{
          position: 'absolute',
          left: spX + lift * 650,
          top: spY - lift * 360,
          transform: `translate(-50%,-50%) scale(${pop(f, 2) * (1 - 0.5 * ramp(f, 18, 28))})`,
        }}
      >
        <Spark size={130} rotate={f * 5} />
      </div>

      <div style={{position: 'absolute', left: 170, top: 600}}>
        <Line
          size={96}
          seed={12}
          segs={[
            {text: 'Artefactos', at: 60, weight: 800, color: C.glow, mode: 'scramble', speed: 1.2},
            {text: ' al instante', at: 74, weight: 400, speed: 1.3},
          ]}
        />
      </div>
    </DarkBackdrop>
  );
};
