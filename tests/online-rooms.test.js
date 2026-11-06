'use strict';
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Room,controls,profile,validCode,normalize}=require('../lib/online-rooms.js');
const peers=new Map();let nextId=0;
class Connection extends EventEmitter{
 constructor(){super();this.open=false;}
 send(packet){if(this.open)queueMicrotask(()=>{if(this.other.open)this.other.emit('data',structuredClone(packet));});}
 close(){if(!this.open)return;this.open=false;this.other.open=false;this.emit('close');this.other.emit('close');}
}
class Peer extends EventEmitter{
 constructor(id){super();this.clientAssignedId=!!id;this.id=id||'guest-'+(++nextId);peers.set(this.id,this);setImmediate(()=>this.emit('open',this.id));}
 connect(id){const a=new Connection(),b=new Connection();a.other=b;b.other=a;
  setImmediate(()=>{const target=peers.get(id);if(!target){this.emit('error',{type:'peer-unavailable'});return;}target.emit('connection',b);a.open=b.open=true;a.emit('open');b.emit('open');});return a;
 }
 destroy(){peers.delete(this.id);}
}
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(setImmediate);};
(async()=>{
 assert.equal(normalize(' ab2cd3 '),'AB2CD3');assert(validCode('AB2CD3'));assert(!validCode('123'));
 assert.deepEqual(profile(null),{name:'PLAYER',car:'octane'});
 const input=controls({throttle:100,steer:NaN,jump:'yes',boost:true,pitch:-4});
 assert.equal(input.throttle,1);assert.equal(input.steer,0);assert.equal(input.jump,false);assert.equal(input.boost,true);assert.equal(input.pitch,-1);
 let starts=0,received,ended='',status;const host=new Room({Peer,onStatus:s=>status=s,onStart:()=>starts++,onData:p=>received=p,onClose:m=>ended=m});
 const guest=new Room({Peer,onStart:()=>starts++});const third=new Room({Peer});
 try{
  host.create({name:'Host',car:'scorpion'});await flush();assert.equal(host.state,'waiting');assert(validCode(host.code));
  const originalCode=host.code,originalPeer=host.peer;
  host.join('bad',{});assert.equal(status.code,originalCode,'An invalid join attempt must not hide the existing room code');
  host.join(originalCode.toLowerCase(),{});assert.equal(host.peer,originalPeer,'Joining your own code must preserve the hosting room');assert(status.message.includes('own room code'));
  guest.join(host.code.toLowerCase(),{name:'Friend',car:'fennec'});await flush();assert.equal(host.state,'connected');assert.equal(guest.state,'connected');assert.equal(starts,2);
  assert(guest.peer.clientAssignedId,'Joining must not depend on the public service HTTP player-ID endpoint');
  assert.equal(host.remote.car,'fennec');assert.equal(guest.remote.name,'Host');
  guest.send({type:'input',seq:1,controls:{throttle:1}});await flush();assert.equal(received.seq,1);
  third.join(host.code,{});await flush();assert.equal(third.state,'error');assert.equal(host.state,'connected','A third player must not replace either participant');
  guest.close();await flush();assert.equal(host.state,'error');assert(ended.includes('disconnected'));
  host.create({});const stale=host.peer;host.close();stale.emit('open');assert.equal(host.state,'idle','Closed attempts cannot reopen the room');
  guest.join('AB2CD3',{});await flush();assert.equal(guest.state,'error');
  const messages=[];const failure=new Room({Peer,onStatus:s=>messages.push(s.message)});
  try{failure.create({});await flush();failure.peer.emit('error',{type:'socket-error'});assert(messages.at(-1).includes('blocked or refused'));assert.equal(failure.lastError,'socket-error');
   failure.create({});assert.equal(failure.lastError,null,'A new attempt must clear the previous failure reason');
  }finally{failure.close();}
  const broken=new Room({Peer,onStart(){throw Error('Startup failed');}});const conn=new Connection();broken.role='guest';broken.attach(conn,broken.generation);
  try{assert.doesNotThrow(()=>conn.emit('data',{type:'welcome',version:1,profile:{}}));assert.equal(broken.state,'error','A match startup exception must produce an error, not a silent connected state');}finally{broken.close();}
  console.log('PASS: room codes, profiles, input validation, two-player handshake, full rooms, missing rooms, disconnect and stale callbacks');
 }finally{host.close();guest.close();third.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
