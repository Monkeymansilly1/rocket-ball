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
    async function evalJS(expr,userGesture=false){
      const result=await call('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true,userGesture});
      if(result.exceptionDetails)throw new Error(result.exceptionDetails.text+' '+JSON.stringify(result.exceptionDetails.exception));
      return result.result?.value;
    }
    await call('Page.enable');
    await call('Runtime.enable');
    console.log('Navigating headless Chrome to local Rocket Ball server');
    await call('Page.navigate',{url});
    await eventually(()=>evalJS('document.readyState==="complete" && !!window.rocketArena && !!window.THREE'),15000)
      .catch(err=>{throw new Error('Game startup: '+err.message+'; browser exceptions: '+JSON.stringify(errors));});
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
    const signatures=await evalJS(`Object.keys(RocketGoalEffects.STYLES).map(style=>{
      document.querySelector('[data-effect="'+style+'"]').click();
      const effect=window.rocketArena.goalEffects[0];
      if(effect.style!==style)throw new Error('Wrong effect for '+style);
      return effect.signature.join(',');
    })`);
    assert.equal(new Set(signatures).size,8,'Selections must use eight different 3D models');
    assert.equal(await evalJS('window.rocketArena.pitch.material.map.encoding===THREE.sRGBEncoding'),true,
      'Pitch texture must use the colour API supported by bundled Three.js');
    assert.equal(await evalJS('window.rocketArena.ballShadow.isMesh'),true);
    assert.equal(await evalJS('window.rocketArena.ballTrail.isLine'),true);
    assert.equal(await evalJS('document.querySelectorAll("#explosion option").length'),8);
    assert.equal(await evalJS('document.querySelectorAll("[data-quick]").length'),3);
    // Preview every selectable goal style without scoring a real match.
    await evalJS(`for(const style of ["classic","fire","galaxy","lightning","blackhole","supernova","pixel","aurora"])window.rocketArena.previewGoalExplosion(style)`);
    assert((await evalJS('window.rocketArena.goalEffectCount'))>0,
      '3D explosion preview never spawned scene objects');
    assert((await evalJS('window.rocketArena.goalEffectCount'))<=2,
      '3D goal explosion preview leaks unbounded meshes');
    await eventually(()=>evalJS('window.rocketArena.goalEffectCount===0'),10000);
    // The actual menu preview button must use the same real 3D effect path.
    await evalJS('document.getElementById("explosion").value="pixel";document.getElementById("explosionPreview").click()');
    assert((await evalJS('window.rocketArena.goalEffectCount'))>0,
      'Goal explosion preview button is not wired to the renderer');
    assert.equal(await evalJS('document.getElementById("explosionPreviewStatus").textContent.includes("Voxel")'),true);
    await eventually(()=>evalJS('window.rocketArena.goalEffectCount===0'),8000);
    console.log('PASS: eight distinct 3D explosions, menu navigation, previews, cleanup and correct turf colour space');
    console.log('Game loaded; testing Free Play');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');
    // Verify the NEW arena exists as playable 3D geometry, not just an image.
    assert.equal(await evalJS('window.rocketArena.stadium.name'), 'Rocket Ball Championship Arena');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.bodies.count'),4096,
      'Dense mini potato spectators were not created');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.faces.count'),4096,
      'Mini crowd faces missing');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.outlines.count'),4096,
      'Outlined mini potato bodies missing');
    assert.equal(await evalJS('window.rocketArena.miniCrowd.flagData.length'),171,
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
    await eventually(()=>evalJS('!!window.rocketArena.cars[0].bodyContact && !window.rocketArena.cars[0].ground'),10000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}))');
    await eventually(()=>evalJS('window.rocketArena.cars[0].ground && Math.abs(window.rocketArena.cars[0].roll)<.15'),15000);
    await evalJS('window.dispatchEvent(new KeyboardEvent("keyup",{code:"Space",bubbles:true}))');
    const recoveredImage=await call('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(os.tmpdir(),'rocket-car-recovered.png'),Buffer.from(recoveredImage.data,'base64'));
    await evalJS('document.getElementById("trainingResetCar").click()');
    console.log('PASS: actual model sideways settling and Space self-righting after both jumps are exhausted');
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
    await evalJS('(function(){const c=window.rocketArena.cars[0]; Object.assign(c,{x:0,y:16,z:0,vx:0,vy:0,vz:0,pitch:1.15,yaw:0,roll:0,airQuat:null,airOmega:null,wallRide:false,wallVerticalAxis:null,wallDetachTimer:1,jumps:1,hold:0,flip:0,ballHitCooldown:0});window.rocketArena.ball.x=40;window.rocketArena.ball.z=40;})()');
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
    await evalJS('(function(){const b=window.rocketArena.ball;Object.assign(b,{x:0,y:2,z:105,vx:0,vy:0,vz:32});})()');
    const celebration=await eventually(()=>evalJS(`(()=>{
      const a=window.rocketArena,c=a.miniCrowd;
      return Number(document.getElementById('trainingGoalCount').textContent.match(/\\d+/)[0])===${goalsBefore+1} && a.goalEffectCount>0 && c.cheerTime>0
        ? {team:c.cheerTeam,cheering:c.faces.material.map===c.cheerFace}:null;
    })()`),10000).catch(async err=>{throw new Error('Free Play scoring explosion: '+err.message+' '+await evalJS('JSON.stringify({state:window.rocketArena.state,goals:document.getElementById("trainingGoalCount").textContent,ball:window.rocketArena.ball,effects:window.rocketArena.goalEffectCount,cheer:window.rocketArena.miniCrowd.cheerTime})'));});
    assert.equal(celebration.team,0,'Scoring blue side did not trigger crowd celebration');
    assert.equal(celebration.cheering,true,'Mini spectators did not switch to cheering faces');
    await eventually(()=>evalJS('window.rocketArena.miniCrowd.cheerTime===0'),6000);
    assert.equal(await evalJS('window.rocketArena.miniCrowd.faces.material.map===window.rocketArena.miniCrowd.calmFace'),true,
      'Mini spectators did not return to their normal happy faces');
    await evalJS('document.getElementById("trainingExit").click()');
    assert.equal(await evalJS('window.rocketArena.state'),'menu');

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
    await eventually(()=>evalJS('window.rocketArena.replayStatus.duration>2'),60000).catch(async err=>{throw new Error('Replay capture: '+err.message+' '+await evalJS('JSON.stringify({state:window.rocketArena.state,replay:window.rocketArena.replayStatus})'));});
    await evalJS('Object.assign(window.rocketArena.ball,{x:0,y:2,z:105,vx:0,vy:0,vz:32})');
    const matchGoal=await eventually(()=>evalJS(`(()=>{const a=window.rocketArena,e=a.goalEffects[0];return a.state==='goal'&&e?{style:e.style,selected:document.getElementById('explosion').value,z:e.group.position.z,direction:e.group.rotation.y}:null;})()`),10000);
    assert.equal(matchGoal.style,matchGoal.selected,'Actual match must play the selected 3D model');
    assert.equal(matchGoal.z,103,'Celebration must be anchored at the goal mouth');
    assert.equal(matchGoal.direction,Math.PI,'Celebration must face into the pitch');
    const goalSpeed=await evalJS('window.rocketArena.goalSpeedMph');
    assert(Math.abs(goalSpeed-35.8)<.2,'Goal speed must use the 32-world-unit ball velocity, not the car speed');
    assert.equal(await evalJS('document.getElementById("goalSpeed").textContent'), 'GOAL SPEED · '+goalSpeed.toFixed(1)+' MPH');
    const goalClock=await evalJS('document.getElementById("clock").textContent');
    await eventually(()=>evalJS('window.rocketArena.state==="replay" && window.rocketArena.replayStatus.elapsed>0'),15000);
    assert.equal(await evalJS('document.getElementById("clock").textContent'),goalClock,'Match clock must stay frozen through the replay');
    assert.equal(await evalJS('window.rocketArena.goalSpeedMph'),goalSpeed,'Goal speed must remain captured during replay');
    const replayStatus=await evalJS('window.rocketArena.replayStatus');
    assert(replayStatus.duration>2 && replayStatus.frames>50,'Replay must contain distinct physics-clock samples');
    await evalJS('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true,cancelable:true}))');
    await eventually(()=>evalJS('window.rocketArena.state==="kick" || window.rocketArena.state==="play"'),10000);
    assert.equal(await evalJS('Math.abs(window.rocketArena.ball.z)<1'),true,'Skipping replay must restore kickoff instead of leaving the scored ball in the goal');
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
    assert.deepEqual(errors,[],'Unexpected browser JS errors');
    console.log('PASS: WebGL startup, engine audio, menu, Free Play, match driving, accurate goal speed, interpolated replay and Space skip.');
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
