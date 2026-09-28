import React from 'react';
import {C} from '../theme';
import {IconChevron, IconSearch, IconSparkle} from './Icons';
import {Panel} from './Panels';
import {Rect} from './layout';

const Section: React.FC<{title: string; children?: React.ReactNode; open?: boolean}> = ({title, children, open = true}) => (
  <div style={{borderBottom: `1px solid ${C.ui0}`, padding: '10px 16px'}}>
    <div style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#E6E6E6'}}>
      <IconChevron size={14} style={{rotate: open ? '0deg' : '-90deg'}} />
      {title}
    </div>
    {open ? <div style={{marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10}}>{children}</div> : null}
  </div>
);

const Row: React.FC<{label: string; value: string; slider?: number; blue?: boolean}> = ({label, value, slider, blue}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 10, fontSize: 13}}>
    <span style={{width: 110, color: '#A8A8A8'}}>{label}</span>
    {slider !== undefined ? (
      <div style={{flex: 1, height: 4, borderRadius: 2, background: '#444', position: 'relative'}}>
        <div style={{position: 'absolute', left: 0, top: 0, height: 4, width: `${slider * 100}%`, borderRadius: 2, background: C.uiBlue}} />
        <div style={{position: 'absolute', left: `calc(${slider * 100}% - 7px)`, top: -5, width: 14, height: 14, borderRadius: 7, background: '#EEE'}} />
      </div>
    ) : (
      <div style={{flex: 1}} />
    )}
    <span style={{color: blue ? C.uiBlue : '#E0E0E0', fontVariantNumeric: 'tabular-nums', minWidth: 54, textAlign: 'right'}}>{value}</span>
  </div>
);

export const PropertiesPanel: React.FC<{r: Rect; focused?: boolean}> = ({r, focused}) => (
  <Panel r={r} tabs={['Propiedades', 'Texto', 'Sonido esencial', 'Color Lumetri']} focused={focused}>
    <div style={{padding: '12px 16px', fontSize: 14, color: '#E6E6E6', fontWeight: 600, borderBottom: `1px solid ${C.ui0}`}}>
      entrevista.mp4
    </div>
    <Section title="Transformar">
      <Row label="Posición" value="960  540" blue />
      <Row label="Escala" value="100" slider={0.5} blue />
      <Row label="Rotación" value="0°" blue />
      <Row label="Opacidad" value="100 %" slider={1} blue />
    </Section>
    <Section title="Recortar" open={false} />
    <Section title="Audio">
      <Row label="Volumen" value="0,0 dB" slider={0.62} blue />
      <Row label="Panorámica" value="0" slider={0.5} blue />
    </Section>
    <Section title="Velocidad" open={false} />
  </Panel>
);

// ---------- Text panel: transcript ----------

export type TranscriptState = {
  typed: number; // 0..1 how much text has appeared
  select: number; // 0..1 selection sweep over the filler phrase
  deleted: number; // 0..1 the filler phrase collapses
};

const SUB_TABS = (active: string) => (
  <div style={{display: 'flex', gap: 22, padding: '0 16px', height: 40, alignItems: 'center', borderBottom: `1px solid ${C.ui0}`, fontSize: 14}}>
    {['Transcripción', 'Subtítulos', 'Gráficos'].map((t) => (
      <div
        key={t}
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          color: t === active ? '#FFFFFF' : '#9A9A9A',
          fontWeight: t === active ? 700 : 500,
          borderBottom: t === active ? `2px solid ${C.uiBlue}` : '2px solid transparent',
          boxSizing: 'border-box',
        }}
      >
        {t}
      </div>
    ))}
  </div>
);

export const TranscriptPanel: React.FC<{r: Rect; state: TranscriptState; focused?: boolean}> = ({r, state, focused}) => {
  const before = 'Hola, hoy te enseño a editar en Premiere Pro. ';
  const filler = 'Eh... este... mmm... ';
  const after = 'Importa tus clips, córtalos y deja que la IA haga el resto.';
  const total = before.length + filler.length + after.length;
  const shown = Math.round(total * Math.max(0, Math.min(1, state.typed)));
  const b = before.slice(0, shown);
  const f = filler.slice(0, Math.max(0, shown - before.length));
  const a = after.slice(0, Math.max(0, shown - before.length - filler.length));
  const fillerChars = f.length;
  const selChars = Math.round(fillerChars * state.select);
  return (
    <Panel r={r} tabs={['Propiedades', 'Texto', 'Sonido esencial', 'Color Lumetri']} active={1} focused={focused}>
      {SUB_TABS('Transcripción')}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px'}}>
        <div style={{flex: 1, height: 30, borderRadius: 15, background: C.ui1, border: `1px solid ${C.uiLine}`, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', color: '#7A7A7A', fontSize: 13}}>
          <IconSearch size={15} /> Buscar
        </div>
        <div style={{height: 30, borderRadius: 15, background: C.uiBlue, color: 'white', fontSize: 13, fontWeight: 700, padding: '0 14px', display: 'flex', alignItems: 'center'}}>
          Crear subtítulos
        </div>
      </div>
      <div style={{padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13}}>
        <div style={{width: 10, height: 10, borderRadius: 5, background: '#FF8A3D'}} />
        <span style={{color: '#E6E6E6', fontWeight: 700}}>Oveja</span>
        <span style={{color: '#7A7A7A', fontVariantNumeric: 'tabular-nums'}}>00:00:00:00</span>
      </div>
      <div style={{padding: '4px 16px 0 34px', fontSize: 19, lineHeight: 1.55, color: '#E8E8E8'}}>
        {b}
        {fillerChars > 0 && state.deleted < 1 ? (
          <span
            style={{
              display: 'inline',
              fontSize: 19 * (1 - state.deleted),
              opacity: 1 - state.deleted,
            }}
          >
            <span style={{background: selChars > 0 ? '#2D8CEB88' : 'transparent', color: '#FFB0B0'}}>{f.slice(0, selChars)}</span>
            <span style={{color: '#FF9C9C'}}>{f.slice(selChars)}</span>
          </span>
        ) : null}
        {a}
        {shown < total ? <span style={{color: C.uiBlue}}>|</span> : null}
      </div>
      <div style={{position: 'absolute', left: 16, right: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#BDBDBD'}}>
        <IconSparkle size={16} color={C.ai} filled />
        <span>Muletillas detectadas: <b style={{color: '#FF9C9C'}}>{state.deleted > 0.5 ? 0 : 3}</b></span>
        <div style={{flex: 1}} />
        <span style={{color: '#8C8C8C'}}>Español (detectado)</span>
      </div>
    </Panel>
  );
};

// ---------- Text panel: captions ----------

export const CaptionsPanel: React.FC<{r: Rect; lang: 'es' | 'en'; translating: number; focused?: boolean}> = ({r, lang, translating, focused}) => {
  const rows =
    lang === 'es'
      ? [
          ['00:00:00:10', 'Hola, hoy te enseño a editar'],
          ['00:00:02:04', 'en Premiere Pro con IA.'],
          ['00:00:04:12', 'Importa tus clips y córtalos.'],
          ['00:00:06:20', 'La IA hace el resto.'],
        ]
      : [
          ['00:00:00:10', "Hi! Today I'll teach you to edit"],
          ['00:00:02:04', 'in Premiere Pro with AI.'],
          ['00:00:04:12', 'Import your clips and cut them.'],
          ['00:00:06:20', 'AI does the rest.'],
        ];
  return (
    <Panel r={r} tabs={['Propiedades', 'Texto', 'Sonido esencial', 'Color Lumetri']} active={1} focused={focused}>
      {SUB_TABS('Subtítulos')}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px'}}>
        <div style={{height: 30, borderRadius: 6, background: C.ui1, border: `1px solid ${C.uiLine}`, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', fontSize: 13, color: '#E0E0E0'}}>
          {lang === 'es' ? 'Español' : 'English'} <IconChevron size={13} />
        </div>
        <div style={{flex: 1}} />
        <div
          style={{
            height: 30,
            borderRadius: 15,
            background: translating > 0 && translating < 1 ? '#7B4FD6' : C.uiBlue,
            color: 'white',
            fontSize: 13,
            fontWeight: 700,
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconSparkle size={14} color="white" filled /> Traducir subtítulos
        </div>
      </div>
      {translating > 0 && translating < 1 ? (
        <div style={{margin: '0 16px 6px', height: 4, borderRadius: 2, background: '#333'}}>
          <div style={{height: 4, width: `${translating * 100}%`, borderRadius: 2, background: C.ai}} />
        </div>
      ) : null}
      <div style={{padding: '4px 16px', display: 'flex', flexDirection: 'column', gap: 8}}>
        {rows.map(([tc, text], i) => (
          <div key={tc} style={{display: 'flex', gap: 12, alignItems: 'center', background: i === 0 ? '#2D8CEB22' : C.ui1, borderRadius: 6, padding: '10px 12px'}}>
            <span style={{fontSize: 12, color: '#8C8C8C', fontVariantNumeric: 'tabular-nums'}}>{tc}</span>
            <span style={{fontSize: 16, color: '#EDEDED'}}>{text}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

// ---------- Essential Sound ----------

export const SoundPanel: React.FC<{r: Rect; enhance: number; focused?: boolean}> = ({r, enhance, focused}) => {
  const on = enhance > 0.05;
  return (
    <Panel r={r} tabs={['Propiedades', 'Texto', 'Sonido esencial', 'Color Lumetri']} active={2} focused={focused}>
      <div style={{padding: '12px 16px', display: 'flex', gap: 8}}>
        {['Diálogo', 'Música', 'SFX', 'Ambiente'].map((t, i) => (
          <div
            key={t}
            style={{
              padding: '6px 12px',
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 700,
              background: i === 0 ? C.uiBlue : C.ui1,
              color: i === 0 ? 'white' : '#9A9A9A',
              border: i === 0 ? 'none' : `1px solid ${C.uiLine}`,
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <Section title="Volumen" open={false} />
      <Section title="Reparar">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 8,
            background: on ? '#7B4FD633' : C.ui1,
            border: `1px solid ${on ? C.ai : C.uiLine}`,
          }}
        >
          <div style={{width: 18, height: 18, borderRadius: 4, background: on ? C.uiBlue : 'transparent', border: `2px solid ${on ? C.uiBlue : '#777'}`, color: 'white', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            {on ? '✓' : ''}
          </div>
          <IconSparkle size={16} color={C.ai} filled />
          <span style={{fontSize: 15, fontWeight: 700, color: '#F0F0F0'}}>Mejorar voz</span>
          <div style={{flex: 1}} />
          <span style={{fontSize: 12, color: '#B98CFF'}}>{on ? (enhance < 1 ? 'Procesando…' : 'Listo') : ''}</span>
        </div>
        <Row label="Mezcla" value={`${Math.round(80 * enhance)} %`} slider={0.8 * enhance} blue />
        <Row label="Reducir ruido" value="—" />
        <Row label="Reducir reverb." value="—" />
      </Section>
      <Section title="Claridad" open={false} />
      <Section title="Creativo" open={false} />
    </Panel>
  );
};

// ---------- Auto Reframe ----------

export const ReframePanel: React.FC<{r: Rect; progress: number; focused?: boolean}> = ({r, progress, focused}) => (
  <Panel r={r} tabs={['Controles de efectos', 'Propiedades', 'Texto']} focused={focused}>
    <div style={{padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#F0F0F0'}}>
      <IconSparkle size={16} color={C.ai} filled /> Reencuadre automático
    </div>
    <div style={{padding: '0 16px', fontSize: 13, color: '#A8A8A8'}}>Relación de aspecto de destino</div>
    <div style={{display: 'flex', gap: 10, padding: '10px 16px'}}>
      {[
        ['16:9', 64, 36],
        ['1:1', 44, 44],
        ['4:5', 40, 50],
        ['9:16', 32, 56],
      ].map(([label, w, h]) => {
        const active = label === '9:16';
        return (
          <div key={label as string} style={{flex: 1, borderRadius: 8, padding: '10px 0', background: active ? '#1F4F7E' : C.ui1, border: `1px solid ${active ? C.uiBlue : C.uiLine}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
            <div style={{width: w as number, height: h as number, border: `2px solid ${active ? 'white' : '#8C8C8C'}`, borderRadius: 3}} />
            <span style={{fontSize: 13, fontWeight: 700, color: active ? 'white' : '#9A9A9A'}}>{label}</span>
          </div>
        );
      })}
    </div>
    <div style={{padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10}}>
      <Row label="Seguimiento" value="Predeterminado" />
      <Row label="Análisis" value={`${Math.round(progress * 100)} %`} slider={progress} blue />
    </div>
  </Panel>
);
