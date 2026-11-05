(() => {
'use strict';
const $ = id => document.getElementById(id);
if (typeof THREE === 'undefined') {
  $('menu').innerHTML = '<h1>Three.js not found</h1><p>Check your connection, or put three.min.js (r149) in the lib/ folder.</p>';
  return;
}
// Three.js r149 uses encoding; colourSpace is a later API.
THREE.ColorManagement.legacyMode = false;
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
  // Lateral tyre velocity must decay through traction, not rotate instantly
  // when the steering wheel turns. Powerslide drops that tyre grip.
  NORMAL_LATERAL_FRICTION: 24, POWERSLIDE_FRICTION_MULTIPLIER: 0.105,
  JUMP_IMPULSE: 291.67 / 50, JUMP_HOLD_FORCE: 1458.33 / 50, JUMP_HOLD_DURATION: 0.2,
  DOUBLE_JUMP_IMPULSE: 291.67 / 50, DODGE_IMPULSE: 500 / 50,
  PITCH_TORQUE_SPEED: 3.4, YAW_TORQUE_SPEED: 2.85, ROLL_TORQUE_SPEED: 4.2,
  // Tuned to the existing arena's actual scale for predictable, playable ball movement.
  BALL_GRAVITY_FORCE: 650 / 50, MAX_BALL_SPEED: 6000 / 50, BALL_MAX_ANGULAR_SPEED: 6,
  BALL_RESTITUTION: 0.6, BALL_FLOOR_RESTITUTION: 0.6, BALL_WALL_RESTITUTION: 0.6,
  // Material friction is not the same as rolling resistance. Keeping them
  // separate prevents a grounded ball losing speed too quickly.
  BALL_ROLLING_RESISTANCE: 0, BALL_RAMP_IMPACT_RESTITUTION: 0.6,
  BALL_BOUNCE_CUTOFF_SPEED: 0.7,
  BALL_WALL_LIP_EFFICIENCY: 0.96, BALL_CONTACT_SLOP: 0.045,
  CAR_LANDING_MIN_DOT: 0.28, CAR_ROOF_RESTITUTION: 0.23,
  DODGE_STICK_DEADZONE: 0.50,
  BALL_SURFACE_FRICTION: 0.35,
  // RocketSim/RLConst: relative-speed curve (Unreal units per second).
  BALL_EXTRA_HIT_CURVE: [[0,0.65],[500,0.65],[2300,0.55],[4600,0.30]],
  BALL_EXTRA_HIT_VERTICAL_SCALE: 0.35, BALL_EXTRA_HIT_FORWARD_SCALE: 0.65,
  BALL_EXTRA_HIT_COOLDOWN: 2 / 120,
  BALL_EXTRA_HIT_MAX_RELATIVE_SPEED: 4600 / 50,
  BALL_CAR_MASS_RATIO: 180 / 30
};
const MATCH = 300;
const TEAM_COLOR_PRESETS = {
  normal: { blue: 0x2fb8ff, orange: 0xff8a1f },
  'blue-amber': { blue: 0x0072b2, orange: 0xe69f00 },
  'high-contrast': { blue: 0x00a6ff, orange: 0xff3b30 }
};
let BLUE = 0x2fb8ff, ORANGE = 0xff8a1f;
let gameVolume = 0.75, colourVisionMode = 'normal', controllerDeadZone = 0.12;
let anthemSelection='dnb',anthemVolume=.55;
try{
  const saved=JSON.parse(localStorage.getItem('rocketArenaAnthemV1')||'{}');
  if(saved.track==='off'||RocketGoalAnthems.TRACKS[saved.track])anthemSelection=saved.track;
  if(Number.isFinite(saved.volume))anthemVolume=Math.max(0,Math.min(1,saved.volume));
}catch(_){}

let controllerSteeringSensitivity = 1.25, controllerAerialSensitivity = 1.35;
let controllerVibrationEnabled = true;
let keyboardFlightMode = 'assist'; // assist retains W+Shift climb; manual = RL-style W/S aerial pitch
let graphicsQuality = 'balanced';
const cameraSettings = { fov: 105, distance: 5.6, height: 2.2, stiffness: 10, shake: false, fovRevision: 1 };
try {
  const savedSettings = JSON.parse(localStorage.getItem('rocketArenaSettingsV1') || '{}');
  if (Number.isFinite(savedSettings.volume)) gameVolume = Math.max(0, Math.min(1, savedSettings.volume));
  if (['low', 'balanced', 'high'].includes(savedSettings.graphicsQuality)) graphicsQuality = savedSettings.graphicsQuality;
  if (Number.isFinite(savedSettings.deadZone)) controllerDeadZone = Math.max(0.05, Math.min(0.4, savedSettings.deadZone));
  if (Number.isFinite(savedSettings.steeringSensitivity)) controllerSteeringSensitivity = Math.max(1, Math.min(2.5, savedSettings.steeringSensitivity));
  if (Number.isFinite(savedSettings.aerialSensitivity)) controllerAerialSensitivity = Math.max(1, Math.min(2.5, savedSettings.aerialSensitivity));
  if (typeof savedSettings.controllerVibration === 'boolean') controllerVibrationEnabled = savedSettings.controllerVibration;
  if (['assist', 'manual'].includes(savedSettings.keyboardFlightMode)) keyboardFlightMode = savedSettings.keyboardFlightMode;
  if (savedSettings.camera && typeof savedSettings.camera === 'object') {
    for (const key of ['fov', 'distance', 'height', 'stiffness']) {
      if (Number.isFinite(savedSettings.camera[key])) cameraSettings[key] = savedSettings.camera[key];
    }
    if (typeof savedSettings.camera.shake === 'boolean') cameraSettings.shake = savedSettings.camera.shake;
    // Undo only the exact FOV preset introduced by the previous update.
    // Subsequent explicit user choices carry this revision and are preserved.
    if(!savedSettings.camera.fovRevision && savedSettings.camera.fov===110 && savedSettings.camera.distance===5.6 && savedSettings.camera.height===2.2)cameraSettings.fov=105;
  }
  if (Object.prototype.hasOwnProperty.call(TEAM_COLOR_PRESETS, savedSettings.colourVisionMode)) colourVisionMode = savedSettings.colourVisionMode;
} catch (_) {}
BLUE = TEAM_COLOR_PRESETS[colourVisionMode].blue;
ORANGE = TEAM_COLOR_PRESETS[colourVisionMode].orange;
const WALL_RAMP_WIDTH = 6.0, WALL_RAMP_HEIGHT = 256 / 50;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rampEase = t => t * t * (3 - 2 * t); // smooth start/end avoids jolts; vertical-wall mode takes over at the edge
function rampProfile(distance, outerEdge) {
  const start = outerEdge - WALL_RAMP_WIDTH;
  const span = WALL_RAMP_WIDTH - 0.5;
  const t = clamp((distance - start) / span, 0, 1);
  if (distance <= start) return { height: 0, slope: 0 };
  // A quarter-round analogue reaches the wall almost vertically. The old
  // smoothstep flattened out right at the lip, making balls/car bounce off an
  // artificial edge and the wall ride snap. Radius ~256 Unreal units.
  const inner = Math.sqrt(Math.max(0, 1 - t*t));
  const height = WALL_RAMP_HEIGHT * (1 - inner);
  const slope = Math.min(12, WALL_RAMP_HEIGHT * t /
    (span * Math.sqrt(Math.max(1e-4, 1-t*t))));
  return { height, slope };
}
// A single rounded-rectangle boundary is shared by the stadium mesh and
// collision system; no diagonal invisible corner walls.
function arenaCornerContact(x,z,clearance) {
  const ax=Math.abs(x), az=Math.abs(z), cx=HW-CH, cz=HL-CH;
  if(ax<=cx||az<=cz)return null;
  const dx=ax-cx,dz=az-cz,dist=Math.hypot(dx,dz);
  const penetration=dist-(CH-clearance);
  if(penetration<=0||dist<1e-6)return null;
  return {penetration,nx:(Math.sign(x)||1)*dx/dist,nz:(Math.sign(z)||1)*dz/dist};
}
function arenaRampAt(x,z) {
  const ax=Math.abs(x),az=Math.abs(z),cx=HW-CH,cz=HL-CH;
  if(ax>cx&&az>cz) {
    const dx=ax-cx,dz=az-cz,radius=Math.hypot(dx,dz);
    const distanceToWall=CH-radius;
    const profile=rampProfile(WALL_RAMP_WIDTH-distanceToWall,WALL_RAMP_WIDTH);
    if(profile.height<=0||radius<1e-6) return {height:0,dx:0,dz:0,side:false};
    return {height:profile.height,
      dx:(Math.sign(x)||1)*profile.slope*dx/radius,
      dz:(Math.sign(z)||1)*profile.slope*dz/radius,side:dx>=dz};
  }
  if(ax>cx) {
    const p=rampProfile(ax,HW);
    return {height:p.height,dx:(Math.sign(x)||1)*p.slope,dz:0,side:true};
  }
  if(az>cz&&ax>GW+2) {
    const p=rampProfile(az,HL);
    return {height:p.height,dx:0,dz:(Math.sign(z)||1)*p.slope,side:false};
  }
  return {height:0,dx:0,dz:0,side:false};
}
let pitchMesh = null, skyMesh = null, rampMeshMaterial = null;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Car model presets (visuals + physical tweaks)
const CAR_MODELS = [
  { name: 'octane', len: 3.4, width: 2.0, height: 0.6, wheelR: 0.45, mass: 1.0, hit: 1.7, cap: 1.0 },
  { name: 'fennec', len: 3.4, width: 2.0, height: 0.6, wheelR: 0.45, mass: 1.0, hit: 1.7, cap: 1.0 },
  { name: 'scorpion', len: 3.8, width: 2.0, height: 0.6, wheelR: 0.45, mass: 1.0, hit: 1.7, cap: 1.0 }
];

// Fennec shares the Octane hitbox. Scorpion uses the longer, lower Dominus shape.
// Body meshes stay independent of collision and all cars use the same controls.
const CAR_HITBOXES = {
  octane: { length:120.507/50, width:86.699/50, height:38.659/50, forward:13.876/50, up:20.755/50 },
  fennec: { length:120.507/50, width:86.699/50, height:38.659/50, forward:13.876/50, up:20.755/50 },
  scorpion: { length:127.926/50, width:83.279/50, height:31.3/50, forward:9/50, up:18.66/50 }
};

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ac7ec);
scene.fog = new THREE.Fog(0xbcd9e8, 450, 1420);
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

scene.add(new THREE.HemisphereLight(0xd8efff, 0x315a43, 0.85));
const fill = new THREE.DirectionalLight(0xb4dcff, 0.4); fill.position.set(-40, 50, -60); scene.add(fill);
const sun = new THREE.DirectionalLight(0xfff1d9, 1.05);
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
    // Alternating mown bands read clearly at chase-camera height.
    g.fillStyle = iy % 2 ? '#245c48' : '#307457';
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
  // Subtle team-coloured goal areas and a split kickoff ring.
  for (const sign of [-1, 1]) {
    g.fillStyle = sign < 0 ? 'rgba(40,145,255,.16)' : 'rgba(255,142,40,.16)';
    g.fillRect(px(-GW-12), pz(sign < 0 ? -HL+27 : HL),
      (GW+12)*2*resolution, 27*resolution);
    g.beginPath();
    g.arc(px(0),pz(0),16*resolution,sign < 0 ? 0 : Math.PI,sign < 0 ? Math.PI : Math.PI*2);
    g.strokeStyle = sign < 0 ? '#36aaff' : '#ffaa47';
    g.lineWidth = .65*resolution; g.stroke();
  }
  g.lineWidth = 0.7 * resolution; g.strokeStyle = 'rgba(246,252,238,.8)';
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
  texture.encoding = THREE.sRGBEncoding;
  const surfaceGeo = new THREE.PlaneGeometry(2*HW,2*HL,160,208);
  surfaceGeo.rotateX(-Math.PI/2);
  const pos = surfaceGeo.attributes.position;
  const surfaceUV = surfaceGeo.attributes.uv;
  for (let i=0;i<pos.count;i++) {
    const z=pos.getZ(i);
    // Quarter-circle floor edge meets the curved glass without triangular gaps.
    const overZ=Math.max(0,Math.abs(z)-(HL-CH));
    const maxX=overZ>0 ? HW-CH+Math.sqrt(Math.max(0,CH*CH-overZ*overZ)) : HW;
    const x=pos.getX(i)*maxX/HW;
    pos.setX(i,x);
    pos.setY(i,arenaRampAt(x,z).height);
    // Canvas top is the orange end (+Z); map after rounding the corners.
    surfaceUV.setXY(i,(x+HW)/(2*HW),(z+HL)/(2*HL));
  }
  surfaceUV.needsUpdate = true;
  pos.needsUpdate = true; surfaceGeo.computeVertexNormals();
  pitchMesh = new THREE.Mesh(surfaceGeo,new THREE.MeshStandardMaterial({map:texture,roughness:.94,side:THREE.DoubleSide}));
  pitchMesh.receiveShadow = true; scene.add(pitchMesh);

  // The external concourse lives behind the collision walls, not over the turf.
  const stone = new THREE.MeshStandardMaterial({color:0xb6a78c,roughness:.83});
  const concourse = new THREE.Mesh(new THREE.CircleGeometry(1,96),stone);
  concourse.name='Stadium Concourse';concourse.scale.set(182,216,1);
  concourse.rotation.x = -Math.PI/2; concourse.position.y = -.28; scene.add(concourse);

  const wallBottom = WALL_RAMP_HEIGHT + 0.28;
  // A faint overhead net shows where the drivable ceiling actually is.
  // Without this surface a car appeared to drive upside-down on open sky.
  const roofGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(HW*2,HL*2),
    new THREE.MeshBasicMaterial({color:0x91c9f4,transparent:true,
      opacity:0.035,depthWrite:false,side:THREE.DoubleSide}));
  roofGlass.rotation.x=-Math.PI/2;
  roofGlass.position.y=CEIL+0.05;
  roofGlass.renderOrder=1;
  scene.add(roofGlass);
  const roofLines=[];
  for(let x=-HW;x<=HW+0.01;x+=10){
    roofLines.push(x,CEIL, -HL, x,CEIL, HL);
  }
  for(let z=-HL;z<=HL+0.01;z+=10){
    roofLines.push(-HW,CEIL,z, HW,CEIL,z);
  }
  const roofMesh=new THREE.BufferGeometry();
  roofMesh.setAttribute('position',new THREE.Float32BufferAttribute(roofLines,3));
  scene.add(new THREE.LineSegments(roofMesh,
    new THREE.LineBasicMaterial({color:0x77bae9,transparent:true,
      opacity:0.14,depthWrite:false})));
  const glass = new THREE.MeshBasicMaterial({
    color:0xa8deef,transparent:true,opacity:.035,
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
  // Straight walls and tangent, circular corner sections share exact endpoints.
  // Goal mouths remain open between the two end-wall segments.
  const cornerSlices=10;
  for(const sign of [-1,1])for(const side of [-1,1]){
    segments.push([[side*HW,0],[side*HW,sign*(HL-CH)],sign]);
    segments.push([[side*(GW+.4),sign*HL],[side*(HW-CH),sign*HL],sign]);
    for(let i=0;i<cornerSlices;i++){
      const a=i/cornerSlices*Math.PI/2,b=(i+1)/cornerSlices*Math.PI/2;
      const point=t=>[side*(HW-CH+CH*Math.cos(t)),sign*(HL-CH+CH*Math.sin(t))];
      segments.push([point(a),point(b),sign]);
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
    // Overlap adjacent curved sections slightly to avoid light-leaking seams.
    const sealedLength=length+0.18;
    makeBox(sealedLength,wallBottom,.42,wallBottom/2,barrier);
    const upper=new THREE.Mesh(new THREE.PlaneGeometry(sealedLength,CEIL-wallBottom),glass);
    upper.position.y=wallBottom+(CEIL-wallBottom)/2;wallGroup.add(upper);
    if(length>7)wallGroup.add(hexPanels(length,CEIL-wallBottom,side));
    makeBox(sealedLength,.8,.7,.4,trim);
    makeBox(sealedLength,.34,.7,wallBottom,rail[side]);
    makeBox(sealedLength,.3,.7,CEIL,trim);
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
    const light=new THREE.PointLight(sign<0?BLUE:ORANGE,1.8,62);
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
  const borderPoints=[];
  const corners=[
    [HW-CH,HL-CH,0],[-HW+CH,HL-CH,Math.PI/2],
    [-HW+CH,-HL+CH,Math.PI],[HW-CH,-HL+CH,Math.PI*1.5]
  ];
  for(const [cx,cz,angle] of corners)for(let i=0;i<=10;i++){
    const a=angle+(i/10)*Math.PI/2;
    borderPoints.push(new THREE.Vector3(cx+CH*Math.cos(a),CEIL,cz+CH*Math.sin(a)));
  }
  const rim=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(borderPoints),
    new THREE.LineBasicMaterial({color:0xc5dfff,transparent:true,opacity:.38}));
  scene.add(rim);
}
buildArena();

// -----------------------------------------------------------------------
// Mini crowd: rounded colourful potato characters with happy little faces.
// Two instanced draw calls render 2,400 characters + 3 for waving flags.
// Animation is deliberately throttled for low-power browsers.
let miniCrowd = null;
const CROWD_CHEER_LENGTH=3.1;
function makeCrowdFaceTexture(cheering=false) {
  const cv=document.createElement('canvas');
  cv.width=cv.height=128;
  const c=cv.getContext('2d');
  c.clearRect(0,0,128,128);
  c.fillStyle='#0c1d2c';
  const eyeY=44;
  for(const x of [42,86]){
    c.beginPath();c.ellipse(x,eyeY,7.2,9.2,0,0,Math.PI*2);c.fill();
    c.fillStyle='#ffffff';
    c.beginPath();c.arc(x-2.4,eyeY-3,2.2,0,Math.PI*2);c.fill();
    c.fillStyle='#0c1d2c';
  }
  c.fillStyle='rgba(255,120,147,.65)';
  for(const x of [21,107]){c.beginPath();c.ellipse(x,70,10,5,0,0,Math.PI*2);c.fill();}
  c.strokeStyle='#17202e';c.lineWidth=5.8;c.lineCap='round';
  if(cheering){
    c.fillStyle='#17202e';
    c.beginPath();c.ellipse(64,78,12,17,0,0,Math.PI*2);c.fill();
    c.fillStyle='#ef839d';
    c.beginPath();c.ellipse(64,88,8,4,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#0c1d2c';
    c.beginPath();c.arc(32,29,10,Math.PI*1.1,Math.PI*1.9);c.stroke();
    c.beginPath();c.arc(96,29,10,Math.PI*1.1,Math.PI*1.9);c.stroke();
  } else {
    c.beginPath();c.arc(64,63,17,.15,Math.PI-.15);c.stroke();
  }
  const tex=new THREE.CanvasTexture(cv);
  tex.encoding=THREE.sRGBEncoding;
  tex.needsUpdate=true;
  return tex;
}
// Sample terraces by distance, rather than angle, so corners and the middle
// of every stand have the same tightly packed seating density.
function miniCrowdSeats(ringPoint) {
  const seats=[];
  for(let row=0;row<18;row++){
    const samples=2048,points=[],distances=[0];
    for(let j=0;j<=samples;j++){
      const point=ringPoint(j/samples*Math.PI*2,101.3+row*2.65,126.3+row*2.55,9.02+row*1.83);
      points.push(point);
      if(j)distances.push(distances[j-1]+point.distanceTo(points[j-1]));
    }
    const perimeter=distances[samples],perRow=Math.floor(perimeter/2.05);
    let segment=1;
    for(let col=0;col<perRow;col++){
      const distance=(col+.25+(row%2)*.5)/perRow*perimeter;
      while(segment<samples&&distances[segment]<distance)segment++;
      const t=(distance-distances[segment-1])/(distances[segment]-distances[segment-1]);
      seats.push({row,col,point:points[segment-1].clone().lerp(points[segment],t)});
    }
  }
  return seats;
}

function miniFanGeometry(low) {
  // Subtly deform the sphere's lower half to make a bean-shaped potato
  // silhouette without the cost of a unique geometry for each character.
  const bodyGeometry=new THREE.SphereGeometry(.72,low?6:8,low?4:6);
  const a=bodyGeometry.attributes.position;
  for(let i=0;i<a.count;i++){
    const y=a.getY(i),x=a.getX(i);
    const shape= y > 0 ? 1-0.18*y/.72 : 1+0.10*Math.abs(y)/.72;
    // Squashed flat-ish base + smaller domed head = little potato, not ball.
    const beanY=y<-.47?-.47+(y+.47)*.18:y;
    a.setXYZ(i,x*shape,beanY,a.getZ(i)*shape);
  }
  a.needsUpdate=true;
  bodyGeometry.computeVertexNormals();
  return bodyGeometry;
}

function buildMiniCrowd(stadium, ringPoint) {
  // Denser rows like the supplied jellybean-crowd reference.
  // Instancing keeps a few draw calls despite thousands of individual fans.
  const seats=miniCrowdSeats(ringPoint),count=seats.length;
  const palette=[0xff8c83,0xffc36a,0xffe889,0x91eb90,0x82dfff,
    0x82a8ff,0xbc94ff,0xffa2dc,0xf2f5f9,0xa57e59,0x63d4b6,0xf5bca2];
  const bodyGeometry=miniFanGeometry(graphicsQuality==='low');
  const bodies=new THREE.InstancedMesh(bodyGeometry,
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:.8,
      metalness:0,emissive:0x10222e,emissiveIntensity:.08}),count);
  const outlines=new THREE.InstancedMesh(bodyGeometry,
    new THREE.MeshBasicMaterial({color:0x142633,side:THREE.BackSide,
      depthWrite:true}),count);
  outlines.frustumCulled=false;
  outlines.name='Mini Potato Dark Outlines';
  const calmFace=makeCrowdFaceTexture(false);
  const cheerFace=makeCrowdFaceTexture(true);
  const faces=new THREE.InstancedMesh(new THREE.PlaneGeometry(.9,.9),
    new THREE.MeshBasicMaterial({map:calmFace,transparent:true,
      side:THREE.DoubleSide,depthWrite:false,alphaTest:.08}),count);
  bodies.frustumCulled=false;faces.frustumCulled=false;
  bodies.name='Mini Potato Crowd';faces.name='Mini Potato Faces';
  stadium.add(outlines,bodies,faces);

  const flagData=[];
  const flagGeometry=new THREE.PlaneGeometry(.92,.65);
  const flags=new THREE.InstancedMesh(flagGeometry,
    new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide}),Math.ceil(count/24));
  const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.045,.045,1.1,5),
    new THREE.MeshBasicMaterial({color:0xdcecf4}),Math.ceil(count/24));
  flags.frustumCulled=false;poles.frustumCulled=false;
  stadium.add(flags,poles);
  const fans=[];
  const mtx=new THREE.Matrix4(),pos=new THREE.Vector3();
  const rot=new THREE.Quaternion(),scale=new THREE.Vector3();
  const up=new THREE.Vector3(0,1,0);
  const forwardAxis=new THREE.Vector3(0,0,1);
  const tint=new THREE.Color(),qTemp=new THREE.Quaternion();
  const temp=new THREE.Object3D();
  for(const {row,col,point} of seats){
      const i=fans.length;
      const towardPitch=new THREE.Vector3(-point.x,0,-point.z).normalize();
      rot.setFromUnitVectors(forwardAxis,towardPitch);
      const team=point.z<0?0:1;
      const hue=(i*37+row*17)%palette.length;
      tint.setHex(palette[hue]).lerp(
        new THREE.Color(team===0?0x4397f6:0xf69b55),.08);
      bodies.setColorAt(i,tint);
      fans.push({
        base:point.clone().add(new THREE.Vector3(0,.76,0)),
        inward:towardPitch,rotation:rot.clone(),team,row,col,
        phase:(i*2.3999632297)%(2*Math.PI),
        heightScale:.9+((i*17)%9)*.035,
        flagIndex: i%24===0?flagData.length:-1
      });
      if(i%24===0) {
        flagData.push(i);
        flags.setColorAt(flagData.length-1,
          new THREE.Color(team===0?0x52adff:0xff9d4a));
      }
  }
  flags.count=flagData.length;poles.count=flagData.length;
  bodies.instanceColor.needsUpdate=true;flags.instanceColor.needsUpdate=true;
  const crowd={fans,bodies,outlines,faces,flags,poles,flagData,calmFace,cheerFace,
    cheerTeam:-1,cheerTime:0,elapsed:0,drawTick:0,matrix:mtx,
    temp,position:pos,rotation:qTemp,scale,up,lowDetail:graphicsQuality==='low'};
  outlines.visible=!crowd.lowDetail;
  // Set initial transforms immediately; the menu must also show the crowd.
  updateMiniCrowdTransforms(crowd,0);
  return crowd;
}
function updateMiniCrowdQuality() {
  if(!miniCrowd)return;
  const low=graphicsQuality==='low';
  if(low!==miniCrowd.lowDetail){
    const previous=miniCrowd.bodies.geometry;
    miniCrowd.bodies.geometry=miniCrowd.outlines.geometry=miniFanGeometry(low);
    previous.dispose();
    miniCrowd.lowDetail=low;
  }
  miniCrowd.outlines.visible=!low;
}

function cheerMiniCrowd(team) {
  if (!miniCrowd) return;
  miniCrowd.cheerTeam=team===1?1:0;
  miniCrowd.cheerTime=CROWD_CHEER_LENGTH;
  miniCrowd.cheerStartedAt=performance.now();
  miniCrowd.faces.material.map=miniCrowd.cheerFace;
  miniCrowd.faces.material.needsUpdate=true;
  miniCrowd.drawTick=.05; // force first celebration pose next render
}
function updateMiniCrowdTransforms(crowd,dt) {
  const {fans,bodies,outlines,faces,flags,poles,flagData,temp,rotation,
    position,scale}=crowd;
  const active=crowd.cheerTime>0;
  const power=active?Math.min(1,crowd.cheerTime/.65,
    (CROWD_CHEER_LENGTH-crowd.cheerTime+.25)*3):0;
  const cheerAge=CROWD_CHEER_LENGTH-crowd.cheerTime;
  const rollAxis=new THREE.Vector3(0,0,1);
  for(let i=0;i<fans.length;i++){
    const f=fans[i];
    const stronger=f.team===crowd.cheerTeam?1:.4;
    // A wave travels along the stand and across its rows after a goal.
    const phase=crowd.elapsed*1.4+f.phase;
    const ripple=cheerAge*11-f.row*.63-f.col*.055;
    const jump=active?Math.pow(Math.max(0,Math.sin(ripple)),2)*
      1.0*stronger*power:0;
    const bob=.055*Math.sin(phase);
    const lean=active?.21*Math.sin(ripple*1.3)*stronger*power:
      .028*Math.sin(phase*.7);
    rotation.copy(f.rotation).multiply(
      temp.quaternion.setFromAxisAngle(rollAxis,lean));
    position.copy(f.base);
    position.y+=jump+bob;
    scale.set(1.37+.055*Math.sin(phase*1.2),
      1.22*f.heightScale*(1+jump*.17),1.29-.025*Math.cos(phase));
    temp.position.copy(position);
    temp.quaternion.copy(rotation);
    temp.scale.copy(scale);
    temp.updateMatrix();
    bodies.setMatrixAt(i,temp.matrix);
    temp.scale.multiplyScalar(1.065);
    temp.updateMatrix();
    outlines.setMatrixAt(i,temp.matrix);
    // Place the cheerful expression just *in front* of the curved body.
    // Previous .62 offset hid the entire face behind the opaque surface.
    temp.position.copy(position).addScaledVector(f.inward,.96);
    temp.position.y+=.12;
    temp.scale.set(1.08,1.08,1);
    temp.updateMatrix();
    faces.setMatrixAt(i,temp.matrix);
  }
  const orient=new THREE.Quaternion(),base=new THREE.Vector3();
  for(let j=0;j<flagData.length;j++){
    const f=fans[flagData[j]];
    const wave=active?Math.sin(cheerAge*13+f.phase)*.37:
      Math.sin(crowd.elapsed*1.7+f.phase)*.08;
    orient.copy(f.rotation).multiply(
      temp.quaternion.setFromAxisAngle(rollAxis,wave));
    base.copy(f.base).addScaledVector(f.inward,.25);
    base.y+=.95;
    temp.position.copy(base);
    temp.quaternion.copy(orient);
    temp.scale.set(1,1,1);temp.updateMatrix();
    poles.setMatrixAt(j,temp.matrix);
    temp.position.y+=.42;
    temp.position.x+=.38;
    temp.scale.set(1,1,1);temp.updateMatrix();
    flags.setMatrixAt(j,temp.matrix);
  }
  bodies.instanceMatrix.needsUpdate=true;outlines.instanceMatrix.needsUpdate=true;
  faces.instanceMatrix.needsUpdate=true;
  flags.instanceMatrix.needsUpdate=true;poles.instanceMatrix.needsUpdate=true;
}
function updateMiniCrowd(dt) {
  if(!miniCrowd)return;
  miniCrowd.elapsed+=Math.min(dt,.1);
  if(miniCrowd.cheerTime>0){
    // A celebration ends on real elapsed time, even if rendering is slow.
    miniCrowd.cheerTime=Math.max(0,CROWD_CHEER_LENGTH-
      (performance.now()-miniCrowd.cheerStartedAt)/1000);
    if(miniCrowd.cheerTime===0){
      miniCrowd.faces.material.map=miniCrowd.calmFace;
      miniCrowd.faces.material.needsUpdate=true;
      miniCrowd.cheerTeam=-1;
    }
  }
  miniCrowd.drawTick+=dt;
  // Animate at ~24Hz during goals and ~12Hz during idle.
  const interval=miniCrowd.cheerTime>0?1/24:1/12;
  if(miniCrowd.drawTick<interval)return;
  miniCrowd.drawTick=0;
  updateMiniCrowdTransforms(miniCrowd,dt);
}


// Decorative, collision-free open-air setting modeled on the supplied
// lakeside arena screenshots: turquoise water, green shoreline, tall conifers,
// soft alpine peaks and a futuristic skyline across the lake.
let lakesideScenery = null;
function buildLakesideScenery(stadium) {
  const scenery=new THREE.Group();
  scenery.name='Lakeside Mountains Water Trees City';
  stadium.add(scenery);
  lakesideScenery=scenery;
  let seed=7471;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const mat=(color,roughness=0.9)=>new THREE.MeshStandardMaterial({
    color,roughness,metalness:0});
  const oceanTexture=(()=>{
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#67c8e9';
    ctx.fillRect(0,0,256,256);
    for(let i=0;i<440;i++){
      const x=random()*256,y=random()*256;
      const w=5+random()*25;
      ctx.strokeStyle=i%4===0?'rgba(243,255,255,.25)':'rgba(13,91,134,.11)';
      ctx.lineWidth=.7+random()*1.1;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+random()*1.3);ctx.stroke();
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(9,9);
    texture.encoding=THREE.sRGBEncoding;
    return texture;
  })();
  const lake=new THREE.Mesh(new THREE.PlaneGeometry(2050,2050),
    new THREE.MeshStandardMaterial({map:oceanTexture,color:0x9bdaef,
      roughness:.27,metalness:.23,emissive:0x0e2a44,emissiveIntensity:.13}));
  lake.name='Reflective Blue Lake';
  lake.rotation.x=-Math.PI/2;
  lake.position.y=-11;
  lake.receiveShadow=false;
  scenery.add(lake);
  // The playing stadium sits on a grassy peninsula raised over the water.
  const island=new THREE.Mesh(new THREE.CylinderGeometry(320,327,9,90),
    mat(0x82b979));
  island.name='Stadium Green Island';
  island.position.y=-6;
  island.scale.z=1.09;
  scenery.add(island);
  // Paved pedestrian loop around the grandstand and above the lake shore.
  const pathPts=[];
  for(let j=0;j<=128;j++){
    const a=j/128*Math.PI*2;
    pathPts.push(new THREE.Vector3(207*Math.cos(a),-1.26,246*Math.sin(a)));
  }
  const promenade=new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts,true),
      128,4.2,5,true),mat(0xf2f1df,.98));
  promenade.name='Pale Lakeside Walkway';
  scenery.add(promenade);
  const treeCount=230;
  const trunkGeo=new THREE.CylinderGeometry(.22,.32,1,5);
  const pineGeo=new THREE.ConeGeometry(1,1,7);
  const trunk=new THREE.InstancedMesh(trunkGeo,mat(0x826a50),treeCount);
  const lower=new THREE.InstancedMesh(pineGeo,
    new THREE.MeshLambertMaterial({color:0xffffff}),treeCount);
  const upper=new THREE.InstancedMesh(pineGeo,
    new THREE.MeshLambertMaterial({color:0xffffff}),treeCount);
  const tr=new THREE.Matrix4(),treeColor=new THREE.Color();
  const greens=[0x3c8b58,0x549f61,0x367c50,0x69a867,0x438969,0x528f54];
  for(let i=0;i<treeCount;i++){
    const angle=random()*Math.PI*2;
    const r=239+random()*68;
    const x=Math.cos(angle)*r,z=Math.sin(angle)*r*1.09;
    const h=7+random()*12,w=2.1+random()*1.8;
    tr.makeScale(.7,h*.45,.7);
    tr.setPosition(x,-1.0+h*.22,z);
    trunk.setMatrixAt(i,tr);
    tr.makeScale(w*1.10,h*.74,w*1.10);
    tr.setPosition(x,-.3+h*.57,z);
    lower.setMatrixAt(i,tr);
    tr.makeScale(w*.77,h*.64,w*.77);
    tr.setPosition(x,-.3+h*.88,z);
    upper.setMatrixAt(i,tr);
    treeColor.setHex(greens[(i*7)%greens.length]);
    lower.setColorAt(i,treeColor);
    upper.setColorAt(i,treeColor.clone().multiplyScalar(1.08));
  }
  for(const obj of [trunk,lower,upper]){
    obj.instanceMatrix.needsUpdate=true;
    obj.frustumCulled=false;
    scenery.add(obj);
  }
  lower.instanceColor.needsUpdate=true;
  upper.instanceColor.needsUpdate=true;
  // Hills frame the water without creating invisible driveable ground.
  const hillMat=mat(0x81b98b),farHillMat=mat(0xacc7ae);
  for(let i=0;i<13;i++){
    const x=-900+i*150+(random()-.5)*80;
    const z=-770-random()*135;
    const radius=135+random()*130,height=38+random()*45;
    const hill=new THREE.Mesh(new THREE.ConeGeometry(radius,height,7),
      i%3===0?farHillMat:hillMat);
    hill.position.set(x,-16+height/2,z);
    scenery.add(hill);
  }
  // Jagged snow-capped alpine peaks beyond the forest and lake.
  const mountainColours=[0x8ca4a1,0x8ba3b3,0x778f9a,0x9faeb4,0x7f9998];
  const snow=mat(0xecf8fa);
  for(let i=0;i<13;i++){
    const x=-950+i*162+(random()-.5)*70;
    const z=-930-random()*95;
    const radius=82+random()*76,height=110+random()*155;
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(radius,height,5),
      mat(mountainColours[i%mountainColours.length]));
    mountain.position.set(x,-17+height/2,z);
    scenery.add(mountain);
    const snowy=new THREE.Mesh(
      new THREE.ConeGeometry(radius*.39,height*.39,5),snow);
    snowy.position.set(x,-17+height-height*.195,z);
    scenery.add(snowy);
  }
  // Bluish glass city with needle towers as seen across the lake.
  const buildingCount=48;
  const cityBlocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),
    new THREE.MeshStandardMaterial({color:0xffffff,roughness:.26,
      metalness:.45,emissive:0x162637,emissiveIntensity:.18}),buildingCount);
  const shades=[0x7fabc2,0xc8e5ee,0x6d9fba,0x9dd5e8,0xe5f4f7,0x92b5ca];
  for(let i=0;i<buildingCount;i++){
    const col=i%12,row=Math.floor(i/12);
    const x=140+(col-5.5)*26+(random()-.5)*12;
    const z=-605-row*33+(random()-.5)*14;
    const height=45+random()*113+(col===5||col===8?72:0);
    const width=10+random()*9;
    tr.makeScale(width,height,width*.83);
    tr.setPosition(x,height/2-16,z);
    cityBlocks.setMatrixAt(i,tr);
    cityBlocks.setColorAt(i,new THREE.Color(shades[(i*5)%shades.length]));
  }
  cityBlocks.instanceMatrix.needsUpdate=true;
  cityBlocks.instanceColor.needsUpdate=true;
  cityBlocks.frustumCulled=false;
  scenery.add(cityBlocks);
  const silver=mat(0xe5f4ff,.35);
  for(const [x,z,height] of [[178,-662,216],[274,-670,182],[348,-640,155]]){
    const needle=new THREE.Mesh(new THREE.CylinderGeometry(.7,2.3,height,8),
      silver);
    needle.position.set(x,-15+height/2,z);
    scenery.add(needle);
    const spire=new THREE.Mesh(new THREE.ConeGeometry(4.5,46,7),silver);
    spire.position.set(x,-15+height+23,z);
    scenery.add(spire);
  }
  return scenery;
}

function buildStadium() {
  // The bowl sits OUTSIDE the glass playable enclosure. Stadium structure is
  // decorative only and cannot cause rogue collisions or interrupt wall riding.
  const stadium = new THREE.Group();
  stadium.name='Rocket Ball Championship Arena';
  scene.add(stadium);
  buildLakesideScenery(stadium);
  // Soft white/turquoise architecture inspired by the reference's open-air
  // lakeside stadium, rather than the previous dark enclosed coliseum.
  const stone = new THREE.MeshStandardMaterial({color:0xd1e8ed,roughness:.66,metalness:.13});
  const oldStone = new THREE.MeshStandardMaterial({color:0x5faeb7,roughness:.72,metalness:.07});
  const ivory = new THREE.MeshStandardMaterial({color:0xf9ffff,roughness:.43,metalness:.08});
  const dark = new THREE.MeshStandardMaterial({color:0x172b40,metalness:.46,roughness:.41});
  const gold = new THREE.MeshBasicMaterial({color:0xffe2a3});
  const roofTrim = new THREE.MeshStandardMaterial({color:0xecfcff,metalness:.18,roughness:.51});
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
  // Broad, soft cotton clouds over bright blue water.
  // Previously the cloud ellipses were tiny translucent streaks.
  for(let cloud=0;cloud<32;cloud++){
    const x=rand(cloud*3)*cv.width,y=165+rand(cloud*3+1)*475;
    const w=40+rand(cloud*3+2)*100;
    sky.fillStyle='rgba(196,223,236,.25)';
    sky.beginPath();sky.ellipse(x,y+w*.12,w*.58,w*.24,0,0,Math.PI*2);sky.fill();
    for(let puff=0;puff<6;puff++){
      const px=x+(puff-2.5)*w*.17;
      const py=y-Math.sin((puff+.4)*.64)*w*.10;
      const rx=w*(.17+rand(cloud*9+puff)*.08);
      const ry=w*(.14+rand(cloud*7+puff)*.10);
      sky.fillStyle=puff%3===0?'rgba(252,255,255,.72)':'rgba(255,255,255,.82)';
      sky.beginPath();sky.ellipse(px,py,rx,ry,0,0,Math.PI*2);sky.fill();
    }
  }
  skyMesh=new THREE.Mesh(new THREE.SphereGeometry(1200,36,20),
    new THREE.MeshBasicMaterial({
      map:new THREE.CanvasTexture(cv),side:THREE.BackSide,fog:false,depthWrite:false
    }));
  skyMesh.material.map.encoding=THREE.sRGBEncoding;
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
  const blueSeat=new THREE.Color(0x638db4),orangeSeat=new THREE.Color(0xd5ac94);
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

  // Character spectators share body, facial expression and flag geometry.
  // A few GPU draw calls replace thousands of separate objects.
  miniCrowd = buildMiniCrowd(stadium, ringPoint);

  // Teal exterior walls with pale structural uprights: the reference shows a
  // low modern stadium facade below an open crowd and white fabric roof.
  const facadeVerts=[],facadeIndex=[];
  const facadeSegments=112;
  for(let j=0;j<=facadeSegments;j++){
    const angle=j/facadeSegments*Math.PI*2;
    const lower=ringPoint(angle,150.5,180.5,-2.5);
    const upper=ringPoint(angle,150.5,180.5,29.5);
    facadeVerts.push(...lower.toArray(),...upper.toArray());
    if(j<facadeSegments){
      const k=j*2;
      facadeIndex.push(k,k+1,k+2,k+1,k+3,k+2);
    }
  }
  const facadeGeometry=new THREE.BufferGeometry();
  facadeGeometry.setAttribute('position',
    new THREE.Float32BufferAttribute(facadeVerts,3));
  facadeGeometry.setIndex(facadeIndex);
  facadeGeometry.computeVertexNormals();
  const facade=new THREE.Mesh(facadeGeometry,
    new THREE.MeshStandardMaterial({color:0x5bb1bb,roughness:.72,
      metalness:.12,side:THREE.DoubleSide}));
  facade.name='Turquoise Stadium Exterior';
  stadium.add(facade);
  const uprightCount=56;
  const uprights=new THREE.InstancedMesh(
    new THREE.BoxGeometry(.94,32.5,1.5),ivory,uprightCount);
  const uprightMatrix=new THREE.Matrix4();
  for(let j=0;j<uprightCount;j++){
    const angle=j/uprightCount*Math.PI*2;
    const point=ringPoint(angle,152.8,182.8,13.7);
    uprightMatrix.makeRotationY(-angle);
    uprightMatrix.setPosition(point.x,point.y,point.z);
    uprights.setMatrixAt(j,uprightMatrix);
  }
  uprights.instanceMatrix.needsUpdate=true;
  uprights.frustumCulled=false;
  stadium.add(uprights);
  // The broad upper lip is visible from both the pitch and outside.
  makeRim(151.8,181.8,30.6,.8,ivory);

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

  // 24 open white scalloped sail canopies. Triangular high points create the
  // row of fabric peaks from the user's Potato League screenshots.
  const sailCount=24,roofPos=[],roofShade=[],sailRibs=[];
  const whiteA=new THREE.Color(0xf9ffff),whiteB=new THREE.Color(0xd7e9ed);
  for(let i=0;i<sailCount;i++){
    const a0=i/sailCount*Math.PI*2;
    const a1=(i+1)/sailCount*Math.PI*2;
    const am=(a0+a1)/2;
    const in0=ringPoint(a0,134.5,161,45.7);
    const in1=ringPoint(a1,134.5,161,45.7);
    const left=ringPoint(a0,161.5,191,50.2);
    const right=ringPoint(a1,161.5,191,50.2);
    const peak=ringPoint(am,161.5,191,68.5);
    const centre=ringPoint(am,147.5,174,51);
    const triangles=[
      [in0,centre,left],[in0,in1,centre],[in1,right,centre],
      [centre,peak,left],[centre,right,peak]
    ];
    for(const [a,b,c] of triangles){
      for(const v of [a,b,c]){
        roofPos.push(v.x,v.y,v.z);
        const colour=(i%3===0?whiteB:whiteA);
        roofShade.push(colour.r,colour.g,colour.b);
      }
    }
    for(const [a,b] of [[peak,left],[peak,right],[peak,centre]]){
      sailRibs.push(a.x,a.y+.08,a.z,b.x,b.y+.08,b.z);
    }
  }
  const sailGeometry=new THREE.BufferGeometry();
  sailGeometry.setAttribute('position',
    new THREE.Float32BufferAttribute(roofPos,3));
  sailGeometry.setAttribute('color',
    new THREE.Float32BufferAttribute(roofShade,3));
  sailGeometry.computeVertexNormals();
  const sails=new THREE.Mesh(sailGeometry,new THREE.MeshStandardMaterial({
    vertexColors:true,side:THREE.DoubleSide,roughness:.76,
    emissive:0x243138,emissiveIntensity:.025
  }));
  sails.name='White Alpine Sail Canopies';
  stadium.add(sails);
  const ribs=new THREE.BufferGeometry();
  ribs.setAttribute('position',new THREE.Float32BufferAttribute(sailRibs,3));
  stadium.add(new THREE.LineSegments(ribs,
    new THREE.LineBasicMaterial({color:0xf4ffff,transparent:true,
      opacity:.85})));
  // Thin white supports read as airy canopy masts, not enclosed high arches.
  const mastCount=sailCount;
  const mast=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(.47,.62,55,7),ivory,mastCount);
  const mastMatrix=new THREE.Matrix4();
  for(let i=0;i<mastCount;i++){
    const angle=(i+.5)/mastCount*Math.PI*2;
    const point=ringPoint(angle,161.5,191,0);
    mastMatrix.makeTranslation(point.x,25.3,point.z);
    mast.setMatrixAt(i,mastMatrix);
  }
  mast.instanceMatrix.needsUpdate=true;
  mast.frustumCulled=false;
  stadium.add(mast);

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
  screenMaterial.map.encoding=THREE.sRGBEncoding;
  for(const sign of [-1,1]){
    const display=new THREE.Mesh(new THREE.PlaneGeometry(42,19),screenMaterial);
    display.position.set(0,77,sign*219);
    display.rotation.y=sign>0?Math.PI:0;
    stadium.add(display);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(44,21,1.15),ivory);
    frame.position.copy(display.position);
    frame.position.z+=sign*.8;
    stadium.add(frame);
    const darkBacking=new THREE.Mesh(new THREE.BoxGeometry(43,20,.2),dark);
    darkBacking.position.copy(display.position);
    darkBacking.position.z+=sign*1.49;
    stadium.add(darkBacking);
    for(const side of [-1,1]){
      const post=new THREE.Mesh(new THREE.CylinderGeometry(.78,.98,57,8),ivory);
      post.position.set(side*16,38,sign*220);
      stadium.add(post);
    }
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
    championship: { sky: 0x334d70, fog: 0x6c8aab, ground: 0xffffff, glow: 0xa9dcff },
    sunset: { sky: 0x8ac7ec, fog: 0xbcd9e8, ground: 0xffffff, glow: 0x68d0ff },
    neon: { sky: 0x07142d, fog: 0x101d3b, ground: 0xb7c7ff, glow: 0x8c4dff },
    ice: { sky: 0x9ac8e6, fog: 0x9ac8e6, ground: 0xd6f4ff, glow: 0x7be8ff },
    desert: { sky: 0x47212c, fog: 0x6b3841, ground: 0xffd0a0, glow: 0xffb34f }
  };
  const p = palettes[style] || palettes.sunset;
  scene.background.setHex(p.sky); scene.fog.color.setHex(p.fog);
  if (skyMesh) skyMesh.material.color.setHex(style === 'championship' ? 0x8ca8cc : style === 'ice' ? 0x8ab9d8 : style === 'neon' ? 0x697bff : style === 'desert' ? 0xffa15e : 0xffffff);
  if (pitchMesh) pitchMesh.material.color.setHex(p.ground);
  if (rampMeshMaterial) rampMeshMaterial.color.setHex(style === 'ice' ? 0x9fdaef : style === 'neon' ? 0x596db9 : style === 'desert' ? 0xbca06d : 0x59b849);
  scene.traverse(o => { if (o.isLineLoop && o.material && o.material.color) o.material.color.setHex(p.glow); });
}
applyArenaStyle('championship');
// Batch the arena before cars and effects add animated geometry.
RocketSceneUtils.batchStaticMeshes(scene);

// Detailed car assets share one fitting path; hitboxes and controls stay independent.
const carModelAssets = {
  octane: { url:'assets/octane/scene.gltf', rotation:-Math.PI/2, axle:new THREE.Vector3(0,1,0) },
  fennec: { url:'assets/fennec/scene.glb', rotation:0, axle:new THREE.Vector3(1,0,0) },
  scorpion: { url:'assets/scorpion/scene.gltf?v=scorpion-2', rotation:0, axle:new THREE.Vector3(1,0,0),
    template:window.RocketScorpionBody?.create(THREE), bundled:true }
};
function makeDetailedCar(car) {
  const asset = car && carModelAssets[car.model];
  if (!asset?.template || car.mesh.assetTemplate===asset.template) return;
  const m = car.mesh, model = asset.template.clone(true);
  const col = onlineMode || car.ai ? (car.team ? hexCss(ORANGE) : hexCss(BLUE)) :
    car.team ? (localTwoPlayer && !car.ai ? player2Paint : hexCss(ORANGE)) : playerPaint;
  const paint = new THREE.Color(col);
  const wheelNodes = [];
  model.traverse(object => {
    if ((/^Dieci/i.test(object.name) && object.children.length >= 2) || /^Wheel_/.test(object.name)) wheelNodes.push(object);
    if (!object.isMesh) return;
    object.castShadow = true; object.receiveShadow = true;
    const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
    const materials = originalMaterials.map(material => {
      const mat = material.clone();
      const matName = (mat.name || '').toLowerCase().replace(/\s+/g, '_');
      if ((car.model === 'octane' && (matName === 'paint' || matName === 'octane_body')) || matName === 'bodypaint') {
        mat.color.copy(paint); mat.roughness = 0.3; mat.metalness = 0.25; mat.needsUpdate = true;
      }
      return mat;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0];
  });
  // Converted FBX cars already face +Z; the original Octane faces +X.
  const fitted = new THREE.Group(); fitted.add(model);
  model.rotation.y += asset.rotation;
  fitted.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fitted);
  const size = box.getSize(new THREE.Vector3());
  if (![size.x, size.y, size.z].every(v => Number.isFinite(v) && v > 1e-5)) {
    console.warn(car.model + ' model bounds invalid, using standard car.');
    return;
  }
  model.scale.multiplyScalar(Math.min(2.42 / size.x, 1.5 / size.y, 3.95 / size.z));
  fitted.updateMatrixWorld(true);
  const fit = new THREE.Box3().setFromObject(fitted);
  const center = fit.getCenter(new THREE.Vector3());
  fitted.position.set(-center.x, -fit.min.y - 0.48, -center.z);
  // Keep the existing body rotation pivot and boost flame; hide placeholder geometry only.
  for (const child of m.body.children) if (child !== m.flame) child.visible = false;
  if(m.detailedRoot){
    m.body.remove(m.detailedRoot);
    m.detailedRoot.traverse(object=>{if(object.isMesh)for(const material of [object.material].flat())material.dispose();});
  }
  m.body.add(fitted);
  m.assetTemplate=asset.template;
  m.textured=!!asset.textured;
  cacheCarBodyBounds(m);
  m.detailed = true;
  fitted.name = car.model + ' Imported Vehicle';
  fitted.userData.vehicleModel = car.model;
  m.detailedRoot = fitted;
  m.detailedWheels = wheelNodes;
  m.detailedWheelAxis = asset.axle;
  m.wheels = [];
}
function updateCarModelStatus() {
  const status = $('modelLoadStatus');
  if (!status) return;
  const selected=carModelAssets[playerCarModel];
  const title=playerCarModel[0].toUpperCase()+playerCarModel.slice(1);
  status.textContent = selected?.template ? '✓ '+title+' ready' :
    selected?.failed ? title+' model could not load · select it again to retry' :
    'Loading '+title+' 3D body…';
}
function loadDetailedCars() {
  for (const [name, asset] of Object.entries(carModelAssets)) {
    if (asset.loading || asset.textured) continue;
    if (!THREE.GLTFLoader) { asset.failed = true; updateCarModelStatus(); continue; }
    asset.loading = true; asset.failed = false;
    updateCarModelStatus();
    new THREE.GLTFLoader().load(asset.url, gltf => {
      const previous=asset.template,previousTextured=asset.textured;
      asset.template = gltf.scene; asset.loading = false; asset.failed = false; asset.textured = true;
      for (const car of cars) if (car.model === name) makeDetailedCar(car);
      if(previous&&!previousTextured)previous.traverse(object=>{
        if(object.isMesh){object.geometry.dispose();for(const material of [object.material].flat())material.dispose();}
      });
      updateCarModelStatus();
    }, undefined, err => {
      asset.loading = false; asset.failed = true;
      console.warn(name + (asset.bundled ? ' texture detail unavailable; supplied body remains active:' : ' model unavailable; retaining playable fallback:'), err);
      updateCarModelStatus();
    });
  }
}

// Cache the visible model's local bounds once, excluding hidden placeholders
// and boost flames. Body-ground contact then follows the actual tilted car.
function cacheCarBodyBounds(mesh) {
  mesh.body.updateWorldMatrix(true,true);
  const inverse=new THREE.Matrix4().copy(mesh.body.matrixWorld).invert();
  const bounds=new THREE.Box3();bounds.makeEmpty();
  mesh.body.traverseVisible(object=>{
    if(!object.isMesh||object===mesh.flame)return;
    if(!object.geometry.boundingBox)object.geometry.computeBoundingBox();
    const transform=new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld);
    bounds.union(object.geometry.boundingBox.clone().applyMatrix4(transform));
  });
  if(!bounds.isEmpty())mesh.bodyBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
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
  const chassis = type.name === 'fennec' ?
    [0.94, 0.45, 0.84, 0.85, 0.28, 0.32, 0.68, 0.68, 0.44, -0.02] :
    [0.94, 0.42, 0.82, 0.84, 0.25, 0.32, 0.58, 0.58, 0.40, -0.01];
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
  cabin.position.set(0, type.height * 0.47, type.len * chassis[9]);
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
  const mesh={root,body,flame,type,wheels};cacheCarBodyBounds(mesh);return mesh;
}
const ballTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#dfe9ef'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#2b3a47';
  for (let i = 0; i < 16; i++) { g.beginPath(); g.arc((i * 83) % 256, 14 + (i * 47) % 100, 15, 0, 7); g.fill(); }
  const texture = new THREE.CanvasTexture(c);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
})();
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BR, 32, 24),
  new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.12 }));
ballMesh.castShadow = true; scene.add(ballMesh);
// A readable contact shadow is important for judging a bouncing ball's
// true height. It stays on the curved pitch rather than floating in the air.
const ballGroundShadow=new THREE.Mesh(
  new THREE.CircleGeometry(BR*1.4,40),
  new THREE.MeshBasicMaterial({color:0x020916,transparent:true,opacity:0.32,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2})
);
ballGroundShadow.rotation.x=-Math.PI/2;
scene.add(ballGroundShadow);
// Lightweight 3D streak for genuinely fast ball motion. Draw-range avoids
// creating and destroying meshes each frame.
const BALL_TRAIL_POINTS=16;
const ballTrailGeometry=new THREE.BufferGeometry();
ballTrailGeometry.setAttribute('position',
  new THREE.BufferAttribute(new Float32Array(BALL_TRAIL_POINTS*3),3));
ballTrailGeometry.setDrawRange(0,0);
const ballTrail=new THREE.Line(ballTrailGeometry,
  new THREE.LineBasicMaterial({color:0x75f5fb,transparent:true,
    opacity:0.58,depthWrite:false,blending:THREE.AdditiveBlending}));
ballTrail.frustumCulled=false;
scene.add(ballTrail);
const ballTrailHistory=[];
function resetBallTrail(){
  ballTrailHistory.length=0;
  ballTrailGeometry.setDrawRange(0,0);
  ballTrail.visible=false;
}
function updateBallVisuals(){
  const gameActive=state==='play'||state==='goal'||state==='replay';
  ballGroundShadow.visible=gameActive;
  const floorY=arenaRampAt(ball.x,ball.z).height;
  const height=Math.max(0,ball.y-(BR+floorY));
  ballGroundShadow.position.set(ball.x,floorY+0.055,ball.z);
  const scale=1+Math.min(20,height)*0.065;
  ballGroundShadow.scale.setScalar(scale);
  ballGroundShadow.material.opacity=Math.max(0.06,0.33-height*0.012);
  const speed=Math.hypot(ball.vx,ball.vy,ball.vz);
  if(!gameActive || speed<24 || !Number.isFinite(speed)){
    resetBallTrail();
    return;
  }
  const current=new THREE.Vector3(ball.x,ball.y,ball.z);
  if(ballTrailHistory.length &&
    current.distanceTo(ballTrailHistory[ballTrailHistory.length-1])>11)
    ballTrailHistory.length=0;
  ballTrailHistory.push(current);
  if(ballTrailHistory.length>BALL_TRAIL_POINTS)ballTrailHistory.shift();
  const positions=ballTrailGeometry.attributes.position;
  // Use each point's stored world-space location; no velocity extrapolation.
  for(let k=0;k<ballTrailHistory.length;k++){
    const p=ballTrailHistory[k];
    positions.setXYZ(k,p.x,p.y,p.z);
  }
  positions.needsUpdate=true;
  ballTrailGeometry.setDrawRange(0,ballTrailHistory.length);
  ballTrail.visible=ballTrailHistory.length>1;
  const t=clamp((speed-24)/70,0,1);
  ballTrail.material.opacity=0.25+t*0.5;
  ballTrail.material.color.setHex(speed>65?0xffd278:0x75f5fb);
}

// ---------- state ----------
let state = 'menu', t = 0, score = [0, 0], clock = MATCH, ot = false, cd = 0, ballCam = false, mode = 2, diff = 1, muted = false;
const ball = { x: 0, y: BR + 6, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, onRamp: false };
let cars = [];
// UI and gameplay toggles
let playerName = 'PLAYER';
let player2Name = 'PLAYER 2';
const profilePictures = { p1: '', p2: '' };
function profileAvatarHTML(car, idx) {
  const key = onlineMode ? '' : idx === 0 ? 'p1' : (localTwoPlayer && idx === mode ? 'p2' : '');
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
let playerCarModel = 'scorpion';
let playerPaint = '#2fb8ff', playerPaintCustom = false;
let player2CarModel = 'fennec';
let player2Paint = '#ff8a1f', player2PaintCustom = false;
try {
  const saved=JSON.parse(localStorage.getItem('rocketArenaGarageV1')||'{}');
  if(CAR_MODELS.some(car=>car.name===saved.p1))playerCarModel=saved.p1;
  if(CAR_MODELS.some(car=>car.name===saved.p2))player2CarModel=saved.p2;
  const requested=new URLSearchParams(location.search).get('car');
  if(CAR_MODELS.some(car=>car.name===requested))playerCarModel=requested;
}catch(_){}
function saveGarageSelection(){
  try{localStorage.setItem('rocketArenaGarageV1',JSON.stringify({p1:playerCarModel,p2:player2CarModel}));}catch(_){}
}
for(const button of document.querySelectorAll('[data-car]'))button.classList.toggle('on',button.dataset.car===playerCarModel);
for(const button of document.querySelectorAll('[data-car2]'))button.classList.toggle('on',button.dataset.car2===player2CarModel);
saveGarageSelection();

let physicsStyle = 'standard';
let localTwoPlayer = false;
let onlineMode=null,onlineStarting=false,onlineBackgroundFrame=null;
const nextoAI=new RocketNexto.Controller(updateNextoStatus);
let nextoObservationTime=0,nextoLastObservation=0;
let goalExplosionStyle = 'classic';
try {
  const previous=localStorage.getItem('rocketArenaExplosionV1');
  if(['classic','fire','galaxy','lightning','blackhole','supernova','pixel','aurora'].includes(previous))
    goalExplosionStyle=previous;
} catch (_) {}
let trainingMode = false, trainingGoals = 0, trainingAttempts = 0, trainingAirTouches = 0, trainingWallArmed = false;
let paused = false;
let lastTouch = null;
let previousTouch = null;
let playerStats = [];
let eventCooldown = {};
let replayHistory = [];
let replayCaptureTimer = 0;
let replayFrames = [];
let replayElapsed = 0;
let replayAnthemToken=0,replayAnthemTrack='dnb';
let replaySimulationTime = 0;
let goalScorerText = 'PLAYER';
let goalSpeedMph = 0;
let replayCameraCarIndex = 0;
const REPLAY_HISTORY_LIMIT = 301;
function saveReplayFrame() {
  const frame={
    time:replaySimulationTime,
    cars:cars.map(c=>({x:c.x,y:c.y,z:c.z,vx:c.vx,vy:c.vy,vz:c.vz,
      q:getCarOrientation(c).toArray(),yaw:c.yaw,pitch:c.pitch,roll:c.roll,
      ground:c.ground,wallRide:c.wallRide,wallVerticalAxis:c.wallVerticalAxis,wallVerticalSign:c.wallVerticalSign,
      demoTimer:c.demoTimer,boost:c.boost,engineLoad:c.engineLoad||0,
      flipAxis:c.flipAxis?c.flipAxis.toArray():null,flip:c.flip,fx:c.fx,fz:c.fz,fl:c.fl})),
    ball:{x:ball.x,y:ball.y,z:ball.z,vx:ball.vx,vy:ball.vy,vz:ball.vz,
      wx:ball.wx,wy:ball.wy,wz:ball.wz,q:ball.q?[...ball.q]:[0,0,0,1],onRamp:ball.onRamp},
    pads:pads.map(p=>p.t)
  };
  if(replayHistory.length && replayHistory[replayHistory.length-1].time===frame.time)replayHistory[replayHistory.length-1]=frame;
  else replayHistory.push(frame);
  if(replayHistory.length>REPLAY_HISTORY_LIMIT)replayHistory.shift();
}
function applyReplayFrame(frame) {
  if(!frame)return;
  frame.cars.forEach((p,i)=>{
    const c=cars[i];if(!c)return;
    Object.assign(c,p);c.airQuat=new THREE.Quaternion().fromArray(p.q);
    c.airOmega=null;c.flipAxis=p.flipAxis?new THREE.Vector3().fromArray(p.flipAxis):null;
  });
  Object.assign(ball,frame.ball);
  frame.pads?.forEach((value,i)=>{if(pads[i])pads[i].t=value;});
}


const SKILL = [
  { thr: 0.65, boost: false, steer: 2.2, cap: 0.6, wait: 1.5, sloppy: 10, flip: 0, aerial: false, drift: false },
  { thr: 0.85, boost: true, steer: 3, cap: 0.82, wait: 0.8, sloppy: 4, flip: 0.4, aerial: false, drift: false },
  { thr: 1, boost: true, steer: 4, cap: 1, wait: 0.25, sloppy: 1.2, flip: 0.9, aerial: true, drift: true },
  { thr: 1, boost: true, steer: 4, cap: 1, wait: 0, sloppy: 0, flip: 1, aerial: true, drift: true }];
function mkCar(team, k, ai, modelName) {
  const model = CAR_MODELS.some(m => m.name === modelName) ? modelName : CAR_MODELS[k % CAR_MODELS.length].name;
  const col = new THREE.Color(onlineMode ? (team ? ORANGE : BLUE) : !ai && k === 0 ? (team ? player2Paint : playerPaint) : (team ? ORANGE : BLUE)).offsetHSL(0, 0, -0.09 * k);
  const car = { team, k, x: 0, y: 0.55, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0, airQuat: null, airOmega: null, surfaceQuat: null, surfaceNormal: null, surfaceForward: null, landingQuat:null, ceilingRide:false, wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, ai, aiCd: 0, boost: 34, jumps: 0, jt: 0, flip: 0, flipPitchScale: 1, aerialAssistDelay: 0, fx: 0, fz: 0, fl: 0, ground: true, demoTimer: 0, demoCooldown: 0, boostImpactTimer: 0 };
  car.mesh = carMesh(col, model);
  car.model = model;
  car.nexto=ai&&diff===3;
  car.displayName = ai ? (team ? 'ORANGE BOT ' : 'BLUE BOT ') + (k + 1) : playerName;
  // model-based properties
  const mdef = CAR_MODELS.find(m => m.name === model);
  car.hit = mdef.hit; car.hitbox = CAR_HITBOXES[model] || CAR_HITBOXES.octane; car.mass = 4; car.cap = 1; car.baseCap = 1;
  makeDetailedCar(car);
  return car;
}
function buildTeams() {
  for (const c of cars) scene.remove(c.mesh.root);
  cars = [];
  for (let k = 0; k < mode; k++) {
    const c = mkCar(0, k, k > 0, k === 0 ? playerCarModel : undefined);
    c.displayName = k === 0 ? playerName : (diff===3?'BLUE NEXTO ':'BLUE BOT ') + (k + 1);
    cars.push(c);
  }
  for (let k = 0; k < mode; k++) {
    const human = localTwoPlayer && k === 0;
    const c = mkCar(1, k, !human, human ? player2CarModel : undefined);
    c.displayName = human ? player2Name : (diff===3?'ORANGE NEXTO ':'ORANGE BOT ') + (k + 1);
    cars.push(c);
  }
}
// Six 100-boost pads at the four corners and the two side midpoints.
// The small 12-boost pads are mirrored across both halves, following the
// overhead arena map. Each is positioned on the continuous ramp surface.
const pads = [];
const bigPads=[
  [-61.44,-81.92,1],[61.44,-81.92,1],
  [-61.44,81.92,1],[61.44,81.92,1],[-71.68,0,1],[71.68,0,1]
];
// RLBot's standard Soccar pad coordinates, scaled 1/50. There are 28 small
// pads, plus the 6 full boosts above, all flat on the pitch.
const negativeSmallPads=[
  [0,-84.8],[-35.84,-83.68],[35.84,-83.68],
  [-18.8,-66.16],[18.8,-66.16],[0,-56.32],
  [-71.68,-49.68],[71.68,-49.68],
  [-35.76,-46.04],[35.76,-46.04],
  [-40.96,-20.72],[40.96,-20.72],[0,-20.48]
];
const smallPads=[
  ...negativeSmallPads,
  ...negativeSmallPads.map(([x,z])=>[x,-z]),
  [-20.48,0],[20.48,0]
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
const FORM = [[0, 4608 / 50 / HL], [-40.96, 2560 / 50 / HL], [40.96, 2560 / 50 / HL]];
function kickoff() {
  nextoAI.reset();nextoObservationTime=0;nextoLastObservation=0;
  for(const car of cars)car.nextoPreviousQuat=null;
  for(const c of cars){c.recoveryTimer=0;c.recoveryTarget=null;c.bodyRestTime=0;c.bodyContact=false;}
  previousTouch = null;
  eventCooldown = {};
  resetBallTrail();
  const msgEl = $('msg'); if (msgEl) msgEl.classList.remove('replay-title');
  const goalByEl = $('goalBy'); if (goalByEl) goalByEl.textContent = '';
  const goalSpeedEl = $('goalSpeed'); if (goalSpeedEl) goalSpeedEl.textContent = '';
  goalSpeedMph = 0;
  replayHistory = [];
  replayCaptureTimer = 0;
  replaySimulationTime = 0;
  predictionTimer = 0;
  replayFrames = [];
  replayElapsed = 0;
  Object.assign(ball, { x: 0, y: BR + 0.038, z: 0, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0, q:[0,0,0,1], onRamp: false, onGround: true });
  lastTouch = null;
  for (const c of cars) {
    const f = FORM[c.k], s = c.team ? 1 : -1;
    Object.assign(c, { x: f[0] * (c.team ? -1 : 1), y: 0.55, z: s * f[1] * HL, vx: 0, vy: 0, vz: 0, yaw: c.team ? Math.PI : 0, pitch: 0, roll: 0, airQuat: null, airOmega: null, surfaceQuat:null, surfaceNormal:null, surfaceForward:null, landingQuat:null, ceilingRide:false, flipAxis:null, wallDetachTimer: 0, wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, boost: 34, jumps: 0, jt: 0, flip: 0, flipPitchScale: 1, aerialAssistDelay: 0, fl: 0, ground: true, aiCd: 0, wait: SKILL[diff].wait });
  }
  if(!trainingMode)saveReplayFrame();
}
function start(freePlay = false) {
  if(!onlineStarting)leaveOnline();
  if(!freePlay&&diff===3&&!nextoAI.ready){
    sfx.init(); // Unlock audio during the user's click, before asynchronous loading.
    $('go').textContent='Loading Nexto before the match…';
    nextoAI.load().then(()=>{if(diff===3&&(state==='menu'||state==='over'))start(false);}).catch(()=>{});
    return;
  }
  document.activeElement?.blur?.();
  clearHeldInput();
  for(const rig of [cam,cam2]){delete rig.heading;delete rig.offset;delete rig.direction;}
  stopGoalPreview();lobbyArenaTour=false;camera.clearViewOffset();
  sfx.init(); // read UI choices
  trainingMode = !!freePlay;
  trainingGoals = 0;
  trainingAttempts = 0;
  trainingAirTouches = 0;
  trainingWallArmed = false;
  paused = false;
  // Competitive car-soccer defaults to ball tracking, toggled at any time by C.
  setBallCamera(true);
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
  resetBallTrail();
  Object.assign(ball, {
    x: 0, y: BR + 0.038, z: 0, vx: 0, vy: 0, vz: 0,
    wx: 0, wy: 0, wz: 0, q:[0,0,0,1], onRamp: false, onGround: false
  });
  ballMesh.quaternion.identity();
  lastTouch = previousTouch = null;
}
function resetTrainingCar() {
  const car = cars[0]; if (!car) return;
  car.recoveryTimer=0;car.recoveryTarget=null;car.bodyRestTime=0;
  Object.assign(car, {
    x: 0, y: 0.55, z: -34, vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0, roll: 0, jumps: 0, jt: 0,
    flip: 0, flipPitchScale: 1, aerialAssistDelay: 0, fl: 0, hold: 0, jumpNormal: null, ground: true,
    wallRide: false, wallVerticalAxis: null, wallVerticalSign: 0, wallDetachTimer: 0,
    airQuat: null, airOmega: null, surfaceQuat:null, surfaceNormal:null, surfaceForward:null, landingQuat:null, ceilingRide:false, flipAxis:null, demoTimer: 0, boost: 100, ballHitCooldown: 0, airTouchCooldown: 0
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
      // Launch with the ball JUST ahead of the upright car's roof.
      // The previous preset sent it inward at 12 units/s, while a wall
      // jump starts near 6: it raced away before the driver could catch it.
      // Use a real reachable 3D contact rather than a scripted fake touch.
      const ballX = sideSign * (HW - 3.5);
      Object.assign(ball, {
        x: ballX, z: car.z + 1.3, y: car.y + 4.0,
        vx: -sideSign * 3.5, vy: 11.8, vz: 3,
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
      ball.y = BR + 0.038;
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
function updateNextoStatus(message){
  const status=$('nextoStatus');if(status){status.textContent=message;status.hidden=diff!==3;}
  if(nextoAI?.status==='failed'&&diff===3&&state==='menu')$('go').textContent=message;
  if(nextoAI?.status==='failed'&&diff===3&&state==='play'&&!trainingMode){
    paused=true;$('msg').textContent='NEXTO UNAVAILABLE · OPEN GARAGE TO RETRY';
  }
}
function pick(k, v) {
  if (k === 'mode') mode = v; else diff = v;
  if(k==='diff'){
    if($('nextoStatus'))$('nextoStatus').hidden=diff!==3;
    if(diff===3)nextoAI.load().catch(()=>{});
    else if(state==='menu'||state==='over')$('go').textContent='Choose your setup, then press PLAY';
  }
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

// Filtered combustion harmonics, a low engine body and a soft boost whoosh.
const carAudio=new RocketCarAudio.CarAudio();
const goalAnthems=new RocketGoalAnthems.Player({onStatus:message=>{if($('anthemPreviewStatus'))$('anthemPreviewStatus').textContent=message;}});
const sfx={
  get ac(){return carAudio.ac;},
  init(){
    carAudio.volume=gameVolume;carAudio.init(window.AudioContext||window.webkitAudioContext);
    goalAnthems.init(carAudio.ac);goalAnthems.setMix({volume:anthemVolume,master:gameVolume,muted});
    void goalAnthems.prepare(anthemSelection).catch(()=>{});
  },
  setVolume(value){gameVolume=clamp(Number(value)||0,0,1);carAudio.setVolume(gameVolume);},
  tone(f,d,type,v){carAudio.muted=muted;carAudio.tone(f,d,type,v);},
  update(c,on){
    carAudio.muted=muted;
    const volume=gameVolume*(goalAnthems.audible ? .4 : 1);
    if(carAudio.volume!==volume)carAudio.setVolume(volume);
    carAudio.update(c,on&&!paused);
  }
};

function syncAudioControls(){
  const blocked=carAudio.ac?.state!=='running';
  const silent=muted||gameVolume===0||blocked;
  const status=muted?'Sound muted · Enable Sound to unmute':gameVolume===0?'Game volume is 0%':
    blocked?'Click Enable Sound to start browser audio':'Sound on';
  const label=$('settingAudioStatus');if(label&&label.textContent!==status)label.textContent=status;
  if($('enableSoundButton'))$('enableSoundButton').hidden=!silent;
  if($('anthemEnableAudio'))$('anthemEnableAudio').hidden=!(silent||anthemVolume===0);
}
function enableSound(){
  muted=false;
  if(gameVolume===0){
    sfx.setVolume(.75);
    $('settingVolume').value='75';$('settingVolumeValue').value='75%';saveGeneralSettings();
  }
  if(anthemVolume===0){
    anthemVolume=.55;$('settingAnthemVolume').value='55';$('settingAnthemVolumeValue').value='55%';saveAnthemSettings();
  }
  sfx.init();void goalAnthems.recover();syncAudioControls();
}
for(const id of ['enableSoundButton','settingEnableSound','anthemEnableAudio'])$(id)?.addEventListener('click',()=>{
  enableSound();
  if(id==='anthemEnableAudio'&&anthemSelection!=='off'&&!goalAnthems.current&&!goalAnthems.intent&&!goalAnthems.status.paused)
    void goalAnthems.play(anthemSelection);
});
// A tab or device change can interrupt audio. The next real interaction is
// the browser's opportunity to resume it without requiring a page refresh.
function resumeInterruptedAudio(){if(carAudio.ac&&carAudio.ac.state!=='running'&&carAudio.ac.state!=='closed')sfx.init();}
addEventListener('pointerdown',resumeInterruptedAudio,{capture:true});
addEventListener('keydown',resumeInterruptedAudio,{capture:true});

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
const CONTROL_ACTIONS = ['forward', 'reverse', 'left', 'right', 'aerialUp', 'aerialDown', 'jump', 'boost', 'hand', 'rollLeft', 'rollRight', 'camera'];
const DEFAULT_CONTROL_BINDINGS = {
  p1: {
    keyboard: { forward:'KeyW', reverse:'KeyS', left:'KeyA', right:'KeyD', aerialUp:'KeyK', aerialDown:'KeyI', jump:'Space', boost:'ShiftLeft', hand:'KeyE', rollLeft:'KeyQ', rollRight:'KeyE', camera:'KeyC' },
    pad: { forward:7, reverse:6, left:null, right:null, jump:0, boost:2, hand:4, rollLeft:null, rollRight:5, camera:3 }
  },
  p2: {
    keyboard: { forward:'ArrowUp', reverse:'ArrowDown', left:'ArrowLeft', right:'ArrowRight', aerialUp:'Numpad5', aerialDown:'Numpad8', jump:'Enter', boost:'ShiftRight', hand:'Slash', rollLeft:'Numpad1', rollRight:'Numpad3', camera:'KeyC' },
    pad: { forward:7, reverse:6, left:null, right:null, jump:0, boost:2, hand:4, rollLeft:null, rollRight:5, camera:3 }
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
  
document.querySelectorAll('[data-bind-key]').forEach(button => {
    const action = button.dataset.bindKey;
    button.textContent = pendingKeyCapture === action ? 'Press a key…' : keyLabel(binding.keyboard[action]);
    button.classList.toggle('capture-active', pendingKeyCapture === action);
  });
  document.querySelectorAll('[data-bind-pad]').forEach(button => {
    const action = button.dataset.bindPad;
    const defaults = { forward:'RT / R2', reverse:'LT / L2', left:'Left stick ←', right:'Left stick →', rollLeft:'LB/L1 + stick ←' };
    button.textContent = pendingPadCapture === action ? 'Press a button…' :
      (action === 'rollLeft' && binding.pad.rollLeft === binding.pad.hand ?
        'LB/L1 + stick ←' :
        (binding.pad[action] === null || binding.pad[action] === undefined ?
          (defaults[action] || 'Not set') : padButtonLabel(binding.pad[action])));
    button.classList.toggle('capture-active', pendingPadCapture === action);
  });
}

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
function setBallCamera(enabled,controlHint='C') {
  ballCam=!!enabled;
  if($('cam'))$('cam').textContent=(ballCam?'BALL CAM':'CAR CAM')+' · '+controlHint;
  const button=$('viewToggle');
  if(button){button.innerHTML=ballCam?'◉ <span>BALL CAM</span>':'◉ <span>CAR CAM</span>';button.setAttribute('aria-pressed',String(ballCam));button.classList.toggle('on',ballCam);}
}
const viewToggle=$('viewToggle');
if(viewToggle)viewToggle.addEventListener('click',()=>setBallCamera(!ballCam));
const cinematicToggle=$('cinematicToggle');
if(cinematicToggle)cinematicToggle.addEventListener('click',()=>{
  for(const rig of [cam,cam2]){delete rig.heading;delete rig.offset;delete rig.direction;}
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
  if(state==='replay'&&onlineMode?.role==='guest')onlineRoom.send({type:'skip'});
  else if (state === 'replay') replayElapsed = RocketReplay.duration(replayFrames);
});


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
// Optional Gamepad API haptics: meaningful impact feedback, no rumble on unsupported pads.
function rumbleCar(car, strength = 0.2, duration = 90) {
  if (!controllerVibrationEnabled || !car || car.ai || !connectedGamepads.length) return;
  const who = car === cars[0] ? 'p1' : localTwoPlayer && car === cars[mode] ? 'p2' : null;
  if (!who) return;
  const pad = controllerForPlayer(who);
  if (!pad) return;
  const intensity = clamp(strength, 0, 1);
  try {
    if (pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === 'function') {
      const result = pad.vibrationActuator.playEffect('dual-rumble', {
        duration: Math.max(30, Math.min(400, duration)), startDelay: 0,
        strongMagnitude: intensity, weakMagnitude: intensity * 0.6
      });
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } else if (pad.hapticActuators && pad.hapticActuators[0] &&
               typeof pad.hapticActuators[0].pulse === 'function') {
      const result = pad.hapticActuators[0].pulse(intensity, duration);
      if (result && typeof result.catch === 'function') result.catch(() => {});
    }
  } catch (_) { /* Unsupported controller vibration must never interrupt the match. */ }
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
      const cameraIndex = controlBindings.p1.pad.camera;
      const cameraId = first.index + ':' + cameraIndex;
      // Y/Triangle toggles ball cam once per press, not every physics frame.
      if (state === 'play' && !paused && !pendingKeyCapture &&
          Number.isInteger(cameraIndex) && current[cameraId] && !previousPadButtons[cameraId]) {
        setBallCamera(!ballCam,'Y / △');
      }
      // Options/Start: start from garage or pause/resume a running match.
      const optionsId = first.index + ':9';
      if (!pendingKeyCapture && current[optionsId] && !previousPadButtons[optionsId] &&
          !Object.values(controlBindings.p1.pad).includes(9) &&
          !($('controlsSettings') && $('controlsSettings').open)) {
        if (state === 'menu' || state === 'over') start();
        else if (state === 'play' && !onlineMode) {
          paused = !paused;
          if ($('msg')) {
            $('msg').textContent = paused ? 'PAUSED · PRESS OPTIONS TO RESUME' : '';
            $('msg').style.color = '#fff';
          }
        }
      }
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

function isEditingTarget(target) {
  return !!(target && (target.isContentEditable ||
    (target.closest && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'))));
}
function clearHeldInput() {
  for(const code of Object.keys(keys))delete keys[code];
  jumpQ=jumpQ2=false;padJumpQueued.p1=padJumpQueued.p2=false;
}
addEventListener('blur',clearHeldInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearHeldInput();});
document.addEventListener('focusin',event=>{if(isEditingTarget(event.target))clearHeldInput();});
addEventListener('keydown', e => {
  // Text editing and IME composition belong to the browser, including A,
  // Space, arrows and menu shortcuts. Do not queue driving input from them.
  if(e.isComposing || isEditingTarget(e.target)||e.target?.closest?.('.online-lobby, #onlineMatchBar'))return;
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
  if(e.ctrlKey || e.metaKey || e.altKey)return;
  if(state==='replay' && e.code==='Space'){
    if(onlineMode?.role==='guest'){onlineRoom.send({type:'skip'});clearHeldInput();e.preventDefault();return;}
    replayElapsed=RocketReplay.duration(replayFrames);clearHeldInput();e.preventDefault();return;
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
  if (!keys[e.code] && e.code === controlBindings.p1.keyboard.camera) {
    setBallCamera(!ballCam);
  }
  if (e.code === 'Enter' && (state === 'menu' || state === 'over') && !isEditingTarget(document.activeElement)) start();
  if (state === 'menu' || state === 'over') {
    const n = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code], d = { Digit4: 0, Digit5: 1, Digit6: 2 }[e.code];
    if (n) pick('mode', n); if (d !== undefined) pick('diff', d);
  }
  if (e.code === 'KeyM') muted = !muted;
  if (e.code === 'KeyP' && !onlineMode) {
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
let lobbyArenaTour = false;
const explosionInput = $('explosion');
const effectIcons={classic:'01',fire:'02',galaxy:'03',lightning:'04',blackhole:'05',supernova:'06',pixel:'07',aurora:'08'};
const effectCards=$('effectCards');
if(effectCards){
  for(const [style,data] of Object.entries(RocketGoalEffects.STYLES)){
    const card=document.createElement('button');card.type='button';card.className='effect-card';card.dataset.effect=style;
    card.style.setProperty('--effect-colour','#'+data.colour.toString(16).padStart(6,'0'));
    const icon=document.createElement('span');icon.className='effect-icon';icon.textContent=effectIcons[style];icon.setAttribute('aria-hidden','true');
    const label=document.createElement('b');label.textContent=data.name.toUpperCase();card.append(icon,label);
    card.addEventListener('click',()=>{explosionInput.value=style;explosionInput.dispatchEvent(new Event('change'));});effectCards.append(card);
  }
}
function syncGoalSelection(){
  const data=RocketGoalEffects.STYLES[goalExplosionStyle];
  if(!data)return;
  document.querySelectorAll('[data-effect]').forEach(card=>{const active=card.dataset.effect===goalExplosionStyle;card.classList.toggle('active',active);card.setAttribute('aria-pressed',String(active));});
  if($('effectDescription'))$('effectDescription').textContent=data.description;
  if($('menu').dataset.panel==='effects'){
    $('previewKicker').textContent='GOAL EXPLOSION COLLECTION';$('previewTitle').textContent=data.name.toUpperCase();$('previewHint').textContent='Select a celebration to watch it in 3D';
  }
}
if(explosionInput){
  for(const option of explosionInput.options)if(RocketGoalEffects.STYLES[option.value])option.textContent=RocketGoalEffects.STYLES[option.value].name;
  explosionInput.value=goalExplosionStyle;
  explosionInput.addEventListener('change',()=>{
    goalExplosionStyle=explosionInput.value;
    try{localStorage.setItem('rocketArenaExplosionV1',goalExplosionStyle);}catch(_){}
    syncGoalSelection();
    if(state==='menu' && $('menu').dataset.panel==='effects')goalExplosion(false,true);
  });
}
const explosionPreview=$('explosionPreview');
if(explosionPreview)explosionPreview.addEventListener('click',()=>{goalExplosionStyle=explosionInput.value;syncGoalSelection();goalExplosion(false,true);});
function stopGoalPreview(){
  goalPreviewUntil=0;goalEffects.clear();document.body.classList.remove('goal-preview','preview-fullscreen');
}
function selectLobbyPanel(name){
  if(!['play','garage','effects','arena'].includes(name))return;
  stopGoalPreview();lobbyArenaTour=name==='arena';$('menu').dataset.panel=name;
  document.querySelectorAll('.lobby-panel').forEach(panel=>panel.hidden=panel.id!=='panel-'+name);
  document.querySelectorAll('.lobby-nav [data-panel]').forEach(button=>{const active=button.dataset.panel===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  const labels={play:['YOUR NEXT MATCH','LAKESIDE CHAMPIONSHIP','Choose a mode to get started'],garage:['YOUR RIDE',playerCarModel.toUpperCase(),'Choose your body and paint'],arena:['STADIUM TOUR','LAKESIDE CHAMPIONSHIP','Decorative stands stay outside the playing surface']};
  if(labels[name])['previewKicker','previewTitle','previewHint'].forEach((id,i)=>$(id).textContent=labels[name][i]);
  syncGoalSelection();if(name==='effects')goalExplosion(false,true);
  const panels=document.querySelector('.lobby-panels');if(panels)panels.scrollTop=0;
}
document.querySelectorAll('.lobby-nav [data-panel]').forEach(button=>button.addEventListener('click',()=>selectLobbyPanel(button.dataset.panel)));
$('lobbySettings')?.addEventListener('click',()=>{$('controlsSettings').open=!$('controlsSettings').open;});
$('stopGoalPreview')?.addEventListener('click',stopGoalPreview);
$('fullGoalPreview')?.addEventListener('click',()=>{goalExplosion(false,true);document.body.classList.add('preview-fullscreen');});
$('returnGoalPreview')?.addEventListener('click',stopGoalPreview);
$('arenaTour')?.addEventListener('click',()=>{lobbyArenaTour=!lobbyArenaTour;});
syncGoalSelection();
function updateGaragePreview() {
  if($('menu').dataset.panel!=='garage')return;
  const chosen=CAR_MODELS.find(model=>model.name===playerCarModel);
  $('previewTitle').textContent=(chosen?.label||playerCarModel).toUpperCase();
  $('previewHint').textContent='YOUR PAINT · '+playerPaint.toUpperCase();
}
const paintInput = $('paint');
if (paintInput) paintInput.addEventListener('input', () => { playerPaint = paintInput.value || '#2fb8ff'; playerPaintCustom = true; updateGaragePreview(); if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
const paint2Input = $('paint2');
if (paint2Input) paint2Input.addEventListener('input', () => { player2Paint = paint2Input.value || '#ff8a1f'; player2PaintCustom = true; if (state === 'menu' || state === 'over') { buildTeams(); kickoff(); } });
updateGaragePreview();

function saveAnthemSettings(){
  try{localStorage.setItem('rocketArenaAnthemV1',JSON.stringify({track:anthemSelection,volume:anthemVolume}));}catch(_){}
}
function syncAnthemSelection(){
  for(const button of document.querySelectorAll('[data-anthem]')){
    const selected=button.dataset.anthem===anthemSelection;
    button.classList.toggle('on',selected);button.setAttribute('aria-pressed',String(selected));
  }
  if($('anthemPreview'))$('anthemPreview').disabled=anthemSelection==='off';
  if($('anthemPreviewStatus'))$('anthemPreviewStatus').textContent=anthemSelection==='off'?'Goal anthems off':'Selected: '+RocketGoalAnthems.TRACKS[anthemSelection].title;
}
for(const button of document.querySelectorAll('[data-anthem]'))button.addEventListener('click',()=>{
  anthemSelection=button.dataset.anthem;goalAnthems.stop(.08);saveAnthemSettings();syncAnthemSelection();
  if(anthemSelection!=='off')sfx.init();
});
$('anthemPreview')?.addEventListener('click',()=>{sfx.init();void goalAnthems.play(anthemSelection);});
$('anthemStop')?.addEventListener('click',()=>{goalAnthems.stop();if($('anthemPreviewStatus'))$('anthemPreviewStatus').textContent='Preview stopped';});
const anthemVolumeInput=$('settingAnthemVolume');
if(anthemVolumeInput){
  anthemVolumeInput.value=String(Math.round(anthemVolume*100));$('settingAnthemVolumeValue').value=anthemVolumeInput.value+'%';
  anthemVolumeInput.addEventListener('input',()=>{
    anthemVolume=Math.max(0,Math.min(1,Number(anthemVolumeInput.value)/100));
    $('settingAnthemVolumeValue').value=anthemVolumeInput.value+'%';
    goalAnthems.setMix({volume:anthemVolume});saveAnthemSettings();
  });
}
syncAnthemSelection();

function hexCss(hex) { return '#' + Number(hex).toString(16).padStart(6, '0'); }
function saveGeneralSettings() {
  try {
    localStorage.setItem('rocketArenaSettingsV1', JSON.stringify({
      volume: gameVolume, colourVisionMode, deadZone: controllerDeadZone,
      steeringSensitivity: controllerSteeringSensitivity, aerialSensitivity: controllerAerialSensitivity,
      controllerVibration: controllerVibrationEnabled, keyboardFlightMode,
      camera: cameraSettings, graphicsQuality
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
// Separate stick sensitivity sliders match Rocket League's controller options.
for (const [name, id, out] of [
  ['steering', 'settingSteeringSensitivity', 'settingSteeringSensitivityValue'],
  ['aerial', 'settingAerialSensitivity', 'settingAerialSensitivityValue']
]) {
  const input = $(id), output = $(out);
  if (!input) continue;
  const getValue = () => name === 'steering' ? controllerSteeringSensitivity : controllerAerialSensitivity;
  input.value = String(getValue());
  if (output) output.value = getValue().toFixed(2) + '×';
  input.addEventListener('input', () => {
    const sensitivity = clamp(Number(input.value) || 1, 1, 2.5);
    if (name === 'steering') controllerSteeringSensitivity = sensitivity;
    else controllerAerialSensitivity = sensitivity;
    if (output) output.value = sensitivity.toFixed(2) + '×';
    saveGeneralSettings();
  });
}
const vibrationSetting = $('settingControllerVibration');
if (vibrationSetting) {
  vibrationSetting.checked = controllerVibrationEnabled;
  vibrationSetting.addEventListener('change', () => {
    controllerVibrationEnabled = vibrationSetting.checked;
    saveGeneralSettings();
  });
}
for (const [key, id, out, min, max, suffix] of [
  ['fov', 'settingCameraFov', 'settingCameraFovValue', 60, 110, '°'],
  ['distance', 'settingCameraDistance', 'settingCameraDistanceValue', 5, 20, ''],
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
// One-click camera values inspired by common competitive Rocket League
// camera settings, retained through refresh as normal user settings.
const rlCameraPreset = $('settingCameraCompetitive');
if (rlCameraPreset) rlCameraPreset.addEventListener('click', () => {
  Object.assign(cameraSettings, { fov:105, distance:5.6, height:2.2, stiffness:10, shake:false });
  for (const [key, id, out, suffix] of [
    ['fov','settingCameraFov','settingCameraFovValue','°'],
    ['distance','settingCameraDistance','settingCameraDistanceValue',''],
    ['height','settingCameraHeight','settingCameraHeightValue',''],
    ['stiffness','settingCameraStiffness','settingCameraStiffnessValue','']
  ]) {
    if ($(id)) $(id).value=String(cameraSettings[key]);
    if ($(out)) $(out).value=cameraSettings[key]+suffix;
  }
  if ($('settingCameraShake')) $('settingCameraShake').checked=false;
  saveGeneralSettings();
});
const cameraShakeInput = $('settingCameraShake');
if (cameraShakeInput) {
  cameraShakeInput.checked = cameraSettings.shake;
  cameraShakeInput.addEventListener('change', () => {
    cameraSettings.shake = cameraShakeInput.checked; saveGeneralSettings();
  });
}
const keyboardFlightSetting = $('settingKeyboardFlight');
if (keyboardFlightSetting) {
  keyboardFlightSetting.value = keyboardFlightMode;
  keyboardFlightSetting.addEventListener('change', () => {
    keyboardFlightMode = keyboardFlightSetting.value === 'manual' ? 'manual' : 'assist';
    saveGeneralSettings();
  });
}
const graphicsSetting = $('settingGraphics');
if (graphicsSetting) {
  graphicsSetting.value = graphicsQuality;
  graphicsSetting.addEventListener('change', () => {
    graphicsQuality = ['low', 'balanced', 'high'].includes(graphicsSetting.value) ?
      graphicsSetting.value : 'balanced';
    renderer.shadowMap.enabled = graphicsQuality !== 'low';
    updateMiniCrowdQuality();
    resize();
    saveGeneralSettings();
  });
}
renderer.shadowMap.enabled = graphicsQuality !== 'low';
applyColourVisionMode(colourVisionMode, false, false);
sfx.setVolume(gameVolume);
const stadiumInput = $('stadium');
if (stadiumInput) stadiumInput.addEventListener('change', () => applyArenaStyle(stadiumInput.value));
for(const id of ['name2','profile2'])$(id)?.closest('.opts')?.classList.add('p2-configuration');
document.querySelector('.car-opts-p2')?.classList.add('p2-configuration');
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
      if(carModelAssets[playerCarModel]?.failed)loadDetailedCars();
      updateCarModelStatus();
      updateGaragePreview();
      document.querySelectorAll('.car-opts:not(.car-opts-p2) button').forEach(x => x.classList.toggle('on', x === b));
    } else {
      player2CarModel = b.dataset.car2;
      if(carModelAssets[player2CarModel]?.failed)loadDetailedCars();
      document.querySelectorAll('.car-opts-p2 button').forEach(x => x.classList.toggle('on', x === b));
    }
    saveGarageSelection();
    // Rebuild in the menu so each player's garage choice is immediately visible.
    if (state === 'menu' || state === 'over') {
      buildTeams();
      kickoff();
      const go = $('go');
      if (go) go.textContent = (b.dataset.car2 ? 'P2 selected: ' : 'P1 selected: ') + b.textContent.trim() + ' — press PLAY';
    }
  }
}
$('menu').addEventListener('click', handleMenuChoice);
// One-click quick modes use the real start path, not a separate fake arena.
for(const button of document.querySelectorAll('[data-quick]')){
  button.addEventListener('click',event=>{
    event.stopPropagation();
    const choice=button.dataset.quick;
    if(choice==='nexto'){
      localTwoPlayer=false;if($('localTwo'))$('localTwo').checked=false;resize();
      pick('mode',1);pick('diff',3);start();return;
    }
    if(choice==='freestyle'){
      start(true);
      const preset=$('trainingPreset');
      if(preset){
        preset.value='wall';
        preset.dispatchEvent(new Event('change',{bubbles:true}));
      }
      return;
    }
    pick('mode',choice==='competitive'?2:1);
    pick('diff',choice==='competitive'?2:0);
    start();
  });
}
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
  // Gamepad API: left stick X = steering / airborne yaw, Y = airborne pitch.
  // Triggers accelerate and reverse independently. Do not use the triggers to
  // pitch the car: Rocket League uses the left stick for this in the air.
  const stick = raw => {
    if (!Number.isFinite(raw)) return 0;
    const value = clamp(raw, -1, 1), magnitude = Math.abs(value);
    return magnitude <= controllerDeadZone ? 0 :
      Math.sign(value) * (magnitude - controllerDeadZone) / (1 - controllerDeadZone);
  };
  const rawAxisX = pad && pad.axes ? stick(pad.axes[0]) : 0;
  const rawAxisY = pad && pad.axes ? stick(pad.axes[1]) : 0;
  const axisX = clamp(rawAxisX * controllerSteeringSensitivity, -1, 1);
  const airAxisX = clamp(rawAxisX * controllerAerialSensitivity, -1, 1);
  const airAxisY = clamp(rawAxisY * controllerAerialSensitivity, -1, 1);
  const airRollModifier = buttonValue(pad, 'hand', who) > 0.55;
  // Legacy defaults used the same LB button for both drift and left air roll.
  // Treat LB as an air-roll modifier rather than continuously spinning left.
  const leftRollIsShared = controlBindings[who].pad.rollLeft === controlBindings[who].pad.hand;
  const leftRollPressed = !leftRollIsShared && buttonValue(pad, 'rollLeft', who) > 0.55;
  const rightRollPressed = buttonValue(pad, 'rollRight', who) > 0.55;
  const steer = clamp(keyRight - keyLeft + axisX + padRight - padLeft, -1, 1);
  const jumpButton = buttonValue(pad, 'jump', who) > 0.55;
  const keyboardPitchUp = !!keys[binding.aerialUp];
  const keyboardPitchDown = !!keys[binding.aerialDown];
  const manualPitch = keyboardPitchDown - keyboardPitchUp;
  const keyboardBoostHeld = !!keys[binding.boost];
  // Manual keyboard mode reproduces the familiar car-soccer mapping:
  // W pitches down in air and S pitches up; throttle still works normally.
  const manualFlight = typeof keyboardFlightMode !== 'undefined' && keyboardFlightMode === 'manual';
  return {
    throttle: clamp(keyForward - keyReverse + padForward - padReverse, -1, 1),
    steer,
    // In assisted mode, W/S are throttle only and I/K are pitch keys.
    // In manual Rocket-style mode, W noses down and S noses up while airborne.
    // Controller analogue pitch remains independent of triggers.
    pitch: clamp(manualPitch + (manualFlight ? keyForward-keyReverse : 0) - airAxisY, -1, 1),
    keyboardFlightAssist: !!(!manualFlight && keyboardBoostHeld &&
      !keyboardPitchUp && !keyboardPitchDown && Math.abs(airAxisY) < 0.04),
    // Neutral stick + RT + double-jump stays neutral; the left stick chooses flips.
    dodge: [clamp(keyForward - keyReverse - rawAxisY, -1, 1), clamp(keyRight - keyLeft + rawAxisX + padRight - padLeft, -1, 1)],
    airYaw: clamp(keyRight - keyLeft + (airRollModifier ? 0 : airAxisX) + padRight - padLeft, -1, 1),
    // Hold LB/L1 + move left stick horizontally to air roll. RB/R1 also rolls right.
    roll: clamp((keys[binding.rollRight] ? 1 : 0) - (keys[binding.rollLeft] ? 1 : 0) +
      (rightRollPressed ? 1 : 0) - (leftRollPressed ? 1 : 0) +
      (airRollModifier ? airAxisX : 0), -1, 1),
    jumpHeld: !!keys[binding.jump] || jumpButton,
    jump: false,
    hand: !!keys[binding.hand] || airRollModifier,
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
// Convert the actual state, not mesh positions (the garage moves preview meshes).
function nextoSnapshot(){
  const dt=Math.max(.001,nextoObservationTime-nextoLastObservation);nextoLastObservation=nextoObservationTime;
  return {
    cars:cars.map(c=>{
      const q=getCarOrientation(c).clone();let angular=[0,0,0];
      if(c.nextoPreviousQuat){
        const delta=q.clone().multiply(c.nextoPreviousQuat.clone().invert()).normalize();
        if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
        const magnitude=Math.hypot(delta.x,delta.y,delta.z);
        if(magnitude>1e-7){const scale=2*Math.atan2(magnitude,delta.w)/magnitude/dt;angular=[delta.x*scale,delta.y*scale,delta.z*scale];}
      }
      c.nextoPreviousQuat=q.clone();
      return {ai:c.ai,team:c.team,position:[c.x,c.y,c.z],velocity:[c.vx,c.vy,c.vz],
        quaternion:q.toArray(),angularVelocity:angular,boost:c.boost,demo:c.demoTimer>0,
        ground:c.ground,hasFlip:!(c.demoTimer>0)&&(c.ground||(c.jumps===1&&c.jt<PHYSICS_TUNING.DOUBLE_JUMP_WINDOW))};
    }),
    ball:{position:[ball.x,ball.y,ball.z],velocity:[ball.vx,ball.vy,ball.vz],angularVelocity:[ball.wx||0,ball.wy||0,ball.wz||0]},
    pads:pads.map(p=>({x:p.x,z:p.z,big:p.big,available:p.t<=0}))
  };
}
const pred = []; // where the ball will be every 0.1s for the next 4 seconds
let predictionTimer = 0;
function predict() {
  // Match the real ball solver exactly instead of using a stale separate
  // collision model. This improves AI interception after curved wall bounces.
  const forecast={...ball};
  pred.length=0;
  for(let i=0;i<40;i++){
    for(let sub=0;sub<4;sub++)stepBall(0.025,forecast,true);
    pred.push({x:forecast.x,y:forecast.y,z:forecast.z});
  }
}
function aiCtl(c, dt) {
  if(diff===3)return nextoAI.controls(c,cars.indexOf(c),{cars,ball});
  c.aiCd -= dt; c.errT = (c.errT || 0) - dt;
  const sk = SKILL[diff], ct = { throttle: sk.thr, steer: 0, jump: false, jumpHeld: false, boost: false, hand: false };
  if(c.bodyContact&&!c.ground&&c.aiCd<=0){ct.jump=true;ct.throttle=0;c.aiCd=.8;return ct;}
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
    // Positive steering rotates the nose RIGHT (+yaw) in the current vehicle
    // solver. Bots still used the old negative sign after the control overhaul,
    // causing them to turn AWAY from every target and circle helplessly.
    ct.steer = clamp(da * sk.steer, -1, 1);
    const headingError = Math.abs(da);
    const forwardSpeed = c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw);
    const targetSpeed = chase ? clamp(dist * 1.9 + 7, 11, 39) :
      clamp(dist * 1.6, 0, 29);
    const reverseTurn = headingError > 2.15 && sp < 7 && dist > 7;
    // Tyres now preserve momentum through steering. Give the bot a real
    // approach speed/brake strategy instead of holding throttle at full power
    // while making an impossible U-turn around a moving target.
    if (parked) ct.throttle = Math.abs(forwardSpeed) > 3 ? -Math.sign(forwardSpeed)*0.65 : 0;
    else if (reverseTurn) {
      ct.throttle = -0.7;
      ct.steer = -ct.steer; // reversing flips the effective steering direction
    } else if (forwardSpeed > targetSpeed + 4)
      ct.throttle = -0.8;
    else if (headingError > 1.25 && sp > 9)
      ct.throttle = 0.15;
    else ct.throttle = sk.thr;
    ct.boost = !reverseTurn && !parked && !!sk.boost &&
      c.boost > (chase ? 5 : 45) && headingError < 0.21 &&
      forwardSpeed > 8 && dist > 20;
    ct.hand = sk.drift && !reverseTurn && headingError > 0.85 && sp > 13;
    const low = tgt.y < 4.5 && ball.y < 4.5;
    if (chase && c.aiCd <= 0 && low && bd < 9.5 && Math.abs(da) < 0.35 && sp > 16 && Math.random() < sk.flip) { ct.jump = true; c.flipNext = true; c.aiCd = 1.2; } // power flip into the ball
    else if (chase && c.aiCd <= 0 && sk.aerial && tgt.y > 7 && tgt.y < 26 && d2(c, tgt) < 30 && sp > 10 && Math.abs(da) < 0.4) { ct.jump = true; c.aerial = true; c.aiCd = 2; }
    else if (chase && c.aiCd <= 0 && !sk.aerial && bd < 11 && ball.y > 4 && Math.abs(ball.x - c.x) < 9) { ct.jump = true; c.aiCd = 1; }
  } else if (c.aerial) { // aerial: aim nose at the ball and boost
    const hd = d2(c, tgt), want = Math.atan2(tgt.y - c.y, hd), dp = want - c.pitch;
    const aerialHeading = wrap(Math.atan2(tgt.x - c.x, tgt.z - c.z) - c.yaw);
    // Air yaw has the same sign as ground steering. Control pitch directly
    // rather than routing it through reverse/accelerate input, which also
    // applies unintended linear force during flight.
    ct.airYaw = clamp(aerialHeading * 2.4, -1, 1);
    ct.steer = ct.airYaw;
    ct.pitch = clamp(-dp * 2.7, -1, 1);
    ct.throttle = 0;
    ct.jumpHeld = true;
    ct.boost = Math.abs(dp) < 0.38 && Math.abs(aerialHeading) < 0.5 &&
      c.boost > 8 && hd < 45;
  } else {
    ct.pitch = clamp(c.pitch * 2.2, -1, 1); // level out without unwanted air throttle
    ct.throttle = 0;
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
  return c.airQuat || (c.ground && (c.landingQuat || c.surfaceQuat)) || new THREE.Quaternion().setFromEuler(
    new THREE.Euler(-(c.pitch || 0), c.yaw || 0, c.roll || 0, 'YXZ'));
}
function getCarForward(c) {
  return AIR_Z.clone().applyQuaternion(getCarOrientation(c));
}
function aerialControl(c, ct, dt) {
  if (!c.airQuat) c.airQuat = getCarOrientation(c).clone();
  if (!c.airOmega) c.airOmega = { pitch:0, yaw:0, roll:0 };
  const omega = c.airOmega;
  // A dodge owns its rotation until it finishes. The same stick that selected
  // a flip must not also add a second pitch/yaw animation on top of it.
  if(c.flip>0 && c.flipAxis && c.jumps===2){
    const duration=PHYSICS_TUNING.FLIP_TORQUE_DURATION;
    const elapsed=clamp(duration-c.flip,0,duration);
    const end=Math.min(duration,elapsed+dt);
    const rise=.06,fall=.16,flatEnd=duration-fall;
    // Integral of a smooth launch, sustained spin and soft finish. Integrating
    // across the final tick avoids losing rotation at 60/120/240 Hz.
    const travel=t=>{
      if(t<rise){const u=t/rise;return rise*(u*u*u-.5*u*u*u*u);}
      if(t<flatEnd)return rise/2+t-rise;
      const u=(t-flatEnd)/fall;
      return rise/2+flatEnd-rise+fall*(u-u*u*u+.5*u*u*u*u);
    };
    const angle=(travel(end)-travel(elapsed))*2*Math.PI/(duration-(rise+fall)/2);
    const pitch=clamp(Number.isFinite(ct.pitch)?ct.pitch:0,-1,1);
    // Opposite pitch cancels the pitch part of a dodge; side roll remains.
    c.flipPitchScale=c.flipPitchScale??1;
    if(pitch*c.flipAxis.x<-.1)c.flipPitchScale=Math.max(0,c.flipPitchScale-Math.abs(pitch)*8*dt);
    const axis=c.flipAxis.clone();axis.x*=c.flipPitchScale;
    const magnitude=axis.length();
    if(magnitude>1e-6)c.airQuat.multiply(new THREE.Quaternion().setFromAxisAngle(axis.multiplyScalar(1/magnitude),angle*magnitude));
    omega.pitch*=Math.exp(-20*dt);omega.yaw*=Math.exp(-20*dt);omega.roll*=Math.exp(-20*dt);
    c.flip=Math.max(0,c.flip-dt);
    if(c.flip<1e-8){c.flip=0;c.flipAxis=null;}
    c.airQuat.normalize();
    const e=new THREE.Euler().setFromQuaternion(c.airQuat,'YXZ');
    c.pitch=-e.x;c.yaw=e.y;c.roll=e.z;
    return;
  }
  // Local-axis torque and drag govern ordinary aerials. No automatic pitch
  // when the tank is empty, on body contact, inverted, during recovery, or
  // immediately after a dodge. Dedicated pitch/roll/yaw always takes priority.
  let pitchIn = clamp(Number.isFinite(ct.pitch) ? ct.pitch : (ct.throttle || 0), -1, 1);
  const roof=AIR_Y.clone().applyQuaternion(c.airQuat);
  if(ct.keyboardFlightAssist && Math.abs(pitchIn)<.04 && (c.boost??1)>0 &&
      !c.bodyContact && !(c.recoveryTimer>0) && !(c.aerialAssistDelay>0) &&
      roof.y>.25 && Math.abs(ct.roll||0)<.1 && Math.abs(ct.airYaw??ct.steer??0)<.1){
    const elevation=Math.asin(clamp(getCarForward(c).y,-1,1));
    const desiredElevation=55*Math.PI/180;
    pitchIn=clamp((elevation-desiredElevation)*2.6-omega.pitch*.85,-1,1);
  }
  const yawIn = clamp(Number.isFinite(ct.airYaw) ? ct.airYaw : (ct.steer || 0), -1, 1);
  const rollIn = -clamp(ct.roll || 0,-1,1);
  omega.pitch += (12.146*pitchIn - 2.798*omega.pitch) * dt;
  omega.yaw += (8.920*yawIn - 1.886*omega.yaw) * dt;
  omega.roll += (36.080*rollIn - 4.472*omega.roll) * dt;
  const spin = Math.hypot(omega.pitch,omega.yaw,omega.roll);
  if (spin > 5.5) {
    const factor = 5.5/spin;
    omega.pitch *= factor; omega.yaw *= factor; omega.roll *= factor;
  }
  // Rotate the actual body and hitbox, using one angular-velocity vector.
  if(spin>1e-8){
    const angular=new THREE.Vector3(omega.pitch,omega.yaw,omega.roll);
    const speed=angular.length();
    c.airQuat.multiply(new THREE.Quaternion().setFromAxisAngle(angular.multiplyScalar(1/speed),speed*dt));
  }
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
  const demand=boosting?1:clamp(throttle||0,-1,1);
  if(Math.abs(demand)<.01){
    const amount=525/PHYSICS_TUNING.REFERENCE_SCALE*dt;
    return Math.abs(v)<=amount?0:v-Math.sign(v)*amount;
  }
  if(v*demand<0){
    const brake=3500/PHYSICS_TUNING.REFERENCE_SCALE*Math.abs(demand)*dt;
    return Math.sign(v)*Math.max(0,Math.abs(v)-brake);
  }
  const limit=demand<0?PHYSICS_TUNING.REVERSE_MAX_SPEED:PHYSICS_TUNING.GROUND_MAX_SPEED;
  if(Math.abs(v)>=limit)return v;
  const next=v+demand*groundThrottleAcceleration(v)*dt;
  return demand<0?Math.max(-limit,next):Math.min(limit,next);
}
function groundSteeringCurvature(speedUnits, powerslide) {
  // Rocket League community-measured, piecewise ground turning curvature.
  // The wheel angle shrinks steeply with speed and yields ~3s 360° on throttle.
  const v=clamp(Math.abs(speedUnits),0,2500);
  const curvature=v<500 ? .006900 - 5.84e-6*v
    : v<1000 ? .005610 - 3.26e-6*v
    : v<1500 ? .004300 - 1.95e-6*v
    : v<1750 ? .003025 - 1.1e-6*v
    : .001800 - 4e-7*v;
  return Math.max(.0001,curvature) * (1 + (powerslide || 0) * 1.15);
}
// Tangent-space wheel basis at the car's contact point. Motion follows a
// curved surface without adding artificial velocity uphill or snapping Y.
function surfaceWheelAxes(yaw, surface) {
  const sy=Math.sin(yaw),cy=Math.cos(yaw);
  const dyForward=surface.dx*sy+surface.dz*cy;
  const dySide=surface.dx*cy-surface.dz*sy;
  const forward=new THREE.Vector3(sy,dyForward,cy).normalize();
  const right=new THREE.Vector3(cy,dySide,-sy);
  // On corner ramps two tangent basis vectors need orthogonalizing.
  right.addScaledVector(forward,-right.dot(forward)).normalize();
  return {forward,right};
}
// Continuous wheel-contact model for floor, round ramp, side wall and curved
// corner wall. Both steering and the car's visual/physical attitude use the
// SAME surface normal. A car can steer sideways on a vertical wall.
const CAR_CLEARANCE = 0.55;
function carSurfaceContact(c, broad = false) {
  if ((c.wallDetachTimer || 0) > 0) return null;
  // Drive around the ceiling edge instead of pinning a wall-climbing car
  // at maximum height with an upward velocity.
  if(c.y>=CEIL-0.87 && (c.ceilingRide ||
       (c.ground && c.wallRide && c.vy>=0))) {
    return {kind:'ceiling',normal:new THREE.Vector3(0,-1,0),
      height:CEIL-CAR_CLEARANCE,axis:null,sign:0};
  }
  const ax=Math.abs(c.x), az=Math.abs(c.z), cx=HW-CH, cz=HL-CH;
  const radius=Math.hypot(Math.max(0,ax-cx),Math.max(0,az-cz));
  const atCorner=ax>cx&&az>cz&&radius>CH-1.85;
  const onSide=ax>HW-1.85 && az<=HL-CH+1.9;
  const onEnd=az>HL-1.85 && ax>GW+2 && ax<=HW-CH+1.9;
  // Descending wall-to-ramp transitions at the true fillet lip instead of
  // snapping the car upwards from below the ramp.
  const nearUpperWall=c.y>=WALL_RAMP_HEIGHT+CAR_CLEARANCE+0.10 ||
    (c.y>=WALL_RAMP_HEIGHT+0.3 && c.vy>1.5);
  // An airborne car with its wheels toward a real wall may land on it.
  // A much narrower tolerance is used than for a car driving up the ramp:
  // this prevents a 1+ metre teleport across empty space.
  const airborneWallTouch=!c.ground && !!c.airQuat && (
    (atCorner && radius>=CH-CAR_CLEARANCE-0.18) ||
    (onSide && ax>=HW-CAR_CLEARANCE-0.18) ||
    (onEnd && az>=HL-CAR_CLEARANCE-0.18));
  if(nearUpperWall && (atCorner||onSide||onEnd) &&
      (broad || c.ground || c.wallRide || c.wallVerticalAxis ||
        airborneWallTouch)) {
    let n,kind='wall',axis=null,sign=0;
    if(atCorner) {
      const dx=ax-cx,dz=az-cz;
      n=new THREE.Vector3(-(Math.sign(c.x)||1)*dx/radius,0,
                              -(Math.sign(c.z)||1)*dz/radius);
    } else if(onSide) {
      axis='x';sign=Math.sign(c.x)||1;
      n=new THREE.Vector3(-sign,0,0);
    } else {
      axis='z';sign=Math.sign(c.z)||1;
      n=new THREE.Vector3(0,0,-sign);
    }
    return {kind,normal:n,axis,sign};
  }
  const ramp=arenaRampAt(c.x,c.z);
  const normal=new THREE.Vector3(-ramp.dx,1,-ramp.dz).normalize();
  const pose=c.airQuat||(c.ground&&c.landingQuat);
  const tyresTowardSurface=pose&&normal.y>.7&&AIR_Y.clone().applyQuaternion(pose).dot(normal)>=PHYSICS_TUNING.CAR_LANDING_MIN_DOT;
  // The first wheel/chassis contact of a tilted car is above its upright
  // ride height. Using .55 here while collision support holds it at 1–2 units
  // created a permanent hover with neither traction nor recovery available.
  const clearance=tyresTowardSurface&&Number.isFinite(c.landingClearance)?c.landingClearance:CAR_CLEARANCE;
  const support=ramp.height+clearance;
  const contactReach=broad?1.35:(c.ground||c.wallRide?0.67:0.19);
  const normalSpeed=c.vx*normal.x+c.vy*normal.y+c.vz*normal.z;
  if(c.y<=support+contactReach && (broad||c.ground||c.wallRide||normalSpeed<=.5)){
    return {kind:ramp.height>0.04?'ramp':'floor',normal,height:support,axis:null,sign:0};
  }
  return null;
}
function updateCarSurfaceFrame(c,normal) {
  const n=normal.clone().normalize();
  let forward;
  if(c.surfaceForward && c.surfaceNormal) {
    // Parallel transport the nose as the normal rotates from pitch to wall.
    const transport=new THREE.Quaternion().setFromUnitVectors(c.surfaceNormal,n);
    forward=c.surfaceForward.clone().applyQuaternion(transport);
  } else if(c.wallVerticalAxis) {
    // Training drills start already on the wall.
    forward=new THREE.Vector3(0,1,0);
  } else {
    const start=new THREE.Vector3(Math.sin(c.yaw),0,Math.cos(c.yaw));
    forward=start.applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(AIR_Y,n));
  }
  forward.addScaledVector(n,-forward.dot(n));
  if(forward.lengthSq()<1e-6) {
    forward=new THREE.Vector3(0,0,1).addScaledVector(n,-n.z);
    if(forward.lengthSq()<1e-6)forward.set(1,0,0);
  }
  forward.normalize();
  const right=new THREE.Vector3().crossVectors(n,forward).normalize();
  const q=new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(right,n,forward));
  c.surfaceNormal=n;c.surfaceForward=forward;c.surfaceQuat=q;
  const planar=Math.hypot(forward.x,forward.z);
  if(planar>0.2)c.yaw=Math.atan2(forward.x,forward.z);
  const e=new THREE.Euler().setFromQuaternion(q,'YXZ');
  c.pitch=-e.x;c.roll=e.z;
  return {forward,right,normal:n,quaternion:q};
}
function snapCarToContact(c,contact) {
  if(contact.kind==='wall') {
    if(contact.axis==='x') c.x=contact.sign*(HW-CAR_CLEARANCE);
    else if(contact.axis==='z') c.z=contact.sign*(HL-CAR_CLEARANCE);
    else {
      const cx=HW-CH,cz=HL-CH,dx=Math.abs(c.x)-cx,dz=Math.abs(c.z)-cz;
      const scale=(CH-CAR_CLEARANCE)/Math.max(0.01,Math.hypot(dx,dz));
      c.x=(Math.sign(c.x)||1)*(cx+dx*scale);
      c.z=(Math.sign(c.z)||1)*(cz+dz*scale);
    }
  } else {
    c.y=contact.height;
  }
}
function stepCar(c, ct, dt) {
  c.engineLoad=Math.abs(ct.throttle||0);
  c.demoCooldown = Math.max(0, (c.demoCooldown || 0) - dt);
  c.ballHitCooldown = Math.max(0, (c.ballHitCooldown || 0) - dt);
  c.airTouchCooldown = Math.max(0, (c.airTouchCooldown || 0) - dt);
  if (c.demoTimer > 0) {
    c.demoTimer = Math.max(0, c.demoTimer - dt);
    c.vx = c.vy = c.vz = 0; c.y = 0.55; c.pitch = 0; c.fl = 0;
    if (c.demoTimer <= 0) {
      c.x = 0; c.z = c.team ? HL - 14 : -HL + 14; c.yaw = c.team ? Math.PI : 0;
      c.pitch = 0; c.roll = 0; c.wallRide = false; c.wallVerticalAxis = null; c.wallVerticalSign = 0;
      c.surfaceQuat=null;c.surfaceNormal=null;c.surfaceForward=null;c.landingQuat=null;c.ceilingRide=false;
      c.airQuat=null;c.airOmega=null;c.jumpNormal=null;c.flip=0;c.flipAxis=null;c.flipPitchScale=1;c.aerialAssistDelay=0;c.recoveryTimer=0;c.recoveryTarget=null;c.bodyRestTime=0;c.bodyContact=false;
      c.boost = 34; c.jumps = 0; c.jt = 0; c.ground = true; c.boostImpactTimer = 0;
      c.mesh.root.visible = true;
    } else {
      c.mesh.root.visible = false;
    }
    return;
  }
  c.jt += dt;
  c.aerialAssistDelay=Math.max(0,(c.aerialAssistDelay||0)-dt);
  // Brief separation grace after a wall/ramp jump. Otherwise the same ramp
  // snaps the car back onto its surface in the next physics step.
  c.wallDetachTimer = Math.max(0, (c.wallDetachTimer || 0) - dt);
  const bounds=c.mesh?.bodyBounds||{min:[-1.25,-.48,-2],max:[1.25,1,2]};
  function bodyClearance(normal) {
    const local=normal.clone().applyQuaternion(getCarOrientation(c).clone().invert());
    const components=[local.x,local.y,local.z];let support=0;
    for(let i=0;i<3;i++)support-=components[i]*(components[i]>=0?bounds.min[i]:bounds.max[i]);
    return Math.max(CAR_CLEARANCE,support+.025);
  }
  const floorRamp=arenaRampAt(c.x,c.z);
  const floorNormal=new THREE.Vector3(-floorRamp.dx,1,-floorRamp.dz).normalize();
  c.landingClearance=bodyClearance(floorNormal)/Math.max(.7,floorNormal.y);
  const bodyHeight=floorRamp.height+c.landingClearance;
  const wheelAlignment=AIR_Y.clone().applyQuaternion(getCarOrientation(c)).dot(floorNormal);
  const bodyTouch=floorNormal.y>.7 && c.wallDetachTimer<=0 && c.y<=bodyHeight+.10 &&
    c.vx*floorNormal.x+c.vy*floorNormal.y+c.vz*floorNormal.z<2.5 && wheelAlignment<PHYSICS_TUNING.CAR_LANDING_MIN_DOT;
  c.bodyContact=bodyTouch;
  c.bodyRestTime=bodyTouch?(c.bodyRestTime||0)+dt:0;
  const manualRotation=Math.abs(ct.roll||0)>.1 || Math.abs(ct.pitch||0)>.1;
  const settling=bodyTouch && wheelAlignment>-.75 && c.bodyRestTime>.18 &&
    !(ct.boost && c.boost>0) && !manualRotation && !(c.flip>0);
  if((bodyTouch&&ct.jump)||settling){
    const forward=getCarForward(c);forward.addScaledVector(floorNormal,-forward.dot(floorNormal));
    if(forward.lengthSq()<.001)forward.set(Math.sin(c.yaw||0),0,Math.cos(c.yaw||0)).addScaledVector(floorNormal,-Math.cos(c.yaw||0)*floorNormal.z-Math.sin(c.yaw||0)*floorNormal.x);
    forward.normalize();
    const right=new THREE.Vector3().crossVectors(floorNormal,forward).normalize();
    c.recoveryTarget=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,floorNormal,forward));
    c.recoveryTimer=.5;c.airQuat=getCarOrientation(c).clone();c.airOmega={pitch:0,yaw:0,roll:0};
    c.flip=0;c.flipAxis=null;c.hold=0;c.jumpNormal=null;
    if(ct.jump){
      // A body-contact recovery is separate from aerial jumps. Exhausting
      // the double jump must not leave a car permanently trapped on its roof.
      const speed=c.vx*floorNormal.x+c.vy*floorNormal.y+c.vz*floorNormal.z;
      const impulse=Math.max(0,4-speed);
      c.vx+=floorNormal.x*impulse;c.vy+=floorNormal.y*impulse;c.vz+=floorNormal.z*impulse;
      c.wallDetachTimer=.15;ct={...ct,jump:false};
    }
  }
  let contact=carSurfaceContact(c);
  if(contact && !c.ground && c.airQuat) {
    // Landing on the roof, flank or an inverted wheel pose should bounce.
    // Only the tyres can reset jumps and establish traction.
    const wheelUp=AIR_Y.clone().applyQuaternion(c.airQuat);
    if(wheelUp.dot(contact.normal)<PHYSICS_TUNING.CAR_LANDING_MIN_DOT){
      contact=null;
    }
  }
  if(contact && contact.kind==='ceiling') {
    // Tyre suction on the inverted surface only lasts while accelerating;
    // releasing the throttle drops the car after a short transition.
    const gripDrive=Math.abs(ct.throttle||0)>0.05 || !!ct.boost;
    c.ceilingRelease=gripDrive ? 0 : (c.ceilingRelease||0)+dt;
    if(c.ceilingRelease>0.30) {
      c.wallDetachTimer=0.28;c.ceilingRide=false;
      contact=null;
    }
  } else c.ceilingRelease=0;
  const wasGrounded=!!c.ground;
  const ground=!!contact;
  // When tyres lose contact, preserve the last ground/wall orientation.
  if(!ground && c.ground && c.surfaceQuat) {
    c.airQuat=(c.landingQuat||c.surfaceQuat).clone();
    c.landingQuat=null;c.airOmega=null;
  }
  c.ground=ground;
  c.wallRide=ground && contact.kind!=='floor';
  c.ceilingRide=ground && contact.kind==='ceiling';
  c.wallVerticalAxis=ground ? contact.axis : null;
  c.wallVerticalSign=ground ? contact.sign : 0;
  if(ground) {
    c.recoveryTimer=0;c.recoveryTarget=null;c.bodyRestTime=0;c.bodyContact=false;
    if(!wasGrounded && c.airQuat) {
      c.landingQuat=contact.normal.y>.7?c.airQuat.clone():null;
      // Preserve the nose direction that the player aimed during the
      // recovery instead of reverting to a stale pre-jump surface heading.
      const nose=AIR_Z.clone().applyQuaternion(c.airQuat);
      nose.addScaledVector(contact.normal,-nose.dot(contact.normal));
      if(nose.lengthSq()>0.0001){
        c.surfaceForward=nose.normalize();
        c.surfaceNormal=contact.normal.clone();
      }else{
        c.surfaceForward=null;c.surfaceNormal=null;
      }
    }
    c.airQuat=null;c.airOmega=null;c.flipAxis=null;c.jumpNormal=null;
    c.flip=0;c.flipPitchScale=1;c.aerialAssistDelay=0;
    snapCarToContact(c,contact);
    updateCarSurfaceFrame(c,contact.normal);
  }
  const bo = !!ct.boost && c.boost > 0;
  // Keep a very short grace window so a clean boost collision still counts if boost
  // ends on the exact simulation frame the cars make contact.
  c.boostImpactTimer = bo ? 0.18 : Math.max(0, (c.boostImpactTimer || 0) - dt);
  if (trainingMode && !c.ai) c.boost = 100;
  if (bo) { c.boost = Math.max(0, c.boost - PHYSICS_TUNING.BOOST_DRAIN_PER_SECOND * dt); emitBoost(c); }
  c.fl = bo ? 1 : 0;
  if(ground) {
    c.jumps=0;c.jt=0;c.hold=0;
    const normal=c.surfaceNormal;
    const forward=c.surfaceForward;
    const right=new THREE.Vector3().crossVectors(normal,forward).normalize();
    const velocity=new THREE.Vector3(c.vx,c.vy,c.vz);
    let vf=velocity.dot(forward),vs=velocity.dot(right);
    c.powerslide=clamp((c.powerslide||0) +
      (ct.hand ? PHYSICS_TUNING.POWERSLIDE_RISE_RATE :
        -PHYSICS_TUNING.POWERSLIDE_FALL_RATE)*dt,0,1);
    const hb=c.powerslide;
    const physicalScale=physicsStyle==='arcade'?1.2:physicsStyle==='heavy'?0.85:1;
    vf=stepGroundForward(vf,ct.throttle || (bo?1:0),bo,dt*physicalScale);
    // Gravity is projected onto the tangent plane. On vertical walls it
    // naturally pulls the car down; throttle must overcome it.
    vf-=PHYSICS_TUNING.GRAVITY_FORCE*forward.y*dt;
    vs-=PHYSICS_TUNING.GRAVITY_FORCE*right.y*dt;
    const lateralFriction=PHYSICS_TUNING.NORMAL_LATERAL_FRICTION *
      (1-hb*(1-PHYSICS_TUNING.POWERSLIDE_FRICTION_MULTIPLIER));
    // Keep the velocity vector in the original surface tangent plane when
    // the wheels steer. Before, velocity rotated FOR FREE with the car nose:
    // no inertia, instant direction changes, and powerslides barely mattered.
    const preSteeringVelocity=forward.clone().multiplyScalar(vf)
      .addScaledVector(right,vs);
    const yawRate=Math.abs(vf)*PHYSICS_TUNING.REFERENCE_SCALE*
      groundSteeringCurvature(Math.abs(vf)*PHYSICS_TUNING.REFERENCE_SCALE,hb);
    const steer=clamp(ct.steer||0,-1,1);
    const turn=steer*Math.min(5.5,yawRate)*(vf>=0?1:-1)*dt;
    c.surfaceForward.applyAxisAngle(normal,turn).normalize();
    const frame=updateCarSurfaceFrame(c,normal);
    if(c.landingQuat){
      c.landingQuat.slerp(c.surfaceQuat,1-Math.exp(-20*dt)).normalize();
      if(c.landingQuat.angleTo(c.surfaceQuat)<.001)c.landingQuat=null;
      else{
        const e=new THREE.Euler().setFromQuaternion(c.landingQuat,'YXZ');c.pitch=-e.x;c.yaw=e.y;c.roll=e.z;
      }
    }
    // Tyre force is a bounded, time-continuous drag on *lateral* slip.
    // Grip builds centripetal acceleration over time rather than magically
    // rotating the whole velocity on every 120Hz step.
    const longitudinal=preSteeringVelocity.dot(frame.forward);
    const lateral=preSteeringVelocity.dot(frame.right)*
      Math.exp(-lateralFriction*dt);
    const v=frame.forward.clone().multiplyScalar(longitudinal)
      .addScaledVector(frame.right,lateral);
    c.vx=v.x;c.vy=v.y;c.vz=v.z;
  } else {
    const gravityScale = physicsStyle === 'floaty' ? 0.72 : physicsStyle === 'heavy' ? 1.2 : 1;
    c.vy -= PHYSICS_TUNING.GRAVITY_FORCE * gravityScale * dt;
    aerialControl(c, ct, dt);
    if (c.hold > 0 && ct.jumpHeld && c.jumps === 1) {
      // Keep jump hold along the launch surface normal. The driver can rotate
      // the car to aim at the ball without changing that initial jump impulse.
      const direction=c.jumpNormal || AIR_Y;
      const heldTime=Math.min(dt,c.hold);
      c.vx+=direction.x*PHYSICS_TUNING.JUMP_HOLD_FORCE*heldTime;
      c.vy+=direction.y*PHYSICS_TUNING.JUMP_HOLD_FORCE*heldTime;
      c.vz+=direction.z*PHYSICS_TUNING.JUMP_HOLD_FORCE*heldTime;
      c.hold=Math.max(0,c.hold-heldTime);
    } else c.hold = 0;
    // Rocket League retains a small forward/reverse throttle acceleration in
    // air, separate from its pitch input. Most aerial control comes from boost.
    if (Math.abs(ct.throttle || 0) > 0.01) {
      const nose = getCarForward(c);
      const accel = PHYSICS_TUNING.AIR_THROTTLE_ACCEL_REFERENCE /
        PHYSICS_TUNING.REFERENCE_SCALE;
      c.vx += nose.x * ct.throttle * accel * dt;
      c.vy += nose.y * ct.throttle * accel * dt;
      c.vz += nose.z * ct.throttle * accel * dt;
    }
    const damp = Math.exp(-PHYSICS_TUNING.AIR_LINEAR_DRAG * dt);
    c.vx *= damp; c.vy *= damp; c.vz *= damp;
  }
  // The nose, air roll and pitch determine the true rocket thrust vector.
  if (bo) applyDirectionalBoost(c, dt, ground);
  if(ct.jump) {
    if(ground) {
      // Jump along tyre contact normal, preserving the last wall attitude
      // and wall-tangent momentum for real wall-to-air dribble control.
      const n=contact.normal;
      const launch=PHYSICS_TUNING.JUMP_IMPULSE;
      c.airQuat=getCarOrientation(c).clone();
      c.landingQuat=null;c.airOmega=null;
      c.jumpNormal=n.clone();
      c.vx+=n.x*launch;c.vy+=n.y*launch;c.vz+=n.z*launch;
      c.x+=n.x*0.16;c.y+=n.y*0.16;c.z+=n.z*0.16;
      c.ground=false;c.wallRide=false;c.ceilingRide=false;c.wallVerticalAxis=null;
      c.wallVerticalSign=0;c.wallDetachTimer=0.30;
      c.jumps=1;c.jt=0;c.hold=PHYSICS_TUNING.JUMP_HOLD_DURATION;
    } else if (c.jumps === 1 && c.jt < PHYSICS_TUNING.DOUBLE_JUMP_WINDOW) {
      c.jumps = 2;c.hold=0;c.jumpNormal=null;
      const f = ct.dodge ? ct.dodge[0] : (Number.isFinite(ct.pitch) ? ct.pitch : ct.throttle), s = ct.dodge ? ct.dodge[1] : ct.steer;
      // Avoid accidental dodges from tiny analog stick movement.
      if (Math.hypot(f,s) >= PHYSICS_TUNING.DODGE_STICK_DEADZONE) {
        const dir=Math.hypot(f,s);
        // Dodge momentum stays parallel to the field. Pitching the nose up
        // must not convert a front flip into an extra vertical rocket impulse.
        const forward=getCarForward(c);forward.y=0;
        if(forward.lengthSq()<.01)forward.set(Math.sin(c.yaw),0,Math.cos(c.yaw));
        forward.normalize();
        const right=new THREE.Vector3(forward.z,0,-forward.x);
        const force=PHYSICS_TUNING.DODGE_IMPULSE/dir;
        c.vx+=(forward.x*f+right.x*s)*force;
        c.vz+=(forward.z*f+right.z*s)*force;
        c.flip=PHYSICS_TUNING.FLIP_TORQUE_DURATION;c.fx=f;c.fz=s;
        c.flipPitchScale=1;c.aerialAssistDelay=c.flip+.2;
        c.flipAxis=new THREE.Vector3(f,0,-s).normalize();
        if(!c.airQuat)c.airQuat=getCarOrientation(c).clone();
        c.airOmega={pitch:0,yaw:0,roll:0};
      } else {
        // A neutral second jump adds velocity along the roof, not global up.
        const roof=AIR_Y.clone().applyQuaternion(getCarOrientation(c));
        c.vx+=roof.x*PHYSICS_TUNING.DOUBLE_JUMP_IMPULSE;
        c.vy+=roof.y*PHYSICS_TUNING.DOUBLE_JUMP_IMPULSE;
        c.vz+=roof.z*PHYSICS_TUNING.DOUBLE_JUMP_IMPULSE;
      }
    }
  }
  if(!ground && c.recoveryTimer>0 && c.recoveryTarget){
    c.airQuat=getCarOrientation(c).clone().slerp(c.recoveryTarget,1-Math.exp(-14*dt)).normalize();
    c.airOmega={pitch:0,yaw:0,roll:0};c.recoveryTimer=Math.max(0,c.recoveryTimer-dt);
    const e=new THREE.Euler().setFromQuaternion(c.airQuat,'YXZ');c.pitch=-e.x;c.yaw=e.y;c.roll=e.z;
  }
  if (c.ai&&!c.nexto) c.boost = Math.min(100, c.boost + 8 * dt);
  // Boost momentum persists after boost is released. Only genuine physics
  // (coasting, braking, tyre friction) can slow the car from supersonic speed.
  const absoluteLimit = PHYSICS_TUNING.MAX_SPEED;
  const carSpeed = Math.hypot(c.vx, c.vy, c.vz);
  if (carSpeed > absoluteLimit) {
    const scale = absoluteLimit / carSpeed;
    c.vx *= scale; c.vy *= scale; c.vz *= scale;
  }
  const beforeMovement=ground ?
    {normal:c.surfaceNormal.clone(),forward:c.surfaceForward.clone()} : null;
  const previousForwardSpeed=beforeMovement ?
    c.vx*beforeMovement.forward.x+c.vy*beforeMovement.forward.y+
    c.vz*beforeMovement.forward.z : 0;
  const previousRight=beforeMovement ?
    new THREE.Vector3().crossVectors(beforeMovement.normal,beforeMovement.forward) : null;
  const previousSideSpeed=previousRight ?
    c.vx*previousRight.x+c.vy*previousRight.y+c.vz*previousRight.z : 0;
  c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;
  // Keep the roof/flanks above the surface using the rotated visible-body
  // bounds; a fixed upright clearance embedded sideways cars in the pitch.
  const bodyRamp=arenaRampAt(c.x,c.z);
  const bodyNormal=new THREE.Vector3(-bodyRamp.dx,1,-bodyRamp.dz).normalize();
  c.landingClearance=bodyClearance(bodyNormal)/Math.max(.7,bodyNormal.y);
  const minY=!ground&&bodyNormal.y>.7?bodyRamp.height+bodyClearance(bodyNormal)/bodyNormal.y:CAR_CLEARANCE;
  const maxY=CEIL-(!ground?bodyClearance(new THREE.Vector3(0,-1,0)):CAR_CLEARANCE);
  if(c.y<minY){
    c.y=minY;
    if(!ground){
      const incoming=c.vx*bodyNormal.x+c.vy*bodyNormal.y+c.vz*bodyNormal.z;
      if(incoming<0){
        const tyreAlignment=AIR_Y.clone().applyQuaternion(getCarOrientation(c)).dot(bodyNormal);
        const restitution=incoming < -1&&tyreAlignment<PHYSICS_TUNING.CAR_LANDING_MIN_DOT?PHYSICS_TUNING.CAR_ROOF_RESTITUTION:0;
        const impulse=-(1+restitution)*incoming;
        c.vx+=bodyNormal.x*impulse;c.vy+=bodyNormal.y*impulse;c.vz+=bodyNormal.z*impulse;
        const drag=Math.exp(-3*dt);c.vx*=drag;c.vz*=drag;
      }
    }
  }else if(c.y>maxY){
    c.y=maxY;
    if(!ground&&c.vy>0)c.vy=-c.vy*PHYSICS_TUNING.CAR_ROOF_RESTITUTION;
  }
  // Wheel suspension brings the car to its nearest curved surface without
  // deleting its speed along that surface. Contact normal is updated every
  // physics tick, so the ramp-wall boundary is not a mode-switch teleport.
  if(ground && c.wallDetachTimer<=0){
    const after=carSurfaceContact(c,true);
    if(after){
      snapCarToContact(c,after);
      const frame=updateCarSurfaceFrame(c,after.normal);
      const aligned=frame.forward.clone().multiplyScalar(previousForwardSpeed)
        .addScaledVector(frame.right,previousSideSpeed);
      c.vx=aligned.x;c.vy=aligned.y;c.vz=aligned.z;
      c.ground=true;c.wallRide=after.kind!=='floor';
      c.ceilingRide=after.kind==='ceiling';
      c.wallVerticalAxis=after.axis;c.wallVerticalSign=after.sign;
    }else {
      c.ground=false;c.wallRide=false;c.ceilingRide=false;
      c.wallVerticalAxis=null;c.wallVerticalSign=0;
      c.airQuat=(c.landingQuat||c.surfaceQuat||getCarOrientation(c)).clone();
      c.landingQuat=null;c.airOmega=null;
    }
  }else {
    // Airborne body contact with the enclosure does not silently reattach the
    // tyres. Players must touch down again or steer back onto the ramp.
    const corner=arenaCornerContact(c.x,c.z,CAR_CLEARANCE);
    if(corner){
      c.x-=corner.nx*corner.penetration;
      c.z-=corner.nz*corner.penetration;
      const outbound=c.vx*corner.nx+c.vz*corner.nz;
      if(outbound>0){
        c.vx-=corner.nx*outbound*1.25;
        c.vz-=corner.nz*outbound*1.25;
      }
    }
    if(Math.abs(c.x)>HW-CAR_CLEARANCE){
      const sign=Math.sign(c.x);
      c.x=sign*(HW-CAR_CLEARANCE);
      if(c.vx*sign>0)c.vx*=-0.25;
    }
    if(Math.abs(c.z)>HL-CAR_CLEARANCE &&
       !(Math.abs(c.x)<GW && c.y<GH)){
      const sign=Math.sign(c.z);
      c.z=sign*(HL-CAR_CLEARANCE);
      if(c.vz*sign>0)c.vz*=-0.25;
    }
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
  rumbleCar(attacker, 0.9, 280);
  rumbleCar(victim, 0.95, 320);
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
        rumbleCar(a, 0.5, 115); rumbleCar(b, 0.5, 115);
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
  if (closing > 2.5 && (c.nextRumbleAt || 0) <= t) {
    rumbleCar(c, Math.min(0.65, 0.12 + closing * 0.018), Math.min(170, 60 + closing * 3));
    c.nextRumbleAt = t + 0.15;
  }

  const inverseBallMass = 1 / PHYSICS_TUNING.BALL_MASS_REFERENCE;
  const inverseCarMass = 1 / PHYSICS_TUNING.CAR_MASS_REFERENCE;
  const impulse = closing * (1 + PHYSICS_TUNING.CAR_BALL_RESTITUTION) / (inverseBallMass + inverseCarMass);
  const ballChange = impulse * inverseBallMass, carChange = impulse * inverseCarMass;
  ball.vx += nx * ballChange; ball.vy += ny * ballChange; ball.vz += nz * ballChange;
  c.vx -= nx * carChange; c.vy -= ny * carChange; c.vz -= nz * carChange;
  // Tangential impulses act at the surface of a solid sphere (I = 2/5 mr²).
  // Include existing spin so a rolling contact is not mistaken for sliding.
  const contactX=rvx-BR*((ball.wy||0)*nz-(ball.wz||0)*ny);
  const contactY=rvy-BR*((ball.wz||0)*nx-(ball.wx||0)*nz);
  const contactZ=rvz-BR*((ball.wx||0)*ny-(ball.wy||0)*nx);
  const normalContact=contactX*nx+contactY*ny+contactZ*nz;
  const tx=contactX-normalContact*nx,ty=contactY-normalContact*ny,tz=contactZ-normalContact*nz;
  const slip=Math.hypot(tx,ty,tz);
  if(slip>1e-6){
    const change=Math.min(slip/(3.5+inverseCarMass/inverseBallMass),ballChange*PHYSICS_TUNING.CAR_BALL_FRICTION);
    const k=change/slip;
    const dvx=-tx*k,dvy=-ty*k,dvz=-tz*k;
    ball.vx+=dvx;ball.vy+=dvy;ball.vz+=dvz;
    const reaction=inverseCarMass/inverseBallMass;
    c.vx-=dvx*reaction;c.vy-=dvy*reaction;c.vz-=dvz*reaction;
    ball.wx-=2.5/BR*(ny*dvz-nz*dvy);
    ball.wy-=2.5/BR*(nz*dvx-nx*dvz);
    ball.wz-=2.5/BR*(nx*dvy-ny*dvx);
  }

  // Match the public RocketSim extra-hit model: centre-to-centre direction,
  // compressed vertical component, forward adjustment, and a speed curve.
  // Boost and dodges already contribute through velocity; no fixed pop/bonus.
  if((c.ballHitCooldown||0)<=0){
    const speed=Math.min(Math.hypot(rvx+contactSpeed.x,rvy+contactSpeed.y,rvz+contactSpeed.z),
      PHYSICS_TUNING.BALL_EXTRA_HIT_MAX_RELATIVE_SPEED);
    const referenceSpeed=speed*PHYSICS_TUNING.REFERENCE_SCALE;
    const curve=PHYSICS_TUNING.BALL_EXTRA_HIT_CURVE;
    let factor=curve[curve.length-1][1];
    for(let i=1;i<curve.length;i++)if(referenceSpeed<=curve[i][0]){
      const [x0,y0]=curve[i-1],[x1,y1]=curve[i];
      factor=y0+(y1-y0)*clamp((referenceSpeed-x0)/(x1-x0),0,1);break;
    }
    const direction=new THREE.Vector3(dx,dy*PHYSICS_TUNING.BALL_EXTRA_HIT_VERTICAL_SCALE,dz).normalize();
    const adjustment=direction.dot(nose)*(1-PHYSICS_TUNING.BALL_EXTRA_HIT_FORWARD_SCALE);
    direction.addScaledVector(nose,-adjustment).normalize();
    ball.vx+=direction.x*speed*factor;ball.vy+=direction.y*speed*factor;ball.vz+=direction.z*speed*factor;
    c.ballHitCooldown=PHYSICS_TUNING.BALL_EXTRA_HIT_COOLDOWN;
  }
  clampBallMotion();
}
function clampBallMotion(body=ball) {
  const speed = Math.hypot(body.vx, body.vy, body.vz);
  if (speed > PHYSICS_TUNING.MAX_BALL_SPEED) {
    const scale = PHYSICS_TUNING.MAX_BALL_SPEED / speed;
    body.vx *= scale; body.vy *= scale; body.vz *= scale;
  }
  const spin = Math.hypot(body.wx || 0, body.wy || 0, body.wz || 0);
  if (spin > PHYSICS_TUNING.BALL_MAX_ANGULAR_SPEED) {
    const scale = PHYSICS_TUNING.BALL_MAX_ANGULAR_SPEED / spin;
    body.wx *= scale; body.wy *= scale; body.wz *= scale;
  }
}
function ballSurfaceImpulse(nx, ny, nz, restitution, body=ball) {
  const vn=body.vx*nx+body.vy*ny+body.vz*nz;
  if(vn>=0)return 0;
  // Only genuine impacts rebound. Small resting contacts lose their normal
  // velocity, but retain horizontal rolling momentum.
  const e=vn<-PHYSICS_TUNING.BALL_BOUNCE_CUTOFF_SPEED?restitution:0;
  const impulse=-(1+e)*vn;
  body.vx+=impulse*nx;body.vy+=impulse*ny;body.vz+=impulse*nz;
  const contactX=body.vx-BR*((body.wy||0)*nz-(body.wz||0)*ny);
  const contactY=body.vy-BR*((body.wz||0)*nx-(body.wx||0)*nz);
  const contactZ=body.vz-BR*((body.wx||0)*ny-(body.wy||0)*nx);
  const normal=contactX*nx+contactY*ny+contactZ*nz;
  const tx=contactX-normal*nx,ty=contactY-normal*ny,tz=contactZ-normal*nz;
  const speed=Math.hypot(tx,ty,tz);
  if(speed>1e-6){
    const change=Math.min(speed/3.5,impulse*PHYSICS_TUNING.BALL_SURFACE_FRICTION);
    const k=change/speed,dvx=-tx*k,dvy=-ty*k,dvz=-tz*k;
    body.vx+=dvx;body.vy+=dvy;body.vz+=dvz;
    body.wx-=2.5/BR*(ny*dvz-nz*dvy);
    body.wy-=2.5/BR*(nz*dvx-nx*dvz);
    body.wz-=2.5/BR*(nx*dvy-ny*dvx);
  }
  return impulse;
}

// goal explosion helpers
let camShakeTime = 0;

const GOAL_EFFECT_DATA = RocketGoalEffects.STYLES;
const goalEffects = new RocketGoalEffects.Manager(scene, {quality:graphicsQuality});
const activeGoalEffects = goalEffects.effects;
let goalPreviewUntil = 0;
let goalCameraView = null;
function clearGoalEffect(effect) { goalEffects.remove(effect); }
function tickGoalEffects(dt) { goalEffects.update(dt); }
function goalExplosion(team, preview=false) {
  const style=Object.hasOwn(GOAL_EFFECT_DATA,goalExplosionStyle)?goalExplosionStyle:'classic';
  const end=preview?1:(ball.z>=0?1:-1);
  // Anchor the whole celebration at the goal mouth, facing into the pitch.
  const position=new THREE.Vector3(preview?0:clamp(ball.x,-GW+3,GW-3),6,end*(HL-1));
  goalEffects.quality=graphicsQuality;
  if(preview)goalEffects.clear();
  const effect=goalEffects.spawn(style,position,{teamColour:team?ORANGE:BLUE,direction:-end});
  if(preview){
    goalPreviewUntil=performance.now()+effect.duration*1000+600;
    document.body.classList.add('goal-preview');
    const tip=$('explosionPreviewStatus');
    if(tip)tip.textContent=GOAL_EFFECT_DATA[style].name+' · LIVE 3D PREVIEW';
  }else {
    camShakeTime=cameraSettings.shake ? .65 : 0;
    goalCameraView={x:position.x,y:position.y,z:position.z,end,startedAt:performance.now()};
  }
  if(sfx && sfx.init){
    if(preview)sfx.init();
    const notes=style==='fire'?[98,147,196]:style==='blackhole'?[82,65,49]:[196,392,587];
    notes.forEach((frequency,index)=>setTimeout(()=>sfx.tone(frequency,.22,'sine',.10),index*100));
  }
}


// Transfer momentum from the curved ramp into VERTICAL wall rolling. Without
// this the ball hits a flat invisible barrier at the ramp lip and rebounds.
function resolveBallWall(axis, sign, rampSurfaceY, body=ball) {
  const outward = (axis === 'x' ? body.vx : body.vz) * sign;
  // The ball centre meets the vertical boundary before the ramp reaches its
  // full height, because the ball radius offsets it inward from the wall.
  const atWallLip = rampSurfaceY > BR + WALL_RAMP_HEIGHT * 0.25 &&
    body.y > rampSurfaceY - 2.2 &&
    body.y < rampSurfaceY + 4.2;
  // At the lip, the rounded ramp has ALREADY converted most outward
  // velocity to upward motion. Do not require a large remaining outward speed
  // or inject another vertical "pop" every frame.
  // A fast outward ball at the lip can roll upward even when its initial
  // vertical velocity is small. Avoid popping genuinely falling wall hits.
  if (atWallLip && outward > 1.1 && body.vy > -0.5) {
    // Convert the outward component INTO vertical travel only once.
    // The efficiency is below 1 so the wall cannot create kinetic energy.
    const rising=Math.max(0,body.vy);
    body.vy=Math.max(rising,Math.hypot(outward,rising)*PHYSICS_TUNING.BALL_WALL_LIP_EFFICIENCY);
    if(axis==='x')body.vx=0;
    else body.vz=0;
    body.onRamp=false;body.onGround=false;body.onWall=true;
    // Turning surface momentum upward is the wall ramp continuation, not an
    // extra speed boost. The sphere will naturally slow and fall under gravity.
  } else {
    ballSurfaceImpulse(axis === 'x' ? -sign : 0, 0,
      axis === 'z' ? -sign : 0, PHYSICS_TUNING.BALL_WALL_RESTITUTION, body);
    body.onWall = false;
  }
}
function stepBall(dt, body=ball, predicting=false) {
  const p = PHYSICS_TUNING;
  body.onWall=false;
  const previousZ=body.z,previousVelocity={vx:body.vx,vy:body.vy,vz:body.vz};
  // Integrate velocity before contacts, keeping all motion in world space.
  body.vy -= p.BALL_GRAVITY_FORCE * dt;
  const airDrag = Math.pow(1-p.BALL_DRAG_REFERENCE,dt);
  body.vx *= airDrag; body.vy *= airDrag; body.vz *= airDrag;
  clampBallMotion(body);
  body.x += body.vx * dt; body.y += body.vy * dt; body.z += body.vz * dt;

  if (body.y > CEIL - BR) {
    body.y = CEIL - BR;
    ballSurfaceImpulse(0, -1, 0, p.BALL_RESTITUTION, body);
  }
  const ax = Math.abs(body.x), az = Math.abs(body.z);
  const sx = Math.sign(body.x) || 1, sz = Math.sign(body.z) || 1;
  if (!predicting && state === 'play' && az > HL && ax < GW - BR * 0.25 && body.y < GH - BR * 0.25) {
    const span=body.z-previousZ;
    const fraction=Math.abs(previousZ)<=HL && Math.abs(span)>1e-9?clamp(((body.z>0?HL:-HL)-previousZ)/span,0,1):1;
    const crossing={vx:previousVelocity.vx+(body.vx-previousVelocity.vx)*fraction,
      vy:previousVelocity.vy+(body.vy-previousVelocity.vy)*fraction,vz:previousVelocity.vz+(body.vz-previousVelocity.vz)*fraction};
    clampBallMotion(crossing);
    return goal(body.z > 0 ? 0 : 1,crossing);
  }

  // Smooth sphere contact with the same ramp height field used by the cars.
  // Only hold the ball on a ramp when actually touching it; never snap an
  // airborne ball down from several units above the slope.
  const ramp = arenaRampAt(body.x, body.z);
  const surface = BR + ramp.height;
  const normalLength = Math.hypot(-ramp.dx, 1, -ramp.dz);
  const nx = -ramp.dx / normalLength, ny = 1 / normalLength, nz = -ramp.dz / normalLength;
  const normalSpeed = body.vx * nx + body.vy * ny + body.vz * nz;
  const touching=body.y<=surface+p.BALL_CONTACT_SLOP && normalSpeed<=0.2;
  const wasSupported=!!(body.onGround||body.onRamp);
  if(body.y<surface || (wasSupported && touching)){
    body.y=Math.max(body.y,surface);
    const restitution=ramp.height<=0.1?p.BALL_FLOOR_RESTITUTION:p.BALL_RAMP_IMPACT_RESTITUTION;
    ballSurfaceImpulse(nx,ny,nz,restitution, body);
    // Airborne bounces should not be tagged as "rolling" and dragged flat.
    const outgoing=body.vx*nx+body.vy*ny+body.vz*nz;
    const supported=outgoing<0.36;
    body.onRamp=ramp.height>0.1&&supported;
    body.onGround=ramp.height<=0.1&&supported;

  }else{
    body.onRamp=false;body.onGround=false;
  }

  // Circular corner wall collision: exact normal from the new arc, not
  // the old 45-degree invisible diagonal that kicked balls unexpectedly.
  const corner = arenaCornerContact(body.x,body.z,BR);
  if(corner){
    body.x -= corner.nx*corner.penetration;
    body.z -= corner.nz*corner.penetration;
    ballSurfaceImpulse(-corner.nx,0,-corner.nz,p.BALL_WALL_RESTITUTION, body);
    body.onWall=true;
  }

  if (Math.abs(body.x) > HW - BR && az <= HL + BR &&
      !(Math.abs(body.x)>HW-CH && Math.abs(body.z)>HL-CH)) {
    const sign = Math.sign(body.x);
    body.x = sign * (HW - BR);
    resolveBallWall('x', sign, surface, body);
  }
  if (Math.abs(body.z) > HL) {
    // Goal interior has its own side / roof / back-wall colliders.
    if (Math.abs(body.x) > GW - BR) {
      const sign = Math.sign(body.x);
      body.x = sign * (GW - BR);
      ballSurfaceImpulse(-sign, 0, 0, p.BALL_RESTITUTION, body);
    }
    if (body.y > GH - BR) {
      body.y = GH - BR;
      ballSurfaceImpulse(0, -1, 0, p.BALL_RESTITUTION, body);
    }
    if (Math.abs(body.z) > HL + GD - BR) {
      const sign = Math.sign(body.z);
      body.z = sign * (HL + GD - BR);
      ballSurfaceImpulse(0, 0, -sign, p.BALL_RESTITUTION, body);
    }
  } else if (Math.abs(body.z) > HL - BR &&
      !(Math.abs(body.x)>HW-CH && Math.abs(body.z)>HL-CH) &&
      !(Math.abs(body.x) < GW - BR && body.y < GH - BR)) {
    const sign = Math.sign(body.z);
    body.z = sign * (HL - BR);
    resolveBallWall('z', sign, surface, body);
  }

  // Spin changes through contact friction, not a forced rolling animation.
  clampBallMotion(body);
  if(!predicting){
    const spin=Math.hypot(body.wx||0,body.wy||0,body.wz||0);
    if(spin>1e-6){
      const q=new THREE.Quaternion().fromArray(body.q||[0,0,0,1]);
      const axis=new THREE.Vector3(body.wx,body.wy,body.wz).multiplyScalar(1/spin);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis,spin*dt)).normalize();body.q=q.toArray();
    }
  }
}

function showGameEvent(label, color = '#fff') {
  const el = $('eventCallout'); if (!el) return;
  el.textContent = label; el.style.color = color; el.classList.remove('event-pop'); void el.offsetWidth; el.classList.add('event-pop');
}
function goal(team, scoringVelocity=ball) {
  goalSpeedMph=RocketReplay.speedToMph(scoringVelocity,PHYSICS_TUNING.REFERENCE_SCALE);
  replayAnthemToken++;replayAnthemTrack=anthemSelection;
  if (trainingMode) {
    trainingGoals++;
    updateTrainingCounters();
    showGameEvent('FREE PLAY GOAL '+trainingGoals+' · '+goalSpeedMph.toFixed(1)+' MPH', '#ffca64');
    // Free Play now uses the same selected 3D explosion as a real match.
    const scoringSide=ball.z<0?1:0;
    goalExplosion(scoringSide);
    cheerMiniCrowd(scoringSide);
    resetTrainingBall();
    return;
  }
  score[team]++;
  const scorerIndex = lastTouch ? cars.indexOf(lastTouch) : -1;
  if (scorerIndex >= 0 && playerStats[scorerIndex]) playerStats[scorerIndex].goals++;
  const assistIndex = previousTouch ? cars.indexOf(previousTouch) : -1;
  if (assistIndex >= 0 && assistIndex !== scorerIndex && cars[assistIndex].team === team && playerStats[assistIndex]) playerStats[assistIndex].assists++;
  if (scorerIndex >= 0 && playerStats[scorerIndex]) playerStats[scorerIndex].shotsOnGoal++;
  state = 'goal';
  cd = GOAL_EFFECT_DATA[goalExplosionStyle]?.duration || 4.3; // let the full 3D celebration play
  // Keep ten seconds of live gameplay plus the frame in which the goal was scored.
  saveReplayFrame();
  replayFrames = replayHistory.slice(-301);
  replayElapsed = 0;

  // Show the scorer first, before switching to the replay title.
  const scorerName = lastTouch ? (lastTouch === cars[0] ? playerName : lastTouch.displayName) : null;
  goalScorerText = scorerName || (team ? 'ORANGE' : 'BLUE');
  const goalByEl = $('goalBy');
  if (goalByEl) goalByEl.textContent = 'Goal by ' + goalScorerText + '!!!';
  const goalSpeedEl = $('goalSpeed');
  if (goalSpeedEl) goalSpeedEl.textContent = 'GOAL SPEED · ' + goalSpeedMph.toFixed(1) + ' MPH';
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
  cheerMiniCrowd(team);

  // The selected 3D celebration owns its particles; no generic burst obscures it.
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.35, 'triangle', 0.2), i * 120));
}
function update(dt) {
  if(typeof onlineMode!=='undefined'&&onlineMode?.role==='guest')return;
  t += dt;
  if(state==='play' && !trainingMode)replaySimulationTime+=dt;
  if (state === 'kick') { cd -= dt; jumpQ = false; $('msg').style.color = '#fff'; $('msg').textContent = cd > 0 ? Math.ceil(cd) : 'GO!'; if (cd <= 0) { state = 'play'; $('msg').textContent = ''; } return; }
  if (state === 'replay') {
    replayElapsed += dt;
    if (replayElapsed >= RocketReplay.duration(replayFrames)) {
      applyReplayFrame(replayFrames[replayFrames.length-1]);
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
        replayElapsed = 0;
        applyReplayFrame(RocketReplay.sample(replayFrames,0));
        resetBallTrail();
        // Snap the replay camera behind the selected scorer immediately; don't
        // let the previous player's camera position linger into the replay.
        const scorer = cars[replayCameraCarIndex] || cars[0];
        const backX = -Math.sin(scorer.yaw), backZ = -Math.cos(scorer.yaw);
        for (const camState of [cam, ...(localTwoPlayer ? [cam2] : [])]) {
          delete camState.heading;delete camState.offset;delete camState.direction;
          camState.x = scorer.x + backX * 11;
          camState.y = clamp(scorer.y + 4.6, 2, CEIL - 1);
          camState.z = scorer.z + backZ * 11;
          camState.lx = scorer.x - backX * 9;
          camState.ly = 1.5;
          camState.lz = scorer.z - backZ * 9;
        }
        const m = $('msg'); if (m) { m.textContent = 'GOAL REPLAY'; m.style.color = '#fff'; m.classList.add('replay-title'); }
        const goalByEl = $('goalBy'); if (goalByEl) goalByEl.textContent = 'Goal by ' + goalScorerText + '!!!';
        const goalSpeedEl = $('goalSpeed'); if (goalSpeedEl) goalSpeedEl.textContent = 'GOAL SPEED · ' + goalSpeedMph.toFixed(1) + ' MPH';
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
  if(diff===3&&!trainingMode){nextoObservationTime+=dt;nextoAI.update(dt,nextoSnapshot);}
  const cts = cars.map((c, i) => {
    if (i === 0) return playerCtl();
    if(typeof onlineMode!=='undefined'&&onlineMode&&i===1)return remoteOnlineControls();
    if (localTwoPlayer && i === mode) return player2Ctl();
    return aiCtl(c, dt);
  });
  for (let n = 0; n < 2; n++) {
    const h = dt / 2;
    cars.forEach((c, i) => stepCar(c, cts[i], h)); cts.forEach(ct => { ct.jump = false; });
    bump(); stepBall(h); cars.forEach(hitBall);
  }
  if(state==='play' && !trainingMode){
    replayCaptureTimer+=dt;
    if(replayCaptureTimer+1e-9>=1/30){saveReplayFrame();replayCaptureTimer-=1/30;}
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
function updateCam(dt, carIndex=0, targetCamera=camera, camState=cam) {
  const car=cars[carIndex]||cars[0];if(!car)return;
  const pad=controllerForPlayer(localTwoPlayer&&carIndex===mode?'p2':'p1');
  const stick=raw=>{if(!Number.isFinite(raw))return 0;const magnitude=Math.abs(clamp(raw,-1,1));return magnitude<=controllerDeadZone?0:Math.sign(raw)*(magnitude-controllerDeadZone)/(1-controllerDeadZone);};
  const result=RocketBallCamera.update(camState,{car,ball,forward:getCarForward(car),settings:cameraSettings,
    aspect:targetCamera.aspect,ballCam,lookX:stick(pad?.axes?.[2]),lookY:stick(pad?.axes?.[3]),dt,
    heightAt:(x,z)=>arenaRampAt(x,z).height});
  targetCamera.position.set(result.position.x,result.position.y,result.position.z);
  if(cameraSettings.shake&&camShakeTime>0){
    const shake=Math.min(.25,camShakeTime)*.4;targetCamera.position.x+=(Math.random()-.5)*shake;targetCamera.position.y+=(Math.random()-.5)*shake;
  }
  camShakeTime=Math.max(0,camShakeTime-dt);
  targetCamera.up.set(0,1,0);targetCamera.lookAt(result.target.x,result.target.y,result.target.z);
  targetCamera.fov+=(result.fov-targetCamera.fov)*(1-Math.exp(-cameraSettings.stiffness*dt));targetCamera.updateProjectionMatrix();
  // Retain compatibility with the replay camera reset/debug state.
  Object.assign(camState,{x:result.position.x,y:result.position.y,z:result.position.z,lx:result.target.x,ly:result.target.y,lz:result.target.z});
  sun.position.set(car.x+30,80,car.z+25);sun.target.position.set(car.x,0,car.z);sun.target.updateMatrixWorld();
}

function render(dt) {
  document.body.classList.toggle('in-menu',state==='menu');
  document.body.classList.toggle('goal-celebration',state==='goal');
  document.body.classList.toggle('local-two-enabled',localTwoPlayer);
  if(state==='replay'&&onlineMode?.role!=='guest')applyReplayFrame(RocketReplay.sample(replayFrames,replayElapsed));
  for (const c of cars) {
    const m = c.mesh;
    m.root.position.set(c.x, c.y, c.z);
    if ((c.airQuat || (c.ground && c.surfaceQuat)) && state !== 'menu' && state !== 'over') {
      m.root.quaternion.copy(getCarOrientation(c));
    } else {
      m.root.rotation.set(-c.pitch, c.yaw, c.roll || 0, 'YXZ');
    }
    m.flame.visible = !!c.fl; m.flame.scale.set(1, 0.7 + Math.random() * 0.6, 1);
    m.body.rotation.set(0, 0, 0);
    // Detailed wheels use their real axle pivots.
    const wheelSpeed = Math.hypot(c.vx, c.vz) * 0.6;
    if (m.detailedWheels && m.detailedWheels.length) {
      for (const wheel of m.detailedWheels) wheel.rotateOnAxis(m.detailedWheelAxis, wheelSpeed * dt);
    } else if (m.wheels && m.wheels.length) {
      for (const wheel of m.wheels) wheel.rotation.x += wheelSpeed * dt;
    }
  }
  ballMesh.position.set(ball.x, ball.y, ball.z);
  updateBallVisuals();
  if(ball.q)ballMesh.quaternion.fromArray(ball.q);
  const sp = Math.hypot(ball.vx, ball.vz);
  if (state === 'play' && Math.hypot(sp, ball.vy) > 26) emit(ball.x, ball.y, ball.z, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 0.4, 0.3, 0.9, 0.8);
  for (const p of pads) {
    const active = p.t <= 0;
    p.mesh.material.opacity = active ? 0.9 : 0.12;
    p.ring.material.opacity = active ? 0.95 : 0.08;
    p.core.material.opacity = active ? 0.5 : 0.05;
    p.group.visible = active || p.t > 0;
  }
  stepParts(dt); tickGoalEffects(dt); updateMiniCrowd(dt); drawMini();
  goalAnthems.sync({state,paused,muted,master:gameVolume,volume:anthemVolume,replayId:replayAnthemToken,replayTrack:replayAnthemTrack,
    allowPreview:state==='menu'&&$('menu').dataset.panel==='effects',celebrating:trainingMode&&trainingGoals>0});
  syncAudioControls();
  const localCarIndex=onlineMode?.role==='guest'?1:0;
  sfx.update(cars[localCarIndex], state === 'play' || state === 'replay');
  const splitActive = !trainingMode && localTwoPlayer && state !== 'menu' && state !== 'over';
  document.body.classList.toggle('split-screen', splitActive);
  // During a replay, follow the player who scored instead of always following P1.
  if (state === 'menu') {
    const preview=cars[0];
    const showingGoal=performance.now()<goalPreviewUntil;
    document.body.classList.toggle('goal-preview',showingGoal);
    cars.forEach(c=>{c.mesh.root.visible=false;});
    ballMesh.visible=false;
    if(!showingGoal)document.body.classList.remove('preview-fullscreen');
    const shift=document.body.classList.contains('preview-fullscreen')?0:innerWidth>700?.19:showingGoal?.22:0;
    camera.setViewOffset(innerWidth,innerHeight,-innerWidth*shift,0,innerWidth,innerHeight);
    if(showingGoal){
      const previewDistance=Math.max(34,18/(Math.tan(31*Math.PI/180)*(innerWidth/innerHeight)));
      camera.position.set(1.5,10,HL-previewDistance);camera.lookAt(0,8,HL-1);camera.fov=62;
    }else if(lobbyArenaTour){
      const orbit=performance.now()*.000075;
      camera.position.set(Math.sin(orbit)*153,67,Math.cos(orbit)*177);camera.lookAt(0,7,0);camera.fov=65;
    }else{
      if(preview){
        preview.mesh.root.visible=true;preview.mesh.root.position.set(28,.55,0);
        preview.mesh.root.rotation.set(0,Math.PI*.64+Math.sin(performance.now()*.0003)*.3,0);preview.mesh.flame.visible=false;
      }
      camera.position.set(36,3.4,10);camera.lookAt(28,1,0);camera.fov=48;
    }
    camera.updateProjectionMatrix();
  } else if (state === 'over') {
    camera.clearViewOffset();
    // Hold a close, centred camera on the straight winning lineup.
    const winTeam = score[0] === score[1] ? null : score[1] > score[0];
    cars.forEach(c => { c.mesh.root.visible = winTeam !== null && !!c.team === winTeam && c.demoTimer <= 0; });
    ballMesh.visible = false;
    camera.position.set(0, 6.5, winTeam ? -24 : 24);
    camera.lookAt(0, 1.15, winTeam ? -15 : 15);
    camera.fov = 48; camera.updateProjectionMatrix();
  } else if (state === 'goal' && goalCameraView) {
    // A bot or long shot can score far from the player's chase camera.
    // Give the complete 3D celebration a clear three-quarter goal view.
    camera.clearViewOffset();
    cars.forEach(c=>{c.mesh.root.visible=c.demoTimer<=0;});ballMesh.visible=false;
    const age=(performance.now()-goalCameraView.startedAt)/1000;
    camera.position.set(goalCameraView.x+12+Math.sin(age*.5)*3,11,goalCameraView.end*(HL-34));
    camera.lookAt(goalCameraView.x,goalCameraView.y+1,goalCameraView.z);camera.fov=68;camera.updateProjectionMatrix();
  } else {
    camera.clearViewOffset();
    cars.forEach(c => { c.mesh.root.visible = c.demoTimer <= 0; }); ballMesh.visible = true;
    updateCam(dt, state === 'replay' ? replayCameraCarIndex : localCarIndex);
    if (splitActive) updateCam(dt, state === 'replay' ? replayCameraCarIndex : mode, camera2, cam2);
  }
  $('s0').textContent = score[0]; $('s1').textContent = score[1];
  const s = Math.ceil(clock); $('clock').textContent = trainingMode ? 'FREE PLAY' : ot ? 'OT' : Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const flightHint=$('flightHint');
  if(flightHint){
    flightHint.hidden=!['play','kick'].includes(state);
    const manual=keyboardFlightMode==='manual';
    const own=cars[localCarIndex];const tipped=!!own?.bodyContact && !own.ground;
    const text=tipped?'CAR TIPPED · Press SPACE to right the car · Q/E rolls manually':manual?'MANUAL AERIAL · Hold SPACE, raise nose with S, then SHIFT · W pitches down'
      :'ASSISTED AERIAL · Hold SPACE to jump, then hold SHIFT to climb · K/I aim · Q/E roll';
    if(flightHint.textContent!==text)flightHint.textContent=text;
  }
  const b = trainingMode ? 100 : cars[localCarIndex].boost;
  $('bt').textContent = trainingMode ? '∞' : Math.round(b);
  $('bf').style.width = '84%';
  $('bf').style.background = 'conic-gradient(' + (b <= 20 ? '#ff7547' : '#ffba52') +
    ' ' + (b * 3.6) + 'deg, rgba(12,29,59,.65) ' + (b * 3.6) + 'deg)';
  const p2 = cars[mode];
  const bf2 = $('bf2'), bt2 = $('bt2');
  if (bf2 && bt2) { const b2 = p2 ? p2.boost : 0; bf2.style.width = Math.round(clamp(b2, 0, 100)) + '%'; bt2.textContent = Math.round(b2); bf2.style.background = b2 > 66 ? '#ffd35a' : '#ff8a1f'; }
  const pHUD = $('player'); if (pHUD) pHUD.textContent = onlineMode?cars[localCarIndex].displayName:playerName;
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

// ---------- private online 1v1 ----------
let onlineRemoteInput={},onlineInputAt=0,onlineInputSeq=-1,onlineSendTime=0,onlineSnapshot=null,onlineSaved=null;
const onlineRoom=new RocketRooms.Room({
 onStatus(info){
  $('onlineStatus').textContent=info.message;
  $('onlineRoomCode').textContent=info.code||'';
  $('onlineInvite').hidden=!info.code||!['waiting','connecting','connected'].includes(info.state);
  $('onlineCreate').disabled=$('onlineJoin').disabled=['waiting','connecting','connected'].includes(info.state);
 },
 onStart:beginOnlineMatch,
 onData(packet){
  if(!onlineMode)return;
  if(onlineMode.role==='host'){
   if(packet.type==='input'&&Number.isSafeInteger(packet.seq)&&packet.seq>onlineInputSeq){
    const next=RocketRooms.controls(packet.controls);next.jump=state==='play'&&(next.jump||onlineRemoteInput.jump);
    onlineRemoteInput=next;onlineInputSeq=packet.seq;onlineInputAt=performance.now();
   }else if(packet.type==='skip'&&state==='replay')replayElapsed=RocketReplay.duration(replayFrames);
  }else if(packet.type==='snapshot'&&validOnlineSnapshot(packet))onlineSnapshot=packet;
 },
 onClose(message){leaveOnline(message);}
});
function localOnlineProfile(){return {name:$('name').value,car:playerCarModel};}
$('onlineCreate').addEventListener('click',()=>{sfx.init();onlineRoom.create(localOnlineProfile());});
$('onlineJoin').addEventListener('click',()=>{sfx.init();onlineRoom.join($('onlineCode').value,localOnlineProfile());});
$('onlineCode').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('onlineJoin').click();}});
for(const id of ['onlineLeave','onlineMatchLeave'])$(id).addEventListener('click',()=>leaveOnline('Room closed. Create or join another room.'));
$('onlineCopy').addEventListener('click',async()=>{
 const invite=new URL(location.href);invite.searchParams.set('room',onlineRoom.code);invite.searchParams.delete('car');
 try{await navigator.clipboard.writeText(invite.href);$('onlineStatus').textContent='Invite copied. Send it to your friend.';}
 catch(_){$('onlineStatus').textContent='Copy this code and send it to your friend: '+onlineRoom.code;}
});
const invitedCode=RocketRooms.normalize(new URLSearchParams(location.search).get('room'));
if(RocketRooms.validCode(invitedCode)){$('onlineCode').value=invitedCode;$('onlineStatus').textContent='Your friend invited you. Press JOIN ROOM to connect.';selectLobbyPanel('play');}
function beginOnlineMatch(session){
 onlineSaved={mode,diff,playerName,player2Name,localTwoPlayer,goalExplosionStyle};
 onlineMode=session;onlineStarting=true;mode=1;diff=0;localTwoPlayer=false;
 try{start(false);}finally{onlineStarting=false;}
 const profiles=session.role==='host'?[session.local,session.remote]:[session.remote,session.local];
 for(const c of cars)scene.remove(c.mesh.root);
 cars=profiles.map((p,i)=>{const c=mkCar(i,0,false,p.car);c.displayName=p.name;c.nexto=false;return c;});
 playerName=profiles[0].name;player2Name=profiles[1].name;
 kickoff();state='kick';cd=3;replayCameraCarIndex=0;onlineSnapshot=null;onlineInputSeq=-1;onlineRemoteInput={};onlineSendTime=0;
 $('onlineMatchBar').hidden=false;$('onlineMatchLabel').textContent='ROOM '+onlineRoom.code+' · '+(session.role==='host'?'BLUE':'ORANGE');
 $('quickPlayButton').hidden=true;
 if(session.role==='host')onlineMode.backgroundTimer=setInterval(()=>{
  if(document.hidden&&onlineBackgroundFrame)onlineBackgroundFrame(performance.now(),true);
 },50);
 clearHeldInput();
}
function leaveOnline(message){
 const wasOnline=!!onlineMode,hadRoom=onlineRoom.state!=='idle';
 if(onlineMode)clearInterval(onlineMode.backgroundTimer);
 onlineMode=null;onlineSnapshot=null;onlineRemoteInput={};onlineRoom.close();
 $('onlineMatchBar').hidden=true;$('onlineInvite').hidden=true;$('onlineCreate').disabled=$('onlineJoin').disabled=false;$('quickPlayButton').hidden=false;
 if(onlineSaved){({mode,diff,playerName,player2Name,localTwoPlayer,goalExplosionStyle}=onlineSaved);onlineSaved=null;}
 if(wasOnline){
  paused=false;state='menu';trainingMode=false;clearHeldInput();goalEffects.clear();goalAnthems.stop();
  $('victory').style.display='none';$('victory').dataset.shown='';document.body.classList.remove('victory-screen');
  $('menu').style.display='grid';$('msg').textContent='';$('goalBy').textContent='';$('goalSpeed').textContent='';
  buildTeams();kickoff();resize();
 }
 if(message||hadRoom)$('onlineStatus').textContent=message||'Room closed.';
}
function remoteOnlineControls(){
 if(performance.now()-onlineInputAt>300){onlineRemoteInput={};return RocketRooms.controls();}
 const input={...onlineRemoteInput};onlineRemoteInput.jump=false;return input;
}
const NETWORK_MOTION=['x','y','z','vx','vy','vz','yaw','pitch','roll','boost','demoTimer','fl','engineLoad'];
const NETWORK_STATS=['goals','assists','shots','saves','clears','shotsOnGoal','demos'];
function onlineMotion(c){const p={};for(const key of NETWORK_MOTION)p[key]=Number.isFinite(c[key])?c[key]:0;p.q=getCarOrientation(c).toArray();p.ground=!!c.ground;return p;}
function validOnlineSnapshot(p){
 const numbers=o=>o&&['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(o[k])&&Math.abs(o[k])<1e6);
 const quaternion=q=>Array.isArray(q)&&q.length===4&&q.every(v=>Number.isFinite(v)&&Math.abs(v)<=1.001)&&Math.hypot(...q)>.99;
 return ['kick','play','goal','replay','over'].includes(p.state)&&Number.isFinite(p.clock)&&p.clock>=0&&p.clock<=MATCH&&
  Number.isFinite(p.cd)&&Array.isArray(p.score)&&p.score.length===2&&p.score.every(v=>Number.isSafeInteger(v)&&v>=0)&&
  Array.isArray(p.cars)&&p.cars.length===2&&p.cars.every(c=>numbers(c)&&quaternion(c.q)&&NETWORK_MOTION.every(k=>Number.isFinite(c[k])))&&
  numbers(p.ball)&&quaternion(p.ball.q)&&Array.isArray(p.pads)&&p.pads.length===pads.length&&p.pads.every(v=>Number.isFinite(v)&&v>=0&&v<30)&&
  Number.isSafeInteger(p.anthem)&&p.anthem>=0&&Number.isFinite(p.speed)&&Number.isFinite(p.elapsed)&&
  Number.isInteger(p.scorer)&&p.scorer>=0&&p.scorer<2;
}
function sendOnlineSnapshot(dt){
 onlineSendTime+=dt;if(onlineSendTime<1/30)return;onlineSendTime=0;
 if(state==='menu'){leaveOnline('You left the match.');return;}
 onlineRoom.send({type:'snapshot',state,score:[...score],clock,cd,ot,ball:{...ball,q:ball.q||[0,0,0,1]},cars:cars.map(onlineMotion),pads:pads.map(p=>p.t),
  anthem:replayAnthemToken,track:replayAnthemTrack,style:goalExplosionStyle,speed:goalSpeedMph,scorer:replayCameraCarIndex,scorerName:goalScorerText,elapsed:replayElapsed,stats:playerStats,
  message:$('msg').textContent});
}
function onlineFrame(dt){
 if(!onlineMode)return;
 if(state==='menu'){leaveOnline('You left the match.');return;}
 if(onlineMode.role!=='guest')return;
 onlineRoom.send({type:'input',seq:onlineMode.seq=(onlineMode.seq||0)+1,controls:playerCtl()});
 const p=onlineSnapshot;if(!p)return;
 const snap=state!==p.state;
 state=p.state;score=[...p.score];clock=p.clock;cd=p.cd;ot=!!p.ot;replayElapsed=p.elapsed;
 if(Array.isArray(p.stats)&&p.stats.length===2&&p.stats.every(s=>s&&NETWORK_STATS.every(k=>Number.isFinite(s[k])&&s[k]>=0)))
  playerStats=p.stats.map(s=>Object.fromEntries(NETWORK_STATS.map(k=>[k,s[k]])));
 cars.forEach((c,i)=>{
  const target=p.cars[i],blend=snap||Math.hypot(c.x-target.x,c.y-target.y,c.z-target.z)>12?1:1-Math.exp(-24*dt);
  for(const k of ['x','y','z'])c[k]+=(target[k]-c[k])*blend;
  for(const k of NETWORK_MOTION)if(!['x','y','z'].includes(k))c[k]=target[k];
  const q=new THREE.Quaternion().fromArray(target.q);c.airQuat=getCarOrientation(c).clone().slerp(q,blend);c.ground=!!target.ground;
 });
 const blend=snap||Math.hypot(ball.x-p.ball.x,ball.y-p.ball.y,ball.z-p.ball.z)>12?1:1-Math.exp(-24*dt);
 for(const k of ['x','y','z'])ball[k]+=(p.ball[k]-ball[k])*blend;
 for(const k of ['vx','vy','vz','wx','wy','wz'])ball[k]=Number.isFinite(p.ball[k])?p.ball[k]:0;
 ball.q=[...p.ball.q];pads.forEach((pad,i)=>pad.t=p.pads[i]);
 goalSpeedMph=p.speed;goalScorerText=String(p.scorerName||'PLAYER').slice(0,12);replayCameraCarIndex=p.scorer;
 replayAnthemToken=p.anthem;replayAnthemTrack=RocketGoalAnthems.TRACKS[p.track]?p.track:'off';
 if(Object.hasOwn(GOAL_EFFECT_DATA,p.style))goalExplosionStyle=p.style;
 $('msg').textContent=String(p.message||'').slice(0,100);$('msg').classList.toggle('replay-title',state==='replay');
 $('goalBy').textContent=['goal','replay'].includes(state)?'Goal by '+goalScorerText+'!!!':'';
 $('goalSpeed').textContent=['goal','replay'].includes(state)?'GOAL SPEED · '+goalSpeedMph.toFixed(1)+' MPH':'';
 if(snap&&state==='goal'){goalExplosion(score[0]>onlineMode.lastBlue?0:1);cheerMiniCrowd(score[0]>onlineMode.lastBlue?0:1);}
 onlineMode.lastBlue=score[0];
 if(state==='over')showVictoryScreen();
}

// ---------- loop ----------
buildTeams(); kickoff(); pick('mode', 2); pick('diff', 1);
loadDetailedCars();
if(CAR_MODELS.some(car=>car.name===new URLSearchParams(location.search).get('car')))selectLobbyPanel('garage');
window.rocketArena = {
  ball, physics: PHYSICS_TUNING,
  get cars() { return cars; },
  get nextoStatus(){return {state:nextoAI.status,ready:nextoAI.ready,inferences:nextoAI.inferenceCount,lastInferenceMs:nextoAI.lastInferenceMs};},
  get score() { return score; },
  get state() { return state; },
  get onlineStatus(){return {state:onlineRoom.state,role:onlineMode?.role||onlineRoom.role,code:onlineRoom.code};},
  // Read-only references for browser-level stadium regression checks.
  get stadium() { return scene.getObjectByName('Rocket Ball Championship Arena'); },
  get lakesideScenery() { return lakesideScenery; },
  get pitch() { return pitchMesh; },
  get pads() { return pads; },
  get goalEffectCount() { return activeGoalEffects.length; },
  get goalEffects() { return activeGoalEffects.map(f=>({style:f.style,age:f.age,duration:f.duration,signature:[...f.signature],group:f.group})); },
  get replayStatus(){const frames=state==='play'?replayHistory:replayFrames;return {elapsed:replayElapsed,duration:RocketReplay.duration(frames),frames:frames.length};},
  get anthemStatus(){return goalAnthems.status;},
  get audioStatus(){return {state:carAudio.ac?.state||'uninitialised',engineGain:carAudio.engineGain?.gain.value||0,boostGain:carAudio.boostGain?.gain.value||0};},
  get goalSpeedMph(){return goalSpeedMph;},
  get cameraView(){return {position:camera.position.toArray(),target:[cam.lx,cam.ly,cam.lz],verticalFov:camera.fov,configuredFov:cameraSettings.fov,ballCam};},
  get renderStats() { return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}; },
  get ballShadow() { return ballGroundShadow; },
  get ballTrail() { return ballTrail; },
  get miniCrowd() { return miniCrowd; },
  previewGoalExplosion(style) {
    if(Object.hasOwn(GOAL_EFFECT_DATA,style)){
      goalExplosionStyle=style;
      if(explosionInput)explosionInput.value=style;
      try{localStorage.setItem('rocketArenaExplosionV1',style);}catch(_){}
      goalExplosion(false,true);
    }
  }
};
let last = performance.now();
(function loop(now,background=false) {
  onlineBackgroundFrame=loop;
  // Match clocks follow elapsed time even when software rendering is slow.
  // Keep the physics step bounded independently to avoid unstable collisions.
  const wallDt = Math.max(0, (now - last) / 1000); last = now;
  const frameDt = Math.min(0.25, wallDt);
  pollControllers();
  // Physics remains deterministic at 120Hz. The clock, countdown, goal intro,
  // and replay still track real elapsed time when the GPU is running slowly.
  if (typeof window.__rocketPhysicsAccumulator !== 'number') window.__rocketPhysicsAccumulator = 0;
  if (!paused && onlineMode?.role!=='guest') {
    window.__rocketPhysicsAccumulator = Math.min(0.25, window.__rocketPhysicsAccumulator + frameDt);
    const fixedDt = 1 / 120;
    let steps = 0;
    while (window.__rocketPhysicsAccumulator >= fixedDt && steps < 30) {
      update(fixedDt);
      window.__rocketPhysicsAccumulator -= fixedDt;
      steps++;
    }
    const skippedTime = Math.max(0, wallDt - steps * fixedDt);
    if (skippedTime > 0) {
      if (state === 'kick' || state === 'goal') cd -= skippedTime;
      else if (state === 'replay') replayElapsed += skippedTime;
      else if (state === 'play' && !trainingMode && !ot) {
        clock = Math.max(0, clock - skippedTime);
        if (clock <= 0) {
          if (score[0] === score[1]) ot = true;
          else { state = 'over'; showVictoryScreen(); }
        }
      }
    }
  } else window.__rocketPhysicsAccumulator = 0;
  onlineFrame(frameDt);
  render(frameDt);
  if(onlineMode?.role==='host')sendOnlineSnapshot(frameDt);
  if(!background)requestAnimationFrame(loop);
})(last);
})();
