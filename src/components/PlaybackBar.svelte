<script lang="ts">
  import { createPlayer } from '../audio/player';
  import type { Player, PlayerState } from '../audio/player';
  import type { PlaybackScore } from '../music/playback';

  let { playback }: { playback: PlaybackScore } = $props();

  // Player = objek imperatif (bukan $state); UI memegang cermin reaktifnya.
  let player: Player | null = null;
  let playState = $state<PlayerState>('stopped');
  // svelte-ignore state_referenced_locally — nilai awal memang yang diinginkan;
  // pindah lagu me-remount komponen ini via {#key playback}
  let tempo = $state(playback.tempoBpm ?? 90);
  let busy = $state(false);
  let muted = $state<Record<string, boolean>>({});
  let soloed = $state<Record<string, boolean>>({});

  // Player dibuat malas di tap pertama: chunk Tone.js baru diunduh saat
  // audio benar-benar dipakai. Pembuatan (~ratusan ms) masih dalam jendela
  // transient activation, jadi Tone.start() di dalam play() tetap ter-unlock
  // di iOS/Android — diverifikasi di checklist device asli.
  async function ensurePlayer(): Promise<Player | null> {
    if (player) return player;
    if (busy) return null; // tahan klik dobel saat inisialisasi
    busy = true;
    try {
      const p = await createPlayer(playback);
      p.onEnded = () => (playState = 'stopped');
      p.setTempo(tempo);
      // pulihkan mute/solo yang sempat diubah sebelum player ada
      for (const [id, m] of Object.entries(muted)) p.setMute(id, m);
      for (const [id, s] of Object.entries(soloed)) p.setSolo(id, s);
      player = p;
      return p;
    } finally {
      busy = false;
    }
  }

  async function onPlayPause() {
    const p = await ensurePlayer();
    if (!p) return;
    if (playState === 'playing') {
      p.pause();
    } else {
      await p.play();
    }
    playState = p.state;
  }

  function onStop() {
    player?.stop();
    playState = 'stopped';
  }

  async function onStartingPitches() {
    const p = await ensurePlayer();
    await p?.playStartingPitches();
  }

  function onTempoInput(e: Event) {
    tempo = Number((e.currentTarget as HTMLInputElement).value);
    player?.setTempo(tempo);
  }

  function toggleMute(id: string) {
    muted[id] = !muted[id];
    player?.setMute(id, muted[id]);
  }

  function toggleSolo(id: string) {
    soloed[id] = !soloed[id];
    player?.setSolo(id, soloed[id]);
  }

  // Cleanup saat komponen dilepas (pindah lagu/halaman): matikan transport,
  // lepaskan node WebAudio — kebocoran di sini bikin audio pecah lama-lama.
  $effect(() => () => player?.dispose());
</script>

<div class="playback">
  <div class="transport-row">
    <button class="primary" onclick={onPlayPause} disabled={busy}>
      {playState === 'playing' ? '⏸ Pause' : '▶ Main'}
    </button>
    <button onclick={onStop} disabled={playState === 'stopped'}>⏹ Stop</button>
    <button onclick={onStartingPitches} disabled={busy} title="Pitch pertama tiap suara, untuk dirigen/koor">
      ♪ Nada awal
    </button>
    <label class="tempo">
      <span>Tempo {tempo}</span>
      <input type="range" min="40" max="200" step="2" value={tempo} oninput={onTempoInput} />
    </label>
  </div>

  {#if playback.voices.length > 1}
    <div class="voices">
      {#each playback.voices as v (v.id)}
        <span class="voice-chip">
          {v.label}
          <button class:on={muted[v.id]} onclick={() => toggleMute(v.id)} title="Bisukan suara ini">M</button>
          <button class:on={soloed[v.id]} onclick={() => toggleSolo(v.id)} title="Solo: bisukan suara lain">S</button>
        </span>
      {/each}
    </div>
  {/if}

  {#if playback.hasRepeats || playback.hasFermata}
    <p class="flags">
      {#if playback.hasRepeats}
        ⚠ Tanda ulang belum dimainkan playback (Fase 1: linear sekali jalan).
      {/if}
      {#if playback.hasFermata}
        ℹ Fermata: durasi ekstra diabaikan playback Fase 1.
      {/if}
    </p>
  {/if}
</div>

<style>
  .playback {
    background: var(--card);
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    box-shadow: 0 1px 2px rgb(0 0 0 / 8%);
    margin-bottom: 0.75rem;
  }

  .transport-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  button {
    font: inherit;
    border: 1px solid var(--accent);
    border-radius: 0.4rem;
    background: var(--card);
    color: var(--accent);
    padding: 0.4rem 0.8rem;
    cursor: pointer;
    min-height: 44px; /* target sentuh tablet */
  }

  button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  button.primary {
    background: var(--accent);
    color: var(--on-accent);
    min-width: 6.5rem;
  }

  .tempo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    color: var(--muted);
    font-size: 0.9rem;
  }

  .tempo input {
    width: 8rem;
  }

  .voices {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.5rem;
  }

  .voice-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    border: 1px solid var(--muted);
    border-radius: 2rem;
    padding: 0.15rem 0.3rem 0.15rem 0.7rem;
    font-size: 0.85rem;
  }

  .voice-chip button {
    min-height: 32px;
    min-width: 32px;
    padding: 0.1rem 0.45rem;
    border-radius: 50%;
    font-size: 0.75rem;
  }

  .voice-chip button.on {
    background: var(--accent);
    color: var(--on-accent);
  }

  .flags {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
</style>
