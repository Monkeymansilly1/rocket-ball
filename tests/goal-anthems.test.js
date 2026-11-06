'use strict';
const assert=require('node:assert/strict');
const {TRACKS,Player}=require('../lib/goal-anthems.js');
class Param{
 constructor(){this.value=0;this.events=[];}
 setValueAtTime(v,t){this.value=v;this.events.push(['set',v,t]);}
 setTargetAtTime(v,t,c){this.value=v;this.events.push(['target',v,t,c]);}
 linearRampToValueAtTime(v,t){this.value=v;this.events.push(['ramp',v,t]);}
 cancelScheduledValues(t){this.events.push(['cancel',t]);}
}
class Node{
 constructor(){this.gain=new Param();}
 connect(node){this.connected=node;return node;}
 disconnect(){this.disconnected=true;}
 start(at,offset=0){this.startAt=at;this.offset=offset;}
 stop(at){this.stopAt=at;}
}
class Context{
 constructor(){this.currentTime=1;this.state='running';this.destination={};this.sources=[];}
 createGain(){return new Node();}
 createBufferSource(){const source=new Node();this.sources.push(source);return source;}
 decodeAudioData(){return Promise.resolve({duration:12});}
 resume(){this.state='running';return Promise.resolve();}
}
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
const flush=()=>new Promise(setImmediate);
function make(fetcher=async()=>response()){
 const context=new Context(),player=new Player({fetcher});player.init(context);return {player,context};
}
(async()=>{
 assert.deepEqual(Object.keys(TRACKS),['dnb','grime','rap']);assert.equal(TRACKS.rap.bpm,92);
 const interrupted=make();interrupted.context.state='interrupted';
 assert(await interrupted.player.play('dnb'));
 assert.equal(interrupted.context.state,'running','An interrupted browser audio context must be resumed before song playback');
 assert(interrupted.player.audible);
 interrupted.context.state='suspended';assert.equal(interrupted.player.status.playing,false);assert.equal(interrupted.player.audible,false,'A suspended context must never claim to be audible');
 assert(await interrupted.player.unlock());assert(interrupted.player.audible);
 let activated=true;const gesture=make(async()=>{activated=false;return response();});gesture.context.state='suspended';
 gesture.context.resume=()=>{assert(activated,'Audio must unlock during the click, before fetching loses user activation');gesture.context.state='running';return Promise.resolve();};
 assert(await gesture.player.play('rap'));
 const messages=[];const warnings=new Player({onStatus:message=>messages.push(message),fetcher:async()=>response()});warnings.init(new Context());
 warnings.setMix({master:0});assert(await warnings.play('grime'));assert(messages.at(-1).includes('Game volume is 0%'));
 warnings.setMix({master:.75,muted:true});assert(messages.at(-1).includes('Sound muted'));
 const blocked=make();blocked.context.state='interrupted';blocked.context.resume=()=>Promise.resolve();
 assert.equal(await blocked.player.play('dnb',{mode:'replay',token:5}),false);
 assert.equal(blocked.player.status.blocked,true);assert.equal(blocked.player.starts,0);
 blocked.context.resume=()=>{blocked.context.state='running';return Promise.resolve();};
 assert(await blocked.player.recover());assert.equal(blocked.player.status.mode,'replay');assert.equal(blocked.player.starts,1,'Enable Sound must retry a blocked song in the same replay');
 const replacement=new Context();blocked.context.currentTime+=2;blocked.context.state='closed';blocked.player.init(replacement);
 assert(await blocked.player.recover());assert.equal(blocked.player.status.track,'dnb');assert.equal(blocked.player.starts,1,'Replacing a closed context must resume the same goal song');
 assert(replacement.sources[0].offset>1.9);
 const freePlay=make();const celebration={state:'play',celebrating:true,replayId:1,replayTrack:'grime'};
 freePlay.player.sync(celebration);await flush();assert.equal(freePlay.player.starts,1,'Free Play goals must also play the selected song');
 freePlay.player.sync(celebration);await flush();assert.equal(freePlay.player.starts,1,'A Free Play goal must not restart its song each frame');
 freePlay.player.sync({...celebration,paused:true});assert(freePlay.player.status.paused);
 freePlay.player.sync(celebration);await flush();assert.equal(freePlay.player.starts,1);
 freePlay.player.sync({...celebration,state:'menu'});assert.equal(freePlay.player.status.playing,false);
 const {player:p,context:a}=make();
 assert(await p.play('dnb'));const old=a.sources[0];assert.equal(p.status.track,'dnb');
 assert(await p.play('grime'));assert(old.stopAt<a.currentTime+.2,'Switching genre must fade the old clip');
 old.onended();assert(old.disconnected);assert.equal(p.status.track,'grime');p.stop();
 assert.equal(p.status.playing,false);
 const state={state:'replay',replayId:1,replayTrack:'rap',volume:.5,master:.8};
 p.sync({...state,state:'goal'});await flush();assert.equal(p.starts,2,'Goal intro must not start replay music');
 p.sync(state);await flush();assert.equal(p.starts,3);
 for(let i=0;i<120;i++)p.sync(state);await flush();assert.equal(p.starts,3,'One goal must play exactly once despite rendering repeatedly');
 a.currentTime+=2;p.sync({...state,paused:true});assert(p.status.paused&&!p.status.playing);
 const offset=p.pausedData.offset;assert(offset>1.9&&offset<2.1);
 p.sync(state);await flush();assert.equal(p.starts,3,'Unpausing resumes the same clip, not a new anthem');
 assert(Math.abs(a.sources.at(-1).offset-offset)<1e-9);
 p.sync({...state,muted:true});assert.equal(p.audible,false);assert.equal(p.master.gain.value,0);
 p.sync(state);assert(Math.abs(p.master.gain.value-.4)<1e-9,'Music and game volume must multiply');
 const voice=a.sources.at(-1);p.sync({...state,state:'kick'});assert(p.status.playing&&p.status.fading);
 assert.equal(voice.stopAt,undefined,'Ending a replay must not cut the song short');
 const tail=p.current,fade=tail.gain.gain.events.at(-1);
 assert.equal(fade[0],'ramp');assert.equal(fade[1],0);
 assert(Math.abs(fade[2]-(tail.startedAt+12-tail.offset))<1e-9,'Fade must run through the full remaining clip');
 const events=tail.gain.gain.events.length;
 for(let i=0;i<30;i++)p.sync({...state,state:'play'});
 assert.equal(tail.gain.gain.events.length,events,'Rendering must not restart the fade every frame');
 a.currentTime+=2;p.sync({...state,state:'kick',paused:true});assert(p.status.paused&&p.status.fading);
 p.sync({...state,state:'kick'});await flush();assert.equal(p.starts,3);
 assert(p.status.playing&&p.status.fading,'Pause/resume must preserve the fading tail');
 assert(p.current.gain.gain.events.some(e=>e[0]==='set'&&e[1]>0&&e[1]<1),'Resuming a fade must retain its reduced gain');
 p.sync({...state,replayId:2,replayTrack:'off'});await flush();assert.equal(p.starts,3,'Off must suppress the next replay anthem');
 p.sync({...state,replayId:3,replayTrack:'dnb'});await flush();assert.equal(p.starts,4);
 a.sources.at(-1).onended();p.sync({...state,replayId:3,replayTrack:'dnb'});await flush();assert.equal(p.starts,4,'Natural clip end must not restart within the same replay');
 const deferred={};const pending=make(url=>new Promise(resolve=>deferred[url]=resolve));
 pending.player.sync({state:'replay',replayId:1,replayTrack:'dnb'});await flush();
 pending.player.sync({state:'kick',replayId:1,replayTrack:'dnb'});
 deferred[TRACKS.dnb.url](response());await flush();
 assert.equal(pending.player.starts,1,'The full clip may finish after replay when decoding is delayed');
 assert(pending.player.status.fading,'A delayed clip must honour the replay-end fade');
 const quitPending={};const quit=make(url=>new Promise(resolve=>quitPending[url]=resolve));
 quit.player.sync({state:'replay',replayId:1,replayTrack:'dnb'});await flush();
 quit.player.sync({state:'menu',replayId:1,replayTrack:'dnb'});
 quitPending[TRACKS.dnb.url](response());await flush();
 assert.equal(quit.player.starts,0,'Leaving the match must cancel late music downloads');
 const race={};const fast=make(url=>new Promise(resolve=>race[url]=resolve));
 const first=fast.player.play('dnb');await flush();const second=fast.player.play('rap');await flush();
 race[TRACKS.rap.url](response());await second;race[TRACKS.dnb.url](response());await first;
 assert.equal(fast.player.status.track,'rap');assert.equal(fast.player.starts,1,'An older preview must not replace the newly selected genre');
 let attempts=0;const retry=make(async()=>{if(!attempts++)throw Error('network');return response();});
 assert.equal(await retry.player.play('grime'),false);assert.equal(retry.player.status.playing,false);
 assert.equal(await retry.player.play('grime'),true,'Failed clip downloads must be retryable');
 console.log('PASS: audible context state, gesture/interruption recovery, silent-volume feedback, Free Play goals, three genres, replay lifecycle and cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
