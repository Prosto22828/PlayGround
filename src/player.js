import * as THREE from '../vendor/three.module.js';
import { BLOCK, BLOCKS, SURFACE } from './world.js';

const EYE = 1.62;
const HEIGHT = 1.78;
const RADIUS = 0.31;
const GRAVITY = 26;

export class Player {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(32.5, world.topAt(32.5, 44.5), 44.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.06;
    this.onGround = false;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.digHeld = false;
    this.placeQueued = false;
    this.mining = { x: 0, y: 0, z: 0, progress: 0, active: false, block: 0 };
    this.swing = 0;
    this.swingTime = 0;
    this.bobTime = 0;
    this.stepTimer = 0;
    this.shake = 0;
    this.placeCooldown = 0;
    this.warnCooldown = 0;
    this.lampMix = 0;
    this.lampDistance = 12;
    this.enabled = false;
    this.lastBreakSound = 0;
    this.lookSensitivity = 0.0022;

    this.camera.rotation.order = 'YXZ';
    this.scene.add(camera);

    this._buildLights();
    this._buildTool();
    this._buildOutline();
  }

  _buildLights() {
    this.spot = new THREE.SpotLight(0xffe9c2, 0, 30, 0.78, 0.55, 1.6);
    this.spot.position.set(0.15, 0.1, 0);
    this.spot.target.position.set(0, -0.4, -10);
    this.camera.add(this.spot);
    this.camera.add(this.spot.target);

    this.nearLight = new THREE.PointLight(0xffdfae, 0.5, 8, 1.6);
    this.nearLight.position.set(0, -0.1, -0.3);
    this.camera.add(this.nearLight);
  }

  _buildTool() {
    this.toolGroup = new THREE.Group();
    this.toolGroup.position.set(0.68, -0.26, -0.95);
    this.toolGroup.rotation.set(0.16, -0.36, 0.18);
    this.toolGroup.scale.setScalar(0.4);
    this.camera.add(this.toolGroup);

    const wood = new THREE.MeshBasicMaterial({ color: 0x6b4423 });
    const metal = new THREE.MeshBasicMaterial({ color: 0x9aa4ae });
    const dark = new THREE.MeshBasicMaterial({ color: 0x2b3036 });

    // shovel
    this.shovel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.92, 0.055), wood);
    handle.position.y = 0.08;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.07), dark);
    grip.position.y = 0.47;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.05), metal);
    blade.position.set(0, -0.44, 0.005);
    const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.16, 4), metal);
    bladeTip.position.set(0, -0.66, 0.005);
    bladeTip.rotation.set(Math.PI, Math.PI / 4, 0);
    bladeTip.scale.z = 0.35;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 8), dark);
    collar.position.y = -0.26;
    this.shovel.add(handle, grip, blade, bladeTip, collar);
    this.shovel.rotation.set(-0.15, 0, 0.08);
    this.toolGroup.add(this.shovel);

    // drill
    this.drill = new THREE.Group();
    this.drill.visible = false;
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xd18a32 });
    this.drillBodyMat = bodyMat;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.115, 0.36, 12), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, -0.02);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 10), dark);
    back.rotation.x = Math.PI / 2;
    back.position.set(0, 0, 0.2);
    const grip2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), dark);
    grip2.position.set(0, -0.18, 0.08);
    grip2.rotation.x = 0.18;
    this.bitPivot = new THREE.Group();
    this.bitPivot.position.set(0, 0, -0.2);
    const bitMat = new THREE.MeshBasicMaterial({ color: 0xe6eef7 });
    this.bitMat = bitMat;
    const bit = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3, 10), bitMat);
    bit.rotation.x = -Math.PI / 2;
    bit.position.z = -0.14;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 6, 14), dark);
    ring.position.z = -0.02;
    this.bitPivot.add(bit, ring);
    this.drill.add(body, back, grip2, this.bitPivot);
    this.drill.rotation.set(-0.32, 0.04, 0);
    this.drill.position.set(0, 0.02, 0);
    this.toolGroup.add(this.drill);
    this.toolGroup.visible = false;

    // small light to make the tool readable underground
    const toolLight = new THREE.PointLight(0xffdca8, 0.25, 2.2, 1.5);
    toolLight.position.set(0.2, 0.1, 0.2);
    this.toolGroup.add(toolLight);
  }

  _buildOutline() {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    const mat = new THREE.LineBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.75, depthWrite: false });
    this.outline = new THREE.LineSegments(geo, mat);
    this.outline.visible = false;
    this.outline.renderOrder = 4;
    this.scene.add(this.outline);
  }

  setSpawn(x, y, z, yaw = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.06;
    this.onGround = false;
  }

  teleport(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.onGround = false;
  }

  getDepth() {
    return Math.max(0, SURFACE + 1 - this.pos.y);
  }

  look(dx, dy) {
    this.yaw -= dx * this.lookSensitivity;
    this.pitch -= dy * this.lookSensitivity;
    this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));
  }

  getDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    return out;
  }

  collides(px, py, pz) {
    const minX = Math.floor(px - RADIUS), maxX = Math.floor(px + RADIUS);
    const minY = Math.floor(py + 0.002), maxY = Math.floor(py + HEIGHT - 0.002);
    const minZ = Math.floor(pz - RADIUS), maxZ = Math.floor(pz + RADIUS);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (this.world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  update(dt, game) {
    if (!this.enabled) {
      this.toolGroup.visible = false;
      this.outline.visible = false;
      this.spot.intensity = 0;
      return;
    }
    this.toolGroup.visible = true;
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.warnCooldown = Math.max(0, this.warnCooldown - dt);

    // ---- movement input ----
    let f = 0, r = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) r += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) r -= 1;
    f += -this.touchMove.y;
    r += this.touchMove.x;
    const len = Math.hypot(f, r);
    if (len > 1) { f /= len; r /= len; }
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const baseSpeed = 4.35 * game.bootsMult * (sprint ? 1.55 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const tx = (fx * f + rx * r) * baseSpeed;
    const tz = (fz * f + rz * r) * baseSpeed;
    const accel = this.onGround ? 16 : 5.5;
    this.vel.x += (tx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (tz - this.vel.z) * Math.min(1, accel * dt);

    if ((this.keys.has('Space') || game.jumpQueued) && this.onGround) {
      this.vel.y = 8.4;
      this.onGround = false;
      game.jumpQueued = false;
      game.audio.jump();
    }
    game.jumpQueued = false;

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -38) this.vel.y = -38;

    // ---- collision ----
    const wasGround = this.onGround;
    this.onGround = false;
    this.pos.x += this.vel.x * dt;
    if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.x -= this.vel.x * dt;
      this.vel.x = 0;
    }
    this.pos.z += this.vel.z * dt;
    if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.z -= this.vel.z * dt;
      this.vel.z = 0;
    }
    this.pos.y += this.vel.y * dt;
    if (this.collides(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.y -= this.vel.y * dt;
      if (this.vel.y < 0) {
        this.onGround = true;
        if (!wasGround && this.vel.y < -8) game.audio.land();
      }
      this.vel.y = 0;
    }

    // fall out of the world failsafe
    if (this.pos.y < -6) {
      this.teleport(32.5, this.world.topAt(32.5, 44.5), 44.5);
    }

    // ---- camera ----
    const moving = Math.hypot(this.vel.x, this.vel.z) > 0.7 && this.onGround;
    if (moving) {
      this.bobTime += dt * (sprint ? 13 : 9.4);
      this.stepTimer -= dt * (sprint ? 1.5 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.46;
        game.audio.step();
      }
    }
    const bob = moving ? Math.sin(this.bobTime) * 0.045 : 0;
    const sway = moving ? Math.cos(this.bobTime * 0.5) * 0.025 : 0;
    this.shake = Math.max(0, this.shake - dt * 2.4);
    const shx = (Math.random() - 0.5) * this.shake * 0.06;
    const shy = (Math.random() - 0.5) * this.shake * 0.06;
    this.camera.position.set(this.pos.x + sway + shx, this.pos.y + EYE + bob + shy, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');

    // ---- tool ----
    const showDrill = game.power >= 2;
    this.shovel.visible = !showDrill;
    this.drill.visible = showDrill;
    if (showDrill) {
      const colors = [0xd18a32, 0xd18a32, 0xcfd6de, 0x8ff0ff];
      this.drillBodyMat.color.setHex(colors[Math.min(3, game.power - 1)]);
      this.bitMat.color.setHex(game.power >= 3 ? 0xa9f7ff : 0xe6eef7);
    }
    this.toolGroup.position.set(0.68, -0.26 + bob * 0.5, -0.95);
    this.toolGroup.rotation.x = 0.16;
    this.toolGroup.rotation.y = -0.36;
    this.toolGroup.rotation.z = 0.18 + sway * 0.4;
    const miningSwing = this.mining.active ? Math.sin(this.swingTime * 17) : 0;
    if (showDrill) {
      this.toolGroup.position.y += Math.abs(miningSwing) * 0.03;
      this.toolGroup.position.z = -0.95 + (this.mining.active ? 0.05 : 0);
      this.bitPivot.rotation.z += dt * (this.mining.active ? 34 : 3);
    } else {
      this.toolGroup.rotation.x = 0.1 + miningSwing * 0.24;
      this.toolGroup.rotation.y = -0.25 - miningSwing * 0.12;
      this.toolGroup.position.y += miningSwing * 0.02;
    }

    // ---- lamp ----
    const depth = this.getDepth();
    const targetMix = Math.max(0, Math.min(1, (depth - 2) / 7));
    this.lampMix += (targetMix - this.lampMix) * Math.min(1, dt * 3);
    this.lampDistance += (game.lampDistance - this.lampDistance) * Math.min(1, dt * 3);
    this.spot.distance = this.lampDistance + 8;
    this.spot.intensity = this.lampMix * 13 + 0.8;
    this.spot.angle = 0.8;
    this.nearLight.intensity = 0.28 + this.lampMix * 0.75;
    this.nearLight.distance = 5 + this.lampMix * 3;

    // ---- mining ----
    this.updateMining(dt, game);
  }

  updateMining(dt, game) {
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    const camPos = this.camera.position;
    const dir = this.getDir(new THREE.Vector3());
    const hit = this.world.raycast(camPos, dir, 5.6);

    if (hit) {
      this.outline.visible = true;
      this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      const isCore = hit.block === BLOCK.CORE;
      this.outline.material.color.setHex(isCore ? 0xffd76a : 0xffc857);
    } else {
      this.outline.visible = false;
    }

    if (!this.digHeld || !hit) {
      this.mining.active = false;
      this.mining.progress = 0;
      this.swingTime = 0;
      if (this.placeQueued && hit && this.placeCooldown <= 0) {
        game.tryPlace(hit);
        this.placeCooldown = 0.22;
      }
      this.placeQueued = false;
      return;
    }
    this.placeQueued = false;

    const def = BLOCKS[hit.block];
    if (!def) return;
    if (game.power < def.power) {
      this.mining.active = false;
      this.mining.progress = 0;
      if (this.warnCooldown <= 0) {
        game.warn(`Your drill is too weak for ${def.name}. Upgrade it at the Ore-O-Matic.`, 'bad');
        this.warnCooldown = 1.4;
        game.audio.clank();
      }
      return;
    }
    if (!game.canCollect(hit.block)) {
      this.mining.active = false;
      this.mining.progress = 0;
      if (this.warnCooldown <= 0) {
        game.warn('Backpack full! Winch up and sell your haul.', 'bad');
        this.warnCooldown = 1.4;
        game.audio.clank();
      }
      return;
    }

    if (!this.mining.active || this.mining.x !== hit.x || this.mining.y !== hit.y || this.mining.z !== hit.z) {
      this.mining.x = hit.x;
      this.mining.y = hit.y;
      this.mining.z = hit.z;
      this.mining.progress = 0;
      this.mining.active = true;
      this.mining.block = hit.block;
    }
    this.swingTime += dt;
    this.mining.progress += (dt * game.speedMult) / def.hardness;
    this.shake = Math.max(this.shake, 0.25);
    game.audio.digLoop(dt);
    if (Math.random() < dt * 12) game.particles.mine(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, hit.block, 1);

    if (this.mining.progress >= 1) {
      const ok = game.breakBlock(hit.x, hit.y, hit.z, hit.block);
      this.mining.progress = 0;
      this.mining.active = false;
      this.swingTime = 0;
      if (ok) this.shake = 0.55;
    }
  }

  applyUpgrades(game) {
    // visual/readability hooks; stats are read from game each frame
    this.lampDistance = game.lampDistance;
  }
}
