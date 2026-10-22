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
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(name==='/')name='/index.html';
  const file=path.resolve(process.cwd(),'.'+name);
  if(!file.startsWith(process.cwd()+path.sep)) {
    res.writeHead(403);return res.end();
  }
  try {
    const body=fs.readFileSync(file);
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
    },20000);
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
      if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails?.text||'Script exception');
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
    async function evalJS(expr){
      const result=await call('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));
      return result.result?.value;
    }
    await call('Page.enable');
    await call('Runtime.enable');
    console.log('Navigating headless Chrome to local Rocket Ball server');
    await call('Page.navigate',{url});
    await eventually(()=>evalJS('document.readyState==="complete" && !!window.rocketArena && !!window.THREE'),15000)
      .catch(err=>{throw new Error('Game startup: '+err.message+'; browser exceptions: '+JSON.stringify(errors));});
    console.log('Game loaded; testing Free Play');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');

    await evalJS('document.getElementById("freePlayBtn").click()');
    await eventually(()=>evalJS('window.rocketArena.state==="play" && window.rocketArena.cars.length===1'));
    assert.equal(await evalJS('document.body.classList.contains("free-play")'),true);
    await evalJS('document.getElementById("trainingPreset").value="wall"; document.getElementById("trainingPreset").dispatchEvent(new Event("change",{bubbles:true}))');
    assert.equal(await evalJS('window.rocketArena.ball.x > 60'),true);
    assert.equal(await evalJS('document.getElementById("trainingShotCount").textContent.includes("2")'),true);
    await evalJS('document.getElementById("trainingNextShot").click()');
    assert.equal(await evalJS('document.getElementById("trainingShotCount").textContent.includes("3")'),true);
    await evalJS('document.getElementById("trainingLaunch").click()');
    await delay(250);
    assert.equal(await evalJS('Number.isFinite(window.rocketArena.ball.y)'),true);
    await evalJS('document.getElementById("trainingResetBall").click()');
    const resetY=await evalJS('window.rocketArena.ball.y');
    assert(Math.abs(resetY-3.4)<.3,'Training ball did not reset');
    await evalJS('document.getElementById("trainingExit").click()');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');

    await evalJS('document.getElementById("settingCameraFov").value="87"; document.getElementById("settingCameraFov").dispatchEvent(new Event("input",{bubbles:true}))');
    assert.equal(await evalJS('JSON.parse(localStorage.getItem("rocketArenaSettingsV1")).camera.fov'),87);
    console.log('Free Play passed; testing normal match');
    await evalJS('document.getElementById("settingGraphics").value="low"; document.getElementById("settingGraphics").dispatchEvent(new Event("change",{bubbles:true}))');
    await evalJS('document.getElementById("playBtn").click()');
    await eventually(()=>evalJS('window.rocketArena.state==="play"'),18000)
      .catch(async err=>{throw new Error('Match kickoff: '+err.message+' state='+await evalJS('window.rocketArena.state')+
        ' announcement='+await evalJS('document.getElementById("msg").textContent')+' browserErrors='+JSON.stringify(errors));});
    assert.equal(await evalJS('window.rocketArena.cars.length'),4);
    const pos0=await evalJS('window.rocketArena.cars[0].z');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyW",bubbles:true}))');
    await delay(550);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyW",bubbles:true}))');
    const pos1=await evalJS('window.rocketArena.cars[0].z');
    assert(pos1>pos0+0.05,'Car did not move when accelerating: '+pos0+' -> '+pos1);
    assert.equal(await evalJS('Number.isFinite(window.rocketArena.ball.x) && Number.isFinite(window.rocketArena.ball.y) && Number.isFinite(window.rocketArena.ball.z)'),true);
    assert.deepEqual(errors,[],'Unexpected browser JS errors');
    console.log('PASS: WebGL startup, menu, Free Play, ball reset, camera persistence, match kickoff and driving.');
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
