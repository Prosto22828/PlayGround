import * as THREE from '../vendor/three.module.js';

// 4x4 atlas of 32px hand-drawn pixel tiles.
export const TILE = 32;
export const ATLAS_COLS = 4;
export const TILES = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  deepstone: 4,
  clay: 5,
  gravel: 6,
  coal: 7,
  copper: 8,
  iron: 9,
  gold: 10,
  diamond: 11,
  ruby: 12,
  bedrock: 13,
  core: 14,
  moss: 15,
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let ATLAS_CTX = null;
const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const shade = (c, f) => `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;

function fill(ctx, ox, oy, color) {
  ctx.fillStyle = color;
  ctx.fillRect(ox, oy, TILE, TILE);
}

function specks(ctx, ox, oy, rnd, colors, count, sizeMin = 1, sizeMax = 3) {
  for (let i = 0; i < count; i++) {
    const c = colors[(rnd() * colors.length) | 0];
    const s = sizeMin + ((rnd() * (sizeMax - sizeMin + 1)) | 0);
    ctx.fillStyle = c;
    ctx.fillRect(ox + ((rnd() * TILE) | 0), oy + ((rnd() * TILE) | 0), s, s);
  }
}

function stoneBase(ctx, ox, oy, rnd, base, dark, light) {
  fill(ctx, ox, oy, base);
  specks(ctx, ox, oy, rnd, [dark, light, base], 55, 1, 3);
  // cracks
  ctx.fillStyle = dark;
  for (let i = 0; i < 3; i++) {
    let x = (rnd() * TILE) | 0, y = (rnd() * TILE) | 0;
    for (let j = 0; j < 6; j++) {
      ctx.fillRect(ox + x, oy + y, 1, 2);
      x += rnd() > 0.5 ? 1 : -1;
      y += 1 + ((rnd() * 2) | 0);
    }
  }
}

function oreBlobs(ctx, ox, oy, rnd, colors, count = 9, minR = 2, maxR = 4) {
  for (let i = 0; i < count; i++) {
    const cx = 5 + rnd() * (TILE - 10);
    const cy = 5 + rnd() * (TILE - 10);
    const r = minR + rnd() * (maxR - minR);
    const col = colors[(rnd() * colors.length) | 0];
    ctx.fillStyle = col;
    for (let y = -r; y <= r; y += 1) {
      for (let x = -r; x <= r; x += 1) {
        if (x * x + y * y <= r * r && rnd() > 0.18) {
          ctx.fillRect(ox + Math.round(cx + x), oy + Math.round(cy + y), 1, 1);
        }
      }
    }
    // glint
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(ox + Math.round(cx - r * 0.3), oy + Math.round(cy - r * 0.4), 1, 1);
  }
}

function grassTop(ox, oy, rnd) {
  const ctx = ATLAS_CTX;
  fill(ctx, ox, oy, '#5a8f3a');
  specks(ctx, ox, oy, rnd, ['#4f7f31', '#639742', '#558637', '#6b9e47'], 70, 1, 2);
  // occasional darker clump
  ctx.fillStyle = '#4a7730';
  ctx.fillRect(ox + ((rnd() * 26) | 0), oy + ((rnd() * 26) | 0), 3, 2);
}

function grassSide(ox, oy, rnd) {
  const ctx = ATLAS_CTX;
  // dirt body
  fill(ctx, ox, oy, '#8a5a34');
  specks(ctx, ox, oy, rnd, ['#734625', '#9d6a3f', '#663d21', '#a97a4d'], 70, 1, 3);
  // grass cap
  ctx.fillStyle = '#5f9c3c';
  ctx.fillRect(ox, oy, TILE, 7);
  specks(ctx, ox, oy, rnd, ['#4c8530', '#75b24a', '#8cc35a'], 26, 1, 2);
  // fringe
  for (let x = 0; x < TILE; x++) {
    const h = 1 + ((rnd() * 5) | 0);
    ctx.fillStyle = rnd() > 0.5 ? '#548d35' : '#4c8530';
    ctx.fillRect(ox + x, oy + 7, 1, h);
  }
  ctx.fillStyle = '#3f7029';
  ctx.fillRect(ox, oy + 6, TILE, 1);
}

function coreTile(ox, oy, rnd) {
  const ctx = ATLAS_CTX;
  fill(ctx, ox, oy, '#2b1a08');
  specks(ctx, ox, oy, rnd, ['#1d1105', '#3d260c'], 40, 1, 3);
  const cx = 16, cy = 16;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < 13.5) {
        const t = 1 - d / 13.5;
        const rr = 255;
        const gg = 120 + t * 120;
        const bb = 20 + t * 150;
        ctx.fillStyle = `rgb(${rr | 0},${gg | 0},${bb | 0})`;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  }
  ctx.fillStyle = '#fff8dc';
  ctx.fillRect(ox + 14, oy + 11, 4, 10);
  ctx.fillRect(ox + 11, oy + 14, 10, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox + 15, oy + 15, 2, 2);
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * ATLAS_COLS;
  canvas.height = TILE * ATLAS_COLS;
  const ctx = canvas.getContext('2d');
  ATLAS_CTX = ctx;
  ctx.imageSmoothingEnabled = false;

  const draw = (tile, fn) => {
    const ox = (tile % ATLAS_COLS) * TILE;
    const oy = Math.floor(tile / ATLAS_COLS) * TILE;
    fn(ox, oy, mulberry32(0x9e3779b9 + tile * 7919));
  };

  draw(TILES.grassTop, grassTop);
  draw(TILES.grassSide, grassSide);
  draw(TILES.dirt, (ox, oy, rnd) => {
    fill(ctx, ox, oy, '#8a5a34');
    specks(ctx, ox, oy, rnd, ['#734625', '#9d6a3f', '#663d21', '#a97a4d', '#b98a5c'], 85, 1, 3);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#6d4a2c';
      ctx.fillRect(ox + ((rnd() * 28) | 0), oy + ((rnd() * 28) | 0), 2 + ((rnd() * 3) | 0), 1);
    }
  });
  draw(TILES.stone, (ox, oy, rnd) => stoneBase(ctx, ox, oy, rnd, '#7c7f87', '#5b5e67', '#9b9ea6'));
  draw(TILES.deepstone, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#474d62', '#33384a', '#5f6780');
    specks(ctx, ox, oy, rnd, ['#3a4157', '#6d7691', '#2c3142'], 30, 1, 2);
  });
  draw(TILES.clay, (ox, oy, rnd) => {
    fill(ctx, ox, oy, '#a5663f');
    specks(ctx, ox, oy, rnd, ['#8d5232', '#bb7b4d', '#7d472b', '#c68a5b'], 70, 1, 3);
    ctx.fillStyle = '#7d472b';
    for (let i = 0; i < 3; i++) ctx.fillRect(ox + 2, oy + 5 + i * 9, TILE - 4, 1);
  });
  draw(TILES.gravel, (ox, oy, rnd) => {
    fill(ctx, ox, oy, '#6d6b6a');
    for (let i = 0; i < 34; i++) {
      const c = ['#8d8a86', '#575553', '#9e9a92', '#77736e', '#4a4846'][(rnd() * 5) | 0];
      const s = 2 + ((rnd() * 3) | 0);
      ctx.fillStyle = c;
      ctx.fillRect(ox + ((rnd() * (TILE - s)) | 0), oy + ((rnd() * (TILE - s)) | 0), s, s);
    }
  });
  draw(TILES.coal, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#767982', '#585b64', '#92959d');
    oreBlobs(ctx, ox, oy, rnd, ['#1d1d22', '#2e2e35', '#111114', '#3d3d46'], 8, 2, 4);
  });
  draw(TILES.copper, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#7c7f87', '#5b5e67', '#9b9ea6');
    oreBlobs(ctx, ox, oy, rnd, ['#c8793b', '#e69a55', '#a85a2c', '#63b7a2'], 8, 2, 4);
  });
  draw(TILES.iron, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#797c84', '#585b64', '#9598a0');
    oreBlobs(ctx, ox, oy, rnd, ['#d8c0a8', '#efd9c0', '#b99a7e', '#a8896e'], 8, 2, 4);
  });
  draw(TILES.gold, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#4b5166', '#363b4d', '#626a82');
    oreBlobs(ctx, ox, oy, rnd, ['#ffd23f', '#ffe98a', '#e0a41c', '#fff4b8'], 9, 2, 4);
  });
  draw(TILES.diamond, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#43495d', '#2f3445', '#5b647e');
    oreBlobs(ctx, ox, oy, rnd, ['#67e8f9', '#a5f3fc', '#22b8cf', '#e0ffff'], 9, 2, 4);
  });
  draw(TILES.ruby, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#43495d', '#2f3445', '#5b647e');
    oreBlobs(ctx, ox, oy, rnd, ['#ff4d6d', '#ff8fa3', '#d61f45', '#ffd0d8'], 8, 2, 4);
  });
  draw(TILES.bedrock, (ox, oy, rnd) => {
    fill(ctx, ox, oy, '#2a2a31');
    specks(ctx, ox, oy, rnd, ['#1b1b20', '#3b3b45', '#141418', '#4a4a55'], 70, 1, 4);
    ctx.fillStyle = '#101014';
    for (let i = 0; i < 5; i++) ctx.fillRect(ox + ((rnd() * 26) | 0), oy + ((rnd() * 30) | 0), 2 + ((rnd() * 5) | 0), 1);
  });
  draw(TILES.core, coreTile);
  draw(TILES.moss, (ox, oy, rnd) => {
    stoneBase(ctx, ox, oy, rnd, '#6f7a68', '#525c4c', '#8a967f');
    specks(ctx, ox, oy, rnd, ['#4e7a3a', '#5f9146', '#3c5e2d'], 50, 1, 3);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export function tileUV(tile) {
  const col = tile % ATLAS_COLS;
  const row = Math.floor(tile / ATLAS_COLS);
  const pad = 0.0025;
  const u0 = col / ATLAS_COLS + pad;
  const u1 = (col + 1) / ATLAS_COLS - pad;
  // canvas is flipped by three; row 0 is top of the atlas
  const v1 = 1 - row / ATLAS_COLS - pad;
  const v0 = 1 - (row + 1) / ATLAS_COLS + pad;
  return [u0, v0, u1, v1];
}

export function makeCanvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeSignTexture(title, subtitle, opts = {}) {
  const bg = opts.bg || '#2b2118';
  const fg = opts.fg || '#f7ecd4';
  const accent = opts.accent || '#ffb938';
  return makeCanvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = accent;
    ctx.fillRect(34, 34, 8, h - 68);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = fg;
    ctx.font = '800 76px Outfit, sans-serif';
    ctx.fillText(title, w / 2, h * 0.42, w - 80);
    if (subtitle) {
      ctx.fillStyle = accent;
      ctx.font = '600 32px Outfit, sans-serif';
      ctx.fillText(subtitle, w / 2, h * 0.72, w - 80);
    }
  });
}
