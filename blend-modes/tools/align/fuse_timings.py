# Fuses the two ASR passes with acoustic onsets (pre-emphasised energy, 5 ms hop):
# the average of both models per word, then each pause end snaps the single word that follows it.
#   python3 fuse_timings.py ../../build/data/words.json   (expects vo16k.wav, vo_words.json, pk_words.json)
import sys, wave, json, numpy as np
w=wave.open('vo16k.wav'); sr=16000; x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
y=np.append(x[0], x[1:]-0.95*x[:-1]); hop=80; win=320
E=np.array([np.sqrt(np.mean(y[i:i+win]**2)) for i in range(0,len(y)-win,hop)])
edb=20*np.log10(E+1e-9); ref=np.percentile(edb,95); sp=edb>ref-38
pauses=[]; i=0
while i<len(sp):
    if not sp[i]:
        j=i
        while j<len(sp) and not sp[j]: j+=1
        if j-i>=24: pauses.append((i*hop/sr, j*hop/sr))
        i=j
    else: i+=1
pk=json.load(open('pk_words.json')); zp=json.load(open('vo_words.json'))
T=[(a['t']+b['t'])/2 for a,b in zip(pk,zp)]
snap=[False]*len(T)
for ps,pe in pauses:
    cands=[k for k in range(len(T)) if abs(T[k]-pe)<=0.3 and not snap[k]]
    if not cands: continue
    # prefer the first word whose estimate is >= pause start (i.e. the word following the pause)
    after=[k for k in cands if T[k]>=ps-0.05]
    k=min(after or cands, key=lambda k:abs(T[k]-pe))
    # the word must be the first word starting after the pause: previous word must be < ps
    if k>0 and T[k-1]>=ps and not snap[k-1]: k=k-1 if abs(T[k-1]-pe)<=0.3 else k
    T[k]=pe; snap[k]=True
for k in range(1,len(T)):
    if T[k]<=T[k-1]+0.06: T[k]=T[k-1]+0.08
dur=len(x)/sr
words=[]
for k in range(len(T)):
    nxt=T[k+1] if k+1<len(T) else dur
    ps=[p for p,_ in pauses if T[k]+0.08<p<nxt]
    words.append({'w':pk[k]['w'],'start':round(T[k],3),'end':round(min(ps) if ps else nxt,3)})
json.dump({'duration':round(dur,3),'pauses':[[round(a,3),round(b,3)] for a,b in pauses],'words':words}, open(sys.argv[1] if len(sys.argv) > 1 else 'words.json','w'), indent=1)
for k,o in enumerate(words): print(f"{o['w']:14s} {o['start']:6.2f}-{o['end']:6.2f} {'*' if snap[k] else ''}")
