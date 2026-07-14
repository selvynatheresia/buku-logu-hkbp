// @vitest-environment jsdom
//
// Test transpose engine — empat lapis:
// 1. "Kontrak tonal": memaku perilaku tonal.js yang jadi sandaran engine.
// 2. Tabel acceptance (spelling hand-verified, bisa dicek Selvyna vs teori musik) —
//    termasuk key tujuan ber-KRES banyak sesuai acceptance criteria SPEC.
// 3. Property test: 5 key pilot × 12 target kanonik.
// 4. End-to-end di dummy logu-000 + guard rails.
// (Lapis ke-5, cross-check lawan Verovio, ada di transpose.oracle.test.ts.)

import { describe, expect, it } from 'vitest';
import { Interval, Note, Scale } from 'tonal';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { frac, pitchToMidi, pitchToString } from './model';
import type { InternalScore, KeySignature, NoteEvent, Pitch, Step } from './model';
import { parseMusicXml } from './parse';
import {
  TransposeError,
  canonicalTonics,
  intervalBetweenTonics,
  tonicForKey,
  transposePitch,
  transposeScoreToTonic,
} from './transpose';

/** Helper test: "Db4" → Pitch. */
function p(name: string): Pitch {
  const m = name.match(/^([A-G])(#{1,2}|b{1,2})?(\d)$/);
  if (!m) throw new Error(`nama not test tidak valid: ${name}`);
  const alter = m[2] === undefined ? 0 : m[2].startsWith('#') ? m[2].length : -m[2].length;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

function tinyScore(key: KeySignature, pitches: Pitch[]): InternalScore {
  return {
    title: null,
    key,
    time: { beats: 4, beatType: 4 },
    tempoBpm: null,
    versesCount: 0,
    anacrusis: false,
    voices: [
      {
        id: 'v1',
        label: 'Test',
        measures: [
          {
            number: '1',
            index: 0,
            partial: false,
            finalBar: true,
            repeat: { forward: false, backward: false, endingNumbers: null, endingType: null },
            events: pitches.map((pitch, i) => ({
              kind: 'note' as const,
              id: `v1-m0-e${i}`,
              start: frac(i, 4),
              duration: frac(1, 4),
              fermata: false,
              pitch,
              tieStart: false,
              tieStop: false,
              slurStart: false,
              slurStop: false,
              lyrics: {},
              tuplet: false,
            })),
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// 1. Kontrak tonal — kalau upgrade tonal mengubah ini, engine ikut rusak
// ---------------------------------------------------------------------------

describe('kontrak tonal.js', () => {
  it('format interval: number-first, bertanda arah', () => {
    expect(Interval.distance('Db', 'D')).toBe('1A');
    expect(Interval.distance('C4', 'B3')).toBe('-2m');
    expect(Interval.distance('Bb4', 'F#4')).toBe('-4d');
  });

  it('transpose menjaga spelling per interval', () => {
    expect(Note.transpose('F4', '1A')).toBe('F#4');
    expect(Note.transpose('Eb4', '-5d')).toBe('A3');
    expect(Note.transpose('F##4', '1A')).toBe('F###4'); // triple — guard kita yang menolak
  });

  it('simplify me-respell double accidental (termasuk lompatan oktaf B/C)', () => {
    expect(Note.simplify('B##4')).toBe('C#5');
    expect(Note.simplify('Ebb4')).toBe('D4');
  });
});

// ---------------------------------------------------------------------------
// 2. Tabel acceptance — spelling hand-verified
// ---------------------------------------------------------------------------

interface AcceptanceCase {
  from: string;
  fromFifths: number;
  to: string;
  toFifths: number;
  interval: string;
  /** Skala penuh sumber → tujuan, spelled. */
  pairs: [string, string][];
}

const ACCEPTANCE: AcceptanceCase[] = [
  {
    // Contoh eksplisit acceptance criteria SPEC: Db +1 semitone = D mayor 2 kres
    from: 'Db', fromFifths: -5, to: 'D', toFifths: 2, interval: '1A',
    pairs: [
      ['Db4', 'D4'], ['Eb4', 'E4'], ['F4', 'F#4'], ['Gb4', 'G4'],
      ['Ab4', 'A4'], ['Bb4', 'B4'], ['C5', 'C#5'],
    ],
  },
  {
    from: 'C', fromFifths: 0, to: 'B', toFifths: 5, interval: '-2m',
    pairs: [
      ['C4', 'B3'], ['D4', 'C#4'], ['E4', 'D#4'], ['F4', 'E4'],
      ['G4', 'F#4'], ['A4', 'G#4'], ['B4', 'A#4'],
    ],
  },
  {
    from: 'C', fromFifths: 0, to: 'E', toFifths: 4, interval: '3M',
    pairs: [
      ['C4', 'E4'], ['D4', 'F#4'], ['E4', 'G#4'], ['F4', 'A4'],
      ['G4', 'B4'], ['A4', 'C#5'], ['B4', 'D#5'],
    ],
  },
  {
    // Bb (2 mol) → F# (6 kres): kasus kres terekstrem; interval = descending dim 4th
    from: 'Bb', fromFifths: -2, to: 'F#', toFifths: 6, interval: '-4d',
    pairs: [
      ['Bb4', 'F#4'], ['C5', 'G#4'], ['D5', 'A#4'], ['Eb5', 'B4'],
      ['F5', 'C#5'], ['G5', 'D#5'], ['A5', 'E#5'],
    ],
  },
  {
    from: 'Eb', fromFifths: -3, to: 'A', toFifths: 3, interval: '-5d',
    pairs: [
      ['Eb4', 'A3'], ['F4', 'B3'], ['G4', 'C#4'], ['Ab4', 'D4'],
      ['Bb4', 'E4'], ['C5', 'F#4'], ['D5', 'G#4'],
    ],
  },
];

describe.each(ACCEPTANCE)('acceptance $from → $to', ({ from, fromFifths, to, toFifths, interval, pairs }) => {
  it(`interval terpilih = ${interval}`, () => {
    expect(intervalBetweenTonics(from, to)).toBe(interval);
  });

  it('seluruh skala ter-respell benar', () => {
    for (const [src, expected] of pairs) {
      expect(pitchToString(transposePitch(p(src), interval)), `${src} + ${interval}`).toBe(expected);
    }
  });

  it(`key signature ${fromFifths} → ${toFifths}`, () => {
    const score = tinyScore({ fifths: fromFifths, mode: 'major' }, [p(pairs[0][0])]);
    const result = transposeScoreToTonic(score, to);
    expect(result.score.key.fifths).toBe(toFifths);
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Property test: 5 key pilot × 12 target kanonik
// ---------------------------------------------------------------------------

describe('property: semua key pilot × 12 target kanonik', () => {
  const sources = ['C', 'Db', 'Bb', 'Eb', 'A']; // key kelima lagu pilot
  const targets = canonicalTonics('major');

  for (const src of sources) {
    for (const tgt of targets) {
      if (src === tgt) continue;
      it(`${src} → ${tgt}`, () => {
        const interval = intervalBetweenTonics(src, tgt);
        const inverse = intervalBetweenTonics(tgt, src);
        const scaleIn = Scale.get(`${src} major`).notes.map((pc) => p(`${pc}4`));
        const scaleOut = scaleIn.map((note) => transposePitch(note, interval));

        // (a) 7 huruf muncul tepat sekali
        expect(new Set(scaleOut.map((n) => n.step)).size).toBe(7);

        // (b) diatonis masuk → diatonis keluar, tanpa double accidental
        for (const n of scaleOut) expect(Math.abs(n.alter)).toBeLessThanOrEqual(1);

        // (c) jarak semitone seragam untuk semua not = perpindahan tonic
        const k = (Note.chroma(tgt)! - Note.chroma(src)! + 12) % 12;
        const shift = k <= 5 ? k : k - 12;
        scaleIn.forEach((input, i) => {
          expect(pitchToMidi(scaleOut[i]) - pitchToMidi(input)).toBe(shift);
        });

        // (d) round-trip: spelling kembali identik (oktaf boleh geser di tritone)
        scaleIn.forEach((input, i) => {
          const back = transposePitch(scaleOut[i], inverse);
          expect(back.step).toBe(input.step);
          expect(back.alter).toBe(input.alter);
        });
      });
    }
  }
});

// ---------------------------------------------------------------------------
// 4. End-to-end dummy + guard rails
// ---------------------------------------------------------------------------

describe('end-to-end dummy logu-000', () => {
  const source = parseMusicXml(dummyXml).score;

  it('G → A: pitch & key berubah, SEMUA yang lain identik', () => {
    const before = JSON.stringify(source);
    const { score: out, warnings } = transposeScoreToTonic(source, 'A');

    expect(warnings).toEqual([]);
    expect(out.key).toEqual({ fifths: 3, mode: 'major' });
    const first = out.voices[0].measures[0].events[0] as NoteEvent;
    expect(pitchToString(first.pitch)).toBe('E4'); // D4 + 2M

    // deep-equal setelah pitch & key dibutakan → struktur, lirik, id, durasi,
    // repeat, anacrusis semuanya dijamin tak tersentuh
    const blind = (s: InternalScore) =>
      JSON.parse(JSON.stringify(s, (k, v) => (k === 'pitch' || k === 'key' ? undefined : v)));
    expect(blind(out)).toEqual(blind(source));

    // immutability: skor sumber tidak berubah sedikit pun
    expect(JSON.stringify(source)).toBe(before);
  });

  it('G → G: identitas, tanpa kerja', () => {
    const result = transposeScoreToTonic(source, 'G');
    expect(result.score).toBe(source);
    expect(result.warnings).toEqual([]);
  });

  it('G → Db (tritone): turun sesuai konvensi', () => {
    const { score: out } = transposeScoreToTonic(source, 'Db');
    expect(out.key.fifths).toBe(-5);
    const first = out.voices[0].measures[0].events[0] as NoteEvent;
    expect(pitchToString(first.pitch)).toBe('Ab3'); // D4 turun -4A
  });
});

describe('guard rails & simplifikasi', () => {
  it('nada dasar tujuan tak dikenal → TransposeError', () => {
    const score = tinyScore({ fifths: 0, mode: 'major' }, [p('C4')]);
    expect(() => transposeScoreToTonic(score, 'H')).toThrow(TransposeError);
    expect(() => transposeScoreToTonic(score, 'D#')).toThrow(/mayor|major|Pilihan sah/);
  });

  it('hasil melebihi double accidental → error keras', () => {
    expect(() => transposePitch(p('F##4'), '1A')).toThrow(TransposeError);
  });

  it('key signature di luar -7..7 → error', () => {
    expect(() => tonicForKey({ fifths: 8, mode: 'major' })).toThrow(TransposeError);
  });

  it('not kromatis ber-double-accidental → di-respell + warning', () => {
    // B# di Db mayor (kromatis ekstrem yang disengaja) + 1A = B## → C#5
    const score = tinyScore({ fifths: -5, mode: 'major' }, [p('Db4'), p('B#3')]);
    const { score: out, warnings } = transposeScoreToTonic(score, 'D');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('DOUBLE_ACCIDENTAL_SIMPLIFIED');
    expect(warnings[0].eventId).toBe('v1-m0-e1');
    const respelled = out.voices[0].measures[0].events[1] as NoteEvent;
    expect(pitchToString(respelled.pitch)).toBe('C#4'); // B##3 → C#4
  });
});

describe('tabel tonic', () => {
  it('canonicalTonics: 12 pitch class, tie tritone → sisi kres', () => {
    expect(canonicalTonics('major')).toHaveLength(12);
    expect(canonicalTonics('major')).toContain('F#');
    expect(canonicalTonics('major')).not.toContain('Gb');
    expect(canonicalTonics('minor')).toContain('D#');
    expect(canonicalTonics('minor')).toContain('G#');
  });

  it('tonicForKey: fifths+mode → spelling tonic', () => {
    expect(tonicForKey({ fifths: 1, mode: 'major' })).toBe('G');
    expect(tonicForKey({ fifths: -5, mode: 'major' })).toBe('Db');
    expect(tonicForKey({ fifths: 0, mode: 'minor' })).toBe('A');
    expect(tonicForKey({ fifths: 2, mode: 'minor' })).toBe('B');
    // mode null → asumsi mayor (gerbang minor hanya menyangkut not angka)
    expect(tonicForKey({ fifths: -2, mode: null })).toBe('Bb');
  });
});
