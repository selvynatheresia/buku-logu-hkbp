// @vitest-environment jsdom
//
// Test converter not angka — empat kelompok:
// 1. Dummy logu-000: cipher lengkap hand-written (artefak review — baca dan
//    cocokkan dengan notasi balok dummy; format string dijelaskan di cipher.ts).
// 2. Aritmetika derajat/oktaf/kromatis lintas key.
// 3. Property kunci movable-do: transpose TIDAK mengubah cipher, hanya Do = X.
// 4. Gerbang SPEC (minor, meter compound, tuplet) + warning terstruktur.

import { describe, expect, it } from 'vitest';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { FRAC_ZERO, frac, fracAdd } from './model';
import type {
  Fraction,
  InternalScore,
  NoteEvent,
  RestEvent,
  ScoreEvent,
  Step,
  Syllable,
} from './model';
import { parseMusicXml } from './parse';
import { canonicalTonics, transposeScoreToTonic } from './transpose';
import {
  CipherError,
  type CipherNoteCell,
  cipherVoiceToString,
  degreeInfo,
  formatDoLabel,
  scoreToCipher,
} from './cipher';

// ---------------------------------------------------------------------------
// Helper fixture
// ---------------------------------------------------------------------------

/** "Db4" → Pitch. */
function p(name: string) {
  const m = name.match(/^([A-G])(#{1,2}|b{1,2})?(\d)$/);
  if (!m) throw new Error(`nama not tidak valid: ${name}`);
  const alter = m[2] === undefined ? 0 : m[2].startsWith('#') ? m[2].length : -m[2].length;
  return { step: m[1] as Step, alter, octave: Number(m[3]) };
}

interface EvSpec {
  /** Nama not ("G4"); tanpa ini = rest. */
  n?: string;
  dur: Fraction;
  tieStart?: boolean;
  tieStop?: boolean;
  slurStart?: boolean;
  slurStop?: boolean;
  fermata?: boolean;
  lyrics?: Record<number, Syllable>;
}

function mkScore(
  measures: EvSpec[][],
  {
    fifths = 0,
    mode = 'major' as 'major' | 'minor' | null,
    beats = 4,
    beatType = 4,
  } = {},
): InternalScore {
  return {
    title: null,
    key: { fifths, mode },
    time: { beats, beatType },
    tempoBpm: null,
    versesCount: 0,
    anacrusis: false,
    voices: [
      {
        id: 'v1',
        label: 'Test',
        measures: measures.map((specs, mi) => {
          let start = FRAC_ZERO;
          const events: ScoreEvent[] = specs.map((spec, ei) => {
            const base = {
              id: `t-m${mi}-e${ei}`,
              start,
              duration: spec.dur,
              fermata: spec.fermata ?? false,
            };
            start = fracAdd(start, spec.dur);
            if (spec.n !== undefined) {
              const note: NoteEvent = {
                kind: 'note',
                ...base,
                pitch: p(spec.n),
                tieStart: spec.tieStart ?? false,
                tieStop: spec.tieStop ?? false,
                slurStart: spec.slurStart ?? false,
                slurStop: spec.slurStop ?? false,
                lyrics: spec.lyrics ?? {},
                tuplet: false,
                articulations: [],
              };
              return note;
            }
            const rest: RestEvent = { kind: 'rest', ...base, measureRest: false };
            return rest;
          });
          return {
            number: String(mi + 1),
            index: mi,
            partial: false,
            events,
            directions: [],
            repeat: { forward: false, backward: false, endingNumbers: null, endingType: null },
            finalBar: mi === measures.length - 1,
          };
        }),
      },
    ],
  };
}

const Q = frac(1, 4);

// ---------------------------------------------------------------------------
// 1. Dummy logu-000
// ---------------------------------------------------------------------------

describe('cipher dummy logu-000 (Do = G)', () => {
  const result = scoreToCipher(parseMusicXml(dummyXml).score);
  const voice = result.cipher.voices[0];

  it('bersih: nol warning', () => {
    expect(result.warnings).toEqual([]);
  });

  it('header: Do = G, 4/4, 3 bait', () => {
    expect(result.cipher.doLabel).toBe('G');
    expect(result.cipher.timeLabel).toBe('4/4');
    expect(result.cipher.versesCount).toBe(3);
  });

  it('cipher lengkap cocok dengan hasil tulis-tangan', () => {
    // Baca per birama; koma = titik oktaf bawah, _ = underline (eighth),
    // ( ) = slur melisma, @ = fermata, - = tahan 1 ketuk, . = tahan sub-ketuk.
    expect(cipherVoiceToString(voice)).toBe(
      '5, | 1 2 3 1 | 4 ._ 3_ 2 - | 3_( 2_) 1 6, 5, | 1 - 0 5, | 6, 1 2 - | - 3 4 2 | 1@ - -',
    );
  });

  it('anacrusis: pickup jatuh di ketukan musikal ke-4 (indeks 3)', () => {
    expect(voice.measures[0].partial).toBe(true);
    expect(voice.measures[0].beats).toHaveLength(1);
    expect(voice.measures[0].beats[0].index).toBe(3);
    // birama normal mulai dari ketukan 0
    expect(voice.measures[1].beats.map((b) => b.index)).toEqual([0, 1, 2, 3]);
  });

  it('lirik menempel di sel angka; lanjutan melisma tanpa lirik', () => {
    const pickup = voice.measures[0].beats[0].cells[0] as CipherNoteCell;
    expect(pickup.kind).toBe('note');
    expect(pickup.lyrics[1].text).toBe('Ma');

    const [melStart, melCont] = voice.measures[3].beats[0].cells as CipherNoteCell[];
    expect(melStart.lyrics[1]).toEqual({ text: 'pu', syllabic: 'begin', extend: true });
    expect(melStart.slurStart).toBe(true);
    expect(Object.keys(melCont.lyrics)).toHaveLength(0);
    expect(melCont.slurStop).toBe(true);
  });

  it('sourceId menjembatani sel ke event model (angka + perpanjangannya)', () => {
    // m2: "4 ._ 3_ 2 -" — sel '4' dan '._' berasal dari event dotted-quarter yang sama
    const m2cells = voice.measures[2].beats.flatMap((b) => b.cells);
    expect(m2cells[0].sourceId).toBe('v1-m2-e0');
    expect(m2cells[1].sourceId).toBe('v1-m2-e0');
    expect(m2cells[2].sourceId).toBe('v1-m2-e1');
    // m6: dash pertama = lanjutan tie dari m5
    const m6first = voice.measures[6].beats[0].cells[0];
    expect(m6first.kind).toBe('dash');
    expect(m6first.sourceId).toBe('v1-m6-e0');
  });
});

// ---------------------------------------------------------------------------
// 2. Aritmetika derajat / titik oktaf / kromatis
// ---------------------------------------------------------------------------

describe('degreeInfo', () => {
  const REF_C = 4 * 7 + 0; // do = C4
  const REF_DB = 4 * 7 + 1; // do = Db4 (huruf D)
  const REF_A = 4 * 7 + 5; // do = A4

  it('key Db: not diatonis ber-mol tetap derajat polos', () => {
    // Gb4 = derajat 4 di Db mayor, tanpa aksidental (mol-nya bawaan key)
    expect(degreeInfo(p('Gb4'), REF_DB, -5)).toEqual({ degree: 4, octaveDots: 0, deviation: 0 });
    expect(degreeInfo(p('C5'), REF_DB, -5)).toEqual({ degree: 7, octaveDots: 0, deviation: 0 });
  });

  it('kromatis = penyimpangan dari skala, bukan dari natural', () => {
    // G natural di Db mayor: seharusnya Gb → deviasi +1
    expect(degreeInfo(p('G4'), REF_DB, -5).deviation).toBe(1);
    // F# di C mayor: deviasi +1 pada derajat 4
    expect(degreeInfo(p('F#4'), REF_C, 0)).toEqual({ degree: 4, octaveDots: 0, deviation: 1 });
  });

  it('titik oktaf relatif ke jendela do C4..B4', () => {
    expect(degreeInfo(p('C4'), REF_C, 0)).toEqual({ degree: 1, octaveDots: 0, deviation: 0 });
    expect(degreeInfo(p('B3'), REF_C, 0)).toEqual({ degree: 7, octaveDots: -1, deviation: 0 });
    expect(degreeInfo(p('C6'), REF_C, 0)).toEqual({ degree: 1, octaveDots: 2, deviation: 0 });
    // A mayor: E4 di bawah do (A4) → sol dengan titik bawah
    expect(degreeInfo(p('E4'), REF_A, 3)).toEqual({ degree: 5, octaveDots: -1, deviation: 0 });
    expect(degreeInfo(p('C#5'), REF_A, 3)).toEqual({ degree: 3, octaveDots: 0, deviation: 0 });
  });
});

// ---------------------------------------------------------------------------
// 3. Property movable-do: transpose tidak menyentuh angka
// ---------------------------------------------------------------------------

describe('movable-do: cipher invarian terhadap transpose', () => {
  const source = parseMusicXml(dummyXml).score;
  const baseline = cipherVoiceToString(scoreToCipher(source).cipher.voices[0]);

  for (const target of canonicalTonics('major')) {
    it(`dummy G → ${target}: angka identik, hanya Do berubah`, () => {
      const transposed = transposeScoreToTonic(source, target).score;
      const { cipher, warnings } = scoreToCipher(transposed);
      expect(warnings).toEqual([]);
      expect(cipher.doLabel).toBe(target);
      expect(cipherVoiceToString(cipher.voices[0])).toBe(baseline);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Gerbang SPEC + warning terstruktur
// ---------------------------------------------------------------------------

describe('gerbang SPEC', () => {
  it('lagu minor → berhenti keras (konvensi Do=X vs La=X belum diverifikasi)', () => {
    const score = mkScore([[{ n: 'A4', dur: Q }]], { mode: 'minor' });
    expect(() => scoreToCipher(score)).toThrow(CipherError);
    expect(() => scoreToCipher(score)).toThrow(/La = X/);
  });

  it('meter compound (6/8) → berhenti keras', () => {
    const score = mkScore([[{ n: 'C4', dur: frac(3, 8) }]], { beats: 6, beatType: 8 });
    expect(() => scoreToCipher(score)).toThrow(/6\/8/);
  });

  it('durasi tuplet → berhenti keras dengan konteks', () => {
    const score = mkScore([
      [
        { n: 'C4', dur: frac(1, 12) },
        { n: 'D4', dur: frac(1, 12) },
        { n: 'E4', dur: frac(1, 12) },
      ],
    ]);
    expect(() => scoreToCipher(score)).toThrow(/tuplet/i);
  });
});

describe('warning terstruktur', () => {
  it('not kromatis → CHROMATIC_NOTE + aksidental provisional di sel', () => {
    // G natural dalam Db mayor
    const score = mkScore(
      [[{ n: 'Db4', dur: Q }, { n: 'G4', dur: Q }, { n: 'Ab4', dur: Q }, { n: 'Db4', dur: Q }]],
      { fifths: -5 },
    );
    const { cipher, warnings } = scoreToCipher(score);
    expect(warnings.map((w) => w.code)).toEqual(['CHROMATIC_NOTE']);
    expect(warnings[0].eventId).toBe('t-m0-e1');
    const cells = cipher.voices[0].measures[0].beats.flatMap((b) => b.cells) as CipherNoteCell[];
    expect(cells[1].accidental).toBe(1);
    expect(cipherVoiceToString(cipher.voices[0])).toBe('1 4# 5 1');
  });

  it('slur antar nada sama → SLUR_SAME_PITCH', () => {
    const score = mkScore([
      [
        { n: 'G4', dur: Q, slurStart: true },
        { n: 'G4', dur: Q, slurStop: true },
        { n: 'A4', dur: Q },
        { n: 'B4', dur: Q },
      ],
    ]);
    expect(scoreToCipher(score).warnings.map((w) => w.code)).toContain('SLUR_SAME_PITCH');
  });

  it('lirik di lanjutan tie → LYRICS_ON_TIE_CONTINUATION (lirik tak punya tempat)', () => {
    const syl: Syllable = { text: 'la', syllabic: 'single', extend: false };
    const score = mkScore(
      [
        [
          { n: 'G4', dur: frac(1, 2), tieStart: true, lyrics: { 1: syl } },
          { n: 'G4', dur: Q, tieStop: true, lyrics: { 1: syl } },
          { n: 'A4', dur: Q },
        ],
      ],
      { fifths: 1 }, // G mayor — supaya G4 = do
    );
    const { cipher, warnings } = scoreToCipher(score);
    expect(warnings.map((w) => w.code)).toContain('LYRICS_ON_TIE_CONTINUATION');
    // strukturnya tetap benar: tie jadi dash
    expect(cipherVoiceToString(cipher.voices[0])).toBe('1 - - 2');
  });
});

describe('formatDoLabel (konvensi cetakan: nama Indonesia, nada = Do)', () => {
  it('nama not Indonesia dengan elisi vokal yang benar', () => {
    expect(formatDoLabel('C')).toBe('C = Do');
    expect(formatDoLabel('Bb')).toBe('Bes = Do');
    expect(formatDoLabel('Eb')).toBe('Es = Do');
    expect(formatDoLabel('Ab')).toBe('As = Do');
    expect(formatDoLabel('Db')).toBe('Des = Do');
    expect(formatDoLabel('Gb')).toBe('Ges = Do');
    expect(formatDoLabel('F#')).toBe('Fis = Do');
    expect(formatDoLabel('C#')).toBe('Cis = Do');
  });
});

describe('ritme sub-ketuk', () => {
  it('dotted eighth + sixteenth: angka + titik + angka, underline bertingkat', () => {
    const score = mkScore([
      [
        { n: 'C4', dur: frac(3, 16) },
        { n: 'D4', dur: frac(1, 16) },
        { n: 'E4', dur: Q },
        { n: 'F4', dur: Q },
        { n: 'G4', dur: Q },
      ],
    ]);
    const { cipher, warnings } = scoreToCipher(score);
    expect(warnings).toEqual([]);
    // 3/16 = 1/8 (angka, 1 garis) + 1/16 (titik, 2 garis); sixteenth = 2 garis
    expect(cipherVoiceToString(cipher.voices[0])).toBe('1_ .__ 2__ 3 4 5');
  });

  it('meter 3/4 dan 2/2 didukung (satuan ketuk = beat-type)', () => {
    const waltz = mkScore(
      [[{ n: 'C4', dur: frac(1, 2) }, { n: 'D4', dur: Q }]],
      { beats: 3, beatType: 4 },
    );
    expect(cipherVoiceToString(scoreToCipher(waltz).cipher.voices[0])).toBe('1 - 2');

    const cut = mkScore(
      [[{ n: 'C4', dur: frac(1, 2) }, { n: 'D4', dur: frac(1, 4) }, { n: 'E4', dur: frac(1, 4) }]],
      { beats: 2, beatType: 2 },
    );
    // di 2/2: half note = 1 ketuk penuh; quarter = ½ ketuk → underline
    expect(cipherVoiceToString(scoreToCipher(cut).cipher.voices[0])).toBe('1 2_ 3_');
  });
});
