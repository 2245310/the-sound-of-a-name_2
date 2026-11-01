/**
 * src/components/VisualScore.tsx
 * ------------------------------
 * Generative Concentric Orbital Score for the Updated Antigravity Brief.
 *
 * Displays:
 * - One concentric ring per letter in exact name order (innermost = Letter #1,
 *   outermost = last letter).
 * - Each ring is divided into the exact length of that letter's complete
 *   Fibonacci-modulo cycle (e.g., R=18 has 24 segments, A=1 has 1 full ring
 *   segment for `0 -> Snap`, M=13 has 28 segments, E=5 has 20, S=19 has 18,
 *   H=8 has 12).
 * - Because 0 maps to Snap (not silence), 0 is drawn as a distinct crisp marker
 *   while higher numbers scale radial height proportionally.
 * - Highlights the currently playing letter, step, number, and human sound in
 *   real time as the continuous composition plays.
 */

import React from 'react';
import type { NameConversionResult } from '../engine/types';
import type { PlayerStatus } from '../audio/types';

interface VisualScoreProps {
  conversion: NameConversionResult;
  status: PlayerStatus;
  selectedLetterIndex: number;
  onSelectLetterIndex: (idx: number) => void;
}

function polarToCartesian(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function wrapSvgWords(text: string, maxCharsPerLine = 13): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text.trim()];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export const VisualScore: React.FC<VisualScoreProps> = ({
  conversion,
  status,
  selectedLetterIndex,
  onSelectLetterIndex,
}) => {
  const letters = conversion.letters;
  const totalLetters = letters.length;

  const size = 640;
  const cx = size / 2;
  const cy = size / 2;
  const minRadius = 88;
  const maxRadius = 280;
  const ringSpacing =
    totalLetters > 1
      ? (maxRadius - minRadius) / Math.max(1, totalLetters - 1)
      : 0;

  const isPlaying = status.state === 'playing' || status.state === 'paused';
  const inspectedLetter = letters[selectedLetterIndex] ?? letters[0];
  const centerLabel = status.activeSoundName ?? conversion.normalizedName;
  const centerLines = wrapSvgWords(centerLabel, 13);
  const centerFontSize =
    centerLines.length === 1 && centerLines[0].length > 10
      ? Math.max(7.5, Math.min(12, 112 / centerLines[0].length))
      : 11.5;

  return (
    <section
      className="visual-score-section"
      aria-labelledby="visual-score-heading"
    >
      <div className="section-header-bar">
        <div>
          <span className="section-kicker">
            ORBITAL CYCLE VISUALIZATION // VARIABLE-LENGTH PISANO RINGS
          </span>
          <h2 id="visual-score-heading" className="section-title">
            Complete Cycle Score — {conversion.normalizedName}
          </h2>
          <p className="section-subtitle">
            Each concentric ring represents one letter in{' '}
            <strong>{conversion.normalizedName}</strong> and is divided into the
            exact number of steps in its complete Fibonacci-modulo cycle. Every
            step triggers its recorded human sound (including{' '}
            <code>0 → Snap</code>).
          </p>
        </div>
      </div>

      <div className="visual-score-grid">
        {/* Left: SVG Concentric Cycle Rings */}
        <div className="score-canvas-wrap">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="score-svg"
            role="img"
            aria-label={`Concentric Fibonacci-modulo cycle rings for ${conversion.normalizedName}`}
          >
            {letters.map((letterData, lIdx) => {
              const radius =
                totalLetters === 1
                  ? (minRadius + maxRadius) / 2
                  : minRadius + lIdx * ringSpacing;
              const cycleLen = letterData.sequence.length;
              const isSelectedRing = selectedLetterIndex === lIdx;
              const isActiveRing =
                isPlaying && status.activeLetterIndex === lIdx;
              const maxModVal = Math.max(1, letterData.alphabetValue - 1);

              return (
                <g
                  key={`ring-${lIdx}-${letterData.letter}`}
                  onClick={() => onSelectLetterIndex(lIdx)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Base orbit guide */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={
                      isActiveRing
                        ? '#B8FF01'
                        : isSelectedRing
                        ? '#F7C6D9'
                        : 'rgba(245, 240, 235, 0.14)'
                    }
                    strokeWidth={isActiveRing ? 2.4 : isSelectedRing ? 1.6 : 0.8}
                  />

                  {/* Nodes around the cycle */}
                  {letterData.steps.map((stepItem, sIdx) => {
                    const angle =
                      (sIdx / cycleLen) * Math.PI * 2 - Math.PI / 2;
                    const norm =
                      letterData.alphabetValue <= 1
                        ? 0.35
                        : stepItem.number / maxModVal;

                    const isCurrentStep =
                      isPlaying &&
                      status.activeGlobalStepIndex === stepItem.globalStepIndex;

                    const pt = polarToCartesian(cx, cy, radius, angle);
                    const spikeLen =
                      5 + norm * Math.min(20, Math.max(8, ringSpacing * 0.6));
                    const tip = polarToCartesian(
                      cx,
                      cy,
                      radius + spikeLen,
                      angle
                    );

                    const color = isCurrentStep
                      ? '#FF2A3C'
                      : stepItem.number === 0
                      ? '#F7C6D9'
                      : '#B8FF01';

                    return (
                      <g key={`node-${lIdx}-${sIdx}`}>
                        <line
                          x1={pt.x}
                          y1={pt.y}
                          x2={tip.x}
                          y2={tip.y}
                          stroke={color}
                          strokeWidth={isCurrentStep ? 3.8 : 1.8}
                          strokeLinecap="round"
                          opacity={isCurrentStep ? 1 : isSelectedRing ? 0.95 : 0.68}
                        />
                        <circle
                          cx={tip.x}
                          cy={tip.y}
                          r={
                            isCurrentStep
                              ? 6.5
                              : stepItem.number === 0
                              ? 2.8
                              : 2.2 + norm * 2.5
                          }
                          fill={color}
                        >
                          <title>
                            {`Letter #${letterData.positionInName} (${
                              letterData.letter
                            }) · Step ${sIdx + 1}/${cycleLen}: Number ${
                              stepItem.number
                            } → ${stepItem.soundName}`}
                          </title>
                        </circle>
                      </g>
                    );
                  })}

                  {/* Ring Badge at 12 o'clock */}
                  <g transform={`translate(${cx}, ${(cy - radius).toFixed(1)})`}>
                    {(() => {
                      const badgeText = `${letterData.letter}(${cycleLen})`;
                      const badgeW = Math.max(46, badgeText.length * 6.8 + 14);
                      return (
                        <>
                          <rect
                            x={-badgeW / 2}
                            y={-9}
                            width={badgeW}
                            height={18}
                            rx={4}
                            fill={isActiveRing ? '#B8FF01' : '#120E17'}
                            stroke="#B8FF01"
                            strokeWidth={1}
                          />
                          <text
                            x={0}
                            y={1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            className="svg-orbit-badge"
                            fill={isActiveRing ? '#0C0A0E' : '#F5F0EB'}
                          >
                            {badgeText}
                          </text>
                        </>
                      );
                    })()}
                  </g>
                </g>
              );
            })}

            {/* Center Live Readout */}
            <circle
              cx={cx}
              cy={cy}
              r={64}
              fill="#0E0B12"
              stroke="#B8FF01"
              strokeWidth={1.8}
            />
            <text
              x={cx}
              y={cy - (centerLines.length > 1 ? 24 : 18)}
              textAnchor="middle"
              className="svg-center-genre"
              fill="#B8FF01"
            >
              {status.activeNumber !== null
                ? `NUM ${status.activeNumber}`
                : `${conversion.orderedSteps.length} STEPS`}
            </text>
            <text
              x={cx}
              y={
                centerLines.length === 1
                  ? cy + 4
                  : centerLines.length === 2
                  ? cy - 3
                  : cy - 8
              }
              textAnchor="middle"
              className="svg-center-bpm"
              style={{ fontSize: `${centerFontSize}px` }}
              fill="#F5F0EB"
            >
              {centerLines.map((ln, idx) => (
                <tspan
                  key={`c-ln-${idx}`}
                  x={cx}
                  dy={idx === 0 ? 0 : 13.5}
                >
                  {ln}
                </tspan>
              ))}
            </text>
            <text
              x={cx}
              y={cy + (centerLines.length > 2 ? 36 : 30)}
              textAnchor="middle"
              className="svg-center-sum"
              fill="#F7C6D9"
            >
              {status.activeLetterIndex !== null
                ? `Letter #${status.activeLetterIndex + 1}`
                : `${totalLetters} Letters`}
            </text>
          </svg>

          <div className="score-legend">
            <div className="legend-item">
              <span
                className="legend-swatch solid"
                style={{ background: '#B8FF01' }}
              />
              <span>Fibonacci Number 1..26 (radial height = value)</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-swatch solid"
                style={{ background: '#F7C6D9' }}
              />
              <span>Number 0 → Snap (active sound, not silence)</span>
            </div>
            <div className="legend-item">
              <span
                className="legend-swatch solid"
                style={{ background: '#FF2A3C' }}
              />
              <span>Currently playing step in continuous sequence</span>
            </div>
          </div>
        </div>

        {/* Right: Selected Letter Cycle Inspector */}
        <div className="score-inspector-panel">
          <div className="inspector-header">
            <span className="section-kicker">LETTER CYCLE INSPECTOR</span>
            <h3>Inspect each letter’s complete Fibonacci-modulo cycle</h3>
          </div>

          <div className="letter-orbit-tabs" role="tablist">
            {letters.map((l, idx) => {
              const isSelected = idx === selectedLetterIndex;
              const isPlayingNow = status.activeLetterIndex === idx;
              return (
                <button
                  key={`tab-${idx}-${l.letter}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`orbit-tab-btn ${isSelected ? 'selected' : ''} ${
                    isPlayingNow ? 'playing-now' : ''
                  }`}
                  onClick={() => onSelectLetterIndex(idx)}
                >
                  <span className="tab-pos">#{l.positionInName}</span>
                  <span className="tab-letter">{l.letter}</span>
                  <span className="tab-val">
                    n={l.alphabetValue} ({l.sequence.length}{' '}
                    {l.sequence.length === 1 ? 'step' : 'steps'})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="inspected-letter-card">
            <div className="inspected-meta-row">
              <div>
                <div className="inspected-big-letter">
                  Letter #{inspectedLetter.positionInName}: “
                  {inspectedLetter.letter}” (Alphabet Position n ={' '}
                  {inspectedLetter.alphabetValue})
                </div>
                <div className="inspected-sub">
                  Complete cycle length:{' '}
                  <strong>{inspectedLetter.sequence.length} numbers</strong>{' '}
                  before returning to{' '}
                  <code>(0, 1 mod {inspectedLetter.alphabetValue})</code>
                </div>
              </div>
            </div>

            <div className="step-inspector-grid">
              {inspectedLetter.steps.map((st) => {
                const isStepActive =
                  status.activeGlobalStepIndex === st.globalStepIndex;
                return (
                  <div
                    key={`step-card-${st.globalStepIndex}`}
                    className={`step-cell is-hit ${
                      isStepActive ? 'is-active' : ''
                    }`}
                  >
                    <div className="step-cell-top">
                      <span>#{st.globalStepIndex + 1}</span>
                      <span>step {st.stepIndexInLetter + 1}</span>
                    </div>
                    <div className="step-fib-val">{st.number}</div>
                    <div className="step-meta">
                      <span>{st.soundName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
