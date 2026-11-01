/**
 * src/App.tsx
 * -----------
 * Main interactive interface for the Updated Antigravity Brief:
 * "The Sound of a Name" — Three-Layer Composition System:
 *   - Layer 1: Recorded human sound sequence from complete Fibonacci-modulo cycles (0..26)
 *   - Layer 2: Name-derived Time Signature (T = S % 6) & Percussion Beat (P = S % 6)
 *   - Layer 3: Mathematically Suggested Musical Theme (G = Σ(i × xᵢ), M = G % 6)
 *              with manual override across all 6 preloaded themes
 *   - User-controlled tempo (default 100 BPM, range 40–200 BPM) shared by all 3 layers
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_INSTRUMENTAL_STYLES,
  DEFAULT_BPM,
  getInstrumentalStyleById,
} from './engine/config';
import { convertNameToSoundSequence } from './engine/mathEngine';
import type {
  InstrumentalStyleId,
  NameConversionResult,
} from './engine/types';
import { summarizeManifestForName } from './audio/assetManifest';
import { SoundOfNameAudioEngine } from './audio/audioEngine';
import { buildContinuousTimeline, clampBpm } from './audio/audioSequencer';
import type {
  AccompanimentSoundAsset,
  NumberSoundAsset,
  PercussionSoundAsset,
  PlayerStatus,
} from './audio/types';
import { AudioPlayerPanel } from './components/AudioPlayerPanel';
import { ExplanationPanel } from './components/ExplanationPanel';
import { PosterExportPanel } from './components/PosterExportPanel';
import { VisualScore } from './components/VisualScore';

const PRESET_EXAMPLES = [
  { label: 'SHIVANA (S=74 · 5/4 · Leg thump · Pop)', value: 'SHIVANA' },
  { label: 'RAMESH (S=64 · 7/8 · Sneeze · Pop)', value: 'RAMESH' },
  { label: 'SAHANA RAMESH (With Space · 5/4 · Leg thump)', value: 'SAHANA RAMESH' },
  { label: 'A (S=1 · 4/4 · Clap · Jazz)', value: 'A' },
  { label: 'B (S=2 · 5/4 · Leg thump · Rock)', value: 'B' },
  { label: 'C (S=3 · 6/8 · Lip pop · Classical)', value: 'C' },
  { label: 'D (S=4 · 7/8 · Sneeze · Reggae)', value: 'D' },
  { label: 'E (S=5 · 12/8 · Tongue click · Carnatic)', value: 'E' },
  { label: 'F (S=6 · 3/4 · Snap · Pop)', value: 'F' },
  { label: 'HANNAH (Repeated Letters)', value: 'HANNAH' },
];

export const App: React.FC = () => {
  const [inputText, setInputText] = useState<string>('RAMESH');
  const [submittedName, setSubmittedName] = useState<string>('RAMESH');
  const [bpm, setBpm] = useState<number>(DEFAULT_BPM);
  const [inputError, setInputError] = useState<string | null>(null);
  const [selectedLetterIndex, setSelectedLetterIndex] = useState<number>(0);

  const conversion: NameConversionResult = useMemo(() => {
    try {
      return convertNameToSoundSequence(submittedName);
    } catch {
      return convertNameToSoundSequence('RAMESH');
    }
  }, [submittedName]);

  // Step 8: Select the mathematically suggested theme by default when a name is entered,
  // while allowing the user to manually switch to any of the six themes at any time.
  const [selectedStyleId, setSelectedStyleId] = useState<InstrumentalStyleId>(
    () => conversion.suggestedTheme.id
  );

  const audioEngineRef = useRef<SoundOfNameAudioEngine | null>(null);
  if (!audioEngineRef.current && typeof window !== 'undefined') {
    audioEngineRef.current = new SoundOfNameAudioEngine();
  }

  const [numberManifest, setNumberManifest] = useState<NumberSoundAsset[]>(
    () =>
      audioEngineRef.current ? audioEngineRef.current.getNumberManifest() : []
  );
  const [percussionManifest, setPercussionManifest] = useState<
    PercussionSoundAsset[]
  >(() =>
    audioEngineRef.current
      ? audioEngineRef.current.getPercussionManifest()
      : []
  );
  const [accompanimentManifest, setAccompanimentManifest] = useState<
    AccompanimentSoundAsset[]
  >(() =>
    audioEngineRef.current
      ? audioEngineRef.current.getAccompanimentManifest()
      : []
  );

  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>({
    state: 'idle',
    bpm: DEFAULT_BPM,
    currentTime: 0,
    totalDuration: 0,
    progressPercent: 0,
    mainVolume: 0.92,
    isMainMuted: false,
    percussionVolume: 0.45,
    isPercussionMuted: false,
    accompanimentVolume: 0.42,
    isAccompanimentMuted: false,
    selectedStyleId: conversion.suggestedTheme.id,
    activeGlobalStepIndex: null,
    activeLetterIndex: null,
    activeStepInLetter: null,
    activeNumber: null,
    activeSoundName: null,
    activeBarNumber: null,
    activeBeatInBar: null,
    activeGroupIndexInBar: null,
    isGroupStartActive: false,
    isPercussionHitActive: false,
  });

  const timeline = useMemo(
    () =>
      buildContinuousTimeline(
        conversion,
        numberManifest,
        bpm,
        selectedStyleId
      ),
    [conversion, numberManifest, bpm, selectedStyleId]
  );

  const librarySummary = useMemo(
    () =>
      summarizeManifestForName(
        numberManifest,
        percussionManifest,
        conversion.uniqueNumbersUsed,
        conversion.selectedPercussion.id,
        accompanimentManifest,
        selectedStyleId
      ),
    [
      numberManifest,
      percussionManifest,
      conversion.uniqueNumbersUsed,
      conversion.selectedPercussion.id,
      accompanimentManifest,
      selectedStyleId,
    ]
  );

  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    const unsubStatus = engine.subscribeStatus((st) => setPlayerStatus(st));
    const unsubManifest = engine.subscribeManifest((numMf, percMf, accMf) => {
      setNumberManifest([...numMf]);
      setPercussionManifest([...percMf]);
      setAccompanimentManifest([...accMf]);
    });

    engine.loadManifestAssets();

    return () => {
      unsubStatus();
      unsubManifest();
      engine.stop();
    };
  }, []);

  const prevNameRef = useRef<string>(conversion.normalizedName);

  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;

    if (prevNameRef.current !== conversion.normalizedName) {
      prevNameRef.current = conversion.normalizedName;
      engine.setTimelineForNewName(timeline);
      setSelectedLetterIndex(0);
    } else {
      // Smoothly update timing AND/OR instrumental style during playback without restarting
      engine.updateTimelineWithNewBpm(timeline);
    }
  }, [conversion.normalizedName, timeline]);

  useEffect(() => {
    if (
      playerStatus.state === 'playing' &&
      playerStatus.activeLetterIndex !== null
    ) {
      setSelectedLetterIndex(playerStatus.activeLetterIndex);
    }
  }, [playerStatus.state, playerStatus.activeLetterIndex]);

  const applyNewSubmittedName = (rawName: string) => {
    const nextConversion = convertNameToSoundSequence(rawName);
    setSubmittedName(rawName);
    // Automatically select the name's mathematically suggested theme (Step 8)
    setSelectedStyleId(nextConversion.suggestedTheme.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inputText.toUpperCase().replace(/[^A-Z]/g, '');
    if (cleaned.length === 0) {
      setInputError(
        'Please enter at least one alphabetic letter (A–Z). Spaces and punctuation are ignored.'
      );
      return;
    }
    setInputError(null);
    applyNewSubmittedName(inputText);
  };

  const handlePresetClick = (val: string) => {
    setInputError(null);
    setInputText(val);
    applyNewSubmittedName(val);
  };

  const handleBpmChange = (nextBpm: number) => {
    setBpm(clampBpm(nextBpm));
  };

  const handleSeekToStep = (globalStepIndex: number) => {
    const ev = timeline.events[globalStepIndex];
    if (!ev || !audioEngineRef.current) return;
    audioEngineRef.current.seek(ev.startTimeSeconds);
  };

  const activeStyleSpec = getInstrumentalStyleById(selectedStyleId);
  const isThemeOverridden = selectedStyleId !== conversion.suggestedTheme.id;

  return (
    <div className="app-shell">
      <header className="editorial-header">
        <div className="masthead-top-row">
          <span className="masthead-issue">
            THE SOUND OF A NAME // FIBONACCI-MODULO SOUND, TIME SIGNATURE, PERCUSSION & THEME ENGINE
          </span>
          <span className="masthead-determinism">
            SOUNDS (0–26) · TIME SIG (T = S % 6) · PERCUSSION (P = S % 6) · THEME (M = G % 6) · 40–200 BPM
          </span>
        </div>

        <div className="masthead-hero">
          <div className="hero-title-col">
            <h1 className="display-title">THE SOUND OF A NAME</h1>
            <p className="editorial-lead">
              Transforms any name into a three-layer musical composition:
              (1) complete Fibonacci-modulo sequences triggering{' '}
              <strong>27 recorded human sounds</strong> (<code>0 = Snap … 26 = Rubbing palms together</code>),
              (2) a repeating background beat in your name’s mathematically derived{' '}
              <strong>{conversion.selectedTimeSignature.id}</strong> time signature
              (<code>T = S % 6</code>) on{' '}
              <strong>{conversion.selectedPercussion.instrumentName}</strong> (<code>P = S % 6</code>),
              and (3) a <strong>{activeStyleSpec.styleName}</strong> musical theme
              (suggested via <code>M = G % 6</code>) at <strong>{bpm} BPM</strong>.
            </p>
          </div>

          <div className="hero-form-col">
            <form onSubmit={handleSubmit} className="name-entry-form" noValidate>
              <label htmlFor="name-input-field" className="form-kicker">
                STEP 1 // ENTER ANY NAME TO GENERATE ITS COMPOSITION
              </label>
              <div className="input-action-row">
                <input
                  id="name-input-field"
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="e.g. RAMESH"
                  maxLength={48}
                  className="name-input"
                  aria-invalid={Boolean(inputError)}
                />
                <button type="submit" className="btn-generate">
                  Convert Name →
                </button>
              </div>
              {inputError && (
                <div className="form-error-msg" role="alert">
                  {inputError}
                </div>
              )}
            </form>

            <div className="preset-strip" aria-label="Preset test names">
              <span className="preset-label">
                Try verified test names (covers all 6 time signatures, 6 percussion sounds & 6 themes):
              </span>
              <div className="preset-buttons">
                {PRESET_EXAMPLES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`preset-chip ${
                      submittedName.toUpperCase() === p.value.toUpperCase()
                        ? 'active-preset'
                        : ''
                    }`}
                    onClick={() => handlePresetClick(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="preset-strip"
              style={{ marginTop: '0.75rem' }}
              aria-label="Musical theme quick selector"
            >
              <span className="preset-label">
                Step 7 & 8 — Musical Theme (Your name’s suggested theme:{' '}
                <strong style={{ color: '#B8FF01' }}>
                  {conversion.suggestedTheme.styleName}
                </strong>{' '}
                via <code>G={conversion.weightedSumG}, M={conversion.themeModuloM}</code>):
              </span>
              <div className="preset-buttons">
                {ALL_INSTRUMENTAL_STYLES.map((style) => {
                  const isSuggested = style.id === conversion.suggestedTheme.id;
                  const isSelected = selectedStyleId === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      className={`preset-chip ${
                        isSelected ? 'active-preset' : ''
                      }`}
                      onClick={() => setSelectedStyleId(style.id)}
                    >
                      🎼 {style.styleName}
                      {isSuggested ? ' ★ Suggested' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="editorial-main">
        {/* Top Summary Telemetry Banner */}
        <section className="telemetry-banner" aria-label="Composition overview">
          <div className="telemetry-card primary-card">
            <span className="telemetry-label">1. NORMALIZED NAME & SUM (S)</span>
            <div className="telemetry-value-xl telemetry-name-token">
              {conversion.normalizedName}
            </div>
            <span className="telemetry-sub">
              {conversion.letters
                .map((l) => `${l.letter}=${l.alphabetValue}`)
                .join(', ')}{' '}
              · Sum S = {conversion.letterSum}
            </span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">
              2. TIME SIGNATURE & PERCUSSION (S % 6)
            </span>
            <div
              className="telemetry-value-xl accent-genre"
              style={{ fontSize: '1.45rem' }}
            >
              ⏱ {conversion.selectedTimeSignature.id} · 🥁{' '}
              {conversion.selectedPercussion.instrumentName}
            </div>
            <span className="telemetry-sub">
              <code>
                T = P = {conversion.letterSum} % 6 = {conversion.timeSignatureModulo}
              </code>{' '}
              · Grouping {conversion.selectedTimeSignature.groupingLabel}
            </span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">
              3. SUGGESTED VS. SELECTED THEME
            </span>
            <div
              className="telemetry-value-xl accent-genre"
              style={{ fontSize: '1.45rem' }}
            >
              🎼 {activeStyleSpec.styleName}
            </div>
            <span className="telemetry-sub">
              Suggested: <strong>{conversion.suggestedTheme.styleName}</strong> (
              <code>
                G={conversion.weightedSumG}, M={conversion.themeModuloM}
              </code>
              ){isThemeOverridden ? ' · Manual override' : ' · Default active'}
            </span>
          </div>

          <div className="telemetry-card">
            <span className="telemetry-label">4. TEMPO & LIVE NUMBER SOUND</span>
            <div
              className="telemetry-value-xl"
              style={{
                fontSize: '1.45rem',
                color:
                  playerStatus.activeNumber !== null ? '#FF2A3C' : '#B8FF01',
              }}
            >
              {playerStatus.activeNumber !== null
                ? `${playerStatus.activeNumber} → ${playerStatus.activeSoundName}`
                : `${bpm} BPM`}
            </div>
            <span className="telemetry-sub">
              {playerStatus.activeBeatInBar !== null
                ? `Bar ${playerStatus.activeBarNumber ?? 1} · Beat ${playerStatus.activeBeatInBar}/${conversion.selectedTimeSignature.beatsPerBar}`
                : timeline.pulseDefinition}
            </span>
          </div>
        </section>

        {/* Three-Layer Audio Player, Style Selector, Mixer & Editable Sound Library */}
        <AudioPlayerPanel
          conversion={conversion}
          timeline={timeline}
          status={playerStatus}
          bpm={bpm}
          onBpmChange={handleBpmChange}
          selectedStyleId={selectedStyleId}
          onStyleChange={setSelectedStyleId}
          numberManifest={numberManifest}
          percussionManifest={percussionManifest}
          accompanimentManifest={accompanimentManifest}
          summary={librarySummary}
          onPlay={() => audioEngineRef.current?.play()}
          onPause={() => audioEngineRef.current?.pause()}
          onStop={() => audioEngineRef.current?.stop()}
          onRestart={() => audioEngineRef.current?.restart()}
          onSeek={(sec) => audioEngineRef.current?.seek(sec)}
          onMainVolumeChange={(vol) =>
            audioEngineRef.current?.setMainVolume(vol)
          }
          onToggleMainMute={() => audioEngineRef.current?.toggleMainMute()}
          onPercussionVolumeChange={(vol) =>
            audioEngineRef.current?.setPercussionVolume(vol)
          }
          onTogglePercussionMute={() =>
            audioEngineRef.current?.togglePercussionMute()
          }
          onAccompanimentVolumeChange={(vol) =>
            audioEngineRef.current?.setAccompanimentVolume(vol)
          }
          onToggleAccompanimentMute={() =>
            audioEngineRef.current?.toggleAccompanimentMute()
          }
          onPreviewStyle={async (styleId) =>
            (await audioEngineRef.current?.previewInstrumentalStyle(styleId)) ??
            false
          }
          onPreviewCandidateBlob={async (blob) => {
            if (!audioEngineRef.current) {
              return { durationSeconds: 0 };
            }
            return audioEngineRef.current.previewCandidateBlob(blob);
          }}
          onUploadNumberSound={async (num, blob, note) => {
            await audioEngineRef.current?.registerNumberAudioBlob(
              num,
              blob,
              note
            );
          }}
          onRestoreDefaultNumberSound={async (num) => {
            await audioEngineRef.current?.restoreDefaultNumberSound(num);
          }}
          onPreviewNumberSound={async (num) =>
            (await audioEngineRef.current?.previewNumberSound(num)) ?? false
          }
          onUploadPercussionSound={async (id, blob, note) => {
            await audioEngineRef.current?.registerPercussionAudioBlob(
              id,
              blob,
              note
            );
          }}
          onRestoreDefaultPercussionSound={async (id) => {
            await audioEngineRef.current?.restoreDefaultPercussionSound(id);
          }}
          onPreviewPercussionSound={async (id) =>
            (await audioEngineRef.current?.previewPercussionSound(id)) ?? false
          }
          onRestoreAllDefaults={async () => {
            await audioEngineRef.current?.restoreAllDefaults();
          }}
          onExportBackup={async () => {
            if (!audioEngineRef.current) {
              return {
                version: 1,
                exportedAt: new Date().toISOString(),
                application: 'The Sound of a Name',
                recordings: [],
              };
            }
            return audioEngineRef.current.exportCustomSoundsBackup();
          }}
          onImportBackup={async (bundle) => {
            if (!audioEngineRef.current) return 0;
            return audioEngineRef.current.importCustomSoundsBackup(bundle);
          }}
        />

        {/* Visual Explanation of all 15 Required Items & Mathematical Steps */}
        <ExplanationPanel
          conversion={conversion}
          timeline={timeline}
          status={playerStatus}
          bpm={bpm}
          selectedStyleId={selectedStyleId}
          onSelectLetterIndex={setSelectedLetterIndex}
          onSeekToStep={handleSeekToStep}
        />

        {/* Generative Concentric Cycle Score */}
        <VisualScore
          conversion={conversion}
          status={playerStatus}
          selectedLetterIndex={selectedLetterIndex}
          onSelectLetterIndex={setSelectedLetterIndex}
        />

        {/* High-Resolution Poster Export */}
        <PosterExportPanel conversion={conversion} timeline={timeline} />
      </main>

      <footer className="editorial-footer">
        <div>
          <strong>THE SOUND OF A NAME</strong> — Fibonacci-Modulo Sound
          Sequence, Time Signature, Percussion & Musical Theme System.
        </div>
        <div>
          Your name determines the mathematical sound sequence, time signature,
          percussion instrument, and suggested theme; you control the active
          theme, custom sound recordings, and playback tempo.
        </div>
      </footer>
    </div>
  );
};

export default App;
