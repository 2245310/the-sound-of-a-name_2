/**
 * src/poster/posterRenderer.ts
 * ----------------------------
 * High-Resolution Generative Music Poster Renderer (minimum 3000 × 3000 px).
 *
 * Design Principle:
 * "The loop is the artwork. The information exists to help the viewer
 * understand it, not compete with it."
 *
 * Hierarchy & Included Elements:
 *   A. Title ("The Sound of a Name"), dynamic headline
 *      ("How ‘<NAME>’ Becomes a Musical Composition"), and prominent name.
 *   B. Dominant hero loop graphic (~62–68% of the poster's visual space)
 *      generated directly from the name's Fibonacci-modulo sequences, plus a
 *      restrained caption explaining what the loop represents.
 *   C. Compact letter-to-number conversion (e.g. S=19, H=8, I=9, ...).
 *   D. Concise explanation of the Fibonacci-modulo cycle process (plus compact
 *      complete sequences only when short enough to fit without crowding).
 *   E. All six musical genres (Pop, Jazz, Rock, Classical, Reggae, Indian
 *      Carnatic) with the algorithmically suggested genre highlighted and any
 *      manual selection clearly distinguished.
 *   F. Compact rhythm metadata: selected time signature, percussion
 *      instrument, and tempo in BPM.
 */

import { ALL_INSTRUMENTAL_STYLES } from '../engine/config';
import type { NameConversionResult } from '../engine/types';
import type { ContinuousTimeline } from '../audio/types';

export type PosterFormat = 'square' | 'portrait' | 'landscape';

export interface PosterDimensions {
  format: PosterFormat;
  label: string;
  width: number;
  height: number;
  aspectLabel: string;
}

export interface RenderedPosterSize {
  width: number;
  height: number;
}

export const POSTER_FORMATS: Record<PosterFormat, PosterDimensions> = {
  square: {
    format: 'square',
    label: 'Square Edition',
    width: 3000,
    height: 3000,
    aspectLabel: '1:1 · 3000 × 3000 px',
  },
  portrait: {
    format: 'portrait',
    label: 'Editorial Portrait',
    width: 3000,
    height: 4000,
    aspectLabel: '3:4 · 3000 × 4000 px',
  },
  landscape: {
    format: 'landscape',
    label: 'Widescreen Edition',
    width: 4000,
    height: 3000,
    aspectLabel: '4:3 · 4000 × 3000 px',
  },
};

const PALETTE = {
  bgBase: '#0C0A0E',
  bgCenterGlow: 'rgba(58, 16, 49, 0.42)',
  bgMidGlow: 'rgba(26, 12, 28, 0.24)',
  bgHub: '#0E0B12',
  bgBadge: '#120E17',
  paper: '#F5F0EB',
  paperSoft: 'rgba(245, 240, 235, 0.80)',
  paperMuted: 'rgba(245, 240, 235, 0.44)',
  acidGreen: '#B8FF01',
  vividRed: '#FF2A3C',
  palePink: '#F7C6D9',
  pinkMuted: 'rgba(247, 198, 217, 0.68)',
  orbitLine: 'rgba(245, 240, 235, 0.16)',
  hairline: 'rgba(245, 240, 235, 0.14)',
};

const FONTS = {
  display: '"Syne", "Helvetica Neue", "Arial Black", -apple-system, sans-serif',
  sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"JetBrains Mono", "SFMono-Regular", Menlo, monospace',
};

export function buildPosterFilename(
  rawInput: string,
  normalizedName: string,
  format: PosterFormat = 'square'
): string {
  const slug = rawInput
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const baseSlug = slug || normalizedName.toLowerCase() || 'name';
  const suffix = format === 'square' ? '' : `-${format}`;
  return `${baseSlug}-sound-score${suffix}.png`;
}

/**
 * Formats the entered name cleanly in uppercase while preserving natural word
 * spaces (e.g. "Sahana Ramesh" -> "SAHANA RAMESH", "SHIVANA" -> "SHIVANA") so
 * multi-word names wrap naturally at spaces and match the normalized letters.
 */
function getDisplayName(rawInput: string, normalizedName: string): string {
  const cleaned = rawInput
    .toUpperCase()
    .replace(/[^A-Z\s]+/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return cleaned || normalizedName;
}

function polar(cx: number, cy: number, r: number, rad: number) {
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function setCanvasFont(
  ctx: CanvasRenderingContext2D,
  weight: number | string,
  sizePx: number,
  family: string
): void {
  ctx.font = `${weight} ${sizePx}px ${family}`;
}

function measureWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontPx: number,
  isMono = false
): number {
  if (typeof ctx.measureText === 'function') {
    const measured = ctx.measureText(text)?.width ?? 0;
    if (measured > 0) {
      return measured;
    }
  }
  return text.length * fontPx * (isMono ? 0.61 : 0.54);
}

/**
 * Wraps text strictly at whitespace boundaries so NO word is ever split across
 * lines by breaking its letters, and NO text is ever truncated with ellipses.
 */
export function wrapWordsIntact(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontPx: number,
  isMono = false
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const candidate = `${currentLine} ${word}`;
      if (measureWidth(ctx, candidate, fontPx, isMono) <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Ensures even a long single unbroken token fits within maxWidth without ever
 * splitting letters across lines.
 */
function resolveSafeFontPx(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number | string,
  family: string,
  preferredPx: number,
  minPx: number,
  maxWidth: number,
  isMono = false
): number {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    setCanvasFont(ctx, weight, preferredPx, family);
    return preferredPx;
  }

  let size = preferredPx;
  while (size > minPx) {
    setCanvasFont(ctx, weight, size, family);
    const widest = Math.max(
      ...tokens.map((tok) => measureWidth(ctx, tok, size, isMono))
    );
    if (widest <= maxWidth) {
      return size;
    }
    size -= 2;
  }
  setCanvasFont(ctx, weight, minPx, family);
  return minPx;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  dryRun: boolean,
  align: CanvasTextAlign = 'left'
): number {
  if (!dryRun) {
    const prevAlign = ctx.textAlign;
    ctx.textAlign = align;
    lines.forEach((line, idx) => {
      ctx.fillText(line, x, y + idx * lineHeight);
    });
    ctx.textAlign = prevAlign;
  }
  return lines.length * lineHeight;
}

/**
 * Determines whether complete Fibonacci-modulo sequences can be shown as a
 * quiet secondary line without crowding the poster or competing with the loop.
 */
function shouldShowCompactSequences(conversion: NameConversionResult): boolean {
  return (
    conversion.letters.length <= 5 &&
    conversion.orderedSteps.length <= 52 &&
    conversion.letters.every((l) => l.sequence.length <= 24)
  );
}

/**
 * Draws the hero concentric Fibonacci-modulo loop graphic, preserving the
 * website VisualScore's exact visual character, colors (#B8FF01 & #F7C6D9),
 * proportional spike geometry, 12 o'clock ring badges, and center hub.
 */
function drawHeroLoopArtwork(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerTipRadius: number,
  displayName: string,
  conversion: NameConversionResult,
  timeline: ContinuousTimeline
): void {
  // Subtle atmospheric radial glow behind the loop so spikes pop against negative space
  if (typeof ctx.createRadialGradient === 'function') {
    const glowR = outerTipRadius * 1.18;
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      outerTipRadius * 0.08,
      cx,
      cy,
      glowR
    );
    grad.addColorStop(0, PALETTE.bgCenterGlow);
    grad.addColorStop(0.55, PALETTE.bgMidGlow);
    grad.addColorStop(1, 'rgba(12, 10, 14, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  const letters = conversion.letters;
  const totalLetters = letters.length;
  const maxSpikeAllowance = Math.max(46, Math.round(outerTipRadius * 0.082));
  const maxRingR = outerTipRadius - maxSpikeAllowance;
  const minRingR = Math.max(195, Math.round(maxRingR * 0.285));
  const ringSpacing =
    totalLetters > 1 ? (maxRingR - minRingR) / (totalLetters - 1) : 0;

  // 1. Draw base concentric orbits and radial Fibonacci-modulo spikes
  letters.forEach((letterData, lIdx) => {
    const r =
      totalLetters === 1
        ? (minRingR + maxRingR) * 0.54
        : minRingR + lIdx * ringSpacing;
    const cycleLen = letterData.sequence.length;
    const maxModVal = Math.max(1, letterData.alphabetValue - 1);

    // Base orbit circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.orbitLine;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    const maxSpike = Math.min(
      maxSpikeAllowance,
      Math.max(20, (ringSpacing || maxSpikeAllowance) * 0.62)
    );
    const stemBaseOffset = Math.min(12, Math.max(6, maxSpike * 0.2));
    const denseFactor = cycleLen > 72 ? 0.68 : cycleLen > 40 ? 0.84 : 1;

    letterData.steps.forEach((stepItem, sIdx) => {
      const angle = (sIdx / cycleLen) * Math.PI * 2 - Math.PI / 2;
      const norm =
        letterData.alphabetValue <= 1 ? 0.35 : stepItem.number / maxModVal;
      const spikeLen = stemBaseOffset + norm * (maxSpike - stemBaseOffset);

      const pStart = polar(cx, cy, r, angle);
      const pTip = polar(cx, cy, r + spikeLen, angle);
      const isZero = stepItem.number === 0;
      const color = isZero ? PALETTE.palePink : PALETTE.acidGreen;

      ctx.save?.();
      if (typeof ctx.globalAlpha === 'number') {
        ctx.globalAlpha = isZero ? 0.92 : 0.84;
      }
      if ('lineCap' in ctx) {
        ctx.lineCap = 'round';
      }
      ctx.beginPath();
      ctx.moveTo(pStart.x, pStart.y);
      ctx.lineTo(pTip.x, pTip.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.4 * denseFactor;
      ctx.stroke();

      if (typeof ctx.globalAlpha === 'number') {
        ctx.globalAlpha = 1;
      }
      const dotRadius =
        (isZero ? 6.4 : 5.0 + norm * 5.4) * denseFactor;
      ctx.beginPath();
      ctx.arc(pTip.x, pTip.y, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore?.();
    });
  });

  // 2. Draw crisp 12 o'clock ring badges (matching VisualScore.tsx) when spacing allows
  const showRingBadges = totalLetters === 1 || ringSpacing >= 26;
  if (showRingBadges) {
    const badgeFontPx =
      totalLetters > 1 && ringSpacing < 44
        ? Math.max(13, Math.floor(ringSpacing * 0.36))
        : 17;
    const badgeH = Math.round(badgeFontPx * 1.62);

    letters.forEach((letterData, lIdx) => {
      const r =
        totalLetters === 1
          ? (minRingR + maxRingR) * 0.54
          : minRingR + lIdx * ringSpacing;
      const badgeText = `${letterData.letter}(${letterData.sequence.length})`;
      setCanvasFont(ctx, 700, badgeFontPx, FONTS.mono);
      const badgeW = Math.max(
        60,
        Math.round(measureWidth(ctx, badgeText, badgeFontPx, true) + 22)
      );
      const bx = cx - badgeW / 2;
      const by = cy - r - badgeH / 2;

      ctx.fillStyle = PALETTE.bgBadge;
      ctx.fillRect(bx, by, badgeW, badgeH);
      ctx.strokeStyle = PALETTE.acidGreen;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(bx, by, badgeW, badgeH);

      ctx.fillStyle = PALETTE.paper;
      ctx.textAlign = 'center';
      ctx.fillText(
        badgeText,
        cx,
        by + Math.round((badgeH - badgeFontPx) / 2) - 1
      );
      ctx.textAlign = 'left';
    });
  }

  // 3. Draw Center Hub (matching VisualScore.tsx center live readout)
  const hubRadius = Math.max(132, Math.min(182, minRingR - 46));
  ctx.beginPath();
  ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.bgHub;
  ctx.fill();
  ctx.strokeStyle = PALETTE.acidGreen;
  ctx.lineWidth = 3.4;
  ctx.stroke();

  const maxHubTextW = Math.round(hubRadius * 1.56);
  const nameFontPx = resolveSafeFontPx(
    ctx,
    displayName,
    800,
    FONTS.display,
    30,
    15,
    maxHubTextW,
    false
  );
  const nameLines = wrapWordsIntact(
    ctx,
    displayName,
    maxHubTextW,
    nameFontPx,
    false
  );
  const nameLineH = Math.round(nameFontPx * 1.2);
  const totalNameBlockH = nameLines.length * nameLineH;

  // Top hub micro-stat: STEPS
  setCanvasFont(ctx, 700, 18, FONTS.mono);
  ctx.fillStyle = PALETTE.acidGreen;
  ctx.textAlign = 'center';
  ctx.fillText(
    `${timeline.totalSteps} ${timeline.totalSteps === 1 ? 'STEP' : 'STEPS'}`,
    cx,
    cy - Math.round(totalNameBlockH / 2) - 34
  );

  // Middle hub prominent name
  setCanvasFont(ctx, 800, nameFontPx, FONTS.display);
  ctx.fillStyle = PALETTE.paper;
  const startNameY = cy - Math.round(totalNameBlockH / 2);
  nameLines.forEach((ln, idx) => {
    ctx.fillText(ln, cx, startNameY + idx * nameLineH);
  });

  // Bottom hub micro-stat: Letters
  setCanvasFont(ctx, 600, 18, FONTS.mono);
  ctx.fillStyle = PALETTE.palePink;
  ctx.fillText(
    `${totalLetters} ${totalLetters === 1 ? 'Letter' : 'Letters'}`,
    cx,
    cy + Math.round(totalNameBlockH / 2) + 16
  );
  ctx.textAlign = 'left';
}

/**
 * Vertical hero poster layout used by Square (3000 × 3000) & Portrait (3000 × 4000).
 * Top: Small project title + large dynamic headline + prominent name.
 * Main area (62–68%): Monumental loop graphic surrounded by generous negative space.
 * Supporting area: Compact letter-to-number conversion + Fibonacci-modulo process.
 * Bottom: Six musical genres (suggested highlighted, override distinguished) + compact rhythm row.
 */
function executeVerticalHeroLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  targetBaseH: number,
  finalCanvasH: number,
  conversion: NameConversionResult,
  timeline: ContinuousTimeline,
  dryRun: boolean
): { naturalHeight: number } {
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const margin = 150;
  const contentW = W - margin * 2; // 2700 px
  const displayName = getDisplayName(
    conversion.rawInput,
    conversion.normalizedName
  );
  const isManualOverride =
    timeline.selectedStyleId !== conversion.suggestedTheme.id;

  if (!dryRun) {
    ctx.fillStyle = PALETTE.bgBase;
    ctx.fillRect(0, 0, W, finalCanvasH);
  }

  // ── 1. TOP EDITORIAL MASTHEAD ──────────────────────────────────────────────
  let topY = margin;
  const colGap = 110;
  const headLeftW = Math.floor(contentW * 0.61); // ~1647 px
  const headRightW = contentW - headLeftW - colGap; // ~943 px
  const headRightX = margin + headLeftW + colGap;

  // Small project title
  const titleText = 'The Sound of a Name';
  setCanvasFont(ctx, 700, 26, FONTS.sans);
  const titleLines = wrapWordsIntact(ctx, titleText, headLeftW, 26, false);
  if (!dryRun) {
    ctx.fillStyle = PALETTE.acidGreen;
  }
  const titleH = drawLines(ctx, titleLines, margin, topY, 36, dryRun);

  // Large name-specific headline
  const headlineText = `How ‘${displayName}’ Becomes a Musical Composition`;
  const headlinePx = resolveSafeFontPx(
    ctx,
    headlineText,
    800,
    FONTS.display,
    56,
    30,
    headLeftW,
    false
  );
  const headlineLineH = Math.round(headlinePx * 1.22);
  const headlineLines = wrapWordsIntact(
    ctx,
    headlineText,
    headLeftW,
    headlinePx,
    false
  );
  if (!dryRun) {
    setCanvasFont(ctx, 800, headlinePx, FONTS.display);
    ctx.fillStyle = PALETTE.paper;
  }
  const headlineH = drawLines(
    ctx,
    headlineLines,
    margin,
    topY + titleH + 16,
    headlineLineH,
    dryRun
  );
  const leftMastheadH = titleH + 16 + headlineH;

  // Right side of masthead: Prominent entered name display
  const bigNamePx = resolveSafeFontPx(
    ctx,
    displayName,
    800,
    FONTS.display,
    92,
    36,
    headRightW,
    false
  );
  const bigNameLineH = Math.round(bigNamePx * 1.12);
  const bigNameLines = wrapWordsIntact(
    ctx,
    displayName,
    headRightW,
    bigNamePx,
    false
  );
  if (!dryRun) {
    // Crisp accent rule aligned right above prominent name
    ctx.fillStyle = PALETTE.acidGreen;
    ctx.fillRect(W - margin - 88, topY + 6, 88, 4);

    setCanvasFont(ctx, 800, bigNamePx, FONTS.display);
    ctx.fillStyle = PALETTE.paper;
  }
  const rightNameH =
    26 +
    drawLines(
      ctx,
      bigNameLines,
      W - margin,
      topY + 26,
      bigNameLineH,
      dryRun,
      'right'
    );

  const mastheadTotalH = Math.max(leftMastheadH, rightNameH);
  const heroZoneTop = margin + mastheadTotalH;

  // ── 2. MEASURE SUPPORTING & BOTTOM METADATA BLOCKS FIRST ───────────────────
  // C & D: Two-column supporting area (Letter-to-Number + Fibonacci-Modulo Process)
  const supColGap = 120;
  const supLeftW = Math.floor((contentW - supColGap) * 0.45); // ~1161 px
  const supRightW = contentW - supColGap - supLeftW; // ~1419 px

  const conversionPairsStr = conversion.letters
    .map((l) => `${l.letter}=${l.alphabetValue}`)
    .join(', ');
  const convFontPx = resolveSafeFontPx(
    ctx,
    conversionPairsStr,
    600,
    FONTS.mono,
    25,
    18,
    supLeftW,
    true
  );
  const convLineH = Math.round(convFontPx * 1.56);
  const convLines = wrapWordsIntact(
    ctx,
    conversionPairsStr,
    supLeftW,
    convFontPx,
    true
  );
  const supLeftH = 34 + convLines.length * convLineH;

  const fibExplainStr =
    'Every letter generates its own Fibonacci-modulo cycle from its alphabet value, triggering a recorded human sound at each step until the cycle repeats.';
  setCanvasFont(ctx, 400, 23, FONTS.sans);
  const fibExplainLines = wrapWordsIntact(
    ctx,
    fibExplainStr,
    supRightW,
    23,
    false
  );
  let supRightH = 34 + fibExplainLines.length * 35;

  const showCompactSeqs = shouldShowCompactSequences(conversion);
  let compactSeqLines: string[] = [];
  if (showCompactSeqs) {
    const seqSummary = conversion.letters
      .map((l) => `${l.letter}(${l.alphabetValue}): ${l.sequence.join(', ')}`)
      .join('   ·   ');
    setCanvasFont(ctx, 500, 18, FONTS.mono);
    compactSeqLines = wrapWordsIntact(ctx, seqSummary, supRightW, 18, true);
    supRightH += 12 + compactSeqLines.length * 28;
  }

  const supportingBlockH = Math.max(supLeftH, supRightH);

  // E: Six Musical Genres Strip
  const genreGap = 34;
  const genreColW = Math.floor((contentW - genreGap * 5) / 6);
  let maxGenreItemH = 68;
  const genreNameLinesMap: Record<string, string[]> = {};
  for (const style of ALL_INSTRUMENTAL_STYLES) {
    setCanvasFont(ctx, 700, 28, FONTS.display);
    const gLines = wrapWordsIntact(
      ctx,
      style.styleName,
      genreColW - 8,
      28,
      false
    );
    genreNameLinesMap[style.id] = gLines;
    const hasTag =
      style.id === conversion.suggestedTheme.id ||
      style.id === timeline.selectedStyleId;
    const itemH = 16 + gLines.length * 34 + (hasTag ? 28 : 6);
    maxGenreItemH = Math.max(maxGenreItemH, itemH);
  }
  const genreBlockH = 40 + maxGenreItemH;

  // F: Compact Rhythm Metadata Row
  const rhythmBlockH = 68;

  const gapHeroToSupporting = 54;
  const gapSupportingToGenres = 52;
  const gapGenresToRhythm = 44;

  const totalLowerContentH =
    supportingBlockH +
    gapSupportingToGenres +
    genreBlockH +
    gapGenresToRhythm +
    rhythmBlockH;

  // Caption beneath the loop inside Hero Zone
  const loopCaptionStr = `Concentric loop representing the musical composition generated from ‘${displayName}’ — ${
    conversion.letters.length
  } ${conversion.letters.length === 1 ? 'letter ring' : 'letter rings'}, ${
    timeline.totalSteps
  } sound ${timeline.totalSteps === 1 ? 'step' : 'steps'}.`;
  const captionMaxW = Math.round(contentW * 0.78);
  const captionFontPx = resolveSafeFontPx(
    ctx,
    loopCaptionStr,
    400,
    FONTS.sans,
    23,
    17,
    captionMaxW,
    false
  );
  const captionLineH = Math.round(captionFontPx * 1.48);
  const loopCaptionLines = wrapWordsIntact(
    ctx,
    loopCaptionStr,
    captionMaxW,
    captionFontPx,
    false
  );
  const loopCaptionBlockH = loopCaptionLines.length * captionLineH + 40; // includes subtle color key row

  // Guarantee the Hero Loop Zone always occupies >= 62% of the poster's height
  // and at least 1840 px on Square / 2520 px on Portrait so the loop dominates.
  const minHeroZoneH = Math.round(targetBaseH * 0.635);
  const requiredNaturalH =
    heroZoneTop +
    minHeroZoneH +
    gapHeroToSupporting +
    totalLowerContentH +
    margin;

  if (dryRun) {
    return { naturalHeight: Math.max(targetBaseH, requiredNaturalH) };
  }

  // ── 3. RENDER HERO LOOP ZONE (~62–68% OF POSTER) ───────────────────────────
  const lowerStartY = finalCanvasH - margin - totalLowerContentH;
  const heroZoneBottom = lowerStartY - gapHeroToSupporting;
  const heroZoneH = heroZoneBottom - heroZoneTop;

  const topAir = Math.max(84, Math.round(heroZoneH * 0.055));
  const bottomAirToCaption = 52;
  const availLoopDiameter = Math.min(
    contentW - 420,
    heroZoneH - topAir - loopCaptionBlockH - bottomAirToCaption
  );
  const outerTipR = Math.max(580, Math.floor(availLoopDiameter / 2));
  const loopCx = Math.round(W / 2);
  const loopCy = Math.round(
    heroZoneTop +
      topAir +
      (heroZoneH - topAir - loopCaptionBlockH - bottomAirToCaption) / 2
  );

  drawHeroLoopArtwork(
    ctx,
    loopCx,
    loopCy,
    outerTipR,
    displayName,
    conversion,
    timeline
  );

  // Restrained caption directly beneath the loop's negative-space halo
  const captionStartY = loopCy + outerTipR + bottomAirToCaption;
  setCanvasFont(ctx, 400, captionFontPx, FONTS.sans);
  ctx.fillStyle = PALETTE.paperSoft;
  const drawnCapH = drawLines(
    ctx,
    loopCaptionLines,
    loopCx,
    captionStartY,
    captionLineH,
    false,
    'center'
  );

  // Minimal 2-item visual key right under the loop caption
  const keyY = captionStartY + drawnCapH + 12;
  setCanvasFont(ctx, 500, 18, FONTS.mono);
  const keyLeft = 'Values 1–26 (spike length = value)';
  const keyRight = '0 → Snap';
  const wLeft = measureWidth(ctx, keyLeft, 18, true);
  const wRight = measureWidth(ctx, keyRight, 18, true);
  const totalKeyW = 18 + wLeft + 52 + 18 + wRight;
  let kx = Math.round(loopCx - totalKeyW / 2);

  ctx.beginPath();
  ctx.arc(kx + 6, keyY + 10, 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.acidGreen;
  ctx.fill();
  ctx.fillStyle = PALETTE.pinkMuted;
  ctx.fillText(keyLeft, kx + 20, keyY);

  kx += 20 + wLeft + 46;
  ctx.beginPath();
  ctx.arc(kx + 6, keyY + 10, 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.palePink;
  ctx.fill();
  ctx.fillStyle = PALETTE.pinkMuted;
  ctx.fillText(keyRight, kx + 20, keyY);

  // ── 4. RENDER SUPPORTING AREA (C. LETTER VALUES & D. FIBONACCI-MODULO) ─────
  let curY = lowerStartY;

  // Left column: C. Letter-to-number conversion
  setCanvasFont(ctx, 700, 18, FONTS.mono);
  ctx.fillStyle = PALETTE.acidGreen;
  ctx.fillText('LETTER-TO-NUMBER CONVERSION', margin, curY);

  setCanvasFont(ctx, 600, convFontPx, FONTS.mono);
  ctx.fillStyle = PALETTE.paper;
  drawLines(ctx, convLines, margin, curY + 34, convLineH, false);

  // Right column: D. Fibonacci-modulo process
  const supRightX = margin + supLeftW + supColGap;
  setCanvasFont(ctx, 700, 18, FONTS.mono);
  ctx.fillStyle = PALETTE.acidGreen;
  ctx.fillText('FIBONACCI-MODULO PROCESS', supRightX, curY);

  setCanvasFont(ctx, 400, 23, FONTS.sans);
  ctx.fillStyle = PALETTE.paperSoft;
  const drawnFibExpH = drawLines(
    ctx,
    fibExplainLines,
    supRightX,
    curY + 34,
    35,
    false
  );

  if (showCompactSeqs && compactSeqLines.length > 0) {
    setCanvasFont(ctx, 500, 18, FONTS.mono);
    ctx.fillStyle = PALETTE.pinkMuted;
    drawLines(
      ctx,
      compactSeqLines,
      supRightX,
      curY + 34 + drawnFibExpH + 12,
      28,
      false
    );
  }

  curY += supportingBlockH + gapSupportingToGenres;

  // Subtle editorial hairline before Musical Identity & Rhythm
  ctx.fillStyle = PALETTE.hairline;
  ctx.fillRect(margin, curY - Math.round(gapSupportingToGenres / 2), contentW, 1.5);

  // ── 5. RENDER E. MUSICAL IDENTITY (SIX GENRES) ─────────────────────────────
  setCanvasFont(ctx, 700, 18, FONTS.mono);
  ctx.fillStyle = PALETTE.pinkMuted;
  ctx.fillText('MUSICAL GENRES', margin, curY);

  const genreStatusNote = isManualOverride
    ? `Suggested by algorithm: ${conversion.suggestedTheme.styleName}   ·   Currently selected: ${timeline.selectedStyleName}`
    : `Suggested & active genre: ${conversion.suggestedTheme.styleName}`;
  const statusFontPx = resolveSafeFontPx(
    ctx,
    genreStatusNote,
    600,
    FONTS.mono,
    18,
    14,
    contentW - 260,
    true
  );
  setCanvasFont(ctx, 600, statusFontPx, FONTS.mono);
  ctx.fillStyle = isManualOverride ? PALETTE.palePink : PALETTE.acidGreen;
  ctx.textAlign = 'right';
  ctx.fillText(genreStatusNote, W - margin, curY);
  ctx.textAlign = 'left';

  const genreRowY = curY + 40;
  ALL_INSTRUMENTAL_STYLES.forEach((style, idx) => {
    const gx = margin + idx * (genreColW + genreGap);
    const isSuggested = style.id === conversion.suggestedTheme.id;
    const isSelected = style.id === timeline.selectedStyleId;

    // Top typographic accent rule
    if (isSuggested) {
      ctx.fillStyle = PALETTE.acidGreen;
      ctx.fillRect(gx, genreRowY, genreColW, 4);
    } else if (isSelected) {
      ctx.fillStyle = PALETTE.vividRed;
      ctx.fillRect(gx, genreRowY, genreColW, 4);
    } else {
      ctx.fillStyle = PALETTE.hairline;
      ctx.fillRect(gx, genreRowY + 2, genreColW, 1.5);
    }

    const gLines = genreNameLinesMap[style.id] ?? [style.styleName];
    if (isSuggested) {
      setCanvasFont(ctx, 800, 28, FONTS.display);
      ctx.fillStyle = PALETTE.acidGreen;
    } else if (isSelected) {
      setCanvasFont(ctx, 800, 28, FONTS.display);
      ctx.fillStyle = PALETTE.paper;
    } else {
      setCanvasFont(ctx, 500, 26, FONTS.sans);
      ctx.fillStyle = PALETTE.paperMuted;
    }

    const gNameH = drawLines(ctx, gLines, gx, genreRowY + 16, 34, false);

    if (isSuggested && isSelected) {
      setCanvasFont(ctx, 700, 15, FONTS.mono);
      ctx.fillStyle = PALETTE.acidGreen;
      ctx.fillText('SUGGESTED', gx, genreRowY + 16 + gNameH + 6);
    } else if (isSuggested && !isSelected) {
      setCanvasFont(ctx, 700, 15, FONTS.mono);
      ctx.fillStyle = PALETTE.acidGreen;
      ctx.fillText('SUGGESTED', gx, genreRowY + 16 + gNameH + 6);
    } else if (!isSuggested && isSelected) {
      setCanvasFont(ctx, 700, 15, FONTS.mono);
      ctx.fillStyle = PALETTE.vividRed;
      ctx.fillText('SELECTED', gx, genreRowY + 16 + gNameH + 6);
    }
  });

  curY += genreBlockH + gapGenresToRhythm;

  // ── 6. RENDER F. COMPACT RHYTHM METADATA ROW ───────────────────────────────
  const rhythmItems: Array<{ label: string; value: string }> = [
    {
      label: 'TIME SIGNATURE',
      value: conversion.selectedTimeSignature.id,
    },
    {
      label: 'PERCUSSION',
      value: conversion.selectedPercussion.instrumentName,
    },
    {
      label: 'TEMPO',
      value: `${timeline.bpm} BPM`,
    },
  ];

  const rhythmColW = Math.floor(contentW / 3);
  rhythmItems.forEach((item, rIdx) => {
    const rx = margin + rIdx * rhythmColW;
    setCanvasFont(ctx, 600, 17, FONTS.mono);
    ctx.fillStyle = PALETTE.pinkMuted;
    ctx.fillText(item.label, rx, curY);

    setCanvasFont(ctx, 700, 30, FONTS.display);
    ctx.fillStyle = PALETTE.paper;
    ctx.fillText(item.value, rx, curY + 26);
  });

  return { naturalHeight: finalCanvasH };
}

/**
 * Asymmetrical widescreen gallery layout for Landscape (4000 × 3000 px).
 * Left 63% of poster: Monumental hero loop graphic floating in generous negative space.
 * Right 37% of poster: Clean Swiss-editorial column with Title/Name, Letter Values,
 * Fibonacci-modulo process, 6 Musical Genres, and Rhythm metadata.
 */
function executeLandscapeHeroLayout(
  ctx: CanvasRenderingContext2D,
  W: number,
  targetBaseH: number,
  finalCanvasH: number,
  conversion: NameConversionResult,
  timeline: ContinuousTimeline,
  dryRun: boolean
): { naturalHeight: number } {
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const margin = 150;
  const contentW = W - margin * 2; // 3700 px
  const heroFieldW = Math.floor(contentW * 0.63); // 2331 px (~63% of width)
  const colGap = 130;
  const sideColX = margin + heroFieldW + colGap;
  const sideColW = contentW - heroFieldW - colGap; // 1239 px

  const displayName = getDisplayName(
    conversion.rawInput,
    conversion.normalizedName
  );
  const isManualOverride =
    timeline.selectedStyleId !== conversion.suggestedTheme.id;

  if (!dryRun) {
    ctx.fillStyle = PALETTE.bgBase;
    ctx.fillRect(0, 0, W, finalCanvasH);
  }

  // ── MEASURE & RENDER RIGHT EDITORIAL COLUMN ────────────────────────────────
  let ry = margin + 10;

  // A. Title, Prominent Name & Headline
  setCanvasFont(ctx, 700, 24, FONTS.sans);
  const titleLines = wrapWordsIntact(
    ctx,
    'The Sound of a Name',
    sideColW,
    24,
    false
  );
  if (!dryRun) {
    ctx.fillStyle = PALETTE.acidGreen;
  }
  ry += drawLines(ctx, titleLines, sideColX, ry, 34, dryRun) + 18;

  const bigNamePx = resolveSafeFontPx(
    ctx,
    displayName,
    800,
    FONTS.display,
    84,
    34,
    sideColW,
    false
  );
  const bigNameLineH = Math.round(bigNamePx * 1.12);
  const bigNameLines = wrapWordsIntact(
    ctx,
    displayName,
    sideColW,
    bigNamePx,
    false
  );
  if (!dryRun) {
    setCanvasFont(ctx, 800, bigNamePx, FONTS.display);
    ctx.fillStyle = PALETTE.paper;
  }
  ry += drawLines(ctx, bigNameLines, sideColX, ry, bigNameLineH, dryRun) + 18;

  const headlineText = `How ‘${displayName}’ Becomes a Musical Composition`;
  const headlinePx = resolveSafeFontPx(
    ctx,
    headlineText,
    700,
    FONTS.display,
    42,
    26,
    sideColW,
    false
  );
  const headlineLineH = Math.round(headlinePx * 1.25);
  const headlineLines = wrapWordsIntact(
    ctx,
    headlineText,
    sideColW,
    headlinePx,
    false
  );
  if (!dryRun) {
    setCanvasFont(ctx, 700, headlinePx, FONTS.display);
    ctx.fillStyle = PALETTE.paperSoft;
  }
  ry +=
    drawLines(ctx, headlineLines, sideColX, ry, headlineLineH, dryRun) + 64;

  // C. Letter-to-number conversion
  if (!dryRun) {
    ctx.fillStyle = PALETTE.hairline;
    ctx.fillRect(sideColX, ry - 30, sideColW, 1.5);
    setCanvasFont(ctx, 700, 18, FONTS.mono);
    ctx.fillStyle = PALETTE.acidGreen;
    ctx.fillText('LETTER-TO-NUMBER CONVERSION', sideColX, ry);
  }
  ry += 34;

  const conversionPairsStr = conversion.letters
    .map((l) => `${l.letter}=${l.alphabetValue}`)
    .join(', ');
  const convFontPx = resolveSafeFontPx(
    ctx,
    conversionPairsStr,
    600,
    FONTS.mono,
    24,
    17,
    sideColW,
    true
  );
  const convLineH = Math.round(convFontPx * 1.56);
  const convLines = wrapWordsIntact(
    ctx,
    conversionPairsStr,
    sideColW,
    convFontPx,
    true
  );
  if (!dryRun) {
    setCanvasFont(ctx, 600, convFontPx, FONTS.mono);
    ctx.fillStyle = PALETTE.paper;
  }
  ry += drawLines(ctx, convLines, sideColX, ry, convLineH, dryRun) + 54;

  // D. Fibonacci-modulo process
  if (!dryRun) {
    setCanvasFont(ctx, 700, 18, FONTS.mono);
    ctx.fillStyle = PALETTE.acidGreen;
    ctx.fillText('FIBONACCI-MODULO PROCESS', sideColX, ry);
  }
  ry += 34;

  const fibExplainStr =
    'Every letter generates its own Fibonacci-modulo cycle from its alphabet value, triggering a recorded human sound at each step until the cycle repeats.';
  setCanvasFont(ctx, 400, 22, FONTS.sans);
  const fibExplainLines = wrapWordsIntact(
    ctx,
    fibExplainStr,
    sideColW,
    22,
    false
  );
  if (!dryRun) {
    ctx.fillStyle = PALETTE.paperSoft;
  }
  ry += drawLines(ctx, fibExplainLines, sideColX, ry, 34, dryRun);

  if (shouldShowCompactSequences(conversion)) {
    const seqSummary = conversion.letters
      .map((l) => `${l.letter}(${l.alphabetValue}): ${l.sequence.join(', ')}`)
      .join('   ·   ');
    setCanvasFont(ctx, 500, 17, FONTS.mono);
    const seqLines = wrapWordsIntact(ctx, seqSummary, sideColW, 17, true);
    if (!dryRun) {
      ctx.fillStyle = PALETTE.pinkMuted;
    }
    ry += 12 + drawLines(ctx, seqLines, sideColX, ry + 12, 26, dryRun);
  }
  ry += 68;

  // E. Six Musical Genres (clean 3 × 2 typographic grid)
  if (!dryRun) {
    ctx.fillStyle = PALETTE.hairline;
    ctx.fillRect(sideColX, ry - 32, sideColW, 1.5);
    setCanvasFont(ctx, 700, 18, FONTS.mono);
    ctx.fillStyle = PALETTE.pinkMuted;
    ctx.fillText('MUSICAL GENRES', sideColX, ry);
  }
  ry += 30;

  const genreStatusNote = isManualOverride
    ? `Suggested by algorithm: ${conversion.suggestedTheme.styleName} · Selected: ${timeline.selectedStyleName}`
    : `Suggested & active genre: ${conversion.suggestedTheme.styleName}`;
  setCanvasFont(ctx, 600, 17, FONTS.mono);
  const statusLines = wrapWordsIntact(
    ctx,
    genreStatusNote,
    sideColW,
    17,
    true
  );
  if (!dryRun) {
    ctx.fillStyle = isManualOverride ? PALETTE.palePink : PALETTE.acidGreen;
  }
  ry += drawLines(ctx, statusLines, sideColX, ry, 25, dryRun) + 24;

  const gCols = 3;
  const gGapX = 32;
  const gGapY = 30;
  const gCellW = Math.floor((sideColW - gGapX * (gCols - 1)) / gCols);

  for (let row = 0; row < 2; row++) {
    let rowMaxH = 66;
    for (let col = 0; col < gCols; col++) {
      const idx = row * gCols + col;
      const style = ALL_INSTRUMENTAL_STYLES[idx];
      const gx = sideColX + col * (gCellW + gGapX);
      const isSuggested = style.id === conversion.suggestedTheme.id;
      const isSelected = style.id === timeline.selectedStyleId;

      setCanvasFont(ctx, 700, 26, FONTS.display);
      const gLines = wrapWordsIntact(
        ctx,
        style.styleName,
        gCellW - 6,
        26,
        false
      );
      const hasTag = isSuggested || isSelected;
      rowMaxH = Math.max(rowMaxH, 16 + gLines.length * 32 + (hasTag ? 26 : 4));

      if (!dryRun) {
        if (isSuggested) {
          ctx.fillStyle = PALETTE.acidGreen;
          ctx.fillRect(gx, ry, gCellW, 4);
          setCanvasFont(ctx, 800, 26, FONTS.display);
          ctx.fillStyle = PALETTE.acidGreen;
        } else if (isSelected) {
          ctx.fillStyle = PALETTE.vividRed;
          ctx.fillRect(gx, ry, gCellW, 4);
          setCanvasFont(ctx, 800, 26, FONTS.display);
          ctx.fillStyle = PALETTE.paper;
        } else {
          ctx.fillStyle = PALETTE.hairline;
          ctx.fillRect(gx, ry + 2, gCellW, 1.5);
          setCanvasFont(ctx, 500, 25, FONTS.sans);
          ctx.fillStyle = PALETTE.paperMuted;
        }

        const drawnGH = drawLines(ctx, gLines, gx, ry + 16, 32, false);
        if (isSuggested) {
          setCanvasFont(ctx, 700, 14, FONTS.mono);
          ctx.fillStyle = PALETTE.acidGreen;
          ctx.fillText('SUGGESTED', gx, ry + 16 + drawnGH + 5);
        } else if (isSelected) {
          setCanvasFont(ctx, 700, 14, FONTS.mono);
          ctx.fillStyle = PALETTE.vividRed;
          ctx.fillText('SELECTED', gx, ry + 16 + drawnGH + 5);
        }
      }
    }
    ry += rowMaxH + (row === 0 ? gGapY : 0);
  }
  ry += 66;

  // F. Compact Rhythm Metadata Row
  if (!dryRun) {
    ctx.fillStyle = PALETTE.hairline;
    ctx.fillRect(sideColX, ry - 30, sideColW, 1.5);
  }

  const rhythmItems: Array<{ label: string; value: string }> = [
    { label: 'TIME SIGNATURE', value: conversion.selectedTimeSignature.id },
    {
      label: 'PERCUSSION',
      value: conversion.selectedPercussion.instrumentName,
    },
    { label: 'TEMPO', value: `${timeline.bpm} BPM` },
  ];
  const rColW = Math.floor(sideColW / 3);
  let maxRhythmValH = 38;
  rhythmItems.forEach((item, rIdx) => {
    const rx = sideColX + rIdx * rColW;
    setCanvasFont(ctx, 700, 28, FONTS.display);
    const valLines = wrapWordsIntact(ctx, item.value, rColW - 14, 28, false);
    maxRhythmValH = Math.max(maxRhythmValH, valLines.length * 34);

    if (!dryRun) {
      setCanvasFont(ctx, 600, 16, FONTS.mono);
      ctx.fillStyle = PALETTE.pinkMuted;
      ctx.fillText(item.label, rx, ry);

      setCanvasFont(ctx, 700, 28, FONTS.display);
      ctx.fillStyle = PALETTE.paper;
      drawLines(ctx, valLines, rx, ry + 26, 34, false);
    }
  });
  ry += 26 + maxRhythmValH;

  const naturalHeight = Math.max(targetBaseH, ry + margin);
  if (dryRun) {
    return { naturalHeight };
  }

  // ── RENDER LEFT HERO LOOP FIELD (~63% OF POSTER SPACE) ─────────────────────
  const loopCaptionStr = `Concentric loop representing the musical composition generated from ‘${displayName}’ — ${
    conversion.letters.length
  } ${conversion.letters.length === 1 ? 'letter ring' : 'letter rings'}, ${
    timeline.totalSteps
  } sound ${timeline.totalSteps === 1 ? 'step' : 'steps'}.`;
  const captionMaxW = Math.round(heroFieldW * 0.84);
  const captionFontPx = resolveSafeFontPx(
    ctx,
    loopCaptionStr,
    400,
    FONTS.sans,
    23,
    17,
    captionMaxW,
    false
  );
  const captionLineH = Math.round(captionFontPx * 1.48);
  const loopCaptionLines = wrapWordsIntact(
    ctx,
    loopCaptionStr,
    captionMaxW,
    captionFontPx,
    false
  );
  const captionBlockH = loopCaptionLines.length * captionLineH + 40;

  const availH = finalCanvasH - margin * 2 - captionBlockH - 64;
  const availW = heroFieldW - 180;
  const outerTipR = Math.max(620, Math.floor(Math.min(availW, availH) / 2));
  const loopCx = Math.round(margin + heroFieldW / 2);
  const loopCy = Math.round(margin + availH / 2);

  drawHeroLoopArtwork(
    ctx,
    loopCx,
    loopCy,
    outerTipR,
    displayName,
    conversion,
    timeline
  );

  const captionStartY = loopCy + outerTipR + 54;
  setCanvasFont(ctx, 400, captionFontPx, FONTS.sans);
  ctx.fillStyle = PALETTE.paperSoft;
  const drawnCapH = drawLines(
    ctx,
    loopCaptionLines,
    loopCx,
    captionStartY,
    captionLineH,
    false,
    'center'
  );

  // Subtle inline color key
  const keyY = captionStartY + drawnCapH + 12;
  setCanvasFont(ctx, 500, 18, FONTS.mono);
  const keyLeft = 'Values 1–26 (spike length = value)';
  const keyRight = '0 → Snap';
  const wLeft = measureWidth(ctx, keyLeft, 18, true);
  const wRight = measureWidth(ctx, keyRight, 18, true);
  const totalKeyW = 18 + wLeft + 52 + 18 + wRight;
  let kx = Math.round(loopCx - totalKeyW / 2);

  ctx.beginPath();
  ctx.arc(kx + 6, keyY + 10, 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.acidGreen;
  ctx.fill();
  ctx.fillStyle = PALETTE.pinkMuted;
  ctx.fillText(keyLeft, kx + 20, keyY);

  kx += 20 + wLeft + 46;
  ctx.beginPath();
  ctx.arc(kx + 6, keyY + 10, 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.palePink;
  ctx.fill();
  ctx.fillStyle = PALETTE.pinkMuted;
  ctx.fillText(keyRight, kx + 20, keyY);

  return { naturalHeight: finalCanvasH };
}

export function renderPosterToCanvas(
  canvas: HTMLCanvasElement,
  conversion: NameConversionResult,
  timeline: ContinuousTimeline,
  format: PosterFormat = 'square'
): RenderedPosterSize {
  const dims = POSTER_FORMATS[format];
  const W = dims.width;

  canvas.width = W;
  canvas.height = dims.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not obtain 2D rendering context for poster export.');
  }

  const layoutFn =
    format === 'landscape'
      ? executeLandscapeHeroLayout
      : executeVerticalHeroLayout;

  // Pass 1: Measure natural content height so nothing ever clips or crowds the hero loop
  const { naturalHeight } = layoutFn(
    ctx,
    W,
    dims.height,
    dims.height,
    conversion,
    timeline,
    true
  );

  const finalH = Math.max(dims.height, Math.ceil(naturalHeight));
  canvas.width = W;
  canvas.height = finalH;

  // Pass 2: Render high-resolution poster (>= 3000 × 3000 px)
  layoutFn(ctx, W, dims.height, finalH, conversion, timeline, false);

  return { width: W, height: finalH };
}
