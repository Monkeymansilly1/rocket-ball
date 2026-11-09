(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketMatchTools=factory();})(globalThis,function(){
'use strict';
const CHATS=Object.freeze(['I got it!','Defending…','Take the shot!','Need boost!','Nice shot!','Great pass!','What a save!','Thanks!','Sorry!','No problem.','Good luck!','Well played!']);
class ChatLimiter{
 constructor(){this.times=new Map();}
 accept(player,index,now){if(!Number.isInteger(index)||!CHATS[index])return false;const recent=(this.times.get(player)||[]).filter(t=>now-t<4);if(recent.length>=3)return false;recent.push(now);this.times.set(player,recent);return true;}
}
class Series{
 constructor(bestOf=1){this.reset(bestOf);}
 reset(bestOf=1){this.bestOf=[1,3,5].includes(Number(bestOf))?Number(bestOf):1;this.wins=[0,0];this.game=1;this.recorded=null;}
 record(id,score){if(this.recorded===id||score[0]===score[1])return false;this.recorded=id;this.wins[score[1]>score[0]?1:0]++;return true;}
 get winner(){const needed=Math.floor(this.bestOf/2)+1;return this.wins.findIndex(n=>n>=needed);}
 next(){if(this.winner>=0){this.wins=[0,0];this.game=1;}else this.game++;this.recorded=null;}
 snapshot(){return {bestOf:this.bestOf,wins:[...this.wins],game:this.game};}
 load(p){if(!p||![1,3,5].includes(p.bestOf)||!Array.isArray(p.wins)||p.wins.length!==2||!p.wins.every(n=>Number.isInteger(n)&&n>=0&&n<=3)||!Number.isInteger(p.game))return false;Object.assign(this,{bestOf:p.bestOf,wins:[...p.wins],game:p.game});return true;}
}
function validReplay(value){
 if(!value||value.version!==1||!Array.isArray(value.frames)||value.frames.length<2||value.frames.length>18001||!Array.isArray(value.players)||value.players.length<1||value.players.length>6||!value.players.every(p=>p&&typeof p==='object'))return false;
 const body=p=>p&&['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<100000)&&Array.isArray(p.q)&&p.q.length===4&&p.q.every(Number.isFinite)&&Math.abs(Math.hypot(...p.q)-1)<.02;
 let time=-Infinity;
 for(const frame of value.frames){if(!Number.isFinite(frame.time)||frame.time<0||frame.time>7200||frame.time<=time||!Array.isArray(frame.cars)||frame.cars.length!==value.players.length||!frame.cars.every(body)||!body(frame.ball))return false;time=frame.time;}
 return true;
}
class ReplayStore{
 constructor(storage,database=globalThis.indexedDB){this.storage=storage;this.database=database;}
 async db(){
  if(!this.database)return null;
  if(!this.opened)this.opened=new Promise((resolve,reject)=>{const r=this.database.open('rocketBallReplaysV1',1);r.onupgradeneeded=()=>r.result.createObjectStore('replays',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Replay storage could not open. Export your replay instead.'));});
  return this.opened;
 }
 async operation(mode,action){const db=await this.db();if(!db)return null;return new Promise((resolve,reject)=>{const tx=db.transaction('replays',mode);let result;const request=action(tx.objectStore('replays'));request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(Error('Replay storage is full or unavailable. Export the replay instead.'));tx.onabort=tx.onerror;});}
 async list(){
  if(this.database){const entries=await this.operation('readonly',store=>store.getAll());return entries.filter(p=>p&&validReplay(p.data)).sort((a,b)=>b.createdAt-a.createdAt);}
  try{const p=JSON.parse(this.storage.getItem('rocketSavedReplaysV1')||'[]');return Array.isArray(p)?p.filter(p=>p&&typeof p.id==='string'&&validReplay(p.data)):[];}catch(_){return [];}
 }
 async save(data,name='Saved match'){
  if(!validReplay(data))throw Error('This replay is incomplete or invalid.');
  const entry={id:globalThis.crypto?.randomUUID?.()||String(Date.now()),name:String(name).slice(0,60),createdAt:Date.now(),data};
  if(this.database){await this.operation('readwrite',store=>store.put(entry));for(const old of (await this.list()).slice(5))await this.remove(old.id);return entry;}
  const entries=[entry,...await this.list()].slice(0,5);
  while(entries.length){try{this.storage.setItem('rocketSavedReplaysV1',JSON.stringify(entries));return entry;}catch(_){if(entries.length===1)throw Error('Browser storage is full. Export the replay instead.');entries.pop();}}
 }
 async remove(id){if(this.database)return this.operation('readwrite',store=>store.delete(id));this.storage.setItem('rocketSavedReplaysV1',JSON.stringify((await this.list()).filter(x=>x.id!==id)));}
 import(text){
  if(text.length>25*1024*1024)throw Error('Replay files must be under 25 MB.');
  const data=JSON.parse(text);if(!validReplay(data))throw Error('This is not a valid Rocket Ball replay.');
  const clean=p=>{const out={q:[...p.q]};for(const key of ['x','y','z','vx','vy','vz','yaw','pitch','roll','boost','engineLoad','demoTimer','fl','wx','wy','wz','jumps','jt'])if(Number.isFinite(p[key]))out[key]=p[key];out.ground=p.ground===true;return out;};
  return {version:1,score:Array.isArray(data.score)?data.score.slice(0,2).map(n=>Number.isSafeInteger(n)&&n>=0?n:0):[0,0],players:data.players.map(p=>({name:String(p.name||'PLAYER').slice(0,12),car:['octane','fennec','scorpion'].includes(p.car)?p.car:'octane',team:p.team===1?1:0,wheel:['stock','chrome','blackout'].includes(p.wheel)?p.wheel:'stock',decal:['none','stripes','lightning'].includes(p.decal)?p.decal:'none',boost:['blue','amber','purple','smoke'].includes(p.boost)?p.boost:'blue',colour:typeof p.colour==='string'&&/^#[0-9a-f]{6}$/i.test(p.colour)?p.colour:null})),frames:data.frames.map(f=>({time:f.time,cut:f.cut===true,cars:f.cars.map(clean),ball:clean(f.ball)}))};
 }
}
return {CHATS,ChatLimiter,Series,ReplayStore,validReplay};
});
