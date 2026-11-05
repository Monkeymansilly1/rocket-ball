'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const THREE=require('../lib/three.min.js'),Replay=require('../lib/replay.js');
const source=fs.readFileSync('game.js','utf8');
function extract(name){const a=source.indexOf('function '+name+'('),start=source.indexOf('{',a);assert(a>=0);let depth=0;for(let i=start;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(a,i+1);}throw Error(name);}
const wallQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
const cars=[{x:0,y:3,z:0,vx:10,vy:0,vz:0,yaw:0,pitch:0,roll:0,ground:true,surfaceQuat:wallQ,demoTimer:0,boost:80,fl:0,engineLoad:.5}];
const ball={x:0,y:2,z:0,vx:12,vy:0,vz:0,wx:0,wy:0,wz:-2,q:[0,0,0,1]},pads=[{t:3}];
const a=source.indexOf('let replayHistory ='),b=source.indexOf('\n\nconst SKILL',a);
const recorder=new Function('THREE','cars','ball','pads',extract('getCarOrientation')+'\n'+source.slice(a,b)+`\nreturn {capture(time){replaySimulationTime=time;saveReplayFrame();},history:()=>replayHistory,apply:applyReplayFrame};`)(THREE,cars,ball,pads);
recorder.capture(0);cars[0].x=10;cars[0].boost=40;ball.x=12;pads[0].t=2;recorder.capture(1);recorder.capture(1);
assert.equal(recorder.history().length,2,'A repeated timestamp must not create a duplicate frame');
assert.deepEqual(recorder.history()[0].cars[0].q,wallQ.toArray(),'Wall orientation must be recorded even when grounded');
const halfway=Replay.sample(recorder.history(),.5);
assert.equal(halfway.cars[0].x,5);assert.equal(halfway.cars[0].boost,60);assert.equal(halfway.ball.x,6);assert.equal(halfway.pads[0],2.5);
assert.equal(Replay.duration(recorder.history()),1);
recorder.apply(halfway);assert(cars[0].airQuat.angleTo(wallQ)<1e-7);assert.equal(ball.x,6);
assert.equal(recorder.history()[0].cars[0].x,0,'Playback must not mutate recorded frames');
for(let i=2;i<400;i++)recorder.capture(i/30+1);
assert.equal(recorder.history().length,301);assert(Math.abs(Replay.duration(recorder.history())-10)<1e-9);
assert.equal(Replay.sample([],1),null);assert.equal(Replay.duration([]),0);
const qa=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),179*Math.PI/180).toArray();
const qb=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-179*Math.PI/180).toArray();
const frames=[{time:10,cars:[{x:0,q:qa}],ball:{}},{time:11,cars:[{x:10,q:qb}],ball:{}}];
const q=new THREE.Quaternion().fromArray(Replay.sample(frames,.5).cars[0].q);
assert(q.angleTo(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI))<1e-6,'Rotation must take the short path instead of spinning backwards');
assert.equal(Replay.sample(frames,0),frames[0]);assert.equal(Replay.sample(frames,10),frames[1]);
const teleport=[{time:0,cars:[{x:0,demoTimer:1}],ball:{}},{time:1,cars:[{x:100,demoTimer:0}],ball:{}}];
assert.equal(Replay.sample(teleport,.5).cars[0].x,0,'Respawning cars must not slide across the arena');
assert(Math.abs(Replay.speedToMph({vx:0,vy:0,vz:20})-22.369362920544)<1e-10);
assert(Math.abs(Replay.speedToMph({vx:6,vy:8,vz:0})-11.184681460272)<1e-10,'Goal speed must include vertical velocity');
assert.equal(Replay.speedToMph({vx:0,vy:0,vz:0}),0);
// Exercise the live scoring-line velocity capture with gravity and drag.
const tuning=source.slice(source.indexOf('const PHYSICS_TUNING ='),source.indexOf('const MATCH ='));
const ramps=source.slice(source.indexOf('const WALL_RAMP_WIDTH'),source.indexOf('let pitchMesh'));
const physics=new Function('THREE',`const HW=80,HL=104,GW=15,GH=10.5,GD=14,CH=14,CEIL=44,BR=91.25/50;${tuning}${ramps}
const state='play';let captured=null;const goal=(team,velocity)=>{captured={team,velocity};};const ball={};
${['clampBallMotion','ballSurfaceImpulse','resolveBallWall','stepBall'].map(extract).join('\n')}
return {step:stepBall,result:()=>captured};`)(THREE);
const shot={x:0,y:3,z:103.98,vx:6,vy:-2,vz:32,wx:0,wy:0,wz:0};physics.step(1/120,shot);
const scored=physics.result();assert.equal(scored.team,0);
const damping=Math.pow(.97,1/120),fraction=.02/(32*damping/120);
assert(Math.abs(scored.velocity.vy-(-2+((-2-13/120)*damping+2)*fraction))<1e-9,'Speed must be captured at the crossing, not at the end of the step');
// The live update path must sample independently of how often render runs.
const updateHarness=new Function('THREE','RocketReplay',`
const cars=[{x:0,y:.55,z:0,boost:34}],ball={x:0,y:2,z:0,vx:0,vy:0,vz:0},pads=[];
const getCarOrientation=()=>new THREE.Quaternion();
let state='play',t=0,clock=300,ot=false,trainingMode=false,trainingWallArmed=false,predictionTimer=1;
const diff=1,localTwoPlayer=false,pred=[{}],eventCooldown={},playerStats=[],lastTouch=null;
const predict=()=>{},playerCtl=()=>({}),bump=()=>{},hitBall=()=>{},stepBall=()=>{},showVictoryScreen=()=>{};
const stepCar=(c,ct,dt)=>{c.x+=dt;};
${source.slice(a,b)}
${extract('update')}
saveReplayFrame();for(let i=0;i<240;i++)update(1/120);
return replayHistory;`)(THREE,Replay);
assert.equal(updateHarness.length,61,'Two simulation seconds must produce 60 unique samples plus the initial frame');
assert(Math.abs(Replay.duration(updateHarness)-2)<1e-9);
assert(Math.abs(updateHarness.at(-1).cars[0].x-2)<1e-9);
console.log('PASS: physics-timed replay capture, interpolation, wall/ceiling orientation, bounded history, respawns and accurate 3D scoring-line speed');
