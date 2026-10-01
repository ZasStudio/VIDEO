"""Metal-mask treatment for the villain's lines of the Thanos short: a short metallic comb
resonance, a touch of ring modulation, a mask-like mid boost and a dark hall reverb.
Usage: python3 scripts/doom_voice.py public/thanos/voice/L16.wav [more.wav ...] (in place)."""
import sys

import numpy as np
from scipy import signal

from voice_timing import read_wav, write_wav
from voice_fx import _peaking, _reverb


def comb(x, sr, delay_s, feedback):
    d = max(1, int(sr * delay_s))
    b = np.zeros(d + 1)
    b[0] = 1
    a = np.zeros(d + 1)
    a[0] = 1
    a[d] = -feedback
    return signal.lfilter(b, a, x)


def doom(x, sr):
    peak = np.abs(x).max() + 1e-9
    t = np.arange(len(x)) / sr
    y = 0.8 * x + 0.2 * comb(x, sr, 0.0045, 0.5)
    y = y * (1 - 0.18 + 0.18 * np.sin(2 * np.pi * 42 * t))  # faint metallic ring
    y = signal.sosfilt(signal.butter(2, 110, "highpass", fs=sr, output="sos"), y)
    for f0, g, q in ((220, 2.5, 0.8), (1800, 3.0, 1.2), (5200, -3.0, 0.9)):
        b, a = _peaking(f0, g, q, sr)
        y = signal.lfilter(b, a, y)
    # The clip keeps its length (the timeline is built from it): the hall tail fades in its last silence.
    y = _reverb(y, sr, mix=0.2, size=0.7)
    return y * (peak / (np.abs(y).max() + 1e-9))


if __name__ == "__main__":
    for path in sys.argv[1:]:
        x, sr = read_wav(path)
        write_wav(path, doom(x, sr), sr)
        print("doom fx", path)
