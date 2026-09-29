import React from "react";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp, rand } from "../../anim";
import { FONT } from "../../theme";
import { HeavyText } from "./HeavyText";
import { INK, QuipuIcon, SunFace } from "./icons";

// Animated map of the Qhapaq Ñan over western South America (900 x 1300 at scale 1):
// parchment land, teal Pacific, the Tawantinsuyu shaded, the Andes as a subtle ridge, the
// highland and coastal roads drawing themselves, cross links, cities, chasqui relays and a
// "+30 000 KM" counter with a quipu. Geography is simplified (equirectangular around 17° S).

type Pt = [number, number];

export const MAP_W = 900;
export const MAP_H = 1300;
const LON0 = -87.5;
const LAT0 = 3.5;
const KX = 31.07;
const KY = 32.5;
const P = (lon: number, lat: number): Pt => [(lon - LON0) * KX, (LAT0 - lat) * KY];

/** Catmull-Rom resampling (seg points per span), in the same space as the input. */
const catmull = (pts: Pt[], seg: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

const pathOf = (pts: Pt[], close = false) =>
  "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L") + (close ? " Z" : "");

const proj = (ll: Pt[]) => ll.map(([lo, la]) => P(lo, la));

// ---------------------------------------------------------------------------------------------
// Geography (lon, lat).

const COAST_LL: Pt[] = [
  [-77.4, 4.8], [-77.35, 3.85], [-77.6, 3.2], [-77.85, 2.6], [-78.25, 2.45], [-78.6, 2.0], [-78.85, 1.75],
  [-79.1, 1.45], [-79.5, 1.1], [-79.8, 0.95], [-80.08, 0.7], [-80.1, 0.3], [-80.45, -0.35], [-80.55, -0.65],
  [-80.8, -0.95], [-80.9, -1.3], [-80.8, -1.65], [-80.8, -1.95], [-81.02, -2.2], [-80.72, -2.42], [-80.35, -2.62],
  [-80.0, -2.72], [-79.84, -2.98], [-79.98, -3.28], [-80.25, -3.45], [-80.45, -3.56], [-80.8, -3.85],
  [-81.1, -4.12], [-81.26, -4.45], [-81.33, -4.68], [-81.2, -4.95], [-81.1, -5.12], [-80.95, -5.45],
  [-80.87, -5.66], [-81.16, -5.92], [-80.9, -6.18], [-80.35, -6.55], [-79.95, -6.86], [-79.6, -7.35],
  [-79.25, -7.85], [-79.05, -8.15], [-78.8, -8.6], [-78.6, -9.1], [-78.35, -9.55], [-78.15, -10.07],
  [-77.78, -10.72], [-77.6, -11.1], [-77.3, -11.58], [-77.15, -12.05], [-76.95, -12.35], [-76.72, -12.7],
  [-76.4, -13.1], [-76.2, -13.45], [-76.28, -13.82], [-76.0, -14.2], [-75.6, -14.7], [-75.18, -15.33],
  [-74.6, -15.78], [-73.8, -16.2], [-73.0, -16.45], [-72.2, -16.92], [-71.35, -17.66], [-70.9, -18.02],
  [-70.33, -18.45], [-70.28, -18.75], [-70.2, -19.35], [-70.15, -20.2], [-70.1, -21.1], [-70.2, -22.1],
  [-70.25, -22.75], [-70.52, -23.15], [-70.4, -23.65], [-70.55, -24.4], [-70.5, -25.4], [-70.65, -26.35],
  [-70.85, -27.1], [-71.1, -27.8], [-71.25, -28.5], [-71.35, -29.3], [-71.35, -29.95], [-71.65, -30.45],
  [-71.55, -31.3], [-71.52, -31.9], [-71.55, -32.6], [-71.65, -33.05], [-71.65, -33.6], [-71.88, -34.0],
  [-72.05, -34.4], [-72.2, -34.9], [-72.42, -35.35], [-72.6, -35.9], [-72.8, -36.4], [-73.1, -36.8], [-73.4, -37.4],
];

/** Eastern edge of the Tawantinsuyu, north to south (the Pacific closes it on the west). */
const EMPIRE_EAST_LL: Pt[] = [
  [-78.95, 1.55], [-78.2, 1.5], [-77.4, 1.35], [-77.0, 0.7], [-77.15, -0.5], [-77.55, -2.0], [-78.15, -3.8],
  [-78.3, -5.0], [-77.6, -6.0], [-77.0, -7.4], [-76.3, -9.1], [-75.3, -10.7], [-74.2, -11.9], [-72.8, -12.3],
  [-71.4, -12.55], [-70.2, -13.35], [-68.8, -14.3], [-67.6, -15.5], [-66.5, -16.6], [-65.1, -17.4],
  [-63.9, -18.1], [-64.2, -19.6], [-64.4, -21.2], [-64.6, -23.0], [-64.9, -24.8], [-65.3, -26.6],
  [-66.2, -28.5], [-67.2, -30.4], [-68.3, -32.2], [-69.1, -33.9], [-70.3, -35.1], [-71.6, -35.45], [-72.45, -35.4],
];

const ANDES_LL: Pt[] = [
  [-77.0, 3.4], [-77.25, 1.2], [-77.65, -0.5], [-78.0, -2.1], [-78.35, -3.7], [-78.3, -5.3], [-77.5, -7.0],
  [-76.8, -8.6], [-75.8, -10.1], [-74.7, -11.5], [-73.3, -12.7], [-71.2, -13.8], [-69.8, -14.7],
  [-68.4, -16.0], [-67.4, -17.6], [-66.9, -19.6], [-66.7, -21.6], [-66.9, -23.6], [-67.6, -25.6],
  [-68.6, -27.6], [-69.5, -29.6], [-69.9, -31.6], [-70.0, -33.4], [-70.3, -35.0], [-70.8, -37.0],
];

/** Highland road (Camino de la Sierra): Pasto – Quito – Cajamarca – Cusco – Titicaca – Santiago. */
const SIERRA_LL: Pt[] = [
  [-77.35, 1.25], [-78.1, 0.35], [-78.5, -0.22], [-78.62, -0.93], [-78.65, -1.67], [-78.87, -2.4],
  [-79.0, -2.9], [-79.2, -4.0], [-79.55, -4.75], [-79.3, -5.5], [-78.85, -6.4], [-78.5, -7.16],
  [-78.05, -7.82], [-77.5, -8.9], [-76.7, -9.85], [-76.05, -11.0], [-75.5, -11.78], [-74.6, -12.8],
  [-73.95, -13.65], [-72.9, -13.65], [-71.97, -13.53], [-71.25, -14.25], [-70.6, -14.9], [-70.2, -15.4],
  [-69.9, -15.9], [-69.05, -16.55], [-68.1, -17.3], [-67.1, -18.1], [-66.3, -19.5], [-65.7, -21.4],
  [-65.5, -23.2], [-66.0, -24.9], [-66.8, -26.4], [-67.9, -27.5], [-69.2, -27.8], [-70.3, -27.45],
  [-70.75, -28.6], [-70.95, -29.9], [-70.9, -31.6], [-70.75, -32.8], [-70.65, -33.45], [-70.95, -34.3], [-71.3, -35.0],
];

/** Coastal road (Camino de la Costa): Tumbes – Chan Chan – Pachacamac – Nazca – Arica – Copiapó. */
const COSTA_LL: Pt[] = [
  [-80.45, -3.57], [-80.75, -4.6], [-80.62, -5.19], [-80.15, -6.3], [-79.8, -6.75], [-79.3, -7.5],
  [-78.8, -8.1], [-78.3, -9.1], [-77.85, -10.05], [-77.3, -11.1], [-76.75, -12.25], [-76.1, -13.1],
  [-75.9, -13.45], [-75.6, -14.07], [-74.95, -14.83], [-74.2, -15.5], [-73.3, -16.05], [-72.6, -16.45],
  [-71.9, -16.95], [-71.2, -17.5], [-70.05, -18.45], [-69.75, -19.9], [-69.7, -21.6], [-69.95, -23.4],
  [-70.1, -25.3], [-70.3, -27.45],
];

/** Transversal roads joining the coast and the highlands. */
const LINKS_LL: Pt[][] = [
  [[-80.45, -3.57], [-79.7, -3.1], [-79.0, -2.9]],
  [[-78.8, -8.1], [-78.62, -7.6], [-78.5, -7.16]],
  [[-77.85, -10.05], [-77.2, -10.0], [-76.7, -9.85]],
  [[-76.75, -12.25], [-76.1, -12.0], [-75.5, -11.78]],
  [[-75.9, -13.45], [-74.9, -13.5], [-73.95, -13.65]],
  [[-74.95, -14.83], [-73.5, -14.5], [-71.97, -13.53]],
  [[-70.05, -18.45], [-69.6, -17.5], [-69.05, -16.55]],
];

type Road = { pts: Pt[]; cum: number[]; len: number; d: string };

const makeRoad = (ll: Pt[], seg = 12): Road => {
  const pts = catmull(proj(ll), seg);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { pts, cum, len: cum[cum.length - 1], d: pathOf(pts) };
};

const pointAt = (r: Road, dist: number): Pt => {
  const d = Math.max(0, Math.min(r.len, dist));
  let lo = 0;
  let hi = r.cum.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (r.cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const span = r.cum[hi] - r.cum[lo] || 1;
  const u = (d - r.cum[lo]) / span;
  return [r.pts[lo][0] + (r.pts[hi][0] - r.pts[lo][0]) * u, r.pts[lo][1] + (r.pts[hi][1] - r.pts[lo][1]) * u];
};

const distAlong = (r: Road, lon: number, lat: number) => {
  const [x, y] = P(lon, lat);
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < r.pts.length; i++) {
    const dx = r.pts[i][0] - x;
    const dy = r.pts[i][1] - y;
    const dd = dx * dx + dy * dy;
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  }
  return r.cum[best];
};

const COAST = catmull(proj(COAST_LL), 4);
const LAND_D = pathOf([...COAST, [MAP_W + 300, MAP_H + 300], [MAP_W + 300, -300]], true);
const COAST_D = pathOf(COAST);
const EMPIRE_D = (() => {
  const east = catmull(proj(EMPIRE_EAST_LL), 6);
  const yTop = P(0, 1.55)[1];
  const yBot = P(0, -35.4)[1];
  const west = COAST.filter((p) => p[1] > yTop && p[1] < yBot).reverse();
  return pathOf([...east, ...west], true);
})();
const ANDES = makeRoad(ANDES_LL, 10);

/** Little trees in the Amazon, east of the empire (clear of the labels). */
const TREES: Pt[] = (() => {
  const east = catmull(proj(EMPIRE_EAST_LL), 6);
  const eastX = (y: number) => {
    for (let i = 1; i < east.length; i++) {
      const a = east[i - 1];
      const b = east[i];
      if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    }
    return 0;
  };
  const out: Pt[] = [];
  for (let i = 0; out.length < 24 && i < 600; i++) {
    const x = 340 + rand(i * 3.31 + 1) * 540;
    const y = 318 + rand(i * 5.17 + 2) * 250;
    if (x < eastX(y) + 44) continue;
    if (x > 490 && x < 730 && y > 455 && y < 560) continue;
    if (out.some((p) => Math.hypot(p[0] - x, p[1] - y) < 42)) continue;
    out.push([x, y]);
  }
  return out.sort((a, b) => a[1] - b[1]);
})();
const SIERRA = makeRoad(SIERRA_LL);
const COSTA = makeRoad(COSTA_LL);
const LINKS = LINKS_LL.map((l) => makeRoad(l, 10));

type City = { name: string; lon: number; lat: number; road: Road; left?: boolean; capital?: boolean; lake?: boolean };
const CITIES: City[] = [
  { name: "QUITO", lon: -78.5, lat: -0.22, road: SIERRA },
  { name: "TUMBES", lon: -80.45, lat: -3.57, road: COSTA, left: true },
  { name: "CAJAMARCA", lon: -78.5, lat: -7.16, road: SIERRA },
  { name: "CUSCO", lon: -71.97, lat: -13.53, road: SIERRA, capital: true },
  { name: "LAGO TITICACA", lon: -69.4, lat: -15.8, road: SIERRA, lake: true },
  { name: "SANTIAGO", lon: -70.65, lat: -33.45, road: SIERRA },
];

const D_CUSCO = distAlong(SIERRA, -71.97, -13.53);
const RELAY = 96;
const LEG = 14;

/** Distances of the relay posts (tambos) along a road, spaced RELAY apart from `origin`. */
const relays = (r: Road, origin: number) => {
  const out: number[] = [];
  for (let d = origin - RELAY * Math.floor(origin / RELAY); d <= r.len; d += RELAY) {
    if (d > 4 && d < r.len - 4) out.push(d);
  }
  return out;
};
const SIERRA_POSTS = relays(SIERRA, D_CUSCO);
const COSTA_POSTS = relays(COSTA, 0);

const fmtSpace = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// Local schedule (frames after `from`).
const T_SIERRA = 12;
const DUR_SIERRA = 64;
const T_COSTA = 22;
const DUR_COSTA = 50;
const T_LINKS = 70;

/** Frame a city pops: when its road's drawing head reaches it. */
const cityFrame = (from: number, c: City) => {
  const d = distAlong(c.road, c.lon, c.lat);
  const [t0, dur] = c.road === SIERRA ? [T_SIERRA, DUR_SIERRA] : [T_COSTA, DUR_COSTA];
  return from + t0 + (dur * d) / c.road.len;
};

/**
 * Absolute frames of the map's beats for a given `from` (and the same optional overrides the
 * component takes), to sync the narration: [start, end] ranges and single pop frames.
 */
export const incaMapCues = (from: number, o: { countAt?: number; quipuAt?: number; chasquiAt?: number } = {}) => {
  const cities: Record<string, number> = {};
  CITIES.forEach((c) => {
    cities[c.name] = Math.round(cityFrame(from, c));
  });
  const countAt = o.countAt ?? from + 30;
  return {
    cardIn: [from, from + 14],
    empire: [from + 4, from + 36],
    sierraRoad: [from + T_SIERRA, from + T_SIERRA + DUR_SIERRA],
    costaRoad: [from + T_COSTA, from + T_COSTA + DUR_COSTA],
    crossLinks: [from + T_LINKS, from + T_LINKS + (LINKS.length - 1) * 4 + 12],
    cities,
    counter: [countAt, countAt + 64],
    quipu: o.quipuAt ?? from + 26,
    chasquis: o.chasquiAt ?? from + 78,
  };
};

const Runner: React.FC<{ road: Road; d0: number; dir: number; t: number; uid: string; seed: number }> = ({ road, d0, dir, t, uid, seed }) => {
  if (t < 0) return null;
  const at = (tt: number) => {
    const j = Math.floor(tt / LEG);
    const u = tt / LEG - j;
    return { d: d0 + dir * RELAY * (j + EASE_IN_OUT(u)), j, u };
  };
  const cur = at(t);
  if (cur.d < 0 || cur.d > road.len) return null;
  const [x, y] = pointAt(road, cur.d);
  const trail: React.ReactNode[] = [];
  for (let i = 1; i <= 6; i++) {
    const tt = t - i * 0.9;
    if (tt < 0) break;
    const [tx, ty] = pointAt(road, at(tt).d);
    trail.push(<circle key={i} cx={tx} cy={ty} r={9 - i * 1.0} fill="#FFF0A0" opacity={0.8 - i * 0.11} />);
  }
  const gold = cur.j % 2 === 0;
  const spark = cur.j >= 1 && cur.u < 0.45 ? 1 - cur.u / 0.45 : 0;
  const post = pointAt(road, d0 + dir * RELAY * cur.j);
  return (
    <g>
      {spark > 0 ? (
        <g transform={`translate(${post[0]} ${post[1]}) rotate(${seed * 40 + cur.j * 23}) scale(${0.5 + (1 - spark) * 0.9})`} opacity={spark}>
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i / 8) * Math.PI * 2;
            const r0 = 9;
            const r1 = i % 2 ? 20 : 30;
            return (
              <line
                key={i}
                x1={Math.cos(a) * r0}
                y1={Math.sin(a) * r0}
                x2={Math.cos(a) * r1}
                y2={Math.sin(a) * r1}
                stroke="#FFF6B0"
                strokeWidth={4}
                strokeLinecap="round"
              />
            );
          })}
          <circle r={9} fill="#FFFFFF" />
        </g>
      ) : null}
      {trail}
      <circle cx={x} cy={y} r={22} fill={gold ? "#FFC23D" : "#7FF3FF"} opacity={0.9} filter={`url(#glow${uid})`} />
      <circle cx={x} cy={y} r={10.5} fill="#FFFFFF" stroke={gold ? "#C77800" : "#138A9C"} strokeWidth={3.5} />
    </g>
  );
};

/** Road with shadow, white casing and coloured core, drawn up to progress p (stroke-dashoffset). */
const RoadStroke: React.FC<{ road: Road; p: number; core: string; w?: number }> = ({ road, p, core, w = 7 }) => {
  if (p <= 0) return null;
  const dash = { strokeDasharray: `${road.len} ${road.len + 20}`, strokeDashoffset: road.len * (1 - p) };
  const common = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, d: road.d };
  return (
    <g>
      <path {...common} {...dash} stroke="rgba(70,35,10,0.35)" strokeWidth={w + 12} transform="translate(0 4)" />
      <path {...common} {...dash} stroke="#FFFFFF" strokeWidth={w + 8} />
      <path {...common} {...dash} stroke={core} strokeWidth={w} />
    </g>
  );
};

const Label: React.FC<{ x: number; y: number; text: string; size?: number; fill?: string; anchor?: "start" | "end"; font?: string; s: number }> = ({
  x,
  y,
  text,
  size = 44,
  fill = "#FFFFFF",
  anchor = "start",
  font = FONT.fun,
  s,
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <text
      x={0}
      y={0}
      textAnchor={anchor}
      dominantBaseline="middle"
      fontFamily={font}
      fontSize={size}
      fill={fill}
      stroke={INK}
      strokeWidth={size * 0.24}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ letterSpacing: 1 }}
    >
      {text}
    </text>
  </g>
);

/**
 * Animated Qhapaq Ñan map. `from` starts the sequence: the card pops in, the empire spreads out
 * from Cusco, the highland road (red) and coastal road (gold) draw north to south, cities pop as
 * the roads reach them, cross links follow, the counter climbs to +30 000 KM with a quipu, and
 * chasqui runners relay sparks along the roads. `x`, `y` = centre (default 540, 830).
 * Optional cue overrides: `countAt` (counter start), `quipuAt`, `chasquiAt` (first runners).
 */
export const IncaMap: React.FC<{
  frame: number;
  from: number;
  x?: number;
  y?: number;
  scale?: number;
  out?: number;
  countAt?: number;
  quipuAt?: number;
  chasquiAt?: number;
  title?: string;
  subtitle?: string;
}> = ({
  frame,
  from,
  x = 540,
  y = 830,
  scale = 1,
  out,
  countAt,
  quipuAt,
  chasquiAt,
  title = "QHAPAQ ÑAN",
  subtitle = "los caminos del Tawantinsuyu",
}) => {
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (frame < from) return null;
  if (out !== undefined && frame > out + 12) return null;
  const t = frame - from;
  const cAt = countAt ?? from + 30;
  const qAt = quipuAt ?? from + 26;
  const chAt = chasquiAt ?? from + 78;

  const inP = pop(frame, from, { damping: 13, stiffness: 150 });
  const exitK = out !== undefined ? ramp(frame, out, out + 12, [0, 1], EASE_IN) : 0;
  const empireR = 1500 * ramp(t, 4, 36, [0, 1], EASE_OUT);
  const pS = ramp(t, T_SIERRA, T_SIERRA + DUR_SIERRA, [0, 1], (v) => v);
  const pC = ramp(t, T_COSTA, T_COSTA + DUR_COSTA, [0, 1], (v) => v);
  const headS = pointAt(SIERRA, pS * SIERRA.len);
  const headC = pointAt(COSTA, pC * COSTA.len);

  const cityAt = (c: City) => cityFrame(from, c);

  // Andes: little peaks along the ridge, appearing north to south.
  const peaks: React.ReactNode[] = [];
  for (let d = 10, i = 0; d < ANDES.len; d += 24, i++) {
    const [px, py] = pointAt(ANDES, d);
    const s = ramp(t, 6 + i * 0.45, 14 + i * 0.45, [0, 1], EASE_OUT);
    if (s <= 0 || py < -20 || py > MAP_H + 20) continue;
    const big = rand(i * 3.1) > 0.45;
    const w = (big ? 30 : 22) * s;
    const h = (big ? 28 : 18) * s;
    const ox = (rand(i * 7.7) - 0.5) * 12;
    peaks.push(
      <g key={i} transform={`translate(${px + ox} ${py + 6})`}>
        <path d={`M${-w / 2} 0 L0 ${-h} L${w / 2} 0 Z`} fill="#A87542" />
        <path d={`M${-w / 2} 0 L0 ${-h} L${w * 0.05} 0 Z`} fill="#C99A5E" />
        {big ? <path d={`M${-w * 0.16} ${-h * 0.68} L0 ${-h} L${w * 0.16} ${-h * 0.68} L${w * 0.04} ${-h * 0.6} Z`} fill="#FFF7E8" /> : null}
      </g>,
    );
  }

  // Waves on the sea.
  const waves: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const wy = 60 + rand(i * 5.3) * (MAP_H - 120);
    const lat = LAT0 - wy / KY;
    const coastX = P(-81 + Math.min(10, Math.max(0, (-lat - 5) * 0.29)), lat)[0];
    const wx = 30 + rand(i * 9.1) * Math.max(40, coastX - 110);
    const drift = Math.sin(frame * 0.05 + i) * 5;
    waves.push(
      <path
        key={i}
        d={`M${wx + drift} ${wy} q9 -7 18 0 t18 0`}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={3.5}
        fill="none"
        strokeLinecap="round"
      />,
    );
  }

  // Chasqui runners (from Cusco north and south on the highland road; south from Tumbes on the coast).
  const runners: React.ReactNode[] = [];
  if (frame >= chAt) {
    const nS = Math.floor((frame - chAt) / 26);
    for (let m = Math.max(0, nS - 12); m <= nS; m++) {
      runners.push(<Runner key={`s${m}`} road={SIERRA} d0={D_CUSCO} dir={m % 2 === 0 ? -1 : 1} t={frame - chAt - m * 26} uid={uid} seed={m} />);
    }
    const nC = Math.floor((frame - chAt - 10) / 40);
    for (let m = Math.max(0, nC - 10); m <= nC; m++) {
      runners.push(<Runner key={`c${m}`} road={COSTA} d0={0} dir={1} t={frame - chAt - 10 - m * 40} uid={uid} seed={m + 50} />);
    }
  }

  const posts = (road: Road, list: number[], p: number) =>
    list.map((d, i) => {
      const s = ramp(p * road.len - d, 0, 30, [0, 1], EASE_OUT);
      if (s <= 0) return null;
      const [px, py] = pointAt(road, d);
      return (
        <rect
          key={i}
          x={px - 6 * s}
          y={py - 6 * s}
          width={12 * s}
          height={12 * s}
          rx={2}
          fill="#FFF4D6"
          stroke={INK}
          strokeWidth={2.5}
        />
      );
    });

  const count = 30000 * ramp(frame, cAt, cAt + 64, [0, 1], EASE_OUT);
  const countIn = pop(frame, cAt - 4, { damping: 11, stiffness: 180 });
  const countDone = bumpAt(frame, cAt + 64, 10);
  const quipuIn = pop(frame, qAt, { damping: 9, stiffness: 170 });
  const titleIn = pop(frame, from + 6, { damping: 11, stiffness: 170 });
  const legendIn = ramp(t, 60, 72, [0, 1], EASE_OUT);

  return (
    <div
      style={{
        position: "absolute",
        left: x - MAP_W / 2,
        top: y - MAP_H / 2,
        width: MAP_W,
        height: MAP_H,
        transform: `scale(${scale * (0.88 + 0.12 * inP) * (1 - exitK * 0.2)}) rotate(${(1 - inP) * -4}deg)`,
        opacity: clamp01(inP * 1.8) * (1 - exitK),
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 50,
          overflow: "hidden",
          boxShadow: "0 18px 0 rgba(0,0,0,0.3), 0 40px 70px rgba(0,0,0,0.4)",
        }}
      >
        <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ display: "block" }}>
          <defs>
            <linearGradient id={`sea${uid}`} x1="0" y1="0" x2="0.35" y2="1">
              <stop offset="0" stopColor="#18B5B3" />
              <stop offset="0.5" stopColor="#0C8C98" />
              <stop offset="1" stopColor="#0A5B74" />
            </linearGradient>
            <radialGradient id={`land${uid}`} cx="0.55" cy="0.4" r="0.8">
              <stop offset="0" stopColor="#FBEBC4" />
              <stop offset="0.6" stopColor="#EFD6A0" />
              <stop offset="1" stopColor="#DDBB7C" />
            </radialGradient>
            <pattern id={`hatch${uid}`} width={16} height={16} patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <rect width={16} height={16} fill="rgba(0,0,0,0)" />
              <rect width={5} height={16} fill="rgba(190,60,20,0.16)" />
            </pattern>
            <clipPath id={`landclip${uid}`}>
              <path d={LAND_D} />
            </clipPath>
            <clipPath id={`reveal${uid}`}>
              <circle cx={P(-71.97, -13.53)[0]} cy={P(-71.97, -13.53)[1]} r={Math.max(0.1, empireR)} />
            </clipPath>
            <filter id={`glow${uid}`} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={5} />
            </filter>
            <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={9} />
            </filter>
            <filter id={`blur${uid}`} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation={34} />
            </filter>
            <filter id={`paper${uid}`} x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency={0.75} numOctaves={3} seed={7} />
              <feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.26  0 0 0 0 0.1  0.9 0 0 0 -0.32" />
            </filter>
            <radialGradient id={`vig${uid}`} cx="0.5" cy="0.5" r="0.75">
              <stop offset="0.6" stopColor="rgba(40,20,5,0)" />
              <stop offset="1" stopColor="rgba(40,20,5,0.35)" />
            </radialGradient>
          </defs>

          {/* Sea */}
          <rect width={MAP_W} height={MAP_H} fill={`url(#sea${uid})`} />
          {waves}
          <path d={COAST_D} fill="none" stroke="#7FE0D6" strokeWidth={30} opacity={0.45} strokeLinejoin="round" />
          <path d={COAST_D} fill="none" stroke="#A8F0E6" strokeWidth={12} opacity={0.5} strokeLinejoin="round" />

          {/* Land */}
          <path d={LAND_D} fill={`url(#land${uid})`} />
          <rect width={MAP_W} height={MAP_H} filter={`url(#paper${uid})`} clipPath={`url(#landclip${uid})`} opacity={0.55} />

          {/* Amazon: a soft green tint and little trees */}
          <g clipPath={`url(#landclip${uid})`} opacity={ramp(t, 6, 24)}>
            <ellipse cx={690} cy={390} rx={330} ry={250} fill="#7DBE5C" opacity={0.34} filter={`url(#blur${uid})`} />
            <ellipse cx={870} cy={700} rx={150} ry={190} fill="#9CCB6A" opacity={0.24} filter={`url(#blur${uid})`} />
          </g>
          {TREES.map(([tx, ty], i) => {
            const ts = ramp(t, 12 + i * 0.7, 20 + i * 0.7, [0, 1], EASE_OUT);
            if (ts <= 0) return null;
            const big = rand(i * 2.7) > 0.5;
            return (
              <g key={i} transform={`translate(${tx} ${ty}) scale(${ts * (big ? 1.15 : 0.9)})`}>
                <rect x={-2.5} y={3} width={5} height={9} rx={1.5} fill="#7A4B2A" />
                <circle cx={0} cy={-2} r={11} fill="#4E9E45" stroke="#2F6B2C" strokeWidth={2.5} />
                <circle cx={-3.5} cy={-5.5} r={4.2} fill="#7CC66A" />
              </g>
            );
          })}

          {/* Tawantinsuyu */}
          <g clipPath={`url(#reveal${uid})`}>
            <g clipPath={`url(#landclip${uid})`}>
              <path d={EMPIRE_D} fill="rgba(232,96,46,0.30)" />
              <path d={EMPIRE_D} fill={`url(#hatch${uid})`} />
            </g>
            <path d={EMPIRE_D} fill="none" stroke="#B23A12" strokeWidth={4.5} strokeDasharray="14 10" strokeLinejoin="round" opacity={0.85} />
          </g>

          {/* Andes */}
          <path d={ANDES.d} fill="none" stroke="#9C6A36" strokeWidth={34} opacity={0.22 * ramp(t, 6, 20)} filter={`url(#soft${uid})`} strokeLinecap="round" />
          {peaks}

          <path d={COAST_D} fill="none" stroke="#5B3A1A" strokeWidth={4.5} strokeLinejoin="round" />

          {/* Cross links, then the two main roads */}
          {LINKS.map((l, i) => (
            <RoadStroke key={i} road={l} p={ramp(t, T_LINKS + i * 4, T_LINKS + i * 4 + 12, [0, 1], EASE_IN_OUT)} core="#F28A2E" w={5.5} />
          ))}
          <RoadStroke road={COSTA} p={pC} core="#FFB703" w={8.5} />
          <RoadStroke road={SIERRA} p={pS} core="#E63946" w={10} />
          {posts(COSTA, COSTA_POSTS, pC)}
          {posts(SIERRA, SIERRA_POSTS, pS)}

          {/* Drawing heads */}
          {pS > 0 && pS < 1 ? (
            <g>
              <circle cx={headS[0]} cy={headS[1]} r={20} fill="#FFE27A" filter={`url(#glow${uid})`} />
              <circle cx={headS[0]} cy={headS[1]} r={8} fill="#FFFFFF" />
            </g>
          ) : null}
          {pC > 0 && pC < 1 ? (
            <g>
              <circle cx={headC[0]} cy={headC[1]} r={18} fill="#FFE27A" filter={`url(#glow${uid})`} />
              <circle cx={headC[0]} cy={headC[1]} r={7} fill="#FFFFFF" />
            </g>
          ) : null}

          {runners}

          {/* Cities */}
          {CITIES.map((c) => {
            const at = cityAt(c);
            const s = pop(frame, at, { damping: 9, stiffness: 200 });
            if (s <= 0.001) return null;
            const [cx, cy] = P(c.lon, c.lat);
            if (c.capital) {
              const ring = clamp01((frame - at) / 18);
              const pulse = ((frame - at) % 40) / 40;
              return (
                <g key={c.name}>
                  {ring < 1 ? <circle cx={cx} cy={cy} r={20 + ring * 90} fill="none" stroke="#FFD23F" strokeWidth={10 * (1 - ring)} opacity={1 - ring} /> : null}
                  <circle cx={cx} cy={cy} r={34 + pulse * 26} fill="none" stroke="#FFD23F" strokeWidth={4} opacity={0.8 * (1 - pulse)} />
                  <g transform={`translate(${cx} ${cy}) scale(${s}) rotate(${Math.sin(frame * 0.05) * 8}) translate(-40 -40)`}>
                    <SunFace size={80} />
                  </g>
                  <Label x={cx + 30} y={cy - 46} text={c.name} size={66} font={FONT.title} fill="#FFD23F" s={s} />
                </g>
              );
            }
            if (c.lake) {
              return (
                <g key={c.name}>
                  <g transform={`translate(${cx} ${cy}) rotate(-38) scale(${s})`}>
                    <ellipse rx={30} ry={13} fill="#4FB3EA" stroke="#1B5E8C" strokeWidth={4} />
                    <ellipse cx={-8} cy={-3} rx={10} ry={4} fill="#A8DDFA" />
                  </g>
                  <Label x={cx + 30} y={cy + 4} text={c.name} size={38} fill="#D8F2FF" s={s} />
                </g>
              );
            }
            return (
              <g key={c.name}>
                <g transform={`translate(${cx} ${cy}) scale(${s})`}>
                  <circle r={12} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
                  <circle r={4.5} fill="#E63946" />
                </g>
                <Label x={c.left ? cx - 22 : cx + 22} y={cy + (c.name === "CAJAMARCA" ? -8 : 2)} text={c.name} anchor={c.left ? "end" : "start"} s={s} />
              </g>
            );
          })}

          {/* Legend and compass on the sea */}
          <g opacity={legendIn} transform={`translate(${-20 * (1 - legendIn)} 0)`}>
            {[
              { y: 770, c: "#E63946", w: 8, text: "Camino de la sierra" },
              { y: 826, c: "#FFB703", w: 7, text: "Camino de la costa" },
            ].map((l) => (
              <g key={l.text}>
                <path d={`M44 ${l.y} L104 ${l.y}`} stroke="#FFFFFF" strokeWidth={l.w + 7} strokeLinecap="round" />
                <path d={`M44 ${l.y} L104 ${l.y}`} stroke={l.c} strokeWidth={l.w} strokeLinecap="round" />
                <text
                  x={120}
                  y={l.y}
                  dominantBaseline="middle"
                  fontFamily={FONT.fun}
                  fontSize={32}
                  fill="#FFFFFF"
                  stroke={INK}
                  strokeWidth={7}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {l.text}
                </text>
              </g>
            ))}
          </g>
          <g transform={`translate(104 430) scale(${ramp(t, 10, 24, [0, 1], EASE_OUT)}) rotate(${(1 - ramp(t, 10, 30, [0, 1], EASE_OUT)) * -90})`}>
            <circle r={50} fill="rgba(255,255,255,0.14)" stroke="#FFFFFF" strokeWidth={3} />
            <path d="M0 -40 L9 0 L0 40 L-9 0 Z" fill="#FFFFFF" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
            <path d="M0 -40 L9 0 L-9 0 Z" fill="#E63946" />
            <path d="M-30 0 L0 -6 L30 0 L0 6 Z" fill="#FFFFFF" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            <text
              y={-58}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily={FONT.title}
              fontSize={34}
              fill="#FFFFFF"
              stroke={INK}
              strokeWidth={7}
              paintOrder="stroke"
              strokeLinejoin="round"
            >
              N
            </text>
          </g>

          <rect width={MAP_W} height={MAP_H} fill={`url(#vig${uid})`} />
        </svg>

        {/* Title (top right, over the Amazon) */}
        {title ? (
          <div
            style={{
              position: "absolute",
              right: 30,
              top: 146,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              transform: `scale(${titleIn}) rotate(${-3 + (1 - titleIn) * 10}deg)`,
              transformOrigin: "100% 0%",
            }}
          >
            <HeavyText text={title} size={74} colors={["#FFFFFF", "#FFE9B0", "#FFB23F"]} />
            {subtitle ? (
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONT.fun,
                  fontSize: 34,
                  color: "#FFFFFF",
                  WebkitTextStroke: `8px ${INK}`,
                  paintOrder: "stroke fill",
                  whiteSpace: "nowrap",
                }}
              >
                {subtitle}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Counter + quipu (bottom left, over the sea) */}
        <div style={{ position: "absolute", left: 34, top: 930, width: 460 }}>
          <div style={{ transform: `scale(${countIn * (1 + 0.14 * countDone)})`, transformOrigin: "0% 50%", opacity: frame >= cAt - 4 ? 1 : 0 }}>
            <HeavyText text={`+${fmtSpace(count)}`} size={96} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
            <div
              style={{
                width: 118,
                height: 118,
                borderRadius: 30,
                background: "linear-gradient(160deg, #FFF3D6 0%, #F2D19A 100%)",
                border: "6px solid #FFFFFF",
                boxShadow: "0 8px 0 rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `scale(${quipuIn}) rotate(${(1 - quipuIn) * 30 + Math.sin(frame * 0.08) * 4}deg)`,
                flexShrink: 0,
              }}
            >
              <QuipuIcon size={96} />
            </div>
            <div style={{ transform: `scale(${countIn})`, transformOrigin: "0% 50%" }}>
              <HeavyText text="KM" size={80} colors={["#FFFFFF", "#FFE9D6", "#FFC08A"]} />
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONT.fun,
                  fontSize: 36,
                  color: "#FFFFFF",
                  WebkitTextStroke: `8px ${INK}`,
                  paintOrder: "stroke fill",
                  whiteSpace: "nowrap",
                }}
              >
                de caminos
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 50,
          border: "11px solid #FFFFFF",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

/** 0 -> 1 -> 0 bump over `dur` frames starting at `at`. */
function bumpAt(frame: number, at: number, dur: number) {
  const d = frame - at;
  if (d < 0 || d > dur) return 0;
  return Math.sin((d / dur) * Math.PI);
}
