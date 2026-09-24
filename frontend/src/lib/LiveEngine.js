import { API } from './api';
import {
  TEACHERS, MODE_NAMES, normalizeSpeechText, cleanAssistantDisplayText,
  extractPracticeInstruction, practiceNorm, practiceNormAny, practicePhraseSimilarity,
  likelyHungarianPracticePhrase,
} from './livo';

const rid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

export class LiveEngine {
  constructor(cb = {}) {
    this.cb = cb; // { getVocab, saveVocab, onFinished }
    this.listeners = new Set();
    this.reset();
    this.snap = this.build();
  }
  reset() {
    this.pc = null; this.dc = null; this.stream = null;
    this.phase = 'setup'; // setup|connecting|live|summary
    this.mode = 'business'; this.teacher = 'maya'; this.sessionMinutes = 15;
    this.profile = {}; this.langMode = 'hu'; this.pace = 'normal';
    this.status = 'Készen áll'; this.connectionLabel = 'Felkészülés';
    this.connected = false; this.muted = false; this.autoPaused = false; this.timeLimitReached = false;
    this.finishing = false; this.error = null;
    this.timeline = []; this.lastByRole = {};
    this.assistantSpeaking = false; this.userSpeaking = false; this.serverSpeechActive = false;
    this.orb = 'idle'; this.userEcho = ''; this.remoteStream = null; this.needsAudioUnlock = false;
    this.practiceTarget = null; this.correction = null; this.pronunciation = null;
    this.wordCapture = null; this.wordPopover = null; this.notes = [];
    this.preferenceBadge = this.langMode === 'hu' ? 'HU · magyar mód' : '';
    this.understood = false;
    this.caption = { teacher: 'maya', words: [], activeIndex: -1, text: '', fallback: 'Nyomd meg az Indítás gombot. A mikrofonengedély után úgy beszélgethetsz, mint egy élő tanárral.' };
    this.summary = null; this.summaryLoading = false;
    // internals
    this.activeMs = 0; this.startedAt = null; this.lastTimerTick = 0; this.timerPaused = false;
    this.timeLeft = 15 * 60;
    this.timer = null; this.karaokeTimer = null; this.karaokeTurnId = null; this.karaokeTarget = -1; this.karaokeActive = -1;
    this.greetingPhase = 'idle'; this.greetingRequested = false; this.greetingRetries = 0; this.greetingWatch = null; this.greetingCount = 0;
    this.manualResponseInFlight = false; this.lastMicActivity = 0; this.lastAssistantActivity = 0;
    this.idleTimer = null; this.idleGuideCount = 0; this.inactivityTimer = null;
    this.turnCheckTimer = null; this.turnCheckAbort = null; this.lastCheckedTurnId = null; this.turnCheckSeq = 0;
    this.responseFallbackTimer = null; this.responseFallbackSeq = 0; this.lastUserTurnNeedingResponse = null;
    this.usageSeconds = 0; this.usageOffset = 0; this.baselineVocab = [];
    this.pendingPron = null; this.pronTimer = null;
    this.summarySeq = 0; this.summaryAbort = null;
  }

  // ---------- store plumbing ----------
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.snap;
  build() {
    return {
      phase: this.phase, mode: this.mode, teacher: this.teacher, sessionMinutes: this.sessionMinutes,
      status: this.status, connectionLabel: this.connectionLabel, connected: this.connected, muted: this.muted,
      autoPaused: this.autoPaused, timeLimitReached: this.timeLimitReached, finishing: this.finishing, error: this.error,
      timeline: this.timeline, orb: this.orb, userEcho: this.userEcho, needsAudioUnlock: this.needsAudioUnlock, caption: this.caption,
      practiceTarget: this.practiceTarget, correction: this.correction, pronunciation: this.pronunciation,
      wordCapture: this.wordCapture, wordPopover: this.wordPopover, notes: this.notes,
      preferenceBadge: this.preferenceBadge, understood: this.understood,
      timeLeft: this.timeLeft, summary: this.summary, summaryLoading: this.summaryLoading,
      modeLabel: MODE_NAMES[this.mode] || 'Angol gyakorlás',
    };
  }
  notify() {
    this.snap = this.build();
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.snap = this.build(); this.listeners.forEach(f => f()); });
    // immediate too, so React sees it synchronously for critical updates
    this.listeners.forEach(f => f());
  }

  // ---------- lifecycle ----------
  open({ mode = 'business', teacher = 'maya', profile = {}, vocab = [], langMode = 'hu' } = {}) {
    this.hardCleanup(false);
    this.reset();
    this.mode = mode; this.teacher = teacher; this.profile = profile; this.langMode = langMode;
    this.caption = { ...this.caption, teacher, fallback: `Nyomd meg az Indítás gombot. ${TEACHERS[teacher]?.name || 'A tanár'} azonnal köszön, aztán indul a beszélgetés.` };
    this.baselineVocab = (vocab || []).map(v => normalizeSpeechText(v.term || '').toLowerCase()).filter(Boolean);
    this.timeLeft = this.sessionMinutes * 60;
    this.phase = 'setup';
    this.notify();
  }
  setMinutes(m) { this.sessionMinutes = m; this.timeLeft = m * 60; this.notify(); }
  setTeacher(t) { this.teacher = t; this.caption = { ...this.caption, teacher: t }; this.notify(); }

  async connect() {
    if (this.connected) return true;
    this.phase = 'connecting'; this.status = 'Mikrofon…'; this.error = null; this.notify();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.stream = stream; this.startMicMonitor(stream);
      const pc = new RTCPeerConnection(); this.pc = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = (e) => {
        const a = this.audioEl();
        if (e.streams && e.streams[0]) this.remoteStream = e.streams[0];
        else { if (!this.remoteStream) this.remoteStream = new MediaStream(); if (e.track) { try { this.remoteStream.addTrack(e.track); } catch {} } }
        if (a) {
          try { a.srcObject = this.remoteStream; } catch {}
          a.muted = false; a.autoplay = true; a.playsInline = true; a.volume = 1;
          const p = a.play();
          if (p && p.catch) p.catch(() => { this.needsAudioUnlock = true; this.notify(); });
        }
      };
      const dc = pc.createDataChannel('oai-events'); this.dc = dc;
      dc.addEventListener('message', (m) => this.handleEvent(m));
      dc.addEventListener('open', () => { this.connectionLabel = 'Kapcsolódva'; this.notify(); });
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await this.waitIce(pc);
      const res = await fetch(`${API}/live-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp: pc.localDescription.sdp, teacher: this.teacher, mode: this.mode, durationMinutes: this.sessionMinutes, languageMode: this.langMode, pace: this.pace, profile: this.profile, memory: this.timeline.slice(-10).map(t => `${t.role === 'user' ? 'learner' : 'tutor'}: ${t.text}`) }),
      });
      const payload = await res.json();
      if (!res.ok) { const err = new Error(typeof payload.error === 'string' ? payload.error : `Session error ${res.status}`); err.code = payload.code; throw err; }
      await pc.setRemoteDescription({ type: 'answer', sdp: payload.transport.sdp });
      this.greetingRequested = false; this.greetingPhase = 'idle'; this.manualResponseInFlight = false;
      this.status = 'Kapcsolódás…'; this.notify();
      return true;
    } catch (e) {
      this.error = e.code === 'NO_API_KEY' ? 'Az élő beszélgetéshez a szerveren OpenAI Realtime kulcs kell.' : (String(e.message).includes('mediaDevices') || e.name === 'NotAllowedError' ? 'A mikrofon eléréséhez engedély kell (HTTPS).' : `Nem sikerült kapcsolódni: ${e.message}`);
      this.connectionLabel = 'Nem sikerült'; this.status = 'Kapcsolódási hiba'; this.phase = 'setup';
      this.disconnectTransport(false); this.notify();
      return false;
    }
  }

  audioEl() { return document.getElementById('livo-remote-audio'); }
  waitIce(pc) {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const f = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', f); resolve(); } };
      pc.addEventListener('icegatheringstatechange', f); setTimeout(resolve, 2200);
    });
  }

  // ---------- transcript ----------
  addTranscript(role, delta, streamKey) {
    const last = this.timeline[this.timeline.length - 1];
    if (last && last.role === role && ((streamKey && last.streamKey === streamKey) || (!streamKey && (Date.now() - last.at) < 1500))) {
      last.text += delta; last.at = Date.now(); this.lastByRole[role] = last; this.timeline = [...this.timeline]; return last;
    }
    const turn = { id: rid('t'), role, text: delta, teacher: this.teacher, streamKey: streamKey || '', at: Date.now() };
    this.timeline = [...this.timeline, turn]; this.lastByRole[role] = turn; return turn;
  }

  handleEvent(msg) {
    let d; try { d = JSON.parse(msg.data); } catch { return; }
    const type = d.type || d?.response?.event?.type || '';
    const ev = d?.response?.event || d;
    if (type === 'session.started') this.markConnected();
    const speechStarted = type.includes('input') && type.includes('speech') && type.includes('started');
    const speechStopped = type.includes('input') && type.includes('speech') && type.includes('stopped');

    if (speechStarted) {
      this.clearResponseFallback(); clearTimeout(this.inactivityTimer); this.understood = false; this.cancelTurnCheck();
      this.userSpeaking = true; this.serverSpeechActive = true; this.manualResponseInFlight = false;
      if (this.greetingPhase === 'pending' || this.greetingPhase === 'speaking') { this.greetingPhase = 'done'; clearTimeout(this.greetingWatch); }
      this.markActivity(); this.pauseAudioForLearner('server'); this.status = 'Hallgatlak…'; this.orb = 'listening'; this.notify();
    }
    if (type === 'session.input_transcript.delta' && ev.delta) {
      this.markActivity(); this.userSpeaking = true;
      const key = ev.item_id || ev.turn_id || ev.segment_id || ev.response_id || '';
      const turn = this.addTranscript('user', ev.delta, key);
      this.status = 'Hallgatlak…'; this.orb = 'listening';
      this.userEcho = `Te: ${(turn?.text || normalizeSpeechText(ev.delta)).slice(-220)}`;
      this.scheduleResponseFallback(1900); this.notify();
    }
    if (speechStopped) {
      this.userSpeaking = false; this.serverSpeechActive = false; this.markActivity(); this.scheduleInactivityPause();
      this.scheduleTurnCheck(1050); this.scheduleResponseFallback(850);
      this.updatePracticeFromUser(this.lastByRole.user?.text || '');
      this.maybePronunciationIntent(this.lastByRole.user?.text || '');
      if (this.timeLimitReached) this.hardStop();
      this.notify();
    }
    if (type === 'session.output_transcript.delta' && ev.delta) {
      if (this.timeLimitReached || this.finishing) { try { this.audioEl()?.pause(); } catch {} return; }
      this.clearResponseFallback();
      const displayDelta = cleanAssistantDisplayText(ev.delta);
      if (!displayDelta.trim() && /\[[^\]]+\]/.test(String(ev.delta))) return;
      if (!this.userSpeaking && !this.serverSpeechActive) this.resumeAudio();
      this.assistantSpeaking = true; if (this.greetingPhase === 'pending') this.greetingPhase = 'speaking';
      const key = ev.item_id || ev.turn_id || ev.segment_id || ev.response_id || '';
      const turn = this.addTranscript('assistant', displayDelta || ev.delta, key);
      this.lastAssistantActivity = Date.now(); this.status = `${TEACHERS[this.teacher]?.name} beszél…`; this.orb = 'speaking'; this.userEcho = '';
      this.syncKaraoke(turn); this.notify();
    }
    if (['response.cancelled', 'response.canceled', 'response.done', 'response.completed'].includes(type)) {
      this.assistantSpeaking = false; this.manualResponseInFlight = false;
      if (this.userSpeaking || this.serverSpeechActive) { try { this.audioEl()?.pause(); } catch {} }
      if (type === 'response.done' || type === 'response.completed') {
        clearTimeout(this.greetingWatch);
        const last = this.lastByRole.assistant;
        if (this.greetingPhase === 'pending' || this.greetingPhase === 'speaking') { this.greetingPhase = 'done'; this.greetingRequested = true; }
        if (last) { this.updatePracticeFromAssistant(last); this.detectMisunderstanding(last.text); this.maybePronunciationFeedback(last.text); }
        this.scheduleInactivityPause();
        if (this.greetingPhase === 'done' && !this.userSpeaking && !this.serverSpeechActive && !this.timeLimitReached && this.idleGuideCount < 2) this.scheduleIdleNudge();
        if (this.timeLimitReached && !this.finishing) this.hardStop();
      }
      this.orb = this.assistantSpeaking ? 'speaking' : (this.muted ? 'muted' : 'idle'); this.notify();
    }
    if (type === 'session.usage.updated' && ev.usage?.seconds != null) this.usageSeconds = (this.usageOffset || 0) + (Number(ev.usage.seconds) || 0);
    if (type === 'session.input_audio.muted') { this.status = 'Mikrofon némítva'; this.notify(); }
    if (type === 'session.input_audio.unmuted') { this.status = 'Hallgatlak…'; this.notify(); }
    if (type === 'session.closed') { this.connected = false; this.assistantSpeaking = false; this.userSpeaking = false; this.notify(); }
    if (/error/i.test(type)) { this.manualResponseInFlight = false; if (this.greetingPhase === 'pending') this.greetingPhase = 'idle'; }
  }

  markConnected() {
    this.understood = false;
    if (!this.connected) { this.connected = true; this.phase = 'live'; this.connectionLabel = 'Élő'; this.startTimer(); }
    setTimeout(() => this.requestGreeting(), 140);
    this.notify();
  }

  // ---------- live channel helpers ----------
  send(obj) { if (this.dc?.readyState === 'open') { try { this.dc.send(JSON.stringify(obj)); return true; } catch { return false; } } return false; }
  appendInstruction(content) { return this.send({ type: 'session.instructions.append', event_id: rid('inst'), content }); }
  oneShot(instruction = '') {
    if (this.dc?.readyState !== 'open' || this.finishing || this.timeLimitReached || this.manualResponseInFlight || this.assistantSpeaking) return false;
    if (instruction) this.appendInstruction(`NEXT RESPONSE ONLY: ${instruction} After this one response, return to the standing LIVO tutor instructions and current lesson mode.`);
    this.manualResponseInFlight = true;
    return this.send({ type: 'response.create', event_id: rid('resp') });
  }
  requestGreeting() {
    if (this.greetingRequested || this.dc?.readyState !== 'open' || this.greetingPhase === 'done') return;
    this.greetingRequested = true; this.greetingPhase = 'pending';
    const t = TEACHERS[this.teacher] || TEACHERS.james;
    this.status = `${t.name} köszön…`; this.notify();
    const name = this.profile?.name || 'Dominik';
    const byMode = {
      free: 'Ez Szabad beszélgetés mód, kizárólag angoltanulásra. Kérdezz egy könnyű témát.',
      business: 'Ez Business English mód. Kérdezz egyetlen gyakorlati munkahelyi helyzetről.',
      vocabulary: 'Ez Szókikérdezés mód. A köszönés után rögtön kérdezz vissza EGY szót.',
      grammar: 'Ez Nyelvtan mód. Válassz EGY rövid nyelvtani fókuszt, adj egy apró beszédfeladatot.',
      interview: 'Ez Állásinterjú mód. Kérdezd meg, milyen pozíciót gyakoroljon.',
      situation: 'Ez Szituáció mód. Kérdezd meg, melyik szerepjátékot szeretné.',
      pronunciation: 'Ez Kiejtés mód. Kérdezd meg, melyik szót szeretné gyakorolni.',
      exam: 'Ez Vizsga mód. Mondd, hogy ez nem hivatalos vizsga, majd adj egy könnyű feladatot.',
    };
    this.appendInstruction(`THIS IS THE FIRST RESPONSE. Your FIRST audible words MUST be exactly: "Szia, ${name}! ${t.name} vagyok." Say that greeting ONCE, no preamble. NEVER output stage directions. ${this.langMode === 'hu' ? 'All meta-speech is Hungarian; English only as the exact learning target.' : ''} ${byMode[this.mode] || byMode.free} Keep it short: greeting plus ONE next learning question.`);
    this.manualResponseInFlight = true;
    this.send({ type: 'response.create', event_id: rid('greet') });
    clearTimeout(this.greetingWatch);
    this.greetingWatch = setTimeout(() => {
      const cnt = this.timeline.filter(x => x.role === 'assistant').length;
      if (this.connected && this.greetingPhase !== 'done' && !this.assistantSpeaking && !this.manualResponseInFlight && this.greetingRetries < 1) {
        this.greetingRetries++; this.greetingRequested = false; this.greetingPhase = 'idle'; this.requestGreeting();
      }
    }, 7000);
  }

  // ---------- audio ducking ----------
  resumeAudio() {
    const a = this.audioEl(); if (!a || this.timeLimitReached || this.finishing || this.userSpeaking || this.serverSpeechActive) return;
    try { if (this.remoteStream && a.srcObject !== this.remoteStream) a.srcObject = this.remoteStream; a.muted = false; a.playsInline = true; const p = a.play(); if (p && p.catch) p.catch(() => { this.needsAudioUnlock = true; this.notify(); }); } catch {}
  }
  unlockAudio() {
    const a = this.audioEl(); this.needsAudioUnlock = false;
    if (a) { try { if (this.remoteStream) a.srcObject = this.remoteStream; a.muted = false; a.volume = 1; a.playsInline = true; a.play()?.catch?.(() => {}); } catch {} }
    this.notify();
  }
  pauseAudioForLearner() { const a = this.audioEl(); if (!a) return; if (this.assistantSpeaking) { try { a.pause(); } catch {} this.status = 'Hallgatlak…'; this.orb = 'listening'; } }

  // ---------- karaoke ----------
  syncKaraoke(turn) {
    if (!turn) return;
    const full = normalizeSpeechText(turn.text);
    const words = full.split(/\s+/).filter(Boolean);
    if (this.karaokeTurnId !== turn.id) { clearTimeout(this.karaokeTimer); this.karaokeTimer = null; this.karaokeTurnId = turn.id; this.karaokeActive = -1; }
    this.karaokeTarget = words.length - 1;
    this.caption = { teacher: turn.teacher || this.teacher, words, activeIndex: this.karaokeActive, text: full };
    this.runKaraoke();
  }
  runKaraoke() {
    if (this.karaokeTimer) return;
    const tick = () => {
      if (this.karaokeActive < this.karaokeTarget) {
        this.karaokeActive++;
        this.caption = { ...this.caption, activeIndex: this.karaokeActive };
        this.notify();
        const w = this.caption.words[this.karaokeActive] || '';
        const delay = Math.max(150, Math.min(360, 145 + w.length * 13));
        this.karaokeTimer = setTimeout(() => { this.karaokeTimer = null; tick(); }, delay);
      } else this.karaokeTimer = null;
    };
    tick();
  }

  // ---------- practice target ----------
  setPracticeTarget(text, turnId = '', kind = 'repeat') {
    const clean = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim(); if (!clean) return;
    const same = this.practiceTarget && practiceNormAny(this.practiceTarget.text) === practiceNormAny(clean) && this.practiceTarget.kind === kind;
    this.practiceTarget = { text: clean, turnId, kind, completed: same ? !!this.practiceTarget.completed : false, attempted: same ? this.practiceTarget.attempted : false };
    this.notify();
  }
  hidePracticeTarget(delay = 0) {
    const run = () => { this.practiceTarget = null; this.notify(); };
    if (delay) setTimeout(run, delay); else run();
  }
  updatePracticeFromAssistant(turn) {
    if (!turn) return;
    const instr = extractPracticeInstruction(turn.text);
    if (instr) { this.setPracticeTarget(instr.text, turn.id, instr.kind); return; }
    if (this.practiceTarget?.kind === 'translate' && this.practiceTarget?.attempted) { this.hidePracticeTarget(900); return; }
    if (this.practiceTarget?.completed) this.hidePracticeTarget(1400);
  }
  updatePracticeFromUser(text = '') {
    if (!this.practiceTarget || this.practiceTarget.completed) return;
    if (this.practiceTarget.kind === 'translate') {
      const said = practiceNormAny(text), source = practiceNormAny(this.practiceTarget.text); if (!said || !source) return;
      this.practiceTarget = { ...this.practiceTarget, attempted: (said === source || likelyHungarianPracticePhrase(text)) ? 'same-language' : true }; this.notify(); return;
    }
    const t = practiceNorm(text), target = practiceNorm(this.practiceTarget.text); if (!t || !target) return;
    if (t.includes(target) || practicePhraseSimilarity(this.practiceTarget.text, text) >= 0.78) { this.practiceTarget = { ...this.practiceTarget, completed: true }; this.notify(); }
  }

  // ---------- corrections ----------
  showCorrection(label, why) {
    this.correction = { label, why };
    this.notes = [{ kind: 'Javítás', text: label }, ...this.notes].slice(0, 12);
    this.notify();
    clearTimeout(this._corrT); this._corrT = setTimeout(() => { this.correction = null; this.notify(); }, 7000);
  }
  cancelTurnCheck() { clearTimeout(this.turnCheckTimer); this.turnCheckTimer = null; this.turnCheckAbort?.abort?.(); this.turnCheckAbort = null; }
  latestUserTurn() { for (let i = this.timeline.length - 1; i >= 0; i--) if (this.timeline[i].role === 'user' && normalizeSpeechText(this.timeline[i].text)) return this.timeline[i]; return null; }
  scheduleTurnCheck(delay = 1100) { clearTimeout(this.turnCheckTimer); const seq = ++this.turnCheckSeq; this.turnCheckTimer = setTimeout(() => this.verifyTurn(seq), delay); }
  async verifyTurn(seq) {
    const turn = this.latestUserTurn(); if (!turn || this.finishing || seq !== this.turnCheckSeq) return;
    if (turn.id === this.lastCheckedTurnId) return;
    const text = normalizeSpeechText(turn.text); if (!text) return;
    const ctrl = new AbortController(); this.turnCheckAbort = ctrl;
    try {
      const prev = [...this.timeline].slice(0, -1).reverse().find(x => x.role === 'assistant')?.text || '';
      const r = await fetch(`${API}/turn-check`, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, mode: this.mode, teacher: this.teacher, previousAssistant: prev }) }).then(x => x.json());
      if (seq !== this.turnCheckSeq) return;
      this.lastCheckedTurnId = turn.id;
      if (r?.shouldCorrect && Number(r.confidence) >= 0.9 && r.corrected && r.original) this.showCorrection(`${r.original} → ${r.corrected}`, r.reason || 'Pontos javítás.');
      if (r?.uncertain) { this.understood = true; this.notify(); setTimeout(() => { this.understood = false; this.notify(); }, 5200); }
    } catch { /* ignore */ } finally { if (this.turnCheckAbort === ctrl) this.turnCheckAbort = null; }
  }

  // ---------- pronunciation ----------
  maybePronunciationIntent(text = '') {
    const clean = normalizeSpeechText(text);
    if (!/(jól ejtem|jól mondom|hogy ejt|kiejt|pronounc|sound right|say this right)/i.test(clean)) return;
    let attempt = '';
    const q = clean.match(/(?:jól ejtem|jól mondom|kiejtem|kiejtés(?:e)?|sound right)\s*[?:,-]?\s*[„“"']?([^„“"'?.!,]{2,60})/i);
    if (q?.[1]) attempt = normalizeSpeechText(q[1]);
    this.pendingPron = { attempt, userText: clean, prevAssistantId: this.lastByRole.assistant?.id || null };
  }
  maybePronunciationFeedback(assistantText = '') {
    const p = this.pendingPron; if (!p) return;
    const last = this.lastByRole.assistant; if (!last || last.id === p.prevAssistantId) return;
    this.pendingPron = null;
    const t = normalizeSpeechText(assistantText).toLowerCase();
    let status = 'unclear';
    if (/(almost|close|not quite|try again|majdnem|nem egészen|javíts|hangsúly)/i.test(t)) status = 'needs_work';
    else if (/(exactly|perfect|correct|spot on|igen[,! ]|jól ejt|teljesen jó|helyes)/i.test(t)) status = 'correct';
    const context = this.timeline.slice(-6).map(x => `${x.role}: ${x.text}`).join('\n');
    fetch(`${API}/pronunciation-help`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ attempt: p.attempt, userText: p.userText, assistantText: normalizeSpeechText(assistantText), tutorStatus: status, context }) })
      .then(x => x.json()).then(r => { this.pronunciation = r; this.notify(); }).catch(() => {
        this.pronunciation = { status, heard: p.attempt || '—', target: 'Hallgasd meg újra', hint: '', ipa: '', note: 'A részletes kiejtési kártya most nem töltődött be.' }; this.notify();
      });
  }
  hidePronunciation() { this.pronunciation = null; this.notify(); }
  listenPronunciation() { const w = this.pronunciation?.target; if (w) this.oneShot(`Pronounce only the English word or phrase ${JSON.stringify(w)}. First slowly once, then naturally once. No explanation.`); }

  // ---------- misunderstanding ----------
  detectMisunderstanding(text = '') {
    if (!/(nem (?:teljesen )?értettem|nem hallottam pontosan|mondd el még egyszer|couldn'?t quite catch|didn'?t catch that)/i.test(normalizeSpeechText(text))) return;
    this.understood = true; this.notify(); setTimeout(() => { this.understood = false; this.notify(); }, 6500);
  }

  // ---------- word lookup / capture ----------
  async lookupWord(word, context) {
    word = normalizeSpeechText(word || ''); if (!word) return;
    const saved = (this.cb.getVocab?.() || []).find(v => String(v.term || '').toLowerCase() === word.toLowerCase() && v.meaning);
    if (saved) { this.wordPopover = { word: saved.term, translation: saved.meaning, explanation: 'Már benne van a Szavaim között.', contextMeaning: saved.example || '', saved: true }; this.notify(); return; }
    this.wordPopover = { word, loading: true }; this.notify();
    try {
      const r = await fetch(`${API}/word-help`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word, context: context || this.caption.text || this.lastByRole.assistant?.text || '', explicitLookup: true, direction: 'auto' }) }).then(x => x.json());
      if (r?.saveable === false || r?.error) throw new Error(r?.error || 'not saveable');
      this.wordPopover = { word: r.source || word, translation: r.translation || '', explanation: r.explanation || '', contextMeaning: r.contextMeaning || '', sourceLanguage: r.sourceLanguage || 'en', saved: false };
    } catch (e) {
      this.wordPopover = { word, translation: '', error: 'Nem sikerült lekérni a jelentést.' };
    }
    this.notify();
  }
  async lookupPhrase(phrase, context) {
    phrase = normalizeSpeechText(phrase).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}?.!'-]+$/gu, '').trim();
    const count = phrase.split(/\s+/).filter(Boolean).length;
    if (count < 2 || count > 10) return;
    return this.lookupWord(phrase, context);
  }
  closeWordPopover() { this.wordPopover = null; this.notify(); }
  async saveWordPopover() {
    const p = this.wordPopover; if (!p || !p.translation) return;
    const lang = p.sourceLanguage || 'en';
    const payload = lang === 'hu' ? { term: p.translation, meaning: p.word } : { term: p.word, meaning: p.translation };
    const w = await this.cb.saveVocab?.({ ...payload, saved: true, source: 'caption_click', sourceLanguage: lang });
    if (w) { this.wordPopover = { ...p, saved: true }; this.notify(); }
  }
  async savePracticeTarget() {
    const target = this.practiceTarget?.text; if (!target) return;
    try {
      const r = await fetch(`${API}/word-help`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: target, context: this.lastByRole.assistant?.text || target, explicitLookup: true, direction: 'en_hu', selectionMode: 'phrase' }) }).then(x => x.json());
      if (r?.saveable === false) throw new Error('not saveable');
      const w = await this.cb.saveVocab?.({ term: r.source || target, meaning: r.translation || '', example: r.contextMeaning || '', saved: true, source: 'practice_target', sourceLanguage: 'en' });
      if (w) { this.practiceTarget = { ...this.practiceTarget, saved: true }; this.notify(); }
    } catch { /* handled by toast in store */ }
  }

  // ---------- timers & pause ----------
  startTimer() {
    this.startedAt = this.startedAt || Date.now(); this.lastTimerTick = Date.now(); clearInterval(this.timer); this.updateTimer();
    this.timer = setInterval(() => {
      const now = Date.now(); const delta = Math.min(1000, Math.max(0, now - (this.lastTimerTick || now))); this.lastTimerTick = now;
      if (this.connected && !this.timerPaused && !this.autoPaused && !this.finishing) this.activeMs += delta;
      this.updateTimer();
    }, 250);
  }
  updateTimer() {
    const target = this.sessionMinutes * 60; const active = Math.floor(this.activeMs / 1000);
    const left = Math.max(0, target - active); this.timeLeft = left;
    if (left <= 0 && !this.timeLimitReached) { this.timeLimitReached = true; this.timerPaused = true; this.hardStop(); }
    this.notify();
  }
  startMicMonitor(stream) {
    this.stopMicMonitor();
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = new AC(); const src = ctx.createMediaStreamSource(stream); const analyser = ctx.createAnalyser();
      analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.25; src.connect(analyser);
      const data = new Uint8Array(analyser.fftSize); this.audioCtx = ctx; this.lastMicActivity = Date.now(); let frames = 0;
      const tick = () => {
        if (!this.stream || this.stream !== stream) return;
        analyser.getByteTimeDomainData(data); let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        if (!this.muted && rms > 0.03) frames++; else frames = Math.max(0, frames - 1);
        if (frames >= 3) { this.markActivity(); if (this.assistantSpeaking && !this.userSpeaking) this.pauseAudioForLearner(); frames = 0; }
        this.micRaf = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* ignore */ }
  }
  stopMicMonitor() { if (this.micRaf) cancelAnimationFrame(this.micRaf); this.micRaf = null; if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; } }
  markActivity() { this.lastMicActivity = Date.now(); this.idleGuideCount = 0; clearTimeout(this.idleTimer); }
  scheduleInactivityPause() {
    clearTimeout(this.inactivityTimer);
    if (!this.connected || this.muted || this.autoPaused || this.finishing || this.timeLimitReached) return;
    const elapsed = Math.max(0, Date.now() - (this.lastMicActivity || Date.now())); const delay = Math.max(800, 60000 - elapsed);
    this.inactivityTimer = setTimeout(() => {
      const quiet = Date.now() - (this.lastMicActivity || 0);
      if (this.connected && !this.userSpeaking && !this.autoPaused && !this.timeLimitReached && quiet >= 59000) this.autoPause();
      else this.scheduleInactivityPause();
    }, delay);
  }
  autoPause() {
    if (this.autoPaused || !this.connected) return;
    this.autoPaused = true; this.timerPaused = true; clearTimeout(this.idleTimer);
    this.stream?.getAudioTracks().forEach(t => (t.enabled = false));
    this.send({ type: 'session.input_audio.mute', event_id: rid('idle_pause') });
    try { this.audioEl()?.pause(); } catch {}
    this.status = 'Szüneteltetve'; this.preferenceBadge = 'SZÜNET · mikrofon kikapcsolva'; this.notify();
  }
  resumeFromPause() {
    if (!this.autoPaused) return;
    this.autoPaused = false; this.timerPaused = false; this.muted = false;
    this.stream?.getAudioTracks().forEach(t => (t.enabled = true));
    this.send({ type: 'session.input_audio.unmute', event_id: rid('idle_resume') });
    this.preferenceBadge = this.langMode === 'hu' ? 'HU · magyar mód' : '';
    this.status = 'Hallgatlak…'; this.markActivity(); this.scheduleInactivityPause(); this.notify();
  }
  scheduleIdleNudge(delay = 6500) {
    clearTimeout(this.idleTimer);
    if (!this.connected || this.muted || this.finishing || this.greetingPhase !== 'done' || this.assistantSpeaking || this.manualResponseInFlight || this.userSpeaking || this.serverSpeechActive || this.timeLimitReached) return;
    if (this.idleGuideCount >= 2) return;
    this.idleTimer = setTimeout(() => this.fireIdle(), delay);
  }
  fireIdle() {
    clearTimeout(this.idleTimer);
    if (!this.connected || this.muted || this.finishing || this.greetingPhase !== 'done' || this.assistantSpeaking || this.manualResponseInFlight || this.userSpeaking || this.serverSpeechActive || this.timeLimitReached) return;
    if (!this.lastByRole.assistant || this.idleGuideCount >= 2) return;
    const pass = ++this.idleGuideCount;
    const target = this.practiceTarget?.text || ''; const completed = this.practiceTarget?.completed === true;
    const instr = pass === 1
      ? `The learner has been silent for several seconds. YOU must lead now; do not merely say "Na?". Take the next teaching step. ${target ? `The visible target is ${JSON.stringify(target)} and it is ${completed ? 'already completed' : 'still pending'}. ` : ''}Give one tiny hint or scaffold, then ask one concrete short question. 1–3 sentences in the current persona and language mode.`
      : `The learner is still silent. Do not nag or repeat. Give the answer/example or simplify yourself, then advance one small step with ONE very easy action. Brief.`;
    if (!this.oneShot(instr)) this.idleGuideCount = Math.max(0, this.idleGuideCount - 1);
  }
  clearResponseFallback() { clearTimeout(this.responseFallbackTimer); this.responseFallbackTimer = null; }
  scheduleResponseFallback(delay = 1500) {
    this.clearResponseFallback(); const seq = ++this.responseFallbackSeq; const turn = this.latestUserTurn();
    if (!turn || !this.connected || this.finishing || this.timeLimitReached) return;
    this.lastUserTurnNeedingResponse = turn.id;
    this.responseFallbackTimer = setTimeout(() => {
      if (seq !== this.responseFallbackSeq || !this.connected || this.finishing || this.assistantSpeaking || this.manualResponseInFlight || this.userSpeaking || this.serverSpeechActive) return;
      const latest = this.latestUserTurn(); if (!latest || latest.id !== this.lastUserTurnNeedingResponse) return;
      this.oneShot('The native Live turn did not begin promptly. Answer this latest learner turn now. Do not repeat anything you already said.');
    }, delay);
  }

  toggleMute() {
    if (this.autoPaused) { this.resumeFromPause(); return; }
    this.muted = !this.muted;
    this.stream?.getAudioTracks().forEach(t => (t.enabled = !this.muted));
    this.send({ type: this.muted ? 'session.input_audio.mute' : 'session.input_audio.unmute', event_id: rid('mute') });
    if (this.muted) clearTimeout(this.idleTimer); else { this.lastMicActivity = Date.now(); if (this.lastAssistantActivity) this.scheduleIdleNudge(); }
    this.orb = this.muted ? 'muted' : (this.assistantSpeaking ? 'speaking' : 'idle');
    this.notify();
  }

  hardStop() {
    if (this.finishing) return;
    this.timeLimitReached = true; this.timerPaused = true; this.clearResponseFallback(); clearTimeout(this.idleTimer); clearTimeout(this.inactivityTimer); this.cancelTurnCheck();
    try { const a = this.audioEl(); if (a) { a.pause(); a.muted = true; } } catch {}
    this.stream?.getAudioTracks().forEach(t => (t.enabled = false));
    this.send({ type: 'response.cancel', event_id: rid('time_cancel') });
    this.send({ type: 'session.input_audio.mute', event_id: rid('time_mute') });
    setTimeout(() => this.finish({ timed: true }), 0);
  }

  disconnectTransport(sendClose = true) {
    this.clearResponseFallback(); clearTimeout(this.idleTimer); clearTimeout(this.inactivityTimer); clearTimeout(this.greetingWatch); this.cancelTurnCheck(); this.stopMicMonitor();
    if (sendClose && this.dc?.readyState === 'open') { try { this.dc.send(JSON.stringify({ type: 'session.close', event_id: rid('close') })); } catch {} }
    this.stream?.getTracks().forEach(t => t.stop());
    try { this.dc?.close(); } catch {} try { this.pc?.close(); } catch {}
    this.pc = this.dc = this.stream = null; this.connected = false; this.assistantSpeaking = false; this.userSpeaking = false; this.serverSpeechActive = false;
    this.greetingRequested = false; this.greetingPhase = 'idle'; this.manualResponseInFlight = false; this.orb = 'idle';
  }
  hardCleanup(sendClose = true) {
    clearInterval(this.timer); clearTimeout(this.karaokeTimer); this.disconnectTransport(sendClose);
  }

  sessionStarted() { return !!this.startedAt || this.activeMs > 0 || this.connected || this.timeline.some(t => normalizeSpeechText(t?.text || '')); }

  cancelBeforeStart() {
    this.summarySeq++; this.summaryAbort?.abort?.();
    this.hardCleanup(false); this.reset(); this.phase = 'closed'; this.notify();
    this.cb.onFinished?.();
  }

  async finish() {
    if (this.finishing) return; this.finishing = true;
    const seq = ++this.summarySeq;
    const duration = Math.max(1, Math.floor(this.activeMs / 1000) || (this.startedAt ? Math.floor((Date.now() - this.startedAt) / 1000) : 0));
    const transcript = this.timeline.map(x => ({ role: x.role, text: normalizeSpeechText(x.text) })).filter(x => x.text);
    const teacher = this.teacher, mode = this.mode;
    const userTurns = transcript.filter(t => t.role === 'user');
    this.summary = {
      headline: 'Kész — az óra lezárult.', speaking_minutes: Math.max(1, Math.round((this.usageSeconds || duration) / 60)),
      user_turns: userTurns.length, wins: [], corrections: [], vocabulary: [], next_focus: 'A részletes értékelés készül…',
      homework: [], last_exchange: transcript.slice(-4), teacher, mode, instant: true,
    };
    this.summaryLoading = true; this.phase = 'summary';
    this.hardCleanup(true);
    this.notify();
    const ctrl = new AbortController(); this.summaryAbort = ctrl; const to = setTimeout(() => ctrl.abort(), 14000);
    try {
      const r = await fetch(`${API}/session/analyze`, { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacher, mode, durationSeconds: duration, transcript, baselineVocabulary: this.baselineVocab }) }).then(x => x.json());
      if (seq !== this.summarySeq) return;
      this.cb.onData?.(r.state);
      this.summary = { ...r.analysis, teacher, mode, instant: false }; this.summaryLoading = false; this.notify();
    } catch (e) {
      if (seq !== this.summarySeq) return;
      this.summary = { ...this.summary, next_focus: 'A részletes AI-elemzés most nem érkezett meg. A következő órán innen folytatjuk.', instant: false }; this.summaryLoading = false; this.notify();
    } finally { clearTimeout(to); if (this.summaryAbort === ctrl) this.summaryAbort = null; if (seq === this.summarySeq) this.finishing = false; }
  }

  end() {
    if (this.phase === 'setup' || this.phase === 'connecting' || !this.sessionStarted()) { this.cancelBeforeStart(); return; }
    this.finish();
  }
  dismissSummary() { this.summary = null; this.phase = 'closed'; this.notify(); this.cb.onFinished?.(); }
}
