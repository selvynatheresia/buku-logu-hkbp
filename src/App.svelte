<script lang="ts">
  import { router } from './lib/router.svelte';
  import HomePage from './pages/HomePage.svelte';
  import HymnPage from './pages/HymnPage.svelte';
  import SettingsPanel from './components/SettingsPanel.svelte';
</script>

<header class="app-header">
  <a class="brand" href="#/">Buku Logu HKBP</a>
  <span class="phase">Fase 0 · walking skeleton</span>
  <SettingsPanel />
</header>

<main>
  {#if router.route.name === 'home'}
    <HomePage />
  {:else if router.route.name === 'hymn'}
    <HymnPage loguNo={router.route.loguNo} />
  {:else}
    <p class="not-found">
      Halaman tidak ditemukan. <a href="#/">Kembali ke daftar lagu</a>
    </p>
  {/if}
</main>

<style>
  .app-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--accent);
    color: var(--on-accent);
  }

  .brand {
    color: var(--on-accent);
    text-decoration: none;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .phase {
    font-size: 0.75rem;
    opacity: 0.75;
  }

  main {
    max-width: 60rem;
    margin: 0 auto;
    padding: 1rem;
  }

  .not-found {
    color: var(--muted);
  }
</style>
