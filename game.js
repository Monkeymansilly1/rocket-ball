(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') {
  $('menu').innerHTML = '<h1>Three.js not found</h1><p>Check your connection, or put three.min.js (r149) in the lib/ folder.</p>';
  return;
}
// ---------- tuning (units are roughly metres) ----------
const HW = 52, HL = 76, GW = 13, GH = 9, GD = 10, CEIL = 36, BR = 2.4, CM = 4;
const G_CAR = 32, G_BALL = 20, MATCH = 180, BLUE = 0x2fb8ff, ORANGE = 0xff8a1f;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070d18);
scene.fog = new THREE.Fog(0x070d18, 130, 360);
const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 800);
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x0a1a18, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(30, 70, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 10, far: 260 });
scene.add(sun);

function buildArena() {
  const S = 10, TW = 2 * HW * S, TH = 2 * HL * S, cvs = document.createElement('canvas'); cvs.width = TW; cvs.height = TH;
  const g = cvs.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#0f3a35' : '#0c322e'; g.fillRect(0, i * TH / 16, TW, TH / 16 + 1); }
  g.fillStyle = 'rgba(47,184,255,.18)'; g.fillRect(0, 0, TW, 15 * S);
  g.fillStyle = 'rgba(255,138,31,.18)'; g.fillRect(0, TH - 15 * S, TW, 15 * S);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6;
  g.strokeRect(3, 3, TW - 6, TH - 6);
  g.strokeRect(TW / 2 - (GW + 6) * S, 3, 2 * (GW + 6) * S, 12 * S); g.strokeRect(TW / 2 - (GW + 6) * S, TH - 3 - 12 * S, 2 * (GW + 6) * S, 12 * S);
  g.beginPath(); g.moveTo(0, TH / 2); g.lineTo(TW, TH / 2); g.stroke();
  g.beginPath(); g.arc(TW / 2, TH / 2, 12 * S, 0, 7); g.stroke();
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, 2 * HL),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cvs), roughness: 0.85 }));
  pitch.rotation.x = -Math.PI / 2; pitch.receiveShadow = true; scene.add(pitch);
  const out = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshBasicMaterial({ color: 0x04070c }));
  out.rotation.x = -Math.PI / 2; out.position.y = -0.1; scene.add(out);

  const wm = new THREE.MeshBasicMaterial({ color: 0x2fffc8, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false });
  const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
  wall(2 * HL, CEIL, -HW, CEIL / 2, 0, Math.PI / 2); wall(2 * HL, CEIL, HW, CEIL / 2, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    for (const x of [-1, 1]) wall(HW - GW, CEIL, x * (GW + (HW - GW) / 2), CEIL / 2, s * HL, 0);
    wall(2 * GW, CEIL - GH, 0, GH + (CEIL - GH) / 2, s * HL, 0);
    const col = s > 0 ? ORANGE : BLUE, mat = new THREE.MeshBasicMaterial({ color: col });
    const post = (x, y, w, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.7), mat); m.position.set(x, y, s * HL); scene.add(m); };
    post(-GW, GH / 2, 0.7, GH); post(GW, GH / 2, 0.7, GH); post(0, GH, 2 * GW + 0.7, 0.7);
    const net = new THREE.Mesh(new THREE.BoxGeometry(2 * GW, GH, GD, 10, 5, 4),
      new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: 0.3 }));
    net.position.set(0, GH / 2, s * (HL + GD / 2)); scene.add(net);
    const pl = new THREE.PointLight(col, 1.2, 45); pl.position.set(0, 5, s * (HL - 4)); scene.add(pl);
  }
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HW, CEIL, 2 * HL)),
    new THREE.LineBasicMaterial({ color: 0x37f2c0, transparent: true, opacity: 0.6 }));
  edges.position.y = CEIL / 2; scene.add(edges);
}
buildArena();
function buildStadium() {
  const st = new Float32Array(900);
  for (let i = 0; i < 300; i++) { const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.2, r = 520;
    st[i * 3] = Math.cos(a) * Math.cos(e) * r; st[i * 3 + 1] = Math.sin(e) * r; st[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, fog: false })));
  const spots = [];
  for (let r = 0; r < 10; r++) {
    const off = 10 + r * 1.7, y = 2 + r * 1.4;
    for (let z = -HL - 6; z <= HL + 6; z += 2) spots.push([-HW - off, y, z], [HW + off, y, z]);
    for (let x = -HW; x <= HW; x += 2) spots.push([x, y, -HL - GD - off + 2], [x, y, HL + GD + off - 2]);
  }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), pal = [0x16324a, 0x1d4766, 0x3a2a1c, 0x5a3a1a, 0x24415c, 0x0f2236, 0x2fb8ff, 0xff8a1f];
  spots.forEach((p, i) => { m4.setPosition(p[0], p[1], p[2]); im.setMatrixAt(i, m4); col.setHex(pal[Math.random() < 0.92 ? (i * 7) % 6 : 6 + (i % 2)]); im.setColorAt(i, col); });
  scene.add(im);
  for (const x of [-1, 1]) for (const z of [-1, 1]) {
    const px = x * (HW + 32), pz = z * (HL + 32);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(1.2, 50, 1.2), new THREE.MeshBasicMaterial({ color: 0x10202c })); pole.position.set(px, 25, pz);
    const head = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff6d8 })); head.position.set(px, 50, pz); head.lookAt(0, 10, 0);
    scene.add(pole, head);
  }
}
buildStadium();

function carMesh(col) {
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const body = new THREE.Group(); root.add(body);
  const paint = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.3, emissive: col, emissiveIntensity: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b1420, roughness: 0.3, metalness: 0.5 });
  const add = (geo, mat, x, y, z, rz) => {
    const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); if (rz) o.rotation.z = rz; o.castShadow = true; body.add(o);
  };
  add(new THREE.BoxGeometry(2, 0.6, 3.4), paint, 0, 0, 0);
  add(new THREE.BoxGeometry(1.6, 0.5, 1.7), dark, 0, 0.5, -0.2);
  add(new THREE.BoxGeometry(2.05, 0.15, 0.5), dark, 0, 0.38, -1.55);
  for (const x of [-1.05, 1.05]) for (const z of [-1.1, 1.1]) add(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 16), dark, x, -0.1, z, Math.PI / 2);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0xffa030 }));
  flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0, -2.6); flame.visible = false; body.add(flame);
  scene.add(root); return { root, body, flame };
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
const SKILL = [{ thr: 0.6, boost: false, steer: 2, cap: 0.6, wait: 1.5 }, { thr: 0.8, boost: true, steer: 2.6, cap: 0.8, wait: 0.8 }, { thr: 1, boost: true, steer: 4, cap: 1, wait: 0.2 }];
function mkCar(team, k, ai) {
  const col = new THREE.Color(team ? ORANGE : BLUE).offsetHSL(0, 0, -0.09 * k);
  return { team, k, x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, ai, aiCd: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fx: 0, fz: 0, fl: 0, ground: true, mesh: carMesh(col) };
}
function buildTeams() {
  for (const c of cars) scene.remove(c.mesh.root);
  cars = [];
  for (let k = 0; k < mode; k++) cars.push(mkCar(0, k, k > 0));
  for (let k = 0; k < mode; k++) cars.push(mkCar(1, k, true));
}
const pads = [];
for (const [x, z, big] of [[-46, -70, 1], [46, -70, 1], [-46, 70, 1], [46, 70, 1], [-46, 0, 1], [46, 0, 1], [0, -48], [0, 48], [-26, -26], [26, -26], [-26, 26], [26, 26], [0, 0], [-32, -54], [32, -54], [-32, 54], [32, 54]]) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(big ? 2.8 : 1.8, big ? 2.8 : 1.8, 0.15, 24), new THREE.MeshBasicMaterial({ color: big ? 0xffd35a : 0x37f2c0, transparent: true }));
  m.position.set(x, 0.08, z); scene.add(m); pads.push({ x, z, big: !!big, t: 0, mesh: m });
}
const FORM = [[0, 0.55], [-16, 0.78], [16, 0.78]];
function kickoff() {
  Object.assign(ball, { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0 });
  for (const c of cars) {
    const f = FORM[c.k], s = c.team ? 1 : -1;
    Object.assign(c, { x: f[0] * (c.team ? -1 : 1), y: 0.55, z: s * f[1] * HL, vx: 0, vy: 0, vz: 0, yaw: c.team ? Math.PI : 0, pitch: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fl: 0, ground: true, aiCd: 0, wait: SKILL[diff].wait });
  }
}
function start() {
  sfx.init(); buildTeams(); score = [0, 0]; clock = MATCH; ot = false; pads.forEach(p => p.t = 0);
  kickoff(); state = 'kick'; cd = 3; $('menu').style.display = 'none'; $('msg').textContent = '';
}
function pick(k, v) {
  if (k === 'mode') mode = v; else diff = v;
  for (const b of document.querySelectorAll('[data-' + k + ']')) b.classList.toggle('on', +b.dataset[k] === v);
}

// particles (one Points object, additive blending)
const NP = 800, pp = { x: new Float32Array(NP * 3), c: new Float32Array(NP * 3), v: new Float32Array(NP * 3), col: new Float32Array(NP * 3), life: new Float32Array(NP), max: new Float32Array(NP), i: 0 };
const pgeo = new THREE.BufferGeometry();
pgeo.setAttribute('position', new THREE.BufferAttribute(pp.x, 3)); pgeo.setAttribute('color', new THREE.BufferAttribute(pp.c, 3));
const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 1.4, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
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
  for (let n = 0; n < 2; n++) emit(c.x - fx * 2.3, c.y - fy * 2.3, c.z - fz * 2.3, -fx * 9 + (Math.random() - 0.5) * 3, -fy * 9 + (Math.random() - 0.5) * 3, -fz * 9 + (Math.random() - 0.5) * 3, 0.4, 1, 0.5 + Math.random() * 0.4, 0.15);
}
function sparks(vn) {
  for (let i = 0; i < 8; i++) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 14, Math.random() * 10, (Math.random() - 0.5) * 14, 0.35, 1, 1, 0.9);
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
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code] && e.code === 'Space') jumpQ = true;
  if (!keys[e.code] && e.code === 'KeyC') { ballCam = !ballCam; $('cam').textContent = ballCam ? 'Ball cam (C)' : 'Chase cam (C)'; }
  if (e.code === 'Enter' && (state === 'menu' || state === 'over')) start();
  if (state === 'menu' || state === 'over') {
    const n = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code], d = { Digit4: 0, Digit5: 1, Digit6: 2 }[e.code];
    if (n) pick('mode', n); if (d !== undefined) pick('diff', d);
  }
  if (e.code === 'KeyM') muted = !muted;
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
$('menu').addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('button');
  if (b) { if (b.dataset.mode) pick('mode', +b.dataset.mode); else pick('diff', +b.dataset.diff); }
  else if (state === 'menu' || state === 'over') start();
});
function playerCtl() {
  const j = jumpQ; jumpQ = false;
  return {
    throttle: ((keys.KeyW || keys.ArrowUp) ? 1 : 0) - ((keys.KeyS || keys.ArrowDown) ? 1 : 0),
    steer: ((keys.KeyD || keys.ArrowRight) ? 1 : 0) - ((keys.KeyA || keys.ArrowLeft) ? 1 : 0),
    jump: j, boost: !!(keys.ShiftLeft || keys.ShiftRight)
  };
}
function aiCtl(c, dt) {
  c.aiCd -= dt;
  const sk = SKILL[diff], ct = { throttle: sk.thr, steer: 0, jump: false, boost: false };
  c.cap = sk.cap; if (c.wait > 0) { c.wait -= dt; ct.throttle = 0; return ct; }
  const own = c.team ? HL : -HL, ag = -own, d2b = o => Math.hypot(ball.x - o.x, ball.z - o.z);
  const rank = cars.filter(o => o.team === c.team).sort((a, b) => d2b(a) - d2b(b)).indexOf(c), bd = d2b(c);
  const chase = rank === 0 || bd < 18; let tx, tz;
  if (chase) { // line up behind the ball, facing the enemy goal
    let ux = -ball.x, uz = ag - ball.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    tx = ball.x - ux * 5; tz = ball.z - uz * 5;
    const rx = c.x - ball.x, rz = c.z - ball.z;
    if (rx * ux + rz * uz > -2) { const px = -uz, pz = ux, sg = (rx * px + rz * pz) >= 0 ? 1 : -1; tx = ball.x - ux * 12 + px * sg * 9; tz = ball.z - uz * 12 + pz * sg * 9; }
  } else if (rank === 1) { tx = ball.x * 0.5; tz = ball.z * 0.5 + own * 0.45; } // support
  else { tx = clamp(ball.x * 0.4, -GW, GW); tz = own * 0.8; } // goalie
  tx = clamp(tx, -HW + 4, HW - 4); tz = clamp(tz, -HL + 6, HL - 6);
  const dx = tx - c.x, dz = tz - c.z, dist = Math.hypot(dx, dz), parked = !chase && dist < 5;
  const da = wrap(Math.atan2(parked ? ball.x - c.x : dx, parked ? ball.z - c.z : dz) - c.yaw);
  ct.steer = -clamp(da * sk.steer, -1, 1);
  if (parked) ct.throttle = 0;
  ct.boost = !!sk.boost && c.boost > (chase ? 10 : 40) && Math.abs(da) < 0.25 && dist > 14;
  if (c.ground && chase && bd < 11 && ball.y > 4 && c.aiCd <= 0) { ct.jump = true; c.aiCd = 1; }
  if (!c.ground) { ct.throttle = 0; if (c.jumps === 1 && c.jt > 0.2 && bd < 7 && c.aiCd <= 0.4 && diff > 0) { ct.jump = true; ct.dodge = [1, 0]; c.aiCd = 1; } }
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
    c.jumps = 0; c.jt = 0; c.pitch *= Math.max(0, 1 - 10 * dt);
    let vf = c.vx * sy + c.vz * cy, vs = c.vx * cy - c.vz * sy;
    if (ct.throttle) vf += ct.throttle * (vf * ct.throttle < 0 ? 55 : 30) * dt; else vf *= Math.max(0, 1 - 1.3 * dt);
    if (bo) vf += 55 * dt;
    vf = clamp(vf, -14, (bo ? 48 : 28) * (c.cap || 1)); vs *= Math.max(0, 1 - 9 * dt);
    c.yaw -= ct.steer * 2.3 * clamp(Math.abs(vf) / 8, 0, 1) * (vf >= 0 ? 1 : -1) * dt;
    c.vx = sy * vf + cy * vs; c.vz = cy * vf - sy * vs; c.vy = 0;
  } else {
    c.vy -= G_CAR * dt; c.yaw -= ct.steer * 2.4 * dt;
    c.pitch = clamp(c.pitch - ct.throttle * 3 * dt, -1.3, 1.3);
    if (bo) {
      const cp = Math.cos(c.pitch);
      c.vx += sy * cp * 55 * dt; c.vy += Math.sin(c.pitch) * 55 * dt; c.vz += cy * cp * 55 * dt;
    }
    const sp = Math.hypot(c.vx, c.vy, c.vz); if (sp > 52) { const k = 52 / sp; c.vx *= k; c.vy *= k; c.vz *= k; }
  }
  if (ct.jump) {
    if (ground) { c.vy = 11; c.jumps = 1; c.jt = 0; c.y += 0.05; }
    else if (c.jumps === 1 && c.jt < 1.4) {
      c.jumps = 2;
      const f = ct.dodge ? ct.dodge[0] : ct.throttle, s = ct.dodge ? ct.dodge[1] : ct.steer;
      if (f || s) { c.vx += (sy * f - cy * s) * 13; c.vz += (cy * f + sy * s) * 13; c.vy = Math.max(c.vy, 3); c.flip = 0.55; c.fx = f; c.fz = s; }
      else c.vy = 9.5;
    }
  }
  if (c.ai) c.boost = Math.min(100, c.boost + 8 * dt);
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  if (c.y < 0.55) { c.y = 0.55; if (c.vy < 0) c.vy = 0; }
  if (c.y > CEIL - 0.6) { c.y = CEIL - 0.6; if (c.vy > 0) c.vy = 0; }
  if (Math.abs(c.x) > HW - 1.3) { c.x = Math.sign(c.x) * (HW - 1.3); c.vx *= -0.2; }
  if (Math.abs(c.z) > HL - 1.9) { c.z = Math.sign(c.z) * (HL - 1.9); c.vz *= -0.2; }
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
  let nf = lf - clamp(lf, -1.7, 1.7), nl = ll - clamp(ll, -1, 1), ny = dy - clamp(dy, -0.55, 0.55);
  let d = Math.hypot(nf, nl, ny);
  if (d >= BR) return;
  if (d < 1e-4) { nf = nl = 0; ny = 1; d = 0; } else { nf /= d; nl /= d; ny /= d; }
  const nx = sy * nf + cy * nl, nz = cy * nf - sy * nl;
  ball.x += nx * (BR - d); ball.y += ny * (BR - d); ball.z += nz * (BR - d);
  const vn = (ball.vx - c.vx) * nx + (ball.vy - c.vy) * ny + (ball.vz - c.vz) * nz;
  if (vn < 0) {
    if (vn < -4) sparks(vn);
    const j = -1.6 * vn / (1 + 1 / CM);
    ball.vx += nx * j; ball.vy += ny * j; ball.vz += nz * j;
    c.vx -= nx * j / CM; c.vy -= ny * j / CM; c.vz -= nz * j / CM;
    if (c.fl) { ball.vx += nx * 4; ball.vy += ny * 4; ball.vz += nz * 4; }
    if (c.ground) ball.vy += 2;
  }
  const s = Math.hypot(ball.vx, ball.vy, ball.vz); if (s > 60) { const k = 60 / s; ball.vx *= k; ball.vy *= k; ball.vz *= k; }
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
  if (Math.abs(ball.x) > HW - BR && az <= HL) { ball.x = Math.sign(ball.x) * (HW - BR); ball.vx = -Math.sign(ball.x) * Math.abs(ball.vx) * 0.72; }
  if (az > HL) { // inside a goal pocket
    if (Math.abs(ball.x) > GW - BR) { ball.x = Math.sign(ball.x) * (GW - BR); ball.vx = -Math.sign(ball.x) * Math.abs(ball.vx) * 0.5; }
    if (ball.y > GH - BR) { ball.y = GH - BR; ball.vy = -Math.abs(ball.vy) * 0.5; }
    if (az > HL + GD - BR) { ball.z = sz * (HL + GD - BR); ball.vz = -sz * Math.abs(ball.vz) * 0.4; }
  } else if (az > HL - BR && !(Math.abs(ball.x) + BR < GW && ball.y + BR < GH)) {
    ball.z = sz * (HL - BR); ball.vz = -sz * Math.abs(ball.vz) * 0.72;
  }
}
function goal(team) {
  score[team]++; state = 'goal'; cd = 3;
  const m = $('msg'); m.textContent = (team ? 'ORANGE' : 'BLUE') + ' SCORES!'; m.style.color = team ? '#ff8a1f' : '#2fb8ff';
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
  if (state === 'play') { clock -= dt; if (clock <= 0) { clock = 0; if (score[0] === score[1]) ot = true; else state = 'over'; } }
  else if (state === 'goal') {
    cd -= dt; dt *= 0.5;
    if (cd <= 0) { $('msg').textContent = ''; if (ot) state = 'over'; else { kickoff(); state = 'kick'; cd = 2.5; } return; }
  } else return;
  const cts = cars.map((c, i) => i === 0 ? playerCtl() : aiCtl(c, dt));
  for (let n = 0; n < 2; n++) {
    const h = dt / 2;
    cars.forEach((c, i) => stepCar(c, cts[i], h)); cts.forEach(ct => { ct.jump = false; });
    bump(); stepBall(h); cars.forEach(hitBall);
  }
  if (state === 'over') {
    const m = $('msg'); m.style.color = '#fff'; m.textContent = score[0] > score[1] ? 'YOU WIN' : 'ORANGE WINS';
    $('mt').textContent = score[0] + ' - ' + score[1]; $('go').textContent = 'Press Enter or click to play again'; $('menu').style.display = 'grid';
  }
}

// ---------- camera + render ----------
const cam = { x: 0, y: 6, z: -60, lx: 0, ly: 2, lz: 0 };
const axis = new THREE.Vector3();
function updateCam(dt) {
  const c = cars[0]; let dx = -Math.sin(c.yaw), dz = -Math.cos(c.yaw);
  if (ballCam) { const bx = c.x - ball.x, bz = c.z - ball.z, l = Math.hypot(bx, bz); if (l > 0.5) { dx = bx / l; dz = bz / l; } }
  const k = 1 - Math.exp(-7 * dt);
  const tx = clamp(c.x + dx * 11, -HW + 1, HW - 1), tz = clamp(c.z + dz * 11, -HL - 5, HL + 5), ty = clamp(c.y + 4.6, 2, CEIL - 1);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k;
  let lx = c.x - dx * 9, ly = 1.5, lz = c.z - dz * 9;
  if (ballCam) { lx = ball.x; ly = ball.y; lz = ball.z; }
  cam.lx += (lx - cam.lx) * k; cam.ly += (ly - cam.ly) * k; cam.lz += (lz - cam.lz) * k;
  camera.position.set(cam.x, cam.y, cam.z); camera.lookAt(cam.lx, cam.ly, cam.lz);
  camera.fov += (70 + Math.hypot(c.vx, c.vy, c.vz) * 0.4 + (c.fl ? 6 : 0) - camera.fov) * k; camera.updateProjectionMatrix();
}
function render(dt) {
  for (const c of cars) {
    const m = c.mesh;
    m.root.position.set(c.x, c.y, c.z); m.root.rotation.set(-c.pitch, c.yaw, 0);
    m.flame.visible = !!c.fl; m.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    m.body.rotation.set(0, 0, 0);
    if (c.flip > 0) {
      const a = (1 - c.flip / 0.55) * Math.PI * 2;
      if (Math.abs(c.fx) >= Math.abs(c.fz)) m.body.rotation.x = a * Math.sign(c.fx); else m.body.rotation.z = a * Math.sign(c.fz);
    }
  }
  ballMesh.position.set(ball.x, ball.y, ball.z);
  const sp = Math.hypot(ball.vx, ball.vz);
  if (sp > 0.05) { axis.set(ball.vz, 0, -ball.vx).normalize(); ballMesh.rotateOnWorldAxis(axis, sp * dt / BR); }
  if (state === 'play' && Math.hypot(sp, ball.vy) > 26) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, 0.3, 0.9, 0.8);
  for (const p of pads) p.mesh.material.opacity = p.t > 0 ? 0.12 : 0.9;
  stepParts(dt); drawMini(); sfx.update(cars[0], state === 'play'); updateCam(dt);
  $('s0').textContent = score[0]; $('s1').textContent = score[1];
  const s = Math.ceil(clock); $('clock').textContent = ot ? 'OT' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const b = cars[0].boost; $('bf').style.width = (2.1 * b) + 'px'; $('bt').textContent = Math.round(b);
  $('bf').style.background = b > 66 ? '#ffd35a' : '#37f2c0';
  renderer.render(scene, camera);
}

// ---------- loop ----------
buildTeams(); kickoff(); pick('mode', 2); pick('diff', 1);
window.rocketArena = { ball, get cars() { return cars; }, get score() { return score; }, get state() { return state; } };
let last = performance.now();
(function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); render(dt); requestAnimationFrame(loop);
})(last);
})();
