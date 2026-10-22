'use strict';
// Run: node tests/physics-smoke.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');

const src = fs.readFileSync('game.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
new vm.Script(src, { filename: 'game.js' });
for (const id of [
  'playBtn', 'freePlayBtn', 'trainingTools', 'trainingResetBall', 'trainingPass',
  'trainingLaunch', 'trainingResetCar', 'settingCameraFov',
  'settingCameraDistance', 'settingCameraHeight', 'settingGraphics'
]) assert(html.includes('id="' + id + '"'), 'Missing UI element ' + id);

function extract(name) {
  const start = src.indexOf('function ' + name + '(');
  assert(start >= 0, 'Missing ' + name);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw Error('Incomplete function ' + name);
}
const functions = [
  extract('rampProfile'), extract('arenaRampAt'),
  extract('getCarOrientation'), extract('getCarForward'),
  extract('aerialControl'), extract('applyDirectionalBoost'),
  extract('clampBallMotion'), extract('ballSurfaceImpulse'),
  extract('resolveBallWall'), extract('stepBall'), extract('hitBall')
].join('\n');
const bootstrap = [
  'const THREE = arguments[0];',
  'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1);',
  'const BR=2.4,HW=80,HL=104,GW=15,GH=10.5,GD=14,CH=14,CEIL=44,WALL_RAMP_HEIGHT=9.5,WALL_RAMP_WIDTH=24;',
  'const PHYSICS_TUNING_AIR={PITCH_TORQUE_SPEED:3.4,YAW_TORQUE_SPEED:2.85,ROLL_TORQUE_SPEED:4.2,AIR_BOOST_FORCE:43,BOOST_FORCE:19.83};',
  'const PHYSICS_TUNING = {BALL_GRAVITY_FORCE:24,BALL_DRAG_REFERENCE:.03,BALL_RESTITUTION:.82,BALL_WALL_RESTITUTION:.84,BALL_FLOOR_RESTITUTION:.78,BALL_FRICTION_REFERENCE:.35,BALL_MAX_ANGULAR_SPEED:6,MAX_BALL_SPEED:80,BALL_MASS_REFERENCE:30,CAR_MASS_REFERENCE:180,CAR_BALL_RESTITUTION:0,PITCH_TORQUE_SPEED:3.4,YAW_TORQUE_SPEED:2.85,ROLL_TORQUE_SPEED:4.2,AIR_BOOST_FORCE:43,BOOST_FORCE:19.83};',
  'const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));',
  'const ball={x:0,y:12.4,z:0,vx:0,vy:-20,vz:0,wx:0,wy:0,wz:0,onRamp:false};',
  'let lastTouch=null,previousTouch=null;',
  'const playerStats=[{goals:0,assists:0,shots:0,saves:0,clears:0}];',
  'const cars=[]; const eventCooldown={}; const t=0,state="play";',
  'const showGameEvent=()=>{},sparks=()=>{};',
  'const goal=()=>{throw Error("Unexpected goal in physics test")};',
  'const rampEase=t=>t*t*(3-2*t);'
].join('\n') + '\n' + functions + '\nreturn {ball,stepBall,hitBall,resolveBallWall,arenaRampAt,getCarForward,aerialControl,applyDirectionalBoost,cars};';
const {ball,stepBall,hitBall,resolveBallWall,arenaRampAt,getCarForward,aerialControl,applyDirectionalBoost,cars} = new Function(bootstrap)(THREE);

for(let i=0;i<240;i++)stepBall(1/120);
assert(ball.y >= 2.399 && ball.y < 20 && Number.isFinite(ball.y),'Floor contact unstable');
Object.assign(ball,{x:77.45,y:20,z:0,vx:38,vy:0,vz:0,onRamp:false});
for(let i=0;i<10;i++)stepBall(1/120);
assert(ball.x<=77.61&&ball.vx<=0,'Side-wall bounce failed');
Object.assign(ball,{x:0,y:3,z:0,vx:1000,vy:0,vz:0});
stepBall(1/120);
assert(Math.hypot(ball.vx,ball.vy,ball.vz)<=80.0001,'Ball speed limit exceeded');

const car={x:0,y:.55,z:0,vx:0,vy:0,vz:30,yaw:0,pitch:0,hit:1.7,team:0,fl:0,flip:0,demoTimer:0,ballHitCooldown:0};
cars.push(car);
Object.assign(ball,{x:0,y:.55,z:4,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0});
hitBall(car);
const first=ball.vz;
assert(first>1&&first<=80,'Car-ball impulse failed');
assert(car.ballHitCooldown>0,'Shot cooldown missing');
Object.assign(ball,{x:0,y:.55,z:4,vx:0,vy:0,vz:0});
hitBall(car);
assert(ball.vz<first,'Repeated contact gained excessive power');

// A ball travelling outward at the top of a ramp must continue UP the
// vertical wall instead of ricocheting directly back onto the pitch.
const wallX=80-2.4-0.05;
Object.assign(ball,{x:wallX,y:2.4+arenaRampAt(wallX,0).height+0.25,z:0,
  vx:24,vy:1,vz:0,onRamp:true});
stepBall(1/120);
assert(ball.vx===0 && ball.vy>18 && ball.onWall,'Real ramp-to-wall ball transfer failed');
for(let i=0;i<35;i++)stepBall(1/120);
assert(ball.y>14,'The ball did not rise after transferring onto the wall');

// A pitched-up car must be able to hit a ball above its nose in 3D.
Object.assign(car,{x:0,y:7,z:0,vx:0,vy:22,vz:0,yaw:Math.PI/2,pitch:Math.PI/2,
  roll:0,ballHitCooldown:0,hitbox:{length:2.4,width:1.7,height:.75,forward:0,up:0}});
Object.assign(ball,{x:0,y:10.7,z:0,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0});
hitBall(car);
assert(ball.vy>6,'Pitched-up car failed to register a real aerial collision');
const pitchedNose=getCarForward({pitch:Math.PI/2,yaw:Math.PI/2,roll:0,airQuat:null});
assert(pitchedNose.y>.99 && Math.abs(pitchedNose.x)<.01,
  'Rendered nose did not face upward while pitched against the side wall');

// True air boost at a 45-60 degree pitch has to overcome gravity. In previous
// builds a car mathematically could not sustain flight, even at full boost.
const flyer={x:0,y:16,z:0,vx:0,vy:0,vz:0,pitch:Math.PI/3,yaw:0,
  roll:0,airQuat:null,airOmega:null};
for(let i=0;i<120;i++){
  flyer.vy-=28/120;
  applyDirectionalBoost(flyer,1/120,false);
}
assert(flyer.vy>7,'Nose-up aerial boost cannot counter gravity');
const before=getCarForward(flyer);
for(let i=0;i<70;i++)aerialControl(flyer,{throttle:-.5,steer:.2,roll:1},1/120);
assert(flyer.airQuat && Math.abs(flyer.airQuat.length()-1)<1e-6,
  'Air rotation lost normalized physical orientation');
assert(getCarForward(flyer).distanceTo(before)>.1,
  'Pitch/yaw inputs failed to change the actual boost direction');
console.log('PASS: syntax, training controls, floor, walls, ball speed cap, car-ball impacts');
