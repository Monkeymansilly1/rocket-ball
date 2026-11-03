(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));
  else root.RocketSceneUtils=factory(root.THREE);
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE){
'use strict';
// Batch only static opaque meshes. Keep named objects, instanced crowds,
// transparent glass and animated objects independently addressable.
function batchStaticMeshes(root){
  root.updateMatrixWorld(true);
  const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),groups=new Map();
  root.traverse(object=>{
    if(!object.isMesh||object.isInstancedMesh||object.name||Array.isArray(object.material)||object.material.transparent||object.morphTargetInfluences)return;
    const keys=Object.keys(object.geometry.attributes).sort();
    const signature=keys.map(k=>k+':'+object.geometry.attributes[k].itemSize).join(',');
    const key=object.material.uuid+'|'+signature+'|'+object.castShadow+'|'+object.receiveShadow;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(object);
  });
  let saved=0;
  for(const objects of groups.values()){
    if(objects.length<3)continue;
    const copies=objects.map(object=>{
      const copy=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
      return copy.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,object.matrixWorld));
    });
    const geometry=new THREE.BufferGeometry();
    for(const key of Object.keys(copies[0].attributes)){
      const attrs=copies.map(g=>g.attributes[key]);
      const buffer=new Float32Array(attrs.reduce((n,a)=>n+a.array.length,0));
      let offset=0;for(const a of attrs){buffer.set(a.array,offset);offset+=a.array.length;}
      geometry.setAttribute(key,new THREE.BufferAttribute(buffer,attrs[0].itemSize));
    }
    geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,objects[0].material);mesh.name='Batched Stadium Structure';
    mesh.castShadow=objects[0].castShadow;mesh.receiveShadow=objects[0].receiveShadow;
    root.add(mesh);for(const object of objects)object.parent.remove(object);
    for(const copy of copies)copy.dispose();saved+=objects.length-1;
  }
  return saved;
}
return {batchStaticMeshes};
});
