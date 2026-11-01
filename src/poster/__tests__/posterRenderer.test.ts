/**
 * src/poster/__tests__/posterRenderer.test.ts
 * -------------------------------------------
 * Comprehensive automated tests for the Redesigned Complete Generative Music
 * Poster Renderer (Sections A through J, >= 3000 × 3000 px, zero truncation,
 * word-intact wrapping, dynamic vertical expansion, and manual theme override).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  ALL_INSTRUMENTAL_STYLES,
  ALL_PERCUSSION_SPECS,
  ALL_SOUND_NUMBERS,
  ALL_TIME_SIGNATURE_SPECS,
  NUMBER_SOUND_MAP,
} from '../../engine/config';
import { convertNameToSoundSequence } from '../../engine/mathEngine';
import { createInitialSoundManifest } from '../../audio/assetManifest';
import { buildContinuousTimeline } from '../../audio/audioSequencer';
import {
  buildPosterFilename,
  POSTER_FORMATS,
  renderPosterToCanvas,
  wrapWordsIntact,
} from '../posterRenderer';

interface DrawnTextCall {
  text: string;
  x: number;
  y: number;
}

function createMockCanvas() {
  const drawnCalls: DrawnTextCall[] = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '500 16px sans-serif',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 9.5,
    })),
    fillText: vi.fn((text: string, x: number, y: number) => {
      drawnCalls.push({ text, x, y });
    }),
  };

  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockCtx),
  } as unknown as HTMLCanvasElement;

  return {
    canvas,
    mockCtx,
    drawnCalls,
    getJoinedText: () => drawnCalls.map((d) => d.text).join(' '),
  };
}

describe('Complete Poster Redesign (Sections A–J, Zero Truncation, Word Integrity)', () => {
  it('generates clean output filenames for square, portrait, and landscape', () => {
    expect(buildPosterFilename('RAMESH', 'RAMESH', 'square')).toBe(
      'ramesh-sound-score.png'
    );
    expect(buildPosterFilename('SHIVANA', 'SHIVANA', 'portrait')).toBe(
      'shivana-sound-score-portrait.png'
    );
    expect(buildPosterFilename('Sahana Ramesh', 'SAHANARAMESH', 'landscape')).toBe(
      'sahana-ramesh-sound-score-landscape.png'
    );
  });

  it('wraps words strictly at spaces without ever splitting an ordinary word across lines', () => {
    const { mockCtx } = createMockCanvas();
    const paragraph =
      'Each letter becomes a number, each number generates a Fibonacci-modulo cycle, and Rubbing palms together stays intact.';
    const lines = wrapWordsIntact(
      mockCtx as unknown as CanvasRenderingContext2D,
      paragraph,
      260,
      16,
      false
    );

    expect(lines.length).toBeGreaterThan(2);
    // Rejoining wrapped lines with single spaces must equal the exact original words
    expect(lines.join(' ')).toBe(paragraph);
    for (const word of paragraph.split(' ')) {
      expect(lines.some((ln) => ln.split(' ').includes(word))).toBe(true);
    }
  });

  it('renders SHIVANA dynamically with all 10 required sections (A–J), zero ellipses, all 27 sounds, all 6 themes, and >= 3000×3000 resolution', () => {
    const conv = convertNameToSoundSequence('SHIVANA');
    const timeline = buildContinuousTimeline(
      conv,
      createInitialSoundManifest(),
      116,
      conv.suggestedTheme.id
    );
    const { canvas, drawnCalls, getJoinedText } = createMockCanvas();

    const dims = renderPosterToCanvas(canvas, conv, timeline, 'square');
    expect(dims.width).toBeGreaterThanOrEqual(POSTER_FORMATS.square.width);
    expect(dims.height).toBeGreaterThanOrEqual(POSTER_FORMATS.square.height);
    expect(canvas.width).toBe(dims.width);
    expect(canvas.height).toBe(dims.height);

    // Zero truncation ellipses ('...') anywhere in rendered text
    for (const call of drawnCalls) {
      expect(call.text).not.toContain('...');
      // Every drawn text coordinate stays inside safe horizontal & vertical canvas margins
      expect(call.x).toBeGreaterThanOrEqual(48);
      expect(call.x).toBeLessThanOrEqual(canvas.width - 48);
      expect(call.y).toBeGreaterThanOrEqual(48);
      expect(call.y).toBeLessThanOrEqual(canvas.height - 48);
    }

    const joined = getJoinedText();

    // Section A: Main title & dynamic headline
    expect(joined).toContain('“The Sound of a Name”');
    expect(joined).toContain('How ‘SHIVANA’ Becomes a Musical Composition');
    expect(joined).toContain('SHIVANA');

    // Section B: Letter-to-number conversion for SHIVANA
    for (const pair of [
      'S = 19',
      'H = 8',
      'I = 9',
      'V = 22',
      'A = 1',
      'N = 14',
    ]) {
      expect(joined).toContain(pair);
    }

    // Section C: Complete untruncated Fibonacci-modulo cycles (e.g. N=14 has 48 steps, V=22 has 30 steps)
    for (const l of conv.letters) {
      expect(joined).toContain(l.sequence.join(', '));
    }

    // Section D: Complete 0–26 sound mapping library
    for (const num of ALL_SOUND_NUMBERS) {
      expect(joined).toContain(NUMBER_SOUND_MAP[num].soundName);
    }

    // Section E: Sum S, T = S mod 6, all 6 meters & rhythmic grouping explanations
    expect(joined).toContain(`S = ${conv.letterSum}`);
    expect(joined).toContain(`T = S mod 6 = ${conv.timeSignatureModulo}`);
    for (const tsSpec of ALL_TIME_SIGNATURE_SPECS) {
      expect(joined).toContain(tsSpec.id);
    }
    expect(joined).toContain('three quarter-note beats per bar');
    expect(joined).toContain('four quarter-note beats per bar');
    expect(joined).toContain('five quarter-note beats per bar');
    expect(joined).toContain('two groups of three eighth notes');
    expect(joined).toContain('grouping of 2 + 2 + 3 eighth notes');
    expect(joined).toContain('four groups of three eighth notes');

    // Section F: Percussion P = S mod 6 & all 6 instruments
    expect(joined).toContain(`P = S mod 6 = ${conv.percussionModulo}`);
    for (const perc of ALL_PERCUSSION_SPECS) {
      expect(joined).toContain(perc.instrumentName);
    }

    // Section G: All 6 themes, G & M calculation, Algorithmically suggested theme
    expect(joined).toContain(`G = ${conv.weightedSumG}`);
    expect(joined).toContain('Algorithmically suggested theme');
    expect(joined).toContain('Currently selected theme');
    for (const style of ALL_INSTRUMENTAL_STYLES) {
      expect(joined).toContain(style.styleName);
    }

    // Section H: Tempo & dotted-quarter pulse explanation
    expect(joined).toContain('116 BPM');
    expect(joined).toContain('dotted-quarter-note pulse');

    // Section I & J: Ordered composition & process diagram stages
    expect(joined).toContain(`${timeline.totalSteps} STEPS`);
    expect(joined).toContain(
      'Name → Alphabet values → Fibonacci-modulo cycles → Sound mapping → Time signature and percussion → Musical theme → Composition'
    );
  });

  it('clearly distinguishes a manual theme override from the algorithmically suggested theme', () => {
    const conv = convertNameToSoundSequence('RAMESH'); // Suggested M=0 -> Pop
    expect(conv.suggestedTheme.id).toBe('pop');

    const timeline = buildContinuousTimeline(
      conv,
      createInitialSoundManifest(),
      100,
      'indian-carnatic'
    );
    const { canvas, getJoinedText } = createMockCanvas();
    renderPosterToCanvas(canvas, conv, timeline, 'square');

    const joined = getJoinedText();
    expect(joined).toContain('Algorithmically suggested theme: Pop');
    expect(joined).toContain(
      'Currently selected theme: Indian Carnatic (Manual user selection — overrides the algorithmic recommendation of Pop)'
    );
  });

  it('handles short names (A..F covering all 6 meters/percussions/themes) and long names with long Fibonacci cycles without clipping', () => {
    // Test A..F (covers T=P=1,2,3,4,5,0 and M=1,2,3,4,5,0)
    for (const singleLetter of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const conv = convertNameToSoundSequence(singleLetter);
      const timeline = buildContinuousTimeline(
        conv,
        createInitialSoundManifest(),
        100,
        conv.suggestedTheme.id
      );
      const { canvas, drawnCalls, getJoinedText } = createMockCanvas();
      const dims = renderPosterToCanvas(canvas, conv, timeline, 'square');

      expect(dims.width).toBe(3000);
      expect(dims.height).toBeGreaterThanOrEqual(3000);
      const joined = getJoinedText();
      expect(joined).toContain(
        `How ‘${singleLetter}’ Becomes a Musical Composition`
      );
      expect(joined).toContain(conv.selectedTimeSignature.id);
      expect(joined).toContain(conv.selectedPercussion.instrumentName);
      expect(joined).toContain(conv.suggestedTheme.styleName);
      for (const c of drawnCalls) {
        expect(c.y).toBeLessThanOrEqual(canvas.height - 48);
      }
    }

    // Long name with long Pisano cycles (Y=25 has 100 steps, V=22 has 30, X=24 has 24, N=14 has 48)
    const longConv = convertNameToSoundSequence('VYASA NARAYANAN');
    const longTimeline = buildContinuousTimeline(
      longConv,
      createInitialSoundManifest(),
      132,
      'reggae'
    );
    const { canvas, drawnCalls, getJoinedText } = createMockCanvas();
    const longDims = renderPosterToCanvas(
      canvas,
      longConv,
      longTimeline,
      'square'
    );

    expect(longDims.width).toBe(3000);
    expect(longDims.height).toBeGreaterThanOrEqual(3000);
    const longJoined = getJoinedText();
    // Complete 100-step cycle for Y=25 must appear in full with zero '...'
    const yLetter = longConv.letters.find((l) => l.letter === 'Y');
    expect(yLetter?.sequence.length).toBe(100);
    expect(longJoined).toContain(yLetter!.sequence.join(', '));
    for (const c of drawnCalls) {
      expect(c.text).not.toContain('...');
      expect(c.y).toBeLessThanOrEqual(canvas.height - 48);
    }
  });
});
