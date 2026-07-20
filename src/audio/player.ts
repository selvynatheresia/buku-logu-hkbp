// Player — lapis tipis di atas Tone.Transport.
//
// Prinsip #1 di sini: penjadwalan pakai WAKTU MUSIKAL (ticks), BUKAN detik.
// Semua event ditaruh di posisi ketukan; slider tempo tinggal mengubah
// transport.bpm dan seluruh lagu bergeser konsisten secara live. (Kalau
// jadwal ditulis dalam detik, perubahan tempo di tengah lagu merusak sinkron.)
// Tidak ada setTimeout di file ini — semua timing milik audio clock.
//
// Lapis ini sengaja setipis mungkin: logika musikal (merge tie, posisi,
// durasi) sudah selesai dan TERUJI di src/music/playback.ts; yang di sini
// hanya pemetaan ke Tone + state machine play/pause/stop yang idempoten
// (tahan klik dobel).

import { fracToNumber } from '../music/model';
import { startingPitches } from '../music/playback';
import type { PlaybackScore } from '../music/playback';
import { createOrganSynth } from './instrument';
import type { Instrument, InstrumentFactory } from './instrument';

export type PlayerState = 'stopped' | 'playing' | 'paused';

export interface Player {
  /** Idempoten; memanggil Tone.start() untuk unlock — panggil dari handler tap user. */
  play(): Promise<void>;
  pause(): void;
  stop(): void;
  readonly state: PlayerState;
  setTempo(bpm: number): void;
  setMute(voiceId: string, muted: boolean): void;
  /** Solo membisukan otomatis semua suara lain (semantik Tone.Channel). */
  setSolo(voiceId: string, soloed: boolean): void;
  /** Posisi playback saat ini dalam KETUKAN (musical time — konsisten saat tempo berubah). */
  readonly positionBeats: number;
  /** Panjang lagu dalam ketukan. */
  readonly totalBeats: number;
  /** Lompat ke posisi ketukan (aman saat playing/paused/stopped). Catatan:
   *  nada yang mestinya sudah berbunyi di titik itu baru terdengar di attack
   *  not berikutnya — keterbatasan wajar playback synth. */
  seekBeats(beats: number): void;
  /** Nada awal: pitch pertama tiap suara berurutan S→A→T→B (untuk dirigen). */
  playStartingPitches(): Promise<void>;
  /** Di-set UI; dipanggil saat lagu selesai (state sudah 'stopped'). */
  onEnded: (() => void) | null;
  dispose(): void;
}

/** Permukaan Tone.Channel yang kita pakai — structural, biar mudah di-mock. */
interface VoiceChannel {
  mute: boolean;
  solo: boolean;
  dispose(): void;
}

interface VoiceRig {
  id: string;
  channel: VoiceChannel;
  instrument: Instrument;
}

const MIN_BPM = 40;
const MAX_BPM = 200;

export async function createPlayer(
  playback: PlaybackScore,
  instrumentFactory: InstrumentFactory = createOrganSynth,
): Promise<Player> {
  const Tone = await import('tone');
  const transport = Tone.getTransport();

  // Transport = singleton global; satu player aktif per waktu.
  // Bersihkan sisa jadwal player sebelumnya sebelum menjadwalkan yang baru.
  transport.stop();
  transport.cancel();
  transport.bpm.value = playback.tempoBpm ?? 90;

  const rigs: VoiceRig[] = [];
  for (const voice of playback.voices) {
    const channel = new Tone.Channel().toDestination();
    rigs.push({ id: voice.id, channel, instrument: await instrumentFactory(channel) });
  }

  const ppq = transport.PPQ;
  const beatsOf = (f: { num: number; den: number }) => fracToNumber(f) * 4; // whole = 4 quarter
  const ticksOf = (f: { num: number; den: number }) => `${Math.round(beatsOf(f) * ppq)}i`;

  playback.voices.forEach((voice, vi) => {
    const rig = rigs[vi];
    for (const note of voice.notes) {
      const durBeats = beatsOf(note.duration);
      transport.schedule((time) => {
        // durasi detik dihitung SAAT nada dimulai → menghormati tempo live;
        // 0.95 = sedikit celah artikulasi antar nada bersambung
        const durSec = durBeats * (60 / transport.bpm.value) * 0.95;
        rig.instrument.triggerAttackRelease(note.midi, durSec, time);
      }, ticksOf(note.start));
    }
  });

  let state: PlayerState = 'stopped';
  let disposed = false;
  const totalBeats = beatsOf(playback.total);

  const player: Player = {
    async play() {
      if (disposed || state === 'playing') return;
      // Unlock AudioContext — wajib berada di rantai handler gesture user
      // (iOS Safari & Android Chrome sama-sama menuntut ini).
      await Tone.start();
      transport.start();
      state = 'playing';
    },

    pause() {
      if (disposed || state !== 'playing') return;
      transport.pause();
      state = 'paused';
    },

    stop() {
      if (disposed || state === 'stopped') return;
      transport.stop(); // stop = berhenti + kembali ke awal (posisi 0)
      state = 'stopped';
    },

    get state() {
      return state;
    },

    setTempo(bpm: number) {
      if (disposed) return;
      transport.bpm.value = Math.min(MAX_BPM, Math.max(MIN_BPM, bpm));
    },

    setMute(voiceId, muted) {
      const rig = rigs.find((r) => r.id === voiceId);
      if (rig) rig.channel.mute = muted;
    },

    setSolo(voiceId, soloed) {
      const rig = rigs.find((r) => r.id === voiceId);
      if (rig) rig.channel.solo = soloed;
    },

    get positionBeats() {
      return disposed ? 0 : transport.ticks / ppq;
    },

    get totalBeats() {
      return totalBeats;
    },

    seekBeats(beats: number) {
      if (disposed) return;
      const clamped = Math.min(Math.max(0, beats), Math.max(0, totalBeats - 0.01));
      transport.ticks = Math.round(clamped * ppq);
    },

    async playStartingPitches() {
      if (disposed) return;
      await Tone.start();
      const base = Tone.now() + 0.05;
      startingPitches(playback).forEach((sp, i) => {
        const rig = rigs.find((r) => r.id === sp.voiceId);
        rig?.instrument.triggerAttackRelease(sp.midi, 1.1, base + i * 1.3);
      });
    },

    onEnded: null,

    dispose() {
      if (disposed) return;
      disposed = true;
      transport.stop();
      transport.cancel();
      for (const rig of rigs) {
        rig.instrument.dispose();
        rig.channel.dispose();
      }
      state = 'stopped';
    },
  };

  // Akhir lagu: transport berhenti & kembali ke awal, UI diberi tahu.
  transport.schedule((time) => {
    transport.stop(time);
    state = 'stopped';
    player.onEnded?.();
  }, ticksOf(playback.total));

  return player;
}
