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
    assert.equal(await evalJS('window.rocketArena.cars[0]?.model'),'scorpion','New garage must show Scorpion by default');
    assert.equal(await evalJS('window.rocketArena.cars[0]?.mesh.detailedRoot?.userData.vehicleModel'),'scorpion',
      'The uploaded Scorpion body must appear even when its model download is interrupted');
    // SwiftShader has no hardware GPU; use the real performance mode for functional checks.
    await evalJS('document.getElementById("settingGraphics").value="low";document.getElementById("settingGraphics").dispatchEvent(new Event("change",{bubbles:true}))');
    await evalJS('document.querySelector(".lobby-nav [data-panel=garage]").click();document.getElementById("name").value="";document.getElementById("name").focus()');
    await call('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyA',key:'A',text:'A',modifiers:8,windowsVirtualKeyCode:65});
    await call('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyA',key:'A',windowsVirtualKeyCode:65});
    assert.equal(await evalJS('document.getElementById("name").value'),'A','Bound A key must type normally in a text field');
    const editing=await evalJS(`(()=>{const input=document.getElementById('name'),camera=document.getElementById('viewToggle').textContent;
      const allowed=['Space','KeyA','KeyW','KeyP','KeyM','KeyC','Digit2','Enter'].every(code=>input.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true,cancelable:true})));
      const result={allowed,state:window.rocketArena.state,cameraUnchanged:camera===document.getElementById('viewToggle').textContent};
      input.value='PLAYER';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();document.querySelector('.lobby-nav [data-panel=play]').click();return result;})()`);
    assert.deepEqual(editing,{allowed:true,state:'menu',cameraUnchanged:true},'Typing must not trigger gameplay or menu shortcuts');
    console.log('PASS: real A typing, native editing keys and isolated game shortcuts');
    const renderedAudio=await evalJS(`(async()=>{
      const audio=new RocketCarAudio.CarAudio();
      const Offline=class {constructor(){return new OfflineAudioContext(1,44100,44100);}};
      audio.init(Offline);audio.update({vx:24,vy:0,vz:0,engineLoad:1,fl:1},true);
      const data=(await audio.ac.startRendering()).getChannelData(0);
      let peak=0,squares=0;for(const sample of data){peak=Math.max(peak,Math.abs(sample));squares+=sample*sample;}
      return {peak,rms:Math.sqrt(squares/data.length)};
    })()`);
    assert(renderedAudio.peak>.001 && renderedAudio.peak<.9 && renderedAudio.rms>.001,'Real Web Audio output must be audible and free of clipping');
    console.log('PASS: real Web Audio engine/boost render without clipping');
    console.log('Game loaded; testing Reloaded menu and goal effects');
    assert.equal(await evalJS('document.getElementById("ballFeel")===null'),true,'Ball physics options must be removed');
    assert.equal(await evalJS('document.querySelectorAll(".lobby-nav [data-panel]").length'),4);
    assert.equal(await evalJS('document.getElementById("panel-play").hidden'),false);
    await evalJS('document.querySelector(".lobby-nav [data-panel=effects]").click()');
    assert.equal(await evalJS('document.getElementById("panel-effects").hidden'),false);
    assert.equal(await evalJS('document.querySelectorAll("[data-effect]").length'),8);
    await evalJS('document.getElementById("fullGoalPreview").click()');
    assert.equal(await evalJS('document.body.classList.contains("preview-fullscreen")'),true);
    await evalJS('document.getElementById("returnGoalPreview").click()');
    assert.equal(await evalJS('document.body.classList.contains("preview-fullscreen")'),false);
    assert.deepEqual(await evalJS('Array.from(document.querySelectorAll("[data-anthem]")).map(b=>b.dataset.anthem)'),['dnb','grime','rap','dubstep','off']);
    assert.equal(await evalJS('Array.from(document.querySelectorAll("[data-anthem] strong,[data-anthem] small")).every(el=>getComputedStyle(el).color==="rgb(255, 255, 255)")'),true,'Song choices must have white text in every selection state');
    const anthemAudio=await evalJS(`(async()=>{
      const context=new OfflineAudioContext(2,44100,44100),result={};
      for(const [name,track] of Object.entries(RocketGoalAnthems.TRACKS)){
        const buffer=await context.decodeAudioData(await (await fetch(track.url)).arrayBuffer());
        const samples=buffer.getChannelData(0);let peak=0,sum=0;
        for(const sample of samples){peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;}
        result[name]={duration:buffer.duration,peak,rms:Math.sqrt(sum/samples.length),channels:buffer.numberOfChannels};
      }
      return result;
    })()`);
    for(const [name,track] of Object.entries(anthemAudio))assert(track.duration>10&&track.duration<20&&track.channels===2&&track.peak<.96&&track.rms>.03,'Invalid/inaudible anthem: '+name+' '+JSON.stringify(track));
    for(const name of ['dnb','grime','rap','dubstep']){
      await evalJS(`document.querySelector('[data-anthem="${name}"]').click();document.getElementById('anthemPreview').click()`,true);
      await eventually(()=>evalJS(`window.rocketArena.anthemStatus.playing&&window.rocketArena.anthemStatus.track==='${name}'`),15000);
      await eventually(()=>evalJS('window.__testAnthemRms()>.003'),10000);
    }
    await evalJS(`for(const id of ['settingVolume','settingAnthemVolume']){const input=document.getElementById(id);input.value='0';input.dispatchEvent(new Event('input',{bubbles:true}));}`);
    await eventually(()=>evalJS('document.getElementById("anthemPreviewStatus").textContent.includes("Game volume is 0%")&&window.__testAnthemRms()<.0001'));
    await clickSelector('#anthemEnableAudio');
    await eventually(()=>evalJS('window.rocketArena.audioStatus.state==="running"&&window.__testAnthemRms()>.003'));
    assert.equal(await evalJS('document.getElementById("settingVolume").value'),'75');
    assert.equal(await evalJS('document.getElementById("settingAnthemVolume").value'),'55');
    await evalJS('window.__testAnthemMeters[0].context.suspend()');
    await eventually(()=>evalJS('!window.rocketArena.anthemStatus.audible&&!window.rocketArena.anthemStatus.playing&&!document.getElementById("anthemEnableAudio").hidden'));
    await clickSelector('#anthemEnableAudio');
    await eventually(()=>evalJS('window.rocketArena.audioStatus.state==="running"&&window.__testAnthemRms()>.003'));
    console.log('PASS: real song output, visible silent-volume status, zero-volume recovery and suspended browser audio recovery through a real mouse click');
    await evalJS(`document.getElementById('anthemStop').click();document.querySelector('[data-anthem="off"]').click()`);
    assert.equal(await evalJS('window.rocketArena.anthemStatus.playing'),false);
    assert.equal(await evalJS('document.getElementById("anthemPreview").disabled'),true);
    await evalJS(`document.querySelector('[data-anthem="rap"]').click();document.getElementById('settingAnthemVolume').value='35';document.getElementById('settingAnthemVolume').dispatchEvent(new Event('input',{bubbles:true}));`);
    assert.equal(await evalJS('window.rocketArena.anthemStatus.volume'),.35);
    console.log('PASS: all uploaded goal-song clips decode audibly, previews select correctly, Off and separate volume work.');
    const signatures=await evalJS(`Object.keys(RocketGoalEffects.STYLES).map(style=>{
      document.querySelector('[data-effect="'+style+'"]').click();
      const effect=window.rocketArena.goalEffects[0];
      if(effect.style!==style)throw new Error('Wrong effect for '+style);
      return effect.signature.join(',');
    })`);
    assert.equal(new Set(signatures).size,8,'Selections must use eight different 3D models');
    for(const style of ['fire','blackhole']){
      await evalJS(`document.querySelector('[data-effect="${style}"]').click();document.getElementById('fullGoalPreview').click()`);
      await delay(1000);
      const picture=await call('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(os.tmpdir(),'rocket-upgraded-'+style+'.png'),Buffer.from(picture.data,'base64'));
      await evalJS('document.getElementById("returnGoalPreview").click()');
    }
    assert.equal(await evalJS('window.rocketArena.pitch.material.map.encoding===THREE.sRGBEncoding'),true,
      'Pitch texture must use the colour API supported by bundled Three.js');
    assert.equal(await evalJS('window.rocketArena.ballShadow.isMesh'),true);
    assert.equal(await evalJS('window.rocketArena.ballTrail.isLine'),true);
    assert.equal(await evalJS('document.querySelectorAll("#explosion option").length'),8);
    assert.equal(await evalJS('document.querySelectorAll("[data-quick]").length'),4);
    // Preview every selectable goal style without scoring a real match.
    await evalJS(`for(const style of ["classic","fire","galaxy","lightning","blackhole","supernova","pixel","aurora"])window.rocketArena.previewGoalExplosion(style)`);
    assert((await evalJS('window.rocketArena.goalEffectCount'))>0,
      '3D explosion preview never spawned scene objects');
    assert((await evalJS('window.rocketArena.goalEffectCount'))<=2,
      '3D goal explosion preview leaks unbounded meshes');
    await eventually(()=>evalJS('window.rocketArena.goalEffectCount===0'),20000);
    // The actual menu preview button must use the same real 3D effect path.
    await evalJS('document.getElementById("explosion").value="pixel";document.getElementById("explosionPreview").click()');
    assert((await evalJS('window.rocketArena.goalEffectCount'))>0,
      'Goal explosion preview button is not wired to the renderer');
    assert.equal(await evalJS('document.getElementById("explosionPreviewStatus").textContent.includes("Voxel")'),true);
    await eventually(()=>evalJS('window.rocketArena.goalEffectCount===0'),20000);
    console.log('PASS: eight distinct 3D explosions, menu navigation, previews, cleanup and correct turf colour space');
    console.log('Game loaded; testing Free Play');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');
    // Verify the NEW arena exists as playable 3D geometry, not just an image.
    await evalJS(`document.querySelector('[data-car=octane]').click()`);
    assert.equal(await evalJS('window.rocketArena.stadium.name'), 'Rocket Ball Championship Arena');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.bodies.count'),8332,
      'Dense mini potato spectators were not created');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.faces.count'),8332,
      'Mini crowd faces missing');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.outlines.count'),8332,
      'Outlined mini potato bodies missing');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.flagData.length'),348,
      'Team flags missing');
    assert.equal(await evalJS('window.rocketArena.stadium.getObjectByName("White Alpine Sail Canopies")?.isMesh'),true,
      'Scalloped white canopy missing');
    assert.equal(await evalJS('window.rocketArena.stadium.getObjectByName("Turquoise Stadium Exterior")?.isMesh'),true,
      'Teal stadium exterior missing');
    assert.equal(await evalJS('window.rocketArena.lakesideScenery?.getObjectByName("Reflective Blue Lake")?.isMesh'),true,
      'Decorative lakeside landscape missing');
    assert.equal(await evalJS(`(()=>{const c=window.rocketArena.pitch.parent.getObjectByName('Stadium Concourse');const b=new THREE.Box3().setFromObject(c);const size=b.getSize(new THREE.Vector3());return size.x<500&&size.z<500;})()`),true,'Concourse must not cover the surrounding lake');
    assert.equal(await evalJS('window.rocketArena.lakesideScenery?.children.filter(x=>x.isInstancedMesh).length>=4'),true,
      'Pine forest or distant skyline missing');
    assert.equal(await evalJS('document.getElementById("physics")===null'),true,
      'Physics dropdown was not removed from the menu');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.fans.length>8000 && new Set(window.rocketArena.miniCrowd.fans.map(f=>f.row)).size===18'),true,
      'All eighteen terraces must be filled with mini fans');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.bodies.geometry.type'),'SphereGeometry',
      'Crowd must be potato characters, not the old box audience');
    assert.equal(await evalJS('(()=>{const roof=new THREE.Box3().setFromObject(window.rocketArena.stadium.getObjectByName("White Alpine Sail Canopies"));return roof.min.x < -130 && roof.max.x > 130 && roof.max.y > 60;})()'),true,'Canopy must surround the pitch without collapsing into the arena');
    assert.equal(await evalJS('window.rocketArena.stadium.children.filter(x => x.isInstancedMesh).length >= 7'),true);
    assert.equal(await evalJS('window.rocketArena.pitch.geometry.attributes.position.count > 15000'),true);
    assert.equal(await evalJS(`(()=>{const g=window.rocketArena.pitch.geometry,p=g.attributes.position,uv=g.attributes.uv;
      for(let i=0;i<p.count;i++)if(Math.abs(uv.getX(i)-(p.getX(i)+80)/160)>.00001 || Math.abs(uv.getY(i)-(p.getZ(i)+104)/208)>.00001)return false;
      return true;})()`),true,'Pitch UVs must align team markings to world coordinates, including rounded corners');
    assert.equal(await evalJS('window.rocketArena.pads.filter(x => x.big).length'),6);
    assert.equal(await evalJS('window.rocketArena.pads.filter(x => !x.big).length'),28);
    assert.equal(await evalJS('Math.max(...Array.from({length:window.rocketArena.pitch.geometry.attributes.position.count},(_,i)=>window.rocketArena.pitch.geometry.attributes.position.getY(i)))>4.5'),true);
    await eventually(()=>evalJS('window.rocketArena.cars[0]?.mesh?.detailed===true'),25000)
      .catch(async err=>{throw new Error('Detailed Octane failed to load: '+err.message+
        '; status='+await evalJS('document.getElementById("modelLoadStatus").textContent')+
        '; browserErrors='+JSON.stringify(errors));});
    assert.equal(await evalJS('window.rocketArena.cars[0].mesh.detailedWheels.length'),4);
    console.log('Detailed Octane 3D body, original material maps and four wheels loaded.');
    for (const selector of ['[data-car]', '[data-car2]']) {
      assert.deepEqual(await evalJS(`Array.from(document.querySelectorAll('${selector}')).map(b=>b.dataset.car||b.dataset.car2)`),
        ['octane','fennec','scorpion'], 'Both garages must offer exactly the three requested vehicles');
    }
    for (const name of ['fennec','scorpion']) {
      await evalJS(`document.querySelector('[data-car="${name}"]').click()`);
      await eventually(()=>evalJS(`window.rocketArena.cars[0]?.model==='${name}' && window.rocketArena.cars[0]?.mesh.detailed && window.rocketArena.cars[0]?.mesh.textured`),25000);
      const info = await evalJS(`(()=>{const m=window.rocketArena.cars[0].mesh,b=m.bodyBounds;
        const maps=[];m.detailedRoot.traverse(o=>{if(o.isMesh)for(const mat of [o.material].flat())for(const k of ['map','normalMap'])if(mat[k])maps.push(k);});
        return {wheels:m.detailedWheels.length,width:b.max[0]-b.min[0],height:b.max[1]-b.min[1],length:b.max[2]-b.min[2],maps:maps.length,
          axle:m.detailedWheelAxis.toArray(),model:m.detailedRoot.userData.vehicleModel};})()`);
      assert.equal(info.model,name,'The selected vehicle must use its imported body');
      assert.equal(info.wheels,4,name+' must have four animated wheel pivots');
      assert(info.width>1.7&&info.width<2.5&&info.height>.8&&info.height<1.6&&info.length>3.5&&info.length<4.1,
        name+' must use car-sized bounds with the long axis facing forward: '+JSON.stringify(info));
      assert.deepEqual(info.axle,[1,0,0]);
      if(name==='scorpion'){
        assert(info.maps>=5,'Scorpion texture maps must load');
        assert.equal(scorpionRequests,2,'Selecting Scorpion must retry an interrupted model download');
      }
      await evalJS(`document.querySelector('[data-car2="${name}"]').click();document.getElementById('localTwo').checked=true;
        document.getElementById('localTwo').dispatchEvent(new Event('change',{bubbles:true}))`);
      await eventually(()=>evalJS(`window.rocketArena.cars.some(c=>c.team===1&&!c.ai&&c.model==='${name}'&&c.mesh.detailed)`));
      await evalJS(`document.getElementById('localTwo').checked=false;document.getElementById('localTwo').dispatchEvent(new Event('change',{bubbles:true}))`);
    }
    await evalJS(`document.querySelector('[data-car="octane"]').click()`);
    console.log('PASS: exactly Octane, Fennec and Scorpion for both players; real models, textures, four wheel pivots and correctly oriented bounds.');

    await evalJS('document.getElementById("freePlayBtn").click()',true);
    await eventually(()=>evalJS('window.rocketArena.state==="play" && window.rocketArena.cars.length===1'));
    assert.equal(await evalJS('document.body.classList.contains("free-play")'),true);
    await eventually(()=>evalJS('window.rocketArena.audioStatus.state==="running"'),10000);
    const cameraProjection=await evalJS('window.rocketArena.cameraView');
    assert.equal(cameraProjection.ballCam,true);
    assert.equal(await evalJS('document.getElementById("viewToggle").getAttribute("aria-pressed")'),'true');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyC",bubbles:true}));window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyC",bubbles:true}))');
    assert.equal(await evalJS('window.rocketArena.cameraView.ballCam'),false);
    assert.equal(await evalJS('document.getElementById("viewToggle").getAttribute("aria-pressed")'),'false');
    await evalJS('document.getElementById("viewToggle").click();document.getElementById("cinematicToggle").click()');
    assert.equal(await evalJS('window.rocketArena.cameraView.ballCam'),true);
    assert(cameraProjection.configuredFov===105,'Original configured FOV must be preserved');
    assert.equal(await evalJS('document.getElementById("speedValue")===null'),true);
    assert.equal(await evalJS('document.activeElement===document.getElementById("name")'),false,'Starting gameplay must release text-field focus');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"ShiftLeft",bubbles:true}));window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('window.rocketArena.cars[0].jumps===1 && window.rocketArena.cars[0].y>1.5'),10000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('(()=>{const c=window.rocketArena.cars[0];return !c.ground && c.y>6 && c.vy>1 && c.pitch>.6;})()'),30000)
      .catch(async err=>{throw new Error('Ground-to-air assisted takeoff failed: '+err.message+' '+await evalJS('JSON.stringify({y:window.rocketArena.cars[0].y,vy:window.rocketArena.cars[0].vy,pitch:window.rocketArena.cars[0].pitch})'));});
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"ShiftLeft",bubbles:true}));document.getElementById("trainingResetCar").click()');
    console.log('PASS: real Space then Shift aerial takeoff from the ground');
    await evalJS(`(()=>{const c=window.rocketArena.cars[0];Object.assign(c,{x:12,y:.55,z:88,vx:0,vy:0,vz:0,ground:false,jumps:2,jt:2,flip:0,roll:Math.PI/2,pitch:0,yaw:0,wallRide:false,wallDetachTimer:0,surfaceQuat:null,airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2),airOmega:null,recoveryTimer:0,bodyRestTime:0});})()`);
    await eventually(()=>evalJS('window.rocketArena.cars[0].ground && Math.abs(window.rocketArena.cars[0].roll)<.15'),15000)
      .catch(async err=>{throw new Error('Sideways recovery: '+err.message+' '+await evalJS('JSON.stringify({y:window.rocketArena.cars[0].y,roll:window.rocketArena.cars[0].roll,timer:window.rocketArena.cars[0].recoveryTimer})'));});
    await evalJS(`(()=>{const c=window.rocketArena.cars[0];Object.assign(c,{y:.55,vx:0,vy:0,vz:0,ground:false,jumps:2,jt:2,roll:Math.PI,wallDetachTimer:0,surfaceQuat:null,airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI),airOmega:null,recoveryTimer:0,bodyRestTime:0});})()`);
    await eventually(()=>evalJS('!!window.rocketArena.cars[0].bodyContact && !window.rocketArena.cars[0].ground'),20000).catch(async err=>{throw new Error('Roof setup: '+err.message+' '+await evalJS('JSON.stringify((({y,vy,ground,roll,pitch,airOmega,bodyContact,recoveryTimer,bodyRestTime})=>({y,vy,ground,roll,pitch,airOmega,bodyContact,recoveryTimer,bodyRestTime}))(window.rocketArena.cars[0]))'));});
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('window.rocketArena.cars[0].ground && Math.abs(window.rocketArena.cars[0].roll)<.15'),15000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"Space",bubbles:true}))');
    const recoveredImage=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(os.tmpdir(),'rocket-car-recovered.png'),Buffer.from(recoveredImage.data,'base64'));
    await evalJS('document.getElementById("trainingResetCar").click()');
    console.log('PASS: actual model sideways settling and Space self-righting after both jumps are exhausted');
    for(const pitch of [-Math.PI/3,Math.PI/3]){
      await evalJS(`(()=>{const c=window.rocketArena.cars[0];Object.assign(c,{
        x:30,y:5,z:0,vx:0,vy:-8,vz:0,ground:false,jumps:2,jt:2,flip:0,
        pitch:${pitch},yaw:0,roll:.3,wallRide:false,wallDetachTimer:0,
        surfaceQuat:null,landingQuat:null,airQuat:new THREE.Quaternion().setFromEuler(new THREE.Euler(${-pitch},0,.3,'YXZ')),
        airOmega:null,recoveryTimer:0,bodyRestTime:0});})()`);
      await eventually(()=>evalJS(`(()=>{const c=window.rocketArena.cars[0];return c.ground&&c.y<.8&&
        c.mesh.root.quaternion.angleTo(new THREE.Quaternion())<.025;})()`),15000)
        .catch(async err=>{throw new Error('Tilted aerial landing: '+err.message+' '+await evalJS('JSON.stringify((({y,ground,pitch,roll})=>({y,ground,pitch,roll}))(window.rocketArena.cars[0]))'));});
    }
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('!window.rocketArena.cars[0].ground&&window.rocketArena.cars[0].jumps===1'),10000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"Space",bubbles:true}));document.getElementById("trainingResetCar").click()');
    console.log('PASS: real model compound nose-up/nose-down landings settle onto tyres and allow the next jump');
    const previousFlightMode=await evalJS('document.getElementById("settingKeyboardFlight").value');
    await evalJS(`document.getElementById('settingKeyboardFlight').value='manual';
      document.getElementById('settingKeyboardFlight').dispatchEvent(new Event('change',{bubbles:true}));
      Object.assign(window.rocketArena.cars[0],{x:0,y:18,z:0,vx:0,vy:0,vz:0,yaw:0,pitch:0,roll:0,
        ground:false,jumps:1,jt:.1,flip:0,airQuat:new THREE.Quaternion(),airOmega:null,
        recoveryTimer:0,bodyContact:false,bodyRestTime:0,wallDetachTimer:0});
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));`);
    try {
      await eventually(()=>evalJS('window.rocketArena.cars[0].flip>.1 && window.rocketArena.cars[0].jumps===2'),10000);
      await evalJS(`window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}))`);
      await eventually(()=>evalJS('window.rocketArena.cars[0].flip===0'),10000);
      const flipPose=await evalJS(`(()=>{window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
        const c=window.rocketArena.cars[0];return {angle:c.airQuat.angleTo(new THREE.Quaternion()),
          bodyAngle:c.mesh.body.quaternion.angleTo(new THREE.Quaternion()),axis:c.flipAxis};})()`);
      assert(flipPose.angle<.45,'Holding W through a front flip must not leave the car vertical: '+JSON.stringify(flipPose));
      assert(flipPose.bodyAngle<1e-7 && flipPose.axis===null,'Finished flip must not keep spinning the visible body');
      console.log('PASS: real keyboard front flip with W held, clean physical/body finish and no residual somersault');
    } finally {
      await evalJS(`for(const code of ['Space','KeyW'])window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
        document.getElementById('settingKeyboardFlight').value=${JSON.stringify(previousFlightMode)};
        document.getElementById('settingKeyboardFlight').dispatchEvent(new Event('change',{bubbles:true}));
        document.getElementById('trainingResetCar').click();`);
    }

    await evalJS('document.getElementById("trainingTools").open=true;document.getElementById("trainingPreset").value="wall"; document.getElementById("trainingPreset").dispatchEvent(new Event("change",{bubbles:true}))');
    assert.equal(await evalJS('window.rocketArena.ball.x > 60'),true);
    assert.equal(await evalJS('document.getElementById("trainingShotCount").textContent.includes("2")'),true);
    await evalJS('document.getElementById("trainingNextShot").click()');
    assert.equal(await evalJS('document.getElementById("trainingShotCount").textContent.includes("3")'),true);
    assert.equal(await evalJS('window.rocketArena.cars[0].wallVerticalAxis'), 'x');
    const wallSign = await evalJS('window.rocketArena.cars[0].wallVerticalSign');
    const frozenHeight = await evalJS('window.rocketArena.ball.y');
    await delay(350);
    assert(Math.abs(await evalJS('window.rocketArena.ball.y') - frozenHeight)<0.01,
      'Wall training shot dropped before launch input');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"ShiftLeft",bubbles:true}))');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('window.rocketArena.cars[0].jumps === 1 && window.rocketArena.cars[0].wallVerticalAxis === null'),9000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"Space",bubbles:true}))');
    assert.equal(await evalJS('window.rocketArena.cars[0].vx * '+wallSign+' < -2'),true,
      'Wall jump failed to detach inward for the selected side');
    assert.equal(await evalJS('window.rocketArena.cars[0].pitch > 0.6'),true,
      'Wall jump reset the aerial nose-up pitch');
    // Require a REAL car-ball collision from this repeatable practice setup,
    // not merely a camera movement or a scripted "air dribble" label.
    await eventually(()=>evalJS('window.rocketArena.cars[0].jumps > 0 && /[1-9]/.test(document.getElementById("trainingTouchCount").textContent)'),15000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"ShiftLeft",bubbles:true}))');
    console.log('Wall-to-air dribble achieved at least one real airborne ball touch.');
    await evalJS('document.getElementById("trainingLaunch").click()');
    await delay(250);
    assert.equal(await evalJS('Number.isFinite(window.rocketArena.ball.y)'),true);
    // Full 3D flight must overcome gravity with upward-oriented boost.
    // Leave the wall drill: a goal in that drill deliberately freezes the next
    // attempt until Space. An unrelated aerial check must not inherit that gate.
    await evalJS(`document.getElementById('trainingPreset').value='aerial';
      document.getElementById('trainingPreset').dispatchEvent(new Event('change',{bubbles:true}));`);
    await evalJS('(function(){const c=window.rocketArena.cars[0]; Object.assign(c,{x:0,y:16,z:0,vx:0,vy:0,vz:0,pitch:1.15,yaw:0,roll:0,ground:false,airQuat:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-1.15),surfaceQuat:null,airOmega:null,recoveryTimer:0,bodyContact:false,wallRide:false,wallVerticalAxis:null,wallDetachTimer:1,jumps:1,hold:0,flip:0,ballHitCooldown:0});window.rocketArena.ball.x=40;window.rocketArena.ball.z=40;})()');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"ShiftLeft",bubbles:true}))');
    await eventually(()=>evalJS('window.rocketArena.cars[0].vy > 1.4 && !!window.rocketArena.cars[0].airQuat'),15000)
      .catch(async err=>{throw new Error('Aerial boost failed after physics progress: '+err.message+
        ', vy='+await evalJS('window.rocketArena.cars[0].vy')+
        ', pitch='+await evalJS('window.rocketArena.cars[0].pitch'));});
    const airVy=await evalJS('window.rocketArena.cars[0].vy');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"ShiftLeft",bubbles:true}))');
    assert(airVy>1,'Aerial boost did not produce vertical lift');
    // Q/E air roll must actually rotate the physics quaternion, not only the mesh.
    const beforeRoll=await evalJS('window.rocketArena.cars[0].airQuat.toArray().join(",")');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyE",bubbles:true}))');
    await eventually(()=>evalJS('!!window.rocketArena.cars[0].airQuat && window.rocketArena.cars[0].airQuat.toArray().join(",") !== '+JSON.stringify(beforeRoll)),12000)
      .catch(async err=>{throw new Error('Physical air roll input had no effect: '+err.message+
        ' omega='+await evalJS('JSON.stringify(window.rocketArena.cars[0].airOmega)'));});
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyE",bubbles:true}))');
    console.log('Air boost sustained lift and local-axis air roll passed.');
    await evalJS('document.getElementById("trainingResetBall").click()');
    const resetY=await evalJS('window.rocketArena.ball.y');
    assert(Math.abs(resetY-(91.25/50+0.038))<.3,'Training ball did not reset');
    // Actually score in Free Play and verify the chosen 3D explosion plays.
    const goalsBefore=await evalJS('Number(document.getElementById("trainingGoalCount").textContent.match(/\\d+/)[0])');
    const trainingAnthemStarts=await evalJS('window.rocketArena.anthemStatus.starts');
    await evalJS('(function(){const b=window.rocketArena.ball;Object.assign(b,{x:0,y:2,z:105,vx:0,vy:0,vz:32});})()');
    const celebration=await eventually(()=>evalJS(`(()=>{
      const a=window.rocketArena,c=a.miniCrowd;
      return Number(document.getElementById('trainingGoalCount').textContent.match(/\\d+/)[0])===${goalsBefore+1} && a.goalEffectCount>0 && c.cheerTime>0
        ? {team:c.cheerTeam,cheering:c.faces.material.map===c.cheerFace}:null;
    })()`),10000).catch(async err=>{throw new Error('Free Play scoring explosion: '+err.message+' '+await evalJS('JSON.stringify({state:window.rocketArena.state,goals:document.getElementById("trainingGoalCount").textContent,ball:window.rocketArena.ball,effects:window.rocketArena.goalEffectCount,cheer:window.rocketArena.miniCrowd.cheerTime})'));});
    assert.equal(celebration.team,0,'Scoring blue side did not trigger crowd celebration');
    assert.equal(celebration.cheering,true,'Mini spectators did not switch to cheering faces');
    await eventually(()=>evalJS('window.rocketArena.anthemStatus.playing&&window.rocketArena.anthemStatus.mode==="goal"&&window.__testAnthemRms()>.003'));
    assert.equal(await evalJS('window.rocketArena.anthemStatus.starts'),trainingAnthemStarts+1,'A Free Play goal must start its selected song once');
    await eventually(()=>evalJS('window.rocketArena.miniCrowd.cheerTime===0'),6000);
    assert.equal(await evalJS('window.rocketArena.miniCrowd.faces.material.map===window.rocketArena.miniCrowd.calmFace'),true,
      'Mini spectators did not return to their normal happy faces');
    await evalJS('document.getElementById("trainingExit").click()');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');
    await eventually(()=>evalJS('!window.rocketArena.anthemStatus.playing'));

    await evalJS('document.getElementById("settingCameraCompetitive").click()');
    assert.equal(await evalJS('Number(document.getElementById("settingCameraFov").value)'),105);
    assert.equal(await evalJS('Number(document.getElementById("settingCameraDistance").value)'),5.6);
    await evalJS('document.getElementById("settingCameraFov").value="87"; document.getElementById("settingCameraFov").dispatchEvent(new Event("input",{bubbles:true}))');
    assert.equal(await evalJS('JSON.parse(localStorage.getItem("rocketArenaSettingsV1")).camera.fov'),87);
    console.log('Free Play passed; testing normal match');
    await evalJS('document.getElementById("settingGraphics").value="low"; document.getElementById("settingGraphics").dispatchEvent(new Event("change",{bubbles:true}))');
    await evalJS('document.getElementById("playBtn").click()');
    await eventually(()=>evalJS('window.rocketArena.state==="play"'),18000)
      .catch(async err=>{throw new Error('Match kickoff: '+err.message+' state='+await evalJS('window.rocketArena.state')+
        ' announcement='+await evalJS('document.getElementById("msg").textContent')+' browserErrors='+JSON.stringify(errors));});
    assert.equal(await evalJS('window.rocketArena.cars.length'),4);
    const matchSeconds=await evalJS('document.getElementById("clock").textContent.split(":").reduce((m,s)=>m*60+Number(s),0)');
    assert(matchSeconds>280 && matchSeconds<=300,'Match should start with five minutes');
    const pos0=await evalJS('window.rocketArena.cars[0].z');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"KeyW",bubbles:true}))');
    try {
      await eventually(()=>evalJS('window.rocketArena.cars[0].z>'+JSON.stringify(pos0+.05)),10000);
    } finally {
      await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"KeyW",bubbles:true}))');
    }
    const pos1=await evalJS('window.rocketArena.cars[0].z');
    assert(pos1>pos0+0.05,'Car did not move when accelerating: '+pos0+' -> '+pos1);
    assert.equal(await evalJS('Number.isFinite(window.rocketArena.ball.x) && Number.isFinite(window.rocketArena.ball.y) && Number.isFinite(window.rocketArena.ball.z)'),true);
    assert.equal(await evalJS('document.getElementById("speedHud")===null'),true,'Bottom-left speedometer must be removed');
    await eventually(()=>evalJS('window.rocketArena.replayStatus.duration>5'),60000).catch(async err=>{throw new Error('Replay capture: '+err.message+' '+await evalJS('JSON.stringify({state:window.rocketArena.state,replay:window.rocketArena.replayStatus})'));});
    const anthemStartsBeforeGoal=await evalJS('window.rocketArena.anthemStatus.starts');
    await evalJS('if(window.rocketArena.cameraView.ballCam)document.getElementById("viewToggle").click()');
    await evalJS('Object.assign(window.rocketArena.ball,{x:0,y:2,z:105,vx:0,vy:0,vz:32})');
    const matchGoal=await eventually(()=>evalJS(`(()=>{const a=window.rocketArena,e=a.goalEffects[0];return a.state==='goal'&&e?{style:e.style,selected:document.getElementById('explosion').value,z:e.group.position.z,direction:e.group.rotation.y,speed:a.goalSpeedMph,speedText:document.getElementById('goalSpeed').textContent,clock:document.getElementById('clock').textContent}:null;})()`),10000);
    assert.equal(matchGoal.style,matchGoal.selected,'Actual match must play the selected 3D model');
    assert.equal(matchGoal.z,103,'Celebration must be anchored at the goal mouth');
    assert.equal(matchGoal.direction,Math.PI,'Celebration must face into the pitch');
    const goalSpeed=matchGoal.speed;
    assert(Math.abs(goalSpeed-35.8)<.2,'Goal speed must use the 32-world-unit ball velocity, not the car speed');
    assert.equal(matchGoal.speedText, 'GOAL SPEED · '+goalSpeed.toFixed(1)+' MPH');
    const goalClock=matchGoal.clock;
    const replayView=await eventually(()=>evalJS(`(()=>{const a=window.rocketArena;if(a.state!=='replay'||a.replayStatus.elapsed<=0||!a.anthemStatus.playing)return null;const result={view:a.cameraView,ball:{x:a.ball.x,y:a.ball.y,z:a.ball.z},clock:document.getElementById('clock').textContent};for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code:'KeyP',bubbles:true}));return result;})()`),15000);
    assert.deepEqual(replayView.view.target,[replayView.ball.x,replayView.ball.y,replayView.ball.z],
      'Actual goal replay must track the ball, independently of the scorer');
    assert.equal(replayView.view.verticalFov,87,'Replay must use the saved FOV');
    assert.equal(await evalJS('getComputedStyle(document.getElementById("replayControls")).display'), 'flex','Replay camera choice must be visible');
    await evalJS('document.querySelector("[data-replay-camera=car]").click()');
    const carReplay=await eventually(()=>evalJS(`(()=>{const a=window.rocketArena;return a.cameraView.replayMode==='car'&&a.cameraView.target.some((v,i)=>Math.abs(v-[a.ball.x,a.ball.y,a.ball.z][i])>.1)?a.cameraView:null;})()`));
    assert.equal(carReplay.verticalFov,87,'Car replay view must preserve FOV');
    await evalJS('document.querySelector("[data-replay-camera=ball]").click()');
    await eventually(()=>evalJS(`(()=>{const a=window.rocketArena;return a.cameraView.target.every((v,i)=>v===[a.ball.x,a.ball.y,a.ball.z][i]);})()`));
    assert.equal(replayView.clock,goalClock,'Match clock must stay frozen through the replay');
    await evalJS(`for(const type of ['keydown','keyup'])window.dispatchEvent(new KeyboardEvent(type,{code:'KeyP',bubbles:true}))`);
    await eventually(()=>evalJS('window.rocketArena.anthemStatus.playing&&window.rocketArena.anthemStatus.mode==="replay"'),10000);
    await eventually(()=>evalJS('window.__testAnthemRms()>.003'),5000);
    assert.equal(await evalJS('window.rocketArena.anthemStatus.track'),'rap');
    assert.equal(await evalJS('window.rocketArena.anthemStatus.starts'),anthemStartsBeforeGoal+1,'Replay must start the selected anthem exactly once');

    assert.equal(await evalJS('window.rocketArena.goalSpeedMph'),goalSpeed,'Goal speed must remain captured during replay');
    const replayStatus=await evalJS('window.rocketArena.replayStatus');
    assert(replayStatus.duration>2 && replayStatus.frames>50,'Replay must contain distinct physics-clock samples');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true,cancelable:true}))');
    await eventually(()=>evalJS('window.rocketArena.state==="kick" || window.rocketArena.state==="play"'),10000);
    assert.equal(await evalJS('Math.abs(window.rocketArena.ball.z)<1'),true,'Skipping replay must restore kickoff instead of leaving the scored ball in the goal');
    assert.equal(await evalJS('window.rocketArena.cameraView.ballCam'),false,'Ball-follow replay must preserve the live camera toggle');
    await eventually(()=>evalJS('window.rocketArena.anthemStatus.fading&&window.rocketArena.anthemStatus.playing'));
    await eventually(()=>evalJS('window.__testAnthemRms()>.0003'));
    await eventually(()=>evalJS('!window.rocketArena.anthemStatus.playing'),22000);
    assert.equal(await evalJS('window.rocketArena.anthemStatus.starts'),anthemStartsBeforeGoal+1,'Skipping must finish the anthem without restarting it');
    await evalJS('document.getElementById("quickPlayButton").click()');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');
    await evalJS('document.getElementById("quickCasual").click()');
    await eventually(()=>evalJS('window.rocketArena.state==="play" && window.rocketArena.cars.length===2'),16000)
      .catch(err=>{throw new Error('Casual 1v1 preset failed: '+err.message);});
    await evalJS('document.getElementById("quickPlayButton").click()');
    await evalJS('document.getElementById("quickFreestyle").click()');
    assert.equal(await evalJS('document.getElementById("trainingPreset").value'),'wall');
    assert.equal(await evalJS('window.rocketArena.cars.length'),1);
    assert.equal(await evalJS('document.getElementById("ballFeel")===null'),true);
    await evalJS(`document.getElementById('quickPlayButton').click();document.getElementById('quickNexto').click()`);
    await eventually(()=>evalJS('window.rocketArena.nextoStatus.state==="failed"'),60000);
    assert.equal(await evalJS('window.rocketArena.state'),'menu','A failed AI load must not start a match with fake Nexto bots');
    assert.equal(await evalJS('document.getElementById("nextoStatus").textContent.includes("retry")'),true);
    await evalJS('document.getElementById("quickNexto").click()');
    await eventually(()=>evalJS('window.rocketArena.nextoStatus.ready && window.rocketArena.state==="play" && window.rocketArena.cars.length===2'),60000);
    assert.equal(await evalJS('window.rocketArena.cars[1].displayName'),'ORANGE NEXTO 1');
    const policyFixture=JSON.parse(fs.readFileSync('tests/nexto-policy-fixture.json','utf8'));
    const parity=await evalJS(`(async()=>{
      const worker=new Worker('lib/nexto/policy-check-worker.js');
      return await new Promise((resolve,reject)=>{worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data)};worker.postMessage(${JSON.stringify(policyFixture)});});
    })()`);
    assert(parity.maxError<.0002,'Browser inference must match the official trained policy: '+JSON.stringify(parity));
    await evalJS(`(()=>{const c=window.rocketArena.cars[1];Object.assign(c,{x:0,y:.55,z:30,yaw:Math.PI,pitch:0,roll:0,vx:0,vy:0,vz:0,ground:true,airQuat:null,surfaceQuat:null,surfaceForward:null,surfaceNormal:null,nextoPreviousQuat:null,flip:0,recoveryTimer:0,wallRide:false});Object.assign(window.rocketArena.ball,{x:15,y:2,z:0,vx:0,vy:0,vz:0});})()`);
    const initialPredictions=await evalJS('window.rocketArena.nextoStatus.inferences');
    await eventually(()=>evalJS(`window.rocketArena.nextoStatus.inferences>${initialPredictions+3} && window.rocketArena.cars[1].x>.2 && window.rocketArena.cars[1].z<29`),20000);
    for(const teamSize of [2,3]){
      await evalJS(`document.getElementById('quickPlayButton').click();document.querySelector('[data-mode="${teamSize}"]').click();document.querySelector('[data-diff="3"]').click();document.getElementById('playBtn').click();`);
      await eventually(()=>evalJS('window.rocketArena.state==="play"'),20000);
      assert.equal(await evalJS('window.rocketArena.cars.length'),teamSize*2);
      assert.equal(await evalJS('window.rocketArena.cars.filter(c=>c.ai&&c.nexto).length'),teamSize*2-1);
      const count=await evalJS('window.rocketArena.nextoStatus.inferences');
      await eventually(()=>evalJS(`window.rocketArena.nextoStatus.inferences>${count+1}`),20000);
      assert.equal(await evalJS('window.rocketArena.nextoStatus.ready'),true);
    }
    console.log('PASS: Nexto download failure/retry, real PyTorch/WASM policy parity, learned steering and batched 1v1/2v2/3v3 opponents.');
    await call('Page.reload',{ignoreCache:true});
    await eventually(()=>evalJS('!!window.rocketArena&&document.readyState==="complete"'),45000);
    assert.equal(await evalJS('document.querySelector("[data-anthem=rap]").getAttribute("aria-pressed")'),'true','Anthem selection must persist after refresh');
    assert.equal(await evalJS('document.getElementById("settingAnthemVolume").value'),'35','Anthem volume must persist after refresh');
    assert.equal(await evalJS('window.rocketArena.anthemStatus.playing'),false,'Reloading the garage must not autoplay music');
    assert.deepEqual(errors,[],'Unexpected browser JS errors');
    console.log('PASS: WebGL startup, engine audio, menu, Free Play, match driving, accurate goal speed, ball-follow replay with saved FOV and Space skip.');
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
