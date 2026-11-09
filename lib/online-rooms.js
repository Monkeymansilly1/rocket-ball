/* Private 1v1 rooms over PeerJS/WebRTC. MIT; PeerJS license in vendor/. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketRooms=factory();
})(globalThis,function(){
'use strict';
const PREFIX='rocket-ball-v1-',ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalize=value=>String(value||'').trim().toUpperCase();
const validCode=value=>/^[A-HJ-NP-Z2-9]{6}$/.test(value);
function code(length=6){const bytes=crypto.getRandomValues(new Uint8Array(length));return Array.from(bytes,b=>ALPHABET[b%32]).join('');}
function profile(p={}){
 p=p&&typeof p==='object'?p:{};
 return {name:String(p.name||'PLAYER').trim().slice(0,12)||'PLAYER',
  car:['octane','fennec','scorpion'].includes(p.car)?p.car:'octane',
  colour:typeof p.colour==='string'&&/^#[0-9a-f]{6}$/i.test(p.colour)?p.colour.toLowerCase():null,
  explosion:['classic','fire','galaxy','lightning','blackhole','supernova','pixel','aurora'].includes(p.explosion)?p.explosion:'classic',
  anthem:['dnb','grime','rap','dubstep','off'].includes(p.anthem)?p.anthem:'dnb',
  wheel:['stock','chrome','blackout'].includes(p.wheel)?p.wheel:'stock',
  decal:['none','stripes','lightning'].includes(p.decal)?p.decal:'none',
  boost:['blue','amber','purple','smoke'].includes(p.boost)?p.boost:'blue'};
}
function controls(p={}){
 p=p&&typeof p==='object'?p:{};
 const out={};for(const key of ['throttle','steer','pitch','roll','airYaw'])out[key]=Number.isFinite(p[key])?Math.max(-1,Math.min(1,p[key])):0;
 for(const key of ['jump','jumpHeld','hand','boost','keyboardFlightAssist'])out[key]=p[key]===true;
 if(Array.isArray(p.dodge)&&p.dodge.length===2)out.dodge=p.dodge.map(n=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0);
 return out;
}
class Room{
 constructor({Peer=globalThis.Peer,options={},onStatus=()=>{},onStart=()=>{},onData=()=>{},onClose=()=>{},onSuspend=()=>{},onResume=()=>{},onSpectators=()=>{}}={}){
  const defaults=globalThis.peerjs?.util?.defaultConfig;
  if(defaults&&!options.config)options={...options,config:{...defaults,iceServers:defaults.iceServers.map(server=>{
   const urls=[server.urls].flat();return {...server,urls:[...urls,...urls.filter(url=>url.startsWith('turn:')&&!url.includes('?')).map(url=>url+'?transport=tcp')]};
  })}};
  Object.assign(this,{Peer,options,onStatus,onStart,onData,onClose,onSuspend,onResume,onSpectators});
  this.state='idle';this.role=null;this.generation=0;this.spectators=new Set();this.handshakes=new Set();
 }
 status(state,message){this.state=state;this.onStatus({state,message,code:this.code,role:this.role,spectators:this.spectators.size});}
 create(p,roomCode){this.open('host',validCode(roomCode)?roomCode:null,p);}
 join(value,p){this.joinAs('guest',value,p);}
 spectate(value,p){this.joinAs('spectator',value,p);}
 joinAs(role,value,p){
  value=normalize(value);
  if(!validCode(value)){this.status(this.state,'Enter the six-character room code.');return;}
  if(this.role==='host'&&this.code===value){this.status(this.state,'This is your own room code. Send it to your friend.');return;}
  this.open(role,value,p);
 }
 open(role,value,p){
  this.close();this.role=role;this.lastError=null;this.local=profile(p);this.sessionStarted=false;this.recovering=false;this.players=undefined;
  try{this.code=value||code();this.resumeToken=role==='host'?code(26):this.readToken();}
  catch(_){this.fail('Online rooms need HTTPS and an up-to-date browser.');return;}
  const generation=++this.generation,alive=()=>this.generation===generation;
  this.status('connecting',role==='host'?'Creating your room…':role==='spectator'?'Finding the match…':'Finding your friend…');
  if(!this.Peer){this.fail('Online play could not load. Refresh and try again.');return;}
  const peerId=role==='host'?PREFIX+this.code:PREFIX+role+'-'+code(20);
  try{this.peer=new this.Peer(peerId,this.options);}catch(_){this.fail('This browser could not start online play.');return;}
  this.deadline=setTimeout(()=>{if(alive()&&!this.sessionStarted)this.fail('Connection timed out. Check your connection and try again.');},20000);
  this.peer.on('open',()=>{
   if(!alive())return;
   if(role==='host'){
    clearTimeout(this.deadline);
    this.status(this.recovering?'reconnecting':this.sessionStarted?'connected':'waiting',this.recovering?'Waiting for your friend to reconnect…':this.sessionStarted?'Room connection restored':'Share your code. Waiting for your friend…');
   }else this.connect(generation);
  });
  this.peer.on('connection',conn=>{
   if(!alive()||role!=='host'){conn.on('open',()=>{conn.send({type:'full'});setTimeout(()=>conn.close(),150);});return;}
   this.attach(conn,generation);
  });
  this.peer.on('error',error=>{
   if(!alive())return;
   const type=typeof error?.type==='string'?error.type:'unknown';this.lastError=type;
   if(this.recovering&&role!=='host'&&['peer-unavailable','network','webrtc'].includes(type)){this.retry(generation);return;}
   if(this.sessionStarted&&this.conn?.open&&['network','socket-error','socket-closed'].includes(type))return;
   const messages={
    'peer-unavailable':'Room not found. Check the code or ask your friend to create a new room.',
    'unavailable-id':'That code is busy. Create another room.',
    'network':'Cannot reach the room service. Check your connection and try again.',
    'server-error':'The room service could not register this player. Please retry.',
    'socket-error':'The room service connection was blocked or refused. Try another network.',
    'socket-closed':'The room service closed the connection. Create or join a new room.',
    'browser-incompatible':'Open this game in an up-to-date Chrome, Edge, Firefox or Safari.',
    'webrtc':'Could not connect the players. Try another network.'
   };
   this.fail(messages[type]||'Unexpected connection error. Refresh the game on both devices and retry.');
  });
  this.peer.on('disconnected',()=>{
   if(!alive())return;
   if(!this.sessionStarted&&!this.recovering){this.fail('Lost the room connection. Try joining again.');return;}
   try{this.peer.reconnect?.();}catch(_){}
   if(!this.conn?.open)this.suspend(generation);
  });
 }
 readToken(){try{return sessionStorage.getItem('rocketResume:'+this.code)||null;}catch(_){return null;}}
 saveToken(){try{if(this.resumeToken)sessionStorage.setItem('rocketResume:'+this.code,this.resumeToken);}catch(_){}}
 connect(generation){
  if(this.generation!==generation||this.conn?.open)return;
  try{this.attach(this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json'}),generation);}
  catch(_){if(this.recovering)this.retry(generation);else this.fail('The player connection could not start.');}
 }
 retry(generation){clearTimeout(this.retryTimer);this.retryTimer=setTimeout(()=>this.connect(generation),1500);}
 suspend(generation){
  if(this.generation!==generation||!this.sessionStarted)return;
  if(!this.recovering){
   this.recovering=true;this.onSuspend();
   this.status('reconnecting',this.role==='host'?'Your friend disconnected. Holding the match for 30 seconds…':'Connection lost. Reconnecting to the match…');
   this.reconnectDeadline=setTimeout(()=>{if(this.generation===generation&&this.recovering)this.fail('Reconnection timed out. Create or join another room.');},30000);
  }
  if(this.role!=='host')this.retry(generation);
 }
 attach(conn,generation){
  let approved=false,started=false,kind=this.role==='spectator'?'spectator':'guest';
  const alive=()=>this.generation===generation;
  if(this.role!=='host')this.conn=conn;
  const timeout=setTimeout(()=>{
   this.handshakes.delete(timeout);
   if(!alive()||started)return;conn.close();
   if(this.role!=='host'){if(this.recovering)this.retry(generation);else this.fail('Your friend did not respond. Try joining again.');}
  },15000);
  this.handshakes.add(timeout);
  const finishHandshake=()=>{clearTimeout(timeout);this.handshakes.delete(timeout);};
  conn.on('open',()=>{
   if(!alive())return;conn.lastMessage=Date.now();
   if(this.role!=='host')conn.send({type:'hello',version:1,role:this.role,profile:this.local,resumeToken:this.resumeToken});
  });
  conn.on('data',packet=>{
   if(!alive()||!packet||typeof packet!=='object')return;conn.lastMessage=Date.now();
   if(this.role!=='host'&&['full','not-started','ended'].includes(packet.type)){
    const messages={full:'This room already has two players or is holding a reconnecting player.', 'not-started':'The match has not started yet. Spectate after both players connect.',ended:'The host closed the match.'};
    this.fail(messages[packet.type]);return;
   }
   if(packet.type==='hello'&&this.role==='host'&&!approved&&packet.version===1){
    kind=packet.role==='spectator'?'spectator':'guest';
    if(kind==='spectator'){
     if(!this.sessionStarted||this.spectators.size>=4){conn.send({type:this.sessionStarted?'full':'not-started'});setTimeout(()=>conn.close(),150);return;}
     approved=true;this.spectators.add(conn);this.onSpectators(this.spectators.size);
     conn.send({type:'welcome',version:1,role:'spectator',profiles:[this.local,this.remote]});
    }else{
     if(this.conn?.open||(this.sessionStarted&&packet.resumeToken!==this.resumeToken)){conn.send({type:'full'});setTimeout(()=>conn.close(),150);return;}
     approved=true;this.conn=conn;
     if(!this.sessionStarted)this.remote=profile(packet.profile);
     conn.send({type:'welcome',version:1,profile:this.local,resumeToken:this.resumeToken,resumed:this.sessionStarted});
    }
   }else if(packet.type==='welcome'&&this.role!=='host'&&!started&&packet.version===1){
    started=true;finishHandshake();clearTimeout(this.deadline);
    const resumed=this.sessionStarted;
    this.remote=profile(packet.profile);
    if(Array.isArray(packet.profiles))this.players=packet.profiles.map(profile);
    if(typeof packet.resumeToken==='string'){this.resumeToken=packet.resumeToken;this.saveToken();}
    this.recovering=false;clearTimeout(this.reconnectDeadline);clearTimeout(this.retryTimer);
    this.status('connected',this.role==='spectator'?'Spectating the match':'Connected · you are Orange');
    if(resumed)this.onResume();else if(!this.startSession())return;
    conn.send({type:'ready'});this.watch(generation);
   }else if(packet.type==='ready'&&this.role==='host'&&approved&&!started){
    started=true;finishHandshake();
    if(kind==='spectator'){this.watch(generation);return;}
    const resumed=this.sessionStarted;
    this.recovering=false;clearTimeout(this.reconnectDeadline);
    this.status('connected',resumed?'Your friend reconnected':'Connected · you are Blue');
    if(resumed)this.onResume();else if(!this.startSession())return;
    this.watch(generation);
   }else if(packet.type==='leave'&&started){
    if(this.role==='host'&&kind==='spectator'){this.spectators.delete(conn);this.onSpectators(this.spectators.size);conn.close();}
    else this.fail('Your friend disconnected. Create or join a new room to play again.');
   }else if(started&&packet.type!=='heartbeat')this.onData(packet,{role:this.role==='host'?kind:'host'});
  });
  conn.on('close',()=>{
   finishHandshake();if(!alive())return;
   if(this.role==='host'&&kind==='spectator'){this.spectators.delete(conn);this.onSpectators(this.spectators.size);return;}
   if(this.role==='host'&&this.conn!==conn)return;
   if(this.role!=='host'&&this.conn!==conn)return;
   this.conn=null;
   if(!this.sessionStarted&&this.role==='host'){this.status('waiting','Your friend left. Waiting for another player…');}
   else if(this.sessionStarted)this.suspend(generation);
   else this.fail('The player connection closed. Try joining again.');
  });
  conn.on('error',()=>{if(!alive())return;if(this.sessionStarted){if(this.conn===conn)this.conn=null;this.suspend(generation);}else if(this.role!=='host')this.fail('The player connection failed. Try another network.');});
 }
 startSession(){
  this.sessionStarted=true;
  try{this.onStart({role:this.role,local:this.local,remote:this.remote,players:this.players});return this.state==='connected';}
  catch(_){this.fail('The match could not start. Refresh the game on both devices and try again.');return false;}
 }
 watch(generation){
  if(this.heartbeat)return;
  this.heartbeat=setInterval(()=>{
   if(this.generation!==generation)return;
   const now=Date.now();
   if(this.conn?.open&&now-(this.conn.lastMessage||now)>8000){const old=this.conn;this.conn=null;old.close();this.suspend(generation);}
   for(const spectator of [...this.spectators])if(now-(spectator.lastMessage||now)>10000){this.spectators.delete(spectator);spectator.close();this.onSpectators(this.spectators.size);}
   this.send({type:'heartbeat'});
  },1000);
 }
 send(packet){
  const connections=this.role==='host'?[this.conn,...this.spectators]:[this.conn];
  for(const conn of connections)if(conn?.open&&(conn.dataChannel?.bufferedAmount||0)<131072)conn.send(packet);
 }
 fail(message){this.close(false);this.status('error',message);this.onClose(message);}
 close(notify=true){
  this.generation++;clearTimeout(this.deadline);clearTimeout(this.retryTimer);clearTimeout(this.reconnectDeadline);clearInterval(this.heartbeat);this.heartbeat=null;
  for(const timer of this.handshakes)clearTimeout(timer);this.handshakes.clear();
  const connections=[this.conn,...this.spectators],peer=this.peer;
  for(const conn of connections)if(conn?.open){try{conn.send({type:this.role==='host'?'ended':'leave'});}catch(_){}}
  this.spectators.clear();this.conn=null;this.peer=null;this.state='idle';this.role=null;this.code=null;this.sessionStarted=false;this.recovering=false;
  setTimeout(()=>{for(const conn of connections)conn?.close();peer?.destroy();},40);
 }
}
return {Room,normalize,validCode,profile,controls};
});
