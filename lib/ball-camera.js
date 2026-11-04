(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.RocketBallCamera=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function verticalFov(horizontal,aspect){return 2*Math.atan(Math.tan(clamp(horizontal,60,110)*Math.PI/360)/Math.max(.25,aspect))*180/Math.PI;}
function normalise(v,fallback){const length=Math.hypot(v.x,v.y,v.z);return length>1e-6?{x:v.x/length,y:v.y/length,z:v.z/length}:{...fallback};}
function update(state,options){
  const {car,ball,forward,settings,aspect,ballCam,lookX=0,lookY=0,heightAt=()=>0}=options;
  const dt=clamp(options.dt,0,.25),response=clamp(settings.stiffness,2,15);
  const looking=Math.abs(lookX)>.06||Math.abs(lookY)>.06;
  const planar=Math.hypot(forward.x,forward.z);
  const carHeading=planar>.12?Math.atan2(-forward.x,-forward.z):Number.isFinite(state.heading)?state.heading:Math.PI;
  const dx=ball.x-car.x,dz=ball.z-car.z,range=Math.hypot(dx,dz);
  let heading=carHeading;
  if(ballCam&&!looking){
    // Preserve the orbit while the ball crosses the roof/bumper. Normalising
    // a near-zero car-to-ball vector caused the old instantaneous 180° swing.
    heading=range>3?Math.atan2(-dx,-dz):(Number.isFinite(state.heading)?state.heading:carHeading);
  }
  if(looking)heading=carHeading+lookX*1.5;
  if(!Number.isFinite(state.heading))state.heading=heading;
  const turn=wrap(heading-state.heading)*(1-Math.exp(-response*dt));
  state.heading+=clamp(turn,-4.5*dt,4.5*dt);
  const fov=verticalFov(settings.fov,aspect);
  const distance=ballCam&&!looking?Math.max(settings.distance,
    Math.min(64,Math.max(0,Math.abs(ball.y-car.y)-3)/Math.tan(fov*Math.PI/180*.65))):settings.distance;
  const desired={x:Math.sin(state.heading)*distance,y:settings.height,z:Math.cos(state.heading)*distance};
  const k=1-Math.exp(-response*dt);
  if(!state.offset)state.offset={...desired};
  for(const axis of ['x','y','z'])state.offset[axis]+=(desired[axis]-state.offset[axis])*k;
  // Follow the car's translation directly. Smoothing the entire world
  // position made the car outrun its own camera during boost and dodges.
  const position={x:car.x+state.offset.x,y:car.y+state.offset.y,z:car.z+state.offset.z};
  const bounds=options.bounds||{halfWidth:80,halfLength:104,corner:14,ceiling:44,rampHeight:5.12};
  // Above the opaque ramp, a short orbit outside the transparent glass is
  // safe and keeps wall plays in view; never enter the spectator terraces.
  const margin=position.y>bounds.rampHeight+1?6:-.7;
  position.x=clamp(position.x,-bounds.halfWidth-margin,bounds.halfWidth+margin);
  position.z=clamp(position.z,-bounds.halfLength-margin,bounds.halfLength+margin);
  const cx=bounds.halfWidth-bounds.corner,cz=bounds.halfLength-bounds.corner;
  if(Math.abs(position.x)>cx&&Math.abs(position.z)>cz){
    const x=Math.abs(position.x)-cx,z=Math.abs(position.z)-cz,r=Math.hypot(x,z),max=bounds.corner+margin;
    if(r>max){position.x=Math.sign(position.x)*(cx+x/r*max);position.z=Math.sign(position.z)*(cz+z/r*max);}
  }
  position.y=clamp(position.y,Math.max(.8,heightAt(position.x,position.z)+.65),bounds.ceiling-.65);
  const carDirection=normalise({x:car.x-position.x,y:car.y+.45-position.y,z:car.z-position.z},{x:0,y:0,z:1});
  let direction;
  if(ballCam&&!looking){
    const lead=.045,leadLimit=2;
    const ballDirection=normalise({x:ball.x+clamp((ball.vx||0)*lead,-leadLimit,leadLimit)-position.x,
      y:ball.y+clamp((ball.vy||0)*lead,-leadLimit,leadLimit)-position.y,
      z:ball.z+clamp((ball.vz||0)*lead,-leadLimit,leadLimit)-position.z},carDirection);
    // An angular blend, rather than a world-space midpoint, keeps both the
    // car and a high ball inside the frame without pointing straight up.
    const ballWeight=.5+.08*clamp(range/Math.max(1,Math.abs(ball.y-car.y)),0,1);
    direction=normalise({x:ballDirection.x*ballWeight+carDirection.x*(1-ballWeight),y:ballDirection.y*ballWeight+carDirection.y*(1-ballWeight),z:ballDirection.z*ballWeight+carDirection.z*(1-ballWeight)},carDirection);
  }else{
    const front=normalise({x:-Math.sin(state.heading),y:-lookY*.65-.06,z:-Math.cos(state.heading)},{x:0,y:0,z:1});
    direction=front;
  }
  if(!state.direction)state.direction={...direction};
  const aimK=1-Math.exp(-Math.max(10,response*1.6)*dt);
  for(const axis of ['x','y','z'])state.direction[axis]+=(direction[axis]-state.direction[axis])*aimK;
  state.direction=normalise(state.direction,direction);
  return {position,target:{x:position.x+state.direction.x*20,y:position.y+state.direction.y*20,z:position.z+state.direction.z*20},fov};
}
return {update,verticalFov};
});
