import React, { useEffect, useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { TEACHERS, MODES, MODE_NAMES, pct, computeStreak, normalizeSpeechText } from '@/lib/livo';
import { FIXED_STARTER_TASKS } from '@/lib/learningTasks';
import QuestionPracticeRoom from '@/components/QuestionPracticeRoom';
import { toast } from 'sonner';
import {
  ArrowRight, Briefcase, MessagesSquare, Sparkles, Wand2, UserRoundCheck, Clapperboard,
  AudioLines, GraduationCap, Search, Plus, Trash2, Star, Check, Flame, Clock, Trophy, RefreshCw, Loader2,
  History, ChevronRight, X, Bookmark,
} from 'lucide-react';

const ICONS = { Briefcase, MessagesSquare, Sparkles, Wand2, UserRoundCheck, Clapperboard, AudioLines, GraduationCap };

function Ring({ value, max, children }) {
  const p = pct((value / (max || 1)) * 100);
  return (
    <div className="relative h-20 w-20 shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#4F46E5 ${p}%, #E2E8F0 ${p}%)` }} />
      <div className="absolute inset-[6px] rounded-full bg-white grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function HomeView({ data, openLive, goto, onTeacher }) {
  const { toggleHomework } = useStore();
  const p = data.profile, s = data.stats;
  const t = TEACHERS[p.teacher] || TEACHERS.james;
  const due = data.vocabulary.filter(v => v.status === 'uncertain').slice(0, 3);
  return (
    <div className="px-5 pt-5 space-y-6">
      {/* Hero */}
      <section data-testid="home-hero" className="relative overflow-hidden rounded-[1.75rem] bg-task-bg text-task-text p-6 shadow-card">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/40 blur-3xl" />
        <div className="relative">
          <span className="text-[10px] tracking-[0.22em] font-bold text-brand-ring">FOLYTASD INNEN</span>
          <h2 className="font-heading font-extrabold text-2xl leading-tight mt-2">{t.name} emlékszik, hol tartottatok.</h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            {due.length ? `Érdemes visszahozni: ${due.map(x => x.term).join(', ')}.` : 'Folytasd onnan, ahol legutóbb abbahagytátok.'}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button data-testid="home-start-btn" onClick={() => openLive('business')} className="inline-flex items-center gap-2 rounded-full bg-white text-ink font-semibold text-sm px-5 py-3 active:scale-95 transition-transform shadow-soft">
              Beszélj {t.name}-szel <ArrowRight size={16} />
            </button>
            <button onClick={() => goto('practice')} className="text-sm font-semibold text-slate-300 active:text-white">Másik mód</button>
          </div>
        </div>
      </section>

      {/* Streak */}
      <StreakCard sessions={data.sessions || []} />

      {/* Weekly goal */}
      <section className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <Ring value={s.weekMinutes || 0} max={p.weeklyMinutes || 120}>
          <div><div className="font-heading font-extrabold text-xl text-ink leading-none">{s.weekMinutes || 0}</div><div className="text-[9px] text-ink-mute mt-0.5">perc / hét</div></div>
        </Ring>
        <div className="flex-1">
          <div className="font-heading font-bold text-ink">Mai mini cél</div>
          <p className="text-sm text-ink-mute mt-0.5">15 perc beszéd + 3 szó ismétlése</p>
          <button onClick={() => goto('learn')} className="mt-2 text-sm font-semibold text-brand inline-flex items-center gap-1">Ismétlendők <ArrowRight size={14} /></button>
        </div>
      </section>

      {/* Focus cards */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-heading font-bold text-ink">Ma ezt érdemes gyakorolnod</h3>
        </div>
        <FocusCard onClick={() => openLive('business')} icon={Briefcase} title="Business English" sub="Negotiation · 12–20 perc" tag="Folytatás" />
        <FocusCard onClick={() => goto('learn')} icon={Sparkles} title="Szógyakorló" sub={due.map(x => x.term).join(' · ') || 'kiejtés · helyesírás · ismétlés'} tag="3–5 perc" />
        <FocusCard onClick={() => openLive('grammar')} icon={Wand2} title="Past simple" sub="take → took · grow → grew" tag="6 perc" />
      </section>

      {/* Homework */}
      <section className="rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-ink">Mai házi</h3>
          <button onClick={() => goto('learn')} className="text-xs font-semibold text-brand">Tanulás</button>
        </div>
        <div className="space-y-2">
          {(data.homework || []).slice(0, 3).map(h => (
            <label key={h.id} data-testid={`home-hw-${h.id}`} className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 cursor-pointer">
              <input type="checkbox" checked={!!h.done} onChange={e => toggleHomework(h.id, e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
              <span><b className="text-sm text-ink block">{h.title}</b><small className="text-xs text-ink-mute">{h.minutes || 3} perc</small></span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

const DAY_LETTERS = ['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Sz'];
const MILESTONES = [3, 7, 30];

function StreakCard({ sessions }) {
  const { streak, practicedToday, week } = computeStreak(sessions);
  const reached = MILESTONES.filter(m => streak >= m);
  useEffect(() => {
    const top = reached[reached.length - 1];
    if (!top) return;
    const seen = Number(localStorage.getItem('livo_streak_milestone') || 0);
    if (top > seen) {
      localStorage.setItem('livo_streak_milestone', String(top));
      const fire = (opts) => { try { confetti({ particleCount: 110, spread: 75, startVelocity: 38, origin: { y: 0.32 }, colors: ['#F59E0B', '#4F46E5', '#10B981', '#F43F5E', '#FBBF24'], ...opts }); } catch { /* noop */ } };
      fire({});
      setTimeout(() => fire({ particleCount: 60, spread: 110, origin: { y: 0.38 } }), 320);
    }
  }, [reached]);
  return (
    <section data-testid="home-streak" className="rounded-[1.5rem] bg-white p-5 shadow-soft ring-1 ring-slate-100">
      <div className="flex items-center gap-4">
        <div className={`h-14 w-14 shrink-0 rounded-2xl grid place-items-center ${streak > 0 ? 'bg-amber-100 text-amber-500' : 'bg-slate-100 text-slate-400'}`}>
          <Flame size={26} className={practicedToday ? 'animate-pulse' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <div data-testid="streak-count" className="font-heading font-extrabold text-xl text-ink leading-none">{streak} napos sorozat</div>
          <p className="text-xs text-ink-mute mt-1.5">
            {practicedToday ? 'Ma már gyakoroltál. Így tovább!' : streak > 0 ? 'Ma még nem volt óra — tartsd meg a sorozatot!' : 'Kezdj egy órát, és indul a sorozat.'}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          {week.map((d, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-full ${d.done ? 'bg-amber-400' : 'bg-slate-200'}`} />
              <small className="text-[8px] text-ink-faint leading-none">{DAY_LETTERS[new Date(d.day + 'T00:00:00Z').getUTCDay()]}</small>
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <small className="text-[10px] tracking-widest font-bold text-ink-faint">MÉRFÖLDKÖVEK</small>
        {MILESTONES.map(m => {
          const earned = streak >= m;
          const next = !earned && m === MILESTONES.find(x => streak < x);
          return (
            <span key={m} data-testid={`streak-badge-${m}`}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-colors ${earned ? 'bg-amber-400 text-white shadow-soft' : next ? 'bg-amber-50 text-amber-500 ring-1 ring-amber-200' : 'bg-slate-100 text-slate-400'}`}>
              {earned ? <Trophy size={10} /> : <Flame size={10} />} {m} nap
            </span>
          );
        })}
        {reached.length < MILESTONES.length && (
          <small className="ml-auto text-[10px] text-ink-faint">még {MILESTONES.find(m => streak < m) - streak} nap</small>
        )}
      </div>
    </section>
  );
}

function FocusCard({ onClick, icon: Icon, title, sub, tag }) {
  return (
    <button data-testid={`focus-${title}`} onClick={onClick} className="w-full flex items-center gap-3 rounded-[1.25rem] bg-white p-4 shadow-soft ring-1 ring-slate-100 active:scale-[.98] transition-transform text-left">
      <span className="h-11 w-11 rounded-2xl bg-brand-soft text-brand grid place-items-center shrink-0"><Icon size={20} /></span>
      <span className="flex-1 min-w-0"><b className="text-sm text-ink block truncate">{title}</b><small className="text-xs text-ink-mute truncate block">{sub}</small></span>
      <span className="text-xs font-semibold text-brand shrink-0">{tag}</span>
    </button>
  );
}

export function PracticeView({ data, openLive, onTeacher, onSituation }) {
  const t = TEACHERS[data.profile.teacher] || TEACHERS.james;
  const [langMode, setLangMode] = useState(() => localStorage.getItem('livo_live_language') || 'hu');
  const setLanguage = (value) => { setLangMode(value); localStorage.setItem('livo_live_language', value); };
  const liveModes = Object.values(MODES).filter(m => m.id !== 'vocabulary');

  return (
    <div className="px-5 pt-5 space-y-5">
      <button onClick={onTeacher} data-testid="practice-teacher" className="w-full flex items-center gap-3 rounded-[1.25rem] bg-white p-3 shadow-soft ring-1 ring-slate-100 active:scale-[.99] transition-transform">
        <img alt={t.name} src={t.img} className="h-11 w-11 rounded-2xl object-cover" />
        <span className="flex-1 text-left"><small className="text-[10px] tracking-widest text-ink-mute font-semibold">TANÁR</small><b className="block text-ink">{t.name}</b></span>
        <span className="text-xs font-semibold text-brand">Csere</span>
      </button>

      <section className="rounded-[1.25rem] bg-white p-4 shadow-soft ring-1 ring-slate-100">
        <div className="text-xs font-semibold text-ink-mute mb-2">Az óra nyelve</div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setLanguage('hu')} className={`rounded-xl py-2.5 text-sm font-semibold ${langMode === 'hu' ? 'bg-brand text-white' : 'bg-slate-50 text-ink-mute'}`}>Főleg magyarul</button>
          <button onClick={() => setLanguage('en')} className={`rounded-xl py-2.5 text-sm font-semibold ${langMode === 'en' ? 'bg-brand text-white' : 'bg-slate-50 text-ink-mute'}`}>Főleg angolul</button>
        </div>
        <p className="text-[11px] text-ink-faint mt-2">A szógyakorló külön a Tanulás menüben van; a Live itt folyékony beszélgetésre marad.</p>
      </section>

      <div className="grid grid-cols-1 gap-3">
        {liveModes.map((m) => {
          const Icon = ICONS[m.icon] || Sparkles;
          const featured = m.tag === 'AJÁNLOTT';
          return (
            <button key={m.id} data-testid={`mode-${m.id}`} onClick={() => m.id === 'situation' ? onSituation?.() : openLive(m.id, { langMode })}
              className={`relative overflow-hidden text-left rounded-[1.35rem] p-5 active:scale-[.98] transition-transform ${featured ? 'bg-task-bg text-task-text shadow-card' : 'bg-white text-ink shadow-soft ring-1 ring-slate-100'}`}>
              {featured && <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-brand/40 blur-2xl" />}
              <div className="relative flex items-start gap-3">
                <span className={`h-11 w-11 rounded-2xl grid place-items-center shrink-0 ${featured ? 'bg-white/15 text-white' : 'bg-brand-soft text-brand'}`}><Icon size={20} /></span>
                <div className="flex-1">
                  {featured && <span className="text-[10px] tracking-[0.2em] font-bold text-task-accent">AJÁNLOTT</span>}
                  <h3 className="font-heading font-bold text-lg leading-tight mt-0.5">{m.name}</h3>
                  <p className={`text-sm mt-1 leading-relaxed ${featured ? 'text-slate-300' : 'text-ink-mute'}`}>{m.desc}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-medium ${featured ? 'text-slate-400' : 'text-ink-faint'}`}>{m.meta}</span>
                    <span className={`text-xs font-bold inline-flex items-center gap-1 ${featured ? 'text-white' : 'text-brand'}`}>Indítás <ArrowRight size={14} /></span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Learn */
const TABS = [['words', 'Szavak'], ['practice', 'Szógyakorló'], ['sentences', 'Mondatok'], ['lab', 'Word Lab'], ['grammar', 'Nyelvtan'], ['focus', 'Gyakorlandó'], ['homework', 'Házi']];
const TOPICS = ['', 'Üzlet', 'Munka', 'Meeting', 'E-mail', 'Pénzügy', 'Állásinterjú', 'Utazás', 'Repülőtér', 'Szálloda', 'Étterem', 'Vásárlás', 'Közlekedés', 'Egészség', 'Technológia', 'Oktatás', 'Gyártás', 'Logisztika', 'Ügyfélszolgálat', 'Hétköznapok', 'Otthon'];

export function LearnView({ onPlay, onWordPractice, openLive }) {
  const { data } = useStore();
  const [tab, setTab] = useState('words');
  return (
    <div className="px-5 pt-5 space-y-4">
      <div className="flex gap-1 rounded-full bg-slate-100 p-1 overflow-x-auto livo-scroll">
        {TABS.map(([id, label]) => (
          <button key={id} data-testid={`learn-tab-${id}`} onClick={() => setTab(id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors ${tab === id ? 'bg-white text-brand shadow-soft' : 'text-ink-mute'}`}>{label}</button>
        ))}
      </div>
      {tab === 'words' && <WordBank data={data} />}
      {tab === 'practice' && <WordPracticeSetup data={data} onStart={onWordPractice} onLiveStart={(task) => openLive?.('vocabulary', { initialTask: task })} />}
      {tab === 'sentences' && <QuestionPracticeRoom defaultLevel={data.profile?.cefr || 'B1'} />}
      {tab === 'lab' && <WordLab data={data} onPlay={onPlay} />}
      {tab === 'grammar' && <GrammarPane data={data} />}
      {tab === 'focus' && <PracticeFocusPane data={data} />}
      {tab === 'homework' && <HomeworkPane data={data} />}
    </div>
  );
}

function WordBank({ data }) {
  const { saveVocabulary, deleteVocabulary } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ term: '', meaning: '', example: '' });
  let list = data.vocabulary.filter(v => ((v.term || '') + ' ' + (v.meaning || '')).toLowerCase().includes(q.toLowerCase()));
  if (filter === 'saved') list = list.filter(v => v.saved);
  if (filter === 'due') list = list.filter(v => v.status === 'uncertain' || v.status === 'learning');
  if (filter === 'hard') list = list.filter(v => (v.status === 'uncertain') || (v.mastery ?? 40) < 60 || (v.wrong_count || 0) > (v.correct_count || 0));
  list = [...list].sort((a, b) => (a.mastery ?? 50) - (b.mastery ?? 50));
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-soft ring-1 ring-slate-100">
        <Search size={16} className="text-ink-faint" />
        <input data-testid="word-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Keresés a szóbankban" className="flex-1 bg-transparent text-sm outline-none" />
        <span className="text-xs text-ink-faint">{list.length} szó</span>
      </div>
      <div className="flex gap-2 overflow-x-auto livo-scroll">
        {[['all', 'Összes'], ['saved', '★ Mentett'], ['due', 'Ismétlendő'], ['hard', 'Nehéz szavak']].map(([id, l]) => (
          <button key={id} onClick={() => setFilter(id)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${filter === id ? 'bg-brand text-white' : 'bg-white text-ink-mute ring-1 ring-slate-200'}`}>{l}</button>
        ))}
        <button data-testid="add-word-btn" onClick={() => setAdding(a => !a)} className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold bg-emerald2-bg text-emerald2 inline-flex items-center gap-1"><Plus size={13} /> Új szó</button>
      </div>
      {adding && (
        <div className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 space-y-2">
          <input value={form.term} onChange={e => setForm({ ...form, term: e.target.value })} placeholder="Angol (pl. so far)" className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none" data-testid="add-word-en" />
          <input value={form.meaning} onChange={e => setForm({ ...form, meaning: e.target.value })} placeholder="Magyar (pl. eddig)" className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none" data-testid="add-word-hu" />
          <button data-testid="add-word-save" onClick={async () => { if (!form.term && !form.meaning) return toast.error('Írj be egy szót.'); const w = await saveVocabulary({ ...form, source: 'manual', sourceLanguage: form.term ? 'en' : 'hu' }); if (w) { setForm({ term: '', meaning: '', example: '' }); setAdding(false); } }} className="w-full rounded-xl bg-brand text-white text-sm font-semibold py-2.5 active:scale-95 transition-transform">Mentés a szavaimhoz</button>
        </div>
      )}
      <div className="space-y-2">
        {list.length === 0 && <div className="text-center text-sm text-ink-faint py-10">Itt még nincs szó.</div>}
        {list.map(v => (
          <div key={v.id || v.term} data-testid={`word-row-${v.term}`} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft ring-1 ring-slate-100">
            <div className="flex-1 min-w-0">
              <b className="text-sm text-ink flex items-center gap-1">{v.saved && <Star size={12} className="text-amber2 fill-amber2" />}{v.term || '—'}</b>
              <div className="text-xs text-ink-mute truncate">{v.meaning || 'Jelentés még nincs'}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${v.mastery ?? 40}%` }} /></div>
                <span className="text-[10px] text-ink-faint w-8 text-right">{v.mastery ?? 40}%</span>
              </div>
            </div>
            <button data-testid={`word-delete-${v.term}`} onClick={() => { if (window.confirm(`Törlöd? ${v.term || ''}`)) deleteVocabulary(v.id || `term:${v.term}`); }} className="h-8 w-8 grid place-items-center rounded-full text-ink-faint hover:text-rose2 hover:bg-rose2-bg transition-colors"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordPracticeSetup({ data, onStart, onLiveStart }) {
  const [source, setSource] = useState('saved');
  const [mode, setMode] = useState('mixed');
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoSaveMistakes, setAutoSaveMistakes] = useState(true);

  const saved = useMemo(() => [...(data.vocabulary || [])].sort((a, b) => (a.mastery ?? 40) - (b.mastery ?? 40)), [data.vocabulary]);
  const hard = useMemo(() => saved.filter(w => (w.status === 'uncertain') || (w.mastery ?? 40) < 60 || (w.wrong_count || 0) > (w.correct_count || 0)), [saved]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let pack = source === 'hard' ? hard.slice(0, count) : saved.slice(0, count);
      if (source === 'fixed') {
        pack = FIXED_STARTER_TASKS
          .filter(t => t.type === 'translate_to_english' || t.type === 'vocabulary_recall')
          .slice(0, count)
          .map(t => ({ id: t.id, term: t.expected_answer, meaning: t.display_text, learningTask: t, mastery: 40, status: 'uncertain' }));
      }
      if (source === 'recommended') {
        const r = await api('/dictionary/recommend', {
          method: 'POST',
          body: JSON.stringify({ topic: normalizeSpeechText(topic), level: data.profile?.cefr || 'B1', count: Math.max(count, 8) }),
        });
        pack = Array.isArray(r.words) ? r.words.slice(0, count) : [];
      }
      if (!pack.length) throw new Error(source === 'hard' ? 'Most nincs nehéz szó a listádban.' : 'Ehhez a gyakorláshoz még nincs elég szó.');
      onStart(pack, { source, mode: source === 'fixed' ? 'translation' : mode, count: Math.min(count, pack.length), autoSaveMistakes: source === 'fixed' ? false : autoSaveMistakes });
    } catch (e) {
      toast.error(e.message || 'Nem sikerült elindítani a szógyakorlót.');
    } finally {
      setBusy(false);
    }
  };

  const modes = [
    ['mixed', 'Vegyes', 'A leggyengébb készségedet választja: jelentés · HU→EN · helyesírás · kiejtés', true],
    ['translation', 'Magyar → angol', 'Fix feladat: a magyar jelentésből mondd vagy írd be az angol szót', false],
    ['pronounce', 'Kiejtés', 'Hallgasd, ismételd, lassítsd vagy szótagold', false],
    ['dictation', 'Hallás utáni írás', 'Csak hallod a szót, neked kell leírni', false],
    ['missing', 'Hiányzó betűk', 'Egészítsd ki a hallott szót', false],
    ['sound', 'Hangcsapdák', 'ship/sheep · th · w/v · a/e', false],
  ];

  return (
    <div className="space-y-4" data-testid="word-practice-setup">
      <section className="rounded-[1.35rem] bg-task-bg text-task-text p-5 shadow-card">
        <span className="text-[10px] tracking-[0.2em] font-bold text-task-accent">KÜLÖN A LIVE BESZÉLGETÉSTŐL</span>
        <h3 className="font-heading font-bold text-xl mt-1">Precíz szógyakorló</h3>
        <p className="text-sm text-slate-300 mt-1">A rendszer tudja, mi a feladat. Nincs töltelékduma és nincs transcriptből kitalált UI.</p>
        <div className="mt-3 inline-flex rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300">0 AI TOKEN · ESZKÖZHANG</div>
      </section>

      <section>
        <div className="text-xs font-semibold text-ink-mute mb-2">Miből gyakorolj?</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['saved', 'Szavaim', `${saved.length} szó`],
            ['hard', 'Nehéz', `${hard.length} szó`],
            ['recommended', 'Ajánlott', 'Helyi válogatás · 0 token'],
            ['fixed', 'Fix kérdések', `${FIXED_STARTER_TASKS.length} ellenőrzött feladat`],
          ].map(([id, title, sub]) => (
            <button key={id} onClick={() => setSource(id)} className={`rounded-2xl p-3 text-left ring-1 transition-all ${source === id ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-slate-100'}`}>
              <b className="text-sm block">{title}</b><span className={`text-[10px] ${source === id ? 'text-white/70' : 'text-ink-faint'}`}>{sub}</span>
            </button>
          ))}
        </div>
        {source === 'recommended' && (
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Téma opcionális: üzlet, utazás, IT…" className="mt-2 w-full rounded-full bg-white px-4 py-2.5 text-sm outline-none shadow-soft ring-1 ring-slate-100" />
        )}
        {source === 'fixed' && (
          <div className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <div className="text-xs text-ink-mute">Ugyanaz a fix feladat kétféleképp jelenik meg: itt gyakorlókártyaként, Live-ban pedig a tanár kimondja és külön task cardként marad fent.</div>
            <button
              data-testid="fixed-task-live"
              onClick={() => onLiveStart?.(FIXED_STARTER_TASKS[0])}
              className="mt-3 w-full rounded-xl bg-brand-soft text-brand py-2.5 text-sm font-bold"
            >
              Próbáld Live-ban: „alma” → apple
            </button>
          </div>
        )}
      </section>

      <section>
        <div className="text-xs font-semibold text-ink-mute mb-2">Hogyan gyakorolj?</div>
        <div className="space-y-2">
          {modes.map(([id, title, sub, recommended]) => (
            <button key={id} onClick={() => setMode(id)} className={`w-full rounded-2xl p-3.5 text-left ring-1 transition-all ${mode === id ? 'bg-brand-soft ring-brand/30' : 'bg-white ring-slate-100'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <b className="text-sm text-ink">{title}</b>
                  {recommended && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">🔥 AJÁNLOTT</span>}
                </div>
                {mode === id && <Check size={15} className="text-brand shrink-0" />}
              </div>
              <p className="text-xs text-ink-mute mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="text-xs font-semibold text-ink-mute mb-2">Kör hossza</div>
        <div className="grid grid-cols-3 gap-2">
          {[5, 10, 15].map(n => <button key={n} onClick={() => setCount(n)} className={`rounded-xl py-2.5 text-sm font-semibold ${count === n ? 'bg-brand text-white' : 'bg-white text-ink-mute ring-1 ring-slate-200'}`}>{n} szó{n === 5 ? ' · ~3 perc' : ''}</button>)}
        </div>
      </section>

      {source === 'recommended' && (
        <label className="flex items-center justify-between rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <span><b className="text-sm text-ink block">Hibás szavak mentése</b><small className="text-xs text-ink-mute">A nehéz ajánlott szó bekerül a saját listádba.</small></span>
          <input type="checkbox" checked={autoSaveMistakes} onChange={e => setAutoSaveMistakes(e.target.checked)} className="h-5 w-5 accent-brand" />
        </label>
      )}

      <button data-testid="start-word-practice" disabled={busy} onClick={start} className="w-full rounded-2xl bg-brand text-white py-3.5 font-bold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <AudioLines size={17} />} Gyakorlás indítása
      </button>
    </div>
  );
}

function WordLab({ data, onPlay }) {
  const [topic, setTopic] = useState('');
  const [custom, setCustom] = useState('');
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [dictStatus, setDictStatus] = useState(null);
  useEffect(() => { api('/dictionary/status').then(setDictStatus).catch(() => {}); }, []);
  const games = [['swipe', 'Swipe Match', 'Húzd a jó jelentés felé'], ['quick', 'Gyors kör', 'Feleletválasztós'], ['match', 'Párosító', 'Kösd össze a párokat'], ['memory', 'Memory', 'Memóriajáték']];
  const label = normalizeSpeechText(custom || topic) || 'Random';
  const launch = async (id) => {
    if (busy) return;
    const chosen = normalizeSpeechText(custom || topic).slice(0, 80);
    setBusy(id);
    try {
      const r = await api('/game/topic', { method: 'POST', body: JSON.stringify({ topic: chosen, level: data.profile?.cefr || 'B1', count }) });
      const words = Array.isArray(r.words) ? r.words : [];
      if (words.length < 4) throw new Error('Túl kevés helyi szó ehhez a témához. Próbálj másik témát vagy Randomot.');
      onPlay(words, chosen || 'Random', id);
    } catch (e) { toast.error(e.message || 'Nem sikerült szócsomagot készíteni.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-[1.35rem] bg-task-bg text-task-text p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] font-bold text-task-accent">WORD LAB · HELYI SZÓTÁR</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-extrabold text-emerald-300">0 AI TOKEN</span>
          {dictStatus?.ready && <span className="text-[9px] font-bold text-slate-400">{Number(dictStatus.practiceEligible || 0).toLocaleString('hu-HU')} gyakorló szó</span>}
        </div>
        <h3 className="font-heading font-bold text-lg mt-1 leading-tight">Válassz témát, majd indíts egy játékot.</h3>
        <p className="text-sm text-slate-300 mt-1">A csomagot a helyi angol–magyar szótár és a saját szinted alapján válogatjuk. Gyors, kiszámítható, tokenmentes.</p>
      </div>

      <div>
        <div className="text-xs font-semibold text-ink-mute mb-2">Téma</div>
        <div className="flex gap-2 overflow-x-auto livo-scroll pb-1">
          {TOPICS.map(tp => (
            <button key={tp || 'random'} onClick={() => { setTopic(tp); setCustom(''); }} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${topic === tp && !custom ? 'bg-brand text-white' : 'bg-white text-ink-mute ring-1 ring-slate-200'}`}>{tp || '✦ Random'}</button>
          ))}
        </div>
        <input data-testid="wordlab-topic" value={custom} onChange={e => { setCustom(e.target.value); setTopic(''); }} placeholder="…vagy pontos kulcsszó (pl. invoice, ingatlan)" className="mt-2 w-full rounded-full bg-white px-4 py-2.5 text-sm outline-none shadow-soft ring-1 ring-slate-100" />
      </div>

      <div>
        <div className="text-xs font-semibold text-ink-mute mb-2">Hány szó legyen?</div>
        <div className="flex gap-2">
          {[5, 10, 15, 20, 30].map(n => (
            <button key={n} onClick={() => setCount(n)} className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${count === n ? 'bg-brand text-white' : 'bg-white text-ink-mute ring-1 ring-slate-200'}`}>{n}</button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-heading font-bold text-ink text-sm">Indíts egy játékot ehhez: <span className="text-brand">{label}</span></h4>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {games.map(([id, title, sub]) => {
            const loading = busy === id;
            return (
              <button key={id} data-testid={`game-${id}`} disabled={!!busy} onClick={() => launch(id)} className={`relative rounded-2xl p-4 text-left shadow-soft ring-1 ring-slate-100 bg-white text-ink transition-all active:scale-[.97] disabled:opacity-60 ${loading ? 'ring-2 ring-brand' : ''}`}>
                <div className="font-heading font-bold text-sm flex items-center gap-1.5">{title}{loading && <Loader2 size={13} className="animate-spin text-brand" />}</div>
                <div className="text-[11px] text-ink-mute mt-0.5">{loading ? 'Szavakat állítok össze…' : sub}</div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-ink-faint mt-2 text-center">FreeDict-alapú helyi katalógus · a szint gyakorisági becslés, nem hivatalos CEFR-besorolás.</p>
      </div>
    </div>
  );
}

function GrammarPane({ data }) {
  return (
    <div className="space-y-3">
      {data.grammar.map((g, i) => (
        <div key={i} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
          <div className="flex items-center justify-between"><small className="text-xs text-ink-mute">{g.mastery}% · {g.trend}</small><span className="text-xs font-semibold text-brand">{g.title}</span></div>
          <p className="text-sm text-rose2 line-through mt-2">{g.original}</p>
          <p className="text-sm text-emerald2 font-semibold">{g.corrected}</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${g.mastery}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function PracticeFocusPane({ data }) {
  const { deletePracticeFocus } = useStore();
  const items = data.practiceFocus || [];
  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-soft ring-1 ring-slate-100">
          <Bookmark size={22} className="mx-auto text-brand" />
          <b className="block text-sm text-ink mt-2">Még nincs mentett gyakorlási fókusz.</b>
          <p className="text-xs text-ink-mute mt-1">Szituációk és óraértékelések végén egy koppintással ide mentheted, amit újra gyakorolnál.</p>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 flex items-start gap-3">
          <span className="h-9 w-9 rounded-xl bg-brand-soft text-brand grid place-items-center shrink-0"><Bookmark size={16} /></span>
          <div className="flex-1 min-w-0">
            <b className="text-sm text-ink block">{item.title}</b>
            {item.detail && <p className="text-xs text-ink-mute mt-1">{item.detail}</p>}
            {item.scenarioId && <span className="inline-block mt-2 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-ink-faint">{item.scenarioId}</span>}
          </div>
          <button onClick={() => deletePracticeFocus(item.id)} className="h-8 w-8 rounded-full grid place-items-center text-ink-faint hover:text-rose2 hover:bg-rose2-bg"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}

function HomeworkPane({ data }) {
  const { toggleHomework } = useStore();
  return (
    <div className="space-y-2">
      {(data.homework || []).length === 0 && <div className="text-center text-sm text-ink-faint py-10">Nincs aktuális házi.</div>}
      {(data.homework || []).map(h => (
        <label key={h.id} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100 cursor-pointer">
          <input type="checkbox" checked={!!h.done} onChange={e => toggleHomework(h.id, e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
          <span><b className="text-sm text-ink block">{h.title}</b><small className="text-xs text-ink-mute">{h.detail} · {h.minutes || 3} perc</small></span>
        </label>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ Progress */
export function ProgressView({ data }) {
  const s = data.stats;
  const vals = [8, 0, 12, 6, 0, 7, 5], days = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
  const cards = [
    { icon: Clock, label: 'Összes beszéd', val: `${s.totalMinutes || 0} perc`, sub: 'ezen a héten +' + (s.weekMinutes || 0) },
    { icon: Check, label: 'Stabil szókincs', val: data.vocabulary.filter(v => v.status === 'stable').length, sub: `${data.vocabulary.filter(v => v.status === 'learning').length} tanulás alatt` },
    { icon: Flame, label: 'Sorozat', val: `${computeStreak(data.sessions || []).streak} nap`, sub: 'Rendszeres gyakorlás' },
    { icon: Trophy, label: 'Szintbecslés', val: data.profile.cefr || 'B1', sub: 'Nem hivatalos CEFR' },
  ];
  return (
    <div className="px-5 pt-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={i} className="rounded-2xl bg-white p-4 shadow-soft ring-1 ring-slate-100">
            <c.icon size={18} className="text-brand" />
            <div className="mt-2 font-heading font-extrabold text-xl text-ink">{c.val}</div>
            <div className="text-[11px] text-ink-mute">{c.label}</div>
            <div className="text-[10px] text-ink-faint mt-1">{c.sub}</div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <h3 className="font-heading font-bold text-ink text-sm mb-4">Heti beszédidő</h3>
        <div className="flex items-end justify-between gap-2 h-32">
          {vals.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-ink-faint">{v}</span>
              <div className="w-full rounded-t-lg bg-brand/80" style={{ height: `${Math.max(6, v / 14 * 100)}%` }} />
              <span className="text-[9px] text-ink-mute">{days[i]}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <h3 className="font-heading font-bold text-ink text-sm mb-3">Visszatérő minták</h3>
        <div className="space-y-3">
          {data.grammar.slice(0, 4).map((g, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1"><div className="text-xs text-ink-soft mb-1">{g.pattern}</div><div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${g.mastery}%` }} /></div></div>
              <b className="text-sm text-ink w-10 text-right">{g.mastery}%</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Profile */
export function ProfileView({ onTeacher }) {
  const { data, saveProfile, resetLearning } = useStore();
  const p = data.profile;
  const t = TEACHERS[p.teacher] || TEACHERS.james;
  const set = (patch) => saveProfile({ profile: patch });
  const rem = Math.max(0, (data.subscription.includedMinutes || 0) - (data.subscription.usedMinutes || 0));
  return (
    <div className="px-5 pt-5 space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-3"><h3 className="font-heading font-bold text-ink">Tanár és hang</h3><button onClick={onTeacher} className="text-xs font-semibold text-brand">Csere</button></div>
        <div className="flex items-center gap-3"><img alt={t.name} src={t.img} className="h-14 w-14 rounded-2xl object-cover" /><div><b className="text-ink">{t.name}</b><p className="text-xs text-ink-mute">{t.desc} · {t.sub}</p></div></div>
        <div className="mt-3 text-[11px] text-ink-faint bg-slate-50 rounded-xl px-3 py-2">A hallott hang AI-generált, nem emberi hang.</div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100 space-y-3">
        <h3 className="font-heading font-bold text-ink">Tanítási stílus</h3>
        <Select label="Javítás gyakorisága" value={p.correctionStyle || 'balanced'} onChange={v => set({ correctionStyle: v })} options={[['relaxed', 'Lazább'], ['balanced', 'Kiegyensúlyozott'], ['strict', 'Szigorú']]} testid="sel-correction" />
        <Select label="Magyar segítség" value={p.huHelp || 'on_request'} onChange={v => set({ huHelp: v })} options={[['often', 'Gyakran'], ['on_request', 'Ha kérem'], ['emergency', 'Csak végszükségben']]} testid="sel-hu" />
        <Select label="Heti cél" value={String(p.weeklyMinutes || 120)} onChange={v => set({ weeklyMinutes: Number(v) })} options={[['60', '60 perc'], ['120', '120 perc'], ['180', '180 perc'], ['300', '300 perc']]} testid="sel-goal" />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-2"><h3 className="font-heading font-bold text-ink">Tanulási út</h3><span className="text-[10px] font-bold text-brand bg-brand-soft rounded-full px-2.5 py-1">{p.learningPath === 'guided' ? 'Lépésről lépésre' : 'Beszélgetős'}</span></div>
        <div className="flex gap-2 mt-2">
          {[['conversation', 'Beszélgetve'], ['guided', 'Lépésről lépésre']].map(([id, l]) => (
            <button key={id} onClick={() => set({ learningPath: id })} className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${(p.learningPath === 'guided' ? 'guided' : 'conversation') === id ? 'bg-brand text-white' : 'bg-slate-50 text-ink-mute'}`}>{l}</button>
          ))}
        </div>
      </div>

      <SessionHistory sessions={data.sessions || []} />

      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-3"><h3 className="font-heading font-bold text-ink">Előfizetés</h3><span className="text-[10px] font-bold text-ink-mute bg-slate-100 rounded-full px-2.5 py-1">{data.subscription.plan}</span></div>
        <div className="font-heading font-extrabold text-2xl text-ink">{rem} perc</div>
        <div className="text-xs text-ink-mute">maradt ebben az időszakban</div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-brand rounded-full" style={{ width: `${pct(rem / (data.subscription.includedMinutes || 1) * 100)}%` }} /></div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100">
        <h3 className="font-heading font-bold text-ink">Adatvédelem</h3>
        <p className="text-xs text-ink-mute mt-1">A nyers hangot az MVP nem tárolja. A transcript és a memória a személyre szabást szolgálja.</p>
        <button data-testid="reset-btn" onClick={() => { if (window.confirm('Biztosan törlöd a tanulási adatokat?')) resetLearning(); }} className="mt-3 w-full rounded-xl bg-slate-100 text-ink-soft text-sm font-semibold py-2.5">Tanulási adatok törlése</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Session history */
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'short' }); } catch { return ''; }
};

function SessionHistory({ sessions }) {
  const [open, setOpen] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return sessions;
    return sessions.filter(s => {
      const a = s.summary || {};
      const hay = [
        a.headline, a.next_focus, MODE_NAMES[s.mode], s.mode, (TEACHERS[s.teacher] || {}).name,
        ...(a.wins || []),
        ...(a.corrections || []).flatMap(c => [c.original, c.corrected, c.reason, c.type]),
        ...(a.vocabulary || []).flatMap(v => [v.term, v.meaning]),
        ...(a.homework || []).flatMap(h => [h.title, h.detail]),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, q]);
  const list = (showAll || q) ? filtered : filtered.slice(0, 5);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-soft ring-1 ring-slate-100" data-testid="session-history">
      <div className="flex items-center gap-2 mb-3">
        <History size={16} className="text-brand" />
        <h3 className="font-heading font-bold text-ink">Óratörténet</h3>
        <span className="ml-auto text-[10px] font-bold text-ink-mute bg-slate-100 rounded-full px-2.5 py-1">{sessions.length} óra</span>
      </div>
      {sessions.length > 0 && (
        <label className="relative block mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input data-testid="history-search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Keresés téma, szó vagy javított hiba szerint…"
            className="w-full rounded-full bg-slate-50 pl-9 pr-8 py-2.5 text-sm outline-none ring-1 ring-slate-100 focus:ring-brand/40 transition-shadow" />
          {query && <button data-testid="history-search-clear" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 grid place-items-center rounded-full bg-slate-200 text-ink-mute"><X size={11} /></button>}
        </label>
      )}
      {sessions.length === 0 && <p className="text-sm text-ink-faint text-center py-6">Még nincs lezárt órád. Az első óra után itt találod az értékeléseket.</p>}
      {sessions.length > 0 && filtered.length === 0 && <p data-testid="history-no-match" className="text-sm text-ink-faint text-center py-6">Nincs találat erre: „{query}”.</p>}
      <div className="space-y-2">
        {list.map(sess => {
          const t = TEACHERS[sess.teacher] || TEACHERS.james;
          const mins = Math.max(1, Math.round((sess.durationSeconds || 0) / 60));
          return (
            <button key={sess.id} data-testid={`history-item-${sess.id}`} onClick={() => setOpen(sess)} className="w-full flex items-center gap-3 rounded-2xl bg-slate-50 p-3 text-left active:scale-[.98] transition-transform">
              <img alt={t.name} src={t.img} className="h-10 w-10 rounded-xl object-cover shrink-0" />
              <span className="flex-1 min-w-0">
                <small className="text-[10px] text-ink-mute font-semibold">{fmtDate(sess.createdAt)} · {t.name} · {MODE_NAMES[sess.mode] || sess.mode} · {mins} perc</small>
                <b className="block text-sm text-ink truncate">{sess.summary?.headline || 'Lezárt óra'}</b>
              </span>
              <ChevronRight size={16} className="text-ink-faint shrink-0" />
            </button>
          );
        })}
      </div>
      {!q && sessions.length > 5 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-3 w-full text-center text-xs font-semibold text-brand">{showAll ? 'Kevesebb' : `Mind a ${sessions.length} óra`}</button>
      )}
      {open && <SessionDetail session={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SessionDetail({ session, onClose }) {
  const a = session.summary || {};
  const t = TEACHERS[session.teacher] || TEACHERS.james;
  const mins = Math.max(1, Math.round((session.durationSeconds || 0) / 60));
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" data-testid="history-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto livo-scroll bg-background rounded-t-[2rem] p-6 pb-10">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 mb-4" />
        <button data-testid="history-close" onClick={onClose} className="absolute top-5 right-5 h-8 w-8 grid place-items-center rounded-full bg-slate-100 text-ink-mute"><X size={15} /></button>
        <div className="flex items-center gap-3">
          <img alt={t.name} src={t.img} className="h-12 w-12 rounded-2xl object-cover" />
          <div>
            <small className="text-[10px] tracking-widest font-bold text-ink-mute">{fmtDate(session.createdAt)} · {MODE_NAMES[session.mode] || session.mode} · {mins} PERC</small>
            <h2 className="font-heading font-extrabold text-xl text-ink leading-tight">{a.headline || 'Lezárt óra'}</h2>
          </div>
        </div>
        {a.next_focus && <p className="text-sm text-ink-mute mt-3 bg-slate-50 rounded-xl px-3 py-2.5">{a.next_focus}</p>}
        {(a.wins || []).length > 0 && (
          <HSection title="AMI JÓL MENT">
            {a.wins.map((w, i) => <div key={i} className="flex items-start gap-2 text-sm text-ink-soft py-1"><Check size={15} className="text-emerald2 mt-0.5 shrink-0" /><span>{w}</span></div>)}
          </HSection>
        )}
        {(a.corrections || []).length > 0 && (
          <HSection title="JAVÍTÁSOK">
            {a.corrections.map((c, i) => (
              <div key={i} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 mb-2">
                <div className="text-sm"><span className="text-rose2 line-through">{c.original}</span> <ArrowRight size={12} className="inline text-ink-faint" /> <strong className="text-emerald2">{c.corrected}</strong></div>
                <p className="text-xs text-ink-mute mt-1">{c.reason}</p>
              </div>
            ))}
          </HSection>
        )}
        {(a.vocabulary || []).length > 0 && (
          <HSection title="ÓRAI ÚJ SZAVAK">
            <div className="flex flex-wrap gap-2">
              {a.vocabulary.map((v, i) => <span key={i} className="rounded-full bg-brand-soft text-brand text-xs font-semibold px-3 py-1.5">{v.term} · {v.meaning}</span>)}
            </div>
          </HSection>
        )}
        {(a.homework || []).length > 0 && (
          <HSection title="KAPOTT HÁZI">
            {a.homework.map((h, i) => <div key={i} className="rounded-2xl bg-white p-3 shadow-soft ring-1 ring-slate-100 mb-2"><b className="text-sm text-ink">{h.title}</b><p className="text-xs text-ink-mute">{h.detail} · {h.minutes} perc</p></div>)}
          </HSection>
        )}
      </div>
    </div>
  );
}
const HSection = ({ title, children }) => <section className="mt-5"><div className="text-[11px] tracking-widest font-bold text-ink-mute mb-2">{title}</div>{children}</section>;

function Select({ label, value, onChange, options, testid }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-mute">{label}</span>
      <select data-testid={testid} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none appearance-none">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
