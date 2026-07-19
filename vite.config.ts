/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Base relatif: aman untuk GitHub Pages project site (nama repo belum final).
  // Hash-routing membuat semua path relatif tetap resolve ke root deployment.
  base: './',
  plugins: [
    svelte(),
    VitePWA({
      // injectManifest = service worker tetap KODE KITA (src/sw.ts);
      // plugin hanya menyuntik daftar asset app-shell ber-hash (self.__WB_MANIFEST).
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false, // registrasi manual di main.ts
      manifest: {
        name: 'Buku Logu HKBP',
        short_name: 'Buku Logu',
        description:
          'Buku Logu HKBP digital — notasi balok, not angka, lirik semua bait; offline-first.',
        lang: 'id',
        display: 'standalone',
        orientation: 'any',
        background_color: '#faf7f2',
        theme_color: '#031e66',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm}'],
        // Chunk verovio ~7 MB (WASM inline base64) WAJIB ikut precache
        // supaya render balok jalan offline; default limit workbox cuma 2 MB.
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
