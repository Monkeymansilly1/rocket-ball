/* Private 1v1 rooms over PeerJS/WebRTC. MIT; PeerJS license in vendor/. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();else root.RocketRooms=factory();
})(globalThis,function(){
'use strict';
const PREFIX='rocket-ball-v1-',ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalize=value=>String(value||'').trim().toUpperCase();
const validCode=value=>/^[A-HJ-NP-Z2-9]{6}$/.test(value);
function code(){const bytes=crypto.getRandomValues(new Uint8Array(6));return Array.from(bytes,b=>ALPHABET[b%32]).join('');}
function profile(p={}){p=p&&typeof p==='object'?p:{};return {name:String(p.name||'PLAYER').trim().slice(0,12)||'PLAYER',car:['octane','fennec','scorpion'].includes(p.car)?p.car:'octane'};}
function controls(p={}){
 p=p&&typeof p==='object'?p:{};
 const out={};for(const key of ['throttle','steer','pitch','roll','airYaw'])out[key]=Number.isFinite(p[key])?Math.max(-1,Math.min(1,p[key])):0;
 for(const key of ['jump','jumpHeld','hand','boost','keyboardFlightAssist'])out[key]=p[key]===true;
 return out;
}
class Room{
 constructor({Peer=globalThis.Peer,options={},onStatus=()=>{},onStart=()=>{},onData=()=>{},onClose=()=>{}}={}){
  // Retain PeerJS's public STUN/TURN configuration and add TCP relay URLs
  // for networks that do not permit direct UDP connections.
  const defaults=globalThis.peerjs?.util?.defaultConfig;
  if(defaults&&!options.config){const iceServers=defaults.iceServers.map(server=>{
    const urls=[server.urls].flat();return {...server,urls:[...urls,...urls.filter(url=>url.startsWith('turn:')&&!url.includes('?')).map(url=>url+'?transport=tcp')]};
   });options={...options,config:{...defaults,iceServers}};
  }
  Object.assign(this,{Peer,options,onStatus,onStart,onData,onClose});this.state='idle';this.role=null;this.generation=0;
 }
 status(state,message){this.state=state;this.onStatus({state,message,code:this.code,role:this.role});}
 create(p){this.open('host',null,p);}
 join(value,p){
  value=normalize(value);
  if(!validCode(value)){this.status(this.state,'Enter the six-character room code.');return;}
  if(this.role==='host'&&this.code===value){this.status(this.state,'This is your own room code. Send it to your friend so they can join.');return;}
  this.open('guest',value,p);
 }
 open(role,value,p){
  this.close();this.role=role;this.code=value||code();this.local=profile(p);this.generation++;const generation=this.generation;
  this.status('connecting',role==='host'?'Creating your room…':'Finding your friend…');
  if(!this.Peer){this.fail('Online play could not load. Refresh and try again.');return;}
  try{this.peer=new this.Peer(role==='host'?PREFIX+this.code:undefined,this.options);}catch(_){this.fail('This browser could not start online play.');return;}
  const alive=()=>this.generation===generation;
  this.deadline=setTimeout(()=>{if(alive())this.fail('Connection timed out. Check your connection and try again.');},20000);
  this.peer.on('open',()=>{
   if(!alive())return;
   if(role==='host'){clearTimeout(this.deadline);this.status('waiting','Share your code. Waiting for your friend…');}
   else this.attach(this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json'}),generation);
  });
  this.peer.on('connection',conn=>{
   if(!alive()||role!=='host'||this.conn){conn.on('open',()=>{conn.send({type:'full'});setTimeout(()=>conn.close(),150);});return;}
   this.attach(conn,generation);
  });
  this.peer.on('error',error=>{
   if(!alive())return;
   const messages={'peer-unavailable':'Room not found. Check the code or ask your friend to create a new room.','unavailable-id':'That code is busy. Create another room.','network':'Cannot reach the room service. Check your connection and try again.','webrtc':'Could not connect the players. Try another network.'};
   this.fail(messages[error.type]||'Online connection failed. Please try again.');
  });
  this.peer.on('disconnected',()=>{if(alive())this.fail('Lost the room connection. Create or join a new room.');});
 }
 attach(conn,generation){
  this.conn=conn;let approved=false,started=false;
  const alive=()=>generation===this.generation&&this.conn===conn;
  const timeout=this.handshakeTimeout=setTimeout(()=>{if(alive()&&!started){
   if(this.role==='host'){this.conn=null;conn.close();this.status('waiting','Connection timed out. Waiting for your friend to try again…');}
   else this.fail('Your friend did not respond. Try joining again.');
  }},15000);
  conn.on('open',()=>{if(!alive())return;this.lastMessage=Date.now();if(this.role==='guest')conn.send({type:'hello',version:1,profile:this.local});});
  conn.on('data',packet=>{
   if(!alive()||!packet||typeof packet!=='object')return;this.lastMessage=Date.now();
   if(packet.type==='full'){this.fail('This room already has two players.');return;}
   if(packet.type==='hello'&&this.role==='host'&&!approved&&packet.version===1){
    approved=true;this.remote=profile(packet.profile);conn.send({type:'welcome',version:1,profile:this.local});
   }else if(packet.type==='welcome'&&this.role==='guest'&&!started&&packet.version===1){
    this.remote=profile(packet.profile);started=true;clearTimeout(timeout);clearTimeout(this.deadline);
    this.status('connected','Connected · you are Orange');if(!this.startSession())return;conn.send({type:'ready'});this.watch(generation);
   }else if(packet.type==='ready'&&this.role==='host'&&approved&&!started){
    started=true;clearTimeout(timeout);this.status('connected','Connected · you are Blue');if(!this.startSession())return;this.watch(generation);
   }else if(started&&packet.type!=='heartbeat')this.onData(packet);
  });
  conn.on('close',()=>{
   clearTimeout(timeout);if(!alive())return;
   if(!started&&this.role==='host'){this.conn=null;this.status('waiting','Your friend left. Waiting for another player…');}
   else this.fail('Your friend disconnected. Create or join a new room to play again.');
  });
  conn.on('error',()=>{if(alive())this.fail('The player connection failed. Try another network.');});
 }
 startSession(){
  try{this.onStart({role:this.role,local:this.local,remote:this.remote});return this.state==='connected';}
  catch(_){this.fail('The match could not start. Refresh the game on both devices and try again.');return false;}
 }
 watch(generation){this.heartbeat=setInterval(()=>{if(generation!==this.generation)return;if(Date.now()-this.lastMessage>10000){this.fail('Your friend stopped responding. Please reconnect.');return;}this.send({type:'heartbeat'});},1000);}
 send(packet){if(this.conn?.open&&(this.conn.dataChannel?.bufferedAmount||0)<65536)this.conn.send(packet);}
 fail(message){this.close();this.status('error',message);this.onClose(message);}
 close(){this.generation++;clearTimeout(this.deadline);clearTimeout(this.handshakeTimeout);clearInterval(this.heartbeat);const conn=this.conn,peer=this.peer;this.conn=null;this.peer=null;this.state='idle';this.role=null;this.code=null;conn?.close();peer?.destroy();}
}
return {Room,normalize,validCode,profile,controls};
});
