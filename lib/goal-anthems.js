/* Goal-anthems player. Shares the game's unlocked AudioContext. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketGoalAnthems=factory();
})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const TRACKS={
  dnb:{title:'Custom Jump-up',genre:'Jump-up DNB',url:'assets/anthems/dnb.mp3?v=user-upload-1'},
  grime:{title:'East Stand',genre:'Grime',bpm:140,url:'assets/anthems/grime.mp3'},
  rap:{title:'Touchline',genre:'Rap instrumental',bpm:92,url:'assets/anthems/rap.mp3'}
};
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
class Player{
  constructor({onStatus=()=>{},fetcher=globalThis.fetch?.bind(globalThis)}={}){
    this.onStatus=onStatus;this.fetcher=fetcher;this.buffers=new Map();this.pending=new Map();
    this.revision=0;this.current=null;this.intent=null;this.pausedData=null;
    this.volume=.55;this.masterVolume=.75;this.muted=false;this.lastReplayId=null;this.starts=0;this.message='';
  }
  init(context){
    if(this.ac===context||!context)return;
    const item=this.current||this.intent||this.pausedData,wasPaused=!!this.pausedData;
    const recovery=item?{track:item.track,mode:item.mode,token:item.token,
      offset:item.offset+(this.current?Math.max(0,this.ac.currentTime-item.startedAt):0),endingFrom:item.endingFrom??null,resume:!!this.current}:null;
    if(this.ac){this.stop(0);this.ac.removeEventListener?.('statechange',this.stateListener);this.master.disconnect();}
    this.ac=context;this.master=context.createGain();this.master.gain.value=this.level();this.master.connect(context.destination);
    if(recovery){if(wasPaused)this.pausedData=recovery;else this.intent=recovery;}
    this.stateListener=()=>this.notify();context.addEventListener?.('statechange',this.stateListener);
  }
  notify(message=this.message){
    this.message=message;
    const active=this.current||this.intent||this.pausedData;
    const warning=!active?'':this.muted?'Sound muted · click Enable Sound':this.masterVolume===0?'Game volume is 0% · click Enable Sound':
      this.volume===0?'Song volume is 0% · click Enable Sound':this.ac?.state!=='running'?'Browser paused audio · click Enable Sound':'';
    this.onStatus(warning||message);
  }
  unlock(){
    if(!this.ac||this.ac.state==='closed')return Promise.resolve(false);
    if(this.ac.state==='running')return Promise.resolve(true);
    try{return Promise.resolve(this.ac.resume()).then(()=>{this.notify();return this.ac.state==='running';},()=>{this.notify();return false;});}
    catch(_){this.notify();return Promise.resolve(false);}
  }
  recover(){
    if(this.intent&&!this.current)return this.play(this.intent.track,this.intent);
    return this.unlock();
  }
  level(){return this.muted?0:this.volume*this.masterVolume;}
  setMix({volume=this.volume,master=this.masterVolume,muted=this.muted}={}){
    const old=this.level(),previous=[this.volume,this.masterVolume,this.muted];this.volume=clamp(volume);this.masterVolume=clamp(master);this.muted=!!muted;
    if(this.ac&&old!==this.level())this.master.gain.setTargetAtTime(this.level(),this.ac.currentTime,.025);
    if(previous[0]!==this.volume||previous[1]!==this.masterVolume||previous[2]!==this.muted)this.notify();
  }
  prepare(track){
    if(!TRACKS[track]||!this.ac)return Promise.resolve(null);
    if(this.buffers.has(track))return Promise.resolve(this.buffers.get(track));
    if(this.pending.has(track))return this.pending.get(track);
    const loading=Promise.resolve().then(()=>this.fetcher(TRACKS[track].url)).then(response=>{
      if(!response.ok)throw Error('Anthem download failed');return response.arrayBuffer();
    }).then(bytes=>this.ac.decodeAudioData(bytes)).then(buffer=>{
      this.buffers.set(track,buffer);this.pending.delete(track);return buffer;
    },error=>{this.pending.delete(track);throw error;});
    this.pending.set(track,loading);return loading;
  }
  async play(track,{mode='preview',token=null,offset=0,resume=false,endingFrom=null}={}){
    this.stop(.08);
    if(!TRACKS[track]||!this.ac)return false;
    const revision=this.revision;this.intent={track,mode,token,offset,endingFrom};
    // Resume synchronously inside the click, before fetching/decoding loses
    // the browser's user activation. Also handle interrupted audio contexts.
    const unlocked=this.unlock();this.notify('Loading '+TRACKS[track].title+'…');
    try{
      const buffer=await this.prepare(track);
      if(revision!==this.revision||!buffer)return false;
      const ready=await unlocked;
      if(revision!==this.revision)return false;
      if(!ready){this.notify('Browser paused audio · click Enable Sound');return false;}
      if(offset>=buffer.duration){this.intent=null;this.notify('Anthem finished');return false;}
      const source=this.ac.createBufferSource(),gain=this.ac.createGain(),now=this.ac.currentTime;
      source.buffer=buffer;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.025);
      source.connect(gain).connect(this.master);
      const session={track,mode,token,offset,source,gain,startedAt:now+.005,
        endingFrom:this.intent?.endingFrom??null};this.current=session;
      if(session.endingFrom!==null){
        const remaining=buffer.duration-offset;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(clamp(remaining/Math.max(.001,buffer.duration-session.endingFrom)),now);
        gain.gain.linearRampToValueAtTime(0,session.startedAt+remaining);
      }
      source.onended=()=>{
        source.disconnect();gain.disconnect();
        if(this.current===session){this.current=null;this.intent=null;this.notify(mode==='preview'?'Preview finished':'Goal anthem finished');}
      };
      source.start(session.startedAt,offset);if(!resume)this.starts++;
      this.notify((mode==='preview'?'Previewing ':'Playing ')+TRACKS[track].title+' · '+TRACKS[track].genre);
      return true;
    }catch(error){
      if(revision===this.revision){this.intent=null;this.notify('Anthem unavailable · try Preview again');}
      return false;
    }
  }
  stop(fade=.12){
    this.revision++;this.intent=null;this.pausedData=null;
    const session=this.current;this.current=null;
    if(!session||!this.ac)return;
    const now=this.ac.currentTime;
    session.gain.gain.cancelScheduledValues(now);session.gain.gain.setValueAtTime(session.gain.gain.value,now);
    session.gain.gain.linearRampToValueAtTime(0,now+fade);
    session.source.stop(now+fade+.01);
  }
  finishReplay(){
    const item=this.current||this.intent||this.pausedData;
    if(!item||item.endingFrom!==null&&item.endingFrom!==undefined)return;
    const now=this.ac?.currentTime||0;
    const offset=item.offset+(this.current?Math.max(0,now-item.startedAt):0);
    item.endingFrom=offset;
    if(this.intent)this.intent.endingFrom=offset;
    if(this.current){
      const end=item.startedAt+item.source.buffer.duration-item.offset;
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setValueAtTime(item.gain.gain.value,now);
      item.gain.gain.linearRampToValueAtTime(0,Math.max(now+.02,end));
    }
    this.notify('Fading '+TRACKS[item.track].title+' · finishing the full song');
  }
  pause(){
    if(this.pausedData)return;
    const item=this.current||this.intent;if(!item)return;
    const offset=this.current?item.offset+Math.max(0,this.ac.currentTime-item.startedAt):item.offset;
    const paused={track:item.track,mode:item.mode,token:item.token,offset,endingFrom:item.endingFrom??null};this.stop(.05);this.pausedData=paused;
  }
  resume(){const item=this.pausedData;if(!item)return;this.pausedData=null;void this.play(item.track,{...item,resume:true});}
  sync({state,paused=false,muted=false,master=.75,volume=this.volume,replayId,replayTrack,allowPreview=false,celebrating=false}){
    this.setMix({volume,master,muted});
    const mode=(this.current||this.intent||this.pausedData)?.mode;
    const eventMode=state==='replay'?'replay':state==='play'&&celebrating?'goal':null;
    if(!eventMode){
      if(mode==='replay'&&state!=='menu'&&replayId===this.lastReplayId){
        this.finishReplay();if(paused)this.pause();else if(this.pausedData)this.resume();return;
      }
      if(mode==='replay'||mode==='goal'||(mode==='preview'&&!allowPreview)){this.stop();return;}
      if(mode==='preview'){if(paused)this.pause();else if(this.pausedData)this.resume();}
      return;
    }
    if(replayId!==this.lastReplayId){
      this.lastReplayId=replayId;this.stop();
      if(TRACKS[replayTrack]){
        if(paused)this.pausedData={track:replayTrack,mode:eventMode,token:replayId,offset:0};
        else void this.play(replayTrack,{mode:eventMode,token:replayId});
      }
    }else if(paused)this.pause();else if(this.pausedData)this.resume();
  }
  get audible(){return !!this.current&&this.level()>0&&this.ac?.state==='running';}
  get status(){const item=this.current||this.intent||this.pausedData;return {track:item?.track||null,mode:item?.mode||null,
    playing:!!this.current&&this.ac?.state==='running',paused:!!this.pausedData,muted:this.muted,audible:this.audible,
    blocked:!!item&&this.ac?.state!=='running',audioState:this.ac?.state||'uninitialised',master:this.masterVolume,
    fading:item?.endingFrom!==null&&item?.endingFrom!==undefined,
    remaining:this.current?Math.max(0,this.current.source.buffer.duration-this.current.offset-Math.max(0,this.ac.currentTime-this.current.startedAt)):0,
    starts:this.starts,cached:Array.from(this.buffers.keys()),volume:this.volume};}
}
return {TRACKS,Player};
});
