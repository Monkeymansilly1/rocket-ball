'use strict';
// Ground-to-wall regression with native car bounds and the live enclosure check.
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
    if(name==='/game.js')body=Buffer.from(body.toString().replace('window.rocketArena = {', 'window.__wallTest={wallStep:stepCar,reset:resetTrainingCar,noRender:()=>renderer.render=()=>{}};window.rocketArena = {'));
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
    await evalJS('window.__wallTest.noRender()');
    for(const model of ['octane','fennec','scorpion']){
      await evalJS(`document.querySelector('[data-car=${model}]').click();document.getElementById('freePlayBtn').click()`);
      const results=await evalJS(`(()=>{
        const c=window.rocketArena.cars[0],test=window.__wallTest,results=[];
        for(const boost of [false,true])for(const [label,x,z,yaw] of [
          ['right',60,0,Math.PI/2],['left',-60,0,-Math.PI/2],
          ['back',30,84,0],['front',30,-84,Math.PI],
          ['corner',60,84,Math.PI/4],['opposite corner',-60,-84,-3*Math.PI/4]
        ]){
          test.reset();Object.assign(c,{x,z,yaw,boost:100});let reachedWall=false,maxY=0,finite=true;
          for(let i=0;i<360;i++){
            test.wallStep(c,{throttle:1,steer:0,pitch:0,roll:0,boost,jump:false,jumpHeld:false,hand:false},1/120);
            maxY=Math.max(maxY,c.y);if(c.wallRide&&!c.ceilingRide&&c.ground&&c.y>12)reachedWall=true;
            finite=finite&&['x','y','z','vx','vy','vz'].every(k=>Number.isFinite(c[k]));
          }
          results.push({label,boost,reachedWall,maxY,finite,bounds:c.mesh.bodyBounds});
        }
        return results;
      })()`);
      for(const result of results){assert(result.finite,model+' '+result.label+' must remain stable');assert(result.reachedWall,model+' '+result.label+' '+(result.boost?'boost':'throttle')+' failed to drive from the floor onto the wall: '+JSON.stringify(result));}
      console.log('PASS: '+model+' drives onto all four walls and curved corners, with throttle and boost, using its actual body bounds');
      await evalJS('document.getElementById("garageToggle").click()');
    }
    assert.deepEqual(errors,[],'Unexpected browser JS errors during wall driving');
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
