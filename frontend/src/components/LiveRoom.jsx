import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { TEACHERS, MODE_NAMES, formatClock, normalizeSpeechText } from '@/lib/livo';
import { X, Mic, MicOff, Play, RotateCcw, Pause, Volume2, Check, ArrowRight, Sparkles, ScrollText, Bookmark, Lightbulb, Languages, HelpCircle } from 'lucide-react';

// Fire immediately on press (pointerdown). Bulletproof during the live karaoke, where the caption
// re-renders many times per second and a pointerup/click can be LOST when the pressed word node is
// replaced mid-gesture (the browser then emits pointercancel instead of pointerup).
function tapHandlers(onTap) {
  return {
    onPointerDown: (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; onTap(); },
  };
}

export function LiveRoom({ engine }) {
  const s = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const t = TEACHERS[s.teacher] || TEACHERS.james;
  const [showTranscript, setShowTranscript] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  return (
    <div className="absolute inset-0 z-50 bg-[#0B1120] text-white flex flex-col overflow-hidden" data-testid="live-room">
      <audio id="livo-remote-audio" autoPlay playsInline />
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-brand/30 blur-[90px]" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 pt-5 pb-3">
        <button data-testid="live-close" aria-label="Óra bezárása" onClick={() => {
          if (s.connected && s.phase === 'live') setConfirmEnd(true);
          else engine.end();
        }} className="h-9 w-9 grid place-items-center rounded-full bg-white/10 active:scale-90 transition-transform"><X size={18} /></button>
        <div className="flex items-center gap-2.5">
          <img alt={t.name} src={t.img} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/20" />
          <div className="leading-none">
            <b className="text-sm">{t.name}</b>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">{MODE_NAMES[s.mode]} · {s.cefrLevel || 'B1'}</span>
              <LanguageMixControl s={s} engine={engine} open={showLanguageMenu} setOpen={setShowLanguageMenu} />
            </div>
          </div>
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
          {s.phase === 'connecting' && <ConnectDiagnostics diag={s.diag} />}
          {s.needsAudioUnlock && (
            <button data-testid="live-unlock-audio" onClick={() => engine.unlockAudio()} className="mx-5 mt-1 rounded-full bg-amber-400 text-[#131A2B] text-xs font-bold py-2.5 flex items-center justify-center gap-1.5 active:scale-95 transition-transform">
              <Volume2 size={14} /> Koppints ide a hang bekapcsolásához
            </button>
          )}

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
            {s.mode === 'situation' && s.scenario && (
              <div data-testid="situation-live-controls" className="mb-3 rounded-2xl bg-white/[0.06] ring-1 ring-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] tracking-widest font-bold text-brand-ring">SZITUÁCIÓ · {s.situationStepIndex + 1}/{s.scenario.steps?.length || 1}</div>
                    <b className="text-sm text-white truncate block">{s.scenario.title}</b>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">feszültség {s.situationFrustration || 0}/3</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button data-testid="situation-hint" onClick={() => engine.situationHint()} disabled={s.situationFinished || s.situationHintsUsed >= (s.scenario.hintLimit || 3)} className="flex-1 rounded-xl bg-amber-400/15 text-amber-200 py-2 text-xs font-bold disabled:opacity-35 inline-flex items-center justify-center gap-1.5">
                    <Lightbulb size={13} /> Tipp {(s.scenario.hintLimit || 3) - (s.situationHintsUsed || 0)}
                  </button>
                  <button data-testid="situation-help" onClick={() => engine.situationAskHelp()} disabled={s.situationFinished || s.situationHelpUsed >= (s.scenario.helpLimit || 1) || s.situationHelpArmed} className="flex-1 rounded-xl bg-white/10 text-slate-200 py-2 text-xs font-bold disabled:opacity-35 inline-flex items-center justify-center gap-1.5">
                    <HelpCircle size={13} /> AI kérdés {(s.scenario.helpLimit || 1) - (s.situationHelpUsed || 0)}
                  </button>
                </div>
                {s.situationHintText && <div className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100">💡 {s.situationHintText}</div>}
                {s.situationHelpArmed && <div className="mt-2 text-[11px] text-brand-ring">Most tedd fel az egyetlen kérdésedet szóban.</div>}
              </div>
            )}
            {/* Caption */}
            <div className={`rounded-[1.5rem] bg-white/[0.06] ring-1 ring-white/10 p-5 backdrop-blur transition-[opacity,transform] duration-500 ${s.practiceTarget?.text && !s.practiceTarget.completed ? 'opacity-35 scale-[0.97]' : ''}`}>
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
                      {...tapHandlers(() => engine.lookupWord(w.replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, ''), s.caption.text))}
                      className={`kw ${i < s.caption.activeIndex ? 'text-white' : i === s.caption.activeIndex ? 'text-brand-ring bg-white/10' : 'text-slate-500'}`}>{w}</span>
                  ))}
                </p>
              )}
            </div>

            {s.userEcho && <div className="mt-2 text-xs text-slate-400 italic px-1">{s.userEcho}</div>}

            {/* TASK CARD — the crucial UX element */}
            <TaskCard s={s} engine={engine} />

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
              <motion.div data-testid="word-popover" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="absolute left-4 right-4 bottom-32 z-30 rounded-2xl bg-white text-ink p-4 shadow-card">
                <button data-testid="popover-close" onClick={() => engine.closeWordPopover()} className="absolute top-3 right-3 text-ink-faint"><X size={15} /></button>
                <div className="text-[10px] tracking-widest font-bold text-ink-mute">JELENTÉS</div>
                <div className="flex items-center gap-2 mt-1"><b className="font-heading text-lg">{s.wordPopover.word}</b><ArrowRight size={14} className="text-ink-faint" /><strong className="text-brand">{s.wordPopover.loading ? 'Fordítás…' : (s.wordPopover.translation || '—')}</strong></div>
                <p className="text-xs text-ink-mute mt-1">{s.wordPopover.error || s.wordPopover.contextMeaning || s.wordPopover.explanation || ''}</p>
                {!!s.wordPopover.translation && (
                  <div className="mt-3 flex items-center gap-2">
                    <button data-testid="popover-pronounce" disabled={s.wordPopover.loading} onClick={() => engine.pronounceText(s.wordPopover.sourceLanguage === 'hu' ? s.wordPopover.translation : s.wordPopover.word)} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-100 text-ink text-sm font-semibold py-2.5 px-4 disabled:opacity-50">
                      <Volume2 size={15} /> Kiejtés
                    </button>
                    <button data-testid="popover-save" disabled={s.wordPopover.loading || s.wordPopover.saving || s.wordPopover.saved || !s.wordPopover.translation} onClick={() => engine.saveWordPopover()} className="flex-1 rounded-full bg-brand text-white text-sm font-semibold py-2.5 disabled:opacity-50">{s.wordPopover.saved ? '✓ Mentve' : s.wordPopover.saving ? 'Mentés…' : 'Mentés'}</button>
                  </div>
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
                <button data-testid="live-mute" onClick={() => { engine.unlockAudio(); engine.toggleMute(); }} className={`h-20 w-20 rounded-full grid place-items-center shadow-card active:scale-95 transition-transform ${s.muted ? 'bg-rose-500' : 'bg-emerald-500'}`}>
                  {s.muted ? <MicOff size={28} /> : <Mic size={28} />}
                </button>
              )}
              <button
                data-testid="live-pause"
                aria-label="Óra szüneteltetése"
                onClick={() => engine.autoPause()}
                className="h-12 w-12 rounded-full bg-white/10 grid place-items-center text-slate-300 active:scale-90 transition-transform disabled:opacity-30"
                disabled={!s.connected || s.phase !== 'live'}
                title="Szünet"
              ><Pause size={20} /></button>
            </div>
            <p className="text-center text-[10px] text-slate-500 mt-3">AI-generált hang · a szóra koppintva jelentés + mentés</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            data-testid="live-end-confirm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-[70] grid place-items-center bg-[#0B1120]/85 backdrop-blur-sm p-6"
          >
            <motion.div initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-sm rounded-[1.75rem] bg-[#151D30] p-5 text-center ring-1 ring-white/10">
              <h2 className="font-heading text-xl font-extrabold text-white">Lezárod az órát?</h2>
              <p className="mt-2 text-sm text-slate-400">Az eddigi beszélgetésből elkészítjük az összegzést. Ha csak megállnál, használd inkább a szünet gombot.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirmEnd(false)} className="rounded-full bg-white/10 py-3 text-sm font-semibold text-white">Maradok</button>
                <button type="button" onClick={() => { setConfirmEnd(false); engine.end(); }} className="rounded-full bg-rose-500 py-3 text-sm font-semibold text-white">Óra lezárása</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reconnect overlay */}
      <AnimatePresence>
        {(s.reconnecting || s.reconnectFailed) && !s.autoPaused && (
          <motion.div data-testid="reconnect-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-[#0B1120]/90 backdrop-blur-sm p-8 text-center">
            <div>
              <div className="mx-auto h-14 w-14 rounded-full bg-white/10 grid place-items-center mb-4">
                <RotateCcw size={26} className={s.reconnecting ? 'animate-spin' : 'text-rose-300'} />
              </div>
              <span className="text-[11px] tracking-widest font-bold text-slate-400">{s.reconnecting ? 'KAPCSOLAT MEGSZAKADT' : 'NINCS KAPCSOLAT'}</span>
              <h2 className="font-heading font-bold text-2xl mt-2">{s.reconnecting ? 'Újracsatlakozás…' : 'Nem sikerült újracsatlakozni.'}</h2>
              <p className="text-sm text-slate-400 mt-2">
                {s.reconnecting
                  ? `Az óra nem veszik el — a beszélgetés és az idő is megmarad. (${s.reconnectAttempt}/3)`
                  : 'Ellenőrizd a netet, aztán próbáld újra. Az eddigi beszélgetés megvan.'}
              </p>
              {s.reconnectFailed && (
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button data-testid="reconnect-retry" onClick={() => engine.attemptReconnect()} className="rounded-full bg-brand text-white font-semibold px-6 py-3 active:scale-95 transition-transform">Újrapróbálom</button>
                  <button data-testid="reconnect-end" onClick={() => engine.finish()} className="rounded-full bg-white/10 text-slate-200 font-semibold px-6 py-3 active:scale-95 transition-transform">Óra lezárása</button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-pause overlay */}
      <AnimatePresence>
        {s.autoPaused && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-30 grid place-items-center bg-[#0B1120]/90 backdrop-blur-sm p-8 text-center">
            <div>
              <div className="mx-auto h-14 w-14 rounded-full bg-white/10 grid place-items-center mb-4"><Pause size={26} /></div>
              <span className="text-[11px] tracking-widest font-bold text-slate-400">{s.pauseReason === 'idle' ? 'AUTOMATIKUS SZÜNET' : 'SZÜNET'}</span>
              <h2 className="font-heading font-bold text-2xl mt-2">{s.pauseReason === 'idle' ? '1 perce csend van.' : 'Az óra szünetel.'}</h2>
              <p className="text-sm text-slate-400 mt-2">A Live kapcsolatot lezártuk, így szünet közben nem fut a beszélgetés és a LIVO órája sem.</p>
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

function LanguageMixControl({ s, engine, open, setOpen }) {
  const options = [
    ['english', 'EN', 'Végig angolul', 'Csak angol, a szintedhez igazítva'],
    ['mixed', 'MIX', 'Vegyes', 'Angol + rövid magyar segítség'],
    ['hungarian', 'HU', 'Magyar segítség', 'Magyar instrukció, angol célok'],
  ];
  const current = options.find(x => x[0] === s.languageMix) || options[1];

  return (
    <div className="relative">
      <button
        data-testid="live-language-mix"
        onClick={() => s.phase !== 'connecting' && setOpen(v => !v)}
        disabled={s.phase === 'connecting'}
        className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] ring-1 ring-white/10 px-2 py-1 text-[9px] font-extrabold tracking-wide text-slate-200 active:scale-95 transition-transform disabled:opacity-40"
        aria-label="Beszéd nyelve"
        aria-expanded={open}
      >
        <Languages size={11} /> {current[1]}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            data-testid="live-language-menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            className="absolute z-[80] top-8 left-0 w-56 overflow-hidden rounded-2xl bg-[#151D30] shadow-2xl ring-1 ring-white/15 p-1.5"
          >
            <div className="px-2.5 pt-2 pb-1">
              <div className="text-[9px] tracking-[0.2em] font-bold text-slate-500">TANÁR BESZÉDNYELVE</div>
              <div className="text-[10px] text-slate-400 mt-1">A nehézség automatikusan {s.cefrLevel || 'B1'} szintű.</div>
            </div>
            {options.map(([id, short, label, desc]) => {
              const active = s.languageMix === id;
              return (
                <button
                  key={id}
                  data-testid={`live-language-${id}`}
                  onClick={() => { engine.setLanguageMix(id); setOpen(false); }}
                  className={`w-full rounded-xl px-2.5 py-2.5 text-left flex items-center gap-2.5 transition-colors ${active ? 'bg-brand/20' : 'hover:bg-white/[0.06]'}`}
                >
                  <span className={`h-7 min-w-9 px-1.5 rounded-lg grid place-items-center text-[10px] font-black ${active ? 'bg-brand text-white' : 'bg-white/10 text-slate-300'}`}>{short}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block text-xs text-white">{label}</b>
                    <small className="block text-[10px] leading-tight text-slate-400 mt-0.5">{desc}</small>
                  </span>
                  {active && <Check size={13} className="text-brand-ring shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ s, engine }) {
  const pt = s.practiceTarget;
  return (
    <AnimatePresence>
      {pt?.text && (() => {
        const st = pt.state || 'pending';
        const isTranslate = pt.kind === 'translate';
        const isMeaning = pt.kind === 'meaning';
        const revealed = st === 'wrong' || st === 'dont_know';
        const englishTarget = isTranslate ? (pt.correctAnswer || pt.answer || '') : pt.text;
        const revealedAnswer = isMeaning ? (pt.correctAnswer || pt.answer || '') : englishTarget;
        const canPronounce = !!englishTarget && (!isTranslate || revealed || st === 'correct');
        const taskLabel = ({
          translate_to_english: 'MONDD KI ANGOLUL',
          vocabulary_recall: 'MONDD KI ANGOLUL',
          translate_to_hungarian: 'MONDD MAGYARUL',
          repeat_after_me: 'ISMÉTELD UTÁNAM',
          free_answer: 'VÁLASZOLJ ANGOLUL',
          read_aloud: 'OLVASD FEL',
          pronunciation: 'MONDD KI HELYESEN',
        })[pt.taskType] || (isTranslate ? 'MONDD KI ANGOLUL' : isMeaning ? 'MONDD EL, MIT JELENT' : 'MONDD KI');
        const tone = st === 'correct' ? 'bg-emerald-500/15 ring-2 ring-emerald-400/60'
          : st === 'almost_correct' ? 'bg-amber-500/15 ring-2 ring-amber-400/60'
          : st === 'wrong' ? 'bg-rose-500/12 ring-2 ring-rose-400/50'
          : st === 'dont_know' ? 'bg-sky-500/12 ring-2 ring-sky-400/50'
          : 'bg-task-bg ring-2 ring-task-accent/40 shadow-task';
        return (
          <motion.div key={pt.text + pt.kind} data-testid="task-card"
            initial={{ opacity: 0, scale: 0.85, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            className={`relative mt-4 rounded-[1.75rem] p-6 text-center transition-colors duration-300 ${tone}`}>
            {st === 'correct' ? (
              <TaskSuccessCelebration
                answer={pt.matched || englishTarget || pt.text}
                reason={pt.reason || 'Szép! Megvan.'}
              />
            ) : (
              <>
                <button data-testid="task-close" onClick={() => engine.hidePracticeTarget()} className="absolute top-4 right-4 h-6 w-6 grid place-items-center rounded-full bg-white/10 text-slate-400"><X size={13} /></button>
                <div className="text-[10px] tracking-[0.32em] font-black text-white/55 mb-1">FELADAT</div>
                <span data-testid="task-kind" className="text-[11px] tracking-[0.24em] font-extrabold text-task-accent">
                  {taskLabel}
                </span>
                <button data-testid="task-phrase" onClick={() => engine.lookupWord(pt.text, s.caption.text)} className="mt-3 block w-full text-3xl font-heading font-extrabold text-task-text leading-snug">
                  {pt.text}
                </button>

                {revealed && revealedAnswer && (
                  <div data-testid="task-answer" className="mt-3 rounded-2xl bg-white/10 px-4 py-2.5">
                    <div className="text-[10px] tracking-widest text-slate-400">{isMeaning ? 'JELENTÉS' : 'HELYES VÁLASZ'}</div>
                    <b className="text-xl text-white">{revealedAnswer}</b>
                  </div>
                )}

                {st === 'pending' && (
                  <div data-testid="task-listening" className="mt-4 flex items-center justify-center gap-2 text-sm text-brand-ring">
                    <Mic size={15} className="animate-pulse" /> Hallgatlak…
                  </div>
                )}
                {st === 'almost_correct' && <div data-testid="task-almost" className="mt-3 text-sm font-semibold text-amber-300">Majdnem! Próbáld újra.</div>}
                {st === 'wrong' && <div data-testid="task-wrong" className="mt-3 text-sm font-semibold text-rose-300">{isMeaning ? 'Nem egészen — mondd el magyarul, mit jelent.' : 'Nem egészen — mondd ki a helyes választ.'}</div>}
                {st === 'dont_know' && <div data-testid="task-dontknow" className="mt-3 text-sm font-semibold text-sky-300">{isMeaning ? 'Semmi baj — itt a jelentés. Mondd el te is.' : 'Semmi baj — mondd ki utánam.'}</div>}
                {pt.reason && st !== 'pending' && <p className="mt-1 text-xs text-slate-300">{pt.reason}</p>}
                {st === 'pending' && isTranslate && pt.attempted === 'same-language' && <div className="mt-2 text-xs text-slate-400">Ezt most angolul mondd ki.</div>}

                <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                  {canPronounce && (
                    <button data-testid="task-pronounce" onClick={() => engine.pronounceTarget()} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 text-white text-xs font-semibold px-4 py-2 active:scale-95 transition-transform">
                      <Volume2 size={14} /> Kiejtés
                    </button>
                  )}
                  {st !== 'dont_know' && (
                    <button data-testid="task-hint" onClick={() => engine.taskHint()} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 text-white text-xs font-semibold px-4 py-2 active:scale-95 transition-transform">
                      <Lightbulb size={14} /> Segítség
                    </button>
                  )}
                  {st !== 'dont_know' && (
                    <button data-testid="task-dont-know" onClick={() => engine.taskDontKnow()} className="inline-flex items-center rounded-full bg-white/12 text-slate-200 text-xs font-semibold px-4 py-2 active:scale-95 transition-transform">
                      Nem tudom
                    </button>
                  )}
                  {!isTranslate && (
                    <button data-testid="task-save" disabled={pt.saved} onClick={() => engine.savePracticeTarget()} className="inline-flex items-center rounded-full bg-white/12 text-white text-xs font-semibold px-4 py-2 disabled:opacity-60">
                      {pt.saved ? '✓ Mentve' : 'Mentés'}
                    </button>
                  )}
                </div>
              </>
            )}
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}

function TaskSuccessCelebration({ answer, reason }) {
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const base = { particleCount: 55, spread: 68, startVelocity: 26, gravity: 0.9, scalar: 0.8, origin: { y: 0.62 } };
    try {
      confetti({ ...base, origin: { x: 0.35, y: 0.62 } });
      confetti({ ...base, origin: { x: 0.65, y: 0.62 } });
    } catch { /* visual bonus only */ }
  }, []);

  return (
    <motion.div
      data-testid="task-success"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className="relative overflow-hidden rounded-[1.5rem] bg-emerald-500/10 px-4 py-5"
    >
      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-[74px] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/20"
        initial={{ scale: 0.55, opacity: 0.8 }}
        animate={{ scale: [0.55, 1.35, 1.55], opacity: [0.75, 0.2, 0] }}
        transition={{ duration: 1.05, ease: 'easeOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-[74px] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/20 blur-xl"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.25, 1], opacity: [0, 0.8, 0.35] }}
        transition={{ duration: 0.7 }}
      />
      <motion.div
        initial={{ scale: 0, rotate: -18 }}
        animate={{ scale: [0, 1.2, 0.96, 1], rotate: [-18, 5, 0, 0] }}
        transition={{ duration: 0.58, times: [0, 0.55, 0.8, 1] }}
        className="relative mx-auto h-24 w-24 rounded-full bg-emerald-500 text-white grid place-items-center shadow-lg ring-8 ring-emerald-400/15"
      >
        <Check size={54} strokeWidth={3.4} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative mt-4"
      >
        <div className="text-[11px] tracking-[0.32em] font-black text-emerald-300">HELYES!</div>
        <div className="mt-1 text-2xl font-heading font-extrabold text-white break-words">{answer}</div>
        <div className="text-sm font-semibold text-emerald-200/90 mt-1.5">{reason}</div>
      </motion.div>
    </motion.div>
  );
}

function ConnectDiagnostics({ diag }) {
  if (!diag || !diag.length) return null;
  const icon = (st) => st === 'done' ? <Check size={13} className="text-emerald-400" />
    : st === 'error' ? <X size={13} className="text-rose-400" />
    : st === 'active' ? <RotateCcw size={13} className="text-brand-ring animate-spin" />
    : <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />;
  return (
    <div data-testid="connect-diagnostics" className="mx-5 mt-2 rounded-2xl bg-white/[0.05] ring-1 ring-white/10 p-3 space-y-1.5">
      <div className="text-[10px] tracking-widest font-bold text-slate-400">KAPCSOLAT ELLENŐRZÉSE</div>
      {diag.map(d => (
        <div key={d.key} data-testid={`diag-${d.key}`} className="flex items-center gap-2.5 text-sm">
          <span className="h-5 w-5 grid place-items-center shrink-0">{icon(d.state)}</span>
          <span className={d.state === 'error' ? 'text-rose-300' : d.state === 'done' ? 'text-slate-300' : d.state === 'active' ? 'text-white' : 'text-slate-500'}>{d.label}</span>
          {d.detail && <span className="ml-auto text-[11px] text-slate-500">{d.detail}</span>}
        </div>
      ))}
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
        {s.diag?.length > 0 && s.error && <ConnectDiagnostics diag={s.diag} />}
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
  const { saveVocab, savePracticeFocus } = engine.cb;
  return (
    <div className="absolute inset-0 z-40 flex items-end" data-testid="summary-modal">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => engine.dismissSummary()} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} className="relative w-full max-h-[92%] overflow-y-auto livo-scroll bg-background text-ink rounded-t-[2rem] p-6 pb-10">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 mb-4" />
        <div className="rounded-[1.5rem] bg-task-bg text-task-text p-5">
          <div className="flex items-center justify-between"><span className="text-[11px] tracking-widest font-bold text-task-accent">ÓRA LEZÁRVA</span><span className="h-6 w-6 rounded-full bg-emerald-500 grid place-items-center"><Check size={14} /></span></div>
          <h2 className="font-heading font-extrabold text-2xl mt-2">{a.headline || 'Kész az óra.'}</h2>
          <p className="text-sm text-slate-300 mt-1">{a.next_focus || 'Innen folytatjuk legközelebb.'}</p>
          {(a.next_focus || a.scenarioTitle) && (
            <button data-testid="summary-save-focus" onClick={() => savePracticeFocus?.({
              title: a.next_focus || ((a.scenarioTitle || 'Szituáció') + ' gyakorlása'),
              detail: a.scenarioTitle ? ('Szituáció: ' + a.scenarioTitle) : 'Live óra alapján',
              source: a.scenarioId ? 'situation_summary' : 'live_summary',
              scenarioId: a.scenarioId || '',
            })} className="mt-3 rounded-full bg-white/10 text-white px-3 py-2 text-xs font-bold inline-flex items-center gap-1.5">
              <Bookmark size={13} /> Mentés a gyakorlandók közé
            </button>
          )}
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
                        {...tapHandlers(() => toggle(turn, i))}
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
