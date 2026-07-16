<script lang="ts">
  import { loguId, fetchHymnMeta, fetchHymnText } from '../lib/hymns';
  import { acquireWakeLock } from '../lib/wake-lock';
  import { renderMusicXmlToSvg } from '../lib/verovio';
  import { parseMusicXml } from '../music/parse';
  import { scoreToCipher } from '../music/cipher';
  import type { CipherResult } from '../music/cipher';
  import { compilePlayback } from '../music/playback';
  import type { PlaybackScore } from '../music/playback';
  import { cipherToSvg } from '../render/cipher-svg';
  import PlaybackBar from '../components/PlaybackBar.svelte';
  import type { HymnMeta } from '../lib/types';
  import type { ParseWarning } from '../music/model';

  let { loguNo }: { loguNo: number } = $props();

  let meta = $state<HymnMeta | null>(null);
  let staffSvg = $state<string | null>(null);
  let error = $state<string | null>(null);
  let wrapper = $state<HTMLElement | null>(null);

  // Pipeline otak musik: MusicXML → parser → model internal → cipher.
  // Berjalan paralel dengan render Verovio (yang membaca MusicXML asli).
  let parseWarnings = $state<ParseWarning[]>([]);
  let cipherResult = $state<CipherResult | null>(null);
  let cipherError = $state<string | null>(null);
  let playback = $state<PlaybackScore | null>(null);

  let view = $state<'balok' | 'angka'>('balok');

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
    parseWarnings = [];
    cipherResult = null;
    cipherError = null;
    playback = null;
    view = 'balok';

    (async () => {
      try {
        const id = loguId(no);
        const m = await fetchHymnMeta(id);
        if (seq !== requestSeq) return;
        meta = m;

        const xml = await fetchHymnText(id, m.base.file);
        if (seq !== requestSeq) return;

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
        const rendered = await renderMusicXmlToSvg(xml, { pageWidthPx });
        if (seq !== requestSeq) return;
        staffSvg = rendered;
      } catch (e) {
        if (seq !== requestSeq) return;
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  const cipherSvg = $derived(
    cipherResult === null
      ? null
      : cipherToSvg(cipherResult.cipher, { maxWidthPx: 800, fontSizePx: 20 }),
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

    {#if playback}
      <!-- key: pindah lagu = playback baru = player lama di-dispose bersih -->
      {#key playback}
        <PlaybackBar {playback} />
      {/key}
    {/if}

    <div class="view-toggle" role="group" aria-label="Jenis notasi">
      <button class:active={view === 'balok'} onclick={() => (view = 'balok')}>Balok</button>
      <button class:active={view === 'angka'} onclick={() => (view = 'angka')}>Not Angka</button>
    </div>

    {#if view === 'balok'}
      <div class="score" bind:this={wrapper}>
        {#if staffSvg}
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
            Do = {cipherResult.cipher.doLabel} · {cipherResult.cipher.timeLabel}
          </p>
          <!-- eslint-disable-next-line svelte/no-at-html-tags — SVG hasil renderer kita sendiri -->
          {@html cipherSvg}
          <p class="cipher-note">
            Tahap B: angka saja — lirik menunggu verifikasi layout (foto BL-73).
          </p>
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

  .cipher-header {
    margin: 0 0 0.5rem;
    font-weight: 700;
  }

  .cipher-note {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--muted);
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
