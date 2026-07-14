// PWA用アイコンPNGを外部依存なしで生成するスクリプト(Node標準のzlibのみ使用)
// 使い方: node scripts/generate-icons.mjs
// デザイン: ダーク背景に「的(ターゲット)」— 青リング×2 + 白のブルズアイ
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);

// ---- 最小限のPNGエンコーダ(RGBA・フィルタ0) ----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(
    crc32(Buffer.concat([Buffer.from(type, "ascii"), data])),
    8 + data.length,
  );
  return out;
}

function encodePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // 幅
  ihdr.writeUInt32BE(size, 4); // 高さ
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // カラータイプ: RGBA
  // 各行の先頭にフィルタ種別0を付与してから deflate
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 描画 ----
const BG = [0x0f, 0x17, 0x2a]; // slate-900(manifestのtheme_colorと一致)
const BLUE = [0x39, 0x87, 0xe5]; // 検証済みシリーズカラー
const WHITE = [0xf8, 0xfa, 0xfc];

/**
 * 的のアイコンを描画してRGBAバッファを返す
 * @param {number} size 一辺のピクセル数
 * @param {number} scale 最外周リングの半径(sizeに対する比率)。maskableは小さめに
 */
function drawIcon(size, scale) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const R = size * scale;
  // 外側から順に: 青リング → 背景 → 青リング → 背景 → 白の中心
  const rings = [
    [R, BLUE],
    [R * 0.76, BG],
    [R * 0.55, BLUE],
    [R * 0.34, BG],
    [R * 0.19, WHITE],
  ];
  const SUB = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 2x2サブサンプリングで輪郭を滑らかにする
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [dx, dy] of SUB) {
        const d = Math.hypot(x + dx - c, y + dy - c);
        let col = BG;
        // ringsは半径の降順なので、最後に一致した(最小の)リング色が採用される
        for (const [radius, ringCol] of rings) if (d <= radius) col = ringCol;
        r += col[0];
        g += col[1];
        b += col[2];
      }
      const i = (y * size + x) * 4;
      rgba[i] = r / 4;
      rgba[i + 1] = g / 4;
      rgba[i + 2] = b / 4;
      rgba[i + 3] = 255; // 完全不透明(背景で塗りつぶし)
    }
  }
  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  ["icon-180.png", 180, 0.42], // iOS apple-touch-icon
  ["icon-192.png", 192, 0.42],
  ["icon-512.png", 512, 0.42],
  ["icon-512-maskable.png", 512, 0.32], // maskable: セーフゾーン(中央80%)に収める
];

for (const [name, size, scale] of TARGETS) {
  const png = encodePng(size, drawIcon(size, scale));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`生成: public/icons/${name} (${size}x${size}, ${png.length} bytes)`);
}
