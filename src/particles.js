import * as THREE from '../vendor/three.module.js';
import { BLOCKS } from './world.js';

const MAX = 220;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    scene.add(this.mesh);

    this.items = [];
    for (let i = 0; i < MAX; i++) {
      this.items.push({ life: 0, maxLife: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), scale: 1, rot: new THREE.Euler(), spin: new THREE.Vector3() });
    }
    this.cursor = 0;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    for (let i = 0; i < MAX; i++) {
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  spawn(x, y, z, color, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      const p = this.items[idx];
      p.life = 0.55 + Math.random() * 0.65;
      p.maxLife = p.life;
      p.pos.set(x + (Math.random() - 0.5) * 0.7, y + (Math.random() - 0.5) * 0.7, z + (Math.random() - 0.5) * 0.7);
      const a = Math.random() * Math.PI * 2;
      const sp = (1.1 + Math.random() * 2.4) * power;
      p.vel.set(Math.cos(a) * sp * 0.7, 1.5 + Math.random() * 2.6 * power, Math.sin(a) * sp * 0.7);
      p.scale = 0.5 + Math.random() * 0.9;
      p.rot.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      this.color.set(color);
      this.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12);
      this.mesh.setColorAt(idx, this.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  mine(x, y, z, blockId, count) {
    const def = BLOCKS[blockId];
    const color = def ? def.color : '#8a5a34';
    this.spawn(x, y, z, color, count, def && def.kind === 'ore' ? 1.35 : 1);
  }

  burst(x, y, z, blockId) {
    this.mine(x, y, z, blockId, 14);
  }

  update(dt) {
    const d = this.dummy;
    let changed = false;
    for (let i = 0; i < MAX; i++) {
      const p = this.items[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vel.y -= 19 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.rot.x += p.spin.x * dt;
        p.rot.y += p.spin.y * dt;
        p.rot.z += p.spin.z * dt;
        const t = Math.max(0, p.life / p.maxLife);
        const s = p.scale * (0.35 + t * 0.85);
        d.position.copy(p.pos);
        d.rotation.copy(p.rot);
        d.scale.setScalar(s);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        changed = true;
      } else if (p.life > -1) {
        p.life = -2;
        d.position.set(0, -50, 0);
        d.scale.setScalar(0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        changed = true;
      }
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
