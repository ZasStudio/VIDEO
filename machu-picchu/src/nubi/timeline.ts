// Timeline of Nubi's vertical short (1080 x 1920, exactly 15 s), driven by its narration.
// A short cuts tight: each scene ends right after its line. "¡Por eso sigue en pie!": the
// word "sigue" lands on a beat (0.5 s at 120 BPM), and the music is started a little into its
// first bar (MUSIC_OFFSET) so that its final hit falls exactly on that word.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type NubiScene = 'hook' | 'piedras' | 'sismo' | 'final';

export const NUBI_WIDTH = 1080;
export const NUBI_HEIGHT = 1920;
export const NUBI_TOTAL = 15 * FPS;
export const BEAT = FPS / 2;
export const BAR = 2 * FPS;

// Seconds of silence before the first line, between lines and after the last one.
const PLAN: PlanScene<NubiScene>[] = [
  {scene: 'hook', pre: 0.15, lines: [['L01', 0]], post: 0.2},
  {scene: 'piedras', pre: 0.1, lines: [['L02', 0]], post: 0.2},
  {scene: 'sismo', pre: 0.1, lines: [['L03', 0]], post: 0.2},
  {scene: 'final', pre: 0.1, lines: [['L04', 0]], post: 0.6},
];

export const NUBI = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  hit: {scene: 'final', line: 'L04', word: 2, grid: BEAT},
  total: NUBI_TOTAL,
});

/** Frames of music skipped at the start, so its hit (a bar line) lands on "sigue". */
export const MUSIC_OFFSET = Math.ceil(NUBI.hitFrame / BAR) * BAR - NUBI.hitFrame;

/** Song plan for scripts/generate-audio.mjs (bars in music time, which runs MUSIC_OFFSET ahead). */
export const nubiSong = () => {
  const hitBar = (NUBI.hitFrame + MUSIC_OFFSET) / BAR;
  const bars = Math.ceil((NUBI_TOTAL + MUSIC_OFFSET) / BAR) + 1;
  const finalFrom = Math.max(1, hitBar - 2);
  return {
    voiceMix: true,
    sections: [
      {role: 'grooveB', bars: finalFrom, start: 'drop'},
      {role: 'final', bars: bars - finalFrom, hitBar: hitBar - finalFrom},
    ],
  };
};
