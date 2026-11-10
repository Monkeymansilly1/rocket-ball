(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));else root.RocketArenaNet=factory(root.THREE);})(globalThis,function(THREE){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function constrain(body,{quaternion,bounds={min:[-1.25,-.48,-2],max:[1.25,1,2]},halfWidth=80,halfLength=104,corner=14,goalWidth=15,goalHeight=10.5,goalDepth=14,ceiling=44,heightAt=()=>0,bounce=0}={}){
 const q=quaternion||new THREE.Quaternion(),inverse=q.clone().invert();
 const support=(x,y,z)=>{const n=new THREE.Vector3(x,y,z).applyQuaternion(inverse),v=[n.x,n.y,n.z];return Math.max(.05,v.reduce((sum,k,i)=>sum+k*(k>=0?bounds.max[i]:bounds.min[i]),0));};
 // The suspension already resolves tyre contact on the curved arena. A
 // second, vertical body-height correction lifts a tilted car off that ramp;
 // a full nose clearance also stops it reaching the vertical-wall contact.
 // Preserve the suspension's ride height only while its tyres have traction.
 // Freely airborne cars still use their complete rotated body bounds.
 const wheelContact=body.ground===true,upAxis=new THREE.Vector3(0,1,0).applyQuaternion(q);
 // The ramp reaches its lip .50 units inside the wall, then wall suspension
 // uses .55. Clamping to .55 on the ramp strands the car below that lip.
 const wallSupport=(x,z)=>wheelContact&&upAxis.x*x+upAxis.z*z<-.15?(upAxis.y>.01?.5:.55):support(x,0,z);
 const boundary=(axis,value,sign)=>{if(body[axis]*sign<=value)return;body[axis]=value*sign;const key='v'+axis;if(body[key]*sign>0)body[key]*=-bounce;};
 const sx=Math.sign(body.x)||1,sz=Math.sign(body.z)||1;
 const ex=wallSupport(sx,0),ez=wallSupport(0,sz),up=support(0,1,0),down=wheelContact?.55:Math.max(.55,support(0,-1,0));
 body.y=clamp(body.y,heightAt(body.x,body.z)+down,ceiling-(wheelContact?.55:Math.max(.55,up)));
 const fitsGoal=Math.abs(body.x)+support(sx,0,0)<goalWidth&&body.y+up<goalHeight;
 const inGoal=Math.abs(body.z)>halfLength&&Math.abs(body.x)<goalWidth&&body.y<goalHeight;
 if(inGoal){
  boundary('x',goalWidth-support(sx,0,0),sx);boundary('z',halfLength+goalDepth-support(0,0,sz),sz);
  if(body.y+up>goalHeight){body.y=goalHeight-up;if(body.vy>0)body.vy*=-bounce;}
 }else{
  boundary('x',halfWidth-ex,sx);
  if(!fitsGoal)boundary('z',halfLength-ez,sz);
  const cx=halfWidth-corner,cz=halfLength-corner;
  for(let pass=0;pass<2;pass++)if(Math.abs(body.x)>cx&&Math.abs(body.z)>cz){
   const dx=Math.abs(body.x)-cx,dz=Math.abs(body.z)-cz,r=Math.hypot(dx,dz),nx=dx/r*sx,nz=dz/r*sz;
   const limit=corner-wallSupport(nx,nz);
   if(r>limit){body.x=sx*(cx+dx/r*limit);body.z=sz*(cz+dz/r*limit);const outward=(body.vx||0)*nx+(body.vz||0)*nz;if(outward>0){body.vx-=nx*outward*(1+bounce);body.vz-=nz*outward*(1+bounce);}}
  }
 }
 return body;
}
class SnapshotBuffer{
 constructor(delay=.09){this.delay=delay;this.clear();}
 clear(){this.frames=[];this.lastSequence=-1;}
 push(packet,receivedAt){
  const seq=Number.isSafeInteger(packet.sequence)?packet.sequence:this.lastSequence+1;
  if(seq<=this.lastSequence)return false;
  const previous=this.frames.at(-1);
  if(previous&&(previous.packet.state!==packet.state||previous.packet.round!==packet.round))this.frames=[];
  this.lastSequence=seq;this.frames.push({packet,time:Number.isFinite(packet.time)?packet.time:receivedAt,receivedAt});
  if(this.frames.length>45)this.frames.shift();return true;
 }
 sample(now){
  const last=this.frames.at(-1);if(!last)return null;
  const target=last.time+Math.min(.15,Math.max(0,now-last.receivedAt))-this.delay;
  let a=this.frames[0],b=last;
  for(let i=1;i<this.frames.length;i++)if(this.frames[i].time>=target){a=this.frames[i-1];b=this.frames[i];break;}
  const fraction=b.time>a.time?clamp((target-a.time)/(b.time-a.time),0,1):1;
  const blend=(x,y)=>{const out={...y};for(const k of ['x','y','z','vx','vy','vz'])out[k]=x[k]+(y[k]-x[k])*fraction;
   if(x.q&&y.q)out.q=new THREE.Quaternion().fromArray(x.q).slerp(new THREE.Quaternion().fromArray(y.q),fraction).toArray();return out;};
  return {...last.packet,cars:a.packet.cars.map((c,i)=>blend(c,b.packet.cars[i]||c)),ball:blend(a.packet.ball,b.packet.ball),stale:now-last.receivedAt>.6};
 }
}
return {constrain,SnapshotBuffer};
});
