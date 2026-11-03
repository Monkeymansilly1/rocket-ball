'use strict';
const assert=require('node:assert/strict');
const THREE=require('../lib/three.min.js');
const {batchStaticMeshes}=require('../lib/scene-utils.js');
const scene=new THREE.Scene(),material=new THREE.MeshBasicMaterial();
const group=new THREE.Group();group.position.set(5,2,3);group.rotation.y=.5;scene.add(group);
for(let i=0;i<5;i++){
 const box=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),material);box.position.x=i*3;group.add(box);
}
const named=new THREE.Mesh(new THREE.BoxGeometry(),material);named.name='Addressable Object';scene.add(named);
const animated=new THREE.InstancedMesh(new THREE.BoxGeometry(),material,10);scene.add(animated);
const glass=new THREE.Mesh(new THREE.PlaneGeometry(),new THREE.MeshBasicMaterial({transparent:true}));scene.add(glass);
scene.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(group);
const saved=batchStaticMeshes(scene);
assert.equal(saved,4);
const batch=scene.children.find(o=>o.name==='Batched Stadium Structure');
assert(batch);
const after=new THREE.Box3().setFromObject(batch);
assert(bounds.min.distanceTo(after.min)<.00001 && bounds.max.distanceTo(after.max)<.00001,'Batch must preserve the exact stadium silhouette');
assert.equal(batch.geometry.attributes.normal.count,batch.geometry.attributes.position.count);
assert.equal(scene.getObjectByName('Addressable Object'),named);
assert.equal(animated.parent,scene);assert.equal(glass.parent,scene);
assert.equal(batchStaticMeshes(scene),0,'Batching should be repeatable without altering already combined geometry');
console.log('PASS: stadium batching preserves transformed bounds, normals, named objects, instancing and transparent glass');
