#!/usr/bin/env python3
"""
scripts/generate_default_sounds.py
----------------------------------
Generates and bundles:
  1. Step 3: All 27 preloaded default human-sound WAV files (0..26) in `public/sounds/`
     (00-snap.wav .. 26-rubbing-palms-together.wav)
  2. Step 6: All 6 preloaded background percussion WAV files (P = S % 6:
     0=Snap, 1=Clap, 2=Leg thump, 3=Lip pop, 4=Sneeze, 5=Tongue click) in `public/sounds/percussion/`
  3. Step 7: All 18 preloaded instrumental theme WAV files (3 instruments × 6 styles:
     Pop, Jazz, Rock, Classical, Reggae, Indian Carnatic) in `public/sounds/accompaniment/`
"""

import glob
import math
import os
import random
import struct
import wave

SAMPLE_RATE = 44100


def clamp(val: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, val))


def normalize_and_save_wav(filepath: str, samples: list[float], target_peak: float = 0.72) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    if not samples:
        samples = [0.0] * int(SAMPLE_RATE * 0.25)

    peak = max(abs(s) for s in samples)
    scale = (target_peak / peak) if peak > 1e-6 else 1.0

    fade_in = min(int(0.004 * SAMPLE_RATE), len(samples) // 4)
    fade_out = min(int(0.008 * SAMPLE_RATE), len(samples) // 4)

    pcm_bytes = bytearray()
    n = len(samples)
    for i, s in enumerate(samples):
        env = 1.0
        if i < fade_in and fade_in > 0:
            env = i / fade_in
        elif i >= n - fade_out and fade_out > 0:
            env = (n - 1 - i) / fade_out
        val = clamp(s * scale * env, -0.99, 0.99)
        pcm_bytes.extend(struct.pack("<h", int(val * 32767.0)))

    with wave.open(filepath, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(pcm_bytes))


def biquad_bandpass(samples: list[float], center_hz: float, q: float) -> list[float]:
    w0 = 2.0 * math.pi * center_hz / SAMPLE_RATE
    alpha = math.sin(w0) / (2.0 * q)
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * math.cos(w0)
    a2 = 1.0 - alpha

    b0 /= a0
    b1 /= a0
    b2 /= a0
    a1 /= a0
    a2 /= a0

    out = [0.0] * len(samples)
    x1 = x2 = y1 = y2 = 0.0
    for i, x0 in enumerate(samples):
        y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        out[i] = y0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
    return out


def overlay(base: list[float], addition: list[float], offset_sec: float = 0.0, gain: float = 1.0) -> list[float]:
    offset_idx = int(offset_sec * SAMPLE_RATE)
    total_len = max(len(base), offset_idx + len(addition))
    out = list(base) + [0.0] * max(0, total_len - len(base))
    for i, val in enumerate(addition):
        idx = offset_idx + i
        if 0 <= idx < total_len:
            out[idx] += val * gain
    return out


# ─── Step 3: 27 Preloaded Default Number Sounds (0 to 26) ─────────────────────


def gen_snap(rng: random.Random) -> list[float]:
    """0: Crisp finger snap"""
    dur = 0.22
    n = int(dur * SAMPLE_RATE)
    raw = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.008)) for i in range(n)]
    bp1 = biquad_bandpass(raw, 2350.0, 4.5)
    bp2 = biquad_bandpass(raw, 1150.0, 3.0)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        chirp = math.sin(2 * math.pi * (2800 * math.exp(-t * 45)) * t) * math.exp(-t * 95)
        out.append(bp1[i] * 1.4 + bp2[i] * 0.8 + chirp * 0.9)
    return out


def gen_clap(rng: random.Random) -> list[float]:
    """1: Natural hand clap"""
    dur = 0.28
    n = int(dur * SAMPLE_RATE)
    out = [0.0] * n
    for delay_s, amp in [(0.0, 0.7), (0.006, 1.0), (0.013, 0.85)]:
        burst_len = int(0.18 * SAMPLE_RATE)
        noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.018)) for i in range(burst_len)]
        cavity = biquad_bandpass(noise, 1350.0, 2.2)
        slap = biquad_bandpass(noise, 2900.0, 1.8)
        combined = [cavity[i] * 1.2 + slap[i] * 0.9 for i in range(burst_len)]
        out = overlay(out, combined, delay_s, amp)
    return out


def gen_tongue_click(rng: random.Random) -> list[float]:
    """2: Tongue click against hard palate"""
    dur = 0.16
    n = int(dur * SAMPLE_RATE)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        f1 = 1650.0 * math.exp(-t * 25.0) + 650.0
        f2 = 3200.0 * math.exp(-t * 40.0) + 1200.0
        env = math.exp(-t * 85.0)
        click = (math.sin(2 * math.pi * f1 * t) + 0.6 * math.sin(2 * math.pi * f2 * t)) * env
        noise = rng.uniform(-1, 1) * math.exp(-t * 140.0) * 0.35
        out.append(click + noise)
    return out


def gen_foot_stomp(rng: random.Random) -> list[float]:
    """3: Heavy foot stomp on floor"""
    dur = 0.36
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.035)) for i in range(n)]
    wood = biquad_bandpass(noise, 240.0, 2.5)
    sole = biquad_bandpass(noise, 950.0, 1.8)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 58.0 + 95.0 * math.exp(-t * 38.0)
        thump = math.sin(2 * math.pi * freq * t) * math.exp(-t * 14.0)
        out.append(thump * 1.5 + wood[i] * 0.9 + sole[i] * 0.35 * math.exp(-t * 40.0))
    return out


def gen_short_whistle(rng: random.Random) -> list[float]:
    """4: Short human whistle"""
    dur = 0.34
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    breath = biquad_bandpass(noise, 1850.0, 8.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * min(1.0, t / dur)) ** 1.4
        freq = 1680.0 + 110.0 * (1.0 - math.exp(-t * 18.0)) + 14.0 * math.sin(2 * math.pi * 6.0 * t)
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        tone = math.sin(phase) + 0.12 * math.sin(2 * phase)
        out.append((tone * 0.85 + breath[i] * 0.35) * env)
    return out


def gen_sharp_inhale(rng: random.Random) -> list[float]:
    """5: Sharp inhale through parted lips"""
    dur = 0.38
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    f1 = biquad_bandpass(noise, 680.0, 3.5)
    f2 = biquad_bandpass(noise, 1750.0, 4.0)
    f3 = biquad_bandpass(noise, 3100.0, 3.0)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = (t / 0.18) if t < 0.18 else math.exp(-(t - 0.18) * 18.0)
        out.append((f1[i] * 0.8 + f2[i] * 1.1 + f3[i] * 0.7) * env)
    return out


def gen_sigh(rng: random.Random) -> list[float]:
    """6: Relaxed human sigh"""
    dur = 0.58
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    breath1 = biquad_bandpass(noise, 600.0, 3.0)
    breath2 = biquad_bandpass(noise, 1450.0, 3.5)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) * math.exp(-t * 2.2)
        f0 = 230.0 - 65.0 * (t / dur)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        glottal = (
            math.sin(phase)
            + 0.55 * math.sin(2 * phase)
            + 0.3 * math.sin(3 * phase)
            + 0.15 * math.sin(4 * phase)
        )
        out.append((glottal * 0.55 + breath1[i] * 0.9 + breath2[i] * 0.7) * env)
    return out


def gen_thigh_slap(rng: random.Random) -> list[float]:
    """7: Open-palm thigh slap"""
    dur = 0.25
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.015)) for i in range(n)]
    body = biquad_bandpass(noise, 380.0, 2.2)
    skin = biquad_bandpass(noise, 1850.0, 1.6)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        thwack = math.sin(2 * math.pi * (160.0 * math.exp(-t * 25.0) + 85.0) * t) * math.exp(-t * 28.0)
        out.append(thwack * 0.9 + body[i] * 1.2 + skin[i] * 0.85)
    return out


def gen_lip_pop(rng: random.Random) -> list[float]:
    """8: Plosive bilabial lip pop"""
    dur = 0.18
    n = int(dur * SAMPLE_RATE)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 150.0 + 420.0 * (1.0 - math.exp(-t * 55.0))
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        env = math.exp(-t * 42.0)
        pop = (math.sin(phase) + 0.35 * math.sin(2 * phase)) * env
        burst = rng.uniform(-1, 1) * math.exp(-t * 160.0) * 0.4
        out.append(pop + burst)
    return out


def gen_hum(rng: random.Random) -> list[float]:
    """9: Warm closed-mouth vocal hum"""
    dur = 0.52
    n = int(dur * SAMPLE_RATE)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.05)
        release = min(1.0, (dur - t) / 0.08)
        env = attack * release
        f0 = 196.0 + 3.2 * math.sin(2 * math.pi * 5.2 * t)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        voice = (
            1.0 * math.sin(phase)
            + 0.65 * math.sin(2 * phase)
            + 0.35 * math.sin(3 * phase)
            + 0.12 * math.sin(5 * phase)
        )
        out.append(voice * env)
    return out


def gen_double_snap(rng: random.Random) -> list[float]:
    """10: Double finger snap"""
    s1 = gen_snap(rng)
    s2 = gen_snap(rng)
    return overlay(s1, s2, offset_sec=0.14, gain=0.95)


def gen_double_clap(rng: random.Random) -> list[float]:
    """11: Double hand clap"""
    c1 = gen_clap(rng)
    c2 = gen_clap(rng)
    return overlay(c1, c2, offset_sec=0.15, gain=0.95)


def gen_two_tongue_clicks(rng: random.Random) -> list[float]:
    """12: Two tongue clicks back-to-back"""
    k1 = gen_tongue_click(rng)
    k2 = gen_tongue_click(rng)
    return overlay(k1, k2, offset_sec=0.13, gain=0.95)


def gen_two_foot_stomps(rng: random.Random) -> list[float]:
    """13: Two firm foot stomps"""
    f1 = gen_foot_stomp(rng)
    f2 = gen_foot_stomp(rng)
    return overlay(f1, f2, offset_sec=0.18, gain=0.95)


def gen_long_whistle(rng: random.Random) -> list[float]:
    """14: Expressive long human whistle"""
    dur = 0.72
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    breath = biquad_bandpass(noise, 1980.0, 9.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.06)
        release = min(1.0, (dur - t) / 0.12)
        env = attack * release
        freq = 1880.0 + 120.0 * math.sin(math.pi * (t / dur)) + 18.0 * math.sin(2 * math.pi * 5.8 * t)
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        tone = math.sin(phase) + 0.1 * math.sin(2 * phase)
        out.append((tone * 0.85 + breath[i] * 0.3) * env)
    return out


def gen_long_exhale(rng: random.Random) -> list[float]:
    """15: Long audible breath exhale"""
    dur = 0.68
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    f1 = biquad_bandpass(noise, 520.0, 2.8)
    f2 = biquad_bandpass(noise, 1380.0, 3.2)
    f3 = biquad_bandpass(noise, 2650.0, 3.5)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 0.85 * math.exp(-t * 1.4)
        out.append((f1[i] * 1.1 + f2[i] * 0.9 + f3[i] * 0.45) * env)
    return out


def gen_sniffle(rng: random.Random) -> list[float]:
    """16: Quick nasal sniffle"""
    dur = 0.32
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    nasal1 = biquad_bandpass(noise, 1150.0, 3.5)
    nasal2 = biquad_bandpass(noise, 3400.0, 2.5)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        pulse1 = math.exp(-((t - 0.06) / 0.04) ** 2)
        pulse2 = 0.85 * math.exp(-((t - 0.18) / 0.055) ** 2)
        env = pulse1 + pulse2
        out.append((nasal1[i] * 0.8 + nasal2[i] * 1.1) * env)
    return out


def gen_laugh(rng: random.Random) -> list[float]:
    """17: Natural human chuckle/laugh"""
    dur = 0.56
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    asp = biquad_bandpass(noise, 1250.0, 3.0)
    out = []
    phase = 0.0
    bursts = [(0.06, 265.0, 1.0), (0.21, 240.0, 0.9), (0.37, 215.0, 0.78)]
    for i in range(n):
        t = i / SAMPLE_RATE
        env = 0.0
        f0 = 230.0
        for center, pitch, amp in bursts:
            w = math.exp(-((t - center) / 0.048) ** 2) * amp
            if w > env:
                f0 = pitch - 180.0 * max(0.0, t - center)
            env += w
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        vowel = (
            math.sin(phase)
            + 0.85 * math.sin(2 * phase)
            + 0.65 * math.sin(3 * phase)
            + 0.4 * math.sin(4 * phase)
        )
        out.append((vowel * 0.65 + asp[i] * 0.6) * env)
    return out


def gen_cough(rng: random.Random) -> list[float]:
    """18: Single brief cough / throat clear"""
    dur = 0.36
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    chest = biquad_bandpass(noise, 420.0, 2.2)
    throat = biquad_bandpass(noise, 1450.0, 2.5)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        b1 = math.exp(-t * 16.0) if t >= 0.01 else (t / 0.01)
        b2 = 0.55 * math.exp(-((t - 0.17) / 0.05) ** 2)
        env = b1 + b2
        f0 = 145.0 - 30.0 * t
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        rough_voice = math.sin(phase) + 0.7 * math.sin(2 * phase) + 0.5 * math.sin(3 * phase)
        out.append((rough_voice * 0.45 + chest[i] * 1.1 + throat[i] * 0.9) * env)
    return out


def gen_grunt(rng: random.Random) -> list[float]:
    """19: Short, punchy low vocal grunt"""
    dur = 0.30
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    formant = biquad_bandpass(noise, 620.0, 3.5)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        attack = min(1.0, t / 0.015)
        decay = math.exp(-max(0.0, t - 0.04) * 11.0)
        env = attack * decay
        f0 = 118.0 + 22.0 * math.exp(-t * 18.0) - 18.0 * (t / dur)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        glottal = (
            math.sin(phase)
            + 0.9 * math.sin(2 * phase)
            + 0.75 * math.sin(3 * phase)
            + 0.5 * math.sin(4 * phase)
            + 0.3 * math.sin(5 * phase)
        )
        out.append((glottal * 0.75 + formant[i] * 0.35) * env)
    return out


def gen_gasp(rng: random.Random) -> list[float]:
    """20: Quick surprised intake of breath"""
    dur = 0.38
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    f1 = biquad_bandpass(noise, 820.0, 3.8)
    f2 = biquad_bandpass(noise, 2150.0, 4.2)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * min(1.0, t / 0.28)) ** 1.3 if t < 0.28 else math.exp(-(t - 0.28) * 30.0)
        f0 = 290.0 + 140.0 * (t / dur)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        catch = (math.sin(phase) + 0.4 * math.sin(2 * phase)) * 0.22
        out.append((f1[i] * 1.0 + f2[i] * 1.1 + catch) * env)
    return out


def gen_lip_trill(rng: random.Random) -> list[float]:
    """21: Vibrating lip trill"""
    dur = 0.54
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    breath = biquad_bandpass(noise, 950.0, 2.5)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 0.7
        flutter = 0.55 + 0.45 * math.sin(2 * math.pi * 27.0 * t)
        f0 = 175.0 + 18.0 * math.sin(2 * math.pi * 27.0 * t)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        voice = math.sin(phase) + 0.6 * math.sin(2 * phase) + 0.3 * math.sin(3 * phase)
        out.append((voice * 0.65 + breath[i] * 0.65) * flutter * env)
    return out


def gen_whispered_whoo(rng: random.Random) -> list[float]:
    """22: Whispered 'whoo'"""
    dur = 0.52
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    oo1 = biquad_bandpass(noise, 430.0, 5.5)
    oo2 = biquad_bandpass(noise, 890.0, 5.0)
    air = biquad_bandpass(noise, 2100.0, 3.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 1.1
        f0 = 320.0 + 60.0 * math.sin(math.pi * (t / dur))
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        soft_tone = math.sin(phase) * 0.25
        out.append((oo1[i] * 1.3 + oo2[i] * 1.1 + air[i] * 0.35 + soft_tone) * env)
    return out


def gen_chest_thump(rng: random.Random) -> list[float]:
    """23: Deep resonant chest thump"""
    dur = 0.32
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.025)) for i in range(n)]
    cavity = biquad_bandpass(noise, 165.0, 2.8)
    pat = biquad_bandpass(noise, 680.0, 2.0)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 68.0 + 75.0 * math.exp(-t * 32.0)
        sub = math.sin(2 * math.pi * freq * t) * math.exp(-t * 15.0)
        out.append(sub * 1.6 + cavity[i] * 1.1 + pat[i] * 0.45 * math.exp(-t * 35.0))
    return out


def gen_sneeze(rng: random.Random) -> list[float]:
    """24: Expressive human sneeze"""
    dur = 0.55
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    ah_formant = biquad_bandpass(noise, 950.0, 3.2)
    choo_burst = biquad_bandpass(noise, 2650.0, 2.2)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        if t < 0.18:
            env = math.sin(math.pi * (t / 0.18)) * 0.55
            f0 = 260.0 + 140.0 * (t / 0.18)
            phase += 2.0 * math.pi * f0 / SAMPLE_RATE
            voice = (math.sin(phase) + 0.5 * math.sin(2 * phase)) * env
            out.append(voice + ah_formant[i] * env * 0.6)
        else:
            dt = t - 0.18
            env = math.exp(-dt * 11.0)
            f0 = 380.0 * math.exp(-dt * 6.0) + 140.0
            phase += 2.0 * math.pi * f0 / SAMPLE_RATE
            voice = (math.sin(phase) + 0.4 * math.sin(2 * phase)) * env * 0.5
            out.append(voice + choo_burst[i] * env * 1.5 + ah_formant[i] * env * 0.8)
    return out


def gen_sobbing_breath(rng: random.Random) -> list[float]:
    """25: Shaky double-inhale sobbing breath"""
    dur = 0.56
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    breath1 = biquad_bandpass(noise, 780.0, 3.5)
    breath2 = biquad_bandpass(noise, 1850.0, 3.8)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        hitch1 = math.exp(-((t - 0.11) / 0.055) ** 2)
        hitch2 = 0.9 * math.exp(-((t - 0.28) / 0.065) ** 2)
        sigh_tail = 0.45 * math.exp(-((t - 0.44) / 0.07) ** 2)
        env = hitch1 + hitch2 + sigh_tail
        f0 = 275.0 + 15.0 * math.sin(2 * math.pi * 9.0 * t)
        phase += 2.0 * math.pi * f0 / SAMPLE_RATE
        tremor = math.sin(phase) * 0.25
        out.append((breath1[i] * 1.0 + breath2[i] * 1.1 + tremor) * env)
    return out


def gen_rubbing_palms_together(rng: random.Random) -> list[float]:
    """26: Rubbing palms together"""
    dur = 0.58
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    skin_low = biquad_bandpass(noise, 950.0, 2.5)
    skin_mid = biquad_bandpass(noise, 2250.0, 3.0)
    skin_hi = biquad_bandpass(noise, 4200.0, 2.8)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        stroke1 = math.sin(math.pi * min(1.0, max(0.0, t / 0.27))) ** 1.4 if t < 0.27 else 0.0
        stroke2 = (
            0.9 * (math.sin(math.pi * min(1.0, max(0.0, (t - 0.28) / 0.28))) ** 1.4)
            if t >= 0.28
            else 0.0
        )
        env = stroke1 + stroke2
        w_hi = 1.0 if t < 0.28 else 0.75
        out.append((skin_low[i] * 0.7 + skin_mid[i] * 1.1 + skin_hi[i] * 0.85 * w_hi) * env)
    return out


# ─── Step 6: Six Background Percussion Instruments (P = S % 6) ────────────────
#   0 -> Snap          (perc-0-snap.wav)
#   1 -> Clap          (perc-1-clap.wav)
#   2 -> Leg thump     (perc-2-leg-thump.wav)
#   3 -> Lip pop       (perc-3-lip-pop.wav)
#   4 -> Sneeze        (perc-4-sneeze.wav)
#   5 -> Tongue click  (perc-5-tongue-click.wav)


def gen_perc_0_snap(rng: random.Random) -> list[float]:
    """P = 0: Tight rhythmic background Snap with warm room body"""
    dur = 0.20
    n = int(dur * SAMPLE_RATE)
    raw = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.007)) for i in range(n)]
    bp1 = biquad_bandpass(raw, 2150.0, 4.2)
    bp2 = biquad_bandpass(raw, 980.0, 3.2)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        chirp = math.sin(2 * math.pi * (2450 * math.exp(-t * 48)) * t) * math.exp(-t * 90)
        sub = math.sin(2 * math.pi * 180.0 * t) * math.exp(-t * 45) * 0.35
        out.append(bp1[i] * 1.3 + bp2[i] * 0.9 + chirp * 0.85 + sub)
    return out


def gen_perc_1_clap(rng: random.Random) -> list[float]:
    """P = 1: Tight rhythmic background Clap"""
    dur = 0.24
    n = int(dur * SAMPLE_RATE)
    out = [0.0] * n
    for delay_s, amp in [(0.0, 0.75), (0.005, 1.0), (0.011, 0.8)]:
        burst_len = int(0.15 * SAMPLE_RATE)
        noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.015)) for i in range(burst_len)]
        cavity = biquad_bandpass(noise, 1220.0, 2.4)
        slap = biquad_bandpass(noise, 2650.0, 2.0)
        combined = [cavity[i] * 1.25 + slap[i] * 0.85 for i in range(burst_len)]
        out = overlay(out, combined, delay_s, amp)
    return out


def gen_perc_2_leg_thump(rng: random.Random) -> list[float]:
    """P = 2: Deep resonant palm-on-leg thump (warm bass-drum-like body percussion)"""
    dur = 0.28
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.018)) for i in range(n)]
    leg_body = biquad_bandpass(noise, 260.0, 2.5)
    palm_pat = biquad_bandpass(noise, 1180.0, 2.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 72.0 + 95.0 * math.exp(-t * 36.0)
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        thump = math.sin(phase) * math.exp(-t * 16.0)
        out.append(thump * 1.5 + leg_body[i] * 1.15 + palm_pat[i] * 0.55)
    return out


def gen_perc_3_lip_pop(rng: random.Random) -> list[float]:
    """P = 3: Punchy rhythmic background Lip pop"""
    dur = 0.17
    n = int(dur * SAMPLE_RATE)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        freq = 135.0 + 380.0 * (1.0 - math.exp(-t * 58.0))
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        env = math.exp(-t * 45.0)
        pop = (math.sin(phase) + 0.4 * math.sin(2 * phase)) * env
        burst = rng.uniform(-1, 1) * math.exp(-t * 170.0) * 0.38
        out.append(pop + burst)
    return out


def gen_perc_4_sneeze(rng: random.Random) -> list[float]:
    """P = 4: Crisp, tight percussive sneeze ('tchoo!' rhythmic vocal-percussion hit)"""
    dur = 0.28
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    ah_formant = biquad_bandpass(noise, 980.0, 3.0)
    choo_burst = biquad_bandpass(noise, 2750.0, 2.2)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        if t < 0.055:
            env = (t / 0.055) * 0.45
            f0 = 280.0 + 110.0 * (t / 0.055)
            phase += 2.0 * math.pi * f0 / SAMPLE_RATE
            out.append(math.sin(phase) * env + ah_formant[i] * env * 0.5)
        else:
            dt = t - 0.055
            env = math.exp(-dt * 18.0)
            f0 = 340.0 * math.exp(-dt * 9.0) + 135.0
            phase += 2.0 * math.pi * f0 / SAMPLE_RATE
            voice = (math.sin(phase) + 0.35 * math.sin(2 * phase)) * env * 0.45
            out.append(voice + choo_burst[i] * env * 1.45 + ah_formant[i] * env * 0.75)
    return out


def gen_perc_5_tongue_click(rng: random.Random) -> list[float]:
    """P = 5: Sharp palatal background Tongue click"""
    dur = 0.15
    n = int(dur * SAMPLE_RATE)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        f1 = 1520.0 * math.exp(-t * 28.0) + 620.0
        f2 = 2980.0 * math.exp(-t * 42.0) + 1150.0
        env = math.exp(-t * 90.0)
        click = (math.sin(2 * math.pi * f1 * t) + 0.65 * math.sin(2 * math.pi * f2 * t)) * env
        noise = rng.uniform(-1, 1) * math.exp(-t * 150.0) * 0.35
        out.append(click + noise)
    return out


# ─── Step 7: Six Preloaded Musical Themes (18 Accompaniment WAVs) ─────────────


def gen_pop_keys(_rng: random.Random) -> list[float]:
    dur = 0.75
    n = int(dur * SAMPLE_RATE)
    notes = [261.63, 293.66, 392.00, 523.25]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.012) * math.exp(-t * 2.8)
        sig = 0.0
        for f in notes:
            sig += math.sin(2 * math.pi * f * t) + 0.35 * math.sin(2 * math.pi * (f * 2.001) * t) * math.exp(-t * 4.5)
            sig += 0.12 * math.sin(2 * math.pi * (f * 3.0) * t) * math.exp(-t * 8.0)
        out.append(sig * env)
    return out


def gen_pop_bass(_rng: random.Random) -> list[float]:
    dur = 0.52
    n = int(dur * SAMPLE_RATE)
    f0 = 65.41
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.006) * math.exp(-t * 4.2)
        sig = (
            1.0 * math.sin(2 * math.pi * f0 * t)
            + 0.65 * math.sin(2 * math.pi * (2 * f0) * t) * math.exp(-t * 5.0)
            + 0.25 * math.sin(2 * math.pi * (3 * f0) * t) * math.exp(-t * 9.0)
        )
        out.append(sig * env)
    return out


def gen_pop_guitar(_rng: random.Random) -> list[float]:
    dur = 0.55
    n = int(dur * SAMPLE_RATE)
    strings = [(0.0, 196.00), (0.018, 261.63), (0.036, 293.66), (0.054, 392.00)]
    out = [0.0] * n
    for delay, freq in strings:
        start = int(delay * SAMPLE_RATE)
        for i in range(start, n):
            t = (i - start) / SAMPLE_RATE
            env = min(1.0, t / 0.003) * math.exp(-t * 5.2)
            pluck = (
                math.sin(2 * math.pi * freq * t)
                + 0.5 * math.sin(2 * math.pi * 2 * freq * t) * math.exp(-t * 7.0)
                + 0.25 * math.sin(2 * math.pi * 3 * freq * t) * math.exp(-t * 11.0)
            )
            out[i] += pluck * env
    return out


def gen_jazz_piano(_rng: random.Random) -> list[float]:
    dur = 0.68
    n = int(dur * SAMPLE_RATE)
    notes = [261.63, 349.23, 392.00, 587.33]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        trem = 0.88 + 0.12 * math.sin(2 * math.pi * 5.5 * t)
        env = min(1.0, t / 0.015) * math.exp(-t * 3.2) * trem
        sig = 0.0
        for idx, f in enumerate(notes):
            t_note = max(0.0, t - idx * 0.012)
            if t_note > 0:
                sig += math.sin(2 * math.pi * f * t_note) + 0.22 * math.sin(2 * math.pi * 2 * f * t_note) * math.exp(-t_note * 6.0)
        out.append(sig * env)
    return out


def gen_jazz_bass(rng: random.Random) -> list[float]:
    dur = 0.48
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.015)) for i in range(n)]
    finger_thump = biquad_bandpass(noise, 420.0, 3.0)
    f0 = 65.41
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.008) * math.exp(-t * 5.0)
        wood = (
            0.9 * math.sin(2 * math.pi * f0 * t)
            + 0.85 * math.sin(2 * math.pi * 2 * f0 * t) * math.exp(-t * 4.0)
            + 0.35 * math.sin(2 * math.pi * 3 * f0 * t) * math.exp(-t * 8.0)
        )
        out.append(wood * env + finger_thump[i] * 0.25)
    return out


def gen_jazz_guitar(_rng: random.Random) -> list[float]:
    dur = 0.42
    n = int(dur * SAMPLE_RATE)
    notes = [196.00, 293.66, 349.23, 440.00]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.010) * math.exp(-t * 6.5)
        sig = sum(
            math.sin(2 * math.pi * f * t) + 0.18 * math.sin(2 * math.pi * 2 * f * t)
            for f in notes
        )
        out.append(sig * env)
    return out


def gen_rock_guitar(_rng: random.Random) -> list[float]:
    dur = 0.62
    n = int(dur * SAMPLE_RATE)
    freqs = [130.81, 196.00, 261.63]
    raw = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.004) * math.exp(-t * 3.4)
        sig = 0.0
        for f in freqs:
            sig += (
                math.sin(2 * math.pi * f * t)
                + 0.6 * math.sin(2 * math.pi * 2 * f * t)
                + 0.3 * math.sin(2 * math.pi * 3 * f * t)
            )
        driven = math.tanh(sig * 1.9) * env
        raw.append(driven)
    cab_low = biquad_bandpass(raw, 420.0, 1.1)
    cab_mid = biquad_bandpass(raw, 1450.0, 1.4)
    return [cab_low[i] * 1.1 + cab_mid[i] * 0.9 for i in range(n)]


def gen_rock_bass(_rng: random.Random) -> list[float]:
    dur = 0.36
    n = int(dur * SAMPLE_RATE)
    f0 = 65.41
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.003) * math.exp(-t * 6.0)
        raw = (
            math.sin(2 * math.pi * f0 * t)
            + 0.8 * math.sin(2 * math.pi * 2 * f0 * t)
            + 0.45 * math.sin(2 * math.pi * 3 * f0 * t) * math.exp(-t * 10.0)
        )
        out.append(math.tanh(raw * 1.4) * env)
    return out


def gen_rock_accent(_rng: random.Random) -> list[float]:
    dur = 0.28
    n = int(dur * SAMPLE_RATE)
    freqs = [196.00, 293.66]
    raw = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.003) * math.exp(-t * 9.5)
        sig = sum(math.sin(2 * math.pi * f * t) + 0.5 * math.sin(2 * math.pi * 2 * f * t) for f in freqs)
        raw.append(math.tanh(sig * 1.7) * env)
    return biquad_bandpass(raw, 780.0, 1.2)


def gen_classical_strings(_rng: random.Random) -> list[float]:
    dur = 0.95
    n = int(dur * SAMPLE_RATE)
    voices = [130.81, 131.1, 196.00, 196.4, 261.63, 262.1, 392.00, 391.4]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 1.3
        vib = 1.0 + 0.003 * math.sin(2 * math.pi * 5.2 * t)
        sig = 0.0
        for idx, f in enumerate(voices):
            f_inst = f * vib
            sig += (
                math.sin(2 * math.pi * f_inst * t + idx)
                + 0.45 * math.sin(2 * math.pi * 2 * f_inst * t)
                + 0.22 * math.sin(2 * math.pi * 3 * f_inst * t)
            )
        out.append(sig * env)
    return out


def gen_classical_cello(_rng: random.Random) -> list[float]:
    dur = 0.72
    n = int(dur * SAMPLE_RATE)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.06) * math.exp(-t * 2.4)
        vib = 1.0 + 0.0025 * math.sin(2 * math.pi * 4.8 * t)
        f0 = 65.41 * vib
        sig = (
            math.sin(2 * math.pi * f0 * t)
            + 0.7 * math.sin(2 * math.pi * 2 * f0 * t)
            + 0.4 * math.sin(2 * math.pi * 3 * f0 * t)
            + 0.2 * math.sin(2 * math.pi * 4 * f0 * t)
        )
        out.append(sig * env)
    return out


def gen_classical_piano(_rng: random.Random) -> list[float]:
    dur = 0.60
    n = int(dur * SAMPLE_RATE)
    notes = [(0.0, 261.63), (0.07, 392.00), (0.14, 523.25)]
    out = [0.0] * n
    for delay, f in notes:
        start = int(delay * SAMPLE_RATE)
        for i in range(start, n):
            t = (i - start) / SAMPLE_RATE
            env = min(1.0, t / 0.005) * math.exp(-t * 4.2)
            tone = (
                math.sin(2 * math.pi * f * t)
                + 0.35 * math.sin(2 * math.pi * 2 * f * t) * math.exp(-t * 6.0)
                + 0.12 * math.sin(2 * math.pi * 3 * f * t) * math.exp(-t * 10.0)
            )
            out[i] += tone * env
    return out


def gen_reggae_skank(rng: random.Random) -> list[float]:
    dur = 0.19
    n = int(dur * SAMPLE_RATE)
    freqs = [392.00, 523.25, 587.33, 783.99]
    noise = [rng.uniform(-1, 1) * math.exp(-i / (SAMPLE_RATE * 0.012)) for i in range(n)]
    pick_scrape = biquad_bandpass(noise, 2800.0, 3.0)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.004) * math.exp(-t * 24.0)
        chord = sum(
            math.sin(2 * math.pi * f * t) + 0.45 * math.sin(2 * math.pi * 2 * f * t)
            for f in freqs
        )
        out.append(chord * env + pick_scrape[i] * 0.45)
    return out


def gen_reggae_bass(_rng: random.Random) -> list[float]:
    dur = 0.50
    n = int(dur * SAMPLE_RATE)
    f0 = 65.41
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.012) * math.exp(-t * 3.8)
        sub = math.sin(2 * math.pi * f0 * t) + 0.25 * math.sin(2 * math.pi * 2 * f0 * t) * math.exp(-t * 8.0)
        out.append(sub * env)
    return out


def gen_reggae_organ(_rng: random.Random) -> list[float]:
    dur = 0.22
    n = int(dur * SAMPLE_RATE)
    freqs = [261.63, 392.00, 523.25]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.008) * math.exp(-t * 16.0)
        sig = sum(math.sin(2 * math.pi * f * t) for f in freqs)
        out.append(sig * env)
    return out


def gen_carnatic_tanpura(_rng: random.Random) -> list[float]:
    dur = 1.25
    n = int(dur * SAMPLE_RATE)
    strings = [130.81, 196.00, 261.63]
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 0.65
        sig = 0.0
        for s_idx, f0 in enumerate(strings):
            for h in range(1, 10):
                jivari_mod = 1.0 + 0.35 * math.sin(2 * math.pi * (0.9 + h * 0.35) * t + s_idx)
                harm_gain = (1.0 / (h ** 1.15)) * jivari_mod
                sig += harm_gain * math.sin(2 * math.pi * (f0 * h) * t + s_idx * 0.7)
        out.append(sig * env)
    return out


def gen_carnatic_veena(_rng: random.Random) -> list[float]:
    dur = 0.72
    n = int(dur * SAMPLE_RATE)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, t / 0.005) * math.exp(-t * 3.6)
        f_sa = 261.63 * (1.0 + 0.004 * math.sin(2 * math.pi * 5.8 * t) * math.exp(-t * 2.0))
        f_pa = 392.00
        sig = 0.0
        for h in range(1, 11):
            decay_h = math.exp(-t * (1.8 + h * 0.9))
            sig += (0.9 / h) * math.sin(2 * math.pi * (f_sa * h) * t) * decay_h
            sig += (0.45 / h) * math.sin(2 * math.pi * (f_pa * h) * t) * decay_h
        out.append(sig * env)
    return out


def gen_carnatic_flute(rng: random.Random) -> list[float]:
    dur = 0.70
    n = int(dur * SAMPLE_RATE)
    noise = [rng.uniform(-1, 1) for _ in range(n)]
    bamboo_air = biquad_bandpass(noise, 1950.0, 5.0)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / SAMPLE_RATE
        env = math.sin(math.pi * (t / dur)) ** 1.15
        freq = 523.25 * (1.0 - 0.015 * math.exp(-t * 22.0) + 0.004 * math.sin(2 * math.pi * 5.4 * t))
        phase += 2.0 * math.pi * freq / SAMPLE_RATE
        flute = math.sin(phase) + 0.28 * math.sin(2 * phase) + 0.08 * math.sin(3 * phase)
        out.append((flute * 0.85 + bamboo_air[i] * 0.18) * env)
    return out


def main() -> None:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sounds_dir = os.path.join(base_dir, "public", "sounds")
    perc_dir = os.path.join(sounds_dir, "percussion")
    accomp_dir = os.path.join(sounds_dir, "accompaniment")
    os.makedirs(sounds_dir, exist_ok=True)
    os.makedirs(perc_dir, exist_ok=True)
    os.makedirs(accomp_dir, exist_ok=True)

    # Remove old WAVs in sounds_dir and perc_dir so only canonical filenames exist
    for old_wav in glob.glob(os.path.join(sounds_dir, "*.wav")):
        try:
            os.remove(old_wav)
        except OSError:
            pass
    for old_perc in glob.glob(os.path.join(perc_dir, "*.wav")):
        try:
            os.remove(old_perc)
        except OSError:
            pass

    rng = random.Random(20261029)

    number_generators = [
        ("00-snap.wav", gen_snap),
        ("01-clap.wav", gen_clap),
        ("02-tongue-click.wav", gen_tongue_click),
        ("03-foot-stomp.wav", gen_foot_stomp),
        ("04-short-whistle.wav", gen_short_whistle),
        ("05-sharp-inhale.wav", gen_sharp_inhale),
        ("06-sigh.wav", gen_sigh),
        ("07-thigh-slap.wav", gen_thigh_slap),
        ("08-lip-pop.wav", gen_lip_pop),
        ("09-hum.wav", gen_hum),
        ("10-double-snap.wav", gen_double_snap),
        ("11-double-clap.wav", gen_double_clap),
        ("12-two-tongue-clicks.wav", gen_two_tongue_clicks),
        ("13-two-foot-stomps.wav", gen_two_foot_stomps),
        ("14-long-whistle.wav", gen_long_whistle),
        ("15-long-exhale.wav", gen_long_exhale),
        ("16-sniffle.wav", gen_sniffle),
        ("17-laugh.wav", gen_laugh),
        ("18-cough.wav", gen_cough),
        ("19-grunt.wav", gen_grunt),
        ("20-gasp.wav", gen_gasp),
        ("21-lip-trill.wav", gen_lip_trill),
        ("22-whispered-whoo.wav", gen_whispered_whoo),
        ("23-chest-thump.wav", gen_chest_thump),
        ("24-sneeze.wav", gen_sneeze),
        ("25-sobbing-breath.wav", gen_sobbing_breath),
        ("26-rubbing-palms-together.wav", gen_rubbing_palms_together),
    ]

    for filename, fn in number_generators:
        out_path = os.path.join(sounds_dir, filename)
        samples = fn(rng)
        normalize_and_save_wav(out_path, samples, target_peak=0.72)
        print(f"Generated Number Sound -> {filename} ({len(samples)/SAMPLE_RATE:.2f}s)")

    percussion_generators = [
        ("perc-0-snap.wav", gen_perc_0_snap),
        ("perc-1-clap.wav", gen_perc_1_clap),
        ("perc-2-leg-thump.wav", gen_perc_2_leg_thump),
        ("perc-3-lip-pop.wav", gen_perc_3_lip_pop),
        ("perc-4-sneeze.wav", gen_perc_4_sneeze),
        ("perc-5-tongue-click.wav", gen_perc_5_tongue_click),
    ]

    for filename, fn in percussion_generators:
        out_path = os.path.join(perc_dir, filename)
        samples = fn(rng)
        normalize_and_save_wav(out_path, samples, target_peak=0.72)
        print(f"Generated Percussion Sound -> {filename} ({len(samples)/SAMPLE_RATE:.2f}s)")

    accompaniment_generators = [
        ("pop-keys.wav", gen_pop_keys),
        ("pop-bass.wav", gen_pop_bass),
        ("pop-guitar.wav", gen_pop_guitar),
        ("jazz-piano.wav", gen_jazz_piano),
        ("jazz-bass.wav", gen_jazz_bass),
        ("jazz-guitar.wav", gen_jazz_guitar),
        ("rock-guitar.wav", gen_rock_guitar),
        ("rock-bass.wav", gen_rock_bass),
        ("rock-accent.wav", gen_rock_accent),
        ("classical-strings.wav", gen_classical_strings),
        ("classical-cello.wav", gen_classical_cello),
        ("classical-piano.wav", gen_classical_piano),
        ("reggae-skank.wav", gen_reggae_skank),
        ("reggae-bass.wav", gen_reggae_bass),
        ("reggae-organ.wav", gen_reggae_organ),
        ("carnatic-tanpura.wav", gen_carnatic_tanpura),
        ("carnatic-veena.wav", gen_carnatic_veena),
        ("carnatic-flute.wav", gen_carnatic_flute),
    ]

    for filename, fn in accompaniment_generators:
        out_path = os.path.join(accomp_dir, filename)
        samples = fn(rng)
        normalize_and_save_wav(out_path, samples, target_peak=0.68)
        print(f"Generated Accompaniment -> {filename} ({len(samples)/SAMPLE_RATE:.2f}s)")


if __name__ == "__main__":
    main()
