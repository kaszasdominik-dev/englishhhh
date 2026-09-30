import React, { useEffect, useState } from 'react';
import { X, Mic, MessageSquare, ArrowLeft, Send, Lightbulb, HelpCircle, Bookmark, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { TEACHERS, normalizeSpeechText } from '@/lib/livo';
import { toast } from 'sonner';

const cleanWord = (value = '') => normalizeSpeechText(value).replace(/^[^\\p{L}\\p{N}'-]+|[^\\p{L}\\p{N}'-]+$/gu, '');

function ClickableText({ text, onWord }) {
  const parts = String(text || '').split(/(\\s+)/);
  return <p className="text-[15px] leading-relaxed">{parts.map((part, i) => {
    if (/^\\s+$/.test(part)) return <React.Fragment key={i}>{part}</React.Fragment>;
    const word = cleanWord(part);
    if (!word) return <React.Fragment key={i}>{part}</React.Fragment>;
    return <button key={i} onClick={() => onWord(word, text)} className="inline text-left hover:text-brand underline decoration-transparent hover:decoration-brand/40 underline-offset-2">{part}</button>;
  })}</p>;
}

export default function SituationPractice({ data, onClose, onLiveStart }) {
  const { saveVocabulary, savePracticeFocus, setData } = useStore();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState(null);
  const [mode, setMode] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [frustration, setFrustration] = useState(0);
  const [hintUsed, setHintUsed] = useState(0);
  const [hintText, setHintText] = useState('');
  const [helpUsed, setHelpUsed] = useState(0);
  const [helpArmed, setHelpArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const [wordCard, setWordCard] = useState(null);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [sessionWords, setSessionWords] = useState([]);

  useEffect(() => {
    api('/scenarios').then(r => setScenarios(r.scenarios || [])).catch(() => toast.error('Nem sikerült betölteni a szituációkat.')).finally(() => setLoading(false));
  }, []);

  const teacher = TEACHERS[data?.profile?.teacher] || TEACHERS.james;
  const currentStep = scenario?.steps?.[stepIndex] || null;

  const startText = (item) => {
    setScenario(item); setMode('text'); setStepIndex(0); setTurnCount(0); setFrustration(0);
    setHintUsed(0); setHintText(''); setHelpUsed(0); setHelpArmed(false); setSummary(null);
    setSessionMistakes([]); setSessionWords([]); setWordCard(null);
    setMessages([{ role: 'assistant', text: item.steps?.[0]?.opening || 'Hello.' }]);
  };

  const transcriptPayload = (extra = []) => [...messages, ...extra].map(x => ({ role: x.role, text: x.text })).slice(-40);

  const finishText = async (extraMessages = []) => {
    if (!scenario || busy) return;
    setBusy(true);
    try {
      const r = await api('/session/analyze', {
        method: 'POST',
        body: JSON.stringify({
          teacher: data?.profile?.teacher || 'maya', mode: 'situation', scenarioId: scenario.id,
          durationSeconds: Math.max(60, turnCount * 35), transcript: transcriptPayload(extraMessages),
          baselineVocabulary: (data?.vocabulary || []).map(v => v.term).filter(Boolean),
        }),
      });
      if (r.state) setData?.(r.state);
      setSummary(Object.assign({}, r.analysis || {}, { scenarioTitle: scenario.title, scenarioId: scenario.id, localMistakes: sessionMistakes, localWords: sessionWords }));
    } catch {
      setSummary({ headline: 'A szituáció véget ért.', next_focus: sessionMistakes[0] || 'Gyakorold újra ezt a szituációt.', corrections: [], vocabulary: [], scenarioTitle: scenario.title, scenarioId: scenario.id, localMistakes: sessionMistakes, localWords: sessionWords });
    } finally { setBusy(false); setMode('summary'); }
  };

  const send = async () => {
    const value = normalizeSpeechText(input);
    if (!value || busy || !scenario) return;
    setInput('');
    const userMsg = { role: 'user', text: value };
    setMessages(prev => [...prev, userMsg]);
    setBusy(true);
    try {
      if (helpArmed) {
        const r = await api('/scenario/help', { method: 'POST', body: JSON.stringify({ scenarioId: scenario.id, stepIndex, question: value }) });
        const back = currentStep?.opening ? 'Vissza a szituációhoz: ' + currentStep.opening : '';
        setMessages(prev => [...prev, { role: 'assistant', text: [r.answer, back].filter(Boolean).join('\\n\\n'), help: true }]);
        setHelpArmed(false);
        return;
      }
      const r = await api('/scenario/text-turn', {
        method: 'POST',
        body: JSON.stringify({ scenarioId: scenario.id, teacher: data?.profile?.teacher || 'maya', stepIndex, turnCount, frustration, learnerText: value, transcript: transcriptPayload([userMsg]) }),
      });
      const aiMsg = { role: 'assistant', text: r.assistantText || '' };
      setMessages(prev => [...prev, aiMsg]);
      setTurnCount(x => x + 1); setFrustration(Number(r.frustration || 0)); setStepIndex(Number(r.stepIndex ?? stepIndex)); setHintText('');
      if (Array.isArray(r.mistakes) && r.mistakes.length) setSessionMistakes(prev => [...new Set([...prev, ...r.mistakes])].slice(0, 12));
      if (Array.isArray(r.newWords) && r.newWords.length) setSessionWords(prev => [...new Set([...prev, ...r.newWords])].slice(0, 20));
      if (r.finished || r.limitReached || turnCount + 1 >= (scenario.maxTurns || 16)) setTimeout(() => finishText([userMsg, aiMsg]), 50);
    } catch (e) { toast.error(e.message || 'Nem sikerült válaszolni.'); }
    finally { setBusy(false); }
  };

  const hint = () => {
    if (!currentStep || hintUsed >= (scenario?.hintLimit || 3)) return;
    const hints = currentStep.hints || [];
    setHintText(hints[Math.min(hintUsed, hints.length - 1)] || '');
    setHintUsed(x => x + 1);
  };

  const armHelp = () => {
    if (helpUsed >= (scenario?.helpLimit || 1) || helpArmed) return;
    setHelpUsed(1); setHelpArmed(true);
    setMessages(prev => [...prev, { role: 'assistant', text: 'Segítek, viszont csak 1 kérdésed lehet! Hallgatlak.', help: true }]);
  };

  const lookupWord = async (word, context) => {
    if (!word) return;
    setWordCard({ word, loading: true });
    try {
      const r = await api('/word-help', { method:'POST', body: JSON.stringify({ word, context, explicitLookup:true, direction:'auto' }) });
      setWordCard({ word: r.source || word, translation: r.translation || '', explanation: r.contextMeaning || r.explanation || '', sourceLanguage: r.sourceLanguage || 'en' });
    } catch { setWordCard({ word, error: 'Nem sikerült lekérni a jelentést.' }); }
  };

  const saveWord = async (v) => {
    if (!v?.translation) return;
    const lang = v.sourceLanguage || 'en';
    const payload = lang === 'hu' ? { term: v.translation, meaning: v.word } : { term: v.word, meaning: v.translation };
    const saved = await saveVocabulary(Object.assign({}, payload, { source:'situation_text', sourceLanguage:lang }));
    if (saved) setWordCard(prev => Object.assign({}, prev, { saved:true }));
  };

  if (loading) return <div className="absolute inset-0 z-50 bg-background grid place-items-center"><Loader2 className="animate-spin text-brand" /></div>;

  if (mode === 'summary' && summary) {
    const corrections = (summary.corrections || []).slice(0, 6);
    const vocab = (summary.vocabulary || []).slice(0, 8);
    const focusTitle = summary.next_focus || summary.localMistakes?.[0] || (summary.scenarioTitle + ' gyakorlása');
    return <div className="absolute inset-0 z-50 bg-background overflow-y-auto livo-scroll p-5 pb-10">
      <div className="flex items-center justify-between"><button onClick={onClose} className="h-9 w-9 rounded-full bg-white shadow-soft grid place-items-center"><X size={17}/></button><span className="text-[10px] tracking-widest font-bold text-brand">SZITUÁCIÓ KIÉRTÉKELVE</span><span className="w-9" /></div>
      <section className="mt-5 rounded-[1.5rem] bg-task-bg text-white p-5 shadow-card">
        <div className="flex items-center justify-between"><b className="text-sm">{summary.scenarioTitle}</b><Check size={18} className="text-emerald-300"/></div>
        <h2 className="font-heading font-extrabold text-2xl mt-2">{summary.headline || 'Kész.'}</h2>
        <p className="text-sm text-slate-300 mt-2">{summary.next_focus || 'Nézd át a javításokat és mentsd, amit gyakorolnál.'}</p>
        <button onClick={() => savePracticeFocus?.({ title: focusTitle, detail: 'Szituáció: ' + summary.scenarioTitle, source:'situation_summary', scenarioId: summary.scenarioId })} className="mt-4 w-full rounded-full bg-white text-ink py-3 text-sm font-bold inline-flex items-center justify-center gap-2"><Bookmark size={15}/> Mentés a gyakorlandók közé</button>
      </section>
      {corrections.length > 0 && <section className="mt-5"><div className="text-[10px] tracking-widest font-bold text-ink-mute mb-2">MIT RONTOTTÁL EL</div><div className="space-y-2">{corrections.map((c,i) => <div key={i} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100"><div className="text-sm"><span className="text-rose2 line-through">{c.original}</span> → <b className="text-emerald2">{c.corrected}</b></div><p className="text-xs text-ink-mute mt-1">{c.reason}</p><button onClick={() => savePracticeFocus?.({ title:c.type || 'Nyelvtani javítás', detail:(c.original + ' → ' + c.corrected + '. ' + (c.reason || '')), source:'situation_correction', scenarioId:summary.scenarioId })} className="mt-2 text-xs font-bold text-brand">+ Gyakorlásra mentem</button></div>)}</div></section>}
      {vocab.length > 0 && <section className="mt-5"><div className="text-[10px] tracking-widest font-bold text-ink-mute mb-2">HASZNOS SZAVAK</div><div className="space-y-2">{vocab.map((v,i) => <button key={i} onClick={() => saveVocabulary({ term:v.term, meaning:v.meaning, example:v.example || '', source:'situation_summary' })} className="w-full rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 flex items-center text-left"><span className="flex-1"><b className="text-sm">{v.term}</b><small className="block text-xs text-ink-mute">{v.meaning}</small></span><span className="h-8 w-8 rounded-full bg-brand-soft text-brand grid place-items-center">+</span></button>)}</div></section>}
      <button onClick={() => { setMode(null); setScenario(null); }} className="mt-6 w-full rounded-full bg-brand text-white py-3.5 font-semibold">Másik szituáció</button>
    </div>;
  }

  if (mode === 'text' && scenario) {
    return <div className="absolute inset-0 z-50 bg-[#0B1120] text-white flex flex-col">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-white/10">
        <button onClick={() => { setMode(null); setScenario(null); }} className="h-9 w-9 rounded-full bg-white/10 grid place-items-center"><ArrowLeft size={17}/></button>
        <div className="flex-1 min-w-0"><b className="text-sm block truncate">{scenario.title}</b><small className="text-[10px] text-slate-400">Szöveges szituáció · {stepIndex + 1}/{scenario.steps.length} lépés · düh {frustration}/3</small></div>
        <button onClick={() => finishText()} className="text-xs font-bold text-slate-300">Befejezés</button>
      </header>
      <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10">
        <button onClick={hint} disabled={hintUsed >= scenario.hintLimit} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-35 inline-flex items-center gap-1.5"><Lightbulb size={13}/> Tipp {scenario.hintLimit-hintUsed}</button>
        <button onClick={armHelp} disabled={helpUsed >= scenario.helpLimit || helpArmed} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-35 inline-flex items-center gap-1.5"><HelpCircle size={13}/> AI kérdés {scenario.helpLimit-helpUsed}</button>
        <span className="ml-auto text-[10px] text-slate-500">Koppints szóra → mentés</span>
      </div>
      {hintText && <div className="mx-4 mt-3 rounded-2xl bg-amber-400/15 ring-1 ring-amber-300/20 text-amber-100 px-4 py-3 text-sm"><Lightbulb size={14} className="inline mr-1"/> {hintText}</div>}
      <div className="flex-1 overflow-y-auto livo-scroll p-4 space-y-3">
        {messages.map((m,i) => <div key={i} className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}><div className={'max-w-[86%] rounded-2xl px-4 py-3 ' + (m.role === 'user' ? 'bg-brand/30 ring-1 ring-brand/40' : m.help ? 'bg-amber-400/10 ring-1 ring-amber-300/20' : 'bg-white/[0.07] ring-1 ring-white/10')}><div className="text-[9px] tracking-widest font-bold text-slate-500 mb-1">{m.role === 'user' ? 'TE' : m.help ? 'SEGÍTSÉG' : scenario.aiRole.toUpperCase()}</div>{m.role === 'assistant' ? <ClickableText text={m.text} onWord={lookupWord}/> : <p className="text-[15px] leading-relaxed">{m.text}</p>}</div></div>)}
        {busy && <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 size={13} className="animate-spin"/> válasz készül…</div>}
      </div>
      {wordCard && <div className="mx-4 mb-2 rounded-2xl bg-white text-ink p-4 shadow-card relative"><button onClick={() => setWordCard(null)} className="absolute top-3 right-3 text-ink-faint"><X size={14}/></button><div className="text-[10px] tracking-widest font-bold text-ink-mute">SZÓ</div><b>{wordCard.word}</b>{wordCard.translation && <span className="text-brand font-bold"> → {wordCard.translation}</span>}<p className="text-xs text-ink-mute mt-1">{wordCard.loading ? 'Betöltés…' : wordCard.error || wordCard.explanation || ''}</p>{wordCard.translation && <button disabled={wordCard.saved} onClick={() => saveWord(wordCard)} className="mt-2 rounded-full bg-brand text-white text-xs font-bold px-4 py-2 disabled:opacity-50">{wordCard.saved ? '✓ Mentve' : 'Mentés a szavaimhoz'}</button>}</div>}
      <div className="p-4 pt-2 border-t border-white/10 flex items-end gap-2"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} rows={2} placeholder={helpArmed ? 'Tedd fel az egyetlen kérdésed…' : 'Írd le angolul, mit mondanál…'} className="flex-1 resize-none rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3 text-sm outline-none placeholder:text-slate-500"/><button onClick={send} disabled={busy || !input.trim()} className="h-12 w-12 rounded-full bg-brand grid place-items-center disabled:opacity-40"><Send size={18}/></button></div>
    </div>;
  }

  return <div className="absolute inset-0 z-50 bg-background overflow-y-auto livo-scroll p-5 pb-10">
    <div className="flex items-center justify-between"><button onClick={onClose} className="h-9 w-9 rounded-full bg-white shadow-soft grid place-items-center"><X size={17}/></button><div className="text-center"><div className="text-[10px] tracking-[0.2em] font-bold text-brand">SZITUÁCIÓ GYAKORLÁS</div><div className="text-xs text-ink-mute mt-0.5">{teacher.name} marad szerepben</div></div><span className="w-9"/></div>
    <section className="mt-5 rounded-[1.5rem] bg-task-bg text-white p-5 shadow-card"><h2 className="font-heading font-extrabold text-2xl">Valós helyzet. Fix forgatókönyv.</h2><p className="text-sm text-slate-300 mt-2">Fix lépések, 3 tipp, 1 AI-kérdés, korlátozott menetszám és a végén elemzés.</p></section>
    <div className="mt-4 space-y-3">{scenarios.map(item => <section key={item.id} className="rounded-[1.25rem] bg-white p-4 shadow-soft ring-1 ring-slate-100"><div className="flex items-start gap-3"><div className="h-10 w-10 rounded-2xl bg-brand-soft text-brand grid place-items-center"><MessageSquare size={18}/></div><div className="flex-1"><div className="flex items-center gap-2"><b className="text-sm text-ink">{item.title}</b><span className="text-[9px] font-bold rounded-full bg-slate-100 text-ink-mute px-2 py-0.5">{item.level}</span></div><p className="text-xs text-ink-mute mt-1">{item.description}</p><div className="text-[10px] text-ink-faint mt-1">{item.steps.length} lépés · max {item.maxTurns} válasz</div></div></div><div className="grid grid-cols-2 gap-2 mt-3"><button onClick={() => onLiveStart?.(item)} className="rounded-xl bg-brand text-white py-2.5 text-sm font-bold inline-flex items-center justify-center gap-1.5"><Mic size={15}/> Live {teacher.name}-nel</button><button onClick={() => startText(item)} className="rounded-xl bg-slate-100 text-ink py-2.5 text-sm font-bold inline-flex items-center justify-center gap-1.5"><MessageSquare size={15}/> Szövegesen</button></div></section>)}</div>
  </div>;
}
