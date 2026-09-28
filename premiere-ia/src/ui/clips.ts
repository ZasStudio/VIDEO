import {C} from '../theme';
import {TLClip} from './Timeline';

// The finished sequence used as the default state of the timeline.
export const DEFAULT_CLIPS: TLClip[] = [
  {id: 'v1a', track: 'V1', start: 0, end: 12, name: 'entrevista.mp4', kind: 'video', thumb: 'vlog'},
  {id: 'v1b', track: 'V1', start: 12, end: 18, name: 'calle_noche.mp4', kind: 'video', thumb: 'city', color: C.clipVideo2},
  {id: 'v1c', track: 'V1', start: 18, end: 24, name: 'graffiti.mp4', kind: 'video', thumb: 'graffiti'},
  {id: 'v2a', track: 'V2', start: 1, end: 5, name: 'titulo.mogrt', kind: 'graphic'},
  {id: 'a1a', track: 'A1', start: 0, end: 12, name: 'entrevista.mp4', kind: 'audio', wave: {type: 'speech', seed: 3}},
  {id: 'a2a', track: 'A2', start: 0, end: 30, name: 'beat_urbano.wav', kind: 'audio', wave: {type: 'music', seed: 5}},
];
