// Renderer SVG not angka — Tahap C1: angka + lirik semua bait.
//
// Acuan layout: foto BL-73 (keputusan 17 Jul 2026 — MEKANISME cetakan diikuti,
// gaya cetak khas re-typeset Serpong tidak):
// - Garis pembagi ketukan digambar DI ATAS angka (bukan underline).
// - Perpanjangan not (dash maupun dot di model) digambar TITIK — cetakan BL
//   memakai titik untuk semua perpanjangan; model tetap membedakan dash/dot
//   secara struktural, keputusan glyph murni di sini.
// - Slur/melisma = lengkung DI BAWAH angka.
// - Lirik: SEMUA bait bertumpuk di bawah baris angka; suku kata rata-tengah
//   di kolom not-nya; tanda hubung = token terpisah di tengah celah — saat
//   nada ditahan, hyphen otomatis jatuh di wilayah kolom perpanjangan.
// - Nomor bait: "1." polos di gutter kiri (keputusan desain — netral,
//   standar buku nyanyian; BUKAN angka dilingkari khas Serpong).
//
// Parameter versesToShow = kontrak Opsi C: renderer yang sama melayani Mode
// Ibadah (default: semua bait) dan Mode Latihan (satu bait) — mode HANYA
// mempengaruhi bait yang digambar.
//
// Lebar kolom = 2-pass: ukur dulu (angka vs suku kata terpanjang antar bait
// yang tampil), baru gambar. Pengukuran teks injectable supaya test
// deterministik (heuristik) sementara browser bisa memakai canvas presisi.

import { fracCompare } from '../music/model';
import type { CipherCell, CipherMeasure, CipherNoteCell, CipherScore } from '../music/cipher';

export type TextMeasurer = (text: string, sizePx: number, italic: boolean) => number;

export interface CipherSvgOptions {
  maxWidthPx?: number;
  fontSizePx?: number;
  /** Nomor bait yang digambar; default semua (Mode Ibadah). */
  versesToShow?: number[];
  measureText?: TextMeasurer;
}

// ---------------------------------------------------------------------------
// Pengukuran teks
// ---------------------------------------------------------------------------

/** Heuristik lebar teks serif — deterministik untuk test & fallback. */
export const heuristicMeasurer: TextMeasurer = (text, sizePx) => {
  let units = 0;
  for (const ch of text) {
    if ("iljt.,'’ -".includes(ch)) units += 0.32;
    else if ('mwMW'.includes(ch)) units += 0.85;
    else if (ch >= 'A' && ch <= 'Z') units += 0.68;
    else units += 0.52;
  }
  return units * sizePx;
};

let canvasCtx: CanvasRenderingContext2D | null | undefined;

/** Pengukur presisi berbasis canvas (browser); jatuh ke heuristik kalau tak ada. */
export const canvasMeasurer: TextMeasurer = (text, sizePx, italic) => {
  if (canvasCtx === undefined) {
    canvasCtx = typeof document === 'undefined'
      ? null
      : document.createElement('canvas').getContext('2d');
  }
  if (!canvasCtx) return heuristicMeasurer(text, sizePx, italic);
  canvasCtx.font = `${italic ? 'italic ' : ''}${sizePx}px Georgia, 'Times New Roman', serif`;
  return canvasCtx.measureText(text).width;
};

// ---------------------------------------------------------------------------
// Perencanaan token lirik (pure — diuji langsung)
// ---------------------------------------------------------------------------

export interface CellWithX {
  cell: CipherCell;
  /** Pusat kolom sel. */
  x: number;
}

export interface LyricToken {
  verse: number;
  kind: 'syllable' | 'hyphen';
  text: string;
  x: number;
}

/**
 * Suku kata → kolom notnya; hyphen → titik tengah antara dua kolom
 * bersuku-kata. Kolom perpanjangan/melisma di antaranya otomatis terlewati,
 * sehingga hyphen jatuh di wilayahnya — persis pola cetakan BL-73
 * ("Si - pa - ngo   -   lu"). Hyphen di ujung baris (kata terpotong pindah
 * baris) digantung sedikit di kanan kolom terakhir.
 */
export function planLyricTokens(
  cells: CellWithX[],
  verses: number[],
  lineEndOverhang = 14,
): LyricToken[] {
  const tokens: LyricToken[] = [];
  for (const verse of verses) {
    const bearing = cells.filter(
      (c): c is CellWithX & { cell: CipherNoteCell } =>
        c.cell.kind === 'note' && c.cell.lyrics[verse] !== undefined,
    );
    bearing.forEach((c, i) => {
      const syl = c.cell.lyrics[verse];
      tokens.push({ verse, kind: 'syllable', text: syl.text, x: c.x });
      if (syl.syllabic === 'begin' || syl.syllabic === 'middle') {
        const next = bearing[i + 1];
        tokens.push({
          verse,
          kind: 'hyphen',
          text: '-',
          x: next !== undefined ? (c.x + next.x) / 2 : c.x + lineEndOverhang,
        });
      }
    });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

export function cipherToSvg(cipher: CipherScore, options: CipherSvgOptions = {}): string {
  const f = options.fontSizePx ?? 20;
  const maxWidth = options.maxWidthPx ?? 800;
  const measure = options.measureText ?? heuristicMeasurer;

  const voice = cipher.voices[0];
  if (voice === undefined) return emptySvg(maxWidth, f * 3);

  const allVerses = Array.from({ length: cipher.versesCount }, (_, i) => i + 1);
  const verses = (options.versesToShow ?? allVerses).filter((v) => allVerses.includes(v));

  // ---- metrik ----
  const lyricSize = f * 0.78;
  const minCellW = f * 1.15;
  const beatGap = f * 0.4;
  const barPad = f * 0.55;
  const padX = f * 0.6;
  const padY = f * 0.7;
  const gutterW = verses.length > 0 ? measure('9.', lyricSize, false) + f * 0.55 : 0;
  const lyricLineH = lyricSize * 1.35;
  // band dinamika (mf, hairpin, dim.) di atas baris angka — ruangnya hanya
  // dialokasikan kalau skor memang punya tanda arah
  const hasDirections = voice.measures.some((m) => m.directions.length > 0);
  const aboveZone = hasDirections ? f * 2.75 : f * 2.0;
  const belowZone = f * 1.3;
  const lineHeight = aboveZone + belowZone + verses.length * lyricLineH + f * 0.5;

  // ---- pass 1: lebar kolom & birama ----
  const cellWidth = (cell: CipherCell): number => {
    let w = minCellW;
    if (cell.kind === 'note') {
      for (const v of verses) {
        const syl = cell.lyrics[v];
        if (syl !== undefined) {
          w = Math.max(w, measure(syl.text, lyricSize, true) + f * 0.45);
        }
      }
    }
    return w;
  };

  const measureWidth = (m: CipherMeasure): number => {
    let w = 2 * barPad + Math.max(0, m.beats.length - 1) * beatGap;
    for (const beat of m.beats) for (const cell of beat.cells) w += cellWidth(cell);
    return w + (m.finalBar ? f * 0.3 : 0);
  };

  // ---- pembagian baris ----
  const usable = maxWidth - 2 * padX - gutterW;
  const lines: CipherMeasure[][] = [];
  let current: CipherMeasure[] = [];
  let currentW = 0;
  for (const m of voice.measures) {
    const w = measureWidth(m);
    if (current.length > 0 && currentW + w > usable) {
      lines.push(current);
      current = [];
      currentW = 0;
    }
    current.push(m);
    currentW += w;
  }
  if (current.length > 0) lines.push(current);

  // ---- pass 2: gambar ----
  const parts: string[] = [];
  const text = (
    x: number,
    y: number,
    s: string,
    size = f,
    attrs = '',
  ) =>
    parts.push(
      `<text x="${r2(x)}" y="${r2(y)}" font-size="${r2(size)}" text-anchor="middle"${attrs}>${esc(s)}</text>`,
    );
  const line = (x1: number, y1: number, x2: number, y2: number, w = f * 0.06) =>
    parts.push(
      `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" stroke="currentColor" stroke-width="${r2(w)}"/>`,
    );
  const dot = (cx: number, cy: number, radius = f * 0.09) =>
    parts.push(`<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(radius)}" fill="currentColor"/>`);

  lines.forEach((measures, lineIdx) => {
    const baseline = padY + lineIdx * lineHeight + aboveZone;
    const barTop = baseline - f * 1.35;
    const barBottom = baseline + f * 0.25;
    let x = padX + gutterW;

    const lineCells: CellWithX[] = [];
    const slurStarts: number[] = []; // pusat x sel slurStart (baris ini)
    // band dinamika baris ini
    const dynY = baseline - f * 2.05;
    const wedgeYMid = dynY - f * 0.2;
    const wedgeH = f * 0.28;
    const wedges: { type: 'crescendo' | 'diminuendo' | 'stop'; x: number }[] = [];

    // Nomor birama di awal sistem (kecuali sistem pertama) — konvensi partitur
    // profesional untuk koordinasi latihan; kecil & diredam, ikut nomor file.
    if (lineIdx > 0 && measures.length > 0) {
      parts.push(
        `<text class="mnum" x="${r2(x)}" y="${r2(baseline - f * 1.55)}" font-size="${r2(f * 0.55)}" fill-opacity="0.55">${esc(measures[0].number)}</text>`,
      );
    }

    line(x, barTop, x, barBottom); // barline pembuka baris

    for (const m of measures) {
      const measureCellStart = lineCells.length;
      x += barPad;
      m.beats.forEach((beat, beatIdx) => {
        if (beatIdx > 0) x += beatGap;
        const maxDepth = Math.max(...beat.cells.map((c) => c.underlines));
        const beatCells: { cx: number; cell: CipherCell }[] = [];

        for (const cell of beat.cells) {
          const w = cellWidth(cell);
          const cx = x + w / 2;
          beatCells.push({ cx, cell });
          lineCells.push({ cell, x: cx });
          drawCell(cell, cx, maxDepth);
          x += w;
        }

        // garis pembagi DI ATAS angka (konvensi BL-73), run kontigu per ketukan
        for (let depth = 1; depth <= maxDepth; depth++) {
          let runStart: number | null = null;
          beatCells.forEach(({ cell }, i) => {
            const has = cell.underlines >= depth;
            if (has && runStart === null) runStart = i;
            const isEnd = runStart !== null && (!has || i === beatCells.length - 1);
            if (isEnd && runStart !== null) {
              const lastIdx = has ? i : i - 1;
              const y = baseline - f * 0.92 - (depth - 1) * f * 0.14;
              const half = (idx: number) => cellWidth(beatCells[idx].cell) * 0.4;
              line(beatCells[runStart].cx - half(runStart), y, beatCells[lastIdx].cx + half(lastIdx), y);
              runStart = null;
            }
          });
        }
      });

      x += barPad;
      if (m.finalBar) {
        line(x, barTop, x, barBottom);
        line(x + f * 0.22, barTop, x + f * 0.22, barBottom, f * 0.18);
        x += f * 0.3;
      } else {
        line(x, barTop, x, barBottom);
      }

      // tanda arah birama ini — x diambil dari sel pertama pada/atau setelah
      // posisi waktunya (nearest-cell anchoring)
      const measureCells = lineCells.slice(measureCellStart);
      for (const dir of m.directions) {
        const anchor =
          measureCells.find((c) => fracCompare(c.cell.start, dir.start) >= 0) ??
          measureCells[measureCells.length - 1];
        if (anchor === undefined) continue;
        if (dir.kind === 'dynamic') {
          parts.push(
            `<text class="dyn" x="${r2(anchor.x - f * 0.3)}" y="${r2(dynY)}" font-size="${r2(f * 0.62)}" font-style="italic" font-weight="bold">${esc(dir.value)}</text>`,
          );
        } else if (dir.kind === 'words') {
          parts.push(
            `<text class="dir-words" x="${r2(anchor.x - f * 0.3)}" y="${r2(dynY)}" font-size="${r2(f * 0.58)}" font-style="italic">${esc(dir.text)}</text>`,
          );
        } else {
          wedges.push({ type: dir.wedge, x: anchor.x });
        }
      }
    }

    // Hairpin cresc/decresc: pasangkan start→stop dalam baris; yang menyeberang
    // sistem digambar terbuka sampai ujung baris (jujur tapi tidak menyesatkan).
    const drawHairpin = (w: { type: string; x: number }, x2: number) => {
      const d =
        w.type === 'crescendo'
          ? `M ${r2(x2)} ${r2(wedgeYMid - wedgeH)} L ${r2(w.x)} ${r2(wedgeYMid)} L ${r2(x2)} ${r2(wedgeYMid + wedgeH)}`
          : `M ${r2(w.x)} ${r2(wedgeYMid - wedgeH)} L ${r2(x2)} ${r2(wedgeYMid)} L ${r2(w.x)} ${r2(wedgeYMid + wedgeH)}`;
      parts.push(
        `<path class="wedge" fill="none" stroke="currentColor" stroke-width="${r2(f * 0.05)}" d="${d}"/>`,
      );
    };
    let openWedge: { type: 'crescendo' | 'diminuendo'; x: number } | null = null;
    for (const w of wedges) {
      if (w.type === 'stop') {
        if (openWedge !== null) {
          drawHairpin(openWedge, w.x);
          openWedge = null;
        }
      } else {
        openWedge = { type: w.type, x: w.x };
      }
    }
    if (openWedge !== null) drawHairpin(openWedge, x - barPad);

    // ---- lirik baris ini ----
    for (const token of planLyricTokens(lineCells, verses, f * 0.7)) {
      const vi = verses.indexOf(token.verse);
      const y = baseline + belowZone + (vi + 0.75) * lyricLineH;
      text(token.x, y, token.text, lyricSize, ' font-style="italic"');
    }
    // nomor bait "1." di gutter (non-italic, diredam — metadata, bukan konten)
    verses.forEach((verse, vi) => {
      const y = baseline + belowZone + (vi + 0.75) * lyricLineH;
      parts.push(
        `<text x="${r2(padX + gutterW - f * 0.35)}" y="${r2(y)}" font-size="${r2(lyricSize)}" text-anchor="end" fill-opacity="0.62">${verse}.</text>`,
      );
    });

    function drawCell(cell: CipherCell, cx: number, beatMaxDepth: number): void {
      const overlineTop = baseline - f * 0.92 - Math.max(0, beatMaxDepth - 1) * f * 0.14;
      switch (cell.kind) {
        case 'note': {
          text(cx, baseline, String(cell.degree));
          if (cell.accidental !== null) {
            text(cx - f * 0.42, baseline - f * 0.35, cell.accidental > 0 ? '♯' : '♭', f * 0.55);
          }
          // titik oktaf atas: di atas garis pembagi ketukan (kalau ada)
          for (let i = 0; i < cell.octaveDots; i++) {
            dot(cx, overlineTop - f * 0.22 - i * f * 0.26);
          }
          for (let i = 0; i < -cell.octaveDots; i++) {
            dot(cx, baseline + f * 0.3 + i * f * 0.26);
          }
          // artikulasi di atas angka (di atas titik oktaf atas kalau ada)
          if (cell.articulations.length > 0) {
            const yArt =
              overlineTop - f * 0.24 - Math.max(0, cell.octaveDots) * f * 0.26 - f * 0.12;
            for (const art of cell.articulations) {
              if (art === 'accent' || art === 'strong-accent') {
                parts.push(
                  `<path class="artic" fill="none" stroke="currentColor" stroke-width="${r2(f * 0.07)}" d="M ${r2(cx - f * 0.22)} ${r2(yArt - f * 0.13)} L ${r2(cx + f * 0.22)} ${r2(yArt)} L ${r2(cx - f * 0.22)} ${r2(yArt + f * 0.13)}"/>`,
                );
              } else if (art === 'staccato') {
                dot(cx, yArt, f * 0.07);
              } else {
                line(cx - f * 0.2, yArt, cx + f * 0.2, yArt, f * 0.08);
              }
            }
          }
          if (cell.slurStart) slurStarts.push(cx);
          if (cell.slurStop) {
            const startX = slurStarts.pop();
            if (startX !== undefined) {
              // lengkung melisma DI BAWAH angka (konvensi BL-73)
              const yArc = baseline + f * 0.5;
              parts.push(
                `<path d="M ${r2(startX)} ${r2(yArc)} Q ${r2((startX + cx) / 2)} ${r2(yArc + f * 0.4)} ${r2(cx)} ${r2(yArc)}" fill="none" stroke="currentColor" stroke-width="${r2(f * 0.06)}"/>`,
              );
            }
          }
          break;
        }
        case 'dash':
        case 'dot':
          // konvensi cetakan BL: SEMUA perpanjangan digambar titik
          dot(cx, baseline - f * 0.28, f * 0.1);
          break;
        case 'rest':
          text(cx, baseline, '0');
          break;
      }
      if (cell.fermata) {
        const yF = baseline - f * 1.62;
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
    `aria-label="Not angka dengan lirik">` +
    parts.join('') +
    `</svg>`
  );
}

function emptySvg(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"></svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Bulatkan 2 desimal — SVG tetap kecil dan diff-able. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
