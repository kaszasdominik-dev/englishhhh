import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { normalizeSpeechText, uniqueBy } from '@/lib/livo';
import { useStore } from '@/lib/store';
import { ArrowRight, Check, Ear, Gauge, HelpCircle, RotateCcw, Save, Snail, Volume2, X } from 'lucide-react';
import { toast } from 'sonner';

const ROUND_ORDER = ['pronounce', 'dictation', 'missing', 'sound'];

const SOUND_PAIRS = [
  ['ship', 'sheep'], ['live', 'leave'], ['sit', 'seat'], ['fill', 'feel'], ['bit', 'beat'],
  ['there', 'their'], ['than', 'then'], ['think', 'sink'], ['three', 'tree'], ['west', 'vest'],
  ['wine', 'vine'], ['very', 'wary'], ['bat', 'bet'], ['man', 'men'], ['bad', 'bed'],
];

const norm = (v) => normalizeSpeechText(v || '').toLowerCase();

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
    [/ee/i, 'i'], [/i/i, 'ee'], [/a/i, 'e'], [/e/i, 'a'],
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
  const mode = config.mode === 'mixed' ? ROUND_ORDER[round % ROUND_ORDER.length] : (config.mode || 'dictation');
  const options = useMemo(() => target ? soundOptions(target.term, words) : [], [target, words]);

  const teacher = data?.profile?.teacher || 'maya';

  const speak = async (delivery = 'normal') => {
    if (!target?.term || playing) return;
    setPlaying(true);
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/pronounce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: target.term, teacher, delivery }),
      });
      if (!r.ok) throw new Error('pronounce failed');
      const blob = await r.blob();
      try { audioRef.current?.pause(); } catch {}
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
    setAnswer('');
    setLocked(false);
    setFeedback(null);
    if (!target) { setDone(true); return; }
    const id = setTimeout(() => speak('normal'), 220);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const persistResult = async (outcome) => {
    if (!target) return;
    const isSaved = (data?.vocabulary || []).some(v => norm(v.term) === norm(target.term));
    if (!isSaved && outcome !== 'correct' && config.autoSaveMistakes) {
      const saved = await saveVocabulary({
        term: target.term,
        meaning: target.meaning,
        example: target.example || '',
        source: 'word_practice_mistake',
      }, { quiet: true });
      if (saved) toast(`Nehéz szó elmentve: ${target.term}`);
      return;
    }
    if (isSaved) {
      try {
        const r = await api('/game/result', {
          method: 'POST',
          body: JSON.stringify({ term: target.term, outcome, game: `word_practice_${mode}` }),
        });
        if (r?.state) setData(r.state);
      } catch { /* non-blocking */ }
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

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button onClick={() => speak('normal')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Volume2 size={16} /> Mondd újra</button>
                <button onClick={() => speak('slow')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Snail size={16} /> Lassabban</button>
                <button onClick={() => speak('syllables')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Gauge size={16} /> Szótagolva</button>
                <button onClick={() => speak('word_only')} disabled={playing} className="rounded-2xl bg-white/10 px-3 py-3 text-sm font-semibold inline-flex justify-center items-center gap-2"><Volume2 size={16} /> Csak a szót</button>
              </div>

              {mode === 'pronounce' && !locked && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button onClick={() => markPronunciation(false)} className="rounded-2xl bg-amber-500/15 text-amber-200 px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"><HelpCircle size={16} /> Nehéz</button>
                  <button onClick={() => markPronunciation(true)} className="rounded-2xl bg-emerald-500/15 text-emerald-200 px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"><Check size={16} /> Megy</button>
                </div>
              )}

              {(mode === 'dictation' || mode === 'missing') && !locked && (
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
                  <b className="text-sm block truncate">{locked || mode === 'pronounce' || mode === 'missing' ? target.term : '••••••'}</b>
                  <span className="text-xs text-slate-500">{locked ? target.meaning : 'A megoldást csak válasz után mutatjuk.'}</span>
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
    pronounce: 'Kiejtés',
    dictation: 'Hallás utáni írás',
    missing: 'Hiányzó betűk',
    sound: 'Hangzás megkülönböztetés',
  })[mode] || 'Vegyes';
}

function taskTitle(mode) {
  return ({
    pronounce: 'Mondd ki utánam',
    dictation: 'Írd le, amit hallasz',
    missing: 'Egészítsd ki a szót',
    sound: 'Melyik szót hallottad?',
  })[mode] || 'Gyakorolj';
}

function taskSubtitle(mode) {
  return ({
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
