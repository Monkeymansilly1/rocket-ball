'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const {randomUUID,randomBytes}=require('node:crypto');const {mkdtempSync,rmSync}=require('node:fs');const {tmpdir}=require('node:os');const {join}=require('node:path');const {WebSocket}=require('ws');const {createService}=require('./index');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function client(url,account={id:randomUUID(),secret:randomBytes(32).toString('hex')}){
 const ws=new WebSocket(url,{origin:'http://localhost'}),messages=[];ws.on('message',data=>messages.push(JSON.parse(String(data))));
 await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});const send=p=>ws.send(JSON.stringify(p));
 const next=async type=>{for(let i=0;i<500;i++){const n=messages.findIndex(p=>p.type===type);if(n>=0)return messages.splice(n,1)[0];await wait(10);}throw Error('No '+type+': '+JSON.stringify(messages));};
 send({type:'auth',...account,profile:{name:account.id.slice(0,8)}});await next('account');return {ws,send,next,messages,account};
}
test('ranked service: auth, queue, ready barrier, agreed results, durable Elo, disputes, reconnection and forfeits',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'rocket-ranked-')),dbPath=join(dir,'ratings.sqlite');let service,clients=[];let time=Date.now();
 async function boot(){service=createService({dbPath,origins:['http://localhost'],graceMs:1000,now:()=>time});await new Promise(r=>service.server.listen(0,'127.0.0.1',r));return 'ws://127.0.0.1:'+service.server.address().port+'/ranked';}
 try{
  let url=await boot();const a=await client(url),b=await client(url);clients.push(a,b);
  const denied=new WebSocket(url,{origin:'https://untrusted.example'});await new Promise(r=>denied.once('error',r));assert.equal(denied.readyState,WebSocket.CLOSED);
  async function pair(){a.send({type:'queue',profile:{name:'Blue',car:'fennec'}});b.send({type:'queue',profile:{name:'Orange',car:'scorpion'}});const ma=await a.next('match'),mb=await b.next('match');assert.equal(ma.match,mb.match);assert.match(ma.code,/^[A-HJ-NP-Z2-9]{6}$/);const host=ma.role==='host'?a:b,guest=host===a?b:a;await wait(30);assert(!guest.messages.some(p=>p.type==='join'));host.send({type:'ready',match:ma.match});assert.equal((await guest.next('join')).code,ma.code);for(const p of [a,b])p.send({type:'started',match:ma.match});await a.next('playing');await b.next('playing');return {id:ma.match,host,guest};}
  let m=await pair();a.send({type:'result',match:m.id,score:[3,1]});await wait(30);assert(!a.messages.some(p=>p.type==='result'),'One player cannot award themself a win');b.send({type:'result',match:m.id,score:[3,1]});const ra=await a.next('result'),rb=await b.next('result');assert.equal(ra.change+rb.change,0);assert.equal(Math.abs(ra.change),16);assert.equal(ra.own.games,1);
  a.send({type:'result',match:m.id,score:[100,0]});a.send({type:'leaderboard'});const board=await a.next('leaderboard');assert.equal(board.players.length,2);assert(board.players.every(p=>!p.secret&&!p.id));
  m=await pair();a.send({type:'result',match:m.id,score:[2,0]});b.send({type:'result',match:m.id,score:[0,2]});assert.match((await a.next('cancelled')).message,/different scores/);await b.next('cancelled');assert.equal(service.db.prepare('SELECT SUM(games) AS games FROM players').get().games,2);
  m=await pair();const account=b.account;b.ws.terminate();await wait(30);b.ws=(await client(url,account)).ws;clients.push({ws:b.ws});await wait(30);assert.equal(service.db.prepare('SELECT state FROM matches WHERE id=?').get(m.id).state,'playing','Reconnect must preserve the match');
  a.send({type:'forfeit',match:m.id});const forfeit=await a.next('result');assert.equal(forfeit.reason,'forfeit');assert.equal(forfeit.own.games,2);
  const recovered=await client(url,{...a.account,match:m.id});clients.push(recovered);const recoveredResult=await recovered.next('result');assert.equal(recoveredResult.own.rating,forfeit.own.rating);assert.equal(recoveredResult.reason,'forfeit','A reconnecting client can recover a completed result');
  const id=a.account.id,rating=forfeit.own.rating;for(const c of clients)c.ws.terminate();await wait(30);await service.close();url=await boot();assert.equal(service.db.prepare('SELECT rating FROM players WHERE id=?').get(id).rating,rating,'MMR survives server restarts');
  const wrong=new WebSocket(url,{origin:'http://localhost'});await new Promise(r=>wrong.once('open',r));wrong.send(JSON.stringify({type:'auth',id,secret:randomBytes(32).toString('hex')}));const code=await new Promise(r=>wrong.once('close',r));assert.equal(code,1008);
 }finally{for(const c of clients)c.ws.terminate();if(service)await service.close();rmSync(dir,{recursive:true,force:true});}
});
