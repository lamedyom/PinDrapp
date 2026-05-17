// Generate PNG app icons (192 + 512) from an SVG K-pin mark.
// Uses node:zlib + minimal PNG encoder so we don't need a binary canvas dep.
// Result writes to /public/icon-192.png and /public/icon-512.png.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ORANGE = [0xff, 0x5c, 0x1a];
const WHITE = [0xff, 0xff, 0xff];

function makeIcon(size, outPath) {
  const radius = Math.round(size * 0.22);
  const w = size;
  const h = size;
  const pixels = new Uint8Array(w * h * 4);
  // Fill with orange (rounded square)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = inRoundedRect(x, y, w, h, radius);
      const idx = (y * w + x) * 4;
      if (inside) {
        pixels[idx] = ORANGE[0];
        pixels[idx + 1] = ORANGE[1];
        pixels[idx + 2] = ORANGE[2];
        pixels[idx + 3] = 0xff;
      } else {
        pixels[idx + 3] = 0; // transparent corners
      }
    }
  }

  // Draw a simple white pin (circle + tail) centered
  const cx = w / 2;
  const cy = h * 0.42;
  const r = w * 0.22;
  const tailTop = cy + r * 0.7;
  const tailBottom = h * 0.82;
  const tailHalfWidth = r * 0.4;

  // Pin head: filled white circle, inner orange hole
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        plot(pixels, w, x, y, WHITE);
      }
      if (dist <= r * 0.42) {
        plot(pixels, w, x, y, ORANGE);
      }
      // Tail (triangle)
      if (y >= tailTop && y <= tailBottom) {
        const t = (y - tailTop) / (tailBottom - tailTop);
        const halfW = tailHalfWidth * (1 - t);
        if (Math.abs(x - cx) <= halfW) {
          plot(pixels, w, x, y, WHITE);
        }
      }
    }
  }

  fs.writeFileSync(outPath, encodePng(w, h, pixels));
  console.log(`wrote ${outPath}`);
}

function plot(pixels, width, x, y, color) {
  const idx = (y * width + x) * 4;
  pixels[idx] = color[0];
  pixels[idx + 1] = color[1];
  pixels[idx + 2] = color[2];
  pixels[idx + 3] = 0xff;
}

function inRoundedRect(x, y, w, h, r) {
  const cx = Math.max(r, Math.min(w - 1 - r, x));
  const cy = Math.max(r, Math.min(h - 1 - r, y));
  const dx = x - cx;
  const dy = y - cy;
  return Math.hypot(dx, dy) <= r + 0.5;
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (width * 4 + 1) + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const idatData = zlib.deflateSync(raw);

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput) >>> 0, 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const CRC_TABLE = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const outDir = path.resolve(__dirname, '..', 'public');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
makeIcon(192, path.join(outDir, 'icon-192.png'));
makeIcon(512, path.join(outDir, 'icon-512.png'));
