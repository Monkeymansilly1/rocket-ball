(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketRanked=factory();})(globalThis,function(){
'use strict';
function serverUrl(value,secure=globalThis.location?.protocol==='https:'){
 try{const url=new URL(value);if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)return null;if(secure&&url.protocol!=='wss:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))return null;url.pathname='/ranked';return url.href;}catch(_){return null;}
}
class Client{
 constructor({storage=globalThis.localStorage,WebSocket=globalThis.WebSocket,onMessage=()=>{},onStatus=()=>{}}={}){Object.assign(this,{storage,WebSocket,onMessage,onStatus});this.generation=0;}
 connect(value,profile){
  this.close();this.url=serverUrl(value);if(!this.url){this.onStatus('Configure a valid ranked server URL in Settings.');return Promise.reject(Error('Ranked server is not configured.'));}
  const key='rocketRankedAccountV1:'+this.url;let account;try{account=JSON.parse(this.storage.getItem(key)||'null');}catch(_){}
  if(!account||!/^[a-f0-9-]{36}$/.test(account.id)||!/^[a-f0-9]{64}$/.test(account.secret)){account={id:crypto.randomUUID(),secret:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')};this.storage.setItem(key,JSON.stringify(account));}
  this.account=account;this.profile=profile;const generation=++this.generation;
  return new Promise((resolve,reject)=>{let settled=false;this.resolveReady=()=>{if(!settled){settled=true;resolve(this);}};this.rejectReady=message=>{if(!settled){settled=true;reject(Error(message));}};this.open(generation);});
 }
 open(generation){
  if(generation!==this.generation)return;
  this.onStatus('Connecting to ranked matchmaking…');let ws;try{ws=new this.WebSocket(this.url);}catch(_){this.rejectReady('Could not open the ranked connection.');return;}this.ws=ws;
  const deadline=setTimeout(()=>ws.close(),10000);
  ws.onopen=()=>ws.send(JSON.stringify({type:'auth',...this.account,profile:this.profile,match:this.activeMatch||null}));
  ws.onmessage=event=>{if(generation!==this.generation)return;let p;try{p=JSON.parse(event.data);}catch(_){return;}if(p.type==='account'){clearTimeout(deadline);this.authenticated=true;this.retries=0;this.resolveReady();this.onStatus('Connected · ready for ranked 1v1.');}if(p.type==='match')this.activeMatch=p.match;if(['result','cancelled'].includes(p.type)&&p.match===this.activeMatch)this.activeMatch=null;this.onMessage(p);};
  ws.onerror=()=>{};ws.onclose=event=>{clearTimeout(deadline);if(generation!==this.generation)return;this.authenticated=false;this.rejectReady('Ranked server is unavailable. Check its URL and hosting.');
   if([1008,4001].includes(event.code)){this.onStatus(event.reason||'Account connection refused.');return;}
   this.onStatus('Ranked connection interrupted · reconnecting…');this.retry=setTimeout(()=>{this.retries=(this.retries||0)+1;if(this.retries<=10)this.open(generation);else this.onStatus('Ranked server is unavailable. Try again.');},2000);
  };
 }
 send(p){if(this.authenticated&&this.ws?.readyState===1){this.ws.send(JSON.stringify(p));return true;}return false;}
 close(){this.rejectReady?.('Ranked connection closed.');this.generation++;clearTimeout(this.retry);this.authenticated=false;this.retries=0;this.activeMatch=null;if(this.ws)this.ws.close();this.ws=null;}
}
return {Client,serverUrl};
});
