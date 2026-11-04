'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const THREE=require('../lib/three.min.js');
const source=fs.readFileSync(require('node:path').join(__dirname,'../game.js'),'utf8');
const start=source.indexOf('function miniCrowdSeats('),end=source.indexOf('\nfunction buildMiniCrowd(',start);
assert(start>=0&&end>start);
const seats=new Function('THREE',source.slice(start,end)+';return miniCrowdSeats;')(THREE)((a,rx,rz,y)=>{
 const x=Math.cos(a),z=Math.sin(a);
 return new THREE.Vector3(rx*Math.sign(x)*Math.abs(x)**.52,y,rz*Math.sign(z)*Math.abs(z)**.52);
});
assert(seats.length>8000,'Stadium must contain a packed crowd, not sparse rows');
for(let row=0;row<18;row++){
 const fans=seats.filter(f=>f.row===row);
 assert(fans.length>380,'Every terrace row must be occupied');
 for(let i=0;i<fans.length;i++){
  const p=fans[i].point,next=fans[(i+1)%fans.length].point;
  assert(p.toArray().every(Number.isFinite));
  assert(Math.abs(p.y-(9.02+row*1.83))<1e-7,'Fans must sit on their terrace');
  const spacing=p.distanceTo(next);
  assert(spacing>1.9&&spacing<2.1,'Crowd must have even spacing without overlapping or wide gaps: '+spacing);
 }
}
console.log('PASS: '+seats.length+' evenly spaced mini fans fill all 18 terrace rows');
