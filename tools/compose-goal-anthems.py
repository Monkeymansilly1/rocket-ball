"""Render the original synthesized anthem demos.
All three current goal songs are user-supplied and are never overwritten.
Requires numpy, scipy and ffmpeg. No sampled songs or external audio are used.
"""
from pathlib import Path
import argparse, math, subprocess, tempfile, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT=Path(__file__).resolve().parents[1]
SR=44100
RNG=np.random.default_rng(417)
def filt(x,hz,kind='lowpass',order=2):return sosfilt(butter(order,hz,kind,fs=SR,output='sos'),x)
def env(n,attack=.003,release=.12):
 t=np.arange(n)/SR
 return np.minimum(1,t/max(attack,.0001))*np.exp(-t/release)
def tone(freq,length,kind='sine',decay=None):
 t=np.arange(int(length*SR))/SR
 if kind=='reese':
  out=sum(np.sin(2*np.pi*freq*(1+detune)*t*h)/h for detune in [-.004,.004] for h in range(1,9))*.36
  out=np.tanh(filt(out,1200)*1.8)*.65
 elif kind=='rhodes':
  out=np.sin(2*np.pi*freq*t+1.1*np.sin(2*np.pi*freq*2*t)*np.exp(-t*6))
  out+=.25*np.sin(2*np.pi*freq*3*t)*np.exp(-t*3)
 elif kind=='pluck':
  out=sum(np.sin(2*np.pi*freq*t*h)/h for h in [1,2,3,5])*.48
  out=filt(out,3600)
 else:out=np.sin(2*np.pi*freq*t)+.17*np.sin(2*np.pi*freq*2*t)
 return out*env(len(t),.008,decay or length*.65)
def kick():
 t=np.arange(int(.35*SR))/SR;phase=2*np.pi*(46*t+95*.022*(1-np.exp(-t/.022)))
 return .88*np.sin(phase)*env(len(t),.001,.1)+.14*filt(RNG.normal(size=len(t)),2400,'highpass')*env(len(t),.0001,.008)
def snare(grime=False):
 t=np.arange(int(.29*SR))/SR
 noise=filt(filt(RNG.normal(size=len(t)),1100,'highpass'),10500)
 body=np.sin(2*np.pi*(180 if not grime else 205)*t)+.35*np.sin(2*np.pi*330*t)
 return noise*env(len(t),.001,.085)*.53+body*env(len(t),.001,.045)*.30
def hat(opened=False):
 n=int((.22 if opened else .065)*SR)
 return filt(RNG.normal(size=n),6500,'highpass')*env(n,.001,.075 if opened else .018)*.13
def clap():
 n=int(.22*SR);out=np.zeros(n)
 for delay in [0,.011,.023]:
  start=int(delay*SR);length=n-start
  out[start:]+=filt(RNG.normal(size=length),1400,'highpass')*env(length,.0005,.035)*.16
 return out
def midi(note):return 440*2**((note-69)/12)
def jumpup_bass(freq,length,answer=False,beat=60/174):
 # A dry, resonant FM mid-bass answers a deeper, distorted "frog" stab.
 # Keep the sub centred and clean so the riff still hits below the growl.
 t=np.arange(int(length*SR))/SR
 bend=.08 if answer else .16
 phase=2*np.pi*freq*(t+bend*.025*(1-np.exp(-t/.025)))
 wobble=.52+.48*np.sin(2*np.pi*t/(beat*(.5 if answer else 1))+np.pi/2)
 index=(2.1 if answer else 3.8)*np.exp(-t/(.11 if answer else .19))+.8*wobble
 carrier=np.sin(phase*(4 if answer else 2)+index*np.sin(phase*(2 if answer else 3)))
 carrier+=.28*np.sin(phase*6+.7*np.sin(phase*2))
 mid=filt(filt(np.tanh(carrier*2.6),240,'highpass'),2600 if answer else 1700)
 sub=np.sin(phase)+.12*np.sin(phase*2)
 gate=np.minimum(1,t/.004)*np.minimum(1,(length-t)/.018)*np.exp(-t/(length*1.7))
 return (.68*mid*(.55+.45*wobble)+.65*sub)*gate
def compose(name,bpm,bars):
 global RNG
 # Each track can be rebuilt independently without depending on which other
 # clips were rendered first.
 RNG=np.random.default_rng({'dnb':417,'grime':418,'rap':419}[name])
 beat=60/bpm;length=bars*4*beat+.55
 mix=np.zeros((int(length*SR),2));wet=np.zeros_like(mix);music=np.zeros_like(mix);duck=np.ones(len(mix))
 def add(signal,at,gain=1,pan=0,reverb=0,percussion=False):
  start=int(at*SR)
  if start<0 or start>=len(mix):return
  signal=signal[:len(mix)-start]*gain
  left=math.sqrt((1-pan)/2);right=math.sqrt((1+pan)/2)
  stereo=np.column_stack((signal*left,signal*right));target=mix if percussion else music;target[start:start+len(signal)]+=stereo
  wet[start:start+len(signal)]+=stereo*reverb
 def drum(signal,at,gain=1,pan=0,is_kick=False):
  add(signal,at,gain,pan,percussion=True)
  if is_kick:
   start=int(at*SR);n=min(int(.18*SR),len(duck)-start)
   duck[start:start+n]*=1-.52*np.exp(-np.arange(n)/SR/.055)
 k=kick();s=snare(name=='grime');c=clap()
 for bar in range(bars):
  at=bar*4*beat
  if name=='dnb':
   # Immediate jump-up drop: hard two/four backbeat and syncopated kicks,
   # with space between the bass stabs instead of the old liquid-style pad.
   kicks=[0,1.75,2.5] if bar%2==0 else [0,.75,2.5,3.5]
   for pos in kicks:drum(k,at+pos*beat,1.04,is_kick=True)
   for pos in [1,3]:drum(s,at+pos*beat,1.18);drum(c,at+pos*beat,.52,.10)
   for step in range(16):
    if step%2==0 or (bar%2 and step in [7,15]):
     drum(hat(step==14),at+step*.25*beat,.92 if step%2==0 else .48,(-.25 if step%4 else .25))
   if bar%2:drum(s,at+2.75*beat,.19,-.2)
   if bar%4==3:
    for pos in [3.5,3.75]:drum(s,at+pos*beat,.35,.15)
   root=[29,29,29,29,25,25,28,29][bar%8]
   riff=([(0,.62,0,False),(.75,.45,0,False),(1.5,.35,12,True),(2,.60,0,False),(2.75,.35,7,True),(3.5,.35,0,False)]
         if bar%2==0 else [(0,.65,0,False),(.875,.32,12,True),(1.5,.36,7,True),(2.25,.45,0,False),(3.25,.25,12,True),(3.625,.27,7,True)])
   for pos,duration,pitch,answer in riff:
    add(jumpup_bass(midi(root+pitch),duration*beat,answer,beat),at+pos*beat,.85)
   # Short, wide metallic answers; no sustained chords obscure the bass.
   for pos in [1.75,3.75]:
    add(tone(midi(root+36),.11,'pluck',.025),at+pos*beat,.10,(-.6 if bar%2 else .6),.12)
  elif name=='grime':
   for pos in ([0,1.5,2.75] if bar%2==0 else [0,.75,2.5,3.75]):drum(k,at+pos*beat,.95,is_kick=True)
   for pos in [1,3]:drum(s,at+pos*beat,.85);drum(c,at+pos*beat,.7,-.1)
   for step in [0,2,3,6,8,10,11,14,15]:drum(hat(step==14),at+step*.25*beat,.8 if step%2 else 1,(-.35 if step%2 else .35))
   root=[31,31,27,29,31,29][bar%6]
   for pos,duration,pitch in [(0,1.2,0),(1.5,.65,0),(2.5,1.1,-12),(3.75,.25,7)]:
    signal=tone(midi(root+pitch),duration*beat,'sine');signal=np.tanh(signal*2)*.65
    add(signal,at+pos*beat,.44)
   for pos,pitch in zip([0,.75,1.75,2.5,3.25],[67,74,70,65,69] if bar%2==0 else [67,79,77,74,70]):
    signal=tone(midi(pitch),.27,'pluck',.07)
    add(signal,at+pos*beat,.13,(-.28 if bar%2 else .28),.22)
  else:
   for pos in [0,.75,2.25,3.5]:drum(k,at+pos*beat,.85,is_kick=True)
   for pos in [1,3]:drum(s,at+pos*beat,.74);drum(c,at+pos*beat,.35,.1)
   for step in range(8):
    swing=.065 if step%2 else 0
    drum(hat(step==7),at+(step*.5+swing)*beat,.6 if step%2 else .95,(-.25 if step%2 else .25))
   root=[36,32,29,31][bar%4]
   for pos,pitch,duration in [(0,root,1.5),(2.25,root-12,1.2),(3.5,root+7,.45)]:add(tone(midi(pitch),duration*beat,'sine'),at+pos*beat,.43)
   for p in [root+12,root+15,root+19,root+22,root+26]:
    add(tone(midi(p),2.5*beat,'rhodes'),at,.063,(-.52 if p%2 else .52),.4)
   for pos,p in [(1.75,root+31),(2.75,root+26),(3.5,root+27)]:add(tone(midi(p),.34,'rhodes'),at+pos*beat,.075,.25,.3)
   add(filt(RNG.normal(size=int(4*beat*SR)),4500)*.0016,at,.5,0)
 mix+=music*duck[:,None]
 # Short, shared room reflections glue the instrumental without washing out drums.
 for channel in range(2):
  impulse=np.zeros(int(.65*SR))
  for delay,level in [(.043,.34),(.081,.2),(.137,.12),(.219,.08),(.331,.04)]:impulse[int((delay+channel*.007)*SR)]=level
  mix[:,channel]+=fftconvolve(wet[:,channel],impulse)[:len(mix)]
  mix[:,channel]=filt(mix[:,channel],25,'highpass')
 mix=np.tanh(mix*1.18)*.82
 fade_in=np.minimum(1,np.arange(len(mix))/SR/.018)
 fade_out=np.minimum(1,(len(mix)-1-np.arange(len(mix)))/SR/.45)
 mix*=np.minimum(fade_in,fade_out)[:,None]
 with tempfile.NamedTemporaryFile(suffix='.wav') as temp:
  with wave.open(temp.name,'wb') as w:
   w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
  target=ROOT/'assets/anthems'/('afterburn-demo.mp3' if name=='dnb' else f'{name}-demo.mp3')
  title='Afterburn (Jump Up)' if name=='dnb' else f'{name.upper()} Goal Anthem'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',temp.name,'-af','loudnorm=I=-16:TP=-1.5:LRA=8','-ar',str(SR),'-codec:a','libmp3lame','-q:a','3','-metadata',f'title={title}','-metadata','artist=Rocket Ball Originals',str(target)],check=True)
 print(name,bpm,'BPM',round(length,2),'seconds',target.stat().st_size,'bytes')
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--track',choices=['dnb','grime','rap'],action='append',help='Choose tracks; dnb generates afterburn-demo.mp3. Default: grime and rap.')
 selected=parser.parse_args().track or ['grime','rap']
 for args in [('dnb',174,8),('grime',140,6),('rap',92,4)]:
  if args[0] in selected:compose(*args)
