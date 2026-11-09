(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./three.min.js'));else root.RocketMechanics=factory(root.THREE);})(globalThis,function(THREE){
'use strict';
function flipReset(car,ball,orientation){
 if(car.ground||car.demoTimer>0||Math.hypot(ball.x-car.x,ball.y-car.y,ball.z-car.z)>4.2){car.ballResetContact=false;return false;}
 const up=new THREE.Vector3(0,1,0).applyQuaternion(orientation);
 const toward=new THREE.Vector3(ball.x-car.x,ball.y-car.y,ball.z-car.z).normalize();
 let contact=toward.dot(up)<-.8;
 for(const z of [-.67,1.02])for(const x of [-.55,.55]){
  const tyre=new THREE.Vector3(x,-.55,z).applyQuaternion(orientation).add(new THREE.Vector3(car.x,car.y,car.z));
  const distance=tyre.distanceTo(new THREE.Vector3(ball.x,ball.y,ball.z));
  if(Math.abs(distance-1.825)>.32)contact=false;
 }
 if(!contact){car.ballResetContact=false;return false;}
 if(car.ballResetContact||(car.flipResetCooldown||0)>0)return false;
 car.ballResetContact=true;car.flipResetCooldown=.25;car.flipReset=true;
 car.jumps=1;car.jt=0;car.hold=0;car.flip=0;car.flipAxis=null;car.jumpNormal=null;
 car.flipResets=(car.flipResets||0)+1;return true;
}
function waveDash(car,input,normal,forward,impulse=10){
 const f=input.dodge?input.dodge[0]:(input.pitch??input.throttle??0),s=input.dodge?input.dodge[1]:(input.steer||0);
 if(Math.hypot(f,s)<.5)return false;
 const nose=forward.clone().addScaledVector(normal,-forward.dot(normal)).normalize();
 if(nose.lengthSq()<.1)return false;
 const right=new THREE.Vector3().crossVectors(normal,nose),direction=nose.multiplyScalar(f).addScaledVector(right,s).normalize();
 car.vx+=direction.x*impulse;car.vy+=direction.y*impulse;car.vz+=direction.z*impulse;
 car.flip=0;car.flipAxis=null;car.flipReset=false;car.waveDashes=(car.waveDashes||0)+1;
 return true;
}
return {flipReset,waveDash};
});
