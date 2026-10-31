'use strict';
// Run with: node tests/wall-physics.test.js
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
const sourceCode=[
 'const HW=80,HL=104,GW=15,GH=10.5,CEIL=44,CH=14,BR=91.25/50;',
 section('const PHYSICS_TUNING = {','const MATCH ='),
 section('const WALL_RAMP_WIDTH','let pitchMesh'),
 'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1),CAR_CLEARANCE=.55;',
 'const cars=[],pads=[],physicsStyle="standard",trainingMode=false,emitBoost=()=>{};',
 ...funcs.map(extractFunction),
 "\nfunction car(x,y,z,yaw,wall=null) {\n  const c={x,y,z,yaw,pitch:0,roll:0,vx:0,vy:0,vz:0,ground:true,\n    demoTimer:0,demoCooldown:0,ballHitCooldown:0,airTouchCooldown:0,\n    ceilingRide:false,wallRide:!!wall,wallVerticalAxis:wall,\n    wallVerticalSign:wall?1:0,wallDetachTimer:0,\n    surfaceForward:null,surfaceNormal:null,surfaceQuat:null,\n    airQuat:null,airOmega:null,flip:0,jumps:0,jt:0,\n    boost:100,fl:0,ai:false,team:0,\n    mesh:{root:{userData:{},visible:true}}};\n  cars.push(c);\n  return c;\n}\nconst dt=1/120;\nfunction tick(c,input={}) {\n  stepCar(c,{throttle:1,steer:0,hand:false,boost:false,\n    jump:false,jumpHeld:false,...input},dt);\n  for(const key of ['x','y','z','vx','vy','vz'])\n    assert.ok(Number.isFinite(c[key]),'Non-finite '+key);\n}\nconst climber=car(60,0.55,0,Math.PI/2);\nfor(let i=0;i<260;i++)tick(climber);\nassert.equal(climber.wallVerticalAxis,'x','Car failed to climb side wall');\nassert.ok(climber.y>10,'Car should climb the wall');\nassert.ok(Math.abs(climber.x-(HW-.55))<.02,'Tyres not held at wall');\nassert.ok(climber.surfaceQuat,'Missing wall orientation');\n\nconst z0=climber.z;\nfor(let i=0;i<90;i++)tick(climber,{steer:1});\nassert.ok(Math.abs(climber.z-z0)>4,'Wall steering did not move sideways');\n\ntick(climber,{jump:true,throttle:0,steer:0});\nassert.equal(climber.ground,false,'Wall jump did not detach');\nassert.ok(climber.vx<0,'Wall jump should push into arena');\nassert.ok(climber.airQuat,'Missing jump orientation');\nconst q=climber.airQuat.clone();\nfor(let i=0;i<65;i++)tick(climber,{throttle:0,pitch:-1,steer:0,airYaw:0});\nassert.ok(q.angleTo(climber.airQuat)>.2,'Stick pitch not rotating airborne car');\n\nconst corner=car(HW-.55,10,68,0,'x');\ncorner.surfaceNormal=new THREE.Vector3(-1,0,0);\ncorner.surfaceForward=new THREE.Vector3(0,0,1);\ncorner.vz=20;\nfor(let i=0;i<270;i++)tick(corner);\nassert.ok(corner.x<70&&corner.z>102,'Curved-corner travel stalled');\n\nconst roof=car(60,.55,0,Math.PI/2);\nfor(let i=0;i<445;i++)tick(roof);\nassert.equal(roof.ceilingRide,true,'No wall-to-ceiling movement');\nassert.ok(roof.y>43,'Car not at ceiling');\nfor(let i=0;i<115;i++)tick(roof,{throttle:0});\nassert.equal(roof.ceilingRide,false,'Ceiling release did not occur');\nassert.equal(roof.ground,false,'Ceiling release should be airborne');\n\nconst coast=car(60,.55,0,Math.PI/2);\nfor(let i=0;i<240;i++)tick(coast);\nfor(let i=0;i<900;i++)tick(coast,{throttle:0});\nassert.ok(coast.y<2&&coast.ground,'Car did not return down wall');\nreturn {passed:6,physicsHz:120};\n"
].join('\n');
const result=new Function('THREE','assert',sourceCode)(THREE,assert);
console.log('Rocket Ball wall physics:',result.passed,'scenarios passed at',result.physicsHz,'Hz');
