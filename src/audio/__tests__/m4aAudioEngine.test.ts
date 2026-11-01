/**
 * src/audio/__tests__/m4aAudioEngine.test.ts
 * ------------------------------------------
 * Verifies:
 *   1. SoundOfNameAudioEngine loads all 27 personal .m4a recordings from their
 *      exact URL-encoded public paths and never fetches generated 00..26 .wav files.
 *   2. Restoring a custom-overridden sound restores the user's original .m4a
 *      recording (never a .wav file).
 *   3. Codec/decode errors on .m4a surface status: 'error' with conversion
 *      guidance rather than silently falling back to generated .wav files.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { SoundOfNameAudioEngine } from '../audioEngine';

function createMockAudioContext(shouldFailM4aDecode = false) {
  const createMockBuffer = (length = 48000, sampleRate = 48000) => {
    const ch0 = new Float32Array(length);
    const ch1 = new Float32Array(length);
    // Simulate Voice Memo: 0.2s quiet room floor + 0.5s clear signal + 0.3s quiet tail
    for (let i = 9600; i < 33600; i++) {
      ch0[i] = Math.sin(i * 0.05) * 0.65;
      ch1[i] = Math.sin(i * 0.05) * 0.65;
    }
    const channels = [ch0, ch1];
    return {
      numberOfChannels: 2,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: (c: number) => channels[c],
    } as unknown as AudioBuffer;
  };

  const mockCtx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    createGain: vi.fn(() => ({
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect: vi.fn(),
    })),
    createBuffer: vi.fn(
      (numCh: number, len: number, sr: number) => {
        const arrs = Array.from({ length: numCh }, () => new Float32Array(len));
        return {
          numberOfChannels: numCh,
          length: len,
          sampleRate: sr,
          duration: len / sr,
          getChannelData: (c: number) => arrs[c],
        } as unknown as AudioBuffer;
      }
    ),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    })),
    decodeAudioData: vi.fn(async (buf: ArrayBuffer) => {
      if (shouldFailM4aDecode && buf.byteLength === 1024) {
        throw new Error('EncodingError: Unable to decode audio data');
      }
      return createMockBuffer();
    }),
  };

  return mockCtx;
}

describe('SoundOfNameAudioEngine — Personal .m4a Default Library & Restore Verification', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup test window
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    vi.restoreAllMocks();
  });

  it('loads all 27 personal .m4a paths, never requests 00..26 .wav files, and restores original .m4a after custom override', async () => {
    const requestedUrls: string[] = [];
    const mockCtx = createMockAudioContext(false);

    globalThis.window = {
      AudioContext: vi.fn(() => mockCtx),
    } as unknown as Window & typeof globalThis;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const byteLen = url.endsWith('.m4a') ? 1024 : 512;
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h: string) =>
            h.toLowerCase() === 'content-type'
              ? url.endsWith('.m4a')
                ? 'audio/mp4'
                : 'audio/wav'
              : null,
        },
        arrayBuffer: async () => new ArrayBuffer(byteLen),
      } as unknown as Response;
    });

    const engine = new SoundOfNameAudioEngine();
    const { numberManifest } = await engine.loadManifestAssets();

    // 1. All 27 foreground number assets must be loaded from .m4a
    expect(numberManifest).toHaveLength(27);
    for (const item of numberManifest) {
      expect(item.status).toBe('loaded');
      expect(item.filename.endsWith('.m4a')).toBe(true);
      expect(item.isCustom).toBe(false);
      expect(item.sourceNote).toContain('Original iPhone Voice Memo');
    }

    // 2. Verify none of the generated 00..26 .wav paths were ever requested
    const foregroundRequests = requestedUrls.filter(
      (u) =>
        u.startsWith('/sounds/') &&
        !u.startsWith('/sounds/percussion/') &&
        !u.startsWith('/sounds/accompaniment/')
    );
    expect(foregroundRequests).toHaveLength(27);
    expect(foregroundRequests.every((u) => u.endsWith('.m4a'))).toBe(true);
    expect(foregroundRequests.some((u) => u.endsWith('.wav'))).toBe(false);

    // 3. Register a custom override for #0 (Snap), then restore default -> must restore 00-snap.m4a
    const customBlob = {
      type: 'audio/webm',
      arrayBuffer: async () => new ArrayBuffer(2048),
    } as unknown as Blob;
    await engine.registerNumberAudioBlob(
      0,
      customBlob,
      'Custom user snap',
      false
    );
    expect(engine.getNumberManifest()[0].isCustom).toBe(true);
    expect(engine.getNumberManifest()[0].sourceNote).toBe('Custom user snap');

    await engine.restoreDefaultNumberSound(0);
    const restored0 = engine.getNumberManifest()[0];
    expect(restored0.isCustom).toBe(false);
    expect(restored0.status).toBe('loaded');
    expect(restored0.filename).toBe('00-snap.m4a');
    expect(restored0.sourceNote).toBe(
      'Original iPhone Voice Memo (00-snap.m4a)'
    );
  });

  it('surfaces explicit codec error with conversion instructions instead of falling back to .wav if .m4a decoding fails', async () => {
    const requestedUrls: string[] = [];
    const mockCtx = createMockAudioContext(true);

    globalThis.window = {
      AudioContext: vi.fn(() => mockCtx),
    } as unknown as Window & typeof globalThis;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      const byteLen = url.endsWith('.m4a') ? 1024 : 512;
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'audio/mp4' },
        arrayBuffer: async () => new ArrayBuffer(byteLen),
      } as unknown as Response;
    });

    const engine = new SoundOfNameAudioEngine();
    const { numberManifest } = await engine.loadManifestAssets();

    for (const item of numberManifest) {
      expect(item.status).toBe('error');
      expect(item.errorMessage).toContain('afconvert -f WAVE -d LEI16@48000');
    }

    // Must NEVER fall back to fetching any foreground .wav file
    const anyForegroundWav = requestedUrls.some(
      (u) =>
        u.startsWith('/sounds/') &&
        !u.startsWith('/sounds/percussion/') &&
        !u.startsWith('/sounds/accompaniment/') &&
        u.endsWith('.wav')
    );
    expect(anyForegroundWav).toBe(false);
  });
});
