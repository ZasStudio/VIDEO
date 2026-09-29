// Timeline of "¿Y si los dinosaurios nunca se hubieran extinguido?" (1080 x 1920, exactly 60 s),
// driven by the narration: Nubi and, off screen, Nubi's mum.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type DinoScene = 'intro' | 'pasa' | 'ciudad' | 'pizza' | 'cavernicola' | 'rey' | 'final';

export const DINO_WIDTH = 1080;
export const DINO_HEIGHT = 1920;
export const DINO_TOTAL = 60 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<DinoScene>[] = [
  // Nubi the scientist and the asteroid coming (seen through the telescope).
  {scene: 'intro', pre: 0.4, lines: [['L01', 0]], post: 0.4},
  // The asteroid misses the Earth; Nubi celebrates; stomps, a shadow, the T-Rex's point of view.
  {scene: 'pasa', pre: 0.7, lines: [['L02', 0], ['L03', 1.2]], post: 0.8},
  // Poof: tourist in a city with giant walls, a T-Rex in the street and the sign.
  {scene: 'ciudad', pre: 0.4, lines: [['L04', 0], ['L05', 0.3]], post: 0.5},
  // Poof: pizza delivery in first person; a feathered raptor snatches the box; mum says no.
  {scene: 'pizza', pre: 0.4, lines: [['L06', 0], ['L07', 0.9], ['L08', 0.3], ['L09', 0.2]], post: 0.6},
  // Poof: tiny caveman among giant dinosaurs; human existence fades out.
  {scene: 'cavernicola', pre: 0.4, lines: [['L10', 0], ['L11', 0.3]], post: 0.5},
  // Poof: dino king on a bone throne; the roar; "…y nosotros seríamos el snack".
  {scene: 'rey', pre: 0.5, lines: [['L12', 0], ['L13', 0.9]], post: 0.4},
  // First-person chase with the phone; the closing question.
  {scene: 'final', pre: 0.3, lines: [['L14', 0], ['L15', 0.3]], post: 0.5},
];

export const DINO = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: DINO_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Nubi's body talks only on its own lines; mum's line drives her speech bubble. */
export const SPEAKER = {
  nubi: DINO.speakerTrack(linesOf('nubi')),
  mama: DINO.speakerTrack(linesOf('mama')),
};

/**
 * Frames skipped at the start of the music (Magnific, 115 BPM): the video opens on the onset of
 * the song's full section (75.2 s) and the section's last hit (134.7 s) lands at 59.5 s, just as
 * the closing question ends.
 */
export const MUSIC_TRIM = 2256;
