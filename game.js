(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') {
  $('menu').innerHTML = '<h1>Three.js not found</h1><p>Check your connection, or put three.min.js (r149) in the lib/ folder.</p>';
  return;
}
// ---------- tuning (units are roughly metres) ----------
const HW = 80, HL = 104, GW = 15, GH = 10.5, GD = 14, CEIL = 44, CH = 14, BR = 2.4;
const G_CAR = 28, G_BALL = 17, MATCH = 180, BLUE = 0x2fb8ff, ORANGE = 0xff8a1f;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let pitchMesh = null, skyMesh = null;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Car model presets (visuals + physical tweaks)
const CAR_MODELS = [
  { name: 'octane', len: 3.4, width: 2.0, height: 0.6, wheelR: 0.45, mass: 1.0, hit: 1.7, cap: 1.0 },
  { name: 'dominus', len: 3.8, width: 2.05, height: 0.5, wheelR: 0.42, mass: 1.05, hit: 1.9, cap: 0.95 },
  { name: 'breakout', len: 3.6, width: 1.9, height: 0.45, wheelR: 0.42, mass: 0.95, hit: 1.6, cap: 1.05 },
  { name: 'vortex', len: 3.55, width: 2.05, height: 0.48, wheelR: 0.43, mass: 1.0, hit: 1.75, cap: 1.04 },
  { name: 'striker', len: 3.25, width: 1.88, height: 0.52, wheelR: 0.4, mass: 0.92, hit: 1.62, cap: 1.1 },
  { name: 'raptor', len: 3.7, width: 2.15, height: 0.68, wheelR: 0.48, mass: 1.08, hit: 1.85, cap: 0.96 },
  { name: 'hyperion', len: 3.9, width: 2.02, height: 0.46, wheelR: 0.41, mass: 1.02, hit: 1.88, cap: 1.02 }
];

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1a38);
scene.fog = new THREE.Fog(0x3a2342, 220, 900);
const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 2000);
const camera2 = new THREE.PerspectiveCamera(72, 1, 0.5, 2000);
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  const split = !!($('localTwo') && $('localTwo').checked);
  const viewWidth = split ? Math.max(1, Math.floor(innerWidth / 2)) : innerWidth;
  camera.aspect = viewWidth / innerHeight; camera.updateProjectionMatrix();
  camera2.aspect = viewWidth / innerHeight; camera2.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xffe2c4, 0x2a3a5a, 1.05));
const fill = new THREE.DirectionalLight(0x9db8ff, 0.5); fill.position.set(-40, 50, -60); scene.add(fill);
const sun = new THREE.DirectionalLight(0xffe0c0, 1.0);
sun.position.set(30, 70, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 240 });
scene.add(sun); scene.add(sun.target);

function buildArena() {
  const S = 8, TW = 2 * HW * S, TH = 2 * HL * S, T = 10 * S, cvs = document.createElement('canvas'); cvs.width = TW; cvs.height = TH;
  const g = cvs.getContext('2d');
  for (let i = 0; i * T < TW; i++) for (let j = 0; j * T < TH; j++) { g.fillStyle = (i + j) % 2 ? '#2c6a2b' : '#33782f'; g.fillRect(i * T, j * T, T, T); }
  const paint = (y0, y1, col) => {
    g.save(); g.beginPath(); g.rect(0, y0, TW, y1 - y0); g.clip(); g.fillStyle = col;
    for (let x = -TH; x < TW + TH; x += 16 * S) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + 7 * S, y0); g.lineTo(x + 7 * S - (y1 - y0), y1); g.lineTo(x - (y1 - y0), y1); g.fill(); }
    g.restore();
  };
  paint(0, TH * 0.3, 'rgba(40,120,255,.6)'); paint(TH * 0.7, TH, 'rgba(255,125,30,.55)');
  g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 5; g.strokeRect(3, 3, TW - 6, TH - 6);
  const bw = (GW + 10) * S * 2, bd = 18 * S;
  g.strokeRect((TW - bw) / 2, 3, bw, bd); g.strokeRect((TW - bw) / 2, TH - 3 - bd, bw, bd);
  g.beginPath(); g.moveTo(0, TH / 2); g.lineTo(TW, TH / 2); g.stroke();
  g.beginPath(); g.arc(TW / 2, TH / 2, 14 * S, 0, 7); g.stroke();
  const tex = new THREE.CanvasTexture(cvs); tex.anisotropy = 8;
  pitchMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, 2 * HL), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  pitchMesh.rotation.x = -Math.PI / 2; pitchMesh.receiveShadow = true; scene.add(pitchMesh);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: 0x1a1620 }));
  out.rotation.x = -Math.PI / 2; out.position.y = -0.1; scene.add(out);

  const BH = 8;
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false });
  const dim = { [BLUE]: new THREE.MeshBasicMaterial({ color: 0x103a7a, side: THREE.DoubleSide }), [ORANGE]: new THREE.MeshBasicMaterial({ color: 0x7a3a0c, side: THREE.DoubleSide }) };
  const bright = { [BLUE]: new THREE.MeshBasicMaterial({ color: BLUE }), [ORANGE]: new THREE.MeshBasicMaterial({ color: ORANGE }) };
  const plane = (w, h, x, y, z, ry, m) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); };
  const wall = (w, x, z, ry, col) => {
    plane(w, BH, x, BH / 2, z, ry, dim[col]); plane(w, CEIL - BH, x, BH + (CEIL - BH) / 2, z, ry, glass);
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.7), bright[col]); o.position.set(x, BH, z); o.rotation.y = ry; scene.add(o);
  };
  const cw = CH * 1.4142;
  for (const sz of [-1, 1]) {
    const col = sz < 0 ? BLUE : ORANGE;
    for (const sx of [-1, 1]) {
      wall(HL - CH, sx * HW, sz * (HL - CH) / 2, Math.PI / 2, col);                       // side walls
      wall(HW - CH - GW, sx * (GW + HW - CH) / 2, sz * HL, 0, col);                        // end walls beside the goal
      wall(cw, sx * (HW - CH / 2), sz * (HL - CH / 2), sx * sz > 0 ? Math.PI / 4 : -Math.PI / 4, col); // rounded corners
    }
    plane(2 * GW, CEIL - GH, 0, GH + (CEIL - GH) / 2, sz * HL, 0, glass);
    const mat = bright[col];
    const post = (x, y, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.9), mat); m.position.set(x, y, sz * HL); scene.add(m); };
    post(-GW, GH / 2, 0.9, GH); post(GW, GH / 2, 0.9, GH); post(0, GH, 2 * GW + 0.9, 0.9);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2 * GW, GH, GD, 12, 5, 5), new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.3 }));
    net.position.set(0, GH / 2, sz * (HL + GD / 2)); scene.add(net);
    const pl = new THREE.PointLight(col, 1.2, 60); pl.position.set(0, 6, sz * (HL - 5)); scene.add(pl);
  }
  const oct = [[HW - CH, HL], [HW, HL - CH], [HW, -(HL - CH)], [HW - CH, -HL], [-(HW - CH), -HL], [-HW, -(HL - CH)], [-HW, HL - CH], [-(HW - CH), HL]];
  const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(oct.map(p => new THREE.Vector3(p[0], CEIL, p[1]))), new THREE.LineBasicMaterial({ color: 0x37f2c0, transparent: true, opacity: 0.6 }));
  scene.add(loop);
}
buildArena();
function buildStadium() {
  const sc = document.createElement('canvas'); sc.width = 8; sc.height = 256; const sg = sc.getContext('2d');
  const gr = sg.createLinearGradient(0, 0, 0, 128);
  [[0, '#070b24'], [0.45, '#2a2160'], [0.7, '#a14a68'], [0.88, '#ff7c3c'], [1, '#ffc27a']].forEach(([o, c]) => gr.addColorStop(o, c));
  sg.fillStyle = gr; sg.fillRect(0, 0, 8, 128); sg.fillStyle = '#2a1a30'; sg.fillRect(0, 128, 8, 128);
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), side: THREE.BackSide, fog: false, depthWrite: false }));
  skyMesh.renderOrder = -1; scene.add(skyMesh);
  const st = new Float32Array(450);
  for (let i = 0; i < 150; i++) { const a = Math.random() * 6.283, e = 0.5 + Math.random() * 0.9, r = 1400;
    st[i * 3] = Math.cos(a) * Math.cos(e) * r; st[i * 3 + 1] = Math.sin(e) * r; st[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const stg = new THREE.BufferGeometry(); stg.setAttribute('position', new THREE.BufferAttribute(st, 3));
  scene.add(new THREE.Points(stg, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));

  // city skyline with lit windows
  const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const wg = wc.getContext('2d');
  wg.fillStyle = '#0b0e1c'; wg.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) if (Math.random() < 0.38) { wg.fillStyle = ['#ffc46b', '#ffe3a1', '#8cb8ff', '#ff9d5c'][(x * 3 + y) % 4]; wg.fillRect(x * 8 + 1, y * 8 + 2, 5, 4); }
  const wtex = new THREE.CanvasTexture(wc); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.magFilter = THREE.NearestFilter;
  for (let i = 0; i < 80; i++) {
    const a = (i / 80) * 6.283 + Math.random() * 0.05, R = 430 + Math.random() * 220, w = 28 + Math.random() * 40, h = 50 + Math.random() * 190 * (0.3 + 0.7 * Math.random());
    const tx = wtex.clone(); tx.needsUpdate = true; tx.repeat.set(Math.max(1, Math.round(w / 14)), Math.max(1, Math.round(h / 22)));
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), new THREE.MeshBasicMaterial({ map: tx }));
    b.position.set(Math.cos(a) * R, h / 2 - 2, Math.sin(a) * R); b.rotation.y = -a; scene.add(b);
  }
  const cm = new THREE.MeshBasicMaterial({ color: 0x16121e }), red = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  for (const [cx, cz, ry] of [[-330, 420, 0.6], [340, -380, 2.4], [60, 480, 1.2]]) {
    const cg = new THREE.Group(), bx = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || cm); o.position.set(x, y, z); cg.add(o); };
    bx(3, 150, 3, 0, 75, 0); bx(110, 3, 3, 25, 150, 0); bx(24, 6, 6, -42, 148, 0); bx(12, 10, 8, -52, 146, 0); bx(5, 5, 5, 0, 156, 0, red); bx(0.8, 50, 0.8, 55, 124, 0);
    cg.position.set(cx, 0, cz); cg.rotation.y = ry; scene.add(cg);
  }

  // crowd stands
  const spots = [];
  for (let r = 0; r < 12; r++) {
    const off = 12 + r * 1.9, y = 3 + r * 1.5;
    for (let z = -HL - 10; z <= HL + 10; z += 2.2) spots.push([-HW - off, y, z], [HW + off, y, z]);
    for (let x = -HW; x <= HW; x += 2.2) spots.push([x, y, -HL - GD - off + 4], [x, y, HL + GD + off - 4]);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), pal = [0x16324a, 0x1d4766, 0x3a2a1c, 0x5a3a1a, 0x24415c, 0x0f2236, 0x2fb8ff, 0xff8a1f];
  spots.forEach((p, i) => { m4.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m4); col.setHex(pal[Math.random() < 0.92 ? (i * 7) % 6 : 6 + (i % 2)]); im.setColorAt(i, col); });
  scene.add(im);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const px = x * (HW + 44), pz = z * (HL + 44);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1.4, 60, 1.4), new THREE.MeshBasicMaterial({ color: 0x10202c })); pole.position.set(px, 30, pz);
    const head = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 1.4), new THREE.MeshBasicMaterial({ color: 0xfff1c8 })); head.position.set(px, 60, pz); head.lookAt(0, 10, 0);
    scene.add(pole, head);
  }
}
buildStadium();
function applyArenaStyle(style) {
  const palettes = {
    sunset: { sky: 0x2a1a38, fog: 0x3a2342, ground: 0xffffff, glow: 0x37f2c0 },
    neon: { sky: 0x07142d, fog: 0x101d3b, ground: 0xb7c7ff, glow: 0x8c4dff },
    ice: { sky: 0x9ac8e6, fog: 0x9ac8e6, ground: 0xd6f4ff, glow: 0x7be8ff },
    desert: { sky: 0x47212c, fog: 0x6b3841, ground: 0xffd0a0, glow: 0xffb34f }
  };
  const p = palettes[style] || palettes.sunset;
  scene.background.setHex(p.sky); scene.fog.color.setHex(p.fog);
  if (skyMesh) skyMesh.material.color.setHex(style === 'ice' ? 0x8ab9d8 : style === 'neon' ? 0x697bff : style === 'desert' ? 0xffa15e : 0xffffff);
  if (pitchMesh) pitchMesh.material.color.setHex(p.ground);
  scene.traverse(o => { if (o.isLineLoop && o.material && o.material.color) o.material.color.setHex(p.glow); });
}
applyArenaStyle('sunset');

// build car mesh for different model types (improved visuals)
function carMesh(col, typeName) {
  const type = CAR_MODELS.find(t => t.name === typeName) || CAR_MODELS[0];
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const body = new THREE.Group();
  root.add(body);

  const paint = new THREE.MeshStandardMaterial({
    color: col, roughness: 0.23, metalness: 0.28,
    emissive: col, emissiveIntensity: 0.06
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x111824, roughness: 0.42, metalness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x83d9ff, roughness: 0.12, metalness: 0.15,
    transparent: true, opacity: 0.88, clearcoat: 1, clearcoatRoughness: 0.08
  });
  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    body.add(mesh);
    return mesh;
  };

  // Each car gets a noticeably different chassis silhouette (front is +Z).
  const chassis = {
    octane:   [0.94, 0.42, 0.82, 0.84, 0.25, 0.32, 0.58, 0.58, 0.40, -0.01],
    dominus:  [0.98, 0.32, 0.90, 0.72, 0.18, 0.25, 0.52, 0.40, 0.30, -0.04],
    breakout: [0.82, 0.27, 0.88, 0.66, 0.15, 0.25, 0.50, 0.34, 0.34, -0.01],
    vortex:   [0.98, 0.30, 0.86, 0.78, 0.18, 0.28, 0.48, 0.42, 0.30, -0.03],
    striker:  [0.86, 0.34, 0.78, 0.68, 0.22, 0.30, 0.56, 0.52, 0.36, 0.00],
    raptor:   [1.00, 0.46, 0.82, 0.82, 0.28, 0.32, 0.64, 0.62, 0.40, -0.02],
    hyperion: [0.94, 0.28, 0.92, 0.66, 0.16, 0.30, 0.42, 0.38, 0.34, -0.02]
  }[type.name] || [0.94, 0.42, 0.82, 0.84, 0.25, 0.32, 0.58, 0.58, 0.40, -0.01];
  add(new THREE.BoxGeometry(type.width * chassis[0], type.height * chassis[1], type.len * chassis[2]),
      paint, 0, 0.02, 0);
  add(new THREE.BoxGeometry(type.width * chassis[3], type.height * chassis[4], type.len * chassis[5]),
      paint, 0, type.height * 0.16, type.len * 0.27);
  add(new THREE.BoxGeometry(type.width * 0.9, 0.09, type.len * 0.18),
      trim, 0, -0.025, type.len * 0.47);
  add(new THREE.BoxGeometry(type.width * 0.9, 0.08, type.len * 0.18),
      trim, 0, -0.025, -type.len * 0.47);

  // Cabin proportions differ per car so the profiles are easy to tell apart.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(type.width * chassis[6], type.height * chassis[7], type.len * chassis[8]), glass);
  cabin.position.set(0, type.height * (type.name === 'raptor' ? 0.54 : 0.47), type.len * chassis[9]);
  cabin.castShadow = true;
  body.add(cabin);
  add(new THREE.BoxGeometry(type.width * 0.66, 0.07, type.len * 0.16), trim,
      0, type.height * 0.76, -type.len * 0.02);

  // Front lights: warm white headlamps. Rear lights: slim red strips.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff5ce, emissive: 0xffdd91, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff3434, emissive: 0xff1010, emissiveIntensity: 0.8 });
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(type.width * 0.23, 0.075, 0.045), headMat,
        sx * type.width * 0.29, 0.045, type.len * 0.42);
    add(new THREE.BoxGeometry(type.width * 0.21, 0.07, 0.045), tailMat,
        sx * type.width * 0.29, 0.04, -type.len * 0.42);
  }

  // Model-specific styling gives each selection its own silhouette.
  if (type.name === 'octane') {
    add(new THREE.BoxGeometry(type.width * 0.82, 0.16, type.len * 0.17),
        paint, 0, type.height * 0.24, type.len * 0.34);
    add(new THREE.BoxGeometry(type.width * 0.62, 0.09, type.len * 0.13),
        trim, 0, type.height * 0.31, type.len * 0.36);
  } else if (type.name === 'dominus') {
    add(new THREE.BoxGeometry(type.width * 0.94, 0.1, type.len * 0.22),
        paint, 0, type.height * 0.28, -type.len * 0.39);
    add(new THREE.BoxGeometry(type.width * 0.78, 0.07, 0.12),
        trim, 0, type.height * 0.48, -type.len * 0.49);
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.06, 0.36, 0.06), trim, sx * type.width * 0.32,
          type.height * 0.43, -type.len * 0.43);
    }
  } else if (type.name === 'breakout') {
    add(new THREE.BoxGeometry(type.width * 0.72, 0.11, type.len * 0.28),
        paint, 0, type.height * 0.34, type.len * 0.34);
    add(new THREE.BoxGeometry(type.width * 0.88, 0.08, type.len * 0.18),
        trim, 0, type.height * 0.28, -type.len * 0.42);
    // Long low nose and a slim rear wing.
    add(new THREE.BoxGeometry(type.width * 0.58, 0.055, type.len * 0.28),
        paint, 0, 0.02, type.len * 0.43);
  } else if (type.name === 'vortex') {
    // Wide electric supercar with sculpted front splitter and rear diffuser.
    add(new THREE.BoxGeometry(type.width * 0.96, 0.08, type.len * 0.2),
        trim, 0, -0.12, type.len * 0.47);
    add(new THREE.BoxGeometry(type.width * 0.78, 0.1, type.len * 0.17),
        paint, 0, type.height * 0.34, -type.len * 0.4);
    add(new THREE.BoxGeometry(type.width * 0.72, 0.08, 0.12),
        trim, 0, type.height * 0.48, -type.len * 0.48);
  } else if (type.name === 'striker') {
    // Compact track coupe with a long bonnet and twin racing stripes.
    add(new THREE.BoxGeometry(type.width * 0.8, 0.12, type.len * 0.3),
        paint, 0, type.height * 0.28, type.len * 0.34);
    for (const sx of [-1, 1]) {
      add(new THREE.BoxGeometry(0.055, 0.018, type.len * 0.58),
          new THREE.MeshStandardMaterial({ color: 0xf5f8ff, metalness: 0.25, roughness: 0.3 }),
          sx * type.width * 0.13, type.height * 0.23, 0);
    }
    add(new THREE.BoxGeometry(type.width * 0.82, 0.08, 0.12),
        trim, 0, type.height * 0.46, -type.len * 0.47);
  } else if (type.name === 'raptor') {
    // Rally-inspired wide-body car with chunky arches and a tall spoiler.
    for (const sx of [-1, 1]) {
      for (const sz of [-type.len * 0.31, type.len * 0.31]) {
        add(new THREE.BoxGeometry(0.16, 0.17, 0.68), trim,
            sx * type.width * 0.48, -0.015, sz);
      }
    }
    add(new THREE.BoxGeometry(type.width * 0.95, 0.12, 0.16),
        trim, 0, type.height * 0.72, -type.len * 0.48);
    add(new THREE.BoxGeometry(0.08, 0.2, 0.08), trim,
        -type.width * 0.3, type.height * 0.56, -type.len * 0.43);
    add(new THREE.BoxGeometry(0.08, 0.2, 0.08), trim,
        type.width * 0.3, type.height * 0.56, -type.len * 0.43);
  } else if (type.name === 'hyperion') {
    // Sleek futuristic hypercar: narrow cabin and angular rear aero.
    add(new THREE.BoxGeometry(type.width * 0.54, type.height * 0.3, type.len * 0.3),
        glass, 0, type.height * 0.58, -type.len * 0.02);
    add(new THREE.BoxGeometry(type.width * 0.98, 0.075, type.len * 0.16),
        paint, 0, -0.08, -type.len * 0.43);
    add(new THREE.BoxGeometry(type.width * 0.86, 0.06, 0.1),
        trim, 0, type.height * 0.47, -type.len * 0.48);
  }

  // Four proper tyres with metallic hubcaps. The wheel cylinders face outwards.
  const wheels = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x080b10, roughness: 0.72, metalness: 0.06 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc3d1df, roughness: 0.22, metalness: 0.85 });
  for (const sx of [-1, 1]) {
    for (const sz of [-type.len * 0.31, type.len * 0.31]) {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(sx * type.width * 0.56, -0.12, sz);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(type.wheelR * 0.78, type.wheelR * 0.78, 0.28, 24), tireMat);
      tire.rotation.z = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(type.wheelR * 0.43, type.wheelR * 0.43, 0.29, 24), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(tire, rim);
      wheelGroup.userData = { side: sx };
      body.add(wheelGroup);
      wheels.push(wheelGroup);
    }
  }

  // Rear boost outlet points behind the car (-Z); the cone only appears when boosting.
  const nozzle = add(new THREE.CylinderGeometry(0.2, 0.26, 0.22, 16), trim, 0, -0.02, -type.len * 0.48, Math.PI / 2);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.8, 16),
    new THREE.MeshBasicMaterial({ color: 0x43dfff, transparent: true, opacity: 0.95 }));
  flame.rotation.x = Math.PI / 2;
  flame.position.set(0, 0, -type.len * 0.77);
  flame.visible = false;
  body.add(flame);

  // Light underglow distinguishes players and bots without obscuring the paint.
  const glow = new THREE.Mesh(new THREE.BoxGeometry(type.width * 0.76, 0.025, type.len * 0.55),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.48 }));
  glow.position.y = -0.28;
  body.add(glow);

  scene.add(root);
  return { root, body, flame, type, wheels };
}
const ballTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#dfe9ef'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#2b3a47';
  for (let i = 0; i < 16; i++) { g.beginPath(); g.arc((i * 83) % 256, 14 + (i * 47) % 100, 15, 0, 7); g.fill(); }
  return new THREE.CanvasTexture(c);
})();
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 24),
  new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.12 }));
ballMesh.castShadow = true; scene.add(ballMesh);

// ---------- state ----------
let state = 'menu', t = 0, score = [0, 0], clock = MATCH, ot = false, cd = 0, ballCam = false, mode = 2, diff = 1, muted = false;
const ball = { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0 };
let cars = [];
// UI and gameplay toggles
let playerName = 'PLAYER';
let player2Name = 'PLAYER 2';
let playerCarModel = 'octane';
let playerPaint = '#2fb8ff';
let player2CarModel = 'dominus';
let player2Paint = '#ff8a1f';
let physicsStyle = 'standard';
let localTwoPlayer = false;
let goalExplosionStyle = 'classic';
let paused = false;
let lastTouch = null;
let previousTouch = null;
let playerStats = [];
let eventCooldown = {};
let replayHistory = [];
let replayFrames = [];
let replayIndex = 0;
let goalScorerText = 'PLAYER';
let replayCameraCarIndex = 0;
const REPLAY_HISTORY_LIMIT = 301;
function saveReplayFrame() {
  replayHistory.push({
    cars: cars.map(c => ({ x:c.x, y:c.y, z:c.z, vx:c.vx, vy:c.vy, vz:c.vz, yaw:c.yaw, pitch:c.pitch, flip:c.flip, fx:c.fx, fz:c.fz, fl:c.fl })),
    ball: { x:ball.x, y:ball.y, z:ball.z, vx:ball.vx, vy:ball.vy, vz:ball.vz }
  });
  if (replayHistory.length > REPLAY_HISTORY_LIMIT) replayHistory.shift();
}
function applyReplayFrame(frame) {
  if (!frame) return;
  frame.cars.forEach((p, i) => {
    const c = cars[i]; if (!c) return;
    Object.assign(c, p);
  });
  Object.assign(ball, frame.ball);
}


const SKILL = [
  { thr: 0.65, boost: false, steer: 2.2, cap: 0.6, wait: 1.5, sloppy: 10, flip: 0, aerial: false, drift: false },
  { thr: 0.85, boost: true, steer: 3, cap: 0.82, wait: 0.8, sloppy: 4, flip: 0.4, aerial: false, drift: false },
  { thr: 1, boost: true, steer: 4, cap: 1, wait: 0.25, sloppy: 1.2, flip: 0.9, aerial: true, drift: true }];
function mkCar(team, k, ai, modelName) {
  const model = modelName || CAR_MODELS[(k) % CAR_MODELS.length].name;
  const col = new THREE.Color(!ai && k === 0 ? (team ? player2Paint : playerPaint) : (team ? ORANGE : BLUE)).offsetHSL(0, 0, -0.09 * k);
  const car = { team, k, x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, ai, aiCd: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fx: 0, fz: 0, fl: 0, ground: true };
  car.mesh = carMesh(col, model);
  car.model = model;
  car.displayName = ai ? (team ? 'ORANGE BOT ' : 'BLUE BOT ') + (k + 1) : playerName;
  // model-based properties
  const mdef = CAR_MODELS.find(m => m.name === model);
  car.hit = mdef.hit; car.mass = mdef.mass * 4; car.cap = mdef.cap; // scale mass multiplier into existing physics constants
  return car;
}
function buildTeams() {
  for (const c of cars) scene.remove(c.mesh.root);
  cars = [];
  for (let k = 0; k < mode; k++) {
    const c = mkCar(0, k, k > 0, k === 0 ? playerCarModel : undefined);
    c.displayName = k === 0 ? playerName : 'BLUE BOT ' + (k + 1);
    cars.push(c);
  }
  for (let k = 0; k < mode; k++) {
    const human = localTwoPlayer && k === 0;
    const c = mkCar(1, k, !human, human ? player2CarModel : undefined);
    c.displayName = human ? player2Name : 'ORANGE BOT ' + (k + 1);
    cars.push(c);
  }
}
const pads = [];
for (const [x, z, big] of [[-72, -96, 1], [72, -96, 1], [-72, 96, 1], [72, 96, 1], [-74, 0, 1], [74, 0, 1], [0, -64], [0, 64], [-36, -40], [36, -40], [-36, 40], [36, 40], [0, 0],
  [-48, -70], [48, -70], [-48, 70], [48, 70], [-20, -90], [20, -90], [-20, 90], [20, 90], [-60, -20], [60, -20], [-60, 20], [60, 20]]) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(big ? 2.8 : 1.8, big ? 2.8 : 1.8, 0.15, 24), new THREE.MeshBasicMaterial({ color: big ? 0xffd35a : 0x37f2c0, transparent: true }));
  m.position.set(x, 0.08, z); scene.add(m); pads.push({ x, z, big: !!big, t: 0, mesh: m });
}
const FORM = [[0, 0.55], [-26, 0.8], [26, 0.8]];
function kickoff() {
  previousTouch = null;
  eventCooldown = {};
  const msgEl = $('msg'); if (msgEl) msgEl.classList.remove('replay-title');
  const goalByEl = $('goalBy'); if (goalByEl) goalByEl.textContent = '';
  replayHistory = [];
  replayFrames = [];
  replayIndex = 0;
  Object.assign(ball, { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0 });
  lastTouch = null;
  for (const c of cars) {
    const f = FORM[c.k], s = c.team ? 1 : -1;
    Object.assign(c, { x: f[0] * (c.team ? -1 : 1), y: 0.55, z: s * f[1] * HL, vx: 0, vy: 0, vz: 0, yaw: c.team ? Math.PI : 0, pitch: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fl: 0, ground: true, aiCd: 0, wait: SKILL[diff].wait });
  }
}
function start() {
  sfx.init(); // read UI choices
  const nameEl = $('name'); if (nameEl) playerName = (nameEl.value || 'PLAYER').toString().trim().slice(0,12) || 'PLAYER';
  const name2El = $('name2'); if (name2El) player2Name = (name2El.value || 'PLAYER 2').toString().trim().slice(0,12) || 'PLAYER 2';
  const sel = document.querySelector('.car-opts:not(.car-opts-p2) button.on'); if (sel && sel.dataset.car) playerCarModel = sel.dataset.car;
  const sel2 = document.querySelector('.car-opts-p2 button.on'); if (sel2 && sel2.dataset.car2) player2CarModel = sel2.dataset.car2;
  const paint2El = $('paint2'); if (paint2El) player2Paint = paint2El.value || '#ff8a1f';
  const explosionEl = $('explosion'); if (explosionEl) goalExplosionStyle = explosionEl.value;
  buildTeams(); score = [0, 0]; clock = MATCH; ot = false; pads.forEach(p => p.t = 0);
  playerStats = cars.map(() => ({ goals: 0, assists: 0, shots: 0, saves: 0, clears: 0, shotsOnGoal: 0 }));
  const victory = $('victory'); if (victory) { victory.style.display = 'none'; victory.dataset.shown = ''; }
  kickoff(); state = 'kick'; cd = 3; $('menu').style.display = 'none'; $('msg').textContent = '';
  const pHUD = $('player'); if (pHUD) pHUD.textContent = playerName;
}
function pick(k, v) {
  if (k === 'mode') mode = v; else diff = v;
  for (const b of document.querySelectorAll('[data-' + k + ']')) b.classList.toggle('on', +b.dataset[k] === v);
}

// particles (one Points object, additive blending)
const NP = 1200, pp = { x: new Float32Array(NP * 3), c: new Float32Array(NP * 3), v: new Float32Array(NP * 3), col: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), i: 0 };
const pgeo = new THREE.BufferGeometry();
pgeo.setAttribute('position', new THREE.BufferAttribute(pp.x, 3)); pgeo.setAttribute('color', new THREE.BufferAttribute(pp.c, 3));
const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 1.8, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
pts.frustumCulled = false; scene.add(pts);
function emit(x, y, z, vx, vy, vz, life, r, g, b) {
  const i = pp.i; pp.i = (i + 1) % NP;
  pp.x.set([x, y, z], i * 3); pp.v.set([vx, vy, vz], i * 3); pp.col.set([r, g, b], i * 3); pp.life[i] = pp.max[i] = life;
}
function stepParts(dt) {
  for (let i = 0; i < NP; i++) {
    if (pp.life[i] <= 0) { pp.x[i * 3 + 1] = -1000; continue; }
    pp.life[i] -= dt; const k = Math.max(0, pp.life[i] / pp.max[i]);
    for (let a = 0; a < 3; a++) { pp.x[i * 3 + a] += pp.v[i * 3 + a] * dt; pp.c[i * 3 + a] = pp.col[i * 3 + a] * k; }
    pp.v[i * 3 + 1] -= 12 * dt;
  }
  pgeo.attributes.position.needsUpdate = true; pgeo.attributes.color.needsUpdate = true;
}
function emitBoost(c) {
  const cp = Math.cos(c.pitch), fx = Math.sin(c.yaw) * cp, fy = Math.sin(c.pitch), fz = Math.cos(c.yaw) * cp;
  for (let n = 0; n < 4; n++) emit(c.x - fx * 2.3 + (Math.random()-0.5)*0.4, c.y - fy * 2.3, c.z - fz * 2.3 + (Math.random()-0.5)*0.4, -fx * 9 + (Math.random() - 0.5) * 4, -fy * 9 + (Math.random() - 0.5) * 3, -fz * 9 + (Math.random() - 0.5) * 4, 0.4, 1, 0.6, 0.2);
}
function sparks(vn) {
  for (let i = 0; i < 12; i++) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 18, Math.random() * 12, (Math.random() - 0.5) * 18, 0.45, 1, 1, 0.9);
  sfx.tone(90 + Math.min(-vn, 30) * 6, 0.12, 'square', Math.min(0.25, -vn / 60));
}

// synthesized sound (no audio files)
const sfx = {
  init() {
    if (this.ac) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const a = this.ac = new AC(); this.o = a.createOscillator(); this.o.type = 'sawtooth'; this.og = a.createGain(); this.og.gain.value = 0;
    this.o.connect(this.og).connect(a.destination); this.o.start();
    const nb = a.createBuffer(1, a.sampleRate, a.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = nb; src.loop = true; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
    this.bg = a.createGain(); this.bg.gain.value = 0; src.connect(f).connect(this.bg).connect(a.destination); src.start();
  },
  tone(f, d, type, v) {
    if (!this.ac || muted) return; const a = this.ac, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + d);
  },
  update(c, on) {
    if (!this.ac) return; this.o.frequency.value = 55 + Math.hypot(c.vx, c.vz) * 3.2;
    this.og.gain.value = (!muted && on) ? 0.035 : 0; this.bg.gain.value = (!muted && on && c.fl) ? 0.12 : 0;
  }
};

// minimap: your goal at the bottom, attack goal at the top
const mini = $('mini').getContext('2d');
function drawMini() {
  const w = mini.canvas.width, h = mini.canvas.height, sx = w / (2 * HW), sz = h / (2 * HL), X = x => (HW - x) * sx, Z = z => (HL - z) * sz;
  mini.clearRect(0, 0, w, h); mini.fillStyle = 'rgba(5,10,18,.7)'; mini.fillRect(0, 0, w, h);
  mini.strokeStyle = 'rgba(55,242,192,.6)'; mini.strokeRect(1, 1, w - 2, h - 2);
  mini.fillStyle = '#ff8a1f'; mini.fillRect(w / 2 - GW * sx, 0, 2 * GW * sx, 3); mini.fillStyle = '#2fb8ff'; mini.fillRect(w / 2 - GW * sx, h - 3, 2 * GW * sx, 3);
  cars.forEach((c, i) => { mini.fillStyle = c.team ? '#ff8a1f' : '#2fb8ff'; mini.beginPath(); mini.arc(X(c.x), Z(c.z), i ? 3.5 : 4.5, 0, 7); mini.fill(); if (!i) { mini.strokeStyle = '#fff'; mini.stroke(); } });
  mini.fillStyle = '#fff'; mini.beginPath(); mini.arc(X(ball.x), Z(ball.z), 3, 0, 7); mini.fill();
}

// ---------- input ----------
const keys = {}; let jumpQ = false;
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || (e.code === 'Enter' && state === 'play')) e.preventDefault();
  if (!keys[e.code] && e.code === 'Space') jumpQ = true;
  if (!keys[e.code] && e.code === 'Enter' && state === 'play' && localTwoPlayer) jumpQ2 = true;
  if (!keys[e.code] && e.code === 'KeyC') { ballCam = !ballCam; $('cam').textContent = ballCam ? 'Ball cam (C)' : 'Chase cam (C)'; }
  if (e.code === 'Enter' && (state === 'menu' || state === 'over') && document.activeElement !== $('name')) start();
  if (state === 'menu' || state === 'over') {
    const n = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code], d = { Digit4: 0, Digit5: 1, Digit6: 2 }[e.code];
    if (n) pick('mode', n); if (d !== undefined) pick('diff', d);
  }
  if (e.code === 'KeyM') muted = !muted;
  if (e.code === 'KeyP') {
    paused = !paused;
    if (paused) { $('msg').textContent = 'PAUSED'; $('msg').style.color = '#fff'; }
    else { $('msg').textContent = ''; }
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
$('playBtn').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (state === 'menu' || state === 'over') start(); });
const nameInput = $('name');
if (nameInput) nameInput.addEventListener('input', () => {
  playerName = (nameInput.value || '').trim().slice(0, 12) || 'PLAYER';
  $('player').textContent = playerName;
  if (cars[0]) cars[0].displayName = playerName;
});
const name2Input = $('name2');
if (name2Input) name2Input.addEventListener('input', () => {
  player2Name = (name2Input.value || '').trim().slice(0, 12) || 'PLAYER 2';
  const tag = $('p2Tag'); if (tag) tag.textContent = player2Name.toUpperCase();
  const p2 = cars[mode]; if (p2 && localTwoPlayer) p2.displayName = player2Name;
});
const explosionInput = $('explosion');
if (explosionInput) explosionInput.addEventListener('change', () => { goalExplosionStyle = explosionInput.value; });
const paintInput = $('paint');
if (paintInput) paintInput.addEventListener('input', () => { playerPaint = paintInput.value || '#2fb8ff'; if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
const paint2Input = $('paint2');
if (paint2Input) paint2Input.addEventListener('input', () => { player2Paint = paint2Input.value || '#ff8a1f'; if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
const stadiumInput = $('stadium');
if (stadiumInput) stadiumInput.addEventListener('change', () => applyArenaStyle(stadiumInput.value));
const physicsInput = $('physics');
if (physicsInput) physicsInput.addEventListener('change', () => { physicsStyle = physicsInput.value || 'standard'; });
const localTwoInput = $('localTwo');
if (localTwoInput) localTwoInput.addEventListener('change', () => {
  localTwoPlayer = localTwoInput.checked;
  resize();
  if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); }
  const go = $('go'); if (go) go.textContent = localTwoPlayer ? 'Local 2-player enabled — P1 WASD, P2 arrows' : 'Choose your setup, then press PLAY';
});
function handleMenuChoice(e) {
  if (e.target.closest && e.target.closest('input, select')) return;
  const b = e.target.closest && e.target.closest('button');
  if (!b) return;
  if (b.dataset.mode) pick('mode', +b.dataset.mode);
  else if (b.dataset.diff) pick('diff', +b.dataset.diff);
  else if (b.dataset.car || b.dataset.car2) {
    if (b.dataset.car) {
      playerCarModel = b.dataset.car;
      document.querySelectorAll('.car-opts:not(.car-opts-p2) button').forEach(x => x.classList.toggle('on', x === b));
    } else {
      player2CarModel = b.dataset.car2;
      document.querySelectorAll('.car-opts-p2 button').forEach(x => x.classList.toggle('on', x === b));
    }
    // Rebuild in the menu so each player's garage choice is immediately visible.
    if (state === 'menu' || state === 'over') {
      buildTeams();
      kickoff();
      const go = $('go');
      if (go) go.textContent = (b.dataset.car2 ? 'P2 selected: ' : 'P1 selected: ') + b.textContent.trim() + ' — press PLAY';
    }
  }
}
$('menu').addEventListener('pointerdown', handleMenuChoice);
$('menu').addEventListener('click', handleMenuChoice);
function playerCtl() {
  const j = jumpQ; jumpQ = false;
  return { throttle: (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), steer: (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), jump: j, jumpHeld: !!keys.Space, hand: !!keys.KeyE, boost: !!keys.ShiftLeft };
}
let jumpQ2 = false;
function player2Ctl() {
  const j = jumpQ2; jumpQ2 = false;
  return { throttle: (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0), steer: (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0), jump: j, jumpHeld: !!keys.Enter, hand: !!keys.Slash, boost: !!keys.ShiftRight };
}
const pred = []; // where the ball will be every 0.1s for the next 4 seconds
function predict() {
  let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz; pred.length = 0;
  for (let i = 0; i < 40; i++) {
    for (let k = 0; k < 4; k++) {
      const h = 0.025; vy -= G_BALL * h; x += vx * h; y += vy * h; z += vz * h;
      if (y < BR) { y = BR; vy = -vy * 0.62; }
      if (y > CEIL - BR) { y = CEIL - BR; vy = -Math.abs(vy) * 0.5; }
      if (Math.abs(x) > HW - BR) { x = Math.sign(x) * (HW - BR); vx = -vx * 0.72; }
      if (Math.abs(z) > HL - BR && !(Math.abs(x) < GW && y < GH)) { z = Math.sign(z) * (HL - BR); vz = -vz * 0.72; }
    }
    pred.push({ x, y, z });
  }
}
function aiCtl(c, dt) {
  c.aiCd -= dt; c.errT = (c.errT || 0) - dt;
  const sk = SKILL[diff], ct = { throttle: sk.thr, steer: 0, jump: false, jumpHeld: false, boost: false, hand: false };
  c.cap = sk.cap * (c.cap || 1);
  if (c.wait > 0) { c.wait -= dt; ct.throttle = 0; return ct; }
  if (c.y < 0.58 && c.jumps === 0) { c.aerial = false; c.flipNext = false; }
  const sp = Math.hypot(c.vx, c.vz), d2 = (o, p) => Math.hypot(p.x - o.x, p.z - o.z);
  if (c.rev > 0) { c.rev -= dt; ct.throttle = -1; ct.steer = c.revSteer; return ct; } // unstick
  c.stuckT = (c.ground && sp < 1.5) ? (c.stuckT || 0) + dt : 0;
  if (c.stuckT > 1.2) { c.stuckT = 0; c.rev = 0.8; c.revSteer = Math.random() < 0.5 ? -1 : 1; }
  if (c.errT <= 0) { c.err = (Math.random() - 0.5) * sk.sloppy; c.errT = 1 + Math.random(); }
  const own = c.team ? HL : -HL, ag = -own, bd = d2(c, ball);
  const bp = pred[8] || ball;
  const team = cars.filter(o => o.team === c.team).sort((a, b) => d2(a, bp) - d2(b, bp)), rank = team.indexOf(c);
  // first spot the car can reach in time while the ball is low enough to hit
  let tgt = pred[12] || ball, T = 1.2;
  for (let i = 0; i < pred.length; i++) { const p = pred[i]; if (p.y < 6 && d2(c, p) / (14 + 28 * (c.cap || 1)) <= (i + 1) * 0.1) { tgt = p; T = (i + 1) * 0.1; break; } }
  let threat = -1; // will the ball roll into our goal?
  for (let i = 0; i < pred.length; i++) { const p = pred[i]; if (Math.sign(p.z) === Math.sign(own) && Math.abs(p.z) > HL - 4 && Math.abs(p.x) < GW + 3 && p.y < GH + 3) { threat = i; break; } }
  const goalie = team.length > 1 && rank === team.length - 1, chase = rank === 0 || (rank === 1 && bd < 14) || (goalie && bd < 16);
  let tx, tz;
  if (chase) { // line up behind the ball, facing the enemy goal
    let ux = -tgt.x, uz = ag - tgt.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const off = d2(c, tgt) < 12 ? 2.2 : 4.5; tx = tgt.x - ux * off + c.err; tz = tgt.z - uz * off;
    const rx = c.x - tgt.x, rz = c.z - tgt.z;
    if (rx * ux + rz * uz > -3 && d2(c, tgt) > 7) { const px = -uz, pz = ux, sg = (rx * px + rz * pz) >= 0 ? 1 : -1; tx = tgt.x - ux * 14 + px * sg * 11; tz = tgt.z - uz * 14 + pz * sg * 11; }
  } else if (goalie) { tx = clamp(threat >= 0 ? pred[threat].x : tgt.x * 0.35, -GW + 4, GW - 4); tz = own * (HL - 10); }
  else { // support: hang back between the ball and our goal, grab boost if low
    tx = tgt.x * 0.4; tz = tgt.z * 0.55 + own * 0.35;
    if (c.boost < 35) { let best = 1e9; for (const p of pads) if (p.t <= 0 && Math.sign(p.z) === Math.sign(own) && d2(c, p) < best) { best = d2(c, p); tx = p.x; tz = p.z; } }
  }
  tx = clamp(tx, -HW + 6, HW - 6); tz = clamp(tz, -HL + 8, HL - 8);
  const dx = tx - c.x, dz = tz - c.z, dist = Math.hypot(dx, dz), parked = !chase && dist < 5;
  const da = wrap(Math.atan2(parked ? ball.x - c.x : dx, parked ? ball.z - c.z : dz) - c.yaw);
  if (c.ground) {
    ct.steer = -clamp(da * sk.steer, -1, 1);
    if (parked) ct.throttle = 0;
    ct.boost = !!sk.boost && c.boost > (chase ? 5 : 45) && Math.abs(da) < 0.3 && dist > 12;
    ct.hand = sk.drift && Math.abs(da) > 1.3 && sp > 14;
    const low = tgt.y < 4.5 && ball.y < 4.5;
    if (chase && c.aiCd <= 0 && low && bd < 9.5 && Math.abs(da) < 0.35 && sp > 16 && Math.random() < sk.flip) { ct.jump = true; c.flipNext = true; c.aiCd = 1.2; } // power flip into the ball
    else if (chase && c.aiCd <= 0 && sk.aerial && tgt.y > 7 && tgt.y < 26 && d2(c, tgt) < 30 && sp > 10 && Math.abs(da) < 0.4) { ct.jump = true; c.aerial = true; c.aiCd = 2; }
    else if (chase && c.aiCd <= 0 && !sk.aerial && bd < 11 && ball.y > 4 && Math.abs(ball.x - c.x) < 9) { ct.jump = true; c.aiCd = 1; }
  } else if (c.aerial) { // aerial: aim nose at the ball and boost
    const hd = d2(c, tgt), want = Math.atan2(tgt.y - c.y, hd), dp = want - c.pitch;
    ct.steer = -clamp(wrap(Math.atan2(tgt.x - c.x, tgt.z - c.z) - c.yaw) * 3, -1, 1);
    ct.throttle = dp > 0.1 ? -1 : dp < -0.1 ? 1 : 0; ct.jumpHeld = true;
    ct.boost = Math.abs(dp) < 0.35 && c.boost > 8 && hd < 45;
  } else {
    ct.throttle = c.pitch > 0.12 ? 1 : c.pitch < -0.12 ? -1 : 0; // level out for landing
    if (c.flipNext && c.jumps === 1 && c.jt > 0.1) { ct.jump = true; ct.dodge = [1, 0]; c.flipNext = false; }
  }
  return ct;
}

// ---------- physics ----------
function stepCar(c, ct, dt) {
  c.jt += dt; if (c.flip > 0) c.flip -= dt;
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const ground = c.y <= 0.56; c.ground = ground;
  const bo = ct.boost && c.boost > 0;
  if (bo) { c.boost = Math.max(0, c.boost - 33 * dt); emitBoost(c); }
  c.fl = bo ? 1 : 0;
  if (ground) {
    c.jumps = 0; c.jt = 0; c.hold = 0; c.pitch *= Math.max(0, 1 - 10 * dt);
    let vf = c.vx * sy + c.vz * cy, vs = c.vx * cy - c.vz * sy;
    const hb = ct.hand ? 1 : 0, physicsAccel = physicsStyle === 'arcade' ? 1.3 : physicsStyle === 'heavy' ? 0.82 : 1;
    const acc = 42 * physicsAccel * Math.max(0, 1 - Math.abs(vf) / 36);
    if (ct.throttle) vf += ct.throttle * (vf * ct.throttle < 0 ? 70 : acc) * dt; else vf *= Math.max(0, 1 - 0.9 * dt);
    if (bo) vf += 40 * dt;
    vf *= 1 - 0.5 * hb * dt;
    vf = clamp(vf, -24, (bo ? 56 : 36) * (c.cap || 1)); vs *= Math.max(0, 1 - (hb ? 1.6 : 9) * dt);
    const sr = (3.4 - 2.0 * clamp(Math.abs(vf) / 45, 0, 1)) * (1 + 0.6 * hb) * clamp(Math.abs(vf) / 2.5, 0, 1);
    c.yaw -= ct.steer * sr * (vf >= 0 ? 1 : -1) * dt;
    c.vx = sy * vf + cy * vs; c.vz = cy * vf - sy * vs; c.vy = 0;
  } else {
    const gravityScale = physicsStyle === 'floaty' ? 0.72 : physicsStyle === 'heavy' ? 1.2 : 1;
    c.vy -= G_CAR * gravityScale * dt; c.yaw -= ct.steer * (physicsStyle === 'arcade' ? 3.1 : 2.4) * dt;
    if (c.hold > 0 && ct.jumpHeld && c.jumps === 1) { c.vy += 28 * dt; c.hold -= dt; } else c.hold = 0;
    if (!ct.throttle && c.y < 4 && c.vy < 0) c.pitch *= Math.max(0, 1 - 5 * dt);
    c.pitch = clamp(c.pitch - ct.throttle * 3 * dt, -1.3, 1.3);
    if (bo) {
      const cp = Math.cos(c.pitch);
      c.vx += sy * cp * 55 * dt; c.vy += Math.sin(c.pitch) * 55 * dt; c.vz += cy * cp * 55 * dt;
    }
    const sp = Math.hypot(c.vx, c.vy, c.vz); if (sp > 58) { const k = 58 / sp; c.vx *= k; c.vy *= k; c.vz *= k; }
  }
  if (ct.jump) {
    if (ground) { c.vy = 11; c.jumps = 1; c.jt = 0; c.hold = 0.22; c.y += 0.05; }
    else if (c.jumps === 1 && c.jt < 1.4) {
      c.jumps = 2;
      const f = ct.dodge ? ct.dodge[0] : ct.throttle, s = ct.dodge ? ct.dodge[1] : ct.steer;
      if (f || s) { c.vx += (sy * f - cy * s) * 17; c.vz += (cy * f + sy * s) * 17; c.vy = Math.max(c.vy, 3); c.flip = 0.55; c.fx = f; c.fz = s; }
      else c.vy = 9.5;
    }
  }
  if (c.ai) c.boost = Math.min(100, c.boost + 8 * dt);
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  if (c.y < 0.55) { c.y = 0.55; if (c.vy < 0) c.vy = 0; }
  if (c.y > CEIL - 0.6) { c.y = CEIL - 0.6; if (c.vy > 0) c.vy = 0; }
  if (Math.abs(c.x) > HW - 1.3) { c.x = Math.sign(c.x) * (HW - 1.3); c.vx *= -0.2; }
  if (Math.abs(c.z) > HL - 1.9) { c.z = Math.sign(c.z) * (HL - 1.9); c.vz *= -0.2; }
  const ov = Math.abs(c.x) + Math.abs(c.z) - (HW + HL - CH - 2.5); // rounded corners
  if (ov > 0) {
    const sx = Math.sign(c.x), sz = Math.sign(c.z), vn = (c.vx * sx + c.vz * sz) * 0.7071;
    c.x -= sx * ov / 2; c.z -= sz * ov / 2; if (vn > 0) { c.vx -= sx * vn * 0.7071 * 1.2; c.vz -= sz * vn * 0.7071 * 1.2; }
  }
  for (const p of pads) {
    p.t = Math.max(0, p.t - dt);
    if (p.t <= 0 && c.y < 1.6 && c.boost < 100 && Math.hypot(c.x - p.x, c.z - p.z) < (p.big ? 3.2 : 2.2)) {
      c.boost = Math.min(100, c.boost + (p.big ? 100 : 30)); p.t = p.big ? 10 : 4;
    }
  }
}
function bump() {
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d < 2.8 && d > 1e-3 && Math.abs(a.y - b.y) < 1.2) {
      const nx = dx / d, nz = dz / d, p = (2.8 - d) / 2;
      a.x -= nx * p; a.z -= nz * p; b.x += nx * p; b.z += nz * p;
      const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      if (rv > 0) { a.vx -= nx * rv * 0.6; a.vz -= nz * rv * 0.6; b.vx += nx * rv * 0.6; b.vz += nz * rv * 0.6; }
    }
  }
}
function hitBall(c) {
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const dx = ball.x - c.x, dy = ball.y - c.y, dz = ball.z - c.z;
  const lf = dx * sy + dz * cy, ll = dx * cy - dz * sy; // along nose, along left side
  // use model hit radius to vary collision extents
  const hf = c.hit || 1.7;
  let nf = lf - clamp(lf, -hf, hf), nl = ll - clamp(ll, -hf * 0.6, hf * 0.6), ny = dy - clamp(dy, -0.55, 0.55);
  let d = Math.hypot(nf, nl, ny);
  if (d >= BR) return;
  // Contact itself determines the most recent touch. Don't leave an old bot
  // credited just because the latest collision had no inward relative velocity.
  if (lastTouch !== c) { previousTouch = lastTouch; lastTouch = c; }
  const stat = playerStats[cars.indexOf(c)];
  const nearOwnGoal = Math.abs(c.z - (c.team ? -HL : HL)) < 28;
  if (stat && nearOwnGoal && Math.abs(ball.z) > HL - 35 && ball.vz * (c.team ? 1 : -1) > 2 && (eventCooldown['clear'+cars.indexOf(c)] || 0) <= t) {
    stat.clears++; eventCooldown['clear'+cars.indexOf(c)] = t + 3; showGameEvent('CLEARANCE', '#37f2c0');
  }
  if (stat && Math.abs(ball.z) > HL - 24 && Math.abs(ball.x) < GW + 12 && ball.vz * (c.team ? 1 : -1) > 1 && (eventCooldown['save'+cars.indexOf(c)] || 0) <= t) {
    stat.saves++; eventCooldown['save'+cars.indexOf(c)] = t + 3; showGameEvent('SAVE!', '#37f2c0');
  }
  if (d < 1e-4) { nf = nl = 0; ny = 1; d = 0; } else { nf /= d; nl /= d; ny /= d; }
  const nx = sy * nf + cy * nl, nz = cy * nf - sy * nl;
  ball.x += nx * (BR - d); ball.y += ny * (BR - d); ball.z += nz * (BR - d);
  const vn = (ball.vx - c.vx) * nx + (ball.vy - c.vy) * ny + (ball.vz - c.vz) * nz;
  if (vn < 0) {
    if (vn < -4) sparks(vn);
    const j = -1.6 * vn / (1 + 1 / (c.mass || 4));
    ball.vx += nx * j; ball.vy += ny * j; ball.vz += nz * j;
    c.vx -= nx * j / (c.mass || 4); c.vy -= ny * j / (c.mass || 4); c.vz -= nz * j / (c.mass || 4);
    if (c.fl) { ball.vx += nx * 4; ball.vy += ny * 4; ball.vz += nz * 4; }
    if (c.ground) ball.vy += 2;
  }
  const s = Math.hypot(ball.vx, ball.vy, ball.vz); if (s > 80) { const k = 80 / s; ball.vx *= k; ball.vy *= k; ball.vz *= k; }
}

// goal explosion helpers
let camShakeTime = 0;
function goalExplosion(team) {
  const cx = ball.x, cy = Math.max(ball.y, 2.5), cz = ball.z;
  // color palette
  const palettes = {
    classic: team ? [1, 0.54, 0.12] : [0.18, 0.72, 1],
    fire: [1, 0.18 + Math.random() * 0.25, 0.025],
    galaxy: [0.62, 0.2, 1],
    lightning: [0.55, 0.9, 1]
  };
  const cs = palettes[goalExplosionStyle] || palettes.classic;
  const burstCount = goalExplosionStyle === 'galaxy' ? 520 : goalExplosionStyle === 'lightning' ? 260 : 400;
  // large particle burst
  for (let i = 0; i < burstCount; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * 1.6, s = 12 + Math.random() * 32;
    const r = i % 6 ? (goalExplosionStyle === 'galaxy' && i % 3 === 0 ? [0.15, 0.65, 1] : cs) : [1, 0.9, 0.6];
    emit(cx, cy, cz, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 6, Math.sin(a) * Math.cos(e) * s, 1.6 + Math.random() * 0.8, r[0], r[1], r[2]);
  }
  // confetti shards (heavier)
  for (let i = 0; i < 120; i++) {
    const vx = (Math.random() - 0.5) * (goalExplosionStyle === 'lightning' ? 64 : 40);
    const vz = (Math.random() - 0.5) * (goalExplosionStyle === 'lightning' ? 64 : 40);
    emit(cx, cy, cz, vx, Math.random() * 30, vz, 1.2, cs[0], cs[1], cs[2]);
  }

  // flash light
  const pl = new THREE.PointLight(team ? ORANGE : BLUE, 6, 300); pl.position.set(cx, cy, cz); scene.add(pl);
  let lightLife = 0.9;
  const lightInterval = setInterval(() => { pl.intensity *= 0.7; lightLife -= 0.06; if (lightLife <= 0) { scene.remove(pl); clearInterval(lightInterval); } }, 60);

  // expanding ring
  const ringGeo = new THREE.RingGeometry(goalExplosionStyle === 'lightning' ? 4 : 8, goalExplosionStyle === 'lightning' ? 5 : 10, 64);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: goalExplosionStyle === 'classic' ? (team ? ORANGE : BLUE) : new THREE.Color(cs[0], cs[1], cs[2]), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 1.5, cz); scene.add(ring);
  let rscale = 1.0;
  const ringInterval = setInterval(() => { rscale += 0.25; ring.scale.set(rscale, rscale, rscale); ring.material.opacity *= 0.86; if (ring.material.opacity < 0.03) { scene.remove(ring); clearInterval(ringInterval); } }, 40);

  // camera shake + sound
  camShakeTime = 0.8;
  [880, 1047, 1318].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.28, 'sawtooth', 0.18), i * 100));
}

function stepBall(dt) {
  ball.vy -= G_BALL * dt;
  const dr = 1 - 0.03 * dt; ball.vx *= dr; ball.vz *= dr;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
  if (ball.y < BR) {
    ball.y = BR; ball.vy = -ball.vy * 0.62; if (Math.abs(ball.vy) < 1.5) ball.vy = 0;
    const f = Math.max(0, 1 - 0.35 * dt); ball.vx *= f; ball.vz *= f;
  }
  if (ball.y > CEIL - BR) { ball.y = CEIL - BR; ball.vy = -Math.abs(ball.vy) * 0.5; }
  const az = Math.abs(ball.z), sz = Math.sign(ball.z);
  if (state === 'play' && az > HL && Math.abs(ball.x) < GW && ball.y < GH) return goal(ball.z > 0 ? 0 : 1);
  if (az <= HL) { // rounded corners so the ball never sits in a corner
    const sx = Math.sign(ball.x), ov = Math.abs(ball.x) + az - (HW + HL - CH - BR * 1.4142);
    if (ov > 0) {
      const vn = (ball.vx * sx + ball.vz * sz) * 0.7071;
      ball.x -= sx * ov / 2; ball.z -= sz * ov / 2; if (vn > 0) { ball.vx -= sx * vn * 0.7071 * 1.72; ball.vz -= sz * vn * 0.7071 * 1.72; }
    }
  }
  if (Math.abs(ball.x) > HW - BR && az <= HL) { ball.x = Math.sign(ball.x) * (HW - BR); ball.vx = -Math.sign(ball.x) * Math.abs(ball.vx) * 0.72; }
  if (az > HL) { // inside a goal pocket
    if (Math.abs(ball.x) > GW - BR) { ball.x = Math.sign(ball.x) * (GW - BR); ball.vx = -Math.sign(ball.x) * Math.abs(ball.vx) * 0.5; }
    if (ball.y > GH - BR) { ball.y = GH - BR; ball.vy = -Math.abs(ball.vy) * 0.5; }
    if (az > HL + GD - BR) { ball.z = sz * (HL + GD - BR); ball.vz = -sz * Math.abs(ball.vz) * 0.4; }
  } else if (az > HL - BR && !(Math.abs(ball.x) + BR < GW && ball.y + BR < GH)) {
    ball.z = sz * (HL - BR); ball.vz = -sz * Math.abs(ball.vz) * 0.72;
  }
}
function showGameEvent(label, color = '#fff') {
  const el = $('eventCallout'); if (!el) return;
  el.textContent = label; el.style.color = color; el.classList.remove('event-pop'); void el.offsetWidth; el.classList.add('event-pop');
}
function goal(team) {
  score[team]++;
  const scorerIndex = lastTouch ? cars.indexOf(lastTouch) : -1;
  if (scorerIndex >= 0 && playerStats[scorerIndex]) playerStats[scorerIndex].goals++;
  const assistIndex = previousTouch ? cars.indexOf(previousTouch) : -1;
  if (assistIndex >= 0 && assistIndex !== scorerIndex && cars[assistIndex].team === team && playerStats[assistIndex]) playerStats[assistIndex].assists++;
  if (scorerIndex >= 0 && playerStats[scorerIndex]) playerStats[scorerIndex].shotsOnGoal++;
  state = 'goal';
  cd = 2.5; // let the scorer message and goal explosion play before the replay
  // Keep ten seconds of live gameplay plus the frame in which the goal was scored.
  saveReplayFrame();
  replayFrames = replayHistory.slice(-301);
  replayIndex = 0;

  // Show the scorer first, before switching to the replay title.
  const scorerName = lastTouch ? (lastTouch === cars[0] ? playerName : lastTouch.displayName) : null;
  goalScorerText = scorerName || (team ? 'ORANGE' : 'BLUE');
  // Only trust lastTouch when it belongs to the team that was awarded the goal.
  // Otherwise follow the first car on the scoring team, never default to P1.
  replayCameraCarIndex = lastTouch && lastTouch.team === team
    ? cars.indexOf(lastTouch)
    : cars.findIndex(c => c.team === team);
  if (replayCameraCarIndex < 0) replayCameraCarIndex = 0;
  const m = $('msg');
  m.classList.remove('replay-title');
  m.textContent = goalScorerText.toUpperCase() + ' SCORED!';
  m.style.color = team ? '#ff8a1f' : '#2fb8ff';

  // fireworks + explosion
  goalExplosion(team);

  // legacy confetti particles (complementary)
  const cs = team ? [1, 0.54, 0.12] : [0.18, 0.72, 1];
  for (let i = 0; i < 180; i++) {
    const a = Math.random() * 6.28, e = Math.random() * 1.2, s = 8 + Math.random() * 22, k = i % 3 ? cs : [1, 0.85, 0.3];
    emit(ball.x, ball.y, ball.z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 6, Math.sin(a) * Math.cos(e) * s, 1.8, k[0], k[1], k[2]);
  }
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.35, 'triangle', 0.2), i * 120));
}
function update(dt) {
  t += dt;
  if (state === 'kick') { cd -= dt; jumpQ = false; $('msg').style.color = '#fff'; $('msg').textContent = cd > 0 ? Math.ceil(cd) : 'GO!'; if (cd <= 0) { state = 'play'; $('msg').textContent = ''; } return; }
  if (state === 'replay') {
    replayIndex += dt * 30; // recorded at about 30 frames per second: replay ten seconds at normal speed
    if (replayIndex >= replayFrames.length - 1) {
      replayIndex = replayFrames.length - 1;
      applyReplayFrame(replayFrames[replayIndex]);
      if (ot) {
        state = 'over';
        // Overtime goals end the match from inside the replay branch, so show
        // the final scoreboard here instead of leaving the arena frozen.
        showVictoryScreen();
      } else {
        kickoff();
        state = 'kick';
        cd = 2.5;
      }
      const m = $('msg'); if (m) m.textContent = ot ? '' : 'KICK OFF';
    } else {
      applyReplayFrame(replayFrames[Math.floor(replayIndex)]);
    }
    return;
  }
  if (state === 'play') {
    // Count a shot when the ball is travelling into the attacking goal area.
    for (let ti = 0; ti < 2; ti++) {
      const attackDir = ti === 0 ? 1 : -1;
      if (ball.vz * attackDir > 10 && Math.abs(ball.z) > HL - 32 && Math.abs(ball.x) < GW + 15 && (eventCooldown['shot'+ti] || 0) <= t) {
        const shooter = lastTouch ? cars.indexOf(lastTouch) : -1;
        if (shooter >= 0 && cars[shooter].team === ti && playerStats[shooter]) { playerStats[shooter].shots++; playerStats[shooter].shotsOnGoal++; }
        eventCooldown['shot'+ti] = t + 2.5; showGameEvent('SHOT ON GOAL', '#ffe36e');
      }
    }
    clock -= dt; if (clock <= 0) { clock = 0; if (score[0] === score[1]) ot = true; else state = 'over'; } }
  else if (state === 'goal') {
    cd -= dt;
    dt *= 0.5;
    if (cd <= 0) {
      if (replayFrames.length > 1) {
        state = 'replay';
        replayIndex = 0;
        // Snap the replay camera behind the selected scorer immediately; don't
        // let the previous player's camera position linger into the replay.
        const scorer = cars[replayCameraCarIndex] || cars[0];
        const backX = -Math.sin(scorer.yaw), backZ = -Math.cos(scorer.yaw);
        for (const camState of [cam, ...(localTwoPlayer ? [cam2] : [])]) {
          camState.x = scorer.x + backX * 11;
          camState.y = clamp(scorer.y + 4.6, 2, CEIL - 1);
          camState.z = scorer.z + backZ * 11;
          camState.lx = scorer.x - backX * 9;
          camState.ly = 1.5;
          camState.lz = scorer.z - backZ * 9;
        }
        const m = $('msg'); if (m) { m.textContent = 'GOAL REPLAY'; m.style.color = '#fff'; m.classList.add('replay-title'); }
        const goalByEl = $('goalBy'); if (goalByEl) goalByEl.textContent = 'Goal by ' + goalScorerText + '!!!';
      } else {
        $('msg').textContent = '';
        if (ot) state = 'over';
        else { kickoff(); state = 'kick'; cd = 2.5; }
      }
      return;
    }
  } else return;
  predict();
  const cts = cars.map((c, i) => {
    if (i === 0) return playerCtl();
    if (localTwoPlayer && i === mode) return player2Ctl();
    return aiCtl(c, dt);
  });
  for (let n = 0; n < 2; n++) {
    const h = dt / 2;
    cars.forEach((c, i) => stepCar(c, cts[i], h)); cts.forEach(ct => { ct.jump = false; });
    bump(); stepBall(h); cars.forEach(hitBall);
  }
  if (state === 'over') {
    showVictoryScreen();
  }
}

function showVictoryScreen() {
  const panel = $('victory'); if (!panel || panel.dataset.shown === 'yes') return;
  panel.dataset.shown = 'yes'; panel.style.display = 'grid';
  const winner = score[0] > score[1] ? playerName.toUpperCase() + ' WINS' : score[1] > score[0] ? 'ORANGE WINS' : 'DRAW';
  $('victoryTitle').textContent = winner;
  $('victoryScore').textContent = score[0] + '  —  ' + score[1];
  const rows = cars.map((car, idx) => ({car, stats: playerStats[idx] || {}, idx}));
  $('statsBody').innerHTML = rows.map(({car,stats,idx}) => '<tr><td><span class="team-dot" style="background:'+(car.team?'#ff8a1f':'#2fb8ff')+'"></span>'+escapeStats(car.displayName || ('PLAYER '+(idx+1)))+'</td><td>'+stats.goals+'</td><td>'+stats.assists+'</td><td>'+stats.shots+'</td><td>'+stats.saves+'</td><td>'+stats.clears+'</td></tr>').join('');
}
function escapeStats(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
$('victoryPlayAgain').addEventListener('click', () => { const p=$('victory'); p.style.display='none'; p.dataset.shown=''; $('menu').style.display='grid'; state='menu'; $('mt').textContent='ROCKET ARENA 3D'; $('go').textContent='Choose your setup, then press PLAY'; });
// ---------- camera + render ----------
const cam = { x: 0, y: 6, z: -60, lx: 0, ly: 2, lz: 0 };
const cam2 = { x: 0, y: 6, z: 60, lx: 0, ly: 2, lz: 0 };
const axis = new THREE.Vector3();
function updateCam(dt, carIndex = 0, targetCamera = camera, camState = cam) {
  const c = cars[carIndex] || cars[0]; let dx = -Math.sin(c.yaw), dz = -Math.cos(c.yaw);
  if (ballCam) { const bx = c.x - ball.x, bz = c.z - ball.z, l = Math.hypot(bx, bz); if (l > 0.5) { dx = bx / l; dz = bz / l; } }
  const k = 1 - Math.exp(-7 * dt);
  const tx = clamp(c.x + dx * 11, -HW + 2, HW - 2), tz = clamp(c.z + dz * 11, -HL + 2, HL - 2), ty = clamp(c.y + 4.6, 2, CEIL - 1);
  camState.x += (tx - camState.x) * k; camState.y += (ty - camState.y) * k; camState.z += (tz - camState.z) * k;
  let lx = c.x - dx * 9, ly = 1.5, lz = c.z - dz * 9;
  if (ballCam) { lx = ball.x; ly = ball.y; lz = ball.z; }
  camState.lx += (lx - camState.lx) * k; camState.ly += (ly - camState.ly) * k; camState.lz += (lz - camState.lz) * k;

  // camera shake
  if (camShakeTime > 0) {
    camShakeTime -= dt;
    const shakeAmp = Math.min(1, camShakeTime * 2);
    camState.x += (Math.random() - 0.5) * 2 * shakeAmp;
    camState.y += (Math.random() - 0.5) * 1.2 * shakeAmp;
    camState.z += (Math.random() - 0.5) * 2 * shakeAmp;
  }

  targetCamera.position.set(camState.x, camState.y, camState.z); targetCamera.lookAt(camState.lx, camState.ly, camState.lz);
  sun.position.set(c.x + 30, 80, c.z + 25); sun.target.position.set(c.x, 0, c.z); sun.target.updateMatrixWorld();
  targetCamera.fov += (70 + Math.hypot(c.vx, c.vy, c.vz) * 0.4 + (c.fl ? 6 : 0) - targetCamera.fov) * k; targetCamera.updateProjectionMatrix();
}
function render(dt) {
  if (state === 'play') saveReplayFrame();
  if (state === 'replay' && replayFrames.length) applyReplayFrame(replayFrames[Math.min(Math.floor(replayIndex), replayFrames.length - 1)]);
  for (const c of cars) {
    const m = c.mesh;
    m.root.position.set(c.x, c.y, c.z); m.root.rotation.set(-c.pitch, c.yaw, 0);
    m.flame.visible = !!c.fl; m.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    m.body.rotation.set(0, 0, 0);
    if (c.flip > 0) {
      const a = (1 - c.flip / 0.55) * Math.PI * 2;
      if (Math.abs(c.fx) >= Math.abs(c.fz)) m.body.rotation.x = a * Math.sign(c.fx); else m.body.rotation.z = a * Math.sign(c.fz);
    }
    // wheel rotation visual
    if (m.wheels && m.wheels.length) {
      const sp = Math.hypot(c.vx, c.vz);
      const wheelSpeed = sp * 0.6; // tweak multiplier for visual speed
      for (const w of m.wheels) {
        // rotate around local axis
        w.rotation.x += wheelSpeed * dt;
      }
    }
  }
  ballMesh.position.set(ball.x, ball.y, ball.z);
  const sp = Math.hypot(ball.vx, ball.vz);
  if (sp > 0.05) { axis.set(ball.vz, 0, -ball.vx).normalize(); ballMesh.rotateOnWorldAxis(axis, sp * dt / BR); }
  if (state === 'play' && Math.hypot(sp, ball.vy) > 26) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, 0.3, 0.9, 0.8);
  for (const p of pads) p.mesh.material.opacity = p.t > 0 ? 0.12 : 0.9;
  stepParts(dt); drawMini(); sfx.update(cars[0], state === 'play');
  const splitActive = localTwoPlayer && state !== 'menu' && state !== 'over';
  document.body.classList.toggle('split-screen', splitActive);
  // During a replay, follow the player who scored instead of always following P1.
  updateCam(dt, state === 'replay' ? replayCameraCarIndex : 0);
  if (splitActive) updateCam(dt, state === 'replay' ? replayCameraCarIndex : mode, camera2, cam2);
  $('s0').textContent = score[0]; $('s1').textContent = score[1];
  const s = Math.ceil(clock); $('clock').textContent = ot ? 'OT' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const b = cars[0].boost; $('bf').style.width = (2.1 * b) + 'px'; $('bt').textContent = Math.round(b);
  $('bf').style.background = b > 66 ? '#ffd35a' : '#37f2c0';
  const p2 = cars[mode];
  const bf2 = $('bf2'), bt2 = $('bt2');
  if (bf2 && bt2) { const b2 = p2 ? p2.boost : 0; bf2.style.width = (2.1 * b2) + 'px'; bt2.textContent = Math.round(b2); bf2.style.background = b2 > 66 ? '#ffd35a' : '#ff8a1f'; }
  const pHUD = $('player'); if (pHUD) pHUD.textContent = playerName;
  const p2Tag = $('p2Tag'); if (p2Tag) p2Tag.textContent = player2Name.toUpperCase();
  if (splitActive) {
    const half = Math.floor(innerWidth / 2);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, half, innerHeight); renderer.setScissor(0, 0, half, innerHeight); renderer.render(scene, camera);
    renderer.setViewport(half, 0, innerWidth - half, innerHeight); renderer.setScissor(half, 0, innerWidth - half, innerHeight); renderer.render(scene, camera2);
    renderer.setScissorTest(false);
  } else {
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);
  }
}

// ---------- loop ----------
buildTeams(); kickoff(); pick('mode', 2); pick('diff', 1);
window.rocketArena = { ball, get cars() { return cars; }, get score() { return score; }, get state() { return state; } };
let last = performance.now();
(function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  if (!paused) update(dt);
  render(dt);
  requestAnimationFrame(loop);
})(last);
})();
