"""Offline Spanish speech synthesis with eSpeak NG (rule-based, no AI, no network).

Uses the eSpeak NG shared library bundled by the `espeakng-loader` PyPI package and
returns the audio plus the exact start time of every word (from eSpeak's WORD events),
so captions and Clawd's mouth can be synced to the voice.

    pip install espeakng-loader
    python3 scripts/espeak_tts.py "Hola, soy Clawd." out.wav --voice es-419+m3
"""

import ctypes
import json
import struct
import sys
import wave

import espeakng_loader

AUDIO_OUTPUT_SYNCHRONOUS = 2
INIT_DONT_EXIT = 0x8000
CHARS_UTF8 = 1
SSML = 0x10
EVENT_LIST_TERMINATED = 0
EVENT_WORD = 1
EVENT_SENTENCE = 2
EVENT_END = 5
PARAM = {"rate": 1, "volume": 2, "pitch": 3, "range": 4, "wordgap": 7}


class EspeakEvent(ctypes.Structure):
    _fields_ = [
        ("type", ctypes.c_int),
        ("unique_identifier", ctypes.c_uint),
        ("text_position", ctypes.c_int),
        ("length", ctypes.c_int),
        ("audio_position", ctypes.c_int),
        ("sample", ctypes.c_int),
        ("user_data", ctypes.c_void_p),
        ("id", ctypes.c_char * 8),
    ]


CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(EspeakEvent))

_lib = None
_rate = 22050


def _load():
    global _lib, _rate
    if _lib is not None:
        return _lib
    _lib = ctypes.CDLL(espeakng_loader.get_library_path())
    _lib.espeak_Initialize.restype = ctypes.c_int
    _lib.espeak_Initialize.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
    _rate = _lib.espeak_Initialize(AUDIO_OUTPUT_SYNCHRONOUS, 0, espeakng_loader.get_data_path().encode(), INIT_DONT_EXIT)
    if _rate <= 0:
        raise RuntimeError("espeak_Initialize failed")
    _lib.espeak_SetVoiceByName.argtypes = [ctypes.c_char_p]
    _lib.espeak_SetParameter.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_int]
    _lib.espeak_Synth.argtypes = [
        ctypes.c_void_p,
        ctypes.c_size_t,
        ctypes.c_uint,
        ctypes.c_int,
        ctypes.c_uint,
        ctypes.c_uint,
        ctypes.POINTER(ctypes.c_uint),
        ctypes.c_void_p,
    ]
    return _lib


def synthesize(text, voice="es-419+m3", rate=150, pitch=55, pitch_range=70, ssml=False):
    """Returns (samples: list[int], sample_rate, words: list[{text, start_ms, char}])."""
    lib = _load()
    if lib.espeak_SetVoiceByName(voice.encode()) != 0:
        raise RuntimeError(f"unknown voice {voice}")
    lib.espeak_SetParameter(PARAM["rate"], rate, 0)
    lib.espeak_SetParameter(PARAM["pitch"], pitch, 0)
    lib.espeak_SetParameter(PARAM["range"], pitch_range, 0)
    samples = []
    events = []

    def cb(wav, n, ev):
        if n > 0 and wav:
            samples.extend(wav[:n])
        i = 0
        while ev[i].type != EVENT_LIST_TERMINATED:
            e = ev[i]
            if e.type == EVENT_WORD:
                events.append({"start_ms": e.audio_position, "char": e.text_position, "length": e.length})
            i += 1
        return 0

    c_cb = CALLBACK(cb)
    lib.espeak_SetSynthCallback(c_cb)
    data = text.encode("utf-8")
    buf = ctypes.create_string_buffer(data)
    flags = CHARS_UTF8 | (SSML if ssml else 0)
    uid = ctypes.c_uint(0)
    lib.espeak_Synth(buf, len(data) + 1, 0, 0, 0, flags, ctypes.byref(uid), None)
    lib.espeak_Synchronize()
    # Map character positions (1-based, in characters) back to the words of the text.
    words = []
    for e in events:
        start = e["char"] - 1
        words.append({"text": text[start : start + e["length"]], "start_ms": e["start_ms"]})
    return samples, _rate, words


def write_wav(path, samples, rate):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(struct.pack(f"<{len(samples)}h", *samples))


if __name__ == "__main__":
    text = sys.argv[1]
    out = sys.argv[2]
    voice = "es-419+m3"
    if "--voice" in sys.argv:
        voice = sys.argv[sys.argv.index("--voice") + 1]
    s, r, words = synthesize(text, voice=voice)
    write_wav(out, s, r)
    print(json.dumps({"rate": r, "seconds": len(s) / r, "words": words}, ensure_ascii=False))
