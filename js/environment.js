/* The town environment: sky, ground, paths, plaza, greenery and small props. */
import * as THREE from 'three';
import { BUILDINGS, TOWN } from './data.js';
import { makeRNG, buildingWorldPosition, makeCanvas, texFromCanvas, addBox, addCylinder } from './gfx.js';

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export class Environment {
  constructor(scene, quality, matFor, brickGeo) {
    this.scene = scene;
    this.quality = quality;
    this.matFor = matFor;
    this.brickGeo = brickGeo;
    this.rng = makeRNG(778811);
    this.time = 0;
    this.clouds = [];
    this.birds = [];
    this.smoke = [];
    this.fountainParticles = null;
    this.buildingSpots = BUILDINGS.map((def) => {
      const p = buildingWorldPosition(def);
      return { x: p.x, z: p.z, r: Math.max(def.w, def.d) };
    });
    this.group = new THREE.Group();
    this.group.name = 'environment';
    scene.add(this.group);
  }

  isPaved(x, z) {
    const r = Math.hypot(x, z);
    if (r < TOWN.plazaR + 0.8) return true;
    if (Math.abs(r - TOWN.ringR) < TOWN.ringWidth / 2 + 1.2) return true;
    if (Math.abs(x) < 3.0 && z > 10 && z < 47) return true;
    const phi = Math.atan2(z, x);
    for (const b of BUILDINGS) {
      const a = (b.angle * Math.PI) / 180;
      if (Math.abs(angleDiff(phi, a)) * r < 3.2 && r > 9 && r < TOWN.ringR + 3.5) return true;
    }
    return false;
  }

  nearBuilding(x, z, pad = 5) {
    for (const s of this.buildingSpots) {
      if (Math.hypot(x - s.x, z - s.z) < s.r / 2 + pad) return true;
    }
    return false;
  }

  isFreeGround(x, z, pad = 0) {
    const r = Math.hypot(x, z);
    if (r > 58) return false;
    if (this.isPaved(x, z)) return false;
    if (this.nearBuilding(x, z, 4 + pad)) return false;
    return true;
  }

  build() {
    this.createSky();
    this.createDistantLand();
    this.createGround();
    this.createPaths();
    this.createPlaza();
    this.createTrees();
    this.createFlowers();
    this.createRocks();
    this.createLamps();
    this.createEntrance();
    this.createClouds();
    this.createBirds();
    return this;
  }

  /* ---------------- sky ---------------- */
  createSky() {
    const skyGeo = new THREE.SphereGeometry(280, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#8fcfe6') },
        mid: { value: new THREE.Color('#c9e6ea') },
        horizon: { value: new THREE.Color('#ffe4bf') },
        low: { value: new THREE.Color('#f6cda5') },
        sunDir: { value: new THREE.Vector3(-0.52, 0.42, 0.55).normalize() },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 low; uniform vec3 sunDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(low, horizon, smoothstep(-0.12, 0.12, h));
          col = mix(col, mid, smoothstep(0.08, 0.42, h));
          col = mix(col, top, smoothstep(0.38, 0.95, h));
          float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 120.0);
          float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0);
          col += vec3(1.0, 0.83, 0.58) * sun * 0.9;
          col += vec3(1.0, 0.72, 0.46) * glow * 0.10;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // soft sun sprite
    const { canvas, ctx } = makeCanvas(256, 256);
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,247,214,1)');
    grad.addColorStop(0.22, 'rgba(255,228,165,.9)');
    grad.addColorStop(0.55, 'rgba(255,210,150,.25)');
    grad.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texFromCanvas(canvas), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    sprite.position.set(-95, 72, 100);
    sprite.scale.set(80, 80, 1);
    this.scene.add(sprite);

    this.scene.background = new THREE.Color('#f7ddc1');
    this.scene.fog = new THREE.Fog(0xf6ddc3, 72, 185);
  }

  /* ---------------- distant hills & forest ---------------- */
  createDistantLand() {
    const hillColors = ['#c9a9c9', '#d8b3c7', '#b8c9a4', '#d8c0a3', '#b7a9cd', '#c7b6c1'];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + this.rng() * 0.18;
      const r = 72 + this.rng() * 26;
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const m = new THREE.Mesh(geo, this.matFor(hillColors[i % hillColors.length], { roughness: 1, flat: true }));
      m.position.set(Math.cos(a) * r, -4 - this.rng() * 5, Math.sin(a) * r);
      m.scale.set(16 + this.rng() * 18, 9 + this.rng() * 14, 15 + this.rng() * 16);
      m.rotation.set(this.rng(), this.rng() * TAU, this.rng());
      m.receiveShadow = false;
      m.castShadow = false;
      this.scene.add(m);
    }

    // distant pine forest ring (two instanced meshes)
    const pineCount = 110;
    const pineGeo = new THREE.ConeGeometry(1, 3.2, 6);
    pineGeo.translate(0, 1.6, 0);
    const pineMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const pines = new THREE.InstancedMesh(pineGeo, pineMat, pineCount);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const forestColors = ['#6f9c72', '#7fa87b', '#5f8e69', '#8db482'];
    for (let i = 0; i < pineCount; i++) {
      const a = this.rng() * TAU;
      const r = 48 + this.rng() * 30;
      const s = 2.2 + this.rng() * 3.2;
      q.setFromEuler(new THREE.Euler(0, this.rng() * TAU, 0));
      m4.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(s, s * (1.4 + this.rng() * 0.7), s));
      pines.setMatrixAt(i, m4);
      pines.setColorAt(i, new THREE.Color(forestColors[i % forestColors.length]));
    }
    pines.castShadow = false;
    pines.receiveShadow = true;
    this.scene.add(pines);

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.0, 5);
    trunkGeo.translate(0, 0.5, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, this.matFor('#8c6654', { roughness: 1 }), pineCount);
    for (let i = 0; i < pineCount; i++) {
      const a = this.rng() * TAU;
      const r = 48 + this.rng() * 30;
      const s = 2.2 + this.rng() * 3.2;
      m4.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4);
    }
    trunks.castShadow = false;
    this.scene.add(trunks);
  }

  /* ---------------- ground ---------------- */
  createGround() {
    const geo = new THREE.PlaneGeometry(220, 220, 78, 78);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = [];
    const c1 = new THREE.Color('#a8ca8b');
    const c2 = new THREE.Color('#93bb7d');
    const c3 = new THREE.Color('#bad694');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.09 + Math.cos(z * 0.07)) * 0.5 + Math.sin((x + z) * 0.045) * 0.35 + Math.sin(z * 0.17) * 0.15;
      const c = n > 0.32 ? c3 : n < -0.3 ? c2 : c1;
      const mixC = c.clone().offsetHSL((this.rng() - 0.5) * 0.012, (this.rng() - 0.5) * 0.03, (this.rng() - 0.5) * 0.035);
      colors.push(mixC.r, mixC.g, mixC.b);
      // very gentle outer swells, kept flat under the town
      const r = Math.hypot(x, z);
      pos.setY(i, r > 52 ? (Math.sin(x * 0.07) * Math.cos(z * 0.06)) * 1.2 : 0);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.castShadow = false;
    this.scene.add(ground);

    // soft dirt patch under the town edge
    const dirt = new THREE.Mesh(
      new THREE.CircleGeometry(36, 48),
      new THREE.MeshStandardMaterial({ color: '#b6c78c', roughness: 1, transparent: true, opacity: 0.32 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.005;
    this.scene.add(dirt);
  }

  /* ---------------- paths ---------------- */
  createPaths() {
    const pavers = [];
    const add = (x, z, rot, color, sx = 1.16, sz = 1.16) => pavers.push({ x, z, rot, color, sx, sz });
    const palette = ['#f3e3ca', '#ecd7b7', '#f8ecd8', '#e7cfae', '#f0ddc0'];
    const pick = () => palette[Math.floor(this.rng() * palette.length)];

    // ring road
    const ringSteps = Math.floor((TAU * TOWN.ringR) / 0.9);
    for (let i = 0; i < ringSteps; i++) {
      const a = (i / ringSteps) * TAU;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (const off of [-1.62, -0.54, 0.54, 1.62]) {
        const jitter = (this.rng() - 0.5) * 0.1;
        add(cos * (TOWN.ringR + off) + (this.rng() - 0.5) * 0.07,
            sin * (TOWN.ringR + off) + (this.rng() - 0.5) * 0.07,
            a + Math.PI / 2 + jitter, pick());
      }
    }

    // spokes to each building
    for (const b of BUILDINGS) {
      const a = (b.angle * Math.PI) / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      for (let r = TOWN.plazaR + 0.4; r < TOWN.ringR + 2.6; r += 0.92) {
        for (const off of [-1.05, 0, 1.05]) {
          add(cos * r + Math.cos(a + Math.PI / 2) * off, sin * r + Math.sin(a + Math.PI / 2) * off,
              a + (this.rng() - 0.5) * 0.08, pick());
        }
      }
    }

    // south entrance
    for (let z = 10.5; z < 47; z += 0.95) {
      for (const x of [-1.65, -0.55, 0.55, 1.65]) {
        add(x + (this.rng() - 0.5) * 0.05, z, (this.rng() - 0.5) * 0.09, pick());
      }
    }

    const geo = new THREE.BoxGeometry(1, 0.09, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    const mesh = new THREE.InstancedMesh(geo, mat, pavers.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    pavers.forEach((p, i) => {
      e.set(0, p.rot, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p.x, 0.045, p.z), q, new THREE.Vector3(p.sx, 1, p.sz));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, new THREE.Color(p.color));
    });
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    this.scene.add(mesh);
    this.paverMesh = mesh;

    // dark outer curb ring
    const curb = new THREE.Mesh(
      new THREE.RingGeometry(TOWN.ringR + 2.42, TOWN.ringR + 2.78, 96),
      new THREE.MeshStandardMaterial({ color: '#cdb190', roughness: 1 })
    );
    curb.rotation.x = -Math.PI / 2;
    curb.position.y = 0.05;
    curb.receiveShadow = true;
    this.scene.add(curb);
  }

  /* ---------------- plaza ---------------- */
  createPlaza() {
    const { canvas, ctx } = makeCanvas(1024, 1024);
    ctx.fillStyle = '#eedbc1';
    ctx.fillRect(0, 0, 1024, 1024);
    const shades = ['#f2e2ca', '#ead7b9', '#f7ead5', '#e5cdaa', '#f0dcc0'];
    const n = 13;
    const step = 1024 / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = shades[(i * 3 + j * 5 + Math.floor(this.rng() * 5)) % shades.length];
        ctx.fillRect(i * step + 2, j * step + 2, step - 4, step - 4);
      }
    }
    // concentric inlay
    ctx.strokeStyle = 'rgba(155,122,96,.22)';
    ctx.lineWidth = 10;
    [210, 300, 390].forEach((r) => {
      ctx.beginPath();
      ctx.arc(512, 512, r, 0, TAU);
      ctx.stroke();
    });
    ctx.strokeStyle = 'rgba(255,250,235,.35)';
    ctx.lineWidth = 3;
    [230, 320, 410].forEach((r) => {
      ctx.beginPath();
      ctx.arc(512, 512, r, 0, TAU);
      ctx.stroke();
    });
    const plazaTex = texFromCanvas(canvas, 8);
    const circle = new THREE.Mesh(
      new THREE.CircleGeometry(TOWN.plazaR + 0.6, 72),
      new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.92 })
    );
    circle.rotation.x = -Math.PI / 2;
    circle.position.y = 0.055;
    circle.receiveShadow = true;
    this.scene.add(circle);

    const border = new THREE.Mesh(
      new THREE.RingGeometry(TOWN.plazaR + 0.58, TOWN.plazaR + 1.35, 80),
      new THREE.MeshStandardMaterial({ color: '#d8bf9f', roughness: 1 })
    );
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.05;
    border.receiveShadow = true;
    this.scene.add(border);

    // fountain
    const fg = new THREE.Group();
    fg.position.set(0, 0, 0);
    const stone = '#cbb3a0';
    const stoneDark = '#b79d89';
    addCylinder(fg, 3.25, 3.5, 0.6, 28, stone, this.matFor, 0, 0.3, 0, { roughness: 0.95 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.17, 8, 32), this.matFor('#e0c9b4', { roughness: 0.9 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.62;
    rim.castShadow = true;
    rim.receiveShadow = true;
    fg.add(rim);
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(2.98, 2.98, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: '#9bdde6', roughness: 0.18, metalness: 0.08, transparent: true, opacity: 0.82 })
    );
    water.position.y = 0.55;
    water.receiveShadow = true;
    fg.add(water);
    this.fountainWater = water;
    addCylinder(fg, 0.45, 0.68, 1.5, 12, stoneDark, this.matFor, 0, 1.3, 0);
    addCylinder(fg, 1.55, 1.05, 0.24, 20, '#e0c9b4', this.matFor, 0, 2.05, 0);
    addCylinder(fg, 0.22, 0.32, 0.5, 10, stone, this.matFor, 0, 2.4, 0);
    const topBall = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), this.matFor('#f2e0c7', { roughness: 0.8 }));
    topBall.position.y = 2.72;
    topBall.castShadow = true;
    fg.add(topBall);
    this.scene.add(fg);
    this.fountain = fg;

    // fountain particles
    const count = 90;
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0; positions[i * 3 + 1] = 2.75; positions[i * 3 + 2] = 0;
      const a = Math.random() * TAU;
      const sp = 0.35 + Math.random() * 0.9;
      vel.push({ x: Math.cos(a) * sp * 0.35, y: 1.2 + Math.random() * 1.1, z: Math.sin(a) * sp * 0.35 });
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pCanvas = makeCanvas(64, 64);
    const pctx = pCanvas.ctx;
    const pg2 = pctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    pg2.addColorStop(0, 'rgba(255,255,255,.95)');
    pg2.addColorStop(0.45, 'rgba(190,240,245,.8)');
    pg2.addColorStop(1, 'rgba(190,240,245,0)');
    pctx.fillStyle = pg2;
    pctx.fillRect(0, 0, 64, 64);
    const points = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0xd8f8fb, size: 0.16, transparent: true, opacity: 0.9, depthWrite: false,
      map: texFromCanvas(pCanvas.canvas), blending: THREE.AdditiveBlending,
    }));
    points.frustumCulled = false;
    this.scene.add(points);
    this.fountainParticles = { points, positions, vel, count };

    // benches
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      this.createBench(Math.cos(a) * 7.2, Math.sin(a) * 7.2, -a + Math.PI / 2);
    }

    // flower beds at the plaza corners
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 8;
      const x = Math.cos(a) * 9.2, z = Math.sin(a) * 9.2;
      const bed = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35, 1.45, 0.24, 16),
        this.matFor('#c8ae90', { roughness: 1 })
      );
      bed.position.set(x, 0.12, z);
      bed.receiveShadow = true;
      bed.castShadow = true;
      this.scene.add(bed);
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.26, 16), this.matFor('#7d6049', { roughness: 1 }));
      soil.position.set(x, 0.15, z);
      this.scene.add(soil);
      for (let k = 0; k < 12; k++) {
        const fa = Math.random() * TAU, fr = Math.random() * 0.9;
        const flower = new THREE.Mesh(
          new THREE.SphereGeometry(0.09 + Math.random() * 0.06, 5, 4),
          this.matFor(['#f49bb5', '#f7d36c', '#f7f2e2', '#c6a3dc'][k % 4], { roughness: 0.8 })
        );
        flower.position.set(x + Math.cos(fa) * fr, 0.42 + Math.random() * 0.12, z + Math.sin(fa) * fr);
        this.scene.add(flower);
      }
    }
  }

  createBench(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const wood = '#a87957';
    addBox(g, 2.2, 0.16, 0.62, wood, this.matFor, 0, 0.78, 0);
    addBox(g, 2.2, 0.7, 0.13, wood, this.matFor, 0, 1.08, -0.26);
    addBox(g, 0.13, 0.8, 0.5, '#6f5b4d', this.matFor, -0.9, 0.4, 0);
    addBox(g, 0.13, 0.8, 0.5, '#6f5b4d', this.matFor, 0.9, 0.4, 0);
    this.scene.add(g);
  }

  /* ---------------- greenery ---------------- */
  createTrees() {
    const spots = [];
    let guard = 0;
    while (spots.length < 30 && guard++ < 500) {
      const a = this.rng() * TAU;
      const r = 37 + this.rng() * 14;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.isPaved(x, z) || this.nearBuilding(x, z, 6.5)) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 4.6)) continue;
      spots.push({ x, z, r });
    }
    spots.forEach((s, i) => {
      const type = i % 5 === 0 ? 'blossom' : i % 7 === 0 ? 'pine' : 'leafy';
      this.createTree(s.x, s.z, type, 0.85 + this.rng() * 0.65);
    });

    // a couple of special trees close to the plaza
    this.createTree(-16.5, 13.5, 'blossom', 1.25);
    this.createTree(17.5, 15.5, 'leafy', 1.1);
    this.createTree(-15.5, -16.5, 'blossom', 1.0);

    // bushes
    for (let i = 0; i < 22; i++) {
      const a = this.rng() * TAU;
      const r = 14 + this.rng() * 24;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!this.isFreeGround(x, z, 1.5)) continue;
      const bush = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.65 + this.rng() * 0.55, 0),
        this.matFor(['#7cae72', '#8cbc7b', '#6da267', '#a4c98d'][i % 4], { roughness: 1, flat: true })
      );
      bush.position.set(x, 0.45 + this.rng() * 0.15, z);
      bush.scale.y = 0.7 + this.rng() * 0.3;
      bush.rotation.y = this.rng() * TAU;
      bush.castShadow = true;
      bush.receiveShadow = true;
      this.scene.add(bush);
    }
  }

  createTree(x, z, type, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = this.rng() * TAU;
    if (type === 'pine') {
      addCylinder(g, 0.14, 0.22, 1.2, 6, '#8a624d', this.matFor, 0, 0.6, 0);
      const greens = ['#5f8f68', '#6b9d70', '#54835f'];
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.35 - i * 0.3, 1.7, 7),
          this.matFor(greens[i], { roughness: 1, flat: true })
        );
        cone.position.y = 1.7 + i * 0.95;
        cone.castShadow = true;
        cone.receiveShadow = true;
        g.add(cone);
      }
    } else {
      addCylinder(g, 0.16, 0.28, 1.6, 7, '#8c6654', this.matFor, 0, 0.8, 0, { roughness: 1 });
      const leaf = type === 'blossom' ? ['#f2a9c4', '#f5b8cf', '#e99ab9'] : ['#78b371', '#86c07e', '#6da567'];
      for (let i = 0; i < 3; i++) {
        const blob = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.95 + this.rng() * 0.35, 0),
          this.matFor(leaf[i], { roughness: 1, flat: true })
        );
        blob.position.set((this.rng() - 0.5) * 1.1, 2.35 + i * 0.5, (this.rng() - 0.5) * 1.1);
        blob.scale.set(1.05, 0.92, 1.05);
        blob.castShadow = true;
        blob.receiveShadow = true;
        g.add(blob);
      }
      if (type === 'blossom') {
        const extra = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 0), this.matFor('#f6c3d8', { roughness: 1, flat: true }));
        extra.position.set(0.85, 2.5, 0.4);
        extra.castShadow = true;
        g.add(extra);
      }
    }
    g.scale.setScalar(scale);
    this.scene.add(g);
  }

  createFlowers() {
    // grass tufts
    const grassCount = 420;
    const grassGeo = new THREE.ConeGeometry(0.055, 0.5, 3);
    grassGeo.translate(0, 0.25, 0);
    const grass = new THREE.InstancedMesh(grassGeo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), grassCount);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let gi = 0, guard = 0;
    while (gi < grassCount && guard++ < 4000) {
      const a = this.rng() * TAU;
      const r = 12 + this.rng() * 42;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!this.isFreeGround(x, z, 0.5)) continue;
      e.set((this.rng() - 0.5) * 0.2, this.rng() * TAU, (this.rng() - 0.5) * 0.2);
      q.setFromEuler(e);
      const s = 0.7 + this.rng() * 1.1;
      m4.compose(new THREE.Vector3(x, 0.02, z), q, new THREE.Vector3(s, s, s));
      grass.setMatrixAt(gi, m4);
      grass.setColorAt(gi, new THREE.Color(['#7fb677', '#8cc481', '#6fa96b', '#9ccb8a'][gi % 4]));
      gi++;
    }
    grass.count = gi;
    grass.receiveShadow = true;
    this.scene.add(grass);

    // flower heads with tiny stems
    const flowerCount = 260;
    const stemGeo = new THREE.CylinderGeometry(0.012, 0.015, 0.34, 3);
    stemGeo.translate(0, 0.17, 0);
    const stems = new THREE.InstancedMesh(stemGeo, new THREE.MeshStandardMaterial({ color: '#6b9d63', roughness: 1 }), flowerCount);
    const headGeo = new THREE.SphereGeometry(0.075, 5, 4);
    const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowerCount);
    const petalColors = ['#f7f2e3', '#f6a9c0', '#f7d36c', '#c7a6de', '#f18f85', '#9ed3e8'];
    let fi = 0; guard = 0;
    while (fi < flowerCount && guard++ < 4000) {
      const a = this.rng() * TAU;
      const r = 12 + this.rng() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (!this.isFreeGround(x, z, 0.5)) continue;
      const s = 0.8 + this.rng() * 0.9;
      m4.compose(new THREE.Vector3(x, 0.02, z), q.identity(), new THREE.Vector3(s, s, s));
      stems.setMatrixAt(fi, m4);
      m4.compose(new THREE.Vector3(x, 0.2 + 0.34 * s, z), q, new THREE.Vector3(s, s, s));
      heads.setMatrixAt(fi, m4);
      heads.setColorAt(fi, new THREE.Color(petalColors[fi % petalColors.length]));
      fi++;
    }
    stems.count = fi; heads.count = fi;
    this.scene.add(stems);
    this.scene.add(heads);
  }

  createRocks() {
    const colors = ['#d3a7bd', '#c3a5c9', '#d9b3a6', '#b7a9c8'];
    for (let i = 0; i < 15; i++) {
      const a = this.rng() * TAU;
      const r = 40 + this.rng() * 20;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.7 + this.rng() * 1.8, 0),
        this.matFor(colors[i % colors.length], { roughness: 1, flat: true })
      );
      rock.position.set(Math.cos(a) * r, 0.3 + this.rng() * 0.4, Math.sin(a) * r);
      rock.scale.set(1 + this.rng(), 0.6 + this.rng() * 0.6, 1 + this.rng() * 0.8);
      rock.rotation.set(this.rng(), this.rng() * TAU, this.rng());
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }
  }

  /* ---------------- lamps, entrance, sky decor ---------------- */
  createLamps() {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.23;
      this.createLamp(Math.cos(a) * 13.4, Math.sin(a) * 13.4, -a + Math.PI / 2);
    }
    this.createLamp(-4.2, 34, 0);
    this.createLamp(4.2, 34, 0);
  }

  createLamp(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    addCylinder(g, 0.11, 0.16, 2.45, 8, '#4c5d5b', this.matFor, 0, 1.22, 0);
    addCylinder(g, 0.22, 0.27, 0.18, 8, '#4c5d5b', this.matFor, 0, 0.09, 0);
    addBox(g, 0.52, 0.08, 0.08, '#4c5d5b', this.matFor, 0.18, 2.4, 0);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#fff0c7', emissive: '#ffd98c', emissiveIntensity: 1.15, roughness: 0.3 })
    );
    globe.position.set(0.4, 2.3, 0);
    g.add(globe);
    // little cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 8), this.matFor('#4c5d5b', { roughness: 0.8 }));
    cap.position.set(0.4, 2.55, 0);
    g.add(cap);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
  }

  createEntrance() {
    const g = new THREE.Group();
    g.position.set(0, 0, 38.5);
    const wood = '#b98961';
    const cream = '#f3e3c8';
    addCylinder(g, 0.28, 0.34, 4.3, 8, wood, this.matFor, -3.6, 2.15, 0);
    addCylinder(g, 0.28, 0.34, 4.3, 8, wood, this.matFor, 3.6, 2.15, 0);
    addBox(g, 8.1, 0.46, 0.36, wood, this.matFor, 0, 4.25, 0);
    addBox(g, 7.0, 0.16, 0.22, cream, this.matFor, 0, 4.0, 0.08);
    const signTex = texFromCanvas((() => {
      const { canvas, ctx } = makeCanvas(512, 160);
      ctx.fillStyle = '#f7e8cf';
      ctx.fillRect(0, 0, 512, 160);
      ctx.strokeStyle = 'rgba(82,61,45,.35)';
      ctx.lineWidth = 8;
      ctx.strokeRect(5, 5, 502, 150);
      ctx.fillStyle = '#36505a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '600 66px Fredoka, "Trebuchet MS", sans-serif';
      ctx.fillText('MAPLE HOLLOW', 256, 64);
      ctx.font = '800 24px Nunito, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(54,80,90,.6)';
      ctx.fillText('a small town · put back together', 256, 118);
      return canvas;
    })());
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 1.72),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
    );
    sign.position.set(0, 3.5, 0.19);
    g.add(sign);
    // hanging flower baskets
    [-3.6, 3.6].forEach((x) => {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.28, 8), this.matFor('#b0744e', { roughness: 1 }));
      basket.position.set(x, 3.35, 0);
      g.add(basket);
      for (let i = 0; i < 5; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), this.matFor(['#f4a1b8', '#f6d36b', '#f7f1df'][i % 3], { roughness: 0.8 }));
        f.position.set(x + (Math.random() - 0.5) * 0.5, 3.42 + Math.random() * 0.18, (Math.random() - 0.5) * 0.3);
        g.add(f);
      }
    });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    this.entrance = g;
  }

  createClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#fff7e8', roughness: 1, metalness: 0, flatShading: true, emissive: '#ffeed2', emissiveIntensity: 0.35, fog: false,
    });
    const geo = new THREE.SphereGeometry(1, 7, 5);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(this.rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const puff = new THREE.Mesh(geo, cloudMat);
        puff.position.set((p - puffs / 2) * 1.45 + this.rng() * 0.5, this.rng() * 0.7, this.rng() * 1.2);
        puff.scale.set(1.4 + this.rng() * 1.5, 0.8 + this.rng() * 0.8, 1.1 + this.rng());
        g.add(puff);
      }
      const a = this.rng() * TAU;
      const r = 55 + this.rng() * 70;
      g.position.set(Math.cos(a) * r, 28 + this.rng() * 22, Math.sin(a) * r);
      g.scale.setScalar(2.2 + this.rng() * 2.4);
      g.userData.speed = 0.35 + this.rng() * 0.5;
      this.scene.add(g);
      this.clouds.push(g);
    }
  }

  createBirds() {
    const mat = new THREE.MeshBasicMaterial({ color: '#57506a', side: THREE.DoubleSide, fog: false });
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.75, 0.08, 0.15, 0.15, -0.02, 0.28], 3));
    wingGeo.computeVertexNormals();
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const left = new THREE.Mesh(wingGeo, mat);
      const right = new THREE.Mesh(wingGeo, mat);
      right.scale.x = -1;
      g.add(left, right);
      g.scale.setScalar(1.5);
      g.userData = {
        radius: 22 + this.rng() * 20,
        height: 17 + this.rng() * 12,
        speed: 0.045 + this.rng() * 0.05,
        phase: this.rng() * TAU,
        left, right,
      };
      this.scene.add(g);
      this.birds.push(g);
    }
  }

  /* ---------------- update ---------------- */
  update(dt, time) {
    this.time = time;
    // fountain water
    if (this.fountainParticles) {
      const p = this.fountainParticles;
      for (let i = 0; i < p.count; i++) {
        const ix = i * 3;
        p.positions[ix] += p.vel[i].x * dt;
        p.positions[ix + 1] += p.vel[i].y * dt;
        p.positions[ix + 2] += p.vel[i].z * dt;
        p.vel[i].y -= 3.6 * dt;
        if (p.positions[ix + 1] < 0.72) {
          p.positions[ix] = 0; p.positions[ix + 1] = 2.75; p.positions[ix + 2] = 0;
          const a = Math.random() * TAU, sp = 0.35 + Math.random() * 0.9;
          p.vel[i].x = Math.cos(a) * sp * 0.35;
          p.vel[i].y = 1.2 + Math.random() * 1.1;
          p.vel[i].z = Math.sin(a) * sp * 0.35;
        }
      }
      p.points.geometry.attributes.position.needsUpdate = true;
    }
    if (this.fountainWater) this.fountainWater.rotation.y += dt * 0.07;

    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 135) cloud.position.x = -135;
    }

    for (const bird of this.birds) {
      const u = bird.userData;
      u.phase += dt * u.speed;
      bird.position.set(Math.cos(u.phase) * u.radius, u.height + Math.sin(u.phase * 3) * 0.5, Math.sin(u.phase) * u.radius);
      bird.rotation.y = -u.phase + Math.PI / 2;
      const flap = Math.sin(time * 7 + u.phase * 6) * 0.55;
      u.left.rotation.z = flap;
      u.right.rotation.z = -flap;
    }
  }

  collides(x, z, radius) {
    // fountain
    if (Math.hypot(x, z) < 3.55 + radius) return true;
    // entrance posts
    if (Math.hypot(x + 3.6, z - 38.5) < 0.42 + radius) return true;
    if (Math.hypot(x - 3.6, z - 38.5) < 0.42 + radius) return true;
    return false;
  }
}
