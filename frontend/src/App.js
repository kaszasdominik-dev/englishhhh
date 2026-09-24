import React, { useEffect, useRef, useState } from 'react';
import '@/App.css';
import { StoreProvider, useStore } from '@/lib/store';
import { LiveEngine } from '@/lib/LiveEngine';
import { TEACHERS } from '@/lib/livo';
import { HomeView, PracticeView, LearnView, ProgressView, ProfileView } from '@/views';
import { TeacherSheet } from '@/components/TeacherSheet';
import { Onboarding } from '@/components/Onboarding';
import { LiveRoom } from '@/components/LiveRoom';
import { GameRoom } from '@/components/GameRoom';
import { Home, MessagesSquare, GraduationCap, TrendingUp, User, Mic } from 'lucide-react';

const NAV = [
  { id: 'home', label: 'Kezdőlap', icon: Home },
  { id: 'learn', label: 'Tanulás', icon: GraduationCap },
  { id: 'live', label: '', icon: Mic },
  { id: 'progress', label: 'Fejlődés', icon: TrendingUp },
  { id: 'profile', label: 'Profil', icon: User },
];

function Root() {
  const store = useStore();
  const { data, ready, error } = store;
  const [view, setView] = useState('home');
  const [teacherSheet, setTeacherSheet] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const [game, setGame] = useState(null); // { pack, topic }

  const dataRef = useRef(data); dataRef.current = data;
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new LiveEngine({
      getVocab: () => dataRef.current?.vocabulary || [],
      saveVocab: (p) => store.saveVocabulary?.(p, { quiet: false }),
      onData: (s) => store.setData?.(s),
      onFinished: () => setLiveOpen(false),
    });
  }
  const engine = engineRef.current;
  // keep callbacks fresh
  useEffect(() => {
    engine.cb.saveVocab = (p) => store.saveVocabulary(p, { quiet: false });
    engine.cb.onData = (s) => store.setData(s);
    engine.cb.getVocab = () => dataRef.current?.vocabulary || [];
  });

  const openLive = (mode = 'business') => {
    const teacher = TEACHERS[data?.profile?.teacher] ? data.profile.teacher : 'maya';
    const langMode = (data?.user?.locale || 'hu-HU').toLowerCase().startsWith('hu') ? 'hu' : 'en';
    engine.open({ mode, teacher, profile: data?.profile || {}, vocab: data?.vocabulary || [], langMode });
    setLiveOpen(true);
  };

  if (!ready) return <BootScreen />;
  if (error || !data) return <BootScreen error={error} />;

  const onboarded = data.user?.onboarded;

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-[#E8ECF4] p-0 sm:p-6">
      <div data-testid="app-shell" className="relative w-full max-w-md bg-background sm:rounded-[2.5rem] sm:shadow-phone sm:ring-1 sm:ring-slate-200/70 overflow-hidden min-h-screen sm:min-h-0 sm:h-[calc(100vh-3rem)] flex flex-col">
        <TopBar view={view} data={data} onSettings={() => setView('profile')} onTeacher={() => setTeacherSheet(true)} />
        <main className="livo-scroll flex-1 overflow-y-auto overflow-x-hidden pb-28">
          {view === 'home' && <HomeView data={data} openLive={openLive} goto={setView} onTeacher={() => setTeacherSheet(true)} />}
          {view === 'practice' && <PracticeView data={data} openLive={openLive} onTeacher={() => setTeacherSheet(true)} />}
          {view === 'learn' && <LearnView onPlay={(pack, topic, id) => setGame({ pack, topic, id })} />}
          {view === 'progress' && <ProgressView data={data} />}
          {view === 'profile' && <ProfileView onTeacher={() => setTeacherSheet(true)} />}
        </main>
        <BottomNav view={view} setView={setView} openLive={() => { setView('practice'); }} onMic={() => openLive(data?.profile?.focus === 'Business English' ? 'business' : 'business')} />

        {teacherSheet && <TeacherSheet engine={engine} liveOpen={liveOpen} onClose={() => setTeacherSheet(false)} />}
        {liveOpen && <LiveRoom engine={engine} />}
        {game && <GameRoom pack={game.pack} topic={game.topic} initialGame={game.id || 'quick'} onClose={() => setGame(null)} />}
        {!onboarded && <Onboarding onDone={(mode) => { if (mode) openLive(mode); }} />}
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

function BootScreen({ error }) {
  return (
    <div className="min-h-screen grid place-items-center bg-[#E8ECF4] text-center p-8">
      <div>
        <div className="mx-auto h-14 w-14 rounded-3xl bg-brand text-white grid place-items-center font-heading font-extrabold text-2xl shadow-card animate-floaty">L</div>
        <p className="mt-5 text-ink-mute font-medium">{error || 'LIVO betöltése…'}</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
