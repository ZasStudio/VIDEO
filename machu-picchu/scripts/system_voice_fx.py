"""Gives a voice clip the sound of a polite corporate PA / smart speaker (the TIMECO system voice):
band-limited, a little doubled (chorus), a touch of room. The clip keeps its exact length, so
the voice timing stays valid. Re-run it after scripts/voice_timing.py (which rewrites the clips).

    python3 scripts/system_voice_fx.py public/tiempo/voice/L12.wav [more.wav ...] [--hall]

--hall adds a long, dark reverb (a voice from behind a giant door).
"""
import sys
import wave

import numpy as np
from scipy import signal


def read(path):
    with wave.open(path, "rb") as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768
    return (x.reshape(-1, ch).mean(axis=1) if ch > 1 else x), sr, ch


def write(path, x, sr, ch):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    if ch > 1:
        pcm = np.repeat(pcm[:, None], ch, axis=1).reshape(-1)
    with wave.open(path, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def reverb(x, sr, seconds, mix, damp_hz):
    """Exponentially decaying filtered noise as an impulse response."""
    n = int(seconds * sr)
    rng = np.random.default_rng(7)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (sr * seconds / 6.9))
    b, a = signal.butter(2, damp_hz / (sr / 2), "low")
    ir = signal.lfilter(b, a, ir)
    ir /= np.sqrt((ir ** 2).sum())
    wet = signal.fftconvolve(x, ir)[: len(x)]
    return x * (1 - mix) + wet * mix * (np.abs(x).max() / (np.abs(wet).max() + 1e-9))


def process(x, sr, hall):
    peak = np.abs(x).max()
    b, a = signal.butter(2, [260 / (sr / 2), 5200 / (sr / 2)], "band")
    y = signal.lfilter(b, a, x)
    # Presence bump around 2.5 kHz: the bright, smiling "assistant" tone.
    b2, a2 = signal.iirpeak(2500 / (sr / 2), 1.2)
    y = y + 0.35 * signal.lfilter(b2, a2, y)
    # Light doubling: two copies a few milliseconds late.
    for ms, g in ((7, 0.22), (13, 0.16)):
        d = int(sr * ms / 1000)
        y[d:] += g * y[:-d]
    y = reverb(y, sr, 2.6, 0.45, 2500) if hall else reverb(y, sr, 0.35, 0.12, 6000)
    y *= peak / (np.abs(y).max() + 1e-9)
    fade = int(0.02 * sr)
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


if __name__ == "__main__":
    hall = "--hall" in sys.argv
    for path in [a for a in sys.argv[1:] if not a.startswith("--")]:
        x, sr, ch = read(path)
        write(path, process(x, sr, hall), sr, ch)
        print(path, f"{len(x) / sr:.2f} s", "hall" if hall else "speaker")
