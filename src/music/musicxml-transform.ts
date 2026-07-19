// Transform MusicXML → MusicXML — jembatan otak musik → Verovio.
//
// Prinsip 4 SPEC: Verovio hanya pernah menerima MusicXML (format terbuka);
// semua penyesuaian tampilan dilakukan sebagai transformasi XML di sini,
// digerakkan keputusan model/aplikasi.

import type { Step } from './model';
import {
  fifthsForTonic,
  intervalBetweenTonics,
  tonicForKey,
  transposePitchDisplay,
} from './transpose';

/**
 * Buang SEMUA elemen <lyric> dari MusicXML.
 *
 * Klarifikasi fundamental 17 Jul 2026 (lihat DECISIONS.md): Buku Logu asli
 * berisi notasi balok TANPA lirik — lirik + not angka datang dari Buku Ende.
 * Maka renderer balok menampilkan NOL lirik; elemen <lyric> di-strip sebelum
 * MusicXML diserahkan ke Verovio. Penyimpanan lirik di base.musicxml TIDAK
 * berubah (single source of truth untuk not angka & underlay masa depan).
 */
export function stripLyrics(xml: string): string {
  const doc = parseXml(xml, 'stripLyrics');
  for (const lyric of Array.from(doc.getElementsByTagName('lyric'))) {
    lyric.parentNode?.removeChild(lyric);
  }
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Transpose MusicXML ke nada dasar tujuan — rewrite <pitch> + <key> memakai
 * FUNGSI ENGINE YANG SAMA dengan jalur model internal, sehingga kedua jalur
 * dijamin menghasilkan spelling identik (diuji ekuivalensinya di test).
 *
 * Elemen <accidental> (display) DIBUANG: setelah respell semuanya basi;
 * Verovio menurunkan aksidental tampilan ulang dari key + alter. Konsekuensi
 * sadar: courtesy accidental cetakan tidak ikut di versi transpose.
 */
export function transposeMusicXml(xml: string, targetTonic: string): string {
  const doc = parseXml(xml, 'transposeMusicXml');

  const keyEls = Array.from(doc.getElementsByTagName('key'));
  const firstFifths = keyEls[0]?.getElementsByTagName('fifths')[0]?.textContent?.trim();
  const fifths = Number(firstFifths);
  if (firstFifths === undefined || !Number.isInteger(fifths)) {
    throw new Error('transposeMusicXml: <key><fifths> tidak ditemukan.');
  }
  const modeText = keyEls[0]?.getElementsByTagName('mode')[0]?.textContent?.trim();
  const mode = modeText === 'minor' ? 'minor' : 'major';

  const sourceTonic = tonicForKey({ fifths, mode });
  if (sourceTonic === targetTonic) return xml;
  const interval = intervalBetweenTonics(sourceTonic, targetTonic);

  for (const pitchEl of Array.from(doc.getElementsByTagName('pitch'))) {
    const stepEl = pitchEl.getElementsByTagName('step')[0];
    const octaveEl = pitchEl.getElementsByTagName('octave')[0];
    let alterEl: Element | undefined = pitchEl.getElementsByTagName('alter')[0];
    if (!stepEl?.textContent || !octaveEl?.textContent) {
      throw new Error('transposeMusicXml: <pitch> tanpa step/octave.');
    }
    const out = transposePitchDisplay(
      {
        step: stepEl.textContent.trim() as Step,
        alter: alterEl?.textContent ? Number(alterEl.textContent.trim()) : 0,
        octave: Number(octaveEl.textContent.trim()),
      },
      interval,
    );
    stepEl.textContent = out.step;
    octaveEl.textContent = String(out.octave);
    if (out.alter === 0) {
      alterEl?.parentNode?.removeChild(alterEl);
    } else {
      if (!alterEl) {
        alterEl = doc.createElement('alter');
        pitchEl.insertBefore(alterEl, octaveEl); // urutan MusicXML: step, alter, octave
      }
      alterEl.textContent = String(out.alter);
    }
  }

  const newFifths = String(fifthsForTonic(targetTonic, mode));
  for (const keyEl of keyEls) {
    const f = keyEl.getElementsByTagName('fifths')[0];
    if (f) f.textContent = newFifths;
  }

  for (const acc of Array.from(doc.getElementsByTagName('accidental'))) {
    acc.parentNode?.removeChild(acc);
  }

  return new XMLSerializer().serializeToString(doc);
}

function parseXml(xml: string, context: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error(`${context}: input bukan XML yang valid.`);
  }
  return doc;
}
