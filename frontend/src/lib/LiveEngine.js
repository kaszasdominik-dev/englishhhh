import { API, clientHeaders, readJsonResponse } from './api';
import { liveKindForTask, normalizeLearningTask, taskToLiveInstruction } from './learningTasks';
import { LANGUAGE_MIX_META, defaultLanguageMixForCefr, defaultPaceForCefr, languageModeForMix, normalizeCefr } from './liveAdaptation';
import {
  TEACHERS, MODE_NAMES, normalizeSpeechText, cleanAssistantDisplayText,
  extractPracticeInstruction, practiceNorm, practiceNormAny, practicePhraseSimilarity,
  likelyHungarianPracticePhrase, likelyEnglishPracticePhrase,
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
    this.mode = 'free'; this.teacher = 'maya'; this.sessionMinutes = 15;
    this.profile = {}; this.languageMix = 'mixed'; this.langMode = null; this.pace = 'normal'; this.cefrLevel = 'B1';
    this.status = 'Készen áll'; this.connectionLabel = 'Felkészülés';
    this.connected = false; this.muted = false; this.autoPaused = false; this.pauseReason = ''; this.timeLimitReached = false;
    this.finishing = false; this.error = null;
    this.timeline = []; this.lastByRole = {};
    this.assistantSpeaking = false; this.userSpeaking = false; this.serverSpeechActive = false;
    this.orb = 'idle'; this.userEcho = ''; this.remoteStream = null; this.needsAudioUnlock = false;
    this.practiceTarget = null; this.correction = null; this.pronunciation = null;
    this.wordCapture = null; this.wordPopover = null; this.notes = [];
    this.provisionalUser = ''; this._provRaw = ''; this._taskEvalSeq = 0;
    this.preferenceBadge = '';
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
    this.reconnecting = false; this.reconnectFailed = false; this.reconnectAttempt = 0; this.resumeAfterReconnect = false;
    this._practiceAnswerSeq = 0;
    this.pendingPron = null; this.pronTimer = null;
    this.pendingInitialTask = null;
    this.scenario = null;
    this.situationStepIndex = 0; this.situationHintsUsed = 0; this.situationHintText = '';
    this.situationHelpUsed = 0; this.situationHelpArmed = false; this.situationClearHelpAfterResponse = false;
    this.situationFrustration = 0; this.situationTurnCount = 0; this.situationFinished = false;
    this.situationMistakes = []; this.situationPendingOpening = ''; this.situationFinishQueued = false; this.situationFinishAfterResponse = false;
    this.summarySeq = 0; this.summaryAbort = null; this.connectWatch = null;
    this.diag = [];
  }

  // ---------- store plumbing ----------
  subscribe = (fn) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.snap;
  build() {
    return {
      phase: this.phase, mode: this.mode, teacher: this.teacher, sessionMinutes: this.sessionMinutes,
      status: this.status, connectionLabel: this.connectionLabel, connected: this.connected, muted: this.muted,
      autoPaused: this.autoPaused, pauseReason: this.pauseReason, timeLimitReached: this.timeLimitReached, finishing: this.finishing, error: this.error,
      timeline: this.timeline, orb: this.orb, userEcho: this.userEcho, needsAudioUnlock: this.needsAudioUnlock, caption: this.caption,
      practiceTarget: this.practiceTarget, correction: this.correction, pronunciation: this.pronunciation,
      wordCapture: this.wordCapture, wordPopover: this.wordPopover, notes: this.notes,
      preferenceBadge: this.preferenceBadge, understood: this.understood,
      languageMix: this.languageMix, languageMixMeta: LANGUAGE_MIX_META[this.languageMix], cefrLevel: this.cefrLevel,
      timeLeft: this.timeLeft, summary: this.summary, summaryLoading: this.summaryLoading,
      reconnecting: this.reconnecting, reconnectFailed: this.reconnectFailed, reconnectAttempt: this.reconnectAttempt,
      diag: this.diag,
      scenario: this.scenario, situationStepIndex: this.situationStepIndex,
      situationHintsUsed: this.situationHintsUsed, situationHintText: this.situationHintText,
      situationHelpUsed: this.situationHelpUsed, situationHelpArmed: this.situationHelpArmed,
      situationFrustration: this.situationFrustration, situationTurnCount: this.situationTurnCount,
      situationFinished: this.situationFinished, situationMistakes: this.situationMistakes,
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
  open({ mode = 'free', teacher = 'maya', profile = {}, vocab = [], languageMix = null, langMode = null, initialTask = null, scenario = null } = {}) {
    this.hardCleanup(false);
    this.reset();
    this.mode = mode; this.teacher = teacher; this.profile = profile; this.scenario = scenario || null;
    this.cefrLevel = normalizeCefr(profile?.cefr || 'B1');
    this.languageMix = ['english', 'mixed', 'hungarian'].includes(languageMix)
      ? languageMix
      : (langMode === 'en' ? 'english' : langMode === 'hu' ? 'hungarian' : defaultLanguageMixForCefr(this.cefrLevel));
    this.langMode = languageModeForMix(this.languageMix);
    this.pace = defaultPaceForCefr(this.cefrLevel);
    this.pendingInitialTask = initialTask ? normalizeLearningTask(initialTask) : null;
    this.caption = { ...this.caption, teacher, fallback: this.scenario ? `Nyomd meg az Indítás gombot. Indul: ${this.scenario.title}.` : `Nyomd meg az Indítás gombot. ${TEACHERS[teacher]?.name || 'A tanár'} azonnal köszön, aztán indul a beszélgetés.` };
    this.baselineVocab = (vocab || []).map(v => normalizeSpeechText(v.term || '').toLowerCase()).filter(Boolean);
    this.timeLeft = this.sessionMinutes * 60;
    this.phase = 'setup';
    this.notify();
  }
  setMinutes(m) { this.sessionMinutes = m; this.timeLeft = m * 60; this.notify(); }
  setTeacher(t) { this.teacher = t; this.caption = { ...this.caption, teacher: t }; this.notify(); }

  setLanguageMix(mix, { persist = true } = {}) {
    if (!['english', 'mixed', 'hungarian'].includes(mix) || mix === this.languageMix) return;
    this.languageMix = mix;
    this.langMode = languageModeForMix(mix);
    this.profile = { ...this.profile, liveLanguageMix: mix };
    if (persist) this.cb.saveLivePreference?.(mix);
    if (this.connected) {
      const rule = mix === 'english'
        ? 'STANDING LANGUAGE OVERRIDE: From now on, conduct the lesson entirely in English. Keep English appropriate to the learner CEFR level. If they struggle, simplify and rephrase in easier English instead of switching to Hungarian, unless they explicitly change the language control again.'
        : mix === 'hungarian'
          ? 'STANDING LANGUAGE OVERRIDE: From now on, use natural Hungarian for instructions, explanations, corrections and transitions. Keep English only for the exact English target words, phrases, examples and learner practice.'
          : 'STANDING LANGUAGE OVERRIDE: From now on, use a clean bilingual teaching style: English is the main practice language, but use short natural Hungarian support when it helps understanding. Aim for roughly half English and half Hungarian at beginner levels, without mixing languages inside broken sentences. Keep the English difficulty appropriate to the learner CEFR level.';
      this.appendInstruction(rule);
    }
    this.notify();
  }

  async connect(isReconnect = false) {
    if (this.connected) return true;
    if (isReconnect) { this.status = 'Újracsatlakozás…'; this.error = null; }
    else { this.phase = 'connecting'; this.status = 'Mikrofon…'; this.error = null; this.diag = [];
      this.setDiag('mic', 'active'); this.setDiag('session', 'pending'); this.setDiag('webrtc', 'pending'); this.setDiag('live', 'pending'); }
    this.notify();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      this.stream = stream; this.startMicMonitor(stream);
      if (!isReconnect) { this.setDiag('mic', 'done'); this.setDiag('session', 'active'); }
      const iceServers = await this.getIceServers();
      const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 }); this.pc = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.ontrack = (e) => {
        const a = this.audioEl();
        if (e.streams && e.streams[0]) this.remoteStream = e.streams[0];
        else { if (!this.remoteStream) this.remoteStream = new MediaStream(); if (e.track) { try { this.remoteStream.addTrack(e.track); } catch {} } }
        if (a) {
          try { if (a.srcObject !== this.remoteStream) a.srcObject = this.remoteStream; } catch {}
          a.muted = false; a.autoplay = true; a.playsInline = true; a.volume = 1;
          const p = a.play();
          if (p && p.catch) p.catch(() => { this.needsAudioUnlock = true; this.notify(); });
        }
      };
      const dc = pc.createDataChannel('oai-events'); this.dc = dc;
      dc.addEventListener('message', (m) => this.handleEvent(m));
      dc.addEventListener('open', () => { this.connectionLabel = 'Kapcsolódva'; this.notify(); });
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await this.waitIce(pc);
      const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 12000);
      let res, payload;
      try {
        res = await fetch(`${API}/live-session`, {
          method: 'POST', headers: clientHeaders({ 'Content-Type': 'application/json' }), signal: ctrl.signal,
          body: JSON.stringify({ sdp: pc.localDescription.sdp, teacher: this.teacher, mode: this.mode, scenarioId: this.scenario?.id || null, durationMinutes: this.sessionMinutes, languageMode: this.langMode, languageMix: this.languageMix, pace: this.pace, profile: this.profile, memory: this.timeline.slice(-10).map(t => `${t.role === 'user' ? 'learner' : 'tutor'}: ${t.text}`) }),
        });
        const raw = await res.text();
        try {
          payload = raw ? JSON.parse(raw) : {};
        } catch {
          // Never turn a non-JSON server/proxy error page into a misleading JSON.parse network error.
          payload = res.ok ? { transport: { sdp: raw } } : { error: raw || `Session error ${res.status}` };
        }
      } catch (fe) {
        clearTimeout(to);
        throw new Error(fe.name === 'AbortError' ? 'A szerver nem válaszolt időben (munkamenet).' : `Hálózati hiba: ${fe.message}`);
      }
      clearTimeout(to);
      if (!res.ok) {
        const serverMessage = typeof payload?.error === 'string' ? payload.error : `Session error ${res.status}`;
        const err = new Error(serverMessage.slice(0, 500)); err.code = payload?.code; throw err;
      }
      const remoteSdp = payload?.transport?.sdp || payload?.sdp;
      if (!remoteSdp) throw new Error('A szerver nem adott vissza érvényes WebRTC SDP választ.');
      if (!isReconnect) { this.setDiag('session', 'done'); this.setDiag('webrtc', 'active'); }
      await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });
      if (!isReconnect) {
        pc.addEventListener('iceconnectionstatechange', () => {
          if (this.pc !== pc) return;
          const st = pc.iceConnectionState;
          if (st === 'connected' || st === 'completed') { this.setDiag('webrtc', 'done', st); if (this.diag.find(d => d.key === 'live')?.state === 'pending') this.setDiag('live', 'active'); }
          else if (st === 'failed') this.setDiag('webrtc', 'error', 'ICE sikertelen');
          else if (st === 'checking') this.setDiag('webrtc', 'active', 'ellenőrzés…');
        });
      }
      this.watchConnection(pc, dc);
      this.greetingRequested = false; this.greetingPhase = 'idle'; this.manualResponseInFlight = false;
      this.status = 'Kapcsolódás…'; this.notify();
      if (!isReconnect) this.startConnectWatch();
      return true;
    } catch (e) {
      this.error = e.code === 'NO_API_KEY' ? 'Az élő beszélgetéshez a szerveren OpenAI Realtime kulcs kell.' : (String(e.message).includes('mediaDevices') || e.name === 'NotAllowedError' ? 'A mikrofon eléréséhez engedély kell (HTTPS).' : `Nem sikerült kapcsolódni: ${e.message}`);
      if (!isReconnect) { const act = this.diag.find(d => d.state === 'active'); if (act) this.setDiag(act.key, 'error', act.detail || 'hiba'); this.connectionLabel = 'Nem sikerült'; this.status = 'Kapcsolódási hiba'; this.phase = 'setup'; }
      this.disconnectTransport(false); this.notify();
      return false;
    }
  }

  // ---------- reconnect guard ----------
  watchConnection(pc, dc) {
    const drop = () => {
      if (this.pc !== pc || this.finishing || this.timeLimitReached || this.reconnecting || this.phase !== 'live') return;
      this.handleConnectionDrop();
    };
    pc.addEventListener('connectionstatechange', () => {
      if (this.pc !== pc) return;
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed') drop();
      else if (st === 'disconnected') {
        clearTimeout(this._dropDebounce);
        this._dropDebounce = setTimeout(() => {
          if (this.pc === pc && (pc.connectionState === 'disconnected' || pc.connectionState === 'failed')) drop();
        }, 2500);
      } else if (st === 'connected') clearTimeout(this._dropDebounce);
    });
    dc.addEventListener('close', () => { if (this.dc === dc && this.connected) drop(); });
  }
  handleConnectionDrop() {
    if (this.reconnecting || this.finishing || this.timeLimitReached || this.phase !== 'live') return;
    this.reconnecting = true; this.reconnectFailed = false; this.reconnectAttempt = 0;
    this.timerPaused = true; this.usageOffset = this.usageSeconds || 0;
    this.connectionLabel = 'Újracsatlakozás…'; this.status = 'A kapcsolat megszakadt…'; this.orb = 'idle';
    this.assistantSpeaking = false; this.userSpeaking = false; this.serverSpeechActive = false;
    try { this.audioEl()?.pause(); } catch {}
    this.disconnectTransport(false);
    this.notify();
    this.attemptReconnect();
  }
  async attemptReconnect() {
    this.reconnecting = true; this.reconnectFailed = false; this.notify();
    const delays = [800, 2500, 5000];
    for (let i = 0; i < delays.length; i++) {
      if (this.finishing || this.timeLimitReached || this.connected) return;
      this.reconnectAttempt = i + 1;
      this.status = `Újracsatlakozás… (${i + 1}/${delays.length})`; this.notify();
      await new Promise(r => setTimeout(r, delays[i]));
      if (this.finishing || this.timeLimitReached || this.connected) return;
      this.resumeAfterReconnect = true;
      const ok = await this.connect(true);
      if (ok) {
        // Creating the transport is not enough: wait for the Live session.started event.
        const deadline = Date.now() + 9000;
        while (!this.connected && !this.finishing && Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (this.connected) return;
        this.disconnectTransport(false);
      }
      this.resumeAfterReconnect = false;
    }
    this.reconnecting = false; this.reconnectFailed = true;
    this.connectionLabel = 'Kapcsolat nélkül'; this.status = 'Nem sikerült újracsatlakozni';
    this.notify();
  }

  audioEl() { return document.getElementById('livo-remote-audio'); }
  // ICE servers (STUN + optional TURN relay for restrictive networks) fetched from the backend once.
  async getIceServers() {
    if (this._iceServers) return this._iceServers;
    const fallback = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
    try {
      const cfg = await fetch(`${API}/rtc-config`).then(readJsonResponse);
      this._iceServers = (cfg && Array.isArray(cfg.iceServers) && cfg.iceServers.length) ? cfg.iceServers : fallback;
    } catch { this._iceServers = fallback; }
    return this._iceServers;
  }
  // On-screen connection diagnostics so the learner can see exactly which step stalls.
  setDiag(key, state, detail = '') {
    const labels = { mic: 'Mikrofon engedélyezése', session: 'Munkamenet létrehozása', webrtc: 'Hangkapcsolat felépítése', live: 'Élő kapcsolat' };
    const i = this.diag.findIndex(d => d.key === key);
    const item = { key, label: labels[key] || key, state, detail };
    if (i >= 0) { this.diag = this.diag.map((d, idx) => idx === i ? item : d); }
    else { this.diag = [...this.diag, item]; }
    this.notify();
  }
  // If session.started never arrives (e.g. WebRTC/NAT could not establish), don't hang on
  // "Kapcsolódás…" forever — surface an actionable error so the learner can retry.
  startConnectWatch() {
    clearTimeout(this.connectWatch);
    this.connectWatch = setTimeout(() => {
      if (this.connected || this.finishing || this.timeLimitReached || this.reconnecting) return;
      const act = this.diag.find(d => d.state === 'active');
      if (act) this.setDiag(act.key, 'error', 'időtúllépés');
      const where = act && act.key === 'webrtc'
        ? 'A hangkapcsolat (WebRTC) nem épült fel — ezt gyakran tűzfal vagy szigorú hálózat blokkolja.'
        : (act && act.key === 'live' ? 'A kapcsolat felépült, de a hang-munkamenet nem indult el.' : 'Nem érkezett válasz a szervertől.');
      this.error = `${where} Ellenőrizd az internetkapcsolatot, és próbáld újra.`;
      this.connectionLabel = 'Nem sikerült'; this.status = 'Kapcsolódási hiba'; this.phase = 'setup';
      this.disconnectTransport(false); this.notify();
    }, 15000);
  }
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
  // Commit ONE authoritative (or provisional) learner turn — never appends half-word deltas.
  commitUserTurn(text, provisional = false) {
    const clean = normalizeSpeechText(text); if (!clean) return null;
    const last = this.lastByRole.user;
    if (last && last.provisional && (Date.now() - (last.at || 0)) < 9000) {
      last.text = clean; last.provisional = provisional; last.at = Date.now(); this.timeline = [...this.timeline];
      this.lastByRole.user = last; this.notify(); return last;
    }
    const turn = { id: rid('t'), role: 'user', text: clean, teacher: this.teacher, streamKey: '', at: Date.now(), provisional };
    this.timeline = [...this.timeline, turn]; this.lastByRole.user = turn; this.notify(); return turn;
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
      clearTimeout(this._vadWatchdog);
      this._vadWatchdog = setTimeout(() => {
        if (this.serverSpeechActive) { this.serverSpeechActive = false; this.userSpeaking = false; this.resumeAudio(); this.notify(); }
      }, 20000);
      if (this.greetingPhase === 'pending' || this.greetingPhase === 'speaking') { this.greetingPhase = 'done'; clearTimeout(this.greetingWatch); }
      this.markActivity(); this.pauseAudioForLearner('server'); this.status = 'Hallgatlak…'; this.orb = 'listening'; this.notify();
    }
    if (type === 'session.input_transcript.delta' && ev.delta) {
      this.markActivity();
      // Late ASR deltas can arrive after speech stopped — they must not re-flag the learner as speaking,
      // otherwise tutor audio stays paused forever.
      if (this.serverSpeechActive) { this.userSpeaking = true; this.status = 'Hallgatlak…'; this.orb = 'listening'; }
      // Buffer raw deltas as PROVISIONAL text only. Never commit half-word deltas to the authoritative
      // timeline; the final transcript event (below) is the source of truth.
      this._provRaw = (this._provRaw || '') + ev.delta;
      this.provisionalUser = normalizeSpeechText(this._provRaw);
      this.userEcho = `Te: ${this.provisionalUser.slice(-220)}`;
      this.scheduleResponseFallback(1900); this.notify();
    }
    // Authoritative final learner transcript → overwrite whatever provisional turn we committed.
    const inputFinal = type.includes('input') && type.includes('transcript') && (type.includes('completed') || type.endsWith('.done') || type.includes('final'));
    if (inputFinal) {
      const finalText = normalizeSpeechText(ev.transcript || ev.text || this.provisionalUser || '');
      this._provRaw = ''; this.provisionalUser = '';
      if (finalText) {
        this.commitUserTurn(finalText, false);
        this.updatePracticeFromUser(finalText);
        this.maybePronunciationIntent(finalText);
      }
    }
    if (speechStopped) {
      this.userSpeaking = false; this.serverSpeechActive = false; clearTimeout(this._vadWatchdog);
      this.markActivity(); this.scheduleInactivityPause();
      this.resumeAudio();
      // If the final transcript event has not arrived yet, commit the provisional buffer as a
      // provisional turn so verification/practice can run; the final event overwrites it later.
      if (this._provRaw || this.provisionalUser) {
        const t = normalizeSpeechText(this._provRaw || this.provisionalUser);
        this._provRaw = ''; this.provisionalUser = '';
        if (t) this.commitUserTurn(t, true);
      }
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
      // The tutor is audibly responding NOW. Its own speaker output can leak into the mic and
      // trip server VAD (a false input_audio speech_started); that must never keep the tutor muted.
      // Clear any stale learner-speaking flags and force the remote audio element audible on every
      // tutor delta so subsequent turns can never go silent.
      this.userSpeaking = false; this.serverSpeechActive = false; clearTimeout(this._vadWatchdog);
      this.ensureTutorAudible();
      this.assistantSpeaking = true; if (this.greetingPhase === 'pending') this.greetingPhase = 'speaking';
      const key = ev.item_id || ev.turn_id || ev.segment_id || ev.response_id || '';
      const turn = this.addTranscript('assistant', displayDelta || ev.delta, key);
      this.lastAssistantActivity = Date.now(); this.status = `${TEACHERS[this.teacher]?.name} beszél…`; this.orb = 'speaking'; this.userEcho = '';
      this.syncKaraoke(turn); this.notify();
    }
    // Authoritative final tutor transcript → replace the streamed caption text with the clean version.
    const outputFinal = type.includes('output') && type.includes('transcript') && (type.includes('completed') || type.endsWith('.done') || type.includes('final'));
    if (outputFinal && (ev.transcript || ev.text) && !this.timeLimitReached && !this.finishing) {
      const finalText = cleanAssistantDisplayText(ev.transcript || ev.text);
      const last = this.lastByRole.assistant;
      if (last && finalText.trim()) { last.text = finalText; last.provisional = false; this.timeline = [...this.timeline]; this.syncKaraoke(last); this.notify(); }
    }
    if (['response.cancelled', 'response.canceled', 'response.done', 'response.completed'].includes(type)) {
      this.assistantSpeaking = false; this.manualResponseInFlight = false;
      // Do NOT pause the remote audio element here. Pausing a live MediaStream element and relying
      // on a later resume was the source of the silent-tutor bug across turns.
      if (type === 'response.done' || type === 'response.completed') {
        clearTimeout(this.greetingWatch);
        const last = this.lastByRole.assistant;
        const finishedGreeting = this.greetingPhase === 'pending' || this.greetingPhase === 'speaking';
        if (finishedGreeting) { this.greetingPhase = 'done'; this.greetingRequested = true; }
        if (last) { this.updatePracticeFromAssistant(last); this.detectMisunderstanding(last.text); this.maybePronunciationFeedback(last.text); }
        if (this.mode === 'situation' && this.scenario && this.situationClearHelpAfterResponse) {
          this.situationClearHelpAfterResponse = false;
          this.appendInstruction(`HELP MODE OVER. Return fully to role as ${this.scenario.aiRole}. Remain on step ${this.currentSituationStep()?.id || ''} until the scenario controller advances it.`);
        }
        if (this.mode === 'situation' && this.scenario && this.situationFinishAfterResponse) {
          this.situationFinishAfterResponse = false;
          setTimeout(() => { if (!this.finishing) this.finish(); }, 450);
        } else if (this.mode === 'situation' && this.scenario) {
          setTimeout(() => this.flushSituationQueue(), 120);
        }
        if (finishedGreeting && this.pendingInitialTask) {
          const task = this.pendingInitialTask; this.pendingInitialTask = null;
          setTimeout(() => this.presentLearningTask(task, { speak: true }), 250);
        }
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
    clearTimeout(this.connectWatch);
    if (this.diag.length) this.setDiag('live', 'done');
    this.understood = false;
    const wasReconnect = this.resumeAfterReconnect;
    this.reconnecting = false; this.reconnectFailed = false; this.resumeAfterReconnect = false; this.reconnectAttempt = 0;
    if (!this.connected) { this.connected = true; this.phase = 'live'; this.connectionLabel = 'Élő'; this.timerPaused = false; this.startTimer(); }
    if (wasReconnect) {
      this.status = 'Hallgatlak…';
      this.greetingPhase = 'done'; this.greetingRequested = true;
      setTimeout(() => this.oneShot('The audio connection briefly dropped and has just been restored. In ONE short sentence acknowledge you are back, then continue the lesson exactly where it left off. Do not re-introduce yourself, do not greet again.'), 300);
    } else {
      setTimeout(() => this.requestGreeting(), 140);
    }
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
    if (this.mode === 'situation' && this.scenario) {
      const opening = this.scenario.steps?.[0]?.opening || 'Hello.';
      this.status = this.scenario.title + ' indul…'; this.notify();
      this.appendInstruction(`ROLEPLAY START. Your first audible line MUST be exactly: "${opening}". Do not introduce yourself as a teacher. Stay in character as ${this.scenario.aiRole}. Ask only this one current-step question and wait.`);
      this.manualResponseInFlight = true;
      this.send({ type: 'response.create', event_id: rid('scenario_start') });
      clearTimeout(this.greetingWatch);
      this.greetingWatch = setTimeout(() => {
        if (this.connected && this.greetingPhase !== 'done' && !this.assistantSpeaking && !this.manualResponseInFlight && this.greetingRetries < 1) {
          this.greetingRetries++; this.greetingRequested = false; this.greetingPhase = 'idle'; this.requestGreeting();
        }
      }, 7000);
      return;
    }
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
    const nextStep = this.pendingInitialTask ? 'A fixed learning task will follow immediately after this greeting. Do NOT ask any other question yet.' : `${byMode[this.mode] || byMode.free} Keep it short: greeting plus ONE next learning question.`;
    const greeting = this.languageMix === 'hungarian' ? `Szia, ${name}! ${t.name} vagyok.` : `Hi, ${name}! I'm ${t.name}.`;
    const languageRule = this.languageMix === 'english'
      ? 'Continue in English only, adjusted to the learner level.'
      : this.languageMix === 'hungarian'
        ? 'Continue with Hungarian meta-speech; English only for actual learning targets and examples.'
        : 'Continue with English as the main practice language plus short natural Hungarian support where useful.';
    this.appendInstruction(`THIS IS THE FIRST RESPONSE. Your FIRST audible words MUST be exactly: "${greeting}" Say that greeting ONCE, no preamble. NEVER output stage directions. ${languageRule} ${nextStep}`);
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
    try { if (this.remoteStream && a.srcObject !== this.remoteStream) a.srcObject = this.remoteStream; a.muted = false; a.volume = 1; a.playsInline = true; const p = a.play(); if (p && p.catch) p.catch(() => { this.needsAudioUnlock = true; this.notify(); }); } catch {}
  }
  // Force the remote WebRTC audio element to be audible right now, regardless of VAD/learner state.
  // Called on every tutor output delta so a mis-fired server VAD can never leave the tutor muted.
  ensureTutorAudible() {
    const a = this.audioEl(); if (!a || this.timeLimitReached || this.finishing) return;
    try {
      if (this.remoteStream && a.srcObject !== this.remoteStream) a.srcObject = this.remoteStream;
      a.muted = false; a.volume = 1; a.playsInline = true;
      if (a.paused) { const p = a.play(); if (p && p.catch) p.catch(() => { this.needsAudioUnlock = true; this.notify(); }); }
    } catch {}
  }
  unlockAudio() {
    const a = this.audioEl(); this.needsAudioUnlock = false;
    if (a) { try { if (this.remoteStream) a.srcObject = this.remoteStream; a.muted = false; a.volume = 1; a.playsInline = true; a.play()?.catch?.(() => {}); } catch {} }
    this.notify();
  }
  // Never pause the live remote audio element on learner/VAD activity. Barge-in is handled
  // server-side (the tutor response is cancelled), and pausing a live MediaStream element left
  // the tutor silent for the rest of its turn. Only reflect the listening state in the UI here.
  pauseAudioForLearner() { if (this.assistantSpeaking) { this.status = 'Hallgatlak…'; this.orb = 'listening'; } }

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
  setPracticeTarget(text, turnId = '', kind = 'repeat', meta = {}) {
    const clean = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim(); if (!clean) return;
    const same = this.practiceTarget && practiceNormAny(this.practiceTarget.text) === practiceNormAny(clean) && this.practiceTarget.kind === kind;
    const expected = normalizeSpeechText(meta.expectedAnswer || meta.expected_answer || '');
    this.practiceTarget = {
      text: clean, turnId, kind,
      taskId: meta.taskId || meta.task_id || (same ? this.practiceTarget.taskId : turnId),
      taskType: meta.taskType || meta.task_type || (same ? this.practiceTarget.taskType : null),
      source: meta.source || (same ? this.practiceTarget.source : 'transcript'),
      acceptedAnswers: meta.acceptedAnswers || meta.accepted_answers || (same ? this.practiceTarget.acceptedAnswers : []),
      state: same ? (this.practiceTarget.state || 'pending') : 'pending',
      hintLevel: same ? (this.practiceTarget.hintLevel || 0) : 0,
      completed: same ? !!this.practiceTarget.completed : false,
      attempted: same ? this.practiceTarget.attempted : false,
      answer: expected || (same ? this.practiceTarget.answer : null),
      correctAnswer: expected || (same ? this.practiceTarget.correctAnswer : null),
      reason: same ? this.practiceTarget.reason : null,
      matched: same ? this.practiceTarget.matched : null,
      saved: same ? this.practiceTarget.saved : false,
    };
    this.notify();
    if ((kind === 'translate' || kind === 'meaning') && !same && !expected) this.prefetchPracticeAnswer(clean, kind);
  }

  presentLearningTask(rawTask, { speak = true } = {}) {
    const task = normalizeLearningTask(rawTask);
    if (!task.display_text) return null;
    const kind = liveKindForTask(task);
    this.setPracticeTarget(task.display_text, task.id, kind, {
      taskId: task.id,
      taskType: task.type,
      source: task.source,
      expectedAnswer: task.expected_answer,
      acceptedAnswers: task.accepted_answers,
    });
    if (speak && this.connected) {
      const spoken = taskToLiveInstruction(task);
      this.oneShot(`Say this fixed learning task naturally in Hungarian, without revealing the answer: ${JSON.stringify(spoken)}. Do not paraphrase the target. Stop after the question and wait for the learner.`);
    }
    return task;
  }
  async prefetchPracticeAnswer(source, kind = 'translate') {
    const seq = ++this._practiceAnswerSeq;
    const direction = kind === 'meaning' ? 'en_hu' : 'hu_en';
    try {
      const r = await fetch(`${API}/word-help`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ word: source, context: this.lastByRole.assistant?.text || source, direction, explicitLookup: true }) }).then(readJsonResponse);
      if (seq !== this._practiceAnswerSeq) return;
      const answer = normalizeSpeechText(r?.translation || '');
      if (answer && this.practiceTarget?.kind === kind && practiceNormAny(this.practiceTarget.text) === practiceNormAny(source)) {
        this.practiceTarget = { ...this.practiceTarget, answer };
        this.notify();
      }
    } catch { /* tutor still verifies by voice */ }
  }
  completePracticeTarget(matched) {
    this.markTaskResolved('correct', normalizeSpeechText(matched || this.practiceTarget?.text || ''), 'Szép! Megvan.');
  }
  // Central task-state setter. states: pending | correct | almost_correct | wrong | dont_know
  markTaskResolved(state, correctAnswer, reason) {
    const pt = this.practiceTarget; if (!pt || pt.state === 'correct') return;
    const key = pt.text;
    const answer = normalizeSpeechText(correctAnswer || pt.correctAnswer || pt.answer || '');
    this.practiceTarget = { ...pt, state, completed: state === 'correct', correctAnswer: answer || pt.correctAnswer, reason: reason || pt.reason, matched: answer || normalizeSpeechText(pt.text) };
    if (state === 'correct') {
      this.playSuccessChime();
      this.recordTaskSR(pt.kind === 'translate' ? (answer || pt.answer || '') : pt.text, 'correct');
      this.notify();
      setTimeout(() => { if (this.practiceTarget?.state === 'correct' && this.practiceTarget.text === key) this.hidePracticeTarget(); }, 2600);
    } else {
      if (state === 'wrong') {
        this.recordTaskSR(pt.kind === 'translate' ? (answer || pt.answer || '') : pt.text, 'wrong');
        this.capturePracticeMistake(pt, answer).catch(() => {});
      }
      this.notify();
    }
  }
  async capturePracticeMistake(pt, resolvedAnswer = '') {
    if (!pt) return;
    let term = '', meaning = '';
    if (pt.kind === 'translate') {
      term = normalizeSpeechText(resolvedAnswer || pt.correctAnswer || pt.answer || '');
      meaning = normalizeSpeechText(pt.text || '');
    } else if (pt.kind === 'meaning') {
      term = normalizeSpeechText(pt.text || '');
      meaning = normalizeSpeechText(resolvedAnswer || pt.correctAnswer || pt.answer || '');
    } else {
      term = normalizeSpeechText(pt.text || '');
    }
    if (!term || term.split(/\s+/).length > 5) return;

    const already = (this.cb.getVocab?.() || []).some(v => String(v.term || '').toLowerCase() === term.toLowerCase());
    if (already) return;

    if (!meaning) {
      try {
        const r = await fetch(`${API}/word-help`, {
          method: 'POST',
          headers: clientHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ word: term, context: this.lastByRole.assistant?.text || term, direction: 'en_hu', explicitLookup: true }),
        }).then(readJsonResponse);
        if (r?.saveable === false || r?.error) return;
        meaning = normalizeSpeechText(r?.translation || '');
      } catch { return; }
    }
    if (!meaning) return;

    try {
      await this.cb.saveVocab?.({
        term,
        meaning,
        example: '',
        saved: true,
        source: 'live_task_mistake',
        sourceLanguage: 'en',
        quiet: true,
      });
    } catch { /* non-blocking */ }
  }

  // Speak ONLY the English target with clean native pronunciation (server TTS).
  async pronounceText(text) {
    const clean = normalizeSpeechText(text || ''); if (!clean) return;
    try {
      const r = await fetch(`${API}/pronounce`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text: clean, teacher: this.teacher }) });
      if (!r.ok) throw new Error('tts');
      const blob = await r.blob();
      try { this._pronAudio?.pause(); } catch {}
      this._pronAudio = new Audio(URL.createObjectURL(blob));
      this._pronAudio.play().catch(() => {});
    } catch { /* ignore */ }
  }
  pronounceTarget() {
    const pt = this.practiceTarget; if (!pt) return;
    const en = pt.kind === 'translate' ? (pt.correctAnswer || pt.answer) : pt.text;
    if (en) this.pronounceText(en);
  }
  // Gradual spoken hint from the live tutor (never the full answer on the first tap).
  taskHint() {
    const pt = this.practiceTarget; if (!pt || pt.state === 'correct') return;
    const level = (pt.hintLevel || 0) + 1;
    this.practiceTarget = { ...pt, hintLevel: level };
    this.notify();
    const src = pt.text;
    const instr = pt.kind === 'meaning'
      ? (level === 1
        ? `The learner tapped "Segítség" for the meaning task ${JSON.stringify(src)}. Give ONE tiny semantic clue in natural Hungarian without saying the full Hungarian translation.`
        : level === 2
        ? `The learner needs a bigger hint for the meaning of ${JSON.stringify(src)}. Give a short Hungarian description or usage clue, but still do not state the exact translation.`
        : `The learner still needs help with the meaning of ${JSON.stringify(src)}. Give an almost-complete Hungarian explanation and ask them to say the meaning themselves.`)
      : (level === 1
        ? `The learner tapped "Segítség" (hint) for the current task ${JSON.stringify(src)}. Give ONE small, gentle hint in natural Hungarian (e.g. the first sound, the tense, or a tiny clue). Do NOT reveal the full English answer.`
        : level === 2
        ? `The learner tapped "Segítség" again for ${JSON.stringify(src)}. Give a BIGGER hint in natural Hungarian: the first word or the sentence structure. Still do NOT say the whole answer.`
        : `The learner still needs help with ${JSON.stringify(src)}. Now give almost the full answer as a scaffold in natural Hungarian, leaving only the last piece for them to say, and encourage them to try.`);
    this.oneShot(instr);
  }
  // "Nem tudom": reveal the answer and keep the current task type.
  async taskDontKnow() {
    const pt = this.practiceTarget; if (!pt || pt.state === 'correct') return;
    const needsLookup = pt.kind === 'translate' || pt.kind === 'meaning';
    let answer = needsLookup ? (pt.answer || pt.correctAnswer) : pt.text;
    const meaningTask = pt.kind === 'meaning';
    const reason = meaningTask
      ? (answer ? 'Semmi baj — itt a jelentés. Mondd el te is röviden.' : 'Egy pillanat, megkeresem a jelentést…')
      : (answer ? 'Semmi baj — itt a helyes válasz. Mondd ki utánam.' : 'Egy pillanat, előkészítem a helyes választ…');
    this.practiceTarget = { ...this.practiceTarget, state: 'dont_know', correctAnswer: answer || '', hintLevel: 0, reason };
    this.notify();

    if (needsLookup && !answer) {
      try {
        const direction = meaningTask ? 'en_hu' : 'hu_en';
        const r = await fetch(`${API}/word-help`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ word: pt.text, context: this.lastByRole.assistant?.text || pt.text, direction, explicitLookup: true }) }).then(readJsonResponse);
        answer = normalizeSpeechText(r?.translation || '');
      } catch { /* fall through */ }
      answer = answer || pt.text;
      if (this.practiceTarget && this.practiceTarget.state === 'dont_know') {
        this.practiceTarget = {
          ...this.practiceTarget,
          answer,
          correctAnswer: answer,
          reason: meaningTask ? 'Semmi baj — itt a jelentés. Mondd el te is röviden.' : 'Semmi baj — itt a helyes válasz. Mondd ki utánam.',
        };
        this.notify();
      }
    }

    answer = answer || pt.text;
    this.recordTaskSR(pt.kind === 'translate' ? answer : pt.text, 'dont_know');
    this.capturePracticeMistake(pt, answer).catch(() => {});
    if (meaningTask) {
      this.oneShot(`The learner pressed "Nem tudom" for a meaning task. The English target is ${JSON.stringify(pt.text)} and the Hungarian meaning is ${JSON.stringify(answer)}. Briefly reveal the Hungarian meaning, give one tiny usage clue, then ask the learner to tell you what it means. Do not ask them to pronounce the Hungarian answer.`);
    } else {
      this.oneShot(`The learner pressed "Nem tudom" (I don't know) for this task. In natural Hungarian kindly reassure them, then pronounce the correct English answer ${JSON.stringify(answer)} clearly ONCE in native English, and ask them in Hungarian to repeat it after you. Keep it short.`);
    }
  }
  async recordTaskSR(term, outcome) {
    const clean = normalizeSpeechText(term || '').toLowerCase(); if (!clean) return;
    const saved = (this.cb.getVocab?.() || []).find(v => String(v.term || '').toLowerCase() === clean);
    if (!saved) return;
    try {
      const r = await fetch(`${API}/game/result`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ term: saved.term, outcome, game: 'live_quiz' }) }).then(readJsonResponse);
      if (r?.state) this.cb.onData?.(r.state);
    } catch { /* non-blocking */ }
  }
  playSuccessChime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      if (!this._chimeCtx || this._chimeCtx.state === 'closed') this._chimeCtx = new AC();
      const ctx = this._chimeCtx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t0 = ctx.currentTime + 0.02;
      [[659.25, 0], [987.77, 0.11]].forEach(([f, off]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + off);
        g.gain.exponentialRampToValueAtTime(0.09, t0 + off + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.55);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0 + off); o.stop(t0 + off + 0.6);
      });
    } catch { /* silent */ }
  }
  hidePracticeTarget(delay = 0) {
    const key = this.practiceTarget?.text;
    const run = () => { if (delay && this.practiceTarget && this.practiceTarget.text !== key) return; this.practiceTarget = null; this.notify(); };
    if (delay) setTimeout(run, delay); else run();
  }
  updatePracticeFromAssistant(turn) {
    if (!turn) return;
    const instr = extractPracticeInstruction(turn.text);
    if (instr) { this.setPracticeTarget(instr.text, turn.id, instr.kind); return; }
    // Keep the current task card visible until the learner actually answers (resolved as correct).
  }
  updatePracticeFromUser(text = '') {
    const pt = this.practiceTarget;
    if (!pt || pt.state === 'correct') return;
    this.evaluateTaskAnswer(text);
  }
  async evaluateTaskAnswer(text) {
    const pt = this.practiceTarget; if (!pt || pt.state === 'correct') return;
    const said = normalizeSpeechText(text); if (!said) return;
    // After "Nem tudom", pronunciation/translation tasks wait for repetition.
    // A meaning task remains a meaning task: the learner should answer in Hungarian.
    const kind = pt.state === 'dont_know' && pt.kind !== 'meaning' ? 'repeat' : pt.kind;
    const expected = (kind === 'translate' || kind === 'meaning')
      ? (pt.answer || pt.correctAnswer || '')
      : (pt.state === 'dont_know' ? (pt.correctAnswer || pt.text) : pt.text);
    // Translate task answered in Hungarian → don't penalise, just nudge to answer in English.
    if (pt.kind === 'translate' && pt.state !== 'dont_know') {
      const saidAny = practiceNormAny(said), srcAny = practiceNormAny(pt.text);
      if ((saidAny && srcAny && saidAny === srcAny) || (likelyHungarianPracticePhrase(said) && !likelyEnglishPracticePhrase(said))) {
        this.practiceTarget = { ...pt, attempted: 'same-language' }; this.notify(); return;
      }
    }
    // Fast local "correct" path (avoids latency for obvious matches).
    if (expected) {
      const a = kind === 'meaning' ? practiceNormAny(said) : practiceNorm(said);
      const b = kind === 'meaning' ? practiceNormAny(expected) : practiceNorm(expected);
      const similar = kind === 'meaning'
        ? (a && b && (a.includes(b) || b.includes(a)))
        : practicePhraseSimilarity(expected, said) >= 0.82;
      if (b && a && (a.includes(b) || b.includes(a) || similar)) {
        this.markTaskResolved('correct', expected, 'Szép! Megvan.'); return;
      }
    }
    // Nuanced, meaning-based evaluation (not exact-string) on the server.
    const seq = ++this._taskEvalSeq;
    this.practiceTarget = { ...this.practiceTarget, attempted: true }; this.notify();
    try {
      const r = await fetch(`${API}/task-eval`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ kind, source: pt.text, expected, learnerText: said, context: this.lastByRole.assistant?.text || '' }) }).then(readJsonResponse);
      if (seq !== this._taskEvalSeq || !this.practiceTarget || this.practiceTarget.state === 'correct') return;
      const st = ['correct', 'almost_correct', 'wrong'].includes(r?.state) ? r.state : 'almost_correct';
      this.markTaskResolved(st, r?.correctAnswer || expected, r?.reason || '');
    } catch { /* leave pending; the live tutor still verifies by voice */ }
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
    // Dedicated drills already have their own task evaluator; a second AI verifier adds
    // latency/cost and can produce conflicting feedback.
    if (['vocabulary', 'grammar', 'pronunciation'].includes(this.mode)) return;
    const turn = this.latestUserTurn(); if (!turn || this.finishing || seq !== this.turnCheckSeq) return;
    if (turn.id === this.lastCheckedTurnId) return;
    const text = normalizeSpeechText(turn.text); if (!text) return;
    if (this.mode === 'situation' && this.scenario) return this.verifySituationTurn(seq, turn, text);
    const ctrl = new AbortController(); this.turnCheckAbort = ctrl;
    try {
      const prev = [...this.timeline].slice(0, -1).reverse().find(x => x.role === 'assistant')?.text || '';
      const r = await fetch(`${API}/turn-check`, { method: 'POST', signal: ctrl.signal, headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ text, mode: this.mode, teacher: this.teacher, previousAssistant: prev }) }).then(readJsonResponse);
      if (seq !== this.turnCheckSeq) return;
      this.lastCheckedTurnId = turn.id;
      if (r?.shouldCorrect && Number(r.confidence) >= 0.9 && r.corrected && r.original) this.showCorrection(`${r.original} → ${r.corrected}`, r.reason || 'Pontos javítás.');
      if (r?.uncertain) { this.understood = true; this.notify(); setTimeout(() => { this.understood = false; this.notify(); }, 5200); }
    } catch { /* ignore */ } finally { if (this.turnCheckAbort === ctrl) this.turnCheckAbort = null; }
  }

  // ---------- finite situation role-play ----------
  flushSituationQueue() {
    if (!this.scenario || this.finishing || this.assistantSpeaking || this.manualResponseInFlight || this.userSpeaking || this.serverSpeechActive) return false;
    if (this.situationPendingOpening) {
      const opening = this.situationPendingOpening;
      const ok = this.oneShot(`SCENARIO NEXT STEP. Say exactly: "${opening}". Stay in role. Ask nothing else and wait for the learner.`);
      if (ok) this.situationPendingOpening = '';
      return ok;
    }
    if (this.situationFinishQueued) {
      const ok = this.oneShot('SCENARIO COMPLETE. Close the role-play naturally in ONE short in-character sentence. Do not ask a new question and do not change topic.');
      if (ok) {
        this.situationFinishQueued = false;
        this.situationFinishAfterResponse = true;
      }
      return ok;
    }
    return false;
  }

  currentSituationStep() { return this.scenario?.steps?.[this.situationStepIndex] || null; }

  situationHint() {
    const step = this.currentSituationStep();
    if (!step || this.situationFinished || this.situationHintsUsed >= (this.scenario?.hintLimit || 3)) return;
    const hints = step.hints || [];
    const hint = hints[Math.min(this.situationHintsUsed, hints.length - 1)] || '';
    this.situationHintsUsed += 1;
    this.situationHintText = hint;
    this.notify();
  }

  situationAskHelp() {
    if (!this.scenario || this.situationFinished || this.situationHelpUsed >= (this.scenario.helpLimit || 1) || this.situationHelpArmed) return;
    if (this.dc?.readyState !== 'open' || this.finishing || this.timeLimitReached || this.manualResponseInFlight || this.assistantSpeaking) return;
    const step = this.currentSituationStep();
    this.appendInstruction(`TEMPORARY ROLEPLAY HELP: The NEXT learner utterance is their one help question, not an answer to the scenario. Answer that one question briefly in Hungarian, with at most one useful English model phrase. Then repeat the current role-play line in English: ${JSON.stringify(step?.opening || '')}. Do not advance the scenario because of the help question.`);
    const ok = this.oneShot('Say exactly in Hungarian: "Segítek, viszont csak 1 kérdésed lehet! Hallgatlak." Then stop and wait for the learner question.');
    if (!ok) return;
    this.situationHelpUsed = 1; this.situationHelpArmed = true;
    this.notify();
  }

  async verifySituationTurn(seq, turn, text) {
    if (!this.scenario || !turn || seq !== this.turnCheckSeq || this.situationFinished) return;
    const prev = [...this.timeline].slice(0, -1).reverse().find(x => x.role === 'assistant')?.text || '';
    this.lastCheckedTurnId = turn.id;
    const ctrl = new AbortController(); this.turnCheckAbort = ctrl;
    try {
      if (this.situationHelpArmed) {
        this.situationHelpArmed = false;
        if (this.assistantSpeaking || this.manualResponseInFlight) {
          this.situationClearHelpAfterResponse = true;
        } else {
          this.appendInstruction(`HELP MODE OVER. Return fully to role as ${this.scenario.aiRole}. Remain on step ${this.currentSituationStep()?.id || ''} until the scenario controller advances it.`);
        }
        this.notify();
        return;
      }

      const r = await fetch(`${API}/scenario/live-check`, {
        method:'POST', credentials:'include', signal:ctrl.signal, headers:clientHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({
          scenarioId:this.scenario.id, stepIndex:this.situationStepIndex, learnerText:text,
          previousAssistant:prev, frustration:this.situationFrustration,
        }),
      }).then(x=>x.json());
      if (seq !== this.turnCheckSeq) return;

      this.situationTurnCount += 1;
      this.situationFrustration = Number(r.frustration || 0);
      if (Array.isArray(r.mistakes) && r.mistakes.length) this.situationMistakes = [...new Set([...this.situationMistakes, ...r.mistakes])].slice(0, 12);

      if (!r.understood) {
        this.understood = true;
        this.appendInstruction(`SCENARIO FRUSTRATION UPDATE: ${r.frustrationInstruction || ''} Stay on the current step. Ask only one short in-character clarification.`);
        setTimeout(() => { this.understood = false; this.notify(); }, 5200);
      }

      if (r.stepComplete) {
        this.situationStepIndex = Number(r.stepIndex ?? this.situationStepIndex);
        this.situationHintText = '';
        if (r.finished) {
          this.situationFinished = true;
          this.appendInstruction('SCENARIO COMPLETE. Do not ask any new question or change topic. Close the role-play naturally in ONE short in-character sentence, then remain silent.');
          this.situationFinishQueued = true;
        } else {
          this.appendInstruction(`SCENARIO STEP UPDATE — HIGHEST PRIORITY. Current step is now ${r.nextStepId}. Goal: ${r.nextGoal}. Stay strictly on this step until another update.`);
          this.situationPendingOpening = r.nextOpening || '';
        }
      }

      if (this.situationTurnCount >= (this.scenario.maxTurns || 16) && !this.situationFinished) {
        this.situationFinished = true;
        this.situationPendingOpening = '';
        this.appendInstruction('SCENARIO TURN LIMIT REACHED. Close the role-play in ONE short in-character sentence. Do not continue the conversation.');
        this.situationFinishQueued = true;
      }
      this.notify();
      setTimeout(() => this.flushSituationQueue(), 80);
    } catch { /* keep live role-play running */ }
    finally { if (this.turnCheckAbort === ctrl) this.turnCheckAbort = null; }
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
    fetch(`${API}/pronunciation-help`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ attempt: p.attempt, userText: p.userText, assistantText: normalizeSpeechText(assistantText), tutorStatus: status, context }) })
      .then(readJsonResponse).then(r => { this.pronunciation = r; this.notify(); }).catch(() => {
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
    word = normalizeSpeechText(word || '').replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, '').trim(); if (!word) return;
    const saved = (this.cb.getVocab?.() || []).find(v => String(v.term || '').toLowerCase() === word.toLowerCase() && v.meaning);
    if (saved) { this.wordPopover = { word: saved.term, translation: saved.meaning, explanation: 'Már benne van a Szavaim között.', contextMeaning: saved.example || '', saved: true }; this.notify(); return; }
    this.wordPopover = { word, loading: true }; this.notify();
    try {
      const r = await fetch(`${API}/word-help`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ word, context: context || this.caption.text || this.lastByRole.assistant?.text || '', explicitLookup: true, direction: 'auto' }) }).then(readJsonResponse);
      if (r?.saveable === false || r?.error) throw new Error(r?.error || 'not saveable');
      this.wordPopover = { word: r.source || word, translation: r.translation || '', explanation: r.explanation || '', contextMeaning: r.contextMeaning || '', sourceLanguage: r.sourceLanguage || 'en', saved: false };
    } catch (e) {
      if (this.wordPopover?.word !== word) return; // popover was closed/changed — don't resurrect or spam logs
      console.error('[LIVO] word-help failed for', word, e);
      this.wordPopover = { word, translation: '', error: 'Nem sikerült lekérni a jelentést. Koppints újra.' };
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
    const p = this.wordPopover; if (!p || !p.translation || p.saved || p.saving) return;
    const lang = p.sourceLanguage || 'en';
    const payload = lang === 'hu' ? { term: p.translation, meaning: p.word } : { term: p.word, meaning: p.translation };
    this.wordPopover = { ...p, saving: true, error: '' }; this.notify();
    try {
      const savedWord = await this.cb.saveVocab?.({ ...payload, saved: true, source: 'caption_click', sourceLanguage: lang });
      if (!savedWord) throw new Error('save rejected');
      if (this.wordPopover?.word === p.word) {
        this.wordPopover = { ...this.wordPopover, saving: false, saved: true, error: '' };
        this.notify();
      }
    } catch (e) {
      console.error('[LIVO] save word failed', e);
      if (this.wordPopover?.word === p.word) {
        this.wordPopover = { ...p, saving: false, saved: false, error: 'Nem sikerült menteni. Próbáld újra.' };
        this.notify();
      }
    }
  }
  async savePracticeTarget() {
    const target = this.practiceTarget?.text; if (!target) return;
    try {
      const r = await fetch(`${API}/word-help`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ word: target, context: this.lastByRole.assistant?.text || target, explicitLookup: true, direction: 'en_hu', selectionMode: 'phrase' }) }).then(readJsonResponse);
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
        // NOTE: never pause tutor audio from local RMS — speaker echo would silence the tutor.
        // Interruptions are handled by server VAD (speechStarted). Local RMS only marks activity.
        if (frames >= 3) { this.markActivity(); frames = 0; }
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
      if (this.connected && !this.userSpeaking && !this.autoPaused && !this.timeLimitReached && quiet >= 59000) this.autoPause('idle');
      else this.scheduleInactivityPause();
    }, delay);
  }
  autoPause(reason = 'manual') {
    if (this.autoPaused || !this.connected) return;
    this.autoPaused = true; this.pauseReason = reason; this.timerPaused = true; clearTimeout(this.idleTimer);
    this.usageOffset = this.usageSeconds || this.usageOffset || 0;
    this.status = 'Szüneteltetve';
    this.connectionLabel = 'Szünet';
    this.preferenceBadge = 'SZÜNET · Live kapcsolat lezárva';
    try { this.audioEl()?.pause(); } catch {}
    // A muted Live session can still cost money. Close the transport completely and
    // recreate it only when the learner resumes.
    this.disconnectTransport(true);
    this.notify();
  }
  async resumeFromPause() {
    if (!this.autoPaused || this.finishing || this.timeLimitReached) return;
    this.autoPaused = false; this.pauseReason = ''; this.timerPaused = true; this.muted = false;
    this.reconnecting = true; this.reconnectFailed = false; this.resumeAfterReconnect = true;
    this.preferenceBadge = 'FOLYTATÁS…';
    this.status = 'Kapcsolódás…'; this.connectionLabel = 'Újracsatlakozás…'; this.notify();
    const ok = await this.connect(true);
    if (ok) {
      const deadline = Date.now() + 9000;
      while (!this.connected && !this.finishing && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 200));
      }
    }
    if (!ok || !this.connected) {
      this.disconnectTransport(false);
      this.reconnecting = false; this.reconnectFailed = true; this.autoPaused = true; this.resumeAfterReconnect = false;
      this.preferenceBadge = 'SZÜNET';
      this.status = 'Nem sikerült folytatni'; this.connectionLabel = 'Kapcsolat nélkül'; this.notify();
      return;
    }
    this.markActivity();
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
    if (this.mode === 'situation' && this.scenario) {
      const step = this.currentSituationStep();
      const instr = pass === 1
        ? `The learner is silent in the role-play. Stay strictly in character as ${this.scenario.aiRole}. Rephrase the CURRENT step question once, slightly more simply. Do not teach, hint, change topic or advance the step. Current goal: ${step?.goal || ''}.`
        : `The learner is still silent. Stay in role and repeat the CURRENT step request one final time, briefly. Do not reveal the answer and do not advance.`;
      if (!this.oneShot(instr)) this.idleGuideCount = Math.max(0, this.idleGuideCount - 1);
      return;
    }
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
    this.clearResponseFallback(); clearTimeout(this.idleTimer); clearTimeout(this.inactivityTimer); clearTimeout(this.greetingWatch); clearTimeout(this.connectWatch); this.cancelTurnCheck(); this.stopMicMonitor();
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
      homework: [], last_exchange: transcript.slice(-4), teacher, mode, scenarioId: this.scenario?.id || null, scenarioTitle: this.scenario?.title || '', instant: true,
    };
    this.summaryLoading = true; this.phase = 'summary';
    this.hardCleanup(true);
    this.notify();
    const ctrl = new AbortController(); this.summaryAbort = ctrl; const to = setTimeout(() => ctrl.abort(), 14000);
    try {
      const r = await fetch(`${API}/session/analyze`, { method: 'POST', signal: ctrl.signal, headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ teacher, mode, scenarioId: this.scenario?.id || null, durationSeconds: duration, transcript, observedMistakes: this.situationMistakes || [], baselineVocabulary: this.baselineVocab }) }).then(readJsonResponse);
      if (seq !== this.summarySeq) return;
      this.cb.onData?.(r.state);
      this.summary = { ...r.analysis, teacher, mode, scenarioId: this.scenario?.id || null, scenarioTitle: this.scenario?.title || '', instant: false }; this.summaryLoading = false; this.notify();
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
