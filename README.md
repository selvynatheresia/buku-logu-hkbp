# Buku Logu HKBP — Digital

Digitalisasi **Buku Logu HKBP** (tune book gereja HKBP, ±900 lagu) menjadi PWA musik
modern untuk iPad/tablet/HP: notasi balok, not angka (movable-do), lirik semua bait,
transpose, playback SATB — **offline-first**, untuk dipakai live saat ibadah.

**Status: Fase 0 — walking skeleton (5 lagu pilot).** Seluruh pipeline dibuktikan pada
5 lagu dulu sebelum scale ke ratusan. Lihat [SPEC_v7.md](SPEC_v7.md) (spesifikasi),
[DECISIONS.md](DECISIONS.md) (log keputusan — sumber kebenaran terbaru), dan
[VISION.md](VISION.md) (arah jangka panjang).

## Arsitektur

```
base.musicxml ──► parser (TS) ──► MODEL INTERNAL (JSON)
                                      │
                   ┌──────────────────┼──────────────────────┐
                   ▼                  ▼                       ▼
            transpose engine   renderer not angka       audio engine
             (TS + tonal.js)    + lirik (custom SVG)      (Tone.js)
                   │
                   ▼
      MusicXML transform (strip lirik; pitch+key saat transpose)
                   │
                   ▼
               Verovio ──► SVG notasi balok (tanpa lirik, seperti buku asli)
```

Prinsip kunci: **model musik internal sebagai perantara** — Verovio (rendering balok)
hanya menerima MusicXML (format terbuka), tidak pernah model internal; otak musik tidak
pernah menyentuh internal Verovio. Keduanya bisa diganti tanpa merombak yang lain.

- Data hymn: `public/hymns/logu-NNN/` (folder-per-hymn: `hymn.json`, `base.musicxml`,
  `arr/`, `lyrics/`) + `public/hymns/manifest.json` ber-versi untuk precache offline.
- `hymns/logu-000/` = **dummy** untuk uji pipeline (anacrusis, melisma, tie, fermata,
  3 bait) — bukan lagu Buku Logu.

## Development

```bash
npm install
npm run dev      # dev server
npm test         # unit test (Vitest)
npm run check    # svelte-check / typecheck
npm run build    # build produksi (termasuk service worker PWA)
npm run preview  # serve hasil build — pakai ini untuk tes offline/PWA
```

Target device tes: **iPad Safari dan Android Chrome** (keduanya wajib), termasuk
airplane-mode test setelah load pertama.

## Kredit

Dibuat dan dirawat oleh **Selvyna Theresia Sibarani** — personal project yang
dimaksudkan sebagai legacy jangka panjang untuk komunitas HKBP.

## Lisensi

- **Kode: [MIT](LICENSE).**
- **Konten musik & lirik TIDAK ikut lisensi kode.** Notasi Buku Logu, teks ende, dan
  harmonisasi SATB berpotensi memiliki hak cipta tersendiri (HKBP / penyusun); status
  izin sedang diurus terpisah dan dicatat per-file lewat field `license` di `hymn.json`.
  File dummy `logu-000` = CC0.
- Dependency [Verovio](https://www.verovio.org) berlisensi LGPL-3.0 — dipakai sebagai
  library tanpa modifikasi.
