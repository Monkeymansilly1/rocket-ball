(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') {
  $('menu').innerHTML = '<h1>Three.js not found</h1><p>Check your connection, or put three.min.js (r149) in the lib/ folder.</p>';
  return;
}
// ---------- tuning (units are roughly metres) ----------
const HW = 80, HL = 104, GW = 15, GH = 10.5, GD = 14, CEIL = 44, CH = 14, BR = 91.25 / 50;
const PHYSICS_TUNING = {
  // Reference constants requested by the project. The playable arena is scaled
  // down (~50 reference units per game unit), so scaled values are used by the solver.
  REFERENCE_SCALE: 50,
  BALL_MASS_REFERENCE: 30, BALL_RADIUS_REFERENCE: 91.25, BALL_VISUAL_RADIUS_REFERENCE: 95,
  BALL_GRAVITY_REFERENCE: 650, BALL_MAX_SPEED_REFERENCE: 6000, BALL_MAX_ANGULAR_SPEED_REFERENCE: 6,
  BALL_DRAG_REFERENCE: 0.03, BALL_FRICTION_REFERENCE: 0.35, BALL_RESTITUTION_REFERENCE: 0.6,
  CAR_MASS_REFERENCE: 180, CAR_MAX_SPEED_REFERENCE: 2300, SUPERSONIC_START_REFERENCE: 2200,
  SUPERSONIC_DROP_REFERENCE: 2100, SUPERSONIC_HOLD_SECONDS: 1,
  GROUND_BOOST_ACCEL_REFERENCE: 991.67, AIR_BOOST_ACCEL_REFERENCE: 1058.33,
  BOOST_CAPACITY: 100, BOOST_DRAIN_PER_SECOND: 33.33, SMALL_BOOST_PICKUP: 12, LARGE_BOOST_PICKUP: 100,
  SMALL_PAD_COOLDOWN: 4, LARGE_PAD_COOLDOWN: 10,
  JUMP_ACCEL_REFERENCE: 1458.33, JUMP_IMPULSE_REFERENCE: 291.67,
  JUMP_HOLD_MIN: 0.025, JUMP_HOLD_MAX: 0.2, DOUBLE_JUMP_WINDOW: 1.25,
  FORWARD_FLIP_SCALE: 1, SIDE_FLIP_SCALE: 1.9, BACKWARD_FLIP_SCALE: 2.5, FLIP_TORQUE_DURATION: 0.65,
  AIR_TORQUE_REFERENCE: { pitch: 130, yaw: 95, roll: 400 },
  AIR_DAMPING_REFERENCE: { pitch: 30, yaw: 20, roll: 50 },
  CAR_WORLD_FRICTION: 0.3, CAR_WORLD_RESTITUTION: 0.3, CAR_CAR_FRICTION: 0.09, CAR_CAR_RESTITUTION: 0.1,
  CAR_BALL_FRICTION: 2, CAR_BALL_RESTITUTION: 0, BUMP_COOLDOWN: 0.25, DEMO_RESPAWN: 3,
  SUSPENSION_STIFFNESS: 500, FRONT_SUSPENSION_FORCE_SCALE: 35.75, REAR_SUSPENSION_FORCE_SCALE: 54.265,
  SUSPENSION_COMPRESSION_DAMPING: 25, SUSPENSION_RELAXATION_DAMPING: 40, MAX_SUSPENSION_TRAVEL: 12,
  POWERSLIDE_RISE_RATE: 5, POWERSLIDE_FALL_RATE: 2, THROTTLE_TORQUE: 72000,
  BRAKE_TORQUE: 2625, AIR_THROTTLE_ACCEL_REFERENCE: 66.67,
  OCTANE_HITBOX_HALF_EXTENTS: { x:120.507, y:86.699, z:38.659 },
  OCTANE_HITBOX_CENTRE_OFFSET: { x:13.876, y:0, z:20.755 },
  ARENA_HALF_EXTENTS_REFERENCE: { x:4096, y:5120 }, ARENA_HEIGHT_REFERENCE: 2048,
  // Stable scaled values used by the current Three.js arena.
  GRAVITY_FORCE: 650 / 50, MAX_SPEED: 2300 / 50, GROUND_MAX_SPEED: 1410 / 50, REVERSE_MAX_SPEED: 24,
  BOOST_FORCE: 991.667 / 50, AIR_BOOST_FORCE: 1058.333 / 50, AIR_LINEAR_DRAG: 0.025, GROUND_ACCELERATION: 1600 / 50,
  TURN_RATE_SLOW: 3.4, TURN_RATE_FAST: 1.4, HANDBRAKE_TURN_MULTIPLIER: 1.6,
  NORMAL_LATERAL_FRICTION: 14, POWERSLIDE_FRICTION_MULTIPLIER: 0.18,
  JUMP_IMPULSE: 291.67 / 50, JUMP_HOLD_FORCE: 1458.33 / 50, JUMP_HOLD_DURATION: 0.2,
  DOUBLE_JUMP_IMPULSE: 291.67 / 50, DODGE_IMPULSE: 17,
  PITCH_TORQUE_SPEED: 3.4, YAW_TORQUE_SPEED: 2.85, ROLL_TORQUE_SPEED: 4.2,
  // Tuned to the existing arena's actual scale for predictable, playable ball movement.
  BALL_GRAVITY_FORCE: 650 / 50, MAX_BALL_SPEED: 6000 / 50, BALL_MAX_ANGULAR_SPEED: 6,
  BALL_RESTITUTION: 0.6, BALL_FLOOR_RESTITUTION: 0.6, BALL_WALL_RESTITUTION: 0.6,
  BALL_SURFACE_FRICTION: 0.35, BALL_HIT_MULTIPLIER: 1.0,
  BALL_HIT_FORWARD_FORCE: 6, BALL_FORWARD_SPEED_FACTOR: 0.34,
  BALL_FLIP_HIT_BONUS: 8, BALL_BOOST_HIT_BONUS: 5,
  BALL_UPWARD_POP: 5.5, BALL_EXTRA_HIT_MAX_RELATIVE_SPEED: 4600 / 50,
  BALL_CAR_MASS_RATIO: 180 / 30
};
const MATCH = 180;
const TEAM_COLOR_PRESETS = {
  normal: { blue: 0x2fb8ff, orange: 0xff8a1f },
  'blue-amber': { blue: 0x0072b2, orange: 0xe69f00 },
  'high-contrast': { blue: 0x00a6ff, orange: 0xff3b30 }
};
let BLUE = 0x2fb8ff, ORANGE = 0xff8a1f;
let gameVolume = 0.75, colourVisionMode = 'normal', controllerDeadZone = 0.16;
let graphicsQuality = 'balanced';
const cameraSettings = { fov: 77, distance: 12, height: 5, stiffness: 7, shake: true };
try {
  const savedSettings = JSON.parse(localStorage.getItem('rocketArenaSettingsV1') || '{}');
  if (Number.isFinite(savedSettings.volume)) gameVolume = Math.max(0, Math.min(1, savedSettings.volume));
  if (['low', 'balanced', 'high'].includes(savedSettings.graphicsQuality)) graphicsQuality = savedSettings.graphicsQuality;
  if (Number.isFinite(savedSettings.deadZone)) controllerDeadZone = Math.max(0.05, Math.min(0.4, savedSettings.deadZone));
  if (savedSettings.camera && typeof savedSettings.camera === 'object') {
    for (const key of ['fov', 'distance', 'height', 'stiffness']) {
      if (Number.isFinite(savedSettings.camera[key])) cameraSettings[key] = savedSettings.camera[key];
    }
    if (typeof savedSettings.camera.shake === 'boolean') cameraSettings.shake = savedSettings.camera.shake;
  }
  if (Object.prototype.hasOwnProperty.call(TEAM_COLOR_PRESETS, savedSettings.colourVisionMode)) colourVisionMode = savedSettings.colourVisionMode;
} catch (_) {}
BLUE = TEAM_COLOR_PRESETS[colourVisionMode].blue;
ORANGE = TEAM_COLOR_PRESETS[colourVisionMode].orange;
const WALL_RAMP_WIDTH = 24, WALL_RAMP_HEIGHT = 9.5;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rampEase = t => t * t * (3 - 2 * t); // smooth start/end avoids jolts; vertical-wall mode takes over at the edge
function rampProfile(distance, outerEdge) {
  const start = outerEdge - WALL_RAMP_WIDTH;
  const span = WALL_RAMP_WIDTH - 0.5;
  const t = clamp((distance - start) / span, 0, 1);
  if (distance <= start) return { height: 0, slope: 0 };
  return { height: WALL_RAMP_HEIGHT * rampEase(t), slope: WALL_RAMP_HEIGHT * 6 * t * (1 - t) / span };
}
function arenaRampAt(x, z) {
  const ax = Math.abs(x), az = Math.abs(z);
  const side = ax > HW - WALL_RAMP_WIDTH ? rampProfile(ax, HW - 0.5) : { height: 0, slope: 0 };
  // Keep the goal mouth open; end ramps and side ramps merge continuously in all four corners.
  const end = ax > GW + 2 && az > HL - WALL_RAMP_WIDTH
    ? rampProfile(az, HL - 0.5) : { height: 0, slope: 0 };
  const a = side.height, b = end.height;
  if (a <= 0 && b <= 0) return { height: 0, dx: 0, dz: 0, side: false };
  // Smooth maximum: matches each straight ramp at its seam, but rounds the corner between them.
  const height = Math.pow(a * a * a * a + b * b * b * b, 0.25);
  const den = Math.max(1e-6, height * height * height);
  const dx = Math.sign(x) * side.slope * a * a * a / den;
  const dz = Math.sign(z) * end.slope * b * b * b / den;
  return { height, dx, dz, side: a >= b };
}
let pitchMesh = null, skyMesh = null, rampMeshMaterial = null;
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

// Collision hitboxes are independent of the visible body mesh. Each car keeps
// its own dimensions, while all vehicles use the same movement/boost rules.
// The Octane half-extents/offset use the supplied reference scaled by 1/50.
const CAR_HITBOXES = {
  octane:   { length:120.507/50, width:86.699/50, height:38.659/50, forward:13.876/50, up:20.755/50 },
  dominus:  { length:2.57, width:1.64, height:0.64, forward:0.18, up:0.38 },
  breakout: { length:2.50, width:1.62, height:0.59, forward:0.18, up:0.39 },
  vortex:   { length:2.44, width:1.74, height:0.70, forward:0.20, up:0.40 },
  striker:  { length:2.58, width:1.52, height:0.54, forward:0.19, up:0.33 },
  raptor:   { length:2.35, width:1.82, height:0.85, forward:0.18, up:0.48 },
  hyperion: { length:2.55, width:1.69, height:0.65, forward:0.22, up:0.36 }
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ac7ec);
scene.fog = new THREE.Fog(0xbcd9e8, 240, 850);
const camera = new THREE.PerspectiveCamera(72, 1, 0.5, 2000);
const camera2 = new THREE.PerspectiveCamera(72, 1, 0.5, 2000);
function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,
    graphicsQuality === 'low' ? 1 : graphicsQuality === 'high' ? 2 : 1.5));
  renderer.setSize(innerWidth, innerHeight, false);
  const split = !!($('localTwo') && $('localTwo').checked && !document.body.classList.contains('free-play'));
  const viewWidth = split ? Math.max(1, Math.floor(innerWidth / 2)) : innerWidth;
  camera.aspect = viewWidth / innerHeight; camera.updateProjectionMatrix();
  camera2.aspect = viewWidth / innerHeight; camera2.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xd8efff, 0x315a43, 1.3));
const fill = new THREE.DirectionalLight(0xb4dcff, 0.75); fill.position.set(-40, 50, -60); scene.add(fill);
const sun = new THREE.DirectionalLight(0xfff1d9, 1.6);
sun.position.set(30, 70, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 240 });
scene.add(sun); scene.add(sun.target);

function buildArena() {
  // Utopia-inspired coliseum field: one uninterrupted render surface uses the
  // SAME height function as car and ball collision physics. No corner patches,
  // disconnected ramp meshes or visible cracks at the seams.
  const resolution = 7, TW = 2 * HW * resolution, TH = 2 * HL * resolution;
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const g = canvas.getContext('2d');
  const tile = 9 * resolution;
  for (let x = 0; x < TW; x += tile) for (let y = 0; y < TH; y += tile) {
    const ix = Math.floor(x / tile), iy = Math.floor(y / tile);
    g.fillStyle = (ix + iy) % 2 ? '#356f35' : '#3e7c3d';
    g.fillRect(x, y, tile, tile);
    // fine mowing lines give the turf some texture without external downloads
    g.fillStyle = 'rgba(240,255,195,.032)';
    g.fillRect(x + tile * 0.18, y, tile * 0.15, tile);
  }
  const line = (points, colour, width) => {
    g.beginPath(); g.moveTo(...points[0]);
    for (const point of points.slice(1)) g.lineTo(...point);
    g.lineWidth = width; g.strokeStyle = colour; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke();
  };
  const px = x => (x + HW) * resolution;
  const pz = z => (HL - z) * resolution;
  g.lineWidth = 3.3 * resolution; g.strokeStyle = 'rgba(246,252,238,.8)';
  g.strokeRect(px(-HW + 10), pz(HL - 10), (2 * HW - 20) * resolution, (2 * HL - 20) * resolution);
  line([[px(-HW + 7),pz(0)],[px(HW - 7),pz(0)]], 'rgba(247,255,248,.76)', 0.65 * resolution);
  g.beginPath(); g.arc(px(0),pz(0),14 * resolution,0,Math.PI*2);
  g.lineWidth = 0.85 * resolution; g.strokeStyle = 'rgba(241,253,249,.9)'; g.stroke();
  g.beginPath(); g.arc(px(0),pz(0),2 * resolution,0,Math.PI*2); g.fillStyle='#e6f7f0'; g.fill();
  for (const sign of [-1, 1]) {
    const col = sign < 0 ? '#28a9ff' : '#ff962a';
    // Large inlaid team-colour lanes match the field references.
    line([[px(-HW+14),pz(sign*(HL-12))],[px(-30),pz(sign*43)],[px(0),pz(sign*27)],[px(30),pz(sign*43)],[px(HW-14),pz(sign*(HL-12))]],
      col,2.1*resolution);
    line([[px(-HW+14),pz(sign*(HL-15))],[px(-31),pz(sign*46)],[px(0),pz(sign*31)],[px(31),pz(sign*46)],[px(HW-14),pz(sign*(HL-15))]],
      'rgba(227,240,241,.6)',0.65*resolution);
    g.strokeStyle = col; g.lineWidth = 1.0 * resolution;
    const boxWide = (GW+12)*2*resolution, depth=19*resolution;
    g.strokeRect(px(0)-boxWide/2,pz(sign*(HL-9))-(sign<0?depth:0),boxWide,depth);
    line([[px(-HW+12),pz(sign*(HL-13))],[px(-HW+12),pz(sign*12)]],
      col,1.15*resolution);
    line([[px(HW-12),pz(sign*(HL-13))],[px(HW-12),pz(sign*12)]],
      col,1.15*resolution);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  texture.colorSpace = THREE.SRGBColorSpace || texture.colorSpace;
  const surfaceGeo = new THREE.PlaneGeometry(2*HW,2*HL,112,148);
  surfaceGeo.rotateX(-Math.PI/2);
  const pos = surfaceGeo.attributes.position;
  for (let i=0;i<pos.count;i++) {
    const z=pos.getZ(i);
    // Clip the ground's four corners into the SAME octagonal perimeter as the
    // playable walls. The boundary now meets the diagonal glass exactly.
    const maxX=HW-Math.max(0,Math.abs(z)-(HL-CH));
    const x=pos.getX(i)*maxX/HW;
    pos.setX(i,x);
    pos.setY(i,arenaRampAt(x,z).height);
  }
  pos.needsUpdate = true; surfaceGeo.computeVertexNormals();
  pitchMesh = new THREE.Mesh(surfaceGeo,new THREE.MeshStandardMaterial({map:texture,roughness:.94,side:THREE.DoubleSide}));
  pitchMesh.receiveShadow = true; scene.add(pitchMesh);

  // The external concourse lives behind the collision walls, not over the turf.
  const stone = new THREE.MeshStandardMaterial({color:0xb6a78c,roughness:.83});
  const concourse = new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),stone);
  concourse.rotation.x = -Math.PI/2; concourse.position.y = -.28; scene.add(concourse);

  const wallBottom = 9.5;
  const glass = new THREE.MeshPhysicalMaterial({
    color:0xa8deef,roughness:.12,metalness:.04,transparent:true,opacity:.095,
    depthWrite:false,side:THREE.DoubleSide
  });
  const barrier = new THREE.MeshStandardMaterial({color:0x29465a,metalness:.45,roughness:.49,side:THREE.DoubleSide});
  const rail = {
    [-1]:new THREE.MeshBasicMaterial({color:BLUE}),
    [1]:new THREE.MeshBasicMaterial({color:ORANGE})
  };
  rail[-1].userData.teamSide='blue'; rail[1].userData.teamSide='orange';
  const trim = new THREE.MeshStandardMaterial({color:0xc3d6d7,roughness:.44,metalness:.35});
  const hexWire = {
    [-1]:new THREE.LineBasicMaterial({color:0x73cfff,transparent:true,opacity:.19,depthWrite:false}),
    [1]:new THREE.LineBasicMaterial({color:0xffb769,transparent:true,opacity:.19,depthWrite:false})
  };
  const hexPanels = (width,height,side) => {
    const verts=[],radius=2.6,dy=Math.sqrt(3)*radius;
    const cols=Math.ceil(width/(radius*3))+2;
    const rows=Math.ceil(height/dy)+2;
    for(let row=0;row<rows;row++) for(let column=0;column<cols;column++){
      const cx=-width/2+column*radius*3 + (row%2)*radius*1.5;
      const cy=dy*row+wallBottom;
      for(let k=0;k<6;k++){
        const a=Math.PI/3*k,b=Math.PI/3*(k+1);
        const x1=cx+radius*Math.cos(a),y1=cy+radius*Math.sin(a);
        const x2=cx+radius*Math.cos(b),y2=cy+radius*Math.sin(b);
        if(x1>=-width/2&&x1<=width/2&&x2>=-width/2&&x2<=width/2&&
          y1>=wallBottom&&y2>=wallBottom&&y1<=CEIL&&y2<=CEIL)
          verts.push(x1,y1,.13,x2,y2,.13);
      }
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    return new THREE.LineSegments(geom,hexWire[side]);
  };
  const segments=[];
  // Every perimeter segment shares endpoints: corners are sealed physically
  // and visually, with an actual opening through both goal mouths.
  for(const sign of [-1,1]){
    for(const side of [-1,1]){
      segments.push([[side*HW,sign*(HL-CH)],[side*HW,0],sign]);
      segments.push([[side*HW,0],[side*HW,-sign*(HL-CH)],-sign]);
      segments.push([[side*HW,sign*(HL-CH)],[side*(HW-CH),sign*HL],sign]);
      segments.push([[side*(GW+.4),sign*HL],[side*(HW-CH),sign*HL],sign]);
    }
  }
  // Remove mirrored duplicate half-wall sections while preserving geometry.
  const seen=new Set();
  for(const [a,b,side] of segments){
    const key=[a,b].map(q=>q.map(v=>v.toFixed(2)).join(',')).sort().join('|');
    if(seen.has(key))continue;seen.add(key);
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    const wallGroup=new THREE.Group();
    wallGroup.position.set(mx,0,mz); wallGroup.rotation.y=Math.atan2(-dz,dx);
    const makeBox=(w,h,d,y,mat)=>{
      const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      o.position.y=y;wallGroup.add(o);return o;
    };
    makeBox(length,wallBottom,.42,wallBottom/2,barrier);
    const upper=new THREE.Mesh(new THREE.PlaneGeometry(length,CEIL-wallBottom),glass);
    upper.position.y=wallBottom+(CEIL-wallBottom)/2;wallGroup.add(upper);
    wallGroup.add(hexPanels(length,CEIL-wallBottom,side));
    makeBox(length,.8,.7,.4,trim);
    makeBox(length,.34,.7,wallBottom,rail[side]);
    makeBox(length,.3,.7,CEIL,trim);
    const slats=Math.max(1,Math.round(length/11));
    for(let i=1;i<slats;i++){
      const bar=makeBox(.28,CEIL-wallBottom,.45,(CEIL+wallBottom)/2,trim);
      bar.position.x=length*(i/slats-.5);
    }
    scene.add(wallGroup);
  }

  // One rounded, lit goal portal at each end with recessed tunnel geometry.
  const goalTunnelDark = new THREE.MeshStandardMaterial({color:0x162432,metalness:.2,roughness:.7,side:THREE.DoubleSide});
  const netMat = new THREE.LineBasicMaterial({color:0xd7e9f9,transparent:true,opacity:.48,depthWrite:false});
  for(const sign of [-1,1]){
    const colorMat=rail[sign];
    const portalZ=sign*HL;
    const goalFloor=new THREE.Mesh(new THREE.BoxGeometry(2*GW,.2,GD),goalTunnelDark);
    goalFloor.position.set(0,-.05,sign*(HL+GD/2));scene.add(goalFloor);
    const goalRoof=new THREE.Mesh(new THREE.BoxGeometry(2*GW,.2,GD),goalTunnelDark);
    goalRoof.position.set(0,GH+.1,sign*(HL+GD/2));scene.add(goalRoof);
    for(const side of [-1,1]){
      const wall=new THREE.Mesh(new THREE.PlaneGeometry(GD,GH),goalTunnelDark);
      wall.position.set(side*GW,GH/2,sign*(HL+GD/2));
      wall.rotation.y=Math.PI/2;scene.add(wall);
    }
    const back=new THREE.Mesh(new THREE.PlaneGeometry(2*GW,GH),goalTunnelDark);
    back.position.set(0,GH/2,sign*(HL+GD));scene.add(back);

    const portal=[];
    portal.push(new THREE.Vector3(-GW,0,portalZ));
    const round=3.6;
    portal.push(new THREE.Vector3(-GW,GH-round,portalZ));
    for(let i=0;i<=8;i++){
      const angle=Math.PI-i/8*(Math.PI/2);
      portal.push(new THREE.Vector3(-GW+round+round*Math.cos(angle),
        GH-round+round*Math.sin(angle),portalZ));
    }
    portal.push(new THREE.Vector3(GW-round,GH,portalZ));
    for(let i=0;i<=8;i++){
      const angle=Math.PI/2-i/8*(Math.PI/2);
      portal.push(new THREE.Vector3(GW-round+round*Math.cos(angle),
        GH-round+round*Math.sin(angle),portalZ));
    }
    portal.push(new THREE.Vector3(GW,0,portalZ));
    const curve=new THREE.CatmullRomCurve3(portal,false,'centripetal');
    const stoneArch=new THREE.Mesh(new THREE.TubeGeometry(curve,60,1.3,8,false),trim);
    scene.add(stoneArch);
    const neon=new THREE.Mesh(new THREE.TubeGeometry(curve,60,.42,8,false),colorMat);
    neon.position.z=-sign*.18;scene.add(neon);
    const goalMesh=[];
    for(let x=-GW;x<=GW+.01;x+=2.3)
      goalMesh.push(x,0,sign*(HL+GD),x,GH,sign*(HL+GD));
    for(let y=0;y<=GH+.01;y+=2.3)
      goalMesh.push(-GW,y,sign*(HL+GD),GW,y,sign*(HL+GD));
    const netGeom=new THREE.BufferGeometry();
    netGeom.setAttribute('position',new THREE.Float32BufferAttribute(goalMesh,3));
    scene.add(new THREE.LineSegments(netGeom,netMat));
    const light=new THREE.PointLight(sign<0?BLUE:ORANGE,1.1,62);
    light.userData.teamSide=sign<0?'blue':'orange';
    light.position.set(0,7,sign*(HL-5));scene.add(light);
  }

  // Add visible blue/orange tiled trim along the smooth ramps, sampled from
  // arenaRampAt so markings hug the playable collision surface.
  const addCurve=(pts,mat,radius=.17)=>{
    const curve=new THREE.CatmullRomCurve3(pts,false,'centripetal');
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(16,pts.length*2),radius,5,false),mat);
    scene.add(mesh);
  };
  for(const sign of [-1,1]){
    for(const sx of [-1,1]){
      const pts=[];
      for(let z=0;z<=HL-CH;z+=4){
        const x=sx*(HW-WALL_RAMP_WIDTH+2),worldZ=sign*z;
        pts.push(new THREE.Vector3(x,arenaRampAt(x,worldZ).height+.17,worldZ));
      }
      addCurve(pts,rail[sign],.23);
    }
    for(const sx of [-1,1]){
      const pts=[];
      for(let x=GW+2;x<=HW-CH;x+=3){
        const worldX=sx*x,z=sign*(HL-WALL_RAMP_WIDTH+2);
        pts.push(new THREE.Vector3(worldX,arenaRampAt(worldX,z).height+.17,z));
      }
      addCurve(pts,rail[sign],.23);
    }
  }
  // Transparent upper enclosure rim under the coliseum seating.
  const borderPoints=[
    [HW-CH,HL],[HW,HL-CH],[HW,-HL+CH],[HW-CH,-HL],
    [-HW+CH,-HL],[-HW,-HL+CH],[-HW,HL-CH],[-HW+CH,HL]
  ];
  const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(
    borderPoints.map(p=>new THREE.Vector3(p[0],CEIL,p[1]))),
    new THREE.LineBasicMaterial({color:0xc5dfff,transparent:true,opacity:.38}));
  scene.add(rim);
}
buildArena();
function buildStadium() {
  // The bowl sits OUTSIDE the glass playable enclosure. Stadium structure is
  // decorative only and cannot cause rogue collisions or interrupt wall riding.
  const stadium = new THREE.Group();
  stadium.name='Coliseum Stadium';
  scene.add(stadium);
  const stone = new THREE.MeshStandardMaterial({color:0xd3c6ae,roughness:.84,metalness:.06});
  const oldStone = new THREE.MeshStandardMaterial({color:0x938c82,roughness:.9});
  const ivory = new THREE.MeshStandardMaterial({color:0xe9d9ba,roughness:.76});
  const dark = new THREE.MeshStandardMaterial({color:0x132338,metalness:.36,roughness:.53});
  const gold = new THREE.MeshBasicMaterial({color:0xffd48c});
  const roofTrim = new THREE.MeshStandardMaterial({color:0xc7b69b,metalness:.2,roughness:.73});
  const blueCloth = new THREE.MeshStandardMaterial({
    color:0x125bb6,roughness:.88,side:THREE.DoubleSide
  });
  const orangeCloth = new THREE.MeshStandardMaterial({
    color:0xe97729,roughness:.88,side:THREE.DoubleSide
  });
  blueCloth.userData.teamSide='blue';
  orangeCloth.userData.teamSide='orange';

  // Bright blue day with wispy procedural clouds, no image downloads.
  const cv=document.createElement('canvas');cv.width=512;cv.height=1024;
  const sky=cv.getContext('2d');
  const gradient=sky.createLinearGradient(0,0,0,cv.height);
  gradient.addColorStop(0,'#2878ba');gradient.addColorStop(.32,'#61ade4');
  gradient.addColorStop(.68,'#a2d5f5');gradient.addColorStop(1,'#e7eef0');
  sky.fillStyle=gradient;sky.fillRect(0,0,cv.width,cv.height);
  const rand=(n)=>{const x=Math.sin(n*216.17+9.3)*49781.232;return x-Math.floor(x);};
  for(let cloud=0;cloud<38;cloud++){
    const x=rand(cloud*3)*cv.width,y=180+rand(cloud*3+1)*480;
    const w=35+rand(cloud*3+2)*105;
    sky.fillStyle='rgba(255,255,255,.08)';
    for(let puff=0;puff<6;puff++){
      sky.beginPath();
      sky.ellipse(x+(puff-2.5)*w*.16,
        y+Math.sin(puff*1.7)*4,w*.23,6+rand(cloud+puff)*10,-.12,0,Math.PI*2);
      sky.fill();
    }
  }
  skyMesh=new THREE.Mesh(new THREE.SphereGeometry(1200,36,20),
    new THREE.MeshBasicMaterial({
      map:new THREE.CanvasTexture(cv),side:THREE.BackSide,fog:false,depthWrite:false
    }));
  skyMesh.renderOrder=-2; scene.add(skyMesh);

  // Squircle outline covers every corner of the rectangular playing field.
  const ringPoint=(a,rx,rz,y)=>{
    const sx=Math.cos(a),sz=Math.sin(a),power=.52;
    return new THREE.Vector3(
      rx*Math.sign(sx)*Math.pow(Math.abs(sx),power),y,
      rz*Math.sign(sz)*Math.pow(Math.abs(sz),power)
    );
  };
  const ringCurve=(rx,rz,y,segments=128)=>{
    const points=[];
    for(let i=0;i<segments;i++)points.push(ringPoint(i/segments*Math.PI*2,rx,rz,y));
    return new THREE.CatmullRomCurve3(points,true,'centripetal');
  };
  const makeRim=(rx,rz,y,rad,mat)=>{
    const pipe=new THREE.Mesh(
      new THREE.TubeGeometry(ringCurve(rx,rz,y),160,rad,5,true),mat);
    stadium.add(pipe);return pipe;
  };
  // Continuous stepped terraces rise up behind the rounded arena walls.
  const steps=18,sectors=144,seatPoints=[],seatColors=[];
  const seatMat=new THREE.MeshStandardMaterial({vertexColors:true,metalness:.06,roughness:.91,side:THREE.DoubleSide});
  const seatVerts=[],seatIndices=[],seatVertsColors=[];
  const blueSeat=new THREE.Color(0x173b68),orangeSeat=new THREE.Color(0x5c3830);
  for(let step=0;step<steps;step++){
    const y=9.0+step*1.83;
    const inX=100+step*2.65,inZ=125+step*2.55;
    const outX=inX+2.72,outZ=inZ+2.64;
    for(let j=0;j<=sectors;j++){
      const a=(j%sectors)/sectors*Math.PI*2;
      const left=ringPoint(a,inX,inZ,y),right=ringPoint(a,outX,outZ,y+.16);
      const ci=(j%sectors)/sectors;
      const paint=(Math.sin(a)<0?blueSeat:orangeSeat).clone()
        .multiplyScalar(.73+.15*Math.cos(ci*13));
      seatVerts.push(...left.toArray(),...right.toArray());
      for(let k=0;k<2;k++)seatVertsColors.push(paint.r,paint.g,paint.b);
      if(j<sectors){
        const b=step*(sectors+1)*2+j*2;
        seatIndices.push(b,b+1,b+2,b+1,b+3,b+2);
      }
    }
  }
  const seatGeo=new THREE.BufferGeometry();
  seatGeo.setAttribute('position',new THREE.Float32BufferAttribute(seatVerts,3));
  seatGeo.setAttribute('color',new THREE.Float32BufferAttribute(seatVertsColors,3));
  seatGeo.setIndex(seatIndices);seatGeo.computeVertexNormals();
  const terraces=new THREE.Mesh(seatGeo,seatMat);
  terraces.receiveShadow=true;stadium.add(terraces);
  for(const i of [0,5,11,17]){
    makeRim(101+i*2.65,126+i*2.55,9+i*1.83,.54,roofTrim);
  }

  // A single GPU-instanced crowd with coloured spectator lights.
  const audienceRows=18,perRow=160,people=audienceRows*perRow;
  const crowd=new THREE.InstancedMesh(
    new THREE.BoxGeometry(.78,.85,.7),
    new THREE.MeshBasicMaterial({color:0xffffff}),people
  );
  const crowdMatrix=new THREE.Matrix4(),crowdColor=new THREE.Color();
  for(let row=0;row<audienceRows;row++){
    for(let j=0;j<perRow;j++){
      const i=row*perRow+j;
      const a=(j+(row%2)*.5)/perRow*Math.PI*2;
      const pos=ringPoint(a,100.4+row*2.65,125.4+row*2.55,10+row*1.83);
      crowdMatrix.makeScale(.87,1,1);
      crowdMatrix.setPosition(pos.x,pos.y,pos.z);
      crowd.setMatrixAt(i,crowdMatrix);
      const blue=pos.z<0;
      const palette=blue ?
        [0x5b95de,0x1672d8,0x98cff7,0x315fa1,0x394b80,0xd2eaff] :
        [0xffab50,0xe87937,0xf7d38f,0xc2522a,0xffdaaa,0x994b2b];
      crowdColor.setHex(palette[Math.floor(rand(i*11)*palette.length)]);
      crowd.setColorAt(i,crowdColor);
    }
  }
  crowd.instanceMatrix.needsUpdate=true;
  crowd.instanceColor.needsUpdate=true;
  crowd.frustumCulled=false;stadium.add(crowd);

  // Lower arcade follows the grandstand instead of floating in the distance.
  const pillarsPerTier=40;
  const makeArcade=(count,rx,rz,baseY,height,span)=>{
    // Stone columns, 3D arches and lintels are all instanced, rather than
    // hundreds of separate draw calls. This also helps integrated GPUs.
    const colMesh=new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.82,1.05,height,8),stone,count*2);
    const archMesh=new THREE.InstancedMesh(
      new THREE.TorusGeometry(span,.88,7,18,Math.PI),ivory,count);
    const capMesh=new THREE.InstancedMesh(
      new THREE.BoxGeometry(span*2+2.5,.8,1.6),roofTrim,count);
    const mtx=new THREE.Matrix4();
    for(let i=0;i<count;i++){
      const a=(i+.5)/count*Math.PI*2,center=ringPoint(a,rx,rz,0);
      const tangent=ringPoint(a+.001,rx,rz,0).sub(ringPoint(a-.001,rx,rz,0)).normalize();
      const angle=Math.atan2(-tangent.z,tangent.x);
      const cs=Math.cos(angle),sn=Math.sin(angle);
      for(const side of [-1,1]){
        mtx.makeTranslation(
          center.x + side*span*cs, baseY+height/2,
          center.z - side*span*sn);
        colMesh.setMatrixAt(i*2+(side>0?1:0),mtx);
      }
      mtx.makeRotationY(angle);
      mtx.setPosition(center.x,baseY+height,center.z);
      archMesh.setMatrixAt(i,mtx);
      mtx.makeRotationY(angle);
      mtx.setPosition(center.x,baseY+height+span+.65,center.z);
      capMesh.setMatrixAt(i,mtx);
    }
    for(const mesh of [colMesh,archMesh,capMesh]){
      mesh.instanceMatrix.needsUpdate=true;
      mesh.frustumCulled=false;
      stadium.add(mesh);
    }
  };
  makeArcade(pillarsPerTier,143,171,36,13,6.35);
  makeRim(145,173,56.2,1.25,stone);

  // The outer high arches are the defining Utopia Coliseum silhouette.
  makeArcade(36,165,196,47,15,7.9);
  makeRim(167,198,70.8,1.7,ivory);

  // Coloured canvas shades over the stands: a proper open-air roof.
  const roofGeo=new THREE.BufferGeometry();
  const roofPos=[],roofCol=[];
  const firstBlue=new THREE.Color(0x104d9d),firstOrange=new THREE.Color(0xc76738);
  for(let i=0;i<144;i++){
    const a0=i/144*Math.PI*2,a1=(i+1)/144*Math.PI*2;
    const mid=(a0+a1)/2;
    const col=(Math.sin(mid)<0?firstBlue:firstOrange).clone()
      .multiplyScalar(i%3===0?.83:1.0);
    const q=[
      ringPoint(a0,145,173,56.5),ringPoint(a1,145,173,56.5),
      ringPoint(a0,165,196,65.8),ringPoint(a1,165,196,65.8)
    ];
    const flat=[q[0],q[1],q[2],q[1],q[3],q[2]];
    for(const vertex of flat) {
      roofPos.push(vertex.x,vertex.y,vertex.z);
      roofCol.push(col.r,col.g,col.b);
    }
  }
  roofGeo.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));
  roofGeo.setAttribute('color',new THREE.Float32BufferAttribute(roofCol,3));
  roofGeo.computeVertexNormals();
  stadium.add(new THREE.Mesh(roofGeo,
    new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.85})));

  // Flags and emblems also share GPU geometry; each colour is one draw call.
  const flagGeo=new THREE.PlaneGeometry(3.5,8.2);
  const crestGeo=new THREE.CircleGeometry(1.06,6);
  const bannerCount=32;
  const bannersBlue=new THREE.InstancedMesh(flagGeo,blueCloth,bannerCount);
  const bannersOrange=new THREE.InstancedMesh(flagGeo,orangeCloth,bannerCount);
  const crestMat=new THREE.MeshBasicMaterial({
    color:0xe8f4ff,transparent:true,opacity:.8,side:THREE.DoubleSide});
  const crests=new THREE.InstancedMesh(crestGeo,crestMat,bannerCount);
  const flagMtx=new THREE.Matrix4();
  const flagBlueIndices=[],flagOrangeIndices=[];
  for(let i=0;i<bannerCount;i++){
    const a=(i+.5)/bannerCount*Math.PI*2,p=ringPoint(a,148,178,0);
    const angle=Math.atan2(p.x,p.z);
    flagMtx.makeRotationY(angle);
    flagMtx.setPosition(p.x,44.3,p.z);
    const bucket=p.z<0?flagBlueIndices:flagOrangeIndices;
    const target=p.z<0?bannersBlue:bannersOrange;
    target.setMatrixAt(bucket.length,flagMtx);bucket.push(i);
    flagMtx.makeRotationY(angle);
    flagMtx.setPosition(p.x,46.0,p.z+.05);
    crests.setMatrixAt(i,flagMtx);
  }
  bannersBlue.count=flagBlueIndices.length;
  bannersOrange.count=flagOrangeIndices.length;
  for(const mesh of [bannersBlue,bannersOrange,crests]){
    mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;stadium.add(mesh);
  }

  // Real double-sided scoreboard panels above the goals, no sponsor ads.
  const screen=document.createElement('canvas');screen.width=512;screen.height=240;
  const cg=screen.getContext('2d');
  cg.fillStyle='#061628';cg.fillRect(0,0,512,240);
  cg.fillStyle='#1d639c';cg.fillRect(0,0,256,15);
  cg.fillStyle='#ff903f';cg.fillRect(256,0,256,15);
  cg.fillStyle='#ebf7ff';cg.textAlign='center';
  cg.font='bold 56px Arial';cg.fillText('ROCKET BALL',256,108);
  cg.font='bold 23px Arial';cg.fillStyle='#90b9df';
  cg.fillText('BLUE       VS       ORANGE',256,166);
  cg.fillStyle='#e2b66e';cg.fillRect(98,189,316,4);
  const screenMaterial=new THREE.MeshBasicMaterial({
    map:new THREE.CanvasTexture(screen),side:THREE.DoubleSide
  });
  for(const sign of [-1,1]){
    const display=new THREE.Mesh(new THREE.PlaneGeometry(32,15),screenMaterial);
    display.position.set(0,49,sign*156);
    display.rotation.y=sign>0?Math.PI:0;
    stadium.add(display);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(34,17,.8),dark);
    frame.position.copy(display.position);
    frame.position.z+=sign*.6;
    stadium.add(frame);
  }

  // Floodlight rigs with emissive bulbs instead of expensive point lights.
  const bulb=new THREE.MeshBasicMaterial({color:0xfff7db});
  const pole=new THREE.MeshStandardMaterial({color:0x8b99aa,metalness:.85,roughness:.28});
  const bulbGeo=new THREE.BoxGeometry(.72,.85,.23),lightCount=12;
  const bulbs=new THREE.InstancedMesh(bulbGeo,bulb,lightCount*18);
  const bulbsMatrix=new THREE.Matrix4();
  for(let i=0;i<lightCount;i++){
    const a=(i+.5)/lightCount*Math.PI*2,p=ringPoint(a,157,186,0);
    const mast=new THREE.Mesh(new THREE.CylinderGeometry(.42,.6,18,8),pole);
    mast.position.set(p.x,63,p.z);stadium.add(mast);
    const head=new THREE.Group();head.position.set(p.x,73,p.z);
    head.rotation.y=Math.atan2(-p.x,-p.z);
    const housing=new THREE.Mesh(new THREE.BoxGeometry(10.5,4.4,1.1),dark);
    head.add(housing);stadium.add(head);
    for(let k=0;k<18;k++){
      const b=(i*18+k),column=k%6,row=Math.floor(k/6);
      const local=new THREE.Vector3(-4.4+column*1.7,-1.5+row*1.45,.65);
      local.applyAxisAngle(new THREE.Vector3(0,1,0),head.rotation.y);
      bulbsMatrix.makeTranslation(p.x+local.x,73+local.y,p.z+local.z);
      bulbs.setMatrixAt(b,bulbsMatrix);
    }
  }
  bulbs.instanceMatrix.needsUpdate=true;bulbs.frustumCulled=false;
  stadium.add(bulbs);

  // Thin translucent wire roof conveys the enclosed gameplay volume without
  // hiding the open sky. All decorative geometry remains outside ball physics.
  const wires=[],gridMaterial=new THREE.LineBasicMaterial({
    color:0xd1e7ef,transparent:true,opacity:.085,depthWrite:false
  });
  for(let x=-HW;x<=HW;x+=16){
    for(let z=-HL;z<HL;z+=12){
      wires.push(x,CEIL+.4,z,x,CEIL+.4,Math.min(HL,z+12));
    }
  }
  for(let z=-HL;z<=HL;z+=16){
    for(let x=-HW;x<HW;x+=12){
      wires.push(x,CEIL+.4,z,Math.min(HW,x+12),CEIL+.4,z);
    }
  }
  const wiresGeo=new THREE.BufferGeometry();
  wiresGeo.setAttribute('position',new THREE.Float32BufferAttribute(wires,3));
  stadium.add(new THREE.LineSegments(wiresGeo,gridMaterial));
}
buildStadium();
function applyArenaStyle(style) {
  const palettes = {
    sunset: { sky: 0x8ac7ec, fog: 0xbcd9e8, ground: 0xffffff, glow: 0x68d0ff },
    neon: { sky: 0x07142d, fog: 0x101d3b, ground: 0xb7c7ff, glow: 0x8c4dff },
    ice: { sky: 0x9ac8e6, fog: 0x9ac8e6, ground: 0xd6f4ff, glow: 0x7be8ff },
    desert: { sky: 0x47212c, fog: 0x6b3841, ground: 0xffd0a0, glow: 0xffb34f }
  };
  const p = palettes[style] || palettes.sunset;
  scene.background.setHex(p.sky); scene.fog.color.setHex(p.fog);
  if (skyMesh) skyMesh.material.color.setHex(style === 'ice' ? 0x8ab9d8 : style === 'neon' ? 0x697bff : style === 'desert' ? 0xffa15e : 0xffffff);
  if (pitchMesh) pitchMesh.material.color.setHex(p.ground);
  if (rampMeshMaterial) rampMeshMaterial.color.setHex(style === 'ice' ? 0x9fdaef : style === 'neon' ? 0x596db9 : style === 'desert' ? 0xbca06d : 0x59b849);
  scene.traverse(o => { if (o.isLineLoop && o.material && o.material.color) o.material.color.setHex(p.glow); });
}
applyArenaStyle('sunset');

// Full-resolution Octane visual model; hitboxes and controls remain independent.
let octaneSceneTemplate = null, octaneModelLoading = false, octaneModelReady = false;
const octaneWheelAxis = new THREE.Vector3(0, 1, 0);
function makeDetailedOctane(car) {
  if (!octaneSceneTemplate || !car || car.model !== 'octane' || car.mesh.detailed) return;
  const m = car.mesh, model = octaneSceneTemplate.clone(true);
  const col = car.ai ? (car.team ? hexCss(ORANGE) : hexCss(BLUE)) :
    car.team ? (localTwoPlayer && !car.ai ? player2Paint : hexCss(ORANGE)) : playerPaint;
  const paint = new THREE.Color(col);
  const wheelNodes = [];
  model.traverse(object => {
    if (/^Dieci/i.test(object.name) && object.children.length >= 2) wheelNodes.push(object);
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const materials = originalMaterials.map(material => {
      const mat = material.clone();
      const matName = (mat.name || '').toLowerCase().replace(/\s+/g, '_');
      if (matName === 'paint' || matName === 'octane_body') {
        mat.color.copy(paint); mat.roughness = 0.3; mat.metalness = 0.25; mat.needsUpdate = true;
      }
      return mat;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
  // Exported Octane points forward along X; Rocket Ball points forward along Z.
  const fitted = new THREE.Group(); fitted.add(model);
  model.rotation.y -= Math.PI / 2;
  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  const size = box.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 1e-5)) {
    console.warn('Octane model bounds invalid, using standard car.');
    return;
  }
  model.scale.multiplyScalar(Math.min(2.42 / size.x, 1.5 / size.y, 3.95 / size.z));
  fitted.updateMatrixWorld(true);
  const fit = new THREE.Box3().setFromObject(fitted);
  const center = fit.getCenter(new THREE.Vector3());
  fitted.position.set(-center.x, -fit.min.y - 0.48, -center.z);
  // Keep the existing body rotation pivot and boost flame; hide placeholder geometry only.
  for (const child of m.body.children) if (child !== m.flame) child.visible = false;
  m.body.add(fitted);
  m.detailed = true;
  m.detailedRoot = fitted;
  m.detailedWheels = wheelNodes;
  m.wheels = [];
}
function loadDetailedOctane() {
  if (octaneModelLoading || octaneModelReady) return;
  const status = $('modelLoadStatus');
  if (!THREE.GLTFLoader) {
    if (status) status.textContent = 'Using lightweight car (3D importer unavailable)';
    return;
  }
  octaneModelLoading = true;
  new THREE.GLTFLoader().load('assets/octane/scene.gltf', gltf => {
    octaneSceneTemplate = gltf.scene;
    octaneModelReady = true; octaneModelLoading = false;
    for (const car of cars) makeDetailedOctane(car);
    if (status) status.textContent = '✓ Detailed Octane and Dieci wheels loaded';
  }, undefined, err => {
    octaneModelLoading = false;
    console.warn('Full Octane could not load; retaining playable car:', err);
    if (status) status.textContent = 'Using lightweight car (model unavailable)';
  });
}

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
const ball = { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, onRamp: false };
let cars = [];
// UI and gameplay toggles
let playerName = 'PLAYER';
let player2Name = 'PLAYER 2';
const profilePictures = { p1: '', p2: '' };
function profileAvatarHTML(car, idx) {
  const key = idx === 0 ? 'p1' : (localTwoPlayer && idx === mode ? 'p2' : '');
  const src = key ? profilePictures[key] : '';
  const name = car.displayName || ('PLAYER ' + (idx + 1));
  const color = car.team ? '#ff8a1f' : '#2fb8ff';
  if (src && /^data:image\/jpeg;base64,/.test(src)) {
    return '<img class="player-avatar" src="' + src + '" alt="' + escapeStats(name) + ' profile picture" style="--avatar-color:' + color + '">';
  }
  return '<span class="player-avatar player-avatar-fallback" style="--avatar-color:' + color + '" aria-label="' + escapeStats(name) + ' avatar">' + escapeStats((name.trim().charAt(0) || '?').toUpperCase()) + '</span>';
}
function initProfilePictureControls() {
  const controls = [
    { key: 'p1', input: 'profile1', preview: 'profilePreview1', clear: 'clearProfile1', storage: 'rocketArenaProfileP1' },
    { key: 'p2', input: 'profile2', preview: 'profilePreview2', clear: 'clearProfile2', storage: 'rocketArenaProfileP2' }
  ];
  for (const item of controls) {
    const input = $(item.input), preview = $(item.preview), clear = $(item.clear);
    if (!input || !preview || !clear) continue;
    try {
      const saved = localStorage.getItem(item.storage) || '';
      if (/^data:image\/jpeg;base64,/.test(saved)) profilePictures[item.key] = saved;
    } catch (_) {}
    if (profilePictures[item.key]) {
      preview.src = profilePictures[item.key];
      preview.hidden = false;
    }
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { alert('Choose an image file.'); input.value = ''; return; }
      if (file.size > 8 * 1024 * 1024) { alert('Please choose an image smaller than 8 MB.'); input.value = ''; return; }
      const reader = new FileReader();
      reader.onerror = () => alert('Could not read that picture. Try another image.');
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => alert('Could not open that picture. Try another image.');
        image.onload = () => {
          const size = 256, canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
          const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
          ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
          const data = canvas.toDataURL('image/jpeg', 0.82);
          profilePictures[item.key] = data;
          try { localStorage.setItem(item.storage, data); }
          catch (_) { alert('Picture loaded for this session, but your browser could not save it for next time.'); }
          preview.src = data;
          preview.hidden = false;
        };
        image.src = String(reader.result || '');
      };
      reader.readAsDataURL(file);
    });
    clear.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      profilePictures[item.key] = '';
      try { localStorage.removeItem(item.storage); } catch (_) {}
      preview.removeAttribute('src'); preview.hidden = true; input.value = '';
    });
  }
}
let playerCarModel = 'octane';
let playerPaint = '#2fb8ff', playerPaintCustom = false;
let player2CarModel = 'dominus';
let player2Paint = '#ff8a1f', player2PaintCustom = false;
let physicsStyle = 'standard';
let localTwoPlayer = false;
let goalExplosionStyle = 'classic';
let trainingMode = false, trainingGoals = 0, trainingAttempts = 0, trainingAirTouches = 0, trainingWallArmed = false;
let paused = false;
let lastTouch = null;
let previousTouch = null;
let playerStats = [];
let eventCooldown = {};
let replayHistory = [];
let replayCaptureTimer = 0;
let replayFrames = [];
let replayIndex = 0;
let goalScorerText = 'PLAYER';
let goalSpeedMph = 0;
let replayCameraCarIndex = 0;
const REPLAY_HISTORY_LIMIT = 301;
function saveReplayFrame() {
  replayHistory.push({
    cars: cars.map(c => ({ x:c.x, y:c.y, z:c.z, vx:c.vx, vy:c.vy, vz:c.vz, yaw:c.yaw, pitch:c.pitch, roll:c.roll, wallRide:c.wallRide, wallVerticalAxis:c.wallVerticalAxis, wallVerticalSign:c.wallVerticalSign, aq:c.airQuat ? c.airQuat.toArray() : null, flip:c.flip, fx:c.fx, fz:c.fz, fl:c.fl })),
    ball: { x:ball.x, y:ball.y, z:ball.z, vx:ball.vx, vy:ball.vy, vz:ball.vz, wx:ball.wx, wy:ball.wy, wz:ball.wz, onRamp:ball.onRamp }
  });
  if (replayHistory.length > REPLAY_HISTORY_LIMIT) replayHistory.shift();
}
function applyReplayFrame(frame) {
  if (!frame) return;
  frame.cars.forEach((p, i) => {
    const c = cars[i]; if (!c) return;
    Object.assign(c, p);
    c.airQuat = p.aq ? new THREE.Quaternion().fromArray(p.aq) : null;
    c.airOmega = null;
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
  const car = { team, k, x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, airQuat: null, airOmega: null, wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, ai, aiCd: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fx: 0, fz: 0, fl: 0, ground: true, demoTimer: 0, demoCooldown: 0, boostImpactTimer: 0 };
  car.mesh = carMesh(col, model);
  car.model = model;
  car.displayName = ai ? (team ? 'ORANGE BOT ' : 'BLUE BOT ') + (k + 1) : playerName;
  // model-based properties
  const mdef = CAR_MODELS.find(m => m.name === model);
  car.hit = mdef.hit; car.hitbox = CAR_HITBOXES[model] || CAR_HITBOXES.octane; car.mass = mdef.mass * 4; car.cap = mdef.cap; car.baseCap = mdef.cap;
  if (model === 'octane' && octaneModelReady) makeDetailedOctane(car); // scale mass multiplier into existing physics constants
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
// Six 100-boost pads at the four corners and the two side midpoints.
// The small 12-boost pads are mirrored across both halves, following the
// overhead arena map. Each is positioned on the continuous ramp surface.
const pads = [];
const bigPads=[
  [-63,-83,1],[63,-83,1],[-63,83,1],[63,83,1],[-66,0,1],[66,0,1]
];
const smallPads=[
  [0,0],[0,-26],[0,26],[0,-54],[0,54],[0,-89],[0,89],
  [-27,0],[27,0],[-48,0],[48,0],
  [-29,-24],[29,-24],[-29,24],[29,24],
  [-39,-53],[39,-53],[-39,53],[39,53],
  [-56,-34],[56,-34],[-56,34],[56,34],
  [-23,-76],[23,-76],[-23,76],[23,76],
  [-43,-86],[43,-86],[-43,86],[43,86]
];
for (const [x,z,big] of [...bigPads,...smallPads]) {
  const ramp = arenaRampAt(x, z);
  const surfaceY = ramp.height;
  const group = new THREE.Group();
  group.position.set(x, surfaceY, z);
  group.rotation.set(-Math.atan(ramp.dz), 0, Math.atan(ramp.dx));
  const material = new THREE.MeshBasicMaterial({ color: big ? 0xffb236 : 0xffd363, transparent: true, opacity: 0.9 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(big ? 2.55 : 1.48, big ? 2.55 : 1.48, 0.18, 32), material);
  m.position.y = 0.09; group.add(m);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(big ? 2.35 : 1.32, big ? 0.16 : 0.09, 8, 36),
    new THREE.MeshBasicMaterial({ color: big ? 0xffe27a : 0xffdfa4, transparent: true, opacity: 0.95 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; group.add(ring);
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(big ? 1.8 : 0.82, 24),
    new THREE.MeshBasicMaterial({ color: big ? 0xffcc48 : 0xffd989, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
  );
  core.rotation.x = -Math.PI / 2; core.position.y = 0.19; group.add(core);
  scene.add(group);
  pads.push({ x, z, big: !!big, t: 0, mesh: m, ring, core, group, surfaceY, ramp });
}
const FORM = [[0, 0.55], [-26, 0.8], [26, 0.8]];
function kickoff() {
  previousTouch = null;
  eventCooldown = {};
  const msgEl = $('msg'); if (msgEl) msgEl.classList.remove('replay-title');
  const goalByEl = $('goalBy'); if (goalByEl) goalByEl.textContent = '';
  const goalSpeedEl = $('goalSpeed'); if (goalSpeedEl) goalSpeedEl.textContent = '';
  goalSpeedMph = 0;
  replayHistory = [];
  replayCaptureTimer = 0;
  predictionTimer = 0;
  replayFrames = [];
  replayIndex = 0;
  Object.assign(ball, { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, onRamp: false, onGround: false });
  lastTouch = null;
  for (const c of cars) {
    const f = FORM[c.k], s = c.team ? 1 : -1;
    Object.assign(c, { x: f[0] * (c.team ? -1 : 1), y: 0.55, z: s * f[1] * HL, vx: 0, vy: 0, vz: 0, yaw: c.team ? Math.PI : 0, pitch: 0, roll: 0, airQuat: null, airOmega: null, wallDetachTimer: 0, wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, boost: 34, jumps: 0, jt: 0, flip: 0, fl: 0, ground: true, aiCd: 0, wait: SKILL[diff].wait });
  }
}
function start(freePlay = false) {
  sfx.init(); // read UI choices
  trainingMode = !!freePlay;
  trainingGoals = 0;
  trainingAttempts = 0;
  trainingAirTouches = 0;
  trainingWallArmed = false;
  paused = false;
  window.__rocketPhysicsAccumulator = 0;
  document.body.classList.toggle('free-play', trainingMode);
  resize();
  if ($('trainingTools')) $('trainingTools').hidden = !trainingMode;
  if ($('trainingGoalCount')) $('trainingGoalCount').textContent = 'GOALS 0';
  if ($('trainingShotCount')) $('trainingShotCount').textContent = 'ATTEMPT 1';
  if ($('trainingTouchCount')) $('trainingTouchCount').textContent = 'AIR TOUCHES 0';
  const nameEl = $('name'); if (nameEl) playerName = (nameEl.value || 'PLAYER').toString().trim().slice(0,12) || 'PLAYER';
  const name2El = $('name2'); if (name2El) player2Name = (name2El.value || 'PLAYER 2').toString().trim().slice(0,12) || 'PLAYER 2';
  const sel = document.querySelector('.car-opts:not(.car-opts-p2) button.on'); if (sel && sel.dataset.car) playerCarModel = sel.dataset.car;
  const sel2 = document.querySelector('.car-opts-p2 button.on'); if (sel2 && sel2.dataset.car2) player2CarModel = sel2.dataset.car2;
  const paint2El = $('paint2'); if (paint2El) player2Paint = paint2El.value || '#ff8a1f';
  const explosionEl = $('explosion'); if (explosionEl) goalExplosionStyle = explosionEl.value;
  document.body.classList.remove('victory-screen');
  buildTeams();
  if (trainingMode) {
    // Train with one real custom garage car and no AI players.
    for (const bot of cars.slice(1)) scene.remove(bot.mesh.root);
    cars = cars.slice(0, 1);
  }
  score = [0, 0]; clock = MATCH; ot = false; pads.forEach(p => p.t = 0);
  playerStats = cars.map(() => ({ goals: 0, assists: 0, shots: 0, saves: 0, clears: 0, shotsOnGoal: 0, demos: 0 }));
  const victory = $('victory'); if (victory) { victory.style.display = 'none'; victory.dataset.shown = ''; }
  kickoff(); state = 'kick'; cd = 3; $('menu').style.display = 'none'; $('msg').textContent = '';
  if (trainingMode) {
    state = 'play'; cd = 0;
    loadTrainingShot(($('trainingPreset') && $('trainingPreset').value) || 'dribble');
    $('msg').textContent = ''; 
  }
  const pHUD = $('player'); if (pHUD) pHUD.textContent = playerName;
}
// Free Play lets players practise aerials, wall shots and ground dribbles
// without changing normal match rules or spawning opposition bots.
function resetTrainingBall() {
  Object.assign(ball, {
    x: 0, y: BR + 1, z: 0, vx: 0, vy: 0, vz: 0,
    wx: 0, wy: 0, wz: 0, onRamp: false, onGround: false
  });
  ballMesh.quaternion.identity();
  lastTouch = previousTouch = null;
}
function resetTrainingCar() {
  const car = cars[0]; if (!car) return;
  Object.assign(car, {
    x: 0, y: 0.55, z: -34, vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0, roll: 0, jumps: 0, jt: 0,
    flip: 0, fl: 0, hold: 0, ground: true,
    wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, wallDetachTimer: 0,
    airQuat: null, airOmega: null, demoTimer: 0, boost: 100, ballHitCooldown: 0, airTouchCooldown: 0
  });
  car.wallDetachTimer = 0;
  car.mesh.root.visible = true;
}
function passTrainingBall() {
  if (!trainingMode || !cars[0]) return;
  const car = cars[0], sx = Math.sin(car.yaw), sz = Math.cos(car.yaw);
  Object.assign(ball, {
    x: clamp(car.x + sx * 16, -HW + 9, HW - 9),
    z: clamp(car.z + sz * 16, -HL + 9, HL - 9),
    y: BR + 1.2, vx: -sx * 18, vy: 3.5, vz: -sz * 18,
    wx: 0, wy: 0, wz: 0, onRamp: false
  });
}
function launchTrainingBall() {
  if (!trainingMode || !cars[0]) return;
  const car = cars[0], sx = Math.sin(car.yaw), sz = Math.cos(car.yaw);
  Object.assign(ball, {
    x: clamp(car.x + sx * 11, -HW + 9, HW - 9),
    z: clamp(car.z + sz * 11, -HL + 9, HL - 9),
    y: BR + 5, vx: sx * 21, vy: 17, vz: sz * 21,
    wx: 0, wy: 0, wz: 0, onRamp: false
  });
}
function updateTrainingCounters() {
  if ($('trainingGoalCount')) $('trainingGoalCount').textContent = 'GOALS ' + trainingGoals;
  if ($('trainingShotCount')) $('trainingShotCount').textContent = 'ATTEMPT ' + trainingAttempts;
  if ($('trainingTouchCount')) $('trainingTouchCount').textContent = 'AIR TOUCHES ' + trainingAirTouches;
}
function loadTrainingShot(scenario = 'dribble') {
  if (!trainingMode || !cars[0]) return;
  const wallTip = $('wallTrainingTip');
  if (wallTip) wallTip.hidden = scenario !== 'wall';
  resetTrainingCar();
  resetTrainingBall();
  const car = cars[0];
  const variation = (trainingAttempts % 5) - 2;
  trainingAirTouches = 0;
  trainingWallArmed = false;
  switch (scenario) {
    case 'aerial':
      car.z = -58;
      Object.assign(ball, {
        x: variation * 2.0, z: -18, y: BR + 12,
        vx: variation * 1.5, vy: 11, vz: 12
      });
      break;
    case 'wall': {
      // Repeatable first-touch setup: freeze both objects while the player
      // prepares. Space releases car and ball with MATCHED upward/inward pace,
      // leaving room for manual boost feathering and repeated light touches.
      const sideSign = trainingAttempts % 2 === 0 ? -1 : 1;
      car.x = sideSign * (HW - 1.3);
      car.z = -37 + variation * 1.8;
      car.y = WALL_RAMP_HEIGHT + 7.0;
      car.yaw = sideSign * Math.PI / 2;
      car.pitch = Math.PI / 2;
      car.vx = 0; car.vy = 13; car.vz = 2;
      car.wallRide = true;
      car.wallVerticalAxis = 'x'; car.wallVerticalSign = sideSign;
      car.ground = true;
      const ballX = sideSign * (HW - 3.5);
      Object.assign(ball, {
        x: ballX, z: car.z + 1.3, y: car.y + 5.8,
        vx: -sideSign * 12, vy: 11.8, vz: 3,
        wx: 0, wy: 0, wz: 0,
        onRamp: false, onGround: false, onWall: false
      });
      trainingWallArmed = true;
      break;
    }
    case 'save':
      car.z = -HL + 19;
      Object.assign(ball, {
        x: variation * 2.5, z: -15, y: BR + 2,
        vx: 0, vy: 4.5, vz: -29
      });
      break;
    case 'kickoff':
      car.z = -57;
      ball.y = BR + 6;
      break;
    case 'dribble':
    default:
      car.z = -32;
      ball.z = -15 + variation * 0.8;
      ball.y = BR + 0.2;
      break;
  }
  trainingAttempts++;
  updateTrainingCounters();
  if (trainingWallArmed && wallTip) wallTip.textContent =
    'READY: Press SPACE to launch from the wall. Feather SHIFT to catch the ball, tap S to angle the nose inward, and use Q/E for air roll.';
  else if (wallTip) wallTip.textContent =
    'Wall air dribble: jump inward, feather boost, match ball speed, and make several gentle touches.';
  showGameEvent('TRAINING · ' + scenario.toUpperCase(), '#8fe5ff');
}
function exitTraining() {
  trainingMode = false; trainingWallArmed = false; paused = false;
  document.body.classList.remove('free-play');
  resize();
  if ($('trainingTools')) $('trainingTools').hidden = true;
  state = 'menu'; $('menu').style.display = 'grid';
  $('mt').textContent = 'ROCKET ARENA 3D';
}
for (const [id, action] of [
  ['trainingResetBall', resetTrainingBall], ['trainingPass', passTrainingBall],
  ['trainingLaunch', launchTrainingBall], ['trainingResetCar', resetTrainingCar],
  ['trainingNextShot', () => loadTrainingShot(($('trainingPreset') && $('trainingPreset').value) || 'dribble')],
  ['trainingExit', exitTraining]
]) {
  if ($(id)) $(id).addEventListener('click', action);
}
if ($('trainingPreset')) $('trainingPreset').addEventListener('change', () => loadTrainingShot($('trainingPreset').value));
if ($('freePlayBtn')) $('freePlayBtn').addEventListener('click', e => {
  e.preventDefault(); e.stopPropagation(); start(true);
});
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
    const a = this.ac = new AC();
    this.master = a.createGain(); this.master.gain.value = gameVolume; this.master.connect(a.destination);
    this.o = a.createOscillator(); this.o.type = 'sawtooth'; this.og = a.createGain(); this.og.gain.value = 0;
    this.o.connect(this.og).connect(this.master); this.o.start();
    const nb = a.createBuffer(1, a.sampleRate, a.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = nb; src.loop = true; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 800;
    this.bg = a.createGain(); this.bg.gain.value = 0; src.connect(f).connect(this.bg).connect(this.master); src.start();
  },
  setVolume(value) {
    gameVolume = clamp(Number(value) || 0, 0, 1);
    if (this.master && this.ac) this.master.gain.setTargetAtTime(gameVolume, this.ac.currentTime, 0.025);
  },
  tone(f, d, type, v) {
    if (!this.ac || muted || gameVolume <= 0) return; const a = this.ac, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    o.connect(g).connect(this.master || a.destination); o.start(); o.stop(a.currentTime + d);
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
const CONTROL_ACTIONS = ['forward', 'reverse', 'left', 'right', 'jump', 'boost', 'hand', 'rollLeft', 'rollRight'];
const DEFAULT_CONTROL_BINDINGS = {
  p1: {
    keyboard: { forward:'KeyW', reverse:'KeyS', left:'KeyA', right:'KeyD', jump:'Space', boost:'ShiftLeft', hand:'KeyE', rollLeft:'KeyQ', rollRight:'KeyE' },
    pad: { forward:7, reverse:6, left:null, right:null, jump:0, boost:2, hand:4, rollLeft:4, rollRight:5 }
  },
  p2: {
    keyboard: { forward:'ArrowUp', reverse:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', jump:'Enter', boost:'ShiftRight', hand:'Slash', rollLeft:'Numpad1', rollRight:'Numpad3' },
    pad: { forward:7, reverse:6, left:null, right:null, jump:0, boost:2, hand:4, rollLeft:4, rollRight:5 }
  }
};
const controlBindings = JSON.parse(JSON.stringify(DEFAULT_CONTROL_BINDINGS));
try {
  const saved = JSON.parse(localStorage.getItem('rocketArenaControlsV1') || '{}');
  for (const who of ['p1','p2']) for (const action of CONTROL_ACTIONS) {
    const key = saved[who] && saved[who].keyboard && saved[who].keyboard[action];
    const pad = saved[who] && saved[who].pad && saved[who].pad[action];
    if (typeof key === 'string' && key) controlBindings[who].keyboard[action] = key;
    if (pad === null || (Number.isInteger(pad) && pad >= 0 && pad < 32)) controlBindings[who].pad[action] = pad;
  }
} catch (_) {}
const keys = {};
let jumpQ = false, jumpQ2 = false;
const padJumpQueued = { p1:false, p2:false };
let pendingKeyCapture = null, pendingPadCapture = null;
let connectedGamepads = [], previousPadButtons = Object.create(null);
function saveControlBindings() {
  try { localStorage.setItem('rocketArenaControlsV1', JSON.stringify(controlBindings)); }
  catch (_) {}
}
function activeControlPlayer() {
  return $('controlsPlayer') && $('controlsPlayer').value === 'p2' ? 'p2' : 'p1';
}
function keyLabel(code) {
  const fixed = { Space:'Space', Enter:'Enter', ShiftLeft:'Left Shift', ShiftRight:'Right Shift', ControlLeft:'Left Ctrl', ControlRight:'Right Ctrl', AltLeft:'Left Alt', AltRight:'Right Alt', ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Slash:'/', Backslash:'\\', Numpad1:'Num 1', Numpad3:'Num 3', Escape:'Esc', Tab:'Tab' };
  if (fixed[code]) return fixed[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code || 'Unbound';
}
function padButtonLabel(index) {
  const labels = { 0:'Button 1 (A / ✕)', 1:'Button 2 (B / ○)', 2:'Button 3 (X / □)', 3:'Button 4 (Y / △)', 4:'Button 5 (LB / L1)', 5:'Button 6 (RB / R1)', 6:'LT / L2', 7:'RT / R2', 8:'Button 9', 9:'Button 10', 10:'Button 11', 11:'Button 12' };
  return index === null || index === undefined ? 'Left stick' : (labels[index] || ('Button ' + (index + 1)));
}
function renderControlBindings() {
  const who = activeControlPlayer(), binding = controlBindings[who];
  
/* Corner HUD controls inspired by modern car-soccer interfaces. */
const garageToggle = $('garageToggle');
if (garageToggle) garageToggle.addEventListener('click', () => {
  trainingMode = false; document.body.classList.remove('free-play');
  if ($('trainingTools')) $('trainingTools').hidden = true;
  state = 'menu';
  $('menu').style.display = 'grid';
  $('mt').textContent = 'GARAGE';
  $('go').textContent = 'Choose your setup, then press PLAY';
});
const quickPlayButton = $('quickPlayButton');
if (quickPlayButton) quickPlayButton.addEventListener('click', () => {
  if (state === 'menu' || state === 'over') start();
  else { trainingMode = false; document.body.classList.remove('free-play'); if ($('trainingTools')) $('trainingTools').hidden = true; state = 'menu'; $('menu').style.display = 'grid'; $('mt').textContent = 'MATCH SETUP'; }
});
const viewToggle = $('viewToggle');
if (viewToggle) viewToggle.addEventListener('click', () => {
  ballCam = !ballCam;
  $('cam').textContent = ballCam ? 'Ball cam (C)' : 'Chase cam (C)';
  viewToggle.innerHTML = (ballCam ? '◉ <span>BALL CAM</span>' : '◉ <span>PLAYER VIEW</span>');
});
const cinematicToggle = $('cinematicToggle');
if (cinematicToggle) cinematicToggle.addEventListener('click', () => {
  ballCam = !ballCam;
  $('cam').textContent = ballCam ? 'Cinematic / ball cam' : 'Chase cam';
  cinematicToggle.classList.toggle('on', ballCam);
});
const fullscreenToggle = $('fullscreenToggle');
if (fullscreenToggle) fullscreenToggle.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (_) {}
});
const skipReplayButton = $('skipReplayButton');
if (skipReplayButton) skipReplayButton.addEventListener('click', () => {
  if (state === 'replay') replayIndex = Math.max(0, replayFrames.length - 1);
});

document.querySelectorAll('[data-bind-key]').forEach(button => {
    const action = button.dataset.bindKey;
    button.textContent = pendingKeyCapture === action ? 'Press a key…' : keyLabel(binding.keyboard[action]);
    button.classList.toggle('capture-active', pendingKeyCapture === action);
  });
  document.querySelectorAll('[data-bind-pad]').forEach(button => {
    const action = button.dataset.bindPad;
    const defaults = { forward:'RT / R2', reverse:'LT / L2', left:'Left stick ←', right:'Left stick →' };
    button.textContent = pendingPadCapture === action ? 'Press a button…' :
      (binding.pad[action] === null || binding.pad[action] === undefined ? (defaults[action] || 'Not set') : padButtonLabel(binding.pad[action]));
    button.classList.toggle('capture-active', pendingPadCapture === action);
  });
}
function setControllerStatus(message) {
  const node = $('controllerStatus');
  if (node) node.textContent = message;
}
function beginKeyCapture(action) {
  pendingPadCapture = null; pendingKeyCapture = action;
  setControllerStatus('Press the keyboard key for ' + action + ' (Esc cancels).');
  renderControlBindings();
}
function beginPadCapture(action) {
  pendingKeyCapture = null; pendingPadCapture = action;
  setControllerStatus('Press a button or trigger on the controller you want to assign.');
  renderControlBindings();
}
function controllerForPlayer(who) {
  if (who === 'p2') return localTwoPlayer && connectedGamepads.length > 1 ? connectedGamepads[1] : null;
  return connectedGamepads[0] || null;
}
function buttonValue(pad, action, who) {
  if (!pad) return 0;
  const index = controlBindings[who].pad[action];
  if (!Number.isInteger(index)) return 0;
  const button = pad.buttons && pad.buttons[index];
  if (!button) return 0;
  const raw = Math.max(button.value || 0, button.pressed ? 1 : 0);
  return raw <= controllerDeadZone ? 0 : (raw - controllerDeadZone) / (1 - controllerDeadZone);
}
function pollControllers() {
  connectedGamepads = navigator.getGamepads
    ? Array.from(navigator.getGamepads() || []).filter(pad => pad && pad.connected !== false).sort((a,b) => a.index - b.index)
    : [];
  const current = Object.create(null);
  let captured = false;
  for (const pad of connectedGamepads) {
    for (let i = 0; i < (pad.buttons || []).length; i++) {
      const button = pad.buttons[i];
      const pressed = !!button && Math.max(button.value || 0, button.pressed ? 1 : 0) > 0.55;
      const id = pad.index + ':' + i;
      current[id] = pressed;
      if (pressed && !previousPadButtons[id] && pendingPadCapture) {
        const who = activeControlPlayer(), action = pendingPadCapture;
        controlBindings[who].pad[action] = i;
        pendingPadCapture = null; captured = true;
        saveControlBindings(); renderControlBindings();
        setControllerStatus('Assigned ' + padButtonLabel(i) + ' to ' + action + '.');
      }
    }
  }
  if (!captured && !pendingPadCapture) {
    const first = connectedGamepads[0];
    if (first) {
      const jumpIndex = controlBindings.p1.pad.jump;
      if (state === 'play' && !paused && Number.isInteger(jumpIndex) && current[first.index + ':' + jumpIndex] && !previousPadButtons[first.index + ':' + jumpIndex]) padJumpQueued.p1 = true;
    }
    const second = localTwoPlayer && connectedGamepads.length > 1 ? connectedGamepads[1] : null;
    if (second) {
      const jumpIndex = controlBindings.p2.pad.jump;
      if (state === 'play' && !paused && Number.isInteger(jumpIndex) && current[second.index + ':' + jumpIndex] && !previousPadButtons[second.index + ':' + jumpIndex]) padJumpQueued.p2 = true;
    }
  }
  previousPadButtons = current;
  if (pendingKeyCapture || pendingPadCapture) return;
  if (connectedGamepads.length) {
    const names = connectedGamepads.map(pad => pad.id || ('Controller ' + (pad.index + 1)));
    setControllerStatus('Connected: ' + names.join(' · ') + (localTwoPlayer && connectedGamepads.length > 1 ? ' — both players can use a controller.' : connectedGamepads.length > 1 ? ' — enable Local 2-player for controller 2.' : ''));
  } else {
    setControllerStatus('No controller detected. Connect one and press any button; use USB or Bluetooth.');
  }
}
document.querySelectorAll('[data-bind-key]').forEach(button => button.addEventListener('click', () => beginKeyCapture(button.dataset.bindKey)));
document.querySelectorAll('[data-bind-pad]').forEach(button => button.addEventListener('click', () => beginPadCapture(button.dataset.bindPad)));
if ($('controlsPlayer')) $('controlsPlayer').addEventListener('change', () => { pendingKeyCapture = pendingPadCapture = null; renderControlBindings(); });
if ($('resetControls')) $('resetControls').addEventListener('click', () => {
  const who = activeControlPlayer();
  controlBindings[who] = JSON.parse(JSON.stringify(DEFAULT_CONTROL_BINDINGS[who]));
  pendingKeyCapture = pendingPadCapture = null; saveControlBindings(); renderControlBindings();
  setControllerStatus(who === 'p1' ? 'Player 1 controls reset to defaults.' : 'Player 2 controls reset to defaults.');
});
renderControlBindings();

addEventListener('keydown', e => {
  if (pendingKeyCapture) {
    const action = pendingKeyCapture;
    if (e.code === 'Escape') {
      pendingKeyCapture = null; renderControlBindings(); setControllerStatus('Keyboard binding cancelled.');
    } else {
      const who = activeControlPlayer();
      controlBindings[who].keyboard[action] = e.code;
      pendingKeyCapture = null; saveControlBindings(); renderControlBindings();
      setControllerStatus('Assigned ' + keyLabel(e.code) + ' to ' + action + '.');
    }
    e.preventDefault(); e.stopPropagation(); return;
  }
  const remappedKey = ['p1','p2'].some(who => Object.values(controlBindings[who].keyboard).includes(e.code));
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || remappedKey) e.preventDefault();
  if (!keys[e.code] && e.code === controlBindings.p1.keyboard.jump) jumpQ = true;
  if (!keys[e.code] && e.code === controlBindings.p2.keyboard.jump && state === 'play' && localTwoPlayer) jumpQ2 = true;
  if (trainingMode && state === 'play' && !paused &&
      !(e.target && e.target.closest && e.target.closest('input, textarea, select'))) {
    if (!e.repeat && e.code === 'KeyR') resetTrainingBall();
    if (!e.repeat && e.code === 'KeyT') passTrainingBall();
    if (!e.repeat && e.code === 'KeyY') launchTrainingBall();
    if (!e.repeat && e.code === 'KeyH') loadTrainingShot(($('trainingPreset') && $('trainingPreset').value) || 'dribble');
    if (!e.repeat && e.code === 'Backspace') { resetTrainingCar(); e.preventDefault(); }
  }
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
initProfilePictureControls();
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
function updateGaragePreview() {
  const car = $('menuCarShowcase');
  if (!car) return;
  const chosen = CAR_MODELS.find(m => m.name === playerCarModel) || CAR_MODELS[0];
  car.style.setProperty('--garage-paint', playerPaint || '#2fb8ff');
  const body = car.querySelector('.car-body'), nose = car.querySelector('.car-nose'), roof = car.querySelector('.car-roof'), glow = car.querySelector('.car-glow');
  if (body) body.style.background = 'linear-gradient(165deg,#ffffff,' + (playerPaint || '#2fb8ff') + ' 35%,#10283c 125%)';
  if (nose) nose.style.background = 'linear-gradient(145deg,' + (playerPaint || '#2fb8ff') + ',#10283c)';
  if (roof) roof.style.background = 'linear-gradient(145deg,' + (playerPaint || '#2fb8ff') + ',#12344d)';
  if (glow) glow.style.background = playerPaint || '#2fb8ff';
  const label = car.querySelector('.showcase-label');
  if (label) label.textContent = (chosen.label || chosen.name || playerCarModel).toUpperCase() + ' · ' + (playerPaint || '#2fb8ff').toUpperCase();
}
const paintInput = $('paint');
if (paintInput) paintInput.addEventListener('input', () => { playerPaint = paintInput.value || '#2fb8ff'; playerPaintCustom = true; updateGaragePreview(); if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
const paint2Input = $('paint2');
if (paint2Input) paint2Input.addEventListener('input', () => { player2Paint = paint2Input.value || '#ff8a1f'; player2PaintCustom = true; if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
updateGaragePreview();

function hexCss(hex) { return '#' + Number(hex).toString(16).padStart(6, '0'); }
function saveGeneralSettings() {
  try {
    localStorage.setItem('rocketArenaSettingsV1', JSON.stringify({
      volume: gameVolume, colourVisionMode, deadZone: controllerDeadZone, camera: cameraSettings, graphicsQuality
    }));
  } catch (_) {}
}
function applyColourVisionMode(modeName, rebuild = true, persist = true) {
  const mode = Object.prototype.hasOwnProperty.call(TEAM_COLOR_PRESETS, modeName) ? modeName : 'normal';
  const palette = TEAM_COLOR_PRESETS[mode];
  colourVisionMode = mode; BLUE = palette.blue; ORANGE = palette.orange;
  document.body.dataset.colourVision = mode;
  document.documentElement.style.setProperty('--team-blue', hexCss(BLUE));
  document.documentElement.style.setProperty('--team-orange', hexCss(ORANGE));
  scene.traverse(object => {
    if (object.isLight && object.userData && object.userData.teamSide) {
      object.color.setHex(object.userData.teamSide === 'blue' ? BLUE : ORANGE);
    }
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) {
      const side = material.userData && material.userData.teamSide;
      if (side && material.color) {
        const colour = new THREE.Color(side === 'blue' ? BLUE : ORANGE);
        if (material.userData.teamRole === 'dim') colour.multiplyScalar(0.3);
        material.color.copy(colour);
      }
    }
  });
  if (!playerPaintCustom) playerPaint = hexCss(BLUE);
  if (!player2PaintCustom) player2Paint = hexCss(ORANGE);
  const p1PaintControl = $('paint'), p2PaintControl = $('paint2');
  if (p1PaintControl && !playerPaintCustom) p1PaintControl.value = playerPaint;
  if (p2PaintControl && !player2PaintCustom) p2PaintControl.value = player2Paint;
  const colourSelect = $('settingColourVision');
  if (colourSelect) colourSelect.value = mode;
  updateGaragePreview();
  if (persist) saveGeneralSettings();
  if (rebuild && (state === 'menu' || state === 'over')) { buildTeams(); kickoff(); }
}
const volumeSetting = $('settingVolume');
const volumeSettingValue = $('settingVolumeValue');
if (volumeSetting) {
  volumeSetting.value = String(Math.round(gameVolume * 100));
  if (volumeSettingValue) volumeSettingValue.value = volumeSetting.value + '%';
  volumeSetting.addEventListener('input', () => {
    gameVolume = Number(volumeSetting.value) / 100;
    if (volumeSettingValue) volumeSettingValue.value = volumeSetting.value + '%';
    sfx.setVolume(gameVolume); saveGeneralSettings();
  });
}
const colourVisionSetting = $('settingColourVision');
if (colourVisionSetting) {
  colourVisionSetting.value = colourVisionMode;
  colourVisionSetting.addEventListener('change', () => applyColourVisionMode(colourVisionSetting.value, true, true));
}
const deadZoneSetting = $('settingDeadZone');
const deadZoneSettingValue = $('settingDeadZoneValue');
if (deadZoneSetting) {
  deadZoneSetting.value = String(controllerDeadZone);
  if (deadZoneSettingValue) deadZoneSettingValue.value = Math.round(controllerDeadZone * 100) + '%';
  deadZoneSetting.addEventListener('input', () => {
    controllerDeadZone = clamp(Number(deadZoneSetting.value) || 0.16, 0.05, 0.4);
    if (deadZoneSettingValue) deadZoneSettingValue.value = Math.round(controllerDeadZone * 100) + '%';
    saveGeneralSettings();
  });
}
for (const [key, id, out, min, max, suffix] of [
  ['fov', 'settingCameraFov', 'settingCameraFovValue', 60, 110, '°'],
  ['distance', 'settingCameraDistance', 'settingCameraDistanceValue', 8, 20, ''],
  ['height', 'settingCameraHeight', 'settingCameraHeightValue', 2, 9, ''],
  ['stiffness', 'settingCameraStiffness', 'settingCameraStiffnessValue', 2, 15, '']
]) {
  const input = $(id), output = $(out);
  cameraSettings[key] = clamp(cameraSettings[key], min, max);
  if (!input) continue;
  input.value = String(cameraSettings[key]);
  if (output) output.value = cameraSettings[key] + suffix;
  input.addEventListener('input', () => {
    cameraSettings[key] = clamp(Number(input.value), min, max);
    if (output) output.value = cameraSettings[key] + suffix;
    saveGeneralSettings();
  });
}
const cameraShakeInput = $('settingCameraShake');
if (cameraShakeInput) {
  cameraShakeInput.checked = cameraSettings.shake;
  cameraShakeInput.addEventListener('change', () => {
    cameraSettings.shake = cameraShakeInput.checked; saveGeneralSettings();
  });
}
const graphicsSetting = $('settingGraphics');
if (graphicsSetting) {
  graphicsSetting.value = graphicsQuality;
  graphicsSetting.addEventListener('change', () => {
    graphicsQuality = ['low', 'balanced', 'high'].includes(graphicsSetting.value) ?
      graphicsSetting.value : 'balanced';
    renderer.shadowMap.enabled = graphicsQuality !== 'low';
    resize();
    saveGeneralSettings();
  });
}
renderer.shadowMap.enabled = graphicsQuality !== 'low';
applyColourVisionMode(colourVisionMode, false, false);
sfx.setVolume(gameVolume);
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
      updateGaragePreview();
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
function playerActions(who) {
  const binding = controlBindings[who].keyboard;
  const pad = controllerForPlayer(who);
  const keyForward = keys[binding.forward] ? 1 : 0;
  const keyReverse = keys[binding.reverse] ? 1 : 0;
  const keyLeft = keys[binding.left] ? 1 : 0;
  const keyRight = keys[binding.right] ? 1 : 0;
  const padForward = buttonValue(pad, 'forward', who);
  const padReverse = buttonValue(pad, 'reverse', who);
  const padLeft = buttonValue(pad, 'left', who);
  const padRight = buttonValue(pad, 'right', who);
  let axisX = 0;
  if (pad && pad.axes && Number.isFinite(pad.axes[0])) {
    const raw = pad.axes[0], dead = controllerDeadZone;
    axisX = Math.abs(raw) < dead ? 0 : Math.sign(raw) * (Math.abs(raw) - dead) / (1 - dead);
  }
  const jumpButton = buttonValue(pad, 'jump', who) > 0.55;
  return {
    throttle: Math.max(-1, Math.min(1, keyForward - keyReverse + padForward - padReverse)),
    steer: Math.max(-1, Math.min(1, keyRight - keyLeft + axisX + padRight - padLeft)),
    roll: (keys[binding.rollRight] ? 1 : 0) - (keys[binding.rollLeft] ? 1 : 0) +
      (buttonValue(pad, 'rollRight', who) > 0.55 ? 1 : 0) -
      (buttonValue(pad, 'rollLeft', who) > 0.55 ? 1 : 0),
    jumpHeld: !!keys[binding.jump] || jumpButton,
    jump: false,
    hand: !!keys[binding.hand] || buttonValue(pad, 'hand', who) > 0.55,
    boost: !!keys[binding.boost] || buttonValue(pad, 'boost', who) > 0.55
  };
}
function playerCtl() {
  const j = jumpQ || padJumpQueued.p1; jumpQ = false; padJumpQueued.p1 = false;
  const actions = playerActions('p1'); actions.jump = j;
  return actions;
}
function player2Ctl() {
  const j = jumpQ2 || padJumpQueued.p2; jumpQ2 = false; padJumpQueued.p2 = false;
  const actions = playerActions('p2'); actions.jump = j;
  return actions;
}
const pred = []; // where the ball will be every 0.1s for the next 4 seconds
let predictionTimer = 0;
function predict() {
  let x = ball.x, y = ball.y, z = ball.z, vx = ball.vx, vy = ball.vy, vz = ball.vz;
  let onRamp = !!ball.onRamp;
  pred.length = 0;
  for (let i = 0; i < 40; i++) {
    for (let k = 0; k < 4; k++) {
      const h = 0.025;
      vy -= PHYSICS_TUNING.BALL_GRAVITY_FORCE * h;
      const drag = 1 - 0.03 * h; vx *= drag; vz *= drag;
      x += vx * h; y += vy * h; z += vz * h;
      if (y < BR) {
        y = BR; vy = -vy * PHYSICS_TUNING.BALL_FLOOR_RESTITUTION;
        if (Math.abs(vy) < 1.5) vy = 0;
        const groundDrag = Math.max(0, 1 - 0.35 * h); vx *= groundDrag; vz *= groundDrag;
      }
      if (y > CEIL - BR) { y = CEIL - BR; vy = -Math.abs(vy) * PHYSICS_TUNING.BALL_RESTITUTION; }

      const az = Math.abs(z), sz = Math.sign(z);
      if (Math.abs(x) > HW - BR && az <= HL) {
        const sx = Math.sign(x), edgeX = sx * (HW - BR);
        const edgeRamp = arenaRampAt(edgeX, z);
        const ridingRamp = edgeRamp.height > 0.2 && y < edgeRamp.height + BR + 2.5;
        x = edgeX;
        if (ridingRamp) vz *= Math.max(0, 1 - PHYSICS_TUNING.BALL_SURFACE_FRICTION * h);
        else {
          vx = -sx * Math.abs(vx) * PHYSICS_TUNING.BALL_WALL_RESTITUTION;
          const damp = Math.max(0, 1 - PHYSICS_TUNING.BALL_SURFACE_FRICTION * h);
          vy *= damp; vz *= damp;
        }
      }
      if (az > HL - BR && !(Math.abs(x) + BR < GW && y + BR < GH)) {
        const edgeZ = sz * (HL - BR), edgeRamp = arenaRampAt(x, edgeZ);
        const ridingRamp = edgeRamp.height > 0.2 && Math.abs(x) > GW + 2 && y < edgeRamp.height + BR + 2.5;
        z = edgeZ;
        if (ridingRamp) vx *= Math.max(0, 1 - PHYSICS_TUNING.BALL_SURFACE_FRICTION * h);
        else {
          vz = -sz * Math.abs(vz) * PHYSICS_TUNING.BALL_WALL_RESTITUTION;
          const damp = Math.max(0, 1 - PHYSICS_TUNING.BALL_SURFACE_FRICTION * h);
          vx *= damp; vy *= damp;
        }
      }

      const ramp = arenaRampAt(x, z);
      const rampSurfaceY = ramp.height + BR;
      const rampVelocityY = vx * ramp.dx + vz * ramp.dz;
      if (ramp.height > 0.025 && (y < rampSurfaceY - 0.05 ||
          (y <= rampSurfaceY + 0.18 && vy <= rampVelocityY + 2) ||
          (onRamp && y <= rampSurfaceY + 3))) {
        const normalVelocity = vy - rampVelocityY;
        const normalLengthSq = 1 + ramp.dx * ramp.dx + ramp.dz * ramp.dz;
        vx += normalVelocity * ramp.dx / normalLengthSq;
        vz += normalVelocity * ramp.dz / normalLengthSq;
        vy -= normalVelocity / normalLengthSq;
        y = rampSurfaceY; onRamp = true;
      } else onRamp = false;
      const speed = Math.hypot(vx, vy, vz);
      if (speed > PHYSICS_TUNING.MAX_BALL_SPEED) {
        const factor = PHYSICS_TUNING.MAX_BALL_SPEED / speed;
        vx *= factor; vy *= factor; vz *= factor;
      }
    }
    pred.push({ x, y, z });
  }
}
function aiCtl(c, dt) {
  c.aiCd -= dt; c.errT = (c.errT || 0) - dt;
  const sk = SKILL[diff], ct = { throttle: sk.thr, steer: 0, jump: false, jumpHeld: false, boost: false, hand: false };
  // Difficulty cap must not be multiplied into itself every physics tick.
  c.cap = sk.cap * (c.baseCap || 1);
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
// Actual local-axis aerial rotation. Euler angles are kept for old HUD/replay
// compatibility, but the quaternion is authoritative while the car is airborne.
const AIR_X = new THREE.Vector3(1,0,0);
const AIR_Y = new THREE.Vector3(0,1,0);
const AIR_Z = new THREE.Vector3(0,0,1);
function getCarOrientation(c) {
  return c.airQuat || new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-(c.pitch || 0), c.yaw || 0, c.roll || 0, 'YXZ'));
}
function getCarForward(c) {
  return AIR_Z.clone().applyQuaternion(getCarOrientation(c));
}
function aerialControl(c, ct, dt) {
  if (!c.airQuat) c.airQuat = getCarOrientation(c).clone();
  if (!c.airOmega) c.airOmega = { pitch:0, yaw:0, roll:0 };
  const omega = c.airOmega;
  // Stick input approaches an angular velocity; releasing the stick damps
  // smoothly rather than instantly snapping to a different rotation.
  const blend = 1 - Math.exp(-12 * dt);
  const pitchTarget = clamp(ct.throttle || 0, -1, 1) * PHYSICS_TUNING.PITCH_TORQUE_SPEED;
  const yawTarget = -clamp(ct.steer || 0, -1, 1) * PHYSICS_TUNING.YAW_TORQUE_SPEED;
  const rollTarget = clamp(ct.roll || 0, -1, 1) * PHYSICS_TUNING.ROLL_TORQUE_SPEED;
  omega.pitch += (pitchTarget - omega.pitch) * blend;
  omega.yaw += (yawTarget - omega.yaw) * blend;
  omega.roll += (rollTarget - omega.roll) * blend;
  c.airQuat.multiply(new THREE.Quaternion().setFromAxisAngle(AIR_X, omega.pitch * dt));
  c.airQuat.multiply(new THREE.Quaternion().setFromAxisAngle(AIR_Y, omega.yaw * dt));
  c.airQuat.multiply(new THREE.Quaternion().setFromAxisAngle(AIR_Z, omega.roll * dt));
  c.airQuat.normalize();
  const e = new THREE.Euler().setFromQuaternion(c.airQuat, 'YXZ');
  c.pitch = -e.x; c.yaw = e.y; c.roll = e.z;
}
function applyDirectionalBoost(c, dt, onSurface) {
  const nose = getCarForward(c);
  const accel = onSurface ? PHYSICS_TUNING.BOOST_FORCE :
    PHYSICS_TUNING.AIR_BOOST_FORCE;
  c.vx += nose.x * accel * dt;
  c.vy += nose.y * accel * dt;
  c.vz += nose.z * accel * dt;
}
// Standard 120Hz Rocket League-inspired ground response in game units
// (one world unit ~= 50 Unreal units). Throttle has a 1410uu/s terminal
// speed, while boost can accelerate well past it WITHOUT instant deceleration
// the moment boost is released.
function groundThrottleAcceleration(v) {
  const speed = Math.abs(v) * PHYSICS_TUNING.REFERENCE_SCALE;
  if (speed >= 1410) return 0;
  if (speed > 1400) return (160 * (1410 - speed) / 10) / PHYSICS_TUNING.REFERENCE_SCALE;
  return (1600 - 1440 * (speed / 1400)) / PHYSICS_TUNING.REFERENCE_SCALE;
}
function stepGroundForward(v, throttle, boosting, dt) {
  const demand = boosting ? 1 : clamp(throttle || 0, -1, 1);
  if (Math.abs(demand) < 0.01) {
    const amount = 525 / PHYSICS_TUNING.REFERENCE_SCALE * dt;
    return Math.abs(v) <= amount ? 0 : v - Math.sign(v) * amount;
  }
  if (v * demand < -0.01) return v + Math.sign(demand) *
    (3500 / PHYSICS_TUNING.REFERENCE_SCALE) * dt;
  return v + demand * groundThrottleAcceleration(v) * dt;
}
function groundSteeringCurvature(speedUnits, powerslide) {
  const samples = [[0,.0069],[500,.0042],[1000,.0028],[1500,.0017],
    [1750,.0014],[2300,.0010]];
  let curvature=samples[samples.length-1][1];
  for(let i=1;i<samples.length;i++) if(speedUnits <= samples[i][0]) {
    const a=samples[i-1],b=samples[i];
    const t=clamp((speedUnits-a[0])/(b[0]-a[0]),0,1);
    curvature=a[1]+(b[1]-a[1])*t;
    break;
  }
  return curvature * (1 + (powerslide || 0) * 1.15);
}
function stepCar(c, ct, dt) {
  c.demoCooldown = Math.max(0, (c.demoCooldown || 0) - dt);
  c.ballHitCooldown = Math.max(0, (c.ballHitCooldown || 0) - dt);
  c.airTouchCooldown = Math.max(0, (c.airTouchCooldown || 0) - dt);
  if (c.demoTimer > 0) {
    c.demoTimer = Math.max(0, c.demoTimer - dt);
    c.vx = c.vy = c.vz = 0; c.y = 0.55; c.pitch = 0; c.fl = 0;
    if (c.demoTimer <= 0) {
      c.x = 0; c.z = c.team ? HL - 14 : -HL + 14; c.yaw = c.team ? Math.PI : 0;
      c.pitch = 0; c.roll = 0; c.wallRide = false; c.wallVerticalAxis = null; c.wallVerticalSign = 0;
      c.boost = 34; c.jumps = 0; c.jt = 0; c.ground = true; c.boostImpactTimer = 0;
      c.mesh.root.visible = true;
    } else {
      c.mesh.root.visible = false;
    }
    return;
  }
  c.jt += dt; if (c.flip > 0) c.flip -= dt;
  // Brief separation grace after a wall/ramp jump. Otherwise the same ramp
  // snaps the car back onto its surface in the next physics step.
  c.wallDetachTimer = Math.max(0, (c.wallDetachTimer || 0) - dt);
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const startingRamp = arenaRampAt(c.x, c.z);
  if (c.wallVerticalAxis) {
    c.wallRide = true;
    if (c.wallVerticalAxis === 'x') c.x = c.wallVerticalSign * (HW - 1.3);
    else c.z = c.wallVerticalSign * (HL - 1.9);
    // Align the bonnet with the upward wall direction without hard-snapping.
    const wallYaw = c.wallVerticalAxis === 'x'
      ? c.wallVerticalSign * Math.PI / 2
      : c.wallVerticalSign > 0 ? 0 : Math.PI;
    c.yaw += wrap(wallYaw - c.yaw) * clamp(6 * dt, 0, 1);
    c.pitch += wrap(Math.PI / 2 - c.pitch) * clamp(9 * dt, 0, 1);
    c.roll = 0;
  } else {
    const touchingRamp = c.y <= startingRamp.height + 1.05;
    // Keep adhesion while accelerating UP a slope. The former vy<=0.5
    // check incorrectly marked upward-moving ramp cars as airborne.
    c.wallRide = c.wallDetachTimer <= 0 && startingRamp.height > 0.03 &&
      touchingRamp && (c.wallRide || c.vy <= 0.5);
    if (c.wallRide) {
      const targetY = startingRamp.height + 0.55;
      if (c.y < targetY) c.y += (targetY - c.y) * clamp(45 * dt, 0, 1);
      if (c.vy < 0) c.vy = 0;
      const slopeAlongNose = startingRamp.dx * sy + startingRamp.dz * cy;
      const pitchTarget = Math.atan(slopeAlongNose);
      c.pitch += wrap(pitchTarget - c.pitch) * clamp(9 * dt, 0, 1);
      c.roll += (0 - c.roll) * clamp(9 * dt, 0, 1);
    } else if (c.y <= 0.56) {
      c.roll += (0 - c.roll) * clamp(7 * dt, 0, 1);
    }
  }
  const ground = c.wallDetachTimer <= 0 && (c.y <= 0.56 || c.wallRide); c.ground = ground;
  if (ground) {
    c.airQuat = null;
    c.airOmega = null;
  }
  const bo = !!ct.boost && c.boost > 0;
  // Keep a very short grace window so a clean boost collision still counts if boost
  // ends on the exact simulation frame the cars make contact.
  c.boostImpactTimer = bo ? 0.18 : Math.max(0, (c.boostImpactTimer || 0) - dt);
  if (trainingMode && !c.ai) c.boost = 100;
  if (bo) { c.boost = Math.max(0, c.boost - PHYSICS_TUNING.BOOST_DRAIN_PER_SECOND * dt); emitBoost(c); }
  c.fl = bo ? 1 : 0;
  if (c.wallVerticalAxis) {
    // On the vertical wall, throttle drives along the wall's vertical axis.
    // Steering moves laterally across the wall so the player can aim along it.
    c.jumps = 0; c.jt = 0; c.hold = 0;
    const wallAccel = PHYSICS_TUNING.GROUND_ACCELERATION *
      (physicsStyle === 'arcade' ? 1.15 : physicsStyle === 'heavy' ? 0.8 : 1);
    c.vy += (ct.throttle * wallAccel - PHYSICS_TUNING.GRAVITY_FORCE * 0.55) * dt;
    c.vy = clamp(c.vy, -20, PHYSICS_TUNING.MAX_SPEED);
    if (c.wallVerticalAxis === 'x') {
      c.x = c.wallVerticalSign * (HW - 1.3); c.vx = 0;
      c.vz = clamp((c.vz + ct.steer * 16 * dt) * Math.max(0, 1 - 3.5 * dt), -24, 24);
    } else {
      c.z = c.wallVerticalSign * (HL - 1.9); c.vz = 0;
      c.vx = clamp((c.vx - ct.steer * 16 * dt) * Math.max(0, 1 - 3.5 * dt), -24, 24);
    }
    c.pitch += wrap(Math.PI / 2 - c.pitch) * clamp(9 * dt, 0, 1);
    c.roll = 0;
  } else if (ground) {
    c.jumps = 0; c.jt = 0; c.hold = 0;
    if (c.wallRide) {
      const currentRamp = arenaRampAt(c.x, c.z);
      const pitchTarget = Math.atan(currentRamp.dx * sy + currentRamp.dz * cy);
      c.pitch += wrap(pitchTarget - c.pitch) * clamp(9 * dt, 0, 1);
    } else c.pitch *= Math.max(0, 1 - 10 * dt);
    let vf = c.vx * sy + c.vz * cy, vs = c.vx * cy - c.vz * sy;
    c.powerslide = clamp((c.powerslide || 0) +
      (ct.hand ? PHYSICS_TUNING.POWERSLIDE_RISE_RATE : -PHYSICS_TUNING.POWERSLIDE_FALL_RATE) * dt, 0, 1);
    const hb = c.powerslide;
    const physicalScale = physicsStyle === 'arcade' ? 1.2 : physicsStyle === 'heavy' ? 0.85 : 1;
    const effectiveThrottle = ct.throttle || (bo ? 1 : 0);
    vf = stepGroundForward(vf, effectiveThrottle, bo, dt * physicalScale);
    // Gravity must pull the car downhill; this is especially important on
    // side-wall ramps where holding W should not produce free uphill thrust.
    if (c.wallRide) {
      const slope = arenaRampAt(c.x,c.z);
      const slopeAlongNose = slope.dx*sy+slope.dz*cy;
      vf -= PHYSICS_TUNING.GRAVITY_FORCE *
        (slopeAlongNose / Math.hypot(1, slopeAlongNose)) * dt;
    }
    const lateralFriction = PHYSICS_TUNING.NORMAL_LATERAL_FRICTION *
      (1 - hb * (1 - PHYSICS_TUNING.POWERSLIDE_FRICTION_MULTIPLIER));
    vs *= Math.exp(-lateralFriction * dt);
    // Use curvature rather than arbitrary turn-rate interpolation. Fast cars
    // naturally take wider arcs; handbrake breaks the rear grip.
    const yawRate = Math.abs(vf) * PHYSICS_TUNING.REFERENCE_SCALE *
      groundSteeringCurvature(Math.abs(vf)*PHYSICS_TUNING.REFERENCE_SCALE,hb);
    c.yaw -= (ct.steer || 0) * Math.min(5.5,yawRate) *
      (vf >= 0 ? 1 : -1) * dt;
    // Resolve tyre velocity in the NEW heading, not last frame's steering.
    const sy2=Math.sin(c.yaw),cy2=Math.cos(c.yaw);
    c.vx = sy2 * vf + cy2 * vs; c.vz = cy2 * vf - sy2 * vs;
    // Ramp traction projects velocity along the slope; no zeroing on every frame.
    if (c.wallRide) {
      const grade = arenaRampAt(c.x, c.z);
      c.vy = c.vx * grade.dx + c.vz * grade.dz;
    } else c.vy = 0;
  } else {
    const gravityScale = physicsStyle === 'floaty' ? 0.72 : physicsStyle === 'heavy' ? 1.2 : 1;
    c.vy -= PHYSICS_TUNING.GRAVITY_FORCE * gravityScale * dt;
    aerialControl(c, ct, dt);
    if (c.hold > 0 && ct.jumpHeld && c.jumps === 1) {
      c.vy += PHYSICS_TUNING.JUMP_HOLD_FORCE * dt;
      c.hold = Math.max(0, c.hold - dt);
    } else c.hold = 0;
    // Air throttle is not physical forward drive: it controls pitch above.
    // Only a little aerodynamic drag acts while the car is airborne.
    const damp = Math.max(0, 1 - PHYSICS_TUNING.AIR_LINEAR_DRAG * dt);
    c.vx *= damp; c.vy *= damp; c.vz *= damp;
  }
  // The nose, air roll and pitch determine the true rocket thrust vector.
  if (bo) applyDirectionalBoost(c, dt, ground);
  if (ct.jump) {
    if (c.wallVerticalAxis) {
      const wallAxis = c.wallVerticalAxis, wallSign = c.wallVerticalSign;
      c.wallVerticalAxis = null; c.wallVerticalSign = 0; c.wallRide = false;
      c.wallDetachTimer = 0.32;
      // Surface-normal impulse goes INTO the arena, not through the wall.
      // Preserve upward wall momentum and bonnet pitch so boost can follow
      // the ball immediately instead of launching horizontally.
      c.vy = Math.max(c.vy, 8.5);
      if (wallAxis === 'x') {
        c.vx = -wallSign * 12;
        c.x -= wallSign * 0.12;
      } else {
        c.vz = -wallSign * 12;
        c.z -= wallSign * 0.12;
      }
      c.pitch = Math.max(0.75, c.pitch);
      c.airQuat = null; c.airOmega = null;
      c.jumps = 1; c.jt = 0;
      c.hold = PHYSICS_TUNING.JUMP_HOLD_DURATION;
      c.y += 0.08;
    } else if (ground) {
      if (c.wallRide) {
        const slope = arenaRampAt(c.x, c.z);
        const norm = Math.hypot(slope.dx, 1, slope.dz);
        const launch = PHYSICS_TUNING.JUMP_IMPULSE;
        c.vx += -slope.dx / norm * launch * 0.9;
        c.vz += -slope.dz / norm * launch * 0.9;
        c.vy = Math.max(c.vy, launch / norm);
        c.wallRide = false;
        c.wallDetachTimer = 0.28;
        c.airQuat = null; c.airOmega = null;
      } else {
        c.vy = PHYSICS_TUNING.JUMP_IMPULSE;
      }
      c.jumps = 1; c.jt = 0;
      c.hold = PHYSICS_TUNING.JUMP_HOLD_DURATION; c.y += 0.08;
    } else if (c.jumps === 1 && c.jt < PHYSICS_TUNING.DOUBLE_JUMP_WINDOW) {
      c.jumps = 2;
      const f = ct.dodge ? ct.dodge[0] : ct.throttle, s = ct.dodge ? ct.dodge[1] : ct.steer;
      if (f || s) {
        c.vx += (sy * f - cy * s) * PHYSICS_TUNING.DODGE_IMPULSE;
        c.vz += (cy * f + sy * s) * PHYSICS_TUNING.DODGE_IMPULSE;
        c.vy = Math.max(c.vy, 3); c.flip = 0.55; c.fx = f; c.fz = s;
      } else c.vy = PHYSICS_TUNING.DOUBLE_JUMP_IMPULSE;
    }
  }
  if (c.ai) c.boost = Math.min(100, c.boost + 8 * dt);
  // Boost momentum persists after boost is released. Only genuine physics
  // (coasting, braking, tyre friction) can slow the car from supersonic speed.
  const absoluteLimit = PHYSICS_TUNING.MAX_SPEED;
  const carSpeed = Math.hypot(c.vx, c.vy, c.vz);
  if (carSpeed > absoluteLimit) {
    const scale = absoluteLimit / carSpeed;
    c.vx *= scale; c.vy *= scale; c.vz *= scale;
  }
  c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
  if (c.y < 0.55) { c.y = 0.55; if (c.vy < 0) c.vy = 0; }
  if (c.y > CEIL - 0.6) { c.y = CEIL - 0.6; if (c.vy > 0) c.vy = 0; }
  if (Math.abs(c.x) > HW - 1.3) {
    const sx = Math.sign(c.x); c.x = sx * (HW - 1.3);
    const edgeRamp = arenaRampAt(c.x, c.z);
    const outwardSpeed = c.vx * sx;
    const noseOut = Math.sin(c.yaw) * sx;
    if (c.wallVerticalAxis === 'x') {
      c.vx = 0;
    } else if (!ct.jump && !c.wallVerticalAxis && c.wallRide && edgeRamp.height > WALL_RAMP_HEIGHT * 0.62 && noseOut > 0.42 && outwardSpeed > 5) {
      c.wallVerticalAxis = 'x'; c.wallVerticalSign = sx;
      c.y = Math.max(c.y, edgeRamp.height + 0.55);
      c.vy = Math.max(c.vy, Math.max(7, outwardSpeed * 0.62));
      c.vx = 0; c.pitch = Math.atan(edgeRamp.dx * Math.sin(c.yaw) + edgeRamp.dz * Math.cos(c.yaw)); c.roll = 0;
      c.wallRide = true;
    } else c.vx *= -0.2;
  }
  if (Math.abs(c.z) > HL - 1.9) {
    const sz = Math.sign(c.z); c.z = sz * (HL - 1.9);
    const edgeRamp = arenaRampAt(c.x, c.z);
    const outwardSpeed = c.vz * sz;
    const noseOut = Math.cos(c.yaw) * sz;
    if (c.wallVerticalAxis === 'z') {
      c.vz = 0;
    } else if (!ct.jump && !c.wallVerticalAxis && c.wallRide && Math.abs(c.x) > GW + 2 && edgeRamp.height > WALL_RAMP_HEIGHT * 0.62 && noseOut > 0.42 && outwardSpeed > 5) {
      c.wallVerticalAxis = 'z'; c.wallVerticalSign = sz;
      c.y = Math.max(c.y, edgeRamp.height + 0.55);
      c.vy = Math.max(c.vy, Math.max(7, outwardSpeed * 0.62));
      c.vz = 0; c.pitch = Math.atan(edgeRamp.dx * Math.sin(c.yaw) + edgeRamp.dz * Math.cos(c.yaw)); c.roll = 0;
      c.wallRide = true;
    } else c.vz *= -0.2;
  }
  const ov = Math.abs(c.x) + Math.abs(c.z) - (HW + HL - CH - 2.5); // rounded corners
  if (ov > 0) {
    const sx = Math.sign(c.x), sz = Math.sign(c.z), vn = (c.vx * sx + c.vz * sz) * 0.7071;
    c.x -= sx * ov / 2; c.z -= sz * ov / 2; if (vn > 0) { c.vx -= sx * vn * 0.7071 * 1.2; c.vz -= sz * vn * 0.7071 * 1.2; }
  }
  const rampNow = arenaRampAt(c.x, c.z);
  const rampSupportY = rampNow.height + 0.55;
  if (c.wallVerticalAxis) {
    c.wallRide = true; c.roll = 0;
    // If the car runs out of upward momentum, settle back onto the curved ramp.
    if (c.y <= rampSupportY + 0.45 && c.vy < 0) {
      c.wallVerticalAxis = null; c.wallVerticalSign = 0;
      c.y += (rampSupportY - c.y) * clamp(38 * dt, 0, 1);
    c.vy = c.vx * rampNow.dx + c.vz * rampNow.dz;
    c.wallRide = true;
      c.pitch = Math.atan(rampNow.dx * Math.sin(c.yaw) + rampNow.dz * Math.cos(c.yaw));
    } else if (c.y >= CEIL - 1.5 || c.vy < -8) {
      c.wallVerticalAxis = null; c.wallVerticalSign = 0;
      c.wallRide = false; c.pitch = 0; c.vy = Math.min(c.vy, 0);
    } else {
      c.pitch += wrap(Math.PI / 2 - c.pitch) * clamp(9 * dt, 0, 1);
    }
  } else if (c.wallDetachTimer <= 0 && rampNow.height > 0.03 &&
      ((c.wallRide && !ct.jump) || c.y < rampSupportY - 0.05 ||
       (c.y <= rampSupportY + 0.22 && c.vy <= 0.5))) {
    // Maintain tangent velocity on the curved mesh rather than killing y
    // velocity / snapping the car each frame. Support is positional only.
    c.y += (rampSupportY - c.y) * clamp(35 * dt, 0, 1);
    c.vy = c.vx * rampNow.dx + c.vz * rampNow.dz;
    c.wallRide = true;
    const slopeAlongNose = rampNow.dx * Math.sin(c.yaw) + rampNow.dz * Math.cos(c.yaw);
    const pitchTarget = Math.atan(slopeAlongNose);
    c.pitch += wrap(pitchTarget - c.pitch) * clamp(10 * dt, 0, 1);
    c.roll += (0 - c.roll) * clamp(10 * dt, 0, 1);
  } else {
    c.wallRide = false;
    if (c.y <= 0.56) c.roll += (0 - c.roll) * clamp(7 * dt, 0, 1);
    else c.roll = wrap(c.roll);
  }
  // Supersonic has hysteresis: enter at 2200 reference units/s, retain to 2100,
  // and keep the state for at most one second after dropping below the entry threshold.
  const referenceSpeed = Math.hypot(c.vx, c.vy, c.vz) * PHYSICS_TUNING.REFERENCE_SCALE;
  if (referenceSpeed >= PHYSICS_TUNING.SUPERSONIC_START_REFERENCE) {
    c.supersonic = true;
    c.supersonicTimer = PHYSICS_TUNING.SUPERSONIC_HOLD_SECONDS;
  } else if (c.supersonic) {
    c.supersonicTimer = Math.max(0, (c.supersonicTimer || 0) - dt);
    if (referenceSpeed < PHYSICS_TUNING.SUPERSONIC_DROP_REFERENCE && c.supersonicTimer <= 0) c.supersonic = false;
  }
  if (c.mesh && c.mesh.root) c.mesh.root.userData.supersonic = !!c.supersonic;
  for (const p of pads) {
    // Cooldown is global to the pad, not accelerated by the number of cars in a match.
    if (cars[0] === c) p.t = Math.max(0, p.t - dt);
    const horizontalDistance = Math.hypot(c.x - p.x, c.z - p.z);
    const verticalDistance = Math.abs(c.y - (p.surfaceY + 0.55));
    const pickupRadius = p.big ? 4.0 : 2.7;
    const verticalReach = p.big ? 3.4 : 2.0;
    if (p.t <= 0 && c.boost < 100 &&
        horizontalDistance < pickupRadius && verticalDistance < verticalReach) {
      const amount = p.big ? PHYSICS_TUNING.LARGE_BOOST_PICKUP : PHYSICS_TUNING.SMALL_BOOST_PICKUP;
      const before = c.boost;
      c.boost = Math.min(100, c.boost + amount);
      if (c.boost > before) {
        p.t = p.big ? PHYSICS_TUNING.LARGE_PAD_COOLDOWN : PHYSICS_TUNING.SMALL_PAD_COOLDOWN;
        if (!c.ai) showGameEvent(p.big ? 'FULL BOOST +100' : 'BOOST +12', p.big ? '#ffca64' : '#37f2c0');
        for (let n = 0; n < (p.big ? 28 : 12); n++) {
          const a = Math.random() * Math.PI * 2, burst = 3 + Math.random() * 9;
          emit(p.x, p.surfaceY + 0.35, p.z, Math.cos(a) * burst, 3 + Math.random() * 6, Math.sin(a) * burst, 0.35 + Math.random() * 0.3, p.big ? 1 : 0.35, p.big ? 0.75 : 1, p.big ? 0.2 : 0.8);
        }
      }
    }
  }
}
function tryDemolish(attacker, victim, dirX, dirZ) {
  if (attacker.team === victim.team ||
      attacker.demoCooldown > 0 || attacker.demoTimer > 0 || victim.demoTimer > 0 ||
      (attacker.boostImpactTimer || 0) <= 0) return false;
  const speed = Math.hypot(attacker.vx, attacker.vz);
  const noseX = Math.sin(attacker.yaw), noseZ = Math.cos(attacker.yaw);
  const forwardSpeed = attacker.vx * noseX + attacker.vz * noseZ;
  const facingImpact = noseX * dirX + noseZ * dirZ;
  const relativeClosingSpeed = (attacker.vx - victim.vx) * dirX + (attacker.vz - victim.vz) * dirZ;
  // Demolish only when a boosted opponent is genuinely charging into the impact.
  if (speed < 40 || forwardSpeed < 30 || facingImpact < 0.68 || relativeClosingSpeed < 28) return false;

  const stat = playerStats[cars.indexOf(attacker)];
  if (stat) stat.demos = (stat.demos || 0) + 1;
  attacker.demoCooldown = 1.35;
  attacker.boostImpactTimer = 0;
  victim.demoTimer = 3;
  victim.vx = victim.vy = victim.vz = 0;
  victim.fl = 0; victim.pitch = 0; victim.roll = 0; victim.flip = 0; victim.wallRide = false;
  victim.boostImpactTimer = 0;
  victim.mesh.root.visible = false;
  const color = victim.team ? [1, 0.46, 0.1] : [0.12, 0.72, 1];
  for (let n = 0; n < 54; n++) {
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI;
    const speedBurst = 9 + Math.random() * 23;
    emit(victim.x, victim.y + 0.8, victim.z,
      Math.cos(a) * speedBurst, Math.sin(e) * speedBurst + 4, Math.sin(a) * speedBurst,
      0.6 + Math.random() * 0.4, color[0], color[1], color[2]);
  }
  showGameEvent('DEMOLITION!', '#ffca64');
  return true;
}
function bump() {
  for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) {
    const a = cars[i], b = cars[j];
    if (a.demoTimer > 0 || b.demoTimer > 0) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= 3.15 || d < 1e-3 || Math.abs(a.y - b.y) >= 1.5) continue;

    const nx = dx / d, nz = dz / d;
    // Separate overlapping bumpers every frame to stop cars snagging together.
    const penetration = 3.15 - d;
    const aShare = (b.mass || 4) / ((a.mass || 4) + (b.mass || 4));
    const bShare = 1 - aShare;
    a.x -= nx * penetration * aShare; a.z -= nz * penetration * aShare;
    b.x += nx * penetration * bShare; b.z += nz * penetration * bShare;

    // Try a boost demolition in either direction before doing a regular bump.
    if (tryDemolish(a, b, nx, nz) || tryDemolish(b, a, -nx, -nz)) continue;

    // A positive closing speed means the cars are actually driving into each other.
    const closingSpeed = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    const pairKey = 'bump:' + Math.min(i, j) + ':' + Math.max(i, j);
    if (closingSpeed > 1.5 && (eventCooldown[pairKey] || 0) <= t) {
      eventCooldown[pairKey] = t + 0.22;
      const impulse = Math.min(25, 4 + closingSpeed * 0.78);
      // Knock both cars apart, with a small vertical jolt for a heavy hit.
      a.vx -= nx * impulse * aShare; a.vz -= nz * impulse * aShare;
      b.vx += nx * impulse * bShare; b.vz += nz * impulse * bShare;
      if (closingSpeed > 13) {
        const pop = Math.min(3.5, closingSpeed * 0.055);
        if (a.y > 0.7 || a.wallRide) a.vy += pop * 0.5;
        if (b.y > 0.7 || b.wallRide) b.vy += pop * 0.5;
        showGameEvent('BIG BUMP!', '#ffca64');
      } else {
        showGameEvent('BUMP!', '#d9eaff');
      }
    }
  }
}
// Standard sphere-versus-oriented-box contact, with a small scripted shot impulse.
// Resolve the physical impulse every contact; only boost the shot at a new impact.
function hitBall(c) {
  if (c.demoTimer > 0) return;
  // Proper 3D oriented hitbox: yaw + aerial pitch + roll. The old collision
  // ignored pitch and roll, so a car pointing up a wall could visually touch
  // the ball while the collision system thought it had missed it completely.
  const orientation = getCarOrientation(c);
  const right = AIR_X.clone().applyQuaternion(orientation);
  const up = AIR_Y.clone().applyQuaternion(orientation);
  const nose = AIR_Z.clone().applyQuaternion(orientation);
  const rx=right.x, ry=right.y, rz=right.z;
  const ux=up.x, uy=up.y, uz=up.z;
  const fx=nose.x, fy=nose.y, fz=nose.z;
  const dx = ball.x - c.x, dy = ball.y - c.y, dz = ball.z - c.z;
  const box = c.hitbox || {
    length: c.hit || 1.7, width: (c.hit || 1.7) * 0.6, height: 0.55,
    forward: 0, up: 0
  };
  const forward = dx * fx + dy * fy + dz * fz - box.forward;
  const side = dx * rx + dy * ry + dz * rz;
  const height = dx * ux + dy * uy + dz * uz - box.up;
  const halfLength = box.length, halfWidth = box.width, halfHeight = box.height;
  const nearForward = clamp(forward, -halfLength, halfLength);
  const nearSide = clamp(side, -halfWidth, halfWidth);
  const nearHeight = clamp(height, -halfHeight, halfHeight);
  let nf = forward - nearForward, ns = side - nearSide, nh = height - nearHeight;
  let distance = Math.hypot(nf, ns, nh);
  if (distance >= BR) return;

  // When the ball centre is inside the car hitbox, find the closest face.
  // The old fallback always sent it straight upwards, causing random launches.
  if (distance < 1e-6) {
    const faces = [
      { gap: halfLength - Math.abs(forward), f: Math.sign(forward) || 1, s: 0, h: 0 },
      { gap: halfWidth - Math.abs(side), f: 0, s: Math.sign(side) || 1, h: 0 },
      { gap: halfHeight - Math.abs(height), f: 0, s: 0, h: Math.sign(height) || 1 }
    ].sort((a, b) => a.gap - b.gap);
    nf = faces[0].f; ns = faces[0].s; nh = faces[0].h;
    distance = 0;
  } else {
    nf /= distance; ns /= distance; nh /= distance;
  }
  const nx = fx * nf + rx * ns + ux * nh;
  const ny = fy * nf + ry * ns + uy * nh;
  const nz = fz * nf + rz * ns + uz * nh;
  const penetration = BR - distance;
  const separation = Math.min(penetration + 0.001, BR + 0.7);
  ball.x += nx * separation;
  ball.y += ny * separation;
  ball.z += nz * separation;

  // Relative velocity includes the velocity of the car's contact point,
  // not only its centre. Rolling the nose onto the ball now gives a real
  // tangential touch instead of a random extra forward force.
  const arm = new THREE.Vector3(ball.x-nx*BR-c.x, ball.y-ny*BR-c.y, ball.z-nz*BR-c.z);
  const omega = c.airOmega ? new THREE.Vector3(
    c.airOmega.pitch, c.airOmega.yaw, c.airOmega.roll).applyQuaternion(orientation)
    : new THREE.Vector3();
  const contactSpeed = omega.cross(arm).clampLength(0,12);
  const rvx = ball.vx - (c.vx + contactSpeed.x);
  const rvy = ball.vy - (c.vy + contactSpeed.y);
  const rvz = ball.vz - (c.vz + contactSpeed.z);
  const closing = -(rvx * nx + rvy * ny + rvz * nz);
  if (closing <= 0.18) return;
  if (trainingMode && !c.ai && !c.ground && !c.wallRide &&
      closing > 0.7 && (c.airTouchCooldown || 0) <= 0) {
    trainingAirTouches++;
    c.airTouchCooldown = 0.17;
    updateTrainingCounters();
  }

  const index = cars.indexOf(c), stat = playerStats[index];
  if (lastTouch !== c) { previousTouch = lastTouch; lastTouch = c; }
  const nearOwnGoal = Math.abs(c.z - (c.team ? -HL : HL)) < 28;
  if (stat && nearOwnGoal && Math.abs(ball.z) > HL - 35 &&
      ball.vz * (c.team ? 1 : -1) > 2 && (eventCooldown['clear' + index] || 0) <= t) {
    stat.clears++; eventCooldown['clear' + index] = t + 3; showGameEvent('CLEARANCE', '#37f2c0');
  }
  if (stat && Math.abs(ball.z) > HL - 24 && Math.abs(ball.x) < GW + 12 &&
      ball.vz * (c.team ? 1 : -1) > 1 && (eventCooldown['save' + index] || 0) <= t) {
    stat.saves++; eventCooldown['save' + index] = t + 3; showGameEvent('SAVE!', '#37f2c0');
  }
  if (closing > 5) sparks(-closing);

  const inverseBallMass = 1 / PHYSICS_TUNING.BALL_MASS_REFERENCE;
  const inverseCarMass = 1 / PHYSICS_TUNING.CAR_MASS_REFERENCE;
  const impulse = closing * (1 + PHYSICS_TUNING.CAR_BALL_RESTITUTION) / (inverseBallMass + inverseCarMass);
  const ballChange = impulse * inverseBallMass, carChange = impulse * inverseCarMass;
  ball.vx += nx * ballChange; ball.vy += ny * ballChange; ball.vz += nz * ballChange;
  c.vx -= nx * carChange; c.vy -= ny * carChange; c.vz -= nz * carChange;

  // Only the first substantial impact in a short window receives additional
  // shot power. This prevents the "sticky / accelerating ball" behaviour.
  c.ballHitCooldown = Math.max(0, (c.ballHitCooldown || 0));
  if (c.ballHitCooldown <= 0 && closing > 1.7) {
    const aligned = clamp(fx * nx + fy * ny + fz * nz, 0, 1);
    const forwardSpeed = Math.max(0, c.vx * fx + c.vy * fy + c.vz * fz);
    const aerial = !c.ground && !c.wallRide;
    // Air dribbles require a SERIES of light velocity-matching touches.
    // Unlike dodges and ground shots, the nose must not inject a huge extra
    // impulse on each frame of a close aerial carry.
    const extra = aerial
      ? aligned * (c.flip > 0 ? Math.min(7, closing*0.18+3) :
          Math.min(1.35, closing*0.055 + forwardSpeed*0.012))
      : aligned * Math.min(13, closing*0.12 + forwardSpeed*0.05 +
          (c.flip > 0 ? 5 : 0) + (c.fl ? 2.2 : 0));
    ball.vx += fx * extra; ball.vy += fy * extra; ball.vz += fz * extra;
    if (ny > 0.2 && forward > -0.4) {
      ball.vy += Math.min(aerial ? 0.4 : 2.2, closing * (aerial ? 0.035 : 0.1));
    }
    c.ballHitCooldown = aerial ? 0.11 : 0.085;
  }

  // Tangential contact velocity imparts a bounded amount of ball spin.
  const tx = rvx + closing * nx, ty = rvy + closing * ny, tz = rvz + closing * nz;
  const spinTransfer = 0.012;
  ball.wx += (ny * tz - nz * ty) * spinTransfer;
  ball.wy += (nz * tx - nx * tz) * spinTransfer;
  ball.wz += (nx * ty - ny * tx) * spinTransfer;
  clampBallMotion();
}
function clampBallMotion() {
  const speed = Math.hypot(ball.vx, ball.vy, ball.vz);
  if (speed > PHYSICS_TUNING.MAX_BALL_SPEED) {
    const scale = PHYSICS_TUNING.MAX_BALL_SPEED / speed;
    ball.vx *= scale; ball.vy *= scale; ball.vz *= scale;
  }
  const spin = Math.hypot(ball.wx || 0, ball.wy || 0, ball.wz || 0);
  if (spin > PHYSICS_TUNING.BALL_MAX_ANGULAR_SPEED) {
    const scale = PHYSICS_TUNING.BALL_MAX_ANGULAR_SPEED / spin;
    ball.wx *= scale; ball.wy *= scale; ball.wz *= scale;
  }
}
function ballSurfaceImpulse(nx, ny, nz, restitution) {
  const vn = ball.vx * nx + ball.vy * ny + ball.vz * nz;
  if (vn >= 0) return;
  const e = vn < -1.5 ? restitution : 0;
  ball.vx -= (1 + e) * vn * nx;
  ball.vy -= (1 + e) * vn * ny;
  ball.vz -= (1 + e) * vn * nz;
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

// Transfer momentum from the curved ramp into VERTICAL wall rolling. Without
// this the ball hits a flat invisible barrier at the ramp lip and rebounds.
function resolveBallWall(axis, sign, rampSurfaceY) {
  const outward = (axis === 'x' ? ball.vx : ball.vz) * sign;
  const atWallLip = rampSurfaceY > WALL_RAMP_HEIGHT * 0.78 &&
    ball.y > rampSurfaceY - 2.2 &&
    ball.y < rampSurfaceY + 4.2;
  if (atWallLip && outward > 5 && ball.vy > -5) {
    ball.vy = Math.max(ball.vy, outward * 0.86 + 1.1);
    if (axis === 'x') ball.vx = 0;
    else ball.vz = 0;
    ball.onRamp = false;
    ball.onGround = false;
    ball.onWall = true;
    // Turning surface momentum upward is the wall ramp continuation, not an
    // extra speed boost. The sphere will naturally slow and fall under gravity.
  } else {
    ballSurfaceImpulse(axis === 'x' ? -sign : 0, 0,
      axis === 'z' ? -sign : 0, PHYSICS_TUNING.BALL_WALL_RESTITUTION);
    ball.onWall = false;
  }
}
function stepBall(dt) {
  const p = PHYSICS_TUNING;
  // Integrate velocity before contacts, keeping all motion in world space.
  ball.vy -= p.BALL_GRAVITY_FORCE * dt;
  const airDrag = Math.max(0, 1 - p.BALL_DRAG_REFERENCE * dt);
  ball.vx *= airDrag; ball.vy *= airDrag; ball.vz *= airDrag;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;

  if (ball.y > CEIL - BR) {
    ball.y = CEIL - BR;
    ballSurfaceImpulse(0, -1, 0, p.BALL_RESTITUTION);
  }
  const ax = Math.abs(ball.x), az = Math.abs(ball.z);
  const sx = Math.sign(ball.x) || 1, sz = Math.sign(ball.z) || 1;
  if (state === 'play' && az > HL && ax < GW - BR * 0.25 && ball.y < GH - BR * 0.25) {
    return goal(ball.z > 0 ? 0 : 1);
  }

  // Smooth sphere contact with the same ramp height field used by the cars.
  // Only hold the ball on a ramp when actually touching it; never snap an
  // airborne ball down from several units above the slope.
  const ramp = arenaRampAt(ball.x, ball.z);
  const surface = BR + ramp.height;
  const normalLength = Math.hypot(-ramp.dx, 1, -ramp.dz);
  const nx = -ramp.dx / normalLength, ny = 1 / normalLength, nz = -ramp.dz / normalLength;
  const normalSpeed = ball.vx * nx + ball.vy * ny + ball.vz * nz;
  const touching = ball.y <= surface + 0.035 && normalSpeed <= 0.2;
  if (ball.y < surface || (ball.onRamp && touching)) {
    ball.y = Math.max(ball.y, surface);
    ballSurfaceImpulse(nx, ny, nz, ramp.height > 0.1 ? 0.18 : p.BALL_FLOOR_RESTITUTION);
    const groundFriction = Math.max(0, 1 - p.BALL_FRICTION_REFERENCE * dt);
    ball.vx *= groundFriction;
    ball.vz *= groundFriction;
    ball.onRamp = ramp.height > 0.1;
    ball.onGround = ramp.height <= 0.1;
  } else {
    ball.onRamp = false;
    ball.onGround = false;
  }

  if (az <= HL + BR) {
    // Rounded diagonal corners. A normal impulse preserves tangential speed.
    const edge = HW + HL - CH - BR * Math.SQRT2;
    const over = Math.abs(ball.x) + Math.abs(ball.z) - edge;
    if (over > 0 && Math.abs(ball.x) > HW - CH - BR && Math.abs(ball.z) > HL - CH - BR) {
      const correction = over * 0.5;
      ball.x -= sx * correction;
      ball.z -= sz * correction;
      ballSurfaceImpulse(-sx * Math.SQRT1_2, 0, -sz * Math.SQRT1_2, p.BALL_WALL_RESTITUTION);
    }
  }

  if (Math.abs(ball.x) > HW - BR && az <= HL + BR) {
    const sign = Math.sign(ball.x);
    ball.x = sign * (HW - BR);
    resolveBallWall('x', sign, surface);
  }
  if (Math.abs(ball.z) > HL) {
    // Goal interior has its own side / roof / back-wall colliders.
    if (Math.abs(ball.x) > GW - BR) {
      const sign = Math.sign(ball.x);
      ball.x = sign * (GW - BR);
      ballSurfaceImpulse(-sign, 0, 0, 0.5);
    }
    if (ball.y > GH - BR) {
      ball.y = GH - BR;
      ballSurfaceImpulse(0, -1, 0, 0.5);
    }
    if (Math.abs(ball.z) > HL + GD - BR) {
      const sign = Math.sign(ball.z);
      ball.z = sign * (HL + GD - BR);
      ballSurfaceImpulse(0, 0, -sign, 0.4);
    }
  } else if (Math.abs(ball.z) > HL - BR &&
      !(Math.abs(ball.x) < GW - BR && ball.y < GH - BR)) {
    const sign = Math.sign(ball.z);
    ball.z = sign * (HL - BR);
    resolveBallWall('z', sign, surface);
  }

  // Rolling rotation follows ground velocity; airborne spin decays slowly.
  if (ball.onGround || ball.onRamp) {
    const targetWx = ball.vz / BR, targetWz = -ball.vx / BR;
    const blend = Math.min(1, dt * 8);
    ball.wx += (targetWx - ball.wx) * blend;
    ball.wz += (targetWz - ball.wz) * blend;
    ball.wy *= Math.max(0, 1 - 0.35 * dt);
  } else {
    ball.wx *= Math.max(0, 1 - 0.12 * dt);
    ball.wy *= Math.max(0, 1 - 0.12 * dt);
    ball.wz *= Math.max(0, 1 - 0.12 * dt);
  }
  clampBallMotion();
}

function showGameEvent(label, color = '#fff') {
  const el = $('eventCallout'); if (!el) return;
  el.textContent = label; el.style.color = color; el.classList.remove('event-pop'); void el.offsetWidth; el.classList.add('event-pop');
}
function goal(team) {
  if (trainingMode) {
    trainingGoals++;
    updateTrainingCounters();
    showGameEvent('FREE PLAY GOAL! · ' + trainingGoals, '#ffca64');
    resetTrainingBall();
    return;
  }
  // Ball physics use metre-like units per second; convert speed to mph at the goal line.
  goalSpeedMph = Math.round(Math.hypot(ball.vx, ball.vy, ball.vz) * 2.236936);
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
  const goalByEl = $('goalBy');
  if (goalByEl) goalByEl.textContent = 'Goal by ' + goalScorerText + '!!!';
  const goalSpeedEl = $('goalSpeed');
  if (goalSpeedEl) goalSpeedEl.textContent = 'SHOT SPEED · ' + goalSpeedMph + ' MPH';
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
    if (!trainingMode) {
      clock -= dt;
      if (clock <= 0) { clock = 0; if (score[0] === score[1]) ot = true; else state = 'over'; }
    }
  }
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
        const goalSpeedEl = $('goalSpeed'); if (goalSpeedEl) goalSpeedEl.textContent = 'SHOT SPEED · ' + goalSpeedMph + ' MPH';
      } else {
        $('msg').textContent = '';
        if (ot) state = 'over';
        else { kickoff(); state = 'kick'; cd = 2.5; }
      }
      return;
    }
  } else return;
  // A wall-to-air drill should not fall apart while the player reads the
  // instructions or positions their hands. Physics starts on jump input.
  if (trainingMode && trainingWallArmed) {
    if (!(jumpQ || padJumpQueued.p1)) return;
    trainingWallArmed = false;
    const tip = $('wallTrainingTip');
    if (tip) tip.textContent = 'IN FLIGHT: Feather SHIFT, tap S to tip into the arena and make gentle touches. H resets the shot.';
  }
  // AI predictions are cached at 12.5 Hz, avoiding 120 costly long-horizon
  // predictions per second while the physics loop runs at 120 Hz.
  predictionTimer -= dt;
  if (predictionTimer <= 0 || pred.length === 0) {
    predict();
    predictionTimer = 0.08;
  }
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
  const winner = score[0] > score[1] ? playerName.toUpperCase() : score[1] > score[0] ? 'ORANGE' : 'DRAW';
  $('victoryTitle').textContent = winner;
  $('victoryScore').textContent = score[0] + '  —  ' + score[1];
  const rows = cars.map((car, idx) => ({car, stats: playerStats[idx] || {}, idx}));
  const winningTeam = score[0] === score[1] ? null : score[1] > score[0];
  const winningRows = winningTeam === null ? [] : rows.filter(row => !!row.car.team === winningTeam);
  const winnerCar = winningRows.slice().sort((a, b) => (b.stats.goals || 0) - (a.stats.goals || 0))[0];
  // Place the winners in a level, straight lineup and bring the celebration camera in close.
  if (winnerCar) {
    winningRows.forEach((row, i) => {
      const car = row.car;
      car.x = (i - (winningRows.length - 1) / 2) * 5.2;
      car.z = winningTeam ? -15 : 15;
      car.y = 0.55; car.pitch = 0; car.flip = 0; car.fx = car.fz = 0;
      car.yaw = winningTeam ? Math.PI : 0;
      car.vx = car.vy = car.vz = 0; car.fl = 0;
      car.mesh.body.rotation.set(0, 0, 0);
      car.mesh.root.visible = true;
    });
    rows.filter(row => !!row.car.team !== winningTeam).forEach(row => { row.car.mesh.root.visible = false; });
    ballMesh.visible = false;
    camera.position.set(0, 6.5, winningTeam ? -24 : 24);
    camera.lookAt(0, 1.15, winningTeam ? -15 : 15);
    camera.fov = 48;
    camera.updateProjectionMatrix();
    document.body.classList.add('victory-screen');
  }
  const displayRows = winnerCar ? winningRows : [];
  $('victoryCars').innerHTML = displayRows.map(({car,idx}) =>
    '<div class="victory-car-card '+(car.team ? 'orange-team' : 'blue-team')+'"><div class="victory-player-identity">'+profileAvatarHTML(car,idx)+'<div><div class="victory-car-name">'+escapeStats(car.displayName || ('PLAYER '+(idx+1)))+'</div><div class="victory-car-model">'+escapeStats(String(car.model || 'Octane').toUpperCase())+'</div></div></div></div>'
  ).join('') || '<div class="victory-draw-label">DRAW</div>';
  $('statsBody').innerHTML = rows.map(({car,stats,idx}) => '<tr><td><div class="stat-player-cell"><span class="team-dot" style="background:'+hexCss(car.team?ORANGE:BLUE)+'"></span>'+profileAvatarHTML(car,idx)+'<span class="stat-player-label"><strong>'+escapeStats(car.displayName || ('PLAYER '+(idx+1)))+'</strong><small class="stat-car-model">'+escapeStats(String(car.model || 'Octane').toUpperCase())+'</small></span></div></td><td>'+stats.goals+'</td><td>'+stats.assists+'</td><td>'+stats.shots+'</td><td>'+stats.saves+'</td><td>'+stats.clears+'</td><td>'+(stats.demos || 0)+'</td></tr>').join('');
  const carsView = $('victoryCars'), statsView = $('victoryStats');
  if (carsView) carsView.style.display = 'grid';
  if (statsView) statsView.style.display = 'none';
  if (panel._statsTimer) clearTimeout(panel._statsTimer);
  panel._statsTimer = setTimeout(() => {
    if (panel.style.display !== 'none') {
      // Keep the winner nameplates visible above the actual cars while stats slide in below.
      if (carsView) carsView.style.display = 'grid';
      if (statsView) statsView.style.display = 'block';
    }
  }, 5000);
}
function renderVictoryCarPreviews(rows) {
  // Render the selected winning car's actual gameplay mesh into its preview canvas.
  const canvases = Array.from(document.querySelectorAll('.victory-car-canvas'));
  if (!canvases.length || !window.THREE) return;
  for (const canvas of canvases) {
    const idx = Number(canvas.dataset.carIndex);
    const row = rows.find(entry => entry.idx === idx);
    if (!row || !row.car || !row.car.mesh || !row.car.mesh.root) continue;
    const w = Math.max(1, Math.floor(canvas.clientWidth || 240));
    const h = Math.max(1, Math.floor(canvas.clientHeight || 100));
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(w, h, false);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x263044, 2.5));
      const key = new THREE.DirectionalLight(0xffffff, 3);
      key.position.set(3, 6, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x49bfff, 1.2);
      fill.position.set(-4, 2, -3);
      scene.add(fill);
      const model = row.car.mesh.root.clone(true);
      model.rotation.set(0.12, -0.55, 0);
      model.scale.setScalar(1.25);
      scene.add(model);
      const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
      camera.position.set(4.8, 3.0, 6.2);
      camera.lookAt(0, 0.3, 0);
      renderer.render(scene, camera);
      renderer.dispose();
    } catch (error) {
      console.error('Could not render winner car preview:', error);
    }
  }
}
function escapeStats(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
$('victoryPlayAgain').addEventListener('click', () => { const p=$('victory'); p.style.display='none'; p.dataset.shown=''; document.body.classList.remove('victory-screen'); $('menu').style.display='grid'; state='menu'; $('mt').textContent='ROCKET ARENA 3D'; $('go').textContent='Choose your setup, then press PLAY'; });
// ---------- camera + render ----------
const cam = { x: 0, y: 6, z: -60, lx: 0, ly: 2, lz: 0 };
const cam2 = { x: 0, y: 6, z: 60, lx: 0, ly: 2, lz: 0 };
const axis = new THREE.Vector3();
function updateCam(dt, carIndex = 0, targetCamera = camera, camState = cam) {
  const car = cars[carIndex] || cars[0]; if (!car) return;
  // Camera heading follows the 3D car's nose except when it is almost
  // vertical, where a projected heading has no reliable direction.
  const front = getCarForward(car);
  const forwardLength = Math.hypot(front.x, front.z);
  let backX = forwardLength > 0.23 ? -front.x / forwardLength : -Math.sin(car.yaw);
  let backZ = forwardLength > 0.23 ? -front.z / forwardLength : -Math.cos(car.yaw);
  if (ballCam || (trainingMode && $('trainingPreset') && $('trainingPreset').value === 'wall')) {
    // Camera tracks the ball but stays behind the player's car.
    const awayX = car.x - ball.x, awayZ = car.z - ball.z;
    const length = Math.hypot(awayX, awayZ);
    if (length > 0.6) { backX = awayX / length; backZ = awayZ / length; }
  }
  const k = 1 - Math.exp(-cameraSettings.stiffness * dt);
  let tx = clamp(car.x + backX * cameraSettings.distance, -HW + 2, HW - 2);
  let tz = clamp(car.z + backZ * cameraSettings.distance, -HL + 2, HL - 2);
  let ty = clamp(car.y + cameraSettings.height, 2, CEIL - 1.5);
  // When riding or jumping off a wall, the regular chase camera can be
  // squeezed flat against the glass, hiding the ball and the car. Shift the
  // view inside the arena and look slightly upward during wall-to-air plays.
  const wallView = !!car.wallVerticalAxis || (car.wallDetachTimer || 0) > 0 ||
    (car.wallRide && car.y > WALL_RAMP_HEIGHT * 0.72);
  if (wallView) {
    const infieldOffset = Math.max(11, cameraSettings.distance * 1.05);
    if (car.wallVerticalAxis === 'x' || Math.abs(car.x) > HW - 10) {
      tx = Math.sign(car.x) * (HW - infieldOffset);
      tz = clamp(car.z - 6.5, -HL + 9, HL - 9);
    } else if (car.wallVerticalAxis === 'z' || Math.abs(car.z) > HL - 10) {
      tz = Math.sign(car.z) * (HL - infieldOffset);
      tx = clamp(car.x - 6.5, -HW + 9, HW - 9);
    }
    ty = clamp(car.y + cameraSettings.height + 2.0, 4, CEIL - 1);
  }
  camState.x += (tx - camState.x) * k;
  camState.y += (ty - camState.y) * k;
  camState.z += (tz - camState.z) * k;
  const lookX = ballCam ? ball.x : car.x - backX * 9;
  const lookY = ballCam ? ball.y : car.y + (wallView ? 4.0 : 1.0);
  const lookZ = ballCam ? ball.z : car.z - backZ * 9;
  camState.lx += (lookX - camState.lx) * k;
  camState.ly += (lookY - camState.ly) * k;
  camState.lz += (lookZ - camState.lz) * k;

  if (cameraSettings.shake && camShakeTime > 0) {
    camShakeTime = Math.max(0, camShakeTime - dt);
    const shake = Math.min(0.45, camShakeTime) * 0.7;
    camState.x += (Math.random() - 0.5) * shake;
    camState.y += (Math.random() - 0.5) * shake;
  } else if (camShakeTime > 0) {
    camShakeTime = Math.max(0, camShakeTime - dt);
  }
  targetCamera.position.set(camState.x, camState.y, camState.z);
  targetCamera.lookAt(camState.lx, camState.ly, camState.lz);
  sun.position.set(car.x + 30, 80, car.z + 25);
  sun.target.position.set(car.x, 0, car.z); sun.target.updateMatrixWorld();
  const speed = Math.hypot(car.vx, car.vy, car.vz);
  const desiredFov = clamp(cameraSettings.fov + speed * 0.10 + (car.fl ? 3 : 0), 60, 118);
  targetCamera.fov += (desiredFov - targetCamera.fov) * k;
  targetCamera.updateProjectionMatrix();
}
function render(dt) {
  if (state === 'play' && !trainingMode) {
    // Sample gameplay at a fixed 30fps instead of one frame per render.
    // A 301-frame buffer now represents approximately ten seconds.
    replayCaptureTimer += dt;
    while (replayCaptureTimer >= 1 / 30) {
      saveReplayFrame();
      replayCaptureTimer -= 1 / 30;
    }
  }
  if (state === 'replay' && replayFrames.length) applyReplayFrame(replayFrames[Math.min(Math.floor(replayIndex), replayFrames.length - 1)]);
  for (const c of cars) {
    const m = c.mesh;
    m.root.position.set(c.x, c.y, c.z);
    if (c.airQuat && state !== 'menu' && state !== 'over') {
      m.root.quaternion.copy(c.airQuat);
    } else {
      m.root.rotation.set(-c.pitch, c.yaw, c.roll || 0, 'YXZ');
    }
    m.flame.visible = !!c.fl; m.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    m.body.rotation.set(0, 0, 0);
    if (c.flip > 0) {
      const a = (1 - c.flip / 0.55) * Math.PI * 2;
      if (Math.abs(c.fx) >= Math.abs(c.fz)) m.body.rotation.x = a * Math.sign(c.fx); else m.body.rotation.z = a * Math.sign(c.fz);
    }
    // Detailed wheels use their real axle pivots.
    const wheelSpeed = Math.hypot(c.vx, c.vz) * 0.6;
    if (m.detailedWheels && m.detailedWheels.length) {
      for (const wheel of m.detailedWheels) wheel.rotateOnAxis(octaneWheelAxis, wheelSpeed * dt);
    } else if (m.wheels && m.wheels.length) {
      for (const wheel of m.wheels) wheel.rotation.x += wheelSpeed * dt;
    }
  }
  ballMesh.position.set(ball.x, ball.y, ball.z);
  const sp = Math.hypot(ball.vx, ball.vz);
  const spinMagnitude = Math.hypot(ball.wx || 0, ball.wy || 0, ball.wz || 0);
  if (spinMagnitude > 0.001) {
    axis.set(ball.wx, ball.wy, ball.wz).multiplyScalar(1 / spinMagnitude);
    ballMesh.rotateOnWorldAxis(axis, spinMagnitude * dt);
  }
  if (state === 'play' && Math.hypot(sp, ball.vy) > 26) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, 0.3, 0.9, 0.8);
  for (const p of pads) {
    const active = p.t <= 0;
    p.mesh.material.opacity = active ? 0.9 : 0.12;
    p.ring.material.opacity = active ? 0.95 : 0.08;
    p.core.material.opacity = active ? 0.5 : 0.05;
    p.group.visible = active || p.t > 0;
  }
  stepParts(dt); drawMini(); sfx.update(cars[0], state === 'play');
  const splitActive = !trainingMode && localTwoPlayer && state !== 'menu' && state !== 'over';
  document.body.classList.toggle('split-screen', splitActive);
  // During a replay, follow the player who scored instead of always following P1.
  if (state === 'menu') {
    // Actual selected 3D car in the arena, not a black/empty garage backdrop.
    const preview = cars[0];
    cars.forEach(c => { c.mesh.root.visible = false; });
    if (preview) {
      preview.mesh.root.visible = true;
      preview.mesh.root.position.set(28, 0.55, 0);
      preview.mesh.root.rotation.set(0, Math.PI * 0.63 + Math.sin(performance.now() * 0.00045) * 0.2, 0);
      preview.mesh.flame.visible = false;
    }
    ballMesh.visible = true;
    ballMesh.position.set(36, BR + 0.35, -12);
    camera.position.set(47, 8, 22);
    camera.lookAt(27, 1.5, 0);
    camera.fov = 64; camera.updateProjectionMatrix();
  } else if (state === 'over') {
    // Hold a close, centred camera on the straight winning lineup.
    const winTeam = score[0] === score[1] ? null : score[1] > score[0];
    cars.forEach(c => { c.mesh.root.visible = winTeam !== null && !!c.team === winTeam && c.demoTimer <= 0; });
    ballMesh.visible = false;
    camera.position.set(0, 6.5, winTeam ? -24 : 24);
    camera.lookAt(0, 1.15, winTeam ? -15 : 15);
    camera.fov = 48; camera.updateProjectionMatrix();
  } else {
    cars.forEach(c => { c.mesh.root.visible = c.demoTimer <= 0; }); ballMesh.visible = true;
    updateCam(dt, state === 'replay' ? replayCameraCarIndex : 0);
    if (splitActive) updateCam(dt, state === 'replay' ? replayCameraCarIndex : mode, camera2, cam2);
  }
  $('s0').textContent = score[0]; $('s1').textContent = score[1];
  const s = Math.ceil(clock); $('clock').textContent = trainingMode ? 'FREE PLAY' : ot ? 'OT' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const b = trainingMode ? 100 : cars[0].boost;
  $('bt').textContent = trainingMode ? '∞' : Math.round(b);
  $('bf').style.width = '84%';
  $('bf').style.background = 'conic-gradient(' + (b > 66 ? '#ffd35a' : '#37f2c0') +
    ' ' + (b * 3.6) + 'deg, rgba(12,29,59,.65) ' + (b * 3.6) + 'deg)';
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
loadDetailedOctane();
window.rocketArena = {
  ball, physics: PHYSICS_TUNING,
  get cars() { return cars; },
  get score() { return score; },
  get state() { return state; },
  // Read-only references for browser-level stadium regression checks.
  get stadium() { return scene.getObjectByName('Coliseum Stadium'); },
  get pitch() { return pitchMesh; },
  get pads() { return pads; }
};
let last = performance.now();
(function loop(now) {
  const wallDt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
  const frameDt = Math.min(0.09, wallDt);
  pollControllers();
  // Physics remains deterministic at 120Hz. The clock, countdown, goal intro,
  // and replay still track real elapsed time when the GPU is running slowly.
  if (typeof window.__rocketPhysicsAccumulator !== 'number') window.__rocketPhysicsAccumulator = 0;
  if (!paused) {
    window.__rocketPhysicsAccumulator = Math.min(0.19, window.__rocketPhysicsAccumulator + frameDt);
    const fixedDt = 1 / 120;
    let steps = 0;
    while (window.__rocketPhysicsAccumulator >= fixedDt && steps < 12) {
      update(fixedDt);
      window.__rocketPhysicsAccumulator -= fixedDt;
      steps++;
    }
    const skippedTime = Math.max(0, wallDt - steps * fixedDt);
    if (skippedTime > 0) {
      if (state === 'kick' || state === 'goal') cd -= skippedTime;
      else if (state === 'replay') replayIndex += skippedTime * 30;
      else if (state === 'play' && !trainingMode && !ot) {
        clock = Math.max(0, clock - skippedTime);
        if (clock <= 0) {
          if (score[0] === score[1]) ot = true;
          else { state = 'over'; showVictoryScreen(); }
        }
      }
    }
  } else window.__rocketPhysicsAccumulator = 0;
  render(frameDt);
  requestAnimationFrame(loop);
})(last);
})();
