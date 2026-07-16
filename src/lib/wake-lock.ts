// Wake lock — layar tidak boleh mati saat app terbuka di music stand
// (fitur wajib Fase 1 #8; pemakaian live saat ibadah).

/**
 * Minta screen wake lock; kembalikan fungsi pelepas (cocok untuk cleanup
 * $effect Svelte). Gagal minta (browser lama, battery saver) = degradasi
 * halus tanpa error — app tetap jalan, layar saja yang ikut kebijakan OS.
 */
export function acquireWakeLock(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let released = false;

  async function request(): Promise<void> {
    if (released || !('wakeLock' in navigator)) return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // ditolak — bukan fatal
    }
  }

  // OS otomatis melepas lock saat tab tersembunyi; minta ulang begitu terlihat lagi
  const onVisibility = () => {
    if (document.visibilityState === 'visible') void request();
  };
  document.addEventListener('visibilitychange', onVisibility);
  void request();

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release();
    sentinel = null;
  };
}
