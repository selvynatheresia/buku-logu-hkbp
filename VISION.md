# VISION.md — Mimpi Besar Buku Logu HKBP Digital

> File ini adalah **bintang penuntun (north star)** — arah jangka panjang, BUKAN daftar yang dibangun sekarang.
> Yang dibangun sekarang tetap di `SPEC.md` + `DECISIONS.md`: **5 lagu saja.**
>
> **Prinsip:** _"Desain untuk mimpi besar, bangun kerangkanya dulu."_
> Arsitektur Fase 1 harus **tidak menutup pintu** ke fitur di bawah — tapi fitur ini **TIDAK dibangun sekarang.**

_Terakhir diupdate: 7 Juli 2026_

---

## Visi

- Dipakai musisi & jemaat HKBP **di seluruh dunia**, termasuk diaspora.
- Standar kualitas yang **tidak memalukan** kalau dilirik musisi/lembaga lain (mis. Yamuger).
- **Ambisi benchmark (17 Jul 2026):** kemungkinan aplikasi gereja pertama yang
  mendigitalkan buku nyanyian lengkap dengan notasi balok + not angka berdampingan —
  targetnya jadi acuan bagi gereja/lembaga lain, termasuk potensi kolaborasi YAMUGER
  (Kidung Jemaat/PKJ/NKB punya edisi not angka & edisi harmoni — kebutuhan serupa).
- **Identitas:** yang dilihat user = HKBP & Buku Logu, bukan pembuatnya. Kisah
  personal di balik proyek hidup di dokumen (README/VISION) dan kelak halaman
  "Tentang" opsional — tidak pernah dominan di pengalaman harian.
- **Menghidupkan kembali keindahan hymn Buku Logu** — melawan tren mencampur pop/soul sembarangan.
- **Legacy jangka panjang:** format terbuka, bebas vendor lock-in, bisa dilanjutkan orang lain.

---

## Model Kolaborasi: "Perpustakaan Aransemen" (bukan editor bawaan)

Keputusan penting: app **tidak** membangun editor notasi sendiri (itu = membangun ulang MuseScore).
Sebagai gantinya:

- Base layer = notasi asli Buku Logu + lirik as-printed (tidak berubah).
- Siapa pun bisa membuat **arrangement layer** di MuseScore, lalu menyumbangkannya ke perpustakaan.
- Arranger dapat **kredit nama**; pengguna memilih versi aransemen yang aktif.

> Ibarat YouTube: alat rekamnya milik masing-masing orang; app-nya jadi tempat berkumpul & berbagi.

### Mekanisme kontribusi: Git-based, zero-backend ✅ (arah diputuskan)

- "Upload" = **GitHub Pull Request** (untuk yang teknis) atau **kirim via email → dikommit manual oleh maintainer** (untuk yang tidak).
- Kenapa: tetap zero backend & kompatibel GitHub Pages; PR review = quality gate gratis (kurator, bukan moderator spam); kredit arranger permanen di metadata + riwayat Git.
- Kelak butuh: **panduan arranger** (konvensi penamaan part, template MuseScore) + **import validator** otomatis (Fase 2) — beban engineering pindah dari "editor" ke "validator + style guide".

### Kandidat "admin panel" masa depan: git-native CMS

- **Kandidat utama: Sveltia CMS** (rewrite modern dari Decap CMS/Netlify CMS); **alternatif battle-tested: Decap CMS**.
- Alasan cocok: git-native, zero backend, zero database, MIT license, commit langsung ke repo via GitHub API — selaras penuh dengan GitHub Pages + prinsip no-lock-in.
- Prasyarat arsitektur yang harus dijaga SEKARANG (sudah terpenuhi): semua data = file JSON/MusicXML biasa dalam folder-per-hymn (kompatibel model folder-collection CMS).
- **BUKAN scope Fase 1.** Evaluasi kematangan Sveltia dilakukan nanti, saat volume kontribusi membenarkannya.

---

## Ide Fitur (dikelompokkan per fase; trade-off dicatat saat relevan)

### Sudah masuk Fase 1 (tercatat di SPEC — bukan lagi "ide")
- Toggle not balok ↔ not angka; transpose; playback 4-track SATB dengan **mute/solo per suara** + tempo control; lirik semua bait; offline; **wake lock**; **tombol nada awal** (pitch pertama tiap suara — emas untuk dirigen tanpa alat musik).

### A. Untuk penyanyi & koor (Fase 2)
- **Practice suite:** loop bagian tertentu (A–B), metronome, count-in, volume slider per suara ("suaraku lebih keras"). Trade-off: UI mulai padat → butuh pemisahan mode "latihan" vs mode "ibadah".
- **Solo/mute visual per suara** _(ide Selvyna 19 Jul 2026)_: highlight satu suara
  S/A/T/B di NOTASI, suara lain diredupkan — pasangan visual dari mute/solo audio,
  satu model mental. Urutan build: not angka dulu (tiap suara = baris sendiri, murah)
  BEGITU Logu 73 SATB masuk — jangan dibangun buta tanpa data SATB nyata; balok
  menyusul lewat pemetaan id not (kerja yang sama membuka playback-highlight — sinergi).
- ⭐ **Mode Latihan Suara** _(ide Selvyna 20 Jul 2026, arah disepakati)_: paralel
  dengan Mode Latihan bait — user memilih Sopran/Alto/Tenor/Bas, lalu mendapat
  **panel latihan tersendiri**: notasi suara itu ditonjolkan, tombol main sendiri
  (hanya suara itu), dan **tempo sendiri** yang tidak mengubah tempo ibadah.
  Kenapa bukan sekadar solo+tempo global: target penggunanya penyanyi yang tidak
  membaca not — mereka butuh "latihan bagianku", bukan konsep mixing. Tempo
  latihan lambat WAJIB tidak bocor ke halaman utama (dua konteks, dua state).
  Rekomendasi teknis: satu player per konteks (bukan satu player global), dan
  pertimbangkan opsi "suaraku keras + lainnya pelan" sebagai langkah kedua —
  banyak penyanyi butuh konteks harmoni, bukan isolasi total. Dibangun BERSAMAAN
  dengan rendering SATB saat Logu 73 masuk.

### B. Untuk pemusik pengiring (Fase 2 – jangka menengah)
- Pilih **bunyi instrumen** (organ, piano, strings) — abstraksi "instrument" sudah disiapkan di arsitektur audio Fase 1.
- **Simbol akor** di atas not (dari tag harmony MusicXML, kalau arranger menyertakan).
- **Auto-scroll / auto page-turn** saat playback — feasible karena library rendering memberi ID elemen per not; effort menengah, efek "wow" besar.

### C. Aransemen & kolaborasi
- Base + **banyak versi arrangement layer** _(mekanisme: Fase 1)_
- **Kontribusi aransemen sedunia** via Git (lihat atas) + kredit arranger _(jangka menengah)_
- **Lyric underlay eksternal**: ende lain / terjemahan (Batak/Indonesia/Inggris) untuk logu yang sama — schema `lyrics[]` sebagai indeks sudah membuka pintunya _(jangka menengah)_
- Visi jauh: **orchestra penuh** ala Tabernacle Choir (multi-tahun).

### D. Untuk ibadah & organisasi (Fase 2)
- ⭐ **Dua daftar isi: Buku Ende & Buku Logu** _(ide Selvyna 20 Jul 2026)_ — dua
  pintu masuk untuk dua persona (jemaat lewat nomor BE; pemusik lewat nomor BL),
  masing-masing mendarat di tab yang sesuai (BE → Not Angka, BL → Balok).
  Prasyarat data: relasi many-to-many BE↔BL harus terisi (`lyrics[].ende_no`
  sudah ada di skema — tinggal diisi disiplin sejak lagu pertama). Catatan UX:
  satu logu dipakai banyak ende → daftar BE bisa memuat beberapa entri yang
  membuka halaman logu yang sama; judul entri harus judul ENDE-nya, bukan judul
  logu, supaya user tidak merasa "salah lagu".
- ⭐ **Setlist via URL encoding** (`?setlist=110,245,17`) — dibagikan lewat WA, **tanpa backend**. Trade-off: tidak ada sinkronisasi antar-device/akun; untuk konteks gereja, share link sudah menutup mayoritas kebutuhan. _(Prioritas dinaikkan 17 Jul 2026 — kebutuhan nyata dirigen/song leader.)_
- ⭐ **Pencarian** _(dibahas 20 Jul 2026)_: **satu kotak search untuk semua**, bukan
  dipisah per buku — user tidak selalu ingat sedang mencari BE atau BL; hasil
  dikelompokkan berlabel ("Buku Ende 204" / "Buku Logu 73"). Query menerima
  **nomor DAN judul sekaligus** (deteksi otomatis: input angka → cocokkan nomor
  dulu, lalu judul; teks → judul/baris pertama lirik). Toleran typo & tanpa
  diakritik. Jangka menengah: tema / kategori liturgis / ayat Alkitab — index
  client-side (mis. FlexSearch) dari metadata; syaratnya disiplin mengisi
  metadata sejak lagu ke-1 (field sudah ada di schema).
- **Stage mode**: huruf besar, kontras tinggi, dark mode (mostly CSS). _(Sebagian
  sudah terwujud lewat panel aksesibilitas Aa — ukuran & tema, Jul 2026.)_
- **Mode fokus / full-screen** _(ide Selvyna 19 Jul 2026)_: notasi memenuhi layar
  tanpa header/kontrol (tombol "Fokus", tap untuk keluar; Fullscreen API) — rasa
  membaca partitur fisik di music stand. BERBEDA dari mode proyektor (proyektor =
  lirik besar untuk jemaat; fokus = notasi untuk pemusik) — keduanya saling
  melengkapi. Kandidat item Fase 2 pertama setelah inti Fase 1 rampung.
- ⭐ **Export PDF** via print CSS dari SVG. Trade-off: pagination hymn panjang butuh kerja ekstra. _(Prioritas dinaikkan 17 Jul 2026 — untuk jemaat tanpa perangkat.)_
- Bisa dipakai **offline** _(Fase 1 ✅)_

### E. Jangka jauh
- **Integrasi Almanak HKBP** — cari lagu per minggu/musim liturgis (field `kategori_liturgis` sudah membuka pintu).
- Port native via **Capacitor**.

---

## Ide Kelas Benchmark (dicatat 17 Jul 2026 — arah, BUKAN komitmen)

> Kumpulan ide dari diskusi "supaya berskala internasional". Semua di luar scope
> sekarang; dicatat supaya keputusan arsitektur hari ini tidak menutup pintunya.

### Latihan & playback
- **Sampled pipe organ** (SoundFont/sample) — abstraksi instrument sudah menyiapkan slot-nya.
- **Highlight not berjalan** saat playback di KEDUA notasi (xml:id Verovio + sourceId cipher sudah tersedia dari hari pertama).
- Fermata dihormati playback (rubato ringan), breath mark, A–B loop, count-in, metronome, mode "suaraku ditonjolkan".

### Untuk pemusik
- **Tampilan part ter-transpose untuk instrumen Bb/Eb/F** (trumpet, saxophone, horn) — transpose engine interval-based tinggal diberi preset instrumen; fitur langka bahkan di app hymnal komersial.
- **Web MIDI out** (bunyikan ke keyboard/organ digital) + **pedal Bluetooth page-turn** (AirTurn dkk.) untuk music stand.
- **Export MusicXML per hymn** — interop penuh; juga jalur teknis kolaborasi YAMUGER.

### Untuk jemaat & ibadah
- **Mode proyektor**: tampilan lirik-saja resolusi besar dari data yang sama — menggantikan software proyeksi terpisah yang datanya selalu tidak sinkron.
- **Navigasi silang BE ↔ BL dua arah** (field ende_no sudah ada).
- **Print/PDF paritas cetak** (booklet A4) — lihat prioritas Fase 2.

### Platform
- **Arsitektur multi-hymnal**: folder-per-hymn + skema sudah hymnal-agnostic — jangka panjang app ini bisa jadi "engine buku nyanyian" untuk buku lain (KJ, PKJ, NKB) tanpa rombak inti.
- **Braille music export (BMML)** — ambisi aksesibilitas jangka sangat jauh.

## Pagar Disiplin (jangan dilanggar)

- **Fase 1 = 5 lagu.** Fitur di atas TIDAK dibangun sekarang.
- Tugas arsitektur sekarang hanya satu: pastikan keputusan Fase 1 **tidak menutup pintu** ke fitur di atas.
- Kalau sebuah fitur menggoda untuk dibangun lebih awal → tahan, catat di sini, lanjutkan skeleton.
- **Kualitas > kecepatan** — tapi bukan alasan menambah fitur.
