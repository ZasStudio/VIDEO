// Sound design of "¿Y si tus mentiras salieran sobre tu cabeza?": the Magnific effects
// ("mentiras/<name>"), a few from the earlier shorts, and the cheeky score cut to the scenes.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { MENTIRAS_TOTAL } from "./timeline";

/** Placeholder: the whole score once (cut to the scenes in the sound-design pass). */
export const MUSIC_PARTS: MusicPart[] = [[0, MENTIRAS_TOTAL, 0, 0, 20]];

export const musicGain = (g: number) => (g >= 0 ? 1 : 1);

export const CUES: Cue[] = [];

export const BEDS: Bed[] = [];
