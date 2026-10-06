// Timeline of "¿Y si dormir te pagara?" (1080 x 1920, exactly 75 s), driven by the narration: Nubi,
// its boss, a sleepy baker and a neighbour who sells silence.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type DormirScene = 'gancho' | 'oficina' | 'problema' | 'mundo' | 'enemigo' | 'giro' | 'final';

export const DORMIR_WIDTH = 1080;
export const DORMIR_HEIGHT = 1920;
export const DORMIR_TOTAL = 75 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<DormirScene>[] = [
  // The money counter over Nubi's bed rises (cha-ching); the alarm; the smash; Nubi to camera.
  {scene: 'gancho', pre: 1.4, lines: [['L01', 0], ['L02', 0.3]], post: 0.6},
  // The office full of beds: Nubi dives into one; the boss; the snore; the proud nod.
  {scene: 'oficina', pre: 1.4, lines: [['L03', 0], ['L04', 0.2], ['L05', 1.1]], post: 0.4},
  // Nubi's counter stuck at S/0, the colleague's at S/800; "DESPIERTO"; the peek.
  {scene: 'problema', pre: 0.6, lines: [['L06', 0], ['L07', 0.6]], post: 0.8},
  // The bakery: the baker asleep on the counter; the bell; S/100 bread.
  {scene: 'mundo', pre: 1.0, lines: [['L08', 0], ['L09', 1.2], ['L10', 0.3], ['L11', 0.3]], post: 0.6},
  // Back in bed: the drill; the neighbour with a speaker; the look to camera.
  {scene: 'enemigo', pre: 1.0, lines: [['L12', 0], ['L13', 0.8], ['L14', 0.6]], post: 0.6},
  // Pays, sleep mask, the money montage to S/1000; the charges; zero.
  {scene: 'giro', pre: 1.3, lines: [['L15', 0], ['L16', 1.4]], post: 0.6},
  // The question to camera; the alarm again; the threat; smash, back to sleep: the loop.
  {scene: 'final', pre: 0.6, lines: [['L17', 0], ['L18', 1.0]], post: 2.0},
];

export const DORMIR = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: DORMIR_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Each character's body talks only on its own lines (nobody has a mouth). */
export const SPEAKER = {
  nubi: DORMIR.speakerTrack(linesOf('nubi')),
  jefe: DORMIR.speakerTrack(linesOf('jefe')),
  panadero: DORMIR.speakerTrack(linesOf('panadero')),
  vecino: DORMIR.speakerTrack(linesOf('vecino')),
};
