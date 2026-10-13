(() => {
'use strict';
// ---------- tuning ----------
const W = 1200, H = 600, GROUND = 540, GOALH = 190, GOALD = 80, MARG = 80;
const BR = 30, CM = 4, GRAV = 1500, MATCH = 120;
const BLUE = '#2fb8ff', ORANGE = '#ff8a1f', FONT = '"Arial Narrow","Helvetica Neue",Impact,sans-serif';

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const CW = W + 2 * MARG;
cv.width = CW; cv.height = H;

// ---------- input ----------
let state = 'menu', t = 0, score = [0, 0], clock = MATCH, ot = false, msg = '', msgCol = '#fff', cd = 0;
const keys = {}; let jumpQ = false;
const JUMP = ['Space', 'ArrowUp', 'KeyW'];
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!keys[e.code] && JUMP.includes(e.code)) jumpQ = true;
  if (e.code === 'Enter' && (state === 'menu' || state === 'over')) start();
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('pointerdown', () => { if (state === 'menu' || state === 'over') start(); });

// ---------- world ----------
const ball = { x: W / 2, y: 230, vx: 0, vy: 0, rot: 0 };
let cars = [], pads = [], parts = [];
const mkCar = (x, h, col, ai) => ({ x, y: GROUND - 16, vx: 0, vy: 0, h, col, ai, boost: 34, jumps: 0, jt: 0, spin: 0, fl: 0, ground: true });

function kickoff() {
  ball.x = W / 2; ball.y = 230; ball.vx = ball.vy = 0;
  cars = [mkCar(W * 0.28, 0, BLUE, false), mkCar(W * 0.72, Math.PI, ORANGE, true)];
}
function resetPads() {
  pads = [[60, 100], [W - 60, 100], [320, 35], [600, 35], [880, 35]].map(([x, v]) => ({ x, v, t: 0 }));
}
function start() {
  score = [0, 0]; clock = MATCH; ot = false; resetPads(); kickoff(); parts = [];
  state = 'kick'; cd = 3; jumpQ = false;
}

// ---------- controls ----------
function playerCtl() {
  const m = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
  const j = jumpQ; jumpQ = false;
  return { move: m, jump: j, boost: !!(keys.ShiftLeft || keys.ShiftRight || keys.ArrowDown || keys.KeyS) };
}
let aiCd = 0;
function aiCtl(c, dt) {
  const ct = { move: 0, jump: false, boost: false }; aiCd -= dt;
  const dx = ball.x - c.x, dy = ball.y - c.y, dist = Math.hypot(dx, dy);
  if (c.ground) {
    let tx = ball.x + (ball.x > W - 260 ? 45 : 85); tx = Math.min(tx, W - 70);
    const d = tx - c.x, face = Math.cos(c.h) >= 0 ? 1 : -1;
    if (Math.abs(d) > 20) ct.move = Math.sign(d);
    ct.boost = Math.abs(d) > 300 && c.boost > 15 && Math.sign(d) === face;
    if (Math.abs(dx) < 150 && dy < -20 && aiCd <= 0) { ct.jump = true; aiCd = 0.8; }
  } else {
    let df = Math.atan2(dy, dx) - c.h;
    while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI;
    ct.move = Math.abs(df) > 0.12 ? Math.sign(df) : 0;
    ct.boost = Math.abs(df) < 0.5 && dist < 450 && c.boost > 10;
    if (c.jumps === 1 && c.jt > 0.12 && dist < 130 && aiCd <= 0) { ct.jump = true; ct.flip = dx < 0 ? -1 : 1; aiCd = 0.5; }
  }
  return ct;
}

// ---------- physics ----------
function stepCar(c, ct, dt) {
  c.jt += dt; if (c.spin > 0) c.spin -= dt;
  const ground = c.y >= GROUND - 16.5; c.ground = ground;
  if (ground) {
    c.jumps = 0; c.jt = 0;
    if (ct.move) { c.h = ct.move > 0 ? 0 : Math.PI; c.vx += ct.move * 1600 * dt; }
    else c.vx *= Math.max(0, 1 - 2.2 * dt);
    c.h = Math.cos(c.h) >= 0 ? 0 : Math.PI;
  } else {
    c.h += ct.move * 5.2 * dt; c.vy += GRAV * dt;
    if (c.h > Math.PI) c.h -= 2 * Math.PI; if (c.h < -Math.PI) c.h += 2 * Math.PI;
  }
  if (ct.jump) {
    if (ground) { c.vy = -580; c.jumps = 1; c.jt = 0; c.y -= 2; }
    else if (c.jumps === 1 && c.jt < 1.5) {
      c.jumps = 2; c.spin = 0.4;
      const m = ct.flip !== undefined ? ct.flip : ct.move;
      if (m) { c.vx += m * 700; c.vy = Math.min(c.vy, -100); } else c.vy = -420;
    }
  }
  c.fl = 0;
  if (ct.boost && c.boost > 0) {
    c.vx += Math.cos(c.h) * 2400 * dt; c.vy += Math.sin(c.h) * 2400 * dt;
    c.boost = Math.max(0, c.boost - 34 * dt); c.fl = 1;
    parts.push({ x: c.x - Math.cos(c.h) * 38, y: c.y - Math.sin(c.h) * 38, vx: -Math.cos(c.h) * 220 + (Math.random() - .5) * 90,
      vy: -Math.sin(c.h) * 220 + (Math.random() - .5) * 90, life: .35, max: .35, r: 7, col: Math.random() < .5 ? '#ffd35a' : '#ff6a2a' });
  }
  if (c.ai) c.boost = Math.min(100, c.boost + 10 * dt);
  if (ground) c.vx = Math.max(-(c.fl ? 980 : 560), Math.min(c.fl ? 980 : 560, c.vx));
  const sp = Math.hypot(c.vx, c.vy); if (sp > 1000) { c.vx *= 1000 / sp; c.vy *= 1000 / sp; }
  c.x += c.vx * dt; c.y += c.vy * dt;
  if (c.y >= GROUND - 16) { c.y = GROUND - 16; if (c.vy > 0) c.vy = 0; }
  if (c.y < 16) { c.y = 16; c.vy = Math.max(c.vy, 0); }
  if (c.x < 40) { c.x = 40; c.vx = Math.abs(c.vx) * 0.2; }
  if (c.x > W - 40) { c.x = W - 40; c.vx = -Math.abs(c.vx) * 0.2; }
  for (const p of pads) {
    p.t = Math.max(0, p.t - dt);
    if (p.t <= 0 && c.y > GROUND - 60 && Math.abs(c.x - p.x) < 50 && c.boost < 100) { c.boost = Math.min(100, c.boost + p.v); p.t = 5; }
  }
}
function hitBall(c) {
  for (const o of [-22, 0, 22]) {
    const px = c.x + Math.cos(c.h) * o, py = c.y + Math.sin(c.h) * o;
    const dx = ball.x - px, dy = ball.y - py, d = Math.hypot(dx, dy) || 0.01, min = BR + 16;
    if (d < min) {
      const nx = dx / d, ny = dy / d;
      ball.x = px + nx * min; ball.y = py + ny * min;
      const vn = (ball.vx - c.vx) * nx + (ball.vy - c.vy) * ny;
      if (vn < 0) {
        const j = -1.55 * vn / (1 + 1 / CM);
        ball.vx += nx * j; ball.vy += ny * j; c.vx -= nx * j / CM; c.vy -= ny * j / CM;
        if (c.fl) { ball.vx += nx * 140; ball.vy += ny * 140; }
        for (let i = 0; i < 6; i++) parts.push({ x: ball.x - nx * BR, y: ball.y - ny * BR, vx: (Math.random() - .5) * 240, vy: (Math.random() - .5) * 240, life: .3, max: .3, r: 3, col: '#fff' });
      }
    }
  }
  const s = Math.hypot(ball.vx, ball.vy); if (s > 1500) { ball.vx *= 1500 / s; ball.vy *= 1500 / s; }
}
function stepBall(dt) {
  ball.vy += GRAV * 0.62 * dt; ball.vx *= 1 - 0.1 * dt;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.rot += ball.vx * dt / BR;
  if (ball.y + BR > GROUND) { ball.y = GROUND - BR; ball.vy = -ball.vy * 0.74; if (Math.abs(ball.vy) < 70) ball.vy = 0; ball.vx *= 1 - 0.5 * dt; }
  if (ball.y - BR < 0) { ball.y = BR; ball.vy = Math.abs(ball.vy) * 0.7; }
  if (state === 'play') {
    if (ball.x < 0 && ball.y > GROUND - GOALH + 4) return goal(1);
    if (ball.x > W && ball.y > GROUND - GOALH + 4) return goal(0);
  }
  const mouth = ball.y - BR > GROUND - GOALH;
  if (ball.x - BR < 0) {
    if (!mouth && ball.x > -BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * 0.8; }
    else if (ball.x < -GOALD + BR) { ball.x = -GOALD + BR; ball.vx = Math.abs(ball.vx) * 0.4; }
  }
  if (ball.x + BR > W) {
    if (!mouth && ball.x < W + BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx) * 0.8; }
    else if (ball.x > W + GOALD - BR) { ball.x = W + GOALD - BR; ball.vx = -Math.abs(ball.vx) * 0.4; }
  }
}
function goal(team) {
  score[team]++; state = 'goal'; cd = 2.4;
  msg = (team === 0 ? 'BLUE' : 'ORANGE') + ' SCORES!'; msgCol = team === 0 ? BLUE : ORANGE;
  const gx = team === 0 ? W : 0;
  for (let i = 0; i < 70; i++) parts.push({ x: gx, y: GROUND - 80, vx: (team === 0 ? -1 : 1) * Math.random() * 500, vy: -Math.random() * 700,
    life: 1.4, max: 1.4, r: 4, col: ['#fff', msgCol, '#ffd35a'][i % 3], g: 900 });
}

function update(dt) {
  t += dt;
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; }
  parts = parts.filter(p => p.life > 0);
  if (state === 'kick') { cd -= dt; jumpQ = false; if (cd <= 0) state = 'play'; return; }
  if (state === 'play') {
    clock -= dt;
    if (clock <= 0) { clock = 0; if (score[0] === score[1]) ot = true; else state = 'over'; }
  } else if (state === 'goal') {
    cd -= dt; dt *= 0.55;
    if (cd <= 0) { if (ot) state = 'over'; else { kickoff(); state = 'kick'; cd = 2.4; } return; }
  } else return;
  const pc = playerCtl(), ac = aiCtl(cars[1], dt);
  for (let i = 0; i < 2; i++) {
    const h = dt / 2;
    stepCar(cars[0], pc, h); stepCar(cars[1], ac, h);
    pc.jump = ac.jump = false;
    stepBall(h); hitBall(cars[0]); hitBall(cars[1]);
  }
}

// ---------- drawing ----------
function drawBG() {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, '#070d18'); g.addColorStop(1, '#16344a');
  ctx.fillStyle = g; ctx.fillRect(-MARG, 0, CW, H);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * Math.sin(t * 2 + i)})`;
    ctx.fillRect((i * 97) % W, 30 + (i * 53) % 260, 3, 3);
  }
  ctx.fillStyle = '#0b2d2a'; ctx.fillRect(0, GROUND, W, H - GROUND);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.1)'; ctx.fillRect(i * 100, GROUND, 100, H - GROUND); }
  ctx.fillStyle = '#37f2c0'; ctx.fillRect(0, GROUND, W, 3);
  ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, GROUND); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, GROUND, 130, Math.PI, 0); ctx.stroke();
  for (const p of pads) {
    ctx.fillStyle = p.t > 0 ? 'rgba(255,255,255,.08)' : (p.v > 50 ? '#ffd35a' : '#37f2c0');
    ctx.beginPath(); ctx.ellipse(p.x, GROUND + 3, p.v > 50 ? 34 : 22, 5, 0, 0, 7); ctx.fill();
  }
  const top = GROUND - GOALH;
  for (const [x, col] of [[-GOALD, BLUE], [W, ORANGE]]) {
    ctx.fillStyle = col + '22'; ctx.fillRect(x, top, GOALD, GOALH);
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= GOALD; i += 16) { ctx.moveTo(x + i, top); ctx.lineTo(x + i, GROUND); }
    for (let y = top; y < GROUND; y += 16) { ctx.moveTo(x, y); ctx.lineTo(x + GOALD, y); }
    ctx.stroke(); ctx.fillStyle = col; ctx.fillRect(x, top - 4, GOALD, 5);
  }
  ctx.fillStyle = '#04070c';
  for (const x of [-MARG, W]) { ctx.fillRect(x, 0, MARG, top - 4); ctx.fillRect(x, GROUND + 3, MARG, H); }
  ctx.fillStyle = '#37f2c0'; ctx.fillRect(-2, 0, 3, top - 4); ctx.fillRect(W - 1, 0, 3, top - 4);
}
function drawBall() {
  ctx.save(); ctx.translate(ball.x, ball.y);
  ctx.shadowColor = '#bff'; ctx.shadowBlur = 24;
  const g = ctx.createRadialGradient(-8, -8, 4, 0, 0, BR);
  g.addColorStop(0, '#fff'); g.addColorStop(1, '#9bb3c2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, BR, 0, 7); ctx.fill();
  ctx.shadowBlur = 0; ctx.rotate(ball.rot); ctx.strokeStyle = '#34495a'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * BR * .9, Math.sin(a) * BR * .9); ctx.lineTo(-Math.cos(a) * BR * .9, -Math.sin(a) * BR * .9); }
  ctx.stroke(); ctx.restore();
}
function drawCar(c) {
  ctx.save(); ctx.translate(c.x, c.y);
  const flip = Math.cos(c.h) < 0;
  if (flip) { ctx.rotate(c.h - Math.PI); ctx.scale(-1, 1); } else ctx.rotate(c.h);
  if (c.spin > 0) ctx.rotate((flip ? -1 : 1) * (1 - c.spin / 0.4) * Math.PI * 2);
  ctx.fillStyle = c.col; ctx.beginPath(); ctx.roundRect(-36, -8, 72, 20, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.roundRect(-14, -20, 30, 14, 5); ctx.fill();
  ctx.fillStyle = '#0a1220'; ctx.fillRect(-32, 2, 64, 3);
  for (const x of [-22, 22]) { ctx.beginPath(); ctx.arc(x, 12, 7, 0, 7); ctx.fill(); }
  ctx.restore();
}
function drawParts() {
  for (const p of parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.g ? 1 : p.life / p.max + .3), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function centerText(s, y, size, col) {
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.font = `italic 800 ${size}px ${FONT}`; ctx.fillText(s, CW / 2, y);
}
function hud() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const x = CW / 2;
  ctx.fillStyle = 'rgba(5,10,18,.75)'; ctx.fillRect(x - 170, 10, 340, 56);
  ctx.fillStyle = BLUE; ctx.fillRect(x - 170, 10, 100, 56);
  ctx.fillStyle = ORANGE; ctx.fillRect(x + 70, 10, 100, 56);
  ctx.textAlign = 'center'; ctx.fillStyle = '#04101c'; ctx.font = `italic 800 40px ${FONT}`;
  ctx.fillText(score[0], x - 120, 52); ctx.fillText(score[1], x + 120, 52);
  const s = Math.ceil(clock), tm = ot ? 'OT' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  ctx.fillStyle = '#e8f6ff'; ctx.font = `italic 800 30px ${FONT}`; ctx.fillText(tm, x, 49);
  const b = cars[0].boost;
  ctx.fillStyle = 'rgba(5,10,18,.75)'; ctx.fillRect(22, H - 40, 232, 22);
  ctx.fillStyle = b > 66 ? '#ffd35a' : '#37f2c0'; ctx.fillRect(28, H - 34, 220 * b / 100, 10);
  ctx.textAlign = 'left'; ctx.fillStyle = '#8fb3c4'; ctx.font = `700 12px ${FONT}`; ctx.fillText('BOOST ' + Math.round(b), 28, H - 46);
  if (state === 'kick') centerText(String(Math.ceil(cd)), 230, 120, '#fff');
  if (state === 'goal') centerText(msg, 230, 80, msgCol);
  if (state === 'menu' || state === 'over') {
    ctx.fillStyle = 'rgba(4,7,12,.72)'; ctx.fillRect(0, 0, CW, H);
    if (state === 'menu') {
      centerText('ROCKET ARENA', 230, 110, '#fff');
      centerText('Score more goals than the orange car before time runs out.', 290, 24, '#8fb3c4');
    } else {
      const w = score[0] > score[1] ? 0 : 1;
      centerText(w === 0 ? 'YOU WIN' : 'ORANGE WINS', 230, 100, w === 0 ? BLUE : ORANGE);
      centerText(score[0] + ' - ' + score[1], 300, 48, '#e8f6ff');
    }
    centerText(state === 'menu' ? 'Press Enter or tap to kick off' : 'Press Enter or tap to play again', 380, 30, '#37f2c0');
  }
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, MARG, 0);
  drawBG(); drawParts(); drawBall(); cars.forEach(drawCar); hud();
}

// ---------- loop ----------
resetPads(); kickoff();
let last = performance.now();
(function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt); draw(); requestAnimationFrame(loop);
})(last);
})();
