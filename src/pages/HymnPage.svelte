<script lang="ts">
  import { loguId, fetchHymnMeta, fetchHymnText } from '../lib/hymns';
  import { acquireWakeLock } from '../lib/wake-lock';
  import { renderMusicXmlToSvg } from '../lib/verovio';
  import { parseMusicXml } from '../music/parse';
  import { stripLyrics, transposeMusicXml } from '../music/musicxml-transform';
  import { formatDoLabel, scoreToCipher } from '../music/cipher';
  import type { CipherResult } from '../music/cipher';
  import { compilePlayback } from '../music/playback';
  import { canonicalTonics, tonicForKey, transposeScoreToTonic } from '../music/transpose';
  import type { TransposeWarning } from '../music/transpose';
  import { canvasMeasurer, cipherToSvg } from '../render/cipher-svg';
  import PlaybackBar from '../components/PlaybackBar.svelte';
  import { settings } from '../lib/settings.svelte';
  import type { HymnMeta } from '../lib/types';
  import type { InternalScore, ParseWarning } from '../music/model';

  let { loguNo }: { loguNo: number } = $props();

  let meta = $state<HymnMeta | null>(null);
  let error = $state<string | null>(null);
  let wrapper = $state<HTMLElement | null>(null);

  // Pipeline otak musik: MusicXML → parser → model internal (sumber tunggal);
  // transpose menghasilkan skor AKTIF yang dikonsumsi cipher + playback,
  // sementara balok memakai transform XML dengan fungsi engine yang sama.
  let xmlSource = $state<string | null>(null);
  let parsedScore = $state<InternalScore | null>(null);
  let parseWarnings = $state<ParseWarning[]>([]);
  let parseError = $state<string | null>(null);

  let staffSvg = $state<string | null>(null);
  let showBalokLyrics = $state(false);

  // Transpose (on-the-fly di client, keputusan terkunci): null = nada dasar asli
  let targetTonic = $state<string | null>(null);

  // Not Angka = default (nomor Buku Ende yang diumumkan gereja); pilihan
  // terakhir diingat per perangkat.
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
      // preferensi saja yang hilang
    }
  }
  let view = $state<'balok' | 'angka'>(loadViewPref());

  // Opsi C (C2): mode HANYA mempengaruhi bait yang digambar di not angka.
  let lyricMode = $state<'ibadah' | 'latihan'>('ibadah');
  let activeVerse = $state(1);

  function onSongEnd(): boolean {
    // auto-advance bait Mode Latihan: lagu selesai → bait berikutnya, main lagi
    if (
      view === 'angka' &&
      lyricMode === 'latihan' &&
      cipherResult !== null &&
      activeVerse < cipherResult.cipher.versesCount
    ) {
      activeVerse += 1;
      return true;
    }
    return false;
  }

  // Layar tidak boleh mati selama halaman hymn terbuka (live di music stand)
  $effect(() => acquireWakeLock());

  // Penjaga race per jenis pekerjaan
  let requestSeq = 0;
  let staffSeq = 0;

  // ---- muat data lagu ----
  $effect(() => {
    const no = loguNo;
    const seq = ++requestSeq;
    meta = null;
    error = null;
    xmlSource = null;
    parsedScore = null;
    parseWarnings = [];
    parseError = null;
    staffSvg = null;
    showBalokLyrics = false;
    targetTonic = null;
    view = loadViewPref();
    lyricMode = 'ibadah';
    activeVerse = 1;

    (async () => {
      try {
        const id = loguId(no);
        const m = await fetchHymnMeta(id);
        if (seq !== requestSeq) return;
        meta = m;

        const xml = await fetchHymnText(id, m.base.file);
        if (seq !== requestSeq) return;
        xmlSource = xml;
        try {
          const parsed = parseMusicXml(xml);
          parsedScore = parsed.score;
          parseWarnings = parsed.warnings;
        } catch (e) {
          parseError = e instanceof Error ? e.message : String(e);
        }
      } catch (e) {
        if (seq !== requestSeq) return;
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // ---- skor aktif (asli / ter-transpose) ----
  const transposeOut = $derived.by(() => {
    if (parsedScore === null) return null;
    if (targetTonic === null) {
      return { score: parsedScore, warnings: [] as TransposeWarning[] };
    }
    try {
      return transposeScoreToTonic(parsedScore, targetTonic);
    } catch {
      return { score: parsedScore, warnings: [] as TransposeWarning[] };
    }
  });
  const activeScore = $derived(transposeOut?.score ?? null);

  const cipherOut = $derived.by(() => {
    if (activeScore === null) return null;
    try {
      return { result: scoreToCipher(activeScore), gateError: null as string | null };
    } catch (e) {
      return { result: null, gateError: e instanceof Error ? e.message : String(e) };
    }
  });
  const cipherResult: CipherResult | null = $derived(cipherOut?.result ?? null);
  const cipherError = $derived(parseError ?? cipherOut?.gateError ?? null);

  const playback = $derived(activeScore === null ? null : compilePlayback(activeScore));

  // Mode Ibadah (default Opsi C): semua bait; Latihan: bait aktif saja.
  const cipherSvg = $derived(
    cipherResult === null
      ? null
      : cipherToSvg(cipherResult.cipher, {
          maxWidthPx: 800,
          fontSizePx: 20 * settings.scale, // re-layout penuh saat ukuran berubah
          measureText: canvasMeasurer,
          versesToShow: lyricMode === 'latihan' ? [activeVerse] : undefined,
        }),
  );

  const tonicOptions = $derived(
    parsedScore === null ? [] : canonicalTonics(parsedScore.key.mode ?? 'major'),
  );
  const originalDoLabel = $derived(
    parsedScore === null ? '' : formatDoLabel(tonicForKey(parsedScore.key)),
  );

  const allWarnings = $derived([
    ...parseWarnings.map((w) => `[parser ${w.code}] ${w.message}`),
    ...(transposeOut?.warnings.map((w) => `[transpose ${w.code}] ${w.message}`) ?? []),
    ...(cipherResult?.warnings.map((w) => `[not angka ${w.code}] ${w.message}`) ?? []),
  ]);

  // ---- render balok (Verovio) ----
  // Satu jalur: strip lirik (default Buku Logu) / utuh (toggle latihan),
  // lalu transform transpose bila perlu. Semua dependensi dibaca eksplisit
  // supaya perubahan (skala aksesibilitas, tonic, toggle) memicu re-render.
  $effect(() => {
    const src = xmlSource;
    const withLyrics = showBalokLyrics;
    const target = targetTonic;
    const scalePercent = 40 * settings.scale;
    if (src === null) return;
    const seq = ++staffSeq;
    staffSvg = null;

    (async () => {
      try {
        const base = withLyrics ? src : stripLyrics(src);
        const xml = target === null ? base : transposeMusicXml(base, target);
        const measured = wrapper?.clientWidth ?? 0;
        const rendered = await renderMusicXmlToSvg(xml, {
          pageWidthPx: measured >= 200 ? measured : 800,
          scalePercent,
        });
        if (seq !== staffSeq) return;
        staffSvg = rendered;
      } catch (e) {
        if (seq !== staffSeq) return;
        error = e instanceof Error ? e.message : String(e);
      }
    })();
  });
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
      <!-- key: lagu/transpose berubah = jadwal baru = player lama dibuang bersih -->
      {#key playback}
        <PlaybackBar {playback} {onSongEnd} />
      {/key}
    {/if}

    <div class="controls-row">
      <div class="view-toggle" role="group" aria-label="Jenis notasi">
        <button class:active={view === 'angka'} onclick={() => setView('angka')}>Not Angka</button>
        <button class:active={view === 'balok'} onclick={() => setView('balok')}>Balok</button>
      </div>

      {#if parsedScore}
        <label class="transpose-ctl">
          Nada dasar
          <select
            value={targetTonic ?? ''}
            onchange={(e) => {
              const v = e.currentTarget.value;
              targetTonic = v === '' ? null : v;
            }}
          >
            <option value="">Asli — {originalDoLabel}</option>
            {#each tonicOptions as t (t)}
              <option value={t}>{formatDoLabel(t)}</option>
            {/each}
          </select>
        </label>
      {/if}
    </div>

    {#if view === 'balok'}
      <label class="balok-lyric-toggle">
        <input type="checkbox" bind:checked={showBalokLyrics} />
        Tampilkan lirik (semua bait) — untuk latihan
      </label>
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
          <div class="verse-controls">
            <div class="mode-toggle" role="group" aria-label="Mode bait">
              <button class:active={lyricMode === 'ibadah'} onclick={() => (lyricMode = 'ibadah')}>
                Ibadah
              </button>
              <button class:active={lyricMode === 'latihan'} onclick={() => (lyricMode = 'latihan')}>
                Latihan
              </button>
            </div>
            {#if lyricMode === 'latihan'}
              <div class="verse-chips" role="group" aria-label="Pilih bait">
                {#each Array.from({ length: cipherResult.cipher.versesCount }, (_, i) => i + 1) as v (v)}
                  <button class:active={activeVerse === v} onclick={() => (activeVerse = v)}>
                    {v}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
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

  .controls-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .view-toggle {
    display: inline-flex;
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
    min-width: 44px;
    min-height: 44px;
  }

  .view-toggle button.active {
    background: var(--accent);
    color: var(--on-accent);
  }

  .transpose-ctl {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .transpose-ctl select {
    font: inherit;
    min-height: 44px;
    border: 1px solid var(--accent);
    border-radius: 0.4rem;
    background: var(--card);
    color: var(--ink);
    padding: 0 0.5rem;
  }

  .balok-lyric-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.5rem;
    cursor: pointer;
    min-height: 44px;
  }

  .balok-lyric-toggle input {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--accent);
  }

  .score {
    /* selalu "kertas" terang di semua tema — keterbacaan partitur menang */
    background: var(--paper);
    color: var(--paper-ink);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
    overflow-x: auto;
  }

  .score :global(svg) {
    max-width: 100%;
    height: auto;
  }

  .verse-controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.6rem;
  }

  .mode-toggle {
    display: inline-flex;
    border: 1px solid var(--muted);
    border-radius: 0.4rem;
    overflow: hidden;
  }

  .mode-toggle button {
    font: inherit;
    font-size: 0.85rem;
    border: none;
    background: var(--paper);
    color: var(--muted);
    padding: 0.3rem 0.8rem;
    min-height: 44px;
    cursor: pointer;
  }

  .mode-toggle button.active {
    background: var(--accent);
    color: var(--on-accent);
  }

  .verse-chips {
    display: inline-flex;
    gap: 0.35rem;
  }

  .verse-chips button {
    font: inherit;
    font-size: 0.9rem;
    min-width: 44px;
    min-height: 44px;
    border: 1px solid var(--accent);
    border-radius: 50%;
    background: var(--paper);
    color: var(--accent);
    cursor: pointer;
  }

  .verse-chips button.active {
    background: var(--accent);
    color: var(--on-accent);
  }

  .cipher-header {
    margin: 0 0 0.5rem;
    font-weight: 700;
  }

  .warnings {
    margin-top: 0.75rem;
    font-size: 0.85rem;
    color: var(--warn);
  }

  .warnings ul {
    margin: 0.25rem 0 0;
    padding-left: 1.25rem;
  }

  .error {
    color: var(--error);
  }

  .muted {
    color: var(--muted);
  }
</style>
