// Timeline of "¿Y si Thanos NUNCA chasqueaba los dedos?" (1080 x 1920, exactly 90 s), driven by
// the narration: Nubi and, in the post-credits scene, the masked villain.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type ThanosScene =
  | 'portal'
  | 'carrera'
  | 'thor'
  | 'heroes'
  | 'trajes'
  | 'piedras'
  | 'portales'
  | 'final'
  | 'poscreditos'
  | 'doom'
  | 'cierre';

export const THANOS_WIDTH = 1080;
export const THANOS_HEIGHT = 1920;
export const THANOS_TOTAL = 90 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<ThanosScene>[] = [
  // Nubi drops out of a portal into the battle, frozen in time; Thanos with the gauntlet up.
  {scene: 'portal', pre: 0.9, lines: [['L01', 0]], post: 0.2},
  // Slow-motion run towards Thanos ("Fácil, ¿no?"), the trip over a rock, the fall.
  {scene: 'carrera', pre: 0.3, lines: [['L02', 0], ['L03', 0.25], ['L04', 1.0]], post: 0.2},
  // Poof: Nubi as the thunder god throws the hammer (first person along it); the gauntlet
  // cracks; Thanos snaps… *click*; no cosmic signal.
  {scene: 'thor', pre: 0.9, lines: [['L05', 0], ['L06', 4.0]], post: 0.4},
  // Everyone who used to vanish is still here: the heroes land one after another.
  {scene: 'heroes', pre: 1.0, lines: [['L07', 0], ['L08', 0.4]], post: 0.6},
  // Quick costume changes: shield, hammer, rays, magic… and a rock.
  {scene: 'trajes', pre: 1.2, lines: [['L09', 0], ['L10', 0.6]], post: 1.6},
  // Thanos, furious, fires the stones: the ground breaks and Nubi is launched.
  {scene: 'piedras', pre: 1.3, lines: [['L11', 0], ['L12', 0.6]], post: 1.4},
  // Giant portals open, armies pour out: the biggest battle in history.
  {scene: 'portales', pre: 1.5, lines: [['L13', 0]], post: 1.8},
  // Nubi keeps the switched-off gauntlet… and tries to order a pizza with it.
  {scene: 'final', pre: 0.4, lines: [['L14', 0], ['L15', 0.8]], post: 0.4},
  // Black: "ESCENA POSCRÉDITOS…" and a metallic clank.
  {scene: 'poscreditos', pre: 2.6, lines: [], post: 0},
  // A dark castle: a metal hand picks up the gauntlet; the masked villain; Nubi off screen.
  {scene: 'doom', pre: 1.3, lines: [['L16', 0], ['L17', 0.5], ['L18', 1.0]], post: 0.3},
  // Black: "¿Nubi debería enfrentar a Doctor Doom?"
  {scene: 'cierre', pre: 2.4, lines: [], post: 0},
];

export const THANOS = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: THANOS_TOTAL,
  squeeze: true,
});

const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);
const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Nubi's body talks only on its own lines; the villain's drive his eye glow. */
export const SPEAKER = {
  nubi: THANOS.speakerTrack(linesOf('nubi')),
  doom: THANOS.speakerTrack(linesOf('doom')),
};

/** Frame where the music's climax (its hit at 108.0 s, right after a one-second hush) lands. */
export const MUSIC_HIT = THANOS.SCENES.portales.from + 20;
/**
 * Frames skipped at the start of the main music (Magnific, Lyria): the climax hits as the giant
 * portals open, so the video opens on the hit at 51.5 s and the hush before the climax falls
 * while Nubi is launched into the air.
 */
export const MUSIC_TRIM = Math.round(108.0 * FPS) - MUSIC_HIT;
/** The main music stops on the cut to black of the post-credits scene. */
export const MUSIC_TO = THANOS.SCENES.poscreditos.from + 4;
/**
 * The dark post-credits theme (30 s): it starts under the "ESCENA POSCRÉDITOS…" card and its
 * final hit (25.5 s into the file) lands on the cut to the closing question.
 */
export const DARK_FROM = THANOS.SCENES.poscreditos.from + 15;
export const DARK_TRIM = Math.round(25.5 * FPS) - (THANOS.SCENES.cierre.from - DARK_FROM);
