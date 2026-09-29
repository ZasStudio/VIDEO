// Timeline of "¿Y si desaparece el oxígeno por 5 segundos?" (1080 x 1920, exactly 60 s),
// driven by the narration: Nubi and the lab's alarm computer.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type OxiScene = 'intro' | 'boton' | 'fuego' | 'motores' | 'humanos' | 'regreso' | 'final';

export const OXI_WIDTH = 1080;
export const OXI_HEIGHT = 1920;
export const OXI_TOTAL = 60 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<OxiScene>[] = [
  // Lab: Nubi the scientist next to the big red button.
  {scene: 'intro', pre: 0.35, lines: [['L01', 0]], post: 0.3},
  // Press! The air is sucked out, the alarm goes off, the gauge drops to 0 %.
  {scene: 'boton', pre: 0.8, lines: [['L02', 0], ['L03', 0.35]], post: 0.5},
  // Poof: firefighter. Candles, stove, campfire and the coffee go out.
  {scene: 'fuego', pre: 0.4, lines: [['L04', 0]], post: 0.6},
  // Poof: pilot. The engine dies and the plane glides; a rocket zooms past.
  {scene: 'motores', pre: 0.4, lines: [['L05', 0], ['L06', 0.5]], post: 0.5},
  // Poof: plain Nubi, dramatic gasp; then the ears pop.
  {scene: 'humanos', pre: 0.4, lines: [['L07', 0], ['L08', 0.3]], post: 0.5},
  // The oxygen comes back with a pop; the candle does not light by itself.
  {scene: 'regreso', pre: 0.9, lines: [['L09', 0]], post: 0.4},
  // Gauge back at 21 %, Nubi hugs an oxygen tank and points at the comments.
  {scene: 'final', pre: 0.4, lines: [['L10', 0], ['L11', 0.5]], post: 0.6},
];

export const OXI = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: OXI_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Nubi's body talks only on its own lines; the alarm's lines drive the lab's warning light. */
export const SPEAKER = {
  nubi: OXI.speakerTrack(linesOf('nubi')),
  sistema: OXI.speakerTrack(linesOf('sistema')),
};

/**
 * Frames skipped at the start of the music (Magnific, 110 BPM): the song's quiet breakdown
 * falls while the oxygen is gone and its full section comes back on the downbeat (54.6 s)
 * exactly when the oxygen returns with a pop.
 */
export const MUSIC_TRIM = 379;
