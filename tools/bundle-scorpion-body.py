"""Bundle the supplied Scorpion geometry as a native Three.js model.
Run after converting FBX: python3 tools/bundle-scorpion-body.py
The body has no network dependencies. The normal glTF loader adds texture detail.
"""
import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
folder = root / 'assets/scorpion'
document = json.loads((folder / 'scene.gltf').read_text())
# Only mesh data and solid material parameters are needed for the initial body.
for material in document['materials']:
    material.pop('extensions', None)
    material.pop('normalTexture', None)
    material.pop('occlusionTexture', None)
    material.pop('emissiveTexture', None)
    material.pop('alphaMode', None)
    material.pop('alphaCutoff', None)
    pbr = material.get('pbrMetallicRoughness', {})
    pbr.pop('baseColorTexture', None)
    pbr.pop('metallicRoughnessTexture', None)
    if material['name'] == 'mat_4.002':
        pbr['baseColorFactor'] = [.22, .24, .26, 1]
    elif material['name'] == 'mat_7.002':
        pbr['baseColorFactor'] = [.06, .07, .08, 1]
for key in ['images', 'textures', 'samplers', 'extensionsUsed', 'extensionsRequired']:
    document.pop(key, None)
binary = base64.b64encode((folder / document['buffers'][0]['uri']).read_bytes()).decode()
document['buffers'] = [{'byteLength': document['buffers'][0]['byteLength']}]
factory = r'''
(function(root){
'use strict';
const data=__DOCUMENT__;
const encoded='__BINARY__';
root.RocketScorpionBody={
  create(THREE){
    const raw=atob(encoded),bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
    const buffer=bytes.buffer;
    const components={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
    const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
    function attribute(index){
      const accessor=data.accessors[index],view=data.bufferViews[accessor.bufferView];
      const Typed=components[accessor.componentType],width=widths[accessor.type];
      const offset=(view.byteOffset||0)+(accessor.byteOffset||0);
      const stride=view.byteStride||width*Typed.BYTES_PER_ELEMENT;
      if(stride!==width*Typed.BYTES_PER_ELEMENT)throw new Error('Scorpion bundle requires packed mesh attributes');
      return new THREE.BufferAttribute(new Typed(buffer,offset,accessor.count*width),width,!!accessor.normalized);
    }
    const materials=data.materials.map(source=>{
      const pbr=source.pbrMetallicRoughness||{},color=pbr.baseColorFactor||[.5,.5,.5,1];
      const material=new THREE.MeshStandardMaterial({
        color:new THREE.Color().fromArray(color),metalness:pbr.metallicFactor??1,
        roughness:pbr.roughnessFactor??1,side:source.doubleSided?THREE.DoubleSide:THREE.FrontSide
      });
      material.name=source.name;
      return material;
    });
    const attributes={POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv',TANGENT:'tangent',COLOR_0:'color'};
    const meshes=data.meshes.map(mesh=>mesh.primitives.map(primitive=>{
      const geometry=new THREE.BufferGeometry();
      for(const [key,index] of Object.entries(primitive.attributes)){
        if(attributes[key])geometry.setAttribute(attributes[key],attribute(index));
      }
      if(primitive.indices!==undefined)geometry.setIndex(attribute(primitive.indices));
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      return {geometry,material:materials[primitive.material]};
    }));
    const nodes=data.nodes.map(source=>{
      const node=new THREE.Group();node.name=source.name||'';
      if(source.translation)node.position.fromArray(source.translation);
      if(source.rotation)node.quaternion.fromArray(source.rotation);
      if(source.scale)node.scale.fromArray(source.scale);
      if(source.matrix){node.matrix.fromArray(source.matrix);node.matrix.decompose(node.position,node.quaternion,node.scale);}
      if(source.mesh!==undefined)for(const part of meshes[source.mesh])node.add(new THREE.Mesh(part.geometry,part.material));
      return node;
    });
    data.nodes.forEach((source,i)=>(source.children||[]).forEach(child=>nodes[i].add(nodes[child])));
    const model=new THREE.Group();model.name='Scorpion Supplied Body';
    for(const node of data.scenes[data.scene||0].nodes)model.add(nodes[node]);
    model.userData.source='Scorpion[2].fbx';
    return model;
  }
};
})(typeof window==='undefined'?globalThis:window);
'''
output = factory.replace('__DOCUMENT__', json.dumps(document, separators=(',', ':'))).replace('__BINARY__', binary)
(folder / 'body.js').write_text('// Generated from the supplied Scorpion FBX; regenerate with tools/bundle-scorpion-body.py.\n'+output)
print('Bundled Scorpion body:', len(output), 'bytes')
