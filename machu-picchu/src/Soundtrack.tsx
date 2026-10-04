import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { BEDS, CUES } from "./cues";
import { BED_FRAMES, Bed as BedCue, Cue, sfxFile } from "./sfx";
import { DURATION, LINES, ducking } from "./timeline";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Mix bus. The narrator leads (about 10 dB over everything else while it speaks); the
// music ducks under it and swells back in the pauses, and the effects step back a bit.
const VOICE = 1.0;
const MUSIC = 0.5;
const MUSIC_DUCK = 0.65;
const SFX_GAIN = 0.7;
const SFX_DUCK = 0.45;
const BED_DUCK = 0.45;

/**
 * A piece of the music: [from, to (global frames), trim (frames into the file), fade-in, fade-out,
 * other music file (in public/) instead of the main one].
 */
export type MusicPart = [number, number, number, number?, number?, string?];

/** Overlapping copies of a short loop with equal-power crossfades. */
const Bed: React.FC<{
  from: number;
  to: number;
  sfx: string;
  volume: number;
  len: number;
  duck: (g: number) => number;
  /** Frames of fade at the very end (a short one cuts the ambience dead). */
  fadeOut?: number;
}> = ({ from, to, sfx, volume, len, duck, fadeOut = 20 }) => {
  const xf = Math.round(len / 6);
  const pieces: { at: number; dur: number; first: boolean; last: boolean }[] = [];
  for (let at = from; at < to; at += len - xf) {
    const last = at + len >= to;
    pieces.push({ at, dur: last ? to - at : len, first: at === from, last });
    if (last) break;
  }
  return (
    <>
      {pieces.map((p) => (
        <Sequence key={p.at} name={sfx} from={p.at} durationInFrames={p.dur} layout="none">
          <Audio
            src={staticFile(sfxFile(sfx))}
            volume={(f) => {
              const fin = p.first ? interpolate(f, [0, 12], [0, 1], CLAMP) : Math.sin((Math.PI / 2) * Math.min(1, f / xf));
              const fout = p.last
                ? interpolate(f, [p.dur - fadeOut, p.dur], [1, 0], CLAMP)
                : Math.cos((Math.PI / 2) * Math.max(0, Math.min(1, (f - (p.dur - xf)) / xf)));
              return volume * SFX_GAIN * fin * fout * (1 - BED_DUCK * duck(p.at + f));
            }}
          />
        </Sequence>
      ))}
    </>
  );
};

/** Narration clips, ducked music, looping beds and one-shot effects. */
export const Mix: React.FC<{
  /** Music file (in public/) and frames to skip at its start. */
  music: string;
  musicTrim?: number;
  duration: number;
  /** Frames of fade at the end of the music. */
  fadeOut?: number;
  /** Frame where the music stops (default: the end of the video); it fades out over `fadeOut` before it. */
  musicTo?: number;
  /** Plays these pieces of the music file instead of one continuous take (cuts, re-entries). */
  musicParts?: MusicPart[];
  /** Extra gain on the music by global frame (dips under a whisper, silences). */
  musicGain?: (g: number) => number;
  cues: Cue[];
  beds: BedCue[];
  lines: { id: string; start: number }[];
  /** Folder in public/ with <line id>.wav. */
  voiceDir: string;
  ducking: (g: number) => number;
}> = ({ music, musicTrim = 0, duration, fadeOut = 4, musicTo, musicParts, musicGain, cues, beds, lines, voiceDir, ducking }) => {
  const parts: MusicPart[] = musicParts ?? [[0, musicTo ?? duration, musicTrim, 3, fadeOut]];
  return (
    <>
      {parts.map(([from, to, trim, fadeIn = 3, fade = fadeOut, file], i) => {
        const len = to - from;
        const fin = Math.max(1, fadeIn);
        const fout = Math.max(1, Math.min(fade, len - fin - 1));
        return (
          <Sequence key={`music${i}`} name="Música" from={from} durationInFrames={len} layout="none">
            <Audio
              src={staticFile(file ?? music)}
              trimBefore={trim || undefined}
              volume={(f) =>
                MUSIC *
                (1 - MUSIC_DUCK * ducking(from + f)) *
                (musicGain ? musicGain(from + f) : 1) *
                interpolate(f, [0, fin, len - fout, len], [0, 1, 1, 0], CLAMP)
              }
            />
          </Sequence>
        );
      })}
      {beds.map(([from, to, sfx, volume, fade]) => (
        <Bed key={`${sfx}${from}`} from={from} to={to} sfx={sfx} volume={volume} len={BED_FRAMES[sfx] ?? 60} duck={ducking} fadeOut={fade} />
      ))}
      {cues.map(([from, sfx, volume, len, trim], i) => (
        <Sequence key={i} name={sfx} from={from} durationInFrames={len} layout="none">
          <Audio
            src={staticFile(sfxFile(sfx))}
            trimBefore={trim || undefined}
            volume={(f) =>
              SFX_GAIN *
              volume *
              (1 - SFX_DUCK * ducking(from + f)) *
              (len ? interpolate(f, [len - 8, len], [1, 0], CLAMP) : 1)
            }
          />
        </Sequence>
      ))}
      {lines.map((l) => (
        <Sequence key={l.id} name={`voz ${l.id}`} from={l.start} layout="none">
          <Audio src={staticFile(`${voiceDir}/${l.id}.wav`)} volume={VOICE} />
        </Sequence>
      ))}
    </>
  );
};

export const Soundtrack: React.FC = () => (
  <Mix music="audio/music.wav" duration={DURATION} cues={CUES} beds={BEDS} lines={LINES} voiceDir="voice" ducking={ducking} />
);
