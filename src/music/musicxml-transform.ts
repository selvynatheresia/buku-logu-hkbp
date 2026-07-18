// Transform MusicXML → MusicXML — jembatan otak musik → Verovio.
//
// Prinsip 4 SPEC: Verovio hanya pernah menerima MusicXML (format terbuka);
// semua penyesuaian tampilan dilakukan sebagai transformasi XML di sini,
// digerakkan keputusan model/aplikasi. Transform transpose (rewrite pitch+key)
// akan tinggal di file ini juga nanti.

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
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('stripLyrics: input bukan XML yang valid.');
  }
  for (const lyric of Array.from(doc.getElementsByTagName('lyric'))) {
    lyric.parentNode?.removeChild(lyric);
  }
  return new XMLSerializer().serializeToString(doc);
}
