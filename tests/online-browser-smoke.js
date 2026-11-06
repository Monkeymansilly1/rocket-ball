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
app.get('/game.js',(req,res)=>res.type('js').send(fs.readFileSync('game.js','utf8').replace('window.rocketArena = {','window.__onlineCelebration=()=>({style:activeGoalExplosionStyle,track:replayAnthemTrack,ownStyle:goalExplosionStyle,ownTrack:anthemSelection});window.__onlineAudioFailure=()=>{sfx.init=()=>{throw Error("Unavailable audio");};};window.__onlineEnd=()=>{clock=.001;score=[1,2];playerStats[1].goals=2;};window.__onlineStep=update;window.__onlineRoom=onlineRoom;window.rocketArena = {')));
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
    await guestCall('Page.enable');await guestCall('Runtime.enable');await configure(guestCall);await guestCall('Page.navigate',{url});
    await eventually(()=>guestEval('!!window.rocketArena'),45000);console.log('Guest game loaded');
    for(const evaluate of [evalJS,guestEval])await evaluate("document.getElementById('settingGraphics').value='low';document.getElementById('settingGraphics').dispatchEvent(new Event('change'));THREE.WebGLRenderer=class extends THREE.WebGLRenderer{constructor(...args){super(...args);this.render=function(){}}};");
    await evalJS(`document.querySelector('[data-car=scorpion]').click();document.getElementById('paint').value='#42cafe';document.getElementById('paint').dispatchEvent(new Event('input'));document.querySelector('[data-effect=fire]').click();document.querySelector('[data-anthem=rap]').click();`);
    const creating=await evalJS("(()=>{document.getElementById('name').value='HOST';document.getElementById('onlineCreate').click();return {state:window.rocketArena.onlineStatus.state,hidden:document.getElementById('onlineRoomCode').hidden,copyHidden:document.getElementById('onlineCopy').hidden};})()",true);
    assert.deepEqual(creating,{state:'connecting',hidden:true,copyHidden:true},'A room code must not be shared before registration succeeds');
    await eventually(()=>evalJS('window.rocketArena.onlineStatus.state==="waiting"'),20000).catch(async e=>{throw Error(e.message+' '+await evalJS('JSON.stringify({status:window.rocketArena.onlineStatus,text:document.getElementById("onlineStatus").textContent,options:window.__testPeer&&String(window.Peer),errors:[]})')+' '+JSON.stringify(errors));});
    console.log('Room waiting');const code=await evalJS('window.rocketArena.onlineStatus.code');assert(/^[A-Z2-9]{6}$/.test(code));
    await guestCall('Page.navigate',{url:url+'?room='+code.toLowerCase()});
    await eventually(()=>guestEval('!!window.rocketArena'),45000);
    assert.equal(await guestEval('document.getElementById("onlineCode").value'),code,'Invite URL must prefill the room code');
    await guestEval("document.getElementById('onlineCreate').click()");
    await eventually(()=>guestEval('window.rocketArena.onlineStatus.state==="waiting"'),20000);
    assert.equal(await guestEval('document.getElementById("onlineJoin").disabled'),false,'A player who created their own room must still be able to join a friend');
    await guestEval(`document.getElementById('paint').value='#f21a86';document.getElementById('paint').dispatchEvent(new Event('input'));document.querySelector('[data-effect=galaxy]').click();document.querySelector('[data-anthem=grime]').click();`);
    await guestEval('window.__onlineAudioFailure()');
    await guestEval(`document.querySelector('[data-car=fennec]').click();document.getElementById('name').value='FRIEND';document.getElementById('onlineCode').value='${code.toLowerCase()}';document.getElementById('onlineCode').dispatchEvent(new Event('input',{bubbles:true}));`);
    assert((await guestEval('document.getElementById("onlineStatus").textContent')).includes('Press JOIN ROOM'),'Typing a complete code must explain the next step');
    await guestEval("document.getElementById('onlineJoin').click()");
    await eventually(()=>evalJS('window.rocketArena.onlineStatus.state==="connected"'),25000).catch(async e=>{throw Error(e.message+' HOST '+await evalJS('JSON.stringify({s:window.rocketArena.onlineStatus,t:document.getElementById("onlineStatus").textContent})')+' GUEST '+await guestEval('JSON.stringify({s:window.rocketArena.onlineStatus,t:document.getElementById("onlineStatus").textContent})'));});
    await eventually(()=>guestEval('window.rocketArena.onlineStatus.state==="connected"&&window.rocketArena.cars.length===2'),25000);
    assert.equal(await guestEval('window.rocketArena.onlineStatus.role'),'guest');
    if(rtcConfig.iceTransportPolicy==='relay')assert(await evalJS('(async()=>{const stats=await window.__onlineRoom.conn.peerConnection.getStats();return [...stats.values()].some(s=>s.type==="local-candidate"&&s.candidateType==="relay");})()'),'The two clients must exchange actual WebRTC traffic through the relay');
    assert.equal(await evalJS('window.rocketArena.cars[1].model'),'fennec');assert.equal(await guestEval('window.rocketArena.cars[1].model'),'fennec');
    assert.deepEqual(await evalJS('window.rocketArena.cars.map(c=>({ai:c.ai,name:c.displayName}))'),[{ai:false,name:'HOST'},{ai:false,name:'FRIEND'}]);
    const choices=[{name:'HOST',car:'scorpion',colour:'#42cafe',explosion:'fire',anthem:'rap'},
      {name:'FRIEND',car:'fennec',colour:'#f21a86',explosion:'galaxy',anthem:'grime'}];
    for(const evaluate of [evalJS,guestEval]){
      assert.deepEqual(await evaluate('window.rocketArena.cars.map(c=>c.cosmetics)'),choices,'Both clients must retain each player’s complete choices');
      assert.deepEqual(await evaluate(`window.rocketArena.cars.map(c=>{const colours=[];c.mesh.detailedRoot.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(/paint/i.test(m.name))colours.push('#'+m.color.getHexString());});return colours.includes(c.cosmetics.colour);})`),[true,true],'Actual imported car materials must use each player’s paint');
    }
    await eventually(()=>evalJS('window.rocketArena.state==="play"'),20000).catch(async e=>{throw Error(e.message+' '+await evalJS('JSON.stringify({state:window.rocketArena.state,status:window.rocketArena.onlineStatus})')+' ERRORS '+JSON.stringify(errors));});
    await eventually(()=>guestEval('window.rocketArena.state==="play"'),20000);
    const z=await evalJS('window.rocketArena.cars[1].z');
    await guestEval("window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}))");
    await eventually(()=>evalJS('window.rocketArena.cars[1].z<'+(z-1)),10000);
    await guestEval("window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}))");
    await eventually(()=>guestEval('Math.abs(window.rocketArena.cars[1].vz)<1'),10000);
    await evalJS('Object.assign(window.rocketArena.ball,{x:0,y:2,z:105,vx:0,vy:0,vz:32})');
    await eventually(()=>guestEval('window.rocketArena.score[0]===1'),10000);
    assert.equal(await evalJS('window.rocketArena.score[0]'),1);
    for(const evaluate of [evalJS,guestEval])await eventually(async()=>{
      const choice=await evaluate('window.__onlineCelebration()');return choice.style==='fire'&&choice.track==='rap';
    });
    await eventually(()=>guestEval('window.rocketArena.state==="replay"'),15000);
    await guestEval("document.getElementById('skipReplayButton').click()");
    await eventually(()=>evalJS('window.rocketArena.state==="kick"||window.rocketArena.state==="play"'),10000);
    await eventually(()=>evalJS('window.rocketArena.state==="play"'),10000);
    await evalJS('Object.assign(window.rocketArena.ball,{x:0,y:2,z:-105,vx:0,vy:0,vz:-32})');
    await eventually(()=>guestEval('window.rocketArena.score[1]===1'),10000);
    for(const evaluate of [evalJS,guestEval])await eventually(async()=>{
      const choice=await evaluate('window.__onlineCelebration()');return choice.style==='galaxy'&&choice.track==='grime';
    });
    assert.deepEqual(await evalJS('window.__onlineCelebration()'),{style:'galaxy',track:'grime',ownStyle:'fire',ownTrack:'rap'},'A friend’s goal must not overwrite the host’s garage');
    assert.deepEqual(await guestEval('window.__onlineCelebration()'),{style:'galaxy',track:'grime',ownStyle:'galaxy',ownTrack:'grime'});
    await eventually(()=>guestEval('window.rocketArena.state==="replay"'),15000);
    await guestEval("document.querySelector('[data-replay-camera=car]').click()");
    assert.equal(await guestEval('window.rocketArena.cameraView.replayMode'),'car');
    assert.equal(await evalJS('window.rocketArena.cameraView.replayMode'),'ball','Online replay cameras must be an individual choice');
    await guestEval("document.getElementById('skipReplayButton').click()");
    await eventually(()=>evalJS('window.rocketArena.state==="play"'),10000);
    await evalJS('window.__onlineEnd()');
    await eventually(()=>guestEval('window.rocketArena.state==="over"'),10000);
    assert.equal(await guestEval('document.getElementById("victoryScore").textContent'),await evalJS('document.getElementById("victoryScore").textContent'));
    assert.equal(await guestEval('document.getElementById("statsBody").textContent'),await evalJS('document.getElementById("statsBody").textContent'),'Match statistics must agree on both screens');
    await guestEval("document.getElementById('onlineMatchLeave').click()");
    await eventually(()=>evalJS('window.rocketArena.state==="menu"&&window.rocketArena.onlineStatus.state==="idle"'),10000);
    assert((await evalJS('document.getElementById("onlineStatus").textContent')).includes('disconnected'));
    // A fresh room can be created after a disconnected match.
    await evalJS("document.getElementById('onlineCreate').click()",true);
    await eventually(()=>evalJS('window.rocketArena.onlineStatus.state==="waiting"'),10000);
    await evalJS("document.getElementById('onlineLeave').click()");
    assert.equal(await evalJS('window.rocketArena.onlineStatus.state'),'idle');
    assert.deepEqual(errors,[]);
    assert.equal(idRequests,0,'No player may rely on the blocked HTTP ID service');
    guestSocket.close();
    console.log('PASS: real WebRTC matches with the HTTP ID endpoint unavailable, registered codes only, join, controls, scoring/replays and disconnect');
  } finally {
    if(socket)socket.close();
    chrome.kill();
    await Promise.race([
      new Promise(resolve=>chrome.once('exit',resolve)),
      delay(1500)
    ]);
    signal.emit('close');server.close();
    try { fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200}); }
    catch(e) { console.warn('Chrome profile cleanup:',e.message); }
  }
}
main().then(()=>process.exit(0)).catch(err=>{console.error(err);process.exit(1);});
