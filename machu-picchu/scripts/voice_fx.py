"""Voice post-processing for Clawd's narration (pure numpy/scipy DSP).

Resamples eSpeak's 22.05 kHz output to 48 kHz and gives it a polished "character" sound:
high-pass, presence lift, soft low-pass, gentle compression and a short room reverb.
"""

import numpy as np
from scipy import signal

OUT_RATE = 48000


def _peaking(f0, gain_db, q, fs):
    a = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / fs
    alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * a, -2 * np.cos(w0), 1 - alpha * a]
    den = [1 + alpha / a, -2 * np.cos(w0), 1 - alpha / a]
    return np.array(b) / den[0], np.array(den) / den[0]


def _reverb(x, fs, mix=0.12, size=0.55):
    """Small Schroeder reverb: 4 combs + 2 allpasses."""
    combs = [int(fs * t) for t in (0.0297, 0.0371, 0.0411, 0.0437)]
    out = np.zeros_like(x)
    for d in combs:
        y = np.zeros(len(x) + d)
        g = size
        for i in range(0, len(x), d):
            seg = x[i : i + d]
            y[i + d : i + d + len(seg)] += seg + g * y[i : i + len(seg)]
        out += y[: len(x)]
    out /= len(combs)
    for d, g in ((int(fs * 0.005), 0.7), (int(fs * 0.0017), 0.7)):
        b = np.zeros(d + 1)
        b[0] = -g
        b[d] = 1
        a = np.zeros(d + 1)
        a[0] = 1
        a[d] = -g
        out = signal.lfilter(b, a, out)
    return (1 - mix) * x + mix * out


def process(samples, rate):
    x = np.asarray(samples, dtype=np.float64) / 32768.0
    x = signal.resample_poly(x, OUT_RATE, rate)
    fs = OUT_RATE
    x = signal.sosfilt(signal.butter(2, 95, "highpass", fs=fs, output="sos"), x)
    b, a = _peaking(250, -2.0, 1.0, fs)  # less boxiness
    x = signal.lfilter(b, a, x)
    b, a = _peaking(3200, 3.0, 0.9, fs)  # presence
    x = signal.lfilter(b, a, x)
    x = signal.sosfilt(signal.butter(4, 8500, "lowpass", fs=fs, output="sos"), x)
    # Gentle RMS compressor.
    env = np.sqrt(signal.lfilter([0.002], [1, -0.998], x * x) + 1e-12)
    thr = 0.12
    gain = np.where(env > thr, (thr / env) ** (1 - 1 / 2.5), 1.0)
    x = x * gain
    x = _reverb(x, fs, mix=0.1)
    peak = np.max(np.abs(x)) or 1
    x = x / peak * 10 ** (-3 / 20)
    return x
