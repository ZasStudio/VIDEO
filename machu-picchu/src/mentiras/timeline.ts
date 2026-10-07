// Timeline of "¿Y si tus mentiras salieran sobre tu cabeza?" (1080 x 1920, exactly 72 s), driven by the
// narration: Nubi, its friend, its date and the boss. Every lie makes a truth tag pop over the liar's head.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type MentirasScene = 'gancho' | 'escape' | 'deuda' | 'cita' | 'jefe' | 'giro' | 'final';

export const MENTIRAS_WIDTH = 1080;
export const MENTIRAS_HEIGHT = 1920;
export const MENTIRAS_TOTAL = 72 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
// The gap after each lie is the truth tag's moment: it pops in the silence, then stays over the next line.
const PLAN: PlanScene<MentirasScene>[] = [
  // In bed, on the phone, fake-panting: «ACABA DE DESPERTAR»; then the premise to camera.
  {scene: 'gancho', pre: 0.15, lines: [['L01', 0], ['L02', 1.2]], post: 0.35},
  // The café: the cap; "Había tráfico"; the tag rips through the cap with more and more details.
  {scene: 'escape', pre: 0.5, lines: [['L03', 0], ['L04', 0.25], ['L05', 0.15], ['L06', 1.7]], post: 0.35},
  // The sneaker shop window: "estoy misio" -> «TIENE S/800»; the fin held out; the getaway that fails.
  {scene: 'deuda', pre: 0.7, lines: [['L07', 0], ['L08', 0.2], ['L09', 1.7]], post: 0.4},
  // The candlelit date: "solo contigo" -> «LA COPIÓ Y PEGÓ A 7 PERSONAS»; the record scratch; she leaves.
  {scene: 'cita', pre: 1.1, lines: [['L10', 0], ['L11', 0.25], ['L12', 1.9]], post: 0.45},
  // 6 pm at the office: the boss blocks the door; «TRAJO 68 DIAPOSITIVAS»; everyone sits back down.
  {scene: 'jefe', pre: 0.7, lines: [['L13', 0], ['L14', 1.9]], post: 0.6},
  // "No volver a mentir"; the empty pizza box; Nubi says nothing, the tag can't load, Nubi whistles.
  {scene: 'giro', pre: 0.3, lines: [['L15', 0], ['L16', 0.45], ['L17', 1.5]], post: 0.35},
  // The question with three options; "yo nunca digo esa última" -> «LA DIJO ESTA MAÑANA»; the swat.
  {scene: 'final', pre: 0.3, lines: [['L18', 0], ['L19', 0.45], ['L20', 1.2]], post: 1.7},
];

export const MENTIRAS = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: MENTIRAS_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/**
 * Each character's body talks only on its own lines (nobody has a mouth). L17 is Nubi's thought
 * (voice-over): on screen Nubi keeps quiet and whistles, so its body doesn't talk on it.
 */
export const SPEAKER = {
  nubi: MENTIRAS.speakerTrack(linesOf('nubi').filter((id) => id !== 'L17')),
  amigo: MENTIRAS.speakerTrack(linesOf('amigo')),
  cita: MENTIRAS.speakerTrack(linesOf('cita')),
  jefe: MENTIRAS.speakerTrack(linesOf('jefe')),
};
