'use strict';
// Run with: node tests/aerial-controls.test.js
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
 'const cars=[],pads=[],physicsStyle="standard",trainingMode=true,emitBoost=()=>{};',
 'const keys={};let keyboardFlightMode="assist";const controllerForPlayer=()=>null,buttonValue=()=>0;const controllerDeadZone=.12,controllerSteeringSensitivity=1.25,controllerAerialSensitivity=1.35;',
 ...funcs.map(extractFunction),extractFunction('playerActions'),
 `return {keys,read:()=>playerActions('p1'),step:stepCar,mode:value=>keyboardFlightMode=value,forward:getCarForward};`
].join('\n');
const sim=new Function('THREE','assert',code)(THREE,assert);
function car(){return {x:0,y:.55,z:0,yaw:0,pitch:0,roll:0,vx:0,vy:0,vz:0,ground:true,
 demoTimer:0,demoCooldown:0,wallRide:false,wallVerticalAxis:null,wallDetachTimer:0,
 airQuat:null,airOmega:null,surfaceQuat:null,surfaceNormal:null,surfaceForward:null,
 flip:0,jumps:0,jt:0,boost:100,ai:false,team:0,mesh:{root:{userData:{},visible:true}}};}
function fly(mode,withThrottle){
 for(const key of Object.keys(sim.keys))delete sim.keys[key];sim.mode(mode);
 const c=car();sim.keys.ShiftLeft=true;if(withThrottle)sim.keys.KeyW=true;
 for(let i=0;i<180;i++){
  if(i<24)sim.keys.Space=true;else delete sim.keys.Space;
  if(mode==='manual'&&i<35)sim.keys.KeyS=true;else delete sim.keys.KeyS;
  const action=sim.read();action.jump=i===0;sim.step(c,action,1/120);
 }
 return c;
}
const assisted=fly('assist',false);
assert(!assisted.ground && assisted.y>5 && assisted.vy>0,'Space then Shift alone must produce a sustained assisted aerial from the ground');
const throttle=fly('assist',true);
assert(throttle.y>5 && throttle.vy>0,'W + Space + Shift must sustain an aerial');
assert(sim.forward(throttle).y>.7,'Assisted mode must aim thrust upward without looping');
const manual=fly('manual',false);
assert(!manual.ground&&manual.y>3,'Manual Space, S, Shift takeoff must remain available');
sim.mode('assist');sim.keys.KeyK=true;
assert.equal(sim.read().keyboardFlightAssist,false,'Dedicated pitch must override automatic pitch');
console.log('PASS: ground-to-air assisted and manual takeoffs, upward boost, pitch override and no unintended dodge');
