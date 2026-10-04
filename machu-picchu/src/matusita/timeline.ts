// Timeline of "La noche que nadie quiso pasar en la Casa Matusita" (1080 x 1920, exactly 68 s),
// driven by Nubi's narration (whispered, with one line playing the TV host).
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type MatusitaScene = 'gancho' | 'lugar' | 'reto' | 'miedo' | 'susto' | 'verdad' | 'final';

export const MATUSITA_WIDTH = 1080;
export const MATUSITA_HEIGHT = 1920;
export const MATUSITA_TOTAL = 68 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<MatusitaScene>[] = [
  // Darkness, a low hum: only Nubi's eyes, lit by its flashlight.
  {scene: 'gancho', pre: 0.8, lines: [['L01', 0]], post: 0.4},
  // The house at night in the rain; a second-floor window lights up; "algo miraba de vuelta".
  {scene: 'lugar', pre: 1.2, lines: [['L02', 0], ['L03', 1.0]], post: 0.8},
  // Camcorder footage: Nubi plays the TV host, goes in; the door shuts by itself.
  {scene: 'reto', pre: 1.0, lines: [['L04', 0], ['L05', 1.2]], post: 0.6},
  // The hallway, a thump upstairs, footsteps behind; a second shadow on the wall.
  {scene: 'miedo', pre: 0.8, lines: [['L06', 0], ['L07', 1.0]], post: 1.4},
  // Nubi runs, opens a door: its own room, and another Nubi staring at the camera.
  {scene: 'susto', pre: 0.6, lines: [['L08', 0]], post: 1.4},
  // Back in the real room: it was all made up for TV… a knock behind.
  {scene: 'verdad', pre: 1.2, lines: [['L09', 0], ['L10', 0.5]], post: 1.2},
  // Nobody there; the door ajar; the question; the door closes; black.
  {scene: 'final', pre: 0.8, lines: [['L11', 0]], post: 3.0},
];

export const MATUSITA = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: MATUSITA_TOTAL,
  squeeze: true,
});

/** Nubi is the only speaker. */
export const SPEAKER = {
  nubi: MATUSITA.speakerTrack((narration as unknown as {lines: {id: string}[]}).lines.map((l) => l.id)),
};
