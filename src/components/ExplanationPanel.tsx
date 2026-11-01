/**
 * src/components/ExplanationPanel.tsx
 * -----------------------------------
 * Implements Step 12 ("Visual explanation") of the Updated Antigravity Brief.
 *
 * Displays all required items clearly:
 *   1. Original name
 *   2. Letters and alphabet positions (A=1..Z=26)
 *   3. Complete Fibonacci-modulo sequences
 *   4. Sound name for every number (0=Snap..26=Rubbing palms together)
 *   5. Sum S
 *   6. T = S % 6 and selected time signature (3/4, 4/4, 5/4, 6/8, 7/8, 12/8)
 *   7. Beat grouping for the time signature (e.g. 2 + 2 + 3 for 7/8)
 *   8. P = S % 6 and selected percussion instrument (Snap, Clap, Leg thump, Lip pop, Sneeze, Tongue click)
 *   9. Theme fingerprint G = Σ(i × xᵢ) and M = G % 6
 *  10. Suggested theme
 *  11. Currently selected theme
 *  12. Current BPM and its pulse definition
 *  13. Ordered sound composition
 *  + Real-time highlighting of the current letter, number, sound, bar, and beat during playback!
 */

import React from 'react';
import {
  ALL_SOUND_NUMBERS,
  getInstrumentalStyleById,
  NUMBER_SOUND_MAP,
  PERCUSSION_BY_MODULO_6,
  THEME_BY_MODULO_6,
  TIME_SIGNATURE_BY_MODULO_6,
} from '../engine/config';
import type {
  InstrumentalStyleId,
  NameConversionResult,
} from '../engine/types';
import type { ContinuousTimeline, PlayerStatus } from '../audio/types';

interface ExplanationPanelProps {
  conversion: NameConversionResult;
  timeline: ContinuousTimeline;
  status: PlayerStatus;
  bpm: number;
  selectedStyleId: InstrumentalStyleId;
  onSelectLetterIndex: (idx: number) => void;
  onSeekToStep: (globalStepIndex: number) => void;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({
  conversion,
  timeline,
  status,
  bpm,
  selectedStyleId,
  onSelectLetterIndex,
  onSeekToStep,
}) => {
  const isPlayingOrPaused =
    status.state === 'playing' || status.state === 'paused';
  const activeStyle = getInstrumentalStyleById(selectedStyleId);
  const tsSpec = conversion.selectedTimeSignature;
  const isThemeOverridden = selectedStyleId !== conversion.suggestedTheme.id;

  return (
    <section
      className="explanation-section"
      aria-labelledby="visual-explanation-heading"
    >
      <div className="section-header-bar">
        <div>
          <span className="section-kicker">
            STEP 12 // COMPLETE MATHEMATICAL, TIME SIGNATURE, PERCUSSION & THEME EXPLANATION
          </span>
          <h2 id="visual-explanation-heading" className="section-title">
            How “{conversion.rawInput}” Becomes a Musical Composition
          </h2>
          <p className="section-subtitle">
            Every step below displays the exact mathematical derivations for{' '}
            <strong>“{conversion.rawInput}”</strong> at{' '}
            <strong>{bpm} BPM</strong> ({timeline.pulseDefinition}). During
            playback, the active letter, number, human sound, bar, and beat
            highlight in real time.
          </p>
        </div>
      </div>

      {/* Three Independent Sound Layers Breakdown */}
      <div
        className="fib-breakdown-block"
        style={{
          marginBottom: '2rem',
          border: '1px solid rgba(184, 255, 1, 0.35)',
        }}
      >
        <div className="fib-breakdown-header">
          <span className="section-kicker">
            STEP 9 // THREE SYNCHRONIZED LAYERS OF SOUND
          </span>
          <h3>
            Three Synchronized Layers in {tsSpec.id} at {bpm} BPM:
            Sound Sequence · {conversion.selectedPercussion.instrumentName} ·{' '}
            {activeStyle.styleName} Theme
          </h3>
          <p className="section-subtitle">
            Your normalized name (<strong>{conversion.normalizedName}</strong>)
            deterministically generates the <strong>Sound Sequence</strong>,{' '}
            <strong>Time Signature ({tsSpec.id})</strong>,{' '}
            <strong>
              Percussion Instrument ({conversion.selectedPercussion.instrumentName})
            </strong>
            , and <strong>Suggested Theme ({conversion.suggestedTheme.styleName})</strong>,
            while you can adjust the active theme, custom sound recordings, and
            tempo at any time.
          </p>
        </div>

        <div className="mixer-and-tempo-grid" style={{ marginTop: '1rem' }}>
          {/* Layer 1 Card: Main Sound Sequence */}
          <div
            className="mixer-card"
            style={{
              borderColor:
                isPlayingOrPaused && !status.isMainMuted
                  ? '#FF2A3C'
                  : undefined,
            }}
          >
            <div className="mixer-card-top">
              <span className="section-kicker">
                LAYER 1 // MAIN SOUND SEQUENCE (0–26)
              </span>
              <span className="mono-time">
                {status.isMainMuted
                  ? 'MUTED'
                  : isPlayingOrPaused && status.activeNumber !== null
                  ? '● PLAYING NOW'
                  : 'READY'}
              </span>
            </div>
            <p className="mixer-help">
              Determined strictly by each letter’s complete Fibonacci-modulo
              cycle (<code>0 = Snap</code> …{' '}
              <code>26 = Rubbing palms together</code>):
            </p>
            <div className="exp-formula-box" style={{ marginTop: '0.5rem' }}>
              <div>
                Active Letter:{' '}
                <strong>
                  {status.activeLetterIndex !== null
                    ? `#${status.activeLetterIndex + 1} (${
                        conversion.letters[status.activeLetterIndex]?.letter
                      } = ${
                        conversion.letters[status.activeLetterIndex]
                          ?.alphabetValue
                      })`
                    : `${conversion.letters.length} letters (${conversion.orderedSteps.length} total steps)`}
                </strong>
              </div>
              <div>
                Active Number & Sound:{' '}
                <strong className="accent-text">
                  {status.activeNumber !== null
                    ? `${status.activeNumber} → ${status.activeSoundName}`
                    : 'Press ▶ Play to highlight live sounds'}
                </strong>
              </div>
            </div>
          </div>

          {/* Layer 2 Card: Time Signature & Percussion */}
          <div
            className="mixer-card"
            style={{
              borderColor:
                isPlayingOrPaused && !status.isPercussionMuted
                  ? '#B8FF01'
                  : undefined,
            }}
          >
            <div className="mixer-card-top">
              <span className="section-kicker">
                LAYER 2 // TIME SIGNATURE & PERCUSSION (S % 6)
              </span>
              <span className="mono-time">
                {status.isPercussionMuted
                  ? 'MUTED'
                  : isPlayingOrPaused && status.activeBeatInBar !== null
                  ? `● BAR ${status.activeBarNumber ?? 1} · BEAT ${status.activeBeatInBar}/${tsSpec.beatsPerBar}`
                  : 'READY'}
              </span>
            </div>
            <p className="mixer-help">
              Derived from your name’s letter sum{' '}
              <code>S = {conversion.letterSum}</code> via{' '}
              <code>
                T = P = {conversion.letterSum} % 6 = {conversion.percussionModulo}
              </code>
              :
            </p>
            <div className="exp-formula-box" style={{ marginTop: '0.5rem' }}>
              <div>
                Time Signature & Beat Grouping:{' '}
                <strong className="accent-text">
                  ⏱ {tsSpec.id} ({tsSpec.groupingLabel})
                </strong>
              </div>
              <div>
                Selected Percussion:{' '}
                <strong className="accent-text">
                  🥁 {conversion.selectedPercussion.instrumentName}
                </strong>
              </div>
            </div>
          </div>

          {/* Layer 3 Card: Musical Theme */}
          <div
            className="mixer-card"
            style={{
              borderColor:
                isPlayingOrPaused && !status.isAccompanimentMuted
                  ? '#B8FF01'
                  : undefined,
            }}
          >
            <div className="mixer-card-top">
              <span className="section-kicker">
                LAYER 3 // MUSICAL THEME (SUGGESTED M = G % 6)
              </span>
              <span className="mono-time">
                {status.isAccompanimentMuted
                  ? 'MUTED'
                  : isPlayingOrPaused
                  ? '● ACCOMPANYING NOW'
                  : 'READY'}
              </span>
            </div>
            <p className="mixer-help">
              Suggested via{' '}
              <code>
                G = {conversion.weightedSumG}, M = {conversion.themeModuloM}
              </code>{' '}
              (user-selectable across all 6 preloaded themes):
            </p>
            <div className="exp-formula-box" style={{ marginTop: '0.5rem' }}>
              <div>
                Suggested Theme:{' '}
                <strong>{conversion.suggestedTheme.styleName}</strong> ·
                Currently Selected:{' '}
                <strong className="accent-text">
                  🎼 {activeStyle.styleName}
                </strong>
              </div>
              <div>
                Live Activity:{' '}
                <strong>
                  {status.activeAccompanimentSummary ??
                    activeStyle.arrangementDescription}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Grid: Items 1, 2, 5, 6, 7, 8, 9, 10, 11 & 12 */}
      <div className="explanation-grid">
        {/* Card 1: Items 1, 2 & 5 — Original Name, Letters, Alphabet Positions, and Sum S */}
        <article className="exp-card">
          <div className="exp-step-num">
            ITEMS 1, 2 & 5 // ORIGINAL NAME, LETTERS & SUM (S)
          </div>
          <h3>1. Original Name, Alphabet Positions & Sum (S)</h3>
          <p className="exp-plain">
            We convert your input to uppercase, ignore spaces and non-alphabetic
            characters, convert each letter to{' '}
            <code>A = 1, B = 2, … Z = 26</code>, and sum them to compute{' '}
            <strong>S</strong>:
          </p>

          <div className="exp-formula-box">
            <div>
              1. Original Name: <code>"{conversion.rawInput}"</code> →
              Normalized:{' '}
              <strong className="accent-text">
                {conversion.normalizedName}
              </strong>
            </div>
            <div>
              2. Letters & Alphabet Positions:{' '}
              <strong>
                {conversion.letters
                  .map((l) => `${l.letter} = ${l.alphabetValue}`)
                  .join(', ')}
              </strong>
            </div>
            <div>
              5. Sum <code>S = Σ letter values</code> ={' '}
              <code>
                {conversion.letters.map((l) => l.alphabetValue).join(' + ')}
              </code>{' '}
              = <strong className="accent-text">{conversion.letterSum}</strong>
            </div>
          </div>

          <div className="letter-conversion-strip" role="list">
            {conversion.letters.map((l, idx) => {
              const isCurrentLetter =
                isPlayingOrPaused && status.activeLetterIndex === idx;
              return (
                <button
                  key={`letter-chip-${idx}-${l.letter}`}
                  type="button"
                  className={`conv-chip ${
                    isCurrentLetter ? 'active-playing-chip' : ''
                  }`}
                  onClick={() => onSelectLetterIndex(idx)}
                >
                  <span className="conv-pos">Letter #{l.positionInName}</span>
                  <span className="conv-char">{l.letter}</span>
                  <span className="conv-val">x_{l.positionInName} = {l.alphabetValue}</span>
                  <span className="conv-sound">
                    {l.sequence.length}{' '}
                    {l.sequence.length === 1 ? 'step' : 'steps'}
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        {/* Card 2: Items 6, 7 & 8 — Time Signature (T = S % 6), Beat Grouping & Percussion (P = S % 6) */}
        <article className="exp-card">
          <div className="exp-step-num">
            ITEMS 6, 7 & 8 // TIME SIGNATURE (T = S % 6) & PERCUSSION (P = S % 6)
          </div>
          <h3>2. Time Signature, Beat Grouping & Percussion</h3>
          <p className="exp-plain">
            Using the letter sum <code>S = {conversion.letterSum}</code>, we
            take <code>S % 6</code> to deterministically select both the{' '}
            <strong>Time Signature</strong> (<code>T = S % 6</code>) and the{' '}
            <strong>Background Percussion Instrument</strong> (
            <code>P = S % 6</code>):
          </p>

          <div className="exp-formula-box">
            <div>
              6. Time Signature:{' '}
              <code>
                T = {conversion.letterSum} % 6 ={' '}
                <strong className="accent-text">
                  {conversion.timeSignatureModulo}
                </strong>
              </code>{' '}
              →{' '}
              <span className="genre-pill-inline">
                ⏱ {tsSpec.id} ({tsSpec.interpretation})
              </span>
            </div>
            <div>
              7. Beat Grouping for {tsSpec.id}:{' '}
              <strong className="accent-text">
                {tsSpec.groupingLabel}
              </strong>{' '}
              ({tsSpec.beatStructureExplanation})
            </div>
            <div>
              8. Percussion Instrument:{' '}
              <code>
                P = {conversion.letterSum} % 6 ={' '}
                <strong className="accent-text">
                  {conversion.percussionModulo}
                </strong>
              </code>{' '}
              →{' '}
              <span className="genre-pill-inline">
                🥁 {conversion.selectedPercussion.instrumentName}
              </span>
            </div>
          </div>

          {/* Modulo-6 Lookup Table for Time Signature (T) and Percussion (P) */}
          <div className="modulo7-grid">
            {[0, 1, 2, 3, 4, 5].map((modVal) => {
              const tItem = TIME_SIGNATURE_BY_MODULO_6[modVal];
              const pItem = PERCUSSION_BY_MODULO_6[modVal];
              const isMatched = conversion.timeSignatureModulo === modVal;
              return (
                <div
                  key={`mod6-tp-${modVal}`}
                  className={`mod7-chip ${isMatched ? 'mod7-matched' : ''}`}
                >
                  <span className="mod7-p">T = P = {modVal}</span>
                  <span className="mod7-inst">
                    {tItem.id} ({tItem.groupingLabel}) ·{' '}
                    {pItem.instrumentName}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {/* Card 3: Items 9, 10, 11 & 12 — Theme Fingerprint G, M = G % 6, Suggested vs Selected Theme, and BPM Pulse Definition */}
      <div className="fib-breakdown-block" style={{ marginBottom: '2rem' }}>
        <div className="fib-breakdown-header">
          <span className="section-kicker">
            ITEMS 9, 10, 11 & 12 // THEME FINGERPRINT (G), SUGGESTED VS. SELECTED THEME & BPM PULSE DEFINITION
          </span>
          <h3>
            3. Weighted Theme Fingerprint <code>G = Σ(i × xᵢ)</code>,{' '}
            <code>M = G % 6</code> & Tempo Pulse Definition
          </h3>
          <p className="section-subtitle">
            Because each letter value <code>xᵢ</code> is multiplied by its
            1-based position <code>i</code> in the normalized name, the exact
            letter order shapes your name’s suggested theme.
          </p>
        </div>

        <div className="explanation-grid" style={{ marginTop: '1rem' }}>
          <div className="exp-formula-box" style={{ margin: 0 }}>
            <div>
              9. Weighted Sum Formula:{' '}
              <code>G = 1·x₁ + 2·x₂ + … + k·xₖ</code>
            </div>
            <div>
              Calculation:{' '}
              <code>
                G ={' '}
                {conversion.weightedTerms
                  .map(
                    (t) =>
                      `(${t.position} × ${t.alphabetValue} = ${t.product})`
                  )
                  .join(' + ')}{' '}
                ={' '}
                <strong className="accent-text">
                  {conversion.weightedSumG}
                </strong>
              </code>
            </div>
            <div>
              Modulo-6 Theme Result:{' '}
              <code>
                M = {conversion.weightedSumG} % 6 ={' '}
                <strong className="accent-text">{conversion.themeModuloM}</strong>
              </code>
            </div>
            <div>
              10. Your Name’s Suggested Theme:{' '}
              <span className="genre-pill-inline">
                ★ {conversion.suggestedTheme.styleName}
              </span>
            </div>
            <div>
              11. Currently Selected Theme:{' '}
              <span className="genre-pill-inline">
                🎼 {activeStyle.styleName}
                {isThemeOverridden
                  ? ' (Manual Override Active)'
                  : ' (Matches Suggested Theme)'}
              </span>
            </div>
            <div>
              12. Current BPM & Pulse Definition:{' '}
              <strong className="accent-text">{bpm} BPM</strong> —{' '}
              <code>{timeline.pulseDefinition}</code> (1 beat ={' '}
              <code>{timeline.stepDurationSeconds.toFixed(3)}s</code>)
            </div>
          </div>

          <div className="modulo7-grid" style={{ alignSelf: 'center' }}>
            {[0, 1, 2, 3, 4, 5].map((modVal) => {
              const styleItem = THEME_BY_MODULO_6[modVal];
              const isSuggested = conversion.themeModuloM === modVal;
              const isSelected = styleItem.id === selectedStyleId;
              return (
                <div
                  key={`mod6-theme-${modVal}`}
                  className={`mod7-chip ${isSuggested ? 'mod7-matched' : ''}`}
                  style={
                    isSelected && !isSuggested
                      ? { borderColor: '#F7C6D9' }
                      : undefined
                  }
                >
                  <span className="mod7-p">
                    M = {modVal}
                    {isSuggested ? ' ★ Suggested' : ''}
                    {isSelected ? ' · Active' : ''}
                  </span>
                  <span className="mod7-inst">{styleItem.styleName}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Item 3: Each Complete Fibonacci-Modulo Sequence */}
      <div className="fib-breakdown-block" style={{ marginBottom: '2rem' }}>
        <div className="fib-breakdown-header">
          <span className="section-kicker">
            ITEM 3 // EACH LETTER’S COMPLETE FIBONACCI-MODULO SEQUENCE
          </span>
          <h3>
            Complete Cycle per Letter:{' '}
            <code>next = (previous + previous_previous) % n</code>
          </h3>
          <p className="section-subtitle">
            Each letter starts with <code>0, 1</code> and continues until the
            consecutive pair returns to <code>0, 1 % n</code> (for{' '}
            <code>A = 1</code>, the sequence is <code>0</code>). Click any step
            pill to seek to that step.
          </p>
        </div>

        <div className="fib-table-wrapper">
          <table className="fib-sequence-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Letter</th>
                <th>Alphabet Value (n)</th>
                <th>Cycle Length</th>
                <th>Complete Fibonacci-Modulo Sequence (Number → Sound Name)</th>
              </tr>
            </thead>
            <tbody>
              {conversion.letters.map((l, lIdx) => {
                const isLetterActive =
                  isPlayingOrPaused && status.activeLetterIndex === lIdx;

                return (
                  <tr
                    key={`letter-seq-row-${lIdx}-${l.letter}`}
                    className={`fib-table-row ${
                      isLetterActive ? 'row-playing-now' : ''
                    }`}
                    onClick={() => onSelectLetterIndex(lIdx)}
                  >
                    <td className="mono-cell">#{l.positionInName}</td>
                    <td className="letter-cell">{l.letter}</td>
                    <td className="mono-cell">
                      {l.letter} = {l.alphabetValue}
                    </td>
                    <td className="mono-cell">{l.sequence.length} steps</td>
                    <td>
                      <div className="fib-steps-inline">
                        {l.steps.map((st) => {
                          const isStepPlaying =
                            isPlayingOrPaused &&
                            status.activeGlobalStepIndex === st.globalStepIndex;

                          return (
                            <button
                              key={`seq-pill-${st.globalStepIndex}`}
                              type="button"
                              className={`fib-num-pill is-nonzero ${
                                isStepPlaying ? 'pill-playing-now' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSeekToStep(st.globalStepIndex);
                              }}
                              title={`Step #${st.globalStepIndex + 1}: ${
                                st.number
                              } → ${st.soundName}`}
                            >
                              <strong>{st.number}</strong>
                              <small style={{ marginLeft: '4px', opacity: 0.9 }}>
                                ({st.soundName})
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item 4: Sound Name for Every Number (0 to 26) */}
      <div className="fib-breakdown-block" style={{ marginBottom: '2rem' }}>
        <div className="fib-breakdown-header">
          <span className="section-kicker">
            ITEM 4 // NUMBER-TO-SOUND DICTIONARY (0 TO 26)
          </span>
          <h3>Sound Name for Every Number (0–26)</h3>
          <p className="section-subtitle">
            Every number from <code>0</code> to <code>26</code> triggers its
            corresponding recorded human sound (including{' '}
            <code>0 → Snap</code>). Green cards are used in{' '}
            <strong>{conversion.normalizedName}</strong>; red indicates the
            currently playing sound.
          </p>
        </div>

        <div className="number-dictionary-grid">
          {ALL_SOUND_NUMBERS.map((num) => {
            const spec = NUMBER_SOUND_MAP[num];
            const isUsedInName = conversion.uniqueNumbersUsed.includes(num);
            const isTriggeringNow =
              isPlayingOrPaused && status.activeNumber === num;

            return (
              <div
                key={`dict-${num}`}
                className={`dict-chip ${isUsedInName ? 'used-in-name' : ''} ${
                  isTriggeringNow ? 'triggering-now' : ''
                }`}
              >
                <span className="dict-num">{num}</span>
                <span className="dict-sound">{spec.soundName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Item 13: Ordered Sound Composition */}
      <div className="fib-breakdown-block">
        <div className="fib-breakdown-header">
          <span className="section-kicker">
            ITEM 13 // ORDERED SOUND COMPOSITION IN {tsSpec.id}
          </span>
          <h3>
            Complete Ordered Composition ({conversion.orderedSteps.length}{' '}
            Sounds in {tsSpec.id} +{' '}
            {conversion.selectedPercussion.instrumentName} +{' '}
            {activeStyle.styleName})
          </h3>
          <p className="section-subtitle">
            <code>
              {conversion.letters
                .map((l) => `${l.letter} sequence`)
                .join(' → ')}
            </code>{' '}
            scheduled at <strong>{bpm} BPM</strong> over the repeating{' '}
            <strong>
              {tsSpec.id} ({tsSpec.groupingLabel})
            </strong>{' '}
            bar structure.
          </p>
        </div>

        <div className="ordered-stream-grid">
          {timeline.events.map((ev) => {
            const isCurrent =
              isPlayingOrPaused &&
              status.activeGlobalStepIndex === ev.globalStepIndex;

            return (
              <button
                key={`stream-${ev.globalStepIndex}`}
                type="button"
                className={`stream-step-card ${
                  isCurrent ? 'stream-step-active' : ''
                }`}
                onClick={() => onSeekToStep(ev.globalStepIndex)}
              >
                <div className="stream-step-top">
                  <span>#{ev.globalStepIndex + 1}</span>
                  <span>
                    {ev.letter} · Bar {ev.barNumber}, Beat {ev.beatInBar}/
                    {ev.beatsPerBar}
                  </span>
                </div>
                <div className="stream-step-num">{ev.number}</div>
                <div className="stream-step-sound">{ev.soundName}</div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
