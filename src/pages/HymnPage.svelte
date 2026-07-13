<script lang="ts">
  import { loguId, fetchHymnMeta, fetchHymnText } from '../lib/hymns';
  import { renderMusicXmlToSvg } from '../lib/verovio';
  import type { HymnMeta } from '../lib/types';

  let { loguNo }: { loguNo: number } = $props();

  let meta = $state<HymnMeta | null>(null);
  let svg = $state<string | null>(null);
  let error = $state<string | null>(null);
  let wrapper = $state<HTMLElement | null>(null);

  // Penjaga race: kalau user pindah lagu saat load masih jalan, hasil lama dibuang.
  let requestSeq = 0;

  $effect(() => {
    const no = loguNo;
    const seq = ++requestSeq;
    meta = null;
    svg = null;
    error = null;

    (async () => {
      try {
        const id = loguId(no);
        const m = await fetchHymnMeta(id);
        if (seq !== requestSeq) return;
        meta = m;

        const xml = await fetchHymnText(id, m.base.file);
        // Lebar diukur sekali saat load; re-layout saat resize/rotasi = TODO
        // (dicatat, bukan lupa — belum krusial untuk skeleton).
        const pageWidthPx = wrapper?.clientWidth ?? 800;
        const rendered = await renderMusicXmlToSvg(xml, { pageWidthPx });
        if (seq !== requestSeq) return;
        svg = rendered;
      } catch (e) {
        if (seq !== requestSeq) return;
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

    <div class="score" bind:this={wrapper}>
      {#if svg}
        <!-- eslint-disable-next-line svelte/no-at-html-tags — SVG dari Verovio atas file milik repo sendiri -->
        {@html svg}
      {:else}
        <p class="muted">Merender notasi…</p>
      {/if}
    </div>
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

  .error {
    color: #a02020;
  }

  .muted {
    color: var(--muted);
  }
</style>
