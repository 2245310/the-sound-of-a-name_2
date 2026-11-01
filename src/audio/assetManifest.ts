/**
 * src/audio/assetManifest.ts
 * --------------------------
 * Manages all three audio asset layers for the Updated Antigravity Brief:
 *   1. Layer 1: The 27 preloaded & replaceable number sounds (0 = Snap .. 26 = Rubbing palms together)
 *   2. Layer 2: The 6 preloaded background percussion sounds (P = S % 6)
 *   3. Layer 3: The 18 preloaded instrumental accompaniment samples across the 6
 *      musical themes (Pop, Jazz, Rock, Classical, Reggae, Indian Carnatic).
 */

import {
  ALL_INSTRUMENTAL_STYLES,
  ALL_PERCUSSION_SPECS,
  ALL_SOUND_NUMBERS,
  NUMBER_SOUND_MAP,
} from '../engine/config';
import type {
  InstrumentalStyleId,
  PercussionInstrumentId,
} from '../engine/types';
import type {
  AccompanimentSoundAsset,
  NumberSoundAsset,
  PercussionSoundAsset,
} from './types';

export function createInitialSoundManifest(): NumberSoundAsset[] {
  return ALL_SOUND_NUMBERS.map((num) => {
    const spec = NUMBER_SOUND_MAP[num];
    return {
      number: spec.number,
      soundName: spec.soundName,
      filename: spec.filename,
      publicPath: spec.publicPath,
      recordingTip: spec.recordingTip,
      status: 'pending',
    };
  });
}

export function createInitialPercussionManifest(): PercussionSoundAsset[] {
  return ALL_PERCUSSION_SPECS.map((spec) => ({
    id: spec.id,
    instrumentName: spec.instrumentName,
    moduloValue: spec.moduloValue,
    filename: spec.filename,
    publicPath: spec.publicPath,
    recordingTip: spec.recordingTip,
    status: 'pending',
  }));
}

export function createInitialAccompanimentManifest(): AccompanimentSoundAsset[] {
  const assets: AccompanimentSoundAsset[] = [];
  for (const style of ALL_INSTRUMENTAL_STYLES) {
    const styleSamples = [
      style.samples.primary,
      style.samples.bassOrDrone,
      style.samples.textureOrAccent,
    ];
    for (const sample of styleSamples) {
      assets.push({
        sampleId: sample.sampleId,
        styleId: style.id,
        instrumentLabel: sample.instrumentLabel,
        filename: sample.filename,
        publicPath: sample.publicPath,
        status: 'pending',
      });
    }
  }
  return assets;
}

export interface SoundLibrarySummary {
  totalExpected: number; // 27 (0..26)
  loadedCount: number;
  missingCount: number;
  errorCount: number;
  loadedNumbers: number[];
  missingNumbers: number[];
  errorNumbers: number[];
  /** Unique numbers (0..26) required by the current name */
  requiredByName: number[];
  /** Numbers required by the current name that are loaded */
  loadedForName: number[];
  /** Numbers required by the current name that are missing */
  missingForName: number[];
  /** Whether the selected percussion instrument for the current name is loaded */
  isSelectedPercussionLoaded: boolean;
  /** Number of loaded percussion instruments out of 6 */
  loadedPercussionCount: number;
  /** Whether all 3 samples for the selected instrumental theme are loaded */
  isSelectedStyleLoaded: boolean;
  /** Number of loaded accompaniment samples out of 18 */
  loadedAccompanimentCount: number;
  /** Total accompaniment samples expected (18) */
  totalAccompanimentExpected: number;
  /** True if every number in the name, the selected percussion, and the selected theme are loaded */
  isNameReadyToPlay: boolean;
}

export function summarizeManifestForName(
  numberManifest: NumberSoundAsset[],
  percussionManifest: PercussionSoundAsset[],
  uniqueNumbersInName: number[],
  selectedPercussionId: PercussionInstrumentId,
  accompanimentManifest: AccompanimentSoundAsset[] = [],
  selectedStyleId: InstrumentalStyleId = 'pop'
): SoundLibrarySummary {
  const byNumber = new Map<number, NumberSoundAsset>(
    numberManifest.map((item) => [item.number, item])
  );

  const loadedNumbers = numberManifest
    .filter((m) => m.status === 'loaded')
    .map((m) => m.number);
  const errorNumbers = numberManifest
    .filter((m) => m.status === 'error')
    .map((m) => m.number);
  const missingNumbers = numberManifest
    .filter((m) => m.status !== 'loaded')
    .map((m) => m.number);

  const requiredByName = [...uniqueNumbersInName].sort((a, b) => a - b);
  const loadedForName = requiredByName.filter(
    (num) => byNumber.get(num)?.status === 'loaded'
  );
  const missingForName = requiredByName.filter(
    (num) => byNumber.get(num)?.status !== 'loaded'
  );

  const selectedPercAsset = percussionManifest.find(
    (p) => p.id === selectedPercussionId
  );
  const isSelectedPercussionLoaded = selectedPercAsset?.status === 'loaded';
  const loadedPercussionCount = percussionManifest.filter(
    (p) => p.status === 'loaded'
  ).length;

  const styleAssets = accompanimentManifest.filter(
    (a) => a.styleId === selectedStyleId
  );
  const isSelectedStyleLoaded =
    styleAssets.length === 0 ||
    styleAssets.every((a) => a.status === 'loaded');
  const loadedAccompanimentCount = accompanimentManifest.filter(
    (a) => a.status === 'loaded'
  ).length;

  return {
    totalExpected: numberManifest.length,
    loadedCount: loadedNumbers.length,
    missingCount: missingNumbers.length,
    errorCount: errorNumbers.length,
    loadedNumbers,
    missingNumbers,
    errorNumbers,
    requiredByName,
    loadedForName,
    missingForName,
    isSelectedPercussionLoaded,
    loadedPercussionCount,
    isSelectedStyleLoaded,
    loadedAccompanimentCount,
    totalAccompanimentExpected: accompanimentManifest.length || 18,
    isNameReadyToPlay:
      missingForName.length === 0 &&
      isSelectedPercussionLoaded &&
      isSelectedStyleLoaded,
  };
}
