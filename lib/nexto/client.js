/* Nexto browser controller. See assets/nexto/CREDITS.md for model terms. */
(function(root){
'use strict';
const neutral=()=>({throttle:0,steer:0,pitch:0,airYaw:0,roll:0,jump:false,jumpHeld:false,boost:false,hand:false});
class Controller{
  constructor(onStatus=()=>{}){
    this.onStatus=onStatus;this.status='idle';this.ready=false;this.epoch=0;this.worker=null;
    this.reset();this.inferenceCount=0;this.lastInferenceMs=0;
  }
  reset(){this.epoch++;this.actions={};this.executed={};this.lastJump={};this.elapsed=1/15;this.kickoffAge=0;}
  load(){
    if(this.ready)return Promise.resolve();if(this.status==='failed')this.loading=null;if(this.loading)return this.loading;
    this.status='loading';this.onStatus('Loading Nexto…');
    this.loading=new Promise((resolve,reject)=>{
      let worker;
      const fail=message=>{
        if(worker&&this.worker!==worker)return;
        clearTimeout(this.loadTimer);this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;
        this.loading=null;this.status='failed';this.onStatus('Nexto could not load. Select Nexto to retry.');reject(new Error(message));
      };
      try{
        worker=this.worker=new Worker('lib/nexto/worker.js?v=1');
        this.loadTimer=setTimeout(()=>fail('Nexto loading timed out'),60000);
        this.worker.onerror=event=>{event.preventDefault();fail(event.message||'Nexto worker failed');};
        this.worker.onmessage=({data})=>{
          if(worker!==this.worker)return;
          if(data.type==='ready'){
            clearTimeout(this.loadTimer);this.ready=true;this.loading=null;this.status='ready';this.onStatus('Nexto ready · Experimental');resolve();
          }else if(data.type==='actions'){
            this.busy=false;
            if(data.epoch===this.epoch){this.actions=data.actions;this.inferenceCount++;this.lastInferenceMs=data.ms;}
          }else if(data.type==='error'){
            if(data.epoch!==undefined&&data.epoch!==this.epoch){this.busy=false;return;}
            if(!this.ready)fail(data.message);
            else{this.worker?.terminate();this.worker=null;this.busy=false;this.ready=false;this.loading=null;this.status='failed';this.onStatus('Nexto stopped. Return to the garage to retry.');}
          }
        };
        this.worker.postMessage({type:'init',modelUrl:new URL('assets/nexto/nexto.onnx',location.href).href});
      }catch(error){fail(String(error));}
    });
    return this.loading;
  }
  update(dt,snapshot){
    this.kickoffAge+=dt;this.elapsed+=dt;
    if(!this.ready||this.busy||this.elapsed<1/15)return;
    const state=snapshot();
    const ids=state.cars.map((c,i)=>c.ai&&!c.demo?i:-1).filter(i=>i>=0);
    if(!ids.length)return;
    this.elapsed=0;this.busy=true;
    this.worker.postMessage({type:'predict',epoch:this.epoch,state,ids,previous:this.executed});
  }
  controls(car,id,state){
    if(!this.ready)return neutral();
    // Upstream Nexto also uses a kickoff routine. Choose one taker per team;
    // all other cars continue to use the learned policy for positioning.
    if(this.kickoffAge<3&&Math.hypot(state.ball.x,state.ball.z)<.2&&Math.hypot(state.ball.vx,state.ball.vz)<.5){
      const team=state.cars.filter(c=>c.team===car.team);
      const closest=team.reduce((a,b)=>Math.hypot(a.x,a.z)<=Math.hypot(b.x,b.z)?a:b);
      if(closest===car){
        let error=Math.atan2(-car.x,-car.z)-car.yaw;while(error>Math.PI)error-=2*Math.PI;while(error< -Math.PI)error+=2*Math.PI;
        const steer=Math.max(-1,Math.min(1,error*2.5)),boost=Number(Math.abs(error)<.2&&car.boost>0);
        this.executed[id]=[1,steer,0,steer,0,0,boost,0];
        this.lastJump[id]=false;
        return {...neutral(),throttle:1,steer,boost:!!boost};
      }
    }
    const action=this.actions[id];if(!action)return neutral();
    const pressed=action[5]>0,jump=pressed&&!this.lastJump[id];this.lastJump[id]=pressed;
    this.executed[id]=action;
    return RocketNextoAdapter.controls(action,jump);
  }
}
root.RocketNexto={Controller};
})(typeof window==='undefined'?globalThis:window);
