// Pengaturan aksesibilitas (Batch D) — ukuran teks & tema, persisten per
// perangkat. Jemaat pengguna banyak yang berusia lanjut: perbesar teks =
// RE-LAYOUT penuh (UI ikut rem, notasi ikut parameter renderer), bukan zoom
// yang merusak baris; tema kontras tinggi untuk kondisi cahaya ekstrem.

export type TextScale = 1 | 1.15 | 1.3 | 1.5;
export type Theme = 'terang' | 'gelap' | 'kontras';

export const TEXT_SCALES: { value: TextScale; label: string }[] = [
  { value: 1, label: 'A' },
  { value: 1.15, label: 'A+' },
  { value: 1.3, label: 'A++' },
  { value: 1.5, label: 'A+++' },
];

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'terang', label: 'Terang' },
  { value: 'gelap', label: 'Gelap' },
  { value: 'kontras', label: 'Kontras' },
];

const KEY = 'bl-settings';

function load(): { scale: TextScale; theme: Theme } {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const scale = TEXT_SCALES.some((s) => s.value === raw.scale) ? raw.scale : 1;
    const theme = THEMES.some((t) => t.value === raw.theme) ? raw.theme : 'terang';
    return { scale, theme };
  } catch {
    return { scale: 1, theme: 'terang' };
  }
}

const initial = load();
let scale = $state<TextScale>(initial.scale);
let theme = $state<Theme>(initial.theme);

function apply(): void {
  // UI berbasis rem → skala root menskalakan seluruh antarmuka;
  // notasi membaca settings.scale sendiri lewat parameter renderer
  document.documentElement.style.fontSize = `${16 * scale}px`;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, JSON.stringify({ scale, theme }));
  } catch {
    // preferensi saja yang tidak tersimpan
  }
}

apply();

export const settings = {
  get scale(): TextScale {
    return scale;
  },
  get theme(): Theme {
    return theme;
  },
  setScale(v: TextScale) {
    scale = v;
    apply();
  },
  setTheme(v: Theme) {
    theme = v;
    apply();
  },
};
