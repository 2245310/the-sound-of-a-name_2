/**
 * src/engine/mathEngine.ts
 * ------------------------
 * Pure mathematical conversion engine for the Updated Antigravity Brief:
 *
 * Step 1: Convert the name into letters
 *   - Convert to uppercase.
 *   - Ignore spaces and non-alphabetic characters.
 *   - Convert each letter into its alphabet position: A = 1, B = 2, ... Z = 26.
 *
 * Step 2: Generate the Fibonacci-modulo sequence for each letter
 *   - Start with 0, 1.
 *   - Calculate each subsequent number using `next = (previous + previous_previous) % n`.
 *   - Continue until the pair of consecutive numbers returns to `0, 1 % n`.
 *   - For A = 1, the sequence is simply `[0]`.
 *
 * Step 5: Derive the Time Signature from the name
 *   - S = sum of all alphabet values in the normalized name
 *   - T = S % 6
 *   - 0 -> 3/4, 1 -> 4/4, 2 -> 5/4, 3 -> 6/8, 4 -> 7/8, 5 -> 12/8
 *
 * Step 6: Select the Background Percussion Instrument from the name
 *   - S = sum of all letter values
 *   - P = S % 6
 *   - 0 -> Snap, 1 -> Clap, 2 -> Leg thump, 3 -> Lip pop, 4 -> Sneeze, 5 -> Tongue click
 *
 * Step 8: Select a Musical Theme Mathematically from the name
 *   - G = sum of (i * x_i) for every 1-based letter position i in the normalized name
 *   - M = G % 6
 *   - 0 -> Pop, 1 -> Jazz, 2 -> Rock, 3 -> Classical, 4 -> Reggae, 5 -> Indian Carnatic
 */

import {
  getPercussionForModulo,
  getSoundForNumber,
  getSuggestedThemeForModulo,
  getTimeSignatureForModulo,
} from './config';
import type {
  InstrumentalStyleSpec,
  LetterSequenceData,
  NameConversionResult,
  PercussionInstrumentSpec,
  SequenceStepItem,
  TimeSignatureSpec,
  WeightedLetterTerm,
} from './types';

/**
 * Strips spaces and non-alphabetic characters, returning uppercase A–Z letters.
 */
export function normalizeName(rawInput: string): string {
  return rawInput.toUpperCase().replace(/[^A-Z]/g, '');
}

/**
 * Converts a single uppercase letter A–Z into its alphabet position (1–26).
 */
export function letterToValue(letter: string): number {
  if (letter.length !== 1 || letter < 'A' || letter > 'Z') {
    throw new Error(
      `letterToValue expects a single uppercase letter A–Z, received: "${letter}"`
    );
  }
  return letter.charCodeAt(0) - 64;
}

/**
 * Generates the complete Fibonacci-modulo cycle (Pisano period) for a letter
 * with alphabet value `n` (1..26).
 */
export function fibonacciModuloCycle(n: number): number[] {
  if (!Number.isInteger(n) || n < 1 || n > 26) {
    throw new Error(
      `fibonacciModuloCycle expects an integer n in 1..26, received: ${n}`
    );
  }

  if (n === 1) {
    return [0];
  }

  const startFirst = 0;
  const startSecond = 1 % n;

  const sequence: number[] = [startFirst, startSecond];
  const maxSafetyLimit = n * n * 6 + 100;

  while (sequence.length < maxSafetyLimit) {
    const prevPrev = sequence[sequence.length - 2];
    const prev = sequence[sequence.length - 1];
    const next = (prev + prevPrev) % n;
    sequence.push(next);

    if (
      sequence.length > 2 &&
      sequence[sequence.length - 2] === startFirst &&
      sequence[sequence.length - 1] === startSecond
    ) {
      sequence.pop();
      sequence.pop();
      break;
    }
  }

  return sequence;
}

/**
 * Step 5: Calculates the letter sum `S`, modulo-6 result `T = S % 6`, and
 * selected TimeSignatureSpec.
 */
export function computeTimeSignatureSelection(letterValues: number[]): {
  letterSum: number;
  timeSignatureModulo: number;
  selectedTimeSignature: TimeSignatureSpec;
} {
  const letterSum = letterValues.reduce((acc, v) => acc + v, 0);
  const timeSignatureModulo = letterSum % 6;
  const selectedTimeSignature = getTimeSignatureForModulo(timeSignatureModulo);

  return {
    letterSum,
    timeSignatureModulo,
    selectedTimeSignature,
  };
}

/**
 * Step 6: Calculates the letter sum `S`, modulo-6 result `P = S % 6`, and
 * selected PercussionInstrumentSpec.
 */
export function computePercussionSelection(letterValues: number[]): {
  letterSum: number;
  percussionModulo: number;
  selectedPercussion: PercussionInstrumentSpec;
} {
  const letterSum = letterValues.reduce((acc, v) => acc + v, 0);
  const percussionModulo = letterSum % 6;
  const selectedPercussion = getPercussionForModulo(percussionModulo);

  return {
    letterSum,
    percussionModulo,
    selectedPercussion,
  };
}

/**
 * Step 8: Calculates `G = sum of (i * x_i)` for 1-based letter positions `i = 1..L`,
 * `M = G % 6`, and the suggested InstrumentalStyleSpec.
 */
export function computeSuggestedThemeSelection(
  normalizedLetters: Array<{ letter: string; alphabetValue: number }>
): {
  weightedSumG: number;
  weightedTerms: WeightedLetterTerm[];
  themeModuloM: number;
  suggestedTheme: InstrumentalStyleSpec;
} {
  const weightedTerms: WeightedLetterTerm[] = normalizedLetters.map(
    (item, idx) => {
      const position = idx + 1;
      const product = position * item.alphabetValue;
      return {
        position,
        letter: item.letter,
        alphabetValue: item.alphabetValue,
        product,
      };
    }
  );

  const weightedSumG = weightedTerms.reduce((acc, t) => acc + t.product, 0);
  const themeModuloM = weightedSumG % 6;
  const suggestedTheme = getSuggestedThemeForModulo(themeModuloM);

  return {
    weightedSumG,
    weightedTerms,
    themeModuloM,
    suggestedTheme,
  };
}

/**
 * Master conversion function: converts any user name into its per-letter
 * Fibonacci-modulo cycles, name-derived Time Signature (`T = S % 6`),
 * name-selected Percussion Instrument (`P = S % 6`), mathematically suggested
 * Musical Theme (`G = sum(i * x_i)`, `M = G % 6`), and flattened continuous
 * sound sequence.
 */
export function convertNameToSoundSequence(
  rawInput: string
): NameConversionResult {
  const normalizedName = normalizeName(rawInput);

  if (normalizedName.length === 0) {
    throw new Error(
      `Input must contain at least one letter A–Z. Received: "${rawInput}"`
    );
  }

  let globalCounter = 0;
  const flatNumbers: number[] = [];
  const orderedSteps: NameConversionResult['orderedSteps'] = [];

  const letters: LetterSequenceData[] = normalizedName
    .split('')
    .map((letter, letterIndex) => {
      const positionInName = letterIndex + 1;
      const alphabetValue = letterToValue(letter);
      const weightedProduct = positionInName * alphabetValue;
      const sequence = fibonacciModuloCycle(alphabetValue);

      const steps: SequenceStepItem[] = sequence.map(
        (num, stepIndexInLetter) => {
          const sound = getSoundForNumber(num);
          const globalStepIndex = globalCounter++;
          const stepItem: SequenceStepItem = {
            stepIndexInLetter,
            globalStepIndex,
            number: num,
            soundName: sound.soundName,
            filename: sound.filename,
          };

          flatNumbers.push(num);
          orderedSteps.push({
            ...stepItem,
            letter,
            letterIndex,
            alphabetValue,
          });

          return stepItem;
        }
      );

      return {
        letter,
        positionInName,
        alphabetValue,
        weightedProduct,
        sequence,
        steps,
      };
    });

  const letterValues = letters.map((l) => l.alphabetValue);
  const { letterSum, timeSignatureModulo, selectedTimeSignature } =
    computeTimeSignatureSelection(letterValues);
  const { percussionModulo, selectedPercussion } =
    computePercussionSelection(letterValues);
  const { weightedSumG, weightedTerms, themeModuloM, suggestedTheme } =
    computeSuggestedThemeSelection(
      letters.map((l) => ({ letter: l.letter, alphabetValue: l.alphabetValue }))
    );

  const uniqueNumbersUsed = Array.from(new Set(flatNumbers)).sort(
    (a, b) => a - b
  );

  return {
    rawInput,
    normalizedName,
    letters,
    letterSum,
    timeSignatureModulo,
    selectedTimeSignature,
    percussionModulo,
    selectedPercussion,
    weightedSumG,
    weightedTerms,
    themeModuloM,
    suggestedTheme,
    flatNumbers,
    orderedSteps,
    uniqueNumbersUsed,
  };
}
