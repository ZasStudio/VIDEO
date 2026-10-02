// Timeline of "¿Y si toda el agua desapareciera?" (1080 x 1920, exactly 70 s), driven by the
// narration: Nubi and, in the alley, the shady seller.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type AguaScene = 'hook' | 'antes' | 'problema' | 'solucion' | 'peligro' | 'giro' | 'final';

export const AGUA_WIDTH = 1080;
export const AGUA_HEIGHT = 1920;
export const AGUA_TOTAL = 70 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<AguaScene>[] = [
  // The water in Nubi's glass vanishes; the ocean drains into a desert; flash-forward: the chase
  // with the last bottle, freeze frame.
  {scene: 'hook', pre: 0.05, lines: [['L01', 0], ['L02', 0.6]], post: 0.8},
  // "DOS HORAS ANTES": the tap gives nothing; the dry beach and the ship leaning over Nubi.
  {scene: 'antes', pre: 0.9, lines: [['L03', 0], ['L04', 1.2]], post: 0.5},
  // The plant wilts; the fields wither; the empty supermarket and the potato behind lasers.
  {scene: 'problema', pre: 0.8, lines: [['L05', 0], ['L06', 0.3], ['L07', 0.9]], post: 0.4},
  // "Pssst": the seller, the safe, the price, three soles and a portrait.
  {scene: 'solucion', pre: 0.2, lines: [['L08', 0], ['L09', 1.0], ['L10', 0.3], ['L11', 1.4]], post: 0.6},
  // The street goes silent, every head turns; the chase; the thin pole.
  {scene: 'peligro', pre: 1.4, lines: [['L12', 0], ['L13', 1.2]], post: 1.0},
  // The bottle is empty: a hole; the trail of drops; the last drop in slow motion.
  {scene: 'giro', pre: 0.6, lines: [['L14', 0], ['L15', 0.5], ['L16', 0.7]], post: 0.3},
  // It was a nightmare: the tap works; the question to the viewer.
  {scene: 'final', pre: 1.0, lines: [['L17', 0], ['L18', 0.3], ['L19', 0.4], ['L20', 0.2]], post: 1.6},
];

export const AGUA = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: AGUA_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Nubi's body talks only on its own lines; the seller's on his. */
export const SPEAKER = {
  nubi: AGUA.speakerTrack(linesOf('nubi')),
  seller: AGUA.speakerTrack(linesOf('seller')),
};
