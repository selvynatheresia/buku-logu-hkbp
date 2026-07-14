// @vitest-environment jsdom
//
// Test parser MusicXML → model internal.
// - Kelompok pertama: dummy logu-000 (file asli repo) — acuan struktur lengkap.
// - Kelompok kedua: XML sintetis kecil untuk kebijakan fail-loud & warning.
// Begitu lagu pilot asli (Logu 110 dst.) masuk, tambahkan test serupa per lagu.

import { describe, expect, it } from 'vitest';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { frac, fracAdd, fracEq, FRAC_ZERO } from './model';
import type { Fraction, Measure, NoteEvent } from './model';
import { MusicXmlParseError, parseMusicXml } from './parse';

/** Durasi isi satu birama = posisi akhir event terakhirnya. */
function contentOf(measure: Measure): Fraction {
  return measure.events.reduce(
    (max, ev) => {
      const end = fracAdd(ev.start, ev.duration);
      return end.num / end.den > max.num / max.den ? end : max;
    },
    FRAC_ZERO,
  );
}

// ---------------------------------------------------------------------------
// Dummy logu-000
// ---------------------------------------------------------------------------

describe('parse dummy logu-000', () => {
  const result = parseMusicXml(dummyXml);
  const score = result.score;
  const melody = score.voices[0];

  it('bersih: nol warning', () => {
    expect(result.warnings).toEqual([]);
  });

  it('metadata skor benar', () => {
    expect(score.title).toBe('Lagu Uji Pipeline (dummy)');
    expect(score.key).toEqual({ fifths: 1, mode: 'major' });
    expect(score.time).toEqual({ beats: 4, beatType: 4 });
    expect(score.tempoBpm).toBe(96);
    expect(score.versesCount).toBe(3);
    expect(score.anacrusis).toBe(true);
  });

  it('satu voice melodi dengan 8 birama', () => {
    expect(score.voices).toHaveLength(1);
    expect(melody.id).toBe('v1');
    expect(melody.label).toBe('Melodi');
    expect(melody.measures).toHaveLength(8);
    expect(melody.measures.map((m) => m.events.length)).toEqual([1, 4, 3, 5, 3, 3, 4, 1]);
  });

  it('anacrusis: birama 0 = 1 ketuk, birama akhir = 3 ketuk (komplemen), sisanya penuh', () => {
    const contents = melody.measures.map(contentOf);
    expect(contents[0]).toEqual(frac(1, 4));
    expect(contents[7]).toEqual(frac(3, 4));
    for (let i = 1; i <= 6; i++) expect(contents[i]).toEqual(frac(1, 1));
    expect(melody.measures[0].partial).toBe(true);
    expect(melody.measures[7].partial).toBe(true);
    expect(melody.measures[3].partial).toBe(false);
  });

  it('pitch pertama = spelled pitch D4 (bukan nomor MIDI)', () => {
    const first = melody.measures[0].events[0] as NoteEvent;
    expect(first.kind).toBe('note');
    expect(first.pitch).toEqual({ step: 'D', alter: 0, octave: 4 });
    expect(first.id).toBe('v1-m0-e0');
  });

  it('lirik: 21 not bersuku-kata × 3 bait, syllabic terbawa', () => {
    const notes = melody.measures.flatMap((m) =>
      m.events.filter((e): e is NoteEvent => e.kind === 'note'),
    );
    expect(notes).toHaveLength(23); // 21 berlirik + lanjutan melisma + lanjutan tie

    const withLyrics = notes.filter((n) => Object.keys(n.lyrics).length > 0);
    expect(withLyrics).toHaveLength(21);
    for (const n of withLyrics) {
      expect(Object.keys(n.lyrics).map(Number).sort()).toEqual([1, 2, 3]);
    }

    const first = melody.measures[0].events[0] as NoteEvent;
    expect(first.lyrics[1]).toEqual({ text: 'Ma', syllabic: 'begin', extend: false });
    expect(first.lyrics[3]).toEqual({ text: 'Ha', syllabic: 'begin', extend: false });
  });

  it('melisma di birama 3: slur + extend, not lanjutan tanpa lirik', () => {
    const [start, cont] = melody.measures[3].events as NoteEvent[];
    expect(start.slurStart).toBe(true);
    expect(start.lyrics[1].extend).toBe(true);
    expect(start.lyrics[1].text).toBe('pu');
    expect(cont.slurStop).toBe(true);
    expect(Object.keys(cont.lyrics)).toHaveLength(0);
  });

  it('tie antar-birama 5→6 pada nada sama, lanjutan tanpa lirik', () => {
    const m5 = melody.measures[5].events;
    const tieStart = m5[m5.length - 1] as NoteEvent;
    const tieStop = melody.measures[6].events[0] as NoteEvent;
    expect(tieStart.tieStart).toBe(true);
    expect(tieStart.lyrics[1].text).toBe('syu');
    expect(tieStop.tieStop).toBe(true);
    expect(tieStop.pitch).toEqual(tieStart.pitch);
    expect(Object.keys(tieStop.lyrics)).toHaveLength(0);
  });

  it('rest di birama 4, fermata + final bar di birama akhir', () => {
    const rest = melody.measures[4].events[1];
    expect(rest.kind).toBe('rest');
    expect(rest.duration).toEqual(frac(1, 4));

    const last = melody.measures[7].events[0] as NoteEvent;
    expect(last.fermata).toBe(true);
    expect(last.duration).toEqual(frac(3, 4)); // half + dot
    expect(melody.measures[7].finalBar).toBe(true);
    expect(melody.measures[6].finalBar).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// XML sintetis: fail loud & warning
// ---------------------------------------------------------------------------

/** Rakit score-partwise minimal; measureBodies[0] otomatis diberi attributes. */
function makeScore(
  measureBodies: string[],
  { fifths = 0, beats = 4, beatType = 4, divisions = 2 } = {},
): string {
  const measures = measureBodies
    .map((body, i) => {
      const attrs =
        i === 0
          ? `<attributes><divisions>${divisions}</divisions>` +
            `<key><fifths>${fifths}</fifths><mode>major</mode></key>` +
            `<time><beats>${beats}</beats><beat-type>${beatType}</beat-type></time>` +
            `<clef><sign>G</sign><line>2</line></clef></attributes>`
          : '';
      return `<measure number="${i + 1}">${attrs}${body}</measure>`;
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">` +
    `<part-list><score-part id="P1"><part-name>Test</part-name></score-part></part-list>` +
    `<part id="P1">${measures}</part></score-partwise>`
  );
}

/** Not quarter (duration=2 saat divisions=2). */
function q(step: string, octave: number, extra = ''): string {
  return (
    `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch>` +
    `<duration>2</duration><voice>1</voice><type>quarter</type>${extra}</note>`
  );
}

const FULL_BAR = q('C', 4) + q('D', 4) + q('E', 4) + q('F', 4);

function warningCodes(xml: string): string[] {
  return parseMusicXml(xml).warnings.map((w) => w.code);
}

describe('fail loud: error dengan konteks', () => {
  it('menolak XML rusak', () => {
    expect(() => parseMusicXml('<score-partwise><oops')).toThrow(MusicXmlParseError);
  });

  it('menolak score-timewise dengan saran export ulang', () => {
    expect(() => parseMusicXml('<score-timewise version="4.0"></score-timewise>')).toThrow(
      /score-partwise/,
    );
  });

  it('menolak grace note (di luar subset, harus di-flag)', () => {
    const xml = makeScore([
      q('C', 4) +
        `<note><grace/><pitch><step>D</step><octave>4</octave></pitch><voice>1</voice><type>eighth</type></note>` +
        q('E', 4) +
        q('F', 4) +
        q('G', 4),
    ]);
    expect(() => parseMusicXml(xml)).toThrow(/[Gg]race/);
  });

  it('menolak perubahan key signature di tengah lagu, menyebut birama', () => {
    const xml = makeScore([
      FULL_BAR,
      `<attributes><key><fifths>2</fifths></key></attributes>${FULL_BAR}`,
    ]);
    expect(() => parseMusicXml(xml)).toThrow(/key signature.*birama 2/s);
  });

  it('menolak backup yang mundur melewati awal birama', () => {
    const xml = makeScore([`<backup><duration>2</duration></backup>${FULL_BAR}`]);
    expect(() => parseMusicXml(xml)).toThrow(/backup/);
  });
});

describe('warning terstruktur', () => {
  it('tuplet → warning TUPLET (durasi tetap eksak)', () => {
    // triplet eighth: 3 not × (1/3 dari quarter); divisions=3 → duration=1
    const triplet =
      `<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>` +
      `<voice>1</voice><type>eighth</type>` +
      `<time-modification><actual-notes>3</actual-notes><normal-notes>2</normal-notes></time-modification></note>`;
    const xml = makeScore([triplet.repeat(3)], { beats: 1, beatType: 4, divisions: 3 });
    const result = parseMusicXml(xml);
    expect(result.warnings.map((w) => w.code)).toContain('TUPLET');
    const total = result.score.voices[0].measures[0].events.reduce(
      (sum, e) => fracAdd(sum, e.duration),
      FRAC_ZERO,
    );
    expect(fracEq(total, frac(1, 4))).toBe(true); // 3 × 1/12 = 1/4 eksak
  });

  it('chord → split deterministik jadi 2 suara + warning', () => {
    const chordBar =
      q('G', 4) + `<note><chord/><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>`;
    const xml = makeScore([chordBar], { beats: 1, beatType: 4 });
    const result = parseMusicXml(xml);
    const codes = result.warnings.map((w) => w.code);
    expect(codes).toContain('CHORD_SPLIT');
    expect(codes).toContain('VOICES_UNUSUAL'); // 2 suara, bukan 1/4
    expect(result.score.voices).toHaveLength(2);
    const [upper, lower] = result.score.voices;
    expect((upper.measures[0].events[0] as NoteEvent).pitch.step).toBe('G'); // tertinggi di atas
    expect((lower.measures[0].events[0] as NoteEvent).pitch.step).toBe('C');
  });

  it('chord mengecil di tengah → UNISON_FILL (duplikat not terbawah)', () => {
    const chord = (s1: string, s2: string) =>
      q(s1, 4) +
      `<note><chord/><pitch><step>${s2}</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><type>quarter</type></note>`;
    const xml = makeScore([chord('G', 'C') + q('E', 4)], { beats: 2, beatType: 4 });
    const result = parseMusicXml(xml);
    expect(result.warnings.map((w) => w.code)).toContain('UNISON_FILL');
    const lower = result.score.voices[1];
    expect((lower.measures[0].events[1] as NoteEvent).pitch.step).toBe('E'); // duplikat
  });

  it('slur start berlirik tanpa extend → SLUR_WITHOUT_EXTEND', () => {
    const bar =
      q('C', 4, `<notations><slur type="start" number="1"/></notations><lyric number="1"><syllabic>single</syllabic><text>la</text></lyric>`) +
      q('D', 4, `<notations><slur type="stop" number="1"/></notations>`) +
      q('E', 4, `<lyric number="1"><syllabic>single</syllabic><text>di</text></lyric>`) +
      q('F', 4, `<lyric number="1"><syllabic>single</syllabic><text>da</text></lyric>`);
    expect(warningCodes(makeScore([bar]))).toContain('SLUR_WITHOUT_EXTEND');
  });

  it('tie menyambung nada berbeda → TIE_MISMATCH', () => {
    const bar =
      q('G', 4, `<tie type="start"/><notations><tied type="start"/></notations>`) +
      q('A', 4, `<tie type="stop"/><notations><tied type="stop"/></notations>`) +
      q('B', 4) +
      q('C', 5);
    expect(warningCodes(makeScore([bar]))).toContain('TIE_MISMATCH');
  });

  it('birama akhir bukan komplemen anacrusis → ANACRUSIS_COMPLEMENT', () => {
    const xml = makeScore([q('C', 4), FULL_BAR, q('D', 4) + q('E', 4)]);
    // anacrusis 1 ketuk → akhir seharusnya 3 ketuk, tapi cuma 2
    expect(warningCodes(xml)).toContain('ANACRUSIS_COMPLEMENT');
  });

  it('lubang waktu di tengah suara → VOICE_GAP', () => {
    const xml = makeScore([q('C', 4) + `<forward><duration>2</duration></forward>` + q('E', 4)], {
      beats: 3,
      beatType: 4,
    });
    expect(warningCodes(xml)).toContain('VOICE_GAP');
  });

  it('nomor bait bolong → VERSE_NUMBERS', () => {
    const bar =
      q('C', 4, `<lyric number="1"><syllabic>single</syllabic><text>la</text></lyric><lyric number="3"><syllabic>single</syllabic><text>lo</text></lyric>`) +
      q('D', 4) +
      q('E', 4) +
      q('F', 4);
    expect(warningCodes(makeScore([bar]))).toContain('VERSE_NUMBERS');
  });

  it('birama tengah kurang durasi → MEASURE_DURATION', () => {
    const xml = makeScore([FULL_BAR, q('C', 4) + q('D', 4), FULL_BAR]);
    expect(warningCodes(xml)).toContain('MEASURE_DURATION');
  });
});

describe('repeat & volta tersimpan struktural', () => {
  it('membaca repeat forward/backward dan ending', () => {
    const xml = makeScore([
      `<barline location="left"><repeat direction="forward"/></barline>${FULL_BAR}`,
      `<barline location="left"><ending number="1" type="start"/></barline>${FULL_BAR}` +
        `<barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>`,
      `<barline location="left"><ending number="2" type="start"/></barline>${FULL_BAR}`,
    ]);
    const result = parseMusicXml(xml);
    const [m1, m2, m3] = result.score.voices[0].measures;
    expect(m1.repeat.forward).toBe(true);
    expect(m2.repeat.backward).toBe(true);
    expect(m2.repeat.endingNumbers).toEqual([1]);
    expect(m3.repeat.endingNumbers).toEqual([2]);
    expect(m3.repeat.endingType).toBe('start');
  });
});
