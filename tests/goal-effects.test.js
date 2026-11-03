'use strict';
const assert=require('node:assert/strict');
const THREE=require('../lib/three.min.js');
const {Manager,STYLES}=require('../lib/goal-effects.js');
const signatures=new Set();
function snapshot(effect){
  const out=[];
  effect.group.traverse(o=>{
    out.push(...o.position.toArray(),...o.rotation.toArray().slice(0,3),...o.scale.toArray(),o.visible);
    if(o.isInstancedMesh)out.push(...o.instanceMatrix.array);
    if(o.geometry?.attributes.position)out.push(...o.geometry.attributes.position.array);
  });
  return out;
}
for(const quality of ['low','balanced','high'])for(const [style,data] of Object.entries(STYLES)){
  const scene=new THREE.Scene(),manager=new Manager(scene,{quality});
  const effect=manager.spawn(style,new THREE.Vector3(0,6,103),{now:0,direction:-1,teamColour:0x2fb8ff});
  assert.equal(scene.children.length,1);
  assert.equal(effect.group.rotation.y,Math.PI,'Goal must face into the pitch');
  assert(effect.geometries.size>0 && effect.materials.size>0,'Effect must own actual 3D resources');
  assert(effect.signature.length>=3);
  if(quality==='balanced')signatures.add(effect.signature.join(','));
  manager.update(.1,100);
  const first=snapshot(effect);
  manager.update(.4,500);
  const next=snapshot(effect);
  assert.notDeepEqual(first,next,style+' must animate geometry or transforms');
  for(const n of next)if(typeof n==='number')assert(Number.isFinite(n),style+' animation became non-finite');
  let disposedGeometry=0,disposedMaterial=0;
  effect.geometries.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));
  effect.materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));
  manager.update(.1,(data.duration+1)*1000);
  assert.equal(manager.effects.length,0,style+' must expire even on a slow frame');
  assert.equal(scene.children.length,0);
  assert.equal(disposedGeometry,effect.geometries.size,'Every owned geometry must be disposed exactly once');
  assert.equal(disposedMaterial,effect.materials.size,'Every owned material must be disposed exactly once');
}
assert.equal(signatures.size,8,'Every selection must have a different model and animation structure');
const manager=new Manager(new THREE.Scene());
for(let i=0;i<30;i++)manager.spawn(Object.keys(STYLES)[i%8],new THREE.Vector3(),{now:0});
assert.equal(manager.effects.length,2,'Rapid previews must not accumulate unbounded effects');
assert.equal(manager.created-manager.disposed,2);
manager.clear();
assert.equal(manager.created,manager.disposed);
assert.equal(manager.effects.length,0);
const fallback=manager.spawn('unknown',new THREE.Vector3(),{now:0});
assert.equal(fallback.style,'classic');manager.clear();
console.log('PASS: eight distinct animated 3D effects at three quality levels, finite motion, bounded previews and complete resource cleanup');
