/* Procedural brick buildings, blueprint slots, piles and completion state. */
import * as THREE from 'three';
import { BUILDINGS, PALETTES, BRICK_TYPES, brickKey, keyInfo } from './data.js';
import {
  ROW_H, BASE_Y, WALL_T, makeRNG, buildingWorldPosition, buildingYaw,
  makeCanvas, texFromCanvas, makeSignTexture, drawSignBoard, addBox, addCylinder,
} from './gfx.js';
import { addBuildingDecor } from './decor.js';

const HIDDEN = new THREE.Matrix4().compose(
  new THREE.Vector3(0, -999, 0), new THREE.Quaternion(), new THREE.Vector3(0.0001, 0.0001, 0.0001)
);
const TAU = Math.PI * 2;

function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export class BuildingManager {
  constructor(scene, matFor, brickGeo, quality = {}) {
    this.scene = scene;
    this.matFor = matFor;
    this.brickGeo = brickGeo;
    this.quality = quality;
    this.buildings = [];
    this.piles = [];
    this.focusId = null;
    this.focusUntil = 0;
    this.time = 0;
    this.activeId = null;
    this.active = null;
    this.decorHooks = [];
    this.onPlace = null;
    this.onComplete = null;
    this.clockHands = [];
    this.smokeEmitters = [];
    this.brickMat = new THREE.MeshStandardMaterial({ roughness: 0.74, metalness: 0.02 });
    this.ghostMat = new THREE.MeshStandardMaterial({
      color: '#8be7f7', emissive: '#2c7c94', emissiveIntensity: 0.5, transparent: true, opacity: 0.24,
      roughness: 0.35, metalness: 0.05, depthWrite: false, side: THREE.DoubleSide,
    });
    this.marker = this.createMarker();
  }

  build() {
    BUILDINGS.forEach((def, i) => this.createBuilding(def, i));
    return this;
  }

  get completedCount() {
    return this.buildings.filter((b) => b.completed).length;
  }

  get allComplete() {
    return this.completedCount === this.buildings.length;
  }

  get totalPlaced() {
    return this.buildings.reduce((a, b) => a + b.placedCount, 0);
  }

  get totalBricks() {
    return this.buildings.reduce((a, b) => a + b.slots.length, 0);
  }

  getBuilding(id) {
    return this.buildings.find((b) => b.def.id === id) || null;
  }

  /* ============================================================
     Slot generation
     ============================================================ */
  generateSlots(def, index) {
    const rng = makeRNG(1409 + index * 977);
    const pal = PALETTES[def.palette];
    const cache = new Map();
    const piece = (id) => {
      const base = pal[id] || pal.wall;
      if (!cache.has(id)) cache.set(id, { ...base, key: brickKey(base), id });
      return cache.get(id);
    };
    const slots = [];
    const add = (pieceId, dims, x, y, z, quat = null, meta = {}) => {
      const p = piece(pieceId);
      const q = quat ? quat.clone() : new THREE.Quaternion();
      const pos = new THREE.Vector3(x, y, z);
      const localMatrix = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(dims[0], dims[1], dims[2]));
      slots.push({
        index: slots.length, piece: p, key: p.key, dims: [...dims], pos, quat: q,
        localMatrix, placed: false, color: p.color, meta,
      });
    };

    const wallTop = BASE_Y + def.rows * ROW_H;
    const halfW = def.w / 2, halfD = def.d / 2;
    const windows = [];
    const openingsFor = this.makeOpenings(def);

    // ---- wall courses ----
    const sides = [
      { name: 'front', axis: 'x', len: def.w, fixed: halfD - WALL_T / 2, sign: 1 },
      { name: 'back', axis: 'x', len: def.w, fixed: -halfD + WALL_T / 2, sign: -1 },
      { name: 'right', axis: 'z', len: def.d, fixed: halfW - WALL_T / 2, sign: 1 },
      { name: 'left', axis: 'z', len: def.d, fixed: -halfW + WALL_T / 2, sign: -1 },
    ];

    for (const side of sides) {
      const opens = openingsFor.filter((o) => o.side === side.name);
      const count = Math.max(2, Math.round(side.len / 1.36));
      const step = side.len / count;
      for (let row = 0; row < def.rows; row++) {
        const stagger = (row % 2) ? step * 0.5 : 0;
        for (let i = 0; i < count; i++) {
          let u = -side.len / 2 + step * (i + 0.5) + stagger;
          u = Math.max(-side.len / 2 + step / 2, Math.min(side.len / 2 - step / 2, u));
          let skip = false;
          for (const op of opens) {
            if (row >= op.row0 && row <= op.row1 && Math.abs(u - op.u) < op.w / 2 + step * 0.34) { skip = true; break; }
          }
          if (skip) continue;
          const brickLen = step - 0.035;
          const y = BASE_Y + row * ROW_H + ROW_H / 2;
          const isCorner = i === 0 || i === count - 1;
          let pid = 'wall';
          if (row === 0 || row === def.rows - 1 || isCorner) pid = 'trim';
          else if (row === 2 && (def.style === 'cottage' || def.style === 'bakery') && i % 4 === 0) pid = 'wallDeep';
          else if (rng() < 0.08) pid = 'wallDeep';
          if (def.style === 'greenhouse' && row > 0 && !isCorner && i % 3 === 1) pid = 'trim';
          const dims = side.axis === 'x'
            ? [brickLen, ROW_H - 0.04, WALL_T]
            : [WALL_T, ROW_H - 0.04, brickLen];
          const x = side.axis === 'x' ? u : side.fixed;
          const z = side.axis === 'x' ? side.fixed : u;
          add(pid, dims, x, y, z, null, { side: side.name, row });
        }
      }
    }

    // ---- windows as placeable slots ----
    for (const op of openingsFor) {
      if (op.type !== 'window') continue;
      const winH = (op.row1 - op.row0 + 1) * ROW_H - 0.1;
      const winW = Math.min(op.w, 1.65);
      const y = BASE_Y + ((op.row0 + op.row1 + 1) / 2) * ROW_H;
      const side = sides.find((s) => s.name === op.side);
      let dims, x, z;
      if (side.axis === 'x') {
        dims = [winW, winH, 0.3];
        x = op.u;
        z = side.fixed + (side.sign > 0 ? 0.03 : -0.03);
      } else {
        dims = [0.3, winH, winW];
        x = side.fixed + (side.sign > 0 ? 0.03 : -0.03);
        z = op.u;
      }
      add('glass', dims, x, y, z, null, { window: true, side: op.side });
      windows.push({ ...op, y, winH, winW, sideName: op.side, axis: side.axis });
    }

    // ---- gable ends ----
    if (def.roof !== 'flat') {
      const rise = def.roofRise;
      const G = Math.max(1, Math.round(rise / ROW_H));
      for (const side of [{ z: halfD - WALL_T / 2, name: 'front' }, { z: -halfD + WALL_T / 2, name: 'back' }]) {
        for (let g = 0; g < G; g++) {
          const y = wallTop + g * ROW_H + ROW_H / 2;
          const half = (def.w / 2) * (1 - g / G);
          const n = Math.max(1, Math.round((half * 2) / 1.36));
          const step = (half * 2) / n;
          for (let i = 0; i < n; i++) {
            const x = -half + step * (i + 0.5);
            let pid = 'wall';
            if (i === 0 || i === n - 1) pid = 'trim';
            else if (g === G - 1) pid = 'trim';
            add(pid, [step - 0.035, ROW_H - 0.04, WALL_T], x, y, side.z);
          }
        }
      }
    }

    // ---- roof ----
    const roofTop = def.roof === 'flat' ? wallTop + 0.25 : wallTop + def.roofRise;
    if (def.roof === 'flat') {
      for (let ix = 0; ix < 2; ix++) {
        for (let iz = 0; iz < 2; iz++) {
          add('roof', [def.w / 2 + 0.25, 0.36, def.d / 2 + 0.25], (ix - 0.5) * (def.w / 2 + 0.1), wallTop + 0.17, (iz - 0.5) * (def.d / 2 + 0.1));
        }
      }
    } else {
      const overX = 0.55, overZ = 0.6;
      const halfD2 = halfD + overZ;
      const rise = def.roadRise || def.roofRise;
      const angle = Math.atan2(rise, halfD2);
      const slopeLen = Math.hypot(rise, halfD2);
      const cols = def.w > 8 ? 3 : 2;
      const bw = (def.w + overX * 2) / cols;
      const rows = def.roofRows || 3;
      const roofPid = def.palette === 'greenhouse' ? 'roof' : 'roof';
      for (const side of [1, -1]) {
        for (let r = 0; r < rows; r++) {
          const f = (r + 0.5) / rows;
          const z = side * halfD2 * (1 - f);
          const y = wallTop + rise * f + 0.12;
          const segLen = slopeLen / rows + 0.14;
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(side * angle, 0, 0));
          for (let c = 0; c < cols; c++) {
            const x = -def.w / 2 - overX + bw * (c + 0.5);
            let pid = roofPid;
            if (def.style === 'market' && (r + c) % 2 === 0 && pal.roofAlt) pid = 'roofAlt';
            add(pid, [bw - 0.04, 0.34, segLen], x, y, z, q, { roof: true });
          }
        }
      }
      add('roof', [def.w + overX * 2 + 0.1, 0.24, 0.55], 0, wallTop + rise + 0.22, 0, null, { roof: true, ridge: true });
    }

    return { slots, windows, wallTop, roofTop };
  }

  makeOpenings(def) {
    const list = [];
    const rows = def.rows;
    const winRows = rows >= 5 ? [2, 3] : [1, 2];
    const doorW = def.style === 'market' ? 2.35 : def.style === 'chapel' ? 1.75 : def.style === 'clocktower' ? 1.95 : 1.55;
    list.push({ side: 'front', u: 0, row0: 0, row1: 2, w: doorW, type: 'door' });
    const wx = def.w * 0.275;
    if (def.style === 'chapel') {
      list.push({ side: 'front', u: 0, row0: 3, row1: 4, w: 1.8, type: 'window' });
      list.push({ side: 'left', u: 0, row0: 1, row1: 3, w: 1.0, type: 'window' });
      list.push({ side: 'right', u: 0, row0: 1, row1: 3, w: 1.0, type: 'window' });
      return list;
    }
    if (def.style === 'clocktower') {
      list.push({ side: 'front', u: -wx, row0: 3, row1: 4, w: 1.1, type: 'window' });
      list.push({ side: 'front', u: wx, row0: 3, row1: 4, w: 1.1, type: 'window' });
      list.push({ side: 'left', u: -def.d * 0.2, row0: 2, row1: 3, w: 1.0, type: 'window' });
      list.push({ side: 'right', u: -def.d * 0.2, row0: 2, row1: 3, w: 1.0, type: 'window' });
      list.push({ side: 'back', u: -wx, row0: 2, row1: 3, w: 1.0, type: 'window' });
      list.push({ side: 'back', u: wx, row0: 2, row1: 3, w: 1.0, type: 'window' });
      return list;
    }
    if (def.style === 'greenhouse') {
      list.push({ side: 'front', u: -wx, row0: 1, row1: 2, w: 1.5, type: 'window' });
      list.push({ side: 'front', u: wx, row0: 1, row1: 2, w: 1.5, type: 'window' });
      list.push({ side: 'back', u: -wx, row0: 1, row1: 2, w: 1.5, type: 'window' });
      list.push({ side: 'back', u: wx, row0: 1, row1: 2, w: 1.5, type: 'window' });
      list.push({ side: 'left', u: -def.d * 0.2, row0: 1, row1: 2, w: 1.3, type: 'window' });
      list.push({ side: 'left', u: def.d * 0.2, row0: 1, row1: 2, w: 1.3, type: 'window' });
      list.push({ side: 'right', u: -def.d * 0.2, row0: 1, row1: 2, w: 1.3, type: 'window' });
      list.push({ side: 'right', u: def.d * 0.2, row0: 1, row1: 2, w: 1.3, type: 'window' });
      return list;
    }
    if (def.style === 'market') {
      list.push({ side: 'front', u: -wx, row0: 1, row1: 2, w: 1.2, type: 'window' });
      list.push({ side: 'front', u: wx, row0: 1, row1: 2, w: 1.2, type: 'window' });
      list.push({ side: 'back', u: -wx, row0: 1, row1: 2, w: 1.1, type: 'window' });
      list.push({ side: 'back', u: wx, row0: 1, row1: 2, w: 1.1, type: 'window' });
      list.push({ side: 'left', u: 0, row0: 1, row1: 2, w: 1.0, type: 'window' });
      list.push({ side: 'right', u: 0, row0: 1, row1: 2, w: 1.0, type: 'window' });
      return list;
    }
    // standard cottage-ish building
    list.push({ side: 'front', u: -wx, row0: winRows[0], row1: winRows[1], w: 1.1, type: 'window' });
    list.push({ side: 'front', u: wx, row0: winRows[0], row1: winRows[1], w: 1.1, type: 'window' });
    list.push({ side: 'back', u: -wx, row0: winRows[0], row1: winRows[1], w: 1.0, type: 'window' });
    list.push({ side: 'back', u: wx, row0: winRows[0], row1: winRows[1], w: 1.0, type: 'window' });
    list.push({ side: 'left', u: 0, row0: winRows[0], row1: winRows[1], w: 1.0, type: 'window' });
    list.push({ side: 'right', u: 0, row0: winRows[0], row1: winRows[1], w: 1.0, type: 'window' });
    return list;
  }

  /* ============================================================
     Building creation
     ============================================================ */
  createBuilding(def, index) {
    const rng = makeRNG(9001 + index * 331);
    const pos = buildingWorldPosition(def);
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);
    group.rotation.y = buildingYaw(def);
    group.name = `building-${def.id}`;
    this.scene.add(group);

    const { slots, windows, wallTop, roofTop } = this.generateSlots(def, index);
    const b = {
      def, index, group, slots, windows, wallTop, roofTop,
      placedCount: 0, completed: false, pops: [], decor: null, decorPop: -1,
      x: pos.x, z: pos.z, yaw: group.rotation.y,
      sign: null, scaffold: null, fence: null, signGroup: null, piles: [],
      total: slots.length,
    };

    const ghost = new THREE.InstancedMesh(this.brickGeo, this.ghostMat, slots.length);
    ghost.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    ghost.frustumCulled = false;
    ghost.castShadow = false;
    ghost.receiveShadow = false;
    ghost.userData = { type: 'ghost', building: b };
    const placed = new THREE.InstancedMesh(this.brickGeo, this.brickMat, slots.length);
    placed.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    placed.frustumCulled = false;
    placed.castShadow = true;
    placed.receiveShadow = true;
    placed.userData = { type: 'placed', building: b };

    const color = new THREE.Color();
    slots.forEach((slot, i) => {
      ghost.setMatrixAt(i, slot.localMatrix);
      placed.setMatrixAt(i, HIDDEN);
      color.set(slot.piece.color);
      color.offsetHSL((rng() - 0.5) * 0.008, (rng() - 0.5) * 0.035, (rng() - 0.5) * 0.038);
      slot.instanceColor = color.clone();
      placed.setColorAt(i, slot.instanceColor);
    });
    ghost.instanceMatrix.needsUpdate = true;
    placed.instanceMatrix.needsUpdate = true;
    placed.instanceColor.needsUpdate = true;
    group.add(ghost, placed);
    b.ghost = ghost;
    b.placed = placed;

    this.buildFoundation(b);
    this.buildSite(b);
    this.buildPiles(b);
    this.buildings.push(b);
    return b;
  }

  buildFoundation(b) {
    const def = b.def;
    const pal = PALETTES[def.palette];
    const g = b.group;
    // stone site pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(def.w + 3.2, 0.14, def.d + 3.2),
      this.matFor('#d9c3a5', { roughness: 1 })
    );
    pad.position.y = 0.07;
    pad.receiveShadow = true;
    pad.castShadow = true;
    g.add(pad);
    // foundation
    addBox(g, def.w + 0.7, BASE_Y, def.d + 0.7, pal.base.color, this.matFor, 0, BASE_Y / 2, 0, { roughness: 1 });
    addBox(g, def.w + 1.0, 0.14, def.d + 1.0, '#b79b9b', this.matFor, 0, BASE_Y + 0.02, 0, { roughness: 1 });
    // steps
    addBox(g, 2.0, 0.16, 0.6, '#d8c2a6', this.matFor, 0, 0.08, def.d / 2 + 0.72, { roughness: 1 });
    addBox(g, 1.75, 0.3, 0.45, '#cdb49a', this.matFor, 0, 0.15, def.d / 2 + 0.5, { roughness: 1 });
    // dark doorway recess
    addBox(g, 1.42, 2.08, 0.12, '#443744', this.matFor, 0, BASE_Y + 1.04, def.d / 2 - 0.22, { roughness: 1 });
    // door frame
    const trim = PALETTES[def.palette].trim.color;
    addBox(g, 0.18, 2.35, 0.16, trim, this.matFor, -0.82, BASE_Y + 1.18, def.d / 2 + 0.01);
    addBox(g, 0.18, 2.35, 0.16, trim, this.matFor, 0.82, BASE_Y + 1.18, def.d / 2 + 0.01);
    addBox(g, 1.82, 0.2, 0.16, trim, this.matFor, 0, BASE_Y + 2.26, def.d / 2 + 0.01);

    // window frames around the openings
    const sideInfo = {
      front: { axis: 'x', fixed: def.d / 2 },
      back: { axis: 'x', fixed: -def.d / 2 },
      left: { axis: 'z', fixed: -def.w / 2 },
      right: { axis: 'z', fixed: def.w / 2 },
    };
    for (const w of b.windows) {
      const info = sideInfo[w.sideName];
      const cy = w.y;
      const h = w.winH;
      const ww = w.winW;
      const frameCol = def.palette === 'greenhouse' ? '#f1e6cf' : trim;
      if (info.axis === 'x') {
        const z = info.fixed + (info.fixed > 0 ? 0.03 : -0.03);
        addBox(g, 0.13, h + 0.24, 0.16, frameCol, this.matFor, w.u - ww / 2 - 0.05, cy, z);
        addBox(g, 0.13, h + 0.24, 0.16, frameCol, this.matFor, w.u + ww / 2 + 0.05, cy, z);
        addBox(g, ww + 0.24, 0.14, 0.18, frameCol, this.matFor, w.u, cy + h / 2 + 0.06, z);
        addBox(g, ww + 0.24, 0.14, 0.2, frameCol, this.matFor, w.u, cy - h / 2 - 0.06, z);
        addBox(g, ww + 0.36, 0.11, 0.32, '#cdb49a', this.matFor, w.u, cy - h / 2 - 0.18, z + (z > 0 ? 0.06 : -0.06), { roughness: 1 });
      } else {
        const x = info.fixed + (info.fixed > 0 ? 0.03 : -0.03);
        addBox(g, 0.16, h + 0.24, 0.13, frameCol, this.matFor, x, cy, w.u - ww / 2 - 0.05);
        addBox(g, 0.16, h + 0.24, 0.13, frameCol, this.matFor, x, cy, w.u + ww / 2 + 0.05);
        addBox(g, 0.18, 0.14, ww + 0.24, frameCol, this.matFor, x, cy + h / 2 + 0.06, w.u);
        addBox(g, 0.2, 0.14, ww + 0.24, frameCol, this.matFor, x, cy - h / 2 - 0.06, w.u);
        addBox(g, 0.32, 0.11, ww + 0.36, '#cdb49a', this.matFor, x + (x > 0 ? 0.06 : -0.06), cy - h / 2 - 0.18, w.u, { roughness: 1 });
      }
    }

    // loose construction rubble
    for (let i = 0; i < 7; i++) {
      const rubble = new THREE.Mesh(this.brickGeo, this.matFor(i % 2 ? pal.base.color : '#cfb6aa', { roughness: 0.9 }));
      rubble.scale.set(0.5 + Math.random() * 0.3, 0.28, 0.22);
      rubble.position.set((Math.random() - 0.5) * (def.w + 2.2), 0.14, (Math.random() - 0.5) * 2 + def.d / 2 + 1.6);
      rubble.rotation.set(Math.random() * 0.4 - 0.2, Math.random() * TAU, 0);
      rubble.castShadow = true;
      g.add(rubble);
    }
  }

  /* ---------------- scaffolding, fencing, sign ---------------- */
  buildSite(b) {
    const def = b.def;
    const g = b.group;
    const halfW = def.w / 2 + 1.8;
    const halfD = def.d / 2 + 1.8;

    // --- low construction fence ---
    const posts = [];
    const rails = [];
    const pushSide = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(2, Math.ceil(len / 1.45));
      const rot = Math.atan2(x2 - x1, z2 - z1);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        posts.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t });
      }
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const cx = x1 + (x2 - x1) * (t0 + t1) / 2;
        const cz = z1 + (z2 - z1) * (t0 + t1) / 2;
        rails.push({ x: cx, z: cz, len: len / n, rot });
      }
    };
    pushSide(-halfW, -halfD, halfW, -halfD); // back
    pushSide(-halfW, -halfD, -halfW, halfD); // left
    pushSide(halfW, -halfD, halfW, halfD); // right
    pushSide(-halfW, halfD, -1.5, halfD); // front left
    pushSide(1.5, halfD, halfW, halfD); // front right

    const fenceGroup = new THREE.Group();
    const postGeo = new THREE.BoxGeometry(0.12, 0.98, 0.12);
    const railGeo = new THREE.BoxGeometry(1, 0.1, 0.07);
    const postMesh = new THREE.InstancedMesh(postGeo, this.matFor('#c35e70', { roughness: 0.85 }), posts.length);
    const railMesh = new THREE.InstancedMesh(railGeo, this.matFor('#d58a74', { roughness: 0.85 }), rails.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    posts.forEach((p, i) => {
      m4.compose(new THREE.Vector3(p.x, 0.49, p.z), q.identity(), new THREE.Vector3(1, 1, 1));
      postMesh.setMatrixAt(i, m4);
    });
    rails.forEach((r, i) => {
      e.set(0, r.rot + Math.PI / 2, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(r.x, 0.4, r.z), q, new THREE.Vector3(r.len, 1, 1));
      railMesh.setMatrixAt(i * 2, m4);
      m4.compose(new THREE.Vector3(r.x, 0.76, r.z), q, new THREE.Vector3(r.len, 1, 1));
      railMesh.setMatrixAt(i * 2 + 1, m4);
    });
    postMesh.castShadow = true; railMesh.castShadow = true;
    fenceGroup.add(postMesh, railMesh);
    g.add(fenceGroup);
    b.fence = fenceGroup;

    // --- scaffolding ---
    const scaffold = new THREE.Group();
    const poleGeo = new THREE.CylinderGeometry(0.055, 0.065, 1, 6);
    const poles = [];
    const scHalfW = def.w / 2 + 0.65, scHalfD = def.d / 2 + 0.65;
    const H = Math.min(b.wallTop + def.roofRise * 0.35, 7.2);
    const corners = [];
    for (const x of [-scHalfW, scHalfW]) for (const z of [-scHalfD, scHalfD]) corners.push({ x, z });
    for (const x of [0]) for (const z of [-scHalfD, scHalfD]) corners.push({ x, z });
    for (const z of [0]) for (const x of [-scHalfW, scHalfW]) corners.push({ x, z });
    const poleMesh = new THREE.InstancedMesh(poleGeo, this.matFor('#c05a6c', { roughness: 0.8 }), corners.length);
    corners.forEach((c, i) => {
      m4.compose(new THREE.Vector3(c.x, H / 2, c.z), q.identity(), new THREE.Vector3(1, H, 1));
      poleMesh.setMatrixAt(i, m4);
      poles.push(c);
    });
    poleMesh.castShadow = true;
    scaffold.add(poleMesh);

    const levels = [1.35, Math.min(2.75, H - 0.4)];
    if (H > 4.4) levels.push(Math.min(4.15, H - 0.3));
    const plankGeo = new THREE.BoxGeometry(1, 0.08, 0.42);
    const plankMesh = new THREE.InstancedMesh(plankGeo, this.matFor('#c89060', { roughness: 0.9 }), (levels.length) * 4);
    let pi = 0;
    levels.forEach((y, li) => {
      // rails on all four sides
      const railLenW = scHalfW * 2, railLenD = scHalfD * 2;
      const railData = [
        { x: 0, z: -scHalfD, len: railLenW, rot: Math.PI / 2 },
        { x: 0, z: scHalfD, len: railLenW, rot: Math.PI / 2 },
        { x: -scHalfW, z: 0, len: railLenD, rot: 0 },
        { x: scHalfW, z: 0, len: railLenD, rot: 0 },
      ];
      for (const r of railData) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(r.len, 0.07, 0.07), this.matFor('#d77e8a', { roughness: 0.8 }));
        rail.position.set(r.x, y, r.z);
        rail.rotation.y = r.rot;
        scaffold.add(rail);
      }
      if (li < 3) {
        for (const side of [-1, 1]) {
          m4.compose(new THREE.Vector3(0, y - 0.09, side * scHalfD), q.identity(), new THREE.Vector3(def.w + 1.4, 1, 1));
          plankMesh.setMatrixAt(pi++, m4);
        }
        m4.compose(new THREE.Vector3(-scHalfW, y - 0.09, 0), q.identity(), new THREE.Vector3(1, 1, def.d + 1.4));
        plankMesh.setMatrixAt(pi++, m4);
      }
    });
    plankMesh.count = pi;
    plankMesh.castShadow = true;
    scaffold.add(plankMesh);
    g.add(scaffold);
    b.scaffold = scaffold;

    // --- construction sign ---
    const { canvas, ctx } = makeCanvas(512, 256);
    const tex = texFromCanvas(canvas);
    drawSignBoard(tex, ctx, canvas, def.name.toUpperCase(), `0 / ${b.slots.length} bricks`);
    const signGroup = new THREE.Group();
    signGroup.position.set(def.w / 2 + 1.4, 0, def.d / 2 + 2.6);
    addBox(signGroup, 0.12, 2.15, 0.12, '#9a7256', this.matFor, -1.15, 1.07, -0.08);
    addBox(signGroup, 0.12, 2.15, 0.12, '#9a7256', this.matFor, 1.15, 1.07, -0.08);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    board.position.y = 1.75;
    signGroup.add(board);
    g.add(signGroup);
    b.signGroup = signGroup;
    b.sign = { canvas, ctx, texture: tex, board };

    // little stack of spare planks by the sign
    addBox(g, 1.4, 0.1, 0.5, '#c89060', this.matFor, def.w / 2 + 2.4, 0.1, def.d / 2 + 1.2, { rot: [0, 0.3, 0] });
  }

  updateSiteSign(b) {
    if (!b.sign || b.completed) return;
    const ctx = b.sign.ctx, canvas = b.sign.canvas;
    drawSignBoard(b.sign.texture, ctx, canvas, b.def.name.toUpperCase(), `${b.placedCount} / ${b.slots.length} bricks`);
    if (b.placedCount > 0) {
      // add a little green tick on the sign once work has started
      ctx.fillStyle = '#5fae7f';
      ctx.beginPath();
      ctx.arc(448, 44, 19, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f8ecd7';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(439, 44);
      ctx.lineTo(446, 51);
      ctx.lineTo(458, 36);
      ctx.stroke();
      b.sign.texture.needsUpdate = true;
    }
  }

  /* ============================================================
     Piles of loose bricks
     ============================================================ */
  buildPiles(b) {
    const counts = new Map();
    for (const s of b.slots) counts.set(s.key, (counts.get(s.key) || 0) + 1);
    const entries = [...counts.entries()].sort((a, c) => c[1] - a[1]);
    const def = b.def;
    const rng = makeRNG(5000 + b.index * 61);
    const spots = [];
    const cols = def.w > 8 ? 4 : 3;
    for (let row = 0; row < 3; row++) {
      for (let c = 0; c < cols; c++) {
        const x = -def.w / 2 - 0.4 + (def.w + 0.8) * ((c + 0.5) / cols);
        const z = def.d / 2 + 2.9 + row * 2.25;
        spots.push({ x, z });
      }
    }
    let spotIndex = 0;
    for (const [key, count] of entries) {
      const { piece } = this.keyToPiece(b, key);
      const heaps = Math.max(1, Math.ceil(count / 22));
      let remaining = count;
      for (let h = 0; h < heaps; h++) {
        const share = Math.min(remaining, Math.ceil(count / heaps));
        remaining -= share;
        const spot = spots[spotIndex++ % spots.length];
        const pileGroup = new THREE.Group();
        pileGroup.position.set(spot.x + (rng() - 0.5) * 0.5, 0, spot.z + (rng() - 0.5) * 0.35);
        b.group.add(pileGroup);

        const dirt = new THREE.Mesh(
          new THREE.CircleGeometry(1.32, 18),
          this.matFor('#c7a783', { roughness: 1 })
        );
        dirt.rotation.x = -Math.PI / 2;
        dirt.position.y = 0.045;
        dirt.receiveShadow = true;
        pileGroup.add(dirt);

        const mesh = new THREE.InstancedMesh(this.brickGeo, this.brickMat, share);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        const dims = BRICK_TYPES[piece.type].dims;
        const m4 = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const col = new THREE.Color();
        const layout = [];
        for (let i = 0; i < share; i++) {
          const layer = Math.floor(i / 8);
          const inLayer = i % 8;
          const a = inLayer * 2.399 + rng() * 0.5;
          const rad = layer === 0 ? 0.35 + rng() * 0.85 : 0.15 + rng() * 0.85;
          e.set((rng() - 0.5) * 0.35, rng() * TAU, (rng() - 0.5) * 0.28);
          q.setFromEuler(e);
          m4.compose(
            new THREE.Vector3(Math.cos(a) * rad, 0.19 + layer * 0.36 + rng() * 0.05, Math.sin(a) * rad),
            q,
            new THREE.Vector3(dims[0], dims[1], dims[2])
          );
          mesh.setMatrixAt(i, m4);
          layout.push(m4.clone());
          col.set(piece.color);
          col.offsetHSL(0, 0, (rng() - 0.5) * 0.05);
          mesh.setColorAt(i, col);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        pileGroup.add(mesh);

        const signTex = makeSignTexture(BRICK_TYPES[piece.type].label, piece.name, {
          w: 384, h: 160, brickColor: piece.color, titleSize: 38, subSize: 23,
        });
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(2.05, 0.85),
          new THREE.MeshBasicMaterial({ map: signTex.texture, transparent: true })
        );
        label.position.set(0, 1.5, -1.18);
        pileGroup.add(label);
        addBox(pileGroup, 0.08, 1.35, 0.08, '#9a7256', this.matFor, -0.9, 0.67, -1.2);
        addBox(pileGroup, 0.08, 1.35, 0.08, '#9a7256', this.matFor, 0.9, 0.67, -1.2);

        const pile = {
          building: b, key, piece, group: pileGroup, mesh, stock: share,
          total: share, used: new Uint8Array(share), layout, label, signTexture: signTex.texture,
        };
        mesh.userData = { type: 'pile', pile };
        b.piles.push(pile);
        this.piles.push(pile);
      }
    }
  }

  keyToPiece(b, key) {
    const slot = b.slots.find((s) => s.key === key);
    return { piece: slot.piece, slot };
  }

  hidePile(pile) {
    pile.group.visible = false;
  }

  returnBrick(pile, index) {
    if (!pile || index == null || !pile.used[index]) return false;
    pile.used[index] = 0;
    pile.stock++;
    if (pile.layout[index]) pile.mesh.setMatrixAt(index, pile.layout[index]);
    pile.mesh.instanceMatrix.needsUpdate = true;
    // A completed building no longer shows its construction piles; the brick
    // is simply returned to the pile record without becoming visible clutter.
    pile.group.visible = !pile.building.completed;
    return true;
  }

  /* ============================================================
     Interaction
     ============================================================ */
  collectRayTargets() {
    const targets = [];
    for (const b of this.buildings) {
      if (!b.completed) targets.push(b.ghost);
      for (const p of b.piles) if (p.group.visible && p.stock > 0) targets.push(p.mesh);
    }
    return targets;
  }

  pickPile(pile, instanceId) {
    if (!pile || pile.stock <= 0) return null;
    let idx = instanceId;
    if (idx == null || idx < 0 || idx >= pile.used.length || pile.used[idx]) {
      idx = pile.used.indexOf(0);
      if (idx < 0) return null;
    }
    pile.used[idx] = 1;
    pile.mesh.setMatrixAt(idx, HIDDEN);
    pile.mesh.instanceMatrix.needsUpdate = true;
    pile.stock--;
    if (pile.stock <= 0) this.hidePile(pile);
    return { key: pile.key, piece: pile.piece, pile, index: idx };
  }

  magnetPull(pos, radius, maxCount) {
    const found = [];
    const origin = new THREE.Vector3(pos.x, pos.y || 0, pos.z);
    const candidates = [];
    for (const p of this.piles) {
      if (!p.group.visible || p.stock <= 0) continue;
      const wp = new THREE.Vector3();
      p.group.getWorldPosition(wp);
      const d = wp.distanceTo(origin);
      if (d < radius) candidates.push({ pile: p, d, wp });
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates) {
      while (c.pile.stock > 0 && found.length < maxCount) {
        const idx = c.pile.used.indexOf(0);
        if (idx < 0) break;
        const res = this.pickPile(c.pile, idx);
        if (res) found.push({ ...res, worldPos: c.wp.clone() });
      }
      if (found.length >= maxCount) break;
    }
    return found;
  }

  resolveGhostHit(mesh, instanceId) {
    const b = mesh.userData.building;
    if (!b || b.completed) return null;
    const slot = b.slots[instanceId];
    if (!slot || slot.placed) return null;
    return { building: b, slot, index: instanceId };
  }

  countInventoryForBuilding(b, inv) {
    const totals = new Map();
    for (const s of b.slots) {
      if (!s.placed) totals.set(s.key, (totals.get(s.key) || 0) + 1);
    }
    let total = 0;
    for (const [k, v] of totals) total += v;
    return { missing: totals, total };
  }

  requirements(b) {
    const map = new Map();
    for (const s of b.slots) {
      if (!map.has(s.key)) {
        const info = keyInfo(s.key);
        map.set(s.key, { key: s.key, piece: s.piece, type: info.type, label: info.def.label, name: info.name, color: s.piece.color, count: 0, placed: 0 });
      }
      const e = map.get(s.key);
      e.count++;
      if (s.placed) e.placed++;
    }
    return [...map.values()].sort((a, c) => c.count - a.count);
  }

  /* ============================================================
     Placing bricks
     ============================================================ */
  placeSlot(b, index, opts = {}) {
    if (!b || b.completed) return null;
    const slot = b.slots[index];
    if (!slot || slot.placed) return null;
    slot.placed = true;
    b.placedCount++;
    b.ghost.setMatrixAt(index, HIDDEN);
    b.ghost.instanceMatrix.needsUpdate = true;
    b.placed.setMatrixAt(index, slot.localMatrix);
    b.placed.instanceMatrix.needsUpdate = true;
    b.pops.push({ index, t: 0 });
    this.updateSiteSign(b);
    if (this.onPlace) this.onPlace(b, slot);
    if (b.placedCount >= b.slots.length) this.finishBuilding(b, !opts.silent);
    return { building: b, slot, index };
  }

  finishBuilding(b, animate = true) {
    if (b.completed) return;
    b.completed = true;
    b.ghost.visible = false;
    if (b.scaffold) b.scaffold.visible = false;
    if (b.fence) b.fence.visible = false;
    if (b.signGroup) b.signGroup.visible = false;
    for (const p of b.piles) p.group.visible = false;
    b.decor = addBuildingDecor(this, b, animate);
    if (animate) b.decorPop = 0;
    if (this.onComplete) this.onComplete(b, animate);
  }

  /* ============================================================
     Active building marker
     ============================================================ */
  createMarker() {
    const g = new THREE.Group();
    g.visible = false;
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffd978', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 11, 12, 1, true), beamMat);
    beam.position.y = 5.5;
    g.add(beam);

    const brickMat = new THREE.MeshStandardMaterial({ color: '#ffd15c', emissive: '#c98a22', emissiveIntensity: 0.8, roughness: 0.4, metalness: 0.1 });
    const brick = new THREE.Mesh(this.brickGeo, brickMat);
    brick.scale.set(1.6, 0.7, 0.62);
    brick.castShadow = false;
    g.add(brick);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.06, 6, 24),
      new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.8, depthWrite: false })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.userData.brick = brick;
    g.userData.ring = ring;
    g.userData.beam = beam;

    // label sprite
    const { canvas, ctx } = makeCanvas(512, 128);
    const tex = texFromCanvas(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    sprite.scale.set(6.2, 1.55, 1);
    sprite.position.y = 2.2;
    sprite.renderOrder = 20;
    g.add(sprite);
    g.userData.label = { canvas, ctx, tex };
    this.scene.add(g);
    return g;
  }

  updateMarkerLabel(b) {
    const { canvas, ctx, tex } = this.marker.userData.label;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20,57,74,.93)';
    ctx.beginPath();
    ctx.roundRect(8, 12, 496, 104, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,225,160,.5)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffe8ae';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 46px Fredoka, "Trebuchet MS", sans-serif';
    ctx.fillText(b.def.name.toUpperCase(), 256, 52);
    ctx.fillStyle = 'rgba(255,247,229,.62)';
    ctx.font = '800 24px Nunito, "Segoe UI", sans-serif';
    ctx.fillText(`${b.placedCount} / ${b.slots.length} bricks`, 256, 91);
    tex.needsUpdate = true;
  }

  setFocus(id) {
    this.focusId = id;
    this.focusUntil = this.time + 6;
  }

  getActive(playerPos = null) {
    const incomplete = this.buildings.filter((b) => !b.completed);
    if (!incomplete.length) return null;
    if (this.focusId && this.time < this.focusUntil) {
      const f = this.getBuilding(this.focusId);
      if (f && !f.completed) return f;
    }
    if (playerPos) {
      let best = null, bestD = Infinity;
      for (const b of incomplete) {
        const d = Math.hypot(playerPos.x - b.x, playerPos.z - b.z);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best && bestD < 22) return best;
    }
    return incomplete.slice().sort((a, b) => a.def.order - b.def.order)[0];
  }

  update(dt, time, playerPos) {
    this.time = time;
    // brick pop animation
    for (const b of this.buildings) {
      if (!b.pops.length) continue;
      for (let i = b.pops.length - 1; i >= 0; i--) {
        const p = b.pops[i];
        p.t += dt;
        const k = Math.min(1, p.t / 0.3);
        const s = k < 1 ? easeOutBack(k) : 1;
        const slot = b.slots[p.index];
        const mat = new THREE.Matrix4().compose(
          slot.pos, slot.quat,
          new THREE.Vector3(slot.dims[0] * s, slot.dims[1] * s, slot.dims[2] * s)
        );
        b.placed.setMatrixAt(p.index, mat);
        b.placed.instanceMatrix.needsUpdate = true;
        if (k >= 1) b.pops.splice(i, 1);
      }
    }
    // decor pop
    for (const b of this.buildings) {
      if (b.decorPop >= 0 && b.decor) {
        b.decorPop += dt;
        const k = Math.min(1, b.decorPop / 0.55);
        const s = Math.max(0.001, easeOutBack(k));
        b.decor.scale.setScalar(s);
        if (k >= 1) b.decorPop = -1;
      }
    }
    // smoke puffs
    for (const s of this.smokeEmitters) {
      s.t += dt * s.speed;
      const k = (s.t % 1);
      s.mesh.position.y = s.baseY + k * 2.6;
      s.mesh.position.x = s.baseX + Math.sin(k * 5 + s.phase) * 0.22;
      s.mesh.scale.setScalar(0.4 + k * 0.75);
      s.mesh.material.opacity = 0.22 * (1 - k);
    }
    // clock hands
    if (this.clockHands.length) {
      const now = new Date();
      const min = now.getMinutes() + now.getSeconds() / 60;
      const hr = (now.getHours() % 12) + min / 60;
      for (const c of this.clockHands) {
        c.minute.rotation.z = -(min / 60) * TAU;
        c.hour.rotation.z = -(hr / 12) * TAU;
      }
    }

    const active = this.getActive(playerPos);
    this.active = active;
    this.activeId = active ? active.def.id : null;
    if (!active) {
      this.marker.visible = false;
      return;
    }
    const markerY = active.wallTop + active.def.roofRise + 3.1;
    this.marker.visible = true;
    this.marker.position.set(active.x, markerY + Math.sin(time * 1.8) * 0.22, active.z);
    this.marker.userData.brick.rotation.y += dt * 0.9;
    this.marker.userData.ring.rotation.z += dt * 0.55;
    this.marker.userData.beam.scale.y = 1 + Math.sin(time * 2) * 0.03;
    if (this.marker.userData.lastActive !== active.def.id) {
      this.marker.userData.lastActive = active.def.id;
      this.updateMarkerLabel(active);
    } else if (Math.floor(time * 4) % 8 === 0) {
      // keep the brick count fresh without redrawing every frame
      if (this.marker.userData.lastCount !== active.placedCount) {
        this.marker.userData.lastCount = active.placedCount;
        this.updateMarkerLabel(active);
      }
    }
  }

  /* ============================================================
     Collision, save & load
     ============================================================ */
  collides(x, z, radius) {
    for (const b of this.buildings) {
      if (!b.completed) continue;
      const dx = x - b.x, dz = z - b.z;
      const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < b.def.w / 2 + radius && Math.abs(lz) < b.def.d / 2 + radius) return true;
    }
    return false;
  }

  serialize() {
    const out = {};
    for (const b of this.buildings) {
      const placed = [];
      b.slots.forEach((s, i) => { if (s.placed) placed.push(i); });
      out[b.def.id] = placed;
    }
    return out;
  }

  applySave(data) {
    if (!data) return;
    for (const b of this.buildings) {
      const placed = data[b.def.id];
      if (!Array.isArray(placed)) continue;
      const set = new Set(placed);
      b.slots.forEach((s, i) => {
        if (set.has(i) && !s.placed) {
          s.placed = true;
          b.placedCount++;
          b.ghost.setMatrixAt(i, HIDDEN);
          b.placed.setMatrixAt(i, s.localMatrix);
        }
      });
      b.ghost.instanceMatrix.needsUpdate = true;
      b.placed.instanceMatrix.needsUpdate = true;
      this.updateSiteSign(b);
      if (b.placedCount >= b.slots.length) this.finishBuilding(b, false);
    }
    this.syncPilesToPlaced();
  }

  // A save only records which slots are filled; the loose piles are rebuilt
  // fresh, so hide exactly as many bricks from each pile as were used.
  syncPilesToPlaced() {
    const remaining = new Map();
    for (const b of this.buildings) {
      for (const s of b.slots) {
        if (s.placed) remaining.set(s.key, (remaining.get(s.key) || 0) + 1);
      }
    }
    for (const b of this.buildings) {
      for (const p of b.piles) {
        let n = remaining.get(p.key) || 0;
        while (n > 0 && p.stock > 0) {
          const idx = p.used.indexOf(0);
          if (idx < 0) break;
          p.used[idx] = 1;
          p.stock--;
          n--;
          p.mesh.setMatrixAt(idx, HIDDEN);
        }
        remaining.set(p.key, n);
        p.mesh.instanceMatrix.needsUpdate = true;
        if (p.stock <= 0) this.hidePile(p);
      }
    }
  }

  getCompletionPercent() {
    return (this.totalPlaced / Math.max(1, this.totalBricks)) * 100;
  }
}
