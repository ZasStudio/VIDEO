// Sound design of the AI short (filled in once the shots are timed).
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { IA } from "./timeline";

export const MUSIC_PARTS: MusicPart[] = [[0, IA.DURATION, 0, 10, 20]];
export const musicGain = () => 1;
export const CUES: Cue[] = [];
export const BEDS: Bed[] = [];
