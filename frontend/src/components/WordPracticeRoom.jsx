import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeSpeechText, uniqueBy } from '@/lib/livo';
import { useStore } from '@/lib/store';
import { ArrowRight, Check, Ear, Gauge, HelpCircle, RotateCcw, Save, Snail, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';

const ROUND_ORDER = ['meaning', 'translation', 'dictation', 'missing', 'sound', 'pronounce'];
const SKILLS = ['meaning', 'translation', 'spelling', 'pronunciation'];

function skillForMode(mode) {
  if (mode === 'meaning') return 'meaning';
  if (mode === 'translation') return 'translation';
  if (mode === 'dictation' || mode === 'missing') return 'spelling';
  return 'pronunciation';
}

function skillLabel(skill) {
  return ({
    meaning: 'jelentés',
    translation: 'HU → EN',
    spelling: 'helyesírás',
    pronunciation: 'kiejtés',
  })[skill] || skill;
}

function mixedModeFor(word, round) {
  const mastery = word?.skillMastery;
  if (!mastery || !SKILLS.some(k => Number.isFinite(Number(mastery[k])))) {
    return ROUND_ORDER[round % ROUND_ORDER.length];
  }
  const values = SKILLS.map(k => [k, Number.isFinite(Number(mastery[k])) ? Number(mastery[k]) : 40]);
  const min = Math.min(...values.map(x => x[1]));
  const tied = values.filter(x => x[1] === min).map(x => x[0]);
  const weakest = tied[round % tied.length];
  if (weakest === 'meaning') return 'meaning';
  if (weakest === 'translation') return 'translation';
  if (weakest === 'spelling') return round % 2 ? 'missing' : 'dictation';
  return round % 2 ? 'sound' : 'pronounce';
}

const SOUND_PAIRS = [
  ['ship', 'sheep'], ['live', 'leave'], ['sit', 'seat'], ['fill', 'feel'], ['bit', 'beat'],
  ['than', 'then'], ['think', 'sink'], ['three', 'tree'], ['thought', 'taught'], ['west', 'vest'],
  ['wine', 'vine'], ['very', 'wary'], ['bat', 'bet'], ['man', 'men'], ['bad', 'bed'],
];

const norm = (v) => normalizeSpeechText(v || '').toLowerCase();

function roughSyllableText(value = '') {
  return String(value).split(/\s+/).map(word => {
    const clean = word.replace(/[^a-z'-]/gi, '');
    if (!clean) return word;
    const parts = clean.match(/[^aeiouy]*[aeiouy]+(?:[^aeiouy](?![aeiouy])|$)*/gi);
    return parts && parts.length > 1 ? parts.join(' ... ') : clean;
  }).join('   ');
}

function speakWithDeviceVoice(text, delivery, teacher, onDone) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const lang = ['maya', 'james'].includes(teacher) ? 'en-GB' : 'en-US';
  const spoken = delivery === 'syllables' ? roughSyllableText(text) : text;
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = lang;
  u.rate = delivery === 'slow' ? 0.62 : delivery === 'syllables' ? 0.48 : 0.92;
  u.pitch = 1;
  const voices = synth.getVoices();
  u.voice = voices.find(v => v.lang === lang && /Microsoft|Google/i.test(v.name))
    || voices.find(v => v.lang === lang)
    || voices.find(v => v.lang?.startsWith(lang.slice(0, 2)))
    || null;
  u.onend = onDone;
  u.onerror = onDone;
  synth.speak(u);
  return true;
}

function maskWord(term = '') {
  const chars = [...term];
  const letters = chars.map((c, i) => /[a-z]/i.test(c) ? i : -1).filter(i => i >= 0);
  const hidden = new Set(letters.filter((_, i) => i % 3 === 1 || (letters.length > 5 && i % 4 === 0)));
  if (!hidden.size && letters.length) hidden.add(letters[Math.floor(letters.length / 2)]);
  return chars.map((c, i) => hidden.has(i) ? '_' : c).join(' ');
}

function soundOptions(term, pool) {
  const t = norm(term);
  const known = SOUND_PAIRS.find(p => p.includes(t));
  const distractors = [];
  if (known) distractors.push(...known.filter(x => x !== t));

  const transforms = [
    [/(^|[^s])th/i, '$1t'], [/^w/i, 'v'], [/^v/i, 'w'],
    [/ee/i, 'i'], [/i/i, 'ee'], [/a/i, 'e'], [/e/i, 'a'],
  ];
  transforms.forEach(([rx, rep]) => {
    const v = term.replace(rx, rep);
    if (norm(v) !== t && /^[a-z][a-z' -]*$/i.test(v)) distractors.push(v);
  });

  pool.forEach(w => {
    const candidate = normalizeSpeechText(w.term || '');
    if (candidate && norm(candidate) !== t && Math.abs(candidate.length - term.length) <= 2) distractors.push(candidate);
  });

  return [...new Set([term, ...distractors])].slice(0, 4).sort(() => Math.random() - 0.5);
}

function meaningOptions(target, pool) {
  if (!target) return [];
  const answer = normalizeSpeechText(target.meaning || '');
  const distractors = pool
    .filter(w => w !== target && norm(w.meaning) !== norm(answer))
    .map(w => normalizeSpeechText(w.meaning || ''))
    .filter(Boolean);
  return [...new Set([answer, ...distractors])]
    .slice(0, 4)
    .sort(() => Math.random() - 0.5);
}

export function WordPracticeRoom({ pack = [], config = {}, onClose }) {
  const { data, saveVocabulary, setData } = useStore();
  const words = useMemo(() => uniqueBy(
    (pack || []).filter(w => normalizeSpeechText(w.term || '') && normalizeSpeechText(w.meaning || '')),
    w => norm(w.term)
  ).slice(0, config.count || 10), [pack, config.count]);

  const [round, setRound] = useState(0);
  const [answer, setAnswer] = useState('');
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, hard: 0 });
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const audioRef = useRef(null);

  const target = words[round];
  const mode = config.mode === 'mixed' ? mixedModeFor(target, round) : (config.mode || 'dictation');
  const options = useMemo(() => target ? soundOptions(target.term, words) : [], [target, words]);
  const meanings = useMemo(() => meaningOptions(target, words), [target, words]);

  const teacher = data?.profile?.teacher || 'maya';

  const speak = async (delivery = 'normal') => {
    if (!target?.term) return;
    try { audioRef.current?.pause(); } catch {}
    setPlaying(true);

    // Default: device/browser English voice. Zero API calls and zero LLM/TTS cost.
    if (speakWithDeviceVoice(target.term, delivery, teacher, () => setPlaying(false))) return;

    // Legacy fallback for browsers without Web Speech support.
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/pronounce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: target.term, teacher, delivery }),
      });
      if (!r.ok) throw new Error('pronounce failed');
      const blob = await r.blob();
      audioRef.current = new Audio(URL.createObjectURL(blob));
      audioRef.current.onended = () => setPlaying(false);
      audioRef.current.onerror = () => setPlaying(false);
      await audioRef.current.play();
    } catch {
      setPlaying(false);
      toast.error('Most nem sikerült lejátszani a szót.');
    }
  };

  useEffect(() => {
    try { audioRef.current?.pause(); } catch {}
    setPlaying(false);
    setAnswer('');
    setLocked(false);
    setFeedback(null);
    if (!target) { setDone(true); return; }
    const id = ['meaning', 'translation'].includes(mode) ? null : setTimeout(() => speak('normal'), 220);
    return () => { if (id) clearTimeout(id); try { audioRef.current?.pause(); } catch {} try { window.speechSynthesis?.cancel(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, mode]);

  const persistResult = async (outcome) => {
    if (!target) return;
    let isSaved = (data?.vocabulary || []).some(v => norm(v.term) === norm(target.term));

    if (!isSaved && outcome !== 'correct' && config.autoSaveMistakes) {
      const saved = await saveVocabulary({
        term: target.term,
        meaning: target.meaning,
        example: target.example || '',
        dictionaryId: target.dictionaryId,
        source: target.dictionaryId ? 'dictionary_practice_mistake' : 'word_practice_mistake',
      }, { quiet: true });
      if (saved) {
        isSaved = true;
        toast(`Nehéz szó elmentve: ${target.term}`);
      }
    }

    if (isSaved || target.dictionaryId) {
      try {
        const r = await api('/game/result', {
          method: 'POST',
          body: JSON.stringify({
            term: target.term,
            dictionaryId: target.dictionaryId || '',
            outcome,
            game: `word_practice_${mode}`,
            skill: skillForMode(mode),
          }),
        });
        if (r?.state) setData(r.state);
      } catch { /* practice must keep moving even if progress sync fails */ }
    }
  };

  const finishRound = async (ok, text, outcome = ok ? 'correct' : 'wrong') => {
    if (locked) return;
    setLocked(true);
    setFeedback({ ok, text });
    setStats(s => ({ ...s, correct: s.correct + (ok ? 1 : 0), wrong: s.wrong + (ok ? 0 : 1), hard: s.hard + (outcome === 'dont_know' ? 1 : 0) }));
    await persistResult(outcome);
  };

  const submitTyped = () => {
    if (!target || !answer.trim()) return;
    const ok = norm(answer) === norm(target.term);
    finishRound(ok, ok ? 'Helyes.' : `A helyes írásmód: ${target.term}`);
  };

  const chooseMeaning = (o) => {
    if (!target) return;
    const ok = norm(o) === norm(target.meaning);
    finishRound(ok, ok ? 'Helyes.' : `${target.term} = ${target.meaning}`);
  };

  const chooseSound = (o) => {
    if (!target) return;
    const ok = norm(o) === norm(target.term);
    finishRound(ok, ok ? 'Helyes.' : `Ezt hallottad: ${target.term}`);
  };

  const markPronunciation = (easy) => {
    finishRound(easy, easy ? 'Megy. Jöhet a következő.' : `Tedd a nehéz szavak közé: ${target.term}`, easy ? 'correct' : 'dont_know');
  };

  const next = () => {
    if (round + 1 >= words.length) { setDone(true); return; }
    setRound(r => r + 1);
  };

  if (!words.length) return null;

  return (
    <div className="absolute inset-0 z-[60] bg-[#0B1120] text-white flex flex-col" data-testid="word-practice-room">
      <header className="flex items-center justify-between px-5 pt-5 pb-3">
        <button onClick={onClose} className="h-9 w-9 rounded-full bg-white/10 grid place-items-center"><X size={18} /></button>
        <div className="text-center">
          <div className="text-[10px] tracking-[0.2em] text-slate-400">SZÓGYAKORLÓ</div>
          <b className="font-heading">{labelMode(mode)}</b>
        </div>
        <div className="text-xs text-slate-400">{Math.min(round + 1, words.length)} / {words.length}</div>
      </header>

      <div className="px-5">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${((round + (done ? 1 : 0)) / words.length) * 100}%` }} />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto livo-scroll px-5 py-5">
        {done ? (
          <Finish stats={stats} total={words.length} onAgain={() => { setRound(0); setDone(false); setStats({ correct: 0, wrong: 0, hard: 0 }); }} onClose={onClose} />
        ) : (
          <>
            <section className="rounded-[1.75rem] bg-white/[0.06] ring-1 ring-white/10 p-6 text-center shadow-card">
              <div className="text-[10px] tracking-[0.28em] font-extrabold text-brand-ring">FELADAT</div>
              <h2 className="font-heading font-extrabold text-2xl mt-2">{taskTitle(mode)}</h2>
              <p className="text-sm text-slate-400 mt-1">{taskSubtitle(mode)}</p>
              {config.mode === 'mixed' && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-[10px] font-extrabold text-amber-200">
                  🔥 ADAPTÍV · {skillLabel(skillForMode(mode)).toUpperCase()}
                  {target?.skillMastery?.[skillForMode(mode)] != null && <> · {target.skillMastery[skillForMode(mode)]}%</>}
                </div>
              )}

              {mode === 'meaning' && (
                <div className="mt-6">
                  <div className="text-4xl font-heading font-extrabold">{target.term}</div>
                  <div className="grid grid-cols-1 gap-2 mt-5">
                    {meanings.map(o => (
                      <button key={o} disabled={locked} onClick={() => chooseMeaning(o)} className="rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3 text-sm font-semibold active:scale-[.98] disabled:opacity-60">{o}</button>
                    ))}
                  </div>
                </div>
              )}

              {mode === 'translation' && (
                <div className="mt-6">
                  <div className="text-3xl font-heading font-extrabold">{target.meaning}</div>
                  <input
                    data-testid="translation-input"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitTyped()}
                    disabled={locked}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Írd le angolul"
                    className="mt-5 w-full rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3.5 text-center text-lg font-semibold outline-none focus:ring-brand"
                  />
                </div>
              )}

              {mode === 'pronounce' && (
                <div className="mt-6">
                  <div className="text-4xl font-heading font-extrabold">{target.term}</div>
                  <div className="text-sm text-slate-400 mt-1">{target.meaning}</div>
                </div>
              )}

              {mode === 'dictation' && (
                <div className="mt-6">
                  <div className="h-16 w-16 mx-auto rounded-full bg-brand/20 text-brand-ring grid place-items-center"><Ear size={28} /></div>
                  <input
                    data-testid="dictation-input"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitTyped()}
                    disabled={locked}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Írd le, amit hallottál"
                    className="mt-5 w-full rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3.5 text-center text-lg font-semibold outline-none focus:ring-brand"
                  />
                </div>
              )}

              {mode === 'missing' && (
                <div className="mt-6">
                  <div className="font-mono text-2xl tracking-[0.18em] text-white">{maskWord(target.term)}</div>
                  <div className="text-sm text-slate-400 mt-2">{target.meaning}</div>
                  <input
                    data-testid="missing-input"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitTyped()}
                    disabled={locked}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="Írd be a teljes szót"
                    className="mt-5 w-full rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3.5 text-center text-lg font-semibold outline-none focus:ring-brand"
                  />
                </div>
              )}

              {mode === 'sound' && (
                <div className="mt-6">
                  <div className="h-16 w-16 mx-auto rounded-full bg-brand/20 text-brand-ring grid place-items-center"><Ear size={28} /></div>
                  <div className="grid grid-cols-2 gap-2 mt-5">
                    {options.map(o => (
                      <button key={o} disabled={locked} onClick={() => chooseSound(o)} className="rounded-2xl bg-white/10 ring-1 ring-white/10 px-3 py-3 text-sm font-semibold active:scale-[.98] disabled:opacity-60">{o}</button>
                    ))}
                  </div>
                </div>
              )}

              {!['meaning', 'translation'].includes(mode) && (
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={() => speak('normal')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Volume2 size={16} /> Mondd újra</button>
                  <button onClick={() => speak('slow')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Snail size={16} /> Lassabban</button>
                  <button onClick={() => speak('syllables')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Gauge size={16} /> Szótagolva</button>
                  <button onClick={() => speak('word_only')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Volume2 size={16} /> Csak a szót</button>
                </div>
              )}

              {mode === 'pronounce' && !locked && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button onClick={() => markPronunciation(false)} className="rounded-2xl bg-amber-500/15 text-amber-200 px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"><HelpCircle size={16} /> Nehéz</button>
                  <button onClick={() => markPronunciation(true)} className="rounded-2xl bg-emerald-500/15 text-emerald-200 px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"><Check size={16} /> Megy</button>
                </div>
              )}

              {(mode === 'translation' || mode === 'dictation' || mode === 'missing') && !locked && (
                <button onClick={submitTyped} disabled={!answer.trim()} className="mt-4 w-full rounded-2xl bg-brand py-3 text-sm font-bold disabled:opacity-40">Ellenőrzés</button>
              )}

              {feedback && (
                <div className={`mt-4 rounded-2xl px-4 py-3 text-sm font-semibold ${feedback.ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-rose-500/15 text-rose-200'}`}>
                  {feedback.text}
                </div>
              )}

              {locked && (
                <button onClick={next} className="mt-4 w-full rounded-2xl bg-white text-slate-900 py-3 text-sm font-bold inline-flex items-center justify-center gap-2">
                  Következő <ArrowRight size={16} />
                </button>
              )}
            </section>

            <section className="mt-4 rounded-2xl bg-white/[0.04] ring-1 ring-white/10 p-4">
              <div className="text-[10px] tracking-widest text-slate-500 font-bold">AKTUÁLIS SZÓ</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <b className="text-sm block truncate">{locked || ['meaning', 'pronounce', 'missing'].includes(mode) ? target.term : '••••••'}</b>
                  <span className="text-xs text-slate-500">{locked ? target.meaning : 'A megoldást csak válasz után mutatjuk.'}</span>
                  {target?.skillMastery && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {SKILLS.map(skill => (
                        <span key={skill} className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] text-slate-500">
                          {skillLabel(skill)} {target.skillMastery[skill] ?? 40}%
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {locked && <Save size={16} className="text-slate-500" />}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function labelMode(mode) {
  return ({
    meaning: 'Jelentés',
    translation: 'Magyar → angol',
    pronounce: 'Kiejtés',
    dictation: 'Hallás utáni írás',
    missing: 'Hiányzó betűk',
    sound: 'Hangzás megkülönböztetés',
  })[mode] || 'Vegyes';
}

function taskTitle(mode) {
  return ({
    meaning: 'Mit jelent?',
    translation: 'Hogy mondják angolul?',
    pronounce: 'Mondd ki utánam',
    dictation: 'Írd le, amit hallasz',
    missing: 'Egészítsd ki a szót',
    sound: 'Melyik szót hallottad?',
  })[mode] || 'Gyakorolj';
}

function taskSubtitle(mode) {
  return ({
    meaning: 'Válaszd ki a magyar jelentést.',
    translation: 'Írd be az angol szót a magyar jelentés alapján.',
    pronounce: 'Hallgasd meg tisztán, majd ismételd el.',
    dictation: 'A szó nincs kiírva. Csak a hang alapján dolgozz.',
    missing: 'A jelentés segít, de az írásmódot neked kell tudnod.',
    sound: 'Figyelj a hasonló hangokra: th, w/v, i/ee, a/e.',
  })[mode] || '';
}

function Finish({ stats, total, onAgain, onClose }) {
  const pct = total ? Math.round((stats.correct / total) * 100) : 0;
  return (
    <div className="text-center py-8">
      <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/15 text-emerald-300 grid place-items-center"><Check size={38} /></div>
      <h2 className="font-heading font-extrabold text-2xl mt-4">Kör kész.</h2>
      <p className="text-sm text-slate-400 mt-1">{stats.correct} jó · {stats.wrong} hibás · {stats.hard} nehéz</p>
      <div className="font-heading font-extrabold text-4xl mt-5">{pct}%</div>
      <div className="flex gap-3 justify-center mt-6">
        <button onClick={onClose} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold">Vissza</button>
        <button onClick={onAgain} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2"><RotateCcw size={14} /> Új kör</button>
      </div>
    </div>
  );
}
