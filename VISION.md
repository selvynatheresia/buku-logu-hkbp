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
- **Setlist via URL encoding** (`?setlist=110,245,17`) — dibagikan lewat WA, **tanpa backend**. Trade-off: tidak ada sinkronisasi antar-device/akun; untuk konteks gereja, share link sudah menutup mayoritas kebutuhan.
- **Pencarian**: nomor / judul / tema / kategori liturgis / ayat Alkitab — index client-side (mis. FlexSearch) dari metadata; syaratnya disiplin mengisi metadata sejak lagu ke-1 (field sudah ada di schema).
- **Stage mode**: huruf besar, kontras tinggi, dark mode (mostly CSS).
- **Export PDF** via print CSS dari SVG. Trade-off: pagination hymn panjang butuh kerja ekstra.
- Bisa dipakai **offline** _(Fase 1 ✅)_

### E. Jangka jauh
- **Integrasi Almanak HKBP** — cari lagu per minggu/musim liturgis (field `kategori_liturgis` sudah membuka pintu).
- Port native via **Capacitor**.

---

## Pagar Disiplin (jangan dilanggar)

- **Fase 1 = 5 lagu.** Fitur di atas TIDAK dibangun sekarang.
- Tugas arsitektur sekarang hanya satu: pastikan keputusan Fase 1 **tidak menutup pintu** ke fitur di atas.
- Kalau sebuah fitur menggoda untuk dibangun lebih awal → tahan, catat di sini, lanjutkan skeleton.
- **Kualitas > kecepatan** — tapi bukan alasan menambah fitur.
