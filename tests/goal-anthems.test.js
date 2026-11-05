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
 const voice=a.sources.at(-1);p.sync({...state,state:'kick'});assert.equal(p.status.playing,false);
 assert(voice.stopAt<=a.currentTime+.14,'Skipping/ending a replay must fade out promptly');
 p.sync({...state,replayId:2,replayTrack:'off'});await flush();assert.equal(p.starts,3,'Off must suppress the next replay anthem');
 p.sync({...state,replayId:3,replayTrack:'dnb'});await flush();assert.equal(p.starts,4);
 a.sources.at(-1).onended();p.sync({...state,replayId:3,replayTrack:'dnb'});await flush();assert.equal(p.starts,4,'Natural clip end must not restart within the same replay');
 const deferred={};const pending=make(url=>new Promise(resolve=>deferred[url]=resolve));
 pending.player.sync({state:'replay',replayId:1,replayTrack:'dnb'});await flush();
 pending.player.sync({state:'kick',replayId:1,replayTrack:'dnb'});
 deferred[TRACKS.dnb.url](response());await flush();
 assert.equal(pending.player.starts,0,'A late download must not start after the replay was skipped');
 const race={};const fast=make(url=>new Promise(resolve=>race[url]=resolve));
 const first=fast.player.play('dnb');await flush();const second=fast.player.play('rap');await flush();
 race[TRACKS.rap.url](response());await second;race[TRACKS.dnb.url](response());await first;
 assert.equal(fast.player.status.track,'rap');assert.equal(fast.player.starts,1,'An older preview must not replace the newly selected genre');
 let attempts=0;const retry=make(async()=>{if(!attempts++)throw Error('network');return response();});
 assert.equal(await retry.player.play('grime'),false);assert.equal(retry.player.status.playing,false);
 assert.equal(await retry.player.play('grime'),true,'Failed clip downloads must be retryable');
 console.log('PASS: three genres, previews, one play per replay, pause/resume offsets, volume/mute, skip fades, async cancellation and retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
