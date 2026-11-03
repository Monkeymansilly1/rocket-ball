/* Procedural goal celebrations. Uses original geometry and no external assets. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));
  else root.RocketGoalEffects=factory(root.THREE);
})(typeof globalThis!=='undefined'?globalThis:this,function(THREE){
'use strict';
const TAU=Math.PI*2;
const STYLES=Object.freeze({
  classic:{name:'Shockwave',duration:3.4,colour:0x39bfff,accent:0xe9faff,description:'An expanding energy dome and a crown of flying shards.'},
  fire:{name:'Inferno Dragon',duration:4.6,colour:0xff541b,accent:0xffcf58,description:'A winged dragon surges out of the goal, roaring fire.'},
  galaxy:{name:'Galaxy Rift',duration:4.2,colour:0x9b58ff,accent:0x55e7ff,description:'A rotating wormhole with spiral arms and orbiting worlds.'},
  lightning:{name:'Thunderstrike',duration:3.8,colour:0x60ceff,accent:0xe5faff,description:'Branching lightning erupts beneath a rolling storm cloud.'},
  blackhole:{name:'Singularity',duration:4.5,colour:0x9960ff,accent:0xff894a,description:'A dark event horizon pulls an orbiting debris field inward.'},
  supernova:{name:'Supernova',duration:4.1,colour:0xffb43c,accent:0xfff5cf,description:'A burning star collapses, then releases a giant stellar blast.'},
  pixel:{name:'Voxel Victory',duration:4.3,colour:0x4effb5,accent:0xff60cf,description:'Three-dimensional GOAL letters assemble, bounce and explode into cubes.'},
  aurora:{name:'Aurora Wings',duration:4.6,colour:0x52ffd5,accent:0xba8aff,description:'Flowing luminous wings unfurl around a rising crystal.'}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function makeRandom(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
class Manager{
  constructor(scene,options={}){this.scene=scene;this.quality=options.quality||'balanced';this.effects=[];this.created=0;this.disposed=0;}
  spawn(style,position,options={}){
    if(!STYLES[style])style='classic';
    while(this.effects.length>=2)this.remove(this.effects[0]);
    const data=STYLES[style],group=new THREE.Group();
    group.name='Goal Explosion · '+style;group.position.copy(position);
    group.rotation.y=options.direction<0?Math.PI:0;
    const effect={style,group,age:0,duration:data.duration,startedAt:options.now===undefined?performance.now():options.now,
      geometries:new Set(),materials:new Set(),updates:[],signature:[],random:makeRandom(9107+Object.keys(STYLES).indexOf(style)*147)};
    const primary=style==='classic'?(options.teamColour||data.colour):data.colour;
    const material=(colour,opacity=1,solid=false)=>{
      const m=new THREE.MeshBasicMaterial({color:colour,transparent:!solid,opacity,
        blending:THREE.NormalBlending,toneMapped:false,
        depthWrite:solid,side:THREE.DoubleSide});effect.materials.add(m);return m;
    };
    const mesh=(geometry,mat,parent=group)=>{
      effect.geometries.add(geometry);effect.materials.add(mat);
      const m=new THREE.Mesh(geometry,mat);m.frustumCulled=false;parent.add(m);return m;
    };
    const glow=material(primary),accent=material(data.accent),dark=material(0x050713,1,true);
    const animate=fn=>effect.updates.push(fn);
    const ring=(radius,tube,mat,parent=group)=>mesh(new THREE.TorusGeometry(radius,tube,6,48),mat,parent);
    const sphere=(r,mat,parent=group)=>mesh(new THREE.IcosahedronGeometry(r,1),mat,parent);
    const beam=(a,b,r,mat,parent=group)=>{
      const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);
      const m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),5),mat,parent);
      m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;
    };
    const particles=(count,mode,mat)=>{
      count=Math.round(count*(this.quality==='low'?.55:1));
      const geometry=new THREE.BoxGeometry(.45,.45,.45);effect.geometries.add(geometry);
      const particleMaterial=mat.clone();particleMaterial.color.setHex(0xffffff);effect.materials.add(particleMaterial);
      const instanced=new THREE.InstancedMesh(geometry,particleMaterial,count);instanced.frustumCulled=false;group.add(instanced);
      const records=[],dummy=new THREE.Object3D();
      for(let i=0;i<count;i++){
        const a=effect.random()*TAU,y=effect.random()*2-1,rad=Math.sqrt(1-y*y);
        records.push({x:Math.cos(a)*rad,y,z:Math.sin(a)*rad,a,r:9+effect.random()*11,s:.3+effect.random()*.8});
        instanced.setColorAt(i,new THREE.Color(i%4===0?data.accent:primary));
      }
      animate((age,p)=>{
        for(let i=0;i<count;i++){
          const r=records[i];
          if(mode==='inward'){
            const radius=r.r*(1-smooth(.1,.9,p));const a=r.a+age*(1+p*3);
            dummy.position.set(Math.cos(a)*radius,r.y*radius*.5,Math.sin(a)*radius*.38);
          }else{
            const distance=age*(5+r.s*8);
            dummy.position.set(r.x*distance,r.y*distance+age*3-age*age*1.5,r.z*distance*.65);
          }
          dummy.rotation.set(age*(1+r.s),age*1.5+r.a,age*r.y);dummy.scale.setScalar(r.s*(1-smooth(.65,1,p)));
          dummy.updateMatrix();instanced.setMatrixAt(i,dummy.matrix);
        }
        instanced.instanceMatrix.needsUpdate=true;
      });
      return instanced;
    };
    if(style==='classic'){
      effect.signature.push('energy-dome','radial-lances','shard-crown');
      const shell=mesh(new THREE.SphereGeometry(1,24,12),material(primary,.16));
      const wave=ring(1,.075,accent);wave.rotation.x=Math.PI/2;
      const crown=new THREE.Group();group.add(crown);
      for(let i=0;i<16;i++){
        const a=i/16*TAU;
        const spike=mesh(new THREE.ConeGeometry(.38,5,5),glow,crown);
        spike.position.set(Math.cos(a)*5,Math.sin(a)*5,0);
        spike.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),spike.position.clone().normalize());
      }
      particles(90,'outward',glow);
      animate((age,p)=>{const radius=1+18*smooth(0,.85,p);shell.scale.setScalar(radius);wave.scale.setScalar(radius*1.25);crown.scale.setScalar(1+p*2);crown.rotation.z=age*.35;});
    }else if(style==='fire'){
      effect.signature.push('dragon-head','articulated-jaw','flapping-wings','fire-breath');
      const dragon=new THREE.Group();group.add(dragon);
      const skin=new THREE.MeshStandardMaterial({color:0x9b3022,roughness:.48,metalness:.2,emissive:0x250705,flatShading:true});effect.materials.add(skin);
      const edge=material(0xff812b,.65),bone=material(0xffe6a5,1,true);
      const head=sphere(2.3,skin,dragon);head.scale.set(1,1.1,1.5);
      const neck=mesh(new THREE.CylinderGeometry(1.4,2.1,5,8),skin,dragon);neck.rotation.x=Math.PI/2;neck.position.z=-2.8;
      const snout=mesh(new THREE.BoxGeometry(3.0,1.45,3.4),skin,dragon);snout.position.set(0,-.5,2.3);
      const jaw=new THREE.Group();jaw.position.set(0,-1.1,1);dragon.add(jaw);
      const mandible=mesh(new THREE.BoxGeometry(2.8,.55,3.6),skin,jaw);mandible.position.z=1.4;
      for(const side of [-1,1]){
        const eye=sphere(.38,accent,dragon);eye.position.set(side*1.05,.75,3.1);eye.scale.set(1,.48,1);
        const pupil=sphere(.16,dark,dragon);pupil.position.set(side*1.05,.75,3.43);pupil.scale.set(.45,1,1);
        const nostril=sphere(.19,dark,dragon);nostril.position.set(side*.8,-.12,4.02);nostril.scale.set(1,.6,.3);
        const horn=mesh(new THREE.ConeGeometry(.5,3.8,6),bone,dragon);horn.position.set(side*1.4,2,0);horn.rotation.z=-side*.4;horn.rotation.x=-.5;
        for(let i=0;i<4;i++){
          const tooth=mesh(new THREE.ConeGeometry(.17,.8,5),bone,dragon);tooth.position.set(side*1.28,-1.2,1.4+i*.6);tooth.rotation.x=Math.PI;
        }
      }
      const wings=[];
      for(const side of [-1,1]){
        const wing=new THREE.Group();dragon.add(wing);wing.position.set(side*1.3,0,-1);
        const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(side*8,5);shape.lineTo(side*6,0);shape.lineTo(side*4,1);shape.lineTo(side*2,-2);shape.closePath();
        const panel=mesh(new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false}),material(0xe74419,.85),wing);panel.position.z=-1;
        beam([0,0,0],[side*8,5,-1],.12,edge,wing);beam([0,0,0],[side*6,0,-1],.09,edge,wing);wings.push({wing,side});
      }
      const flames=[];
      for(let i=0;i<7;i++){
        const flame=mesh(new THREE.ConeGeometry(1.1-i*.09,5+i*.55,7),i%2?accent:glow,dragon);
        flame.rotation.x=Math.PI/2;flame.position.set((i%3-1)*.6,-1,5+i*.65);flames.push(flame);
      }
      particles(55,'outward',glow);
      animate((age,p)=>{dragon.position.set(0,2+Math.sin(age*2)*.6,smooth(0,.65,p)*12);dragon.scale.setScalar(smooth(0,.15,p)*(1-smooth(.82,1,p)));dragon.rotation.y=Math.sin(age*1.4)*.17;jaw.rotation.x=.2+Math.sin(age*5)*.16;for(const w of wings)w.wing.rotation.y=w.side*(.3+Math.sin(age*6)*.55);flames.forEach((f,i)=>{f.scale.setScalar(.6+.4*Math.sin(age*15+i));f.rotation.z=age*2+i;});});
    }else if(style==='galaxy'){
      effect.signature.push('wormhole-tunnel','spiral-arms','orbiting-planets');
      const tunnel=new THREE.Group();group.add(tunnel);
      for(let i=0;i<6;i++){const r=ring(4+i*.5,.13,i%2?glow:accent,tunnel);r.position.z=-i*1.25;r.rotation.y=i*.08;}
      const planets=[];
      for(let i=0;i<7;i++){const planet=sphere(.45+(i%3)*.25,i%2?glow:accent);const orbit=ring(1,.055,accent,planet);orbit.rotation.x=1;planets.push(planet);}
      for(let arm=0;arm<3;arm++){
        const pts=[];for(let i=0;i<35;i++){const a=i/34*TAU*1.3+arm*TAU/3,r=1+i*.25;pts.push(new THREE.Vector3(Math.cos(a)*r,Math.sin(a)*r,-i*.07));}
        mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),70,.15,5,false),arm%2?accent:glow,tunnel);
      }
      particles(70,'inward',accent);
      animate((age,p)=>{tunnel.rotation.z=age*.9;tunnel.scale.setScalar(smooth(0,.16,p)*(1-smooth(.78,1,p)));planets.forEach((m,i)=>{const a=age*(.8+i*.12)+i; m.position.set(Math.cos(a)*(7+i*.5),Math.sin(a)*(5+i*.4),Math.sin(a*.7)*4);m.rotation.y=age;});});
    }else if(style==='lightning'){
      effect.signature.push('branching-bolts','storm-cloud','electric-arcs');
      const cloud=new THREE.Group();cloud.position.y=8;group.add(cloud);
      const cloudMat=material(0x182c4e,1,true);
      for(let i=0;i<9;i++){const c=sphere(2.1,cloudMat,cloud);c.position.set((i%3-1)*3,(i%2)*1.3,Math.floor(i/3)*1.8-2);c.scale.set(1.4,.75,1);}
      const bolts=[];
      for(let i=0;i<9;i++){
        const bolt=new THREE.Group();group.add(bolt);const a=i/9*TAU;
        let prev=[Math.cos(a)*2,8,0];
        for(let j=1;j<=6;j++){
          const next=[Math.cos(a)*(2+j*1.3)+(effect.random()-.5)*3,8-j*2.0,(effect.random()-.5)*5];
          beam(prev,next,.14,j%2?accent:glow,bolt);
          if(j%2===0)beam(next,[next[0]+(effect.random()-.5)*6,next[1]-2,next[2]+2],.07,glow,bolt);
          prev=next;
        }
        bolts.push(bolt);
      }
      const arc=ring(6,.12,accent);arc.rotation.x=Math.PI/2;arc.position.y=-2;
      animate((age,p)=>{cloud.rotation.y=age*.2;cloud.scale.setScalar(smooth(0,.12,p));bolts.forEach((b,i)=>{b.visible=Math.sin(age*22+i*1.7)>.05;b.rotation.y=Math.sin(age+i)*.06;});arc.scale.setScalar(1+p);});
    }else if(style==='blackhole'){
      effect.signature.push('event-horizon','accretion-disc','inward-orbits');
      const horizon=mesh(new THREE.SphereGeometry(3.5,24,16),dark);
      const rim=ring(3.7,.18,accent);const disk=new THREE.Group();disk.rotation.x=.65;group.add(disk);
      for(let i=0;i<6;i++){const r=ring(4.2+i*.65,.08,i%2?accent:glow,disk);r.rotation.x=i*.025;}
      particles(110,'inward',glow);
      animate((age,p)=>{const s=smooth(0,.18,p)*(1-smooth(.82,1,p));horizon.scale.setScalar(s);rim.scale.setScalar(s*(1+.06*Math.sin(age*7)));disk.scale.setScalar(s);disk.rotation.z=age*1.8;disk.rotation.y=Math.sin(age*.8)*.3;});
    }else if(style==='supernova'){
      effect.signature.push('stellar-core','solar-spikes','blast-shell');
      const star=sphere(3,accent);const corona=new THREE.Group();group.add(corona);
      for(let i=0;i<24;i++){
        const a=i/24*TAU;const ray=mesh(new THREE.ConeGeometry(.65,7+(i%3)*2,5),glow,corona);ray.position.set(Math.cos(a)*5,Math.sin(a)*5,0);ray.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),ray.position.clone().normalize());
      }
      const shell=mesh(new THREE.SphereGeometry(1,24,12),material(0xffdd82,.12));
      const halo=ring(4,.15,glow);particles(120,'outward',accent);
      animate((age,p)=>{const burst=smooth(.2,.8,p);star.scale.setScalar((1-p*.7)*(1-smooth(.5,.8,p)));corona.rotation.z=age*.5;corona.scale.setScalar(.8+burst*3);shell.scale.setScalar(2+burst*24);halo.scale.setScalar(.4+burst*5);});
    }else if(style==='pixel'){
      effect.signature.push('voxel-letters','cube-assembly','cube-scatter');
      const letters=['1110/1000/1011/1001/1111','1111/1001/1001/1001/1111','0110/1001/1111/1001/1001','1000/1000/1000/1000/1111'];
      const positions=[];letters.forEach((letter,k)=>letter.split('/').forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')positions.push(new THREE.Vector3((k*5+x-9.5)*1.1,(2-y)*1.1,0));})));
      const geo=new THREE.BoxGeometry(.95,.95,1.3);effect.geometries.add(geo);
      const cubes=new THREE.InstancedMesh(geo,material(0xffffff),positions.length);cubes.frustumCulled=false;group.add(cubes);
      const dummy=new THREE.Object3D();positions.forEach((p,i)=>cubes.setColorAt(i,new THREE.Color([0x4effb5,0xff60cf,0xffd45b,0x62c6ff][Math.floor(i/15)%4])));
      animate((age,p)=>{const assemble=smooth(0,.2,p),scatter=smooth(.6,1,p);positions.forEach((pos,i)=>{const a=i*2.399;dummy.position.copy(pos).multiplyScalar(1+(1-assemble)*3+scatter*2);dummy.position.y+=3+Math.sin(age*4)*.5-scatter*scatter*8;dummy.position.z=Math.sin(a)*((1-assemble)*15+scatter*12);dummy.rotation.set(scatter*i*.2,scatter*i*.3,scatter*i*.1);dummy.scale.setScalar(1-smooth(.85,1,p));dummy.updateMatrix();cubes.setMatrixAt(i,dummy.matrix);});cubes.instanceMatrix.needsUpdate=true;});
    }else if(style==='aurora'){
      effect.signature.push('flowing-ribbon-wings','rising-crystal','polar-curtain');
      const crystal=mesh(new THREE.OctahedronGeometry(2.4),accent);const ribbons=[];
      for(let side of [-1,1])for(let layer=0;layer<3;layer++){
        const vertices=new Float32Array(41*2*3),colours=new Float32Array(41*2*3),indices=[];
        for(let i=0;i<=40;i++)for(let edge=0;edge<2;edge++){
          const c=new THREE.Color().setHSL(.43+layer*.12+i/40*.13,1,.58);colours.set([c.r,c.g,c.b],(i*2+edge)*3);
          if(i<40&&edge===0){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
        }
        const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setAttribute('color',new THREE.BufferAttribute(colours,3));geo.setIndex(indices);
        const mat=material(0xffffff,.65);mat.vertexColors=true;mesh(geo,mat);ribbons.push({geo,side,layer});
      }
      animate((age,p)=>{crystal.position.y=age*1.7;crystal.rotation.set(age*.4,age*1.2,age*.25);crystal.scale.setScalar(smooth(0,.12,p));for(const r of ribbons){const a=r.geo.attributes.position;for(let i=0;i<=40;i++)for(let edge=0;edge<2;edge++){const u=i/40,spread=smooth(0,.3,p);a.setXYZ(i*2+edge,r.side*(1+u*14)*spread,2+Math.sin(u*5-age*2+r.layer)*2+u*u*9+edge*(2.2+Math.sin(u*8+age)*.7),Math.cos(u*5+age+r.layer)*2-r.layer*1.1);}a.needsUpdate=true;}});
    }
    effect.baseOpacity=new Map([...effect.materials].map(m=>[m,m.opacity]));
    this.effects.push(effect);this.scene.add(group);this.created++;
    this.animate(effect,0);return effect;
  }
  animate(effect,age){
    const p=clamp(age/effect.duration,0,1),fade=smooth(0,.07,p)*(1-smooth(.72,1,p));
    for(const mat of effect.materials){if(mat.transparent)mat.opacity=effect.baseOpacity.get(mat)*fade;}
    for(const update of effect.updates)update(age,p);
    effect.group.visible=p<1;
  }
  update(dt,now=performance.now()){
    for(const effect of [...this.effects]){
      effect.age=Math.max(effect.age+Math.max(0,dt),(now-effect.startedAt)/1000);
      if(effect.age>=effect.duration)this.remove(effect);else this.animate(effect,effect.age);
    }
  }
  remove(effect){
    this.scene.remove(effect.group);for(const g of effect.geometries)g.dispose();for(const m of effect.materials)m.dispose();
    const i=this.effects.indexOf(effect);if(i>=0)this.effects.splice(i,1);this.disposed++;
  }
  clear(){for(const e of [...this.effects])this.remove(e);}
}
return {Manager,STYLES};
});
