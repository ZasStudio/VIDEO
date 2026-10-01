import React from 'react';
import {clamp01} from '../anim';
import {C, FONT} from '../theme';
import {Spark} from './Spark';

// Interfaces de ejemplo (dibujadas en HTML/CSS) en estilo "vidrio" cálido.
// Sustituyen las capturas de UI y el metraje de la referencia.

export const glass = (dark = true, glowAmt = 1): React.CSSProperties =>
  dark
    ? {
        background: 'linear-gradient(155deg, rgba(255,196,160,0.17) 0%, rgba(217,119,87,0.07) 60%, rgba(120,50,25,0.12) 100%)',
        border: '1.5px solid rgba(255,190,150,0.42)',
        boxShadow: `0 0 ${36 * glowAmt}px rgba(217,119,87,${0.28 * glowAmt}), inset 0 1px 0 rgba(255,235,220,0.25)`,
        borderRadius: 24,
      }
    : {
        background: '#FFFDF9',
        border: `1.5px solid ${C.line}`,
        boxShadow: '0 30px 60px rgba(120,60,30,0.16), 0 6px 14px rgba(120,60,30,0.08)',
        borderRadius: 24,
      };

const bar = (w: number | string, h: number, color: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: w,
  height: h,
  borderRadius: h / 2,
  background: color,
  ...extra,
});

/** Escribe `text` hasta `p` (0..1). */
const typed = (text: string, p: number) => text.slice(0, Math.round(text.length * clamp01(p)));

export const ChatWindow: React.FC<{
  w: number;
  h: number;
  dark?: boolean;
  /** 0..1 avance de la conversación */
  p: number;
  question?: string;
  answer?: string[];
}> = ({
  w,
  h,
  dark = true,
  p,
  question = '¿Me ayudas a planear el lanzamiento de mi app?',
  answer = ['¡Claro! Lo dividimos en tres pasos:', '1. Define a quién le hablas', '2. Prepara un mensaje claro', '3. Elige la fecha y mide'],
}) => {
  // Base tipográfica: funciona tanto en ventanas apaisadas como en verticales.
  const fb = Math.min(h, w * 0.58);
  const fg = dark ? C.white : C.cocoa;
  const sub = dark ? 'rgba(255,235,220,0.55)' : 'rgba(43,29,22,0.5)';
  const qP = clamp01(p / 0.25);
  const aP = clamp01((p - 0.3) / 0.7);
  const totalChars = answer.reduce((a, l) => a + l.length, 0);
  let budget = Math.round(totalChars * aP);
  return (
    <div style={{width: w, height: h, ...glass(dark), overflow: 'hidden', display: 'flex', fontFamily: FONT.sans}}>
      {/* Barra lateral */}
      <div
        style={{
          width: w * 0.2,
          borderRight: `1.5px solid ${dark ? 'rgba(255,190,150,0.2)' : C.line}`,
          padding: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <Spark size={34} color={C.coral} glow={dark ? C.coral : null} />
          <div style={bar(90, 14, dark ? 'rgba(255,235,220,0.5)' : 'rgba(43,29,22,0.35)')} />
        </div>
        <div style={{...bar('100%', 40, dark ? 'rgba(217,119,87,0.35)' : 'rgba(217,119,87,0.18)', {borderRadius: 12})}} />
        {[0.9, 0.7, 0.8, 0.6, 0.75].map((x, i) => (
          <div key={i} style={bar(`${x * 100}%`, 12, dark ? 'rgba(255,235,220,0.18)' : 'rgba(43,29,22,0.12)')} />
        ))}
      </div>
      {/* Conversación */}
      <div style={{flex: 1, padding: '36px 44px', display: 'flex', flexDirection: 'column', gap: 26, position: 'relative'}}>
        <div
          style={{
            alignSelf: 'flex-end',
            maxWidth: '78%',
            padding: '18px 24px',
            borderRadius: 20,
            background: dark ? 'rgba(255,235,220,0.12)' : C.paper,
            color: fg,
            fontSize: fb * 0.042,
            fontWeight: 500,
            opacity: qP > 0 ? 1 : 0,
            transform: `translateY(${(1 - qP) * 20}px)`,
            minHeight: fb * 0.042 * 1.3,
          }}
        >
          {typed(question, qP)}
        </div>
        <div style={{display: 'flex', gap: 18, opacity: aP > 0 ? 1 : 0}}>
          <Spark size={40} color={C.coral} glow={dark ? C.coral : null} rotate={p * 200} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 12, color: fg, fontSize: fb * 0.04}}>
            {answer.map((l, i) => {
              const n = Math.max(0, Math.min(l.length, budget));
              budget -= l.length;
              return (
                <div key={i} style={{fontWeight: i === 0 ? 700 : 500, minHeight: fb * 0.05, opacity: n > 0 ? 1 : 0}}>
                  {l.slice(0, n)}
                </div>
              );
            })}
          </div>
        </div>
        {/* Caja de entrada */}
        <div
          style={{
            position: 'absolute',
            left: 44,
            right: 44,
            bottom: 30,
            height: fb * 0.12,
            borderRadius: 18,
            border: `1.5px solid ${dark ? 'rgba(255,190,150,0.35)' : C.line}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 22px',
            justifyContent: 'space-between',
            color: sub,
            fontSize: fb * 0.034,
          }}
        >
          <span>Escribe a Claude…</span>
          <div style={{width: fb * 0.07, height: fb * 0.07, borderRadius: 12, background: C.coral}} />
        </div>
      </div>
    </div>
  );
};

/** Tarjeta de código con resaltado de sintaxis. */
export const CodeCard: React.FC<{w: number; h: number; p?: number}> = ({w, h, p = 1}) => {
  const lines: [string, string][][] = [
    [['const ', C.coral], ['idea', C.white], [' = ', C.muted], ['await ', C.coral], ['claude', C.amber], ['.think()', C.white]],
    [['if ', C.coral], ['(idea.', C.white], ['clara', C.amber], [') {', C.white]],
    [['  crear', C.amber], ['(idea);', C.white]],
    [['}', C.white]],
    [['// listo ✓', 'rgba(255,235,220,0.45)']],
  ];
  const shown = Math.round(lines.length * clamp01(p));
  return (
    <div style={{width: w, height: h, ...glass(), padding: 26, fontFamily: 'monospace', fontSize: h * 0.085}}>
      <div style={{display: 'flex', gap: 8, marginBottom: 18}}>
        {[C.coral, C.amber, C.glow].map((c) => (
          <div key={c} style={{width: 12, height: 12, borderRadius: 6, background: c}} />
        ))}
      </div>
      {lines.slice(0, shown).map((l, i) => (
        <div key={i} style={{whiteSpace: 'pre', lineHeight: 1.5}}>
          {l.map(([t, c], j) => (
            <span key={j} style={{color: c}}>
              {t}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/** Gráfica de área luminosa con etiqueta. */
export const ChartCard: React.FC<{w: number; h: number; p?: number}> = ({w, h, p = 1}) => {
  const pts = [0.75, 0.62, 0.68, 0.45, 0.52, 0.3, 0.36, 0.18, 0.26];
  const iw = w - 60;
  const ih = h - 110;
  const d = pts.map((y, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * iw},${y * ih}`).join(' ');
  return (
    <div style={{width: w, height: h, ...glass(), padding: 30, position: 'relative'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
        <div style={bar(140, 14, 'rgba(255,235,220,0.55)')} />
        <div style={bar(60, 14, C.amber)} />
      </div>
      <svg width={iw} height={ih} style={{overflow: 'visible'}}>
        <defs>
          <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.coral} stopOpacity={0.55} />
            <stop offset="1" stopColor={C.coral} stopOpacity={0} />
          </linearGradient>
          <clipPath id="reveal">
            <rect x={0} y={-20} width={iw * clamp01(p)} height={ih + 40} />
          </clipPath>
        </defs>
        <g clipPath="url(#reveal)">
          <path d={`${d} L${iw},${ih} L0,${ih} Z`} fill="url(#area)" />
          <path d={d} fill="none" stroke={C.glow} strokeWidth={4} style={{filter: `drop-shadow(0 0 6px ${C.coral})`}} />
        </g>
        {p > 0.8 ? (
          <g transform={`translate(${(7 / 8) * iw}, ${0.18 * ih})`} opacity={clamp01((p - 0.8) / 0.2)}>
            <circle r={9} fill={C.spark} />
            <rect x={-38} y={-52} width={76} height={32} rx={8} fill={C.amber} />
            <text x={0} y={-30} textAnchor="middle" fontFamily={FONT.sans} fontWeight={800} fontSize={18} fill={C.cocoa}>
              +86%
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
};

/** Tarjeta de documento: título y renglones. */
export const DocCard: React.FC<{w: number; h: number}> = ({w, h}) => (
  <div style={{width: w, height: h, ...glass(), padding: 26, display: 'flex', flexDirection: 'column', gap: 14}}>
    <div style={bar('60%', 18, C.amber)} />
    {[0.95, 0.85, 0.9, 0.6, 0.8, 0.7].map((x, i) => (
      <div key={i} style={bar(`${x * 100}%`, 10, 'rgba(255,235,220,0.3)')} />
    ))}
  </div>
);

/** Indicador circular de progreso. */
export const Gauge: React.FC<{size: number; value: number; label?: string; dark?: boolean}> = ({size, value, label, dark = true}) => {
  const r = size * 0.38;
  const L = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}>
      <circle r={r} fill="none" stroke={dark ? 'rgba(255,235,220,0.18)' : 'rgba(43,29,22,0.12)'} strokeWidth={size * 0.1} />
      <circle
        r={r}
        fill="none"
        stroke={C.amber}
        strokeWidth={size * 0.1}
        strokeLinecap="round"
        strokeDasharray={`${L * value} ${L}`}
        transform="rotate(-90)"
      />
      <text y={size * 0.07} textAnchor="middle" fontFamily={FONT.sans} fontWeight={800} fontSize={size * 0.2} fill={dark ? C.white : C.cocoa}>
        {label ?? `${Math.round(value * 100)}%`}
      </text>
    </svg>
  );
};

/** Fila de "pastillas" / interruptores. */
export const Toggles: React.FC<{w: number; h: number}> = ({w, h}) => (
  <div style={{width: w, height: h, ...glass(), padding: 22, display: 'flex', flexDirection: 'column', gap: 16}}>
    {[true, false, true].map((on, i) => (
      <div key={i} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={bar(w * 0.4, 12, 'rgba(255,235,220,0.35)')} />
        <div
          style={{
            width: 54,
            height: 28,
            borderRadius: 14,
            background: on ? C.coral : 'rgba(255,235,220,0.2)',
            position: 'relative',
          }}
        >
          <div style={{position: 'absolute', top: 4, left: on ? 30 : 4, width: 20, height: 20, borderRadius: 10, background: C.white}} />
        </div>
      </div>
    ))}
  </div>
);

export {bar, typed};
