/**
 * src/engine/types.ts
 * -------------------
 * TypeScript type definitions for the Updated Antigravity Brief:
 *   1. Step 1: Letter-to-number conversion (A = 1 .. Z = 26)
 *   2. Step 2: Complete Fibonacci-modulo cycle per letter (returning to 0, 1 % n; A=1 -> [0])
 *   3. Step 3 & 4: 27 preloaded & replaceable number sounds (0 = Snap .. 26 = Rubbing palms together)
 *   4. Step 5: Name-derived Time Signature via S = sum of letter values, T = S % 6:
 *        0 -> 3/4 (Three quarter-note beats per bar)
 *        1 -> 4/4 (Four quarter-note beats per bar)
 *        2 -> 5/4 (Five quarter-note beats per bar)
 *        3 -> 6/8 (Six eighth-note beats per bar, grouped as two main pulses 3+3)
 *        4 -> 7/8 (Seven eighth-note beats per bar, grouped as 2+2+3)
 *        5 -> 12/8 (Twelve eighth-note beats per bar, grouped as four groups of three 3+3+3+3)
 *   5. Step 6: Name-selected Background Percussion via P = S % 6:
 *        0 -> Snap, 1 -> Clap, 2 -> Leg thump, 3 -> Lip pop, 4 -> Sneeze, 5 -> Tongue click
 *   6. Step 7 & 8: Six Preloaded Musical Themes & Mathematical Theme Suggestion via
 *        G = sum of (i * x_i), M = G % 6:
 *        0 -> Pop, 1 -> Jazz, 2 -> Rock, 3 -> Classical, 4 -> Reggae, 5 -> Indian Carnatic
 */

export type TimeSignatureId = '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '12/8';

export type PercussionInstrumentId =
  | 'snap'
  | 'clap'
  | 'leg-thump'
  | 'lip-pop'
  | 'sneeze'
  | 'tongue-click';

export type InstrumentalStyleId =
  | 'pop'
  | 'jazz'
  | 'rock'
  | 'classical'
  | 'reggae'
  | 'indian-carnatic';

export interface TimeSignatureSpec {
  /** Time signature label, e.g. "3/4", "4/4", "5/4", "6/8", "7/8", "12/8" */
  id: TimeSignatureId;
  /** Modulo-6 value T = S % 6 (0..5) */
  moduloValue: number;
  /** Top number: number of beats/subdivisions per bar (3, 4, 5, 6, 7, or 12) */
  beatsPerBar: number;
  /** Bottom number: note value per beat/subdivision (4 = quarter note, 8 = eighth note) */
  beatUnit: 4 | 8;
  /** True for compound meters 6/8 and 12/8 where BPM refers to the dotted-quarter main pulse */
  isCompound: boolean;
  /** Exact interpretation text from Step 5 of the brief */
  interpretation: string;
  /** Visual beat grouping notation, e.g. "2 + 2 + 3" for 7/8, "3 + 3" for 6/8 */
  groupingLabel: string;
  /** Subgroup sizes within each bar, e.g. [2, 2, 3] for 7/8 */
  groupSizes: number[];
  /** Relative accent levels (0.0–1.0) for each beat in the bar (length = beatsPerBar) */
  accentPattern: number[];
  /** Human-readable explanation of how the beat structure works */
  beatStructureExplanation: string;
}

export interface PercussionInstrumentSpec {
  /** Unique ID for the 6 distinct percussion instruments */
  id: PercussionInstrumentId;
  /** Display name from Step 6 of the brief: Snap, Clap, Leg thump, Lip pop, Sneeze, Tongue click */
  instrumentName: string;
  /** Modulo-6 value P = S % 6 (0..5) that selects this instrument */
  moduloValue: number;
  /** Canonical filename in `/public/sounds/percussion/` */
  filename: string;
  /** Public URL path in `/sounds/percussion/` */
  publicPath: string;
  /** Recording tip for the user */
  recordingTip: string;
}

export interface StyleSampleSpec {
  /** Unique sample ID, e.g. "pop-keys", "carnatic-tanpura" */
  sampleId: string;
  /** Instrument role label, e.g. "Tanpura Sa–Pa Drone", "Saraswati Veena" */
  instrumentLabel: string;
  /** Filename in `/public/sounds/accompaniment/` */
  filename: string;
  /** Public URL path in `/sounds/accompaniment/` */
  publicPath: string;
}

export interface InstrumentalStyleSpec {
  /** One of the 6 theme IDs */
  id: InstrumentalStyleId;
  /** Modulo-6 value M = G % 6 (0..5) that suggests this theme */
  moduloValue: number;
  /** Display name: "Pop", "Jazz", "Rock", "Classical", "Reggae", "Indian Carnatic" */
  styleName: string;
  /** Short badge tagline for the theme selector */
  tagline: string;
  /** List of instruments featured in this theme */
  instruments: string[];
  /** Description of the harmonic & rhythmic arrangement approach */
  arrangementDescription: string;
  /** How this theme supports the foreground sound composition */
  harmonyApproach: string;
  /** Preloaded instrumental audio samples used by this theme's arrangement */
  samples: {
    primary: StyleSampleSpec;
    bassOrDrone: StyleSampleSpec;
    textureOrAccent: StyleSampleSpec;
  };
}

export interface SoundMapping {
  /** Number from 0 to 26 */
  number: number;
  /** Default human sound name from Step 3 table, e.g. "Snap", "Clap", ..., "Rubbing palms together" */
  soundName: string;
  /** Filename in `/public/sounds/`, e.g. "00-snap.wav" */
  filename: string;
  /** Public URL path, e.g. "/sounds/00-snap.wav" */
  publicPath: string;
  /** Short recording tip for the user when recording a custom replacement */
  recordingTip: string;
}

export interface SequenceStepItem {
  /** 0-based index within this letter's Fibonacci-modulo cycle */
  stepIndexInLetter: number;
  /** 0-based global index across the entire name's continuous composition */
  globalStepIndex: number;
  /** The Fibonacci-modulo number (0 to n-1) */
  number: number;
  /** The corresponding default sound name (e.g. 0 -> "Snap") */
  soundName: string;
  /** Expected audio filename (e.g. "00-snap.wav") */
  filename: string;
}

export interface LetterSequenceData {
  /** Uppercase letter A–Z */
  letter: string;
  /** 1-based position i of this letter in the normalized name */
  positionInName: number;
  /** Alphabet position x_i: A = 1, B = 2, ..., Z = 26 */
  alphabetValue: number;
  /** Weighted product i * x_i used in G = sum(i * x_i) */
  weightedProduct: number;
  /** Complete Fibonacci-modulo cycle (Pisano period) for modulus = alphabetValue */
  sequence: number[];
  /** Detailed step items with sound names and global indices */
  steps: SequenceStepItem[];
}

export interface WeightedLetterTerm {
  /** 1-based position i */
  position: number;
  /** Uppercase letter */
  letter: string;
  /** Alphabet value x_i (1..26) */
  alphabetValue: number;
  /** Product i * x_i */
  product: number;
}

export interface NameConversionResult {
  /** Exact string entered by the user */
  rawInput: string;
  /** Normalized uppercase letters A–Z only */
  normalizedName: string;
  /** Per-letter breakdown in exact name order */
  letters: LetterSequenceData[];
  /** S = sum of all letter alphabet values */
  letterSum: number;
  /** T = S % 6 (0 to 5) for Time Signature */
  timeSignatureModulo: number;
  /** Selected Time Signature based on T = S % 6 */
  selectedTimeSignature: TimeSignatureSpec;
  /** P = S % 6 (0 to 5) for Background Percussion */
  percussionModulo: number;
  /** Selected Percussion Instrument based on P = S % 6 */
  selectedPercussion: PercussionInstrumentSpec;
  /** G = sum of (i * x_i) for every letter position i = 1..L */
  weightedSumG: number;
  /** Individual (i * x_i) breakdown terms for visual explanation & poster */
  weightedTerms: WeightedLetterTerm[];
  /** M = G % 6 (0 to 5) for Suggested Musical Theme */
  themeModuloM: number;
  /** Mathematically suggested musical theme based on M = G % 6 */
  suggestedTheme: InstrumentalStyleSpec;
  /** Flattened continuous array of all numbers across the entire name in order */
  flatNumbers: number[];
  /** Flattened continuous array of all ordered steps across the entire name */
  orderedSteps: Array<
    SequenceStepItem & {
      letter: string;
      letterIndex: number;
      alphabetValue: number;
    }
  >;
  /** Unique numbers (0..26) that appear anywhere in this name's composition */
  uniqueNumbersUsed: number[];
}
