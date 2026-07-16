// Abstraksi "instrument" — kontrak antara player dan sumber bunyi.
//
// Keputusan terkunci: synth sekarang → sampled organ nanti TANPA merombak
// player/otak musik. Caranya: Tone.js hidup DI BELAKANG interface ini;
// mengganti bunyi = menulis factory baru dengan kontrak yang sama
// (mis. createSampledOrgan yang memuat sample lalu memenuhi Instrument).
//
// Interface bicara dalam nomor MIDI + detik — turunan paling ujung dari
// spelled pitch; semua kecerdasan musikal sudah selesai di lapis atasnya.

import type { ToneAudioNode } from 'tone';

export interface Instrument {
  /** Bunyikan nada MIDI selama durationSec, mulai pada timeSec (waktu AudioContext). */
  triggerAttackRelease(midi: number, durationSec: number, timeSec: number): void;
  dispose(): void;
}

export type InstrumentFactory = (destination: ToneAudioNode) => Promise<Instrument>;

/**
 * Instrument Fase 1: synth organ-ish (triangle + envelope lembut, sustain
 * tinggi) — cukup jelas untuk latihan koor tanpa berpura-pura jadi organ pipa.
 * Tone.js di-import dinamis: chunk-nya baru diunduh saat audio dipakai.
 */
export const createOrganSynth: InstrumentFactory = async (destination) => {
  const Tone = await import('tone');
  const synth = new Tone.PolySynth(Tone.Synth, {
    volume: -8,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.08, sustain: 0.85, release: 0.25 },
  }).connect(destination);

  return {
    triggerAttackRelease(midi, durationSec, timeSec) {
      synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), durationSec, timeSec);
    },
    dispose() {
      synth.dispose();
    },
  };
};
