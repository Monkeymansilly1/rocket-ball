"""Convert the official Nexto TorchScript policy for browser inference.
Requires torch 2.6, onnx 1.17 and onnxruntime 1.20; run with nexto-model.pt path.
Upstream: Rolv-Arild/Necto, CC BY-NC-SA 4.0. No policy weights are retrained.
"""
from pathlib import Path
import sys, json, hashlib
import numpy as np
import torch
import onnx
import onnxruntime as ort

root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1])
torch.set_num_threads(1)
actor=torch.jit.load(str(source),map_location='cpu').eval()
class ExportPolicy(torch.nn.Module):
    def __init__(self,actor):
        super().__init__(); self.actor=actor
    def forward(self,q,kv,mask):
        return self.actor((q,kv,mask))[0]
example=(torch.zeros(1,1,32),torch.zeros(1,41,24),torch.zeros(1,41))
traced=torch.jit.trace(ExportPolicy(actor).eval(),example)
output=root/'assets/nexto/nexto.onnx'
torch.onnx.export(traced,example,str(output),opset_version=17,
 input_names=['query','entities','mask'],output_names=['logits'],
 dynamic_axes={'query':{0:'batch'},'entities':{0:'batch',1:'entity_count'},'mask':{0:'batch',1:'entity_count'},'logits':{0:'batch'}},dynamo=False)
onnx.checker.check_model(onnx.load(output))
session=ort.InferenceSession(str(output),providers=['CPUExecutionProvider'])
rng=np.random.default_rng(17)
fixtures=[]
for batch,n in [(1,37),(3,39),(5,41)]:
 q=rng.normal(0,.5,(batch,1,32)).astype('float32')
 kv=rng.normal(0,.5,(batch,n,24)).astype('float32')
 mask=np.zeros((batch,n),dtype='float32')
 with torch.no_grad(): expected=actor(tuple(torch.from_numpy(x) for x in (q,kv,mask)))[0].numpy()
 actual=session.run(None,{'query':q,'entities':kv,'mask':mask})[0]
 np.testing.assert_allclose(actual,expected,atol=1e-4,rtol=1e-4)
 assert np.array_equal(actual.argmax(-1),expected.argmax(-1))
 print('Policy parity',batch,n,'max error',float(abs(actual-expected).max()))
 if batch==1:fixtures.append({'query':q.flatten().tolist(),'entities':kv.flatten().tolist(),'mask':mask.flatten().tolist(),'entityCount':n,'logits':expected.flatten().tolist()})
(root/'tests/nexto-policy-fixture.json').write_text(json.dumps(fixtures[0],separators=(',',':')))
print('Exported',output.stat().st_size,'bytes; upstream SHA256',hashlib.sha256(source.read_bytes()).hexdigest())
