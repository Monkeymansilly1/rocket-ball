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
  return {time:target,cars:a.cars.map((car,i)=>interpolateBody(car,b.cars[i]||car,alpha)),
    ball:interpolateBody(a.ball,b.ball,alpha),pads:a.pads?.map((value,i)=>value+((b.pads?.[i]??value)-value)*alpha)};
}
function duration(frames){return frames.length>1?Math.max(0,frames[frames.length-1].time-frames[0].time):0;}
function speedToMph(velocity,referenceScale=50){
  return Math.hypot(velocity.vx,velocity.vy,velocity.vz)*(referenceScale/100)*3600/1609.344;
}
return {sample,duration,speedToMph};
});
