# DECISIONS.md — Buku Logu HKBP PWA

> Log keputusan HIDUP. Kalau file ini bentrok dengan SPEC.md, **file ini yang menang** (keputusan terbaru). Update tiap ada keputusan besar, lalu upload ulang ke Project Knowledge.

_Terakhir diupdate: 17 Juli 2026 (klarifikasi fundamental dua-buku; menggantikan
sebagian pemahaman domain SPEC v7 — lihat errata di SPEC_v7.md)_

---

## ✅ Keputusan Terkunci (jangan diasumsikan ulang)

- **(17 Jul 2026) KLARIFIKASI FUNDAMENTAL — dua buku, dua notasi.** Di HKBP ada dua
  buku terpisah: **Buku Logu = notasi BALOK TANPA lirik**; **Buku Ende = NOT ANGKA
  DENGAN lirik**. Proyek ini = digitalisasi BUKU LOGU, dengan kemampuan TAMBAHAN
  not angka + lirik (mekanisme mengikuti contoh BL-73 — yang adalah re-typeset gaya
  Serpong, BUKAN cetakan asli Buku Logu). Konsekuensi terkunci:
  (a) renderer BALOK menampilkan **NOL lirik** — elemen `<lyric>` di-strip dari
  MusicXML sebelum Verovio (`stripLyrics` di `src/music/musicxml-transform.ts`);
  (b) lirik HANYA tampil di renderer not angka (semua bait, hyphenated-per-note);
  (c) Opsi C (`versesToShow`, Mode Ibadah/Latihan) HANYA berlaku untuk not angka;
  (d) PENYIMPANAN lirik di dalam base.musicxml TIDAK berubah — tetap single source
  of truth untuk not angka & lyric underlay masa depan.
  Ini menggantikan fitur #1 SPEC v7 ("render balok beserta lirik").
- **`CLAUDE.md` di root repo (cara kerja, dibuat saat setup skeleton):** ringkasan operasional keputusan terkunci (±100 baris) + pointer ke SPEC/DECISIONS/VISION untuk detail. Berfungsi sebagai **memori kerja hidup**: setiap koreksi dari Selvyna selama coding dicatat sebagai aturan baru di situ agar kesalahan tidak terulang antar-sesi. Koreksi teknis harian → CLAUDE.md; perubahan keputusan besar → tetap DECISIONS.md.
- **Scope Fase 0:** walking skeleton, TEPAT 5 lagu (dipertimbangkan potong ke 3, DIBATALKAN — tetap 5 supaya semua skenario stress-test tercover). Jangan overbuild untuk ratusan lagu.
- **Alur kerja PARALEL:** proses OMR + pembersihan lagu di Audiveris/MuseScore jalan bersamaan dengan coding, BUKAN berurutan. Lagu asli disuplai satu per satu begitu selesai; Claude Code mulai bangun & tes pipeline dari yang tersedia (dummy dulu, lalu lagu asli inkremental) — TIDAK menunggu kelima lagu selesai.
- **5 lagu pilot FINAL** (lihat tabel di bawah): Logu 110 (C), 730 (Db), 73 (Bb), 423 (Eb), 390 (A).
- **Transpose — enharmonic spelling (acceptance criteria):** transpose berbasis interval (huruf not + aksidental), BUKAN sekadar geser semitone. Ejaan not & key signature hasil transpose harus mengikuti konvensi nada dasar tujuan (mis. Db naik semitone → D mayor 2 kres, bukan campuran C#/Db); hindari double accidentals kecuali memang diwajibkan konteks; untuk key tujuan ber-pasangan enharmonis (C#/Db, F#/Gb, B/Cb) pilih signature yang lebih sederhana.
- **Tempo kerja:** TIDAK ada tekanan waktu. Prioritas = kedalaman, kerapian, dokumentasi, pengujian menyeluruh (standar aplikasi internasional) — BUKAN kecepatan, dan BUKAN izin melebarkan scope.
- **Format data:** terbuka & bebas vendor lock-in — MusicXML (notasi + lirik + alignment) + JSON/plain-text (metadata), sebagai file di disk. No SaaS berbayar, no DB proprietary.
- **Base layer:** notasi asli Buku Logu **+ lirik as-printed (semua bait)** = canonical, immutable, append-only.
- **Lirik:** SEMUA bait hyphenated-per-note dengan nomor bait, mekanisme mengikuti
  referensi BL-73 — **tampil HANYA di renderer not angka; balok nol lirik**
  (klarifikasi 17 Jul 2026). Wajib sempurna di kelima lagu pilot.
  **Penyimpanan: di dalam MusicXML** via `<lyric number="n">` + `syllabic` + `extend`,
  dientry di MuseScore. `lyrics[]` di hymn.json = INDEKS/pointer (`underlay: "base"`),
  bukan penyimpan teks. Ende lain / terjemahan masa depan = file underlay eksternal
  (pola sama dengan arrangement layer).
- **Layout bait — Opsi C:** SATU renderer lirik dengan parameter `versesToShow`, dua preset mode: **Mode Ibadah (DEFAULT)** = semua bait tampil, nol interaksi selama lagu; **Mode Latihan** = bait aktif + chip selector + auto-advance saat playback. Mode HANYA mempengaruhi bait mana yang digambar (pagar anti scope-creep). **Berlaku HANYA untuk renderer not angka** — balok tanpa lirik sama sekali (klarifikasi 17 Jul 2026). Toggle dipilih sebelum lagu dimulai.
- **Layered score model:** tiap hymn = 1 base layer + 0..n arrangement layers (MULTIPLE versi per hymn). Score Mode toggle: "Buku Logu Mode" vs "Full Score Mode" + version selector.
- **Editing arrangement:** di MuseScore 4 di luar app → export MusicXML → taruh file sesuai konvensi. App Fase 1 TIDAK punya notation editor built-in. Validator import otomatis = Fase 2.
- **Not angka:** **movable-do** (1 = do = nada dasar). Transpose: angka TIDAK berubah, hanya `Do = X` + balok yang berubah. Renderer custom (SVG/HTML) dari model internal — bukan verovio/OSMD.
- **Format SATB not angka:** 4 baris terpisah (S/A/T/B), titik oktaf sendiri. Converter SATB = converter single-melody 4× lalu tumpuk. Kolom akor condensed = fase nanti.
- **Arsitektur "otak" musik:** MusicXML → parser → **model JSON internal** → renderer/audio. Renderer & playback TIDAK bergantung pada internal library rendering.
- **Transpose:** on-the-fly di client dari model internal — BUKAN pre-generate file per key.
- **Audio:** synth real-time dari model internal (bukan file pre-render), abstraksi "instrument" (synth → sampled bisa diganti nanti). SATB = 4 track dengan mute/solo + tempo control (fitur inti Fase 1).
- **Fitur kecil Fase 1:** wake lock + tombol "nada awal" (pitch pertama tiap suara S→A→T→B).
- **Struktur folder:** folder-per-hymn `hymns/logu-NNN/` berisi `hymn.json`, `base.musicxml`, `arr/`, `lyrics/` (kosong dulu). **Penamaan: nomor logu zero-pad 3 digit** (`logu-005`, `logu-110`) supaya sorting alfabetis benar sampai 900 lagu. **File aransemen: slug lowercase-hyphen** `<instrumen>.<arranger>.<versi>.musicxml` (mis. `french-horn.selvyna.v1.musicxml`).
- **Routing:** URL stabil per hymn (`#/logu/110`) sejak Fase 1.
- **Hosting:** **GitHub Pages**.
- **Device tes:** iPad Safari **DAN** Android Chrome, keduanya sama penting — setiap checklist tes fitur wajib mencakup keduanya.
- **Model kontribusi jangka panjang:** Git-based, zero-backend — arranger submit via GitHub PR atau email → dikommit manual. Kredit arranger via metadata + riwayat Git. Kandidat CMS masa depan: Sveltia (utama) / Decap (alternatif) — lihat VISION.md, BUKAN Fase 1.
- **Sample untuk mulai:** dummy MusicXML dulu (single melody + multi-verse lyrics + melisma + anacrusis); Logu 110 asli menyusul.
- **Offline-first:** hard acceptance criteria; service worker precache **manifest-driven ber-versi** (bukan "cache semua").
- **PWA** dulu (bukan native), arsitektur gampang di-port ke Capacitor nanti.
- **Version control:** Git sejak awal + lisensi open-source untuk kode (kandidat MIT/Apache-2.0); konten notasi/lirik dipisah eksplisit dari lisensi kode.
- **(17 Jul 2026) Bahasa:** konten lirik HANYA Batak (sesuai buku asli); TIDAK ada
  infrastruktur multi-bahasa UI sekarang. Field `language` di skema hymn.json tetap
  sebagai pintu masa depan, tidak dipakai aktif.
- **(17 Jul 2026) Prioritas Fase 2 dinaikkan:** setlist via URL + export/print PDF —
  kebutuhan nyata dirigen (share daftar lagu ke tim musik) & jemaat tanpa perangkat.
  Tetap BUKAN Fase 1. Detail di VISION.md.
- **(17 Jul 2026) Pass desain UI (Batch A):** (a) **Not Angka = view default & posisi
  pertama** — nomor Buku Ende yang diumumkan gereja, cipher primer bagi jemaat;
  pilihan view terakhir diingat per perangkat (localStorage); (b) **tema dari logo
  resmi HKBP** — navy #031e66 di-sample dari logo (izin pemakaian dikonfirmasi);
  logo HANYA di masthead daftar lagu + ikon PWA, TIDAK di halaman hymn; notasi tetap
  hitam-di-kertas; (c) **composer/composer_year** di hymn.json (nullable), tampil
  kecil di bawah judul ("Lagu: X, YYYY"); (d) **nomor birama di awal tiap sistem**
  kedua renderer (Verovio bawaan; renderer cipher menggambar sendiri, sistem pertama
  dilewati). Aset dari scripts/generate-icons.ps1 (helper Windows, output di-commit).
- **(18 Jul 2026) Tanda dinamika (Batch B):** model internal punya `Direction`
  (dynamic/wedge/words, level sistem — dibaca dari part pertama) + `articulations`
  per not; parser memvalidasi (UNKNOWN_DYNAMIC/UNKNOWN_ARTICULATION/WEDGE_UNPAIRED);
  balok dirender native Verovio (terverifikasi), not angka lewat band dinamika di
  atas baris angka (hairpin digambar manual, wedge lintas sistem digambar terbuka).
  Playback velocity BELUM (tampilan dulu — dicatat, menyusul). Acceptance criteria
  verifikasi Logu 110 bertambah: tanda dinamika cocok dengan cetakan.
- **(18 Jul 2026) Aksesibilitas (Batch D):** panel "Aa" di header — ukuran teks
  4 tingkat (UI via rem root, notasi via parameter renderer → RE-LAYOUT penuh,
  bukan zoom) + tema Terang/Gelap/Kontras (design token CSS). Prinsip: **area
  notasi selalu "kertas" terang di semua tema** (keterbacaan partitur menang,
  pola app partitur profesional). Persisten per perangkat (localStorage).
- **(18 Jul 2026) Toggle lirik balok (Batch C):** default TANPA lirik (Buku Logu
  asli); checkbox "Tampilkan lirik (semua bait)" untuk latihan — binary
  show/hide, tanpa granularitas per-bait; render dari MusicXML utuh via Verovio.
- **(17 Jul 2026) Identitas aplikasi:** yang dilihat user berpusat ke HKBP & Buku
  Logu ("ini buku nyanyian gerejaku"), BUKAN ke pembuat. Kisah personal Selvyna =
  konteks di balik layar (README/VISION/halaman Tentang opsional nanti); kredit
  tetap halus sesuai keputusan sebelumnya (footer, README, metadata).

---

## ❓ Pertanyaan Terbuka / Pending (dengan status)

- [x] **Tech stack** — SELESAI 13 Jul 2026, lihat "Tech Stack Final" di bawah.
- [ ] **Konvensi minor keys** (`Do = X` vs `La = X`) → kuverifikasi ke cetakan fisik; GERBANG hanya untuk converter lagu minor.
- [ ] **Foto BL-73** → BELUM terkirim (baru dideskripsikan verbal; foto yang ada: Logu 110 & Logu 81). Kirim ke sesi Claude Code saat lyric renderer not angka mulai dikerjakan.
- [ ] **Konvensi lirik di SATB not angka** (penempatan di format 4 baris) → Fable 5 tanya saat sampai di sana; cetakan fisik jadi acuan.
- [ ] **Status hak cipta HKBP** — 3 lapis; izin tertulis HKBP pusat sebelum disebar. → urusanku, non-teknis.
- [ ] **Co-contributor** — cari 1–2 orang HKBP (musik/IT) untuk kelangsungan (risiko utama = kontinuitas manusia, bukan teknis).

---

## 🎵 5 Lagu Pilot — FINAL ✅

Status semua: dalam proses OMR/pembersihan di Audiveris/MuseScore (belum ada yang 100% selesai; Logu 110 paling dekat kelar). Disuplai satu per satu, paralel dengan coding.

1. **Logu No. 110 "Hupuji holong ni"** — nada dasar **C** — paling sering dipakai ibadah; juga ground truth cetak untuk verifikasi not angka. _(paling dekat selesai)_
2. **Logu No. 730** — nada dasar **Db (5 mol)** — stress-test transpose, paling ekstrim di set.
3. **Logu No. 73 "Ndang Tadingkononku Ho" (BL-73)** — nada dasar **Bb** — SATB lengkap 4 suara; double-purpose: fotonya = referensi visual format lirik hyphenated-per-note (foto BELUM terkirim, lihat pending).
4. **Logu No. 423** — nada dasar **Eb** — ritme/struktur bait kompleks.
5. **Logu No. 390** — nada dasar **A** — pilihan pribadi.

Cakupan nada dasar: C, Db, Bb, Eb, A. Catatan: set condong ke sisi mol (maks. kres = 3, di Logu 390); pengujian transpose wajib menyertakan key TUJUAN ber-kres banyak (mis. ke E atau B) supaya sisi kres ikut ter-stress-test.

---

## 🧱 Tech Stack Final ✅ (disetujui 13 Juli 2026)

- Rendering balok: **Verovio** (WASM, lazy-load; dipilih atas OSMD karena kualitas
  engraving + `xml:id` per elemen + transpose bawaan sebagai test oracle; filter bait
  di KEDUA library tidak ada → solusi: XML transform sebelum render, disetujui). Wrapper
  di `src/lib/verovio.ts`; input MusicXML, swap ke OSMD murah kalau kepepet.
- Logika musik: **TypeScript custom + tonal.js** (interval math/enharmonic spelling);
  parser MusicXML sendiri, client-side murni, tanpa music21.
- Audio playback: **Tone.js** di belakang abstraksi "instrument" milik proyek.
- Framework frontend: **Svelte 5 (runes) + Vite + TypeScript**; test **Vitest**
  (+ jsdom untuk test parser). Catatan: TypeScript dipin ke 5.x (TS 7 belum
  kompatibel svelte-check).
- PWA: **vite-plugin-pwa mode injectManifest** — SW kode sendiri (`src/sw.ts`).
- Hosting: **GitHub Pages** ✅
- Device tes: **iPad Safari + Android Chrome** ✅
