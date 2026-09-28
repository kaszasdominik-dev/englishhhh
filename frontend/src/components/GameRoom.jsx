import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { shuffle, uniqueBy, normalizeSpeechText } from '@/lib/livo';
import { X, Heart, ArrowRight, Loader2, RotateCcw, Plus, Check } from 'lucide-react';
import { toast } from 'sonner';

const GAMES = [['swipe', 'Swipe'], ['image', 'Kép'], ['quick', 'Gyors'], ['match', 'Párosító'], ['memory', 'Memory']];

export function GameRoom({ pack, topic, onClose, initialGame = 'quick' }) {
  const { saveVocabulary, data } = useStore();
  const words = useMemo(() => uniqueBy((pack || []).filter(v => normalizeSpeechText(v.term || '') && normalizeSpeechText(v.meaning || '')), v => v.term.toLowerCase()), [pack]);
  const [game, setGame] = useState(initialGame);
  const [hearts, setHearts] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(null); // null | true | false
  const [feedback, setFeedback] = useState(null);

  const savedSet = useMemo(() => new Set((data?.vocabulary || []).map(v => normalizeSpeechText(v.term || '').toLowerCase())), [data]);

  const reset = (g) => { setGame(g); setHearts(3); setScore(0); setStreak(0); setRound(0); setDone(null); setFeedback(null); };
  useEffect(() => { reset(initialGame); /* eslint-disable-next-line */ }, [initialGame, pack]);

  const total = useMemo(() => {
    if (game === 'match') return Math.min(6, words.length);
    if (game === 'memory') return Math.min(6, words.length);
    if (game === 'image') return Math.min(8, words.filter(imageable).length);
    return Math.min(10, words.length);
  }, [game, words]);

  const correct = () => { setScore(s => s + 100 + Math.min(50, streak * 10)); setStreak(s => s + 1); };
  const wrong = () => { setStreak(0); setHearts(h => { const n = h - 1; if (n <= 0) setTimeout(() => setDone(false), 700); return n; }); };
  const save = async (w) => {
    if (savedSet.has(normalizeSpeechText(w.term).toLowerCase())) { toast('Már elmentve.'); return; }
    const r = await saveVocabulary({ term: w.term, meaning: w.meaning, example: w.example || '', source: 'game' }, { quiet: true });
    if (r) toast.success(`${w.term} elmentve.`);
  };

  if (words.length < 4) return null;

  return (
    <div className="absolute inset-0 z-[55] bg-[#0B1120] text-white flex flex-col" data-testid="game-room">
      <header className="flex items-center justify-between px-5 pt-5 pb-2">
        <button data-testid="game-close" onClick={onClose} className="h-9 w-9 grid place-items-center rounded-full bg-white/10"><X size={18} /></button>
        <div className="text-center"><div className="text-[10px] tracking-widest text-slate-400">LIVO PLAY · {(topic || 'RANDOM').toUpperCase()}</div><b className="font-heading">{GAMES.find(g => g[0] === game)?.[1]}</b></div>
        <div className="text-right"><div className="flex items-center gap-0.5 justify-end">{[0, 1, 2].map(i => <Heart key={i} size={15} className={i < hearts ? 'text-rose-400 fill-rose-400' : 'text-white/20'} />)}</div><div className="text-xs text-slate-400 mt-0.5">{score} pont</div></div>
      </header>
      <div className="px-5"><div className="flex gap-1.5 overflow-x-auto livo-scroll pb-2">{GAMES.map(([id, l]) => <button key={id} onClick={() => reset(id)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${game === id ? 'bg-brand text-white' : 'bg-white/10 text-slate-300'}`}>{l}</button>)}</div></div>
      <div className="px-5"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.min(100, round / Math.max(1, total) * 100)}%` }} /></div>
        <div className="flex justify-between text-[11px] text-slate-400 mt-1.5"><span>{Math.min(round + 1, total)} / {total}</span><span>{streak ? `${streak} sorozat` : 'első kör'}</span></div>
      </div>

      <div className="flex-1 overflow-y-auto livo-scroll px-5 py-4">
        {done !== null ? (
          <Finish done={done} score={score} streak={streak} hearts={hearts} onAgain={() => reset(game)} onClose={onClose} topic={topic} />
        ) : (
          <>
            {game === 'quick' && <Quick words={words} round={round} setRound={setRound} correct={correct} wrong={wrong} hearts={hearts} total={total} setDone={setDone} feedback={feedback} setFeedback={setFeedback} onSave={save} savedSet={savedSet} />}
            {game === 'swipe' && <Swipe words={words} round={round} setRound={setRound} correct={correct} wrong={wrong} hearts={hearts} total={total} setDone={setDone} feedback={feedback} setFeedback={setFeedback} onSave={save} savedSet={savedSet} />}
            {game === 'match' && <Match words={words} total={total} correct={correct} wrong={wrong} setDone={setDone} hearts={hearts} onSave={save} savedSet={savedSet} />}
            {game === 'memory' && <Memory words={words} total={total} correct={correct} wrong={wrong} setDone={setDone} hearts={hearts} onSave={save} savedSet={savedSet} />}
            {game === 'image' && <ImageGame words={words} round={round} setRound={setRound} correct={correct} wrong={wrong} hearts={hearts} total={total} setDone={setDone} feedback={feedback} setFeedback={setFeedback} />}
          </>
        )}
        {feedback && done === null && <div className={`mt-4 text-center text-sm font-semibold ${feedback.kind === 'good' ? 'text-emerald-400' : 'text-rose-400'}`}>{feedback.text}</div>}
      </div>
    </div>
  );
}

const imageable = (v) => v.imageable === true && (v.imageQuery || v.term) && ['noun', 'verb'].includes(v.partOfSpeech) && Array.isArray(v.imageTerms) && v.imageTerms.length;
const norm = (x) => normalizeSpeechText(x).toLowerCase();
function optionSet(target, field, pool, count = 4) {
  const answer = normalizeSpeechText(target[field]);
  const d = shuffle(pool.filter(v => v !== target && normalizeSpeechText(v[field]) && norm(v[field]) !== norm(answer))).slice(0, count - 1).map(v => normalizeSpeechText(v[field]));
  return shuffle([answer, ...d]);
}
function SaveChip({ w, savedSet, onSave }) {
  const saved = savedSet.has(norm(w.term));
  return <button onClick={() => onSave(w)} className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${saved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/15 text-white'}`}>{saved ? '✓' : <Plus size={10} />}</button>;
}

function Quick({ words, round, setRound, correct, wrong, hearts, total, setDone, setFeedback, onSave, savedSet }) {
  const pool = useMemo(() => shuffle(words).slice(0, total), [words, total]);
  const [locked, setLocked] = useState(false);
  const [picked, setPicked] = useState(null);
  const enToHu = useMemo(() => Math.random() > 0.5, [round]);
  const target = pool[round];
  const field = enToHu ? 'meaning' : 'term';
  const opts = useMemo(() => (target ? optionSet(target, field, words) : []), [round, target, field, words]);
  useEffect(() => { setLocked(false); setPicked(null); }, [round]);
  useEffect(() => { if (round >= total || round >= pool.length) { const id = setTimeout(() => setDone(true), 0); return () => clearTimeout(id); } }, [round, total, pool.length, setDone]);
  if (!target) return null;
  const choose = (o) => {
    if (locked) return; setLocked(true); setPicked(o);
    const ok = norm(o) === norm(target[field]);
    if (ok) { correct(); setFeedback({ kind: 'good', text: `Igen · ${target.term} = ${target.meaning}` }); } else { wrong(); setFeedback({ kind: 'bad', text: `Nem · ${target.term} = ${target.meaning}` }); }
    setTimeout(() => { if (hearts > 0 || ok) setRound(r => r + 1); }, 800);
  };
  return (
    <div>
      <div className="text-center mb-5"><small className="text-slate-400 text-xs">{enToHu ? 'Válaszd ki a jelentését' : 'Melyik angol szó illik ide?'}</small>
        <h3 className="font-heading font-extrabold text-3xl mt-2 inline-flex items-center">{enToHu ? target.term : target.meaning}{enToHu && <SaveChip w={target} savedSet={savedSet} onSave={onSave} />}</h3></div>
      <div className="space-y-2">
        {opts.map((o, i) => {
          const right = norm(o) === norm(target[field]);
          const cls = locked ? (right ? 'bg-emerald-500/20 ring-emerald-400' : o === picked ? 'bg-rose-500/20 ring-rose-400' : 'bg-white/5 ring-white/10') : 'bg-white/5 ring-white/10';
          return <button key={i} data-testid="quick-option" disabled={locked} onClick={() => choose(o)} className={`w-full flex items-center justify-between rounded-2xl px-4 py-3.5 ring-1 text-left ${cls} active:scale-[.98] transition-transform`}><span className="font-medium">{o}</span><ArrowRight size={16} className="text-slate-500" /></button>;
        })}
      </div>
    </div>
  );
}

function Swipe({ words, round, setRound, correct, wrong, hearts, total, setDone, setFeedback }) {
  const pool = useMemo(() => shuffle(words).slice(0, total), [words, total]);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-180, 180], [-16, 16]);
  const leftGlow = useTransform(x, [-120, -25], [1, 0]);
  const rightGlow = useTransform(x, [25, 120], [0, 1]);
  const [result, setResult] = useState(null);
  const [locked, setLocked] = useState(false);
  const target = pool[round];
  const wrongW = useMemo(() => (target ? shuffle(words.filter(w => w !== target && norm(w.meaning) !== norm(target.meaning)))[0] : null), [round, target, words]);
  const choices = useMemo(() => shuffle([{ v: target?.meaning, ok: true }, { v: wrongW?.meaning || '—', ok: false }]), [round, target, wrongW]);
  useEffect(() => { x.set(0); setResult(null); setLocked(false); }, [round, x]);
  useEffect(() => { if (round >= total || round >= pool.length) { const id = setTimeout(() => setDone(true), 0); return () => clearTimeout(id); } }, [round, total, pool.length, setDone]);
  if (!target) return null;
  const commit = (side) => {
    if (locked) return; setLocked(true);
    const ok = choices[side === 'left' ? 0 : 1].ok;
    setResult(ok ? 'good' : 'bad');
    animate(x, side === 'left' ? -260 : 260, { duration: 0.28, ease: 'easeIn' });
    if (ok) { correct(); setFeedback({ kind: 'good', text: `✓ ${target.term} = ${target.meaning}` }); } else { wrong(); setFeedback({ kind: 'bad', text: `✕ ${target.term} = ${target.meaning}` }); }
    setTimeout(() => { if (hearts > 0 || ok) setRound(r => r + 1); }, 620);
  };
  const onDragEnd = (e, info) => {
    if (locked) return;
    if (info.offset.x < -85 || info.velocity.x < -450) commit('left');
    else if (info.offset.x > 85 || info.velocity.x > 450) commit('right');
    else animate(x, 0, { type: 'spring', stiffness: 500, damping: 32 });
  };
  return (
    <div>
      <div className="text-center mb-4"><small className="text-slate-400 text-xs">HÚZD A KÁRTYÁT A JÓ JELENTÉS FELÉ</small><b className="block mt-1">Melyik jelentés tartozik hozzá?</b></div>
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <button onClick={() => commit('left')} className="w-full h-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 text-center grid place-items-center min-h-[92px]"><strong className="text-sm">{choices[0].v}</strong></button>
          <motion.div style={{ opacity: leftGlow }} className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand bg-brand/15" />
        </div>
        <motion.div key={round} drag="x" style={{ x, rotate }} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} dragMomentum={false} onDragEnd={onDragEnd} whileTap={{ scale: 1.03 }}
          className="relative w-32 shrink-0 rounded-2xl bg-gradient-to-br from-brand to-indigo-400 p-4 grid place-items-center text-center cursor-grab active:cursor-grabbing shadow-card touch-none select-none">
          <div><span className="text-[10px] text-white/70">EN</span><h3 className="font-heading font-extrabold text-xl mt-1 leading-tight">{target.term}</h3><span className="text-[11px] text-white/70">{target.partOfSpeech || 'word'}</span></div>
          <AnimatePresence>
            {result && (
              <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 rounded-2xl grid place-items-center ${result === 'good' ? 'bg-emerald-500/85' : 'bg-rose-500/85'}`}>
                {result === 'good' ? <Check size={44} strokeWidth={3} className="text-white" /> : <X size={44} strokeWidth={3} className="text-white" />}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        <div className="relative flex-1">
          <button onClick={() => commit('right')} className="w-full h-full rounded-2xl bg-white/5 ring-1 ring-white/10 p-3 text-center grid place-items-center min-h-[92px]"><strong className="text-sm">{choices[1].v}</strong></button>
          <motion.div style={{ opacity: rightGlow }} className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand bg-brand/15" />
        </div>
      </div>
      <p className="text-center text-[11px] text-slate-500 mt-3">Húzd gyorsan balra vagy jobbra · vagy koppints a jelentésre</p>
    </div>
  );
}

function Match({ words, total, correct, wrong, setDone, hearts, onSave, savedSet }) {
  const pool = useMemo(() => shuffle(words).slice(0, total), [words, total]);
  const left = useMemo(() => shuffle(pool.map((w, i) => ({ i, text: w.term }))), [pool]);
  const right = useMemo(() => shuffle(pool.map((w, i) => ({ i, text: w.meaning }))), [pool]);
  const [selL, setSelL] = useState(null); const [selR, setSelR] = useState(null);
  const [matched, setMatched] = useState(new Set()); const [bad, setBad] = useState(null);
  useEffect(() => { if (matched.size >= total && total > 0) setTimeout(() => setDone(true), 400); }, [matched, total, setDone]);
  const pick = (side, key) => {
    if (matched.has(key) && side === 'left') return;
    if (side === 'left') setSelL(key); else setSelR(key);
    const l = side === 'left' ? key : selL, r = side === 'right' ? key : selR;
    if (l == null || r == null) return;
    if (l === r) { correct(); setMatched(m => new Set([...m, l])); setSelL(null); setSelR(null); onSave(pool[l]); }
    else { wrong(); setBad([l, r]); setTimeout(() => { setBad(null); setSelL(null); setSelR(null); }, 500); }
  };
  return (
    <div>
      <div className="text-center mb-4"><b>{total} pár. Ennyi az egész.</b></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">{left.map(x => { const m = matched.has(x.i); return <button key={x.i} disabled={m} onClick={() => pick('left', x.i)} className={`w-full rounded-xl px-3 py-3 text-sm font-semibold ring-1 ${m ? 'bg-emerald-500/20 ring-emerald-400 opacity-60' : selL === x.i ? 'bg-brand ring-brand' : bad && bad[0] === x.i ? 'bg-rose-500/30 ring-rose-400' : 'bg-white/5 ring-white/10'}`}>{x.text}</button>; })}</div>
        <div className="space-y-2">{right.map(x => { const m = matched.has(x.i); return <button key={x.i} disabled={m} onClick={() => pick('right', x.i)} className={`w-full rounded-xl px-3 py-3 text-sm ring-1 ${m ? 'bg-emerald-500/20 ring-emerald-400 opacity-60' : selR === x.i ? 'bg-brand ring-brand' : bad && bad[1] === x.i ? 'bg-rose-500/30 ring-rose-400' : 'bg-white/5 ring-white/10'}`}>{x.text}</button>; })}</div>
      </div>
    </div>
  );
}

function Memory({ words, total, correct, wrong, setDone, onSave }) {
  const pool = useMemo(() => shuffle(words).slice(0, total), [words, total]);
  const cards = useMemo(() => shuffle(pool.flatMap((w, i) => [{ i, kind: 'en', text: w.term }, { i, kind: 'hu', text: w.meaning }])), [pool]);
  const [flipped, setFlipped] = useState([]); const [matched, setMatched] = useState(new Set()); const [lock, setLock] = useState(false);
  useEffect(() => { if (matched.size >= total && total > 0) setTimeout(() => setDone(true), 400); }, [matched, total, setDone]);
  const flip = (n) => {
    if (lock || flipped.includes(n) || matched.has(cards[n].i) && cards.filter((c, j) => c.i === cards[n].i && flipped.includes(j)).length) return;
    if (flipped.includes(n)) return;
    const nf = [...flipped, n]; setFlipped(nf);
    if (nf.length < 2) return; setLock(true);
    const [a, b] = nf;
    if (cards[a].i === cards[b].i && cards[a].kind !== cards[b].kind) { correct(); setMatched(m => new Set([...m, cards[a].i])); onSave(pool[cards[a].i]); setFlipped([]); setLock(false); }
    else { wrong(); setTimeout(() => { setFlipped([]); setLock(false); }, 650); }
  };
  return (
    <div>
      <div className="text-center mb-4"><b>{total} pár</b></div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c, n) => { const shown = flipped.includes(n) || matched.has(c.i); return (
          <button key={n} onClick={() => flip(n)} className={`aspect-square rounded-xl grid place-items-center text-xs font-semibold p-1 text-center transition-colors ${shown ? (matched.has(c.i) ? 'bg-emerald-500/20 ring-1 ring-emerald-400' : 'bg-brand') : 'bg-white/10'}`}>{shown ? c.text : '?'}</button>
        ); })}
      </div>
    </div>
  );
}

function ImageGame({ words, round, setRound, correct, wrong, hearts, total, setDone, setFeedback }) {
  const pool = useMemo(() => shuffle(words.filter(imageable)).slice(0, total), [words, total]);
  const [photo, setPhoto] = useState(null); const [loading, setLoading] = useState(true); const [err, setErr] = useState(null); const [locked, setLocked] = useState(false); const [picked, setPicked] = useState(null);
  const target = pool[round];
  useEffect(() => {
    let alive = true; setLoading(true); setErr(null); setLocked(true); setPhoto(null); setPicked(null);
    if (!target) { setDone(true); return; }
    (async () => {
      try {
        const q = encodeURIComponent(target.imageQuery || target.term);
        const terms = encodeURIComponent((target.imageTerms || [target.term]).join(','));
        const r = await api(`/game/photo?query=${q}&target=${encodeURIComponent(target.term)}&terms=${terms}`);
        if (!alive) return; setPhoto(r); setLoading(false); setLocked(false);
      } catch (e) {
        if (!alive) return;
        if (e.code === 'NO_PEXELS_KEY') { setErr('Ehhez a képes játékhoz PEXELS_API_KEY kell.'); setLoading(false); return; }
        setRound(r => r + 1);
      }
    })();
    return () => { alive = false; };
  }, [round]);
  const opts = useMemo(() => { if (!target) return []; const all = words.filter(imageable); const others = shuffle(all.filter(v => v !== target)).slice(0, 3).map(v => v.term); return shuffle([target.term, ...others]); }, [round, photo, target, words]);
  if (!target) return null;
  if (err) return <div className="text-center py-10"><p className="text-slate-300">{err}</p></div>;
  const choose = (o) => {
    if (locked) return; setLocked(true); setPicked(o);
    const ok = norm(o) === norm(target.term);
    if (ok) { correct(); setFeedback({ kind: 'good', text: `${target.term} = ${target.meaning}` }); } else { wrong(); setFeedback({ kind: 'bad', text: `Nem · ${target.term} = ${target.meaning}` }); }
    setTimeout(() => { if (hearts > 0 || ok) setRound(r => r + 1); }, 800);
  };
  return (
    <div>
      <div className="text-center mb-3"><small className="text-slate-400 text-xs">Melyik angol szó látható?</small></div>
      <div className="rounded-2xl overflow-hidden bg-white/5 aspect-[4/3] grid place-items-center mb-3">
        {loading ? <Loader2 size={26} className="animate-spin text-slate-400" /> : <img alt={photo?.alt} src={photo?.imageUrl} className="h-full w-full object-cover" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {opts.map((o, i) => { const right = norm(o) === norm(target.term); const cls = locked && picked ? (right ? 'bg-emerald-500/20 ring-emerald-400' : o === picked ? 'bg-rose-500/20 ring-rose-400' : 'bg-white/5 ring-white/10') : 'bg-white/5 ring-white/10';
          return <button key={i} disabled={locked} onClick={() => choose(o)} className={`rounded-xl px-3 py-3 text-sm font-semibold ring-1 ${cls}`}>{o}</button>; })}
      </div>
    </div>
  );
}

function Finish({ done, score, streak, hearts, onAgain, onClose, topic }) {
  return (
    <div className="text-center py-8" data-testid="game-finish">
      <div className={`mx-auto h-20 w-20 rounded-full grid place-items-center text-3xl ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{done ? '✓' : '×'}</div>
      <h3 className="font-heading font-extrabold text-2xl mt-4">{done ? 'Kész. Ez már ment.' : 'Elfogytak az életeid.'}</h3>
      <p className="text-sm text-slate-400 mt-1">{done ? `A(z) ${topic || 'random'} csomagból végigmentél.` : 'Nem baj. Indíthatsz egy új kört.'}</p>
      <div className="flex justify-center gap-6 mt-5">
        <div><div className="font-heading font-extrabold text-xl">{score}</div><div className="text-[11px] text-slate-500">pont</div></div>
        <div><div className="font-heading font-extrabold text-xl">{streak}</div><div className="text-[11px] text-slate-500">sorozat</div></div>
        <div><div className="font-heading font-extrabold text-xl">{3 - hearts}</div><div className="text-[11px] text-slate-500">hiba</div></div>
      </div>
      <div className="flex gap-3 mt-6 justify-center">
        <button onClick={onClose} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold">Vissza</button>
        <button onClick={onAgain} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-1"><RotateCcw size={14} /> Új kör</button>
      </div>
    </div>
  );
}
