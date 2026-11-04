'use strict';
// Run with: node tests/car-recovery.test.js
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
const sim=new Function('THREE','assert',code)(THREE,assert);
function tipped(roll,x=0,z=0){return {x,y:1.3,z,yaw:0,pitch:0,roll,vx:0,vy:0,vz:0,ground:false,
 demoTimer:0,demoCooldown:0,wallRide:false,wallVerticalAxis:null,wallDetachTimer:0,
 airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),roll),airOmega:null,
 surfaceQuat:null,surfaceNormal:null,surfaceForward:null,flip:0,jumps:2,jt:2,boost:34,ai:false,team:0,
 mesh:{root:{userData:{},visible:true},bodyBounds:{min:[-1.25,-.48,-2],max:[1.25,1,2]}}};}
function tick(car,overrides={}){sim.step(car,{throttle:0,steer:0,pitch:0,roll:0,jump:false,jumpHeld:false,boost:false,...overrides},1/120);}
const embedded=tipped(Math.PI/2);embedded.y=.55;tick(embedded);
assert(embedded.y>=1.275-1e-9,'A sideways car must use its body width as floor clearance');
assert.equal(embedded.ground,false,'A flank contact must not count as tyre traction');
for(const roll of [Math.PI/2,-Math.PI/2,1.85,-1.85]){
 const c=tipped(roll,12,88);for(let i=0;i<360;i++)tick(c);
 assert(c.ground,'Sideways car must settle back onto its tyres: '+roll);
 assert(sim.orientation(c).clone().dot(new THREE.Quaternion())>.9,'Settling must restore upright orientation');
}
for(const roll of [Math.PI,-Math.PI,Math.PI/2,-Math.PI/2]){
 const c=tipped(roll);for(let i=0;i<90;i++)tick(c);
 tick(c,{jump:true});for(let i=0;i<180;i++)tick(c);
 assert(c.ground,'Space must recover a tipped car even after both aerial jumps were used: '+roll);
 assert(Math.abs(c.x)<3&&Math.abs(c.z)<3,'Recovery must not teleport the car');
}
const airborne=tipped(Math.PI);airborne.y=15;tick(airborne,{jump:true});
assert.equal(airborne.jumps,2,'Mid-air Space must not give an extra jump');
assert.equal(airborne.recoveryTimer||0,0,'Self-righting must require actual body contact');
console.log('PASS: sideways settling, exhausted-jump roof recovery, no teleport and no mid-air recovery exploit');
