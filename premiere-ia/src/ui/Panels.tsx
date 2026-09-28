import React from 'react';
import {C, FONT} from '../theme';
import {Footage, FootageKind} from './Footage';
import {
  IconCamera,
  IconChevron,
  IconExport,
  IconFolder,
  IconFullscreen,
  IconGrid,
  IconHome,
  IconInsert,
  IconList,
  IconMarkIn,
  IconMarkOut,
  IconMarker,
  IconMenu,
  IconNew,
  IconOverwrite,
  IconPlay,
  IconSearch,
  IconStepBack,
  IconStepFwd,
  IconTrash,
  IconWrench,
  PrLogo,
  ToolGenExtend,
  ToolHand,
  ToolPen,
  ToolRazor,
  ToolRipple,
  ToolSelect,
  ToolSlip,
  ToolTrack,
  ToolType,
} from './Icons';
import {MON, Rect, TAB_H, monitorFrame, timecode} from './layout';

export const uiText: React.CSSProperties = {
  fontFamily: FONT.ui,
  color: C.uiText,
  fontSize: 14,
};

// ---------- Window chrome ----------

export const TitleBar: React.FC<{r: Rect}> = ({r}) => (
  <div
    style={{
      ...uiText,
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      background: C.ui0,
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      padding: '0 12px',
      fontSize: 13,
      color: '#BDBDBD',
    }}
  >
    <PrLogo size={20} />
    {['Archivo', 'Edición', 'Clip', 'Secuencia', 'Marcadores', 'Gráficos y títulos', 'Ver', 'Ventana', 'Ayuda'].map((m) => (
      <span key={m}>{m}</span>
    ))}
    <div style={{flex: 1}} />
    <span style={{color: '#8C8C8C'}}>Adobe Premiere Pro — Tutorial_IA.prproj</span>
    <div style={{flex: 1}} />
    <span style={{letterSpacing: 18, color: '#8C8C8C'}}>— ▢ ✕</span>
  </div>
);

export const HeaderBar: React.FC<{r: Rect; active: 'Importar' | 'Editar' | 'Exportar'}> = ({r, active}) => (
  <div
    style={{
      ...uiText,
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      background: C.ui1,
      borderBottom: `1px solid ${C.ui0}`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: 28,
    }}
  >
    <IconHome size={20} />
    {(['Importar', 'Editar', 'Exportar'] as const).map((t) => (
      <div
        key={t}
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          fontSize: 16,
          fontWeight: t === active ? 700 : 600,
          color: t === active ? '#FFFFFF' : '#A8A8A8',
          borderBottom: t === active ? `3px solid ${C.uiBlue}` : '3px solid transparent',
          boxSizing: 'border-box',
          paddingTop: 3,
        }}
      >
        {t}
      </div>
    ))}
    <div style={{flex: 1}} />
    <div style={{display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: '#E6E6E6'}}>
      Tutorial_IA <IconChevron size={16} />
      <span style={{fontSize: 12, color: '#8C8C8C', fontWeight: 400, marginLeft: 6}}>Editado</span>
    </div>
    <div style={{flex: 1}} />
    <IconExport size={20} />
    <IconMenu size={20} />
    <IconFullscreen size={20} />
  </div>
);

// ---------- Generic panel ----------

export const Panel: React.FC<{
  r: Rect;
  tabs: string[];
  active?: number;
  focused?: boolean;
  children?: React.ReactNode;
  contentStyle?: React.CSSProperties;
}> = ({r, tabs, active = 0, focused, children, contentStyle}) => (
  <div
    style={{
      ...uiText,
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      background: C.ui2,
      borderRadius: 5,
      overflow: 'hidden',
      boxShadow: focused ? `inset 0 0 0 2px ${C.uiBlue}` : 'none',
    }}
  >
    <div
      style={{
        height: TAB_H,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: '0 12px',
        borderBottom: `1px solid ${C.ui0}`,
        background: C.ui1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {tabs.map((t, i) => (
        <div
          key={t}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: i === active ? 700 : 500,
            color: i === active ? '#F2F2F2' : '#8F8F8F',
          }}
        >
          {t}
          {i === active ? <IconMenu size={14} /> : null}
        </div>
      ))}
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: TAB_H, bottom: 0, ...contentStyle}}>{children}</div>
  </div>
);

// ---------- Monitors ----------

export const MonitorPanel: React.FC<{
  r: Rect;
  title: string;
  tabs?: string[];
  kind: FootageKind;
  t: number; // footage time (frames)
  seconds: number; // current time shown in timecode
  duration: number;
  focused?: boolean;
  talking?: boolean;
  overlay?: React.ReactNode; // drawn above the video frame, in frame coordinates
  frameOverride?: React.ReactNode; // replaces the footage entirely
  showFit?: boolean;
}> = ({r, title, tabs, kind, t, seconds, duration, focused, talking, overlay, frameOverride, showFit}) => {
  const f = monitorFrame(r);
  const frac = Math.max(0, Math.min(1, seconds / duration));
  const rulerTop = r.h - MON.transport - MON.ruler;
  return (
    <Panel r={r} tabs={tabs ?? [title]} focused={focused}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: rulerTop - MON.infoRow, background: '#101010'}} />
      <div style={{position: 'absolute', left: f.x, top: f.y - TAB_H, width: f.w, height: f.h, overflow: 'hidden', background: '#000'}}>
        {frameOverride ?? <Footage kind={kind} t={t} w={f.w} h={f.h} talking={talking} />}
        {overlay}
      </div>
      {/* info row */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: rulerTop - MON.infoRow,
          height: MON.infoRow,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 14,
        }}
      >
        <span style={{color: C.uiBlue, fontVariantNumeric: 'tabular-nums', fontWeight: 600}}>{timecode(seconds)}</span>
        {showFit ? (
          <>
            <span style={{display: 'flex', alignItems: 'center', gap: 2, color: '#BDBDBD'}}>
              Ajustar <IconChevron size={12} />
            </span>
            <div style={{flex: 1}} />
            <span style={{display: 'flex', alignItems: 'center', gap: 2, color: '#BDBDBD'}}>
              Completa <IconChevron size={12} />
            </span>
          </>
        ) : (
          <div style={{flex: 1}} />
        )}
        <IconWrench size={15} />
        <span style={{color: '#BDBDBD', fontVariantNumeric: 'tabular-nums'}}>{timecode(duration)}</span>
      </div>
      {/* mini ruler */}
      <div style={{position: 'absolute', left: 12, right: 12, top: rulerTop, height: MON.ruler}}>
        <div style={{position: 'absolute', left: 0, right: 0, top: 7, height: 1, background: '#4A4A4A'}} />
        {[...Array(21)].map((_, i) => (
          <div key={i} style={{position: 'absolute', left: `${i * 5}%`, top: i % 5 ? 4 : 1, width: 1, height: i % 5 ? 6 : 12, background: '#5A5A5A'}} />
        ))}
        <div
          style={{
            position: 'absolute',
            left: `calc(${frac * 100}% - 6px)`,
            top: 0,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `9px solid ${C.uiBlue}`,
          }}
        />
      </div>
      {/* transport */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: MON.transport,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <IconMarker size={17} />
        <IconMarkIn size={17} />
        <IconMarkOut size={17} />
        <IconStepBack size={17} />
        <IconPlay size={20} />
        <IconStepFwd size={17} />
        <IconInsert size={17} />
        <IconOverwrite size={17} />
        <IconCamera size={17} />
      </div>
    </Panel>
  );
};

// ---------- Project panel ----------

export type ProjectItem = {name: string; kind: FootageKind | 'audio' | 'sequence'; dur: string; color: string};

export const PROJECT_ITEMS: ProjectItem[] = [
  {name: 'entrevista.mp4', kind: 'vlog', dur: '0:12', color: C.clipVideo},
  {name: 'calle_noche.mp4', kind: 'city', dur: '0:06', color: C.clipVideo},
  {name: 'graffiti.mp4', kind: 'graffiti', dur: '0:06', color: C.clipVideo},
  {name: 'titulo.mogrt', kind: 'title', dur: '0:04', color: C.clipGraphic},
  {name: 'beat_urbano.wav', kind: 'audio', dur: '0:45', color: C.clipAudio},
  {name: 'Secuencia 01', kind: 'sequence', dur: '0:30', color: '#3FA34D'},
];

const Thumb: React.FC<{item: ProjectItem; w: number; h: number; t: number}> = ({item, w, h, t}) => {
  if (item.kind === 'audio') {
    return (
      <div style={{width: w, height: h, background: '#123B33', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3}}>
        {[...Array(24)].map((_, i) => (
          <div key={i} style={{width: 4, height: 10 + Math.abs(Math.sin(i * 1.7)) * (h * 0.55), background: C.clipAudio, borderRadius: 2}} />
        ))}
      </div>
    );
  }
  if (item.kind === 'sequence') {
    return (
      <div style={{width: w, height: h, background: '#15261A', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: 10, boxSizing: 'border-box'}}>
        <div style={{height: 10, width: '70%', background: C.clipVideo, borderRadius: 2}} />
        <div style={{height: 10, width: '90%', background: C.clipVideo2, borderRadius: 2}} />
        <div style={{height: 10, width: '80%', background: C.clipAudio, borderRadius: 2}} />
      </div>
    );
  }
  return <Footage kind={item.kind} t={t} w={w} h={h} talking={false} />;
};

export const ProjectPanel: React.FC<{
  r: Rect;
  t: number;
  focused?: boolean;
  search?: string;
  filter?: (item: ProjectItem) => boolean;
  selected?: string;
  hidden?: string[]; // items currently being dragged away (render ghosted)
}> = ({r, t, focused, search, filter, selected, hidden = []}) => {
  const items = filter ? PROJECT_ITEMS.filter(filter) : PROJECT_ITEMS;
  const cols = 3;
  const cellW = (r.w - 24 - (cols - 1) * 12) / cols;
  const thumbH = (cellW * 9) / 16;
  return (
    <Panel r={r} tabs={['Proyecto: Tutorial_IA', 'Navegador de medios', 'Bibliotecas', 'Efectos']} focused={focused}>
      <div style={{position: 'absolute', left: 12, right: 12, top: 10, height: 30, display: 'flex', alignItems: 'center', gap: 10}}>
        <IconFolder size={16} />
        <span style={{fontSize: 13, color: '#BDBDBD'}}>Tutorial_IA.prproj</span>
        <div style={{flex: 1}} />
        <span style={{fontSize: 12, color: '#8C8C8C'}}>{items.length} elementos</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          top: 46,
          height: 32,
          borderRadius: 16,
          background: C.ui1,
          border: `1px solid ${search ? C.uiBlue : C.uiLine}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          fontSize: 14,
          color: search ? '#F2F2F2' : '#7A7A7A',
        }}
      >
        <IconSearch size={16} />
        {search || 'Buscar'}
      </div>
      <div style={{position: 'absolute', left: 12, right: 12, top: 92, display: 'flex', flexWrap: 'wrap', gap: 12}}>
        {items.map((item) => (
          <div key={item.name} style={{width: cellW, opacity: hidden.includes(item.name) ? 0.35 : 1}}>
            <div
              style={{
                position: 'relative',
                width: cellW,
                height: thumbH,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: selected === item.name ? `0 0 0 2px ${C.uiBlue}` : '0 0 0 1px #000',
              }}
            >
              <Thumb item={item} w={cellW} h={thumbH} t={t} />
              <div style={{position: 'absolute', right: 4, bottom: 4, background: '#000A', borderRadius: 3, padding: '0 5px', fontSize: 11, color: '#EEE'}}>
                {item.dur}
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, fontSize: 12, color: '#D0D0D0', whiteSpace: 'nowrap', overflow: 'hidden'}}>
              <div style={{width: 9, height: 9, borderRadius: 2, background: item.color, flexShrink: 0}} />
              {item.name}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 36,
          borderTop: `1px solid ${C.ui0}`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 12px',
        }}
      >
        <IconList size={16} />
        <IconGrid size={16} color={C.uiBlue} />
        <div style={{width: 90, height: 3, background: '#555', borderRadius: 2, position: 'relative'}}>
          <div style={{position: 'absolute', left: 50, top: -4, width: 10, height: 10, borderRadius: 5, background: '#CCC'}} />
        </div>
        <div style={{flex: 1}} />
        <IconFolder size={16} />
        <IconNew size={16} />
        <IconTrash size={16} />
      </div>
    </Panel>
  );
};

// ---------- Tools ----------

export type ToolId = 'select' | 'track' | 'ripple' | 'razor' | 'slip' | 'pen' | 'hand' | 'type' | 'genext';

const TOOLS: {id: ToolId; Icon: React.FC<{size?: number; color?: string}>}[] = [
  {id: 'select', Icon: ToolSelect},
  {id: 'track', Icon: ToolTrack},
  {id: 'ripple', Icon: ToolRipple},
  {id: 'razor', Icon: ToolRazor},
  {id: 'slip', Icon: ToolSlip},
  {id: 'pen', Icon: ToolPen},
  {id: 'hand', Icon: ToolHand},
  {id: 'type', Icon: ToolType},
  {id: 'genext', Icon: ToolGenExtend},
];

export const TOOL_Y = (id: ToolId) => 14 + TOOLS.findIndex((t) => t.id === id) * 46;

export const ToolsPanel: React.FC<{r: Rect; active: ToolId; focused?: boolean}> = ({r, active, focused}) => (
  <div
    style={{
      position: 'absolute',
      left: r.x,
      top: r.y,
      width: r.w,
      height: r.h,
      background: C.ui2,
      borderRadius: 5,
      boxShadow: focused ? `inset 0 0 0 2px ${C.uiBlue}` : 'none',
    }}
  >
    {TOOLS.map(({id, Icon}) => (
      <div
        key={id}
        style={{
          position: 'absolute',
          left: 5,
          top: TOOL_Y(id),
          width: r.w - 10,
          height: 36,
          borderRadius: 5,
          background: id === active ? '#1F4F7E' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={id === active ? '#FFFFFF' : id === 'genext' ? C.ai : '#BDBDBD'} />
      </div>
    ))}
  </div>
);

// ---------- Audio meters ----------

export const Meters: React.FC<{r: Rect; level: number; level2?: number}> = ({r, level, level2}) => {
  const bar = (lv: number) => {
    const h = Math.max(0, Math.min(1, lv)) * (r.h - 60);
    return (
      <div style={{position: 'relative', width: 10, height: r.h - 60, background: '#111'}}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 10,
            height: h,
            background: 'linear-gradient(to top, #2FBF4F 0%, #2FBF4F 65%, #E8D43A 82%, #E23B3B 100%)',
            backgroundSize: `10px ${r.h - 60}px`,
            backgroundPosition: 'bottom',
          }}
        />
      </div>
    );
  };
  return (
    <div style={{position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, background: C.ui2, borderRadius: 5}}>
      <div style={{position: 'absolute', top: 30, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5}}>
        {bar(level)}
        {bar(level2 ?? level * 0.96)}
      </div>
      <div style={{position: 'absolute', bottom: 8, width: '100%', textAlign: 'center', fontFamily: FONT.ui, fontSize: 11, color: '#8C8C8C'}}>
        S S
      </div>
    </div>
  );
};
