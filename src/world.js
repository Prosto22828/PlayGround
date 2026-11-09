import * as THREE from '../vendor/three.module.js';
import { createAtlas, tileUV, TILES } from './textures.js';

export const WORLD_X = 64;
export const WORLD_Y = 112;
export const WORLD_Z = 64;
export const SURFACE = 96;
export const CHUNK = 16;

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  DEEPSTONE: 4,
  CLAY: 5,
  GRAVEL: 6,
  COAL: 7,
  COPPER: 8,
  IRON: 9,
  GOLD: 10,
  DIAMOND: 11,
  RUBY: 12,
  BEDROCK: 13,
  CORE: 14,
  MOSS: 15,
};

// face order: +X, -X, +Y, -Y, +Z, -Z
export const BLOCKS = {
  [BLOCK.GRASS]: {
    name: 'Grass', tiles: [TILES.grassSide, TILES.grassSide, TILES.grassTop, TILES.dirt, TILES.grassSide, TILES.grassSide],
    hardness: 0.5, value: 0.4, weight: 0.4, power: 1, color: '#5f9c3c', glow: 0, kind: 'material',
  },
  [BLOCK.DIRT]: {
    name: 'Dirt', tiles: [TILES.dirt, TILES.dirt, TILES.dirt, TILES.dirt, TILES.dirt, TILES.dirt],
    hardness: 0.42, value: 0.45, weight: 0.35, power: 1, color: '#8a5a34', glow: 0, kind: 'material',
  },
  [BLOCK.STONE]: {
    name: 'Stone', tiles: [TILES.stone, TILES.stone, TILES.stone, TILES.stone, TILES.stone, TILES.stone],
    hardness: 1.0, value: 0.8, weight: 0.9, power: 1, color: '#7c7f87', glow: 0, kind: 'material',
  },
  [BLOCK.DEEPSTONE]: {
    name: 'Deepstone', tiles: [TILES.deepstone, TILES.deepstone, TILES.deepstone, TILES.deepstone, TILES.deepstone, TILES.deepstone],
    hardness: 1.5, value: 1.4, weight: 1.1, power: 2, color: '#474d62', glow: 0, kind: 'material',
  },
  [BLOCK.CLAY]: {
    name: 'Clay', tiles: [TILES.clay, TILES.clay, TILES.clay, TILES.clay, TILES.clay, TILES.clay],
    hardness: 0.65, value: 0.6, weight: 0.8, power: 1, color: '#a5663f', glow: 0, kind: 'material',
  },
  [BLOCK.GRAVEL]: {
    name: 'Gravel', tiles: [TILES.gravel, TILES.gravel, TILES.gravel, TILES.gravel, TILES.gravel, TILES.gravel],
    hardness: 0.55, value: 0.5, weight: 0.7, power: 1, color: '#6d6b6a', glow: 0, kind: 'material',
  },
  [BLOCK.COAL]: {
    name: 'Coal', tiles: [TILES.coal, TILES.coal, TILES.coal, TILES.coal, TILES.coal, TILES.coal],
    hardness: 0.7, value: 4, weight: 0.8, power: 1, color: '#26262d', glow: 0.16, kind: 'ore',
  },
  [BLOCK.COPPER]: {
    name: 'Copper', tiles: [TILES.copper, TILES.copper, TILES.copper, TILES.copper, TILES.copper, TILES.copper],
    hardness: 0.9, value: 9, weight: 1.2, power: 1, color: '#c8793b', glow: 0.2, kind: 'ore',
  },
  [BLOCK.IRON]: {
    name: 'Iron', tiles: [TILES.iron, TILES.iron, TILES.iron, TILES.iron, TILES.iron, TILES.iron],
    hardness: 1.2, value: 20, weight: 1.6, power: 2, color: '#d8c0a8', glow: 0.24, kind: 'ore',
  },
  [BLOCK.GOLD]: {
    name: 'Gold', tiles: [TILES.gold, TILES.gold, TILES.gold, TILES.gold, TILES.gold, TILES.gold],
    hardness: 1.4, value: 52, weight: 1.2, power: 2, color: '#ffd23f', glow: 0.4, kind: 'ore',
  },
  [BLOCK.DIAMOND]: {
    name: 'Diamond', tiles: [TILES.diamond, TILES.diamond, TILES.diamond, TILES.diamond, TILES.diamond, TILES.diamond],
    hardness: 1.9, value: 135, weight: 0.5, power: 3, color: '#67e8f9', glow: 0.55, kind: 'ore',
  },
  [BLOCK.RUBY]: {
    name: 'Ruby', tiles: [TILES.ruby, TILES.ruby, TILES.ruby, TILES.ruby, TILES.ruby, TILES.ruby],
    hardness: 2.3, value: 250, weight: 0.5, power: 3, color: '#ff4d6d', glow: 0.5, kind: 'ore',
  },
  [BLOCK.BEDROCK]: {
    name: 'Bedrock', tiles: [TILES.bedrock, TILES.bedrock, TILES.bedrock, TILES.bedrock, TILES.bedrock, TILES.bedrock],
    hardness: Infinity, value: 0, weight: 0, power: 99, color: '#2a2a31', glow: 0, kind: 'material',
  },
  [BLOCK.CORE]: {
    name: 'Heart of the Hole', tiles: [TILES.core, TILES.core, TILES.core, TILES.core, TILES.core, TILES.core],
    hardness: 2.6, value: 0, weight: 1, power: 3, color: '#ffb938', glow: 1, kind: 'core',
  },
  [BLOCK.MOSS]: {
    name: 'Mossy Stone', tiles: [TILES.moss, TILES.moss, TILES.moss, TILES.moss, TILES.moss, TILES.moss],
    hardness: 0.95, value: 0.7, weight: 0.9, power: 1, color: '#6f7a68', glow: 0, kind: 'material',
  },
};

export const SELL_ORDER = [BLOCK.RUBY, BLOCK.DIAMOND, BLOCK.GOLD, BLOCK.IRON, BLOCK.COPPER, BLOCK.COAL, BLOCK.DEEPSTONE, BLOCK.STONE, BLOCK.MOSS, BLOCK.GRAVEL, BLOCK.CLAY, BLOCK.DIRT, BLOCK.GRASS];

const FACES = [
  { n: [1, 0, 0], p: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], p: [0, 0, 1], u: [0, 1, 0], v: [0, 0, -1] },
  { n: [0, 1, 0], p: [0, 1, 1], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], p: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], p: [1, 0, 1], u: [0, 1, 0], v: [-1, 0, 0] },
  { n: [0, 0, -1], p: [0, 0, 0], u: [0, 1, 0], v: [1, 0, 0] },
];

const AO_LEVEL = [0.5, 0.69, 0.85, 1];

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) / 4294967295);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) { return t * t * (3 - 2 * t); }

function valueNoise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz;
}

function base64FromBytes(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

function bytesFromBase64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.seed = seed | 0;
    this.voxels = new Uint8Array(WORLD_X * WORLD_Y * WORLD_Z);
    this.surfaceHeights = new Int16Array(WORLD_X * WORLD_Z);
    this.chunkGroup = new THREE.Group();
    this.chunkGroup.name = 'voxel-world';
    this.scene.add(this.chunkGroup);
    this.chunks = new Map();
    this.dirty = new Set();
    this.coreBlock = new THREE.Vector3(0, SURFACE - 82, 0);
    this.corePos = new THREE.Vector3(0.5, SURFACE - 82 + 0.5, 0.5);
    this.coreLight = null;

    const atlas = createAtlas();
    this.material = new THREE.MeshLambertMaterial({
      map: atlas,
      vertexColors: true,
      fog: true,
    });
    this.material.name = 'voxel';
  }

  idx(x, y, z) {
    return (y * WORLD_Z + z) * WORLD_X + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < WORLD_X && y >= 0 && y < WORLD_Y && z >= 0 && z < WORLD_Z;
  }

  get(x, y, z) {
    if (!this.inBounds(x, y, z)) return 0;
    return this.voxels[this.idx(x, y, z)];
  }

  isSolid(x, y, z) {
    if (y >= WORLD_Y) return false;
    if (x < 0 || x >= WORLD_X || z < 0 || z >= WORLD_Z || y < 0) return true;
    return this.voxels[this.idx(x, y, z)] !== 0;
  }

  set(x, y, z, block) {
    if (!this.inBounds(x, y, z)) return;
    this.voxels[this.idx(x, y, z)] = block;
    this.markDirty(x, y, z);
  }

  surfaceHeight(x, z) {
    const ix = Math.max(0, Math.min(WORLD_X - 1, Math.floor(x)));
    const iz = Math.max(0, Math.min(WORLD_Z - 1, Math.floor(z)));
    return this.surfaceHeights[iz * WORLD_X + ix];
  }

  // world coordinate (block centers are .5)
  topAt(x, z) {
    return this.surfaceHeight(x, z) + 1;
  }

  generate() {
    const rnd = mulberry32(this.seed);
    const vox = this.voxels;
    vox.fill(0);

    const heightNoiseSeed = (this.seed * 13 + 7) | 0;
    for (let x = 0; x < WORLD_X; x++) {
      for (let z = 0; z < WORLD_Z; z++) {
        const wx = x - WORLD_X / 2;
        const wz = z - WORLD_Z / 2;
        const edge = Math.max(Math.abs(wx), Math.abs(wz));
        const blend = Math.max(0, Math.min(1, (edge - 17) / 12));
        let h = SURFACE;
        if (blend > 0) {
          const n = valueNoise2(x * 0.075, z * 0.075, heightNoiseSeed) * 2.6 +
                    valueNoise2(x * 0.19, z * 0.19, heightNoiseSeed + 9) * 0.9;
          h += Math.round((n - 1.2) * blend * 1.6);
        }
        h = Math.max(SURFACE - 3, Math.min(SURFACE + 3, h));
        this.surfaceHeights[z * WORLD_X + x] = h;

        for (let y = 0; y <= h; y++) {
          const d = h - y;
          let b = BLOCK.STONE;
          if (y <= 1) b = BLOCK.BEDROCK;
          else if (d === 0) b = BLOCK.GRASS;
          else if (d <= 3) b = BLOCK.DIRT;
          else if (d <= 8) {
            const n = valueNoise2(x * 0.12, z * 0.12, this.seed + 31) + valueNoise2(x * 0.31, z * 0.31, this.seed + 77) * 0.5;
            b = n > 0.85 ? BLOCK.CLAY : (n < 0.55 ? BLOCK.GRAVEL : BLOCK.DIRT);
          } else if (d <= 24) {
            const n = valueNoise2(x * 0.09, z * 0.09, this.seed + 55) + valueNoise2(x * 0.27, z * 0.27, this.seed + 101) * 0.4;
            b = n > 1.05 ? BLOCK.CLAY : (n < 0.62 ? BLOCK.GRAVEL : BLOCK.STONE);
          } else if (d <= 46) {
            const n = valueNoise2(x * 0.08, z * 0.08, this.seed + 141);
            b = n > 0.72 ? BLOCK.GRAVEL : (n < 0.25 ? BLOCK.DEEPSTONE : BLOCK.STONE);
          } else {
            b = d > 54 && valueNoise2(x * 0.16, z * 0.16, this.seed + 201) > 0.7 ? BLOCK.STONE : BLOCK.DEEPSTONE;
          }
          if (d <= 10 && d > 3 && valueNoise2(x * 0.5, z * 0.5, this.seed + 303) > 0.82) b = BLOCK.MOSS;
          vox[this.idx(x, y, z)] = b;
        }
      }
    }

    // ore veins
    const plans = [
      { b: BLOCK.COAL, veins: 120, size: 9, d0: 3, d1: 26 },
      { b: BLOCK.COPPER, veins: 95, size: 8, d0: 7, d1: 38 },
      { b: BLOCK.IRON, veins: 80, size: 8, d0: 17, d1: 54 },
      { b: BLOCK.GOLD, veins: 55, size: 7, d0: 34, d1: 72 },
      { b: BLOCK.DIAMOND, veins: 34, size: 6, d0: 52, d1: 90 },
      { b: BLOCK.RUBY, veins: 18, size: 5, d0: 68, d1: 94 },
    ];
    for (const plan of plans) {
      for (let v = 0; v < plan.veins; v++) {
        let x = 3 + Math.floor(rnd() * (WORLD_X - 6));
        let z = 3 + Math.floor(rnd() * (WORLD_Z - 6));
        const h = this.surfaceHeights[z * WORLD_X + x];
        const depth = plan.d0 + rnd() * (plan.d1 - plan.d0);
        let y = Math.max(3, Math.min(WORLD_Y - 3, Math.round(h - depth)));
        const steps = 3 + Math.floor(rnd() * plan.size);
        for (let s = 0; s < steps; s++) {
          if (x > 1 && x < WORLD_X - 2 && z > 1 && z < WORLD_Z - 2 && y > 2 && y < WORLD_Y - 2) {
            const cur = vox[this.idx(x, y, z)];
            if (cur !== BLOCK.AIR && cur !== BLOCK.BEDROCK && cur !== BLOCK.CORE) {
              vox[this.idx(x, y, z)] = plan.b;
              // little satellite blob
              if (rnd() > 0.72) {
                const ox = rnd() > 0.5 ? 1 : -1;
                const oz = rnd() > 0.5 ? 1 : -1;
                const xx = x + ox, zz = z + oz;
                if (xx > 1 && xx < WORLD_X - 2 && zz > 1 && zz < WORLD_Z - 2) {
                  const c2 = vox[this.idx(xx, y, zz)];
                  if (c2 !== BLOCK.AIR && c2 !== BLOCK.BEDROCK) vox[this.idx(xx, y, zz)] = plan.b;
                }
              }
            }
          }
          const r = rnd();
          if (r < 0.34) x += rnd() > 0.5 ? 1 : -1;
          else if (r < 0.67) y += rnd() > 0.5 ? 1 : -1;
          else z += rnd() > 0.5 ? 1 : -1;
          x = Math.max(2, Math.min(WORLD_X - 3, x));
          z = Math.max(2, Math.min(WORLD_Z - 3, z));
          y = Math.max(2, Math.min(WORLD_Y - 3, y));
        }
      }
    }

    // caves
    for (let c = 0; c < 16; c++) {
      const cx = 6 + rnd() * (WORLD_X - 12);
      const cz = 6 + rnd() * (WORLD_Z - 12);
      const h = this.surfaceHeights[Math.floor(cz) * WORLD_X + Math.floor(cx)];
      const cy = h - (14 + rnd() * 58);
      const rx = 2.5 + rnd() * 3.4;
      const ry = 1.6 + rnd() * 2.2;
      const rz = 2.5 + rnd() * 3.4;
      // don't carve near the heart chamber
      if (Math.hypot(cx - WORLD_X / 2, cz - WORLD_Z / 2) < 11 && cy < SURFACE - 68) continue;
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        for (let z = Math.floor(cz - rz - 1); z <= cz + rz + 1; z++) {
          for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
            if (!this.inBounds(x, y, z) || y <= 2) continue;
            const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
            const n = valueNoise2(x * 0.25 + y * 0.17, z * 0.25 - y * 0.11, this.seed + 404);
            if (dx * dx + dy * dy + dz * dz + (n - 0.5) * 0.55 < 1) {
              vox[this.idx(x, y, z)] = BLOCK.AIR;
            }
          }
        }
      }
    }

    // heart chamber
    const cx = WORLD_X / 2;
    const cz = WORLD_Z / 2;
    const coreY = SURFACE - 82;
    for (let x = Math.floor(cx) - 4; x <= Math.floor(cx) + 4; x++) {
      for (let z = Math.floor(cz) - 4; z <= Math.floor(cz) + 4; z++) {
        for (let y = coreY; y <= coreY + 4; y++) {
          if (this.inBounds(x, y, z)) vox[this.idx(x, y, z)] = BLOCK.AIR;
        }
      }
    }
    // shell with gems
    for (let x = Math.floor(cx) - 5; x <= Math.floor(cx) + 5; x++) {
      for (let z = Math.floor(cz) - 5; z <= Math.floor(cz) + 5; z++) {
        for (let y = coreY - 1; y <= coreY + 5; y++) {
          if (!this.inBounds(x, y, z)) continue;
          const edge = x === Math.floor(cx) - 5 || x === Math.floor(cx) + 5 || z === Math.floor(cz) - 5 || z === Math.floor(cz) + 5 || y === coreY - 1 || y === coreY + 5;
          if (!edge) continue;
          let b = y === coreY - 1 || y === coreY + 5 ? BLOCK.DEEPSTONE : BLOCK.DEEPSTONE;
          const r = rnd();
          if (r > 0.9) b = BLOCK.RUBY;
          else if (r > 0.72) b = BLOCK.DIAMOND;
          else if (r > 0.5) b = BLOCK.GOLD;
          else if (r > 0.34) b = BLOCK.IRON;
          vox[this.idx(x, y, z)] = b;
        }
      }
    }
    // floor gems
    for (let x = Math.floor(cx) - 4; x <= Math.floor(cx) + 4; x++) {
      for (let z = Math.floor(cz) - 4; z <= Math.floor(cz) + 4; z++) {
        const r = rnd();
        if (r > 0.72) vox[this.idx(x, coreY - 1, z)] = r > 0.94 ? BLOCK.RUBY : BLOCK.GOLD;
      }
    }
    const coreBlockY = coreY;
    const coreX = Math.floor(cx);
    const coreZ = Math.floor(cz);
    vox[this.idx(coreX, coreBlockY, coreZ)] = BLOCK.CORE;
    this.coreBlock.set(coreX, coreBlockY, coreZ);
    this.corePos.set(coreX + 0.5, coreBlockY + 0.5, coreZ + 0.5);

    // starter pit: a 2x2 hole, two blocks deep, with a step back out
    for (let x = coreX - 1; x <= coreX; x++) {
      for (let z = coreZ - 1; z <= coreZ; z++) {
        const h = this.surfaceHeights[z * WORLD_X + x];
        vox[this.idx(x, h, z)] = BLOCK.AIR;
        vox[this.idx(x, h - 1, z)] = BLOCK.AIR;
      }
    }
    for (let x = coreX - 1; x <= coreX; x++) {
      const h = this.surfaceHeights[(coreZ + 1) * WORLD_X + x];
      vox[this.idx(x, h, coreZ + 1)] = BLOCK.AIR;
    }

    this.rebuildAll();
  }

  // ---------- lighting / meshing ----------
  lightAt(x, y, z) {
    const ix = Math.max(0, Math.min(WORLD_X - 1, x));
    const iz = Math.max(0, Math.min(WORLD_Z - 1, z));
    const h = this.surfaceHeights[iz * WORLD_X + ix];
    const depth = Math.max(0, h - y);
    return Math.max(0.38, Math.min(1, 1 - depth / 36));
  }

  chunkKey(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }

  markDirty(x, y, z) {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK), cz = Math.floor(z / CHUNK);
    this.dirty.add(this.chunkKey(cx, cy, cz));
    const lx = x % CHUNK, ly = y % CHUNK, lz = z % CHUNK;
    if (lx === 0) this.dirty.add(this.chunkKey(cx - 1, cy, cz));
    if (lx === CHUNK - 1) this.dirty.add(this.chunkKey(cx + 1, cy, cz));
    if (ly === 0) this.dirty.add(this.chunkKey(cx, cy - 1, cz));
    if (ly === CHUNK - 1) this.dirty.add(this.chunkKey(cx, cy + 1, cz));
    if (lz === 0) this.dirty.add(this.chunkKey(cx, cy, cz - 1));
    if (lz === CHUNK - 1) this.dirty.add(this.chunkKey(cx, cy, cz + 1));
  }

  flushDirty() {
    if (!this.dirty.size) return;
    for (const key of this.dirty) {
      const [cx, cy, cz] = key.split(',').map(Number);
      this.buildChunk(cx, cy, cz);
    }
    this.dirty.clear();
  }

  rebuildAll() {
    for (let cx = 0; cx < WORLD_X / CHUNK; cx++) {
      for (let cy = 0; cy < WORLD_Y / CHUNK; cy++) {
        for (let cz = 0; cz < WORLD_Z / CHUNK; cz++) {
          this.buildChunk(cx, cy, cz);
        }
      }
    }
    this.dirty.clear();
  }

  buildChunk(cx, cy, cz) {
    const key = this.chunkKey(cx, cy, cz);
    const old = this.chunks.get(key);
    if (old) {
      this.chunkGroup.remove(old);
      old.geometry.dispose();
      this.chunks.delete(key);
    }
    const positions = [];
    const normals = [];
    const uvs = [];
    const colors = [];
    const indices = [];
    const x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;
    const solid = (x, y, z) => this.isSolid(x, y, z);
    const vox = this.voxels;

    for (let ly = 0; ly < CHUNK; ly++) {
      const wy = y0 + ly;
      if (wy >= WORLD_Y) break;
      for (let lz = 0; lz < CHUNK; lz++) {
        const wz = z0 + lz;
        for (let lx = 0; lx < CHUNK; lx++) {
          const wx = x0 + lx;
          const b = vox[this.idx(wx, wy, wz)];
          if (!b) continue;
          const def = BLOCKS[b];
          if (!def) continue;
          const lightBase = Math.max(this.lightAt(wx, wy, wz), def.glow);
          const tint = 0.93 + hash3(wx, wy, wz) * 0.14;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = wx + face.n[0], ny = wy + face.n[1], nz = wz + face.n[2];
            if (solid(nx, ny, nz)) continue;
            const tile = def.tiles[f];
            const [u0, v0, u1, v1] = tileUV(tile);
            const base = positions.length / 3;
            const faceShade = f === 3 ? 0.82 : 1;
            for (let k = 0; k < 4; k++) {
              const cu = k === 1 || k === 2 ? 1 : 0;
              const cv = k === 2 || k === 3 ? 1 : 0;
              const px = wx + face.p[0] + face.u[0] * cu + face.v[0] * cv;
              const py = wy + face.p[1] + face.u[1] * cu + face.v[1] * cv;
              const pz = wz + face.p[2] + face.u[2] * cu + face.v[2] * cv;
              positions.push(px, py, pz);
              normals.push(face.n[0], face.n[1], face.n[2]);

              // ambient occlusion
              const su = cu ? 1 : -1;
              const sv = cv ? 1 : -1;
              const sx = nx + face.u[0] * su, sy = ny + face.u[1] * su, sz = nz + face.u[2] * su;
              const tx = nx + face.v[0] * sv, ty = ny + face.v[1] * sv, tz = nz + face.v[2] * sv;
              const ox = sx + face.v[0] * sv, oy = sy + face.v[1] * sv, oz = sz + face.v[2] * sv;
              const s1 = solid(sx, sy, sz) ? 1 : 0;
              const s2 = solid(tx, ty, tz) ? 1 : 0;
              const co = solid(ox, oy, oz) ? 1 : 0;
              const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + co);
              const brightness = lightBase * tint * faceShade * AO_LEVEL[ao];
              colors.push(brightness, brightness, brightness);
              uvs.push(cu ? u1 : u0, cv ? v1 : v0);
            }
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    if (!indices.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.name = 'chunk-' + key;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.chunkGroup.add(mesh);
    this.chunks.set(key, mesh);
  }

  // ---------- raycast ----------
  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;
    const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
    let tMaxX = dir.x === 0 ? Infinity : (dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) / Math.abs(dir.x);
    let tMaxY = dir.y === 0 ? Infinity : (dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) / Math.abs(dir.y);
    let tMaxZ = dir.z === 0 ? Infinity : (dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) / Math.abs(dir.z);
    let normal = [0, 1, 0];
    let t = 0;
    for (let i = 0; i < 256; i++) {
      if (this.isSolid(x, y, z)) {
        return { x, y, z, block: this.get(x, y, z), normal, distance: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ];
      }
      if (t > maxDist) break;
    }
    return null;
  }

  // ---------- save ----------
  encode() {
    const vox = this.voxels;
    const runs = [];
    let prev = vox[0], count = 0;
    for (let i = 0; i < vox.length; i++) {
      const v = vox[i];
      if (v === prev && count < 65535) count++;
      else { runs.push(prev, count); prev = v; count = 1; }
    }
    runs.push(prev, count);
    const bytes = new Uint8Array(runs.length * 3);
    for (let i = 0, j = 0; i < runs.length; i += 2, j += 3) {
      bytes[j] = runs[i];
      bytes[j + 1] = runs[i + 1] & 255;
      bytes[j + 2] = (runs[i + 1] >> 8) & 255;
    }
    return base64FromBytes(bytes);
  }

  decode(str) {
    if (!str) return false;
    const bytes = bytesFromBase64(str);
    const out = new Uint8Array(this.voxels.length);
    let p = 0;
    for (let i = 0; i < bytes.length; i += 3) {
      const v = bytes[i];
      const c = bytes[i + 1] | (bytes[i + 2] << 8);
      if (p + c > out.length) return false;
      out.fill(v, p, p + c);
      p += c;
    }
    if (p !== out.length) return false;
    this.voxels = out;
    this.rebuildAll();
    return true;
  }
}
