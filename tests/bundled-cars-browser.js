'use strict';
// Verify the actual car bodies with all separate model/texture requests blocked.
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
let blockCarDownloads=true;
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(name==='/')name='/index.html';
  if(blockCarDownloads&&/^\/assets\/(octane|fennec|scorpion)\//.test(name)&&!name.endsWith('/body.js')){res.writeHead(503);return res.end('Simulated unavailable model/texture download');}
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
    console.log('Navigating headless Chrome to local Rocket Ball server');
    await call('Page.navigate',{url});
    await eventually(()=>evalJS('document.readyState==="complete" && !!window.rocketArena && !!window.THREE'),45000)
      .catch(async err=>{throw new Error('Game startup: '+err.message+'; state='+await evalJS('JSON.stringify({ready:document.readyState,game:!!window.rocketArena,three:!!window.THREE,rooms:!!window.RocketRooms})')+'; browser exceptions: '+JSON.stringify(errors));});
    await evalJS('document.getElementById("settingGraphics").value="low";document.getElementById("settingGraphics").dispatchEvent(new Event("change",{bubbles:true}));document.querySelector(".lobby-nav [data-panel=garage]").click()');
    for(const name of ['octane','fennec','scorpion']){
      const selected=await evalJS(`(()=>{document.querySelector('[data-car="${name}"]').click();const c=window.rocketArena.cars[0];return {model:c.model,detailed:c.mesh.detailed,body:c.mesh.detailedRoot?.userData.vehicleModel,wheels:c.mesh.detailedWheels?.length};})()`);
      assert.deepEqual(selected,{model:name,detailed:true,body:name,wheels:4},'The actual selected body must appear immediately with downloads blocked');
      assert((await evalJS('document.getElementById("modelLoadStatus").textContent')).includes('ready'));
      const screenshot=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(os.tmpdir(),'rocket-bundled-'+name+'.png'),Buffer.from(screenshot.data,'base64'));
      await evalJS('document.getElementById("freePlayBtn").click()',true);
      await eventually(()=>evalJS('window.rocketArena.state==="play"&&window.rocketArena.cars.length===1'));
      assert.equal(await evalJS('window.rocketArena.cars[0].mesh.detailedRoot.userData.vehicleModel'),name,'Keep the selected real model when starting play');
      await evalJS('document.getElementById("trainingExit").click();document.querySelector(".lobby-nav [data-panel=garage]").click()');
    }
    await evalJS('document.querySelector("[data-car=fennec]").click()');
    await call('Page.reload',{ignoreCache:true});await eventually(()=>evalJS('document.readyState==="complete"&&!!window.rocketArena'),45000);
    assert.equal(await evalJS('window.rocketArena.cars[0].mesh.detailedRoot.userData.vehicleModel'),'fennec','Reload must retain the selected car with model downloads blocked');
    blockCarDownloads=false;
    await call('Page.reload',{ignoreCache:true});await eventually(()=>evalJS('document.readyState==="complete"&&!!window.rocketArena'),45000);
    for(const name of ['octane','fennec','scorpion']){
      await evalJS(`document.querySelector('[data-car="${name}"]').click()`);
      await eventually(()=>evalJS(`window.rocketArena.cars[0].model==='${name}'&&window.rocketArena.cars[0].mesh.textured===true`),25000);
      assert.equal(await evalJS(`window.rocketArena.cars[0].mesh.body.children.filter(o=>o.userData.vehicleModel==='${name}').length`),1,'Texture upgrade must replace the initial body without duplicate cars');
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: all three real cars in garage/Free Play with downloads blocked, persisted selection, and successful texture upgrades without duplicate bodies');
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
