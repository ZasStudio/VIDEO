// Timeline of the Machu Picchu video, driven by Clawd's narration: every scene is as long
// as its lines need, plus breathing room, rounded up to whole music bars (2 s) so cuts land
// on the beat. src/voice-timing.json is produced by scripts/voice_timing.py from the clips.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from './narrated';
import {FPS} from './theme';

export type {Chunk, Word} from './narrated';
export {HIGHLIGHT} from './narrated';

export type SceneKey = 'hook' | 'intro' | 'datos' | 'inca' | 'reto' | 'piedras' | 'sismos' | 'subsuelo' | 'mita' | 'final';
export type LineId = string;

export const BAR = 2 * FPS; // 60 frames

// Seconds of silence before the first line, before each following line, and after the last one.
const PLAN: PlanScene<SceneKey>[] = [
  {scene: 'hook', pre: 1.4, lines: [['L01', 0]], post: 0.6},
  {scene: 'intro', pre: 1.5, lines: [['L02', 0]], post: 0.5},
  {scene: 'datos', pre: 1.1, lines: [['L03', 0], ['L04', 0.9]], post: 0.6},
  {scene: 'inca', pre: 0.6, lines: [['L05', 0]], post: 1.0},
  {scene: 'reto', pre: 0.9, lines: [['L06', 0], ['L07', 0.4], ['L08', 1.5]], post: 0.8},
  {scene: 'piedras', pre: 0.3, lines: [['L09', 0], ['L10', 0.7], ['L11', 0.9], ['L12', 0.8]], post: 0.9},
  {scene: 'sismos', pre: 0.3, lines: [['L13', 0], ['L14', 0.7], ['L15', 0.8]], post: 1.0},
  {scene: 'subsuelo', pre: 0.3, lines: [['L16', 0], ['L17', 1.0], ['L18', 0.8], ['L19', 0.8]], post: 1.0},
  {scene: 'mita', pre: 0.7, lines: [['L20', 0], ['L21', 0.6]], post: 0.9},
  {scene: 'final', pre: 0.8, lines: [['L22', 0], ['L23', 0.9]], post: 1.6},
];

// "¡Machu Picchu sigue en pie!": the word "sigue" falls on a bar line, where the music hits.
const TL = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: BAR,
  hit: {scene: 'final', line: 'L22', word: 7, grid: BAR},
});

export const {
  SCENES,
  DURATION,
  lineStart,
  lineEnd,
  wordAt,
  wordEnd,
  voiceLevel,
  talking,
  ducking,
  voiceAccent,
  accentIndex,
  CAPTIONS,
  LINES,
} = TL;
export const MAIN_TIMELINE = TL;
/** Bar (0-based, within the final scene) where "¡sigue en pie!" and the music's final hit land. */
export const FINAL_HIT_BAR = (TL.hitFrame - SCENES.final.from) / BAR;

/** Song structure for scripts/generate-audio.mjs --song (bars per scene). */
export const songSections = () => {
  const bars = (k: SceneKey) => SCENES[k].duration / BAR;
  return [
    {role: 'intro', bars: bars('hook')},
    {role: 'grooveA', bars: bars('intro') + bars('datos') + bars('inca'), start: 'drop'},
    {role: 'break', bars: bars('reto')},
    {role: 'grooveB', bars: bars('piedras'), start: 'drop'},
    {role: 'grooveB', bars: bars('sismos'), start: 'fill'},
    {role: 'grooveB', bars: bars('subsuelo'), start: 'fill'},
    {role: 'build', bars: bars('mita')},
    {role: 'final', bars: bars('final'), hitBar: FINAL_HIT_BAR},
  ];
};
