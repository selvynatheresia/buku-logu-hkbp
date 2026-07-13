import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // vitePreprocess memproses <script lang="ts"> di komponen Svelte
  preprocess: vitePreprocess(),
};
