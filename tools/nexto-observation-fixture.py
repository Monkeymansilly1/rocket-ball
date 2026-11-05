"""Check JS observations against upstream NextoObsBuilder; write a regression fixture.
Usage: python tools/nexto-observation-fixture.py /path/to/nexto_obs.py
Requires numpy. Upstream code is CC BY-NC-SA 4.0; see assets/nexto/CREDITS.md.
"""
from pathlib import Path
import json,math,sys,types,runpy,subprocess
from types import SimpleNamespace as NS
import numpy as np
root=Path(__file__).resolve().parents[1]
compat=types.ModuleType('rlgym_compat');cv=types.ModuleType('rlgym_compat.common_values');cv.BLUE_TEAM=0;cv.ORANGE_TEAM=1
state_module=types.ModuleType('rlgym_compat.game_state');state_module.GameState=object;state_module.PlayerData=object
sys.modules.update({'rlgym_compat':compat,'rlgym_compat.common_values':cv,'rlgym_compat.game_state':state_module})
upstream=runpy.run_path(sys.argv[1]);Builder=upstream['NextoObsBuilder']
rotquat=upstream['rotation_to_quaternion']
def vector(v,scale=1):return np.array([-v[0],v[2],v[1]])*scale
def rotate(v,q):
 v=np.asarray(v);u=np.asarray(q[:3]);return v+2*(q[3]*np.cross(u,v)+np.cross(u,np.cross(u,v)))
pads=[{'x':-x/50,'z':y/50,'big':z>72,'available':i%3!=0} for i,(x,y,z) in enumerate(upstream['BOOST_LOCATIONS'])]
cars=[]
for i in range(6):
 q=np.array([.1*i,-.04*i,.03*i,1]);q=q/np.linalg.norm(q)
 cars.append({'ai':i>0,'team':i//3,'position':[i*7-17,.55+i*.4,i*9-25],
 'velocity':[i*2-4,i*.2,18-i*3],'angularVelocity':[.1*i,-.2*i,.05*i],
 'quaternion':q.tolist(),'boost':15+i*13,'ground':i%2==0,'hasFlip':i%3!=0,'demo':i==2})
state={'cars':cars,'pads':pads,'ball':{'position':[7,9,-16],'velocity':[-4,7,21],'angularVelocity':[1,-2,3]}}
ids=[1,4];previous={'1':[1,-1,.5,-1,0,1,0,1],'4':[0,1,-1,1,.5,0,1,0]}
field=NS(boost_pads=[NS(location=NS(x=-p['x']*50,y=p['z']*50,z=73 if p['big'] else 70),is_full_boost=p['big']) for p in pads],num_boosts=34)
expected=[]
for who in ids:
 order=[who]+[i for i,c in enumerate(cars) if i!=who and c['team']==cars[who]['team']]+[i for i,c in enumerate(cars) if c['team']!=cars[who]['team']]
 encoded=[0,0,0]+[int(p['available']) for p in pads]
 for inv in [False,True]:
  for key,scale in [('position',50),('velocity',50),('angularVelocity',1)]:
   v=vector(state['ball'][key],scale);v[:2]*=(-1 if inv else 1);encoded+=v.tolist()
 for i in order:
  car=cars[i];encoded+=[i,car['team']]
  for inv in [False,True]:
   pos=vector(car['position'],50);vel=vector(car['velocity'],50);omega=vector(car['angularVelocity'])
   fw=vector(rotate([0,0,1],car['quaternion']));up=vector(rotate([0,1,0],car['quaternion']))
   matrix=np.column_stack((fw,np.cross(up,fw),up))
   if inv:
    pos[:2]*=-1;vel[:2]*=-1;omega[:2]*=-1;matrix[:2]*=-1
   encoded+=pos.tolist()+rotquat(matrix).tolist()+vel.tolist()+omega.tolist()
  encoded += [0]*5+[int(car['demo']),int(car['ground']),0,int(car['hasFlip']),car['boost']/100]
 builder=Builder(field_info=field)
 q,kv,m=builder.batched_build_obs(np.array([encoded],dtype=np.float64))[0]
 q[0,0,24:]=previous[str(who)]
 expected.append({'query':q.flatten().tolist(),'entities':kv.flatten().tolist(),'mask':m.flatten().tolist()})
fixture={'state':state,'ids':ids,'previous':previous,'expected':expected}
(root/'tests/nexto-observation-fixture.json').write_text(json.dumps(fixture,separators=(',',':')))
print('Wrote reference fixture from official NextoObsBuilder for both teams and rotated cars')
