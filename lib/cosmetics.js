(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));else root.RocketCosmetics=factory(root.THREE);})(globalThis,function(THREE){
'use strict';
const WHEELS=['stock','chrome','blackout'],DECALS=['none','stripes','lightning'];
const BOOSTS={blue:0x38a8d1,amber:0xc98c40,purple:0x9272c1,smoke:0x82949e};
function profile(p={}){return {wheel:WHEELS.includes(p.wheel)?p.wheel:'stock',decal:DECALS.includes(p.decal)?p.decal:'none',boost:Object.hasOwn(BOOSTS,p.boost)?p.boost:'blue'};}
function apply(car){
 const mesh=car.mesh;if(!mesh)return;
 const style=profile(car.cosmetics||{});car.boostTint=new THREE.Color(BOOSTS[style.boost]).multiplyScalar(.42);
 if(mesh.flame){mesh.flame.material.color.setHex(BOOSTS[style.boost]);mesh.flame.material.opacity=style.boost==='smoke'?.2:.42;mesh.flame.scale.setScalar(.8);}
 for(const wheel of mesh.detailedWheels||mesh.wheels||[])wheel.traverse(o=>{
  if(!o.isMesh)return;
  for(const material of [o.material].flat()){
   if(/tread|tyre|tire|rubber/i.test(material.name||''))continue;
   if(!material.userData.originalFinish)material.userData.originalFinish={colour:material.color?.getHex(),metalness:material.metalness,roughness:material.roughness};
   const original=material.userData.originalFinish;
   // Imported Scorpion tyres use a generic material name. Keep their dark,
   // non-metal rubber finish when applying a chrome rim finish.
   if(!/rim/i.test(material.name||'')&&original.metalness===0&&original.colour!==undefined&&new THREE.Color(original.colour).getHSL({}).l<.08)continue;
   if(material.color)material.color.setHex(style.wheel==='chrome'?0xd5e1eb:style.wheel==='blackout'?0x141a22:original.colour);
   if('metalness'in material){material.metalness=style.wheel==='chrome'?.92:style.wheel==='blackout'?.12:original.metalness;material.roughness=style.wheel==='chrome'?.18:style.wheel==='blackout'?.65:original.roughness;}
  }
 });
 if(mesh.decalRoot){mesh.body.remove(mesh.decalRoot);mesh.decalRoot.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});mesh.decalRoot=null;}
 if(style.decal==='none')return;
 const targets=[];(mesh.detailedRoot||mesh.body).traverse(o=>{if(o.isMesh&&o!==mesh.flame&&[o.material].flat().some(m=>/paint|body|chassis/i.test(m.name||'')))targets.push(o);});
 if(!targets.length)return;
 mesh.body.updateWorldMatrix(true,true);
 const bounds=mesh.bodyBounds||{min:[-1,-.48,-1.7],max:[1,1,1.7]},ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(mesh.body.matrixWorld);
 function roof(x,z){const origin=new THREE.Vector3(x,bounds.max[1]+1,z).applyMatrix4(mesh.body.matrixWorld);ray.set(origin,down);const hit=ray.intersectObjects(targets,false)[0];return hit?mesh.body.worldToLocal(hit.point.clone()).add(new THREE.Vector3(0,.018,0)):null;}
 const vertices=[],z0=bounds.min[2]+.4,z1=bounds.max[2]-.4,lines=style.decal==='stripes'?[-.35,.35]:[0];
 for(const line of lines)for(let i=0;i<14;i++){
  const a=z0+(z1-z0)*i/14,b=z0+(z1-z0)*(i+1)/14;
  const xa=line+(style.decal==='lightning'?Math.sin(i*1.7)*.22:0),xb=line+(style.decal==='lightning'?Math.sin((i+1)*1.7)*.22:0);
  const points=[roof(xa-.065,a),roof(xa+.065,a),roof(xb-.065,b),roof(xb+.065,b)];
  if(points.some(p=>!p))continue;
  for(const index of [0,2,1,1,2,3])vertices.push(...points[index].toArray());
 }
 if(!vertices.length)return;
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
 const paint=new THREE.Color(car.paintColour||car.cosmetics?.colour||0x2fb8ff),hsl={};paint.getHSL(hsl);
 const material=new THREE.MeshStandardMaterial({color:hsl.l>.65?0x102536:style.decal==='lightning'?0xffce65:0xf0f7ff,roughness:.45,metalness:.15,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
 mesh.decalRoot=new THREE.Mesh(geometry,material);mesh.decalRoot.name='Car decal '+style.decal;mesh.body.add(mesh.decalRoot);
}
return {WHEELS,DECALS,BOOSTS,profile,apply};
});
