/**
 * src/audio/types.ts
 * ------------------
 * Audio & manifest types for the Updated Antigravity Brief:
 *   - Layer 1 (Foreground): 27 preloaded & replaceable number sounds (0 = Snap .. 26 = Rubbing palms together)
 *   - Layer 2 (Percussion): 6 preloaded background percussion sounds selected via P = S % 6
 *   - Layer 3 (Instrumental Accompaniment): 6 preloaded musical themes suggested via
 *     G = sum(i * x_i), M = G % 6 (with manual override)
 *   - Time Signature Bar & Beat Grouping structure derived via T = S % 6
 *     (3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
 */

import type {
  InstrumentalStyleId,
  PercussionInstrumentId,
  TimeSignatureId,
} from '../engine/types';

export type AssetStatus = 'pending' | 'loaded' | 'missing' | 'error';

export interface NumberSoundAsset {
  /** Number 0 through 26 */
  number: number;
  /** Default sound name, e.g. "Snap", "Clap", ..., "Rubbing palms together" */
  soundName: string;
  /** Expected filename in `/public/sounds/`, e.g. "00-snap.wav" */
  filename: string;
  /** Public URL path, e.g. "/sounds/00-snap.wav" */
  publicPath: string;
  /** Short recording tip */
  recordingTip: string;
  /** Current status of the recording */
  status: AssetStatus;
  /** Duration of the loaded audio buffer in seconds (if loaded) */
  durationSeconds?: number;
  /** Where the recording came from */
  sourceNote?: string;
  /** Detailed error message if HTTP fetch or .m4a AAC decoding fails */
  errorMessage?: string;
  /** True when a user-recorded custom override is active instead of the preloaded default */
  isCustom?: boolean;
}

export interface PercussionSoundAsset {
  /** Unique ID of one of the 6 percussion instruments */
  id: PercussionInstrumentId;
  /** Display name: Snap, Clap, Leg thump, Lip pop, Sneeze, Tongue click */
  instrumentName: string;
  /** Modulo-6 value P = S % 6 (0..5) */
  moduloValue: number;
  /** Filename in `/public/sounds/percussion/` */
  filename: string;
  /** Public URL path */
  publicPath: string;
  /** Recording tip */
  recordingTip: string;
  /** Current status of the recording */
  status: AssetStatus;
  /** Duration of the loaded audio buffer in seconds (if loaded) */
  durationSeconds?: number;
  /** Where the recording came from */
  sourceNote?: string;
  /** Detailed error message if HTTP fetch or .m4a AAC decoding fails */
  errorMessage?: string;
  /** True when a user-recorded custom override is active instead of the preloaded default */
  isCustom?: boolean;
}

export interface AccompanimentSoundAsset {
  /** Unique sample ID, e.g. "pop-keys", "carnatic-tanpura" */
  sampleId: string;
  /** Style ID that owns this sample */
  styleId: InstrumentalStyleId;
  /** Human-readable instrument role, e.g. "Tanpura Sa–Pa–Sa Drone" */
  instrumentLabel: string;
  /** Filename in `/public/sounds/accompaniment/` */
  filename: string;
  /** Public URL path */
  publicPath: string;
  /** Current status of the sample */
  status: AssetStatus;
  /** Duration of the loaded audio buffer in seconds */
  durationSeconds?: number;
}

export interface AccompanimentSubEvent {
  /** Sample ID in the accompaniment library (e.g. "reggae-skank", "carnatic-tanpura") */
  sampleId: string;
  /** Instrument label for visual explanation (e.g. "Offbeat Guitar/Keys Chop") */
  instrumentLabel: string;
  /** Fractional offset within the step (0.0 = on the beat, 0.5 = 8th-note offbeat) */
  offsetRatio: number;
  /** Duration multiplier relative to stepDurationSeconds */
  durationScale: number;
  /** Relative gain for this accompaniment voice */
  gain: number;
  /** Pitch playback rate (1.0 = reference pitch; Indian Carnatic drone stays at 1.0) */
  playbackRate: number;
}

export interface ScheduledStepEvent {
  /** 0-based index across the entire name's continuous composition */
  globalStepIndex: number;
  /** 0-based index of the letter in the normalized name */
  letterIndex: number;
  /** The uppercase letter (A–Z) */
  letter: string;
  /** Alphabet position of the letter (1–26) */
  alphabetValue: number;
  /** 0-based step index inside this letter's Fibonacci-modulo sequence */
  stepIndexInLetter: number;
  /** The Fibonacci-modulo number (0..25) that triggers its sound */
  number: number;
  /** Sound name (e.g. 0 -> "Snap") */
  soundName: string;
  /** Filename for the sound */
  filename: string;
  /** Exact start time (seconds) at the current BPM */
  startTimeSeconds: number;
  /** Exact end time (seconds) of this step slot at the current BPM */
  endTimeSeconds: number;
  /** Step duration (seconds) */
  stepDurationSeconds: number;
  /** 1-based bar number in the name-derived time signature */
  barNumber: number;
  /** 1-based beat inside the current bar (1..beatsPerBar) */
  beatInBar: number;
  /** Total beats per bar for the active time signature (3, 4, 5, 6, 7, or 12) */
  beatsPerBar: number;
  /** 1-based subgroup index within the bar (e.g. 1, 2, or 3 for 2+2+3 in 7/8) */
  groupIndexInBar: number;
  /** 1-based beat index within the current subgroup */
  beatInGroup: number;
  /** Size of the current subgroup (e.g. 2 or 3) */
  groupSize: number;
  /** True if this beat starts a new metric subgroup (accented pulse) */
  isGroupStart: boolean;
  /** True if the Layer 2 background percussion pattern strikes on this step */
  percussionHit: boolean;
  /** Relative accent level of the percussion hit (1.0 on downbeat, ~0.8 on subgroup starts, ~0.48 on weak beats) */
  percussionAccent: number;
  /** Layer 3 instrumental accompaniment sub-events scheduled within this step */
  accompanimentEvents: AccompanimentSubEvent[];
  /** Human-readable summary of Layer 3 instruments active on this beat */
  accompanimentSummary: string;
  /** True if the recording for `number` is loaded */
  hasRecording: boolean;
}

export interface ContinuousTimeline {
  events: ScheduledStepEvent[];
  totalSteps: number;
  bpm: number;
  pulseDefinition: string;
  stepDurationSeconds: number;
  totalDurationSeconds: number;
  timeSignatureId: TimeSignatureId;
  beatsPerBar: number;
  groupingLabel: string;
  selectedPercussionId: PercussionInstrumentId;
  selectedPercussionName: string;
  suggestedStyleId: InstrumentalStyleId;
  suggestedStyleName: string;
  selectedStyleId: InstrumentalStyleId;
  selectedStyleName: string;
}

export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped';

export interface PlayerStatus {
  state: PlayerState;
  bpm: number;
  currentTime: number;
  totalDuration: number;
  progressPercent: number;
  /** Layer 1: Main foreground sound volume (0.0 to 1.0) */
  mainVolume: number;
  isMainMuted: boolean;
  /** Layer 2: Background percussion volume (0.0 to 1.0) */
  percussionVolume: number;
  isPercussionMuted: boolean;
  /** Layer 3: Instrumental accompaniment volume (0.0 to 1.0) */
  accompanimentVolume: number;
  isAccompanimentMuted: boolean;
  /** Selected Layer 3 instrumental theme ID */
  selectedStyleId: InstrumentalStyleId;
  /** Currently playing global step index across the composition (or null) */
  activeGlobalStepIndex: number | null;
  /** Currently playing letter index (or null) */
  activeLetterIndex: number | null;
  /** Currently playing step index within that letter (or null) */
  activeStepInLetter: number | null;
  /** Currently playing Fibonacci number (or null) */
  activeNumber: number | null;
  /** Currently playing sound name (or null) */
  activeSoundName: string | null;
  /** Currently active 1-based bar number (or null) */
  activeBarNumber?: number | null;
  /** Currently active beat in the time signature bar (1..beatsPerBar, or null) */
  activeBeatInBar: number | null;
  /** Currently active subgroup index in the bar (1..groupSizes.length, or null) */
  activeGroupIndexInBar?: number | null;
  /** True when the current beat is a primary/subgroup accent */
  isGroupStartActive?: boolean;
  /** True when the Layer 2 percussion beat is actively firing on this step */
  isPercussionHitActive: boolean;
  /** Summary of the Layer 3 accompaniment instruments active on the current step */
  activeAccompanimentSummary?: string | null;
  /** True while default/custom audio buffers are preloading on startup */
  isLoadingAssets?: boolean;
}
