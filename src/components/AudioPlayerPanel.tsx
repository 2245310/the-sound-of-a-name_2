/**
 * src/components/AudioPlayerPanel.tsx
 * -----------------------------------
 * Implements Steps 3, 4, 5, 6, 7, 8, 9, 10 & 11 of the Updated Antigravity Brief:
 *   - Preloads all 27 default number sounds (0..26), 6 percussion sounds, and
 *     18 theme accompaniment assets with a clear loading indicator
 *   - Play / Pause, Stop, Restart/Replay, Progress bar, Current & Total time
 *   - User-controlled Tempo slider + numeric BPM control (default 100 BPM,
 *     range 40–200 BPM) + clear pulse definition for the active time signature
 *   - Three-layer volume & mute mixer (Main Sound Sequence, Percussion, Theme)
 *   - Live Time Signature & Beat Grouping indicator (3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
 *   - Six Musical Themes with "Your name's suggested theme" (M = G % 6) vs
 *     "Currently selected theme"
 *   - Dedicated Editable Sound Library (all 27 numbers 0..26) with Staged
 *     Recording Workflow (Start → Stop → Preview → Save / Cancel), Restore Default,
 *     IndexedDB persistence, and Export / Import JSON backup
 */

import React, { useRef, useState } from 'react';
import {
  ALL_INSTRUMENTAL_STYLES,
  getInstrumentalStyleById,
  MAX_BPM,
  MIN_BPM,
  NUMBER_SOUND_MAP,
} from '../engine/config';
import type {
  InstrumentalStyleId,
  NameConversionResult,
  PercussionInstrumentId,
} from '../engine/types';
import type { SoundLibrarySummary } from '../audio/assetManifest';
import type { CustomSoundBackupBundle } from '../audio/customSoundStore';
import type {
  AccompanimentSoundAsset,
  ContinuousTimeline,
  NumberSoundAsset,
  PercussionSoundAsset,
  PlayerStatus,
} from '../audio/types';

interface StagedCandidate {
  targetKey: string;
  kind: 'number' | 'percussion';
  number?: number;
  percussionId?: PercussionInstrumentId;
  label: string;
  blob: Blob | null;
  durationSeconds?: number;
  sourceNote: string;
  isRecording: boolean;
}

interface AudioPlayerPanelProps {
  conversion: NameConversionResult;
  timeline: ContinuousTimeline;
  status: PlayerStatus;
  bpm: number;
  onBpmChange: (newBpm: number) => void;
  selectedStyleId: InstrumentalStyleId;
  onStyleChange: (styleId: InstrumentalStyleId) => void;
  numberManifest: NumberSoundAsset[];
  percussionManifest: PercussionSoundAsset[];
  accompanimentManifest: AccompanimentSoundAsset[];
  summary: SoundLibrarySummary;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onMainVolumeChange: (volume: number) => void;
  onToggleMainMute: () => void;
  onPercussionVolumeChange: (volume: number) => void;
  onTogglePercussionMute: () => void;
  onAccompanimentVolumeChange: (volume: number) => void;
  onToggleAccompanimentMute: () => void;
  onPreviewStyle: (styleId: InstrumentalStyleId) => Promise<boolean>;
  onPreviewCandidateBlob: (blob: Blob) => Promise<{ durationSeconds: number }>;
  onUploadNumberSound: (
    num: number,
    blob: Blob,
    sourceNote: string
  ) => Promise<void>;
  onRestoreDefaultNumberSound: (num: number) => Promise<void>;
  onPreviewNumberSound: (num: number) => Promise<boolean>;
  onUploadPercussionSound: (
    id: PercussionInstrumentId,
    blob: Blob,
    sourceNote: string
  ) => Promise<void>;
  onRestoreDefaultPercussionSound: (id: PercussionInstrumentId) => Promise<void>;
  onPreviewPercussionSound: (id: PercussionInstrumentId) => Promise<boolean>;
  onRestoreAllDefaults: () => Promise<void>;
  onExportBackup: () => Promise<CustomSoundBackupBundle>;
  onImportBackup: (bundle: CustomSoundBackupBundle) => Promise<number>;
}

function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1).padStart(4, '0');
  return `${mins}:${rem}`;
}

export const AudioPlayerPanel: React.FC<AudioPlayerPanelProps> = ({
  conversion,
  timeline,
  status,
  bpm,
  onBpmChange,
  selectedStyleId,
  onStyleChange,
  numberManifest,
  percussionManifest,
  accompanimentManifest,
  summary,
  onPlay,
  onPause,
  onStop,
  onRestart,
  onSeek,
  onMainVolumeChange,
  onToggleMainMute,
  onPercussionVolumeChange,
  onTogglePercussionMute,
  onAccompanimentVolumeChange,
  onToggleAccompanimentMute,
  onPreviewStyle,
  onPreviewCandidateBlob,
  onUploadNumberSound,
  onRestoreDefaultNumberSound,
  onPreviewNumberSound,
  onUploadPercussionSound,
  onRestoreDefaultPercussionSound,
  onPreviewPercussionSound,
  onRestoreAllDefaults,
  onExportBackup,
  onImportBackup,
}) => {
  const [showAll27, setShowAll27] = useState<boolean>(true);
  const [showAll6Perc, setShowAll6Perc] = useState<boolean>(false);

  const [staged, setStaged] = useState<StagedCandidate | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const isPlaying = status.state === 'playing';
  const isPlayingOrPaused =
    status.state === 'playing' || status.state === 'paused';

  const customCount =
    numberManifest.filter((m) => m.isCustom).length +
    percussionManifest.filter((p) => p.isCustom).length;

  const stopActiveMediaStream = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((t) => t.stop());
      activeStreamRef.current = null;
    }
  };

  const openStagedEditorForNumber = (num: number, soundName: string) => {
    stopActiveMediaStream();
    setRecordingError(null);
    setStaged({
      targetKey: `num-${num}`,
      kind: 'number',
      number: num,
      label: `#${num} — ${soundName}`,
      blob: null,
      sourceNote: 'Custom user sound recording (microphone)',
      isRecording: false,
    });
  };

  const openStagedEditorForPercussion = (
    id: PercussionInstrumentId,
    instrumentName: string
  ) => {
    stopActiveMediaStream();
    setRecordingError(null);
    setStaged({
      targetKey: `perc-${id}`,
      kind: 'percussion',
      percussionId: id,
      label: `Percussion — ${instrumentName}`,
      blob: null,
      sourceNote: 'Custom percussion recording (microphone)',
      isRecording: false,
    });
  };

  const handleStartCandidateRecording = async () => {
    if (!staged) return;
    setRecordingError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        activeStreamRef.current = null;
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size < 64) {
          setRecordingError(
            'Recording was empty or too brief. Please click "Start Recording" and try again.'
          );
          setStaged((prev) =>
            prev ? { ...prev, isRecording: false, blob: null } : null
          );
          return;
        }
        try {
          const { durationSeconds } = await onPreviewCandidateBlob(blob);
          setStaged((prev) =>
            prev
              ? {
                  ...prev,
                  isRecording: false,
                  blob,
                  durationSeconds,
                  sourceNote: 'Custom user recording (microphone)',
                }
              : null
          );
        } catch (err) {
          setRecordingError(
            err instanceof Error
              ? err.message
              : 'Could not decode recorded audio. Please try recording again.'
          );
          setStaged((prev) =>
            prev ? { ...prev, isRecording: false, blob: null } : null
          );
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStaged({ ...staged, isRecording: true, blob: null });
    } catch {
      setRecordingError(
        'Microphone permission was denied or no microphone was found. Please allow microphone access in your browser settings, or choose an audio file from your computer.'
      );
    }
  };

  const handleStopCandidateRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleStageAudioFile = async (file: File) => {
    if (!staged) return;
    setRecordingError(null);
    try {
      const { durationSeconds } = await onPreviewCandidateBlob(file);
      setStaged({
        ...staged,
        isRecording: false,
        blob: file,
        durationSeconds,
        sourceNote: `Custom recording (${file.name})`,
      });
    } catch (err) {
      setRecordingError(
        err instanceof Error
          ? err.message
          : 'Selected file could not be decoded as a valid audio recording.'
      );
    }
  };

  const handlePreviewStagedCandidate = async () => {
    if (!staged?.blob) return;
    setRecordingError(null);
    try {
      await onPreviewCandidateBlob(staged.blob);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : 'Unable to preview candidate.'
      );
    }
  };

  const handleSaveStagedCandidate = async () => {
    if (!staged || !staged.blob) {
      setRecordingError(
        'Please record or select a sound first before clicking Save Recording.'
      );
      return;
    }
    setRecordingError(null);
    try {
      if (staged.kind === 'number' && typeof staged.number === 'number') {
        await onUploadNumberSound(
          staged.number,
          staged.blob,
          staged.sourceNote
        );
      } else if (staged.kind === 'percussion' && staged.percussionId) {
        await onUploadPercussionSound(
          staged.percussionId,
          staged.blob,
          staged.sourceNote
        );
      }
      setStaged(null);
    } catch (err) {
      setRecordingError(
        err instanceof Error ? err.message : 'Failed to save recording.'
      );
    }
  };

  const handleCancelStagedCandidate = () => {
    stopActiveMediaStream();
    setRecordingError(null);
    setStaged(null);
  };

  const handleExportBackupClick = async () => {
    setBackupNotice(null);
    try {
      const bundle = await onExportBackup();
      const jsonStr = JSON.stringify(bundle, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sound-of-a-name-custom-sounds-backup.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBackupNotice(
        `Exported ${bundle.recordings.length} custom recording(s) to sound-of-a-name-custom-sounds-backup.json.`
      );
    } catch {
      setBackupNotice('Failed to export custom sound library backup.');
    }
  };

  const handleImportBackupFile = async (file: File) => {
    setBackupNotice(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CustomSoundBackupBundle;
      const count = await onImportBackup(parsed);
      setBackupNotice(
        `Successfully imported ${count} custom recording(s) into the Sound Library and saved them to IndexedDB.`
      );
    } catch {
      setBackupNotice(
        'Could not import backup file. Please choose a valid .json backup exported from this website.'
      );
    }
  };

  // Build dynamic beat metadata for the active time signature (e.g., 2+2+3 for 7/8)
  const tsSpec = conversion.selectedTimeSignature;
  const beatMetadataList: {
    beatNumber: number;
    groupIndex: number;
    beatInGroup: number;
    isGroupStart: boolean;
  }[] = [];
  let runningBeat = 1;
  tsSpec.groupSizes.forEach((gSize, gIdx) => {
    for (let b = 1; b <= gSize; b++) {
      beatMetadataList.push({
        beatNumber: runningBeat,
        groupIndex: gIdx + 1,
        beatInGroup: b,
        isGroupStart: b === 1,
      });
      runningBeat += 1;
    }
  });

  const activeStyleSpec = getInstrumentalStyleById(selectedStyleId);
  const isThemeOverridden = selectedStyleId !== conversion.suggestedTheme.id;

  return (
    <section
      id="composition-player-section"
      className="audio-player-section"
      aria-labelledby="audio-player-heading"
    >
      <div className="section-header-bar">
        <div>
          <span className="section-kicker">
            STEPS 5, 6, 7, 8, 9, 10 & 11 // AUDIO CONTROLS, TIME SIGNATURE, PERCUSSION & THEME MIXER
          </span>
          <h2 id="audio-player-heading" className="section-title">
            Composition Player, Time Signature, Percussion & Theme Mixer
          </h2>
          <p className="section-subtitle">
            Foreground sequence:{' '}
            <strong>{timeline.totalSteps} ordered human sounds</strong> · Time
            signature:{' '}
            <strong>
              {tsSpec.id} ({tsSpec.groupingLabel} grouping, T ={' '}
              {conversion.letterSum} % 6 = {conversion.timeSignatureModulo})
            </strong>{' '}
            · Background percussion:{' '}
            <strong>
              {conversion.selectedPercussion.instrumentName} (P ={' '}
              {conversion.letterSum} % 6 = {conversion.percussionModulo})
            </strong>{' '}
            · Theme: <strong>{activeStyleSpec.styleName}</strong> · Tempo:{' '}
            <strong>{bpm} BPM</strong> ({timeline.totalDurationSeconds.toFixed(2)}s
            total).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <a
            href="#editable-sound-library-section"
            className="pill-toggle"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            🎙 Jump to Editable Sound Library (27 Sounds) ↓
          </a>
        </div>
      </div>

      {/* Preloaded Asset Status / Loading Indicator Banner */}
      <div
        className={`manifest-status-banner ${
          status.isLoadingAssets
            ? 'status-incomplete'
            : summary.isNameReadyToPlay && summary.missingCount === 0
            ? 'status-complete'
            : 'status-incomplete'
        }`}
        role="status"
      >
        <div className="banner-main">
          <span className="banner-indicator">
            {status.isLoadingAssets
              ? '⏳ LOADING 27 ORIGINAL .M4A RECORDINGS…'
              : summary.errorCount > 0
              ? '⚠ .M4A CODEC / DECODE ISSUE DETECTED'
              : summary.loadedCount === summary.totalExpected &&
                summary.isNameReadyToPlay
              ? '● ALL 27 PERSONAL .M4A RECORDINGS READY'
              : '▲ MISSING OR LOADING RECORDINGS'}
          </span>
          <div>
            {status.isLoadingAssets ? (
              <p>
                <strong>
                  Loading your 27 original iPhone Voice Memo recordings (
                  <code>00-snap.m4a … 26-rubbing- palms.m4a</code>), 6
                  percussion sounds, and 6 musical themes…
                </strong>{' '}
                Playback will be ready in a moment.
              </p>
            ) : summary.errorCount > 0 ? (
              <p>
                <strong>
                  Format/Codec Error on {summary.errorCount} <code>.m4a</code>{' '}
                  recording(s) (no silent fallback to generated <code>.wav</code>{' '}
                  was used):
                </strong>{' '}
                Your browser could not decode MPEG-4 AAC (<code>.m4a</code>) for
                number(s){' '}
                <code>{summary.errorNumbers.join(', ')}</code>. Open in Safari /
                Google Chrome on macOS, or convert losslessly via Terminal:{' '}
                <code>
                  afconvert -f WAVE -d LEI16@48000 input.m4a output.wav
                </code>
                .
              </p>
            ) : summary.loadedCount === summary.totalExpected &&
              summary.isNameReadyToPlay ? (
              <p>
                <strong>
                  All {summary.loadedCount}/27 of your personal iPhone Voice
                  Memo (<code>.m4a</code>) recordings are loaded as the default
                  sound library!
                </strong>{' '}
                Press <strong>▶ Play</strong> below to hear the composition for “
                {conversion.normalizedName}”, or scroll down to the{' '}
                <strong>Sound Library</strong> to preview, record a custom
                override, or restore your original <code>.m4a</code> recording.
              </p>
            ) : (
              <p>
                <strong>
                  Missing or unloaded recordings ({summary.missingCount} of 27):
                </strong>{' '}
                {summary.missingNumbers
                  .map(
                    (n) =>
                      `#${n} ${NUMBER_SOUND_MAP[n]?.soundName} (${NUMBER_SOUND_MAP[n]?.filename})`
                  )
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
        <div className="banner-counts">
          <span>
            Personal <code>.m4a</code> Library:{' '}
            <strong>
              {summary.loadedCount} / {summary.totalExpected} Ready
            </strong>
          </span>
          <span>
            Custom Overrides Active: <strong>{customCount}</strong>
          </span>
        </div>
      </div>

      {/* Main Transport + Scrubber Card */}
      <div className="player-transport-card">
        <div className="transport-buttons">
          {!isPlaying ? (
            <button
              type="button"
              className="btn-transport primary-play"
              onClick={onPlay}
              disabled={Boolean(status.isLoadingAssets)}
              aria-label="Play composition"
            >
              ▶ Play
            </button>
          ) : (
            <button
              type="button"
              className="btn-transport primary-pause"
              onClick={onPause}
              aria-label="Pause composition"
            >
              ❚❚ Pause
            </button>
          )}

          <button
            type="button"
            className="btn-transport"
            onClick={onStop}
            aria-label="Stop playback"
          >
            ■ Stop
          </button>

          <button
            type="button"
            className="btn-transport"
            onClick={onRestart}
            disabled={Boolean(status.isLoadingAssets)}
            aria-label="Restart and replay entire composition from start"
          >
            ↺ Replay
          </button>
        </div>

        {/* Progress Bar & Live Highlight Status */}
        <div className="timeline-box">
          <div className="timeline-labels">
            <span className="mono-time">{formatTime(status.currentTime)}</span>
            <span className="timeline-active-step">
              {status.activeGlobalStepIndex !== null ? (
                <>
                  Step #{status.activeGlobalStepIndex + 1}/{timeline.totalSteps}{' '}
                  · Letter #{(status.activeLetterIndex ?? 0) + 1} (
                  {conversion.letters[status.activeLetterIndex ?? 0]?.letter}) ·{' '}
                  <strong>
                    Number {status.activeNumber} → {status.activeSoundName}
                  </strong>{' '}
                  · Bar {status.activeBarNumber ?? 1}, Beat{' '}
                  {status.activeBeatInBar}/{tsSpec.beatsPerBar} (
                  {tsSpec.id})
                </>
              ) : (
                `State: ${status.state.toUpperCase()} · ${timeline.pulseDefinition} (${timeline.stepDurationSeconds.toFixed(
                  3
                )}s per beat)`
              )}
            </span>
            <span className="mono-time">{formatTime(status.totalDuration)}</span>
          </div>

          <input
            type="range"
            min={0}
            max={status.totalDuration || 1}
            step={0.01}
            value={status.currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="timeline-slider"
            aria-label="Composition progress bar"
          />
        </div>
      </div>

      {/* Step 5, 6, 10 & 11: Tempo Slider (40–200 BPM), Three-Layer Mixer & Live Time Signature Beat Indicator */}
      <div className="mixer-and-tempo-grid">
        {/* 1. User-Controlled Tempo Control (40–200 BPM, default 100 BPM) */}
        <div className="mixer-card">
          <div className="mixer-card-top">
            <span className="section-kicker">
              STEP 10 // USER-CONTROLLED TEMPO & PULSE DEFINITION
            </span>
            <span className="bpm-readout-badge">{bpm} BPM</span>
          </div>
          <p className="mixer-help">
            Controls the timing of the foreground sound sequence, percussion
            beat, and theme accompaniment ({MIN_BPM}–{MAX_BPM} BPM, default 100
            BPM).
            <br />
            <strong style={{ color: '#B8FF01' }}>
              Pulse definition ({tsSpec.id}):
            </strong>{' '}
            {timeline.pulseDefinition}
          </p>
          <div className="tempo-control-row">
            <span className="mono-time">{MIN_BPM}</span>
            <input
              type="range"
              min={MIN_BPM}
              max={MAX_BPM}
              step={1}
              value={bpm}
              onChange={(e) => onBpmChange(Number(e.target.value))}
              className="timeline-slider"
              aria-label="Tempo in BPM"
            />
            <span className="mono-time">{MAX_BPM}</span>
            <input
              type="number"
              min={MIN_BPM}
              max={MAX_BPM}
              value={bpm}
              onChange={(e) => onBpmChange(Number(e.target.value))}
              className="bpm-number-input"
              aria-label="Exact BPM number"
            />
            <button
              type="button"
              className="btn-mute"
              onClick={() => onBpmChange(100)}
              title="Reset to default 100 BPM"
            >
              100 BPM
            </button>
          </div>
        </div>

        {/* 2. Three-Layer Independent Volume & Mute Mixer */}
        <div className="mixer-card">
          <div className="mixer-card-top">
            <span className="section-kicker">
              STEP 11 // THREE-LAYER MIXER (SOUNDS, PERCUSSION & THEME)
            </span>
          </div>

          {/* Layer 1: Main Foreground Sound Sequence Volume */}
          <div className="channel-strip-row">
            <div className="channel-strip-header">
              <span className="channel-label">Layer 1 · Sounds (0–26):</span>
              <button
                type="button"
                className={`btn-mute ${status.isMainMuted ? 'muted' : ''}`}
                onClick={onToggleMainMute}
                aria-pressed={status.isMainMuted}
              >
                {status.isMainMuted ? '🔇 Muted' : '🔊 Sounds On'}
              </button>
            </div>
            <div className="channel-strip-controls">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={status.isMainMuted ? 0 : status.mainVolume}
                onChange={(e) => onMainVolumeChange(parseFloat(e.target.value))}
                className="volume-slider"
                aria-label="Main sound sequence volume"
              />
              <span className="mono-vol">
                {status.isMainMuted
                  ? '0%'
                  : `${Math.round(status.mainVolume * 100)}%`}
              </span>
            </div>
          </div>

          {/* Layer 2: Separate Background Percussion Volume & Mute Toggle */}
          <div className="channel-strip-row">
            <div className="channel-strip-header">
              <span className="channel-label">
                Layer 2 · Perc ({conversion.selectedPercussion.instrumentName}):
              </span>
              <button
                type="button"
                className={`btn-mute ${status.isPercussionMuted ? 'muted' : ''}`}
                onClick={onTogglePercussionMute}
                aria-pressed={status.isPercussionMuted}
              >
                {status.isPercussionMuted ? '🔇 Perc Muted' : '🥁 Perc On'}
              </button>
            </div>
            <div className="channel-strip-controls">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={status.isPercussionMuted ? 0 : status.percussionVolume}
                onChange={(e) =>
                  onPercussionVolumeChange(parseFloat(e.target.value))
                }
                className="volume-slider"
                aria-label="Background percussion volume"
              />
              <span className="mono-vol">
                {status.isPercussionMuted
                  ? '0%'
                  : `${Math.round(status.percussionVolume * 100)}%`}
              </span>
            </div>
          </div>

          {/* Layer 3: Separate Musical Theme Volume & Mute Toggle */}
          <div className="channel-strip-row">
            <div className="channel-strip-header">
              <span className="channel-label">
                Layer 3 · Theme ({activeStyleSpec.styleName}):
              </span>
              <button
                type="button"
                className={`btn-mute ${status.isAccompanimentMuted ? 'muted' : ''}`}
                onClick={onToggleAccompanimentMute}
                aria-pressed={status.isAccompanimentMuted}
              >
                {status.isAccompanimentMuted ? '🔇 Theme Muted' : '🎼 Theme On'}
              </button>
            </div>
            <div className="channel-strip-controls">
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={status.isAccompanimentMuted ? 0 : status.accompanimentVolume}
                onChange={(e) =>
                  onAccompanimentVolumeChange(parseFloat(e.target.value))
                }
                className="volume-slider"
                aria-label="Musical theme accompaniment volume"
              />
              <span className="mono-vol">
                {status.isAccompanimentMuted
                  ? '0%'
                  : `${Math.round(status.accompanimentVolume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Live Time Signature & Beat Grouping Indicator (Step 5 & Step 9) */}
        <div className="mixer-card">
          <div className="mixer-card-top">
            <span className="section-kicker">
              STEP 5 & 6 // {tsSpec.id} BEAT GROUPING ({tsSpec.groupingLabel})
            </span>
            <span className="mono-time">
              {conversion.selectedPercussion.instrumentName} (T = P = {conversion.percussionModulo})
            </span>
          </div>
          <p className="mixer-help">
            <strong>{tsSpec.id}:</strong> {tsSpec.interpretation} · Grouped
            as <code>{tsSpec.groupingLabel}</code>:
          </p>
          <div
            className="percussion-beat-lamps"
            role="status"
          >
            {beatMetadataList.map((bMeta) => {
              const isBeatActive =
                isPlayingOrPaused &&
                status.activeBeatInBar === bMeta.beatNumber &&
                !status.isPercussionMuted;
              const roleLabel =
                bMeta.beatNumber === 1
                  ? 'Bar Downbeat'
                  : bMeta.isGroupStart
                  ? `Group ${bMeta.groupIndex} Accent`
                  : `Group ${bMeta.groupIndex}.${bMeta.beatInGroup}`;

              return (
                <div
                  key={`beat-lamp-${bMeta.beatNumber}`}
                  className={`beat-lamp ${isBeatActive ? 'lamp-active' : ''} ${
                    bMeta.beatNumber === 1
                      ? 'downbeat'
                      : bMeta.isGroupStart
                      ? 'group-accent'
                      : ''
                  }`}
                >
                  <span className="lamp-num">BEAT {bMeta.beatNumber}</span>
                  <span className="lamp-role">{roleLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 7 & Step 8: Six Preloaded Musical Themes + Mathematical Suggestion (M = G % 6) */}
      <div className="manifest-studio-box" style={{ marginTop: '1.5rem' }}>
        <div className="manifest-studio-header">
          <div>
            <span className="section-kicker">
              STEP 7 & STEP 8 // SIX PRELOADED MUSICAL THEMES & MATHEMATICAL SUGGESTION (M = G % 6)
            </span>
            <h3 style={{ fontSize: '1.35rem', marginTop: '0.2rem' }}>
              Your Name’s Suggested Theme:{' '}
              <span style={{ color: '#B8FF01' }}>
                {conversion.suggestedTheme.styleName}
              </span>{' '}
              (<code>G = {conversion.weightedSumG}</code>,{' '}
              <code>
                M = {conversion.weightedSumG} % 6 = {conversion.themeModuloM}
              </code>
              ) · Currently Selected:{' '}
              <span style={{ color: isThemeOverridden ? '#F7C6D9' : '#B8FF01' }}>
                {activeStyleSpec.styleName}
              </span>
            </h3>
            <p className="manifest-help">
              Weighted position formula:{' '}
              <code>
                G ={' '}
                {conversion.weightedTerms
                  .map((t) => `${t.position}×${t.alphabetValue}`)
                  .join(' + ')}{' '}
                = {conversion.weightedSumG}
              </code>{' '}
              → <code>M = {conversion.weightedSumG} % 6 = {conversion.themeModuloM}</code>{' '}
              → <strong>{conversion.suggestedTheme.styleName}</strong>. You can
              freely switch to any of the 6 preloaded themes below without
              changing your name’s Fibonacci sequences,{' '}
              <strong>{tsSpec.id}</strong> time signature,{' '}
              <strong>{conversion.selectedPercussion.instrumentName}</strong>{' '}
              percussion, or BPM!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            {isThemeOverridden && (
              <button
                type="button"
                className="pill-toggle"
                onClick={() => onStyleChange(conversion.suggestedTheme.id)}
              >
                ↺ Reset to Suggested Theme ({conversion.suggestedTheme.styleName})
              </button>
            )}
            <button
              type="button"
              className="pill-toggle"
              onClick={() => onPreviewStyle(selectedStyleId)}
            >
              🔊 Preview {activeStyleSpec.styleName} Theme
            </button>
          </div>
        </div>

        <div className="sound-manifest-grid">
          {ALL_INSTRUMENTAL_STYLES.map((styleSpec) => {
            const isSelected = styleSpec.id === selectedStyleId;
            const isSuggested = styleSpec.id === conversion.suggestedTheme.id;
            const styleSamples = accompanimentManifest.filter(
              (a) => a.styleId === styleSpec.id
            );
            const allSamplesLoaded =
              styleSamples.length > 0 &&
              styleSamples.every((a) => a.status === 'loaded');

            return (
              <div
                key={styleSpec.id}
                className={`sound-asset-card ${
                  allSamplesLoaded ? 'asset-loaded' : 'asset-missing'
                } ${
                  isPlaying && isSelected && !status.isAccompanimentMuted
                    ? 'asset-triggering-now'
                    : ''
                }`}
                style={
                  isSelected
                    ? {
                        borderColor: '#B8FF01',
                        boxShadow: '0 0 0 2px rgba(184, 255, 1, 0.35)',
                      }
                    : isSuggested
                    ? {
                        borderColor: 'rgba(247, 198, 217, 0.65)',
                      }
                    : undefined
                }
              >
                <div className="asset-card-top">
                  <span className="asset-letter-badge">
                    M = {styleSpec.moduloValue}
                    {isSuggested ? ' · ★ SUGGESTED FOR NAME' : ''}
                    {isSelected ? ' · ACTIVE' : ''}
                  </span>
                  <span
                    className={`asset-status-pill ${
                      allSamplesLoaded ? 'loaded' : 'missing'
                    }`}
                  >
                    {allSamplesLoaded
                      ? `● 3/3 INSTRUMENTS READY`
                      : '⏳ LOADING'}
                  </span>
                </div>

                <div className="asset-sound-title">
                  🎼 {styleSpec.styleName}
                </div>
                <div
                  className="asset-filename"
                  style={{ color: '#B8FF01', marginBottom: '0.25rem' }}
                >
                  Instruments: <strong>{styleSpec.instruments.join(' · ')}</strong>
                </div>
                <p className="asset-tip">{styleSpec.arrangementDescription}</p>
                <div
                  className="asset-source-note"
                  style={{ opacity: 0.85, fontSize: '0.78rem' }}
                >
                  Meter & harmony: {styleSpec.harmonyApproach}
                </div>

                <div className="asset-actions" style={{ marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className={`btn-asset-action ${
                      isSelected ? 'recording-active' : ''
                    }`}
                    style={
                      isSelected
                        ? {
                            background: '#B8FF01',
                            color: '#0C0A0E',
                            fontWeight: 700,
                          }
                        : undefined
                    }
                    onClick={() => onStyleChange(styleSpec.id)}
                    aria-pressed={isSelected}
                  >
                    {isSelected
                      ? `✓ Selected: ${styleSpec.styleName}`
                      : `Use ${styleSpec.styleName} Theme`}
                  </button>

                  <button
                    type="button"
                    className="btn-asset-action audition"
                    onClick={() => onPreviewStyle(styleSpec.id)}
                  >
                    🔊 Preview Theme
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3 & Step 4: Dedicated Editable Sound Library Section */}
      <div
        id="editable-sound-library-section"
        className="manifest-studio-box"
        style={{ marginTop: '1.75rem' }}
      >
        <div className="manifest-studio-header">
          <div>
            <span className="section-kicker">
              STEP 3 & STEP 4 // PRELOADED & EDITABLE SOUND LIBRARY (0 TO 26)
            </span>
            <h3 style={{ fontSize: '1.35rem', marginTop: '0.2rem' }}>
              Sound Library (
              {showAll27
                ? 'All 27 Preloaded Number Sounds 0–26'
                : `Sounds Used in “${conversion.normalizedName}” (${summary.requiredByName.length})`}
              )
            </h3>
            <p className="manifest-help">
              All 27 default human sounds (<code>0 = Snap</code>,{' '}
              <code>1 = Clap</code>, <code>2 = Tongue click</code> …{' '}
              <code>26 = Rubbing palms together</code>) are preloaded and ready
              immediately. Click <strong>🎙 Record / Replace</strong> on any
              sound to record your own take using the staged{' '}
              <strong>Start → Stop → Preview → Save / Cancel</strong> workflow,
              or click <strong>↺ Restore Default</strong> at any time.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="pill-toggle"
              onClick={() => setShowAll27((v) => !v)}
            >
              {showAll27
                ? `Filter to Sounds in “${conversion.normalizedName}” (${summary.requiredByName.length})`
                : 'Show All 27 Number Sounds (0–26)'}
            </button>
            <a
              href="#composition-player-section"
              className="pill-toggle"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              ↑ Back to Composition Player
            </a>
          </div>
        </div>

        {/* Persistence & Backup Bar (IndexedDB + Export/Import JSON + Restore All) */}
        <div
          className="mixer-card"
          style={{
            marginBottom: '1.25rem',
            border: '1px solid rgba(184, 255, 1, 0.35)',
            background: 'rgba(18, 22, 28, 0.9)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong style={{ color: '#B8FF01' }}>
                💾 Automatic Browser Persistence (IndexedDB) & Backup:
              </strong>{' '}
              <span className="manifest-help">
                Custom recordings are automatically saved in your browser’s
                IndexedDB so they stay active after refreshing or reopening the
                page. Note: clearing browser site data or using private browsing
                can erase IndexedDB storage — use{' '}
                <strong>Export Custom Backup</strong> below to keep a permanent
                copy of your custom recordings.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-asset-action"
                onClick={handleExportBackupClick}
              >
                ⬇ Export Custom Backup (.json)
              </button>
              <label className="btn-asset-action file-label">
                ⬆ Import Custom Backup (.json)
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleImportBackupFile(file);
                    e.target.value = '';
                  }}
                  hidden
                />
              </label>
              {customCount > 0 && (
                <button
                  type="button"
                  className="btn-asset-action"
                  onClick={async () => {
                    await onRestoreAllDefaults();
                    setBackupNotice(
                      'Restored all 27 number sounds and 6 percussion sounds to their preloaded defaults.'
                    );
                  }}
                >
                  ↺ Restore All Defaults ({customCount} custom)
                </button>
              )}
            </div>
          </div>
          {backupNotice && (
            <div
              style={{
                marginTop: '0.6rem',
                color: '#B8FF01',
                fontSize: '0.88rem',
              }}
              role="status"
            >
              ✓ {backupNotice}
            </div>
          )}
        </div>

        {/* Staged Recording Modal / Banner when replacing a sound (Step 4 Workflow) */}
        {staged && (
          <div
            className="mixer-card"
            style={{
              marginBottom: '1.25rem',
              border: '2px solid #FF2A3C',
              background: '#161118',
            }}
            role="region"
            aria-label={`Recording replacement studio for ${staged.label}`}
          >
            <div className="mixer-card-top">
              <span className="section-kicker" style={{ color: '#FF2A3C' }}>
                STEP 4 // STAGED RECORDING WORKFLOW — REPLACING{' '}
                {staged.label.toUpperCase()}
              </span>
              <span className="mono-time">
                {staged.isRecording
                  ? '🔴 RECORDING IN PROGRESS…'
                  : staged.blob
                  ? `✓ CANDIDATE READY (${staged.durationSeconds ?? 0}s) — PREVIEW BEFORE SAVING`
                  : 'READY TO RECORD OR CHOOSE FILE'}
              </span>
            </div>
            <p className="mixer-help" style={{ marginBottom: '0.75rem' }}>
              1. Click <strong>🎙 Start Recording</strong> (requests microphone
              permission if needed) and perform the sound, then click{' '}
              <strong>⏹ Stop Recording</strong>. 2. Click{' '}
              <strong>▶ Preview New Recording</strong> to listen to your take.
              3. Click <strong>✓ Save Recording</strong> to make it active
              everywhere, or <strong>✕ Cancel</strong> to keep the previous
              sound unchanged.
            </p>

            {recordingError && (
              <div
                className="recording-error-alert"
                role="alert"
                style={{ marginBottom: '0.75rem' }}
              >
                {recordingError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '0.65rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {!staged.isRecording ? (
                <button
                  type="button"
                  className="btn-asset-action"
                  onClick={handleStartCandidateRecording}
                >
                  🎙 {staged.blob ? 'Re-Record Microphone' : 'Start Recording'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-asset-action recording-active"
                  onClick={handleStopCandidateRecording}
                >
                  ⏹ Stop Recording
                </button>
              )}

              <label className="btn-asset-action file-label">
                📁 Or Choose Audio File
                <input
                  type="file"
                  accept="audio/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await handleStageAudioFile(file);
                    e.target.value = '';
                  }}
                  hidden
                />
              </label>

              <button
                type="button"
                className="btn-asset-action audition"
                disabled={!staged.blob || staged.isRecording}
                onClick={handlePreviewStagedCandidate}
              >
                ▶ Preview New Recording
                {staged.durationSeconds ? ` (${staged.durationSeconds}s)` : ''}
              </button>

              <button
                type="button"
                className="btn-transport primary-play"
                style={{ padding: '0.45rem 1rem', fontSize: '0.88rem' }}
                disabled={!staged.blob || staged.isRecording}
                onClick={handleSaveStagedCandidate}
              >
                ✓ Save Recording
              </button>

              <button
                type="button"
                className="btn-asset-action"
                onClick={handleCancelStagedCandidate}
              >
                ✕ Cancel (Keep Previous Sound)
              </button>
            </div>
          </div>
        )}

        {/* 27 Number Sounds Grid (0..26) */}
        <div className="sound-manifest-grid">
          {numberManifest
            .filter((item) =>
              showAll27 ? true : summary.requiredByName.includes(item.number)
            )
            .map((item) => {
              const isLoaded = item.status === 'loaded';
              const isCustom = Boolean(item.isCustom);
              const recKey = `num-${item.number}`;
              const isStagingThis = staged?.targetKey === recKey;
              const isCurrentlyTriggering =
                status.state === 'playing' &&
                status.activeNumber === item.number;
              const isUsedInCurrentName = summary.requiredByName.includes(
                item.number
              );

              return (
                <div
                  key={item.number}
                  className={`sound-asset-card ${
                    isLoaded ? 'asset-loaded' : 'asset-missing'
                  } ${isCurrentlyTriggering ? 'asset-triggering-now' : ''}`}
                  style={
                    isStagingThis
                      ? { outline: '2px solid #FF2A3C' }
                      : isCustom
                      ? { borderColor: '#B8FF01' }
                      : undefined
                  }
                >
                  <div className="asset-card-top">
                    <span className="asset-letter-badge">
                      #{item.number} {isUsedInCurrentName ? '· IN NAME' : ''}
                    </span>
                    <span
                      className={`asset-status-pill ${
                        isLoaded ? 'loaded' : 'missing'
                      }`}
                      style={
                        isCustom
                          ? {
                              background: 'rgba(184, 255, 1, 0.2)',
                              color: '#B8FF01',
                              borderColor: '#B8FF01',
                            }
                          : undefined
                      }
                    >
                      {isCustom
                        ? `★ CUSTOM (${item.durationSeconds ?? 0}s)`
                        : isLoaded
                        ? `● ORIGINAL .M4A (${item.durationSeconds ?? 0}s)`
                        : item.status === 'error'
                        ? '⚠ CODEC ERROR'
                        : item.status === 'missing'
                        ? '✕ MISSING .M4A'
                        : '⏳ LOADING'}
                    </span>
                  </div>

                  <div className="asset-sound-title">{item.soundName}</div>
                  <div className="asset-filename">
                    <code>public/sounds/{item.filename}</code>
                  </div>
                  <p className="asset-tip">{item.recordingTip}</p>
                  {item.sourceNote && (
                    <div className="asset-source-note">✓ {item.sourceNote}</div>
                  )}
                  {item.errorMessage && (
                    <div
                      className="recording-error-alert"
                      role="alert"
                      style={{ marginTop: '0.4rem', fontSize: '0.78rem' }}
                    >
                      {item.errorMessage}
                    </div>
                  )}

                  <div className="asset-actions">
                    {isLoaded && (
                      <button
                        type="button"
                        className="btn-asset-action audition"
                        onClick={() => onPreviewNumberSound(item.number)}
                        aria-label={`Preview sound ${item.number}: ${item.soundName}`}
                      >
                        🔊 Preview
                      </button>
                    )}

                    <button
                      type="button"
                      className={`btn-asset-action ${
                        isStagingThis ? 'recording-active' : ''
                      }`}
                      onClick={() =>
                        openStagedEditorForNumber(item.number, item.soundName)
                      }
                    >
                      🎙 {isCustom ? 'Replace Again' : 'Record / Replace'}
                    </button>

                    <button
                      type="button"
                      className="btn-asset-action"
                      disabled={!isCustom}
                      onClick={() => onRestoreDefaultNumberSound(item.number)}
                      title={
                        isCustom
                          ? `Restore your original iPhone Voice Memo (${item.filename})`
                          : `Original recording (${item.filename}) is already active`
                      }
                    >
                      ↺ Restore Original (.m4a)
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Step 6: Percussion Instrument Library (6 Preloaded Percussion Sounds P = S % 6) */}
      <div className="manifest-studio-box" style={{ marginTop: '1.5rem' }}>
        <div className="manifest-studio-header">
          <div>
            <span className="section-kicker">
              STEP 6 // PRELOADED BACKGROUND PERCUSSION INSTRUMENTS (P = S % 6)
            </span>
            <h3>
              Background Percussion Library (
              {showAll6Perc
                ? 'All 6 Preloaded Percussion Instruments'
                : `Selected for “${conversion.normalizedName}”: ${conversion.selectedPercussion.instrumentName}`}
              )
            </h3>
            <p className="manifest-help">
              Formula: <code>S = {conversion.letterSum}</code> →{' '}
              <code>
                P = {conversion.letterSum} % 6 = {conversion.percussionModulo}
              </code>{' '}
              → <strong>{conversion.selectedPercussion.instrumentName}</strong>.
              All 6 percussion sounds are preloaded separately from the 27
              foreground number sounds.
            </p>
          </div>
          <button
            type="button"
            className="pill-toggle"
            onClick={() => setShowAll6Perc((v) => !v)}
          >
            {showAll6Perc
              ? `Show Only Selected Percussion (${conversion.selectedPercussion.instrumentName})`
              : 'Show All 6 Percussion Instruments (P = 0..5)'}
          </button>
        </div>

        <div className="sound-manifest-grid">
          {percussionManifest
            .filter((p) =>
              showAll6Perc ? true : p.id === conversion.selectedPercussion.id
            )
            .map((perc) => {
              const isLoaded = perc.status === 'loaded';
              const isCustom = Boolean(perc.isCustom);
              const isSelectedForName =
                perc.id === conversion.selectedPercussion.id;
              const recKey = `perc-${perc.id}`;
              const isStagingThis = staged?.targetKey === recKey;

              return (
                <div
                  key={perc.id}
                  className={`sound-asset-card ${
                    isLoaded ? 'asset-loaded' : 'asset-missing'
                  } ${
                    isPlaying && isSelectedForName && !status.isPercussionMuted
                      ? 'asset-triggering-now'
                      : ''
                  }`}
                >
                  <div className="asset-card-top">
                    <span className="asset-letter-badge">
                      P = {perc.moduloValue}
                    </span>
                    <span
                      className={`asset-status-pill ${
                        isLoaded ? 'loaded' : 'missing'
                      }`}
                    >
                      {isCustom
                        ? `★ CUSTOM (${perc.durationSeconds ?? 0}s)`
                        : isLoaded
                        ? `● DEFAULT (${perc.durationSeconds ?? 0}s)`
                        : '⏳ LOADING'}
                    </span>
                  </div>

                  <div className="asset-sound-title">
                    🥁 {perc.instrumentName}{' '}
                    {isSelectedForName && (
                      <small style={{ color: '#B8FF01' }}>(SELECTED)</small>
                    )}
                  </div>
                  <div className="asset-filename">
                    <code>public{perc.publicPath}</code>
                  </div>
                  <p className="asset-tip">{perc.recordingTip}</p>
                  {perc.sourceNote && (
                    <div className="asset-source-note">✓ {perc.sourceNote}</div>
                  )}

                  <div className="asset-actions">
                    {isLoaded && (
                      <button
                        type="button"
                        className="btn-asset-action audition"
                        onClick={() => onPreviewPercussionSound(perc.id)}
                      >
                        🔊 Preview
                      </button>
                    )}

                    <button
                      type="button"
                      className={`btn-asset-action ${
                        isStagingThis ? 'recording-active' : ''
                      }`}
                      onClick={() =>
                        openStagedEditorForPercussion(
                          perc.id,
                          perc.instrumentName
                        )
                      }
                    >
                      🎙 {isCustom ? 'Replace Again' : 'Record / Replace'}
                    </button>

                    <button
                      type="button"
                      className="btn-asset-action"
                      disabled={!isCustom}
                      onClick={() => onRestoreDefaultPercussionSound(perc.id)}
                    >
                      ↺ Restore Default
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
};
