/**
 * src/engine/__tests__/mathEngine.test.ts
 * ---------------------------------------
 * Automated tests for the Updated Antigravity Brief (Steps 1–14):
 *   - Step 1: Convert name into letters (uppercase, remove spaces/non-letters, A=1..Z=26)
 *   - Step 2: Complete Fibonacci-modulo cycle per letter until returning to (0, 1 % n)
 *             (including A=1 -> [0], and exact verification of all RAMESH sequences)
 *   - Step 3: Map each number 0..26 to its recorded human sound (0=Snap .. 26=Rubbing palms together)
 *   - Step 5: Derive a time signature from the name:
 *             S = sum of all letter values, T = S % 6
 *             0 -> 3/4, 1 -> 4/4, 2 -> 5/4 (3+2), 3 -> 6/8 (3+3), 4 -> 7/8 (2+2+3), 5 -> 12/8 (3+3+3+3)
 *   - Step 6: Select a background percussion instrument from the name:
 *             P = S % 6
 *             0 -> Snap, 1 -> Clap, 2 -> Leg thump, 3 -> Lip pop, 4 -> Sneeze, 5 -> Tongue click
 *   - Step 8: Suggest a musical theme mathematically from the name:
 *             G = Σ(i × xᵢ), M = G % 6
 *             0 -> Pop, 1 -> Jazz, 2 -> Rock, 3 -> Classical, 4 -> Reggae, 5 -> Indian Carnatic
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeName,
  letterToValue,
  fibonacciModuloCycle,
  computeTimeSignatureSelection,
  computePercussionSelection,
  computeSuggestedThemeSelection,
  convertNameToSoundSequence,
} from '../mathEngine';
import {
  ALL_INSTRUMENTAL_STYLES,
  ALL_PERCUSSION_SPECS,
  ALL_SOUND_NUMBERS,
  ALL_TIME_SIGNATURE_SPECS,
  getPercussionForModulo,
  getSoundForNumber,
  getSuggestedThemeForModulo,
  getTimeSignatureForModulo,
  NUMBER_SOUND_MAP,
} from '../config';

describe('Step 1: Name Normalization & Alphabet Positions (A = 1 .. Z = 26)', () => {
  it('converts lowercase to uppercase and removes spaces and punctuation', () => {
    expect(normalizeName('ramesh')).toBe('RAMESH');
    expect(normalizeName('Sahana Ramesh!')).toBe('SAHANARAMESH');
    expect(normalizeName("O'Brien-123")).toBe('OBRIEN');
  });

  it('converts RAMESH letters to R=18, A=1, M=13, E=5, S=19, H=8', () => {
    expect(letterToValue('R')).toBe(18);
    expect(letterToValue('A')).toBe(1);
    expect(letterToValue('M')).toBe(13);
    expect(letterToValue('E')).toBe(5);
    expect(letterToValue('S')).toBe(19);
    expect(letterToValue('H')).toBe(8);
  });

  it('maps every letter A..Z to 1..26', () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 26; i++) {
      expect(letterToValue(alphabet[i])).toBe(i + 1);
    }
  });
});

describe('Step 2: Complete Fibonacci-Modulo Cycle (Pisano Period)', () => {
  it('handles A = 1 as [0]', () => {
    expect(fibonacciModuloCycle(1)).toEqual([0]);
  });

  it('matches the exact R = 18 sequence from the brief', () => {
    expect(fibonacciModuloCycle(18)).toEqual([
      0, 1, 1, 2, 3, 5, 8, 13, 3, 16, 1, 17, 0, 17, 17, 16, 15, 13, 10, 5, 15,
      2, 17, 1,
    ]);
  });

  it('matches the exact M = 13 sequence from the brief', () => {
    expect(fibonacciModuloCycle(13)).toEqual([
      0, 1, 1, 2, 3, 5, 8, 0, 8, 8, 3, 11, 1, 12, 0, 12, 12, 11, 10, 8, 5, 0,
      5, 5, 10, 2, 12, 1,
    ]);
  });

  it('matches the exact E = 5 sequence from the brief', () => {
    expect(fibonacciModuloCycle(5)).toEqual([
      0, 1, 1, 2, 3, 0, 3, 3, 1, 4, 0, 4, 4, 3, 2, 0, 2, 2, 4, 1,
    ]);
  });

  it('matches the exact S = 19 sequence from the brief', () => {
    expect(fibonacciModuloCycle(19)).toEqual([
      0, 1, 1, 2, 3, 5, 8, 13, 2, 15, 17, 13, 11, 5, 16, 2, 18, 1,
    ]);
  });

  it('matches the exact H = 8 sequence from the brief', () => {
    expect(fibonacciModuloCycle(8)).toEqual([
      0, 1, 1, 2, 3, 5, 0, 5, 5, 2, 7, 1,
    ]);
  });

  it('returns a valid finite cycle for every n from 1 to 26 that wraps back to (0, 1 % n)', () => {
    for (let n = 1; n <= 26; n++) {
      const cycle = fibonacciModuloCycle(n);
      expect(cycle.length).toBeGreaterThanOrEqual(1);
      for (const val of cycle) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(n);
      }

      if (n >= 2) {
        const nextFirst =
          (cycle[cycle.length - 2] + cycle[cycle.length - 1]) % n;
        const nextSecond = (cycle[cycle.length - 1] + nextFirst) % n;
        expect(nextFirst).toBe(0);
        expect(nextSecond).toBe(1);
      }
    }
  });
});

describe('Step 3: Number-to-Sound Mapping (0 to 26)', () => {
  it('defines all 27 numbers from 0 to 26', () => {
    expect(ALL_SOUND_NUMBERS).toHaveLength(27);
    expect(ALL_SOUND_NUMBERS[0]).toBe(0);
    expect(ALL_SOUND_NUMBERS[26]).toBe(26);
  });

  it('maps 0 to Snap and 26 to Rubbing palms together matching the brief table', () => {
    const expectedSounds = [
      'Snap',
      'Clap',
      'Tongue click',
      'Foot stomp',
      'Short whistle',
      'Sharp inhale',
      'Sigh',
      'Thigh slap',
      'Lip pop',
      'Hum',
      'Double snap',
      'Double clap',
      'Two tongue clicks',
      'Two foot stomps',
      'Long whistle',
      'Long exhale',
      'Sniffle',
      'Laugh',
      'Cough',
      'Grunt',
      'Gasp',
      'Lip trill',
      'Whispered “whoo”',
      'Chest thump',
      'Sneeze',
      'Sobbing breath',
      'Rubbing palms together',
    ];

    for (let i = 0; i <= 26; i++) {
      expect(getSoundForNumber(i).soundName).toBe(expectedSounds[i]);
      expect(NUMBER_SOUND_MAP[i].filename.endsWith('.m4a')).toBe(true);
      expect(NUMBER_SOUND_MAP[i].publicPath.endsWith('.m4a')).toBe(true);
      expect(NUMBER_SOUND_MAP[i].filename.endsWith('.wav')).toBe(false);
    }
    expect(NUMBER_SOUND_MAP[0].filename).toBe('00-snap.m4a');
    expect(NUMBER_SOUND_MAP[2].filename).toBe('02-tongue click.m4a');
    expect(NUMBER_SOUND_MAP[2].publicPath).toBe('/sounds/02-tongue%20click.m4a');
    expect(NUMBER_SOUND_MAP[15].filename).toBe('15-long-inhale.m4a');
    expect(NUMBER_SOUND_MAP[26].filename).toBe('26-rubbing- palms.m4a');
    expect(NUMBER_SOUND_MAP[26].publicPath).toBe('/sounds/26-rubbing-%20palms.m4a');
  });
});

describe('Step 5: Time Signature Selection (S = sum, T = S % 6)', () => {
  it('defines all 6 time signatures and maps T = 0..5 to 3/4, 4/4, 5/4, 6/8, 7/8, 12/8', () => {
    expect(ALL_TIME_SIGNATURE_SPECS).toHaveLength(6);
    expect(getTimeSignatureForModulo(0).id).toBe('3/4');
    expect(getTimeSignatureForModulo(1).id).toBe('4/4');
    expect(getTimeSignatureForModulo(2).id).toBe('5/4');
    expect(getTimeSignatureForModulo(2).groupingLabel).toBe('3 + 2');
    expect(getTimeSignatureForModulo(3).id).toBe('6/8');
    expect(getTimeSignatureForModulo(3).groupingLabel).toBe('3 + 3');
    expect(getTimeSignatureForModulo(4).id).toBe('7/8');
    expect(getTimeSignatureForModulo(4).groupingLabel).toBe('2 + 2 + 3');
    expect(getTimeSignatureForModulo(5).id).toBe('12/8');
    expect(getTimeSignatureForModulo(5).groupingLabel).toBe('3 + 3 + 3 + 3');
  });

  it('calculates S = 64, T = 64 % 6 = 4 -> 7/8 for RAMESH', () => {
    const res = convertNameToSoundSequence('RAMESH');
    expect(res.letterSum).toBe(64);
    expect(res.timeSignatureModulo).toBe(4);
    expect(res.selectedTimeSignature.id).toBe('7/8');
    expect(res.selectedTimeSignature.groupSizes).toEqual([2, 2, 3]);
  });

  it('computes time signature directly from letter values', () => {
    const { letterSum, timeSignatureModulo, selectedTimeSignature } =
      computeTimeSignatureSelection([18, 1, 13, 5, 19, 8]);
    expect(letterSum).toBe(64);
    expect(timeSignatureModulo).toBe(4);
    expect(selectedTimeSignature.id).toBe('7/8');
  });
});

describe('Step 6: Percussion Instrument Selection (S = sum, P = S % 6)', () => {
  it('defines all 6 percussion instruments and maps P = 0..5 to Snap, Clap, Leg thump, Lip pop, Sneeze, Tongue click', () => {
    expect(ALL_PERCUSSION_SPECS).toHaveLength(6);
    expect(getPercussionForModulo(0).instrumentName).toBe('Snap');
    expect(getPercussionForModulo(1).instrumentName).toBe('Clap');
    expect(getPercussionForModulo(2).instrumentName).toBe('Leg thump');
    expect(getPercussionForModulo(3).instrumentName).toBe('Lip pop');
    expect(getPercussionForModulo(4).instrumentName).toBe('Sneeze');
    expect(getPercussionForModulo(5).instrumentName).toBe('Tongue click');
  });

  it('calculates S = 64, P = 64 % 6 = 4 -> Sneeze for RAMESH', () => {
    const res = convertNameToSoundSequence('RAMESH');
    expect(res.letterSum).toBe(64);
    expect(res.percussionModulo).toBe(4);
    expect(res.selectedPercussion.instrumentName).toBe('Sneeze');
  });

  it('verifies single-letter names A..F cover all P = 0..5 outcomes', () => {
    expect(convertNameToSoundSequence('F').percussionModulo).toBe(0);
    expect(convertNameToSoundSequence('F').selectedPercussion.instrumentName).toBe('Snap');

    expect(convertNameToSoundSequence('A').percussionModulo).toBe(1);
    expect(convertNameToSoundSequence('A').selectedPercussion.instrumentName).toBe('Clap');

    expect(convertNameToSoundSequence('B').percussionModulo).toBe(2);
    expect(convertNameToSoundSequence('B').selectedPercussion.instrumentName).toBe('Leg thump');

    expect(convertNameToSoundSequence('C').percussionModulo).toBe(3);
    expect(convertNameToSoundSequence('C').selectedPercussion.instrumentName).toBe('Lip pop');

    expect(convertNameToSoundSequence('D').percussionModulo).toBe(4);
    expect(convertNameToSoundSequence('D').selectedPercussion.instrumentName).toBe('Sneeze');

    expect(convertNameToSoundSequence('E').percussionModulo).toBe(5);
    expect(convertNameToSoundSequence('E').selectedPercussion.instrumentName).toBe('Tongue click');
  });

  it('computes percussion selection directly from letter values', () => {
    const { letterSum, percussionModulo, selectedPercussion } =
      computePercussionSelection([18, 1, 13, 5, 19, 8]);
    expect(letterSum).toBe(64);
    expect(percussionModulo).toBe(4);
    expect(selectedPercussion.id).toBe('sneeze');
  });
});

describe('Step 8: Mathematical Musical Theme Suggestion (G = Σ(i × xᵢ), M = G % 6)', () => {
  it('defines all 6 themes and maps M = 0..5 to Pop, Jazz, Rock, Classical, Reggae, Indian Carnatic', () => {
    expect(ALL_INSTRUMENTAL_STYLES).toHaveLength(6);
    expect(getSuggestedThemeForModulo(0).styleName).toBe('Pop');
    expect(getSuggestedThemeForModulo(1).styleName).toBe('Jazz');
    expect(getSuggestedThemeForModulo(2).styleName).toBe('Rock');
    expect(getSuggestedThemeForModulo(3).styleName).toBe('Classical');
    expect(getSuggestedThemeForModulo(4).styleName).toBe('Reggae');
    expect(getSuggestedThemeForModulo(5).styleName).toBe('Indian Carnatic');
  });

  it('calculates G = 222, M = 222 % 6 = 0 -> Pop for RAMESH matching the brief example', () => {
    // 1*18 + 2*1 + 3*13 + 4*5 + 5*19 + 6*8 = 18 + 2 + 39 + 20 + 95 + 48 = 222
    const res = convertNameToSoundSequence('RAMESH');
    expect(res.weightedSumG).toBe(222);
    expect(res.themeModuloM).toBe(0);
    expect(res.suggestedTheme.styleName).toBe('Pop');
    expect(res.weightedTerms.map((t) => t.product)).toEqual([
      18, 2, 39, 20, 95, 48,
    ]);
  });

  it('is sensitive to letter order (anagrams produce different G values) and deterministic across spaces/punctuation', () => {
    const clean = convertNameToSoundSequence('RAMESH');
    const spaced = convertNameToSoundSequence('R A M E S H! 123');
    expect(spaced.weightedSumG).toBe(clean.weightedSumG);
    expect(spaced.themeModuloM).toBe(clean.themeModuloM);
    expect(spaced.suggestedTheme).toEqual(clean.suggestedTheme);
    expect(spaced.selectedTimeSignature).toEqual(clean.selectedTimeSignature);
    expect(spaced.selectedPercussion).toEqual(clean.selectedPercussion);
    expect(spaced.flatNumbers).toEqual(clean.flatNumbers);

    const reversed = convertNameToSoundSequence('HSEMAR');
    expect(reversed.weightedSumG).not.toBe(clean.weightedSumG);

    const direct = computeSuggestedThemeSelection([
      { letter: 'R', alphabetValue: 18 },
      { letter: 'A', alphabetValue: 1 },
    ]);
    expect(direct.weightedSumG).toBe(20);
    expect(direct.themeModuloM).toBe(2);
    expect(direct.suggestedTheme.styleName).toBe('Rock');
  });
});
