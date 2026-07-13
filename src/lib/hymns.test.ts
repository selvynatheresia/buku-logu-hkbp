import { describe, expect, it } from 'vitest';
import { loguId } from './hymns';

describe('loguId', () => {
  it('zero-pad ke 3 digit sesuai konvensi penamaan', () => {
    expect(loguId(5)).toBe('logu-005');
    expect(loguId(73)).toBe('logu-073');
    expect(loguId(110)).toBe('logu-110');
    expect(loguId(730)).toBe('logu-730');
  });

  it('menolak nomor di luar jangkauan atau bukan integer', () => {
    expect(() => loguId(-1)).toThrow();
    expect(() => loguId(1000)).toThrow();
    expect(() => loguId(1.5)).toThrow();
  });
});
