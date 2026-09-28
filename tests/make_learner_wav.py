import os, io, wave, struct, urllib.request, json

KEY = os.environ["OPENAI_API_KEY"]
LINES = [
    "Hi James, I want to practise business English today.",
    "I work in marketing and I lead a small team of four people.",
    "Yes, we just launched a new product last month and it went really well.",
]
# gaps (seconds) BEFORE each utterance, and trailing gap after last
LEAD = [4.0, 9.0, 9.0]
TAIL = 6.0

def tts(text):
    body = json.dumps({"model": "gpt-4o-mini-tts", "voice": "alloy", "input": text, "response_format": "wav"}).encode()
    req = urllib.request.Request("https://api.openai.com/v1/audio/speech", data=body,
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def read_wav(b):
    w = wave.open(io.BytesIO(b), "rb")
    n, sw, sr, nf = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
    frames = w.readframes(nf); w.close()
    # to mono 16-bit
    if sw != 2:
        raise SystemExit(f"unexpected sample width {sw}")
    samples = list(struct.unpack("<%dh" % (len(frames)//2), frames))
    if n == 2:
        samples = samples[0::2]
    return sr, samples

parts = [tts(l) for l in LINES]
meta = [read_wav(p) for p in parts]
sr = meta[0][0]
print("sample rate", sr)

def silence(sec):
    return [0]*int(sr*sec)

out = []
for i, (_, samples) in enumerate(meta):
    out += silence(LEAD[i])
    out += samples
out += silence(TAIL)

path = "/app/tests/learner_speech.wav"
w = wave.open(path, "wb")
w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes(struct.pack("<%dh" % len(out), *out))
w.close()
dur = len(out)/sr
print(f"WROTE {path} duration={dur:.1f}s samples={len(out)}")
