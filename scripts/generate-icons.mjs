// Generator ikon PWA placeholder (PNG solid + lingkaran) tanpa dependency —
// cukup zlib bawaan Node. Ganti dengan ikon desain beneran nanti; script ini
// ada supaya PWA installable sejak hari pertama.
//
// Pakai: node scripts/generate-icons.mjs

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** PNG persegi: latar biru tua (#1e3a5f), lingkaran krem (#faf7f2) di tengah. */
function makeIconPng(size) {
  const bg = [0x1e, 0x3a, 0x5f];
  const fg = [0xfa, 0xf7, 0xf2];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;

  const raw = Buffer.alloc(size * (1 + size * 4));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const inside = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
      const [rr, gg, bb] = inside ? fg : bg;
      raw[off++] = rr;
      raw[off++] = gg;
      raw[off++] = bb;
      raw[off++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  // [10..12] compression/filter/interlace = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, makeIconPng(size));
  console.log(`ditulis: ${file}`);
}
