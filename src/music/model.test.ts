import { describe, expect, it } from 'vitest';
import {
  frac,
  fracAdd,
  fracCompare,
  fracEq,
  fracSub,
  fracToString,
  measureCapacity,
  pitchToString,
} from './model';

describe('frac', () => {
  it('selalu ternormalisasi ke bentuk paling sederhana', () => {
    expect(frac(2, 8)).toEqual({ num: 1, den: 4 });
    expect(frac(6, 8)).toEqual({ num: 3, den: 4 });
    expect(frac(0, 5)).toEqual({ num: 0, den: 1 });
    expect(frac(4, -8)).toEqual({ num: -1, den: 2 });
  });

  it('menolak penyebut nol dan non-integer', () => {
    expect(() => frac(1, 0)).toThrow();
    expect(() => frac(1.5, 2)).toThrow();
  });

  it('aritmetika eksak — tanpa error float', () => {
    // 1/10 + 2/10 == 3/10 eksak (kasus yang gagal di float)
    expect(fracEq(fracAdd(frac(1, 10), frac(2, 10)), frac(3, 10))).toBe(true);
    expect(fracSub(frac(1, 1), frac(1, 4))).toEqual({ num: 3, den: 4 });
    expect(fracCompare(frac(1, 4), frac(3, 8))).toBe(-1);
    expect(fracCompare(frac(2, 4), frac(1, 2))).toBe(0);
    expect(fracToString(frac(3, 4))).toBe('3/4');
  });
});

describe('measureCapacity', () => {
  it('menghitung durasi penuh birama dari time signature', () => {
    expect(measureCapacity({ beats: 4, beatType: 4 })).toEqual({ num: 1, den: 1 });
    expect(measureCapacity({ beats: 3, beatType: 4 })).toEqual({ num: 3, den: 4 });
    expect(measureCapacity({ beats: 6, beatType: 8 })).toEqual({ num: 3, den: 4 });
  });
});

describe('pitchToString', () => {
  it('menuliskan spelled pitch dengan aksidental', () => {
    expect(pitchToString({ step: 'C', alter: 0, octave: 4 })).toBe('C4');
    expect(pitchToString({ step: 'D', alter: -1, octave: 4 })).toBe('Db4');
    expect(pitchToString({ step: 'F', alter: 1, octave: 5 })).toBe('F#5');
    expect(pitchToString({ step: 'B', alter: -2, octave: 3 })).toBe('Bbb3');
  });
});
