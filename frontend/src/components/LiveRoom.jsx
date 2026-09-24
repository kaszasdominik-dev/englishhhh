import React, { useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEACHERS, MODE_NAMES, formatClock, normalizeSpeechText } from '@/lib/livo';
import { X, Mic, MicOff, Play, RotateCcw, Pause, Volume2, Check, ArrowRight, Sparkles, ScrollText, Bookmark } from 'lucide-react';

export function LiveRoom({ engine }) {
  const s = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const t = TEACHERS[s.teacher] || TEACHERS.james;
  const [showTranscript, setShowTranscript] = useState(false);

  return (
    <div className="absolute inset-0 z-50 bg-[#0B1120] text-white flex flex-col overflow-hidden" data-testid="live-room">
      <audio id="livo-remote-audio" autoPlay />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-brand/30 blur-[90px]" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 pt-5 pb-3">
        <button data-testid="live-close" onClick={() => engine.end()} className="h-9 w-9 grid place-items-center rounded-full bg-white/10 active:scale-90 transition-transform"><X size={18} /></button>
        <div className="flex items-center gap-2.5">
          <img alt={t.name} src={t.img} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
          <div className="leading-none"><b className="text-sm">{t.name}</b><div className="text-[11px] text-slate-400">{MODE_NAMES[s.mode]}</div></div>
        </div>
        <div className="text-right leading-none">
          <div className={`font-heading font-extrabold text-lg tabular-nums ${s.timeLeft <= 120 && s.timeLeft > 0 ? 'text-amber2' : ''}`}>{formatClock(s.timeLeft)}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{s.connectionLabel}</div>
        </div>
      </header>

      {/* Session setup */}
      {s.phase === 'setup' && (
        <SessionSetup s={s} engine={engine} teacher={t} />
      )}

      {(s.phase === 'connecting' || s.phase === 'live') && (
        <div className="relative flex-1 flex flex-col min-h-0">
          {/* status + preference badge */}
          <div className="px-5 flex items-center justify-center gap-2 min-h-[24px]">
            <span className="text-xs text-slate-300">{s.status}</span>
            {s.preferenceBadge && <span className="text-[10px] font-bold bg-white/10 rounded-full px-2 py-0.5 text-slate-200">{s.preferenceBadge}</span>}
          </div>

          {/* Orb */}
          <div className="flex justify-center py-4">
            <Orb state={s.orb} teacher={t} />
          </div>

          {/* understood banner */}
          <AnimatePresence>
            {s.understood && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-5 mb-2 rounded-2xl bg-amber-500/15 text-amber-200 text-xs px-4 py-2.5 flex items-center gap-2">
                <span className="font-bold">?</span> Nem értettem pontosan. Mondd el még egyszer.
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrollable caption + task area */}
          <div className="flex-1 overflow-y-auto livo-scroll px-5 pb-2">
            {/* Caption */}
            <div className="rounded-[1.5rem] bg-white/[0.06] ring-1 ring-white/10 p-5 backdrop-blur">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`h-2 w-2 rounded-full ${s.orb === 'speaking' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <b className="text-xs text-slate-300">{s.caption.words.length ? `${t.name} beszél` : (s.connected ? t.name : 'LIVO')}</b>
                <small className="text-[10px] text-slate-500 ml-auto">Koppints egy szóra: jelentés + mentés</small>
              </div>
              {s.caption.words.length === 0 ? (
                <p className="text-lg text-slate-200 leading-relaxed font-heading">{s.caption.fallback}</p>
              ) : (
                <p className="text-[22px] leading-relaxed font-heading font-semibold flex flex-wrap gap-x-1.5 gap-y-1">
                  {s.caption.words.map((w, i) => (
                    <span key={i} data-testid={i === 0 ? 'caption-word' : undefined}
                      onClick={() => engine.lookupWord(w.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, ''), s.caption.text)}
                      className={`kw ${i < s.caption.activeIndex ? 'text-white' : i === s.caption.activeIndex ? 'text-brand-ring bg-white/10' : 'text-slate-500'}`}>{w}</span>
                  ))}
                </p>
              )}
            </div>

            {s.userEcho && <div className="mt-2 text-xs text-slate-400 italic px-1">{s.userEcho}</div>}

            {/* TASK CARD — the crucial UX element */}
            <AnimatePresence>
              {s.practiceTarget?.text && (
                <motion.div key={s.practiceTarget.text + s.practiceTarget.kind} data-testid="task-card"
                  initial={{ opacity: 0, scale: 0.9, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                  className="mt-4 rounded-[1.5rem] bg-task-bg ring-1 ring-task-accent/25 shadow-task p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] tracking-[0.2em] font-extrabold text-task-accent">
                      {s.practiceTarget.completed ? '✓ KÉSZ' : (s.practiceTarget.kind === 'translate' ? 'FORDÍTSD ANGOLRA' : 'MONDD KI')}
                    </span>
                    <button onClick={() => engine.hidePracticeTarget()} className="h-6 w-6 grid place-items-center rounded-full bg-white/10 text-slate-400"><X size={13} /></button>
                  </div>
                  <button data-testid="task-phrase" onClick={() => engine.lookupWord(s.practiceTarget.text, s.caption.text)} className="mt-2 block text-left text-2xl font-heading font-extrabold text-task-text leading-snug">
                    {s.practiceTarget.text}
                  </button>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      {s.practiceTarget.completed ? '✓ Megvan. A tanár most tovább visz.' : (s.practiceTarget.kind === 'translate' ? 'Mondd el ezt angolul — a tanár ellenőrzi.' : (s.practiceTarget.attempted ? 'Válasz elküldve.' : 'Ezt kell most kimondanod.'))}
                    </span>
                    {s.practiceTarget.kind !== 'translate' && (
                      <button data-testid="task-save" disabled={s.practiceTarget.saved} onClick={() => engine.savePracticeTarget()} className="shrink-0 rounded-full bg-white/10 text-xs font-semibold px-3 py-1.5 text-white disabled:opacity-60">
                        {s.practiceTarget.saved ? '✓ Mentve' : 'Mentés'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Correction chip */}
            <AnimatePresence>
              {s.correction && (
                <motion.div data-testid="correction-chip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-4">
                  <div className="text-[10px] tracking-widest font-bold text-slate-400 mb-1">JAVÍTÁS</div>
                  <b className="text-base">{s.correction.label}</b>
                  <p className="text-xs text-slate-400 mt-1">{s.correction.why}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pronunciation card */}
            <AnimatePresence>
              {s.pronunciation && (
                <motion.div data-testid="pron-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-4 rounded-2xl p-4 ring-1 ${s.pronunciation.status === 'correct' ? 'bg-emerald-500/10 ring-emerald-400/30' : s.pronunciation.status === 'needs_work' ? 'bg-rose-500/10 ring-rose-400/30' : 'bg-white/[0.06] ring-white/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] tracking-widest font-bold text-slate-400">KIEJTÉS</span>
                    <strong className={s.pronunciation.status === 'correct' ? 'text-emerald-300' : s.pronunciation.status === 'needs_work' ? 'text-rose-300' : 'text-slate-300'}>{s.pronunciation.status === 'correct' ? 'GOOD!' : s.pronunciation.status === 'needs_work' ? 'WRONG!' : 'NÉZZÜK'}</strong>
                    <button onClick={() => engine.hidePronunciation()} className="text-slate-400"><X size={14} /></button>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div><div className="text-[10px] text-slate-500">AHOGY MONDTAD</div><b>{s.pronunciation.heard || '—'}</b></div>
                    <ArrowRight size={16} className="text-slate-500" />
                    <div><div className="text-[10px] text-slate-500">HELYESEN</div><b>{s.pronunciation.target || '—'}</b></div>
                  </div>
                  <div className="mt-2 text-sm text-brand-ring">{s.pronunciation.hint} <span className="text-slate-500 text-xs">{s.pronunciation.ipa}</span></div>
                  {s.pronunciation.note && <p className="text-xs text-slate-400 mt-1">{s.pronunciation.note}</p>}
                  <button onClick={() => engine.listenPronunciation()} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-white/10 rounded-full px-3 py-1.5"><Volume2 size={13} /> Hallgasd meg</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Word popover */}
          <AnimatePresence>
            {s.wordPopover && (
              <motion.div data-testid="word-popover" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute left-4 right-4 bottom-32 z-20 rounded-2xl bg-white text-ink p-4 shadow-card">
                <button onClick={() => engine.closeWordPopover()} className="absolute top-3 right-3 text-ink-faint"><X size={15} /></button>
                <div className="text-[10px] tracking-widest font-bold text-ink-mute">GYORS JELENTÉS</div>
                <div className="flex items-center gap-2 mt-1"><b className="font-heading text-lg">{s.wordPopover.word}</b><ArrowRight size={14} className="text-ink-faint" /><strong className="text-brand">{s.wordPopover.loading ? 'Fordítás…' : (s.wordPopover.translation || '—')}</strong></div>
                <p className="text-xs text-ink-mute mt-1">{s.wordPopover.error || s.wordPopover.contextMeaning || s.wordPopover.explanation || ''}</p>
                {!s.wordPopover.error && (
                  <button data-testid="popover-save" disabled={s.wordPopover.loading || s.wordPopover.saved || !s.wordPopover.translation} onClick={() => engine.saveWordPopover()} className="mt-3 w-full rounded-full bg-brand text-white text-sm font-semibold py-2.5 disabled:opacity-50">{s.wordPopover.saved ? '✓ Mentve' : 'Mentés'}</button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live transcript pull-down panel */}
          <AnimatePresence>
            {showTranscript && <TranscriptPanel s={s} engine={engine} teacher={t} onClose={() => setShowTranscript(false)} />}
          </AnimatePresence>

          {/* Error */}
          {s.error && s.phase !== 'live' && <div className="mx-5 mb-2 text-center text-sm text-rose-300">{s.error}</div>}

          {/* Controls */}
          <div className="relative px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
            <div className="flex items-center justify-center gap-6">
              <button data-testid="live-transcript-toggle" onClick={() => setShowTranscript(v => !v)} className={`h-12 w-12 rounded-full grid place-items-center active:scale-90 transition-transform ${showTranscript ? 'bg-brand text-white' : 'bg-white/10 text-slate-300'}`} title="Átirat"><ScrollText size={20} /></button>
              {!s.connected ? (
                <button data-testid="live-connect" onClick={() => engine.connect()} disabled={s.phase === 'connecting'} className="h-20 w-20 rounded-full bg-brand grid place-items-center shadow-card active:scale-95 transition-transform disabled:opacity-70">
                  {s.phase === 'connecting' ? <span className="text-sm font-semibold">•••</span> : (s.error ? <RotateCcw size={26} /> : <Play size={30} className="ml-1" />)}
                </button>
              ) : (
                <button data-testid="live-mute" onClick={() => engine.toggleMute()} className={`h-20 w-20 rounded-full grid place-items-center shadow-card active:scale-95 transition-transform ${s.muted ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                  {s.muted ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
              )}
              <button className="h-12 w-12 rounded-full bg-white/10 grid place-items-center text-slate-300" disabled>◉</button>
            </div>
            <p className="text-center text-[10px] text-slate-500 mt-3">AI-generált hang · a szóra koppintva jelentés + mentés</p>
          </div>
        </div>
      )}

      {/* Auto-pause overlay */}
      <AnimatePresence>
        {s.autoPaused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-[#0B1120]/90 backdrop-blur-sm p-8 text-center">
            <div>
              <div className="mx-auto h-14 w-14 rounded-full bg-white/10 grid place-items-center mb-4"><Pause size={26} /></div>
              <span className="text-[11px] tracking-widest font-bold text-slate-400">AUTOMATIKUS SZÜNET</span>
              <h2 className="font-heading font-bold text-2xl mt-2">1 perce csend van.</h2>
              <p className="text-sm text-slate-400 mt-2">Megállítottam az órát. A mikrofon most nem figyel, és az idő sem fogy.</p>
              <button onClick={() => engine.resumeFromPause()} className="mt-5 rounded-full bg-brand text-white font-semibold px-6 py-3 active:scale-95 transition-transform">Folytatom</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary modal */}
      <AnimatePresence>
        {s.phase === 'summary' && s.summary && <SummaryModal s={s} engine={engine} />}
      </AnimatePresence>
    </div>
  );
}

function Orb({ state, teacher }) {
  const speaking = state === 'speaking', listening = state === 'listening', muted = state === 'muted';
  return (
    <div className="relative h-40 w-40 grid place-items-center">
      <motion.div className="absolute inset-0 rounded-full bg-brand/40" animate={{ scale: speaking ? [1, 1.18, 1] : listening ? [1, 1.08, 1] : 1, opacity: speaking ? [0.5, 0.15, 0.5] : 0.3 }} transition={{ duration: speaking ? 1.1 : 1.8, repeat: Infinity }} />
      <motion.div className="absolute inset-4 rounded-full bg-brand/50" animate={{ scale: speaking ? [1, 1.12, 1] : 1 }} transition={{ duration: 1.3, repeat: Infinity }} />
      <div className={`relative h-28 w-28 rounded-full overflow-hidden ring-4 ${muted ? 'ring-rose-500/50' : speaking ? 'ring-emerald-400/60' : listening ? 'ring-brand/60' : 'ring-white/20'}`}>
        <img alt={teacher.name} src={teacher.img} className="h-full w-full object-cover" />
      </div>
    </div>
  );
}

function SessionSetup({ s, engine, teacher }) {
  const mins = [5, 10, 15, 20, 30, 45, 60];
  return (
    <div className="relative flex-1 grid place-items-center px-6" data-testid="session-setup">
      <div className="w-full">
        <div className="flex justify-center mb-5"><Orb state="idle" teacher={teacher} /></div>
        <span className="block text-center text-[11px] tracking-[0.2em] font-bold text-brand-ring">INDULHAT AZ ÓRA</span>
        <h2 className="text-center font-heading font-extrabold text-2xl mt-2">Mennyi időd van most?</h2>
        <p className="text-center text-sm text-slate-400 mt-2">{teacher.name} ehhez az időhöz tartja magát. Nem zárja le előbb az órát.</p>
        <div className="grid grid-cols-4 gap-2 mt-5">
          {mins.map(m => (
            <button key={m} data-testid={`dur-${m}`} onClick={() => engine.setMinutes(m)} className={`rounded-2xl py-3 text-sm font-semibold transition-colors ${s.sessionMinutes === m ? 'bg-brand text-white' : 'bg-white/10 text-slate-300'}`}>{m} perc</button>
          ))}
        </div>
        <button data-testid="session-start" onClick={() => engine.connect()} className="mt-6 w-full rounded-full bg-brand text-white font-semibold py-4 inline-flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-card">
          <Play size={18} /> Óra indítása
        </button>
        {s.error && <p className="text-center text-sm text-rose-300 mt-3">{s.error}</p>}
        <p className="text-center text-[11px] text-slate-500 mt-3">1 perc teljes csend után az óra automatikusan szünetel.</p>
      </div>
    </div>
  );
}

function SummaryModal({ s, engine }) {
  const a = s.summary;
  const corrections = (a.corrections || []).slice(0, 5);
  const vocab = (a.vocabulary || []).slice(0, 8);
  const homework = (a.homework || []).slice(0, 2);
  const { saveVocab } = engine.cb;
  return (
    <div className="absolute inset-0 z-40 flex items-end" data-testid="summary-modal">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => engine.dismissSummary()} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="relative w-full max-h-[92%] overflow-y-auto livo-scroll bg-background text-ink rounded-t-[2rem] p-6 pb-10">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 mb-4" />
        <div className="rounded-[1.5rem] bg-task-bg text-task-text p-5">
          <div className="flex items-center justify-between"><span className="text-[11px] tracking-widest font-bold text-task-accent">ÓRA LEZÁRVA</span><span className="h-6 w-6 rounded-full bg-emerald-500 grid place-items-center"><Check size={14} /></span></div>
          <h2 className="font-heading font-extrabold text-2xl mt-2">{a.headline || 'Kész az óra.'}</h2>
          <p className="text-sm text-slate-300 mt-1">{a.next_focus || 'Innen folytatjuk legközelebb.'}</p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat b={Math.max(0, Number(a.speaking_minutes || 0))} l="aktív perc" />
            <Stat b={corrections.length} l="javítás" />
            <Stat b={vocab.length} l="új szó" />
          </div>
        </div>

        {s.summaryLoading && <div className="mt-4 flex items-center gap-2 text-sm text-ink-mute"><Sparkles size={16} className="text-brand animate-pulse" /> A részletes AI-értékelés készül…</div>}

        {a.wins?.length > 0 && (
          <Section title="AMI MA JÓL MENT">
            {a.wins.slice(0, 3).map((w, i) => <div key={i} className="flex items-start gap-2 text-sm text-ink-soft py-1"><Check size={15} className="text-emerald2 mt-0.5 shrink-0" /><span>{w}</span></div>)}
          </Section>
        )}
        {corrections.length > 0 && (
          <Section title="JAVÍTÁSOK">
            {corrections.map((c, i) => (
              <div key={i} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 mb-2">
                <div className="text-sm"><span className="text-rose2 line-through">{c.original}</span> <ArrowRight size={12} className="inline text-ink-faint" /> <strong className="text-emerald2">{c.corrected}</strong></div>
                <p className="text-xs text-ink-mute mt-1">{c.reason}</p>
              </div>
            ))}
          </Section>
        )}
        {vocab.length > 0 && (
          <Section title="MAI ÚJ SZAVAK">
            <div className="grid grid-cols-1 gap-2">
              {vocab.map((v, i) => (
                <button key={i} onClick={() => saveVocab?.({ term: v.term, meaning: v.meaning, example: v.example || '', source: 'summary' })} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 text-left">
                  <span><b className="text-sm text-ink">{v.term}</b><small className="text-xs text-ink-mute block">{v.meaning}</small></span>
                  <span className="h-7 w-7 rounded-full bg-brand-soft text-brand grid place-items-center">+</span>
                </button>
              ))}
            </div>
          </Section>
        )}
        {homework.length > 0 && (
          <Section title="KÖVETKEZŐ 5 PERC">
            {homework.map((h, i) => (
              <div key={i} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 mb-2"><b className="text-sm text-ink">{h.title}</b><p className="text-xs text-ink-mute">{h.detail} · {h.minutes} perc</p></div>
            ))}
          </Section>
        )}

        <button data-testid="summary-done" onClick={() => engine.dismissSummary()} className="mt-5 w-full rounded-full bg-brand text-white font-semibold py-3.5 active:scale-95 transition-transform">Rendben</button>
      </motion.div>
    </div>
  );
}
const Stat = ({ b, l }) => <div className="rounded-xl bg-white/10 py-2 text-center"><div className="font-heading font-extrabold text-lg">{b}</div><div className="text-[10px] text-slate-400">{l}</div></div>;
const Section = ({ title, children }) => <section className="mt-5"><div className="text-[11px] tracking-widest font-bold text-ink-mute mb-2">{title}</div>{children}</section>;


const stripEdge = (w) => w.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, '');

function TranscriptPanel({ s, engine, teacher, onClose }) {
  const [sel, setSel] = useState({ turnId: null, idx: [] });
  const turns = s.timeline.filter(x => normalizeSpeechText(x.text));
  const activeTurn = turns.find(x => x.id === sel.turnId);
  const activeWords = activeTurn ? normalizeSpeechText(activeTurn.text).split(/\s+/) : [];
  const selPhrase = stripEdge(sel.idx.map(i => activeWords[i]).join(' '));

  const toggle = (turn, i) => {
    setSel(prev => {
      if (prev.turnId !== turn.id) return { turnId: turn.id, idx: [i] };
      const has = prev.idx.includes(i);
      const idx = has ? prev.idx.filter(x => x !== i) : [...prev.idx, i].sort((a, b) => a - b);
      return { turnId: idx.length ? turn.id : null, idx };
    });
  };
  const clear = () => setSel({ turnId: null, idx: [] });
  const save = () => {
    const phrase = selPhrase; if (!phrase) return;
    if (sel.idx.length >= 2) engine.lookupPhrase(phrase, activeTurn?.text || phrase);
    else engine.lookupWord(phrase, activeTurn?.text || phrase);
    clear();
  };

  return (
    <motion.div
      data-testid="transcript-panel"
      initial={{ y: '-100%', opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0.4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2}
      onDragEnd={(e, info) => { if (info.offset.y < -80) onClose(); }}
      className="absolute inset-x-0 top-[64px] bottom-[104px] z-[15] mx-3 rounded-[1.5rem] bg-[#0B1120]/95 ring-1 ring-white/10 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200"><ScrollText size={16} /><b className="text-sm">Élő átirat</b></div>
        <button data-testid="transcript-close" onClick={onClose} className="h-7 w-7 grid place-items-center rounded-full bg-white/10 text-slate-300"><X size={14} /></button>
      </div>
      <div className="px-4 py-1 text-[11px] text-slate-500">Koppints egymás után több szóra egy soron belül → kifejezésként mentheted.</div>

      <div className="flex-1 overflow-y-auto livo-scroll px-4 pb-3 space-y-3">
        {turns.length === 0 && <div className="text-center text-sm text-slate-500 py-10">Amint elindul a beszélgetés, itt jelenik meg a teljes átirat.</div>}
        {turns.map((turn) => {
          const words = normalizeSpeechText(turn.text).split(/\s+/).filter(Boolean);
          const isUser = turn.role === 'user';
          return (
            <div key={turn.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${isUser ? 'bg-brand/25 ring-1 ring-brand/30' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
                <div className={`text-[10px] font-bold tracking-widest mb-1 ${isUser ? 'text-brand-ring' : 'text-slate-400'}`}>{isUser ? 'TE' : (teacher.name || 'TANÁR').toUpperCase()}</div>
                <p className="text-[15px] leading-relaxed flex flex-wrap gap-x-1 gap-y-0.5">
                  {words.map((w, i) => {
                    const active = sel.turnId === turn.id && sel.idx.includes(i);
                    return (
                      <span key={i} data-testid={isUser ? undefined : (turn.id === turns.find(x => x.role !== 'user')?.id && i === 0 ? 'transcript-word' : undefined)}
                        onClick={() => toggle(turn, i)}
                        className={`kw ${active ? 'bg-brand text-white' : (isUser ? 'text-slate-100' : 'text-slate-200')}`}>{w}</span>
                    );
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {sel.idx.length > 0 && selPhrase && (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="border-t border-white/10 bg-[#0B1120] px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-slate-500">KIJELÖLT KIFEJEZÉS</div>
              <b className="text-sm text-white truncate block">{selPhrase}</b>
            </div>
            <button onClick={clear} className="text-xs text-slate-400 px-2">Törlés</button>
            <button data-testid="transcript-save-phrase" onClick={save} className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-sm font-semibold px-4 py-2 active:scale-95 transition-transform"><Bookmark size={14} /> Mentés</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex justify-center py-1.5"><div className="h-1 w-10 rounded-full bg-white/20" /></div>
    </motion.div>
  );
}
