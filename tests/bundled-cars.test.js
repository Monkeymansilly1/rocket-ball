'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const THREE=require('../lib/three.min.js');
const source=fs.readFileSync('game.js','utf8');
function extract(name){const start=source.indexOf('function '+name+'('),brace=source.indexOf('{',start);let depth=0;for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0)return source.slice(start,i+1);}throw Error(name);}
for(const name of ['octane','fennec','scorpion']){
 const window={};vm.runInNewContext(fs.readFileSync('assets/'+name+'/body.js','utf8'),{window,atob});
 const model=window['Rocket'+name[0].toUpperCase()+name.slice(1)+'Body'].create(THREE);
 const meshes=[],wheels=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);if(/^Wheel_/.test(o.name)||(/^Dieci/i.test(o.name)&&o.children.length>=2))wheels.push(o);});
 assert.equal(meshes.length,{octane:12,fennec:13,scorpion:15}[name],'Keep every original material primitive');
 assert.equal(wheels.length,4,'Keep four separately animated wheel pivots');
 const triangles=meshes.reduce((n,m)=>n+m.geometry.index.count/3,0);assert(triangles>10000,'Use the real detailed car, not a placeholder');
 assert(meshes.every(m=>m.geometry.attributes.position&&m.geometry.attributes.normal&&m.geometry.attributes.uv));
 const asset={template:model,rotation:name==='octane'?-Math.PI/2:0,axle:new THREE.Vector3(name==='octane'?0:1,name==='octane'?1:0,0)};
 const install=new Function('THREE','carModelAssets',`const onlineMode=null,localTwoPlayer=false,playerPaint='#2fb8ff',player2Paint='#ff8a1f',ORANGE=0xff8a1f,BLUE=0x2fb8ff;
 const hexCss=n=>'#'+n.toString(16).padStart(6,'0');${extract('cacheCarBodyBounds')}${extract('makeDetailedCar')}return makeDetailedCar;`)(THREE,{[name]:asset});
 const root=new THREE.Group(),body=new THREE.Group(),flame=new THREE.Group(),placeholder=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(body);body.add(placeholder,flame);
 const car={model:name,team:0,ai:false,mesh:{root,body,flame}};install(car);
 assert(car.mesh.detailed);assert.equal(car.mesh.detailedRoot.userData.vehicleModel,name);assert.equal(placeholder.visible,false);
 assert.equal(car.mesh.detailedWheels.length,4);
 const size=new THREE.Box3().setFromObject(car.mesh.detailedRoot).getSize(new THREE.Vector3());
 assert(size.x>1.7&&size.x<2.5&&size.y>.8&&size.y<1.6&&size.z>(name==='octane'?3:3.5)&&size.z<4.1,'Fit and face the correct direction: '+name+' '+JSON.stringify(size));
 console.log('PASS:',name,triangles,'original triangles, four wheel pivots, fitted body and no loader/network dependency');
}
