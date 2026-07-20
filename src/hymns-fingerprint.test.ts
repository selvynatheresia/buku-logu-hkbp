// @vitest-environment node
//
// Penegak disiplin cache offline (jalan juga di CI sebagai gerbang deploy):
// konten hymns/ berubah ⇒ content_version WAJIB naik + fingerprint dicatat.
// Tanpa ini, pengguna offline (cache-first) tidak pernah menerima konten baru.

import { describe, expect, it } from 'vitest';
import { computeFingerprint, readRecorded } from '../scripts/hymns-fingerprint.mjs';

describe('guard versi konten hymn', () => {
  it('hymns/ tidak berubah diam-diam tanpa bump content_version', () => {
    const recorded = readRecorded();
    expect(recorded, 'hymns.fingerprint.json belum ada — jalankan: npm run fingerprint').not.toBeNull();

    const current = computeFingerprint();
    expect(
      current,
      'Konten public/hymns/ berubah. Naikkan content_version di manifest.json ' +
        '(service worker offline hanya refresh saat versi naik), lalu jalankan `npm run fingerprint`.',
    ).toEqual(recorded);
  });
});
