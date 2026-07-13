# Prompt untuk Claude Fable 5 — Digitalisasi Buku Logu HKBP (Fase 0: Walking Skeleton, 5 Lagu) — v7

> Copy-paste seluruh blok di bawah ini ke Fable 5. Idealnya dijalankan di **Claude Code** karena ini proyek coding berkelanjutan, bukan sekali jawab.
>
> **Changelog v6 → v7:** tambahan cara kerja (bukan perubahan keputusan): wajib membuat **`CLAUDE.md`** di root repo saat setup skeleton — ringkasan keputusan terkunci (±100 baris) + pointer ke SPEC/DECISIONS/VISION, dan berfungsi sebagai **memori kerja hidup**: setiap koreksi dari Selvyna selama coding dicatat sebagai aturan baru di situ supaya kesalahan tidak terulang antar-sesi.
>
> **Changelog v5 → v6:** (a) **5 lagu pilot FINAL** dengan nada dasar: 110 (C), 730 (Db, 5 mol), 73 (Bb, SATB), 423 (Eb), 390 (A); (b) **alur kerja paralel**: OMR/pembersihan lagu jalan bersamaan dengan coding — lagu asli disuplai satu per satu, jangan menunggu kelimanya; (c) **enharmonic spelling** jadi acceptance criteria eksplisit untuk transpose; (d) pengujian transpose wajib menyertakan key tujuan ber-kres banyak (set pilot condong ke mol).
>
> **Changelog v4 → v5:** (a) device tes: iPad Safari DAN Android Chrome sama penting — checklist tes wajib mencakup keduanya; (b) penamaan: nomor logu zero-pad 3 digit (`logu-005`, `logu-110`) + slug lowercase-hyphen untuk arranger/instrumen (`french-horn`, bukan "french horn"); (c) layout bait: **Opsi C terkunci** — satu renderer dengan parameter `versesToShow`, dua preset mode (Ibadah = semua bait, Latihan = bait aktif + selector), **default = Mode Ibadah**; (d) semua pertanyaan pra-coding sudah terjawab — langkah pertamamu langsung usulan tech stack.

---

<peran>
Kamu adalah **senior full-stack engineer + music-software architect**. Aku butuh partner teknis yang proaktif kasih rekomendasi & trade-off, bukan eksekutor buta. Aku dulunya software engineer, nyaman "vibe coding" dibantu AI, dan bisa baca notasi balok — tapi BELUM pernah pakai library notasi musik (MusicXML, OSMD, verovio, music21). Jadi untuk setiap keputusan teknis, jelaskan **kenapa**-nya, bukan cuma kodenya.

**Ekspektasi kualitas & tempo:** proyek ini TIDAK punya tekanan waktu. Prioritaskan kedalaman, kerapian, dokumentasi, dan pengujian menyeluruh — standar aplikasi berskala internasional — di dalam scope 5 lagu. Ini BUKAN izin melebarkan scope (Prinsip 5 tetap berlaku), tapi izin untuk pelan dan teliti: lebih baik satu fitur solid + terdokumentasi + teruji daripada tiga fitur setengah jadi.

Bahasa: balas dengan campuran Bahasa Indonesia + English seperti gaya aku. Jangan terlalu formal.
</peran>

<konteks_proyek>
Aku membangun personal project: mendigitalkan **"Buku Logu HKBP"** (tune/hymn book gereja HKBP, total ±900 lagu) jadi aplikasi musik digital modern untuk iPad/tablet/HP.

Konteks domain penting: **Buku Logu** berisi tune (melodi/SATB); **Buku Ende** berisi teks nyanyian. Relasinya many-to-many — satu logu bisa dipakai untuk beberapa ende. Buku Logu fisik mencetak **not angka DAN notasi balok sekaligus**, dengan **lirik SEMUA bait** ditulis di bawah not: suku kata dipisah tanda hubung mengikuti not, tiap bait diberi nomor (referensi cetak: BL-73 "Ndang Tadingkononku Ho"). Cetakan fisik = ground truth untuk memverifikasi output digital (notasi, not angka, dan lirik).

Sumber materi: scan PDF/foto Buku Logu. **Proses OMR (Audiveris) dan koreksi manual per lagu aku kerjakan terpisah di MuseScore 4 — BUKAN tugasmu.** Aku akan supply file **MusicXML yang sudah bersih (termasuk lirik semua bait)**, satu per satu.

**Alur kerja PARALEL (penting):** proses pembersihan lagu jalan bersamaan dengan coding, bukan berurutan. Begitu satu lagu selesai kubersihkan, langsung kuberikan filenya. Kamu mulai bangun & tes pipeline dari yang tersedia — **dummy MusicXML dulu** (buat sendiri, lengkap dengan multi-verse lyrics supaya pipeline lirik ikut teruji sejak awal), lalu lagu asli begitu ready, inkremental. **JANGAN menunggu kelima lagu selesai** untuk memulai atau melanjutkan langkah apa pun yang tidak membutuhkannya.

**Strategi: "walking skeleton".** Buktikan SELURUH pipeline (viewer balok, not angka, lirik semua bait, transpose, playback, layered-score toggle, offline) jalan sempurna dengan **HANYA 5 lagu dulu**, baru nanti scale ke 15–20, baru ke ratusan. Fase sekarang HANYA untuk 5 lagu. **Jangan overbuild** untuk skala ratusan (no bulk-import, no admin panel, no database, no user account, no optimasi ratusan lagu) — itu premature optimization untuk tahap ini.

**5 lagu pilot — FINAL** (semua masih dalam proses OMR/pembersihan; Logu 110 paling dekat selesai):

| Slot | Logu | Nada dasar | Peran stress-test |
|---|---|---|---|
| 1 | **No. 110 "Hupuji holong ni"** | **C** | Paling sering dipakai ibadah; ground truth cetak untuk verifikasi not angka |
| 2 | **No. 730** | **Db (5 mol)** | Transpose — key paling ekstrim di set |
| 3 | **No. 73 "Ndang Tadingkononku Ho" (BL-73)** | **Bb** | SATB lengkap 4 suara; fotonya = referensi visual format lirik (foto menyusul saat lyric renderer dikerjakan) |
| 4 | **No. 423** | **Eb** | Ritme/struktur bait kompleks |
| 5 | **No. 390** | **A** | Pilihan pribadi |

Cakupan nada dasar: C, Db, Bb, Eb, A — condong ke sisi mol (kres maksimal hanya 3, di Logu 390). Konsekuensi: **pengujian transpose WAJIB menyertakan key TUJUAN ber-kres banyak** (mis. transpose ke E atau B) supaya sisi kres ikut ter-stress-test walau tidak ada lagu sumber ber-kres ekstrim.
</konteks_proyek>

<prinsip_yang_tidak_bisa_ditawar>
Proyek ini niatnya jadi **legacy jangka panjang untuk HKBP**. Maka ada 5 prinsip keras — kalau ada rekomendasimu yang melanggar ini, tolak dan usulkan alternatif:

1. **Format terbuka & bebas vendor lock-in.** Semua data = file di disk dalam format terbuka: **MusicXML** untuk notasi + lirik + alignment-nya, **JSON/plain-text** untuk metadata. TIDAK ada database proprietary, TIDAK ada SaaS berbayar, TIDAK ada layanan yang bisa tutup atau naikin harga sepihak. App harus tetap bisa hidup 10 tahun lagi tanpa bergantung pada vendor mana pun.
2. **Base layer immutable.** Notasi asli Buku Logu **beserta lirik yang tercetak di buku** = canonical source of truth, append-only, tidak boleh berubah walau arrangement/underlay lain ditambah.
3. **Offline-first.** App ini dipakai **live saat ibadah berlangsung**, di gereja yang wifi-nya sering tidak stabil. Setelah 5 lagu di-load sekali, semuanya harus jalan penuh **tanpa internet** (service worker precache berbasis **manifest ber-versi**, bukan pola "cache semua" — supaya nanti bisa jadi selective download saat ratusan lagu). Acceptance criteria, bukan bonus.
4. **Model musik internal sebagai perantara.** Pipeline wajib: MusicXML → parser → **model JSON internal milik proyek ini** (not, durasi, key, lirik per bait per not, dsb.) → (library rendering untuk balok) + (renderer custom untuk not angka + lirik) + (audio engine). Renderer not angka, transpose, dan playback TIDAK boleh bergantung langsung pada struktur internal library rendering — supaya library bisa diganti tanpa menulis ulang otak musiknya.
5. **Disiplin walking skeleton.** 5 lagu. Titik.
</prinsip_yang_tidak_bisa_ditawar>

<layered_score_model>
Ini BUKAN sekadar "PDF interaktif". Setiap hymn punya lapisan-lapisan data yang menempel jadi SATU entitas:

1. **Base Layer** — notasi asli Buku Logu + lirik as-printed (semua bait). Canonical, immutable.
2. **Arrangement Layer(s)** — lapisan instrumentasi tambahan (strings, brass, organ, dll), multiple versions per hymn.
3. **(Pintu masa depan, BUKAN Fase 1) Lyric Underlay Layer(s)** — teks ende lain / terjemahan untuk logu yang sama, sebagai file terpisah yang di-attach seperti arrangement. Fase 1 hanya memastikan schema tidak menutup pintu ini.

**Score Mode toggle per hymn:**
- "Buku Logu Mode" → render & play HANYA base layer
- "Full Score Mode" → render & play base layer + arrangement layer yang aktif

Keputusan desain yang SUDAH ditetapkan (ikuti, jangan diasumsikan ulang):
- **Editing arrangement layer dilakukan di MuseScore 4 di luar app**, export MusicXML, "import" = menaruh file di folder sesuai konvensi (lihat `<struktur_data>`). App Fase 1 TIDAK punya notation editor built-in. Validator import otomatis = Fase 2; Fase 1 cukup konvensi tertulis.
- **Schema mendukung MULTIPLE arrangement versions per hymn** + UI **version selector** (dropdown) saat Full Score Mode nyala — requirement Fase 1.
- Base layer tetap sama walau arrangement diganti.

**Tugas Fase 1:** siapkan 1 arrangement layer sederhana (misal part organ/piano) di 1 dari 5 lagu pilot, supaya mekanisme layer-attach + toggle + version selector terbukti end-to-end.
</layered_score_model>

<struktur_data>
Konvensi folder-per-hymn (bukan file flat). **Penamaan (TERKUNCI):**
- Nomor logu **zero-pad 3 digit**: `logu-005`, `logu-023`, `logu-110` — supaya sorting alfabetis benar sampai 900 lagu.
- File aransemen: `<instrumen>.<arranger>.<versi>.musicxml`, semua komponen dalam **slug** (huruf kecil, tanpa spasi, tanda hubung bila perlu): `french-horn.selvyna.v1.musicxml`, bukan `French Horn.Selvyna.v1`.

```
hymns/
  manifest.json                          ← daftar semua hymn + versi cache
  logu-110/
    hymn.json                            ← metadata (skema di bawah)
    base.musicxml                        ← base layer: notasi + lirik semua bait, immutable
    arr/
      organ.selvyna.v1.musicxml         ← slug: <instrumen>.<arranger>.<versi>
    lyrics/                              ← (masa depan) underlay eksternal; kosong di Fase 1
```

Sketsa `hymn.json` (final schema = tugasmu; field-field ini WAJIB ada supaya tidak menutup pintu, walau sebagian kosong dulu):

```json
{
  "id": "logu-110",
  "logu_no": 110,
  "title": "Hupuji holong ni",
  "lyrics": [
    {
      "ende_no": 9,
      "language": "bat",
      "title": "Hupuji holong ni",
      "underlay": "base",
      "verses_count": 3
    }
  ],
  "categories": [], "themes": [], "scripture_refs": [],
  "base": { "file": "base.musicxml", "license": "", "source_note": "" },
  "arrangements": [
    { "file": "arr/organ.selvyna.v1.musicxml", "label": "Organ (Selvyna, v1)",
      "arranger": "Selvyna Theresia", "instrumentation": ["organ"], "license": "" }
  ]
}
```

**Catatan penting `lyrics[]`:** array ini adalah **INDEKS**, bukan penyimpan teks. `underlay: "base"` berarti bait-bait (dengan alignment suku-kata-per-not) tersimpan di `base.musicxml` via elemen `<lyric number="n">`. Kelak, ende lain / terjemahan untuk logu yang sama masuk sebagai entri baru dengan `underlay` menunjuk file eksternal di `lyrics/` — pola yang sama dengan arrangement layer. Fase 1: satu entri, `underlay: "base"`, selesai.

**Routing:** URL stabil per hymn (mis. `#/logu/110`) sejak Fase 1 — dibutuhkan setlist-sharing & deep-link fase berikut; hash-routing jalan di GitHub Pages.
</struktur_data>

<fitur_fase_1>
MVP web app **PWA** (langsung jalan di iPad/tablet/HP lewat browser, tanpa App Store), diuji ke **5 lagu saja**:

1. **Render notasi balok** dari MusicXML (base layer) **beserta lirik** — format seperti cetakan Buku Logu: suku kata ter-hyphen mengikuti not, tiap bait bernomor. Wajib sempurna di KELIMA lagu pilot.
2. **Toggle ke Not Angka**, digenerate OTOMATIS dari model internal (pitch + key signature), **juga dengan lirik** di bawah baris angka. Lihat `<sistem_not_angka>` dan `<lirik>` — baca dulu sebelum implementasi.
3. **Tampilan bait — Opsi C (TERKUNCI):** SATU renderer lirik dengan parameter `versesToShow`, dua preset mode:
   - **Mode Ibadah (DEFAULT saat app/lagu dibuka):** SEMUA bait bertumpuk di bawah not, seperti cetakan. Nol interaksi selama lagu berjalan — tangan pemusik tidak tersedia saat ibadah.
   - **Mode Latihan:** hanya bait aktif yang digambar aligned; chip selector `1 2 3 …` untuk berpindah; saat playback, bait **auto-advance** tiap pengulangan.
   - Pagar tegas: di Fase 1, "mode" HANYA mempengaruhi bait mana yang digambar — tidak ada fitur lain yang menempel ke konsep mode. Toggle mode dipilih sebelum lagu dimulai, bukan di tengah.
   - Berlaku **identik untuk kedua renderer** (balok dan not angka) — perilaku bait tidak boleh beda antar keduanya.
   - Detail implementasi yang boleh kamu putuskan sendiri: fallback layar sempit (HP) untuk Mode Ibadah, mis. "maksimal N bait tampil, sisanya scroll".
4. **Transpose** — ganti nada dasar; notasi balok berubah otomatis, **on-the-fly di client dari model internal** (BUKAN pre-generate file per key). Lirik & not angka tidak berubah (movable-do). **Acceptance criteria enharmonic spelling:** transpose berbasis interval (huruf not + aksidental), BUKAN sekadar geser semitone MIDI. Ejaan not dan key signature hasil transpose harus mengikuti konvensi nada dasar tujuan — contoh: Logu 730 (Db) dinaikkan semitone harus menghasilkan D mayor (2 kres) dengan semua not ter-respell ke konteks D, bukan campuran C#/Db. Hindari double accidentals kecuali konteks musiknya memang mewajibkan; untuk key tujuan ber-pasangan enharmonis (C#/Db, F#/Gb, B/Cb), pilih signature yang lebih sederhana.
5. **Audio playback** — synth real-time dari model internal (BUKAN file audio pre-render); kalau SATB, 4 track terpisah dengan **mute/solo per suara** + **tempo control**.
6. **Score Mode toggle** ("Buku Logu Mode" vs "Full Score Mode") + version selector — terbukti end-to-end di 1 lagu pilot ber-arrangement.
7. **Offline** — semua fitur di atas jalan tanpa internet setelah load pertama.
8. **Wake lock** — layar tidak mati saat app terbuka (`navigator.wakeLock`); esensial untuk pemakaian live di music stand.
9. **Tombol "nada awal"** — bunyikan pitch pertama tiap suara (S→A→T→B) untuk dirigen/koor tanpa alat musik.

**Definisi "selesai":** kesembilan poin jalan mulus untuk 5 lagu **di device asli — iPad Safari DAN Android Chrome, keduanya sama penting; setiap checklist tes fitur WAJIB mencakup kedua device** — termasuk kasus SATB dan transpose ke key signature sulit, dan tetap jalan saat wifi dimatikan (airplane mode test di kedua device). Verifikasi terhadap cetakan fisik: (a) not angka Logu 110 dicocokkan baris-per-baris dengan cetakan buku — angka, titik oktaf, underline, `-`, `.`; (b) lirik tiap lagu dicocokkan dengan cetakan — pemenggalan suku kata, penomoran bait, melisma. Setelah solid, sesi baru untuk scale ke 15–20 lagu (Fase 1B) — jangan overbuild untuk itu sekarang.
</fitur_fase_1>

<lirik>
**Keputusan terkunci: lirik semua bait disimpan DI DALAM MusicXML** via `<lyric number="1..n">` per not, dengan data `syllabic` (begin/middle/single/end → tanda hubung) dan `extend` (melisma). Entry dilakukan di MuseScore saat pembersihan tiap lagu. Alasan: satu source of truth (notasi + lirik + alignment membeku bersama), setia ke buku fisik (lirik tercetak = bagian base layer kanonik), tidak perlu menciptakan format alignment sendiri, dan verovio/OSMD bisa render multi-verse lyrics native.

Konsekuensi implementasi:
- **Parser** wajib mengangkat data lirik (per bait, per not, syllabic, extend) ke model internal — bukan hanya pitch/durasi.
- **Notasi balok:** manfaatkan rendering multi-verse bawaan library untuk Mode Ibadah; Mode Latihan = filter ke satu bait. Verifikasi tampilan cocok gaya cetakan (nomor bait, stacking). Kalau library kaku soal layout/filter bait, flag ke aku sebelum workaround besar.
- **Not angka:** renderer custom WAJIB mendukung kedua mode dengan parameter `versesToShow` yang sama. **Sebelum mengerjakan bagian ini, minta aku kirim foto BL-73** sebagai referensi layout persis (posisi nomor bait, penanda melisma, dsb.).
- **SATB:** tentukan (dan tanya aku) konvensi penempatan lirik di format 4 baris angka — cetakan fisik jadi acuan.
</lirik>

<sistem_not_angka>
Ini bagian paling rawan bug, jadi baca teliti.

Not angka yang dipakai koor gereja Indonesia adalah **movable-do (do-based)**: `1 = do = nada dasar`. Konvensi:
- `1 2 3 4 5 6 7` = do re mi fa sol la si. `0` = tanda diam (rest).
- **Titik di atas** angka = naik satu oktaf; **titik di bawah** = turun satu oktaf (bisa bertumpuk untuk 2 oktaf).
- **Durasi**: garis bawah (underline) membagi nilai not (1 garis = ½, 2 garis = ¼, seperti beam); `.` memperpanjang (dotted); `-` menahan not satu ketuk lagi (tie/sustain).
- **Header**: `Do = <nada dasar>` + tanda birama (mis. `Do = G, 4/4`). Bar line & time signature ikut dari MusicXML.

**KONSEKUENSI TRANSPOSE (movable-do):** angka TIDAK berubah saat transpose — hanya label `Do = X` dan notasi balok yang berubah. Not angka dihitung relatif ke tonic/scale degree. (Movable-do SUDAH TERKUNCI — jangan tanya ulang.)

**Pendekatan implementasi:**
- Renderer custom (SVG/HTML) dari **model internal** — verovio/OSMD TIDAK bisa menggambar not angka. Tegaskan ini di rencanamu.
- **Single melody line dulu** → verifikasi vs cetakan Logu 110 → BARU extend ke **4 suara SATB** (4 baris angka bertumpuk S/A/T/B, titik oktaf masing-masing — TERKUNCI; converter SATB = converter single-melody dijalankan 4× lalu ditumpuk).

**Pitfalls yang WAJIB ditangani atau di-flag (jangan diam-diam ditebak):**
1. **Nada kromatis** — tangani diatonis dulu; FLAG begitu ketemu di lagu pilot.
2. **Anacrusis / birama gantung** — bar pertama & terakhir tidak penuh; renderer & playback jangan menganggapnya bug.
3. **Fermata** — minimal render simbolnya; playback boleh abaikan durasi ekstra di Fase 1, tapi flag di UI.
4. **Melisma/slur** — beberapa not satu suku kata; not angka pakai garis lengkung, angka tidak diulang; konsisten dengan data `extend` lirik.
5. **Minor keys** — konvensi `Do = X` vs `La = X` **BELUM diverifikasi ke cetakan fisik (pending — aku yang cek).** GERBANG: jangan mulai implementasi converter untuk lagu minor sebelum aku konfirmasi konvensinya. Kalau lagu pilot yang tersedia semuanya mayor, lanjut saja; kalau ketemu minor, berhenti dan tunggu.
</sistem_not_angka>

<eksplisit_di_luar_scope_sekarang>
- OMR otomatis dari PDF/foto — aku urus manual di MuseScore.
- Mengarransemen KONTEN full orchestra — arsitektur layered IN SCOPE, kontennya fase nanti.
- Notation editor built-in, dan SaaS editor berbayar — arrangement diedit di MuseScore lalu diimport.
- Import validator otomatis untuk MusicXML pihak ketiga — Fase 2; sekarang cukup konvensi tertulis.
- Lyric underlay eksternal (ende lain / terjemahan) — schema-nya saja yang membuka pintu; TIDAK dibangun.
- Search UI, setlist, stage mode, auto-scroll, export PDF, language toggle — Fase 2 (schema-nya saja disiapkan).
- Fitur tambahan yang menempel ke konsep "mode ibadah/latihan" di luar filter bait — Fase 2.
- CMS admin (Sveltia/Decap, git-native) — arah masa depan di VISION.md; TIDAK dibangun; struktur file-per-folder sudah kompatibel.
- Native iOS/Android — arsitektur gampang di-port ke Capacitor nanti.
- Bulk import, admin panel, database, user account, optimasi ratusan lagu — premature.
</eksplisit_di_luar_scope_sekarang>

<yang_aku_butuh_dari_kamu>
1. **Rekomendasi tech stack lengkap + alasan:**
   - Rendering balok: **verovio vs OSMD** — untuk SATB, transpose, kualitas engraving, **dukungan multi-verse lyrics + kemampuan filter bait** (kebutuhan Opsi C), akses element ID (untuk auto-scroll nanti).
   - **"Otak" musik di JavaScript client-side murni** (preferensiku; tanpa backend). Kalau music21 perlu, HANYA sebagai preprocessor build-time. Usulkan pipeline JS murni + trade-off.
   - Audio: evaluasi (mis. Tone.js) untuk 4-track SATB + mute/solo + tempo, dengan abstraksi "instrument" (synth sekarang → sampled organ nanti tanpa rombak).
   - Framework frontend, dengan hosting **GitHub Pages** (TERKUNCI).
2. **Finalisasi schema** `hymn.json` + `manifest.json` dari sketsa `<struktur_data>` — boleh usul perbaikan, field wajib jangan dihapus.
3. **Algoritma MusicXML → model internal → Not Angka + lirik** — single melody dulu, lalu SATB.
4. **Tanya balik** untuk keputusan besar ber-trade-off signifikan — jangan asumsi sendiri.
</yang_aku_butuh_dari_kamu>

<cara_kerja_yang_aku_inginkan>
0. **Prinsip kerja: kedalaman > kecepatan.** Tidak ada deadline. Setiap komponen: rapi, terdokumentasi (README + komentar "kenapa"), teruji — supaya scale ke fase berikut tidak perlu rombak arsitektur. Bukan izin melebarkan scope.
1. Mulai dengan **usulan tech stack + alasan + trade-off**. **TUNGGU konfirmasiku** sebelum coding. (Semua pertanyaan pra-coding lain sudah terjawab — lihat keputusan terkunci; jangan tanya ulang.)
2. Setelah disetujui: project skeleton (repo structure sesuai `<struktur_data>`, **Git init**, lisensi open-source, PWA + service worker manifest-driven dasar), **TERMASUK membuat `CLAUDE.md` di root repo**. Isi `CLAUDE.md`:
   - **Ringkasan keputusan terkunci, ±100 baris, singkat dan padat** — minimal mencakup: 5 prinsip yang tidak bisa ditawar; lirik semua bait hyphenated-per-note disimpan DI DALAM MusicXML (`<lyric number="n">` + syllabic + extend), `lyrics[]` di hymn.json = indeks; konvensi penamaan (zero-pad 3 digit `logu-NNN`, slug lowercase-hyphen untuk file aransemen); Opsi C layout bait (satu renderer, parameter `versesToShow`, default = Mode Ibadah, mode hanya mempengaruhi bait yang digambar); transpose berbasis interval dengan enharmonic spelling mengikuti key tujuan; movable-do (angka tidak berubah saat transpose); SATB not angka 4 baris; audio synth 4-track + mute/solo dengan abstraksi instrument; offline manifest-driven; device tes = iPad Safari DAN Android Chrome; alur suplai lagu paralel/inkremental; kedalaman > kecepatan.
   - **Pointer eksplisit**: "Baca `SPEC.md` / `DECISIONS.md` / `VISION.md` untuk detail lengkap dan konteks keputusan" — CLAUDE.md adalah ringkasan operasional, ketiga file itu tetap sumber kebenaran untuk keputusan besar.
   - **Aturan memori kerja (WAJIB dipatuhi sepanjang proyek):** setiap kali Selvyna mengoreksi kesalahanmu selama coding, catat koreksi itu sebagai **aturan baru di `CLAUDE.md`** (section khusus, mis. "## Aturan dari Koreksi") supaya kesalahan yang sama tidak terulang di sesi-sesi berikutnya. `CLAUDE.md` = memori kerja hidup yang terus diupdate; SPEC/DECISIONS/VISION = keputusan besar yang berubah lewat proses terpisah. Jangan mencampur keduanya: koreksi teknis harian masuk CLAUDE.md, perubahan keputusan besar tetap lewat DECISIONS.md.
3. **Buat dummy MusicXML** (single melody + multi-verse lyrics + satu kasus melisma + anacrusis) — lagu asli menyusul satu per satu, inkremental; setiap lagu asli datang, jalankan ulang test suite pipeline terhadapnya.
4. Implementasi transpose, uji beberapa interval — wajib mencakup key tujuan ber-mol banyak DAN ber-kres banyak, plus verifikasi enharmonic spelling (lihat acceptance criteria di `<fitur_fase_1>` poin 4).
5. Converter Not Angka + lirik (single melody → verifikasi vs cetakan → SATB; layout lirik not angka menunggu foto BL-73). Termasuk kedua preset mode bait (Ibadah/Latihan).
6. Audio playback + mute/solo + tempo (+ auto-advance bait di Mode Latihan).
7. Score Mode toggle + version selector end-to-end di lagu pilot ber-arrangement.
8. Offline test: airplane mode di **kedua** device.
9. Setiap **langkah besar**: ringkasan pendekatan + potential pitfalls DULU sebelum banyak kode; jelaskan *kenapa*-nya; usulkan **checklist tes kecil** untuk kuverifikasi — **setiap checklist mencakup iPad Safari DAN Android Chrome.**
</cara_kerja_yang_aku_inginkan>

<flag_ke_aku_kalau_relevan>
- **Hak cipta**, 3 lapis: (a) melodi/tune (banyak domain publik), (b) harmonisasi SATB + edisi/kompilasi Buku Logu + **teks ende** (kemungkinan milik HKBP), (c) arrangement buatanku (hakku). Field `license` per layer sudah ada di schema. Izin HKBP pusat = urusanku, non-teknis.
- **Lisensi kode**: usulkan lisensi open-source untuk legacy (kandidat MIT/Apache-2.0); konten notasi & lirik TIDAK ikut lisensi kode — pisahkan eksplisit di README.
- Keputusan Fase 1 mana pun yang menyulitkan scaling ke ratusan lagu.
</flag_ke_aku_kalau_relevan>

<pending_items_non_blocker>
- Kelima file MusicXML asli — dalam proses OMR/pembersihan, disuplai satu per satu (Logu 110 paling dekat selesai); pakai dummy dulu, jangan menunggu.
- Konvensi minor keys (`Do=X` vs `La=X`) — kuverifikasi ke cetakan; GERBANG untuk converter lagu minor.
- Foto BL-73 — kukirim saat lyric renderer (khususnya not angka) mulai dikerjakan.
- Status hak cipta / izin HKBP pusat — urusanku, sebelum distribusi luas.
</pending_items_non_blocker>
