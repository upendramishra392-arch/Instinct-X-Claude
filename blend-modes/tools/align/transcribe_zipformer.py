# First ASR pass (icefall zipformer transducer via sherpa-onnx), chunked on silences.
#   python3 transcribe_zipformer.py vo16k.wav vo_words.json
import sys, wave, json, numpy as np, sherpa_onnx
d='sherpa-onnx-zipformer-en-2023-06-26/'
rec = sherpa_onnx.OfflineRecognizer.from_transducer(encoder=d+'encoder-epoch-99-avg-1.onnx', decoder=d+'decoder-epoch-99-avg-1.onnx', joiner=d+'joiner-epoch-99-avg-1.onnx', tokens=d+'tokens.txt', num_threads=4, decoding_method='modified_beam_search')
w=wave.open(sys.argv[1]); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
hop=int(0.01*sr); e=np.array([np.sqrt(np.mean(x[i:i+hop*2]**2)) for i in range(0,len(x)-hop*2,hop)])
edb=20*np.log10(e+1e-9); thr=np.percentile(edb,95)-35
sil=edb<thr
# find silence runs >= 150ms
runs=[];i=0
while i<len(sil):
    if sil[i]:
        j=i
        while j<len(sil) and sil[j]: j+=1
        if j-i>=15: runs.append((i*hop,j*hop))
        i=j
    else: i+=1
print('silences:',[(round(a/sr,2),round(b/sr,2)) for a,b in runs], file=sys.stderr)
json.dump([(a/sr,b/sr) for a,b in runs], open(sys.argv[2].replace('.json','_sil.json'),'w'))
# split points: greedily choose silence midpoints so chunks <= 14s
cuts=[0]; mids=[(a+b)//2 for a,b in runs]
for k,m in enumerate(mids):
    nxt = mids[k+1] if k+1<len(mids) else len(x)
    if nxt-cuts[-1] > 14*sr and m>cuts[-1]: cuts.append(m)
cuts.append(len(x))
words=[]
for a,b in zip(cuts[:-1],cuts[1:]):
    s=rec.create_stream(); s.accept_waveform(sr,x[a:b]); rec.decode_stream(s); r=s.result
    print(f'[{a/sr:.2f}-{b/sr:.2f}] {r.text}', file=sys.stderr)
    for tok,ts in zip(r.tokens,r.timestamps):
        if tok.startswith(' ') or not words: words.append([tok.strip(), ts+a/sr])
        else: words[-1][0]+=tok
json.dump([{'w':w_,'t':round(t,3)} for w_,t in words], open(sys.argv[2],'w'))
print(' '.join(f"{w_}@{t:.2f}" for w_,t in words))
