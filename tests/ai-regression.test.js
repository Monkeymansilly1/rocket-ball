'use strict';
// Regression suite for the real bot controller + current tyre physics.
// Run: node tests/ai-regression.test.js
const assert=require('node:assert/strict');
const fs=require('node:fs');
const THREE=require('../lib/three.min.js');
const source=fs.readFileSync('game.js','utf8');

function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0 && b>a,'Missing game.js section '+start);
 return source.slice(a,b);
}
function functionSource(name){
 const a=source.indexOf('function '+name+'(');
 assert(a>=0,'Missing '+name);
 const brace=source.indexOf('{',a);
 let depth=0;
 for(let i=brace;i<source.length;i++){
   if(source[i]==='{')depth++;
   if(source[i]==='}' && --depth===0)return source.slice(a,i+1);
 }
 throw new Error('Unclosed '+name);
}
const funcs=['getCarOrientation','getCarForward','aerialControl',
 'applyDirectionalBoost','groundThrottleAcceleration','stepGroundForward',
 'groundSteeringCurvature','carSurfaceContact','updateCarSurfaceFrame',
 'snapCarToContact','stepCar','aiCtl'];
const sandbox=[
 'const HW=80,HL=104,GW=15,GH=10.5,CEIL=44,CH=14,BR=91.25/50;',
 section('const PHYSICS_TUNING = {','const MATCH ='),
 section('const WALL_RAMP_WIDTH','let pitchMesh'),
 section('const SKILL = [','function mkCar'),
 'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1),CAR_CLEARANCE=.55;',
 'const wrap=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};',
 'const cars=[],pads=[],pred=[],ball={x:28,y:91.25/50,z:28,vx:0,vy:0,vz:0};',
 'let diff=1;',
 'const physicsStyle="standard",trainingMode=false,emitBoost=()=>{},showGameEvent=()=>{};',
 ...funcs.map(functionSource),
 `
const dt=1/120;
function bot(x,z,yaw,team=0) {
 const c={x,y:.55,z,yaw,pitch:0,roll:0,vx:0,vy:0,vz:0,ground:true,
  demoTimer:0,demoCooldown:0,ballHitCooldown:0,airTouchCooldown:0,
  ceilingRide:false,wallRide:false,wallVerticalAxis:null,
  wallVerticalSign:0,wallDetachTimer:0,surfaceForward:null,
  surfaceNormal:null,surfaceQuat:null,airQuat:null,airOmega:null,
  flip:0,jumps:0,jt:0,boost:100,fl:0,ai:true,team,
  aiCd:10,wait:0,rev:0,stuckT:0,errT:100000,err:0,baseCap:1,
  mesh:{root:{userData:{},visible:true}}};
 cars.push(c);
 return c;
}
function step(c){
 const ct=aiCtl(c,dt);
 stepCar(c,ct,dt);
 for(const k of ['x','y','z','vx','vy','vz','yaw'])
  assert(Number.isFinite(c[k]),'AI car became non-finite: '+k);
 return ct;
}
const pursuer=bot(0,-48,0);
const aim=aiCtl(pursuer,dt);
assert(aim.steer>0.1,
  'Target on car right must command POSITIVE ground steering');
const startDist=Math.hypot(ball.x-pursuer.x,ball.z-pursuer.z);
for(let i=0;i<480;i++)step(pursuer);
const finishDist=Math.hypot(ball.x-pursuer.x,ball.z-pursuer.z);
assert(pursuer.x>3,'Bot failed to steer toward right-hand ball: x='+pursuer.x);
assert(finishDist<startDist-18,
 'Bot failed to approach stationary ball: '+startDist+' -> '+finishDist);
assert(pursuer.ground,'Bot left the ground chasing an ordinary ball');
cars.length=0;

// Orange cars face the other way and must also navigate toward the ball.
const orange=bot(0,48,Math.PI,1);
Object.assign(ball,{x:-28,y:91.25/50,z:-28});
const orangeAction=aiCtl(orange,dt);
assert(orangeAction.steer>0.1,
 'Orange bot facing negative Z steered away from left-side target');
for(let i=0;i<460;i++)step(orange);
assert(orange.x < -3,
 'Orange bot did not turn towards left-side ball, x='+orange.x);
cars.length=0;

// Steep target behind car: must have an intentional recovery turn.
const reversing=bot(0,-25,0);
Object.assign(ball,{x:3,z:-77});
const reversed=aiCtl(reversing,dt);
assert(reversed.throttle<0,
 'Bot does not reverse when its target is directly behind');

// Aerial steering must use positive yaw and a real pitch input, not reverse
// throttle (reverse in flight creates a force unrelated to rotating).
cars.length=0;
const flyer=bot(0,0,0);
Object.assign(flyer,{ground:false,aerial:true,y:12,airQuat:new THREE.Quaternion()});
Object.assign(ball,{x:13,z:16,y:22});
const aerial=aiCtl(flyer,dt);
assert(aerial.airYaw>0,
 'Airborne bot yaw remains inverted toward a right-hand ball');
assert(aerial.pitch<0,
 'Airborne bot must command nose-up pitch for higher ball');
assert.equal(aerial.throttle,0,
 'Bot must not use backwards throttle as the pitch control');
// Learned-policy opponents must use the same finite boost resource as players.
const learned=bot(0,0,0);learned.nexto=true;learned.boost=0;
for(let i=0;i<120;i++)stepCar(learned,{throttle:0,steer:0,jump:false,jumpHeld:false,boost:false},dt);
assert.equal(learned.boost,0,'Nexto must not receive the scripted bots boost regeneration');
console.log('PASS: AI navigation, steering directions, speed control, reverse recovery and aerial targeting');
`
].join('\n');
new Function('THREE','assert',sandbox)(THREE,assert);
