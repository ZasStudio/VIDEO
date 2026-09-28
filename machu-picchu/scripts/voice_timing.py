"""Prepares Clawd's narration for the video.

For every line of src/narration.json it takes the raw voice clip, trims the silence,
writes public/voice/<id>.wav and measures:
  - duration,
  - the start/end of every spoken word, found by aligning the clip against an eSpeak NG
    synthesis of the same text (MFCC features + dynamic time warping, the same idea as
    the aeneas forced aligner), so captions and 3D titles land on the words,
  - the voice energy per video frame (30 fps) and its syllable accents, which drive
    Clawd's "talking" body movement (Clawd has no mouth).
Everything goes to src/voice-timing.json.

    python3 scripts/voice_timing.py <raw_dir>            # raw_dir holds L01.mp3|wav ...
    python3 scripts/voice_timing.py <raw_dir> --standin  # first synthesise stand-ins with eSpeak
"""

import json
import os
import re
import subprocess
import sys
import wave

import numpy as np
from scipy import signal
from scipy.fft import dct
from scipy.spatial.distance import cdist

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

FPS = 30
OUT_RATE = 48000
FEAT_RATE = 16000
HOP = 160  # 10 ms at 16 kHz

PUNCT = "¡!¿?.,:;…\"'«»()—-"


def tts_to_spoken(tts):
    """Text actually spoken: drops [performance tags]."""
    return re.sub(r"\[[^\]]*\]", " ", tts).strip()


def spoken_words(tts):
    words = []
    for tok in tts_to_spoken(tts).split():
        w = tok.strip(PUNCT)
        if w:
            words.append(w)
    return words


def caption_word_count(captions):
    n = 0
    for tok in captions.replace(" / ", " ").split():
        m = re.search(r"\{(\d+)\}", tok)
        n += int(m.group(1)) if m else 1
    return n


# ----------------------------------------------------------------------------- audio io
def ffmpeg(*args):
    subprocess.run(["npx", "remotion", "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args], cwd=ROOT, check=True)


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        ch = w.getnchannels()
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    if ch > 1:
        data = data.reshape(-1, ch).mean(axis=1)
    return data, sr


def write_wav(path, x, sr):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def load_clip(raw_dir, line_id, tmp_dir):
    for ext in ("wav", "mp3"):
        p = os.path.join(raw_dir, f"{line_id}.{ext}")
        if os.path.exists(p):
            out = os.path.join(tmp_dir, f"{line_id}-48k.wav")
            ffmpeg("-i", p, "-ac", "1", "-ar", str(OUT_RATE), "-sample_fmt", "s16", out)
            return read_wav(out)
    raise FileNotFoundError(f"no raw clip for {line_id} in {raw_dir}")


# ----------------------------------------------------------------------------- analysis
def rms_db(x, sr, win_s=0.02, hop_s=0.005):
    win = int(sr * win_s)
    hop = int(sr * hop_s)
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (win // 2, win // 2)), win)[::hop]
    return 20 * np.log10(np.sqrt((frames**2).mean(axis=1)) + 1e-9), hop


def trim_bounds(x, sr, thresh_db=-42, margin_s=0.04):
    db, hop = rms_db(x, sr)
    idx = np.where(db > thresh_db)[0]
    if len(idx) == 0:
        return 0, len(x)
    start = max(0, idx[0] * hop - int(margin_s * sr))
    end = min(len(x), (idx[-1] + 1) * hop + int(margin_s * sr))
    return start, end


def frame_envelope(x, sr):
    """Voice energy per video frame, 0..1, plus accent frames (syllable onsets)."""
    db, hop = rms_db(x, sr, win_s=0.03, hop_s=0.01)
    level = np.clip((db + 48) / 34, 0, 1)
    n_frames = int(np.ceil(len(x) / sr * FPS))
    env = np.zeros(n_frames)
    t = np.arange(len(level)) * hop / sr
    for f in range(n_frames):
        sel = level[(t >= f / FPS) & (t < (f + 1) / FPS)]
        env[f] = sel.max() if len(sel) else 0
    env = signal.lfilter([0.6], [1, -0.4], env)  # tiny smoothing
    # Accents: rises in energy (syllable nuclei), at least 4 frames apart.
    rise = np.diff(np.concatenate([[0], env]))
    peaks, _ = signal.find_peaks(rise, height=0.12, distance=4)
    return [round(float(v), 3) for v in np.clip(env, 0, 1)], [int(p) for p in peaks]


def mel_bank(sr, n_fft, n_mels=26, fmin=80, fmax=7600):
    def hz2mel(f):
        return 2595 * np.log10(1 + f / 700)

    def mel2hz(m):
        return 700 * (10 ** (m / 2595) - 1)

    pts = mel2hz(np.linspace(hz2mel(fmin), hz2mel(fmax), n_mels + 2))
    bins = np.floor((n_fft + 1) * pts / sr).astype(int)
    fb = np.zeros((n_mels, n_fft // 2 + 1))
    for m in range(1, n_mels + 1):
        a, b, c = bins[m - 1], bins[m], bins[m + 1]
        for k in range(a, b):
            fb[m - 1, k] = (k - a) / max(1, b - a)
        for k in range(b, c):
            fb[m - 1, k] = (c - k) / max(1, c - b)
    return fb


def features(x, sr):
    x = signal.resample_poly(x, FEAT_RATE, sr)
    x = np.append(x[0], x[1:] - 0.97 * x[:-1])
    win, n_fft = 400, 512
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(x, (win // 2, win // 2)), win)[::HOP]
    frames = frames * np.hamming(win)
    spec = np.abs(np.fft.rfft(frames, n_fft)) ** 2
    logmel = np.log(spec @ mel_bank(FEAT_RATE, n_fft).T + 1e-10)
    ceps = dct(logmel, type=2, axis=1, norm="ortho")[:, 1:13]
    energy = np.log((frames**2).sum(axis=1) + 1e-10)[:, None]
    f = np.hstack([ceps, energy * 0.8])
    return (f - f.mean(0)) / (f.std(0) + 1e-8)


def dtw_path(A, B):
    C = cdist(A, B)
    n, m = C.shape
    D = np.full((n + 1, m + 1), np.inf)
    D[0, 0] = 0
    for i in range(1, n + 1):
        prev = D[i - 1]
        row = D[i]
        ci = C[i - 1]
        best = np.minimum(prev[1:], prev[:-1])  # up, diagonal
        for j in range(1, m + 1):
            v = best[j - 1]
            if row[j - 1] < v:
                v = row[j - 1]
            row[j] = ci[j - 1] + v
    i, j = n, m
    path = [(i - 1, j - 1)]
    while i > 1 or j > 1:
        cands = []
        if i > 1 and j > 1:
            cands.append((D[i - 1, j - 1], i - 1, j - 1))
        if i > 1:
            cands.append((D[i - 1, j], i - 1, j))
        if j > 1:
            cands.append((D[i, j - 1], i, j - 1))
        _, i, j = min(cands)
        path.append((i - 1, j - 1))
    return path[::-1]


def align(real, sr, tts, words):
    """Word start times (s) in `real` by DTW against an eSpeak rendering of the text."""
    from espeak_tts import synthesize

    ref, ref_sr, events = synthesize(tts_to_spoken(tts), voice="es-419", rate=150)
    ref = np.asarray(ref, dtype=np.float64) / 32768
    if len(events) != len(words):
        print(f"    note: eSpeak found {len(events)} words, text has {len(words)}; using proportional fallback")
        return None
    A = features(ref, ref_sr)
    B = features(real, sr)
    path = dtw_path(A, B)
    first_real = {}
    for i, j in path:
        first_real.setdefault(i, j)
    starts = []
    for e in events:
        i = min(len(A) - 1, int(round(e["start_ms"] / 10)))
        starts.append(first_real.get(i, 0) * HOP / FEAT_RATE)
    # Keep them strictly increasing.
    for k in range(1, len(starts)):
        starts[k] = max(starts[k], starts[k - 1] + 0.04)
    return starts


# ----------------------------------------------------------------------------- phrases
HARD = (".", "!", "?", ":", "…")


def phrase_marks(tts):
    """For every spoken word: 'hard' if a pause is expected before it (sentence end, "...",
    a [tag]), 'soft' after a comma, '' otherwise."""
    marks = []
    pending = ""
    for tok in re.findall(r"\[[^\]]*\]|\S+", tts):
        if tok.startswith("["):
            pending = "hard"
            continue
        w = tok.strip(PUNCT)
        if not w:
            pending = "hard"
            continue
        if tok[0] in "¡¿." or tok.startswith("…"):
            pending = "hard"
        marks.append(pending if marks else "hard")
        tail = tok[len(tok.rstrip(PUNCT)) :]
        pending = "hard" if any(c in tail for c in HARD) else ("soft" if "," in tail else "")
    return marks


def speech_segments(x, sr, rel_db=35, min_gap_s=0.12):
    """(start, end) seconds of the stretches of speech, split at pauses of min_gap_s or more."""
    db, hop = rms_db(x, sr, win_s=0.03, hop_s=0.01)
    on = db > db.max() - rel_db
    segs = []
    start = None
    gap = 0
    end = 0
    for i, v in enumerate(on):
        if v:
            if start is None:
                start = i
            gap = 0
            end = i
        elif start is not None:
            gap += 1
            if gap * hop / sr >= min_gap_s:
                segs.append((start * hop / sr, (end + 1) * hop / sr))
                start = None
    if start is not None:
        segs.append((start * hop / sr, (end + 1) * hop / sr))
    return segs


def match_pauses(marks, starts, segs):
    """Pairs the expected phrase breaks (punctuation, tags) with the real pauses in the clip.

    Monotonic alignment (edit distance) between the breaks, at their DTW-estimated times,
    and the speech onsets that follow each pause. Leaving a long pause without a break is
    expensive, so a break the global DTW misplaced by a second still finds its pause.
    Returns {word index: onset time}."""
    breaks = [k for k in range(1, len(marks)) if marks[k]]
    gaps = [(segs[j][0], segs[j][0] - segs[j - 1][1]) for j in range(1, len(segs))]
    n, m = len(breaks), len(gaps)
    INF = float("inf")
    D = np.full((n + 1, m + 1), INF)
    D[0, 0] = 0
    move = {}
    for i in range(n + 1):
        for j in range(m + 1):
            if i == 0 and j == 0:
                continue
            best = INF
            if i > 0 and j > 0:
                d = abs(starts[breaks[i - 1]] - gaps[j - 1][0])
                if d < 2.5 and D[i - 1, j - 1] + d < best:
                    best, move[i, j] = D[i - 1, j - 1] + d, "m"
            if i > 0:
                c = D[i - 1, j] + (0.5 if marks[breaks[i - 1]] == "hard" else 0.1)
                if c < best:
                    best, move[i, j] = c, "b"
            if j > 0:
                c = D[i, j - 1] + 1.5 * gaps[j - 1][1]
                if c < best:
                    best, move[i, j] = c, "g"
            D[i, j] = best
    out = {}
    i, j = n, m
    while i > 0 or j > 0:
        mv = move[i, j]
        if mv == "m":
            out[breaks[i - 1]] = gaps[j - 1][0]
            i, j = i - 1, j - 1
        elif mv == "b":
            i -= 1
        else:
            j -= 1
    return out


def refine(real, sr, tts, words, starts):
    """Moves phrase starts onto the real pauses, then re-aligns each phrase on its own
    (eSpeak's pauses never match the real ones, which is what throws the global DTW off).
    Returns (starts, ends)."""
    marks = phrase_marks(tts)
    segs = speech_segments(real, sr)
    snapped = match_pauses(marks, starts, segs)
    heads = [0] + sorted(snapped)
    t_head = {0: segs[0][0] if segs else 0.0, **snapped}
    heads.append(len(words))
    out_s, out_e = [], []
    for h in range(len(heads) - 1):
        k0, k1 = heads[h], heads[h + 1]
        t0 = t_head[k0]
        t1 = t_head[k1] if k1 < len(words) else len(real) / sr
        # The phrase ends where its last stretch of speech ends.
        ends = [b for a, b in segs if a < t1 - 0.02 and b > t0]
        t1 = min(t1, max(ends)) if ends else t1
        sub = real[int(t0 * sr) : int(t1 * sr)]
        local = align(sub, sr, " ".join(words[k0:k1]), words[k0:k1]) if k1 - k0 > 1 and len(sub) > sr * 0.2 else [0.0]
        if local is None:
            local = proportional(sub, sr, words[k0:k1])
            local = [v - local[0] for v in local]
        local[0] = 0.0
        for k, v in enumerate(local):
            out_s.append(t0 + v)
            out_e.append(t0 + local[k + 1] if k + 1 < len(local) else t1)
    for k in range(1, len(out_s)):
        out_s[k] = max(out_s[k], out_s[k - 1] + 0.04)
    return out_s, out_e


def cap_pauses(x, sr, max_s=1.4, fade_s=0.03):
    """Shortens pauses inside a line to max_s (cuts the middle of the silence, with a crossfade)."""
    segs = speech_segments(x, sr, rel_db=40, min_gap_s=0.2)
    fade = int(fade_s * sr)
    out = x
    # From the end so earlier positions stay valid.
    for (a0, b0), (a1, _) in reversed(list(zip(segs, segs[1:]))):
        gap = a1 - b0
        if gap <= max_s:
            continue
        cut0 = int((b0 + max_s / 2) * sr)
        cut1 = int((a1 - max_s / 2) * sr)
        head, tail = out[: cut0 + fade].copy(), out[cut1:].copy()
        ramp = np.linspace(1, 0, fade)
        head[-fade:] = head[-fade:] * ramp + tail[:fade] * (1 - ramp)
        out = np.concatenate([head, tail[fade:]])
    return out


def proportional(real, sr, words):
    """Fallback: spread words over the voiced span by letter count."""
    s, e = trim_bounds(real, sr)
    total = sum(len(w) + 2 for w in words)
    t = s / sr
    out = []
    for w in words:
        out.append(t)
        t += (e - s) / sr * (len(w) + 2) / total
    return out


def voiced_end(x, sr):
    return trim_bounds(x, sr, margin_s=0)[1] / sr


# ----------------------------------------------------------------------------- level
SPEECH_DB = -19.0  # active speech level of every line
CEIL_DB = -3.0  # voice peaks stay below this, leaving room for music and effects


def active_level_db(x, sr):
    """Mean power of the frames within 30 dB of the loudest one (i.e. the speech itself)."""
    db, _ = rms_db(x, sr, win_s=0.05, hop_s=0.01)
    act = db[db > db.max() - 30]
    return 10 * np.log10(np.mean(10 ** (act / 10)))


def peak_limit(x, sr, ceil_db, look_s=0.002, release_s=0.06, peak=None):
    """Look-ahead peak limiter: gain never lets |x| exceed the ceiling, attack is smoothed.
    `peak` (optional) is the per-sample level to limit, e.g. an oversampled envelope."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    ceil = 10 ** (ceil_db / 20)
    look = max(1, int(look_s * sr))
    if peak is None:
        peak = np.abs(x) if x.ndim == 1 else np.abs(x).max(axis=1)
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    # A min over +-2*look then a box over +-look keeps every sample under its own need.
    g = uniform_filter1d(minimum_filter1d(need, size=4 * look + 1), size=2 * look + 1)
    g = np.minimum(g, need)
    rel = np.exp(-1 / (release_s * sr))
    out = np.empty_like(g)
    cur = 1.0
    for i, v in enumerate(g):
        cur = v if v < cur else v + (cur - v) * rel
        out[i] = cur
    return x * (out if x.ndim == 1 else out[:, None])


def level(x, sr):
    x = x * 10 ** ((SPEECH_DB - active_level_db(x, sr)) / 20)
    return peak_limit(x, sr, CEIL_DB)


# ----------------------------------------------------------------------------- main
def standins(narration, raw_dir):
    """eSpeak stand-in clips (a different voice/rate than the aligner uses) for development."""
    from espeak_tts import synthesize, write_wav as ewrite

    os.makedirs(raw_dir, exist_ok=True)
    for line in narration["lines"]:
        text = tts_to_spoken(line["tts"])
        s, r, _ = synthesize(text, voice="es-419+f3", rate=128, pitch=70, pitch_range=90)
        pad = [0] * int(r * 0.3)
        ewrite(os.path.join(raw_dir, f"{line['id']}.wav"), pad + s + pad, r)


def main():
    raw_dir = sys.argv[1]
    narration = json.load(open(os.path.join(ROOT, "src", "narration.json")))
    if "--standin" in sys.argv:
        standins(narration, raw_dir)
    tmp_dir = os.path.join(raw_dir, "_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    out_dir = os.path.join(ROOT, "public", "voice")
    os.makedirs(out_dir, exist_ok=True)
    result = {"fps": FPS, "lines": {}}
    for line in narration["lines"]:
        lid = line["id"]
        words = spoken_words(line["tts"])
        if line["captions"] and caption_word_count(line["captions"]) != len(words):
            raise SystemExit(f"{lid}: captions cover {caption_word_count(line['captions'])} words, text has {len(words)}")
        x, sr = load_clip(raw_dir, lid, tmp_dir)
        a, b = trim_bounds(x, sr)
        x = level(cap_pauses(x[a:b].copy(), sr), sr)
        fade = int(0.01 * sr)
        x[:fade] *= np.linspace(0, 1, fade)
        x[-fade:] *= np.linspace(1, 0, fade)
        write_wav(os.path.join(out_dir, f"{lid}.wav"), x, sr)
        starts = align(x, sr, line["tts"], words) or proportional(x, sr, words)
        starts, ends = refine(x, sr, line["tts"], words, starts)
        spans = [[round(s, 3), round(e, 3)] for s, e in zip(starts, ends)]
        env, acc = frame_envelope(x, sr)
        result["lines"][lid] = {"duration": round(len(x) / sr, 3), "words": spans, "env": env, "accents": acc}
        peak = 20 * np.log10(np.abs(x).max())
        print(f"{lid}: {len(x) / sr:5.2f} s, {len(words)} words, first {spans[0][0]:.2f} s, last {spans[-1][0]:.2f} s, peak {peak:.1f} dB")
    with open(os.path.join(ROOT, "src", "voice-timing.json"), "w") as f:
        json.dump(result, f, separators=(",", ":"))
    total = sum(v["duration"] for v in result["lines"].values())
    print(f"total speech {total:.1f} s -> src/voice-timing.json")


if __name__ == "__main__":
    main()
