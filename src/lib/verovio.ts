// Wrapper lazy-load Verovio.
//
// Kenapa lazy: chunk verovio ~7 MB (WASM ter-embed base64). Kalau di-import
// statis, bundle utama ikut bengkak dan halaman pertama lambat. Dengan dynamic
// import, chunk hanya diunduh saat halaman hymn pertama kali dibuka — lalu
// service worker mem-precache-nya untuk offline.
//
// Kenapa wrapper: Prinsip 4 SPEC — library rendering harus bisa diganti tanpa
// menyentuh otak musik. Seluruh kontak dengan Verovio lewat modul ini saja;
// input-nya MusicXML (format terbuka), bukan model internal kita.

import type { VerovioToolkit } from 'verovio/esm';

let toolkitPromise: Promise<VerovioToolkit> | null = null;

/** Toolkit Verovio singleton (inisialisasi WASM cuma sekali per sesi). */
export async function getVerovio(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([
        import('verovio/wasm'),
        import('verovio/esm'),
      ]);
      const module = await createVerovioModule();
      return new VerovioToolkit(module);
    })();
  }
  return toolkitPromise;
}

export interface RenderOptions {
  /** Lebar kontainer dalam px CSS; layout Verovio menyesuaikan lebar ini. */
  pageWidthPx?: number;
}

/**
 * Render MusicXML → satu SVG "halaman menerus" (tinggi menyesuaikan isi),
 * cocok untuk viewport scroll di tablet/HP — bukan paginasi cetak.
 */
export async function renderMusicXmlToSvg(
  xml: string,
  { pageWidthPx = 800 }: RenderOptions = {},
): Promise<string> {
  const tk = await getVerovio();
  const scale = 40; // persen dari ukuran engraving penuh

  tk.setOptions({
    scale,
    // Unit internal Verovio ~1/10 mm pada scale 100; konversi px → unit
    // memakai rumus resmi dari dokumentasi: px * 100 / scale.
    // Clamp ke rentang sah Verovio (100..100000) — nilai di luar itu ditolak
    // dan Verovio diam-diam jatuh ke default.
    pageWidth: Math.min(100000, Math.max(100, Math.round((pageWidthPx * 100) / scale))),
    // pageHeight maksimum + adjustPageHeight = semua sistem masuk 1 "halaman"
    // yang dipotong pas tinggi isinya → SVG tunggal menerus.
    pageHeight: 60000,
    adjustPageHeight: true,
    breaks: 'auto',
    svgViewBox: true, // SVG responsif: skala ikut lebar kontainer via CSS
    header: 'none', // judul dirender UI app, bukan engraving
    footer: 'none',
  });

  if (!tk.loadData(xml)) {
    throw new Error('Verovio gagal memuat MusicXML — kemungkinan file tidak valid.');
  }
  return tk.renderToSVG(1);
}
