import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const THEMES = [
  ['daily_life','Hétköznapok'], ['home','Otthon'], ['family','Család'], ['food_cooking','Étel és főzés'],
  ['shopping','Vásárlás'], ['city_services','Város'], ['transport','Közlekedés'], ['travel','Utazás'],
  ['airport','Repülőtér'], ['hotel','Szálloda'], ['restaurant','Étterem'], ['health','Egészség'],
  ['work_general','Munka'], ['business','Business'], ['meetings','Meetingek'], ['email_phone','E-mail / telefon'],
  ['job_interview','Állásinterjú'], ['manufacturing','Gyártás'], ['logistics','Logisztika'], ['finance','Pénzügy'],
  ['technology','Technológia'], ['education','Oktatás'], ['leisure','Szabadidő'],
  ['weather_environment','Időjárás / környezet'], ['customer_service','Ügyfélszolgálat'],
];

export default function QuestionPracticeRoom({ defaultLevel = 'B1' }) {
  const [theme, setTheme] = useState('daily_life');
  const [level, setLevel] = useState(defaultLevel || 'B1');
  const [skill, setSkill] = useState('');
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [checked, setChecked] = useState(false);
  const [stats, setStats] = useState({ correct:0, wrong:0 });
  const [busy, setBusy] = useState(false);
  const q = questions[index] || null;
  const done = questions.length > 0 && index >= questions.length;
  const score = stats.correct + stats.wrong ? Math.round(stats.correct / (stats.correct + stats.wrong) * 100) : 0;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api('/questions/recommend', {
        method:'POST',
        body:JSON.stringify({ theme, cefr:level, skill:skill || undefined, count:10 }),
      });
      const list = Array.isArray(r.questions) ? r.questions : [];
      if (!list.length) throw new Error('Ehhez a szűréshez most nincs kérdés.');
      setQuestions(list); setIndex(0); setSelected(''); setChecked(false); setStats({correct:0,wrong:0});
    } catch(e) { toast.error(e.message || 'Nem sikerült betölteni a kérdéseket.'); }
    finally { setBusy(false); }
  };

  const choose = (value) => {
    if (checked) return;
    setSelected(value);
  };
  const check = () => {
    if (!q || !selected || checked) return;
    const ok = selected === q.correctAnswer;
    setStats(s => ({ correct:s.correct + (ok?1:0), wrong:s.wrong + (ok?0:1) }));
    setChecked(true);
  };
  const next = () => {
    if (index + 1 >= questions.length) { setIndex(questions.length); return; }
    setIndex(i=>i+1); setSelected(''); setChecked(false);
  };

  if (!questions.length) return <div className="space-y-4" data-testid="question-practice-setup">
    <section className="rounded-[1.35rem] bg-task-bg text-white p-5 shadow-card">
      <span className="text-[10px] tracking-[0.2em] font-bold text-task-accent">10 000 FIX KÉRDÉS · 0 AI TOKEN</span>
      <h3 className="font-heading font-bold text-xl mt-1">Mondat- és nyelvtangyakorló</h3>
      <p className="text-sm text-slate-300 mt-1">A válaszok közt valódi nyelvtani csapdák vannak. A hiányzó helyre húzhatod vagy koppinthatod a választ.</p>
    </section>
    <section className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 space-y-3">
      <label className="block"><span className="text-xs font-semibold text-ink-mute">Téma</span><select value={theme} onChange={e=>setTheme(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none">{THEMES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="block"><span className="text-xs font-semibold text-ink-mute">Szint</span><select value={level} onChange={e=>setLevel(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none">{['A1','A2','B1','B2','C1'].map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="block"><span className="text-xs font-semibold text-ink-mute">Fókusz</span><select value={skill} onChange={e=>setSkill(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-3 text-sm outline-none"><option value="">Vegyes</option><option value="grammar">Nyelvtan</option><option value="vocabulary">Szókincs</option></select></label>
      <button disabled={busy} onClick={start} className="w-full rounded-xl bg-brand text-white py-3 font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50">{busy?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>} 10 kérdés indítása</button>
    </section>
  </div>;

  if (done) return <div className="space-y-4">
    <section className="rounded-[1.5rem] bg-task-bg text-white p-6 shadow-card text-center">
      <Check className="mx-auto text-emerald-300" size={28}/>
      <h3 className="font-heading font-extrabold text-2xl mt-2">{score}%</h3>
      <p className="text-sm text-slate-300 mt-1">{stats.correct} helyes · {stats.wrong} hibás</p>
    </section>
    <button onClick={()=>{setQuestions([]);setIndex(0);}} className="w-full rounded-xl bg-brand text-white py-3 font-bold inline-flex items-center justify-center gap-2"><RotateCcw size={15}/> Új kör</button>
  </div>;

  const promptParts = String(q.prompt || '').split('___');
  return <div className="space-y-4" data-testid="question-practice">
    <div className="flex items-center justify-between text-xs text-ink-mute"><span>{q.themeHu} · {q.cefr}</span><b>{index+1}/{questions.length}</b></div>
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand" style={{width:((index)/questions.length*100)+'%'}}/></div>
    <section className="rounded-[1.35rem] bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="text-[10px] tracking-widest text-brand font-bold mb-3">{q.skill === 'grammar' ? 'NYELVTAN' : 'SZÓKINCS'} · {q.subskill}</div>
      {q.questionType === 'drag_blank' && promptParts.length > 1 ? (
        <div className="text-lg font-heading font-bold text-ink leading-relaxed">
          {promptParts[0]}
          <span onDragOver={e=>e.preventDefault()} onDrop={e=>choose(e.dataTransfer.getData('text/plain'))} className={'inline-flex min-w-28 mx-1 px-3 py-1.5 align-middle justify-center rounded-xl border-2 border-dashed ' + (selected ? 'border-brand bg-brand-soft text-brand' : 'border-slate-300 text-ink-faint')}>
            {selected || 'húzd ide'}
          </span>
          {promptParts.slice(1).join('___')}
        </div>
      ) : <div className="text-lg font-heading font-bold text-ink leading-relaxed">{q.prompt}</div>}
      <div className="mt-5 flex flex-wrap gap-2">
        {(q.options || []).map(option => {
          const isSelected=selected===option;
          const ok=checked && option===q.correctAnswer;
          const bad=checked && isSelected && option!==q.correctAnswer;
          return <button key={option} draggable={!checked} onDragStart={e=>e.dataTransfer.setData('text/plain', option)} onClick={()=>choose(option)}
            className={'rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition-colors ' + (ok?'bg-emerald-50 text-emerald-700 ring-emerald-200':bad?'bg-rose-50 text-rose-700 ring-rose-200':isSelected?'bg-brand-soft text-brand ring-brand/30':'bg-slate-50 text-ink ring-slate-200')}>
            {option}
          </button>;
        })}
      </div>
      {checked && <div className={'mt-4 rounded-xl p-3 text-sm ' + (selected===q.correctAnswer?'bg-emerald-50 text-emerald-800':'bg-rose-50 text-rose-800')}>
        <b>{selected===q.correctAnswer?'Helyes.':'Nem ez a jó válasz.'}</b>
        <p className="text-xs mt-1">{q.explanationHu}</p>
      </div>}
    </section>
    {!checked ? <button disabled={!selected} onClick={check} className="w-full rounded-xl bg-brand text-white py-3 font-bold disabled:opacity-40">Ellenőrzés</button>
      : <button onClick={next} className="w-full rounded-xl bg-brand text-white py-3 font-bold inline-flex items-center justify-center gap-2">Következő <ArrowRight size={15}/></button>}
  </div>;
}
