// Native layout of the Premiere-style interface (1920 x 1080 "screen" pixels).

export type Rect = {x: number; y: number; w: number; h: number};

export const UI_W = 1920;
export const UI_H = 1080;

export const L = {
  titleBar: {x: 0, y: 0, w: 1920, h: 30},
  header: {x: 0, y: 30, w: 1920, h: 46},
  source: {x: 6, y: 82, w: 640, h: 500},
  program: {x: 652, y: 82, w: 760, h: 500},
  right: {x: 1418, y: 82, w: 496, h: 500},
  project: {x: 6, y: 588, w: 500, h: 486},
  tools: {x: 512, y: 588, w: 44, h: 486},
  timeline: {x: 562, y: 588, w: 1300, h: 486},
  meters: {x: 1868, y: 588, w: 46, h: 486},
} satisfies Record<string, Rect>;

export const TAB_H = 34;

// Timeline internals (relative to the timeline panel)
export const TL = {
  headerW: 176,
  topRow: 64, // timecode + ruler row below the tab bar
  trackH: 46,
  gap: 6,
  pxPerSec: 36,
};

export const TRACKS = ['V3', 'V2', 'V1', 'A1', 'A2', 'A3'] as const;
export type TrackId = (typeof TRACKS)[number];

export const trackY = (track: TrackId) => {
  const i = TRACKS.indexOf(track);
  const base = TAB_H + TL.topRow;
  return base + i * TL.trackH + (i >= 3 ? TL.gap : 0);
};

// Program/Source monitor internals
export const MON = {
  infoRow: 30,
  ruler: 16,
  transport: 42,
};

export const monitorFrame = (panel: Rect): Rect => {
  const areaTop = TAB_H;
  const areaH = panel.h - TAB_H - MON.infoRow - MON.ruler - MON.transport;
  const maxW = panel.w - 24;
  let h = areaH - 16;
  let w = (h * 16) / 9;
  if (w > maxW) {
    w = maxW;
    h = (w * 9) / 16;
  }
  return {x: (panel.w - w) / 2, y: areaTop + (areaH - h) / 2, w, h};
};

/** Absolute (screen) rect of a sub-rect of a panel. */
export const inPanel = (panel: Rect, r: Rect): Rect => ({
  x: panel.x + r.x,
  y: panel.y + r.y,
  w: r.w,
  h: r.h,
});

export const secToX = (sec: number, offsetSec = 0) => TL.headerW + (sec - offsetSec) * TL.pxPerSec;

export const timecode = (sec: number, fps = 30) => {
  const total = Math.max(0, Math.round(sec * fps));
  const f = total % fps;
  const s = Math.floor(total / fps) % 60;
  const m = Math.floor(total / fps / 60) % 60;
  const h = Math.floor(total / fps / 3600);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}:${p(f)}`;
};
