'use strict';
const http=require('node:http');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,randomUUID,createHash,timingSafeEqual}=require('node:crypto');
const {WebSocketServer,WebSocket}=require('ws');
const {profile}=require('../lib/online-rooms');
const digest=s=>createHash('sha256').update(s).digest();
function createService({dbPath='rocket-ball.sqlite',origins=['https://monkeymansilly1.github.io'],graceMs=30000,matchTimeoutMs=45000,now=Date.now}={}){
 const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY,secret BLOB NOT NULL,name TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 1000,wins INTEGER NOT NULL DEFAULT 0,losses INTEGER NOT NULL DEFAULT 0,games INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS matches(id TEXT PRIMARY KEY,blue TEXT NOT NULL,orange TEXT NOT NULL,state TEXT NOT NULL,score TEXT,result TEXT,created INTEGER NOT NULL);`);
 // In-flight peer matches cannot survive the authority restarting. Completed ratings do.
 db.prepare("UPDATE matches SET state='cancelled' WHERE state IN ('connecting','playing')").run();
 const clients=new Map(),queue=new Map(),matches=new Map();let closing=false;
 const summary=id=>db.prepare('SELECT id,name,rating,wins,losses,games FROM players WHERE id=?').get(id);
 const send=(id,p)=>{const ws=clients.get(id);if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(p));};
 const both=(m,p)=>m.players.forEach(id=>send(id,p));
 const server=http.createServer((req,res)=>{if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:!closing,queued:queue.size,active:matches.size}));}else{res.writeHead(404);res.end();}});
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{if(req.url!=='/ranked'||!origins.includes(req.headers.origin)){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));});
 function complete(m,score,reason='confirmed'){
  if(!matches.has(m.id))return;
  const players=m.players.map(summary),expected=1/(1+10**((players[1].rating-players[0].rating)/400));
  const winner=score[0]===score[1]?null:score[0]>score[1]?0:1;
  const delta=Math.round(32*((winner===null?.5:winner===0?1:0)-expected));
  db.exec('BEGIN IMMEDIATE');try{
   for(let i=0;i<2;i++)db.prepare('UPDATE players SET rating=MAX(0,rating+?),games=games+1,wins=wins+?,losses=losses+? WHERE id=?').run(i?-delta:delta,winner===i?1:0,winner!==null&&winner!==i?1:0,m.players[i]);
   const result={score,reason,players:m.players.map(summary),changes:m.players.map((id,i)=>summary(id).rating-players[i].rating)};
   db.prepare("UPDATE matches SET state='complete',score=?,result=? WHERE id=?").run(JSON.stringify(score),JSON.stringify(result),m.id);db.exec('COMMIT');
   m.players.forEach((id,i)=>{send(id,{type:'result',match:m.id,...result,own:result.players[i],change:result.players[i].rating-players[i].rating});const ws=clients.get(id);if(ws)ws.match=null;});
  }catch(error){db.exec('ROLLBACK');throw error;}
  matches.delete(m.id);
 }
 function cancel(m,message,state='cancelled'){db.prepare('UPDATE matches SET state=? WHERE id=?').run(state,m.id);both(m,{type:'cancelled',match:m.id,message});m.players.forEach(id=>{const ws=clients.get(id);if(ws)ws.match=null;});matches.delete(m.id);}
 function pair(){
  const entries=[...queue.values()].sort((a,b)=>a.at-b.at);
  for(const a of entries){if(!queue.has(a.id))continue;const candidates=entries.filter(b=>b.id!==a.id&&queue.has(b.id)&&Math.abs(b.rating-a.rating)<=Math.min(1000,150+(now()-Math.min(a.at,b.at))/1000*10)).sort((x,y)=>Math.abs(x.rating-a.rating)-Math.abs(y.rating-a.rating));
   const b=candidates[0];if(!b)continue;queue.delete(a.id);queue.delete(b.id);
   const bytes=randomBytes(6),alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(bytes,x=>alphabet[x%32]).join('');
   const m={id:randomUUID(),players:[a.id,b.id],profiles:[a.profile,b.profile],code,phase:'connecting',created:now(),started:new Set(),reports:new Map(),missing:new Map()};matches.set(m.id,m);
   db.prepare("INSERT INTO matches(id,blue,orange,state,created) VALUES(?,?,?,'connecting',?)").run(m.id,a.id,b.id,m.created);
   m.players.forEach((id,i)=>{const ws=clients.get(id);ws.match=m.id;send(id,{type:'match',match:m.id,code,role:i?'guest':'host',opponent:summary(m.players[1-i])});});
  }
 }
 function matchFor(ws,p){const m=matches.get(ws.match);return m&&p.match===m.id&&m.players.includes(ws.id)?m:null;}
 wss.on('connection',ws=>{
  ws.alive=true;ws.tokens=30;ws.refilled=now();ws.authDeadline=setTimeout(()=>{if(!ws.id)ws.close(1008,'Authentication required');},10000);
  ws.on('pong',()=>ws.alive=true);
  ws.on('error',()=>{});
  ws.on('message',data=>{
   try{
    const elapsed=now()-ws.refilled;ws.tokens=Math.min(30,ws.tokens+elapsed/1000*5);ws.refilled=now();if(ws.tokens<1){ws.close(1008,'Too many requests');return;}ws.tokens--;
    const p=JSON.parse(String(data));if(!p||typeof p.type!=='string')return;
    if(p.type==='auth'&&!ws.id){
     if(!/^[a-f0-9-]{36}$/.test(p.id)||!/^[a-f0-9]{64}$/.test(p.secret)){ws.close(1008,'Invalid account');return;}
     const old=db.prepare('SELECT secret FROM players WHERE id=?').get(p.id),hash=digest(p.secret);
     if(old&&!timingSafeEqual(Buffer.from(old.secret),hash)){ws.close(1008,'Invalid account');return;}
     if(!old)db.prepare('INSERT INTO players(id,secret,name) VALUES(?,?,?)').run(p.id,hash,profile(p.profile).name);
     const existing=clients.get(p.id);if(existing&&existing!==ws){existing.close(4001,'Account opened in another tab');}
     ws.id=p.id;ws.profile=profile(p.profile);clients.set(p.id,ws);clearTimeout(ws.authDeadline);
     const m=[...matches.values()].find(m=>m.players.includes(ws.id));if(m){ws.match=m.id;m.missing.delete(ws.id);send(ws.id,{type:'match',match:m.id,code:m.code,role:m.players.indexOf(ws.id)?'guest':'host',resumed:true});if(m.ready&&m.phase==='connecting'&&m.players[1]===ws.id)send(ws.id,{type:'join',match:m.id,code:m.code});}
     if(!m&&typeof p.match==='string'){
      const previous=db.prepare('SELECT state,result,blue,orange FROM matches WHERE id=? AND (blue=? OR orange=?)').get(p.match,ws.id,ws.id);
      if(previous?.state==='complete'){const result=JSON.parse(previous.result),i=previous.blue===ws.id?0:1;send(ws.id,{type:'result',match:p.match,...result,own:result.players[i],change:result.changes?.[i]||0});}
      else if(previous)send(ws.id,{type:'cancelled',match:p.match,message:'The previous ranked match is no longer active.'});
     }
     send(ws.id,{type:'account',own:summary(ws.id)});return;
    }
    if(!ws.id)return;
    if(p.type==='queue'&&!ws.match){ws.profile=profile(p.profile);db.prepare('UPDATE players SET name=? WHERE id=?').run(ws.profile.name,ws.id);queue.set(ws.id,{id:ws.id,profile:ws.profile,rating:summary(ws.id).rating,at:now()});send(ws.id,{type:'queued'});pair();}
    else if(p.type==='cancel'&&!ws.match){queue.delete(ws.id);send(ws.id,{type:'cancelled',message:'Search cancelled.'});}
    else if(p.type==='leaderboard')send(ws.id,{type:'leaderboard',players:db.prepare('SELECT name,rating,wins,losses,games FROM players WHERE games>0 ORDER BY rating DESC,games DESC LIMIT 20').all()});
    else{
     const m=matchFor(ws,p);if(!m)return;
     if(p.type==='ready'&&m.players[0]===ws.id&&m.phase==='connecting'){m.ready=true;send(m.players[1],{type:'join',match:m.id,code:m.code});}
     else if(p.type==='started'){m.started.add(ws.id);if(m.started.size===2){m.phase='playing';db.prepare("UPDATE matches SET state='playing' WHERE id=?").run(m.id);both(m,{type:'playing',match:m.id});}}
     else if(p.type==='result'&&m.phase==='playing'){
      if(!Array.isArray(p.score)||p.score.length!==2||!p.score.every(n=>Number.isInteger(n)&&n>=0&&n<=999))return;
      m.reports.set(ws.id,p.score);if(!m.reportedAt)m.reportedAt=now();
      if(m.reports.size===2){const [a,b]=[...m.reports.values()];if(a[0]===b[0]&&a[1]===b[1])complete(m,a);else cancel(m,'Players reported different scores. No rating changed.','disputed');}
     }else if(p.type==='forfeit'){if(m.phase==='playing')complete(m,m.players[0]===ws.id?[0,1]:[1,0],'forfeit');else cancel(m,'Match cancelled before kickoff.');}
    }
   }catch(_){send(ws.id,{type:'error',message:'Request could not be processed.'});}
  });
  ws.on('close',()=>{clearTimeout(ws.authDeadline);if(clients.get(ws.id)!==ws)return;clients.delete(ws.id);queue.delete(ws.id);const m=matches.get(ws.match);if(m)m.missing.set(ws.id,now());});
 });
 const ticker=setInterval(()=>{
  pair();for(const m of [...matches.values()]){
   if(m.phase==='connecting'&&now()-m.created>matchTimeoutMs){cancel(m,'Players could not connect. No rating changed.');continue;}
   if(m.phase==='playing'&&m.missing.size){const expired=[...m.missing].filter(([,at])=>now()-at>graceMs);if(expired.length){if(m.missing.size===2)cancel(m,'Both players disconnected. No rating changed.');else complete(m,m.players[0]===expired[0][0]?[0,1]:[1,0],'disconnect');continue;}}
   if(m.reportedAt&&now()-m.reportedAt>graceMs)cancel(m,'Result confirmation timed out. No rating changed.','unconfirmed');
   else if(now()-m.created>40*60*1000)cancel(m,'Match expired. No rating changed.');
  }
 },500);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},10000);
 async function close(){closing=true;clearInterval(ticker);clearInterval(heartbeat);for(const ws of wss.clients){clearTimeout(ws.authDeadline);ws.terminate();}await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));db.close();}
 return {server,close,db};
}
if(require.main===module){
 const service=createService({dbPath:process.env.DB_PATH||'rocket-ball.sqlite',origins:(process.env.ALLOWED_ORIGINS||'https://monkeymansilly1.github.io').split(',').map(s=>s.trim())});
 service.server.listen(Number(process.env.PORT)||8787,'0.0.0.0',()=>console.log('Rocket Ball ranked server listening on port '+(Number(process.env.PORT)||8787)));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>service.close().then(()=>process.exit(0)));
}
module.exports={createService};
