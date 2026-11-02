'use strict';
// Run: node tests/physics-smoke.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');

const src = fs.readFileSync('game.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
// Exercise the live physics tuning values, not a stale mocked constant set.
const tuningLiteral = src.match(/const PHYSICS_TUNING = (\{[\s\S]*?\n\});/);
assert(tuningLiteral, 'Missing physics calibration block');
const tuning = new Function('return '+tuningLiteral[1])();
const scaledBallRadius = 91.25/50;
assert(Math.abs(tuning.GRAVITY_FORCE-13)<.001, 'Car gravity scale incorrect');
assert(Math.abs(tuning.BALL_GRAVITY_FORCE-13)<.001, 'Ball gravity scale incorrect');
assert(Math.abs(tuning.GROUND_MAX_SPEED-28.2)<.001, 'Throttle speed cap incorrect');
assert(Math.abs(tuning.AIR_BOOST_FORCE-1058.333/50)<.001, 'Air boost acceleration incorrect');
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
  extract('rampProfile'), extract('arenaCornerContact'), extract('arenaRampAt'),
  extract('getCarOrientation'), extract('getCarForward'),
  extract('aerialControl'), extract('applyDirectionalBoost'),
  extract('groundThrottleAcceleration'), extract('stepGroundForward'),
  extract('groundSteeringCurvature'),
  extract('predict'),
  extract('clampBallMotion'), extract('ballSurfaceImpulse'),
  extract('resolveBallWall'), extract('stepBall'), extract('hitBall')
].join('\n');
const bootstrap = [
  'const THREE = arguments[0];',
  'const AIR_X=new THREE.Vector3(1,0,0),AIR_Y=new THREE.Vector3(0,1,0),AIR_Z=new THREE.Vector3(0,0,1);',
  'const BR=91.25/50,HW=80,HL=104,GW=15,GH=10.5,GD=14,CH=14,CEIL=44,WALL_RAMP_HEIGHT=256/50,WALL_RAMP_WIDTH=6;',
  'const PHYSICS_TUNING_AIR={PITCH_TORQUE_SPEED:3.4,YAW_TORQUE_SPEED:2.85,ROLL_TORQUE_SPEED:4.2,AIR_BOOST_FORCE:43,BOOST_FORCE:19.83};',
  'const PHYSICS_TUNING = arguments[1];',
  'const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));',
  'const ball={x:0,y:12.4,z:0,vx:0,vy:-20,vz:0,wx:0,wy:0,wz:0,onRamp:false};',
  'let lastTouch=null,previousTouch=null;',
  'const trainingMode=false; const updateTrainingCounters=()=>{};',
  'const playerStats=[{goals:0,assists:0,shots:0,saves:0,clears:0}];',
  'const cars=[]; const eventCooldown={}; const t=0,state="play";',
  'const pred=[];',
  'const showGameEvent=()=>{},sparks=()=>{},rumbleCar=()=>{};',
  'const goal=()=>{throw Error("Unexpected goal in physics test")};',
  'const rampEase=t=>t*t*(3-2*t);'
].join('\n') + '\n' + functions + '\nreturn {ball,pred,predict,stepBall,hitBall,resolveBallWall,arenaRampAt,getCarForward,aerialControl,applyDirectionalBoost,stepGroundForward,groundSteeringCurvature,cars};';
const {ball,pred,predict,stepBall,hitBall,resolveBallWall,arenaRampAt,getCarForward,aerialControl,applyDirectionalBoost,stepGroundForward,groundSteeringCurvature,cars} = new Function(bootstrap)(THREE,tuning);

for(let i=0;i<240;i++)stepBall(1/120);
assert(ball.y >= scaledBallRadius-.001 && ball.y < 20 && Number.isFinite(ball.y),'Floor contact unstable');

// Light ground touches must still bounce instead of clinging to the floor.
Object.assign(ball,{x:0,y:scaledBallRadius+0.003,z:0,vx:0,vy:-1.15,vz:0,
  wx:0,wy:0,wz:0,onRamp:false,onGround:false});
stepBall(1/120);
assert(ball.vy>0.6,'Small ground impacts are being killed instead of bouncing');

// Rolling resistance must stay below material friction.
Object.assign(ball,{x:0,y:scaledBallRadius,z:0,vx:20,vy:0,vz:0,
  wx:0,wy:0,wz:0,onRamp:false,onGround:true});
for(let i=0;i<120;i++)stepBall(1/120);
assert(ball.vx>16&&ball.vx<20,'Grounded ball loses too much momentum');

// Falling onto a curved ramp should bounce; shallow uphill touches stay smooth.
const dropX=76,dropRamp=arenaRampAt(dropX,0);
Object.assign(ball,{x:dropX,y:scaledBallRadius+dropRamp.height+0.005,z:0,
  vx:0,vy:-8,vz:0,wx:0,wy:0,wz:0,onRamp:false,onGround:false});
stepBall(1/120);
const dropNormalLength=Math.hypot(-dropRamp.dx,1,-dropRamp.dz);
const reboundNormalSpeed=(-dropRamp.dx*ball.vx+ball.vy-dropRamp.dz*ball.vz)/dropNormalLength;
assert(reboundNormalSpeed>3,'Ball is sticking to ramp after a downward impact');

Object.assign(ball,{x:77.45,y:20,z:0,vx:38,vy:0,vz:0,onRamp:false});
for(let i=0;i<10;i++)stepBall(1/120);
assert(ball.x<=80-scaledBallRadius+.01&&ball.vx<=0,'Side-wall bounce failed');
Object.assign(ball,{x:0,y:3,z:0,vx:1000,vy:0,vz:0});
stepBall(1/120);
assert(Math.hypot(ball.vx,ball.vy,ball.vz)<=tuning.MAX_BALL_SPEED+.0001,'Ball speed limit exceeded');

const car={x:0,y:.55,z:0,vx:0,vy:0,vz:30,yaw:0,pitch:0,hit:1.7,team:0,fl:0,flip:0,demoTimer:0,ballHitCooldown:0};
cars.push(car);
Object.assign(ball,{x:0,y:.55,z:3.2,vx:0,vy:0,vz:0,wx:0,wy:0,wz:0});
hitBall(car);
const first=ball.vz;
assert(first>1&&first<=tuning.MAX_BALL_SPEED,'Car-ball impulse failed');
assert(car.ballHitCooldown>0,'Shot cooldown missing');
Object.assign(ball,{x:0,y:.55,z:3.2,vx:0,vy:0,vz:0});
hitBall(car);
assert(ball.vz<first,'Repeated contact gained excessive power');

// A ball travelling outward at the top of a ramp must continue UP the
// vertical wall instead of ricocheting directly back onto the pitch.
const wallX=80-scaledBallRadius-0.05;
Object.assign(ball,{x:wallX,y:scaledBallRadius+arenaRampAt(wallX,0).height+0.25,z:0,
  vx:24,vy:1,vz:0,onRamp:true});
stepBall(1/120);
assert(ball.vx<=0 && ball.vy>7,
  'Rounded ramp must redirect outbound ball movement upward before wall contact');
for(let i=0;i<35;i++)stepBall(1/120);
assert(ball.y>6.5,'The ball did not rise after transferring onto the wall');

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
  flyer.vy-=tuning.GRAVITY_FORCE/120;
  applyDirectionalBoost(flyer,1/120,false);
}
assert(flyer.vy>4,'Nose-up aerial boost cannot counter gravity');
const before=getCarForward(flyer);
for(let i=0;i<70;i++)aerialControl(flyer,{throttle:-.5,steer:.2,roll:1},1/120);
assert(flyer.airQuat && Math.abs(flyer.airQuat.length()-1)<1e-6,
  'Air rotation lost normalized physical orientation');
assert(getCarForward(flyer).distanceTo(before)>.1,
  'Pitch/yaw inputs failed to change the actual boost direction');
// Directional dodge should rotate the PHYSICAL car hitbox through a tumble.
// Previously the gameplay hitbox stayed still and only the car art flipped.
const flipper={yaw:0,pitch:0,roll:0,airQuat:null,airOmega:null,
  flip:.55,flipAxis:new THREE.Vector3(1,0,0),jumps:2};
for(let i=0;i<30;i++)
  aerialControl(flipper,{throttle:0,steer:0,roll:0},1/120);
assert(getCarForward(flipper).z<-.7,
  'Directional dodge failed to rotate the actual physics orientation');
// Throttle should converge on 1410uu/s, boost to 2300uu/s, and coasting
// must not erase boost momentum instantly. This used to ruin all ground plays.
let driveSpeed=0;
for(let i=0;i<1200;i++) driveSpeed=stepGroundForward(driveSpeed,1,false,1/120);
assert(Math.abs(driveSpeed-1410/50)<0.2,
  'Throttle-only speed no longer converges to 1410 uu/s: '+driveSpeed);
let boostedSpeed=2300/50;
const afterCoast=stepGroundForward(boostedSpeed,0,false,1/120);
assert(afterCoast>45,'Releasing boost instantly erased supersonic momentum');
const lowCurve=groundSteeringCurvature(500,0);
const highCurve=groundSteeringCurvature(2300,0);
assert(lowCurve>highCurve*3,'Steering should have larger curvature at low speed');
console.log('PASS: syntax, training controls, floor, walls, ball speed cap, car-ball impacts');


// Regression: a controller's left-stick Y must independently control aerial
// pitch and dodge while RT/R2 keeps accelerating. It previously ignored Y
// completely, so jumping and pulling the stick down did nothing.
{
  const defaults = {
    p1: {
      keyboard: {
        forward:'KeyW', reverse:'KeyS', left:'KeyA', right:'KeyD', jump:'Space',
        boost:'ShiftLeft', hand:'KeyE', rollLeft:'KeyQ', rollRight:'KeyE'
      },
      pad: {forward:7, reverse:6, left:null, right:null, jump:0,
        boost:2, hand:4, rollLeft:null, rollRight:5}
    }
  };
  const pressed = new Set();
  const gamepad = {
    axes:[0,0,0,0],
    buttons:Array.from({length:18},()=>({pressed:false,value:0}))
  };
  const keyStates = {};
  const getButton = (pad, action, who) => {
    const index=defaults[who].pad[action];
    return Number.isInteger(index) && pad.buttons[index]?.pressed ? 1 : 0;
  };
  const readPlayer = new Function(
    'controlBindings','controllerForPlayer','keys','buttonValue',
    'controllerDeadZone','controllerSteeringSensitivity',
    'controllerAerialSensitivity','clamp',
    extract('playerActions')+'\nreturn playerActions;'
  )(defaults,()=>gamepad,keyStates,getButton,.12,1,1,
    (value,min,max)=>Math.max(min,Math.min(max,value)));
  const read = (x,y,accelerating=false,drifting=false) => {
    gamepad.axes[0]=x; gamepad.axes[1]=y;
    gamepad.buttons[7].pressed=accelerating;
    gamepad.buttons[4].pressed=drifting;
    return readPlayer('p1');
  };
  const noseUp=read(0,1);
  assert(noseUp.pitch<-.95 && noseUp.dodge[0]<-.95,
    'Pulling left stick down must pitch nose UP / allow a backflip');
  const noseDown=read(0,-1);
  assert(noseDown.pitch>.95 && noseDown.dodge[0]>.95,
    'Pushing left stick up must pitch nose DOWN / allow a front flip');
  const boostlessThrottle=read(0,1,true);
  assert(boostlessThrottle.throttle>.95 && boostlessThrottle.pitch<-.95,
    'Holding RT/R2 must not cancel stick-down aerial pitch');
  const neutral=read(0,0,true);
  assert(Math.abs(neutral.dodge[0])<.01,
    'RT/R2 alone must not cause an accidental front flip on double-jump');
  const airRoll=read(-1,0,false,true);
  assert(airRoll.roll<-.95 && Math.abs(airRoll.airYaw)<.01,
    'LB/L1 plus left stick must control aerial roll, not yaw');
}
console.log('PASS: controller aerial pitch, independent throttle and analog directional dodge');

// Regression suite: the ball must release freely from its contact surface,
// conserve momentum at the wall lip and never invent a vertical wall pop.
{
  const radius=91.25/50;
  Object.assign(ball,{x:0,y:radius+0.03,z:0,vx:7,vy:3.5,vz:0,
    wx:0,wy:0,wz:0,onGround:true,onRamp:false,onWall:false});
  stepBall(1/120);
  assert(ball.vy>3.2 && !ball.onGround,
    'Ball clung to floor while travelling upward');
  Object.assign(ball,{x:80-radius+.04,y:19,z:0,vx:13,vy:-4,vz:6,
    wx:0,wy:0,wz:0,onGround:false,onRamp:false,onWall:false});
  stepBall(1/120);
  assert(ball.vx<0 && ball.vy<0 && Math.abs(ball.vy+4)<.8,
    'A high wall hit should rebound sideways, not pop upward');

  Object.assign(ball,{x:80-radius,y:radius+3.1,z:0,vx:19,vy:2,vz:7,
    wx:0,wy:0,wz:0,onGround:false,onRamp:true,onWall:false});
  const before=Math.hypot(ball.vx,ball.vy,ball.vz);
  resolveBallWall('x',1,radius+3);
  const after=Math.hypot(ball.vx,ball.vy,ball.vz);
  assert(ball.onWall && ball.vx===0 && ball.vy>12,
    'Ramp lip should transfer outward momentum upward');
  assert(after<=before+1e-8,'Wall lip created kinetic energy');
  console.log('PASS: airborne release, wall rebound, energy-limited wall roll');
}


{
  // The bot trajectory must follow the *same* floor, rounded wall and
  // frictional collision solver as live gameplay without moving the live ball.
  Object.assign(ball,{x:75.5,y:9.8,z:24,vx:31,vy:1.8,vz:12,
    wx:0,wy:0,wz:0,onRamp:false,onGround:false,onWall:false});
  const before={...ball};
  predict();
  assert.equal(pred.length,40,'Prediction horizon should remain four seconds');
  assert.deepEqual({...ball},before,'Forecast modified the live ball');
  const simulated={...before};
  for(let i=0;i<4;i++)stepBall(.025,simulated,true);
  assert(Math.hypot(pred[0].x-simulated.x,pred[0].y-simulated.y,
    pred[0].z-simulated.z)<1e-8,'Ball predictor disagrees with real collision solver');
  console.log('PASS: shared live/AI ball dynamics and side-effect-free prediction');
}

 
// Regression: keyboard W must accelerate without rotating the nose down,
// while W + Shift in flight reaches a stable positive boost pitch.
{
  const keys=Object.create(null);
  const bindings={p1:{
    keyboard:{forward:'KeyW',reverse:'KeyS',left:'KeyA',right:'KeyD',
      aerialUp:'KeyK',aerialDown:'KeyI',jump:'Space',boost:'ShiftLeft',
      hand:'KeyE',rollLeft:'KeyQ',rollRight:'KeyE'},
    pad:{forward:7,reverse:6,left:null,right:null,jump:0,boost:2,hand:4,
      rollLeft:null,rollRight:5,camera:3}
  }};
  const read=new Function('controlBindings','keys','controllerForPlayer',
    'buttonValue','clamp','controllerDeadZone','controllerSteeringSensitivity',
    'controllerAerialSensitivity',
    extract('playerActions')+'\nreturn playerActions;'
  )(bindings,keys,()=>null,()=>0,(n,a,b)=>Math.max(a,Math.min(b,n)),.12,1.25,1.35);
  keys.KeyW=true;
  let action=read('p1');
  assert.equal(action.throttle,1);
  assert.equal(action.pitch,0,'W alone must not pitch car into the ground');
  assert.equal(action.keyboardFlightAssist,false);
  keys.ShiftLeft=true;
  action=read('p1');
  assert.equal(action.keyboardFlightAssist,true,
    'W + Shift needs a non-looping aerial climb assist');
  const flyer={x:0,y:12,z:0,vx:0,vy:7,vz:0,pitch:0,yaw:0,roll:0,
    airQuat:null,airOmega:null,flip:0};
  for(let i=0;i<200;i++){
    flyer.vy-=tuning.GRAVITY_FORCE/120;
    aerialControl(flyer,action,1/120);
    applyDirectionalBoost(flyer,1/120,false);
  }
  assert(getCarForward(flyer).y>0.5,'Boosting with W pitched DOWN or kept flipping');
  assert(flyer.vy>0,'Holding W + Shift should support climbing while in flight');
  keys.KeyK=true;
  action=read('p1');
  assert.equal(action.pitch,-1,'K must manually pitch the nose UP');
  assert.equal(action.keyboardFlightAssist,false,'Manual pitch must override assist');
  delete keys.KeyK;
  keys.KeyI=true;
  assert.equal(read('p1').pitch,1,'I must manually pitch the nose DOWN');
  delete keys.KeyI;
  delete keys.KeyW;
  keys.KeyS=true;
  assert.equal(read('p1').pitch,0,'S must not pitch down as reverse');
  console.log('PASS: keyboard W+Shift upward aerials and separate I/K pitch');
}

// Keyboard steering direction must stay the same between floor and air.
// Rotation signs also determine the direction of boost thrust.
{
  const rightYaw={yaw:0,pitch:0,roll:0,airQuat:null,airOmega:null,flip:0};
  const rightRoll={yaw:0,pitch:0,roll:0,airQuat:null,airOmega:null,flip:0};
  for(let i=0;i<40;i++){
    aerialControl(rightYaw,{pitch:0,airYaw:1,roll:0},1/120);
    aerialControl(rightRoll,{pitch:0,airYaw:0,roll:1},1/120);
  }
  assert(getCarForward(rightYaw).x>.2,
    'D/right must turn car nose RIGHT during an aerial');
  const rightWheel=new THREE.Vector3(1,0,0).applyQuaternion(rightRoll.airQuat);
  assert(rightWheel.y<-.2,
    'E/right air roll should lower the right wheels, not raise them');
  console.log('PASS: consistent keyboard yaw and air-roll directions');
}

 
// Both keyboard flight modes must remain usable and not overwrite controller
// stick input. The assisted mode retains the previous W+Shift climbing fix.
{
  const keys={};
  const binding={p1:{keyboard:{
    forward:'KeyW',reverse:'KeyS',left:'KeyA',right:'KeyD',
    aerialUp:'KeyK',aerialDown:'KeyI',jump:'Space',boost:'ShiftLeft',
    hand:'KeyE',rollLeft:'KeyQ',rollRight:'KeyE'
  },pad:{forward:7,reverse:6,left:null,right:null,jump:0,boost:2,
    hand:4,rollLeft:null,rollRight:5,camera:3}}};
  const makeReader=(flightMode)=>new Function(
   'controlBindings','controllerForPlayer','keys','buttonValue',
   'controllerDeadZone','controllerSteeringSensitivity',
   'controllerAerialSensitivity','clamp','keyboardFlightMode',
   extract('playerActions')+'\nreturn playerActions;'
  )(binding,()=>null,keys,()=>0,.12,1.25,1.35,
    (v,a,b)=>Math.max(a,Math.min(b,v)),flightMode);
  const assisted=makeReader('assist');
  const manual=makeReader('manual');
  keys.KeyW=true;keys.ShiftLeft=true;
  assert.equal(assisted('p1').pitch,0,
    'Assisted W+Shift must not point nose at ground');
  assert.equal(assisted('p1').keyboardFlightAssist,true,
    'Assisted climbing must remain enabled');
  assert.equal(manual('p1').pitch,1,
    'Manual W must command nose down for Rocket-style control');
  assert.equal(manual('p1').keyboardFlightAssist,false,
    'Manual mode must not artificially level or raise the nose');
  delete keys.KeyW;keys.KeyS=true;
  assert.equal(manual('p1').pitch,-1,
    'Manual S must point nose up during aerial');
  delete keys.KeyS;keys.KeyK=true;
  assert.equal(manual('p1').pitch,-1,
    'Dedicated K nose-up must work in manual mode');
  console.log('PASS: assisted/manual keyboard aerial modes and independent inputs');
}

 
// The responsive default should make the ball livelier without changing
// the documented reference mass, capping speed or weakening Classic mode.
{
  assert.equal(tuning.BALL_FEEL_MODE,'responsive',
    'New players must start with the responsive ball feel');
  assert.equal(tuning.BALL_MASS_REFERENCE,30);
  const saved=tuning.BALL_FEEL;
  const classic={gravity:1,floor:1,ramp:1,rolling:1,impact:1,pop:1};
  const responsive={gravity:.97,floor:1.1,ramp:1.13,rolling:.70,
    impact:1.12,pop:1.22};
  const start={x:0,y:scaledBallRadius+.002,z:0,vx:0,vy:-11,vz:0,
    wx:0,wy:0,wz:0,onGround:false,onRamp:false,onWall:false};
  tuning.BALL_FEEL=classic;
  Object.assign(ball,start);
  stepBall(1/120);
  const classicBounce=ball.vy;
  tuning.BALL_FEEL=responsive;
  Object.assign(ball,start);
  stepBall(1/120);
  const livelyBounce=ball.vy;
  assert(livelyBounce>classicBounce+.5,
    'Responsive ball should bounce noticeably higher than Classic');
  assert(livelyBounce<10,'Ball gained too much energy on a floor bounce');
  const touchCar=cars[0];
  const impact={x:0,y:.55,z:3.2,vx:0,vy:0,vz:0,
    wx:0,wy:0,wz:0,onGround:false,onRamp:false,onWall:false};
  Object.assign(touchCar,{x:0,y:.55,z:0,yaw:0,vx:0,vy:0,vz:26,
    ground:true,wallRide:false,airQuat:null,pitch:0,roll:0,
    ballHitCooldown:0});
  tuning.BALL_FEEL=classic;
  Object.assign(ball,impact);hitBall(touchCar);
  const classicShot=ball.vz;
  Object.assign(touchCar,{x:0,y:.55,z:0,yaw:0,vx:0,vy:0,vz:26,
    ballHitCooldown:0});
  tuning.BALL_FEEL=responsive;
  Object.assign(ball,impact);hitBall(touchCar);
  assert(ball.vz>classicShot+0.5,
    'Responsive ground contact should produce a stronger clean touch');
  assert(ball.vz<tuning.MAX_BALL_SPEED,
    'Responsive touch exceeded the ball speed limit');
  tuning.BALL_FEEL=saved;
  console.log('PASS: live responsive ball bounce, touch power and Classic fallback');
}
