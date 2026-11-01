/**
 * src/audio/audioSequencer.ts
 * ---------------------------
 * Builds the BPM-synchronized Three-Layer timeline required by the Updated
 * Antigravity Brief:
 *   - Layer 1 (Foreground): The ordered sequence of 27 mapped sounds (0 = Snap .. 26 = Rubbing palms together)
 *   - Layer 2 (Percussion): The name-selected repeating percussion sound (P = S % 6),
 *     organized around the name-derived Time Signature (T = S % 6: 3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
 *   - Layer 3 (Instrumental Accompaniment): The currently selected musical theme
 *     (Pop, Jazz, Rock, Classical, Reggae, Indian Carnatic — suggested via M = G % 6
 *     by default, or manually overridden by the user)
 *
 * Changing the theme changes only the accompaniment. Changing the tempo changes
 * timing only. Replacing a sound changes the audio associated with that number only.
 */

import {
  DEFAULT_BPM,
  getInstrumentalStyleById,
  getPulseDefinitionForTimeSignature,
  getStepDurationForTimeSignature,
  MAX_BPM,
  MIN_BPM,
  SIX_TIME_SIGNATURES,
} from '../engine/config';
import type {
  InstrumentalStyleId,
  NameConversionResult,
  TimeSignatureSpec,
} from '../engine/types';
import type {
  AccompanimentSubEvent,
  ContinuousTimeline,
  NumberSoundAsset,
  ScheduledStepEvent,
} from './types';

export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return DEFAULT_BPM;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

/**
 * Computes the bar, beat, subgroup, and background percussion accent parameters
 * for a given 0-based `globalStepIndex` under a `TimeSignatureSpec` (`3/4`,
 * `4/4`, `5/4`, `6/8`, `7/8`, or `12/8`).
 */
export function getTimeSignatureBeatForStep(
  globalStepIndex: number,
  timeSig: TimeSignatureSpec = SIX_TIME_SIGNATURES['4/4']
): {
  barNumber: number;
  beatInBar: number;
  beatsPerBar: number;
  groupIndexInBar: number;
  beatInGroup: number;
  groupSize: number;
  isGroupStart: boolean;
  percussionHit: boolean;
  percussionAccent: number;
} {
  const beatsPerBar = timeSig.beatsPerBar;
  const barNumber = Math.floor(globalStepIndex / beatsPerBar) + 1;
  const beatIndexInBar = globalStepIndex % beatsPerBar;
  const beatInBar = beatIndexInBar + 1;

  // Determine which subgroup in timeSig.groupSizes this beat falls into
  let cumulative = 0;
  let groupIndexInBar = 1;
  let beatInGroup = 1;
  let groupSize = timeSig.groupSizes[0] ?? 1;
  let isGroupStart = beatIndexInBar === 0;

  for (let g = 0; g < timeSig.groupSizes.length; g++) {
    const size = timeSig.groupSizes[g];
    if (beatIndexInBar >= cumulative && beatIndexInBar < cumulative + size) {
      groupIndexInBar = g + 1;
      beatInGroup = beatIndexInBar - cumulative + 1;
      groupSize = size;
      isGroupStart = beatInGroup === 1;
      break;
    }
    cumulative += size;
  }

  const percussionAccent =
    timeSig.accentPattern[beatIndexInBar] ?? (isGroupStart ? 0.8 : 0.5);

  return {
    barNumber,
    beatInBar,
    beatsPerBar,
    groupIndexInBar,
    beatInGroup,
    groupSize,
    isGroupStart,
    percussionHit: true,
    percussionAccent,
  };
}

/**
 * Computes a consonant harmonic root multiplier (`1.0` = C/Sa, `1.12246` = D,
 * `1.33484` = F, `1.49831` = G) that progresses smoothly across bars.
 */
function getConsonantSupportRate(
  stepNumber: number,
  barIndex: number
): number {
  const pitchClass = stepNumber % 12;
  if (pitchClass === 7 || pitchClass === 2) {
    return barIndex % 2 === 0 ? 1.0 : 1.12246;
  }
  if (pitchClass === 5) {
    return 1.33484;
  }
  const progression = [1.0, 1.0, 1.12246, 0.8909];
  return progression[barIndex % progression.length];
}

/**
 * Generates the Layer 3 Instrumental Accompaniment sub-events for a single step
 * according to the active musical theme (`pop`, `jazz`, `rock`, `classical`,
 * `reggae`, or `indian-carnatic`) and the name-derived `TimeSignatureSpec`.
 */
export function getAccompanimentEventsForStep(
  globalStepIndex: number,
  beatInBar: number,
  stepNumber: number,
  styleId: InstrumentalStyleId,
  timeSig: TimeSignatureSpec = SIX_TIME_SIGNATURES['4/4']
): {
  events: AccompanimentSubEvent[];
  summary: string;
} {
  const barIndex = Math.floor(globalStepIndex / timeSig.beatsPerBar);
  const supportRate = getConsonantSupportRate(stepNumber, barIndex);
  const styleSpec = getInstrumentalStyleById(styleId);
  const { primary, bassOrDrone, textureOrAccent } = styleSpec.samples;

  const beatMeta = getTimeSignatureBeatForStep(globalStepIndex, timeSig);
  const isDownbeat = beatInBar === 1;
  const isSubgroupAccent = !isDownbeat && beatMeta.isGroupStart && timeSig.groupSizes.length > 1;
  // For simple meters (3/4, 4/4) where groupSizes are [1,1,1] or [1,1,1,1], treat Beat 3 of 4/4 as secondary accent
  const isSecondaryStrongBeat =
    isSubgroupAccent || (timeSig.id === '4/4' && beatInBar === 3);

  switch (styleId) {
    case 'pop': {
      if (isDownbeat) {
        return {
          events: [
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.5,
              gain: 0.72,
              playbackRate: supportRate,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.1,
              gain: 0.85,
              playbackRate: supportRate,
            },
          ],
          summary: `Pop Keyboard Chord + Electric Bass (${timeSig.id} Bar Downbeat 1/${timeSig.beatsPerBar})`,
        };
      }
      if (isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.35,
              gain: 0.66,
              playbackRate: supportRate,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 0.9,
              gain: 0.8,
              playbackRate: supportRate * 1.12246,
            },
          ],
          summary: `Pop Keyboard + Subgroup Bass Pulse (Beat ${beatInBar}/${timeSig.beatsPerBar} · Group #${beatMeta.groupIndexInBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 1.05,
            gain: 0.72,
            playbackRate: supportRate,
          },
        ],
        summary: `Clean Electric Guitar Strum (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }

    case 'jazz': {
      const walkingScale = [1.0, 1.12246, 1.25992, 1.33484, 1.49831, 1.33484, 1.12246];
      const bassWalkRate = walkingScale[(beatInBar - 1) % walkingScale.length];

      if (isDownbeat) {
        return {
          events: [
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 0.95,
              gain: 0.82,
              playbackRate: bassWalkRate,
            },
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.35,
              gain: 0.72,
              playbackRate: supportRate,
            },
            {
              sampleId: textureOrAccent.sampleId,
              instrumentLabel: textureOrAccent.instrumentLabel,
              offsetRatio: 0.62,
              durationScale: 0.75,
              gain: 0.6,
              playbackRate: supportRate,
            },
          ],
          summary: `Walking Upright Bass + Jazz Piano 7th Chord (${timeSig.id} Beat 1/${timeSig.beatsPerBar})`,
        };
      }
      if (isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 0.95,
              gain: 0.8,
              playbackRate: bassWalkRate,
            },
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.58,
              durationScale: 1.15,
              gain: 0.7,
              playbackRate: supportRate,
            },
          ],
          summary: `Walking Bass + Swung Jazz Piano Comp (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: bassOrDrone.sampleId,
            instrumentLabel: bassOrDrone.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 0.92,
            gain: 0.76,
            playbackRate: bassWalkRate,
          },
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: beatInBar % 2 === 0 ? 0.0 : 0.62,
            durationScale: 0.8,
            gain: 0.62,
            playbackRate: supportRate,
          },
        ],
        summary: `Walking Upright Bass + Jazz Guitar Syncopation (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }

    case 'rock': {
      const rockRoot = barIndex % 2 === 0 ? 1.0 : 0.8909;
      if (isDownbeat || isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.4,
              gain: isDownbeat ? 0.84 : 0.76,
              playbackRate: isDownbeat ? rockRoot : supportRate,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 0.55,
              gain: 0.85,
              playbackRate: rockRoot,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.5,
              durationScale: 0.5,
              gain: 0.74,
              playbackRate: rockRoot,
            },
          ],
          summary: `Power-Chord Electric Guitar + Driving Rock Bass (${timeSig.id} Accent Beat ${beatInBar}/${timeSig.beatsPerBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 0.75,
            gain: 0.72,
            playbackRate: supportRate,
          },
          {
            sampleId: bassOrDrone.sampleId,
            instrumentLabel: bassOrDrone.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 0.55,
            gain: 0.8,
            playbackRate: rockRoot,
          },
        ],
        summary: `Rock Rhythm Guitar + Picked Bass Chug (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }

    case 'classical': {
      if (isDownbeat) {
        return {
          events: [
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.95,
              gain: 0.8,
              playbackRate: 1.0,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.75,
              gain: 0.82,
              playbackRate: 1.0,
            },
          ],
          summary: `Chamber Strings Swell + Orchestral Cello (${timeSig.id} Downbeat 1/${timeSig.beatsPerBar})`,
        };
      }
      if (isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.75,
              gain: 0.74,
              playbackRate: supportRate,
            },
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.45,
              gain: 0.74,
              playbackRate: supportRate,
            },
          ],
          summary: `Chamber Strings Counter-Swell + Cello (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 1.15,
            gain: 0.68,
            playbackRate: supportRate,
          },
        ],
        summary: `Classical Concert Piano Arpeggio (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }

    case 'reggae': {
      if (isDownbeat) {
        return {
          events: [
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.15,
              gain: 0.9,
              playbackRate: 1.0,
            },
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.5,
              durationScale: 0.48,
              gain: 0.82,
              playbackRate: supportRate,
            },
          ],
          summary: `Rounded Reggae Sub-Bass + Offbeat Skank (${timeSig.id} Beat 1/${timeSig.beatsPerBar})`,
        };
      }
      if (isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 0.88,
              gain: 0.85,
              playbackRate: 0.74915,
            },
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.5,
              durationScale: 0.48,
              gain: 0.8,
              playbackRate: supportRate,
            },
          ],
          summary: `Reggae Bass Drop + Offbeat Guitar/Keys Chop (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: primary.sampleId,
            instrumentLabel: primary.instrumentLabel,
            offsetRatio: 0.5,
            durationScale: 0.48,
            gain: 0.84,
            playbackRate: supportRate,
          },
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: 0.5,
            durationScale: 0.5,
            gain: 0.66,
            playbackRate: supportRate,
          },
        ],
        summary: `Offbeat Reggae Skank + Warm Organ Bubble (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }

    case 'indian-carnatic':
    default: {
      const carnaticConsonantRate = stepNumber % 12 === 7 ? 1.49831 : 1.0;

      if (isDownbeat || isSecondaryStrongBeat) {
        return {
          events: [
            {
              sampleId: bassOrDrone.sampleId,
              instrumentLabel: bassOrDrone.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 2.25,
              gain: 0.84,
              playbackRate: 1.0, // Always anchored to Reference Sa (C4 = 261.63 Hz)
            },
            {
              sampleId: primary.sampleId,
              instrumentLabel: primary.instrumentLabel,
              offsetRatio: 0.0,
              durationScale: 1.38,
              gain: isDownbeat ? 0.78 : 0.72,
              playbackRate: carnaticConsonantRate,
            },
          ],
          summary: `Tanpura Sa–Pa–Sa Drone + Saraswati Veena Pluck (${timeSig.id} Tala Accent ${beatInBar}/${timeSig.beatsPerBar})`,
        };
      }
      return {
        events: [
          {
            sampleId: textureOrAccent.sampleId,
            instrumentLabel: textureOrAccent.instrumentLabel,
            offsetRatio: 0.0,
            durationScale: 1.28,
            gain: 0.68,
            playbackRate: carnaticConsonantRate,
          },
        ],
        summary: `Sustained Tanpura Drone + Carnatic Venu Flute & Violin (Beat ${beatInBar}/${timeSig.beatsPerBar})`,
      };
    }
  }
}

/**
 * Builds the complete BPM-synchronized timeline from a `NameConversionResult`,
 * the current `NumberSoundAsset[]` manifest, the user-selected `bpm`, and the
 * active `selectedStyleId` (which defaults to `conversion.suggestedTheme.id`).
 */
export function buildContinuousTimeline(
  conversion: NameConversionResult,
  manifest: NumberSoundAsset[],
  bpm: number = DEFAULT_BPM,
  selectedStyleId?: InstrumentalStyleId
): ContinuousTimeline {
  const safeBpm = clampBpm(bpm);
  const timeSig = conversion.selectedTimeSignature;
  const activeStyleId = selectedStyleId ?? conversion.suggestedTheme.id;
  const styleSpec = getInstrumentalStyleById(activeStyleId);

  const stepDurationSeconds = getStepDurationForTimeSignature(timeSig, safeBpm);
  const pulseDefinition = getPulseDefinitionForTimeSignature(timeSig, safeBpm);

  const assetByNumber = new Map<number, NumberSoundAsset>(
    manifest.map((a) => [a.number, a])
  );

  const events: ScheduledStepEvent[] = conversion.orderedSteps.map((step) => {
    const asset = assetByNumber.get(step.number);
    const hasRecording = asset?.status === 'loaded';

    const startTimeSeconds = Number(
      (step.globalStepIndex * stepDurationSeconds).toFixed(4)
    );
    const endTimeSeconds = Number(
      ((step.globalStepIndex + 1) * stepDurationSeconds).toFixed(4)
    );

    const beatMeta = getTimeSignatureBeatForStep(
      step.globalStepIndex,
      timeSig
    );

    const { events: accompanimentEvents, summary: accompanimentSummary } =
      getAccompanimentEventsForStep(
        step.globalStepIndex,
        beatMeta.beatInBar,
        step.number,
        activeStyleId,
        timeSig
      );

    return {
      globalStepIndex: step.globalStepIndex,
      letterIndex: step.letterIndex,
      letter: step.letter,
      alphabetValue: step.alphabetValue,
      stepIndexInLetter: step.stepIndexInLetter,
      number: step.number,
      soundName: step.soundName,
      filename: step.filename,
      startTimeSeconds,
      endTimeSeconds,
      stepDurationSeconds,
      barNumber: beatMeta.barNumber,
      beatInBar: beatMeta.beatInBar,
      beatsPerBar: beatMeta.beatsPerBar,
      groupIndexInBar: beatMeta.groupIndexInBar,
      beatInGroup: beatMeta.beatInGroup,
      groupSize: beatMeta.groupSize,
      isGroupStart: beatMeta.isGroupStart,
      percussionHit: beatMeta.percussionHit,
      percussionAccent: beatMeta.percussionAccent,
      accompanimentEvents,
      accompanimentSummary,
      hasRecording,
    };
  });

  const totalSteps = events.length;
  const totalDurationSeconds = Number(
    (totalSteps * stepDurationSeconds).toFixed(4)
  );

  return {
    events,
    totalSteps,
    bpm: safeBpm,
    pulseDefinition,
    stepDurationSeconds,
    totalDurationSeconds,
    timeSignatureId: timeSig.id,
    beatsPerBar: timeSig.beatsPerBar,
    groupingLabel: timeSig.groupingLabel,
    selectedPercussionId: conversion.selectedPercussion.id,
    selectedPercussionName: conversion.selectedPercussion.instrumentName,
    suggestedStyleId: conversion.suggestedTheme.id,
    suggestedStyleName: conversion.suggestedTheme.styleName,
    selectedStyleId: styleSpec.id,
    selectedStyleName: styleSpec.styleName,
  };
}

/**
 * Finds the active `ScheduledStepEvent` at `currentTimeSeconds`.
 */
export function findActiveEventAtTime(
  timeline: ContinuousTimeline,
  currentTimeSeconds: number
): ScheduledStepEvent | null {
  if (
    timeline.events.length === 0 ||
    currentTimeSeconds < 0 ||
    currentTimeSeconds > timeline.totalDurationSeconds
  ) {
    return null;
  }

  const approxIdx = Math.floor(
    currentTimeSeconds / timeline.stepDurationSeconds
  );
  if (approxIdx >= 0 && approxIdx < timeline.events.length) {
    return timeline.events[approxIdx];
  }

  if (Math.abs(currentTimeSeconds - timeline.totalDurationSeconds) < 0.02) {
    return timeline.events[timeline.events.length - 1];
  }

  return null;
}
