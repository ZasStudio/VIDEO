// Timeline of "¿Qué pasaría si el dinero fuera tiempo de vida?" (1080 x 1920, exactly 70 s), driven
// by the narration: Nubi, a tired coworker, an old cleaning lady and TIMECO's polite system voice.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type TiempoScene = 'hook' | 'compras' | 'escala' | 'pregunta' | 'oficina' | 'senora' | 'cargo' | 'timeco' | 'final';

export const TIEMPO_WIDTH = 1080;
export const TIEMPO_HEIGHT = 1920;
export const TIEMPO_TOTAL = 70 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<TiempoScene>[] = [
  // Close-up of Nubi with its life counter floating over its head.
  {scene: 'hook', pre: 0.2, lines: [['L01', 0]], post: 0.3},
  // The juice stand (-6 hours) and the pizza (3 days).
  {scene: 'compras', pre: 0.4, lines: [['L02', 0]], post: 0.3},
  // Shop windows: a phone, a car; the mansion that costs 40 years.
  {scene: 'escala', pre: 0.2, lines: [['L03', 0], ['L04', 0.7]], post: 0.4},
  // Nubi asks the camera; TIMECO's billboard behind it.
  {scene: 'pregunta', pre: 0.1, lines: [['L05', 0]], post: 0.3},
  // TIMECO's office: eight hours in a time-lapse, three minutes of reward.
  {scene: 'oficina', pre: 0.5, lines: [['L06', 0], ['L07', 0.8]], post: 0.3},
  // The cleaning lady with 18 seconds left; Nubi gives her a year.
  {scene: 'senora', pre: 0.6, lines: [['L08', 0], ['L09', 0.25], ['L10', 0.25]], post: 0.7},
  // Nubi's counter drains: breathing in the premium zone; Nubi holds its breath.
  {scene: 'cargo', pre: 0.4, lines: [['L11', 0], ['L12', 0.3]], post: 1.4},
  // TIMECO's tower sucks everyone's time; the extraction screen.
  {scene: 'timeco', pre: 0.9, lines: [['L13', 0]], post: 1.4},
  // The drone fines Nubi down to 10 seconds; the door opens; the question; black: "Pase, Nubi…".
  {scene: 'final', pre: 0.6, lines: [['L14', 0], ['L15', 0.3], ['L16', 0.5]], post: 0.9},
];

export const TIEMPO = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: TIEMPO_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Each character's body talks only on its own lines (nobody has a mouth). */
export const SPEAKER = {
  nubi: TIEMPO.speakerTrack(linesOf('nubi')),
  companero: TIEMPO.speakerTrack(linesOf('companero')),
  senora: TIEMPO.speakerTrack(linesOf('senora')),
};
