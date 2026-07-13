import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { registerSW } from 'virtual:pwa-register';

// Service worker hanya di build produksi — SW di dev server bikin cache
// membingungkan saat development. Tes offline dilakukan lewat `npm run build`
// + `npm run preview` (atau deployment beneran).
if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

const app = mount(App, { target: document.getElementById('app')! });

export default app;
