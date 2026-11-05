/* Nexto observation/action adapter. Adapted from Rolv-Arild/Necto,
 * upstream commit 2e6ed7d6ed2b352e8ff529d4a12a0c9c70c28cca.
 * CC BY-NC-SA 4.0; see assets/nexto/LICENSE.txt and CREDITS.md. */
(function(root){
'use strict';
const actions=[];
for(const throttle of [-1,0,1])for(const steer of [-1,0,1])for(const boost of [0,1])for(const hand of [0,1]){
  if(boost&&throttle!==1)continue;
  actions.push([throttle||boost,steer,0,steer,0,0,boost,hand]);
}
for(const pitch of [-1,0,1])for(const yaw of [-1,0,1])for(const roll of [-1,0,1])for(const jump of [0,1])for(const boost of [0,1]){
  if(jump&&yaw!==0)continue;
  if(pitch===0&&roll===0&&jump===0)continue;
  actions.push([boost,yaw,pitch,yaw,roll,jump,boost,Number(!!jump&&(pitch!==0||yaw!==0||roll!==0))]);
}
const mapVector=(v,scale=1)=>[-v[0]*scale,v[2]*scale,v[1]*scale];
function rotate(v,q){
  const [x,y,z,w]=q,[vx,vy,vz]=v;
  const tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
  return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
function buildBatch(state,ids,previous={}){
  const entityCount=state.cars.length+35,batch=ids.length;
  const query=new Float32Array(batch*32),entities=new Float32Array(batch*entityCount*24),mask=new Float32Array(batch*entityCount);
  for(let b=0;b<batch;b++){
    const id=ids[b],self=state.cars[id],invert=self.team===1?-1:1;
    const order=[id,...state.cars.map((_,i)=>i).filter(i=>i!==id&&state.cars[i].team===self.team),
      ...state.cars.map((_,i)=>i).filter(i=>state.cars[i].team!==self.team)];
    const offset=b*entityCount*24;
    function vector(row,start,v,divisor=1){
      for(let k=0;k<3;k++)entities[offset+row*24+start+k]=v[k]*(k<2?invert:1)/divisor;
    }
    for(let row=0;row<order.length;row++){
      const index=order[row],car=state.cars[index],base=offset+row*24;
      entities[base]=index===id?1:0;
      entities[base+1]=car.team===self.team?1:0;entities[base+2]=car.team!==self.team?1:0;
      vector(row,5,mapVector(car.position,50),2300);
      vector(row,8,mapVector(car.velocity,50),2300);
      vector(row,11,mapVector(rotate([0,0,1],car.quaternion)));
      vector(row,14,mapVector(rotate([0,1,0],car.quaternion)));
      // The basis change is a proper rotation, so angular vectors use the same map.
      vector(row,17,mapVector(car.angularVelocity),5.5);
      entities[base+20]=Math.max(0,Math.min(1,car.boost/100));
      entities[base+21]=car.demo?1:0;entities[base+22]=car.ground?1:0;entities[base+23]=car.hasFlip?1:0;
    }
    let row=state.cars.length;
    entities[offset+row*24+3]=1;
    vector(row,5,mapVector(state.ball.position,50),2300);
    vector(row,8,mapVector(state.ball.velocity,50),2300);
    vector(row,17,mapVector(state.ball.angularVelocity),5.5);
    for(let p=0;p<34;p++){
      row=state.cars.length+1+p;const pad=state.pads[p],base=offset+row*24;
      entities[base+4]=1;
      vector(row,5,[-pad.x*50,pad.z*50,pad.big?73:70],2300);
      entities[base+20]=pad.big?1:.12;
      // Preserve upstream semantics: this slot holds pad availability, not a timer.
      entities[base+21]=pad.available?1:0;
    }
    query.set(entities.subarray(offset,offset+24),b*32);
    query.set(previous[id]||new Float32Array(8),b*32+24);
    const theta=Math.atan2(query[b*32+11],query[b*32+12]),cos=Math.cos(theta),sin=Math.sin(theta);
    for(let r=0;r<entityCount;r++){
      const base=offset+r*24;
      for(let k=0;k<3;k++)entities[base+5+k]-=query[b*32+5+k];
      for(const start of [5,8,11,14,17]){
        const x=entities[base+start],y=entities[base+start+1];
        entities[base+start]=cos*x-sin*y;entities[base+start+1]=sin*x+cos*y;
      }
    }
  }
  return {query,entities,mask,entityCount,batch};
}
function controls(action,jump){
  return {throttle:action[0],steer:action[1],pitch:-action[2]||0,airYaw:action[3],roll:action[4],
    dodge:[-action[2]||0,action[4]||action[3]],jump:!!jump,jumpHeld:action[5]>0,
    boost:action[6]>0,hand:action[7]>0,keyboardFlightAssist:false};
}
const api={actions,buildBatch,controls,mapVector,rotate};
if(typeof module==='object'&&module.exports)module.exports=api;else root.RocketNextoAdapter=api;
})(typeof self==='undefined'?globalThis:self);
