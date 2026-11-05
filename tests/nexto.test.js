'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const adapter=require('../lib/nexto/adapter.js');
const fixture=require('./nexto-observation-fixture.json');
assert.equal(adapter.actions.length,90);
const obs=adapter.buildBatch(fixture.state,fixture.ids,fixture.previous);
for(let b=0;b<fixture.ids.length;b++)for(const [key,width] of [['query',32],['entities',41*24],['mask',41]]){
 const expected=fixture.expected[b][key];let worst=0;
 expected.forEach((v,i)=>worst=Math.max(worst,Math.abs(v-obs[key][b*width+i])));
 assert(worst<8e-7,key+' diverged from official Nexto observations: '+worst);
}
assert(adapter.actions.every(a=>a.length===8&&a.every(Number.isFinite)));
assert.equal(adapter.controls([1,1,-1,1,0,1,1,0],true).pitch,1,'RL nose-down pitch must map to this engine');
assert.deepEqual(adapter.controls([1,0,0,0,1,1,0,1],true).dodge,[0,1],'Side flip uses roll direction');
assert.equal(adapter.controls([0,0,0,0,0,1,0,0],false).jumpHeld,true);
console.log('PASS: official Nexto observation parity for both teams, rotations, boost pads and previous actions; all 90 action mappings');
class FakeWorker{
 constructor(){FakeWorker.last=this;this.messages=[];}
 postMessage(m){this.messages.push(m);}
 terminate(){this.terminated=true;}
 deliver(m){this.onmessage({data:m});}
}
const window={};
vm.runInNewContext(fs.readFileSync('lib/nexto/client.js','utf8'),{window,Worker:FakeWorker,
 RocketNextoAdapter:adapter,URL,location:{href:'https://example.test/rocket-ball/'},setTimeout,clearTimeout});
(async()=>{
 const client=new window.RocketNexto.Controller();const loading=client.load();const worker=FakeWorker.last;
 assert.equal(client.ready,false);worker.deliver({type:'ready'});await loading;assert(client.ready);
 const state={cars:[{ai:false,demo:false},{ai:true,demo:false}],ball:{}};
 client.update(1/15,()=>state);assert.equal(worker.messages.at(-1).type,'predict');
 const count=worker.messages.length;client.update(1,()=>{throw Error('Must not queue work while busy');});assert.equal(worker.messages.length,count);
 worker.deliver({type:'actions',epoch:client.epoch,actions:{1:[1,0,-1,0,0,1,1,0]},ms:3});
 const c={team:1,x:0,z:15,yaw:0,boost:30};const live={cars:[c],ball:{x:8,z:0,vx:0,vz:0}};
 assert.equal(client.controls(c,1,live).jump,true);assert.equal(client.controls(c,1,live).jump,false,'Held jump must not retrigger a second jump');
 assert.equal(client.controls(c,1,live).jumpHeld,true);
 const old=client.epoch;client.reset();worker.deliver({type:'actions',epoch:old,actions:{1:[1,1,1,1,1,1,1,1]},ms:3});
 assert.equal(Object.keys(client.actions).length,0,'Stale predictions must not leak across kickoffs');
 worker.deliver({type:'error',epoch:old,message:'stale'});assert(client.ready,'An old match error must not stop a new kickoff');
 const failed=new window.RocketNexto.Controller();const rejected=failed.load();FakeWorker.last.deliver({type:'error',message:'test failure'});
 await assert.rejects(rejected);assert.equal(failed.status,'failed');assert.equal(failed.ready,false);
 const stoppedWorker=FakeWorker.last;const retry=failed.load();stoppedWorker.deliver({type:'ready'});assert.equal(failed.ready,false,'A terminated worker must not complete a retry');FakeWorker.last.deliver({type:'ready'});await retry;assert(failed.ready,'A failed load must support retry');
 console.log('PASS: asynchronous worker loading, one in-flight prediction, edge-triggered jumps, kickoff generations and failure/retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
