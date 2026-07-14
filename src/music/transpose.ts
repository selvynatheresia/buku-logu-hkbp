// Transpose engine — interval-based, enharmonic-correct.
//
// Arsitektur dua lapis (disetujui 14 Jul 2026):
// - Operasi USER: "pilih nada dasar tujuan" → transposeScoreToTonic().
// - Operasi ENGINE: "geser interval" → transposePitch().
//
// Inti kebenaran enharmonic: interval diturunkan dari PASANGAN TONIC yang
// sudah ter-spell (Db→D = augmented unison, BUKAN "naik 1 semitone"). Interval
// yang sama diterapkan ke semua not → seluruh skala ter-respell konsisten ke
// konvensi key tujuan, tanpa keputusan per-not. Aritmetika not: tonal.js.
//
// Perilaku tonal yang jadi sandaran dipagari test khusus di transpose.test.ts
// ("kontrak tonal") — kalau upgrade tonal mengubah format, test itu yang teriak.

import { Interval, Note } from 'tonal';
import { pitchToString } from './model';
import type { InternalScore, KeySignature, Pitch, ScoreEvent, Step } from './model';

export class TransposeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransposeError';
  }
}

export interface TransposeWarning {
  code: 'DOUBLE_ACCIDENTAL_SIMPLIFIED';
  message: string;
  eventId: string;
}

export interface TransposeResult {
  score: InternalScore;
  warnings: TransposeWarning[];
}

// ---------------------------------------------------------------------------
// Tabel nada dasar
// ---------------------------------------------------------------------------

/**
 * 12 pitch class → spelling tonic kanonik (signature paling sederhana).
 * Konvensi terkunci: tie 6♯/6♭ → pilih sisi kres (F# mayor / D# minor) —
 * lebih lazim di partitur vokal; disetujui 14 Jul 2026.
 */
const CANONICAL_TONICS: Record<'major' | 'minor', readonly string[]> = {
  major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
  minor: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
};

/** Tonic ter-spell → fifths, per mode. Juga berfungsi sebagai daftar tonic sah. */
const FIFTHS_BY_TONIC: Record<'major' | 'minor', Record<string, number>> = {
  major: {
    C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
    F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
  },
  minor: {
    A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'A#': 7,
    D: -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6, Ab: -7,
  },
};

/** Pilihan nada dasar tujuan untuk UI (12 pitch class, spelling kanonik). */
export function canonicalTonics(mode: 'major' | 'minor'): readonly string[] {
  return CANONICAL_TONICS[mode];
}

/**
 * Spelling tonic dari key signature ("Do = X" not angka memakai ini juga).
 * mode null (file tidak menyatakan) diperlakukan mayor — konsisten dengan
 * gerbang SPEC: penanganan khusus minor baru relevan di converter not angka.
 */
export function tonicForKey(key: KeySignature): string {
  const mode = key.mode ?? 'major';
  const table = FIFTHS_BY_TONIC[mode];
  for (const [tonic, fifths] of Object.entries(table)) {
    if (fifths === key.fifths) return tonic;
  }
  throw new TransposeError(`Key signature di luar jangkauan: fifths=${key.fifths} (${mode}).`);
}

// ---------------------------------------------------------------------------
// Interval antar-tonic
// ---------------------------------------------------------------------------

/**
 * Interval tonal (mis. "1A", "-4d") dari tonic sumber ke tujuan.
 * Arah: perpindahan semitone terkecil; tepat 6 → TURUN (aman register sopran;
 * konvensi disetujui 14 Jul 2026). Kontrol oktaf eksplisit = Fase 2.
 */
export function intervalBetweenTonics(fromTonic: string, toTonic: string): string {
  const from = Note.get(fromTonic);
  const to = Note.get(toTonic);
  if (from.empty || from.chroma === undefined || to.empty || to.chroma === undefined) {
    throw new TransposeError(`Tonic tidak dikenal: "${fromTonic}" → "${toTonic}".`);
  }
  const k = (to.chroma - from.chroma + 12) % 12;
  const shift = k <= 5 ? k : k - 12; // k=6 → -6: turun

  const fromNote = `${fromTonic}4`;
  const fromMidi = Note.midi(fromNote);
  if (fromMidi === null) throw new TransposeError(`Tonic tanpa midi: "${fromTonic}".`);
  for (const oct of [3, 4, 5]) {
    const candidate = `${toTonic}${oct}`;
    if (Note.midi(candidate) === fromMidi + shift) {
      return Interval.distance(fromNote, candidate);
    }
  }
  /* v8 ignore next 2 — shift selalu -6..5, kandidat oktaf 3..5 selalu mencakupnya */
  throw new TransposeError(`Gagal menentukan interval ${fromTonic} → ${toTonic}.`);
}

// ---------------------------------------------------------------------------
// Transpose pitch tunggal
// ---------------------------------------------------------------------------

const NOTE_NAME_RE = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/;

/** Parse nama not gaya tonal ("Db4", "F##5") → Pitch; |alter| > 2 = error keras. */
function parseNoteName(name: string): Pitch {
  const m = name.match(NOTE_NAME_RE);
  if (!m) {
    throw new TransposeError(
      `Hasil transpose "${name}" di luar jangkauan aksidental -2..2 — ` +
      'kemungkinan spelling sumber ekstrem; cek file sumbernya.',
    );
  }
  const [, step, acc, oct] = m;
  const alter = acc === undefined ? 0 : acc.startsWith('#') ? acc.length : -acc.length;
  return { step: step as Step, alter, octave: Number(oct) };
}

/** Transpose murni interval — hasil bisa ber-double-accidental (penyederhanaan
 *  ada di level skor, supaya fungsi ini tetap matematika interval yang jujur). */
export function transposePitch(pitch: Pitch, interval: string): Pitch {
  const out = Note.transpose(pitchToString(pitch), interval);
  if (out === '') {
    throw new TransposeError(
      `tonal menolak transpose ${pitchToString(pitch)} dengan interval "${interval}".`,
    );
  }
  return parseNoteName(out);
}

// ---------------------------------------------------------------------------
// Transpose skor utuh
// ---------------------------------------------------------------------------

/**
 * Skor → skor BARU pada nada dasar tujuan. Model sumber tidak pernah dimutasi
 * (analog runtime Prinsip 2 — base layer immutable). Selain pitch dan
 * key.fifths, SEMUA hal lain (durasi, lirik, id event, repeat, anacrusis)
 * dijamin identik — diuji deep-equal di test suite.
 */
export function transposeScoreToTonic(
  score: InternalScore,
  targetTonic: string,
): TransposeResult {
  const mode = score.key.mode ?? 'major';
  const targetFifths = FIFTHS_BY_TONIC[mode][targetTonic];
  if (targetFifths === undefined) {
    throw new TransposeError(
      `Nada dasar tujuan "${targetTonic}" tidak dikenal untuk mode ${mode}. ` +
      `Pilihan sah: ${Object.keys(FIFTHS_BY_TONIC[mode]).join(', ')}.`,
    );
  }

  const sourceTonic = tonicForKey(score.key);
  if (sourceTonic === targetTonic) return { score, warnings: [] };

  const interval = intervalBetweenTonics(sourceTonic, targetTonic);

  // Sanity: interval yang dipilih harus memetakan tonic sumber PERSIS ke
  // spelling tonic tujuan — kalau tidak, ada bug pemilihan interval.
  const check = Note.transpose(sourceTonic, interval);
  /* v8 ignore next 4 */
  if (check !== targetTonic) {
    throw new TransposeError(
      `Bug internal: ${sourceTonic} + ${interval} = ${check}, seharusnya ${targetTonic}.`,
    );
  }

  const warnings: TransposeWarning[] = [];
  const transposeEvent = (ev: ScoreEvent): ScoreEvent => {
    if (ev.kind !== 'note') return ev;
    let pitch = transposePitch(ev.pitch, interval);
    if (Math.abs(pitch.alter) === 2) {
      // Not diatonis + tonic kanonik TIDAK PERNAH sampai sini; ini jejak not
      // kromatis di sumber. Respell sederhana + warning — fail loud, bukan diam.
      const simplified = parseNoteName(Note.simplify(pitchToString(pitch)));
      warnings.push({
        code: 'DOUBLE_ACCIDENTAL_SIMPLIFIED',
        message:
          `${pitchToString(pitch)} di-respell jadi ${pitchToString(simplified)} (event ${ev.id}) — ` +
          'double accidental dihindari; kemungkinan ada not kromatis di sumber, cek terhadap cetakan.',
        eventId: ev.id,
      });
      pitch = simplified;
    }
    return { ...ev, pitch };
  };

  return {
    score: {
      ...score,
      key: { ...score.key, fifths: targetFifths },
      voices: score.voices.map((voice) => ({
        ...voice,
        measures: voice.measures.map((measure) => ({
          ...measure,
          events: measure.events.map(transposeEvent),
        })),
      })),
    },
    warnings,
  };
}
