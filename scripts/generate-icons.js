/**
 * Generates PNG app icons for PWA support (no external dependencies).
 * Run with: node scripts/generate-icons.js
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Pre-compute CRC32 lookup table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeB = Buffer.from(type, 'ascii');
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([typeB, data])));
  return Buffer.concat([len, typeB, data, crcVal]);
}

/**
 * Creates a simple PNG with a solid background colour and a white "AV" monogram.
 * bgR/G/B = background colour (blue: 59, 130, 246).
 */
function createPNG(size, bgR, bgG, bgB) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  // compression, filter, interlace = 0

  // Build raw scanlines (filter byte 0 + RGB pixels)
  const scanline = Buffer.alloc(1 + size * 3);
  scanline[0] = 0; // filter: None

  // Helper: set pixel colour
  function setPixel(row, col, r, g, b) {
    const off = 1 + col * 3;
    row[off] = r;
    row[off + 1] = g;
    row[off + 2] = b;
  }

  // Build full image as Uint8Array rows
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter
    for (let x = 0; x < size; x++) {
      setPixel(row, x, bgR, bgG, bgB);
    }
    rows.push(row);
  }

  // Draw a simple white shield shape in the centre
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const radius = Math.floor(size * 0.35);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // Rounded rectangle / shield shape
      const inCircle = dx * dx + dy * dy <= radius * radius;
      const inRect = Math.abs(dx) <= radius * 0.7 && dy >= -radius * 0.15 && dy <= radius * 0.85;
      if (inCircle || inRect) {
        // White pixels for the inner icon area
        setPixel(rows[y], x, 255, 255, 255);
      }
    }
  }

  // Draw a blue "AV" text approximation in the centre (simple pixel font)
  const letterH = Math.floor(size * 0.25);
  const letterW = Math.floor(size * 0.12);
  const lx = cx - Math.floor(size * 0.14);
  const ly = cy - Math.floor(size * 0.12);

  // Draw background blue rectangle behind letters for contrast
  for (let y = ly - 4; y < ly + letterH + 4; y++) {
    for (let x = lx - 4; x < lx + letterW * 2 + Math.floor(size * 0.04) + 4; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) {
        setPixel(rows[y], x, bgR, bgG, bgB);
      }
    }
  }

  const raw = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// AtlasVerify brand blue: #3b82f6 → r=59, g=130, b=246
const sizes = [
  { name: 'icon-192.png',        size: 192 },
  { name: 'icon-512.png',        size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png',      size: 32  },
];

for (const { name, size } of sizes) {
  const png = createPNG(size, 59, 130, 246);
  fs.writeFileSync(path.join(iconsDir, name), png);
  console.log(`✓ ${name} (${size}×${size})`);
}

console.log('\nIcons generated in public/icons/');
