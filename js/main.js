/* Brick by Brick — game bootstrap, first-person controls, HUD and save state. */
import * as THREE from 'three';
import {
  BUILDINGS, ABILITIES, BRICK_TYPES, PALETTES, TOWN, ICONS, brickKey, keyInfo,
} from './data.js';
import { createMaterialCache, makeBrickGeometry } from './gfx.js';
import { Environment } from './environment.js';
import { BuildingManager } from './buildings.js';
import { SoundEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const SAVE_KEY = 'brickByBrick.save.v2';
const SOUND_KEY = 'brickByBrick.sound';

const canvas = $('scene');
const titleScreen = $('title-screen');
const hud = $('hud');
const loading = $('loading');
const touchControls = $('touch-controls');
const crosshair = $('crosshair');
const interaction = $('interaction');
const interactionKey = $('interaction-key');
const interactionTitle = $('interaction-title');
const interactionAction = $('interaction-action');
const interactionSwatch = $('interaction-swatch');
const miniHint = $('mini-hint');
const banner = $('banner');
const bannerTitle = $('banner-title');
const bannerKicker = $('banner-kicker');
const abilityToast = $('ability-toast');
const abilityToastTitle = $('ability-toast-title');
const abilityToastIcon = $('ability-toast-icon');
const invList = $('inv-list');
const invEmpty = $('inv-empty');
const invCap = $('inv-cap');
const objectiveName = $('objective-name');
const objectiveCount = $('objective-count');
const objectiveBar = $('objective-bar');
const objectiveIconBrick = document.querySelector('#objective-card .mini-brick');
const objectiveArrow = $('objective-arrow');
const townProgress = $('town-progress');
const abilityBar = $('ability-bar');

const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('touch');

/* =========================================================
   Renderer, scene and lighting
   ========================================================= */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isTouch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 420);
camera.rotation.order = 'YXZ';
scene.add(camera);

const matFor = createMaterialCache();
const brickGeo = makeBrickGeometry();
const audio = new SoundEngine();

const env = new Environment(scene, { mobile: isTouch }, matFor, brickGeo).build();
const buildings = new BuildingManager(scene, matFor, brickGeo, { mobile: isTouch }).build();
scene.updateMatrixWorld(true);

const hemi = new THREE.HemisphereLight(0xdff3ff, 0xa58e79, 1.55);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d2, 2.35);
sun.position.set(-38, 54, 33);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
sun.shadow.camera.left = -54;
sun.shadow.camera.right = 54;
sun.shadow.camera.top = 54;
sun.shadow.camera.bottom = -54;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 150;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.018;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xcfe7ff, 0.46);
fill.position.set(30, 20, -44);
scene.add(fill);

/* =========================================================
   Game state
   ========================================================= */
let mode = 'title'; // title | playing | paused | final
let uiOpen = false;
let planReturn = 'game';
let howReturn = 'title';
let finalShown = false;
let suppressCallbacks = false;
let time = 0;
let startedAt = 0;
let hover = null;
let interactHeld = false;
let lastInteract = 0;
let magnetCooldown = 0;
let hintTimer = null;
let bannerTimer = null;
let toastTimer = null;
let finalTimer = null;
let hudRefreshAcc = 0;
let lastHoverKey = '';

const inventory = [];
const capacity = () => {
  if (buildings.completedCount >= 9) return 22;
  if (buildings.completedCount >= 3) return 16;
  return 10;
};

const player = {
  pos: new THREE.Vector3(TOWN.spawn[0], 0, TOWN.spawn[1]),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: -0.03,
  vy: 0,
  onGround: true,
  jumps: 0,
  bob: 0,
  bobPhase: 0,
  stepDist: 0,
  speed: 0,
};
let jumpRequested = false;
const keys = new Set();
const joystick = { x: 0, y: 0, active: false, id: null };

const raycaster = new THREE.Raycaster();
raycaster.far = 13;
const centerNDC = new THREE.Vector2(0, 0);
const forward = new THREE.Vector3();
const camWorld = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const tmpMat = new THREE.Matrix4();

/* =========================================================
   Highlight meshes
   ========================================================= */
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: '#8ae8f4', transparent: true, opacity: 0.95, depthTest: false })
);
outline.visible = false;
outline.renderOrder = 18;
scene.add(outline);

const pileRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.42, 0.055, 6, 30),
  new THREE.MeshBasicMaterial({ color: '#8ae8f4', transparent: true, opacity: 0.85, depthWrite: false })
);
pileRing.rotation.x = Math.PI / 2;
pileRing.visible = false;
pileRing.renderOrder = 16;
scene.add(pileRing);

const heldMat = new THREE.MeshStandardMaterial({ color: '#e05a4d', roughness: 0.72, metalness: 0.02 });
const heldBrick = new THREE.Mesh(brickGeo, heldMat);
heldBrick.visible = false;
heldBrick.castShadow = false;
heldBrick.receiveShadow = false;
camera.add(heldBrick);

/* =========================================================
   Particles
   ========================================================= */
const particleGeo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const particleMats = new Map();
const particles = [];

function particleMat(color) {
  let m = particleMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    particleMats.set(color, m);
  }
  return m;
}

function burst(pos, color, count = 8, power = 0.9) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(particleGeo, particleMat(color));
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 0.35;
    mesh.position.y += Math.random() * 0.35;
    mesh.position.z += (Math.random() - 0.5) * 0.35;
    mesh.rotation.set(Math.random() * TAU, Math.random() * TAU, Math.random() * TAU);
    mesh.scale.setScalar(0.65 + Math.random() * 1.1);
    mesh.castShadow = false;
    scene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * power,
        1.0 + Math.random() * power * 1.5,
        (Math.random() - 0.5) * power
      ),
      life: 0.45 + Math.random() * 0.45,
      max: 0.9,
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
      continue;
    }
    p.vel.y -= 10 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.rotation.x += dt * 5;
    p.mesh.rotation.y += dt * 4;
    if (p.mesh.position.y < 0.05) {
      p.mesh.position.y = 0.05;
      p.vel.y *= -0.25;
    }
    p.mesh.scale.setScalar(Math.max(0.08, Math.min(1, p.life / 0.6)));
  }
}

/* =========================================================
   Accessibility and small helpers
   ========================================================= */
function showHint(text, ms = 2600) {
  miniHint.textContent = text;
  miniHint.classList.remove('hidden');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => miniHint.classList.add('hidden'), ms);
}

function showBanner(b) {
  bannerKicker.textContent = buildings.completedCount === BUILDINGS.length ? 'Town Restored' : 'Construction Complete';
  bannerTitle.textContent = b.def.name;
  clearTimeout(bannerTimer);
  banner.classList.remove('hidden', 'leaving');
  // restart the entrance animation
  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = '';
  bannerTimer = setTimeout(() => {
    banner.classList.add('leaving');
    bannerTimer = setTimeout(() => banner.classList.add('hidden'), 460);
  }, 2800);
}

function showAbilityToast(id) {
  const a = ABILITIES.find((x) => x.id === id);
  if (!a) return;
  abilityToastTitle.textContent = a.name;
  abilityToastIcon.innerHTML = ICONS[a.icon] || '';
  abilityToast.classList.remove('hidden');
  abilityToast.style.animation = 'none';
  void abilityToast.offsetWidth;
  abilityToast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => abilityToast.classList.add('hidden'), 3800);
}

function setSoundUi() {
  document.body.classList.toggle('muted', !audio.enabled);
  const label = `Sound: ${audio.enabled ? 'on' : 'off'}`;
  $('btn-title-sound').textContent = label;
  $('btn-pause-sound').textContent = label;
  $('btn-sound').setAttribute('aria-pressed', String(audio.enabled));
  try { localStorage.setItem(SOUND_KEY, audio.enabled ? '1' : '0'); } catch (e) { /* ignore */ }
}

function toggleSound() {
  audio.ensure();
  audio.setEnabled(!audio.enabled);
  setSoundUi();
  if (audio.enabled) audio.ui();
}

try {
  const savedSound = localStorage.getItem(SOUND_KEY);
  if (savedSound === '0') audio.enabled = false;
} catch (e) { /* ignore */ }
setSoundUi();

/* =========================================================
   Saving
   ========================================================= */
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.placed) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function writeSave() {
  if (mode === 'title' && !startedAt) return;
  try {
    const placed = buildings.serialize();
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 2,
      placed,
      sound: audio.enabled,
      startedAt,
      savedAt: Date.now(),
    }));
  } catch (e) { /* ignore quota errors */ }
}

let saveQueued = 0;
function saveSoon() {
  clearTimeout(saveQueued);
  saveQueued = setTimeout(writeSave, 350);
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
}

const savedGame = readSave();
if (savedGame) {
  $('btn-continue').classList.remove('hidden');
  const note = $('saved-note');
  note.textContent = 'A half-built Maple Hollow is waiting for you.';
  note.classList.remove('hidden');
}

/* =========================================================
   Abilities
   ========================================================= */
const unlocked = new Set();
let announced = new Set();

function refreshAbilities(announce = false) {
  const next = new Set(ABILITIES.filter((a) => buildings.completedCount >= a.need).map((a) => a.id));
  const newly = [...next].filter((id) => !unlocked.has(id));
  unlocked.clear();
  for (const id of next) unlocked.add(id);

  if (announce) {
    for (const id of newly) {
      if (announced.has(id) || id === 'sprint') continue;
      announced.add(id);
      showAbilityToast(id);
      audio.unlock();
    }
  }
  for (const id of next) announced.add(id);

  abilityBar.querySelectorAll('.ability').forEach((el) => {
    const id = el.dataset.ability;
    const isUnlocked = unlocked.has(id);
    el.classList.toggle('locked', !isUnlocked);
    el.classList.toggle('ready', isUnlocked);
    const level = el.querySelector('.ability-level');
    if (level) level.textContent = isUnlocked ? '✓' : (ABILITIES.find((a) => a.id === id)?.need ?? '');
  });

  // Touch magnet button reflects the skill unlock.
  const magnetBtn = $('touch-magnet');
  if (magnetBtn) magnetBtn.classList.toggle('locked', !unlocked.has('magnet'));

  refreshInventory();
}

function buildAbilityBar() {
  abilityBar.innerHTML = ABILITIES.map((a) => `
    <button class="ability locked" data-ability="${a.id}" title="${a.desc}">
      <span class="ability-circle">${ICONS[a.icon] || ''}<span class="ability-level">${a.need}</span></span>
      <span class="ability-key">${a.key}</span>
      <span class="ability-label">${a.name}</span>
    </button>
  `).join('');
}

/* =========================================================
   Inventory
   ========================================================= */
function invCount() {
  return inventory.length;
}

function addToInventory(key, piece, source) {
  if (invCount() >= capacity()) return false;
  inventory.push({ key, piece, source });
  refreshInventory();
  updateHeldBrick();
  return true;
}

function takeFromInventory(key) {
  const i = inventory.findIndex((it) => it.key === key);
  if (i < 0) return null;
  return inventory.splice(i, 1)[0];
}

function refreshInventory() {
  const groups = new Map();
  for (const item of inventory) {
    const g = groups.get(item.key);
    if (g) g.count++;
    else groups.set(item.key, { piece: item.piece, count: 1 });
  }
  invList.innerHTML = [...groups.values()].map((g) => `
    <span class="inv-chip" title="${g.piece.name}">
      <span class="chip-brick" style="background:linear-gradient(to bottom, color-mix(in srgb, ${g.piece.color} 84%, white), ${g.piece.color})"></span>
      <span class="chip-count">${g.count}</span>
    </span>
  `).join('');
  invEmpty.classList.toggle('hidden', groups.size > 0 || inventory.length > 0);
  invCap.textContent = `${invCount()} / ${capacity()}`;
  invCap.classList.toggle('full', invCount() >= capacity());
  updateHeldBrick();
}

function updateHeldBrick() {
  const item = inventory[inventory.length - 1];
  if (!item || mode === 'title' || uiOpen) {
    heldBrick.visible = false;
    return;
  }
  const dims = BRICK_TYPES[item.piece.type]?.dims || BRICK_TYPES['2x1'].dims;
  heldBrick.visible = mode === 'playing';
  heldBrick.material.color.set(item.piece.color);
  heldBrick.scale.set(dims[0] * 0.3, dims[1] * 0.34, Math.max(0.2, dims[2] * 0.4));
  heldBrick.position.set(0.43, -0.34, -0.78);
  heldBrick.rotation.set(0.28, -0.48, 0.12);
}

/* =========================================================
   HUD
   ========================================================= */
function activeBuilding() {
  return buildings.active || buildings.getActive(player.pos);
}

function refreshObjective() {
  const b = activeBuilding();
  if (!b) {
    objectiveName.textContent = 'Maple Hollow';
    objectiveCount.textContent = 'All done';
    objectiveBar.style.width = '100%';
    townProgress.textContent = `${BUILDINGS.length} / ${BUILDINGS.length}`;
    return;
  }
  objectiveName.textContent = b.def.name;
  objectiveCount.textContent = `${b.placedCount} / ${b.slots.length}`;
  objectiveBar.style.width = `${(b.placedCount / Math.max(1, b.slots.length)) * 100}%`;
  const pal = PALETTES[b.def.palette];
  objectiveIconBrick.style.setProperty('--brick', pal.wall.color);
  townProgress.textContent = `${buildings.completedCount} / ${BUILDINGS.length}`;
}

function updateObjectiveArrow() {
  const b = activeBuilding();
  if (!b) {
    objectiveArrow.style.opacity = '0';
    return;
  }
  objectiveArrow.style.opacity = '';
  const dx = b.x - player.pos.x;
  const dz = b.z - player.pos.z;
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const angle = Math.atan2(dx * rightX + dz * rightZ, dx * fwdX + dz * fwdZ);
  objectiveArrow.style.transform = `rotate(${angle}rad)`;
}

/* =========================================================
   Interaction targeting
   ========================================================= */
function findTarget() {
  if (mode !== 'playing' || uiOpen) return null;
  camera.updateMatrixWorld();
  raycaster.setFromCamera(centerNDC, camera);
  const objects = buildings.collectRayTargets();
  const hits = raycaster.intersectObjects(objects, false);
  for (const hit of hits) {
    const ud = hit.object.userData;
    if (ud.type === 'pile') {
      const p = ud.pile;
      if (!p || !p.group.visible || p.stock <= 0) continue;
      return { type: 'pile', pile: p, instanceId: hit.instanceId, worldPos: hit.point.clone() };
    }
    if (ud.type === 'ghost') {
      const r = buildings.resolveGhostHit(hit.object, hit.instanceId);
      if (r) {
        const worldPos = r.slot.pos.clone().applyMatrix4(r.building.group.matrixWorld);
        return { type: 'slot', building: r.building, slot: r.slot, index: r.index, worldPos };
      }
    }
  }

  // Gentle aim assist: makes the small blueprint bricks pleasant to target.
  camera.getWorldPosition(camWorld);
  camera.getWorldDirection(forward);
  const candidates = [];
  for (const b of buildings.buildings) {
    if (b.completed) continue;
    if (Math.hypot(b.x - player.pos.x, b.z - player.pos.z) > 18) continue;
    for (const slot of b.slots) {
      if (slot.placed) continue;
      const wp = slot.pos.clone().applyMatrix4(b.group.matrixWorld);
      const to = wp.clone().sub(camWorld);
      const dist = to.length();
      if (dist < 0.15 || dist > 12) continue;
      to.divideScalar(dist);
      const dot = to.dot(forward);
      if (dot < 0.985) continue;
      candidates.push({ score: dot - dist * 0.0012, type: 'slot', building: b, slot, index: slot.index, worldPos: wp });
    }
  }
  if (!candidates.length) {
    for (const p of buildings.piles) {
      if (!p.group.visible || p.stock <= 0) continue;
      const wp = new THREE.Vector3();
      p.group.getWorldPosition(wp);
      wp.y = 0.35;
      const to = wp.clone().sub(camWorld);
      const dist = to.length();
      if (dist < 0.2 || dist > 8.5) continue;
      to.divideScalar(dist);
      const dot = to.dot(forward);
      if (dot < 0.94) continue;
      candidates.push({ score: dot - dist * 0.005, type: 'pile', pile: p, worldPos: wp });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function setCrosshairTarget(on, action = false) {
  crosshair.classList.toggle('target', on);
  crosshair.classList.toggle('action', on && action);
}

function updateHover() {
  hover = findTarget();
  if (!hover) {
    outline.visible = false;
    pileRing.visible = false;
    interaction.classList.add('hidden');
    setCrosshairTarget(false);
    lastHoverKey = '';
    return;
  }

  if (hover.type === 'slot') {
    const { building, slot } = hover;
    const canPlace = inventory.some((it) => it.key === slot.key);
    const info = keyInfo(slot.key);
    const worldMat = tmpMat.multiplyMatrices(building.group.matrixWorld, slot.localMatrix);
    worldMat.decompose(outline.position, outline.quaternion, outline.scale);
    outline.scale.multiplyScalar(1.09);
    outline.visible = true;
    pileRing.visible = false;
    outline.material.color.set(canPlace ? '#8ae8f4' : '#ffb27a');
    setCrosshairTarget(true, canPlace);

    const key = `slot:${building.def.id}:${slot.index}:${canPlace}`;
    if (key !== lastHoverKey) {
      interactionTitle.textContent = info.def.label;
      interactionAction.textContent = canPlace ? 'Place brick' : `Need ${slot.piece.name}`;
      interactionSwatch.style.background = slot.piece.color;
      interaction.classList.remove('hidden');
      interaction.classList.toggle('want', !canPlace);
      interactionKey.textContent = isTouch ? 'E' : 'E';
      lastHoverKey = key;
    }
  } else {
    const p = hover.pile;
    outline.visible = false;
    const wp = new THREE.Vector3();
    p.group.getWorldPosition(wp);
    pileRing.position.set(wp.x, 0.12, wp.z);
    pileRing.visible = true;
    setCrosshairTarget(true, true);

    const key = `pile:${p.building.def.id}:${p.key}:${p.stock}`;
    if (key !== lastHoverKey) {
      const info = keyInfo(p.key);
      interactionTitle.textContent = info.def.label;
      interactionAction.textContent = `Pick up · ${p.piece.name}`;
      interactionSwatch.style.background = p.piece.color;
      interaction.classList.remove('hidden');
      interaction.classList.remove('want');
      interactionKey.textContent = 'E';
      lastHoverKey = key;
    }
  }
}

/* =========================================================
   Core actions
   ========================================================= */
function pickFromPile(pile, instanceId) {
  if (!pile) return;
  if (invCount() >= capacity()) {
    audio.error();
    showHint('Hands full — place a few bricks first.');
    return;
  }
  const res = buildings.pickPile(pile, instanceId);
  if (!res) return;
  addToInventory(res.key, res.piece, { pile: res.pile, index: res.index });
  audio.pickup(invCount());
  burst(hover?.worldPos || new THREE.Vector3(), res.piece.color, 5, 0.55);
  refreshObjective();
}

function placeAt(target) {
  if (!target || target.type !== 'slot') return;
  const { building, slot, index } = target;
  const item = takeFromInventory(slot.key);
  if (!item) {
    audio.error();
    showHint(`That slot needs a ${slot.piece.name} ${BRICK_TYPES[slot.piece.type]?.label || 'brick'}.`);
    return;
  }
  const result = buildings.placeSlot(building, index);
  if (!result) {
    inventory.push(item);
    refreshInventory();
    return;
  }
  audio.place(index);
  burst(target.worldPos, slot.piece.color, 7, 0.75);
  refreshObjective();
  refreshInventory();
  saveSoon();
}

function doInteract() {
  if (mode !== 'playing' || uiOpen) return;
  lastInteract = time;
  if (!hover) {
    showHint('Look at a pile or a glowing blueprint brick.');
    return;
  }
  if (hover.type === 'pile') pickFromPile(hover.pile, hover.instanceId);
  else placeAt(hover);
}

function triggerMagnet() {
  if (mode !== 'playing' || uiOpen) return;
  if (!unlocked.has('magnet')) {
    const a = ABILITIES.find((x) => x.id === 'magnet');
    showHint(`Finish ${a.need} buildings to unlock the Brick Magnet.`);
    return;
  }
  if (time < magnetCooldown) return;
  magnetCooldown = time + 1.4;
  const free = capacity() - invCount();
  if (free <= 0) {
    audio.error();
    showHint('Hands full — place a few bricks first.');
    return;
  }
  const found = buildings.magnetPull(player.pos, 8.5, free);
  if (!found.length) {
    audio.error();
    showHint('No loose bricks nearby.');
    return;
  }
  for (const res of found) {
    if (!addToInventory(res.key, res.piece, { pile: res.pile, index: res.index })) break;
    res.pile.group.getWorldPosition(tmpVec);
    burst(tmpVec, res.piece.color, 3, 0.5);
  }
  audio.magnet();
  showHint(`${found.length} brick${found.length === 1 ? '' : 's'} pulled in.`, 1800);
  refreshObjective();
}

function dropAll() {
  if (mode !== 'playing' || uiOpen) return;
  if (!inventory.length) {
    showHint('Your arms are already empty.');
    return;
  }
  let n = 0;
  for (const item of inventory) {
    if (item.source?.pile && buildings.returnBrick(item.source.pile, item.source.index)) n++;
  }
  inventory.length = 0;
  refreshInventory();
  audio.drop();
  showHint(n ? `Dropped ${n} brick${n === 1 ? '' : 's'} back on the pile.` : 'Bricks cleared.', 1900);
}

/* =========================================================
   Completion flow
   ========================================================= */
function handleComplete(b, animate) {
  if (suppressCallbacks) return;
  audio.complete();
  showBanner(b);
  refreshAbilities(true);
  refreshObjective();
  refreshInventory();
  updateHudTown();
  saveSoon();
  showHint(`${b.def.name} is finished — the town feels a little more alive.`, 3200);

  const pal = PALETTES[b.def.palette];
  burst(new THREE.Vector3(b.x, b.wallTop + 1, b.z), pal.accent.color, 20, 1.7);
  burst(new THREE.Vector3(b.x, b.wallTop, b.z), pal.trim.color, 14, 1.4);

  if (buildings.allComplete) {
    clearTimeout(finalTimer);
    finalTimer = setTimeout(showFinale, 1900);
  }
}

buildings.onComplete = (b, animate) => {
  if (!suppressCallbacks) handleComplete(b, animate);
};

function updateHudTown() {
  townProgress.textContent = `${buildings.completedCount} / ${BUILDINGS.length}`;
}

function buildSkillTree() {
  const done = buildings.completedCount;
  $('skill-count').textContent = unlocked.size;
  const next = ABILITIES.find((a) => !unlocked.has(a.id));
  $('skill-tree').innerHTML = ABILITIES.map((a) => {
    const isUnlocked = done >= a.need;
    const isCurrent = next && next.id === a.id;
    return `
      <div class="skill-node ${isUnlocked ? 'unlocked' : ''} ${isCurrent ? 'current' : ''}">
        <div class="skill-badge">${ICONS[a.icon] || ''}</div>
        <div class="skill-copy">
          <div class="skill-title-row">
            <h4>${a.name}</h4>
            <span class="skill-status">${isUnlocked ? 'Unlocked' : 'Locked'}</span>
          </div>
          <p>${a.desc}</p>
          ${isUnlocked ? '' : `<div class="skill-req">Finish ${a.need} building${a.need === 1 ? '' : 's'} to unlock</div>`}
        </div>
      </div>
    `;
  }).join('');
}

/* =========================================================
   Town plan
   ========================================================= */
let planBuildingId = null;
let planTab = 'buildings';

function selectedPlanBuilding() {
  return buildings.getBuilding(planBuildingId) || buildings.buildings.find((b) => !b.completed) || buildings.buildings[0];
}

function populateBuildingList() {
  const list = $('building-list');
  list.innerHTML = buildings.buildings.map((b) => {
    const pal = PALETTES[b.def.palette];
    const pct = (b.placedCount / Math.max(1, b.slots.length)) * 100;
    const status = b.completed ? 'Done' : b.placedCount > 0 ? `${Math.round(pct)}%` : 'Waiting';
    return `
      <button class="building-item ${b.completed ? 'done' : ''} ${b.def.id === planBuildingId ? 'active' : ''}" data-building="${b.def.id}">
        <span class="building-dot" style="background:linear-gradient(150deg, ${pal.wall.color}, ${pal.wallDeep.color})"></span>
        <span class="building-info">
          <span class="building-name"><span>${b.def.name}</span><em>${status}</em></span>
          <span class="building-progress"><span style="width:${pct}%"></span></span>
        </span>
      </button>
    `;
  }).join('');
}

function populateBlueprint() {
  const b = selectedPlanBuilding();
  if (!b) return;
  const reqs = buildings.requirements(b);
  const missingOnly = $('bp-missing').checked;
  const shown = missingOnly ? reqs.filter((r) => r.placed < r.count) : reqs;
  const pct = Math.round((b.placedCount / Math.max(1, b.slots.length)) * 100);

  $('bp-name').textContent = b.def.name;
  $('bp-meta').textContent = `${reqs.length} brick types · ${b.slots.length} bricks`;
  const status = $('bp-status');
  status.textContent = b.completed ? 'Complete' : b.placedCount > 0 ? 'Under construction' : 'Blueprint';
  status.classList.toggle('done', b.completed);
  $('bp-percent').textContent = `${pct}%`;
  $('bp-bar').style.width = `${pct}%`;
  $('bp-count').textContent = `${b.placedCount} / ${b.slots.length} bricks placed`;
  $('bp-hint').textContent = b.completed
    ? 'This building is finished. Wander over and admire it.'
    : `Look for the floating golden marker above ${b.def.name}.`;

  $('bp-grid').innerHTML = shown.length ? shown.map((r) => {
    const complete = r.placed >= r.count;
    const info = keyInfo(r.key);
    const width = Math.round(20 + Math.min(3, info.def.aspect) * 12);
    const cls = info.type === 'window' ? 'window' : info.type === 'roof' ? 'roof' : '';
    return `
      <div class="bp-item ${complete ? 'complete' : ''}">
        <div class="bp-brick"><span class="bp-brick-shape ${cls}" style="--c:${r.color};width:${width}px"></span></div>
        <div class="bp-item-label">${r.name} · ${info.def.label}</div>
        <div class="bp-item-count">${r.placed} / ${r.count} placed</div>
      </div>
    `;
  }).join('') : `<div class="bp-empty">${b.completed ? 'Every brick is back where it belongs.' : 'Nothing missing here — beautiful work.'}</div>`;
}

function populatePlan() {
  $('bp-missing').checked = false;
  populateBuildingList();
  populateBlueprint();
  buildSkillTree();
}

function selectPlanTab(tab) {
  planTab = tab;
  document.querySelectorAll('.plan-tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tab));
  $('tab-buildings').classList.toggle('hidden', tab !== 'buildings');
  $('tab-abilities').classList.toggle('hidden', tab !== 'abilities');
}

/* =========================================================
   Modal flow
   ========================================================= */
function releasePointer() {
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function requestPointerLock() {
  if (isTouch) return;
  try {
    if (document.pointerLockElement !== canvas) {
      const req = canvas.requestPointerLock();
      if (req && typeof req.catch === 'function') req.catch(() => {});
    }
  } catch (e) { /* pointer lock can be refused */ }
}

function showHud(show) {
  hud.classList.toggle('hidden', !show);
}

function updateTouchVisibility() {
  const show = isTouch && mode === 'playing' && !uiOpen;
  touchControls.classList.toggle('hidden', !show);
}

function openHow(returnTo = 'title') {
  howReturn = returnTo;
  if (returnTo === 'pause') $('modal-pause').classList.add('hidden');
  $('modal-how').classList.remove('hidden');
}

function closeHow() {
  $('modal-how').classList.add('hidden');
  if (howReturn === 'pause') $('modal-pause').classList.remove('hidden');
}

function openPlan(returnTo = 'game') {
  if (mode === 'title' || mode === 'final') return;
  planReturn = returnTo;
  uiOpen = true;
  if (mode === 'playing') mode = 'paused';
  releasePointer();
  $('modal-pause').classList.add('hidden');
  $('modal-how').classList.add('hidden');
  planBuildingId = activeBuilding()?.def.id || buildings.buildings[0].def.id;
  populatePlan();
  selectPlanTab('buildings');
  $('modal-plan').classList.remove('hidden');
  updateTouchVisibility();
  updateHeldBrick();
}

function closePlan(resume = true) {
  $('modal-plan').classList.add('hidden');
  if (planReturn === 'pause' && resume) {
    $('modal-pause').classList.remove('hidden');
    uiOpen = true;
    return;
  }
  if (planReturn === 'pause') {
    $('modal-pause').classList.remove('hidden');
    return;
  }
  uiOpen = false;
  if (resume && mode === 'paused') resumeGame();
  else updateTouchVisibility();
}

function openPause() {
  if (mode !== 'playing') return;
  mode = 'paused';
  uiOpen = true;
  releasePointer();
  $('modal-plan').classList.add('hidden');
  $('modal-how').classList.add('hidden');
  updatePauseCopy();
  $('modal-pause').classList.remove('hidden');
  updateTouchVisibility();
  updateHeldBrick();
}

function resumeGame() {
  $('modal-pause').classList.add('hidden');
  $('modal-how').classList.add('hidden');
  $('modal-plan').classList.add('hidden');
  $('modal-final').classList.add('hidden');
  mode = 'playing';
  uiOpen = false;
  if (!startedAt) startedAt = Date.now();
  updateTouchVisibility();
  updateHeldBrick();
  requestPointerLock();
}

function updatePauseCopy() {
  const unlockedCount = ABILITIES.filter((a) => buildings.completedCount >= a.need).length;
  $('pause-stats').innerHTML = `
    <div><strong>${buildings.completedCount}/${BUILDINGS.length}</strong>Buildings</div>
    <div><strong>${buildings.totalPlaced}</strong>Bricks placed</div>
    <div><strong>${unlockedCount}</strong>Skills</div>
  `;
  const tips = [
    'Tip: brick piles are labelled by shape and colour. The town plan lists everything you still need.',
    'Tip: matching colours is optional, but matching shapes makes the walls sit neatly.',
    'Tip: once the Brick Magnet unlocks, press X to sweep up a whole pile at once.',
    'Tip: finished buildings unlock helpful skills. Check the Abilities tab in the town plan.',
    'Tip: hold E with Continuous Build unlocked to rebuild without tapping between bricks.',
    'Tip: the golden ribbon in the sky always points toward your next project.',
  ];
  $('pause-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
}

/* =========================================================
   Finale
   ========================================================= */
function showFinale() {
  if (finalShown) return;
  finalShown = true;
  mode = 'final';
  uiOpen = true;
  releasePointer();
  updateTouchVisibility();
  updateHeldBrick();
  audio.finish();

  const seconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  $('final-stats').innerHTML = `
    <div><strong>${BUILDINGS.length}</strong>Buildings</div>
    <div><strong>${buildings.totalBricks}</strong>Bricks</div>
    <div><strong>${ABILITIES.length}</strong>Skills</div>
    <div><strong>${mm}:${ss}</strong>Build time</div>
  `;
  const confetti = $('confetti');
  const colors = ['#ee6b54', '#ffcf5c', '#8ae8f4', '#79d69a', '#c7a6de', '#f7f2e3'];
  confetti.innerHTML = '';
  for (let i = 0; i < 80; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 30}vw`);
    bit.style.animationDuration = `${3 + Math.random() * 3.2}s`;
    bit.style.animationDelay = `${Math.random() * 1.6}s`;
    bit.style.width = `${6 + Math.random() * 8}px`;
    bit.style.height = `${10 + Math.random() * 12}px`;
    confetti.appendChild(bit);
  }
  $('modal-final').classList.remove('hidden');
  writeSave();
}

/* =========================================================
   Start / reset
   ========================================================= */
function hideTitle() {
  if (titleScreen.classList.contains('hidden')) return;
  titleScreen.style.transition = 'opacity .55s ease';
  titleScreen.style.opacity = '0';
  setTimeout(() => titleScreen.classList.add('hidden'), 560);
}

function startGame(loadExisting) {
  audio.ensure();
  setSoundUi();

  if (loadExisting) {
    const data = readSave();
    if (data) {
      suppressCallbacks = true;
      buildings.applySave(data.placed);
      suppressCallbacks = false;
      scene.updateMatrixWorld(true);
      if (data.startedAt) startedAt = data.startedAt;
    }
  } else {
    clearSave();
    startedAt = Date.now();
  }
  if (!startedAt) startedAt = Date.now();

  mode = 'playing';
  uiOpen = false;
  finalShown = false;
  inventory.length = 0;
  hover = null;
  player.pos.set(TOWN.spawn[0], 0, TOWN.spawn[1]);
  player.vel.set(0, 0, 0);
  player.vy = 0;
  player.onGround = true;
  player.jumps = 0;
  player.yaw = 0;
  player.pitch = -0.03;

  hideTitle();
  showHud(true);
  updateTouchVisibility();
  buildAbilityBar();
  refreshAbilities(false);
  refreshInventory();
  refreshObjective();
  updateHudTown();
  updateHeldBrick();
  buildings.update(0, time, player.pos);
  scene.updateMatrixWorld(true);
  saveSoon();
  requestPointerLock();
  showHint('Follow the golden marker — the first pile is just beyond the town gate.', 4200);
}

function resetTown() {
  if (!window.confirm('Start a brand new town? All current progress will be lost.')) return;
  clearSave();
  try { localStorage.removeItem(SOUND_KEY); } catch (e) { /* ignore */ }
  window.location.reload();
}

/* =========================================================
   Player controls
   ========================================================= */
function blockedAt(x, z) {
  if (Math.hypot(x, z) > 56.5) return true;
  if (env.collides(x, z, 0.42)) return true;
  if (buildings.collides(x, z, 0.42)) return true;
  return false;
}

function updatePlayer(dt) {
  let stickX = joystick.x;
  let stickY = joystick.y;
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  mx += stickX;
  mz += stickY;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }

  const sprinting = unlocked.has('sprint') && (keys.has('ShiftLeft') || keys.has('ShiftRight')) && len > 0.35;
  const speed = sprinting ? 7.0 : 4.3;
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const rightX = Math.cos(player.yaw);
  const rightZ = -Math.sin(player.yaw);
  const targetX = (fwdX * mz + rightX * mx) * speed;
  const targetZ = (fwdZ * mz + rightZ * mx) * speed;
  const smooth = Math.min(1, dt * 12);
  player.vel.x += (targetX - player.vel.x) * smooth;
  player.vel.z += (targetZ - player.vel.z) * smooth;

  const dx = player.vel.x * dt;
  const dz = player.vel.z * dt;
  if (!blockedAt(player.pos.x + dx, player.pos.z)) player.pos.x += dx;
  else player.vel.x = 0;
  if (!blockedAt(player.pos.x, player.pos.z + dz)) player.pos.z += dz;
  else player.vel.z = 0;

  // Jump / double jump
  if (jumpRequested) {
    jumpRequested = false;
    if (player.onGround) {
      player.vy = 6.4;
      player.onGround = false;
      player.jumps = 1;
      audio.jump();
    } else if (unlocked.has('doubleJump') && player.jumps < 2) {
      player.vy = 6.0;
      player.jumps = 2;
      audio.jump();
      burst(new THREE.Vector3(player.pos.x, player.pos.y + 0.2, player.pos.z), '#e8d8bf', 5, 0.4);
    }
  }
  player.vy -= 19 * dt;
  player.pos.y += player.vy * dt;
  if (player.pos.y <= 0) {
    if (!player.onGround && player.vy < -5) {
      burst(new THREE.Vector3(player.pos.x, 0.08, player.pos.z), '#d8c7ad', 5, 0.35);
    }
    player.pos.y = 0;
    player.vy = 0;
    player.onGround = true;
    player.jumps = 0;
  }

  player.speed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && player.speed > 0.45) {
    player.bobPhase += dt * player.speed * 2.15;
    player.stepDist += player.speed * dt;
    if (player.stepDist > 2.25) {
      player.stepDist = 0;
      audio.footstep(sprinting);
    }
  }
  const bobAmt = player.onGround ? Math.min(1, player.speed / 4.5) : 0;
  player.bob = Math.sin(player.bobPhase * 2) * 0.035 * bobAmt;
  const sway = Math.cos(player.bobPhase) * 0.011 * bobAmt;

  const targetFov = sprinting ? 68 : 62;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 7);
    camera.updateProjectionMatrix();
  }

  const eye = 1.68 + player.bob;
  camera.position.set(player.pos.x, player.pos.y + eye, player.pos.z);
  camera.rotation.x = player.pitch;
  camera.rotation.y = player.yaw;
  camera.rotation.z = sway;

  // held brick gently floats with the walk
  if (heldBrick.visible) {
    heldBrick.position.y = -0.34 + Math.sin(player.bobPhase * 2) * 0.008 * bobAmt;
    heldBrick.rotation.z = 0.12 + Math.sin(player.bobPhase) * 0.015 * bobAmt;
  }

  // continuous build
  if (interactHeld && unlocked.has('continuous') && time - lastInteract > 0.24) {
    doInteract();
  }
}

/* =========================================================
   Mouse / keyboard / touch
   ========================================================= */
let draggingLook = false;
let dragX = 0, dragY = 0;
let touchLookId = null;
let touchLookX = 0, touchLookY = 0;

function applyLook(dx, dy) {
  const s = document.pointerLockElement === canvas ? 0.0022 : 0.0038;
  player.yaw -= dx * s;
  player.pitch -= dy * s;
  player.pitch = Math.max(-1.18, Math.min(1.18, player.pitch));
}

document.addEventListener('mousemove', (e) => {
  if (mode !== 'playing' || uiOpen) return;
  if (document.pointerLockElement === canvas) {
    applyLook(e.movementX, e.movementY);
  } else if (draggingLook) {
    applyLook(e.clientX - dragX, e.clientY - dragY);
    dragX = e.clientX;
    dragY = e.clientY;
  }
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (mode === 'playing' && !isTouch) {
    if (document.pointerLockElement !== canvas) requestPointerLock();
    draggingLook = true;
    dragX = e.clientX;
    dragY = e.clientY;
  }
});
window.addEventListener('mouseup', () => { draggingLook = false; });

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || mode !== 'playing' || uiOpen) return;
  touchLookId = e.pointerId;
  touchLookX = e.clientX;
  touchLookY = e.clientY;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch' || e.pointerId !== touchLookId || mode !== 'playing' || uiOpen) return;
  applyLook(e.clientX - touchLookX, e.clientY - touchLookY);
  touchLookX = e.clientX;
  touchLookY = e.clientY;
});
function endTouchLook(e) {
  if (e.pointerId === touchLookId) touchLookId = null;
}
canvas.addEventListener('pointerup', endTouchLook);
canvas.addEventListener('pointercancel', endTouchLook);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'KeyM') { toggleSound(); return; }
  if (e.code === 'Escape') {
    if (!$('modal-how').classList.contains('hidden')) { closeHow(); return; }
    if (!$('modal-plan').classList.contains('hidden')) { closePlan(true); return; }
    if (!$('modal-pause').classList.contains('hidden')) { resumeGame(); return; }
    if (mode === 'playing') { openPause(); return; }
    return;
  }
  if (mode === 'title' || mode === 'final') return;

  if (e.code === 'KeyB') {
    if (!$('modal-plan').classList.contains('hidden')) closePlan(true);
    else if (!$('modal-pause').classList.contains('hidden')) openPlan('pause');
    else openPlan('game');
    return;
  }

  if (uiOpen) return;

  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyR', 'KeyX'].includes(e.code)) {
    e.preventDefault();
  }
  keys.add(e.code);
  if (e.code === 'Space' && !e.repeat) jumpRequested = true;
  if (e.code === 'KeyE' && !e.repeat) { interactHeld = true; doInteract(); }
  if (e.code === 'KeyR' && !e.repeat) dropAll();
  if (e.code === 'KeyX' && !e.repeat) triggerMagnet();
});

document.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'KeyE') interactHeld = false;
});

window.addEventListener('blur', () => {
  keys.clear();
  interactHeld = false;
  joystick.active = false;
  joystick.x = 0;
  joystick.y = 0;
  if (mode === 'playing') openPause();
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && mode === 'playing' && !uiOpen && !isTouch) {
    openPause();
  }
});

/* ---------------- touch joystick ---------------- */
const joystickEl = $('joystick');
const joystickKnob = $('joystick-knob');
let joyPointer = null;

function joystickMove(e) {
  if (e.pointerId !== joyPointer) return;
  const rect = joystickEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width * 0.33;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  joystick.x = dx / max;
  joystick.y = -dy / max;
  const dead = 0.13;
  if (Math.abs(joystick.x) < dead) joystick.x = 0;
  if (Math.abs(joystick.y) < dead) joystick.y = 0;
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

joystickEl.addEventListener('pointerdown', (e) => {
  if (mode !== 'playing' || uiOpen) return;
  e.preventDefault();
  joyPointer = e.pointerId;
  joystick.active = true;
  joystickEl.setPointerCapture(e.pointerId);
  joystickMove(e);
});
joystickEl.addEventListener('pointermove', joystickMove);
function endJoystick(e) {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null;
  joystick.active = false;
  joystick.x = 0;
  joystick.y = 0;
  joystickKnob.style.transform = 'translate(-50%, -50%)';
}
joystickEl.addEventListener('pointerup', endJoystick);
joystickEl.addEventListener('pointercancel', endJoystick);

function wireTouchButton(id, down, up) {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', (e) => {
    if (mode !== 'playing' || uiOpen) return;
    e.preventDefault();
    e.stopPropagation();
    el.setPointerCapture?.(e.pointerId);
    down?.();
  });
  el.addEventListener('pointerup', (e) => { e.preventDefault(); up?.(); });
  el.addEventListener('pointercancel', () => up?.());
  el.addEventListener('pointerleave', () => up?.());
}
wireTouchButton('touch-interact', () => { interactHeld = true; doInteract(); }, () => { interactHeld = false; });
wireTouchButton('touch-jump', () => { jumpRequested = true; });
wireTouchButton('touch-magnet', () => triggerMagnet());
wireTouchButton('touch-drop', () => dropAll());
$('touch-plan').addEventListener('click', () => {
  if (mode === 'playing') openPlan('game');
});

/* =========================================================
   UI events
   ========================================================= */
$('btn-play').addEventListener('click', () => {
  if (savedGame && !window.confirm('Start a new town? Your saved progress will be replaced.')) return;
  startGame(false);
});
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-how').addEventListener('click', () => openHow('title'));
$('btn-title-sound').addEventListener('click', toggleSound);
$('btn-sound').addEventListener('click', toggleSound);
$('btn-pause-sound').addEventListener('click', toggleSound);
$('btn-resume').addEventListener('click', resumeGame);
$('btn-pause-plan').addEventListener('click', () => openPlan('pause'));
$('btn-pause-how').addEventListener('click', () => openHow('pause'));
$('btn-reset').addEventListener('click', resetTown);
$('btn-final-reset').addEventListener('click', resetTown);
$('btn-freeplay').addEventListener('click', () => {
  $('modal-final').classList.add('hidden');
  finalShown = false;
  mode = 'playing';
  uiOpen = false;
  updateTouchVisibility();
  updateHeldBrick();
  requestPointerLock();
  showHint('Maple Hollow is yours to wander. Nothing left to tidy!', 3200);
});
$('btn-plan').addEventListener('click', () => {
  if (mode === 'playing') openPlan('game');
  else if (!$('modal-pause').classList.contains('hidden')) openPlan('pause');
});
$('btn-pause').addEventListener('click', () => {
  if (mode === 'playing') openPause();
});

document.querySelectorAll('[data-close]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.close;
    if (id === 'modal-how') closeHow();
    else if (id === 'modal-plan') closePlan(true);
    else $(id)?.classList.add('hidden');
  });
});

document.querySelectorAll('.plan-tab').forEach((tab) => {
  tab.addEventListener('click', () => selectPlanTab(tab.dataset.tab));
});

$('building-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-building]');
  if (!btn) return;
  planBuildingId = btn.dataset.building;
  populateBuildingList();
  populateBlueprint();
});

$('bp-missing').addEventListener('change', populateBlueprint);

$('bp-locate').addEventListener('click', () => {
  const b = selectedPlanBuilding();
  if (!b) return;
  buildings.setFocus(b.def.id);
  planReturn = 'game';
  closePlan(true);
  showHint(`Follow the golden marker to ${b.def.name}.`, 3000);
});

abilityBar.addEventListener('click', (e) => {
  const el = e.target.closest('.ability');
  if (!el) return;
  const a = ABILITIES.find((x) => x.id === el.dataset.ability);
  if (!a) return;
  if (!unlocked.has(a.id)) {
    showHint(`Finish ${a.need} building${a.need === 1 ? '' : 's'} to unlock ${a.name}.`);
    return;
  }
  if (a.id === 'magnet') triggerMagnet();
  else showHint(a.desc, 2400);
});

/* =========================================================
   Title camera and frame loop
   ========================================================= */
function updateTitleCamera(t) {
  const a = 0.7 + t * 0.032;
  const r = 49;
  camera.position.set(Math.cos(a) * r, 20.5 + Math.sin(t * 0.18) * 1.1, Math.sin(a) * r);
  camera.lookAt(0, 6.2, 0);
  camera.rotation.z = 0;
}

let busy = false;
let lastFrame = performance.now();
let resizeQueued = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  time += dt;

  env.update(dt, time);
  buildings.update(dt, time, mode === 'title' ? null : player.pos);
  updateParticles(dt);

  if (mode === 'title') {
    updateTitleCamera(time);
    heldBrick.visible = false;
    setCrosshairTarget(false);
    interaction.classList.add('hidden');
  } else if (mode === 'playing') {
    updatePlayer(dt);
    updateHover();
  } else {
    if (hover) {
      outline.visible = false;
      pileRing.visible = false;
      interaction.classList.add('hidden');
      setCrosshairTarget(false);
      hover = null;
    }
    updateHeldBrick();
  }

  updateObjectiveArrow();

  hudRefreshAcc += dt;
  if (hudRefreshAcc > 0.28 && mode !== 'title') {
    hudRefreshAcc = 0;
    refreshObjective();
    // Keep the held brick in sync with capacity changes.
    if (invCap.textContent !== `${invCount()} / ${capacity()}`) refreshInventory();
  }

  if (outline.visible) {
    outline.material.opacity = 0.72 + Math.sin(time * 4) * 0.18;
  }
  if (pileRing.visible) {
    pileRing.rotation.z = time * 0.45;
    pileRing.material.opacity = 0.65 + Math.sin(time * 4) * 0.2;
  }

  renderer.render(scene, camera);
}

/* =========================================================
   Resize, boot
   ========================================================= */
function onResize() {
  clearTimeout(resizeQueued);
  resizeQueued = setTimeout(() => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    const portrait = isTouch && window.innerHeight > window.innerWidth;
    $('orientation-hint').classList.toggle('hidden', !portrait || mode !== 'playing');
  }, 120);
}
window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && mode === 'playing') openPause();
});

if (isTouch && window.innerHeight > window.innerWidth) {
  $('orientation-hint').classList.remove('hidden');
  setTimeout(() => $('orientation-hint').classList.add('hidden'), 6000);
}

renderer.render(scene, camera);
requestAnimationFrame((t) => {
  lastFrame = t;
  requestAnimationFrame(frame);
});
setTimeout(() => {
  loading.classList.add('gone');
  setTimeout(() => loading.classList.add('hidden'), 700);
}, 450);

// Tiny debug handle, useful for smoke tests and curious builders.
window.__brickGame = {
  get mode() { return mode; },
  get inventory() { return inventory; },
  get hover() { return hover; },
  get player() { return player; },
  get active() { return activeBuilding(); },
  buildings, scene, camera, renderer, env, controls: { startGame, resumeGame, openPlan, closePlan, triggerMagnet, dropAll },
  teleport(x, z, yaw = player.yaw) {
    player.pos.set(x, 0, z);
    player.yaw = yaw;
    player.vy = 0;
    player.onGround = true;
    camera.position.set(x, 1.68, z);
  },
};
