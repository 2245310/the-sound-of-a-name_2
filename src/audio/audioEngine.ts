/**
 * src/audio/audioEngine.ts
 * ------------------------
 * Web Audio API Three-Layer Player, Preloader, and Editable Alaap Library
 * Manager for the Updated Antigravity Brief:
 *
 * Layer 1 — Alaap Melody:
 *   27 preloaded human-sung alaap notes (`0..26`, from `Sa` [C4, 261.63 Hz]
 *   to `Shuddh Ga, third octave` [E6, 1318.51 Hz]), replaceable with custom
 *   user recordings persisted in IndexedDB.
 *
 * Layer 2 — Name-Selected Percussion:
 *   6 preloaded percussion instruments (`Bass drum / kick`, `Snare drum`,
 *   `Hi-hat`, `Tambourine`, `Woodblock`, `Hand drum`) selected via `P = S % 7`.
 *
 * Layer 3 — Instrumental Accompaniment:
 *   6 user-selectable musical styles (`Pop`, `Jazz`, `Rock`, `Classical`,
 *   `Reggae`, `Indian Carnatic`), each with 3 dedicated preloaded instrument
 *   samples and a distinct rhythmic/harmonic arrangement synchronized to the
 *   shared BPM clock (`40–200 BPM`, default `100 BPM`).
 */

import {
  DEFAULT_BPM,
  DEFAULT_INSTRUMENTAL_STYLE_ID,
  getInstrumentalStyleById,
} from '../engine/config';
import type {
  InstrumentalStyleId,
  PercussionInstrumentId,
} from '../engine/types';
import {
  createInitialAccompanimentManifest,
  createInitialPercussionManifest,
  createInitialSoundManifest,
  summarizeManifestForName,
  type SoundLibrarySummary,
} from './assetManifest';
import {
  clampBpm,
  findActiveEventAtTime,
  getAccompanimentEventsForStep,
} from './audioSequencer';
import {
  base64ToBlob,
  blobToBase64,
  clearAllCustomSoundsInDb,
  createCustomSoundBackupBundle,
  deleteCustomSoundFromDb,
  loadAllCustomSoundsFromDb,
  saveCustomSoundToDb,
  type CustomSoundBackupBundle,
} from './customSoundStore';
import type {
  AccompanimentSoundAsset,
  ContinuousTimeline,
  NumberSoundAsset,
  PercussionSoundAsset,
  PlayerState,
  PlayerStatus,
  ScheduledStepEvent,
} from './types';

type StatusListener = (status: PlayerStatus) => void;
type ManifestListener = (
  numberManifest: NumberSoundAsset[],
  percussionManifest: PercussionSoundAsset[],
  accompanimentManifest: AccompanimentSoundAsset[]
) => void;

export class SoundOfNameAudioEngine {
  private ctx: AudioContext | null = null;
  private mainGain: GainNode | null = null;
  private percussionGain: GainNode | null = null;
  private accompanimentGain: GainNode | null = null;

  private numberManifest: NumberSoundAsset[] = createInitialSoundManifest();
  private percussionManifest: PercussionSoundAsset[] =
    createInitialPercussionManifest();
  private accompanimentManifest: AccompanimentSoundAsset[] =
    createInitialAccompanimentManifest();

  /** Active playback buffers (custom override if present, otherwise default) */
  private buffersByNumber: Map<number, AudioBuffer> = new Map();
  private buffersByPercussion: Map<PercussionInstrumentId, AudioBuffer> =
    new Map();
  private buffersByAccompaniment: Map<string, AudioBuffer> = new Map();

  /** Preloaded default buffers kept in memory for instant "Restore Default" */
  private defaultBuffersByNumber: Map<number, AudioBuffer> = new Map();
  private defaultBuffersByPercussion: Map<PercussionInstrumentId, AudioBuffer> =
    new Map();

  private timeline: ContinuousTimeline | null = null;
  private state: PlayerState = 'idle';
  private bpm: number = DEFAULT_BPM;
  private selectedStyleId: InstrumentalStyleId = DEFAULT_INSTRUMENTAL_STYLE_ID;
  private isLoadingAssets = false;

  /** Layer 1: Main foreground alaap volume (prominent by default) */
  private mainVolume = 0.92;
  private isMainMuted = false;

  /** Layer 2: Background percussion volume */
  private percussionVolume = 0.45;
  private isPercussionMuted = false;

  /** Layer 3: Instrumental accompaniment volume (balanced behind the alaap melody) */
  private accompanimentVolume = 0.42;
  private isAccompanimentMuted = false;

  private startCtxTime = 0;
  private pausedAtSeconds = 0;
  private rafId: number | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();

  private statusListeners: Set<StatusListener> = new Set();
  private manifestListeners: Set<ManifestListener> = new Set();

  /**
   * Preloads all 27 default alaap notes, all 6 percussion sounds, and all 18
   * instrumental accompaniment samples across the 6 styles, then overlays any
   * user-saved custom recordings from IndexedDB.
   */
  async loadManifestAssets(): Promise<{
    numberManifest: NumberSoundAsset[];
    percussionManifest: PercussionSoundAsset[];
    accompanimentManifest: AccompanimentSoundAsset[];
  }> {
    this.isLoadingAssets = true;
    this.notifyStatus();

    const updatedNumbers: NumberSoundAsset[] = [];

    for (const item of this.numberManifest) {
      if (this.defaultBuffersByNumber.has(item.number) && item.status === 'loaded') {
        updatedNumbers.push(item);
        continue;
      }

      try {
        const res = await fetch(item.publicPath, { cache: 'no-cache' });
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || contentType.includes('text/html')) {
          updatedNumbers.push({
            ...item,
            status: 'missing',
            errorMessage: `Missing original recording: public/sounds/${item.filename} (HTTP ${res.status})`,
            isCustom: false,
          });
          continue;
        }

        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 100) {
          updatedNumbers.push({
            ...item,
            status: 'missing',
            errorMessage: `Empty audio file: public/sounds/${item.filename}`,
            isCustom: false,
          });
          continue;
        }

        const ctx = this.ensureContext();
        try {
          const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
          const trimmed = this.trimLeadingSilence(ctx, rawBuffer);
          this.defaultBuffersByNumber.set(item.number, trimmed);
          this.buffersByNumber.set(item.number, trimmed);

          updatedNumbers.push({
            ...item,
            status: 'loaded',
            durationSeconds: Number(trimmed.duration.toFixed(3)),
            sourceNote: `Original iPhone Voice Memo (${item.filename})`,
            errorMessage: undefined,
            isCustom: false,
          });
        } catch (decodeErr) {
          const detail =
            decodeErr instanceof Error ? decodeErr.message : String(decodeErr);
          updatedNumbers.push({
            ...item,
            status: 'error',
            errorMessage: `Browser could not decode "${item.filename}" (MPEG-4 AAC .m4a: ${detail}). Recommended lossless conversion on Mac: afconvert -f WAVE -d LEI16@48000 "public/sounds/${item.filename}" "public/sounds/${item.filename.replace(/\\.m4a$/i, '.pcm.wav')}"`,
            isCustom: false,
          });
        }
      } catch (fetchErr) {
        const detail =
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        updatedNumbers.push({
          ...item,
          status: 'missing',
          errorMessage: `Could not fetch public/sounds/${item.filename}: ${detail}`,
          isCustom: false,
        });
      }
    }

    const updatedPercussion: PercussionSoundAsset[] = [];
    for (const perc of this.percussionManifest) {
      if (
        this.defaultBuffersByPercussion.has(perc.id) &&
        perc.status === 'loaded'
      ) {
        updatedPercussion.push(perc);
        continue;
      }

      try {
        const res = await fetch(perc.publicPath, { cache: 'no-cache' });
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || contentType.includes('text/html')) {
          updatedPercussion.push({ ...perc, status: 'missing', isCustom: false });
          continue;
        }

        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 100) {
          updatedPercussion.push({ ...perc, status: 'missing', isCustom: false });
          continue;
        }

        const ctx = this.ensureContext();
        const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        const trimmed = this.trimLeadingSilence(ctx, rawBuffer);
        this.defaultBuffersByPercussion.set(perc.id, trimmed);
        this.buffersByPercussion.set(perc.id, trimmed);

        updatedPercussion.push({
          ...perc,
          status: 'loaded',
          durationSeconds: Number(trimmed.duration.toFixed(3)),
          sourceNote: 'Preloaded default percussion',
          isCustom: false,
        });
      } catch {
        updatedPercussion.push({ ...perc, status: 'missing', isCustom: false });
      }
    }

    const updatedAccompaniment: AccompanimentSoundAsset[] = [];
    for (const acc of this.accompanimentManifest) {
      if (
        this.buffersByAccompaniment.has(acc.sampleId) &&
        acc.status === 'loaded'
      ) {
        updatedAccompaniment.push(acc);
        continue;
      }

      try {
        const res = await fetch(acc.publicPath, { cache: 'no-cache' });
        const contentType = res.headers.get('content-type') ?? '';
        if (!res.ok || contentType.includes('text/html')) {
          updatedAccompaniment.push({ ...acc, status: 'missing' });
          continue;
        }

        const arrayBuf = await res.arrayBuffer();
        if (arrayBuf.byteLength < 100) {
          updatedAccompaniment.push({ ...acc, status: 'missing' });
          continue;
        }

        const ctx = this.ensureContext();
        const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        this.buffersByAccompaniment.set(acc.sampleId, rawBuffer);

        updatedAccompaniment.push({
          ...acc,
          status: 'loaded',
          durationSeconds: Number(rawBuffer.duration.toFixed(3)),
        });
      } catch {
        updatedAccompaniment.push({ ...acc, status: 'missing' });
      }
    }

    this.numberManifest = updatedNumbers;
    this.percussionManifest = updatedPercussion;
    this.accompanimentManifest = updatedAccompaniment;

    await this.restoreCustomSoundsFromIndexedDb();

    this.isLoadingAssets = false;
    this.notifyManifest();
    this.notifyStatus();

    return {
      numberManifest: this.numberManifest,
      percussionManifest: this.percussionManifest,
      accompanimentManifest: this.accompanimentManifest,
    };
  }

  private async restoreCustomSoundsFromIndexedDb(): Promise<void> {
    const stored = await loadAllCustomSoundsFromDb();
    if (stored.length === 0) return;

    const ctx = this.ensureContext();
    for (const entry of stored) {
      try {
        const blob = base64ToBlob(entry.base64Data, entry.mimeType);
        const arrayBuf = await blob.arrayBuffer();
        const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
        const trimmed = this.trimLeadingSilence(ctx, rawBuffer);

        if (entry.kind === 'number' && typeof entry.number === 'number') {
          const num = entry.number;
          this.buffersByNumber.set(num, trimmed);
          this.numberManifest = this.numberManifest.map((item) =>
            item.number === num
              ? {
                  ...item,
                  status: 'loaded',
                  durationSeconds: Number(trimmed.duration.toFixed(3)),
                  sourceNote: entry.sourceNote || 'Custom user alaap recording',
                  isCustom: true,
                }
              : item
          );
        } else if (
          entry.kind === 'percussion' &&
          typeof entry.percussionId === 'string'
        ) {
          const id = entry.percussionId as PercussionInstrumentId;
          this.buffersByPercussion.set(id, trimmed);
          this.percussionManifest = this.percussionManifest.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'loaded',
                  durationSeconds: Number(trimmed.duration.toFixed(3)),
                  sourceNote: entry.sourceNote || 'Custom percussion recording',
                  isCustom: true,
                }
              : item
          );
        }
      } catch {
        // Ignore corrupted DB entry and keep preloaded default buffer
      }
    }
  }

  async previewCandidateBlob(blob: Blob): Promise<{ durationSeconds: number }> {
    const arrayBuf = await blob.arrayBuffer();
    if (arrayBuf.byteLength < 64) {
      throw new Error('Recording is empty. Please record at least a brief sound.');
    }
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const trimmed = this.trimLeadingSilence(ctx, rawBuffer);
    if (trimmed.duration < 0.04) {
      throw new Error('Recording is too short (< 0.04s). Please try recording again.');
    }

    const src = ctx.createBufferSource();
    src.buffer = trimmed;
    const gain = ctx.createGain();
    gain.gain.value = this.isMainMuted ? 0.85 : Math.max(0.35, this.mainVolume);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    return { durationSeconds: Number(trimmed.duration.toFixed(3)) };
  }

  async registerNumberAudioBlob(
    num: number,
    blob: Blob,
    sourceNote: string,
    persistToDb = true
  ): Promise<void> {
    const arrayBuf = await blob.arrayBuffer();
    if (arrayBuf.byteLength < 64) {
      throw new Error('Recording file is empty.');
    }
    const ctx = this.ensureContext();
    const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const trimmed = this.trimLeadingSilence(ctx, rawBuffer);
    if (trimmed.duration < 0.04) {
      throw new Error('Recording is too short to use as an alaap note.');
    }

    this.buffersByNumber.set(num, trimmed);

    this.numberManifest = this.numberManifest.map((item) =>
      item.number === num
        ? {
            ...item,
            status: 'loaded',
            durationSeconds: Number(trimmed.duration.toFixed(3)),
            sourceNote,
            isCustom: true,
          }
        : item
    );

    if (persistToDb) {
      const base64Data = await blobToBase64(blob);
      await saveCustomSoundToDb({
        key: `num-${num}`,
        kind: 'number',
        number: num,
        mimeType: blob.type || 'audio/webm',
        base64Data,
        sourceNote,
        updatedAt: new Date().toISOString(),
      });
    }

    this.notifyManifest();
  }

  async restoreDefaultNumberSound(num: number): Promise<void> {
    await deleteCustomSoundFromDb(`num-${num}`);
    let defaultBuf = this.defaultBuffersByNumber.get(num);
    const targetItem = this.numberManifest.find((m) => m.number === num);

    // If not yet decoded in memory, load strictly from the user's original .m4a path (never .wav)
    if (!defaultBuf && targetItem) {
      try {
        const res = await fetch(targetItem.publicPath, { cache: 'no-cache' });
        const contentType = res.headers.get('content-type') ?? '';
        if (res.ok && !contentType.includes('text/html')) {
          const arrayBuf = await res.arrayBuffer();
          if (arrayBuf.byteLength >= 100) {
            const ctx = this.ensureContext();
            const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
            defaultBuf = this.trimLeadingSilence(ctx, rawBuffer);
            this.defaultBuffersByNumber.set(num, defaultBuf);
          }
        }
      } catch {
        // Handled below if defaultBuf remains undefined
      }
    }

    if (defaultBuf) {
      this.buffersByNumber.set(num, defaultBuf);
      this.numberManifest = this.numberManifest.map((item) =>
        item.number === num
          ? {
              ...item,
              status: 'loaded',
              durationSeconds: Number(defaultBuf.duration.toFixed(3)),
              sourceNote: `Original iPhone Voice Memo (${item.filename})`,
              errorMessage: undefined,
              isCustom: false,
            }
          : item
      );
    } else {
      this.buffersByNumber.delete(num);
      this.numberManifest = this.numberManifest.map((item) =>
        item.number === num
          ? {
              ...item,
              status: 'missing',
              durationSeconds: undefined,
              sourceNote: undefined,
              errorMessage: `Original .m4a recording could not be restored from public/sounds/${item.filename}`,
              isCustom: false,
            }
          : item
      );
    }

    this.notifyManifest();
  }

  async registerPercussionAudioBlob(
    id: PercussionInstrumentId,
    blob: Blob,
    sourceNote: string,
    persistToDb = true
  ): Promise<void> {
    const arrayBuf = await blob.arrayBuffer();
    const ctx = this.ensureContext();
    const rawBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const trimmed = this.trimLeadingSilence(ctx, rawBuffer);

    this.buffersByPercussion.set(id, trimmed);

    this.percussionManifest = this.percussionManifest.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'loaded',
            durationSeconds: Number(trimmed.duration.toFixed(3)),
            sourceNote,
            isCustom: true,
          }
        : item
    );

    if (persistToDb) {
      const base64Data = await blobToBase64(blob);
      await saveCustomSoundToDb({
        key: `perc-${id}`,
        kind: 'percussion',
        percussionId: id,
        mimeType: blob.type || 'audio/webm',
        base64Data,
        sourceNote,
        updatedAt: new Date().toISOString(),
      });
    }

    this.notifyManifest();
  }

  async restoreDefaultPercussionSound(id: PercussionInstrumentId): Promise<void> {
    await deleteCustomSoundFromDb(`perc-${id}`);
    const defaultBuf = this.defaultBuffersByPercussion.get(id);

    if (defaultBuf) {
      this.buffersByPercussion.set(id, defaultBuf);
      this.percussionManifest = this.percussionManifest.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'loaded',
              durationSeconds: Number(defaultBuf.duration.toFixed(3)),
              sourceNote: 'Preloaded default percussion',
              isCustom: false,
            }
          : item
      );
    }

    this.notifyManifest();
  }

  async restoreAllDefaults(): Promise<void> {
    await clearAllCustomSoundsInDb();

    this.numberManifest = this.numberManifest.map((item) => {
      const defaultBuf = this.defaultBuffersByNumber.get(item.number);
      if (defaultBuf) {
        this.buffersByNumber.set(item.number, defaultBuf);
        return {
          ...item,
          status: 'loaded',
          durationSeconds: Number(defaultBuf.duration.toFixed(3)),
          sourceNote: `Original iPhone Voice Memo (${item.filename})`,
          errorMessage: undefined,
          isCustom: false,
        };
      }
      return { ...item, isCustom: false };
    });

    this.percussionManifest = this.percussionManifest.map((perc) => {
      const defaultBuf = this.defaultBuffersByPercussion.get(perc.id);
      if (defaultBuf) {
        this.buffersByPercussion.set(perc.id, defaultBuf);
        return {
          ...perc,
          status: 'loaded',
          durationSeconds: Number(defaultBuf.duration.toFixed(3)),
          sourceNote: 'Preloaded default percussion',
          isCustom: false,
        };
      }
      return { ...perc, isCustom: false };
    });

    this.notifyManifest();
  }

  async exportCustomSoundsBackup(): Promise<CustomSoundBackupBundle> {
    return createCustomSoundBackupBundle();
  }

  async importCustomSoundsBackup(bundle: CustomSoundBackupBundle): Promise<number> {
    if (!bundle || !Array.isArray(bundle.recordings)) {
      throw new Error('Invalid custom sound backup file.');
    }
    let importedCount = 0;
    for (const rec of bundle.recordings) {
      if (!rec.base64Data) continue;
      const blob = base64ToBlob(rec.base64Data, rec.mimeType || 'audio/webm');
      if (rec.kind === 'number' && typeof rec.number === 'number') {
        await this.registerNumberAudioBlob(
          rec.number,
          blob,
          rec.sourceNote || 'Imported from backup',
          true
        );
        importedCount++;
      } else if (
        rec.kind === 'percussion' &&
        typeof rec.percussionId === 'string'
      ) {
        await this.registerPercussionAudioBlob(
          rec.percussionId as PercussionInstrumentId,
          blob,
          rec.sourceNote || 'Imported from backup',
          true
        );
        importedCount++;
      }
    }
    return importedCount;
  }

  async previewNumberSound(num: number): Promise<boolean> {
    const buf = this.buffersByNumber.get(num);
    if (!buf) return false;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = this.isMainMuted ? 0 : this.mainVolume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return true;
  }

  async previewPercussionSound(id: PercussionInstrumentId): Promise<boolean> {
    const buf = this.buffersByPercussion.get(id);
    if (!buf) return false;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = this.isPercussionMuted ? 0 : this.percussionVolume;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    return true;
  }

  /**
   * Plays a short 4-beat miniature preview of a selected Instrumental Style
   * (`pop`, `jazz`, `rock`, `classical`, `reggae`, or `indian-carnatic`) at the
   * current BPM so the user can audition the style's arrangement.
   */
  async previewInstrumentalStyle(styleId: InstrumentalStyleId): Promise<boolean> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const stepDur = 60 / this.bpm;
    const now = ctx.currentTime + 0.02;
    const previewGain = ctx.createGain();
    previewGain.gain.value = this.isAccompanimentMuted
      ? 0.55
      : Math.max(0.35, this.accompanimentVolume);
    previewGain.connect(ctx.destination);

    let scheduledAny = false;
    for (let beat = 0; beat < 4; beat++) {
      const beatInBar = ((beat % 4) + 1) as 1 | 2 | 3 | 4;
      const { events } = getAccompanimentEventsForStep(
        beat,
        beatInBar,
        beat === 2 ? 7 : 0,
        styleId
      );

      for (const sub of events) {
        const buf = this.buffersByAccompaniment.get(sub.sampleId);
        if (!buf) continue;
        const startTime = now + beat * stepDur + sub.offsetRatio * stepDur;
        const playDur = Math.min(buf.duration, stepDur * sub.durationScale);
        if (playDur > 0.015) {
          this.scheduleBufferNode(
            ctx,
            buf,
            previewGain,
            startTime,
            0,
            playDur,
            sub.gain,
            sub.playbackRate
          );
          scheduledAny = true;
        }
      }
    }

    return scheduledAny;
  }

  getNumberManifest(): NumberSoundAsset[] {
    return this.numberManifest;
  }

  getPercussionManifest(): PercussionSoundAsset[] {
    return this.percussionManifest;
  }

  getAccompanimentManifest(): AccompanimentSoundAsset[] {
    return this.accompanimentManifest;
  }

  getSummaryForName(
    uniqueNumbersInName: number[],
    selectedPercussionId: PercussionInstrumentId,
    selectedStyleId: InstrumentalStyleId = this.selectedStyleId
  ): SoundLibrarySummary {
    return summarizeManifestForName(
      this.numberManifest,
      this.percussionManifest,
      uniqueNumbersInName,
      selectedPercussionId,
      this.accompanimentManifest,
      selectedStyleId
    );
  }

  setTimelineForNewName(timeline: ContinuousTimeline): void {
    this.stop();
    this.timeline = timeline;
    this.bpm = timeline.bpm;
    this.selectedStyleId = timeline.selectedStyleId;
    this.pausedAtSeconds = 0;
    this.state = 'idle';
    this.notifyStatus();
  }

  /**
   * Smoothly updates timing AND/OR instrumental style during playback without
   * restarting the composition or altering the mathematical sequence.
   */
  updateTimelineWithNewBpm(newTimeline: ContinuousTimeline): void {
    const prevTimeline = this.timeline;
    const prevStepDur = prevTimeline?.stepDurationSeconds ?? 0.6;
    const newStepDur = newTimeline.stepDurationSeconds;

    let currentElapsed = this.pausedAtSeconds;
    if (this.state === 'playing' && this.ctx) {
      currentElapsed = Math.max(0, this.ctx.currentTime - this.startCtxTime);
    }

    const fractionalSteps =
      prevStepDur > 0 ? currentElapsed / prevStepDur : 0;
    const newElapsedSeconds = Math.min(
      newTimeline.totalDurationSeconds,
      fractionalSteps * newStepDur
    );

    this.timeline = newTimeline;
    this.bpm = clampBpm(newTimeline.bpm);
    this.selectedStyleId = newTimeline.selectedStyleId;
    this.pausedAtSeconds = newElapsedSeconds;

    if (this.state === 'playing' && this.ctx) {
      this.stopAllActiveNodes();
      this.startCtxTime = this.ctx.currentTime - this.pausedAtSeconds;
      this.scheduleEventsFrom(this.pausedAtSeconds);
    }

    this.notifyStatus();
  }

  async play(): Promise<void> {
    if (!this.timeline || this.timeline.events.length === 0) return;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (this.pausedAtSeconds >= this.timeline.totalDurationSeconds) {
      this.pausedAtSeconds = 0;
    }

    this.stopAllActiveNodes();
    this.startCtxTime = ctx.currentTime - this.pausedAtSeconds;
    this.scheduleEventsFrom(this.pausedAtSeconds);
    this.state = 'playing';
    this.startTicker();
    this.notifyStatus();
  }

  pause(): void {
    if (this.state !== 'playing' || !this.ctx) return;
    this.pausedAtSeconds = Math.min(
      this.timeline?.totalDurationSeconds ?? 0,
      Math.max(0, this.ctx.currentTime - this.startCtxTime)
    );
    this.stopAllActiveNodes();
    this.stopTicker();
    this.state = 'paused';
    this.notifyStatus();
  }

  stop(): void {
    this.stopAllActiveNodes();
    this.stopTicker();
    this.pausedAtSeconds = 0;
    this.state = this.timeline ? 'stopped' : 'idle';
    this.notifyStatus();
  }

  async restart(): Promise<void> {
    this.stop();
    await this.play();
  }

  seek(seconds: number): void {
    if (!this.timeline) return;
    const clamped = Math.max(
      0,
      Math.min(this.timeline.totalDurationSeconds, seconds)
    );
    const wasPlaying = this.state === 'playing';
    this.stopAllActiveNodes();
    this.pausedAtSeconds = clamped;
    if (wasPlaying && this.ctx) {
      this.startCtxTime = this.ctx.currentTime - this.pausedAtSeconds;
      this.scheduleEventsFrom(this.pausedAtSeconds);
    }
    this.notifyStatus();
  }

  setMainVolume(vol: number): void {
    this.mainVolume = Math.max(0, Math.min(1, vol));
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(
        this.isMainMuted ? 0 : this.mainVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  toggleMainMute(): void {
    this.isMainMuted = !this.isMainMuted;
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(
        this.isMainMuted ? 0 : this.mainVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  setPercussionVolume(vol: number): void {
    this.percussionVolume = Math.max(0, Math.min(1, vol));
    if (this.percussionGain && this.ctx) {
      this.percussionGain.gain.setValueAtTime(
        this.isPercussionMuted ? 0 : this.percussionVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  togglePercussionMute(): void {
    this.isPercussionMuted = !this.isPercussionMuted;
    if (this.percussionGain && this.ctx) {
      this.percussionGain.gain.setValueAtTime(
        this.isPercussionMuted ? 0 : this.percussionVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  setAccompanimentVolume(vol: number): void {
    this.accompanimentVolume = Math.max(0, Math.min(1, vol));
    if (this.accompanimentGain && this.ctx) {
      this.accompanimentGain.gain.setValueAtTime(
        this.isAccompanimentMuted ? 0 : this.accompanimentVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  toggleAccompanimentMute(): void {
    this.isAccompanimentMuted = !this.isAccompanimentMuted;
    if (this.accompanimentGain && this.ctx) {
      this.accompanimentGain.gain.setValueAtTime(
        this.isAccompanimentMuted ? 0 : this.accompanimentVolume,
        this.ctx.currentTime
      );
    }
    this.notifyStatus();
  }

  getStatus(): PlayerStatus {
    const totalDuration = this.timeline?.totalDurationSeconds ?? 0;
    let currentTime = this.pausedAtSeconds;
    if (this.state === 'playing' && this.ctx) {
      currentTime = Math.min(
        totalDuration,
        Math.max(0, this.ctx.currentTime - this.startCtxTime)
      );
    }

    const progressPercent =
      totalDuration > 0
        ? Math.min(100, (currentTime / totalDuration) * 100)
        : 0;

    const activeEvent: ScheduledStepEvent | null =
      this.timeline && (this.state === 'playing' || this.state === 'paused')
        ? findActiveEventAtTime(this.timeline, currentTime)
        : null;

    return {
      state: this.state,
      bpm: this.bpm,
      currentTime: Number(currentTime.toFixed(2)),
      totalDuration: Number(totalDuration.toFixed(2)),
      progressPercent: Number(progressPercent.toFixed(1)),
      mainVolume: this.mainVolume,
      isMainMuted: this.isMainMuted,
      percussionVolume: this.percussionVolume,
      isPercussionMuted: this.isPercussionMuted,
      accompanimentVolume: this.accompanimentVolume,
      isAccompanimentMuted: this.isAccompanimentMuted,
      selectedStyleId: this.selectedStyleId,
      activeGlobalStepIndex: activeEvent ? activeEvent.globalStepIndex : null,
      activeLetterIndex: activeEvent ? activeEvent.letterIndex : null,
      activeStepInLetter: activeEvent ? activeEvent.stepIndexInLetter : null,
      activeNumber: activeEvent ? activeEvent.number : null,
      activeSoundName: activeEvent ? activeEvent.soundName : null,
      activeBarNumber: activeEvent ? activeEvent.barNumber : null,
      activeBeatInBar: activeEvent ? activeEvent.beatInBar : null,
      activeGroupIndexInBar: activeEvent ? activeEvent.groupIndexInBar : null,
      isGroupStartActive: activeEvent ? activeEvent.isGroupStart : false,
      isPercussionHitActive: activeEvent ? activeEvent.percussionHit : false,
      activeAccompanimentSummary: activeEvent
        ? activeEvent.accompanimentSummary
        : getInstrumentalStyleById(this.selectedStyleId).tagline,
      isLoadingAssets: this.isLoadingAssets,
    };
  }

  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.getStatus());
    return () => this.statusListeners.delete(listener);
  }

  subscribeManifest(listener: ManifestListener): () => void {
    this.manifestListeners.add(listener);
    listener(
      this.numberManifest,
      this.percussionManifest,
      this.accompanimentManifest
    );
    return () => this.manifestListeners.delete(listener);
  }

  // ─── Internal Web Audio Graph & Synchronized 3-Layer Scheduling ───────────

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();

      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -3.0;
      limiter.knee.value = 6.0;
      limiter.ratio.value = 12.0;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.12;
      limiter.connect(this.ctx.destination);

      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.value = this.isMainMuted ? 0 : this.mainVolume;
      this.mainGain.connect(limiter);

      this.percussionGain = this.ctx.createGain();
      this.percussionGain.gain.value = this.isPercussionMuted
        ? 0
        : this.percussionVolume;
      this.percussionGain.connect(limiter);

      this.accompanimentGain = this.ctx.createGain();
      this.accompanimentGain.gain.value = this.isAccompanimentMuted
        ? 0
        : this.accompanimentVolume;
      this.accompanimentGain.connect(limiter);
    }
    return this.ctx;
  }

  /**
   * Schedules all three layers (Layer 1: Alaap Melody, Layer 2: Percussion Beat,
   * Layer 3: Instrumental Accompaniment) from `offsetSeconds` until the end of
   * the composition using the shared tempo clock.
   */
  private scheduleEventsFrom(offsetSeconds: number): void {
    if (
      !this.timeline ||
      !this.ctx ||
      !this.mainGain ||
      !this.percussionGain ||
      !this.accompanimentGain
    ) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const percBuffer = this.buffersByPercussion.get(
      this.timeline.selectedPercussionId
    );

    for (const ev of this.timeline.events) {
      if (ev.endTimeSeconds <= offsetSeconds) continue;

      const relativeStart = ev.startTimeSeconds - offsetSeconds;
      const startTime = now + Math.max(0, relativeStart);
      const bufferOffset = relativeStart < 0 ? Math.abs(relativeStart) : 0;

      // Layer 1: Schedule Foreground Human-Sung Alaap Note (0..26)
      const fgBuffer = this.buffersByNumber.get(ev.number);
      if (fgBuffer && bufferOffset < fgBuffer.duration) {
        const maxNaturalDuration = Math.min(
          fgBuffer.duration - bufferOffset,
          ev.stepDurationSeconds * 1.65
        );
        if (maxNaturalDuration > 0.015) {
          this.scheduleBufferNode(
            ctx,
            fgBuffer,
            this.mainGain,
            startTime,
            bufferOffset,
            maxNaturalDuration,
            0.94,
            1.0
          );
        }
      }

      // Layer 2: Schedule Name-Selected Background Percussion Beat
      if (
        ev.percussionHit &&
        percBuffer &&
        bufferOffset < percBuffer.duration
      ) {
        const maxPercDuration = Math.min(
          percBuffer.duration - bufferOffset,
          ev.stepDurationSeconds * 1.25
        );
        if (maxPercDuration > 0.015) {
          this.scheduleBufferNode(
            ctx,
            percBuffer,
            this.percussionGain,
            startTime,
            bufferOffset,
            maxPercDuration,
            ev.percussionAccent,
            1.0
          );
        }
      }

      // Layer 3: Schedule Selected Instrumental Accompaniment Sub-Events
      for (const sub of ev.accompanimentEvents) {
        const accBuffer = this.buffersByAccompaniment.get(sub.sampleId);
        if (!accBuffer) continue;

        const subEventAbsTime =
          ev.startTimeSeconds + sub.offsetRatio * ev.stepDurationSeconds;
        const subRelativeStart = subEventAbsTime - offsetSeconds;
        if (
          subEventAbsTime + ev.stepDurationSeconds * sub.durationScale <=
          offsetSeconds
        ) {
          continue;
        }

        const subStartTime = now + Math.max(0, subRelativeStart);
        const subBufferOffset =
          subRelativeStart < 0 ? Math.abs(subRelativeStart) : 0;

        if (subBufferOffset < accBuffer.duration) {
          // Ensure accompaniment ends cleanly with the composition
          const remainingCompTime = Math.max(
            0.05,
            this.timeline.totalDurationSeconds -
              Math.max(offsetSeconds, subEventAbsTime)
          );
          const maxAccDuration = Math.min(
            accBuffer.duration - subBufferOffset,
            ev.stepDurationSeconds * sub.durationScale,
            remainingCompTime + 0.12
          );
          if (maxAccDuration > 0.015) {
            this.scheduleBufferNode(
              ctx,
              accBuffer,
              this.accompanimentGain,
              subStartTime,
              subBufferOffset,
              maxAccDuration,
              sub.gain,
              sub.playbackRate
            );
          }
        }
      }
    }
  }

  private scheduleBufferNode(
    ctx: AudioContext,
    buffer: AudioBuffer,
    destinationGain: GainNode,
    startTime: number,
    bufferOffset: number,
    playDuration: number,
    peakGain: number,
    playbackRate: number = 1.0
  ): void {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (playbackRate !== 1.0 && Number.isFinite(playbackRate)) {
      source.playbackRate.setValueAtTime(playbackRate, startTime);
    }

    const env = ctx.createGain();
    const endTime = startTime + playDuration;
    const fadeOutStart = Math.max(
      startTime + 0.005,
      endTime - Math.min(0.06, playDuration * 0.25)
    );

    env.gain.setValueAtTime(0.001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.005);
    env.gain.setValueAtTime(peakGain, fadeOutStart);
    env.gain.linearRampToValueAtTime(0.0001, endTime);

    source.connect(env);
    env.connect(destinationGain);

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
    };

    try {
      source.start(startTime, bufferOffset, playDuration);
    } catch {
      // Ignore if offset exceeds buffer duration
    }
  }

  private trimLeadingSilence(
    ctx: AudioContext,
    buffer: AudioBuffer
  ): AudioBuffer {
    const numChannels = buffer.numberOfChannels;
    const len = buffer.length;
    if (len === 0 || numChannels === 0) return buffer;

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      channels.push(buffer.getChannelData(ch));
    }

    // 1. Measure overall peak amplitude across all stereo/mono channels
    let peak = 0;
    for (let i = 0; i < len; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const absVal = Math.abs(channels[ch][i]);
        if (absVal > peak) peak = absVal;
      }
    }

    if (peak < 0.0005) {
      return buffer;
    }

    // 2. Adaptive silence threshold (catches soft breaths like peak=0.049 while rejecting 0.002 Voice Memo pre-roll)
    const threshold = Math.min(0.012, Math.max(0.004, peak * 0.1));

    let startSample = 0;
    while (startSample < len) {
      let frameMax = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const v = Math.abs(channels[ch][startSample]);
        if (v > frameMax) frameMax = v;
      }
      if (frameMax >= threshold) break;
      startSample++;
    }

    let endSample = len - 1;
    while (endSample > startSample) {
      let frameMax = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        const v = Math.abs(channels[ch][endSample]);
        if (v > frameMax) frameMax = v;
      }
      if (frameMax >= threshold) break;
      endSample--;
    }

    const leadPad = Math.floor(buffer.sampleRate * 0.008);
    const tailPad = Math.floor(buffer.sampleRate * 0.065);
    startSample = Math.max(0, startSample - leadPad);
    endSample = Math.min(len - 1, endSample + tailPad);

    const trimmedLength = endSample - startSample + 1;
    if (trimmedLength <= Math.floor(buffer.sampleRate * 0.04)) {
      return buffer;
    }

    // Gentle makeup gain for softer Voice Memos (e.g., quiet breath or rubbing palms) without clipping
    const gainBoost =
      peak < 0.55 ? Math.min(6.0, 0.72 / Math.max(0.01, peak)) : 1.0;

    const trimmed = ctx.createBuffer(
      numChannels,
      trimmedLength,
      buffer.sampleRate
    );
    for (let ch = 0; ch < numChannels; ch++) {
      const src = channels[ch];
      const dst = trimmed.getChannelData(ch);
      for (let i = 0; i < trimmedLength; i++) {
        const sample = src[startSample + i] * gainBoost;
        dst[i] = Math.max(-0.98, Math.min(0.98, sample));
      }
    }
    return trimmed;
  }

  private stopAllActiveNodes(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    }
    this.activeSources.clear();
  }

  private startTicker(): void {
    this.stopTicker();
    const tick = () => {
      if (this.state !== 'playing' || !this.ctx || !this.timeline) return;
      const elapsed = this.ctx.currentTime - this.startCtxTime;
      if (elapsed >= this.timeline.totalDurationSeconds) {
        this.stopAllActiveNodes();
        this.pausedAtSeconds = 0;
        this.state = 'stopped';
        this.notifyStatus();
        return;
      }
      this.notifyStatus();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTicker(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private notifyStatus(): void {
    const snapshot = this.getStatus();
    for (const fn of this.statusListeners) {
      fn(snapshot);
    }
  }

  private notifyManifest(): void {
    for (const fn of this.manifestListeners) {
      fn(
        this.numberManifest,
        this.percussionManifest,
        this.accompanimentManifest
      );
    }
  }
}
