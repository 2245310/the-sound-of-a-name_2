/**
 * src/components/PosterExportPanel.tsx
 * ------------------------------------
 * Complete High-Resolution PNG Poster Preview & Export Panel (minimum
 * 3000 × 3000 px, dynamically expanding vertically when long names or long
 * Fibonacci-modulo cycles produce taller visual records).
 */

import React, { useEffect, useRef, useState } from 'react';
import type { NameConversionResult } from '../engine/types';
import type { ContinuousTimeline } from '../audio/types';
import {
  buildPosterFilename,
  POSTER_FORMATS,
  renderPosterToCanvas,
  type PosterFormat,
  type RenderedPosterSize,
} from '../poster/posterRenderer';

interface PosterExportPanelProps {
  conversion: NameConversionResult;
  timeline: ContinuousTimeline;
}

export const PosterExportPanel: React.FC<PosterExportPanelProps> = ({
  conversion,
  timeline,
}) => {
  const [format, setFormat] = useState<PosterFormat>('square');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [renderedSize, setRenderedSize] = useState<RenderedPosterSize>(() => ({
    width: POSTER_FORMATS.square.width,
    height: POSTER_FORMATS.square.height,
  }));
  const [lastExportInfo, setLastExportInfo] = useState<{
    filename: string;
    width: number;
    height: number;
    sizeKB: number;
  } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const expectedFilename = buildPosterFilename(
    conversion.rawInput,
    conversion.normalizedName,
    format
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    // Render immediately for instant feedback, then re-render once web fonts
    // finish loading so preview metrics & glyphs match the exported PNG 1:1.
    const initialSize = renderPosterToCanvas(
      canvas,
      conversion,
      timeline,
      format
    );
    setRenderedSize(initialSize);
    setLastExportInfo(null);

    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (cancelled || !previewCanvasRef.current) return;
        const readySize = renderPosterToCanvas(
          previewCanvasRef.current,
          conversion,
          timeline,
          format
        );
        setRenderedSize(readySize);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [conversion, timeline, format]);

  const handleDownloadPoster = async () => {
    setIsExporting(true);
    try {
      if (typeof document !== 'undefined' && document.fonts?.ready) {
        await document.fonts.ready;
      }

      const exportCanvas = document.createElement('canvas');
      const finalDims = renderPosterToCanvas(
        exportCanvas,
        conversion,
        timeline,
        format
      );

      // Re-sync on-screen preview canvas as well
      if (previewCanvasRef.current) {
        renderPosterToCanvas(
          previewCanvasRef.current,
          conversion,
          timeline,
          format
        );
      }
      setRenderedSize(finalDims);

      const blob: Blob | null = await new Promise((resolve) =>
        exportCanvas.toBlob((b) => resolve(b), 'image/png', 1.0)
      );

      if (!blob) {
        throw new Error('Failed to encode high-resolution PNG blob.');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = expectedFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setLastExportInfo({
        filename: expectedFilename,
        width: finalDims.width,
        height: finalDims.height,
        sizeKB: Math.round(blob.size / 1024),
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section
      className="poster-export-section"
      aria-labelledby="poster-export-heading"
    >
      <div className="section-header-bar">
        <div>
          <span className="section-kicker">
            ARCHIVAL PRINT EXPORT // HIGH-RESOLUTION POSTER (3000+ PX PNG)
          </span>
          <h2 id="poster-export-heading" className="section-title">
            Generative Music Poster — “{conversion.rawInput.trim() || conversion.normalizedName}”
          </h2>
          <p className="section-subtitle">
            Exports a high-resolution editorial poster (minimum 3000 × 3000 px)
            centered on your name’s concentric Fibonacci-modulo loop artwork,
            accompanied by letter values, musical genre identity, and rhythm
            metadata.
          </p>
        </div>
      </div>

      <div className="poster-studio-grid">
        <div className="poster-controls-card">
          <div className="exp-step-num">SELECT POSTER FORMAT</div>
          <h3>Choose Aspect Ratio &amp; Resolution</h3>

          <div className="poster-format-options" role="radiogroup">
            {(Object.keys(POSTER_FORMATS) as PosterFormat[]).map((fmtKey) => {
              const spec = POSTER_FORMATS[fmtKey];
              const isSelected = format === fmtKey;
              return (
                <button
                  key={fmtKey}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  className={`poster-format-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setFormat(fmtKey)}
                >
                  <div className="format-btn-title">{spec.label}</div>
                  <div className="format-btn-dims">{spec.aspectLabel}</div>
                </button>
              );
            })}
          </div>

          <div className="poster-spec-summary">
            <div className="spec-row">
              <span>Output Filename:</span>
              <code>{expectedFilename}</code>
            </div>
            <div className="spec-row">
              <span>Exact Export Resolution:</span>
              <code>
                {renderedSize.width} × {renderedSize.height} px
              </code>
            </div>
            <div className="spec-row">
              <span>Suggested vs. Selected Theme:</span>
              <code>
                {conversion.suggestedTheme.styleName} / {timeline.selectedStyleName}
              </code>
            </div>
            <div className="spec-row">
              <span>Meter, Percussion &amp; Tempo:</span>
              <code>
                {conversion.selectedTimeSignature.id} ·{' '}
                {conversion.selectedPercussion.instrumentName} · {timeline.bpm} BPM
              </code>
            </div>
          </div>

          <button
            type="button"
            className="btn-download-poster"
            onClick={handleDownloadPoster}
            disabled={isExporting}
          >
            {isExporting
              ? 'Rendering High-Resolution PNG...'
              : `⬇ Download Complete Poster PNG (${renderedSize.width} × ${renderedSize.height} px)`}
          </button>

          {lastExportInfo && (
            <div className="export-success-box" role="status">
              <strong>✓ Exported {lastExportInfo.filename}</strong>
              <div>
                {lastExportInfo.width} × {lastExportInfo.height} px ·{' '}
                {lastExportInfo.sizeKB} KB PNG
              </div>
            </div>
          )}
        </div>

        <div className="poster-preview-card">
          <div className="preview-top-bar">
            <span className="mono-time">
              LIVE FULL-POSTER PREVIEW ({renderedSize.width} ×{' '}
              {renderedSize.height} PX)
            </span>
            <span className="mono-time">{expectedFilename}</span>
          </div>
          <div className="poster-canvas-frame">
            <canvas
              ref={previewCanvasRef}
              className="poster-preview-canvas"
              aria-label={`Complete high-resolution poster preview for ${conversion.normalizedName}`}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
