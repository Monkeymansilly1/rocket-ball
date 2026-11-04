'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict'),THREE=require('../lib/three.min.js');
const Rig=require('../lib/ball-camera.js');
const source=fs.readFileSync('game.js','utf8');
const settingsCode=source.slice(source.indexOf('const cameraSettings ='),source.indexOf('BLUE = TEAM_COLOR_PRESETS[colourVisionMode]'));
function loadCamera(camera){return new Function('localStorage','TEAM_COLOR_PRESETS',settingsCode+'return cameraSettings;')({getItem:()=>JSON.stringify({camera})},{});}
assert.equal(loadCamera({fov:110,distance:5.6,height:2.2}).fov,105,'Undo the accidentally saved preset from the last update');
assert.equal(loadCamera({fov:110,distance:5.6,height:2.2,fovRevision:1}).fov,110,'An explicit later FOV choice must remain available');
assert.equal(loadCamera({fov:87,distance:8,height:3.5}).fov,87,'Preserve existing custom FOV settings');
const settings={fov:105,distance:5.6,height:2.2,stiffness:10};
const car={x:0,y:.55,z:0,yaw:0,vx:0,vy:0,vz:0};
const ball={x:0,y:1.825,z:30,vx:0,vy:0,vz:0};
const options={car,ball,forward:{x:0,y:0,z:1},settings,aspect:16/9,ballCam:true,dt:1/120};
for(const aspect of [4/3,16/9,32/9]){
  assert.equal(Rig.update({}, {...options,aspect}).fov,105,'Configured FOV must be preserved without aspect conversion');
  assert.equal(Rig.update({}, {...options,aspect,settings:{...settings,fov:87}}).fov,87,'Custom FOV must remain unchanged');
}
assert.equal(Rig.update({}, {...options,car:{...car,vz:30,fl:1}}).fov,111,'Existing speed/boost FOV response must be retained');
const state={};let result;
for(let i=0;i<120;i++)result=Rig.update(state,options);
function visible(point,view=result){
 const camera=new THREE.PerspectiveCamera(view.fov,options.aspect,.1,2000);
 camera.position.set(view.position.x,view.position.y,view.position.z);camera.lookAt(view.target.x,view.target.y,view.target.z);camera.updateMatrixWorld();
 const p=new THREE.Vector3(point.x,point.y,point.z).project(camera);
 return Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>0&&p.z<1;
}
assert(visible({...car,y:car.y+.5})&&visible(ball),'Both car and ball must be framed during normal play');
const oldX=result.position.x,oldZ=result.position.z;car.x+=18;car.z+=12;ball.x+=18;ball.z+=12;
result=Rig.update(state,options);
assert(Math.abs(result.position.x-oldX-18)<1e-8&&Math.abs(result.position.z-oldZ-12)<1e-8,'A boosting car must not outrun its camera');
let previous=state.heading;
for(const z of [3,.1,-.1,-3,-20]){
 ball.x=car.x;ball.z=car.z+z;result=Rig.update(state,options);
 assert(Math.abs(state.heading-previous)<=4.5/120+1e-9,'Ball crossing the bumper must not snap the orbit 180 degrees');previous=state.heading;
}
ball.x=car.x;ball.y=40;ball.z=car.z;
for(let i=0;i<360;i++)result=Rig.update(state,options);
for(const point of [{...car,y:car.y-.3},{...car,y:car.y+1.4},{...ball,y:ball.y-1.825},{...ball,y:ball.y+1.825}])assert(visible(point),'Overhead framing must include the full car and ball, not just their centres');
assert(result.position.y<44&&result.position.y>=.8);
car.x=79.3;car.y=12;car.z=88;ball.x=0;ball.y=15;ball.z=0;
for(let i=0;i<180;i++)result=Rig.update(state,options);
assert(Math.abs(result.position.x)<=86&&Math.abs(result.position.z)<=110,'Wall orbit must stay out of the stands');
assert(result.position.y>=.8&&result.position.y<=43.35);
for(const aspect of [4/3,16/9,32/9,.6]){
 result=Rig.update({}, {...options,aspect,lookX:.8,lookY:-.6});
 for(const value of [...Object.values(result.position),...Object.values(result.target),result.fov])assert(Number.isFinite(value));
}
const chase=Rig.update({}, {...options,ballCam:false,forward:{x:0,y:1,z:0}});
assert(Number.isFinite(chase.position.x),'Vertical car orientation must retain a stable chase heading');
console.log('PASS: preserved default/custom FOV, car/ball framing, boost following, bumper crossings, overhead balls, walls and controller look');
