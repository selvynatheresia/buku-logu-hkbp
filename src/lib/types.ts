// Skema data proyek (hymns/manifest.json + hymns/<id>/hymn.json).
// Field-field ini bagian dari kontrak SPEC <struktur_data> — field wajib
// TIDAK boleh dihapus walau sebagian kosong di Fase 1 (membuka pintu Fase 2).

/** hymns/manifest.json — daftar semua hymn + versi konten, dasar precache offline. */
export interface HymnsManifest {
  schema_version: number;
  /**
   * Naik setiap ada perubahan konten hymn apa pun.
   * Service worker membandingkan versi ini untuk refresh cache konten.
   */
  content_version: number;
  hymns: HymnManifestEntry[];
}

export interface HymnManifestEntry {
  /** Konvensi TERKUNCI: zero-pad 3 digit, mis. "logu-005", "logu-110". */
  id: string;
  logu_no: number;
  title: string;
  /** Versi per-hymn — pintu untuk selective download saat ratusan lagu. */
  version: number;
  /** Daftar file relatif terhadap hymns/<id>/ yang harus di-cache. */
  files: string[];
}

/** hymns/<id>/hymn.json — metadata satu hymn. */
export interface HymnMeta {
  id: string;
  logu_no: number;
  title: string;
  /** Pencipta lagu, sesuai cetakan ("Johann Anastasius Frelinghausen"); null = belum ada data. */
  composer: string | null;
  /** Tahun karya sesuai cetakan; null = tidak dicantumkan. */
  composer_year: number | null;
  /** INDEKS lirik, bukan penyimpan teks — teks + alignment hidup di MusicXML. */
  lyrics: LyricsIndexEntry[];
  categories: string[];
  themes: string[];
  scripture_refs: string[];
  base: {
    file: string;
    license: string;
    source_note: string;
  };
  arrangements: ArrangementEntry[];
}

export interface LyricsIndexEntry {
  /** Nomor Buku Ende; null untuk konten non-ende (mis. dummy). */
  ende_no: number | null;
  /** Kode bahasa ISO 639: "bat" (Batak Toba), "id", "en". */
  language: string;
  title: string;
  /**
   * "base" = bait-bait tersimpan di base.musicxml (<lyric number="n">).
   * Masa depan: path file eksternal di lyrics/ (pola sama dengan arrangement).
   */
  underlay: string;
  verses_count: number;
}

export interface ArrangementEntry {
  /** Konvensi TERKUNCI: "arr/<instrumen>.<arranger>.<versi>.musicxml", semua slug. */
  file: string;
  label: string;
  arranger: string;
  instrumentation: string[];
  license: string;
}
