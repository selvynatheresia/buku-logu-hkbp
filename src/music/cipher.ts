// Converter not angka (movable-do) — model internal → model cipher.
//
// Pemisahan tanggung jawab (rencana disetujui 14 Jul 2026):
// - File ini (Tahap A) memutuskan STRUKTUR: angka derajat, titik oktaf,
//   sel ritme beat-grid (angka / '-' / '.' / '0' + underline), slur, fermata,
//   lirik per sel. Semuanya deterministik dan teruji.
// - GLYPH LAYOUT persis (posisi titik, jarak, lirik) = urusan renderer SVG,
//   diverifikasi terhadap cetakan (Logu 110 + foto BL-73) — kalau konvensi
//   cetak beda soal detail, yang berubah renderer, bukan converter ini.
//
// Inti movable-do: derajat = aritmetika HURUF not terhadap huruf do
// (mod 7), BUKAN semitone. Konsekuensi yang diuji sebagai property:
// transpose mengubah semua huruf seragam → cipher TIDAK berubah sama sekali,
// hanya label "Do = X".
//
// Gerbang SPEC yang ditegakkan di sini:
// - Lagu minor → CipherError (konvensi Do=X vs La=X belum diverifikasi).
// - Meter compound (6/8 dst.) → CipherError (satuan ketuk belum diverifikasi).
// - Not kromatis → warning CHROMATIC_NOTE + tampilan aksidental provisional,
//   TIDAK ditebak diam-diam.

import { FRAC_ZERO, frac, fracAdd, fracCompare, fracEq, fracSub, fracToString, measureCapacity } from './model';
import type {
  Fraction,
  InternalScore,
  Measure,
  NoteEvent,
  Pitch,
  RepeatInfo,
  ScoreEvent,
  Step,
  Syllable,
  TimeSignature,
  Voice,
} from './model';
import { tonicForKey } from './transpose';

export class CipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CipherError';
  }
}

export type CipherWarningCode =
  | 'CHROMATIC_NOTE'
  | 'SLUR_SAME_PITCH'
  | 'LYRICS_ON_TIE_CONTINUATION';

export interface CipherWarning {
  code: CipherWarningCode;
  message: string;
  measure?: string;
  eventId?: string;
}

// ---------------------------------------------------------------------------
// Model cipher
// ---------------------------------------------------------------------------

interface CipherCellBase {
  /** Posisi mulai dalam birama (pecahan whole note, ruang model internal). */
  start: Fraction;
  /** Durasi sel ini saja (satu not bisa jadi beberapa sel: angka + '-'/'.'.) */
  duration: Fraction;
  /** Jumlah garis bawah (0 = satu ketuk penuh; 1 = ½ ketuk; 2 = ¼; dst.). */
  underlines: number;
  fermata: boolean;
  /** Id event sumber di model internal — jembatan highlight/audio nanti. */
  sourceId: string | null;
}

export interface CipherNoteCell extends CipherCellBase {
  kind: 'note';
  /** 1..7 (do..si). */
  degree: number;
  /** Titik oktaf: positif = di atas angka, negatif = di bawah. */
  octaveDots: number;
  /**
   * null = diatonis. Selain itu = PENYIMPANGAN kromatis dari skala key
   * (+1 = dinaikkan, -1 = diturunkan) — tampilan provisional sampai konvensi
   * cetakan dikonfirmasi (selalu dibarengi warning CHROMATIC_NOTE).
   */
  accidental: number | null;
  slurStart: boolean;
  slurStop: boolean;
  /** key = nomor bait. */
  lyrics: Record<number, Syllable>;
}

/** '-' = menahan satu ketuk penuh; '.' = perpanjangan sub-ketuk. */
export interface CipherExtendCell extends CipherCellBase {
  kind: 'dash' | 'dot';
}

/** '0'. */
export interface CipherRestCell extends CipherCellBase {
  kind: 'rest';
}

export type CipherCell = CipherNoteCell | CipherExtendCell | CipherRestCell;

export interface CipherBeat {
  /** Indeks ketukan musikal 0-based (anacrusis: grid disejajarkan dari AKHIR birama). */
  index: number;
  cells: CipherCell[];
}

export interface CipherMeasure {
  number: string;
  index: number;
  partial: boolean;
  beats: CipherBeat[];
  repeat: RepeatInfo;
  finalBar: boolean;
}

export interface CipherVoice {
  id: string;
  label: string;
  measures: CipherMeasure[];
}

export interface CipherScore {
  /** Isi label "Do = X" (spelling tonic; lokalisasi label = urusan renderer). */
  doLabel: string;
  /** "4/4" dsb. */
  timeLabel: string;
  time: TimeSignature;
  versesCount: number;
  voices: CipherVoice[];
}

export interface CipherResult {
  cipher: CipherScore;
  warnings: CipherWarning[];
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const LETTER_IDX: Record<Step, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_ORDER = 'FCGDAEB';
const FLAT_ORDER = 'BEADGCF';

/**
 * Referensi titik oktaf (PROVISIONAL — verifikasi vs cetakan Logu 110):
 * angka polos = jendela-do yang memuat MEDIAN register suara pertama.
 *
 * Kenapa median, bukan jendela absolut (C4..B4): jendela absolut melanggar
 * movable-do — transpose naik kuart bisa menyeberangkan seluruh melodi ke
 * jendela berikutnya dan semua angka mendadak bertitik atas (ketangkap
 * property test). Dengan median: transpose menggeser median DAN posisi do
 * sejumlah huruf yang sama, selisihnya kekal → titik oktaf terbukti invarian.
 * Untuk SATB, referensi tetap dari suara PERTAMA (sopran) — keempat baris
 * memakai do yang sama, masing-masing dengan titiknya sendiri (sesuai SPEC).
 */
function referenceDiatonic(score: InternalScore, doLetterIdx: number): number {
  const positions: number[] = [];
  const firstVoice = score.voices[0];
  if (firstVoice !== undefined) {
    for (const measure of firstVoice.measures) {
      for (const ev of measure.events) {
        if (ev.kind === 'note') positions.push(ev.pitch.octave * 7 + LETTER_IDX[ev.pitch.step]);
      }
    }
  }
  if (positions.length === 0) return 4 * 7 + doLetterIdx; // fallback: do di oktaf 4
  positions.sort((a, b) => a - b);
  const median = positions[Math.floor((positions.length - 1) / 2)];
  return doLetterIdx + 7 * Math.floor((median - doLetterIdx) / 7);
}

export function scoreToCipher(score: InternalScore): CipherResult {
  if (score.key.mode === 'minor') {
    throw new CipherError(
      'GERBANG SPEC: lagu minor terdeteksi — konvensi "Do = X" vs "La = X" belum ' +
        'diverifikasi ke cetakan fisik. Berhenti; tunggu konfirmasi Selvyna.',
    );
  }
  const { beats, beatType } = score.time;
  if (beatType !== 2 && beatType !== 4) {
    throw new CipherError(
      `Meter ${beats}/${beatType} belum didukung converter not angka — satuan ketuk ` +
        'meter compound belum diverifikasi ke cetakan. Flag ke Selvyna.',
    );
  }

  const beat = frac(1, beatType);
  const capacity = measureCapacity(score.time);
  const doTonic = tonicForKey(score.key);
  const refDiatonic = referenceDiatonic(score, LETTER_IDX[doTonic[0] as Step]);

  const warnings: CipherWarning[] = [];
  const ctx: ConvertContext = {
    beat,
    capacity,
    fifths: score.key.fifths,
    refDiatonic,
    warnings,
  };

  return {
    cipher: {
      doLabel: doTonic,
      timeLabel: `${beats}/${beatType}`,
      time: score.time,
      versesCount: score.versesCount,
      voices: score.voices.map((v) => convertVoice(v, ctx)),
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Derajat, titik oktaf, aksidental
// ---------------------------------------------------------------------------

/** Alter "seharusnya" untuk sebuah huruf menurut key signature. */
function keyAlter(step: Step, fifths: number): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(step) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(step) ? -1 : 0;
  return 0;
}

export interface DegreeInfo {
  degree: number;
  octaveDots: number;
  /** Penyimpangan kromatis dari skala; 0 = diatonis. */
  deviation: number;
}

/** Aritmetika huruf murni — diekspos untuk test. */
export function degreeInfo(pitch: Pitch, refDiatonic: number, fifths: number): DegreeInfo {
  const absDiatonic = pitch.octave * 7 + LETTER_IDX[pitch.step];
  const diff = absDiatonic - refDiatonic;
  const degree = ((diff % 7) + 7) % 7 + 1;
  const octaveDots = Math.floor(diff / 7);
  const deviation = pitch.alter - keyAlter(pitch.step, fifths);
  return { degree, octaveDots, deviation };
}

// ---------------------------------------------------------------------------
// Konversi voice/measure/event
// ---------------------------------------------------------------------------

interface ConvertContext {
  beat: Fraction;
  capacity: Fraction;
  fifths: number;
  refDiatonic: number;
  warnings: CipherWarning[];
}

function convertVoice(voice: Voice, ctx: ConvertContext): CipherVoice {
  // Deteksi slur antar nada SAMA (kemungkinan maksudnya tie) — per voice.
  let prevNote: NoteEvent | null = null;
  for (const measure of voice.measures) {
    for (const ev of measure.events) {
      if (ev.kind !== 'note') continue;
      if (
        ev.slurStop &&
        prevNote !== null &&
        prevNote.slurStart &&
        prevNote.pitch.step === ev.pitch.step &&
        prevNote.pitch.alter === ev.pitch.alter &&
        prevNote.pitch.octave === ev.pitch.octave
      ) {
        ctx.warnings.push({
          code: 'SLUR_SAME_PITCH',
          message:
            `Slur menyambung dua nada yang sama (event ${ev.id}) — di not angka ini ambigu ` +
            '(angka diulang atau ditahan?); kemungkinan maksud sumbernya tie. Cek vs cetakan.',
          measure: measure.number,
          eventId: ev.id,
        });
      }
      prevNote = ev;
    }
  }

  return {
    id: voice.id,
    label: voice.label,
    measures: voice.measures.map((m) => convertMeasure(m, ctx, voice.id)),
  };
}

function measureContent(measure: Measure): Fraction {
  let max = FRAC_ZERO;
  for (const ev of measure.events) {
    const end = fracAdd(ev.start, ev.duration);
    if (fracCompare(end, max) > 0) max = end;
  }
  return max;
}

function convertMeasure(measure: Measure, ctx: ConvertContext, voiceId: string): CipherMeasure {
  // Anacrusis: grid ketukan disejajarkan dari AKHIR birama, supaya pickup
  // 1 ketuk di 4/4 benar-benar jatuh di ketukan ke-4 (underline grouping benar).
  const offset =
    measure.index === 0 && measure.partial
      ? fracSub(ctx.capacity, measureContent(measure))
      : FRAC_ZERO;

  const cells: CipherCell[] = [];
  for (const ev of measure.events) {
    emitEventCells(ev, measure, offset, ctx, voiceId, cells);
  }

  // Kelompokkan sel per ketukan musikal (dasar underline grouping di renderer)
  const beats: CipherBeat[] = [];
  for (const cell of cells) {
    const idx = floorDiv(fracAdd(cell.start, offset), ctx.beat);
    const last = beats[beats.length - 1];
    if (last !== undefined && last.index === idx) last.cells.push(cell);
    else beats.push({ index: idx, cells: [cell] });
  }

  return {
    number: measure.number,
    index: measure.index,
    partial: measure.partial,
    beats,
    repeat: measure.repeat,
    finalBar: measure.finalBar,
  };
}

function emitEventCells(
  ev: ScoreEvent,
  measure: Measure,
  offset: Fraction,
  ctx: ConvertContext,
  voiceId: string,
  out: CipherCell[],
): void {
  // Lanjutan tie BUKAN angka baru — jadi sel '-' / '.' (nada ditahan).
  const isTieContinuation = ev.kind === 'note' && ev.tieStop;
  if (isTieContinuation && Object.keys((ev as NoteEvent).lyrics).length > 0) {
    ctx.warnings.push({
      code: 'LYRICS_ON_TIE_CONTINUATION',
      message:
        `Ada lirik pada not lanjutan tie (event ${ev.id}) — di not angka not ini jadi tanda ` +
        'tahan tanpa angka, liriknya tidak punya tempat. Cek entry di MuseScore.',
      measure: measure.number,
      eventId: ev.id,
    });
  }

  const pieces = splitAtBeatBoundaries(ev.start, ev.duration, offset, ctx.beat);
  let isFirstCell = true;

  for (const piece of pieces) {
    for (const comp of decomposePowerOfTwo(piece.duration, ctx.beat, ev.id, measure.number)) {
      const base = {
        start: piece.consumedStart,
        duration: comp,
        underlines: underlineCount(comp, ctx.beat),
        fermata: isFirstCell && ev.fermata,
        sourceId: ev.id,
      };
      piece.consumedStart = fracAdd(piece.consumedStart, comp);

      if (ev.kind === 'rest') {
        out.push({ ...base, kind: 'rest' });
      } else if (isFirstCell && !isTieContinuation) {
        const note = ev as NoteEvent;
        const info = degreeInfo(note.pitch, ctx.refDiatonic, ctx.fifths);
        if (info.deviation !== 0) {
          ctx.warnings.push({
            code: 'CHROMATIC_NOTE',
            message:
              `Not kromatis: derajat ${info.degree} menyimpang ${info.deviation > 0 ? '+' : ''}${info.deviation} ` +
              `dari skala (event ${ev.id}, voice ${voiceId}) — GERBANG SPEC: tampilan aksidental ` +
              'provisional; konvensi cetakan belum dikonfirmasi.',
            measure: measure.number,
            eventId: ev.id,
          });
        }
        out.push({
          ...base,
          kind: 'note',
          degree: info.degree,
          octaveDots: info.octaveDots,
          accidental: info.deviation === 0 ? null : info.deviation,
          slurStart: note.slurStart,
          slurStop: note.slurStop,
          lyrics: note.lyrics,
        });
      } else {
        // perpanjangan: satu ketuk penuh = '-', sub-ketuk = '.'
        out.push({ ...base, kind: fracEq(comp, ctx.beat) ? 'dash' : 'dot' });
      }
      isFirstCell = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Aritmetika ritme
// ---------------------------------------------------------------------------

/** floor(a / b) untuk pecahan, aritmetika integer murni. */
function floorDiv(a: Fraction, b: Fraction): number {
  return Math.floor((a.num * b.den) / (a.den * b.num));
}

interface Piece {
  duration: Fraction;
  /** Posisi jalan (dimutasi saat komponen dikonsumsi). */
  consumedStart: Fraction;
}

/** Belah [start, start+duration) pada batas ketukan (grid ber-offset anacrusis). */
function splitAtBeatBoundaries(
  start: Fraction,
  duration: Fraction,
  offset: Fraction,
  beat: Fraction,
): Piece[] {
  const pieces: Piece[] = [];
  let pos = start;
  let remaining = duration;
  while (fracCompare(remaining, FRAC_ZERO) > 0) {
    const gridPos = fracAdd(pos, offset);
    const nextBoundary = frac((floorDiv(gridPos, beat) + 1) * beat.num, beat.den);
    const room = fracSub(nextBoundary, gridPos);
    const take = fracCompare(remaining, room) < 0 ? remaining : room;
    pieces.push({ duration: take, consumedStart: pos });
    pos = fracAdd(pos, take);
    remaining = fracSub(remaining, take);
  }
  return pieces;
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Pecah durasi (≤ 1 ketuk) jadi komponen 1/2^k ketuk, terbesar dulu —
 * ekspansi biner: dotted eighth (¾ ketuk) → [½, ¼] = angka ber-underline
 * lalu titik ber-underline ganda, persis pola cetakan.
 */
function decomposePowerOfTwo(
  duration: Fraction,
  beat: Fraction,
  eventId: string,
  measureNumber: string,
): Fraction[] {
  // rasio durasi terhadap ketukan
  const ratio = frac(duration.num * beat.den, duration.den * beat.num);
  if (!isPowerOfTwo(ratio.den) || ratio.den > 8) {
    throw new CipherError(
      `Durasi ${fracToString(duration)} (event ${eventId}, birama ${measureNumber}) bukan ` +
        'pembagian 1/2^k dari ketukan — kemungkinan tuplet. Renderer not angka untuk tuplet ' +
        'menunggu kasus nyata di lagu pilot; flag ke Selvyna.',
    );
  }
  const components: Fraction[] = [];
  for (let bit = 31 - Math.clz32(ratio.num); bit >= 0; bit--) {
    if ((ratio.num >> bit) & 1) {
      components.push(frac(2 ** bit * beat.num, ratio.den * beat.den));
    }
  }
  return components;
}

function underlineCount(duration: Fraction, beat: Fraction): number {
  let count = 0;
  let d = duration;
  while (fracCompare(d, beat) < 0) {
    d = frac(d.num * 2, d.den);
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Serialisasi debug/test — BUKAN format render.
// Notasi: derajat + aksidental (#/b) + titik oktaf (' atas, , bawah) +
// underline (_ per garis) + fermata (@) + slur ( '(' mulai, ')' selesai ).
// ---------------------------------------------------------------------------

export function cipherCellToString(cell: CipherCell): string {
  let s: string;
  switch (cell.kind) {
    case 'dash':
      s = '-';
      break;
    case 'dot':
      s = '.';
      break;
    case 'rest':
      s = '0';
      break;
    case 'note': {
      const acc =
        cell.accidental === null || cell.accidental === 0
          ? ''
          : cell.accidental > 0
            ? '#'.repeat(cell.accidental)
            : 'b'.repeat(-cell.accidental);
      const oct =
        cell.octaveDots >= 0 ? "'".repeat(cell.octaveDots) : ','.repeat(-cell.octaveDots);
      s = `${cell.degree}${acc}${oct}`;
      break;
    }
  }
  s += '_'.repeat(cell.underlines);
  if (cell.fermata) s += '@';
  if (cell.kind === 'note') {
    if (cell.slurStart) s += '(';
    if (cell.slurStop) s += ')';
  }
  return s;
}

export function cipherMeasureToString(measure: CipherMeasure): string {
  return measure.beats.flatMap((b) => b.cells.map(cipherCellToString)).join(' ');
}

export function cipherVoiceToString(voice: CipherVoice): string {
  return voice.measures.map(cipherMeasureToString).join(' | ');
}
