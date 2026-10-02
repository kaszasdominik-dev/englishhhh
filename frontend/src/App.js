import React, { Component, useEffect, useRef, useState } from 'react';
import '@/App.css';
import { StoreProvider, useStore } from '@/lib/store';
import { LiveEngine } from '@/lib/LiveEngine';
import { TEACHERS } from '@/lib/livo';
import { defaultLanguageMixForCefr } from '@/lib/liveAdaptation';
import { HomeView, PracticeView, LearnView, ProgressView, ProfileView } from '@/views';
import { TeacherSheet } from '@/components/TeacherSheet';
import { Onboarding } from '@/components/Onboarding';
import { LiveRoom } from '@/components/LiveRoom';
import { GameRoom } from '@/components/GameRoom';
import { WordPracticeRoom } from '@/components/WordPracticeRoom';
import SituationPractice from '@/components/SituationPractice';
import { Home, MessagesSquare, GraduationCap, TrendingUp, User, Mic } from 'lucide-react';

const NAV = [
  { id: 'home', label: 'Kezdőlap', icon: Home },
  { id: 'learn', label: 'Tanulás', icon: GraduationCap },
  { id: 'live', label: '', icon: Mic },
  { id: 'progress', label: 'Fejlődés', icon: TrendingUp },
  { id: 'profile', label: 'Profil', icon: User },
];

function useOnlineStatus() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine !== false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function Root() {
  const store = useStore();
  const online = useOnlineStatus();
  const { data, ready, error, retryBootstrap } = store;
  const [view, setView] = useState('home');
  const [teacherSheet, setTeacherSheet] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [game, setGame] = useState(null); // { pack, topic }
  const [wordPractice, setWordPractice] = useState(null); // { pack, config }
  const [situationOpen, setSituationOpen] = useState(false);

  const dataRef = useRef(data); dataRef.current = data;
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new LiveEngine({
      getVocab: () => dataRef.current?.vocabulary || [],
      saveVocab: (p) => store.saveVocabulary?.(p, { quiet: p?.quiet === true }),
      onData: (s) => store.setData?.(s),
      onFinished: () => setLiveOpen(false),
      saveLivePreference: (languageMix) => store.saveProfile?.({ profile: { liveLanguageMix: languageMix } }),
      savePracticeFocus: (p) => store.savePracticeFocus?.(p),
    });
  }
  const engine = engineRef.current;
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') window.__livoEngine = engine;
  // keep callbacks fresh
  useEffect(() => {
    engine.cb.saveVocab = (p) => store.saveVocabulary(p, { quiet: p?.quiet === true });
    engine.cb.onData = (s) => store.setData(s);
    engine.cb.getVocab = () => dataRef.current?.vocabulary || [];
    engine.cb.saveLivePreference = (languageMix) => store.saveProfile?.({ profile: { liveLanguageMix: languageMix } });
    engine.cb.savePracticeFocus = (p) => store.savePracticeFocus?.(p);
  });

  const openLive = (mode = 'free', options = {}) => {
    const teacher = TEACHERS[data?.profile?.teacher] ? data.profile.teacher : 'maya';
    const profile = data?.profile || {};
    const languageMix = ['english', 'mixed', 'hungarian'].includes(options.languageMix)
      ? options.languageMix
      : ['english', 'mixed', 'hungarian'].includes(profile.liveLanguageMix)
        ? profile.liveLanguageMix
        : defaultLanguageMixForCefr(profile.cefr || 'B1');
    engine.open({ mode, teacher, profile, vocab: data?.vocabulary || [], languageMix, initialTask: options.initialTask || null, scenario: options.scenario || null });
    setLiveOpen(true);
  };

  if (!ready) return <BootScreen />;
  if (error || !data) return <BootScreen error={error} onRetry={retryBootstrap} />;

  const onboarded = data.user?.onboarded;

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-[#E8ECF4] p-0 sm:p-6">
      <div data-testid="app-shell" className="relative w-full max-w-md bg-background sm:rounded-[2.5rem] sm:shadow-phone sm:ring-1 sm:ring-slate-200/70 overflow-hidden min-h-screen sm:min-h-0 sm:h-[calc(100vh-3rem)] flex flex-col">
        <TopBar view={view} data={data} onSettings={() => setView('profile')} onTeacher={() => setTeacherSheet(true)} />
        {!online && (
          <div role="status" className="z-20 mx-4 mt-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            Nincs internetkapcsolat · a helyi gyakorlók működhetnek, a Live és a mentés átmenetileg nem.
          </div>
        )}
        <main className="livo-scroll flex-1 overflow-y-auto overflow-x-hidden pb-28">
          {view === 'home' && <HomeView data={data} openLive={openLive} goto={setView} onTeacher={() => setTeacherSheet(true)} />}
          {view === 'practice' && <PracticeView data={data} openLive={openLive} onTeacher={() => setTeacherSheet(true)} onSituation={() => setSituationOpen(true)} />}
          {view === 'learn' && <LearnView openLive={openLive} onPlay={(pack, topic, id) => setGame({ pack, topic, id })} onWordPractice={(pack, config) => setWordPractice({ pack, config })} />}
          {view === 'progress' && <ProgressView data={data} />}
          {view === 'profile' && <ProfileView onTeacher={() => setTeacherSheet(true)} />}
        </main>
        <BottomNav view={view} setView={setView} onMic={() => openLive('free')} />

        {teacherSheet && <TeacherSheet engine={engine} liveOpen={liveOpen} onClose={() => setTeacherSheet(false)} />}
        {liveOpen && <LiveRoom engine={engine} />}
        {game && <GameRoom pack={game.pack} topic={game.topic} initialGame={game.id || 'quick'} onClose={() => setGame(null)} />}
        {wordPractice && <WordPracticeRoom pack={wordPractice.pack} config={wordPractice.config} onClose={() => setWordPractice(null)} />}
        {situationOpen && <SituationPractice data={data} onClose={() => setSituationOpen(false)} onLiveStart={(scenario) => { setSituationOpen(false); openLive('situation', { scenario }); }} />}
        {!onboarded && <Onboarding onDone={() => { setLiveOpen(false); setSituationOpen(false); setView('home'); }} />}
      </div>
    </div>
  );
}

function TopBar({ view, data, onSettings, onTeacher }) {
  const meta = {
    home: ['MAI FÓKUSZ', 'Beszélj többet.'],
    practice: ['LIVE BESZÉLGETÉS', 'Mit gyakoroljunk ma?'],
    learn: ['TANULÁS', 'Célzott gyakorlás'],
    progress: ['FEJLŐDÉS', 'Lásd, miben lettél jobb'],
    profile: ['PROFIL', 'A te beállításaid'],
  }[view] || ['LIVO', ''];
  const t = TEACHERS[data.profile?.teacher] || TEACHERS.james;
  return (
    <header className="glass sticky top-0 z-30 px-5 pt-5 pb-3 border-b border-slate-200/60">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-2xl bg-brand text-white grid place-items-center font-heading font-extrabold text-lg shadow-soft">L</div>
          <div className="leading-none">
            <div className="text-[10px] tracking-[0.22em] text-ink-mute font-semibold">{meta[0]}</div>
            <div className="font-heading font-bold text-ink text-[15px] mt-0.5">{meta[1]}</div>
          </div>
        </div>
        <button data-testid="topbar-teacher" onClick={onTeacher} className="flex items-center gap-2 rounded-full bg-white pl-1 pr-3 py-1 shadow-soft ring-1 ring-slate-200 active:scale-95 transition-transform">
          <img alt={t.name} src={t.img} className="h-7 w-7 rounded-full object-cover" />
          <span className="text-xs font-semibold text-ink-soft">{t.name}</span>
        </button>
      </div>
    </header>
  );
}

function BottomNav({ view, setView, onMic }) {
  return (
    <nav className="glass absolute bottom-0 inset-x-0 z-30 border-t border-slate-200/60 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        {NAV.map((n) => {
          const Icon = n.icon;
          if (n.id === 'live') {
            return (
              <button key="live" data-testid="nav-live" onClick={onMic} className="relative -mt-8 h-16 w-16 rounded-full bg-brand text-white grid place-items-center shadow-card ring-4 ring-background active:scale-95 transition-transform">
                <Icon size={26} />
              </button>
            );
          }
          const active = view === n.id;
          return (
            <button key={n.id} data-testid={`nav-${n.id}`} onClick={() => setView(n.id)} className={`flex-1 flex flex-col items-center gap-1 py-1.5 transition-colors ${active ? 'text-brand' : 'text-ink-faint'}`}>
              <Icon size={21} strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[10px] font-semibold ${active ? 'text-brand' : 'text-ink-faint'}`}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function BootScreen({ error, onRetry }) {
  return (
    <div className="min-h-screen grid place-items-center bg-[#E8ECF4] text-center p-8">
      <div className="w-full max-w-sm">
        <div className="mx-auto h-14 w-14 rounded-3xl bg-brand text-white grid place-items-center font-heading font-extrabold text-2xl shadow-card animate-floaty">L</div>
        <p className="mt-5 text-ink-mute font-medium">{error || 'LIVO betöltése…'}</p>
        {error && (
          <>
            <p className="mt-2 text-xs text-ink-faint">Helyi futtatásnál ellenőrizd, hogy a backend a 8000-es porton fut.</p>
            <button type="button" onClick={onRetry} className="mt-5 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white active:scale-95 transition-transform">
              Újrapróbálom
            </button>
          </>
        )}
      </div>
    </div>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[LIVO] UI crash', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen grid place-items-center bg-[#E8ECF4] p-6 text-center">
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-card ring-1 ring-slate-200">
          <div className="mx-auto h-14 w-14 rounded-3xl bg-rose-500 text-white grid place-items-center font-heading font-extrabold text-2xl">!</div>
          <h1 className="mt-4 font-heading text-xl font-extrabold text-ink">Valami megakadt.</h1>
          <p className="mt-2 text-sm text-ink-mute">A tanulási adataid nem vesznek el. Töltsd újra az alkalmazást, és próbáld újra.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white">
            Újratöltés
          </button>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </AppErrorBoundary>
  );
}
