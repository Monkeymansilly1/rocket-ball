(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.RocketCarAudio=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function engineTargets(car,playing){
  const speed=Math.hypot(car?.vx||0,car?.vy||0,car?.vz||0);
  const load=clamp(Math.abs(car?.engineLoad||0),0,1),boost=!!car?.fl;
  const gear=Math.min(4,Math.floor(speed/10));
  const gearSpeed=Math.max(0,speed-gear*10);
  const rpm=clamp(850+gearSpeed*190+load*1000+(boost?450:0),850,4700);
  return {frequency:rpm/30,cutoff:260+rpm*.19,gain:playing ? .018+load*.016+Math.min(speed/46,1)*.008 : 0,
    intake:playing?load*.013:0,boost:playing&&boost ? .065 : 0};
}
class CarAudio{
  constructor(){this.volume=.75;this.muted=false;this.ac=null;}
  init(Context){
    if(this.ac){if(this.ac.state==='suspended')this.ac.resume()?.catch(()=>{});return;}
    if(!Context)return;
    const a=this.ac=new Context();
    this.master=a.createGain();this.master.gain.value=this.volume;
    const limiter=a.createDynamicsCompressor();limiter.threshold.value=-18;limiter.knee.value=18;limiter.ratio.value=4;limiter.attack.value=.008;limiter.release.value=.18;
    this.master.connect(limiter);limiter.connect(a.destination);
    this.engine=a.createOscillator();
    const real=new Float32Array(7),imag=new Float32Array([0,1,.32,.12,.055,.025,.01]);
    this.engine.setPeriodicWave(a.createPeriodicWave(real,imag));
    this.engineFilter=a.createBiquadFilter();this.engineFilter.type='lowpass';this.engineFilter.Q.value=.5;
    this.engineGain=a.createGain();this.engineGain.gain.value=0;
    this.engine.connect(this.engineFilter).connect(this.engineGain).connect(this.master);this.engine.start();
    this.bass=a.createOscillator();this.bass.type='sine';this.bassGain=a.createGain();this.bassGain.gain.value=0;
    this.bass.connect(this.bassGain).connect(this.master);this.bass.start();
    const buffer=a.createBuffer(1,a.sampleRate*2,a.sampleRate),data=buffer.getChannelData(0);
    let previous=0;for(let i=0;i<data.length;i++){previous=(previous+(Math.random()*2-1)*.025)/1.025;data[i]=previous*4;}
    this.noise=a.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;
    this.intakeFilter=a.createBiquadFilter();this.intakeFilter.type='bandpass';this.intakeFilter.frequency.value=340;this.intakeFilter.Q.value=.6;
    this.intakeGain=a.createGain();this.intakeGain.gain.value=0;
    this.noise.connect(this.intakeFilter).connect(this.intakeGain).connect(this.master);
    this.boostFilter=a.createBiquadFilter();this.boostFilter.type='bandpass';this.boostFilter.frequency.value=1100;this.boostFilter.Q.value=.45;
    this.boostGain=a.createGain();this.boostGain.gain.value=0;
    this.noise.connect(this.boostFilter).connect(this.boostGain).connect(this.master);this.noise.start();
    if(a.state==='suspended')a.resume()?.catch(()=>{});
  }
  setVolume(value){this.volume=clamp(Number(value)||0,0,1);if(this.ac)this.master.gain.setTargetAtTime(this.volume,this.ac.currentTime,.03);}
  tone(frequency,duration,type,volume){
    if(!this.ac||this.muted||this.volume===0)return;
    const a=this.ac,o=a.createOscillator(),g=a.createGain(),now=a.currentTime;
    o.type=type==='square'?'triangle':type;o.frequency.value=frequency;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(Math.min(volume,.22),now+.008);
    g.gain.exponentialRampToValueAtTime(.0001,now+Math.max(duration,.02));
    o.connect(g).connect(this.master);o.onended=()=>{o.disconnect();g.disconnect();};o.start(now);o.stop(now+Math.max(duration,.02)+.01);
  }
  update(car,playing){
    if(!this.ac)return;
    const target=engineTargets(car,playing&&!this.muted&&this.volume>0),now=this.ac.currentTime;
    this.engine.frequency.setTargetAtTime(target.frequency,now,.13);
    this.bass.frequency.setTargetAtTime(target.frequency*.5,now,.13);
    this.engineFilter.frequency.setTargetAtTime(target.cutoff,now,.16);
    this.engineGain.gain.setTargetAtTime(target.gain,now,.055);
    this.bassGain.gain.setTargetAtTime(target.gain*.38,now,.07);
    this.intakeGain.gain.setTargetAtTime(target.intake,now,.065);
    this.boostGain.gain.setTargetAtTime(target.boost,now,.09);
  }
}
return {CarAudio,engineTargets};
});
