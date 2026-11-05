/* Original goal-anthems player. Shares the game's unlocked AudioContext. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketGoalAnthems=factory();
})(typeof globalThis==='undefined'?this:globalThis,function(){
'use strict';
const TRACKS={
  dnb:{title:'Afterburn',genre:'DNB',bpm:172,url:'assets/anthems/dnb.mp3'},
  grime:{title:'East Stand',genre:'Grime',bpm:140,url:'assets/anthems/grime.mp3'},
  rap:{title:'Touchline',genre:'Rap instrumental',bpm:92,url:'assets/anthems/rap.mp3'}
};
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
class Player{
  constructor({onStatus=()=>{},fetcher=globalThis.fetch?.bind(globalThis)}={}){
    this.onStatus=onStatus;this.fetcher=fetcher;this.buffers=new Map();this.pending=new Map();
    this.revision=0;this.current=null;this.intent=null;this.pausedData=null;
    this.volume=.55;this.masterVolume=.75;this.muted=false;this.lastReplayId=null;this.starts=0;
  }
  init(context){
    if(this.ac||!context)return;
    this.ac=context;this.master=context.createGain();this.master.gain.value=this.level();this.master.connect(context.destination);
  }
  level(){return this.muted?0:this.volume*this.masterVolume;}
  setMix({volume=this.volume,master=this.masterVolume,muted=this.muted}={}){
    const old=this.level();this.volume=clamp(volume);this.masterVolume=clamp(master);this.muted=!!muted;
    if(this.ac&&old!==this.level())this.master.gain.setTargetAtTime(this.level(),this.ac.currentTime,.025);
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
  async play(track,{mode='preview',token=null,offset=0,resume=false}={}){
    this.stop(.08);
    if(!TRACKS[track]||!this.ac)return false;
    const revision=this.revision;this.intent={track,mode,token,offset};
    this.onStatus('Loading '+TRACKS[track].title+'…');
    try{
      const buffer=await this.prepare(track);
      if(revision!==this.revision||!buffer)return false;
      if(this.ac.state==='suspended')await this.ac.resume();
      if(revision!==this.revision)return false;
      if(offset>=buffer.duration){this.intent=null;this.onStatus('Anthem finished');return false;}
      const source=this.ac.createBufferSource(),gain=this.ac.createGain(),now=this.ac.currentTime;
      source.buffer=buffer;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+.025);
      source.connect(gain).connect(this.master);
      const session={track,mode,token,offset,source,gain,startedAt:now+.005};this.current=session;
      source.onended=()=>{
        source.disconnect();gain.disconnect();
        if(this.current===session){this.current=null;this.intent=null;this.onStatus(mode==='preview'?'Preview finished':'Goal anthem finished');}
      };
      source.start(session.startedAt,offset);if(!resume)this.starts++;
      this.onStatus((mode==='preview'?'Previewing ':'Playing ')+TRACKS[track].title+' · '+TRACKS[track].genre);
      return true;
    }catch(error){
      if(revision===this.revision){this.intent=null;this.onStatus('Anthem unavailable · try Preview again');}
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
  pause(){
    if(this.pausedData)return;
    const item=this.current||this.intent;if(!item)return;
    const offset=this.current?item.offset+Math.max(0,this.ac.currentTime-item.startedAt):item.offset;
    const paused={track:item.track,mode:item.mode,token:item.token,offset};this.stop(.05);this.pausedData=paused;
  }
  resume(){const item=this.pausedData;if(!item)return;this.pausedData=null;void this.play(item.track,{...item,resume:true});}
  sync({state,paused=false,muted=false,master=.75,volume=this.volume,replayId,replayTrack,allowPreview=false}){
    this.setMix({volume,master,muted});
    const mode=(this.current||this.intent||this.pausedData)?.mode;
    if(state!=='replay'){
      if(mode==='replay'||(mode==='preview'&&!allowPreview)){this.stop();return;}
      if(mode==='preview'){if(paused)this.pause();else if(this.pausedData)this.resume();}
      return;
    }
    if(replayId!==this.lastReplayId){
      this.lastReplayId=replayId;this.stop();
      if(TRACKS[replayTrack]){
        if(paused)this.pausedData={track:replayTrack,mode:'replay',token:replayId,offset:0};
        else void this.play(replayTrack,{mode:'replay',token:replayId});
      }
    }else if(paused)this.pause();else if(this.pausedData)this.resume();
  }
  get audible(){return !!this.current&&this.level()>0;}
  get status(){const item=this.current||this.intent||this.pausedData;return {track:item?.track||null,mode:item?.mode||null,
    playing:!!this.current,paused:!!this.pausedData,muted:this.muted,audible:this.audible,starts:this.starts,cached:Array.from(this.buffers.keys()),volume:this.volume};}
}
return {TRACKS,Player};
});
