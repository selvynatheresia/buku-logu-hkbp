// @vitest-environment jsdom
//
// Test renderer not angka Tahap C1 — fokus pada perencanaan lirik
// (planLyricTokens, pure) + invarian SVG. Pengukuran teks memakai heuristik
// deterministik; presisi canvas hanya di browser.

import { describe, expect, it } from 'vitest';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { scoreToCipher } from '../music/cipher';
import { parseMusicXml } from '../music/parse';
import { cipherToSvg, planLyricTokens } from './cipher-svg';
import type { CellWithX } from './cipher-svg';

const cipher = scoreToCipher(parseMusicXml(dummyXml).score).cipher;

/** Semua sel dummy berurutan waktu, x sintetis kelipatan 40 (indeks × 40). */
function flatCells(): CellWithX[] {
  return cipher.voices[0].measures
    .flatMap((m) => m.beats.flatMap((b) => b.cells))
    .map((cell, i) => ({ cell, x: i * 40 }));
}

describe('planLyricTokens (dummy, 30 sel)', () => {
  const cells = flatCells();

  it('bait 1: 21 suku kata + 12 hyphen (begin/middle saja)', () => {
    const tokens = planLyricTokens(cells, [1]);
    expect(tokens.filter((t) => t.kind === 'syllable')).toHaveLength(21);
    expect(tokens.filter((t) => t.kind === 'hyphen')).toHaveLength(12);
    expect(tokens[0]).toEqual({ verse: 1, kind: 'syllable', text: 'Ma', x: 0 });
  });

  it('melisma: hyphen jatuh persis di kolom not lanjutan slur', () => {
    const tokens = planLyricTokens(cells, [1]);
    // 'pu' di sel idx 10 (x=400), 'ji' di idx 12 (x=480);
    // sel lanjutan melisma (idx 11, x=440) tak bersuku kata → hyphen di 440
    const pu = tokens.find((t) => t.text === 'pu')!;
    const ji = tokens.find((t) => t.text === 'ji')!;
    expect(pu.x).toBe(400);
    expect(ji.x).toBe(480);
    expect(tokens.some((t) => t.kind === 'hyphen' && t.x === 440)).toBe(true);
  });

  it('tie: hyphen menyeberangi kolom-kolom tanda tahan', () => {
    const tokens = planLyricTokens(cells, [1]);
    // 'syu' idx 21 (x=840) ... 'kur' idx 24 (x=960): dua sel tahan di antaranya
    const syu = tokens.find((t) => t.text === 'syu')!;
    const kur = tokens.find((t) => t.text === 'kur')!;
    expect(syu.x).toBe(840);
    expect(kur.x).toBe(960);
    expect(tokens.some((t) => t.kind === 'hyphen' && t.x === 900)).toBe(true);
  });

  it("kata utuh ('yang') tidak diberi hyphen", () => {
    const tokens = planLyricTokens(cells, [1]);
    const yang = tokens.find((t) => t.text === 'yang')!;
    const next = tokens
      .filter((t) => t.kind === 'syllable' && t.x > yang.x)
      .sort((a, b) => a.x - b.x)[0];
    const midpoint = (yang.x + next.x) / 2;
    expect(tokens.some((t) => t.kind === 'hyphen' && t.x === midpoint)).toBe(false);
  });

  it('versesToShow menyaring bait (kontrak Opsi C)', () => {
    const tokens = planLyricTokens(cells, [2]);
    expect(tokens.every((t) => t.verse === 2)).toBe(true);
    expect(tokens.filter((t) => t.kind === 'syllable')).toHaveLength(21);
    expect(tokens[0].text).toBe('Su');
  });
});

describe('cipherToSvg dengan lirik', () => {
  it('default (Mode Ibadah): semua bait tampil, nomor bait polos "1."', () => {
    const svg = cipherToSvg(cipher, { fontSizePx: 20 });
    expect(svg).toContain('>Ma<');
    expect(svg).toContain('>Su<');
    expect(svg).toContain('>Ha<');
    expect(svg).toContain('>1.<');
    expect(svg).toContain('>2.<');
    expect(svg).toContain('>3.<');
    expect(svg).not.toContain('①'); // gaya Serpong tidak ditiru
    expect(svg).toContain('font-style="italic"'); // lirik italic sesuai cetakan
  });

  it('versesToShow: [1] → bait lain tidak digambar', () => {
    const svg = cipherToSvg(cipher, { fontSizePx: 20, versesToShow: [1] });
    expect(svg).toContain('>Ma<');
    expect(svg).not.toContain('>Su<');
    expect(svg).not.toContain('>2.<');
  });

  it('nomor bait di luar jangkauan diabaikan tanpa error', () => {
    const svg = cipherToSvg(cipher, { fontSizePx: 20, versesToShow: [1, 99] });
    expect(svg).toContain('>1.<');
    expect(svg).not.toContain('>99.<');
  });

  it('nomor birama tampil di awal sistem kedua dst. (bukan sistem pertama)', () => {
    // dummy pada lebar 800 pecah jadi ≥2 sistem → minimal satu penanda mnum
    const svg = cipherToSvg(cipher, { fontSizePx: 20 });
    expect(svg).toContain('class="mnum"');
    expect(svg.indexOf('class="mnum"')).toBe(svg.lastIndexOf('class="mnum"')); // tepat 1 (2 sistem)
  });
});
