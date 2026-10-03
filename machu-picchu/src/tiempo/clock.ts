// Everyone's life counter (seconds of life left) as a function of the GLOBAL frame. Shots and
// overlays read these, so every counter on screen agrees with the story and with the voices.
import { CARGO, COMPRAS, ESCALA, FINAL, OFICINA, SENORA } from "./beats";

export const MIN = 60;
export const HOUR = 3600;
export const DAY = 86400;
export const MONTH = 30 * DAY;
export const YEAR = 365 * DAY;
const FPS = 30;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
/** 0 → 1 over `dur` frames from `at` (smoothstep). */
const step = (g: number, at: number, dur: number) => smooth((g - at) / dur);
/** 0 → 1 linearly between two frames. */
const span = (g: number, a: number, b: number) => clamp01((g - a) / Math.max(1, b - a));
/** Rolls between two values on a log scale (digits cascade like a slot machine). */
const logLerp = (a: number, b: number, k: number) => Math.exp(Math.log(Math.max(a, 0.01)) + (Math.log(Math.max(b, 0.01)) - Math.log(Math.max(a, 0.01))) * k);

/** A one-off change shown as a popup next to a counter. */
export type LifeEvent = { at: number; text: string; tone: "loss" | "gain" | "tiny" | "gift" };

// ------------------------------------------------------------------------------------- Nubi
/** "32 AÑOS · 4 MESES" at the first frame. */
export const NUBI_START = 32 * YEAR + 4 * MONTH + 12 * DAY + 8 * HOUR + 15 * MIN + 42;
/** The premium-zone charge: drained while the alarm rings, frozen while Nubi holds its breath. */
const HOLD_FROM = CARGO.INHALE + 6;
const DRAIN_1 = 11 * YEAR + 3 * MONTH + 17 * DAY;
const DRAIN_2 = 12 * YEAR + 7 * MONTH + 4 * DAY;

const nubiBeforeFine = (g: number) => {
  let s = NUBI_START - g / FPS;
  s -= 6 * HOUR * step(g, COMPRAS.SEIS, 10); // the juice
  s -= 8 * HOUR * span(g, OFICINA.LAPSE, OFICINA.LAPSE_END); // the working day goes by
  s -= YEAR * step(g, SENORA.ANO, 20); // the year Nubi gives away
  // Breathing in the premium zone.
  s -= DRAIN_1 * span(g, CARGO.ALARM, HOLD_FROM);
  s -= DRAIN_2 * span(g, CARGO.EXHALE, FINAL.MULTA);
  // Holding its breath stops everything, even the seconds.
  if (g > HOLD_FROM) s += (Math.min(g, CARGO.EXHALE) - HOLD_FROM) / FPS;
  return s;
};

/** Nubi's time left (seconds). From FINAL.MULTA: 10 seconds, then real time. */
export const nubiSeconds = (g: number) => {
  if (g < FINAL.MULTA) return nubiBeforeFine(g);
  const after = Math.max(0, 10 - (g - FINAL.MULTA) / FPS);
  return logLerp(nubiBeforeFine(FINAL.MULTA), after, step(g, FINAL.MULTA, 8));
};

/** True while Nubi's counter drains by itself (the premium-zone charge): beeping, red. */
export const nubiDraining = (g: number) => (g >= CARGO.ALARM && g < HOLD_FROM) || (g >= CARGO.EXHALE && g < FINAL.MULTA);
/** True while Nubi holds its breath (the counter is frozen). */
export const nubiHolding = (g: number) => g >= HOLD_FROM && g < CARGO.EXHALE;

export const NUBI_EVENTS: LifeEvent[] = [
  { at: COMPRAS.SEIS, text: "−6 HORAS", tone: "loss" },
  { at: OFICINA.LAPSE, text: "−8 HORAS", tone: "loss" },
  { at: SENORA.ANO, text: "−1 AÑO", tone: "gift" },
  { at: FINAL.MULTA, text: "MULTA", tone: "loss" },
];

// ------------------------------------------------------------------------------- the others
/** The old cleaning lady: exactly 00:00:18 on "dieciocho", then +1 year from Nubi. */
export const ladySeconds = (g: number) => Math.max(0, 18 - (g - SENORA.DIECIOCHO) / FPS) + YEAR * step(g, SENORA.ANO, 20);
export const LADY_EVENTS: LifeEvent[] = [{ at: SENORA.ANO, text: "+1 AÑO", tone: "gift" }];

/** The coworker: the working day costs him 8 hours, the company pays him 3 minutes. */
export const coworkerSeconds = (g: number) =>
  2 * YEAR + MONTH + 3 * DAY + 4 * HOUR + 12 * MIN + 10 - (g - OFICINA.START) / FPS - 8 * HOUR * span(g, OFICINA.LAPSE, OFICINA.LAPSE_END) + 3 * MIN * step(g, OFICINA.REWARD, 6);
export const COWORKER_EVENTS: LifeEvent[] = [{ at: OFICINA.REWARD, text: "+00:03:00", tone: "tiny" }];

/** The rich man at the car dealer: 999 years; the car (5 years) barely shows. */
export const RICH_BUY = ESCALA.ANOS + 6;
export const richSeconds = (g: number) => 999 * YEAR + 2 * MONTH - g / FPS - 5 * YEAR * step(g, RICH_BUY, 10);
export const RICH_EVENTS: LifeEvent[] = [{ at: RICH_BUY, text: "−5 AÑOS", tone: "tiny" }];

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Any passer-by or office worker (deterministic per seed): 1-60 years, ticking in real time. */
export const extraSeconds = (seed: number, g: number) => {
  const r = hash(seed);
  const years = r < 0.15 ? 0 : Math.floor(1 + 59 * hash(seed + 7) ** 1.6);
  const start = years * YEAR + Math.floor(hash(seed + 3) * 12) * MONTH + Math.floor(hash(seed + 5) * 30) * DAY + hash(seed + 9) * DAY;
  return Math.max(0, start - g / FPS - 8 * HOUR * span(g, OFICINA.LAPSE, OFICINA.LAPSE_END));
};

// ------------------------------------------------------------------------------- formatting
export type LifeTier = "years" | "days" | "hours" | "seconds";
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "32 AÑOS · 4 MESES" + "12 D · 08:15:42"; "245 DÍAS" + "08:15:42"; "08:15:42"; "00:00:18". */
export const formatLife = (seconds: number): { main: string; sub: string; tier: LifeTier } => {
  const t = Math.max(0, Math.floor(seconds));
  const years = Math.floor(t / YEAR);
  let rem = t - years * YEAR;
  const months = Math.floor(rem / MONTH);
  rem -= months * MONTH;
  const days = Math.floor(rem / DAY);
  rem -= days * DAY;
  const clock = `${pad2(Math.floor(rem / HOUR))}:${pad2(Math.floor((rem % HOUR) / MIN))}:${pad2(rem % MIN)}`;
  if (years > 0) {
    return { main: `${years} ${years === 1 ? "AÑO" : "AÑOS"} · ${months} ${months === 1 ? "MES" : "MESES"}`, sub: `${days} D · ${clock}`, tier: "years" };
  }
  if (months > 0 || days > 0) {
    const d = months * 30 + days;
    return { main: `${d} ${d === 1 ? "DÍA" : "DÍAS"}`, sub: clock, tier: "days" };
  }
  return { main: clock, sub: "", tier: t >= MIN ? "hours" : "seconds" };
};
