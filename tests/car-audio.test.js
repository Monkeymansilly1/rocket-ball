'use strict';
const assert=require('node:assert/strict');
const {CarAudio,engineTargets}=require('../lib/car-audio.js');
class Param{
 constructor(){this.value=0;this.events=[];}
 setTargetAtTime(value,time,constant){assert(Number.isFinite(value));assert(constant>0);this.events.push({type:'target',value,time,constant});this.value=value;}
 setValueAtTime(value,time){this.events.push({type:'set',value,time});this.value=value;}
 linearRampToValueAtTime(value,time){this.events.push({type:'attack',value,time});this.value=value;}
 exponentialRampToValueAtTime(value,time){assert(value>0);this.events.push({type:'decay',value,time});this.value=value;}
}
class Node{
 constructor(){for(const key of ['gain','frequency','Q','threshold','knee','ratio','attack','release'])this[key]=new Param();this.connections=[];}
 connect(node){this.connections.push(node);return node;}
 disconnect(){this.disconnected=true;}
 start(time){this.started=time??0;}
 stop(time){this.stopped=time;}
 setPeriodicWave(wave){this.wave=wave;}
}
class Context{
 constructor(){this.currentTime=1;this.sampleRate=48000;this.state='suspended';this.destination=new Node();this.nodes=[];this.resumeCalls=0;}
 make(){const n=new Node();this.nodes.push(n);return n;}
 createGain(){return this.make();}createOscillator(){return this.make();}createDynamicsCompressor(){return this.make();}
 createBiquadFilter(){return this.make();}createBufferSource(){return this.make();}
 createPeriodicWave(real,imag){assert.equal(real.length,imag.length);return {real,imag};}
 createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
 resume(){this.state='running';this.resumeCalls++;return Promise.resolve();}
}
const idle=engineTargets({},true),accelerating=engineTargets({vx:15,engineLoad:1},true);
assert(accelerating.frequency>idle.frequency);assert(accelerating.gain>idle.gain);
assert.equal(engineTargets({fl:1},false).boost,0);
assert(engineTargets({fl:1},true).boost>0);
const audio=new CarAudio();audio.init();assert.equal(audio.ac,null);
audio.init(Context);assert.equal(audio.ac.state,'running');const count=audio.ac.nodes.length;audio.init(Context);assert.equal(audio.ac.nodes.length,count,'Starting again must not duplicate engine loops');
audio.ac.state='interrupted';const resumes=audio.ac.resumeCalls;audio.init(Context);assert.equal(audio.ac.state,'running');assert.equal(audio.ac.resumeCalls,resumes+1);
assert(audio.engine.wave,'Engine must use softened harmonics rather than a raw sawtooth');
assert.equal(audio.engineFilter.type,'lowpass');assert.equal(audio.boostFilter.type,'bandpass');
audio.update({vx:20,engineLoad:1,fl:1},true);
assert(audio.engineGain.gain.value>0 && audio.engineGain.gain.value<.05);
assert.equal(audio.boostGain.gain.events.at(-1).type,'target','Boost must fade rather than click on/off');
audio.muted=true;audio.update({vx:20,fl:1},true);
assert.equal(audio.engineGain.gain.value,0);assert.equal(audio.boostGain.gain.value,0);
audio.muted=false;audio.setVolume(0);const before=audio.ac.nodes.length;audio.tone(200,.2,'square',1);assert.equal(audio.ac.nodes.length,before);
audio.setVolume(.5);audio.tone(200,.2,'square',1);
const voice=audio.ac.nodes.at(-2),gain=audio.ac.nodes.at(-1);
assert.equal(voice.type,'triangle');assert.equal(gain.gain.events[0].value,0);assert.equal(gain.gain.events[1].type,'attack');assert(gain.gain.events[1].value<=.22);
voice.onended();assert(voice.disconnected&&gain.disconnected,'One-shot sounds must disconnect after finishing');
audio.update({},false);assert.equal(audio.engineGain.gain.value,0);
const closed=audio.ac;closed.state='closed';audio.init(Context);assert.notEqual(audio.ac,closed);assert.equal(audio.ac.state,'running','Enable Sound must be able to replace a closed context');
console.log('PASS: filtered engine layers, smoothed pitch/boost, volume/mute, audio resume and one-shot cleanup');
