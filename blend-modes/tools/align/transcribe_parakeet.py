# Second ASR pass (NeMo Parakeet TDT 0.6b v2, int8, via sherpa-onnx) — gives punctuation and
# timestamps that agree closely with acoustic onsets. Writes pk_words.json.
#   python3 transcribe_parakeet.py vo16k.wav
import sys, wave, json, numpy as np, sherpa_onnx

d = 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/'
rec = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=d + 'encoder.int8.onnx', decoder=d + 'decoder.int8.onnx', joiner=d + 'joiner.int8.onnx',
    tokens=d + 'tokens.txt', model_type='nemo_transducer', num_threads=4)
w = wave.open(sys.argv[1])
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
s = rec.create_stream()
s.accept_waveform(16000, x)
rec.decode_stream(s)
r = s.result
words = []
for tok, ts in zip(r.tokens, r.timestamps):
    if tok.startswith(' ') or tok.startswith('▁') or not words:
        words.append([tok.strip().lstrip('▁'), ts])
    else:
        words[-1][0] += tok
json.dump([{'w': a, 't': round(b, 3)} for a, b in words], open('pk_words.json', 'w'))
print(r.text)
