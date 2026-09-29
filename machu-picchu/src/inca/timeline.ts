// Timeline of "¿Así sería vivir en el Imperio Inca con celular?" (1080 x 1920, exactly 60 s),
// driven by the narration: Nubi, the phone's messenger and the potato assistant.
// The pauses leave room for the gags (the trip, the nap, the llama's shove); if the voices
// run long they are shortened in proportion so the video still lasts 60 s.
import narration from './narration.json';
import timing from './voice-timing.json';
import {Narration, PlanScene, VoiceTiming, createTimeline} from '../narrated';
import {FPS} from '../theme';

export type IncaScene = 'intro' | 'chasqui' | 'inca' | 'papa' | 'selfie' | 'caminos' | 'cta';

export const INCA_WIDTH = 1080;
export const INCA_HEIGHT = 1920;
export const INCA_TOTAL = 60 * FPS;

// Seconds of silence before the first line, before each following line ([id, gap]) and after the last.
const PLAN: PlanScene<IncaScene>[] = [
  // The phone falls from the sky into Nubi's fins.
  {scene: 'intro', pre: 0.6, lines: [['L01', 0]], post: 0.3},
  // Poof: chasqui. Pututu, running, the trip, typing, the nap.
  {scene: 'chasqui', pre: 0.8, lines: [['L02', 0], ['L03', 0.9], ['L04', 0.4]], post: 1.3},
  // Poof: Sapa Inca on the throne, 99 notifications.
  {scene: 'inca', pre: 0.8, lines: [['L05', 0], ['L06', 0.4], ['L07', 0.3]], post: 0.9},
  // Poof: farmer on the terraces, the potato assistant pops out of the phone.
  {scene: 'papa', pre: 0.7, lines: [['L08', 0], ['L09', 0.5], ['L10', 0.3]], post: 0.9},
  // Machu Picchu selfie, llamas photobomb, one shoves Nubi out.
  {scene: 'selfie', pre: 0.6, lines: [['L11', 0], ['L12', 0.4], ['L13', 0.25]], post: 1.4},
  // Poof: chasqui again in front of the Qhapaq Ñan map.
  {scene: 'caminos', pre: 0.6, lines: [['L14', 0]], post: 0.6},
  // "¿A qué otra época debería viajar Nubi?"
  {scene: 'cta', pre: 0.3, lines: [['L15', 0]], post: 0.8},
];

export const INCA = createTimeline(narration as Narration, timing as unknown as VoiceTiming, PLAN, {
  fps: FPS,
  grid: 1,
  total: INCA_TOTAL,
  squeeze: true,
});

/** Which voice speaks each line (nubi, celular, papa). */
export const VOICE_OF: Record<string, string> = Object.fromEntries(
  (narration as unknown as {lines: {id: string; voice: string}[]}).lines.map((l) => [l.id, l.voice]),
);

const linesOf = (voice: string) => Object.keys(VOICE_OF).filter((id) => VOICE_OF[id] === voice);
/** Voice drivers per speaker: Nubi's body talks only on its own lines; the phone and the potato on theirs. */
export const SPEAKER = {
  nubi: INCA.speakerTrack(linesOf('nubi')),
  celular: INCA.speakerTrack(linesOf('celular')),
  papa: INCA.speakerTrack(linesOf('papa')),
};
