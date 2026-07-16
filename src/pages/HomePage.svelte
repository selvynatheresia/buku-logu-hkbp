<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchManifest } from '../lib/hymns';
  import type { HymnsManifest } from '../lib/types';

  let manifest = $state<HymnsManifest | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      manifest = await fetchManifest();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  });
</script>

<h1>Daftar Lagu</h1>

{#if error}
  <p class="error">{error}</p>
{:else if !manifest}
  <p class="muted">Memuat…</p>
{:else}
  <ul class="hymn-list">
    {#each manifest.hymns as hymn (hymn.id)}
      <li>
        <a href={`#/logu/${hymn.logu_no}`}>
          <span class="no">{hymn.logu_no}</span>
          <span class="title">{hymn.title}</span>
        </a>
      </li>
    {/each}
  </ul>

  <!-- Colophon: hanya di halaman daftar — halaman hymn dipakai live saat
       ibadah, harus bebas dari apa pun yang bukan musik. -->
  <footer class="colophon">
    <p>Dibuat oleh <strong>Selvyna Theresia Sibarani</strong></p>
    <p>Kode open-source (MIT) · Notasi &amp; lirik: hak milik pemegangnya masing-masing</p>
  </footer>
{/if}

<style>
  .hymn-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .hymn-list a {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--card);
    border-radius: 0.5rem;
    text-decoration: none;
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
  }

  .no {
    font-weight: 700;
    min-width: 2.5rem;
    color: var(--accent);
  }

  .title {
    color: var(--ink);
  }

  .error {
    color: #a02020;
  }

  .muted {
    color: var(--muted);
  }

  /* Colophon "berbisik": kecil, redup, dipisah hairline — hierarki visual
     memastikan daftar lagu tetap satu-satunya fokus halaman. */
  .colophon {
    margin-top: 3rem;
    padding: 1rem 0 0.5rem;
    border-top: 1px solid rgb(0 0 0 / 10%);
    text-align: center;
    font-size: 0.8rem;
    color: var(--muted);
    line-height: 1.6;
  }

  .colophon p {
    margin: 0;
  }

  .colophon strong {
    font-weight: 600;
    color: inherit;
  }
</style>
