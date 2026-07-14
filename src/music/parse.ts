// Parser MusicXML → model internal (InternalScore).
//
// Kenapa parser sendiri (bukan library generik): subset MusicXML yang dipakai
// hymn itu kecil dan jelas, dan library generik justru meng-couple model kita
// ke struktur data pihak ketiga — persis yang Prinsip 4 SPEC larang.
//
// Kebijakan "fail loud":
// - Struktur di luar subset yang didukung (grace note, key/time change di
//   tengah lagu, format timewise) → MusicXmlParseError dengan konteks birama.
// - Keanehan yang masih bisa ditangani deterministik → ParseWarning
//   terstruktur, TIDAK pernah di-skip diam-diam. Warning ini radar kita
//   saat kelima lagu pilot berdatangan.
//
// Hanya memakai API DOM standar (DOMParser) — jalan di browser dan di test
// environment jsdom, tanpa dependency.

import {
  FRAC_ZERO,
  frac,
  fracAdd,
  fracCompare,
  fracEq,
  fracSub,
  fracToString,
  measureCapacity,
  pitchToString,
} from './model';
import type {
  Fraction,
  KeySignature,
  Measure,
  NoteEvent,
  ParseResult,
  ParseWarning,
  Pitch,
  RepeatInfo,
  RestEvent,
  ScoreEvent,
  Step,
  Syllabic,
  Syllable,
  TimeSignature,
  Voice,
} from './model';

export class MusicXmlParseError extends Error {
  constructor(
    message: string,
    /** Nomor birama (string dari file) tempat masalah ditemukan. */
    readonly measure?: string,
  ) {
    super(measure !== undefined ? `${message} (birama ${measure})` : message);
    this.name = 'MusicXmlParseError';
  }
}

// ---------------------------------------------------------------------------
// Helper DOM — selalu anak LANGSUNG, supaya elemen bersarang (mis. <slur> di
// dalam <notations>) tidak tertukar dengan level di atasnya.
// ---------------------------------------------------------------------------

function children(parent: Element, tag: string): Element[] {
  return Array.from(parent.children).filter((c) => c.tagName === tag);
}

function child(parent: Element, tag: string): Element | null {
  return children(parent, tag)[0] ?? null;
}

function childText(parent: Element, tag: string): string | null {
  return child(parent, tag)?.textContent ?? null;
}

function childInt(parent: Element, tag: string): number | null {
  const t = childText(parent, tag);
  if (t === null || t.trim() === '') return null;
  const n = Number(t.trim());
  if (!Number.isInteger(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Bentuk mentah hasil jalan-pertama (sebelum penataan voice)
// ---------------------------------------------------------------------------

/** Kunci "garis fisik" satu baris musik di file: part + staff + voice. */
type LineKey = string;

function lineKey(partIdx: number, staff: number, voice: string): LineKey {
  return `${partIdx}:${staff}:${voice}`;
}

interface RawNote {
  line: LineKey;
  start: Fraction;
  duration: Fraction;
  isRest: boolean;
  measureRest: boolean;
  pitch: Pitch | null;
  /** Not ini anggota chord dari not sebelumnya (berbunyi bersamaan). */
  chord: boolean;
  tieStart: boolean;
  tieStop: boolean;
  slurStart: boolean;
  slurStop: boolean;
  fermata: boolean;
  tuplet: boolean;
  lyrics: Record<number, Syllable>;
}

interface RawMeasure {
  number: string;
  implicitAttr: boolean;
  notes: RawNote[];
  repeat: RepeatInfo;
  finalBar: boolean;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function parseMusicXml(xml: string): ParseResult {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new MusicXmlParseError('File bukan XML yang valid.');
  }
  const root = doc.documentElement;
  if (root.tagName === 'score-timewise') {
    throw new MusicXmlParseError(
      'Format score-timewise tidak didukung — export ulang sebagai score-partwise (default MuseScore).',
    );
  }
  if (root.tagName !== 'score-partwise') {
    throw new MusicXmlParseError(`Root <${root.tagName}> tidak dikenal — bukan file MusicXML?`);
  }

  const warnings: ParseWarning[] = [];
  const warn = (w: ParseWarning) => warnings.push(w);

  const title =
    child(root, 'work') !== null ? childText(child(root, 'work')!, 'work-title') : null;

  const parts = children(root, 'part');
  if (parts.length === 0) throw new MusicXmlParseError('Tidak ada <part> di file.');

  const partNames = readPartNames(root, parts);

  // ---- Jalan pertama: kumpulkan not ber-posisi-waktu per birama ----
  const ctx: WalkContext = {
    divisions: null,
    key: null,
    time: null,
    tempoBpm: null,
    warn,
  };

  let rawMeasures: RawMeasure[] | null = null;
  parts.forEach((part, partIdx) => {
    const partMeasures = walkPart(part, partIdx, ctx);
    if (rawMeasures === null) {
      rawMeasures = partMeasures;
    } else {
      if (partMeasures.length !== rawMeasures.length) {
        throw new MusicXmlParseError(
          `Jumlah birama part ke-${partIdx + 1} (${partMeasures.length}) beda dengan part pertama (${rawMeasures.length}).`,
        );
      }
      partMeasures.forEach((m, i) => rawMeasures![i].notes.push(...m.notes));
    }
  });
  if (rawMeasures === null) throw new MusicXmlParseError('Tidak ada birama di file.');
  const measures: RawMeasure[] = rawMeasures;

  if (ctx.key === null) throw new MusicXmlParseError('Key signature tidak ditemukan.');
  if (ctx.time === null) throw new MusicXmlParseError('Time signature tidak ditemukan.');
  const key: KeySignature = ctx.key;
  const time: TimeSignature = ctx.time;

  // ---- Penataan voice: garis fisik → voice logis (chord di-split dulu) ----
  const lines = collectLines(measures, warn);
  const voices = buildVoices(lines, measures, partNames, warn);

  // ---- Validasi struktur skor ----
  const anacrusis = detectAnacrusis(measures, voices, time, warn);
  validateMeasureDurations(voices, time, anacrusis, warn);
  validateTies(voices, warn);
  validateLyrics(voices, warn);

  const versesCount = countVerses(voices, warn);

  return {
    score: {
      title: title?.trim() || null,
      key,
      time,
      tempoBpm: ctx.tempoBpm,
      voices,
      versesCount,
      anacrusis,
    },
    warnings,
  };
}

function readPartNames(root: Element, parts: Element[]): string[] {
  const list = child(root, 'part-list');
  const byId = new Map<string, string>();
  if (list) {
    for (const sp of children(list, 'score-part')) {
      const id = sp.getAttribute('id');
      const name = childText(sp, 'part-name')?.trim();
      if (id && name) byId.set(id, name);
    }
  }
  return parts.map((p, i) => byId.get(p.getAttribute('id') ?? '') ?? `Part ${i + 1}`);
}

// ---------------------------------------------------------------------------
// Jalan pertama per part: cursor waktu eksplisit + divisions per part
// ---------------------------------------------------------------------------

interface WalkContext {
  divisions: number | null;
  key: KeySignature | null;
  time: TimeSignature | null;
  tempoBpm: number | null;
  warn: (w: ParseWarning) => void;
}

function walkPart(part: Element, partIdx: number, ctx: WalkContext): RawMeasure[] {
  const out: RawMeasure[] = [];
  // divisions berlaku per part; reset supaya part tanpa divisions terdeteksi
  let divisions: number | null = null;

  children(part, 'measure').forEach((measureEl, measureIdx) => {
    const number = measureEl.getAttribute('number') ?? String(measureIdx);
    const raw: RawMeasure = {
      number,
      implicitAttr: measureEl.getAttribute('implicit') === 'yes',
      notes: [],
      repeat: { forward: false, backward: false, endingNumbers: null, endingType: null },
      finalBar: false,
    };

    let cursor: Fraction = FRAC_ZERO;
    // posisi not terakhir yang bukan-chord — anchor untuk anggota chord
    let lastNoteStart: Fraction = FRAC_ZERO;

    const toWhole = (durDivisions: number): Fraction => {
      if (divisions === null) {
        throw new MusicXmlParseError('<divisions> belum ditetapkan sebelum not pertama.', number);
      }
      // divisions = jumlah unit per QUARTER note; whole note = 4 quarter
      return frac(durDivisions, divisions * 4);
    };

    for (const el of Array.from(measureEl.children)) {
      switch (el.tagName) {
        case 'attributes': {
          const div = childInt(el, 'divisions');
          if (div !== null) divisions = div;
          readKeyAndTime(el, number, ctx);
          break;
        }
        case 'note': {
          const note = readNote(el, partIdx, number, cursor, lastNoteStart, toWhole, ctx);
          raw.notes.push(note.raw);
          if (!note.raw.chord) {
            lastNoteStart = note.raw.start;
            cursor = fracAdd(note.raw.start, note.raw.duration);
          }
          break;
        }
        case 'backup': {
          const dur = childInt(el, 'duration');
          if (dur === null) throw new MusicXmlParseError('<backup> tanpa <duration>.', number);
          cursor = fracSub(cursor, toWhole(dur));
          if (fracCompare(cursor, FRAC_ZERO) < 0) {
            throw new MusicXmlParseError('<backup> mundur melewati awal birama.', number);
          }
          break;
        }
        case 'forward': {
          const dur = childInt(el, 'duration');
          if (dur === null) throw new MusicXmlParseError('<forward> tanpa <duration>.', number);
          cursor = fracAdd(cursor, toWhole(dur));
          break;
        }
        case 'barline': {
          readBarline(el, raw);
          break;
        }
        case 'direction': {
          const sound = child(el, 'sound');
          const tempo = sound?.getAttribute('tempo');
          if (tempo && ctx.tempoBpm === null) ctx.tempoBpm = Number(tempo);
          break;
        }
        case 'sound': {
          const tempo = el.getAttribute('tempo');
          if (tempo && ctx.tempoBpm === null) ctx.tempoBpm = Number(tempo);
          break;
        }
        default:
          // print, harmony, dsb. — aman diabaikan untuk model musik
          break;
      }
    }

    out.push(raw);
  });

  return out;
}

function readKeyAndTime(attrs: Element, measureNumber: string, ctx: WalkContext): void {
  const keyEl = child(attrs, 'key');
  if (keyEl) {
    const fifths = childInt(keyEl, 'fifths');
    if (fifths === null) throw new MusicXmlParseError('<key> tanpa <fifths>.', measureNumber);
    const modeText = childText(keyEl, 'mode')?.trim();
    const mode = modeText === 'major' || modeText === 'minor' ? modeText : null;
    const next: KeySignature = { fifths, mode };
    if (ctx.key === null) {
      ctx.key = next;
    } else if (ctx.key.fifths !== next.fifths) {
      // Modulasi di tengah lagu = di luar subset Fase 1 — fail loud sesuai rencana.
      throw new MusicXmlParseError(
        `Perubahan key signature di tengah lagu (${ctx.key.fifths} → ${next.fifths}) belum didukung — flag ke Selvyna.`,
        measureNumber,
      );
    }
  }

  const timeEl = child(attrs, 'time');
  if (timeEl) {
    const beats = childInt(timeEl, 'beats');
    const beatType = childInt(timeEl, 'beat-type');
    if (beats === null || beatType === null) {
      throw new MusicXmlParseError('<time> tanpa beats/beat-type.', measureNumber);
    }
    const next: TimeSignature = { beats, beatType };
    if (ctx.time === null) {
      ctx.time = next;
    } else if (ctx.time.beats !== next.beats || ctx.time.beatType !== next.beatType) {
      throw new MusicXmlParseError(
        `Perubahan time signature di tengah lagu (${ctx.time.beats}/${ctx.time.beatType} → ${next.beats}/${next.beatType}) belum didukung — flag ke Selvyna.`,
        measureNumber,
      );
    }
  }
}

const VALID_STEPS: readonly string[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const VALID_SYLLABIC: readonly string[] = ['single', 'begin', 'middle', 'end'];

function readNote(
  el: Element,
  partIdx: number,
  measureNumber: string,
  cursor: Fraction,
  lastNoteStart: Fraction,
  toWhole: (d: number) => Fraction,
  ctx: WalkContext,
): { raw: RawNote } {
  if (child(el, 'grace')) {
    throw new MusicXmlParseError(
      'Grace note ditemukan — di luar subset Fase 1, flag ke Selvyna sebelum lanjut.',
      measureNumber,
    );
  }
  if (child(el, 'cue')) {
    throw new MusicXmlParseError('Cue note belum didukung.', measureNumber);
  }

  const durationDiv = childInt(el, 'duration');
  if (durationDiv === null) {
    throw new MusicXmlParseError('<note> tanpa <duration>.', measureNumber);
  }
  const duration = toWhole(durationDiv);

  const isChord = child(el, 'chord') !== null;
  const start = isChord ? lastNoteStart : cursor;

  const staff = childInt(el, 'staff') ?? 1;
  const voice = childText(el, 'voice')?.trim() || '1';
  const line = lineKey(partIdx, staff, voice);

  const restEl = child(el, 'rest');
  let pitch: Pitch | null = null;
  if (!restEl) {
    const pitchEl = child(el, 'pitch');
    if (!pitchEl) {
      throw new MusicXmlParseError('<note> tanpa <pitch> dan bukan <rest> (unpitched belum didukung).', measureNumber);
    }
    const step = childText(pitchEl, 'step')?.trim() ?? '';
    if (!VALID_STEPS.includes(step)) {
      throw new MusicXmlParseError(`<step> tidak valid: "${step}".`, measureNumber);
    }
    const octave = childInt(pitchEl, 'octave');
    if (octave === null) throw new MusicXmlParseError('<pitch> tanpa <octave>.', measureNumber);
    const alterText = childText(pitchEl, 'alter');
    const alter = alterText === null ? 0 : Number(alterText.trim());
    if (!Number.isInteger(alter) || alter < -2 || alter > 2) {
      throw new MusicXmlParseError(`<alter> di luar jangkauan -2..2: ${alterText}.`, measureNumber);
    }
    pitch = { step: step as Step, alter, octave };
  }

  // tie (sound) — bisa muncul dua elemen sekaligus (stop + start)
  let tieStart = false;
  let tieStop = false;
  for (const tie of children(el, 'tie')) {
    if (tie.getAttribute('type') === 'start') tieStart = true;
    if (tie.getAttribute('type') === 'stop') tieStop = true;
  }

  let slurStart = false;
  let slurStop = false;
  let fermata = false;
  let tiedStart = false;
  let tiedStop = false;
  for (const notations of children(el, 'notations')) {
    const slurs = children(notations, 'slur');
    if (slurs.length > 2) {
      ctx.warn({
        code: 'NESTED_SLUR',
        message: `Lebih dari 2 slur pada satu not — struktur slur bersarang, cek manual.`,
        measure: measureNumber,
      });
    }
    for (const slur of slurs) {
      if (slur.getAttribute('type') === 'start') slurStart = true;
      if (slur.getAttribute('type') === 'stop') slurStop = true;
    }
    for (const tied of children(notations, 'tied')) {
      if (tied.getAttribute('type') === 'start') tiedStart = true;
      if (tied.getAttribute('type') === 'stop') tiedStop = true;
    }
    if (child(notations, 'fermata')) fermata = true;
  }

  // Percaya <tie> (sound); fallback <tied> (notasi); beda isi → warning.
  if (!tieStart && tiedStart) {
    tieStart = true;
    if (children(el, 'tie').length > 0) {
      ctx.warn({
        code: 'TIE_MISMATCH',
        message: 'Ada <tied type="start"> tanpa <tie type="start"> — notasi dan sound tidak sinkron.',
        measure: measureNumber,
      });
    }
  }
  if (!tieStop && tiedStop) {
    tieStop = true;
    if (children(el, 'tie').length > 0) {
      ctx.warn({
        code: 'TIE_MISMATCH',
        message: 'Ada <tied type="stop"> tanpa <tie type="stop"> — notasi dan sound tidak sinkron.',
        measure: measureNumber,
      });
    }
  }

  const tuplet = child(el, 'time-modification') !== null;
  if (tuplet) {
    ctx.warn({
      code: 'TUPLET',
      message:
        'Tuplet ditemukan — durasi sudah dihitung eksak, tapi notasi not angka-nya perlu perhatian saat renderer dikerjakan.',
      measure: measureNumber,
    });
  }

  const lyrics: Record<number, Syllable> = {};
  children(el, 'lyric').forEach((lyricEl, i) => {
    const numAttr = lyricEl.getAttribute('number');
    let verse = numAttr !== null ? Number(numAttr) : i + 1;
    if (!Number.isInteger(verse) || verse < 1) {
      ctx.warn({
        code: 'LYRIC_NO_NUMBER',
        message: `<lyric> dengan number tidak numerik ("${numAttr}") — dianggap bait ke-${i + 1}.`,
        measure: measureNumber,
      });
      verse = i + 1;
    }
    const syllabicText = childText(lyricEl, 'syllabic')?.trim() ?? null;
    const syllabic =
      syllabicText !== null && VALID_SYLLABIC.includes(syllabicText)
        ? (syllabicText as Syllabic)
        : null;
    lyrics[verse] = {
      text: childText(lyricEl, 'text') ?? '',
      syllabic,
      // MuseScore menulis <extend/> tanpa type; type="stop" BUKAN start melisma
      extend:
        children(lyricEl, 'extend').length > 0 &&
        children(lyricEl, 'extend')[0].getAttribute('type') !== 'stop',
    };
  });

  return {
    raw: {
      line,
      start,
      duration,
      isRest: restEl !== null,
      measureRest: restEl?.getAttribute('measure') === 'yes',
      pitch,
      chord: isChord,
      tieStart,
      tieStop,
      slurStart,
      slurStop,
      fermata,
      tuplet,
      lyrics,
    },
  };
}

function readBarline(el: Element, raw: RawMeasure): void {
  const repeat = child(el, 'repeat');
  if (repeat) {
    const dir = repeat.getAttribute('direction');
    if (dir === 'forward') raw.repeat.forward = true;
    if (dir === 'backward') raw.repeat.backward = true;
  }
  const ending = child(el, 'ending');
  if (ending) {
    const numbers = (ending.getAttribute('number') ?? '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    const type = ending.getAttribute('type');
    raw.repeat.endingNumbers = numbers.length > 0 ? numbers : null;
    raw.repeat.endingType =
      type === 'start' || type === 'stop' || type === 'discontinue' ? type : null;
  }
  if (childText(el, 'bar-style')?.trim() === 'light-heavy') {
    raw.finalBar = true;
  }
}

// ---------------------------------------------------------------------------
// Penataan garis fisik → voice logis
// ---------------------------------------------------------------------------

interface PhysicalLine {
  key: LineKey;
  partIdx: number;
  staff: number;
  voice: string;
  /** Ukuran chord terbesar di garis ini (1 = tidak ada chord). */
  maxChord: number;
}

function collectLines(measures: RawMeasure[], warn: (w: ParseWarning) => void): PhysicalLine[] {
  const map = new Map<LineKey, PhysicalLine>();
  for (const m of measures) {
    // hitung ukuran chord per grup (not non-chord + not chord yang menempel)
    let currentLine: LineKey | null = null;
    let groupSize = 0;
    const flush = () => {
      if (currentLine !== null && map.has(currentLine)) {
        const line = map.get(currentLine)!;
        line.maxChord = Math.max(line.maxChord, groupSize);
      }
    };
    for (const n of m.notes) {
      const [p, s, v] = n.line.split(':');
      if (!map.has(n.line)) {
        map.set(n.line, {
          key: n.line,
          partIdx: Number(p),
          staff: Number(s),
          voice: v,
          maxChord: 1,
        });
      }
      if (n.chord && n.line === currentLine) {
        groupSize += 1;
      } else {
        flush();
        currentLine = n.line;
        groupSize = 1;
      }
    }
    flush();
  }

  const lines = Array.from(map.values()).sort(
    (a, b) =>
      a.partIdx - b.partIdx || a.staff - b.staff || a.voice.localeCompare(b.voice, 'en'),
  );

  for (const line of lines) {
    if (line.maxChord > 1) {
      warn({
        code: 'CHORD_SPLIT',
        message:
          `Garis part ${line.partIdx + 1}/staff ${line.staff}/voice ${line.voice} berisi chord ` +
          `(maks ${line.maxChord} not bersamaan) — di-split jadi ${line.maxChord} suara (not tertinggi = suara atas). ` +
          'Verifikasi hasilnya terhadap cetakan.',
      });
    }
  }
  return lines;
}

/** Satu "sub-garis" hasil split chord (chordIdx 0 = suara paling atas). */
interface SubLine {
  line: PhysicalLine;
  chordIdx: number;
}

function buildVoices(
  lines: PhysicalLine[],
  measures: RawMeasure[],
  partNames: string[],
  warn: (w: ParseWarning) => void,
): Voice[] {
  const subLines: SubLine[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.maxChord; i++) subLines.push({ line, chordIdx: i });
  }

  const ids = voiceIds(subLines.length, warn);
  const labels = voiceLabels(subLines, partNames);

  return subLines.map((sub, subIdx) => {
    const voiceId = ids[subIdx];
    const voiceMeasures: Measure[] = measures.map((rawMeasure, measureIdx) => {
      const events = eventsForSubLine(rawMeasure, sub, voiceId, measureIdx, warn);
      return {
        number: rawMeasure.number,
        index: measureIdx,
        partial: false, // diisi detectAnacrusis/validateMeasureDurations
        events,
        repeat: rawMeasure.repeat,
        finalBar: rawMeasure.finalBar,
      };
    });
    return { id: voiceId, label: labels[subIdx], measures: voiceMeasures };
  });
}

function voiceIds(count: number, warn: (w: ParseWarning) => void): string[] {
  if (count === 1) return ['v1'];
  if (count === 4) return ['s', 'a', 't', 'b'];
  warn({
    code: 'VOICES_UNUSUAL',
    message: `Jumlah suara ${count} (bukan 1 atau 4) — id voice generik dipakai; cek struktur file.`,
  });
  return Array.from({ length: count }, (_, i) => `v${i + 1}`);
}

function voiceLabels(subLines: SubLine[], partNames: string[]): string[] {
  if (subLines.length === 1) return [partNames[subLines[0].line.partIdx]];
  if (subLines.length === 4) return ['Sopran', 'Alto', 'Tenor', 'Bas'];
  return subLines.map(
    (sub) =>
      `${partNames[sub.line.partIdx]} · staff ${sub.line.staff} · voice ${sub.line.voice}` +
      (sub.line.maxChord > 1 ? ` · chord ${sub.chordIdx + 1}` : ''),
  );
}

function eventsForSubLine(
  rawMeasure: RawMeasure,
  sub: SubLine,
  voiceId: string,
  measureIdx: number,
  warn: (w: ParseWarning) => void,
): ScoreEvent[] {
  // Grup not per posisi start di garis fisik ini (chord = 1 grup >1 not)
  const lineNotes = rawMeasure.notes.filter((n) => n.line === sub.line.key);
  const groups: RawNote[][] = [];
  for (const n of lineNotes) {
    if (n.chord && groups.length > 0) groups[groups.length - 1].push(n);
    else groups.push([n]);
  }

  const events: ScoreEvent[] = [];
  for (const group of groups) {
    let source: RawNote;
    if (sub.line.maxChord === 1) {
      source = group[0];
    } else {
      // chord → suara atas = pitch tertinggi (aturan split deterministik)
      const sorted = [...group].sort((a, b) => comparePitchDesc(a.pitch, b.pitch));
      if (sub.chordIdx < sorted.length) {
        source = sorted[sub.chordIdx];
      } else {
        // chord lebih kecil dari maxChord → unison: not terbawah diduplikasi
        source = sorted[sorted.length - 1];
        if (!source.isRest) {
          // rest memang berlaku untuk semua suara — duplikasinya bukan anomali
          warn({
            code: 'UNISON_FILL',
            message:
              `Chord berisi ${group.length} not padahal garis ini ${sub.line.maxChord} suara — ` +
              `suara "${voiceId}" memakai duplikat not terbawah (diasumsikan unison). Verifikasi vs cetakan.`,
            measure: rawMeasure.number,
            voice: voiceId,
          });
        }
      }
    }
    events.push(toEvent(source, voiceId, measureIdx, events.length));
  }

  // Kontiguitas: event harus menyambung tanpa lubang
  let expectedStart: Fraction | null = null;
  for (const ev of events) {
    if (expectedStart !== null && !fracEq(ev.start, expectedStart)) {
      warn({
        code: 'VOICE_GAP',
        message: `Ada lubang/tumpang-tindih waktu di suara "${voiceId}" (event ${ev.id} mulai ${fracToString(ev.start)}, seharusnya ${fracToString(expectedStart)}).`,
        measure: rawMeasure.number,
        voice: voiceId,
      });
    }
    expectedStart = fracAdd(ev.start, ev.duration);
  }

  return events;
}

function comparePitchDesc(a: Pitch | null, b: Pitch | null): number {
  // rest tidak pernah anggota chord bernada; null diletakkan terakhir
  if (a === null) return 1;
  if (b === null) return -1;
  const chromA = pitchChroma(a);
  const chromB = pitchChroma(b);
  return chromB - chromA;
}

/** Tinggi absolut untuk PENGURUTAN saja (bukan identitas nada — spelling tetap dijaga). */
function pitchChroma(p: Pitch): number {
  const base: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  return (p.octave + 1) * 12 + base[p.step] + p.alter;
}

function toEvent(n: RawNote, voiceId: string, measureIdx: number, eventIdx: number): ScoreEvent {
  const id = `${voiceId}-m${measureIdx}-e${eventIdx}`;
  if (n.isRest) {
    const rest: RestEvent = {
      kind: 'rest',
      id,
      start: n.start,
      duration: n.duration,
      fermata: n.fermata,
      measureRest: n.measureRest,
    };
    return rest;
  }
  const note: NoteEvent = {
    kind: 'note',
    id,
    start: n.start,
    duration: n.duration,
    fermata: n.fermata,
    pitch: n.pitch!,
    tieStart: n.tieStart,
    tieStop: n.tieStop,
    slurStart: n.slurStart,
    slurStop: n.slurStop,
    lyrics: n.lyrics,
    tuplet: n.tuplet,
  };
  return note;
}

// ---------------------------------------------------------------------------
// Validasi struktur
// ---------------------------------------------------------------------------

function measureContentDuration(voices: Voice[], measureIdx: number): Fraction {
  let max = FRAC_ZERO;
  for (const voice of voices) {
    for (const ev of voice.measures[measureIdx].events) {
      const end = fracAdd(ev.start, ev.duration);
      if (fracCompare(end, max) > 0) max = end;
    }
  }
  return max;
}

function detectAnacrusis(
  measures: RawMeasure[],
  voices: Voice[],
  time: TimeSignature,
  warn: (w: ParseWarning) => void,
): boolean {
  if (measures.length === 0) return false;
  const capacity = measureCapacity(time);
  const firstContent = measureContentDuration(voices, 0);
  const anacrusis =
    measures[0].implicitAttr || fracCompare(firstContent, capacity) < 0;

  if (anacrusis) {
    for (const v of voices) v.measures[0].partial = true;
    // Birama akhir harus komplemen anacrusis (konvensi cetak Buku Logu)
    const lastIdx = measures.length - 1;
    if (lastIdx > 0) {
      const lastContent = measureContentDuration(voices, lastIdx);
      const expectedLast = fracSub(capacity, firstContent);
      if (fracEq(lastContent, expectedLast)) {
        for (const v of voices) v.measures[lastIdx].partial = true;
      } else if (fracCompare(lastContent, capacity) < 0) {
        for (const v of voices) v.measures[lastIdx].partial = true;
        warn({
          code: 'ANACRUSIS_COMPLEMENT',
          message:
            `Birama akhir (${fracToString(lastContent)}) bukan komplemen anacrusis ` +
            `(${fracToString(firstContent)} + ${fracToString(lastContent)} ≠ ${fracToString(capacity)}) — cek terhadap cetakan.`,
          measure: measures[lastIdx].number,
        });
      }
    }
  }
  return anacrusis;
}

function validateMeasureDurations(
  voices: Voice[],
  time: TimeSignature,
  anacrusis: boolean,
  warn: (w: ParseWarning) => void,
): void {
  if (voices.length === 0) return;
  const capacity = measureCapacity(time);
  const count = voices[0].measures.length;
  for (let i = 0; i < count; i++) {
    const isPartialAllowed = voices[0].measures[i].partial && anacrusis;
    const content = measureContentDuration(voices, i);
    if (!isPartialAllowed && !fracEq(content, capacity)) {
      warn({
        code: 'MEASURE_DURATION',
        message: `Isi birama ${fracToString(content)} ≠ time signature ${fracToString(capacity)}.`,
        measure: voices[0].measures[i].number,
      });
    }
  }
}

function validateTies(voices: Voice[], warn: (w: ParseWarning) => void): void {
  for (const voice of voices) {
    let pending: NoteEvent | null = null; // tieStart yang menunggu pasangan
    for (const measure of voice.measures) {
      for (const ev of measure.events) {
        if (ev.kind !== 'note') continue;
        if (ev.tieStop) {
          if (pending === null) {
            warn({
              code: 'TIE_UNPAIRED',
              message: `Tie stop tanpa tie start sebelumnya (event ${ev.id}).`,
              measure: measure.number,
              voice: voice.id,
            });
          } else if (pitchToString(pending.pitch) !== pitchToString(ev.pitch)) {
            warn({
              code: 'TIE_MISMATCH',
              message:
                `Tie menyambung nada berbeda: ${pitchToString(pending.pitch)} → ${pitchToString(ev.pitch)} ` +
                `(event ${ev.id}) — tie harus nada sama; mungkin maksudnya slur?`,
              measure: measure.number,
              voice: voice.id,
            });
          }
          pending = null;
        }
        if (ev.tieStart) {
          if (pending !== null) {
            warn({
              code: 'TIE_UNPAIRED',
              message: `Tie start bertumpuk tanpa stop (event ${ev.id}).`,
              measure: measure.number,
              voice: voice.id,
            });
          }
          pending = ev;
        }
      }
    }
    if (pending !== null) {
      warn({
        code: 'TIE_UNPAIRED',
        message: `Tie start di akhir lagu tanpa pasangan stop (event ${pending.id}).`,
        voice: voice.id,
      });
    }
  }
}

/**
 * Konsistensi lirik ↔ melisma:
 * - slur start pada not berlirik seharusnya dibarengi extend (penanda melisma);
 * - extend pada not tanpa slur/tie berarti alignment-nya patut dicek.
 * Keduanya warning, bukan error — cetakan yang jadi hakim akhirnya.
 */
function validateLyrics(voices: Voice[], warn: (w: ParseWarning) => void): void {
  for (const voice of voices) {
    for (const measure of voice.measures) {
      for (const ev of measure.events) {
        if (ev.kind !== 'note') continue;
        const sylls = Object.values(ev.lyrics);
        if (sylls.length === 0) continue;
        const anyExtend = sylls.some((s) => s.extend);
        if (ev.slurStart && !anyExtend && !ev.tieStart) {
          warn({
            code: 'SLUR_WITHOUT_EXTEND',
            message:
              `Not berlirik dengan slur start tapi tanpa <extend> (event ${ev.id}) — ` +
              'melisma tidak tertandai di lirik; cek entry di MuseScore.',
            measure: measure.number,
            voice: voice.id,
          });
        }
        if (anyExtend && !ev.slurStart && !ev.tieStart) {
          warn({
            code: 'EXTEND_WITHOUT_SLUR',
            message: `Lirik ber-<extend> tapi notnya tidak slur/tie (event ${ev.id}) — cek alignment.`,
            measure: measure.number,
            voice: voice.id,
          });
        }
      }
    }
  }
}

function countVerses(voices: Voice[], warn: (w: ParseWarning) => void): number {
  const seen = new Set<number>();
  for (const voice of voices) {
    for (const measure of voice.measures) {
      for (const ev of measure.events) {
        if (ev.kind !== 'note') continue;
        for (const k of Object.keys(ev.lyrics)) seen.add(Number(k));
      }
    }
  }
  if (seen.size === 0) return 0;
  const max = Math.max(...seen);
  for (let v = 1; v <= max; v++) {
    if (!seen.has(v)) {
      warn({
        code: 'VERSE_NUMBERS',
        message: `Nomor bait tidak berurutan: bait ${v} tidak pernah muncul padahal bait ${max} ada.`,
      });
    }
  }
  return max;
}
