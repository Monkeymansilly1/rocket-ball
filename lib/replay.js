(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));
  else root.RocketReplay=factory(root.THREE);
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE){
'use strict';
const numeric=['x','y','z','vx','vy','vz','boost','engineLoad','flip','wx','wy','wz'];
function interpolateBody(a,b,alpha){
  const result={...(alpha<1?a:b)};
  const discontinuity=(a.demoTimer>0)!==(b.demoTimer>0);
  if(!discontinuity)for(const key of numeric)if(Number.isFinite(a[key])&&Number.isFinite(b[key]))result[key]=a[key]+(b[key]-a[key])*alpha;
  if(a.q&&b.q){
    result.q=new THREE.Quaternion().fromArray(a.q).slerp(new THREE.Quaternion().fromArray(b.q),alpha).toArray();
  }
  return result;
}
function sample(frames,elapsed){
  if(!frames.length)return null;
  const target=frames[0].time+Math.max(0,elapsed);
  if(target<=frames[0].time)return frames[0];
  if(target>=frames[frames.length-1].time)return frames[frames.length-1];
  let low=0,high=frames.length-1;
  while(high-low>1){const mid=(low+high)>>1;if(frames[mid].time<=target)low=mid;else high=mid;}
  const a=frames[low],b=frames[high],alpha=(target-a.time)/(b.time-a.time);
  if(b.cut)return target<b.time?a:b;
  return {time:target,cars:a.cars.map((car,i)=>interpolateBody(car,b.cars[i]||car,alpha)),
    ball:interpolateBody(a.ball,b.ball,alpha),pads:a.pads?.map((value,i)=>value+((b.pads?.[i]??value)-value)*alpha)};
}
function duration(frames){return frames.length>1?Math.max(0,frames[frames.length-1].time-frames[0].time):0;}
function speedToMph(velocity,referenceScale=50){
  return Math.hypot(velocity.vx,velocity.vy,velocity.vz)*(referenceScale/100)*3600/1609.344;
}
function updateCamera(state,{ball,settings,dt,forwardZ=1,heightAt=()=>0,
  bounds={halfWidth:80,halfLength:104,corner:14,ceiling:44}}){
  const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
  const step=clamp(dt,0,.25);
  const speed=Math.hypot(ball.vx||0,ball.vz||0);
  const desired=speed>2?Math.atan2(-(ball.vx||0),-(ball.vz||0)):
    Number.isFinite(state.heading)?state.heading:Math.atan2(0,-forwardZ);
  if(!Number.isFinite(state.heading))state.heading=desired;
  // Follow translation directly, but ease the orbit through rebounds. A
  // reversed velocity must not swing the camera 180 degrees in one frame.
  const angle=Math.atan2(Math.sin(desired-state.heading),Math.cos(desired-state.heading));
  state.heading+=clamp(angle*(1-Math.exp(-4*step)),-1.8*step,1.8*step);
  const distance=clamp(settings.distance*2.5,12,22);
  const position={x:ball.x+Math.sin(state.heading)*distance,
    y:ball.y+Math.max(4,settings.height+3),z:ball.z+Math.cos(state.heading)*distance};
  const margin=1;
  position.x=clamp(position.x,-bounds.halfWidth+margin,bounds.halfWidth-margin);
  position.z=clamp(position.z,-bounds.halfLength+margin,bounds.halfLength-margin);
  const cx=bounds.halfWidth-bounds.corner,cz=bounds.halfLength-bounds.corner;
  if(Math.abs(position.x)>cx&&Math.abs(position.z)>cz){
    const x=Math.abs(position.x)-cx,z=Math.abs(position.z)-cz,r=Math.hypot(x,z),max=bounds.corner-margin;
    if(r>max){position.x=Math.sign(position.x)*(cx+x/r*max);position.z=Math.sign(position.z)*(cz+z/r*max);}
  }
  position.y=clamp(position.y,Math.max(1,heightAt(position.x,position.z)+1),bounds.ceiling-1);
  return {position,target:{x:ball.x,y:ball.y,z:ball.z},fov:settings.fov};
}
return {sample,duration,speedToMph,updateCamera};
});
