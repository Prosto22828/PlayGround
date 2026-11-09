import * as THREE from '../vendor/three.module.js';
import { World, BLOCK, BLOCKS, SELL_ORDER, SURFACE, WORLD_X, WORLD_Z, WORLD_Y } from './world.js';
import { Environment } from './environment.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';

const SAVE_KEY = 'agadh3d.save.v1';
const CENTER = WORLD_X / 2;
const SPAWN_X = 32.5;
const SPAWN_Z = 44.5;

const GOALS = [
  { d: 10, reward: 40, label: 'FIRST TEN' },
  { d: 25, reward: 120, label: 'QUARTER WAY' },
  { d: 50, reward: 320, label: 'HALFWAY DOWN' },
  { d: 75, reward: 800, label: 'THE DEEP END' },
];

const UPGRADES = [
  {
    id: 'speed', name: 'Drill Motor', icon: '⚡',
    desc: 'More torque in the bit. Every block breaks faster.',
    levels: [{ cost: 70 }, { cost: 180 }, { cost: 450 }, { cost: 1000 }],
    format: (l) => [1, 1.6, 2.3, 3.3, 4.8][l].toFixed(1) + '× speed',
  },
  {
    id: 'power', name: 'Drill Bit', icon: '⛏',
    desc: 'Hardened teeth for deepstone, iron and gems.',
    levels: [{ cost: 150 }, { cost: 450 }, { cost: 1000 }],
    format: (l) => 'Power ' + ['I', 'II', 'III', 'IV'][l],
  },
  {
    id: 'pack', name: 'Backpack', icon: '🎒',
    desc: 'Carry more ore before the long winch home.',
    levels: [{ cost: 60 }, { cost: 160 }, { cost: 400 }, { cost: 900 }],
    format: (l) => [30, 50, 75, 110, 160][l] + ' kg',
  },
  {
    id: 'boots', name: 'Dig Boots', icon: '🥾',
    desc: 'Grippy soles and springy heels. Move faster.',
    levels: [{ cost: 60 }, { cost: 150 }, { cost: 350 }],
    format: (l) => [1, 1.14, 1.28, 1.45][l].toFixed(2) + '× speed',
  },
  {
    id: 'lamp', name: 'Headlamp', icon: '🔦',
    desc: 'Throw a brighter cone into the dark.',
    levels: [{ cost: 40 }, { cost: 120 }, { cost: 300 }],
    format: (l) => [12, 18, 26, 36][l] + ' m range',
  },
];

function defaultState(seed) {
  return {
    version: 1,
    seed: seed !== undefined ? seed : (Math.random() * 2 ** 31) | 0,
    money: 0,
    upgrades: { speed: 0, power: 0, pack: 0, boots: 0, lamp: 0 },
    inventory: {},
    maxDepth: 0,
    milestones: [],
    mined: 0,
    earned: 0,
    time: 0,
    won: false,
    checkpoint: null,
    player: null,
    world: null,
  };
}

function formatTime(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + String(r).padStart(2, '0');
}

class Game {
  constructor() {
    this.canvas = document.getElementById('view');
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.06, 900);
    this.clock = new THREE.Clock();
    this.mode = 'boot';
    this.menuT = 0;
    this.hudTimer = 0;
    this.saveTimer = 0;
    this.needSave = false;
    this.pointerLocked = false;
    this.jumpQueued = false;
    this.winching = false;
    this.isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
    this.interactable = null;
    this.interactTimer = 0;
    this.audio = new GameAudio();
    this.particles = null;
    this.player = null;
    this.world = null;
    this.env = null;
    this.data = defaultState();
    this.saveExists = false;
    this.lookPointer = null;
    this.joyPointer = null;
    this.lastAudioDepth = -1;
    this.lastPauseAt = 0;

    this.ui = new UI();
    this.ui.bind({
      start: (isNew) => this.startGame(isNew),
      resume: () => this.resumeGame(),
      reset: () => this.resetWorld(true),
      closeShop: () => this.closeShop(),
      sell: () => this.sellAll(),
      buy: (id) => this.buyUpgrade(id),
      mute: () => this.toggleMute(),
      keep: () => this.keepDigging(),
      again: () => this.resetWorld(true),
      getGame: () => this,
    });
    this.ui.setTouch(this.isTouch);

    this._bindEvents();
    this.boot();
  }

  async boot() {
    this.ui.setLoading(0.06);
    try { await document.fonts.ready; } catch (e) { /* ignore */ }
    await new Promise((r) => setTimeout(r, 30));

    const saved = this.loadSave();
    this.saveExists = !!saved;
    if (saved) {
      this.data = saved;
      if (!this.data.upgrades) this.data.upgrades = { speed: 0, power: 0, pack: 0, boots: 0, lamp: 0 };
      if (!this.data.inventory) this.data.inventory = {};
      if (!this.data.milestones) this.data.milestones = [];
      if (typeof this.data.earned !== 'number') this.data.earned = 0;
      if (typeof this.data.mined !== 'number') this.data.mined = 0;
      if (typeof this.data.time !== 'number') this.data.time = 0;
      if (typeof this.data.maxDepth !== 'number') this.data.maxDepth = 0;
    }

    this.world = new World(this.scene, this.data.seed);
    this.ui.setLoading(0.22);
    await new Promise((r) => setTimeout(r, 20));
    this.world.generate();
    this.ui.setLoading(0.58);
    await new Promise((r) => setTimeout(r, 20));
    if (saved && saved.world) {
      const ok = this.world.decode(saved.world);
      if (!ok) this.world.generate();
    }
    this.ui.setLoading(0.74);
    await new Promise((r) => setTimeout(r, 20));

    this.env = new Environment(this.scene, this.world);
    this.player = new Player(this.scene, this.camera, this.world);
    this.particles = new Particles(this.scene);
    this.ui.setLoading(0.9);
    await new Promise((r) => setTimeout(r, 20));

    const spawn = this.surfaceSpawn();
    this.player.setSpawn(spawn.x, spawn.y, spawn.z, 0);
    if (saved && saved.player && this.isSafe(saved.player.x, saved.player.y, saved.player.z)) {
      this.player.teleport(saved.player.x, saved.player.y, saved.player.z);
      this.player.yaw = saved.player.yaw || 0;
    }

    this.ui.setLoading(1);
    await new Promise((r) => setTimeout(r, 120));
    this.ui.hideLoading();
    this.ui.showStart(this.saveExists);
    this.mode = 'menu';
    this.menuT = Math.random() * Math.PI * 2;
    this.clock.start();
    this.loop();
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      this.pointerLocked = locked;
      if (!locked && this.mode === 'playing' && !this.isTouch) {
        this.pauseGame();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.mode === 'playing' && this.pointerLocked) {
        this.player.look(e.movementX || 0, e.movementY || 0);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch || this.mode !== 'playing') return;
      if (!this.pointerLocked) {
        this.requestLock();
        return;
      }
      if (e.button === 0) this.player.digHeld = true;
      if (e.button === 2) this.player.placeQueued = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (this.isTouch) return;
      if (e.button === 0 && this.player) this.player.digHeld = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      if (code === 'Escape') {
        if (this.mode === 'shop') { e.preventDefault(); this.closeShop(); return; }
        if (this.mode === 'paused') { e.preventDefault(); if (performance.now() - this.lastPauseAt > 400) this.resumeGame(); return; }
        if (this.mode === 'playing' && !this.pointerLocked) { e.preventDefault(); this.pauseGame(); return; }
        return;
      }
      if (this.mode !== 'playing') return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].includes(code)) {
        e.preventDefault();
        this.player.keys.add(code);
      }
      if (code === 'KeyF') { e.preventDefault(); this.winch(); }
      if (code === 'KeyE') { e.preventDefault(); this.interact(); }
      if (code === 'KeyM') { this.toggleMute(); }
      if (code === 'KeyH') { this.pauseGame(); }
    });
    window.addEventListener('keyup', (e) => {
      if (!this.player) return;
      this.player.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      if (this.player) {
        this.player.keys.clear();
        this.player.digHeld = false;
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.pauseGame();
      if (document.hidden) this.saveGame();
    });
    window.addEventListener('pagehide', () => this.saveGame());

    this._bindTouch();
  }

  _bindTouch() {
    const joy = this.ui.el.joystick;
    const knob = this.ui.el.joystickKnob;
    const updateJoy = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const max = 42;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      if (this.player) {
        this.player.touchMove.x = dx / max;
        this.player.touchMove.y = dy / max;
      }
    };
    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.joyPointer = e.pointerId;
      try { joy.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      updateJoy(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joyPointer) updateJoy(e);
    });
    const endJoy = (e) => {
      if (e.pointerId !== this.joyPointer) return;
      this.joyPointer = null;
      knob.style.transform = 'translate(0px, 0px)';
      if (this.player) this.player.touchMove.x = this.player.touchMove.y = 0;
    };
    joy.addEventListener('pointerup', endJoy);
    joy.addEventListener('pointercancel', endJoy);

    const dig = this.ui.el.btnDig;
    dig.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.player) this.player.digHeld = true;
    });
    const stopDig = (e) => {
      e.preventDefault();
      if (this.player) this.player.digHeld = false;
    };
    dig.addEventListener('pointerup', stopDig);
    dig.addEventListener('pointercancel', stopDig);
    dig.addEventListener('pointerleave', stopDig);

    this.ui.el.btnJump.addEventListener('pointerdown', (e) => { e.preventDefault(); this.jumpQueued = true; });
    this.ui.el.btnRecall.addEventListener('pointerdown', (e) => { e.preventDefault(); this.winch(); });
    this.ui.el.btnInteract.addEventListener('pointerdown', (e) => { e.preventDefault(); this.interact(); });

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || this.mode !== 'playing') return;
      this.lookPointer = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch' || this.lookPointer !== e.pointerId) return;
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.player.look(dx * 1.55, dy * 1.55);
    });
    const endLook = (e) => {
      if (this.lookPointer === e.pointerId) this.lookPointer = null;
    };
    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', endLook);
  }

  // ---------- save / state ----------
  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || s.version !== 1 || typeof s.seed !== 'number') return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  saveGame() {
    if (!this.world || !this.player || this.mode === 'boot' || this.mode === 'menu') return;
    try {
      this.data.player = { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw };
      this.data.world = this.world.encode();
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.saveExists = true;
      this.needSave = false;
    } catch (e) {
      /* storage full / unavailable */
    }
  }

  surfaceSpawn() {
    return { x: SPAWN_X, y: this.world.topAt(SPAWN_X, SPAWN_Z), z: SPAWN_Z };
  }

  isSafe(x, y, z) {
    if (!this.player) return false;
    if (x < 2 || x > WORLD_X - 2 || z < 2 || z > WORLD_Z - 2) return false;
    if (y < 1.2 || y > WORLD_Y - 3) return false;
    return !this.player.collides(x, y, z);
  }

  resetWorld(startNow) {
    const seed = (Math.random() * 2 ** 31) | 0;
    this.data = defaultState(seed);
    this.world.seed = seed;
    this.world.generate();
    const spawn = this.surfaceSpawn();
    this.player.setSpawn(spawn.x, spawn.y, spawn.z, 0);
    this.player.digHeld = false;
    this.ui.last = {};
    this.saveGame();
    this.ui.toast('A fresh patch of dirt. Go make a hole.', 'good', 'NEW HOLE');
    if (startNow) {
      this.mode = 'playing';
      this.player.enabled = true;
      this.ui.showGame();
      this.ui.updateHUD(this);
      this.requestLock();
    } else {
      this.mode = 'menu';
      this.ui.showStart(false);
    }
  }

  startGame(isNew) {
    this.audio.init();
    if (isNew) {
      this.resetWorld(false);
      // fall through into play
    }
    if (!this.data.player) {
      const spawn = this.surfaceSpawn();
      this.player.setSpawn(spawn.x, spawn.y, spawn.z, 0);
    } else if (this.isSafe(this.data.player.x, this.data.player.y, this.data.player.z)) {
      this.player.teleport(this.data.player.x, this.data.player.y, this.data.player.z);
      this.player.yaw = this.data.player.yaw || 0;
    } else {
      const spawn = this.surfaceSpawn();
      this.player.setSpawn(spawn.x, spawn.y, spawn.z, 0);
    }
    this.mode = 'playing';
    this.player.enabled = true;
    this.player.digHeld = false;
    this.ui.showGame();
    this.ui.hidePause();
    this.ui.hideShop();
    this.ui.updateHUD(this);
    this.requestLock();
    this.clock.getDelta();
    this.needSave = true;
  }

  resumeGame() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.player.enabled = true;
    this.ui.hidePause();
    this.requestLock();
    this.clock.getDelta();
  }

  pauseGame() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.lastPauseAt = performance.now();
    this.player.enabled = false;
    this.player.mining.active = false;
    this.player.digHeld = false;
    this.player.keys.clear();
    this.ui.showPause({
      depth: this.player.getDepth(),
      best: this.data.maxDepth,
      mined: this.data.mined,
      time: formatTime(this.data.time),
    });
    if (document.pointerLockElement) document.exitPointerLock();
    this.saveGame();
  }

  keepDigging() {
    this.mode = 'playing';
    this.player.enabled = true;
    this.ui.hideAllScreens();
    this.ui.showGame();
    this.requestLock();
    this.clock.getDelta();
  }

  requestLock() {
    if (this.isTouch) return;
    if (document.pointerLockElement === this.canvas) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  // ---------- gameplay ----------
  get state() { return this.data; }
  get speedMult() { return [1, 1.6, 2.3, 3.3, 4.8][this.data.upgrades.speed || 0]; }
  get power() { return 1 + (this.data.upgrades.power || 0); }
  get capacity() { return [30, 50, 75, 110, 160][this.data.upgrades.pack || 0]; }
  get bootsMult() { return [1, 1.14, 1.28, 1.45][this.data.upgrades.boots || 0]; }
  get lampDistance() { return [12, 18, 26, 36][this.data.upgrades.lamp || 0]; }
  get upgradeDefs() { return UPGRADES; }

  getCapacity() { return this.capacity; }

  getWeight() {
    let w = 0;
    for (const id in this.data.inventory) {
      const def = BLOCKS[id];
      if (def) w += def.weight * this.data.inventory[id];
    }
    return w;
  }

  canCollect(blockId) {
    if (blockId === BLOCK.CORE) return true;
    const def = BLOCKS[blockId];
    if (!def) return false;
    return this.getWeight() + def.weight <= this.capacity + 0.0001;
  }

  getInventoryValue() {
    let v = 0;
    for (const id in this.data.inventory) {
      const def = BLOCKS[id];
      if (def) v += def.value * this.data.inventory[id];
    }
    return Math.round(v);
  }

  breakBlock(x, y, z, blockId) {
    if (!this.canCollect(blockId)) {
      this.warn('Backpack full! Winch up and sell your haul.', 'bad');
      return false;
    }
    const def = BLOCKS[blockId];
    this.world.set(x, y, z, BLOCK.AIR);
    this.world.flushDirty();
    this.data.inventory[blockId] = (this.data.inventory[blockId] || 0) + 1;
    this.data.mined++;
    this.needSave = true;
    this.particles.burst(x + 0.5, y + 0.5, z + 0.5, blockId);
    this.audio.breakBlock();
    this.audio.pickup();
    if (def && def.kind === 'ore') {
      this.ui.toast(def.name + ' collected', 'good', '+' + def.name.toUpperCase());
    }
    if (blockId === BLOCK.CORE) {
      this.triggerWin();
    }
    this.ui.updateHUD(this);
    return true;
  }

  tryPlace(hit) {
    if (!hit) return;
    const n = hit.normal;
    const x = hit.x + n[0], y = hit.y + n[1], z = hit.z + n[2];
    if (x < 0 || x >= WORLD_X || z < 0 || z >= WORLD_Z || y < 0 || y >= WORLD_Y) return;
    if (this.world.isSolid(x, y, z)) return;
    if (!(this.data.inventory[BLOCK.DIRT] > 0)) {
      if (this.player.warnCooldown <= 0) {
        this.warn('No dirt in your backpack. Dig some first.', 'bad');
        this.player.warnCooldown = 1.2;
      }
      return;
    }
    // don't entomb yourself
    const r = 0.32, h = 1.78;
    const p = this.player.pos;
    if (x + 1 > p.x - r && x < p.x + r && y + 1 > p.y && y < p.y + h && z + 1 > p.z - r && z < p.z + r) {
      this.warn('Not inside your own head, please.', 'bad');
      return;
    }
    this.world.set(x, y, z, BLOCK.DIRT);
    this.world.flushDirty();
    this.data.inventory[BLOCK.DIRT]--;
    if (this.data.inventory[BLOCK.DIRT] <= 0) delete this.data.inventory[BLOCK.DIRT];
    this.needSave = true;
    this.particles.mine(x + 0.5, y + 0.5, z + 0.5, BLOCK.DIRT, 4);
    this.audio.breakBlock();
    this.ui.updateHUD(this);
  }

  getInteractable() {
    if (!this.env || !this.player) return null;
    let best = null;
    let bestD = Infinity;
    for (const item of this.env.interactables) {
      const d = this.player.pos.distanceTo(item.position);
      if (d < item.radius && d < bestD) { best = item; bestD = d; }
    }
    return best;
  }

  interact() {
    if (this.mode !== 'playing') return;
    const item = this.getInteractable();
    if (!item) return;
    this.openShop(item.id === 'sell' ? 'sell' : 'upgrade');
  }

  openShop(tab) {
    if (this.mode !== 'playing') return;
    this.mode = 'shop';
    this.player.enabled = false;
    this.player.mining.active = false;
    this.player.digHeld = false;
    this.player.keys.clear();
    this.ui.setPrompt(null);
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.init();
    this.ui.showShop(tab);
  }

  closeShop() {
    this.ui.hideShop();
    this.mode = 'playing';
    this.player.enabled = true;
    this.requestLock();
    this.clock.getDelta();
    this.saveGame();
  }

  sellAll() {
    const total = this.getInventoryValue();
    if (total <= 0) return;
    this.data.money += total;
    this.data.earned += total;
    this.data.inventory = {};
    this.data.trips = (this.data.trips || 0) + 1;
    this.needSave = true;
    this.audio.cash();
    this.ui.toast('Sold the whole backpack', 'good', '+$' + total.toLocaleString('en-US'));
    this.ui.refreshShop();
    this.ui.updateHUD(this);
    this.saveGame();
  }

  buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return;
    const level = this.data.upgrades[id] || 0;
    if (level >= def.levels.length) return;
    const cost = def.levels[level].cost;
    if (this.data.money < cost) return;
    this.data.money -= cost;
    this.data.upgrades[id] = level + 1;
    this.needSave = true;
    this.audio.buy();
    const label = def.name + ' upgraded';
    this.ui.toast(label, 'good', 'LEVEL ' + (level + 1));
    if (id === 'power' && level + 1 >= 1) {
      this.ui.toast('Steel drill online. Deepstone and iron are no match.', 'good');
    }
    this.ui.refreshShop();
    this.ui.updateHUD(this);
    this.saveGame();
  }

  warn(text, kind) {
    this.ui.toast(text, kind || 'bad');
  }

  winch() {
    if (this.mode !== 'playing' || this.winching) return;
    const depth = this.player.getDepth();
    const spawn = this.surfaceSpawn();
    let target = null;
    let up = false;
    if (depth > 1.5) {
      target = spawn;
      up = true;
    } else if (this.data.checkpoint) {
      const c = this.data.checkpoint;
      target = this.safeSpotNear(c.x, c.y, c.z);
      if (!target) {
        this.warn('The winch rope is blocked. Dig out a little room.', 'bad');
        return;
      }
    } else {
      this.warn('Dig a little deeper first. The winch needs somewhere to go.', 'bad');
      return;
    }
    this.winching = true;
    this.player.digHeld = false;
    this.ui.fade(true);
    this.audio.winch();
    setTimeout(() => {
      this.player.teleport(target.x, target.y, target.z);
      this.player.vel.set(0, 0, 0);
      if (up) this.player.yaw = 0;
      this.player.keys.clear();
      this.ui.fade(false);
      this.winching = false;
      this.needSave = true;
      this.ui.updateHUD(this);
    }, 280);
  }

  safeSpotNear(x, y, z) {
    for (let dy = 0; dy <= 8; dy++) {
      for (const ox of [0, 0.6, -0.6, 1.2, -1.2]) {
        for (const oz of [0, 0.6, -0.6, 1.2, -1.2]) {
          const px = x + ox, py = y + dy, pz = z + oz;
          if (this.isSafe(px, py, pz)) return { x: px, y: py, z: pz };
        }
      }
    }
    return null;
  }

  getObjective() {
    if (this.data.won) return { text: 'Keep digging. The hole is yours.', reward: 0 };
    const next = GOALS.find((g) => !this.data.milestones.includes(g.d));
    if (next) return { text: 'Dig down ' + next.d + ' metres', reward: next.reward };
    return { text: 'Find the Heart of the Hole', reward: 0 };
  }

  checkMilestones() {
    const depth = this.data.maxDepth;
    for (const g of GOALS) {
      if (depth >= g.d && !this.data.milestones.includes(g.d)) {
        this.data.milestones.push(g.d);
        this.data.money += g.reward;
        this.data.earned += g.reward;
        this.needSave = true;
        this.audio.cash();
        this.ui.toast(g.label, 'good', '+$' + g.reward);
        this.ui.popObjective();
      }
    }
  }

  triggerWin() {
    if (this.data.won) return;
    this.data.won = true;
    this.mode = 'won';
    this.player.enabled = false;
    this.player.digHeld = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.win();
    this.ui.showWin({
      depth: this.data.maxDepth,
      mined: this.data.mined,
      earned: this.data.earned,
      time: formatTime(this.data.time),
    });
    this.saveGame();
  }

  // ---------- frame ----------
  loop() {
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.mode === 'menu') {
      this.menuT += dt * 0.075;
      const sway = Math.sin(this.menuT * 0.7) * 2.2;
      this.camera.position.set(CENTER + sway, SURFACE + 3.0 + Math.sin(this.menuT * 1.3) * 0.18, SPAWN_Z);
      this.camera.lookAt(CENTER, SURFACE - 0.6, CENTER);
      this.env.update(dt, this.camera.position, 0);
      this.particles.update(dt);
    } else if (this.mode === 'playing') {
      this.data.time += dt;
      this.player.update(dt, this);
      const depth = this.player.getDepth();
      if (depth > this.data.maxDepth) {
        this.data.maxDepth = depth;
        if (this.player.onGround && depth > 1.5) {
          this.data.checkpoint = { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z };
        }
      }
      this.checkMilestones();
      this.particles.update(dt);
      this.env.update(dt, this.player.pos, depth);
      this.updateInteraction();
      this.updateHudFrame(dt, depth);
      this.saveTimer += dt;
      if (this.saveTimer > 9 && this.needSave) {
        this.saveTimer = 0;
        this.saveGame();
      }
      if (Math.abs(depth - this.lastAudioDepth) > 1.5) {
        this.lastAudioDepth = depth;
        this.audio.setDepth(depth);
      }
    } else {
      this.particles.update(dt);
      const depth = this.player ? this.player.getDepth() : 0;
      this.env.update(dt, this.player ? this.player.pos : this.camera.position, depth);
      this.updateHudFrame(dt, depth);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateHudFrame(dt, depth) {
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.ui.updateHUD(this);
      const p = this.player;
      if (p.mining.active) this.ui.setCrosshair('mining', p.mining.progress);
      else if (p.outline.visible) this.ui.setCrosshair('target', 0);
      else this.ui.setCrosshair('none', 0);
    }
    if (!this.data.won && this.data.maxDepth >= 40) {
      const cp = this.world.corePos;
      const dx = cp.x - this.player.pos.x;
      const dz = cp.z - this.player.pos.z;
      const dy = cp.y - (this.player.pos.y + 1.6);
      const dist = Math.hypot(dx, dy, dz);
      const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
      const rx = Math.cos(this.player.yaw), rz = -Math.sin(this.player.yaw);
      const len = Math.hypot(dx, dz) || 1;
      const angle = Math.atan2((dx / len) * rx + (dz / len) * rz, (dx / len) * fx + (dz / len) * fz) * 180 / Math.PI;
      this.ui.setSignal(true, dist, angle);
    } else {
      this.ui.setSignal(false, 0, 0);
    }
    this.ui.setDepthTint(depth);
  }

  updateInteraction() {
    this.interactTimer -= 0.016;
    if (this.interactTimer > 0) return;
    this.interactTimer = 0.12;
    const item = this.getInteractable();
    this.interactable = item;
    this.ui.setPrompt(item ? item.label : null);
  }
}

// ---------- debug / screenshot helpers ----------
const game = new Game();

window.__game = {
  get game() { return game; },
  get mode() { return game.mode; },
  get data() { return game.data; },
  start() { game.startGame(false); },
  newGame() { game.startGame(true); },
  setLook(yaw, pitch = 0) {
    game.player.yaw = yaw;
    game.player.pitch = pitch;
  },
  teleport(x, y, z) {
    game.player.teleport(x, y, z);
    game.player.enabled = true;
    game.mode = 'playing';
    game.ui.showGame();
  },
  teleportDepth(depth) {
    const y = SURFACE + 1 - depth;
    this.carve(32, Math.floor(y) - 1, 32, 3, 2, 3);
    game.world.flushDirty();
    game.player.teleport(32.5, y, 38.5);
    game.player.yaw = 0;
    game.player.pitch = -0.08;
    game.player.enabled = true;
    game.mode = 'playing';
    game.ui.showGame();
    game.data.maxDepth = Math.max(game.data.maxDepth, depth);
    game.data.checkpoint = { x: 32.5, y, z: 38.5 };
    game.player.lampMix = 1;
  },
  carve(cx, cy, cz, rx, ry, rz) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      for (let y = cy - ry; y <= cy + ry; y++) {
        for (let z = cz - rz; z <= cz + rz; z++) {
          if (x < 1 || x >= WORLD_X - 1 || z < 1 || z >= WORLD_Z - 1 || y < 2 || y >= WORLD_Y - 1) continue;
          game.world.set(x, y, z, 0);
        }
      }
    }
  },
  poseUnderground(depth = 42) {
    const y = Math.floor(SURFACE + 1 - depth);
    this.carve(32, y + 1, 32, 3, 2, 3);
    // decorate the walls with a few ores for the camera
    const ores = [BLOCK.GOLD, BLOCK.DIAMOND, BLOCK.IRON, BLOCK.RUBY, BLOCK.GOLD];
    let i = 0;
    for (let x = 28; x <= 36; x += 2) {
      for (let yy = y; yy <= y + 3; yy += 2) {
        game.world.set(x, yy, 28, ores[i % ores.length]);
        game.world.set(36 - (x - 28), yy, 36, ores[(i + 2) % ores.length]);
        i++;
      }
    }
    for (let z = 29; z <= 35; z += 3) {
      game.world.set(28, y + 2, z, ores[(z + i) % ores.length]);
      game.world.set(36, y + 2, z, ores[(z + i + 1) % ores.length]);
    }
    game.world.flushDirty();
    game.player.teleport(32.5, y + 1, 34.5);
    game.player.yaw = 0;
    game.player.pitch = -0.03;
    game.player.enabled = true;
    game.player.lampMix = 1;
    game.mode = 'playing';
    game.ui.showGame();
    game.data.maxDepth = Math.max(game.data.maxDepth, depth);
    game.data.checkpoint = { x: 32.5, y: y + 1, z: 34.5 };
    game.ui.updateHUD(game);
  },
  poseSurface() {
    const s = game.surfaceSpawn();
    game.player.teleport(s.x, s.y, s.z);
    game.player.yaw = 0;
    game.player.pitch = -0.13;
    game.player.enabled = true;
    game.mode = 'playing';
    game.ui.showGame();
    game.ui.updateHUD(game);
  },
  fillInventory() {
    game.data.inventory = {
      [BLOCK.COAL]: 14,
      [BLOCK.COPPER]: 9,
      [BLOCK.IRON]: 6,
      [BLOCK.GOLD]: 4,
      [BLOCK.DIAMOND]: 2,
      [BLOCK.RUBY]: 1,
      [BLOCK.DIRT]: 12,
    };
    game.ui.updateHUD(game);
  },
  setMoney(n) { game.data.money = n; game.ui.updateHUD(game); },
  grant(id, level) { game.data.upgrades[id] = level; game.ui.updateHUD(game); },
  openShop(tab = 'sell') {
    game.mode = 'playing';
    game.player.enabled = true;
    game.openShop(tab);
  },
  closeShop() { game.closeShop(); },
  sell() { game.sellAll(); },
  buy(id) { game.buyUpgrade(id); },
  win() { game.triggerWin(); },
  save() { game.saveGame(); },
  getPlayer() { return game.player; },
};
