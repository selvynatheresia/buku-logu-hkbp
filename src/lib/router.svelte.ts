// Hash-router mini. Kenapa bukan library: kebutuhan routing proyek ini cuma
// dua pola URL, dan hash-routing wajib untuk GitHub Pages (keputusan SPEC).
// Satu-satunya sumber kebenaran = location.hash; state di sini cuma cermin reaktifnya.

export type Route =
  | { name: 'home' }
  | { name: 'hymn'; loguNo: number }
  | { name: 'not-found'; hash: string };

function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (h === '' || h === '/') return { name: 'home' };
  const m = h.match(/^\/logu\/(\d{1,3})$/);
  if (m) return { name: 'hymn', loguNo: Number(m[1]) };
  return { name: 'not-found', hash: h };
}

let current = $state<Route>(parseHash(location.hash));

window.addEventListener('hashchange', () => {
  current = parseHash(location.hash);
});

export const router = {
  get route(): Route {
    return current;
  },
};
