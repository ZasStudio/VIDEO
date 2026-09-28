import {PathVal, Vec, round} from './model';

// Minimal SVG path -> After Effects path converter (M, L, H, V, C, Q, A, Z; absolute + relative).

type Seg = {p0: Vec; c1: Vec; c2: Vec; p3: Vec};

const arcToBeziers = (x1: number, y1: number, rx: number, ry: number, phi: number, fa: number, fs: number, x2: number, y2: number): Seg[] => {
  const rad = (phi * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  let th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI;
  if (fs && dth < 0) dth += 2 * Math.PI;
  const n = Math.ceil(Math.abs(dth) / (Math.PI / 2));
  const segs: Seg[] = [];
  const d = dth / n;
  const k = (4 / 3) * Math.tan(d / 4);
  const pt = (t: number): Vec => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
  const der = (t: number): Vec => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
  for (let i = 0; i < n; i++) {
    const a = th1 + i * d;
    const b = a + d;
    const p0 = pt(a);
    const p3 = pt(b);
    const d0 = der(a);
    const d3 = der(b);
    segs.push({p0, c1: [p0[0] + k * d0[0], p0[1] + k * d0[1]], c2: [p3[0] - k * d3[0], p3[1] - k * d3[1]], p3});
  }
  th1 += 0;
  return segs;
};

export function parsePath(d: string, scale = 1, offset: Vec = [0, 0]): PathVal[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';
  let cur: Vec = [0, 0];
  let start: Vec = [0, 0];
  const subpaths: {v: Vec[]; i: Vec[]; o: Vec[]; c: 0 | 1}[] = [];
  let sp: (typeof subpaths)[number] | null = null;
  const num = () => parseFloat(tokens[i++]);
  const isCmd = (t: string) => /[a-zA-Z]/.test(t);
  const addPoint = (p: Vec, inTan: Vec) => {
    sp!.v.push(p);
    sp!.i.push(inTan);
    sp!.o.push([0, 0]);
  };
  const addCubic = (c1: Vec, c2: Vec, p: Vec) => {
    const last = sp!.v.length - 1;
    const lp = sp!.v[last];
    sp!.o[last] = [c1[0] - lp[0], c1[1] - lp[1]];
    addPoint(p, [c2[0] - p[0], c2[1] - p[1]]);
  };
  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const bx = rel ? cur[0] : 0;
    const by = rel ? cur[1] : 0;
    if (C === 'M') {
      const p = [num() + bx, num() + by];
      sp = {v: [], i: [], o: [], c: 0};
      subpaths.push(sp);
      addPoint(p, [0, 0]);
      cur = p;
      start = p;
      cmd = rel ? 'l' : 'L';
    } else if (C === 'L') {
      const p = [num() + bx, num() + by];
      addPoint(p, [0, 0]);
      cur = p;
    } else if (C === 'H') {
      const p = [num() + bx, cur[1]];
      addPoint(p, [0, 0]);
      cur = p;
    } else if (C === 'V') {
      const p = [cur[0], num() + by];
      addPoint(p, [0, 0]);
      cur = p;
    } else if (C === 'C') {
      const c1 = [num() + bx, num() + by];
      const c2 = [num() + bx, num() + by];
      const p = [num() + bx, num() + by];
      addCubic(c1, c2, p);
      cur = p;
    } else if (C === 'Q') {
      const q = [num() + bx, num() + by];
      const p = [num() + bx, num() + by];
      const c1 = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
      const c2 = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
      addCubic(c1, c2, p);
      cur = p;
    } else if (C === 'A') {
      const rx = num();
      const ry = num();
      const phi = num();
      const fa = num();
      const fs = num();
      const p = [num() + bx, num() + by];
      for (const s of arcToBeziers(cur[0], cur[1], rx, ry, phi, fa, fs, p[0], p[1])) addCubic(s.c1, s.c2, s.p3);
      cur = p;
    } else if (C === 'Z') {
      sp!.c = 1;
      // merge a duplicated closing point
      const n = sp!.v.length;
      if (n > 1) {
        const a = sp!.v[0];
        const b = sp!.v[n - 1];
        if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) {
          sp!.i[0] = sp!.i[n - 1];
          sp!.v.pop();
          sp!.i.pop();
          sp!.o.pop();
        }
      }
      cur = start;
    } else {
      throw new Error(`Unsupported path command ${cmd} in ${d}`);
    }
  }
  const tf = (p: Vec) => [round(p[0] * scale + offset[0], 3), round(p[1] * scale + offset[1], 3)];
  const tv = (p: Vec) => [round(p[0] * scale, 3), round(p[1] * scale, 3)];
  return subpaths.map((s) => ({v: s.v.map(tf), i: s.i.map(tv), o: s.o.map(tv), c: s.c}));
}
