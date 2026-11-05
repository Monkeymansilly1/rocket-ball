/* Nexto inference runs off the render/physics thread. No server or GPU required. */
'use strict';
importScripts('vendor/ort.wasm.min.js','adapter.js?v=1');
ort.env.wasm.numThreads=1;
ort.env.wasm.proxy=false;
ort.env.wasm.wasmPaths=new URL('vendor/',self.location.href).href;
let session=null;
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      session=await ort.InferenceSession.create(data.modelUrl,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
      // Compile kernels before the user starts the match.
      await session.run({query:new ort.Tensor('float32',new Float32Array(32),[1,1,32]),
        entities:new ort.Tensor('float32',new Float32Array(37*24),[1,37,24]),
        mask:new ort.Tensor('float32',new Float32Array(37),[1,37])});
      self.postMessage({type:'ready'});return;
    }
    if(data.type!=='predict'||!session)return;
    const start=performance.now(),obs=RocketNextoAdapter.buildBatch(data.state,data.ids,data.previous);
    const result=await session.run({query:new ort.Tensor('float32',obs.query,[obs.batch,1,32]),
      entities:new ort.Tensor('float32',obs.entities,[obs.batch,obs.entityCount,24]),
      mask:new ort.Tensor('float32',obs.mask,[obs.batch,obs.entityCount])});
    const logits=result.logits.data,selected={};
    for(let b=0;b<obs.batch;b++){
      let best=0;for(let a=1;a<90;a++)if(logits[b*90+a]>logits[b*90+best])best=a;
      selected[data.ids[b]]=RocketNextoAdapter.actions[best];
    }
    self.postMessage({type:'actions',epoch:data.epoch,actions:selected,ms:performance.now()-start});
  }catch(error){self.postMessage({type:'error',message:String(error?.message||error),epoch:data.epoch});}
};
