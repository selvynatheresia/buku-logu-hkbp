// Kompilator jadwal playback — model internal → event ber-posisi-waktu per voice.
//
// Lapis 1 dari arsitektur audio (disetujui 15 Jul 2026): SEMUA logika musikal
// playback hidup di sini sebagai pure function yang di-unit-test — lapis Tone.js
// di src/audio/ dibuat setipis mungkin karena tidak bisa diuji otomatis (jsdom
// tidak punya WebAudio).
//
// Keputusan penting:
// - Rangkaian TIE di-merge jadi SATU nada berkelanjutan (kalau tidak, nada
//   di-attack ulang di tengah — bug audible paling klasik).
// - Posisi & durasi tetap pecahan whole note (eksak); konversi ke
//   detik/ticks = urusan player, karena tergantung tempo live.
// - MIDI = turunan spelled pitch via pitchToMidi, dihitung di ujung pipa.
// - Repeat TIDAK diekspansi (Fase 1): dimainkan linear + flag hasRepeats
//   supaya UI jujur bilang "pengulangan belum dimainkan".

import { FRAC_ZERO, fracAdd, fracCompare, fracEq, pitchToMidi } from './model';
import type { Fraction, InternalScore, Measure, Pitch } from './model';

export interface PlaybackNote {
  /** Posisi mulai absolut dari awal lagu (pecahan whole note). */
  start: Fraction;
  /** Durasi total, termasuk semua sambungan tie. */
  duration: Fraction;
  midi: number;
  /** Spelled pitch not PERTAMA rangkaian (untuk label nada awal / debug). */
  pitch: Pitch;
  fermata: boolean;
  /** Id event model dari not pertama rangkaian — pintu highlight nanti. */
  sourceId: string;
}

export interface PlaybackVoice {
  id: string;
  label: string;
  notes: PlaybackNote[];
}

export interface PlaybackScore {
  voices: PlaybackVoice[];
  /** Panjang lagu (pecahan whole note). */
  total: Fraction;
  /** Tempo dari file (ketukan quarter/menit); null = file tidak menyebut. */
  tempoBpm: number | null;
  /** Ada repeat/volta di skor — Fase 1 dimainkan linear, UI wajib memberi tahu. */
  hasRepeats: boolean;
  /** Ada fermata — durasi ekstranya diabaikan Fase 1, UI wajib memberi tahu. */
  hasFermata: boolean;
}

export function compilePlayback(score: InternalScore): PlaybackScore {
  // Offset awal tiap birama dihitung SEKALI lintas voice (dari isi terpanjang),
  // supaya keempat suara SATB selalu sejajar walau ada voice ber-gap.
  const measureCount = score.voices[0]?.measures.length ?? 0;
  const measureOffsets: Fraction[] = [];
  let running = FRAC_ZERO;
  for (let i = 0; i < measureCount; i++) {
    measureOffsets.push(running);
    running = fracAdd(running, measureDuration(score, i));
  }
  const total = running;

  let hasRepeats = false;
  let hasFermata = false;

  const voices: PlaybackVoice[] = score.voices.map((voice) => {
    const notes: PlaybackNote[] = [];
    voice.measures.forEach((measure, mi) => {
      if (measure.repeat.forward || measure.repeat.backward || measure.repeat.endingNumbers) {
        hasRepeats = true;
      }
      for (const ev of measure.events) {
        if (ev.fermata) hasFermata = true;
        if (ev.kind !== 'note') continue; // rest = celah waktu, bukan event

        const start = fracAdd(measureOffsets[mi], ev.start);
        const midi = pitchToMidi(ev.pitch);
        const last = notes[notes.length - 1];

        // Sambungan tie: nada sama & menyambung persis di ujung nada sebelumnya
        // → perpanjang, JANGAN attack ulang. (Chain tie ikut ter-handle karena
        // nada hasil merge tetap jadi "last" untuk sambungan berikutnya.)
        if (
          ev.tieStop &&
          last !== undefined &&
          last.midi === midi &&
          fracEq(fracAdd(last.start, last.duration), start)
        ) {
          last.duration = fracAdd(last.duration, ev.duration);
          last.fermata = last.fermata || ev.fermata;
          continue;
        }

        notes.push({
          start,
          duration: ev.duration,
          midi,
          pitch: ev.pitch,
          fermata: ev.fermata,
          sourceId: ev.id,
        });
      }
    });
    return { id: voice.id, label: voice.label, notes };
  });

  return { voices, total, tempoBpm: score.tempoBpm, hasRepeats, hasFermata };
}

function measureDuration(score: InternalScore, measureIdx: number): Fraction {
  let max = FRAC_ZERO;
  for (const voice of score.voices) {
    const measure: Measure | undefined = voice.measures[measureIdx];
    if (measure === undefined) continue;
    for (const ev of measure.events) {
      const end = fracAdd(ev.start, ev.duration);
      if (fracCompare(end, max) > 0) max = end;
    }
  }
  return max;
}

export interface StartingPitch {
  voiceId: string;
  label: string;
  midi: number;
  pitch: Pitch;
}

/** Nada awal tiap suara, urutan suara di skor (S→A→T→B untuk SATB). */
export function startingPitches(playback: PlaybackScore): StartingPitch[] {
  const out: StartingPitch[] = [];
  for (const voice of playback.voices) {
    const first = voice.notes[0];
    if (first !== undefined) {
      out.push({ voiceId: voice.id, label: voice.label, midi: first.midi, pitch: first.pitch });
    }
  }
  return out;
}
