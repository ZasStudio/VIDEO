// Builds a video's timeline from its narration: every scene is as long as its lines need,
// plus breathing room, rounded up to a grid (music bars or beats) so cuts land on the beat.
// The voice timing JSON is produced by scripts/voice_timing.py from the voice clips.

export type LineTiming = {duration: number; words: [number, number][]; env: number[]; accents: number[]};
export type NarrationLine = {id: string; scene: string; tts: string; captions: string | null};
export type Narration = {lines: NarrationLine[]};
export type VoiceTiming = {lines: Record<string, LineTiming>};

/** Seconds of silence before the first line, before each following line ([id, gap]), and after the last one. */
export type PlanScene<K extends string> = {scene: K; pre: number; lines: [string, number][]; post: number};

export type TimelineOptions<K extends string> = {
  fps: number;
  /** Scene lengths are rounded up to a multiple of this many frames. */
  grid: number;
  /** Delay one line so this word lands on a multiple of `grid` frames from the start of the video (the music's hit). */
  hit?: {scene: K; line: string; word: number; grid: number};
  /** Stretch the last scene so the video lasts exactly this many frames (it must not be shorter already). */
  total?: number;
};

export type Word = {text: string; at: number; color?: string};
export type Chunk = {from: number; to: number; words: Word[]};

export const HIGHLIGHT: Record<string, string> = {
  y: '#FFD60A',
  o: '#FF8A3D',
  g: '#4DFF7C',
  r: '#FF4B3E',
  c: '#4FE3FF',
};

export const createTimeline = <K extends string>(
  narration: Narration,
  timing: VoiceTiming,
  plan: PlanScene<K>[],
  opts: TimelineOptions<K>,
) => {
  const {fps, grid} = opts;
  const T = timing.lines;
  const lineStartMap: Record<string, number> = {};
  const SCENES = {} as Record<K, {from: number; duration: number}>;
  let hitFrame = -1;

  let cursor = 0;
  plan.forEach((s, si) => {
    let t = Math.round(s.pre * fps);
    s.lines.forEach(([id, gap], k) => {
      if (k > 0) t += Math.round(gap * fps);
      if (opts.hit && opts.hit.line === id) {
        // Push the line so the hit word falls exactly on the grid.
        const word = Math.round(T[id].words[opts.hit.word][0] * fps);
        const at = Math.ceil((cursor + t + word) / opts.hit.grid) * opts.hit.grid;
        t = at - word - cursor;
        hitFrame = at;
      }
      lineStartMap[id] = cursor + t;
      t += Math.ceil(T[id].duration * fps);
    });
    t += Math.round(s.post * fps);
    let duration = Math.ceil(t / grid) * grid;
    if (opts.total !== undefined && si === plan.length - 1) {
      if (cursor + t > opts.total) throw new Error(`narration needs ${cursor + t} frames, more than ${opts.total}`);
      duration = opts.total - cursor;
    }
    SCENES[s.scene] = {from: cursor, duration};
    cursor += duration;
  });

  const DURATION = cursor;
  const lineStart = (id: string) => lineStartMap[id];
  const lineEnd = (id: string) => lineStartMap[id] + Math.ceil(T[id].duration * fps);
  /** Global frame where word `i` of line `id` starts (negative i counts from the end). */
  const wordAt = (id: string, i: number) => {
    const w = T[id].words;
    return lineStartMap[id] + Math.round(w[i < 0 ? w.length + i : i][0] * fps);
  };
  const wordEnd = (id: string, i: number) => {
    const w = T[id].words;
    return lineStartMap[id] + Math.round(w[i < 0 ? w.length + i : i][1] * fps);
  };

  // -------------------------------------------------------------------------- voice level
  const LEVEL = new Float32Array(DURATION + 1);
  const ACCENTS: number[] = [];
  for (const id of Object.keys(lineStartMap)) {
    const start = lineStartMap[id];
    T[id].env.forEach((v, k) => {
      if (start + k <= DURATION) LEVEL[start + k] = Math.max(LEVEL[start + k], v);
    });
    for (const a of T[id].accents) ACCENTS.push(start + a);
  }
  ACCENTS.sort((a, b) => a - b);

  /** Loudness of the voice at frame g (0..1). */
  const voiceLevel = (g: number) => (g >= 0 && g <= DURATION ? LEVEL[Math.floor(g)] : 0);

  /** Smoothed "is talking" amount (fast attack, slow release) for body motion. */
  const ACTIVE = new Float32Array(DURATION + 1);
  {
    let v = 0;
    for (let f = 0; f <= DURATION; f++) {
      const target = LEVEL[f] > 0.08 ? 1 : 0;
      v += (target - v) * (target > v ? 0.5 : 0.08);
      ACTIVE[f] = v;
    }
  }
  const talking = (g: number) => (g >= 0 && g <= DURATION ? ACTIVE[Math.floor(g)] : 0);

  /** Ducking envelope for the music (0..1): starts a few frames before the voice and holds
   *  through short pauses, so the music does not pump between words. */
  const DUCK = new Float32Array(DURATION + 1);
  {
    const AHEAD = 4;
    const HOLD = 18;
    let last = -1e9;
    let v = 0;
    for (let f = 0; f <= DURATION; f++) {
      if (LEVEL[Math.min(DURATION, f + AHEAD)] > 0.08) last = f;
      const target = f - last <= HOLD ? 1 : 0;
      v += (target - v) * (target > v ? 0.35 : 0.06);
      DUCK[f] = v;
    }
  }
  const ducking = (g: number) => (g >= 0 && g <= DURATION ? DUCK[Math.floor(g)] : 0);

  /** Decaying pulse after each syllable accent (0..1). */
  const voiceAccent = (g: number, decay = 4) => {
    let lo = 0;
    let hi = ACCENTS.length - 1;
    let last = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ACCENTS[mid] <= g) {
        last = ACCENTS[mid];
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (last < 0) return 0;
    const d = g - last;
    return d > decay * 4 ? 0 : Math.exp(-d / decay);
  };

  /** Index of the accent at or before g (to alternate gestures between sides). */
  const accentIndex = (g: number) => {
    let n = 0;
    for (const a of ACCENTS) {
      if (a <= g) n++;
      else break;
    }
    return n;
  };

  // -------------------------------------------------------------------------- captions
  // Syntax: chunks separated by " / "; TOKEN{n} covers n spoken words; ^y|o|g|r|c colours it;
  // ~TOKEN is spoken but not shown (a 3D title shows it); "_" is a non-breaking space.
  const buildCaptions = (): Chunk[] => {
    const chunks: Chunk[] = [];
    for (const line of narration.lines) {
      if (!line.captions) continue;
      let wordIdx = 0;
      const lineChunks: Chunk[] = [];
      for (const part of line.captions.split(' / ')) {
        const words: Word[] = [];
        for (const raw of part.split(' ')) {
          let tok = raw;
          const hidden = tok.startsWith('~');
          if (hidden) tok = tok.slice(1);
          const span = /\{(\d+)\}/.exec(tok);
          tok = tok.replace(/\{\d+\}/, '');
          const col = /\^([a-z])$/.exec(tok);
          if (col) tok = tok.slice(0, -2);
          if (!hidden) words.push({text: tok.replace(/_/g, '\u00a0'), at: wordAt(line.id, wordIdx), color: col ? HIGHLIGHT[col[1]] : undefined});
          wordIdx += span ? Number(span[1]) : 1;
        }
        if (words.length) lineChunks.push({from: words[0].at, to: 0, words});
      }
      lineChunks.forEach((c, k) => {
        c.to = k + 1 < lineChunks.length ? lineChunks[k + 1].from : lineEnd(line.id) + 10;
      });
      chunks.push(...lineChunks);
    }
    // Never overlap the next line's first chunk.
    chunks.sort((a, b) => a.from - b.from);
    chunks.forEach((c, k) => {
      if (k + 1 < chunks.length) c.to = Math.min(c.to, chunks[k + 1].from);
    });
    return chunks;
  };

  const CAPTIONS = buildCaptions();
  const LINES = narration.lines.map((l) => ({id: l.id, scene: l.scene as K, start: lineStartMap[l.id], end: lineEnd(l.id)}));

  return {
    SCENES,
    DURATION,
    /** Frame of the hit word (see opts.hit), or -1. */
    hitFrame,
    lineStart,
    lineEnd,
    wordAt,
    wordEnd,
    voiceLevel,
    talking,
    ducking,
    voiceAccent,
    accentIndex,
    CAPTIONS,
    LINES,
  };
};

export type Timeline = ReturnType<typeof createTimeline>;
