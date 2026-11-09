import * as THREE from '../vendor/three.module.js';
import { SURFACE, WORLD_X, WORLD_Z } from './world.js';
import { makeCanvasTexture, makeSignTexture } from './textures.js';

const CENTER = WORLD_X / 2;
const TOP = SURFACE + 1;

function mat(color, roughness = 0.85, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(w, h, d, material, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

function radialTexture(inner, outer) {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, inner);
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export class Environment {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.time = 0;
    this.interactables = [];
    this.clouds = [];
    this.coreGlow = null;
    this.holo = null;
    this.dust = null;
    this.dustMat = null;

    this._lights();
    this._sky();
    this._ground();
    this._hills();
    this._fence();
    this._trees();
    this._shed();
    this._machines();
    this._props();
    this._grassAndFlowers();
    this._coreGlow();
    this._dust();

    this.skyFog = new THREE.Color(0xc7dfea);
    this.caveFog = new THREE.Color(0x07070c);
    scene.fog = new THREE.Fog(0xc7dfea, 65, 260);
    scene.background = new THREE.Color(0xc7dfea);
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xbfe4ff, 0x6d5636, 1.18);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1d0, 2.3);
    this.sun.position.set(CENTER + 48, TOP + 72, CENTER + 34);
    this.sun.target.position.set(CENTER, TOP, CENTER);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -46;
    this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46;
    this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 180;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.fill = new THREE.DirectionalLight(0xffd9a8, 0.35);
    this.fill.position.set(CENTER - 30, TOP + 20, CENTER - 40);
    this.scene.add(this.fill);

    // gentle warm bounce light that fades in underground
    this.caveFill = new THREE.AmbientLight(0xa88f6e, 0);
    this.scene.add(this.caveFill);
  }

  _sky() {
    const geo = new THREE.SphereGeometry(460, 32, 20);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#5fa8dc') },
        mid: { value: new THREE.Color('#a9d6ee') },
        horizon: { value: new THREE.Color('#ffe0b0') },
        sunDir: { value: new THREE.Vector3(0.42, 0.66, 0.32).normalize() },
        sunColor: { value: new THREE.Color('#fff2c4') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vDir;
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -1.0, 1.0);
          vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
          col = mix(col, top, smoothstep(0.18, 0.72, h));
          float sd = max(dot(d, sunDir), 0.0);
          col += sunColor * pow(sd, 320.0) * 1.4;
          col += sunColor * pow(sd, 12.0) * 0.10;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMesh = new THREE.Mesh(geo, material);
    this.skyMesh.renderOrder = -10;
    this.skyMesh.frustumCulled = false;
    this.scene.add(this.skyMesh);

    const sunTex = radialTexture('rgba(255,248,214,1)', 'rgba(255,220,140,0)');
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sunSprite.position.set(0.42, 0.66, 0.32).normalize().multiplyScalar(430);
    sunSprite.scale.set(90, 90, 1);
    this.scene.add(sunSprite);

    // clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0, transparent: true, opacity: 0.88, fog: false, depthWrite: false });
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const n = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + Math.random() * 4, 0), cloudMat);
        puff.position.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 9);
        puff.scale.y = 0.48;
        g.add(puff);
      }
      g.position.set(CENTER + (Math.random() - 0.5) * 300, TOP + 38 + Math.random() * 34, CENTER + (Math.random() - 0.5) * 300);
      g.userData.speed = 0.6 + Math.random() * 0.9;
      this.clouds.push(g);
      this.scene.add(g);
    }
  }

  _ground() {
    const grassTex = makeCanvasTexture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#5e9038';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1900; i++) {
        ctx.fillStyle = ['#568631', '#689a3f', '#4f7e2e', '#63943b'][(Math.random() * 4) | 0];
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    });
    grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
    grassTex.repeat.set(90, 90);
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(430, 64),
      new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff })
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(CENTER, TOP - 0.08, CENTER);
    g.receiveShadow = true;
    this.scene.add(g);
    this.groundPlane = g;
  }

  _hills() {
    const colors = [0x5f8d3e, 0x6c9a46, 0x547f37, 0x7aa353, 0x4e7a34];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
      const r = 75 + Math.random() * 95;
      const s = 16 + Math.random() * 26;
      const hill = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshLambertMaterial({ color: colors[i % colors.length], flatShading: true })
      );
      hill.position.set(CENTER + Math.cos(a) * r, TOP - 5 - Math.random() * 4, CENTER + Math.sin(a) * r);
      hill.scale.set(s, s * (0.32 + Math.random() * 0.24), s);
      hill.rotation.y = Math.random() * Math.PI;
      hill.receiveShadow = true;
      this.scene.add(hill);
    }
  }

  _fence() {
    const wood = mat(0x6b4a2c, 0.9);
    const woodDark = mat(0x563a22, 0.9);
    const half = 24;
    const step = 2.4;
    const posts = [];
    const rails = [];
    const addPost = (x, z) => posts.push({ x, z });
    for (let x = CENTER - half; x <= CENTER + half + 0.01; x += step) {
      addPost(x, CENTER - half);
      addPost(x, CENTER + half);
    }
    for (let z = CENTER - half + step; z <= CENTER + half - step + 0.01; z += step) {
      addPost(CENTER - half, z);
      addPost(CENTER + half, z);
    }
    // gate gap on the south fence (z = CENTER + half)
    const gateMin = CENTER - 2.5, gateMax = CENTER + 2.5;

    const postGeo = new THREE.BoxGeometry(0.22, 1.35, 0.22);
    const postMesh = new THREE.InstancedMesh(postGeo, wood, posts.length);
    const dummy = new THREE.Object3D();
    let pi = 0;
    for (const p of posts) {
      if (p.z === CENTER + half && p.x > gateMin && p.x < gateMax) continue;
      const y = this.world.topAt(p.x, p.z);
      dummy.position.set(p.x, y + 0.55, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      postMesh.setMatrixAt(pi++, dummy.matrix);
    }
    postMesh.count = pi;
    postMesh.castShadow = true;
    postMesh.receiveShadow = true;
    this.scene.add(postMesh);

    const railGeo = new THREE.BoxGeometry(step, 0.13, 0.09);
    const railMesh = new THREE.InstancedMesh(railGeo, woodDark, 220);
    let ri = 0;
    const addRail = (x, z, rotY, h) => {
      const y = this.world.topAt(x, z);
      dummy.position.set(x, y + h, z);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      railMesh.setMatrixAt(ri++, dummy.matrix);
    };
    for (let x = CENTER - half + step / 2; x < CENTER + half; x += step) {
      addRail(x, CENTER - half, 0, 0.45);
      addRail(x, CENTER - half, 0, 1.02);
      if (!(x + step / 2 > gateMin && x - step / 2 < gateMax)) {
        addRail(x, CENTER + half, 0, 0.45);
        addRail(x, CENTER + half, 0, 1.02);
      }
    }
    for (let z = CENTER - half + step / 2; z < CENTER + half; z += step) {
      addRail(CENTER - half, z, Math.PI / 2, 0.45);
      addRail(CENTER - half, z, Math.PI / 2, 1.02);
      addRail(CENTER + half, z, Math.PI / 2, 0.45);
      addRail(CENTER + half, z, Math.PI / 2, 1.02);
    }
    railMesh.count = ri;
    railMesh.castShadow = true;
    railMesh.receiveShadow = true;
    this.scene.add(railMesh);

    // gate posts and a little arch
    for (const x of [gateMin, gateMax]) {
      const y = this.world.topAt(x, CENTER + half);
      const post = box(0.3, 2.1, 0.3, wood, x, y + 0.9, CENTER + half);
      this.scene.add(post);
    }
    const arch = box(gateMax - gateMin + 0.6, 0.22, 0.22, woodDark, CENTER, this.world.topAt(CENTER, CENTER + half) + 1.95, CENTER + half);
    this.scene.add(arch);
  }

  _trees() {
    const spots = [[14, 14, 1.1], [50, 14, 0.9], [14, 50, 1.0], [50, 50, 1.15], [58, 30, 0.85], [32, 60, 0.8]];
    const trunkMat = mat(0x6a4527, 0.95);
    const leafMats = [mat(0x4f8a36, 0.9), mat(0x5b9940, 0.9), mat(0x457a2f, 0.9), mat(0x6aa84a, 0.9)];
    for (const [x, z, s] of spots) {
      const y = this.world.topAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.32 * s, 3.1 * s, 7), trunkMat);
      trunk.position.y = 1.55 * s;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      g.add(trunk);
      const n = 3;
      for (let i = 0; i < n; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry((1.3 + Math.random() * 0.5) * s, 0), leafMats[(Math.random() * leafMats.length) | 0]);
        leaf.position.set((Math.random() - 0.5) * 1.4 * s, (2.9 + Math.random() * 1.2) * s, (Math.random() - 0.5) * 1.4 * s);
        leaf.scale.y = 0.82;
        leaf.rotation.set(Math.random(), Math.random(), Math.random());
        leaf.castShadow = true;
        leaf.receiveShadow = true;
        g.add(leaf);
      }
      this.scene.add(g);
    }

    // bushes
    const bushMat = mat(0x4c7f33, 0.95);
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 10 + Math.random() * 13;
      const x = CENTER + Math.cos(a) * r;
      const z = CENTER + Math.sin(a) * r;
      if (Math.abs(x - CENTER) < 5 && Math.abs(z - CENTER) < 5) continue;
      const y = this.world.topAt(x, z);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + Math.random() * 0.55, 0), bushMat);
      bush.position.set(x, y + 0.3, z);
      bush.scale.y = 0.7;
      bush.castShadow = true;
      bush.receiveShadow = true;
      this.scene.add(bush);
    }
  }

  _shed() {
    const x = 18, z = 49;
    const y = this.world.topAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const wall = mat(0xcbb18a, 0.92);
    const trim = mat(0x5c3c23, 0.9);
    const roof = mat(0x7a3f2a, 0.88);
    const body = box(6.2, 3.1, 4.6, wall, 0, 1.55, 0);
    g.add(body);
    // roof
    const r1 = box(6.7, 0.24, 2.8, roof, 0, 3.55, -1.2);
    r1.rotation.x = 0.42;
    const r2 = box(6.7, 0.24, 2.8, roof, 0, 3.55, 1.2);
    r2.rotation.x = -0.42;
    g.add(r1, r2);
    const ridge = box(6.75, 0.18, 0.24, trim, 0, 4.1, 0);
    g.add(ridge);
    // door
    const door = box(1.2, 2.15, 0.08, trim, -0.9, 1.1, -2.33);
    g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(0xd9b64b, 0.3, 0.8));
    knob.position.set(-0.42, 1.05, -2.39);
    g.add(knob);
    // window
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: 0xffdf9e }));
    win.position.set(1.1, 1.75, -2.33);
    win.rotation.y = Math.PI;
    g.add(win);
    const winFrame = box(1.4, 1.1, 0.09, trim, 1.1, 1.75, -2.32);
    g.add(winFrame);
    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.88), new THREE.MeshBasicMaterial({ color: 0xffe3a8 }));
    winGlass.position.set(1.1, 1.75, -2.38);
    winGlass.rotation.y = Math.PI;
    g.add(winGlass);
    // sign
    const signTex = makeSignTexture('HOLE CO.', 'EST. 2026 · DIG DEEP', { bg: '#2b2118', fg: '#f7ecd4', accent: '#ffb938' });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: signTex }));
    sign.position.set(0, 2.85, -2.36);
    sign.rotation.y = Math.PI;
    g.add(sign);
    // porch step
    g.add(box(2.2, 0.18, 0.9, trim, -0.9, 0.09, -2.9));
    this.scene.add(g);
    this.shed = g;
  }

  _machines() {
    // ---- ORE-O-MATIC ----
    const mx = 39.0, mz = 36.5;
    const my = this.world.topAt(mx, mz);
    const g = new THREE.Group();
    g.position.set(mx, my, mz);
    g.rotation.y = -Math.PI / 2;
    const metal = mat(0x394644, 0.5, 0.45);
    const dark = mat(0x1e2726, 0.55, 0.5);
    const trim = mat(0xd18a32, 0.45, 0.55);
    g.add(box(1.5, 0.25, 1.2, dark, 0, 0.12, 0));
    g.add(box(1.35, 2.1, 1.05, metal, 0, 1.2, 0));
    g.add(box(1.5, 0.16, 1.2, trim, 0, 2.32, 0));
    // hopper
    const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.32, 0.55, 4), trim);
    hopper.position.set(0, 2.62, 0);
    hopper.rotation.y = Math.PI / 4;
    g.add(hopper);
    g.add(box(0.14, 0.55, 0.14, dark, 0.45, 2.55, 0.25));
    // screen
    const screenTex = makeCanvasTexture(256, 192, (ctx, w, h) => {
      ctx.fillStyle = '#08170f';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#2d6b47';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#8dffb0';
      ctx.font = '700 22px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ORE-O-MATIC', w / 2, 58);
      ctx.font = '700 76px Silkscreen, monospace';
      ctx.fillStyle = '#c8ffd8';
      ctx.fillText('$', w / 2, 136);
      ctx.font = '600 18px Outfit, sans-serif';
      ctx.fillStyle = '#69d68d';
      ctx.fillText('SELL · UPGRADE · REPEAT', w / 2, 170);
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#123d27' : '#0c2a1b';
        ctx.fillRect(14 + i * 28, 14, 16, 10);
      }
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.8), new THREE.MeshBasicMaterial({ map: screenTex }));
    screen.position.set(0, 1.55, 0.531);
    g.add(screen);
    const screenGlow = new THREE.PointLight(0x7dffa8, 2.4, 5, 1.6);
    screenGlow.position.set(0, 1.5, 1.1);
    g.add(screenGlow);
    // chute
    g.add(box(0.9, 0.12, 0.5, dark, 0, 0.85, 0.62));
    // side stripes
    for (const s of [-1, 1]) {
      const stripe = box(0.06, 1.5, 0.1, trim, s * 0.69, 1.2, 0.5);
      g.add(stripe);
    }
    this.scene.add(g);
    this.sellMachine = g;
    this.interactables.push({ id: 'sell', label: 'Open the Ore-O-Matic', position: new THREE.Vector3(mx - 1.8, my + 1, mz), radius: 4.2 });

    // ---- WORKBENCH ----
    const bx = 25.0, bz = 36.5;
    const by = this.world.topAt(bx, bz);
    const b = new THREE.Group();
    b.position.set(bx, by, bz);
    b.rotation.y = Math.PI / 2;
    const wood = mat(0x7c5530, 0.9);
    const steel = mat(0x8c99a3, 0.4, 0.7);
    b.add(box(1.9, 0.16, 0.95, wood, 0, 1.02, 0));
    for (const sx of [-0.8, 0.8]) {
      for (const sz of [-0.35, 0.35]) {
        b.add(box(0.12, 1.0, 0.12, wood, sx, 0.5, sz));
      }
    }
    b.add(box(0.8, 0.34, 0.42, steel, 0, 1.27, 0));
    b.add(box(0.5, 0.2, 0.3, mat(0x3b4348, 0.5, 0.6), 0, 1.52, 0));
    // floating hologram
    const holoTex = makeCanvasTexture(320, 200, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(5,30,38,0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#6fe9ff';
      ctx.lineWidth = 5;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#a9f7ff';
      ctx.font = '700 44px Silkscreen, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('UPGRADES', w / 2, 82);
      ctx.fillStyle = '#6fe9ff';
      ctx.font = '600 22px Outfit, sans-serif';
      ctx.fillText('DRILL · PACK · BOOTS · LAMP', w / 2, 126);
      ctx.fillStyle = '#3bb8cf';
      ctx.fillRect(40, 154, w - 80, 8);
      ctx.fillStyle = '#8df3ff';
      ctx.fillRect(40, 154, 130, 8);
    });
    this.holo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.holo.position.set(0, 2.1, 0);
    b.add(this.holo);
    const holoLight = new THREE.PointLight(0x6fe9ff, 2.2, 4.5, 1.6);
    holoLight.position.set(0, 2.1, 0.2);
    b.add(holoLight);
    const stand = box(0.08, 0.5, 0.08, steel, 0, 1.68, 0);
    b.add(stand);
    this.scene.add(b);
    this.workbench = b;
    this.interactables.push({ id: 'upgrade', label: 'Use the Upgrade Bench', position: new THREE.Vector3(bx + 1.9, by + 1, bz), radius: 4.0 });
  }

  _props() {
    // DIG HERE sign
    const sx = 35.4, sz = 33.2;
    const sy = this.world.topAt(sx, sz);
    const g = new THREE.Group();
    g.position.set(sx, sy, sz);
    g.rotation.y = -0.55;
    const post = box(0.14, 1.5, 0.14, mat(0x6b4a2c, 0.9), 0, 0.75, 0);
    g.add(post);
    const tex = makeSignTexture('DIG HERE', '▼ THE HOLE IS BELOW ▼', { bg: '#2b2118', fg: '#ffe6b0', accent: '#ffb938' });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.95), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    board.position.set(0, 1.45, 0);
    g.add(board);
    this.scene.add(g);

    // little marker flag over the starter pit
    const marker = new THREE.Group();
    const fx = 33.7, fz = 30.7;
    marker.position.set(fx, this.world.topAt(fx, fz), fz);
    marker.add(box(0.09, 2.0, 0.09, mat(0x6b4a2c, 0.9), 0, 1.0, 0));
    const xTex = makeSignTexture('X', 'DIG', { bg: '#ffb938', fg: '#2b2118', accent: '#2b2118' });
    const xBoard = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.72), new THREE.MeshBasicMaterial({ map: xTex, side: THREE.DoubleSide }));
    xBoard.position.set(0, 2.1, 0);
    marker.add(xBoard);
    this.scene.add(marker);

    // shovel stuck in the ground
    const shovel = new THREE.Group();
    const shovelX = 34.2, shovelZ = 31.2;
    shovel.position.set(shovelX, this.world.topAt(shovelX, shovelZ), shovelZ);
    const handle = box(0.07, 1.5, 0.07, mat(0x8b5a2b, 0.9), 0, 0.6, 0);
    handle.rotation.z = 0.24;
    const blade = box(0.34, 0.42, 0.06, mat(0xa8b2bc, 0.35, 0.7), -0.18, -0.12, 0);
    blade.rotation.z = 0.24;
    shovel.add(handle, blade);
    shovel.rotation.y = 0.5;
    this.scene.add(shovel);

    // path stones
    const stoneMat = mat(0x9b978c, 0.95);
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const px = 33.4 + t * 4.9;
      const pz = 40.9 - t * 3.3 + Math.sin(t * 6) * 0.32;
      const py = this.world.topAt(px, pz);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.24 + Math.random() * 0.07, 0.27, 0.07, 7), stoneMat);
      st.position.set(px, py + 0.02, pz);
      st.rotation.y = Math.random() * Math.PI;
      st.receiveShadow = true;
      this.scene.add(st);
    }

    // mailbox
    const mb = new THREE.Group();
    const mbx = 33.8, mbz = 52.5;
    mb.position.set(mbx, this.world.topAt(mbx, mbz), mbz);
    const post2 = box(0.12, 1.2, 0.12, mat(0x6b4a2c, 0.9), 0, 0.6, 0);
    const mbox = box(0.5, 0.35, 0.7, mat(0x2f6d8c, 0.6, 0.3), 0, 1.28, 0);
    const flag = box(0.05, 0.3, 0.2, mat(0xd94b3a, 0.7), 0.3, 1.45, 0.1);
    mb.add(post2, mbox, flag);
    this.scene.add(mb);

    // wheelbarrow near shed
    const wb = new THREE.Group();
    const wbx = 22.5, wbz = 47;
    wb.position.set(wbx, this.world.topAt(wbx, wbz), wbz);
    wb.rotation.y = 0.6;
    wb.add(box(0.9, 0.45, 0.6, mat(0x4f6f8a, 0.7, 0.3), 0, 0.55, 0));
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), mat(0x2b2b2b, 0.9));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.3, 0.42);
    wb.add(wheel);
    wb.add(box(0.08, 0.08, 1.0, mat(0x6b4a2c, 0.9), 0, 0.42, -0.5));
    this.scene.add(wb);

    // a few boulders
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 17 + Math.random() * 6;
      const px = CENTER + Math.cos(a) * r;
      const pz = CENTER + Math.sin(a) * r;
      if (px > 36 && px < 44 && pz > 32 && pz < 42) continue;
      const py = this.world.topAt(px, pz);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.55, 0), mat(0x8b8b86, 0.95));
      rock.position.set(px, py + 0.2, pz);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
    }

    // lawn chair
    const chair = new THREE.Group();
    chair.position.set(45.5, this.world.topAt(45.5, 45.5), 45.5);
    chair.rotation.y = -2.2;
    const chairMat = mat(0xd06a3b, 0.8);
    chair.add(box(0.75, 0.1, 0.7, chairMat, 0, 0.42, 0));
    const back = box(0.75, 0.8, 0.1, chairMat, 0, 0.8, 0.33);
    back.rotation.x = -0.25;
    chair.add(back);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.3, 0.3]) chair.add(box(0.08, 0.42, 0.08, mat(0x4a4a4a, 0.8), sx, 0.2, sz));
    this.scene.add(chair);
  }

  _grassAndFlowers() {
    const tuftGeo = new THREE.ConeGeometry(0.055, 0.36, 3);
    const tuftMat = new THREE.MeshLambertMaterial({ color: 0x5c9238 });
    const count = 420;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, count);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 15.5;
      const x = CENTER + Math.cos(a) * r;
      const z = CENTER + Math.sin(a) * r;
      if (Math.hypot(x - 32.5, z - 32.5) < 4.5) continue;
      if (x > 36 && x < 44 && z > 31 && z < 42) continue;
      const y = this.world.topAt(x, z);
      dummy.position.set(x, y + 0.15, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(0.7 + Math.random() * 0.9);
      dummy.updateMatrix();
      tufts.setMatrixAt(n++, dummy.matrix);
    }
    tufts.count = n;
    tufts.receiveShadow = true;
    this.scene.add(tufts);

    const headGeo = new THREE.IcosahedronGeometry(0.05, 0);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const flowers = new THREE.InstancedMesh(headGeo, headMat, 120);
    const colors = [0xffe27a, 0xf7f2e2, 0xff9bb3, 0xb28dff, 0xffb46b];
    const c = new THREE.Color();
    let f = 0;
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 15;
      const x = CENTER + Math.cos(a) * r;
      const z = CENTER + Math.sin(a) * r;
      if (Math.hypot(x - 32.5, z - 32.5) < 5) continue;
      if (x > 36 && x < 44 && z > 31 && z < 42) continue;
      const y = this.world.topAt(x, z);
      dummy.position.set(x, y + 0.16, z);
      dummy.rotation.set(0, Math.random() * 3, 0);
      dummy.scale.setScalar(0.8 + Math.random() * 0.6);
      dummy.updateMatrix();
      flowers.setMatrixAt(f, dummy.matrix);
      flowers.setColorAt(f, c.setHex(colors[(Math.random() * colors.length) | 0]));
      f++;
    }
    flowers.count = f;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    this.scene.add(flowers);
  }

  _coreGlow() {
    const pos = this.world.corePos;
    this.coreLight = new THREE.PointLight(0xffa32e, 30, 22, 1.25);
    this.coreLight.position.copy(pos);
    this.scene.add(this.coreLight);

    const tex = radialTexture('rgba(255,210,120,1)', 'rgba(255,120,20,0)');
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.copy(pos);
    sprite.scale.set(6, 6, 1);
    this.scene.add(sprite);
    this.coreGlow = sprite;
  }

  _dust() {
    const count = 260;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 26;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustMat = new THREE.PointsMaterial({ color: 0xffe6bc, size: 0.045, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  update(dt, playerPos, depth) {
    this.time += dt;
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > CENTER + 170) c.position.x = CENTER - 170;
    }
    if (this.holo) {
      this.holo.position.y = 2.1 + Math.sin(this.time * 1.6) * 0.06;
      this.holo.rotation.y = Math.sin(this.time * 0.7) * 0.16;
    }
    if (this.coreGlow) {
      const s = 5.4 + Math.sin(this.time * 2.2) * 0.8;
      this.coreGlow.scale.set(s, s, 1);
      if (this.coreLight) this.coreLight.intensity = 26 + Math.sin(this.time * 2.2) * 6;
    }
    const t = Math.max(0, Math.min(1, (depth - 1) / 5));
    const fogT = t * t * (3 - 2 * t);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.skyFog).lerp(this.caveFog, fogT);
      this.scene.fog.near = 65 - fogT * 55;
      this.scene.fog.far = 260 - fogT * 205;
    }
    this.scene.background.copy(this.skyFog).lerp(this.caveFog, fogT);
    this.hemi.intensity = 1.18 - fogT * 0.95;
    this.sun.intensity = 2.3 - fogT * 2.2;
    if (this.caveFill) this.caveFill.intensity = fogT * 1.05;

    if (this.dust) {
      this.dust.position.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
      this.dust.rotation.y += dt * 0.04;
      this.dustMat.opacity = Math.max(0, Math.min(0.5, (depth - 3) / 12)) * 0.55;
    }
  }
}
