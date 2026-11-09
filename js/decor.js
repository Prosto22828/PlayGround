/* Pretty little finishing touches added when a building is completed. */
import * as THREE from 'three';
import { PALETTES } from './data.js';
import {
  BASE_Y, makeRNG, makeCanvas, texFromCanvas, makeSignTexture,
  addBox, addCylinder,
} from './gfx.js';

const TAU = Math.PI * 2;

function roundedBox(g, w, h, d, color, matFor, x, y, z, opts = {}) {
  const mesh = addBox(g, w, h, d, color, matFor, x, y, z, opts);
  mesh.castShadow = true;
  return mesh;
}

function flowerCluster(g, matFor, x, y, z, colors, count = 6, spread = 0.34) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + Math.sin(i * 4.1) * 0.7;
    const r = (0.22 + ((i * 37) % 10) / 10) * spread;
    const flower = new THREE.Mesh(
      new THREE.SphereGeometry(0.065 + ((i * 13) % 7) * 0.008, 5, 4),
      matFor(colors[i % colors.length], { roughness: 0.75 })
    );
    flower.position.set(x + Math.cos(a) * r, y + Math.sin(i * 2.3) * 0.055, z + Math.sin(a) * r);
    flower.castShadow = true;
    g.add(flower);
  }
}

function leafTuft(g, matFor, x, y, z, scale = 1, color = '#6f9f63') {
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(0.055 * scale, 0.42 * scale, 4),
      matFor(color, { roughness: 1, flat: true })
    );
    leaf.position.set(x + (i - 1) * 0.09 * scale, y + 0.16 * scale, z + (i % 2) * 0.06);
    leaf.rotation.z = (i - 1) * 0.28;
    leaf.rotation.x = (i % 2) * 0.18;
    leaf.castShadow = true;
    g.add(leaf);
  }
}

function planter(g, matFor, x, z, color, flowers = ['#f6a9c0', '#f7d36c', '#f8f1de'], y = 0) {
  addBox(g, 0.62, 0.34, 0.48, color, matFor, x, y + 0.17, z, { roughness: 0.95 });
  addBox(g, 0.7, 0.08, 0.56, '#d6c0a1', matFor, x, y + 0.37, z, { roughness: 0.95 });
  flowerCluster(g, matFor, x, y + 0.5, z, flowers, 7, 0.36);
  leafTuft(g, matFor, x - 0.18, y + 0.35, z + 0.02, 0.8);
  leafTuft(g, matFor, x + 0.16, y + 0.34, z - 0.04, 0.7);
}

function chimney(manager, b, g, opts = {}) {
  const def = b.def;
  const halfD = def.d / 2 + 0.6;
  const z = opts.z ?? -0.55;
  const x = opts.x ?? -def.w / 2 + 1.1;
  const roofY = b.wallTop + (def.roof === 'flat' ? 0.3 : def.roofRise * (1 - Math.abs(z) / halfD));
  const h = opts.height ?? 1.55;
  const color = opts.color ?? PALETTES[def.palette].base.color;
  addBox(g, 0.78, h, 0.72, color, manager.matFor, x, roofY + h / 2 - 0.15, z, { roughness: 0.95 });
  addBox(g, 0.9, 0.16, 0.84, opts.cap ?? '#cbb2a0', manager.matFor, x, roofY + h - 0.08, z, { roughness: 0.95 });
  addBox(g, 0.62, 0.12, 0.58, '#6b5955', manager.matFor, x, roofY + h + 0.01, z, { roughness: 1 });

  const smokeMat = new THREE.MeshBasicMaterial({ color: '#f5eee6', transparent: true, opacity: 0.22, depthWrite: false });
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 5), smokeMat.clone());
    puff.position.set(x + 0.08, roofY + h + 0.2, z);
    puff.castShadow = false;
    puff.receiveShadow = false;
    g.add(puff);
    manager.smokeEmitters.push({
      mesh: puff, t: i / 5, speed: 0.24 + i * 0.006,
      baseX: x + 0.08, baseY: roofY + h + 0.15, phase: i * 1.7,
    });
  }
}

function awning(manager, b, g, colorA, colorB, z = null, width = null) {
  const def = b.def;
  const cz = z ?? def.d / 2 + 0.58;
  const w = width ?? Math.min(4.3, def.w * 0.62);
  const stripes = 7;
  const sw = w / stripes;
  const awn = new THREE.Group();
  awn.position.set(0, BASE_Y + 2.38, cz);
  awn.rotation.x = -0.16;
  for (let i = 0; i < stripes; i++) {
    addBox(awn, sw + 0.01, 0.07, 1.16, i % 2 ? colorB : colorA, manager.matFor, -w / 2 + sw * (i + 0.5), 0, 0, { roughness: 0.86 });
  }
  for (const side of [-1, 1]) {
    addBox(awn, 0.06, 0.06, 1.16, '#8c6a56', manager.matFor, side * (w / 2 + 0.03), -0.03, 0, { roughness: 0.9 });
  }
  const valance = new THREE.Group();
  valance.position.set(0, -0.2, 0.49);
  for (let i = 0; i < stripes; i++) {
    addBox(valance, sw + 0.01, 0.25, 0.06, i % 2 ? colorB : colorA, manager.matFor, -w / 2 + sw * (i + 0.5), 0, 0, { roughness: 0.86 });
  }
  awn.add(valance);
  g.add(awn);
  return awn;
}

function cafeTable(manager, b, g, x, z, color) {
  const topY = 0.82;
  addCylinder(g, 0.52, 0.52, 0.06, 16, color, manager.matFor, x, topY, z, { roughness: 0.85 });
  addCylinder(g, 0.055, 0.075, topY, 8, '#6d615c', manager.matFor, x, topY / 2, z, { roughness: 0.9 });
  addCylinder(g, 0.28, 0.34, 0.06, 12, '#6d615c', manager.matFor, x, 0.05, z, { roughness: 0.9 });
  // two tiny chairs
  for (const s of [-1, 1]) {
    const cx = x + s * 0.92;
    addBox(g, 0.56, 0.07, 0.46, '#b07f5d', manager.matFor, cx, 0.53, z, { roughness: 0.9 });
    addBox(g, 0.07, 0.83, 0.46, '#b07f5d', manager.matFor, cx + s * 0.23, 0.68, z, { rot: [0, 0, s * 0.1], roughness: 0.9 });
    for (const dz of [-0.17, 0.17]) {
      addBox(g, 0.06, 0.5, 0.06, '#6d615c', manager.matFor, cx, 0.26, z + dz, { roughness: 0.9 });
    }
  }
  // tiny cup
  addCylinder(g, 0.075, 0.055, 0.11, 8, '#f8efe0', manager.matFor, x + 0.11, topY + 0.085, z + 0.05, { roughness: 0.6 });
  addCylinder(g, 0.046, 0.045, 0.015, 8, '#d9a875', manager.matFor, x + 0.11, topY + 0.145, z + 0.05, { roughness: 0.7 });
}

function stall(manager, b, g, x, z, rot, colorA, colorB) {
  const st = new THREE.Group();
  st.position.set(x, 0, z);
  st.rotation.y = rot;
  const w = 2.2, d = 1.2;
  for (const sx of [-w / 2, w / 2]) {
    for (const sz of [-d / 2, d / 2]) {
      addBox(st, 0.09, 2.15, 0.09, '#9a7256', manager.matFor, sx, 1.07, sz, { roughness: 0.9 });
    }
  }
  addBox(st, w + 0.28, 0.1, d + 0.28, '#c29268', manager.matFor, 0, 1.24, 0, { roughness: 0.9 });
  addBox(st, w + 0.12, 0.7, 0.09, '#b6825a', manager.matFor, 0, 0.68, d / 2 + 0.02, { roughness: 0.9 });
  // striped canopy
  const stripes = 5, sw = (w + 0.34) / stripes;
  const canopy = new THREE.Group();
  canopy.position.set(0, 2.23, 0);
  canopy.rotation.z = 0.04;
  for (let i = 0; i < stripes; i++) {
    addBox(canopy, sw + 0.01, 0.07, d + 0.56, i % 2 ? colorB : colorA, manager.matFor, -w / 2 - 0.17 + sw * (i + 0.5), 0, 0, { roughness: 0.86 });
  }
  st.add(canopy);
  // crates & produce
  for (let i = 0; i < 2; i++) {
    const cx = -0.62 + i * 1.18;
    addBox(st, 0.62, 0.28, 0.52, '#c99766', manager.matFor, cx, 1.41, 0.02, { roughness: 0.95 });
    for (let k = 0; k < 7; k++) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.075 + (k % 3) * 0.012, 6, 5),
        manager.matFor(['#f08b64', '#f3c94f', '#dc6d7a', '#8cb96b'][(i * 3 + k) % 4], { roughness: 0.7 })
      );
      fruit.position.set(cx - 0.2 + (k % 3) * 0.19, 1.59 + Math.floor(k / 3) * 0.1, 0.01 + (k % 2) * 0.2);
      fruit.castShadow = true;
      st.add(fruit);
    }
  }
  g.add(st);
}

function bench(manager, b, g, x, z, rot = 0) {
  const bn = new THREE.Group();
  bn.position.set(x, 0, z);
  bn.rotation.y = rot;
  addBox(bn, 1.9, 0.12, 0.52, '#b4835e', manager.matFor, 0, 0.58, 0, { roughness: 0.9 });
  addBox(bn, 1.9, 0.58, 0.11, '#b4835e', manager.matFor, 0, 0.84, -0.23, { rot: [-0.08, 0, 0], roughness: 0.9 });
  for (const sx of [-0.78, 0.78]) {
    addBox(bn, 0.1, 0.56, 0.46, '#6d6a63', manager.matFor, sx, 0.28, 0, { roughness: 0.9 });
  }
  g.add(bn);
}

function namePlaque(manager, b, g, tint) {
  const def = b.def;
  const { texture } = makeSignTexture(def.sign, 'MAPLE HOLLOW', {
    w: 512, h: 168, bg: '#f8ecd7', fg: '#2d4550', border: 'rgba(80,62,48,.38)',
    titleSize: 54, subSize: 20, subColor: 'rgba(56,73,78,.55)',
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.65, 0.87),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  sign.position.set(0, BASE_Y + 2.62, def.d / 2 + 0.07);
  g.add(sign);
  addBox(g, 2.85, 0.05, 0.12, tint, manager.matFor, 0, BASE_Y + 2.15, def.d / 2 + 0.03, { roughness: 0.9 });
}

function windowBoxes(manager, b, g, colors) {
  const trim = PALETTES[b.def.palette].trim.color;
  for (const w of b.windows) {
    if (w.sideName !== 'front' && w.sideName !== 'back') continue;
    if (w.u === 0 && w.sideName === 'front') continue;
    const z = (b.def.d / 2) * (w.sideName === 'front' ? 1 : -1) + (w.sideName === 'front' ? 0.25 : -0.25);
    addBox(g, Math.min(1.7, w.winW + 0.36), 0.2, 0.3, trim, manager.matFor, w.u, w.y - w.winH / 2 - 0.25, z, { roughness: 0.9 });
    flowerCluster(g, manager.matFor, w.u, w.y - w.winH / 2 - 0.09, z + (w.sideName === 'front' ? 0.09 : -0.09), colors, 5, 0.52);
  }
}

export function addBuildingDecor(manager, b, animate = true) {
  const def = b.def;
  const pal = PALETTES[def.palette];
  const g = new THREE.Group();
  g.name = `decor-${def.id}`;
  b.group.add(g);
  const rng = makeRNG(3100 + b.index * 719);
  const trim = pal.trim.color;
  const accent = pal.accent.color;
  const glass = pal.glass.color;
  const flowers = [accent, '#f7f2e3', '#f49bb5', '#f7d36c'];

  // Every finished home gets a proper little name board.
  namePlaque(manager, b, g, trim);

  // A warm lantern beside every front door.
  for (const side of [-1, 1]) {
    addBox(g, 0.08, 0.72, 0.08, '#66564d', manager.matFor, side * 1.11, BASE_Y + 1.68, def.d / 2 + 0.12, { roughness: 0.9 });
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.28, 0.22),
      new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffc762', emissiveIntensity: 1.15, roughness: 0.35 })
    );
    lamp.position.set(side * 1.11, BASE_Y + 2.07, def.d / 2 + 0.14);
    lamp.castShadow = false;
    g.add(lamp);
    addBox(g, 0.3, 0.05, 0.3, '#66564d', manager.matFor, side * 1.11, BASE_Y + 2.24, def.d / 2 + 0.14, { roughness: 0.9 });
  }

  // A flower bed on either side of the front step.
  for (const side of [-1, 1]) {
    const x = side * (def.w / 2 + 0.5);
    addBox(g, 1.15, 0.28, 2.0, '#c2a78d', manager.matFor, x, 0.14, def.d / 2 + 1.25, { roughness: 1 });
    addBox(g, 0.99, 0.1, 1.84, '#7f624c', manager.matFor, x, 0.29, def.d / 2 + 1.25, { roughness: 1 });
    flowerCluster(g, manager.matFor, x, 0.5, def.d / 2 + 1.25, flowers, 12, 0.72);
    leafTuft(g, manager.matFor, x - 0.3, 0.38, def.d / 2 + 1.1, 1.05);
    leafTuft(g, manager.matFor, x + 0.3, 0.36, def.d / 2 + 1.45, 0.95);
  }

  switch (def.style) {
    case 'cottage': {
      chimney(manager, b, g, { x: -def.w / 2 + 1.0, z: -0.4 });
      windowBoxes(manager, b, g, flowers);
      // crooked garden fence and a postbox
      for (let i = 0; i < 5; i++) {
        const x = -1.7 + i * 0.85;
        addBox(g, 0.09, 0.72 + (i % 2) * 0.06, 0.09, '#f1e6cf', manager.matFor, x, 0.36, def.d / 2 + 3.2, { rot: [0, 0, (i % 2 ? 0.04 : -0.04)], roughness: 0.95 });
        addBox(g, 0.79, 0.08, 0.07, '#f1e6cf', manager.matFor, x + 0.42, 0.5, def.d / 2 + 3.2, { roughness: 0.95 });
      }
      // daisy patch
      for (let i = 0; i < 9; i++) {
        const x = 2.8 + rng() * 1.4, z = def.d / 2 + 1.6 + rng() * 2.0;
        addCylinder(g, 0.014, 0.016, 0.34, 3, '#6c9a62', manager.matFor, x, 0.17, z, { roughness: 1 });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 5, 4), manager.matFor(i % 3 ? '#f8f2df' : '#f4c95e', { roughness: 0.8 }));
        head.position.set(x, 0.36, z);
        g.add(head);
      }
      break;
    }
    case 'cafe': {
      awning(manager, b, g, '#e96f57', '#fdf1da');
      cafeTable(manager, b, g, -def.w / 2 - 0.85, def.d / 2 + 1.7, '#ead8be');
      cafeTable(manager, b, g, -def.w / 2 - 0.85, def.d / 2 + 3.5, '#ead8be');
      windowBoxes(manager, b, g, ['#e8866a', '#f8f1de', '#f5b8cf']);
      // hanging sign
      addBox(g, 0.07, 0.07, 1.05, '#6f5b4d', manager.matFor, def.w / 2 + 0.32, BASE_Y + 2.72, def.d / 2 + 0.38, { roughness: 0.9 });
      const { texture } = makeSignTexture('CAFÉ', 'fresh buns', {
        w: 300, h: 180, bg: '#f7e3c1', fg: '#4e3b35', titleSize: 54, subSize: 21, border: 'rgba(78,59,53,.4)',
      });
      const hs = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.54), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }));
      hs.position.set(def.w / 2 + 0.32, BASE_Y + 2.22, def.d / 2 + 0.85);
      hs.rotation.y = Math.PI / 2;
      g.add(hs);
      break;
    }
    case 'library': {
      bench(manager, b, g, -def.w / 2 - 1.15, def.d / 2 + 1.25, Math.PI / 2);
      windowBoxes(manager, b, g, ['#f7f2e3', '#c7a6de', '#9ed3e8']);
      // stone reading urn
      addCylinder(g, 0.42, 0.53, 0.74, 12, '#cbb3a0', manager.matFor, def.w / 2 + 1.15, 0.37, def.d / 2 + 1.4, { roughness: 0.98 });
      addCylinder(g, 0.56, 0.56, 0.11, 12, '#e0c9b4', manager.matFor, def.w / 2 + 1.15, 0.75, def.d / 2 + 1.4, { roughness: 0.95 });
      leafTuft(g, manager.matFor, def.w / 2 + 1.15, 0.8, def.d / 2 + 1.4, 1.3, '#6f9f63');
      // little book stack on bench
      addBox(g, 0.36, 0.07, 0.25, '#d9c2a5', manager.matFor, -def.w / 2 - 1.15, 0.68, def.d / 2 + 0.85, { rot: [0, 0.3, 0], roughness: 0.9 });
      addBox(g, 0.32, 0.06, 0.24, '#b88a71', manager.matFor, -def.w / 2 - 1.15, 0.74, def.d / 2 + 0.85, { rot: [0, 0.05, 0], roughness: 0.9 });
      break;
    }
    case 'market': {
      // market stalls flanking the main entry
      stall(manager, b, g, -def.w / 2 - 0.9, def.d / 2 + 1.1, Math.PI / 2 + 0.12, '#d96b7d', '#f7e3c8');
      stall(manager, b, g, def.w / 2 + 0.9, def.d / 2 + 1.1, -Math.PI / 2 - 0.12, '#6b9f86', '#f7e3c8');
      // bunting
      for (let i = 0; i < 7; i++) {
        const x = -def.w / 2 + 0.8 + i * ((def.w - 1.6) / 6);
        addBox(g, 0.22, 0.28, 0.03, ['#ee6b54', '#f7d36c', '#8ae8f4'][i % 3], manager.matFor, x, BASE_Y + 2.96 - Math.sin((i / 6) * Math.PI) * 0.15, def.d / 2 + 0.35, { rot: [0, 0, Math.PI / 4], roughness: 0.8 });
      }
      windowBoxes(manager, b, g, ['#ee6b54', '#f7d36c', '#8ae8f4']);
      break;
    }
    case 'greenhouse': {
      // terracotta pots and lush planting
      for (let i = 0; i < 7; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (def.w / 2 + 0.45 + (i % 3) * 0.42);
        const z = def.d / 2 + 0.6 + Math.floor(i / 2) * 0.8;
        addCylinder(g, 0.24, 0.19, 0.38, 8, ['#c97d5c', '#d79070', '#b96c50'][i % 3], manager.matFor, x, 0.19, z, { roughness: 0.95 });
        leafTuft(g, manager.matFor, x, 0.38, z, 1.15, ['#6f9f63', '#82af6d', '#5f8e69'][i % 3]);
        if (i % 2 === 0) flowerCluster(g, manager.matFor, x, 0.62, z, ['#f6d36b', '#f49bb5', '#f8f1de'], 4, 0.3);
      }
      // vine across the front
      for (let i = 0; i < 9; i++) {
        const x = -def.w / 2 + 0.6 + i * ((def.w - 1.2) / 8);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), manager.matFor(i % 2 ? '#72a566' : '#86b674', { roughness: 1, flat: true }));
        leaf.position.set(x, BASE_Y + 2.35 + Math.sin(i) * 0.12, def.d / 2 + 0.12);
        leaf.scale.set(1, 0.65, 0.5);
        g.add(leaf);
      }
      break;
    }
    case 'workshop': {
      // crates, a barrel and a wheelbarrow outside
      for (let i = 0; i < 4; i++) {
        const x = -def.w / 2 - 1.3 + (i % 2) * 0.74;
        const z = def.d / 2 + 1.35 + Math.floor(i / 2) * 0.62;
        addBox(g, 0.66, 0.58, 0.6, i % 2 ? '#b98d62' : '#c99e70', manager.matFor, x, 0.29, z, { rot: [0, i * 0.32, 0], roughness: 0.95 });
        addBox(g, 0.7, 0.08, 0.64, '#8f6c4d', manager.matFor, x, 0.6, z, { rot: [0, i * 0.32, 0], roughness: 0.95 });
      }
      addCylinder(g, 0.33, 0.37, 0.82, 12, '#9a7356', manager.matFor, def.w / 2 + 1.2, 0.41, def.d / 2 + 1.5, { roughness: 0.95 });
      for (const y of [0.18, 0.68]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 5, 14), manager.matFor('#66564d', { roughness: 0.8 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(def.w / 2 + 1.2, y, def.d / 2 + 1.5);
        g.add(ring);
      }
      // wheelbarrow
      const barrow = new THREE.Group();
      barrow.position.set(def.w / 2 + 2.3, 0, def.d / 2 + 2.2);
      barrow.rotation.y = -0.4;
      addBox(barrow, 1.1, 0.42, 0.72, '#4f9f9d', manager.matFor, 0, 0.47, 0, { roughness: 0.85 });
      addBox(barrow, 1.18, 0.1, 0.78, '#408a89', manager.matFor, 0, 0.7, 0, { roughness: 0.85 });
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 6, 12), manager.matFor('#66564d', { roughness: 0.9 }));
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(0, 0.28, 0.4);
      barrow.add(wheel);
      addBox(barrow, 0.08, 0.08, 0.92, '#9a7256', manager.matFor, -0.38, 0.48, -0.55, { roughness: 0.9 });
      addBox(barrow, 0.08, 0.08, 0.92, '#9a7256', manager.matFor, 0.38, 0.48, -0.55, { roughness: 0.9 });
      g.add(barrow);
      // roof vent
      addBox(g, 1.0, 0.7, 1.0, pal.base.color, manager.matFor, def.w * 0.27, b.wallTop + 0.6, -def.d * 0.2, { roughness: 0.95 });
      addBox(g, 1.14, 0.12, 1.14, '#66564d', manager.matFor, def.w * 0.27, b.wallTop + 0.98, -def.d * 0.2, { roughness: 0.9 });
      break;
    }
    case 'bakery': {
      chimney(manager, b, g, { x: def.w / 2 - 1.25, z: -0.2, color: '#c99e70', height: 1.85 });
      awning(manager, b, g, '#e3a73a', '#fdf3df', def.d / 2 + 0.5, 4.0);
      windowBoxes(manager, b, g, ['#e8866a', '#f7d36c', '#f8f1de']);
      bench(manager, b, g, -def.w / 2 - 1.15, def.d / 2 + 1.45, Math.PI / 2);
      // bread board outside
      const bread = new THREE.Group();
      bread.position.set(def.w / 2 + 1.25, 0, def.d / 2 + 1.7);
      addBox(bread, 1.0, 0.62, 0.6, '#c99766', manager.matFor, 0, 0.31, 0, { roughness: 0.95 });
      addBox(bread, 1.08, 0.07, 0.68, '#8f6c4d', manager.matFor, 0, 0.65, 0, { roughness: 0.95 });
      for (let i = 0; i < 3; i++) {
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 7, 5), manager.matFor('#e5b06a', { roughness: 0.85 }));
        loaf.scale.set(1.25, 0.62, 0.8);
        loaf.position.set(-0.28 + i * 0.28, 0.77, 0);
        loaf.castShadow = true;
        bread.add(loaf);
      }
      g.add(bread);
      break;
    }
    case 'chapel': {
      // bell and cross in the gable
      addBox(g, 0.13, 0.8, 0.13, '#caa65c', manager.matFor, 0, b.roofTop + 0.28, 0, { roughness: 0.6, metalness: 0.25 });
      addBox(g, 0.56, 0.12, 0.13, '#caa65c', manager.matFor, 0, b.roofTop + 0.42, 0, { roughness: 0.6, metalness: 0.25 });
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.34, 0.5, 12, 1, true), manager.matFor('#b89045', { roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide }));
      bell.position.set(0, b.wallTop + 0.92, def.d / 2 + 0.15);
      g.add(bell);
      addBox(g, 0.48, 0.12, 0.22, '#caa65c', manager.matFor, 0, b.wallTop + 1.22, def.d / 2 + 0.15, { roughness: 0.6, metalness: 0.25 });
      // rose window
      const rose = new THREE.Mesh(new THREE.CircleGeometry(0.66, 20), new THREE.MeshStandardMaterial({ color: glass, emissive: '#6fb6c4', emissiveIntensity: 0.18, roughness: 0.35 }));
      rose.position.set(0, b.wallTop - 0.35, def.d / 2 + 0.31);
      g.add(rose);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 20), manager.matFor(trim, { roughness: 0.9 }));
      ring.position.set(0, b.wallTop - 0.35, def.d / 2 + 0.33);
      g.add(ring);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        addBox(g, 0.05, 0.62, 0.05, trim, manager.matFor, Math.cos(a) * 0.34, b.wallTop - 0.35 + Math.sin(a) * 0.34, def.d / 2 + 0.34, { rot: [0, 0, -a], roughness: 0.9 });
      }
      // stone path
      for (let i = 0; i < 5; i++) {
        const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.08, 7), manager.matFor('#cdb49a', { roughness: 1 }));
        stone.position.set((rng() - 0.5) * 0.3, 0.04, def.d / 2 + 1.1 + i * 0.72);
        stone.rotation.y = rng() * TAU;
        stone.receiveShadow = true;
        g.add(stone);
      }
      for (const side of [-1, 1]) planter(manager, g, side * 1.35, def.d / 2 + 0.65, '#b79d89', ['#f7f2e3', '#f6d36b', '#c7a6de']);
      break;
    }
    case 'clocktower': {
      // clock face and moving hands
      const { canvas, ctx } = makeCanvas(256, 256);
      ctx.clearRect(0, 0, 256, 256);
      ctx.fillStyle = '#f7ecd6';
      ctx.beginPath(); ctx.arc(128, 128, 122, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#5d4a62'; ctx.lineWidth = 12; ctx.stroke();
      ctx.fillStyle = '#4b3e50';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ctx.save();
        ctx.translate(128 + Math.cos(a) * 99, 128 + Math.sin(a) * 99);
        ctx.rotate(a + Math.PI / 2);
        ctx.fillRect(-2.4, -7, 4.8, i % 3 === 0 ? 17 : 10);
        ctx.restore();
      }
      ctx.font = '700 22px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MAPLE', 128, 84);
      ctx.fillText('HOLLOW', 128, 172);
      const tex = texFromCanvas(canvas);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.78, 40), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      face.position.set(0, b.wallTop + 0.42, def.d / 2 + 0.31);
      g.add(face);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.09, 8, 32), manager.matFor('#caa65c', { roughness: 0.65, metalness: 0.2 }));
      ring.position.set(0, b.wallTop + 0.42, def.d / 2 + 0.33);
      g.add(ring);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), manager.matFor('#4b3e50', { roughness: 0.6, metalness: 0.3 }));
      hub.position.set(0, b.wallTop + 0.42, def.d / 2 + 0.42);
      g.add(hub);
      const minutePivot = new THREE.Group();
      minutePivot.position.set(0, b.wallTop + 0.42, def.d / 2 + 0.38);
      const minuteHand = addBox(minutePivot, 0.065, 0.58, 0.04, '#3d3142', manager.matFor, 0, 0.24, 0, { roughness: 0.6 });
      minuteHand.castShadow = false;
      const hourPivot = new THREE.Group();
      hourPivot.position.set(0, b.wallTop + 0.42, def.d / 2 + 0.4);
      const hourHand = addBox(hourPivot, 0.09, 0.4, 0.04, '#3d3142', manager.matFor, 0, 0.16, 0, { roughness: 0.6 });
      hourHand.castShadow = false;
      g.add(minutePivot, hourPivot);
      manager.clockHands.push({ minute: minutePivot, hour: hourPivot });
      // finial and weather vane
      addBox(g, 0.12, 1.0, 0.12, '#caa65c', manager.matFor, 0, def.roof === 'flat' ? b.wallTop + 0.7 : b.roofTop + 0.45, 0, { roughness: 0.6, metalness: 0.25 });
      const vane = new THREE.Group();
      vane.position.set(0, (def.roof === 'flat' ? b.wallTop : b.roofTop) + 1.0, 0);
      addBox(vane, 0.72, 0.05, 0.05, '#caa65c', manager.matFor, 0, 0, 0, { roughness: 0.6, metalness: 0.25 });
      addBox(vane, 0.3, 0.24, 0.04, '#caa65c', manager.matFor, 0.36, 0, 0, { roughness: 0.6, metalness: 0.25 });
      g.add(vane);
      // flower planters and bunting
      for (const side of [-1, 1]) planter(manager, g, side * 1.45, def.d / 2 + 0.9, '#cbb3a0', ['#f8f1de', '#f6d36b', '#f49bb5']);
      for (let i = 0; i < 9; i++) {
        const x = -def.w / 2 + 0.7 + i * ((def.w - 1.4) / 8);
        addBox(g, 0.2, 0.26, 0.03, ['#ee6b54', '#f7d36c', '#8ae8f4', '#79d69a'][i % 4], manager.matFor, x, b.wallTop - 0.7 - Math.sin((i / 8) * Math.PI) * 0.2, def.d / 2 + 0.25, { rot: [0, 0, Math.PI / 4], roughness: 0.8 });
      }
      break;
    }
    default:
      break;
  }

  // Random tiny sand-coloured pebbles around the base for texture.
  for (let i = 0; i < 6; i++) {
    const pebble = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.1 + rng() * 0.08, 0),
      manager.matFor(['#cdb9a1', '#c2ab8f', '#d9c8ad'][i % 3], { roughness: 1, flat: true })
    );
    pebble.position.set((rng() - 0.5) * (def.w + 4), 0.09, def.d / 2 + 0.75 + rng() * 2.4);
    pebble.rotation.set(rng(), rng() * TAU, rng());
    pebble.castShadow = true;
    g.add(pebble);
  }

  if (animate) g.scale.setScalar(0.001);
  return g;
}
