'use strict';
// Drive the actual car/ball solver from the centre kickoff, including boost pads.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const THREE=require('../lib/three.min.js');
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
function section(from,to){
  const start=source.indexOf(from),end=source.indexOf(to,start+from.length);
  assert(start>=0&&end>start,'Missing source section '+from);
  return source.slice(start,end);
}
function extract(name){
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,'Missing '+name);
  const brace=source.indexOf('{',start);let depth=0;
  for(let i=brace;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw Error('Unclosed '+name);
}
const functions=['getCarOrientation','getCarForward','aerialControl','applyDirectionalBoost',
  'groundThrottleAcceleration','stepGroundForward','groundSteeringCurvature',
  'carSurfaceContact','updateCarSurfaceFrame','snapCarToContact','stepCar',
  'clampBallMotion','ballSurfaceImpulse','resolveBallWall','stepBall','hitBall'];
const makeSim=new Function('THREE',[
  'const HW=80,HL=104,GW=15,GH=10.5,GD=14,CEIL=44,CH=14,BR=91.25/50;',
  section('const PHYSICS_TUNING = {','const MATCH ='),
  section('const WALL_RAMP_WIDTH','let pitchMesh'),
  section('const CAR_HITBOXES = {','// ---------- renderer'),
  section('const FORM =','function kickoff'),
  section('const negativeSmallPads=','for (const [x,z,big]'),
  'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1),CAR_CLEARANCE=.55;',
  'const cars=[],pads=smallPads.map(([x,z])=>({x,z,big:false,t:0,surfaceY:0}));',
  'const ball={},physicsStyle="standard",trainingMode=false,state="play",t=0,playerStats=[],eventCooldown={};',
  'let lastTouch=null,previousTouch=null,scored=false;',
  'const emitBoost=()=>{},emit=()=>{},showGameEvent=()=>{},sparks=()=>{},rumbleCar=()=>{},goal=()=>{scored=true;};',
  ...functions.map(extract),
  'return {cars,ball,pads,boxes:CAR_HITBOXES,form:FORM,stepCar,stepBall,hitBall,getCarOrientation,scored:()=>scored};'
].join('\n'));

function kickoff(model,team,boost=true){
  const sim=makeSim(THREE),dir=team?-1:1;
  const c={x:0,y:.55,z:-dir*sim.form[0][1]*104,yaw:team?Math.PI:0,pitch:0,roll:0,
    vx:0,vy:0,vz:0,ground:true,boost:34,ai:false,team,hitbox:sim.boxes[model],
    jumps:0,jt:0,flip:0,demoTimer:0,wallDetachTimer:0,mesh:{root:{userData:{},visible:true}}};
  sim.cars.push(c);
  Object.assign(sim.ball,{x:0,y:91.25/50+.038,z:0,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,onGround:true});
  let hit=null,peak=sim.ball.y,atBackboard=null;
  const dt=1/240;
  for(let frame=0;frame<240*9;frame++){
    sim.stepCar(c,{throttle:1,steer:0,pitch:0,roll:0,jump:false,jumpHeld:false,boost},dt);
    sim.stepBall(dt);
    const speedBefore=Math.hypot(sim.ball.vx,sim.ball.vy,sim.ball.vz);
    sim.hitBall(c);
    if(!hit&&Math.hypot(sim.ball.vx,sim.ball.vy,sim.ball.vz)>speedBefore+1){
      hit={vx:sim.ball.vx,vy:sim.ball.vy,vz:sim.ball.vz,time:frame*dt,carSpeed:Math.hypot(c.vx,c.vy,c.vz)};
    }
    peak=Math.max(peak,sim.ball.y);
    if(hit&&atBackboard===null&&dir*sim.ball.z>=104-91.25/50-.01){
      atBackboard=sim.ball.y;
      if(atBackboard>10.5-91.25/50)break;
    }
    if(sim.scored())break;
  }
  assert(hit,'The centre kickoff must reach the ball');
  return {model,team,boost,hit,peak,atBackboard,scored:sim.scored()};
}
const results=[];
for(const model of ['octane','fennec','scorpion'])for(const team of [0,1]){
  results.push(kickoff(model,team,true));
}
const throttle=kickoff('octane',0,false);
const resting=makeSim(THREE);
Object.assign(resting.ball,{x:0,y:93.15/50,z:0,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0,onGround:true});
for(let i=0;i<240;i++)resting.stepBall(1/240);
assert(Math.abs(resting.ball.y-93.15/50)<1e-10,'A waiting kickoff ball must retain the reference resting height');
// Use the real hitboxes in airborne contacts too: lift must come from the
// point of contact, and the origin correction must follow local car up.
function contact(height,orientation=new THREE.Quaternion(),extra=true){
  const sim=makeSim(THREE),box=sim.boxes.octane;
  const position=new THREE.Vector3(4,20,-7);
  const velocity=new THREE.Vector3(0,0,40).applyQuaternion(orientation);
  const c={x:position.x,y:position.y,z:position.z,vx:velocity.x,vy:velocity.y,vz:velocity.z,
    yaw:0,pitch:0,roll:0,airQuat:orientation,ground:false,hitbox:box,team:0,
    demoTimer:0,ballHitCooldown:extra?0:1,airOmega:{pitch:0,yaw:0,roll:0}};
  sim.cars.push(c);
  const centre=new THREE.Vector3(0,box.originUp+height,box.forward+box.length+1.6)
    .applyQuaternion(orientation).add(position);
  Object.assign(sim.ball,{x:centre.x,y:centre.y,z:centre.z,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0});
  sim.hitBall(c);
  return {velocity:new THREE.Vector3(sim.ball.vx,sim.ball.vy,sim.ball.vz)
    .applyQuaternion(orientation.clone().invert()),omega:c.airOmega};
}
const low=contact(1.5),middle=contact(.4151),under=contact(-.6);
assert(low.velocity.y>middle.velocity.y+5,'Low contact must chip higher than a face-centre hit');
assert(under.velocity.y<0,'An underside aerial touch must push down, without a forced upward pop');
const flat=contact(1.1,new THREE.Quaternion(),false);
const rotated=contact(1.1,new THREE.Quaternion().setFromEuler(new THREE.Euler(.7,1.2,-.8)),false);
assert(flat.velocity.distanceTo(rotated.velocity)<1e-9,'Collision geometry must rotate with pitched/rolled cars');
for(const axis of ['pitch','yaw','roll']){
  assert(Number.isFinite(flat.omega[axis])&&Math.abs(flat.omega[axis]-rotated.omega[axis])<1e-9,
    'Airborne angular recoil must use the local car axes');
}
assert(Math.abs(flat.omega.pitch)>.001,'An off-centre airborne hit must transfer angular momentum to the car');
if(process.env.KICKOFF_REPORT)console.log(JSON.stringify({results,throttle},null,2));
else {
  for(const result of results){
    assert(result.hit.vy>10,'A fast low contact must lift the ball: '+JSON.stringify(result));
    assert(result.atBackboard>10.5+91.25/50,'An uncontested boosted kickoff must clear the crossbar: '+JSON.stringify(result));
    assert(!result.scored,'A shot over the crossbar must not be counted as a goal');
  }
  assert(results[0].hit.vy>throttle.hit.vy,'A slower approach must produce a weaker chip');
  assert(throttle.scored,'An uncontested slower centre hit must still be able to finish below the bar');
  assert.deepEqual(results[0],{...results[2],model:'octane'},'Fennec and Octane must share handling');
  for(let i=0;i<results.length;i+=2){
    assert(Math.abs(results[i].hit.vy-results[i+1].hit.vy)<1e-9&&
      Math.abs(results[i].hit.vz+results[i+1].hit.vz)<1e-9,
      'Blue and Orange kickoffs must have mirrored physics');
  }
  console.log('PASS: boosted centre kickoffs clear the crossbar with all three cars, mirrored teams and speed-dependent chips');
  console.log('PASS: face/underside contacts, pitch/roll collision origin and airborne angular recoil');
}
