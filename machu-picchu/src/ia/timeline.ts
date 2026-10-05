// Timeline of "¿Qué pasaría si la IA no existiera?" (1080 x 1920, exactly 76 s), driven by the
// narration: Nubi, a shy boy, a student, a boss, a tired worker and an influencer.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type IaScene = 'gancho' | 'mensaje' | 'tarea' | 'jefe' | 'foto' | 'giro' | 'final';

export const IA_WIDTH = 1080;
export const IA_HEIGHT = 1920;
export const IA_TOTAL = 76 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<IaScene>[] = [
  // The girl reads an endless love message; the boy typing his request to the AI; Nubi; the switch.
  {scene: 'gancho', pre: 2.2, lines: [['L01', 0]], post: 1.0},
  // Split screen CON IA / SIN IA: "¿ya comiste?"; her "Sí"; crickets.
  {scene: 'mensaje', pre: 0.7, lines: [['L02', 0], ['L03', 0.3], ['L04', 1.3]], post: 0.4},
  // 11:58 P.M., the AI is gone; four words typed; the clock hits 12:00.
  {scene: 'tarea', pre: 1.3, lines: [['L05', 0], ['L06', 1.2]], post: 1.3},
  // "Rapidita"; 40 empty slides; coffee, more coffee, sunrise; the stare.
  {scene: 'jefe', pre: 0.3, lines: [['L07', 0], ['L08', 0.3], ['L09', 2.3], ['L10', 0.25]], post: 1.1},
  // The luxury post; rewind; the toy car up close.
  {scene: 'foto', pre: 1.1, lines: [['L11', 0], ['L12', 0.5]], post: 0.7},
  // The record scratch; Nubi among books; the switch back ON; "¿Qué almuerzo?" by a full plate.
  {scene: 'giro', pre: 0.9, lines: [['L13', 0]], post: 1.8},
  // Nubi comes close; TAREA / TRABAJO / MENSAJES; the squint; the end card.
  {scene: 'final', pre: 0.4, lines: [['L14', 0], ['L15', 0.5]], post: 2.2},
];

export const IA = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: IA_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Each character's body talks only on its own lines (nobody has a mouth). */
export const SPEAKER = {
  nubi: IA.speakerTrack(linesOf('nubi')),
  chico: IA.speakerTrack(linesOf('chico')),
  estudiante: IA.speakerTrack(linesOf('estudiante')),
  jefe: IA.speakerTrack(linesOf('jefe')),
  trabajador: IA.speakerTrack(linesOf('trabajador')),
  influencer: IA.speakerTrack(linesOf('influencer')),
};
