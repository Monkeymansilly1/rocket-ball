'use strict';
// Two real WebRTC game clients using a local signaling server.
// Stadium drawing is covered by browser-smoke.js; disable it here for CPU-only CI.
// Run npm ci --prefix tests/online, then node tests/online-browser-smoke.js.
// Runs with the system Chrome/Chromium and only Node.js built-ins.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const {spawn, spawnSync} = require('node:child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function eventually(fn, timeout=20000) {
  const start=Date.now();
  let lastError;
  while(Date.now()-start<timeout) {
    try {const result=await fn(); if(result) return result;}catch(e){lastError=e;}
    await delay(120);
  }
  throw new Error('Timed out waiting for browser: '+(lastError?.message||'condition false'));
}
const {ExpressPeerServer}=require('./online/node_modules/peer');
const express=require('./online/node_modules/express');
const app=express();const server=http.createServer(app);
const rtcConfig=process.env.ROCKET_TEST_TURN_URL?{iceTransportPolicy:'relay',iceServers:[{urls:process.env.ROCKET_TEST_TURN_URL,username:process.env.ROCKET_TEST_TURN_USER||'localtest',credential:process.env.ROCKET_TEST_TURN_PASSWORD||'localtest'}]}:{iceServers:[]};
let idRequests=0;
const signal=ExpressPeerServer(server,{path:'/'});
// A blocked cloud /id endpoint must not stop joining. Only signaling and
// WebRTC should be needed; both peers generate their IDs locally.
app.get('/signal/peerjs/id',(req,res)=>{idRequests++;res.status(503).send('ID service unavailable');});
app.use('/signal',signal);
app.get('/game.js',(req,res)=>res.type('js').send(fs.readFileSync('game.js','utf8').replace('window.rocketArena = {','window.__onlineCelebration=()=>({style:activeGoalExplosionStyle,track:replayAnthemTrack,ownStyle:goalExplosionStyle,ownTrack:anthemSelection});window.__onlineAudioFailure=()=>{sfx.init=()=>{throw Error("Unavailable audio");};};window.__onlineEnd=()=>{clock=.001;score=[1,2];playerStats[1].goals=2;};window.__onlineStep=update;window.__onlineRoom=onlineRoom;window.__rankedClient=rankedClient;window.rocketArena = {')));
app.get('/lib/three.min.js',(req,res)=>res.type('js').send(fs.readFileSync('lib/three.min.js','utf8')+';THREE.WebGLRenderer=class extends THREE.WebGLRenderer{constructor(...args){super(...args);this.render=function(){}}};'));app.use(express.static(process.cwd()));
function chromeExecutable() {
  for(const name of [process.env.CHROME_BIN,'google-chrome','google-chrome-stable','chromium','chromium-browser']) {
    if(!name)continue;
    const p=spawnSync('which',[name],{encoding:'utf8'});
    if(p.status===0)return p.stdout.trim();
  }
  throw new Error('Chrome/Chromium is unavailable');
}
async function main() {
  const executable=chromeExecutable();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port+'/';
  const rankedService=require('../server/index').createService({dbPath:':memory:',origins:[new URL(url).origin,new URL(url.replace('127.0.0.1','localhost')).origin]});await new Promise(r=>rankedService.server.listen(0,'127.0.0.1',r));const rankedUrl='ws://127.0.0.1:'+rankedService.server.address().port+'/ranked';
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'rocket-ball-smoke-'));
  const chrome=spawn(executable,[
    '--headless=new','--allow-loopback-in-peer-connection','--force-webrtc-ip-handling-policy=default','--disable-features=WebRtcHideLocalIpsWithMdns','--no-sandbox','--disable-dev-shm-usage',
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-background-networking','--no-first-run','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
  ],{stdio:'ignore'});
  let socket;
  try {
    const port=await eventually(()=>{
      const p=path.join(profile,'DevToolsActivePort');
      if(!fs.existsSync(p))return null;
      const v=Number(fs.readFileSync(p,'utf8').split('\n')[0]);
      return Number.isInteger(v)?v:null;
    },40000);
    const targets=await eventually(async()=>{
      const response=await fetch('http://127.0.0.1:'+port+'/json/list');
      const json=await response.json();
      return json.find(x=>x.type==='page')||null;
    });
    socket=new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      socket.addEventListener('open',resolve,{once:true});
      socket.addEventListener('error',reject,{once:true});
    });
    let seq=0;
    const pending=new Map(),errors=[];
    socket.addEventListener('message',event=>{
      const msg=JSON.parse(event.data);
      if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails?.exception?.description||msg.params.exceptionDetails?.text||'Script exception');
      if(msg.id&&pending.has(msg.id)){
        const p=pending.get(msg.id); pending.delete(msg.id);
        if(msg.error)p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
      }
    });
    function call(method,params={}) {
      const id=++seq;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject});
        socket.send(JSON.stringify({id,method,params}));
      });
    }
    async function evalJS(expr,userGesture=false){
      const result=await call('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true,userGesture});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));
      return result.result?.value;
    }
    await call('Page.enable');
    await call('Runtime.enable');
    async function configure(callPage){
      await callPage('Page.addScriptToEvaluateOnNewDocument',{source:`
        Object.defineProperty(window,'Peer',{
          configurable:true,
          get(){return this.__testPeer;},
          set(PeerClass){
            this.__testPeer=class extends PeerClass{
              constructor(id,options){super(id,{...options,host:'127.0.0.1',port:${server.address().port},path:'/signal',secure:false,config:${JSON.stringify(rtcConfig)}});}
            };
          }
        });
      `});
    }
    const host={call,eval:evalJS};
    await configure(call);await call('Page.navigate',{url});
    await eventually(()=>evalJS('!!window.rocketArena'),45000);console.log('Host game loaded');
    const newTarget=await call('Target.createTarget',{url:'about:blank'});
    const info=await call('Target.getTargetInfo',{targetId:newTarget.targetId});
    const list=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    const guestSocket=new WebSocket(list.find(t=>t.id===newTarget.targetId).webSocketDebuggerUrl);
    await new Promise(r=>guestSocket.addEventListener('open',r,{once:true}));
    let guestSeq=0;const guestPending=new Map();
    guestSocket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&guestPending.has(m.id)){guestPending.get(m.id)(m.result);guestPending.delete(m.id);}});
    const guestCall=(method,params={})=>new Promise(resolve=>{const id=++guestSeq;guestPending.set(id,resolve);guestSocket.send(JSON.stringify({id,method,params}));});
    const guestEval=async expr=>{const r=await guestCall('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
    await guestCall('Page.enable');await guestCall('Runtime.enable');await configure(guestCall);await guestCall('Page.navigate',{url:url.replace('127.0.0.1','localhost')});
    await eventually(()=>guestEval('!!window.rocketArena'),45000);console.log('Guest game loaded');
    for(const evaluate of [evalJS,guestEval])await evaluate("document.getElementById('settingGraphics').value='low';document.getElementById('settingGraphics').dispatchEvent(new Event('change'));THREE.WebGLRenderer=class extends THREE.WebGLRenderer{constructor(...args){super(...args);this.render=function(){}}};");
    for(const [i,evaluate] of [evalJS,guestEval].entries())await evaluate(`document.getElementById('name').value='RANKED${i}';document.getElementById('rankedServerUrl').value='${rankedUrl}';document.getElementById('rankedServerSave').click();document.getElementById('controlsSettings').open=false;document.getElementById('rankedFind').click();`);
    for(const evaluate of [evalJS,guestEval])await eventually(()=>evaluate('window.rocketArena.onlineStatus.state==="connected"&&window.rocketArena.state==="play"'),30000).catch(async error=>{throw Error(error.message+' '+await evaluate('JSON.stringify({s:window.rocketArena.onlineStatus,ranked:document.getElementById("rankedStatus").textContent,network:document.getElementById("networkBanner").textContent})'));});
    assert.equal(await evalJS('window.rocketArena.onlineStatus.code'),await guestEval('window.rocketArena.onlineStatus.code'));
    await guestEval('window.__rankedClient.ws.close()');await eventually(()=>guestEval('window.__rankedClient.authenticated'),10000);assert.equal(await guestEval('window.rocketArena.state'),'play','Ranked service reconnect must preserve the active peer match');
    // Both clients reach victory through the actual authoritative update path.
    const hostEval=await evalJS('window.rocketArena.onlineStatus.role')==='host'?evalJS:guestEval;
    await hostEval('window.__onlineEnd()');for(const evaluate of [evalJS,guestEval])await eventually(()=>evaluate('document.getElementById("rankedResult").textContent.includes("RESULT CONFIRMED")'),15000);
    const ratings=await Promise.all([evalJS('document.getElementById("rankedRating").textContent'),guestEval('document.getElementById("rankedRating").textContent')]);assert(ratings.some(t=>t.includes('1016'))&&ratings.some(t=>t.includes('984')));assert(ratings.every(t=>t.includes('PLACEMENTS 1/5')));
    await evalJS('document.getElementById("rankedLeaderboard").click()');await eventually(()=>evalJS('document.getElementById("rankedBoard").children.length===2'));
    assert.equal(await evalJS('document.getElementById("rematchButton").textContent'),'CASUAL REMATCH');
    await evalJS('document.getElementById("rematchButton").click()');await guestEval('document.getElementById("rematchButton").click()');for(const evaluate of [evalJS,guestEval])await eventually(()=>evaluate('["kick","play"].includes(window.rocketArena.state)'));
    const games=rankedService.db.prepare('SELECT SUM(games) AS total FROM players').get().total;assert.equal(games,2,'Casual rematch must not create an untracked ranked result');
    assert.deepEqual(errors,[]);guestSocket.close();console.log('PASS: separate browser accounts, real ranked queue and PeerJS match, confirmed MMR, placement progress, leaderboard and casual rematch');
  } finally {
    if(socket)socket.close();
    chrome.kill();
    await Promise.race([
      new Promise(resolve=>chrome.once('exit',resolve)),
      delay(1500)
    ]);
    await rankedService.close();signal.emit('close');server.close();
    try { fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200}); }
    catch(e) { console.warn('Chrome profile cleanup:',e.message); }
  }
}
main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
