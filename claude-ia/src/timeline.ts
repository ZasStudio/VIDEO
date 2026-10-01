import {S1_DURATION} from './scenes/S1Spark';
import {S2_DURATION} from './scenes/S2Rings';
import {S3_DURATION} from './scenes/S3Think';
import {S4_DURATION} from './scenes/S4Chat';
import {S5_DURATION} from './scenes/S5Reason';
import {S6_DURATION} from './scenes/S6Frame';
import {S7_DURATION} from './scenes/S7Dashboard';
import {S8_DURATION} from './scenes/S8Artifact';
import {S9_DURATION} from './scenes/S9Clear';
import {S10_DURATION} from './scenes/S10Forward';
import {S11_DURATION} from './scenes/S11Understand';
import {S12_DURATION} from './scenes/S12Outro';

// Duraciones en frames (30 fps). Todas son múltiplos de medio compás (36 frames)
// para que cada corte caiga en un tiempo fuerte de la música (100 BPM).
export const DURATIONS = [
  S1_DURATION,
  S2_DURATION,
  S3_DURATION,
  S4_DURATION,
  S5_DURATION,
  S6_DURATION,
  S7_DURATION,
  S8_DURATION,
  S9_DURATION,
  S10_DURATION,
  S11_DURATION,
  S12_DURATION,
];

/** Frame absoluto en que empieza cada escena. */
export const STARTS = DURATIONS.reduce<number[]>((acc, d, i) => [...acc, i === 0 ? 0 : acc[i - 1] + DURATIONS[i - 1]], []);

export const TOTAL = DURATIONS.reduce((a, b) => a + b, 0);
