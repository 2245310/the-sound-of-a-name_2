/**
 * src/audio/__tests__/audioSequencer.test.ts
 * ------------------------------------------
 * Automated tests for:
 *   - 27-number human-sound manifest (0=Snap .. 26=Rubbing palms together)
 *   - 6-instrument percussion manifest (P = S % 6: Snap, Clap, Leg thump, Lip pop, Sneeze, Tongue click)
 *   - Time signature bar structure & beat groupings (T = S % 6: 3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
 *   - User-controlled BPM (default 100 BPM, range 40–200 BPM) + dotted-quarter main pulse for 6/8 and 12/8
 *   - Verification that changing BPM or theme never alters the Fibonacci sequence, time signature, or percussion choice
 */

import { describe, it, expect } from 'vitest';
import { ALL_INSTRUMENTAL_STYLES } from '../../engine/config';
import type { InstrumentalStyleId } from '../../engine/types';
import { convertNameToSoundSequence } from '../../engine/mathEngine';
import {
  createInitialAccompanimentManifest,
  createInitialPercussionManifest,
  createInitialSoundManifest,
  summarizeManifestForName,
} from '../assetManifest';
import {
  buildContinuousTimeline,
  clampBpm,
  findActiveEventAtTime,
  getTimeSignatureBeatForStep,
} from '../audioSequencer';

describe('0–26 Human-Sound Library & 6-Instrument Percussion Manifest', () => {
  it('initializes 27 foreground sound slots (0..26) and 6 percussion slots', () => {
    const numManifest = createInitialSoundManifest();
    const percManifest = createInitialPercussionManifest();
    expect(numManifest).toHaveLength(27);
    expect(percManifest).toHaveLength(6);
  });

  it('maps all 27 numbers (0..26) strictly to the user personal .m4a recordings and never .wav', () => {
    const numManifest = createInitialSoundManifest();
    expect(numManifest[0].soundName).toBe('Snap');
    expect(numManifest[0].filename).toBe('00-snap.m4a');
    expect(numManifest[0].publicPath).toBe('/sounds/00-snap.m4a');

    expect(numManifest[2].soundName).toBe('Tongue click');
    expect(numManifest[2].publicPath).toBe('/sounds/02-tongue%20click.m4a');

    expect(numManifest[26].soundName).toBe('Rubbing palms together');
    expect(numManifest[26].filename).toBe('26-rubbing- palms.m4a');
    expect(numManifest[26].publicPath).toBe('/sounds/26-rubbing-%20palms.m4a');

    for (const item of numManifest) {
      expect(item.filename.endsWith('.m4a')).toBe(true);
      expect(item.publicPath.startsWith('/sounds/')).toBe(true);
      expect(item.publicPath.endsWith('.m4a')).toBe(true);
      expect(item.publicPath.includes(' ')).toBe(false); // spaces must be URL-encoded
    }
  });

  it('tracks missing vs loaded foreground and percussion assets accurately', () => {
    const numManifest = createInitialSoundManifest();
    const percManifest = createInitialPercussionManifest();
    const conv = convertNameToSoundSequence('A'); // uses number 0, S=1, P=1 -> clap

    const summaryBefore = summarizeManifestForName(
      numManifest,
      percManifest,
      conv.uniqueNumbersUsed,
      conv.selectedPercussion.id
    );
    expect(summaryBefore.requiredByName).toEqual([0]);
    expect(summaryBefore.isSelectedPercussionLoaded).toBe(false);
    expect(summaryBefore.isNameReadyToPlay).toBe(false);

    const loadedNums = numManifest.map((m) =>
      m.number === 0 ? { ...m, status: 'loaded' as const } : m
    );
    const loadedPerc = percManifest.map((p) =>
      p.id === 'clap' ? { ...p, status: 'loaded' as const } : p
    );

    const summaryAfter = summarizeManifestForName(
      loadedNums,
      loadedPerc,
      conv.uniqueNumbersUsed,
      conv.selectedPercussion.id
    );
    expect(summaryAfter.isSelectedPercussionLoaded).toBe(true);
    expect(summaryAfter.isNameReadyToPlay).toBe(true);
  });
});

describe('Time Signature Beat Groupings, Tempo & Synchronized Timeline', () => {
  it('clamps BPM to the required 40–200 BPM range and defaults to 100 BPM', () => {
    expect(clampBpm(100)).toBe(100);
    expect(clampBpm(20)).toBe(40);
    expect(clampBpm(300)).toBe(200);
  });

  it('schedules RAMESH (103 steps, 7/8 time signature, P=4 Sneeze, M=0 Pop) at 100 BPM', () => {
    const conv = convertNameToSoundSequence('RAMESH');
    const numManifest = createInitialSoundManifest();
    const timeline100 = buildContinuousTimeline(conv, numManifest, 100);

    expect(timeline100.bpm).toBe(100);
    expect(timeline100.totalSteps).toBe(103);
    expect(timeline100.timeSignatureId).toBe('7/8');
    expect(timeline100.groupingLabel).toBe('2 + 2 + 3');
    expect(timeline100.selectedPercussionId).toBe('sneeze');
    expect(timeline100.suggestedStyleId).toBe('pop');
    expect(timeline100.selectedStyleId).toBe('pop');
    expect(timeline100.stepDurationSeconds).toBeCloseTo(0.6, 4);
    expect(timeline100.totalDurationSeconds).toBeCloseTo(103 * 0.6, 3);
  });

  it('uses dotted-quarter main pulse timing for 6/8 and 12/8 time signatures', () => {
    const conv68 = convertNameToSoundSequence('C'); // S=3 -> T=3 -> 6/8
    const tl68 = buildContinuousTimeline(
      conv68,
      createInitialSoundManifest(),
      100
    );
    expect(tl68.timeSignatureId).toBe('6/8');
    expect(tl68.stepDurationSeconds).toBeCloseTo(30 / 100, 4);
    expect(tl68.pulseDefinition).toContain('dotted-quarter main pulse');
  });

  it('computes accurate bar, beatInBar, and group starts for 7/8 (2+2+3) and 5/4 (3+2)', () => {
    const conv78 = convertNameToSoundSequence('RAMESH'); // 7/8 (2+2+3)
    const spec78 = conv78.selectedTimeSignature;
    const groupStarts78 = [0, 1, 2, 3, 4, 5, 6].map(
      (idx) => getTimeSignatureBeatForStep(idx, spec78).isGroupStart
    );
    // Group starts at beats 1 (index 0), 3 (index 2), and 5 (index 4)
    expect(groupStarts78).toEqual([
      true,
      false,
      true,
      false,
      true,
      false,
      false,
    ]);

    const conv54 = convertNameToSoundSequence('B'); // S=2 -> T=2 -> 5/4 (3+2)
    const spec54 = conv54.selectedTimeSignature;
    const groupStarts54 = [0, 1, 2, 3, 4].map(
      (idx) => getTimeSignatureBeatForStep(idx, spec54).isGroupStart
    );
    // Group starts at beats 1 (index 0) and 4 (index 3)
    expect(groupStarts54).toEqual([true, false, false, true, false]);
  });

  it('changing BPM changes step timing and total duration WITHOUT changing sequences, time signature, or percussion choice', () => {
    const conv = convertNameToSoundSequence('RAMESH');
    const numManifest = createInitialSoundManifest();

    const slow = buildContinuousTimeline(conv, numManifest, 60); // 1.0s per step
    const fast = buildContinuousTimeline(conv, numManifest, 120); // 0.5s per step

    expect(slow.events.map((e) => e.number)).toEqual(
      fast.events.map((e) => e.number)
    );
    expect(slow.timeSignatureId).toBe(fast.timeSignatureId);
    expect(slow.selectedPercussionId).toBe(fast.selectedPercussionId);
    expect(slow.totalDurationSeconds).toBeCloseTo(103 * 1.0, 3);
    expect(fast.totalDurationSeconds).toBeCloseTo(103 * 0.5, 3);

    const active = findActiveEventAtTime(fast, 0.1);
    expect(active?.globalStepIndex).toBe(0);
    expect(active?.beatInBar).toBe(1);
  });

  it('defines 6 preloaded musical themes (18 accompaniment assets) and switching themes never alters the Fibonacci sequence, time signature, or percussion choice', () => {
    expect(ALL_INSTRUMENTAL_STYLES).toHaveLength(6);
    const accManifest = createInitialAccompanimentManifest();
    expect(accManifest).toHaveLength(18);

    const conv = convertNameToSoundSequence('RAMESH');
    const numManifest = createInitialSoundManifest();

    const styleIds: InstrumentalStyleId[] = [
      'pop',
      'jazz',
      'rock',
      'classical',
      'reggae',
      'indian-carnatic',
    ];

    const timelines = styleIds.map((styleId) =>
      buildContinuousTimeline(conv, numManifest, 100, styleId)
    );

    const referenceNumbers = timelines[0].events.map((e) => e.number);
    const referenceSounds = timelines[0].events.map((e) => e.soundName);
    const styleSummaries = new Set<string>();

    for (const tl of timelines) {
      expect(tl.events.map((e) => e.number)).toEqual(referenceNumbers);
      expect(tl.events.map((e) => e.soundName)).toEqual(referenceSounds);
      expect(tl.timeSignatureId).toBe('7/8');
      expect(tl.selectedPercussionId).toBe('sneeze');
      expect(tl.suggestedStyleId).toBe('pop');
      expect(tl.bpm).toBe(100);
      expect(tl.totalDurationSeconds).toBeCloseTo(103 * 0.6, 3);

      const barSignature = tl.events
        .slice(0, 7)
        .map((e) => e.accompanimentSummary)
        .join(' || ');
      styleSummaries.add(barSignature);
    }

    expect(styleSummaries.size).toBe(6);

    // Verify Indian Carnatic Tanpura drone remains anchored to Reference Sa (playbackRate = 1.0)
    const carnaticTl = buildContinuousTimeline(
      conv,
      numManifest,
      100,
      'indian-carnatic'
    );
    const tanpuraEvents = carnaticTl.events.flatMap((ev) =>
      ev.accompanimentEvents.filter((a) => a.sampleId === 'carnatic-tanpura')
    );
    expect(tanpuraEvents.length).toBeGreaterThan(0);
    for (const droneEv of tanpuraEvents) {
      expect(droneEv.playbackRate).toBe(1.0);
    }
  });
});
