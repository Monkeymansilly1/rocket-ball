'use strict';
const assert=require('node:assert/strict');const THREE=require('../lib/three.min');const {constrain,SnapshotBuffer}=require('../lib/arena-network');const {flipReset,waveDash}=require('../lib/advanced-mechanics');const {Series,ChatLimiter,ReplayStore,validReplay}=require('../lib/match-tools');const Replay=require('../lib/replay');
const bounds={min:[-1.25,-.48,-2],max:[1.25,1,2]};
for(const yaw of [0,.3,1,2])for(const roll of [0,.8,Math.PI]){
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,yaw,roll)),c={x:85,y:12,z:40,vx:40,vy:0,vz:0};constrain(c,{quaternion:q,bounds});
 for(const x of bounds.min[0]===-1.25?[-1.25,1.25]:[])for(const y of [-.48,1])for(const z of [-2,2])assert(new THREE.Vector3(x,y,z).applyQuaternion(q).x+c.x<=80+1e-9,'Rotated visible body stays inside side wall');assert(c.vx<=0);
}
for(const z of [-130,130]){const c={x:0,y:2,z,vx:0,vy:0,vz:Math.sign(z)*40};constrain(c);assert(Math.abs(c.z)<=116);assert(c.vz===0,'Goal back stops an outgoing car');}
const corner={x:82,y:12,z:110,vx:30,vy:0,vz:30};constrain(corner);assert(Math.hypot(corner.x-66,corner.z-90)<13);
const ceiling={x:0,y:60,z:0,vx:0,vy:10,vz:0};constrain(ceiling);assert(ceiling.y<=43);
const buf=new SnapshotBuffer(.05),body=x=>({x,y:4,z:0,vx:20,vy:0,vz:0,q:[0,0,0,1]});const packet=(n,x,state='play',round=1)=>({sequence:n,time:n*.05,state,round,cars:[body(x)],ball:body(x)});
buf.push(packet(1,0),1);buf.push(packet(2,1),1.05);assert(!buf.push(packet(1,50),1.06),'Old packets cannot rewind a car');assert(Math.abs(buf.sample(1.075).cars[0].x-.5)<1e-9);assert.equal(buf.sample(10).cars[0].x,1,'Packet loss freezes at the last valid position');assert(buf.sample(10).stale);buf.push(packet(3,80,'kick',2),10);assert.equal(buf.sample(10).cars[0].x,80,'Kickoffs must not interpolate across the field');
for(const inverted of [false,true]){
 const q=new THREE.Quaternion();if(inverted)q.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);
 const c={x:0,y:10,z:0,ground:false,jumps:2,jt:5,demoTimer:0,vx:12,vy:1,vz:9};const down=new THREE.Vector3(0,-2.1,.17).applyQuaternion(q),ball={x:down.x,y:10+down.y,z:down.z};
 assert(flipReset(c,ball,q));assert.equal(c.jumps,1);assert(c.flipReset);assert.deepEqual([c.vx,c.vy,c.vz],[12,1,9]);assert(!flipReset(c,ball,q),'Continuous contact grants one reset');
 assert(!flipReset({...c,ballResetContact:false}, {x:3,y:10,z:0},q),'Side contact cannot grant a reset');
}
const dash={vx:0,vy:0,vz:20,flip:0};assert(waveDash(dash,{dodge:[1,0]},new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)));assert.equal(dash.vz,30);assert.equal(dash.vy,0);assert(!waveDash(dash,{dodge:[0,0]},new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)));
const series=new Series(5);assert(series.record('a',[2,1]));assert(!series.record('a',[2,1]));series.next();series.record('b',[2,0]);assert.equal(series.winner,-1);series.next();series.record('c',[3,2]);assert.equal(series.winner,0);series.next();assert.deepEqual(series.wins,[0,0]);
const chats=new ChatLimiter();for(let n=0;n<3;n++)assert(chats.accept(0,n,1));assert(!chats.accept(0,4,1));assert(chats.accept(1,0,1));assert(chats.accept(0,0,6));assert(!chats.accept(0,100,6));
(async()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},store=new ReplayStore(storage,null);
 const data={version:1,players:[{name:'CAR',car:'fennec',team:0,decal:'stripes',wheel:'chrome',boost:'purple'}],frames:[{time:0,cars:[body(0)],ball:body(0)},{time:1,cars:[body(2)],ball:body(2)},{time:2,cut:true,cars:[body(80)],ball:body(80)}]};assert(validReplay(data));assert.equal(Replay.sample(data.frames,1.5).cars[0].x,2);
 data.frames[0].cars[0].mesh={bad:true};const clean=store.import(JSON.stringify(data));assert(!('mesh'in clean.frames[0].cars[0]));assert.equal(clean.players[0].decal,'stripes');assert.throws(()=>store.import('{"version":1}'));
 for(let n=0;n<7;n++)await store.save(clean,'Replay '+n);assert.equal((await store.list()).length,5);await store.remove((await store.list())[0].id);assert.equal((await store.list()).length,4);
 console.log('PASS: oriented enclosure, goal-back collision, buffered snapshots, tyre flip resets, wave dashes, series, chat limits and safe replay storage/import');
})().catch(error=>{console.error(error);process.exitCode=1;});
