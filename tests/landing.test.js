'use strict';
// Run with: node tests/landing.test.js
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
 'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1),CAR_CLEARANCE=.55;',
 'const cars=[],pads=[],physicsStyle="standard",trainingMode=false,emitBoost=()=>{};',
 ...funcs.map(extractFunction),
 'return {step:stepCar,orientation:getCarOrientation};'
].join('\n');
const sim=new Function('THREE','assert','RocketArenaNet','RocketMechanics',code)(THREE,assert,require('../lib/arena-network'),require('../lib/advanced-mechanics'));
function tipped(roll,x=0,z=0){return {x,y:1.3,z,yaw:0,pitch:0,roll,vx:0,vy:0,vz:0,ground:false,
 demoTimer:0,demoCooldown:0,wallRide:false,wallVerticalAxis:null,wallDetachTimer:0,
 airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),roll),airOmega:null,
 surfaceQuat:null,surfaceNormal:null,surfaceForward:null,flip:0,jumps:2,jt:2,boost:34,ai:false,team:0,
 mesh:{root:{userData:{},visible:true},bodyBounds:{min:[-1.25,-.48,-2],max:[1.25,1,2]}}};}
function tick(car,overrides={}){sim.step(car,{throttle:0,steer:0,pitch:0,roll:0,jump:false,jumpHeld:false,boost:false,...overrides},1/120);}

for(const axis of ['pitch','roll'])for(const angle of [-65,-45,-20,20,45,65]){
 const c=tipped(0);c.y=4;c.vy=-8;c.vz=20;
 c.airQuat.setFromAxisAngle(new THREE.Vector3(axis==='pitch'?1:0,0,axis==='roll'?1:0),angle*Math.PI/180);
 let minimum=Infinity,groundAt=-1,maxStep=0,previousY=c.y;
 for(let frame=0;frame<360;frame++){
  tick(c);maxStep=Math.max(maxStep,Math.abs(c.y-previousY));previousY=c.y;
  if(c.ground&&groundAt<0){groundAt=frame;assert(c.vz>18,'Landing must preserve forward momentum');}
  const q=sim.orientation(c);
  for(const x of [-1.25,1.25])for(const y of [-.48,1])for(const z of [-2,2]){
   minimum=Math.min(minimum,new THREE.Vector3(x,y,z).applyQuaternion(q).y+c.y);
  }
 }
 assert(c.ground,'A '+angle+' degree '+axis+' landing must not hover on the chassis: '+JSON.stringify({y:c.y,ground:c.ground,pitch:c.pitch,roll:c.roll}));
 assert(groundAt<180,'Landing must establish tyre contact promptly');
 assert(minimum>-.04,'Visible body must not clip into the field during landing: '+minimum);
 assert(maxStep<.35,'Landing alignment must not teleport vertically: '+maxStep);
 assert(Math.abs(c.pitch)<.015&&Math.abs(c.roll)<.015,'Landed car must settle onto its tyres');
}
const inFlight=tipped(0);inFlight.y=14;inFlight.airQuat.setFromAxisAngle(new THREE.Vector3(1,0,0),.6);
const original=inFlight.airQuat.clone();for(let i=0;i<30;i++)tick(inFlight);
assert(sim.orientation(inFlight).angleTo(original)<1e-7,'Landing assistance must not rotate a freely airborne car');
const boosted=tipped(0);boosted.y=4;boosted.vy=-8;boosted.airQuat.setFromAxisAngle(new THREE.Vector3(1,0,0),-.5);
for(let i=0;i<240;i++)tick(boosted,{boost:true,keyboardFlightAssist:true});
assert(boosted.ground,'Holding boost must not prevent a valid tyre-first landing');
const jump=tipped(0);jump.y=4;jump.vy=-8;jump.airQuat.setFromAxisAngle(new THREE.Vector3(1,0,0),.5);
for(let i=0;i<240&&!jump.ground;i++)tick(jump);
const landingPose=sim.orientation(jump).clone();tick(jump,{jump:true});
assert(!jump.ground&&jump.jumps===1,'A landed car must be able to jump again');
assert(sim.orientation(jump).angleTo(landingPose)<.15,'Jumping during suspension alignment must preserve the actual pose');
console.log('PASS: tilted pitch/roll landings, body clearance, smooth suspension, momentum, boost-held landings and immediate re-jump');

const dash=tipped(0);Object.assign(dash,{y:.58,vy:-1,vz:20,jumps:1,jt:.2});tick(dash,{jump:true,dodge:[1,0]});assert.equal(dash.waveDashes,1,'Dodge during tyre landing performs a wave dash');assert(dash.ground&&dash.vz>29&&dash.vy<.1,'Wave dash preserves tyre contact and adds tangent momentum');
const reset=tipped(0);Object.assign(reset,{y:15,jumps:1,jt:4,flipReset:true});tick(reset,{jump:true,dodge:[1,0]});assert.equal(reset.jumps,2);assert(!reset.flipReset&&reset.flip>0,'A tyre reset permits a flip beyond the original second-jump window');
console.log('PASS: live solver wave dash on landing and reset flips after the normal timer expires');
