"""Masters the rendered mix: brings it to -14 LUFS (YouTube's reference loudness) and keeps
the (oversampled) peaks under -1 dBTP with a look-ahead limiter.

    python3 scripts/master_audio.py <in.wav> <out.wav> [target_lufs]
"""

import os
import sys
import wave

import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_timing import peak_limit  # noqa: E402

TARGET_LUFS = -14.0
CEIL_DB = -1.0
MAX_GAIN_DB = 8.0


def lufs(x, sr):
    """Integrated loudness (ITU-R BS.1770-4: K-weighting, 400 ms blocks, absolute and relative gates)."""
    # K-weighting: high shelf (+4 dB above ~1.5 kHz) and high pass (~38 Hz), bilinear designs.
    f0, g, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = np.tan(np.pi * f0 / sr)
    vh = 10 ** (g / 20)
    vb = vh**0.4996667741545416
    a0 = 1 + k / q + k * k
    b1 = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    a1 = [1, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = np.tan(np.pi * f0 / sr)
    a2 = [1, 2 * (k * k - 1) / (1 + k / q + k * k), (1 - k / q + k * k) / (1 + k / q + k * k)]
    b2 = [1, -2, 1]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
    block, hop = int(0.4 * sr), int(0.1 * sr)
    power = np.array([(y[i : i + block] ** 2).mean(axis=0).sum() for i in range(0, len(y) - block, hop)])
    loud = -0.691 + 10 * np.log10(power + 1e-12)
    gated = power[loud > -70]
    rel = -0.691 + 10 * np.log10(gated.mean()) - 10
    return -0.691 + 10 * np.log10(power[(loud > -70) & (loud > rel)].mean())


def true_peak(x):
    return np.abs(signal.resample_poly(x, 4, 1, axis=0)).max()


def main():
    src, dst = sys.argv[1], sys.argv[2]
    target = float(sys.argv[3]) if len(sys.argv) > 3 else TARGET_LUFS
    with wave.open(src, "rb") as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64).reshape(-1, ch) / 32768
    before = lufs(x, sr)
    gain_db = min(MAX_GAIN_DB, target - before)
    y = x * 10 ** (gain_db / 20)
    # Two passes: the second catches the few inter-sample overs the first one leaves.
    for margin in (0.15, 0.3):
        over = np.abs(signal.resample_poly(y, 4, 1, axis=0)).reshape(-1, 4, ch).max(axis=(1, 2))
        y = peak_limit(y, sr, CEIL_DB - margin, peak=np.maximum(over, np.abs(y).max(axis=1)))
    with wave.open(dst, "wb") as w:
        w.setnchannels(ch)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype("<i2").tobytes())
    db = lambda v: 20 * np.log10(max(v, 1e-9))  # noqa: E731
    print(
        f"{before:.1f} LUFS, peak {db(true_peak(x)):.1f} dBTP -> gain {gain_db:+.1f} dB -> "
        f"{lufs(y, sr):.1f} LUFS, peak {db(true_peak(y)):.2f} dBTP"
    )


if __name__ == "__main__":
    main()
