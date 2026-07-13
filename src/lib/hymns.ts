import type { HymnsManifest, HymnMeta } from './types';

/**
 * Nomor logu → id folder, zero-pad 3 digit (konvensi TERKUNCI di SPEC):
 * 5 → "logu-005", 110 → "logu-110". Zero-pad menjamin sorting alfabetis
 * benar sampai 900 lagu.
 */
export function loguId(no: number): string {
  if (!Number.isInteger(no) || no < 0 || no > 999) {
    throw new Error(`Nomor logu di luar jangkauan 0–999: ${no}`);
  }
  return `logu-${String(no).padStart(3, '0')}`;
}

// Path relatif (tanpa leading slash) supaya resolve benar di GitHub Pages
// project site; dengan hash-routing, URL dokumen tidak pernah berubah.
const HYMNS_BASE = 'hymns';

export async function fetchManifest(): Promise<HymnsManifest> {
  const res = await fetch(`${HYMNS_BASE}/manifest.json`);
  if (!res.ok) throw new Error(`Gagal memuat daftar lagu (HTTP ${res.status})`);
  return res.json();
}

export async function fetchHymnMeta(id: string): Promise<HymnMeta> {
  const res = await fetch(`${HYMNS_BASE}/${id}/hymn.json`);
  if (!res.ok) throw new Error(`Gagal memuat metadata ${id} (HTTP ${res.status})`);
  return res.json();
}

/** Ambil isi file milik satu hymn sebagai teks (MusicXML dsb.). */
export async function fetchHymnText(id: string, file: string): Promise<string> {
  const res = await fetch(`${HYMNS_BASE}/${id}/${file}`);
  if (!res.ok) throw new Error(`Gagal memuat ${id}/${file} (HTTP ${res.status})`);
  return res.text();
}
