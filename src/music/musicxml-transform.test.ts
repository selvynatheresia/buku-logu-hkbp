// @vitest-environment jsdom
//
// Test transform MusicXML. Assertion terkuat: hasil strip diparse ulang oleh
// parser kita sendiri — musiknya harus IDENTIK (pitch, durasi, struktur),
// hanya liriknya yang hilang.

import { describe, expect, it } from 'vitest';
import dummyXml from '../../public/hymns/logu-000/base.musicxml?raw';
import { cipherVoiceToString, scoreToCipher } from './cipher';
import { stripLyrics, transposeMusicXml } from './musicxml-transform';
import { parseMusicXml } from './parse';
import { transposeScoreToTonic } from './transpose';

describe('stripLyrics', () => {
  const stripped = stripLyrics(dummyXml);

  it('tidak menyisakan satu pun elemen <lyric>', () => {
    expect(dummyXml).toContain('<lyric');
    expect(stripped).not.toContain('<lyric');
  });

  it('musiknya utuh: parse ulang identik kecuali lirik', () => {
    const original = parseMusicXml(dummyXml).score;
    const bare = parseMusicXml(stripped).score;

    expect(bare.versesCount).toBe(0);
    expect(bare.key).toEqual(original.key);
    expect(bare.time).toEqual(original.time);
    expect(bare.anacrusis).toBe(original.anacrusis);

    // struktur not identik — bandingkan lewat serialisasi cipher
    // (derajat, ritme, tie, slur, fermata semua terwakili di situ)
    expect(cipherVoiceToString(scoreToCipher(bare).cipher.voices[0])).toBe(
      cipherVoiceToString(scoreToCipher(original).cipher.voices[0]),
    );
  });

  it('idempoten & menolak XML rusak', () => {
    expect(stripLyrics(stripped)).not.toContain('<lyric');
    expect(() => stripLyrics('<oops')).toThrow(/XML/);
  });
});

describe('transposeMusicXml', () => {
  it('EKUIVALEN dengan jalur model: dua implementasi independen setuju', () => {
    const source = parseMusicXml(dummyXml).score;
    for (const target of ['A', 'Db', 'B', 'F#']) {
      const viaXml = parseMusicXml(transposeMusicXml(dummyXml, target)).score;
      const viaModel = transposeScoreToTonic(source, target).score;
      expect(viaXml).toEqual(viaModel);
    }
  });

  it('tonic sama → string dikembalikan utuh tanpa sentuhan', () => {
    expect(transposeMusicXml(dummyXml, 'G')).toBe(dummyXml);
  });

  it('fifths tertulis benar; <accidental> display dibuang', () => {
    const out = transposeMusicXml(dummyXml, 'B'); // G(1#) → B(5#)
    expect(out).toContain('<fifths>5</fifths>');
    expect(out).not.toContain('<accidental>');
    // spot-check: D4 (pickup) + 3M = F#4 → alter 1 muncul di not pertama
    expect(parseMusicXml(out).score.voices[0].measures[0].events[0]).toMatchObject({
      pitch: { step: 'F', alter: 1, octave: 4 },
    });
  });
});
