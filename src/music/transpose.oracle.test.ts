// @vitest-environment jsdom
//
// Cross-check transpose engine kita lawan transpose bawaan Verovio (oracle).
// Dua implementasi independen yang setuju = confidence tinggi untuk enharmonic
// spelling. Verovio memuat MusicXML asli + opsi transpose miliknya sendiri;
// kita bandingkan pitch-per-pitch (via ekspor MEI) dan key signature.
//
// Test ini lebih berat (init WASM ~beberapa detik) — kalau suatu saat perlu
// dipisah dari watch mode, pindahkan ke suite terpisah; sekarang biarkan
// jalan bersama supaya regresi enharmonic ketahuan setiap saat.

import { beforeAll, describe, expect, it } from 'vitest';
import { Interval } from 'tonal';
import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { pitchToString } from './model';
import type { NoteEvent, Pitch, Step } from './model';
import { parseMusicXml } from './parse';
import { intervalBetweenTonics, transposeScoreToTonic } from './transpose';

let tk: VerovioToolkit;

beforeAll(async () => {
  tk = new VerovioToolkit(await createVerovioModule());
}, 120_000);

/** Interval tonal (number-first, "1A"/"-4d") → format Verovio (quality-first, "A1"/"-d4"). */
function toVerovioInterval(tonalInterval: string): string {
  const iv = Interval.get(tonalInterval);
  if (iv.empty || iv.num === undefined || iv.q === undefined) {
    throw new Error(`Interval tonal tidak terparse: ${tonalInterval}`);
  }
  return `${iv.num < 0 ? '-' : ''}${iv.q}${Math.abs(iv.num)}`;
}

const ACCID_TO_ALTER: Record<string, number> = { s: 1, f: -1, x: 2, ss: 2, ff: -2, n: 0 };
const SHARPS = 'FCGDAEB';
const FLATS = 'BEADGCF';

/** Ekstrak key signature (fifths) + urutan pitch dari MEI output Verovio. */
function extractFromMei(mei: string): { fifths: number; pitches: Pitch[] } {
  const doc = new DOMParser().parseFromString(mei, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);

  const sig = doc.getElementsByTagName('keySig')[0]?.getAttribute('sig') ?? '0';
  const fifths = sig === '0' ? 0 : Number(sig.slice(0, -1)) * (sig.endsWith('f') ? -1 : 1);

  // MEI tidak menulis accidental untuk not yang tercakup key signature —
  // alter diturunkan dari signature, kecuali ada accid tertulis di not.
  const keyAlter = (letter: string): number => {
    if (fifths > 0) return SHARPS.slice(0, fifths).includes(letter) ? 1 : 0;
    if (fifths < 0) return FLATS.slice(0, -fifths).includes(letter) ? -1 : 0;
    return 0;
  };

  const pitches: Pitch[] = [];
  for (const note of Array.from(doc.getElementsByTagName('note'))) {
    const step = (note.getAttribute('pname') ?? '').toUpperCase() as Step;
    const octave = Number(note.getAttribute('oct'));
    const accidEl = note.getElementsByTagName('accid')[0];
    const accid =
      note.getAttribute('accid') ??
      accidEl?.getAttribute('accid') ??
      note.getAttribute('accid.ges') ??
      accidEl?.getAttribute('accid.ges') ??
      null;
    const alter = accid !== null ? ACCID_TO_ALTER[accid] : keyAlter(step);
    expect(alter, `accid MEI tidak dikenal: ${accid}`).toBeDefined();
    pitches.push({ step, alter, octave });
  }
  return { fifths, pitches };
}

// Target campuran: contoh SPEC (→D-ish via A), sisi mol ekstrem (Db),
// sisi kres banyak (B=5♯, E=4♯, F#=6♯) — dummy bernada dasar G.
const TARGETS = ['A', 'Db', 'B', 'E', 'F#'];

describe('oracle: engine kita vs transpose bawaan Verovio', () => {
  for (const target of TARGETS) {
    it(`dummy G → ${target}`, () => {
      const ours = transposeScoreToTonic(parseMusicXml(dummyXml).score, target);
      const ourNotes = ours.score.voices[0].measures.flatMap(
        (m) => m.events.filter((e): e is NoteEvent => e.kind === 'note'),
      );

      const interval = intervalBetweenTonics('G', target);
      tk.setOptions({ transpose: toVerovioInterval(interval) });
      // binding WASM mengembalikan 1/0 di Node, bukan boolean
      expect(tk.loadData(dummyXml)).toBeTruthy();
      const verovio = extractFromMei(tk.getMEI({ noLayout: true }));

      expect(verovio.fifths).toBe(ours.score.key.fifths);
      expect(verovio.pitches).toHaveLength(ourNotes.length);
      ourNotes.forEach((note, i) => {
        expect(pitchToString(verovio.pitches[i]), `not urutan ke-${i + 1}`).toBe(
          pitchToString(note.pitch),
        );
      });
    });
  }
});
