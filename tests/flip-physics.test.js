'use strict';
// Run with: node tests/flip-physics.test.js
// Tests the real Rocket Ball simulation without WebGL or browser globals.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const THREE=require('../lib/three.min.js');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function section(from,to){
 const start=source.indexOf(from),end=source.indexOf(to,start+from.length);
 assert.ok(start>=0&&end>start,'Missing source region '+from);
 return source.slice(start,end);
}
function extractFunction(name){
 const start=source.indexOf('function '+name+'(');
 assert.ok(start>=0,'Missing function '+name);
 const brace=source.indexOf('{',start);
 let depth=0;
 for(let i=brace;i<source.length;i++){
   if(source[i]==='{')depth++;
   else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw new Error('Unclosed function '+name);
}
const funcs=['getCarOrientation','getCarForward','aerialControl',
 'applyDirectionalBoost','groundThrottleAcceleration','stepGroundForward',
 'groundSteeringCurvature','carSurfaceContact','updateCarSurfaceFrame',
 'snapCarToContact','stepCar'];

const code=[
 'const HW=80,HL=104,GW=15,GH=10.5,CEIL=44,CH=14,BR=91.25/50;',
 section('const PHYSICS_TUNING = {','const MATCH ='),
 section('const WALL_RAMP_WIDTH','let pitchMesh'),
 section('const DEFAULT_CONTROL_BINDINGS =','try {'),
 'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1),CAR_CLEARANCE=.55;',
 'const cars=[],pads=[],physicsStyle="standard",trainingMode=false,emitBoost=()=>{};',
 'const keys={};let keyboardFlightMode="assist";const controllerForPlayer=()=>null,buttonValue=()=>0;const controllerDeadZone=.12,controllerSteeringSensitivity=1.25,controllerAerialSensitivity=1.35;',
 ...funcs.map(extractFunction),extractFunction('playerActions'),
 `return {keys,read:()=>playerActions('p1'),step:stepCar,mode:value=>keyboardFlightMode=value,forward:getCarForward,orientation:getCarOrientation,rotate:aerialControl};`
].join('\n');
const sim=new Function('THREE','assert','RocketArenaNet','RocketMechanics',code)(THREE,assert,require('../lib/arena-network'),require('../lib/advanced-mechanics'));
function car(){return {x:0,y:.55,z:0,yaw:0,pitch:0,roll:0,vx:0,vy:0,vz:0,ground:true,
 demoTimer:0,demoCooldown:0,wallRide:false,wallVerticalAxis:null,wallDetachTimer:0,
 airQuat:null,airOmega:null,surfaceQuat:null,surfaceNormal:null,surfaceForward:null,
 flip:0,jumps:0,jt:0,boost:100,ai:false,team:0,mesh:{root:{userData:{},visible:true}}};}

function airCar(pitch=0){
 const c=car();Object.assign(c,{y:18,ground:false,jumps:1,jt:.1,
   airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch)});return c;
}
function tick(c,overrides={},dt=1/120){sim.step(c,{throttle:0,steer:0,pitch:0,roll:0,jump:false,jumpHeld:false,boost:false,...overrides},dt);}
// A dodge accelerates along the field, even while the car is pitched up.
const tilted=airCar(-Math.PI*.4);tilted.vy=-6;
tick(tilted,{jump:true,dodge:[1,0]});
assert(tilted.vy< -5.9,'A forward dodge must not inject vertical launch speed into a falling tilted car');
assert(tilted.vz>9&&tilted.vz<11,'A stationary dodge should add about 500 UU/s in its horizontal direction');
// Keeping the same direction held must not layer a second rotation on the flip.
for(const [f,s] of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]){
 const idle=airCar(),held=airCar();
 tick(idle,{jump:true,dodge:[f,s]});tick(held,{jump:true,dodge:[f,s]});
 let steps=0;
 while(idle.flip>0&&steps++<150){
   tick(idle);tick(held,{pitch:f,steer:s,airYaw:s});
   assert(sim.orientation(idle).angleTo(sim.orientation(held))<.025,
     'Held flip direction must not create extra pitch/yaw during the dodge: '+[f,s]);
 }
 assert(steps<150,'Dodge must terminate');
 assert(sim.orientation(idle).angleTo(new THREE.Quaternion())<.025,'Uncancelled dodge must finish without a residual half flip');
}
// Pulling against a front flip cancels its pitch rotation.
const normal=airCar(),cancelled=airCar();
tick(normal,{jump:true,dodge:[1,0]});tick(cancelled,{jump:true,dodge:[1,0]});
for(let i=0;i<35;i++){tick(normal);tick(cancelled,{pitch:-1});}
assert(sim.orientation(normal).angleTo(sim.orientation(cancelled))>.7,'Opposite pitch must allow a flip cancel');
// An exhausted boost button must not automatically stand the car up on its tail.
const empty=airCar();empty.boost=0;
for(let i=0;i<40;i++)tick(empty,{boost:true,keyboardFlightAssist:true});
assert(Math.abs(sim.forward(empty).y)<.01,'No boost must mean no automatic pitch-up');
// Assisted flight must defer to a rolled/inverted pose instead of pitching along the wrong axis.
const inverted=airCar();inverted.airQuat.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
for(let i=0;i<35;i++)tick(inverted,{boost:true,keyboardFlightAssist:true});
assert(Math.abs(sim.forward(inverted).y)<.01,'Assistance must not pitch an inverted car into the floor');
console.log('PASS: horizontal dodge momentum, stable forward/back/side/diagonal flips, flip cancellation, empty-boost and inverted assist guards');

for(const hz of [60,120,240]){
 const c=airCar();tick(c,{jump:true,dodge:[1,0]},1/hz);
 let steps=0;while(c.flip>0&&steps++<hz)tick(c,{},1/hz);
 assert(sim.orientation(c).angleTo(new THREE.Quaternion())<.002,'Flip endpoint must be consistent at '+hz+' Hz');
 assert(Math.abs(c.vy+(steps+1)*13/hz)<.15,'Flip must preserve vertical physics without a hidden upward impulse');
}
const landing=airCar();Object.assign(landing,{y:.58,vy:-1,jumps:2,flip:.25,flipAxis:new THREE.Vector3(1,0,0)});
tick(landing);
assert(landing.ground&&landing.flip===0&&landing.flipAxis===null,'Tyre landing must end the dodge, without a cosmetic ground flip');
const tail=airCar(-Math.PI/2);Object.assign(tail,{y:2,vx:12,vy:0,jumps:2});
for(let i=0;i<150;i++)tick(tail);
assert(tail.ground,'A car contacting the floor on its tail must settle even while sliding');
console.log('PASS: flip endpoints at 60/120/240 Hz, landing cancels residual spin, moving tail-contact recovery');
