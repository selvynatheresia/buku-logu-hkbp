<script lang="ts">
  import { settings, TEXT_SCALES, THEMES } from '../lib/settings.svelte';

  let open = $state(false);
</script>

<!-- Pengaturan tampilan: sengaja di header (bukan halaman hymn) — pemakaian
     live anti salah-pencet; tombol "Aa" lebih bermakna bagi pengguna awam
     daripada ikon roda gigi. -->
<div class="settings">
  <button
    class="gear"
    aria-expanded={open}
    aria-label="Pengaturan tampilan"
    onclick={() => (open = !open)}
  >
    Aa
  </button>
  {#if open}
    <div class="panel" role="dialog" aria-label="Pengaturan tampilan">
      <p class="label" id="lbl-ukuran">Ukuran teks</p>
      <div class="row" role="group" aria-labelledby="lbl-ukuran">
        {#each TEXT_SCALES as s (s.value)}
          <button class:on={settings.scale === s.value} onclick={() => settings.setScale(s.value)}>
            {s.label}
          </button>
        {/each}
      </div>
      <p class="label" id="lbl-tema">Tema</p>
      <div class="row" role="group" aria-labelledby="lbl-tema">
        {#each THEMES as t (t.value)}
          <button class:on={settings.theme === t.value} onclick={() => settings.setTheme(t.value)}>
            {t.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .settings {
    position: relative;
    margin-left: auto;
  }

  .gear {
    font: inherit;
    font-weight: 700;
    background: transparent;
    color: var(--on-accent);
    border: 1px solid currentColor;
    border-radius: 0.4rem;
    min-width: 44px;
    min-height: 44px;
    cursor: pointer;
  }

  .panel {
    position: absolute;
    right: 0;
    top: calc(100% + 0.4rem);
    background: var(--card);
    color: var(--ink);
    border: 1px solid var(--hairline);
    border-radius: 0.6rem;
    box-shadow: 0 4px 16px rgb(0 0 0 / 22%);
    padding: 0.75rem;
    min-width: 15rem;
    z-index: 20;
  }

  .label {
    margin: 0 0 0.35rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .label + .row {
    margin-bottom: 0.8rem;
  }

  .row {
    display: flex;
    gap: 0.4rem;
  }

  .row button {
    font: inherit;
    flex: 1;
    min-height: 44px;
    border: 1px solid var(--accent);
    border-radius: 0.4rem;
    background: var(--card);
    color: var(--accent);
    cursor: pointer;
  }

  .row button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
