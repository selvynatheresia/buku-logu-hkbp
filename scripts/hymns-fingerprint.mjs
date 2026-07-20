// Guard disiplin cache offline: konten hymns/ TIDAK BOLEH berubah tanpa
// menaikkan content_version di manifest.json — service worker pengguna
// offline hanya me-refresh cache konten saat versi naik (cache-first).
//
// Alur kerja saat mengubah konten hymn:
//   1. ubah file di public/hymns/...
//   2. naikkan content_version di public/hymns/manifest.json
//   3. jalankan: npm run fingerprint   (mencatat hash baru)
// Test src/hymns-fingerprint.test.ts menegakkan aturan ini di CI —
// deploy yang lupa bump versi tidak akan pernah lolos.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hymnsDir = join(root, 'public', 'hymns');
const fingerprintPath = join(root, 'hymns.fingerprint.json');

/** Hash seluruh konten hymns/ yang tercantum di manifest (deterministik). */
export function computeFingerprint() {
  const manifest = JSON.parse(readFileSync(join(hymnsDir, 'manifest.json'), 'utf8'));
  const files = ['manifest.json'];
  for (const hymn of manifest.hymns) {
    for (const f of hymn.files) files.push(`${hymn.id}/${f}`);
  }
  files.sort();
  const hash = createHash('sha1');
  for (const rel of files) {
    hash.update(rel);
    hash.update('\n');
    hash.update(readFileSync(join(hymnsDir, rel)));
    hash.update('\n');
  }
  return { content_version: manifest.content_version, hash: hash.digest('hex') };
}

export function readRecorded() {
  if (!existsSync(fingerprintPath)) return null;
  return JSON.parse(readFileSync(fingerprintPath, 'utf8'));
}

function main() {
  const current = computeFingerprint();
  const recorded = readRecorded();
  if (
    recorded !== null &&
    recorded.hash !== current.hash &&
    recorded.content_version === current.content_version
  ) {
    console.error(
      `KONTEN hymns/ BERUBAH tapi content_version masih ${current.content_version}.\n` +
        'Naikkan content_version di public/hymns/manifest.json dulu (service worker\n' +
        'pengguna offline hanya refresh saat versi naik), lalu jalankan ulang.',
    );
    process.exit(1);
  }
  writeFileSync(fingerprintPath, JSON.stringify(current, null, 2) + '\n');
  console.log(`fingerprint dicatat: v${current.content_version} ${current.hash}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
