'use strict';
// Headless browser check for the actual garage, Free Play, matches and settings.
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
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ico':'image/x-icon'};
let scorpionRequests=0,nextoRequests=0;
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(name==='/')name='/index.html';
  if(name==='/assets/nexto/nexto.onnx'&&++nextoRequests===1){res.writeHead(503);return res.end('Simulated Nexto load failure');}
  if(name==='/lib/nexto/policy-check-worker.js'){res.writeHead(200,{'Content-Type':'text/javascript'});return res.end("self.importScripts('vendor/ort.wasm.min.js');ort.env.wasm.numThreads=1;ort.env.wasm.wasmPaths=new URL('vendor/',self.location.href).href;self.onmessage=async({data})=>{try{const s=await ort.InferenceSession.create(new URL('../../assets/nexto/nexto.onnx',self.location.href).href,{executionProviders:['wasm']});const r=await s.run({query:new ort.Tensor('float32',Float32Array.from(data.query),[1,1,32]),entities:new ort.Tensor('float32',Float32Array.from(data.entities),[1,data.entityCount,24]),mask:new ort.Tensor('float32',Float32Array.from(data.mask),[1,data.entityCount])});let maxError=0;for(let i=0;i<90;i++)maxError=Math.max(maxError,Math.abs(r.logits.data[i]-data.logits[i]));self.postMessage({maxError});}catch(error){self.postMessage({error:String(error)})}};");}
  // Exercise recovery from an interrupted model download, as on a live host.
  if(name==='/assets/scorpion/scene.gltf'&&++scorpionRequests===1){
    res.writeHead(503);return res.end('Simulated interrupted model download');
  }
  const file=path.resolve(process.cwd(),'.'+name);
  if(!file.startsWith(process.cwd()+path.sep)) {
    res.writeHead(403);return res.end();
  }
  try {
    let body=fs.readFileSync(file);
    if(name==='/game.js')body=Buffer.from(body.toString().replace('window.rocketArena = {', 'window.__featureTest={step:update,series:matchSeries,features:matchFeatures,replayStore,get viewer(){return savedViewer},get paused(){return paused},get data(){return replayData()},finish:()=>{score=[2,1];state="over";showVictoryScreen();},noRender:()=>{window.__originalDraw=renderer.render.bind(renderer);renderer.render=()=>{}},draw:()=>{const silent=renderer.render;renderer.render=window.__originalDraw;render(.016);renderer.render=silent;}};window.rocketArena = {'));
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});
    res.end(body);
  } catch(e){res.writeHead(404);res.end('Not found');}
});
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
    '--headless=new','--no-sandbox','--disable-dev-shm-usage',
    '--enable-webgl','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
    '--disable-background-networking','--no-first-run',
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
    // Meter the music's real output connection, rather than trusting a
    // "playing" flag on a source connected to a silent/suspended context.
    await call('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.__testAnthemMeters=[];
      const originalConnect=AudioNode.prototype.connect;
      AudioNode.prototype.connect=function(destination,...args){
        const result=originalConnect.call(this,destination,...args);
        if(this instanceof GainNode&&destination===this.context.destination){
          const meter=this.context.createAnalyser();meter.fftSize=2048;
          originalConnect.call(this,meter);window.__testAnthemMeters.push(meter);
        }
        return result;
      };
      window.__testAnthemRms=()=>Math.max(0,...window.__testAnthemMeters.map(m=>{
        const data=new Float32Array(m.fftSize);m.getFloatTimeDomainData(data);
        return Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length);
      }));
    `});
    async function clickSelector(selector){
      const point=await evalJS(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    }
    console.log('Navigating headless Chrome to local Rocket Ball server');
    await call('Page.navigate',{url});
    await eventually(()=>evalJS('document.readyState==="complete" && !!window.rocketArena && !!window.THREE'),45000)
      .catch(async err=>{throw new Error('Game startup: '+err.message+'; state='+await evalJS('JSON.stringify({ready:document.readyState,game:!!window.rocketArena,three:!!window.THREE,rooms:!!window.RocketRooms})')+'; browser exceptions: '+JSON.stringify(errors));});
    await evalJS('window.__featureTest.noRender();document.getElementById("settingCameraFov").value="87";document.getElementById("settingCameraFov").dispatchEvent(new Event("input"))');
    for(const model of ['octane','fennec','scorpion']){
      await evalJS(`document.querySelector('[data-car=${model}]').click();document.getElementById('decalStyle').value='stripes';document.getElementById('decalStyle').dispatchEvent(new Event('change'));document.getElementById('wheelFinish').value='chrome';document.getElementById('wheelFinish').dispatchEvent(new Event('change'))`);
      const cosmetic=await evalJS(`(()=>{const c=window.rocketArena.cars[0];return {decal:c.mesh.decalRoot?.geometry.attributes.position.count,cosmetics:c.cosmetics,flame:c.mesh.flame.material.opacity};})()`);
      assert(cosmetic.decal>0,model+' needs visible roof stripes');assert.equal(cosmetic.cosmetics.wheel,'chrome');assert(cosmetic.flame<.5,'Boost flame should be dimmer');
    }
    console.log('PASS: decals on all three native cars, wheel finishes and toned-down boost');
    await evalJS("document.getElementById('seriesLength').value='5';document.querySelector('[data-mode=\"1\"]').click();document.querySelector('[data-diff=\"0\"]').click();document.getElementById('playBtn').click();for(let i=0;i<600;i++)window.__featureTest.step(1/120)",true);
    await eventually(()=>evalJS('window.rocketArena.state==="play"'));
    const hud=await evalJS(`Object.fromEntries(['referenceToolbar','quickPlayButton','score','mini','flightHint','cam','boost'].map(id=>[id,getComputedStyle(document.getElementById(id)).display]))`);
    for(const id of ['referenceToolbar','quickPlayButton','score','mini','flightHint'])assert.equal(hud[id],'none',id+' should move out of the playing HUD');assert.notEqual(hud.cam,'none');assert.notEqual(hud.boost,'none');
    async function key(code,type='keydown'){return evalJS(`window.dispatchEvent(new KeyboardEvent('${type}',{code:'${code}',bubbles:true,cancelable:true}))`);}
    await key('Tab');assert.notEqual(await evalJS('getComputedStyle(document.getElementById("score")).display'),'none');await key('Tab','keyup');
    await key('Escape');assert.equal(await evalJS('document.getElementById("pauseMenu").hidden'),false);assert.equal(await evalJS('window.__featureTest.paused'),true);
    await call('Emulation.setDeviceMetricsOverride',{width:1365,height:768,deviceScaleFactor:1,mobile:false});await evalJS('window.__featureTest.draw()');fs.writeFileSync('/tmp/rocket-pause-menu.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evalJS('window.__featureTest.draw()');fs.writeFileSync('/tmp/rocket-pause-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await call('Emulation.setDeviceMetricsOverride',{width:1365,height:768,deviceScaleFactor:1,mobile:false});
    const clock=await evalJS('document.getElementById("clock").textContent');await delay(400);assert.equal(await evalJS('document.getElementById("clock").textContent'),clock);
    await evalJS('document.getElementById("pauseResume").click()');await key('Digit2');await key('Digit1');assert((await evalJS('document.getElementById("quickChatFeed").textContent')).includes('Nice shot!'));
    await evalJS('window.__featureTest.draw()');fs.writeFileSync('/tmp/rocket-clean-hud.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await evalJS('for(let i=0;i<960;i++)window.__featureTest.step(1/120)');
    await evalJS('document.getElementById("pauseSaveReplay").click()');await eventually(()=>evalJS('window.__featureTest.replayStore.list().then(x=>x.length===1)'));
    await evalJS('window.__featureTest.finish()');assert((await evalJS('document.getElementById("seriesResult").textContent')).includes('BLUE 1'));
    await evalJS('document.getElementById("rematchButton").click()');assert.equal(await evalJS('window.rocketArena.state'),'kick');assert.deepEqual(await evalJS('window.__featureTest.series.wins'),[1,0]);assert.deepEqual(await evalJS('window.rocketArena.score'),[0,0]);
    await evalJS('document.getElementById("garageToggle").click();document.getElementById("openReplayLibrary").click()');await eventually(()=>evalJS('!!document.querySelector("#replayLibraryList article button")'));
    await evalJS('document.querySelector("#replayLibraryList article button").click()');await eventually(()=>evalJS('!!window.__featureTest.viewer'));
    assert.equal(await evalJS('document.getElementById("savedPlayback").hidden'),false);await evalJS('document.getElementById("replayPlayPause").click();document.getElementById("replayTimeline").value="4";document.getElementById("replayTimeline").dispatchEvent(new Event("input"))');
    assert(Math.abs(await evalJS('window.rocketArena.replayStatus.elapsed')-4)<.1);assert.equal(await evalJS('window.rocketArena.cameraView.verticalFov'),87);
    await evalJS('document.getElementById("replaySpeed").value=".25";document.getElementById("replaySpeed").dispatchEvent(new Event("change"))');assert.equal(await evalJS('window.__featureTest.viewer.speed'),.25);
    await evalJS('document.getElementById("replayExit").click()');assert.equal(await evalJS('window.rocketArena.state'),'menu');
    await evalJS('document.getElementById("rankedFind").click()');await eventually(()=>evalJS('document.getElementById("controlsSettings").open'));assert((await evalJS('document.getElementById("rankedStatus").textContent')).includes('not configured'));
    assert.deepEqual(errors,[]);console.log('PASS: clean HUD, Tab score, pause/resume, chat, best-of-five rematch, IndexedDB save, replay library, timeline/speed and preserved FOV; unconfigured ranked state');
  } finally {
    if(socket)socket.close();
    chrome.kill();
    await Promise.race([
      new Promise(resolve=>chrome.once('exit',resolve)),
      delay(1500)
    ]);
    server.close();
    try { fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:200}); }
    catch(e) { console.warn('Chrome profile cleanup:',e.message); }
  }
}
main().catch(err=>{console.error(err);process.exitCode=1;server.close();});
