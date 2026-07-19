// Model musik internal — jantung Prinsip 4 SPEC.
//
// Semua konsumen (transpose engine, renderer not angka, audio engine, dan
// transform MusicXML untuk Verovio) membaca struktur di file ini, dan TIDAK
// pernah menyentuh struktur internal library mana pun.
//
// Dua keputusan desain paling penting (disetujui 13 Jul 2026):
//
// 1. Pitch = SPELLED PITCH (huruf + aksidental + oktaf), bukan nomor MIDI.
//    Db4 dan C#4 adalah dua nilai yang berbeda. Nomor MIDI menghancurkan
//    informasi enharmonis — akar bug transpose yang dilarang acceptance
//    criteria. Nilai MIDI/frekuensi dihitung sebagai turunan saat dibutuhkan.
//
// 2. Durasi = BILANGAN RASIONAL (pecahan whole note), bukan float.
//    `divisions` MusicXML berbeda-beda antar file, dan float berakumulasi
//    error pembulatan yang merusak deteksi anacrusis + alignment playback.
//    Bonus: durasi tuplet (den=3 dst.) otomatis eksak tanpa refactor.

// ---------------------------------------------------------------------------
// Pecahan (durasi & posisi waktu)
// ---------------------------------------------------------------------------

/** Pecahan ternormalisasi; satuan durasi = whole note (4/4 penuh = 1/1). */
export interface Fraction {
  readonly num: number;
  readonly den: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

/** Buat pecahan ternormalisasi (penyebut selalu positif, selalu bentuk paling sederhana). */
export function frac(num: number, den: number): Fraction {
  if (den === 0 || !Number.isInteger(num) || !Number.isInteger(den)) {
    throw new Error(`Pecahan tidak valid: ${num}/${den}`);
  }
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den) || 1;
  return { num: num / g, den: den / g };
}

export const FRAC_ZERO: Fraction = frac(0, 1);

export function fracAdd(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function fracSub(a: Fraction, b: Fraction): Fraction {
  return frac(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function fracEq(a: Fraction, b: Fraction): boolean {
  return a.num === b.num && a.den === b.den;
}

/** -1 kalau a<b, 0 kalau sama, 1 kalau a>b. */
export function fracCompare(a: Fraction, b: Fraction): number {
  const diff = a.num * b.den - b.num * a.den;
  return diff < 0 ? -1 : diff > 0 ? 1 : 0;
}

/** Untuk pesan error/debug: "3/4". */
export function fracToString(f: Fraction): string {
  return `${f.num}/${f.den}`;
}

/** Konversi ke float — HANYA untuk output akhir (mis. detik audio), bukan perbandingan. */
export function fracToNumber(f: Fraction): number {
  return f.num / f.den;
}

// ---------------------------------------------------------------------------
// Pitch (spelled)
// ---------------------------------------------------------------------------

export type Step = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface Pitch {
  step: Step;
  /** Aksidental kromatis: -2 (double flat) … +2 (double sharp); 0 = natural. */
  alter: number;
  /** Oktaf ilmiah (C4 = middle C), sama dengan konvensi MusicXML. */
  octave: number;
}

/** "Db4", "F#5", "C4" — untuk pesan, debug, dan jembatan ke tonal.js. */
export function pitchToString(p: Pitch): string {
  const acc = p.alter === 0 ? '' : p.alter > 0 ? '#'.repeat(p.alter) : 'b'.repeat(-p.alter);
  return `${p.step}${acc}${p.octave}`;
}

const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Nomor MIDI sebagai TURUNAN spelled pitch (C4 = 60; B#3 = 60 juga — enharmonis).
 * Untuk audio dan pengurutan tinggi nada. JANGAN dipakai sebagai identitas nada:
 * spelling-lah identitasnya (Prinsip enharmonic).
 */
export function pitchToMidi(p: Pitch): number {
  return (p.octave + 1) * 12 + STEP_SEMITONES[p.step] + p.alter;
}

// ---------------------------------------------------------------------------
// Konteks musik
// ---------------------------------------------------------------------------

export interface KeySignature {
  /** Jumlah kres (positif) / mol (negatif), -7..7 — konvensi MusicXML <fifths>. */
  fifths: number;
  /** null = file tidak menyatakan mode. Lagu minor = gerbang converter not angka! */
  mode: 'major' | 'minor' | null;
}

export interface TimeSignature {
  beats: number;
  beatType: number;
}

/** Durasi penuh satu birama menurut time signature, sebagai pecahan whole note. */
export function measureCapacity(time: TimeSignature): Fraction {
  return frac(time.beats, time.beatType);
}

// ---------------------------------------------------------------------------
// Lirik
// ---------------------------------------------------------------------------

export type Syllabic = 'single' | 'begin' | 'middle' | 'end';

export interface Syllable {
  text: string;
  /** null = file tidak menyatakan syllabic (jarang; diperlakukan 'single'). */
  syllabic: Syllabic | null;
  /** true = suku kata ini melisma — ditahan melewati not-not berikutnya tanpa lirik. */
  extend: boolean;
}

// ---------------------------------------------------------------------------
// Tanda dinamika & arah (Batch B, 18 Jul 2026)
// ---------------------------------------------------------------------------

/** Tanda dinamika MusicXML yang dikenal (subset yang lazim di hymn). */
export const DYNAMIC_VALUES = [
  'ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sf', 'sfz', 'fz', 'rf', 'rfz',
] as const;
export type DynamicValue = (typeof DYNAMIC_VALUES)[number];

/**
 * Event arah pada posisi waktu dalam birama — level SISTEM (berlaku semua
 * suara), sesuai praktik hymn; disimpan sekali dan dirujuk semua voice.
 */
export type Direction =
  | { kind: 'dynamic'; start: Fraction; value: DynamicValue }
  | { kind: 'wedge'; start: Fraction; wedge: 'crescendo' | 'diminuendo' | 'stop' }
  | { kind: 'words'; start: Fraction; text: string };

/** Artikulasi per not yang didukung tampilan Fase 1. */
export type Articulation = 'accent' | 'strong-accent' | 'staccato' | 'tenuto';

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface EventBase {
  /** Id stabil "«voice»-m«index»-e«n»" — dipakai renderer/audio/highlight nanti. */
  id: string;
  /** Posisi mulai relatif terhadap awal birama (pecahan whole note). */
  start: Fraction;
  duration: Fraction;
  fermata: boolean;
}

export interface NoteEvent extends EventBase {
  kind: 'note';
  pitch: Pitch;
  /** Tie = SATU nada disambung (bunyi menerus); beda konsep dengan slur. */
  tieStart: boolean;
  tieStop: boolean;
  /** Slur di konteks vokal = penanda melisma/frase. */
  slurStart: boolean;
  slurStop: boolean;
  /** key = nomor bait (1-based, sesuai <lyric number> MusicXML). */
  lyrics: Record<number, Syllable>;
  /** Ada time-modification (tuplet) di sumber — durasi sudah eksak, tapi
   *  renderer not angka perlu tahu untuk notasinya. */
  tuplet: boolean;
  /** Artikulasi (aksen dsb.) — tampilan; playback velocity menyusul. */
  articulations: Articulation[];
}

export interface RestEvent extends EventBase {
  kind: 'rest';
  /** <rest measure="yes"> — tanda diam sepanjang birama. */
  measureRest: boolean;
}

export type ScoreEvent = NoteEvent | RestEvent;

// ---------------------------------------------------------------------------
// Struktur skor
// ---------------------------------------------------------------------------

/** Info pengulangan per birama — disimpan struktural sejak awal karena
 *  auto-advance bait Mode Latihan bekerja per pengulangan (SPEC Opsi C). */
export interface RepeatInfo {
  forward: boolean;
  backward: boolean;
  /** Volta: nomor ending ([1], [2], atau [1,2]) kalau birama ini bagian ending. */
  endingNumbers: number[] | null;
  endingType: 'start' | 'stop' | 'discontinue' | null;
}

export interface Measure {
  /** Nomor birama dari file (string — MusicXML mengizinkan "X1" dsb.). */
  number: string;
  /** Indeks 0-based dalam urutan dokumen. */
  index: number;
  /** Birama tidak penuh yang "sah" (anacrusis / birama akhir komplemen). */
  partial: boolean;
  events: ScoreEvent[];
  /** Dinamika/wedge/teks level sistem — referensi array yang SAMA di semua voice. */
  directions: Direction[];
  repeat: RepeatInfo;
  finalBar: boolean;
}

export interface Voice {
  /** "v1" untuk melodi tunggal; "s"/"a"/"t"/"b" untuk SATB. */
  id: string;
  label: string;
  measures: Measure[];
}

export interface InternalScore {
  title: string | null;
  key: KeySignature;
  time: TimeSignature;
  tempoBpm: number | null;
  voices: Voice[];
  /** Jumlah bait (nomor bait terbesar yang muncul di lirik). */
  versesCount: number;
  /** Lagu diawali birama gantung. */
  anacrusis: boolean;
}

// ---------------------------------------------------------------------------
// Hasil parse + kebijakan "fail loud"
// ---------------------------------------------------------------------------

/** Kode warning terstruktur — radar kita saat lagu asli mulai berdatangan. */
export type WarningCode =
  | 'TUPLET'
  | 'CHORD_SPLIT'
  | 'UNISON_FILL'
  | 'SLUR_WITHOUT_EXTEND'
  | 'EXTEND_WITHOUT_SLUR'
  | 'TIE_UNPAIRED'
  | 'TIE_MISMATCH'
  | 'MEASURE_DURATION'
  | 'ANACRUSIS_COMPLEMENT'
  | 'VOICE_GAP'
  | 'VOICES_UNUSUAL'
  | 'VERSE_NUMBERS'
  | 'LYRIC_NO_NUMBER'
  | 'NESTED_SLUR'
  | 'UNKNOWN_DYNAMIC'
  | 'UNKNOWN_ARTICULATION'
  | 'WEDGE_UNPAIRED';

export interface ParseWarning {
  code: WarningCode;
  message: string;
  /** Nomor birama tempat masalah ditemukan (kalau relevan). */
  measure?: string;
  voice?: string;
}

export interface ParseResult {
  score: InternalScore;
  warnings: ParseWarning[];
}
