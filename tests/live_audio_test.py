import asyncio, json, time
from playwright.async_api import async_playwright

URL = "https://tutor-audio-restore.preview.emergentagent.com"
CHROME = "/pw-browsers/chromium_headless_shell-1208/chrome-linux/headless_shell"
WAV = "/app/tests/learner_speech_48k.wav"

INSTRUMENT = """
() => {
  window.__mon = { samples: [], events: [], err: [] };
  const A = () => document.getElementById('livo-remote-audio');
  // hook play/pause on the remote audio element to catch pauses
  const patch = () => {
    const a = A(); if (!a || a.__patched) return;
    a.__patched = true;
    const op = a.pause.bind(a);
    a.pause = function(){ window.__mon.events.push({t:Date.now(), ev:'ELEMENT.pause()'}); return op(); };
    a.addEventListener('pause', () => window.__mon.events.push({t:Date.now(), ev:'pause-event', paused:a.paused}));
    a.addEventListener('playing', () => window.__mon.events.push({t:Date.now(), ev:'playing-event'}));
  };
  let actx=null, analyser=null, data=null, curStream=null;
  const setupAnalyser = (stream) => {
    try{
      if(!actx){ actx = new (window.AudioContext||window.webkitAudioContext)(); }
      const src = actx.createMediaStreamSource(stream);
      analyser = actx.createAnalyser(); analyser.fftSize=1024;
      src.connect(analyser); data = new Uint8Array(analyser.fftSize);
      curStream = stream;
    }catch(e){ window.__mon.err.push('analyser '+e); }
  };
  const energy = () => {
    if(!analyser||!data) return 0;
    analyser.getByteTimeDomainData(data);
    let s=0; for(let i=0;i<data.length;i++){ const v=(data[i]-128)/128; s+=v*v; }
    return Math.sqrt(s/data.length);
  };
  setInterval(() => {
    patch();
    const a = A();
    if(a && a.srcObject && a.srcObject !== curStream){ setupAnalyser(a.srcObject); }
    if(actx && actx.state==='suspended'){ actx.resume().catch(()=>{}); }
    const cap = document.querySelector('[data-testid=\"caption-word\"]');
    const capBox = cap ? cap.closest('p') : null;
    const captionText = capBox ? capBox.innerText.replace(/\\n/g,' ').slice(0,200) : '';
    window.__mon.samples.push({
      t: Date.now(),
      paused: a? a.paused : null,
      muted: a? a.muted : null,
      vol: a? a.volume : null,
      hasSrc: a? !!a.srcObject : null,
      tracks: (a&&a.srcObject)? a.srcObject.getAudioTracks().length : 0,
      trackState: (a&&a.srcObject&&a.srcObject.getAudioTracks()[0])? a.srcObject.getAudioTracks()[0].readyState : null,
      energy: +energy().toFixed(4),
      caption: captionText,
    });
  }, 250);
  return true;
}
"""

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROME,
            headless=True,
            args=[
                "--use-fake-device-for-media-stream",
                "--use-fake-ui-for-media-stream",
                f"--use-file-for-fake-audio-capture={WAV}%noloop",
                "--autoplay-policy=no-user-gesture-required",
                "--no-sandbox",
            ],
        )
        ctx = await browser.new_context(permissions=["microphone"])
        page = await ctx.new_page()
        clog = []
        page.on("console", lambda m: clog.append(f"{m.type}:{m.text}"[:240]))
        page.on("pageerror", lambda e: clog.append(f"PAGEERROR:{e}"[:240]))
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(2500)
        # onboarding (if shown) else open live from home
        try:
            await page.click('[data-testid="onb-next"]', timeout=5000)
            await page.wait_for_timeout(700)
            await page.click('[data-testid="onb-finish"]', timeout=6000)
            print("onboarding done")
        except Exception:
            try:
                await page.click('[data-testid="nav-live"]', timeout=5000, force=True)
                print("opened live from nav")
            except Exception as e:
                print("open-live fail:", str(e)[:120])
        await page.wait_for_timeout(2000)
        await page.evaluate(INSTRUMENT)
        # start session
        try:
            await page.click('[data-testid="session-start"]', timeout=8000, force=True)
            print("clicked start")
        except Exception as e:
            print("start click fail:", str(e)[:150])
        # let the full ~40s scripted conversation play
        await page.wait_for_timeout(46000)
        mon = await page.evaluate("() => window.__mon")
        # transcript counts: open panel
        try:
            await page.click('[data-testid="live-transcript-toggle"]', timeout=4000, force=True)
            await page.wait_for_timeout(600)
            counts = await page.evaluate("""() => {
                const p = document.querySelector('[data-testid="transcript-panel"]');
                if(!p) return {u:0,a:0,turns:[]};
                const rows=[...p.querySelectorAll('.flex.justify-start, .flex.justify-end')];
                const turns = rows.map(r=>({role: r.classList.contains('justify-end')?'user':'assistant', text:(r.innerText||'').replace(/\\n/g,' ').slice(0,120)}));
                return {u:turns.filter(t=>t.role==='user').length, a:turns.filter(t=>t.role==='assistant').length, turns};
            }""")
        except Exception as e:
            counts = {"err": str(e)[:100]}
        await browser.close()

    samples = mon["samples"]
    events = mon["events"]
    errs = mon["err"]
    print("\n=== SAMPLE COUNT:", len(samples))
    if samples:
        t0 = samples[0]["t"]
        # find tutor speaking windows via energy
        speaking = [s for s in samples if s["energy"] and s["energy"] > 0.02]
        print("samples with audio energy>0.02:", len(speaking))
        # paused-while-energy = the BUG signature
        bug = [s for s in samples if s["energy"] and s["energy"] > 0.02 and s["paused"]]
        print("BUG samples (energy>0.02 AND element.paused):", len(bug))
        # print a compact timeline every ~1s
        print("\n t(s) paused muted vol energy tracks state | caption")
        last = -999
        for s in samples:
            rel = (s["t"]-t0)/1000.0
            if rel - last < 1.0: continue
            last = rel
            print(f"{rel:5.1f}  {str(s['paused'])[:5]:5} {str(s['muted'])[:5]:5} {s['vol']} {s['energy']:.3f} {s['tracks']} {str(s['trackState'])[:5]:5} | {s['caption'][:70]}")
        # energy bursts => tutor turns
        bursts=0; inburst=False
        for s in samples:
            hot = s["energy"] and s["energy"]>0.02
            if hot and not inburst: bursts+=1; inburst=True
            if not hot: 
                # require a gap of silence to end burst
                inburst=False if s["energy"] is not None and s["energy"]<0.01 else inburst
        print("\napprox tutor audio bursts:", bursts)
    print("\n=== ELEMENT pause() events:", json.dumps(events, indent=0)[:600])
    print("=== in-page errors:", errs[:10])
    print("=== transcript counts:", counts)
    print("\n=== last 40 console logs:")
    for l in clog[-40:]:
        print(l)

asyncio.run(main())
