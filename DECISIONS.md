# DECISIONS.md — Buku Logu HKBP PWA

> Log keputusan HIDUP. Kalau file ini bentrok dengan SPEC.md, **file ini yang menang** (keputusan terbaru). Update tiap ada keputusan besar, lalu upload ulang ke Project Knowledge.

_Terakhir diupdate: 12 Juli 2026 (sinkron dengan SPEC v7)_

---

## ✅ Keputusan Terkunci (jangan diasumsikan ulang)

- **`CLAUDE.md` di root repo (cara kerja, dibuat saat setup skeleton):** ringkasan operasional keputusan terkunci (±100 baris) + pointer ke SPEC/DECISIONS/VISION untuk detail. Berfungsi sebagai **memori kerja hidup**: setiap koreksi dari Selvyna selama coding dicatat sebagai aturan baru di situ agar kesalahan tidak terulang antar-sesi. Koreksi teknis harian → CLAUDE.md; perubahan keputusan besar → tetap DECISIONS.md.
- **Scope Fase 0:** walking skeleton, TEPAT 5 lagu (dipertimbangkan potong ke 3, DIBATALKAN — tetap 5 supaya semua skenario stress-test tercover). Jangan overbuild untuk ratusan lagu.
- **Alur kerja PARALEL:** proses OMR + pembersihan lagu di Audiveris/MuseScore jalan bersamaan dengan coding, BUKAN berurutan. Lagu asli disuplai satu per satu begitu selesai; Claude Code mulai bangun & tes pipeline dari yang tersedia (dummy dulu, lalu lagu asli inkremental) — TIDAK menunggu kelima lagu selesai.
- **5 lagu pilot FINAL** (lihat tabel di bawah): Logu 110 (C), 730 (Db), 73 (Bb), 423 (Eb), 390 (A).
- **Transpose — enharmonic spelling (acceptance criteria):** transpose berbasis interval (huruf not + aksidental), BUKAN sekadar geser semitone. Ejaan not & key signature hasil transpose harus mengikuti konvensi nada dasar tujuan (mis. Db naik semitone → D mayor 2 kres, bukan campuran C#/Db); hindari double accidentals kecuali memang diwajibkan konteks; untuk key tujuan ber-pasangan enharmonis (C#/Db, F#/Gb, B/Cb) pilih signature yang lebih sederhana.
- **Tempo kerja:** TIDAK ada tekanan waktu. Prioritas = kedalaman, kerapian, dokumentasi, pengujian menyeluruh (standar aplikasi internasional) — BUKAN kecepatan, dan BUKAN izin melebarkan scope.
- **Format data:** terbuka & bebas vendor lock-in — MusicXML (notasi + lirik + alignment) + JSON/plain-text (metadata), sebagai file di disk. No SaaS berbayar, no DB proprietary.
- **Base layer:** notasi asli Buku Logu **+ lirik as-printed (semua bait)** = canonical, immutable, append-only.
- **Lirik:** SEMUA bait hyphenated-per-note dengan nomor bait, sesuai cetakan fisik (referensi: BL-73). Wajib sempurna di kelima lagu pilot. **Penyimpanan: di dalam MusicXML** via `<lyric number="n">` + `syllabic` + `extend`, dientry di MuseScore. `lyrics[]` di hymn.json = INDEKS/pointer (`underlay: "base"`), bukan penyimpan teks. Ende lain / terjemahan masa depan = file underlay eksternal (pola sama dengan arrangement layer).
- **Layout bait — Opsi C:** SATU renderer lirik dengan parameter `versesToShow`, dua preset mode: **Mode Ibadah (DEFAULT)** = semua bait tampil, nol interaksi selama lagu; **Mode Latihan** = bait aktif + chip selector + auto-advance saat playback. Mode HANYA mempengaruhi bait mana yang digambar (pagar anti scope-creep). Berlaku identik untuk renderer balok DAN not angka. Toggle dipilih sebelum lagu dimulai.
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
