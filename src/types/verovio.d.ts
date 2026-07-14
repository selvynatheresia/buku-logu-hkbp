// Package verovio (6.x) tidak menyertakan type definitions —
// deklarasi minimal ini hanya mencakup permukaan API yang kita pakai.
// Referensi: https://book.verovio.org/toolkit-reference/toolkit-methods.html

declare module 'verovio/wasm' {
  /** Inisialisasi module WASM Verovio (binary ter-embed di file .mjs-nya). */
  export default function createVerovioModule(): Promise<unknown>;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    renderToSVG(page?: number): string;
    getPageCount(): number;
    getVersion(): string;
    /** Ekspor MEI dari data yang dimuat — dipakai test oracle transpose. */
    getMEI(options?: Record<string, unknown>): string;
  }
}
