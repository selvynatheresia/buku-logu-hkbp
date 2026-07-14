// Renderer SVG not angka — Tahap B: ANGKA SAJA, tanpa lirik.
//
// ⛔ GERBANG: layout lirik (Tahap C) menunggu foto BL-73 dari Selvyna —
// jangan tambahkan lirik di sini sebelum foto itu jadi acuan.
//
// Renderer ini menggambar dari model cipher (src/music/cipher.ts), TIDAK
// pernah menyentuh model internal langsung — pemisahan yang sama dengan
// Verovio vs otak musik. Semua ukuran relatif ke fontSizePx supaya skala
// konsisten di tablet/HP. Layout persis (jarak, posisi titik) provisional
// sampai diverifikasi terhadap cetakan Logu 110.

import type { CipherCell, CipherMeasure, CipherScore } from '../music/cipher';

export interface CipherSvgOptions {
  /** Lebar maksimum baris notasi dalam px. */
  maxWidthPx?: number;
  /** Ukuran digit; semua metrik lain proporsional terhadap ini. */
  fontSizePx?: number;
}

interface CellPos {
  cell: CipherCell;
  x: number; // pusat sel
  lineIdx: number;
}

export function cipherToSvg(cipher: CipherScore, options: CipherSvgOptions = {}): string {
  const f = options.fontSizePx ?? 20;
  const maxWidth = options.maxWidthPx ?? 800;

  // ---- metrik dasar (relatif ke f) ----
  const adv = f * 1.15; // lebar grid satu sel
  const beatGap = f * 0.4; // jarak antar kelompok ketukan
  const barPad = f * 0.55; // jarak sel ke garis birama
  const lineHeight = f * 3.2;
  const padX = f * 0.6;
  const padY = f * 0.8;

  // Fase 1 tahap ini: single melody — suara pertama saja.
  // (SATB 4 baris menyusul setelah verifikasi single melody vs cetakan.)
  const voice = cipher.voices[0];
  if (voice === undefined) return emptySvg(maxWidth, lineHeight);

  const measureWidth = (m: CipherMeasure): number => {
    const nCells = m.beats.reduce((sum, b) => sum + b.cells.length, 0);
    return nCells * adv + Math.max(0, m.beats.length - 1) * beatGap + 2 * barPad;
  };

  // ---- pembagian baris (greedy per birama) ----
  const lines: CipherMeasure[][] = [];
  let current: CipherMeasure[] = [];
  let currentWidth = 0;
  for (const measure of voice.measures) {
    const w = measureWidth(measure);
    if (current.length > 0 && currentWidth + w > maxWidth - 2 * padX) {
      lines.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(measure);
    currentWidth += w;
  }
  if (current.length > 0) lines.push(current);

  // ---- gambar ----
  const parts: string[] = [];
  const slurStarts: CellPos[] = [];
  const text = (x: number, y: number, s: string, size = f, extra = '') =>
    parts.push(
      `<text x="${r2(x)}" y="${r2(y)}" font-size="${r2(size)}" text-anchor="middle"${extra}>${s}</text>`,
    );
  const line = (x1: number, y1: number, x2: number, y2: number, w = f * 0.06) =>
    parts.push(
      `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="currentColor" stroke-width="${r2(w)}"/>`,
    );
  const dot = (cx: number, cy: number, radius = f * 0.09) =>
    parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(radius)}" fill="currentColor"/>`);

  lines.forEach((measures, lineIdx) => {
    const baseline = padY + lineIdx * lineHeight + f * 1.7;
    let x = padX;

    // garis birama pembuka baris
    line(x, baseline - f, x, baseline + f * 0.25);

    for (const measure of measures) {
      x += barPad;

      for (const [beatIdx, beat] of measure.beats.entries()) {
        if (beatIdx > 0) x += beatGap;
        const cellXs: number[] = [];

        for (const cell of beat.cells) {
          const cx = x + adv / 2;
          cellXs.push(cx);
          drawCell(cell, cx, baseline);
          x += adv;
        }

        // underline per kedalaman, run kontigu dalam satu ketukan (seperti beam)
        const maxDepth = Math.max(...beat.cells.map((c) => c.underlines));
        for (let depth = 1; depth <= maxDepth; depth++) {
          let runStart: number | null = null;
          beat.cells.forEach((cell, i) => {
            const has = cell.underlines >= depth;
            if (has && runStart === null) runStart = i;
            const isEnd = runStart !== null && (!has || i === beat.cells.length - 1);
            if (isEnd && runStart !== null) {
              const lastIdx = has ? i : i - 1;
              const y = baseline + f * 0.22 + (depth - 1) * f * 0.14;
              line(cellXs[runStart] - adv * 0.42, y, cellXs[lastIdx] + adv * 0.42, y);
              runStart = null;
            }
          });
        }
      }

      x += barPad;
      // garis birama penutup
      if (measure.finalBar) {
        line(x, baseline - f, x, baseline + f * 0.25);
        line(x + f * 0.22, baseline - f, x + f * 0.22, baseline + f * 0.25, f * 0.18);
        x += f * 0.3;
      } else {
        line(x, baseline - f, x, baseline + f * 0.25);
      }
    }

    function drawCell(cell: CipherCell, cx: number, base: number): void {
      switch (cell.kind) {
        case 'note': {
          text(cx, base, String(cell.degree));
          if (cell.accidental !== null) {
            // provisional (menunggu konvensi cetakan) — selalu ada warning-nya
            text(cx - f * 0.42, base - f * 0.35, cell.accidental > 0 ? '♯' : '♭', f * 0.55);
          }
          for (let i = 0; i < cell.octaveDots; i++) {
            dot(cx, base - f * 1.02 - i * f * 0.26);
          }
          const belowStart = base + f * 0.28 + cell.underlines * f * 0.14 + f * 0.18;
          for (let i = 0; i < -cell.octaveDots; i++) {
            dot(cx, belowStart + i * f * 0.26);
          }
          if (cell.slurStart) slurStarts.push({ cell, x: cx, lineIdx });
          if (cell.slurStop) {
            const start = slurStarts.pop();
            if (start !== undefined && start.lineIdx === lineIdx) {
              // lengkung melisma di atas angka (hanya dalam satu baris)
              const yArc = base - f * 1.15;
              parts.push(
                `<path d="M ${r2(start.x)} ${r2(yArc)} Q ${r2((start.x + cx) / 2)} ${r2(yArc - f * 0.5)} ${r2(cx)} ${r2(yArc)}" fill="none" stroke="currentColor" stroke-width="${r2(f * 0.06)}"/>`,
              );
            }
          }
          break;
        }
        case 'dash':
          line(cx - f * 0.28, base - f * 0.32, cx + f * 0.28, base - f * 0.32, f * 0.09);
          break;
        case 'dot':
          dot(cx, base - f * 0.14);
          break;
        case 'rest':
          text(cx, base, '0');
          break;
      }
      if (cell.fermata) {
        const yF = base - f * 1.45;
        parts.push(
          `<path d="M ${r2(cx - f * 0.32)} ${r2(yF)} A ${r2(f * 0.32)} ${r2(f * 0.32)} 0 0 1 ${r2(cx + f * 0.32)} ${r2(yF)}" fill="none" stroke="currentColor" stroke-width="${r2(f * 0.07)}"/>`,
        );
        dot(cx, yF - f * 0.1, f * 0.07);
      }
    }
  });

  const height = padY * 2 + lines.length * lineHeight;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${maxWidth} ${r2(height)}" ` +
    `font-family="Georgia, 'Times New Roman', serif" fill="currentColor" role="img" ` +
    `aria-label="Not angka">` +
    parts.join('') +
    `</svg>`
  );
}

function emptySvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
}

/** Bulatkan 2 desimal — SVG tetap kecil dan diff-able. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
