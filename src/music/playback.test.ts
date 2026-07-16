// @vitest-environment jsdom
//
// Test kompilator jadwal playback (lapis pure dari arsitektur audio).
// Yang paling penting di sini: merge tie (anti attack-ulang), celah rest,
// posisi absolut lintas birama (termasuk anacrusis), dan flag kejujuran UI
// (hasRepeats / hasFermata).

import { describe, expect, it } from 'vitest';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { FRAC_ZERO, frac } from './model';
import { parseMusicXml } from './parse';
import { compilePlayback, startingPitches } from './playback';

const score = parseMusicXml(dummyXml).score;

describe('compilePlayback dummy logu-000', () => {
  const playback = compilePlayback(score);
  const notes = playback.voices[0].notes;

  it('metadata: tempo dari file, total 7 whole note (28 ketuk), flag jujur', () => {
    expect(playback.tempoBpm).toBe(96);
    expect(playback.total).toEqual(frac(7, 1));
    expect(playback.hasFermata).toBe(true); // fermata birama akhir → UI wajib flag
    expect(playback.hasRepeats).toBe(false);
    expect(playback.voices).toHaveLength(1);
  });

  it('tie di-merge: 23 not model → 22 nada bersuara, tanpa attack ulang', () => {
    expect(notes).toHaveLength(22);
    // rangkaian tie m5→m6: half (1/2) + quarter (1/4) = SATU nada 3/4 whole (3 ketuk)
    const tied = notes.find((n) => n.sourceId === 'v1-m5-e2');
    expect(tied).toBeDefined();
    expect(tied!.duration).toEqual(frac(3, 4));
    // not lanjutannya TIDAK muncul sebagai event sendiri
    expect(notes.some((n) => n.sourceId === 'v1-m6-e0')).toBe(false);
  });

  it('anacrusis: nada pertama mulai di 0 tanpa menunggu birama penuh', () => {
    expect(notes[0].start).toEqual(FRAC_ZERO);
    expect(notes[0].midi).toBe(62); // D4
    expect(notes[0].sourceId).toBe('v1-m0-e0');
  });

  it('posisi absolut lintas birama benar; rest jadi celah, bukan nada', () => {
    // birama 4 offset = 1/4 (anacrusis) + 3×1 = 13/4
    const g4 = notes.find((n) => n.sourceId === 'v1-m4-e0');
    expect(g4!.start).toEqual(frac(13, 4));
    expect(g4!.duration).toEqual(frac(1, 2));
    // setelah G4 half ada rest 1 ketuk → D4 masuk di 13/4 + 3/4 = 4
    const d4 = notes.find((n) => n.sourceId === 'v1-m4-e2');
    expect(d4!.start).toEqual(frac(4, 1));
    // rest tidak pernah menghasilkan nada
    expect(notes.filter((n) => n.sourceId.startsWith('v1-m4')).length).toBe(2);
  });

  it('fermata menempel di nada terakhir', () => {
    const last = notes[notes.length - 1];
    expect(last.sourceId).toBe('v1-m7-e0');
    expect(last.fermata).toBe(true);
    expect(last.duration).toEqual(frac(3, 4));
  });

  it('nada awal: pitch pertama per suara, urutan suara skor', () => {
    expect(startingPitches(playback)).toEqual([
      {
        voiceId: 'v1',
        label: 'Melodi',
        midi: 62,
        pitch: { step: 'D', alter: 0, octave: 4 },
      },
    ]);
  });
});

describe('flag repeat', () => {
  it('skor ber-repeat → hasRepeats true (UI wajib bilang belum dimainkan)', () => {
    const withRepeat = structuredClone(score);
    withRepeat.voices[0].measures[2].repeat.backward = true;
    expect(compilePlayback(withRepeat).hasRepeats).toBe(true);
  });
});
