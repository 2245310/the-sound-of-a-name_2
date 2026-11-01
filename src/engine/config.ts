/**
 * src/engine/config.ts
 * --------------------
 * Single source of truth for:
 *   1. Step 3: The 27 preloaded number sounds (0 = Snap .. 26 = Rubbing palms together)
 *   2. Step 5: The 6 Time Signatures and Modulo-6 mapping (T = S % 6):
 *        0 -> 3/4, 1 -> 4/4, 2 -> 5/4, 3 -> 6/8, 4 -> 7/8, 5 -> 12/8
 *   3. Step 6: The 6 Background Percussion Instruments and Modulo-6 mapping (P = S % 6):
 *        0 -> Snap, 1 -> Clap, 2 -> Leg thump, 3 -> Lip pop, 4 -> Sneeze, 5 -> Tongue click
 *   4. Step 7 & 8: The 6 Preloaded Musical Themes and Modulo-6 mapping (M = G % 6):
 *        0 -> Pop, 1 -> Jazz, 2 -> Rock, 3 -> Classical, 4 -> Reggae, 5 -> Indian Carnatic
 *   5. Step 10: Adjustable Tempo constants (default 100 BPM, range 40–200 BPM) and
 *      pulse definition helpers (dotted-quarter main pulse for 6/8 and 12/8).
 */

import type {
  InstrumentalStyleId,
  InstrumentalStyleSpec,
  PercussionInstrumentId,
  PercussionInstrumentSpec,
  SoundMapping,
  StyleSampleSpec,
  TimeSignatureId,
  TimeSignatureSpec,
} from './types';

// ─── Step 10: Tempo Constants ────────────────────────────────────────────────

export const DEFAULT_BPM = 100;
export const MIN_BPM = 40;
export const MAX_BPM = 200;

// Reference Sa for Indian Carnatic Tanpura Drone (C4 = 261.63 Hz)
export const DEFAULT_REFERENCE_SA_NOTE = 'C4';
export const DEFAULT_REFERENCE_SA_HZ = 261.63;

// ─── Step 3: All 27 Personal Number Sound Recordings (0 to 26, .m4a) ─────────

export const NUMBER_SOUND_MAP: Record<number, SoundMapping> = {
  0: {
    number: 0,
    soundName: 'Snap',
    filename: '00-snap.m4a',
    publicPath: '/sounds/00-snap.m4a',
    recordingTip: 'Record one crisp finger snap close to the microphone.',
  },
  1: {
    number: 1,
    soundName: 'Clap',
    filename: '01-clap.m4a',
    publicPath: '/sounds/01-clap.m4a',
    recordingTip: 'Record one clean, sharp hand clap.',
  },
  2: {
    number: 2,
    soundName: 'Tongue click',
    filename: '02-tongue click.m4a',
    publicPath: '/sounds/02-tongue%20click.m4a',
    recordingTip: 'Click your tongue once cleanly against the roof of your mouth.',
  },
  3: {
    number: 3,
    soundName: 'Foot stomp',
    filename: '03-foot -stomp.m4a',
    publicPath: '/sounds/03-foot%20-stomp.m4a',
    recordingTip: 'Stomp one foot firmly on a solid floor.',
  },
  4: {
    number: 4,
    soundName: 'Short whistle',
    filename: '04-short-whistle.m4a',
    publicPath: '/sounds/04-short-whistle.m4a',
    recordingTip: 'Whistle a short, crisp single note.',
  },
  5: {
    number: 5,
    soundName: 'Sharp inhale',
    filename: '05-sharp-inhale.m4a',
    publicPath: '/sounds/05-sharp-inhale.m4a',
    recordingTip: 'Take a quick, audible breath inward through parted lips.',
  },
  6: {
    number: 6,
    soundName: 'Sigh',
    filename: '06-sigh.m4a',
    publicPath: '/sounds/06-sigh.m4a',
    recordingTip: 'Let out a natural, relaxed human sigh.',
  },
  7: {
    number: 7,
    soundName: 'Thigh slap',
    filename: '07-thigh-slap.m4a',
    publicPath: '/sounds/07-thigh-slap.m4a',
    recordingTip: 'Slap your open palm once against your thigh.',
  },
  8: {
    number: 8,
    soundName: 'Lip pop',
    filename: '08-lip-pop.m4a',
    publicPath: '/sounds/08-lip-pop.m4a',
    recordingTip: 'Press your lips together and pop them open cleanly.',
  },
  9: {
    number: 9,
    soundName: 'Hum',
    filename: '09-hum.m4a',
    publicPath: '/sounds/09-hum.m4a',
    recordingTip: 'Hum a short, steady closed-mouth musical note.',
  },
  10: {
    number: 10,
    soundName: 'Double snap',
    filename: '10-double-snap.m4a',
    publicPath: '/sounds/10-double-snap.m4a',
    recordingTip: 'Snap your fingers twice in quick succession.',
  },
  11: {
    number: 11,
    soundName: 'Double clap',
    filename: '11-double-clap.m4a',
    publicPath: '/sounds/11-double-clap.m4a',
    recordingTip: 'Clap your hands twice rapidly.',
  },
  12: {
    number: 12,
    soundName: 'Two tongue clicks',
    filename: '12-two-tongue -clicks.m4a',
    publicPath: '/sounds/12-two-tongue%20-clicks.m4a',
    recordingTip: 'Click your tongue twice back-to-back.',
  },
  13: {
    number: 13,
    soundName: 'Two foot stomps',
    filename: '13-two-foot- stomps.m4a',
    publicPath: '/sounds/13-two-foot-%20stomps.m4a',
    recordingTip: 'Stomp your foot twice firmly.',
  },
  14: {
    number: 14,
    soundName: 'Long whistle',
    filename: '14-long-whistle.m4a',
    publicPath: '/sounds/14-long-whistle.m4a',
    recordingTip: 'Whistle a smooth, sustained note.',
  },
  15: {
    number: 15,
    soundName: 'Long exhale',
    filename: '15-long-inhale.m4a',
    publicPath: '/sounds/15-long-inhale.m4a',
    recordingTip: 'Breathe audibly and steadily.',
  },
  16: {
    number: 16,
    soundName: 'Sniffle',
    filename: '16-sniffle.m4a',
    publicPath: '/sounds/16-sniffle.m4a',
    recordingTip: 'Record a quick nasal sniffle.',
  },
  17: {
    number: 17,
    soundName: 'Laugh',
    filename: '17-laugh.m4a',
    publicPath: '/sounds/17-laugh.m4a',
    recordingTip: 'Record a short, natural human laugh or chuckle.',
  },
  18: {
    number: 18,
    soundName: 'Cough',
    filename: '18-cough.m4a',
    publicPath: '/sounds/18-cough.m4a',
    recordingTip: 'Record a single brief cough or throat clear.',
  },
  19: {
    number: 19,
    soundName: 'Grunt',
    filename: '19-grunt.m4a',
    publicPath: '/sounds/19-grunt.m4a',
    recordingTip: 'Make a short, punchy low vocal grunt.',
  },
  20: {
    number: 20,
    soundName: 'Gasp',
    filename: '20-gasp.m4a',
    publicPath: '/sounds/20-gasp.m4a',
    recordingTip: 'Record a quick, surprised intake of breath.',
  },
  21: {
    number: 21,
    soundName: 'Lip trill',
    filename: '21-lip-trill.m4a',
    publicPath: '/sounds/21-lip-trill.m4a',
    recordingTip: 'Blow air through relaxed lips to make a vibrating lip trill.',
  },
  22: {
    number: 22,
    soundName: 'Whispered “whoo”',
    filename: '22-whispered- whoo.m4a',
    publicPath: '/sounds/22-whispered-%20whoo.m4a',
    recordingTip: 'Whisper an airy “whoo” into the microphone.',
  },
  23: {
    number: 23,
    soundName: 'Chest thump',
    filename: '23-chest-thump.m4a',
    publicPath: '/sounds/23-chest-thump.m4a',
    recordingTip: 'Thump your palm or fist once against your chest.',
  },
  24: {
    number: 24,
    soundName: 'Sneeze',
    filename: '24-sneeze.m4a',
    publicPath: '/sounds/24-sneeze.m4a',
    recordingTip: 'Record a natural or expressive sneeze.',
  },
  25: {
    number: 25,
    soundName: 'Sobbing breath',
    filename: '25-sobbing-breath.m4a',
    publicPath: '/sounds/25-sobbing-breath.m4a',
    recordingTip: 'Record a shaky double-inhale sobbing breath.',
  },
  26: {
    number: 26,
    soundName: 'Rubbing palms together',
    filename: '26-rubbing- palms.m4a',
    publicPath: '/sounds/26-rubbing-%20palms.m4a',
    recordingTip: 'Rub both palms briskly together close to the microphone.',
  },
};

export const ALL_SOUND_NUMBERS: number[] = Object.keys(NUMBER_SOUND_MAP)
  .map((k) => Number(k))
  .sort((a, b) => a - b);

export function getSoundForNumber(num: number): SoundMapping {
  const mapping = NUMBER_SOUND_MAP[num];
  if (!mapping) {
    throw new Error(`No sound mapping defined for number ${num}. Expected 0–26.`);
  }
  return mapping;
}

// ─── Step 5: Six Time Signatures & Modulo-6 Lookup (T = S % 6) ───────────────

export const SIX_TIME_SIGNATURES: Record<TimeSignatureId, TimeSignatureSpec> = {
  '3/4': {
    id: '3/4',
    moduloValue: 0,
    beatsPerBar: 3,
    beatUnit: 4,
    isCompound: false,
    interpretation: 'Three quarter-note beats per bar',
    groupingLabel: '1 + 1 + 1',
    groupSizes: [1, 1, 1],
    accentPattern: [1.0, 0.52, 0.52],
    beatStructureExplanation:
      'Waltz / triple meter with three quarter-note beats per bar (STRONG – weak – weak, grouped 1 + 1 + 1). Beat 1 carries the primary downbeat accent.',
  },
  '4/4': {
    id: '4/4',
    moduloValue: 1,
    beatsPerBar: 4,
    beatUnit: 4,
    isCompound: false,
    interpretation: 'Four quarter-note beats per bar',
    groupingLabel: '1 + 1 + 1 + 1',
    groupSizes: [1, 1, 1, 1],
    accentPattern: [1.0, 0.5, 0.78, 0.5],
    beatStructureExplanation:
      'Common quadruple meter with four quarter-note beats per bar (STRONG – weak – medium – weak, grouped 1 + 1 + 1 + 1). Beat 1 is the downbeat and beat 3 is the secondary pulse.',
  },
  '5/4': {
    id: '5/4',
    moduloValue: 2,
    beatsPerBar: 5,
    beatUnit: 4,
    isCompound: false,
    interpretation: 'Five quarter-note beats per bar',
    groupingLabel: '3 + 2',
    groupSizes: [3, 2],
    accentPattern: [1.0, 0.5, 0.5, 0.82, 0.5],
    beatStructureExplanation:
      'Asymmetric quintuple meter with five quarter-note beats per bar grouped as 3 + 2 (beats 1–2–3 + beats 4–5), placing primary emphasis on beat 1 and secondary emphasis on beat 4.',
  },
  '6/8': {
    id: '6/8',
    moduloValue: 3,
    beatsPerBar: 6,
    beatUnit: 8,
    isCompound: true,
    interpretation: 'Six eighth-note beats per bar, grouped as two main pulses',
    groupingLabel: '3 + 3',
    groupSizes: [3, 3],
    accentPattern: [1.0, 0.46, 0.46, 0.82, 0.46, 0.46],
    beatStructureExplanation:
      'Compound duple meter with six eighth-note beats per bar organized as two dotted-quarter main pulses of three eighth notes each (3 + 3: sub-beats 1–2–3 and 4–5–6).',
  },
  '7/8': {
    id: '7/8',
    moduloValue: 4,
    beatsPerBar: 7,
    beatUnit: 8,
    isCompound: false,
    interpretation: 'Seven eighth-note beats per bar, grouped as 2+2+3',
    groupingLabel: '2 + 2 + 3',
    groupSizes: [2, 2, 3],
    accentPattern: [1.0, 0.48, 0.78, 0.48, 0.85, 0.46, 0.46],
    beatStructureExplanation:
      'Additive septuple meter with seven eighth-note beats per bar grouped as 2 + 2 + 3 (sub-beats 1–2, 3–4, and 5–6–7), accenting beats 1, 3, and 5.',
  },
  '12/8': {
    id: '12/8',
    moduloValue: 5,
    beatsPerBar: 12,
    beatUnit: 8,
    isCompound: true,
    interpretation:
      'Twelve eighth-note beats per bar, grouped as four groups of three',
    groupingLabel: '3 + 3 + 3 + 3',
    groupSizes: [3, 3, 3, 3],
    accentPattern: [
      1.0, 0.45, 0.45, 0.75, 0.45, 0.45, 0.86, 0.45, 0.45, 0.75, 0.45, 0.45,
    ],
    beatStructureExplanation:
      'Compound quadruple meter with twelve eighth-note beats per bar organized into four dotted-quarter main pulses of three eighth notes each (3 + 3 + 3 + 3: accents on sub-beats 1, 4, 7, and 10).',
  },
};

export const TIME_SIGNATURE_BY_MODULO_6: Record<number, TimeSignatureSpec> = {
  0: SIX_TIME_SIGNATURES['3/4'],
  1: SIX_TIME_SIGNATURES['4/4'],
  2: SIX_TIME_SIGNATURES['5/4'],
  3: SIX_TIME_SIGNATURES['6/8'],
  4: SIX_TIME_SIGNATURES['7/8'],
  5: SIX_TIME_SIGNATURES['12/8'],
};

export const ALL_TIME_SIGNATURE_SPECS: TimeSignatureSpec[] = [
  SIX_TIME_SIGNATURES['3/4'],
  SIX_TIME_SIGNATURES['4/4'],
  SIX_TIME_SIGNATURES['5/4'],
  SIX_TIME_SIGNATURES['6/8'],
  SIX_TIME_SIGNATURES['7/8'],
  SIX_TIME_SIGNATURES['12/8'],
];

export function getTimeSignatureForModulo(t: number): TimeSignatureSpec {
  const normalized = ((t % 6) + 6) % 6;
  return TIME_SIGNATURE_BY_MODULO_6[normalized];
}

/**
 * Computes the duration in seconds of a single beat/subdivision step for the
 * given time signature and BPM.
 *
 * - For 3/4, 4/4, and 5/4: BPM refers to the quarter-note beat (`60 / bpm` seconds per step).
 * - For compound meters 6/8 and 12/8: BPM refers to the dotted-quarter main pulse
 *   (with a gentle 2× subdivision pacing `(60 / bpm) / 2` so that at 40–200 BPM
 *   every human sound recording remains distinct and articulate while two 3-note
 *   pulses in 6/8 or four 3-note pulses in 12/8 Lock cleanly to the dotted-quarter groove).
 * - For 7/8: BPM refers to the eighth-note pulse (`60 / bpm` seconds per eighth-note step,
 *   grouped 2 + 2 + 3).
 */
export function getStepDurationForTimeSignature(
  timeSig: TimeSignatureSpec,
  bpm: number
): number {
  const safeBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
  if (timeSig.isCompound) {
    // Dotted-quarter main pulse = (60 / safeBpm) * 1.5s, so each of the 3 eighth notes
    // inside the dotted-quarter pulse is (60 / safeBpm) * 0.5s (100 BPM -> 0.30s per eighth note,
    // 0.90s per 3-note dotted-quarter group), keeping all 27 human sounds crisp up to 200 BPM.
    return Number((30 / safeBpm).toFixed(4));
  }
  return Number((60 / safeBpm).toFixed(4));
}

/**
 * Returns a human-readable explanation of what the BPM number means for the
 * given time signature (Step 10, Step 12 item 12, and Step 13 poster).
 */
export function getPulseDefinitionForTimeSignature(
  timeSig: TimeSignatureSpec,
  bpm: number
): string {
  const safeBpm = Math.max(MIN_BPM, Math.min(MAX_BPM, bpm));
  const stepSec = getStepDurationForTimeSignature(timeSig, safeBpm);
  if (timeSig.isCompound) {
    const dottedQuarterBpm = Math.round((60 / (stepSec * 3)) * 10) / 10;
    return `${safeBpm} BPM (Compound meter pulse: dotted-quarter main pulse = ${dottedQuarterBpm} pulses/min · 3 eighth-note steps per pulse at ${stepSec.toFixed(2)}s/step, grouped ${timeSig.groupingLabel})`;
  }
  if (timeSig.beatUnit === 8) {
    return `${safeBpm} BPM (Eighth-note beat pulse = ${stepSec.toFixed(2)}s per eighth-note step, grouped ${timeSig.groupingLabel} per ${timeSig.id} bar)`;
  }
  return `${safeBpm} BPM (Quarter-note beat pulse = ${stepSec.toFixed(2)}s per quarter-note beat, grouped ${timeSig.groupingLabel} per ${timeSig.id} bar)`;
}

// ─── Step 6: Six Background Percussion Instruments & Modulo-6 (P = S % 6) ────

export const SIX_PERCUSSION_INSTRUMENTS: Record<
  PercussionInstrumentId,
  PercussionInstrumentSpec
> = {
  snap: {
    id: 'snap',
    instrumentName: 'Snap',
    moduloValue: 0,
    filename: 'perc-0-snap.wav',
    publicPath: '/sounds/percussion/perc-0-snap.wav',
    recordingTip: 'Crisp background finger-snap percussion pulse.',
  },
  clap: {
    id: 'clap',
    instrumentName: 'Clap',
    moduloValue: 1,
    filename: 'perc-1-clap.wav',
    publicPath: '/sounds/percussion/perc-1-clap.wav',
    recordingTip: 'Warm background hand-clap percussion pulse.',
  },
  'leg-thump': {
    id: 'leg-thump',
    instrumentName: 'Leg thump',
    moduloValue: 2,
    filename: 'perc-2-leg-thump.wav',
    publicPath: '/sounds/percussion/perc-2-leg-thump.wav',
    recordingTip: 'Deep, resonant palm-on-leg thump percussion pulse.',
  },
  'lip-pop': {
    id: 'lip-pop',
    instrumentName: 'Lip pop',
    moduloValue: 3,
    filename: 'perc-3-lip-pop.wav',
    publicPath: '/sounds/percussion/perc-3-lip-pop.wav',
    recordingTip: 'Plosive, hollow lip-pop background rhythm.',
  },
  sneeze: {
    id: 'sneeze',
    instrumentName: 'Sneeze',
    moduloValue: 4,
    filename: 'perc-4-sneeze.wav',
    publicPath: '/sounds/percussion/perc-4-sneeze.wav',
    recordingTip: 'Rhythmic percussive sneeze accent.',
  },
  'tongue-click': {
    id: 'tongue-click',
    instrumentName: 'Tongue click',
    moduloValue: 5,
    filename: 'perc-5-tongue-click.wav',
    publicPath: '/sounds/percussion/perc-5-tongue-click.wav',
    recordingTip: 'Sharp palatal tongue-click percussion beat.',
  },
};

export const ALL_PERCUSSION_SPECS: PercussionInstrumentSpec[] = [
  SIX_PERCUSSION_INSTRUMENTS['snap'],
  SIX_PERCUSSION_INSTRUMENTS['clap'],
  SIX_PERCUSSION_INSTRUMENTS['leg-thump'],
  SIX_PERCUSSION_INSTRUMENTS['lip-pop'],
  SIX_PERCUSSION_INSTRUMENTS['sneeze'],
  SIX_PERCUSSION_INSTRUMENTS['tongue-click'],
];

/**
 * Exact P = S % 6 lookup table from Step 6 of the brief:
 *   0 -> Snap
 *   1 -> Clap
 *   2 -> Leg thump
 *   3 -> Lip pop
 *   4 -> Sneeze
 *   5 -> Tongue click
 */
export const PERCUSSION_BY_MODULO_6: Record<number, PercussionInstrumentSpec> = {
  0: SIX_PERCUSSION_INSTRUMENTS['snap'],
  1: SIX_PERCUSSION_INSTRUMENTS['clap'],
  2: SIX_PERCUSSION_INSTRUMENTS['leg-thump'],
  3: SIX_PERCUSSION_INSTRUMENTS['lip-pop'],
  4: SIX_PERCUSSION_INSTRUMENTS['sneeze'],
  5: SIX_PERCUSSION_INSTRUMENTS['tongue-click'],
};

export function getPercussionForModulo(p: number): PercussionInstrumentSpec {
  const normalized = ((p % 6) + 6) % 6;
  return PERCUSSION_BY_MODULO_6[normalized];
}

// ─── Step 7 & 8: Six Preloaded Musical Themes & Modulo-6 (M = G % 6) ─────────

export const DEFAULT_INSTRUMENTAL_STYLE_ID: InstrumentalStyleId = 'pop';

export const SIX_INSTRUMENTAL_STYLES: Record<
  InstrumentalStyleId,
  InstrumentalStyleSpec
> = {
  pop: {
    id: 'pop',
    moduloValue: 0,
    styleName: 'Pop',
    tagline: 'Contemporary melodic groove · Keyboard, Bass & Clean Guitar',
    instruments: [
      'Electric Keyboard',
      'Pop Electric Bass',
      'Clean Electric Guitar',
    ],
    arrangementDescription:
      'Contemporary, melodic accompaniment with simple chord progressions, warm keyboard voicings, steady bass groove, and clean guitar arpeggio textures.',
    harmonyApproach:
      'Uses open, consonant contemporary chord progressions (Csus2 / G5 / Fsus2) that adapt cleanly to the active time signature without clashing with the foreground sounds.',
    samples: {
      primary: {
        sampleId: 'pop-keys',
        instrumentLabel: 'Pop Electric Keyboard',
        filename: 'pop-keys.wav',
        publicPath: '/sounds/accompaniment/pop-keys.wav',
      },
      bassOrDrone: {
        sampleId: 'pop-bass',
        instrumentLabel: 'Pop Electric Bass',
        filename: 'pop-bass.wav',
        publicPath: '/sounds/accompaniment/pop-bass.wav',
      },
      textureOrAccent: {
        sampleId: 'pop-guitar',
        instrumentLabel: 'Clean Electric Guitar Strum',
        filename: 'pop-guitar.wav',
        publicPath: '/sounds/accompaniment/pop-guitar.wav',
      },
    },
  },
  jazz: {
    id: 'jazz',
    moduloValue: 1,
    styleName: 'Jazz',
    tagline: 'Richer 7th harmonies & swing · Jazz Piano, Upright Bass & Guitar',
    instruments: [
      'Jazz Piano (Seventh Chords)',
      'Upright Acoustic Walking Bass',
      'Warm Hollow-Body Jazz Guitar',
    ],
    arrangementDescription:
      'Richer harmonies and seventh chords featuring walking acoustic bass, swung piano comping, and warm jazz guitar syncopations.',
    harmonyApproach:
      'Uses lush 7th and 9th shell voicings with walking bass motion that outlines each bar of the name-derived time signature.',
    samples: {
      primary: {
        sampleId: 'jazz-piano',
        instrumentLabel: 'Jazz Piano Voicing',
        filename: 'jazz-piano.wav',
        publicPath: '/sounds/accompaniment/jazz-piano.wav',
      },
      bassOrDrone: {
        sampleId: 'jazz-bass',
        instrumentLabel: 'Upright Walking Bass',
        filename: 'jazz-bass.wav',
        publicPath: '/sounds/accompaniment/jazz-bass.wav',
      },
      textureOrAccent: {
        sampleId: 'jazz-guitar',
        instrumentLabel: 'Soft Jazz Guitar Comp',
        filename: 'jazz-guitar.wav',
        publicPath: '/sounds/accompaniment/jazz-guitar.wav',
      },
    },
  },
  rock: {
    id: 'rock',
    moduloValue: 2,
    styleName: 'Rock',
    tagline: 'Driving groove & strong attacks · Power-Chord Guitar & Bass',
    instruments: [
      'Overdriven Power-Chord Electric Guitar',
      'Driving Picked Bass Guitar',
      'Rock Rhythm Guitar',
    ],
    arrangementDescription:
      'Electric guitar, driving bass, and energetic rhythmic backing with strong attacks on group accents and punchy power-chord textures.',
    harmonyApproach:
      'Uses punchy root-fifth power chords (C5 / G5 / F5) locked tightly to the bar downbeats and subgroup accents of the time signature.',
    samples: {
      primary: {
        sampleId: 'rock-guitar',
        instrumentLabel: 'Power-Chord Electric Guitar',
        filename: 'rock-guitar.wav',
        publicPath: '/sounds/accompaniment/rock-guitar.wav',
      },
      bassOrDrone: {
        sampleId: 'rock-bass',
        instrumentLabel: 'Picked Rock Bass Guitar',
        filename: 'rock-bass.wav',
        publicPath: '/sounds/accompaniment/rock-bass.wav',
      },
      textureOrAccent: {
        sampleId: 'rock-accent',
        instrumentLabel: 'Rock Rhythm Guitar Chord',
        filename: 'rock-accent.wav',
        publicPath: '/sounds/accompaniment/rock-accent.wav',
      },
    },
  },
  classical: {
    id: 'classical',
    moduloValue: 3,
    styleName: 'Classical',
    tagline: 'Western chamber orchestra · Strings, Cello & Concert Piano',
    instruments: [
      'Chamber Strings Ensemble',
      'Orchestral Cello & Contrabass',
      'Classical Concert Piano',
    ],
    arrangementDescription:
      'Western classical chamber accompaniment with sustained orchestral string swells, warm cello bass, and delicate concert piano arpeggios.',
    harmonyApproach:
      'Uses balanced orchestral string voicings and dynamic swells shaped across each bar of the name-derived time signature.',
    samples: {
      primary: {
        sampleId: 'classical-strings',
        instrumentLabel: 'Chamber Strings Swell',
        filename: 'classical-strings.wav',
        publicPath: '/sounds/accompaniment/classical-strings.wav',
      },
      bassOrDrone: {
        sampleId: 'classical-cello',
        instrumentLabel: 'Orchestral Cello Bass',
        filename: 'classical-cello.wav',
        publicPath: '/sounds/accompaniment/classical-cello.wav',
      },
      textureOrAccent: {
        sampleId: 'classical-piano',
        instrumentLabel: 'Classical Concert Piano',
        filename: 'classical-piano.wav',
        publicPath: '/sounds/accompaniment/classical-piano.wav',
      },
    },
  },
  reggae: {
    id: 'reggae',
    moduloValue: 4,
    styleName: 'Reggae',
    tagline: 'Offbeat guitar/keys skank · Rounded Bass & Spacious Groove',
    instruments: [
      'Offbeat Clean Guitar & Keyboard Skank',
      'Rounded Dub Sub-Bass',
      'Warm Reggae Organ',
    ],
    arrangementDescription:
      'Relaxed, spacious rhythmic arrangement featuring a warm, rounded bass line on primary pulses and crisp offbeat guitar/keyboard skank accents.',
    harmonyApproach:
      'Places short, percussive chord chops on offbeats and weak subdivisions of the time signature, leaving generous breathing room for the foreground sounds.',
    samples: {
      primary: {
        sampleId: 'reggae-skank',
        instrumentLabel: 'Offbeat Guitar/Keys Chop',
        filename: 'reggae-skank.wav',
        publicPath: '/sounds/accompaniment/reggae-skank.wav',
      },
      bassOrDrone: {
        sampleId: 'reggae-bass',
        instrumentLabel: 'Rounded Reggae Bass',
        filename: 'reggae-bass.wav',
        publicPath: '/sounds/accompaniment/reggae-bass.wav',
      },
      textureOrAccent: {
        sampleId: 'reggae-organ',
        instrumentLabel: 'Warm Reggae Organ Bubble',
        filename: 'reggae-organ.wav',
        publicPath: '/sounds/accompaniment/reggae-organ.wav',
      },
    },
  },
  'indian-carnatic': {
    id: 'indian-carnatic',
    moduloValue: 5,
    styleName: 'Indian Carnatic',
    tagline: 'Sustained Tanpura Sa–Pa Drone · Saraswati Veena, Violin & Venu Flute',
    instruments: [
      'Tambura / Tanpura Drone (Sa–Pa–Sa)',
      'Saraswati Veena',
      'Carnatic Violin & Venu Bamboo Flute',
    ],
    arrangementDescription:
      'Sustained tanpura-style drone anchored to the reference Sa (C4 = 261.63 Hz) with melodic support from Saraswati Veena, Carnatic violin, and Venu bamboo flute.',
    harmonyApproach:
      'Respects the Sa–Pa modal framework without forcing Western chord progressions, accenting tala subgroup starts with Veena and Venu flute phrases.',
    samples: {
      primary: {
        sampleId: 'carnatic-veena',
        instrumentLabel: 'Saraswati Veena Pluck',
        filename: 'carnatic-veena.wav',
        publicPath: '/sounds/accompaniment/carnatic-veena.wav',
      },
      bassOrDrone: {
        sampleId: 'carnatic-tanpura',
        instrumentLabel: 'Tanpura Sa–Pa–Sa Drone',
        filename: 'carnatic-tanpura.wav',
        publicPath: '/sounds/accompaniment/carnatic-tanpura.wav',
      },
      textureOrAccent: {
        sampleId: 'carnatic-flute',
        instrumentLabel: 'Carnatic Venu Flute & Violin',
        filename: 'carnatic-flute.wav',
        publicPath: '/sounds/accompaniment/carnatic-flute.wav',
      },
    },
  },
};

export const ALL_INSTRUMENTAL_STYLES: InstrumentalStyleSpec[] = [
  SIX_INSTRUMENTAL_STYLES['pop'],
  SIX_INSTRUMENTAL_STYLES['jazz'],
  SIX_INSTRUMENTAL_STYLES['rock'],
  SIX_POSITION_ORDERED_STYLES(),
].flat();

function SIX_POSITION_ORDERED_STYLES(): InstrumentalStyleSpec[] {
  return [
    SIX_INSTRUMENTAL_STYLES['classical'],
    SIX_INSTRUMENTAL_STYLES['reggae'],
    SIX_INSTRUMENTAL_STYLES['indian-carnatic'],
  ];
}

/**
 * Exact M = G % 6 lookup table from Step 8 of the brief:
 *   0 -> Pop
 *   1 -> Jazz
 *   2 -> Rock
 *   3 -> Classical
 *   4 -> Reggae
 *   5 -> Indian Carnatic
 */
export const THEME_BY_MODULO_6: Record<number, InstrumentalStyleSpec> = {
  0: SIX_INSTRUMENTAL_STYLES['pop'],
  1: SIX_INSTRUMENTAL_STYLES['jazz'],
  2: SIX_INSTRUMENTAL_STYLES['rock'],
  3: SIX_INSTRUMENTAL_STYLES['classical'],
  4: SIX_INSTRUMENTAL_STYLES['reggae'],
  5: SIX_INSTRUMENTAL_STYLES['indian-carnatic'],
};

export function getSuggestedThemeForModulo(m: number): InstrumentalStyleSpec {
  const normalized = ((m % 6) + 6) % 6;
  return THEME_BY_MODULO_6[normalized];
}

export const ALL_ACCOMPANIMENT_SAMPLES: StyleSampleSpec[] =
  ALL_INSTRUMENTAL_STYLES.flatMap((style) => [
    style.samples.primary,
    style.samples.bassOrDrone,
    style.samples.textureOrAccent,
  ]);

export function getInstrumentalStyleById(
  id: InstrumentalStyleId
): InstrumentalStyleSpec {
  return SIX_INSTRUMENTAL_STYLES[id] ?? SIX_INSTRUMENTAL_STYLES.pop;
}
