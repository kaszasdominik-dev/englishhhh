// Deterministic state-machine reproduction of the multi-turn Live audio bug.
// Loads the REAL LiveEngine from a path given via LIVE_ENGINE env, stubs the browser
// globals it touches, and replays the exact OpenAI Live DataChannel event sequence,
// including a server-VAD speech_started that fires WHILE the tutor is speaking (the
// real-world speaker->mic echo case). Asserts whether the remote <audio> stays audible.

const ENGINE_PATH = process.env.LIVE_ENGINE;

// ---- mock remote <audio id="livo-remote-audio"> ----
const audio = {
  id: 'livo-remote-audio', paused: true, muted: false, volume: 1,
  autoplay: false, playsInline: false, srcObject: null,
  play() { this.paused = false; return Promise.resolve(); },
  pause() { this.paused = true; },
  addEventListener() {}, removeEventListener() {},
};

// ---- global stubs ----
global.document = { getElementById: (id) => (id === 'livo-remote-audio' ? audio : null) };
global.window = global;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.navigator = { mediaDevices: {} };
global.MediaStream = class { constructor() {} addTrack() {} getAudioTracks() { return [{ enabled: true, stop() {}, readyState: 'live' }]; } getTracks() { return this.getAudioTracks(); } };
global.RTCPeerConnection = class {};
global.AudioContext = class { constructor() { this.state = 'running'; } createMediaStreamSource() { return { connect() {} }; } createAnalyser() { return { fftSize: 512, getByteTimeDomainData() {} }; } createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: {} }; } createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; } resume() { return Promise.resolve(); } close() {} };
global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

const { LiveEngine } = await import(ENGINE_PATH);

const engine = new LiveEngine({ getVocab: () => [], saveVocab: async () => null, onFinished: () => {} });
// put the engine into a live, connected state with an open data channel
engine.connected = true;
engine.phase = 'live';
engine.dc = { readyState: 'open', send: () => true };
engine.remoteStream = new MediaStream();
engine.greetingPhase = 'done';
engine.greetingRequested = true;
audio.paused = false; // pc.ontrack already started playback for the greeting

const fire = (obj) => engine.handleEvent({ data: JSON.stringify(obj) });
const log = [];
const snap = (label) => { log.push({ step: label, paused: audio.paused, muted: audio.muted, vol: audio.volume, userSpeaking: engine.userSpeaking, serverSpeechActive: engine.serverSpeechActive, assistantSpeaking: engine.assistantSpeaking }); };

// ---------------- TURN 1: tutor greeting ----------------
fire({ type: 'session.output_transcript.delta', delta: 'Szia Dominik! James vagyok.', item_id: 'a1' });
fire({ type: 'response.done' });
snap('after greeting');

// ---------------- learner answers (turn 1) ----------------
fire({ type: 'input_audio_buffer.speech_started' });
fire({ type: 'session.input_transcript.delta', delta: 'hi, i want business english', item_id: 'u1' });
fire({ type: 'input_audio_buffer.speech_stopped' });
snap('after learner turn 1');

// ---------------- TURN 2: tutor responds; speaker echo trips server VAD mid-speech ----------------
fire({ type: 'session.output_transcript.delta', delta: 'Ez ', item_id: 'a2' });
snap('tutor turn2 begins (audio should be playing)');
// >>> ECHO: tutor voice leaks from speaker into mic -> server VAD emits speech_started
fire({ type: 'input_audio_buffer.speech_started' });
snap('ECHO speech_started fired mid tutor-turn');
// tutor keeps streaming its answer
fire({ type: 'session.output_transcript.delta', delta: 'nagyon jó alap. Mondj egy példát.', item_id: 'a2' });
snap('tutor turn2 continues (MUST be audible here)');
fire({ type: 'response.done' });
snap('after tutor turn 2');

// ---------------- learner answers (turn 2) ----------------
fire({ type: 'input_audio_buffer.speech_started' });
fire({ type: 'session.input_transcript.delta', delta: 'i work in marketing', item_id: 'u2' });
fire({ type: 'input_audio_buffer.speech_stopped' });
snap('after learner turn 2');

// ---------------- TURN 3: tutor responds again (echo again) ----------------
fire({ type: 'session.output_transcript.delta', delta: 'Szuper! ', item_id: 'a3' });
fire({ type: 'input_audio_buffer.speech_started' }); // echo again
fire({ type: 'session.output_transcript.delta', delta: 'Hogy halad a projekt?', item_id: 'a3' });
snap('tutor turn3 continues (MUST be audible here)');
fire({ type: 'response.done' });
snap('after tutor turn 3');

console.log(JSON.stringify(log, null, 1));

// verdict: during any tutor turn the audio element must NOT be paused
const badTurns = log.filter(l => /MUST be audible|tutor turn2 begins/.test(l.step) && l.paused === true);
console.log('\nVERDICT:', badTurns.length === 0 ? 'PASS - tutor audio stays audible on every turn' : `FAIL - tutor SILENT (paused) during: ${badTurns.map(b=>b.step).join(' | ')}`);
process.exit(badTurns.length === 0 ? 0 : 1);
