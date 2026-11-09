/* Shared geometry, texture and material helpers. */
import * as THREE from 'three';
import { TOWN } from './data.js';

export const ROW_H = 0.58;
export const BASE_Y = 0.62;
export const WALL_T = 0.5;

export function makeRNG(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildingWorldPosition(def) {
  const th = (def.angle * Math.PI) / 180;
  return { x: TOWN.rx * Math.cos(th), z: TOWN.rz * Math.sin(th) };
}

export function buildingYaw(def) {
  const { x, z } = buildingWorldPosition(def);
  return Math.atan2(-x, -z);
}

function roundedRectShape(size, radius) {
  const s = size / 2;
  const r = Math.min(radius, s);
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  shape.closePath();
  return shape;
}

export function makeBrickGeometry() {
  const shape = roundedRectShape(1, 0.09);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.94,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.028,
    bevelThickness: 0.028,
    curveSegments: 3,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

export function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function texFromCanvas(canvas, anisotropy = 4) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

export function createMaterialCache() {
  const cache = new Map();
  return function material(color, opts = {}) {
    const key = `${color}|${opts.roughness ?? 0.86}|${opts.metalness ?? 0}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? 0}|${opts.transparent ?? false}|${opts.opacity ?? 1}|${opts.side ?? 0}`;
    if (cache.has(key)) return cache.get(key);
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: opts.roughness ?? 0.86,
      metalness: opts.metalness ?? 0,
      flatShading: opts.flat ?? false,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : 0x000000,
      emissiveIntensity: opts.emissiveIntensity ?? 0,
    });
    cache.set(key, m);
    return m;
  };
}

export function addBox(parent, w, h, d, color, matFor, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    matFor(color, opts)
  );
  mesh.position.set(x, y, z);
  if (opts.rot) mesh.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(parent, rt, rb, h, seg, color, matFor, x = 0, y = 0, z = 0, opts = {}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    matFor(color, opts)
  );
  mesh.position.set(x, y, z);
  if (opts.rot) mesh.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
  mesh.castShadow = opts.castShadow !== false;
  mesh.receiveShadow = opts.receiveShadow !== false;
  parent.add(mesh);
  return mesh;
}

export function makeSignTexture(title, subtitle, opts = {}) {
  const { canvas, ctx } = makeCanvas(opts.w || 512, opts.h || 220);
  const bg = opts.bg || '#f8ecd7';
  const fg = opts.fg || '#2b4552';
  ctx.fillStyle = bg;
  ctx.beginPath();
  const r = 16;
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, r);
  ctx.fill();
  ctx.strokeStyle = opts.border || 'rgba(70,58,45,.35)';
  ctx.lineWidth = 6;
  ctx.stroke();
  if (opts.brickColor) {
    const bw = 76, bh = 36;
    const bx = 28, by = 26;
    ctx.fillStyle = opts.brickColor;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath();
    ctx.roundRect(bx + 6, by + 5, bw - 12, 8, 4);
    ctx.fill();
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${opts.titleSize || 52}px Fredoka, "Trebuchet MS", sans-serif`;
  ctx.fillText(title, canvas.width / 2, opts.subtitle ? canvas.height * 0.44 : canvas.height * 0.52);
  if (subtitle) {
    ctx.font = `700 ${opts.subSize || 24}px Nunito, "Segoe UI", sans-serif`;
    ctx.fillStyle = opts.subColor || 'rgba(50,64,70,.63)';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.72);
  }
  return { canvas, ctx, texture: texFromCanvas(canvas) };
}

export function drawSignBoard(texture, ctx, canvas, title, subtitle) {
  // helper used for live-updating construction signs
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8ecd7';
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 18);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92,70,50,.35)';
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.fillStyle = '#2b4552';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 58px Fredoka, "Trebuchet MS", sans-serif';
  ctx.fillText(title, canvas.width / 2, 76);
  ctx.font = '800 28px Nunito, "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(50,64,70,.55)';
  ctx.fillText(subtitle, canvas.width / 2, 142);
  texture.needsUpdate = true;
}
