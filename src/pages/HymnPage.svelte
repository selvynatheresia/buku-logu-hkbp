<script lang="ts">
  import { loguId, fetchHymnMeta, fetchHymnText } from '../lib/hymns';
  import { acquireWakeLock } from '../lib/wake-lock';
  import { renderMusicXmlToSvg } from '../lib/verovio';
  import { parseMusicXml } from '../music/parse';
  import { stripLyrics } from '../music/musicxml-transform';
  import { formatDoLabel, scoreToCipher } from '../music/cipher';
  import type { CipherResult } from '../music/cipher';
  import { compilePlayback } from '../music/playback';
  import type { PlaybackScore } from '../music/playback';
  import { canvasMeasurer, cipherToSvg } from '../render/cipher-svg';
  import PlaybackBar from '../components/PlaybackBar.svelte';
  import type { HymnMeta } from '../lib/types';
  import type { ParseWarning } from '../music/model';

  let { loguNo }: { loguNo: number } = $props();

  let meta = $state<HymnMeta | null>(null);
  let staffSvg = $state<string | null>(null);
  let error = $state<string | null>(null);
  let wrapper = $state<HTMLElement | null>(null);

  // Toggle lirik balok (Batch C): default TANPA lirik (Buku Logu asli);
  // saat diaktifkan, render ulang dari MusicXML utuh (semua bait, native
  // Verovio) dan di-cache — untuk kebutuhan latihan "ulang dari lirik X".
  let xmlSource = $state<string | null>(null);
  let staffSvgLyrics = $state<string | null>(null);
  let showBalokLyrics = $state(false);

  // Pipeline otak musik: MusicXML → parser → model internal → cipher.
  // Berjalan paralel dengan render Verovio (yang membaca MusicXML asli).
  let parseWarnings = $state<ParseWarning[]>([]);
  let cipherResult = $state<CipherResult | null>(null);
  let cipherError = $state<string | null>(null);
  let playback = $state<PlaybackScore | null>(null);

  // Not Angka = default (nomor Buku Ende yang diumumkan gereja → cipher yang
  // primer bagi jemaat); pilihan terakhir diingat per perangkat, jadi organis
  // yang selalu membuka Balok cukup memilih sekali.
  const VIEW_KEY = 'bl-view';
  function loadViewPref(): 'balok' | 'angka' {
    try {
      return localStorage.getItem(VIEW_KEY) === 'balok' ? 'balok' : 'angka';
    } catch {
      return 'angka';
    }
  }
  function setView(v: 'balok' | 'angka') {
    view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage penuh/di-block — preferensi saja yang hilang, bukan fungsinya
    }
  }

  let view = $state<'balok' | 'angka'>(loadViewPref());

  // Layar tidak boleh mati selama halaman hymn terbuka (live di music stand)
  $effect(() => acquireWakeLock());

  // Penjaga race: kalau user pindah lagu saat load masih jalan, hasil lama dibuang.
  let requestSeq = 0;

  $effect(() => {
    const no = loguNo;
    const seq = ++requestSeq;
    meta = null;
    staffSvg = null;
    error = null;
    xmlSource = null;
    staffSvgLyrics = null;
    showBalokLyrics = false;
    parseWarnings = [];
    cipherResult = null;
    cipherError = null;
    playback = null;
    view = loadViewPref();

    (async () => {
      try {
        const id = loguId(no);
        const m = await fetchHymnMeta(id);
        if (seq !== requestSeq) return;
        meta = m;

        const xml = await fetchHymnText(id, m.base.file);
        if (seq !== requestSeq) return;
        xmlSource = xml;

        // otak musik (sinkron, cepat) — gagal parse ≠ gagal halaman:
        // balok Verovio tetap tampil, not angka menampilkan alasannya
        try {
          const parsed = parseMusicXml(xml);
          parseWarnings = parsed.warnings;
          playback = compilePlayback(parsed.score);
          // converter cipher bisa berhenti di gerbang (minor dsb.) tanpa
          // mematikan playback/balok — makanya try terpisah
          try {
            cipherResult = scoreToCipher(parsed.score);
          } catch (e) {
            cipherError = e instanceof Error ? e.message : String(e);
          }
        } catch (e) {
          cipherError = e instanceof Error ? e.message : String(e);
        }

        // Lebar diukur sekali saat load; re-layout saat resize/rotasi = TODO.
        // Guard: saat DOM belum selesai layout, clientWidth bisa 0/mini —
        // jangan teruskan nilai sampah ke engine layout Verovio.
        const measured = wrapper?.clientWidth ?? 0;
        const pageWidthPx = measured >= 200 ? measured : 800;
        // Balok tanpa lirik — meniru Buku Logu asli (klarifikasi 17 Jul 2026);
        // lirik hanya tampil di renderer not angka.
        const rendered = await renderMusicXmlToSvg(stripLyrics(xml), { pageWidthPx });
        if (seq !== requestSeq) return;
        staffSvg = rendered;
      } catch (e) {
        if (seq !== requestSeq) return;
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // Render balok BER-LIRIK secara malas saat toggle pertama kali menyala
  $effect(() => {
    if (!showBalokLyrics || staffSvgLyrics !== null || xmlSource === null) return;
    const seq = requestSeq;
    const src = xmlSource;
    (async () => {
      const measured = wrapper?.clientWidth ?? 0;
      const rendered = await renderMusicXmlToSvg(src, {
        pageWidthPx: measured >= 200 ? measured : 800,
      });
      if (seq !== requestSeq) return;
      staffSvgLyrics = rendered;
    })();
  });

  // Mode Ibadah (default Opsi C): semua bait — versesToShow tidak diisi.
  // Mode Latihan (chip bait + filter) menyusul di Tahap C2.
  const cipherSvg = $derived(
    cipherResult === null
      ? null
      : cipherToSvg(cipherResult.cipher, {
          maxWidthPx: 800,
          fontSizePx: 20,
          measureText: canvasMeasurer,
        }),
  );

  const allWarnings = $derived([
    ...parseWarnings.map((w) => `[parser ${w.code}] ${w.message}`),
    ...(cipherResult?.warnings.map((w) => `[not angka ${w.code}] ${w.message}`) ?? []),
  ]);
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !meta}
  <p class="muted">Memuat…</p>
{:else}
  <article>
    <h1>
      <span class="no">Logu {meta.logu_no}</span>
      {meta.title}
    </h1>
    <p class="meta-line">
      {#if meta.lyrics.length > 0}
        {meta.lyrics[0].verses_count} bait
      {/if}
      {#if meta.arrangements.length > 0}
        · {meta.arrangements.length} aransemen
      {/if}
    </p>
    {#if meta.composer}
      <p class="credit-line">
        Lagu: {meta.composer}{meta.composer_year ? `, ${meta.composer_year}` : ''}
      </p>
    {/if}

    {#if playback}
      <!-- key: pindah lagu = playback baru = player lama di-dispose bersih -->
      {#key playback}
        <PlaybackBar {playback} />
      {/key}
    {/if}

    <div class="view-toggle" role="group" aria-label="Jenis notasi">
      <button class:active={view === 'angka'} onclick={() => setView('angka')}>Not Angka</button>
      <button class:active={view === 'balok'} onclick={() => setView('balok')}>Balok</button>
    </div>

    {#if view === 'balok'}
      <label class="balok-lyric-toggle">
        <input type="checkbox" bind:checked={showBalokLyrics} />
        Tampilkan lirik (semua bait) — untuk latihan
      </label>
      <div class="score" bind:this={wrapper}>
        {#if showBalokLyrics}
          {#if staffSvgLyrics}
            <!-- eslint-disable-next-line svelte/no-at-html-tags — SVG dari Verovio atas file milik repo sendiri -->
            {@html staffSvgLyrics}
          {:else}
            <p class="muted">Merender notasi berlirik…</p>
          {/if}
        {:else if staffSvg}
          <!-- eslint-disable-next-line svelte/no-at-html-tags — SVG dari Verovio atas file milik repo sendiri -->
          {@html staffSvg}
        {:else}
          <p class="muted">Merender notasi…</p>
        {/if}
      </div>
    {:else}
      <div class="score">
        {#if cipherError}
          <p class="error">Not angka belum bisa ditampilkan: {cipherError}</p>
        {:else if cipherResult && cipherSvg}
          <p class="cipher-header">
            {formatDoLabel(cipherResult.cipher.doLabel)} · {cipherResult.cipher.timeLabel}
          </p>
          <!-- eslint-disable-next-line svelte/no-at-html-tags — SVG hasil renderer kita sendiri -->
          {@html cipherSvg}
        {:else}
          <p class="muted">Mengonversi…</p>
        {/if}
      </div>
    {/if}

    {#if allWarnings.length > 0}
      <details class="warnings">
        <summary>⚠ {allWarnings.length} peringatan pipeline</summary>
        <ul>
          {#each allWarnings as w (w)}
            <li>{w}</li>
          {/each}
        </ul>
      </details>
    {/if}
  </article>
{/if}

<style>
  h1 {
    font-size: 1.4rem;
    margin-bottom: 0.25rem;
  }

  .no {
    color: var(--accent);
    margin-right: 0.5rem;
  }

  .meta-line {
    color: var(--muted);
    margin-top: 0;
    margin-bottom: 0.15rem;
  }

  .credit-line {
    color: var(--muted);
    font-size: 0.85rem;
    margin: 0 0 0.6rem;
  }

  .view-toggle {
    display: inline-flex;
    margin-bottom: 0.75rem;
    border: 1px solid var(--accent);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .view-toggle button {
    border: none;
    background: var(--card);
    color: var(--accent);
    font: inherit;
    padding: 0.45rem 1.1rem;
    cursor: pointer;
    min-width: 44px; /* target sentuh tablet */
    min-height: 44px;
  }

  .view-toggle button.active {
    background: var(--accent);
    color: #fff;
  }

  .score {
    background: var(--card);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
    overflow-x: auto;
  }

  .score :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .balok-lyric-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
    cursor: pointer;
    min-height: 44px; /* target sentuh */
  }

  .balok-lyric-toggle input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--accent);
  }

  .cipher-header {
    margin: 0 0 0.5rem;
    font-weight: 700;
  }

  .warnings {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: #7a5a00;
  }

  .warnings ul {
    margin: 0.25rem 0 0;
    padding-left: 1.25rem;
  }

  .error {
    color: #a02020;
  }

  .muted {
    color: var(--muted);
  }
</style>
