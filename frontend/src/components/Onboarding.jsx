import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { TEACHERS, TEACHER_IDS } from '@/lib/livo';
import { ArrowRight, ArrowLeft, Play, Check } from 'lucide-react';
import { PlacementTest } from '@/components/PlacementTest';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1+'];

export function Onboarding({ onDone }) {
  const { data, saveProfile, previewTeacher } = useStore();
  const [step, setStep] = useState(0);
  const [teacher, setTeacher] = useState(data?.profile?.teacher || 'maya');
  const [path, setPath] = useState(data?.profile?.learningPath === 'guided' ? 'guided' : 'conversation');
  const [level, setLevel] = useState(data?.profile?.cefr || '');
  const [placementOpen, setPlacementOpen] = useState(false);

  const finish = async (cefr, placement = null, source = 'self_reported') => {
    const cleanLevel = cefr === 'C1+' ? 'C1' : cefr;
    await saveProfile({
      profile: {
        teacher,
        learningPath: path,
        cefr: cleanLevel || 'B1',
        placement: placement || {
          source,
          cefr: cleanLevel || 'B1',
          completedAt: new Date().toISOString(),
          note: 'A felhasználó által megadott becsült szint.',
        },
      },
      user: { onboarded: true },
    }, true);
    onDone('free');
  };

  if (placementOpen) {
    return (
      <div className="absolute inset-0 z-[60] bg-background overflow-y-auto livo-scroll" data-testid="onboarding-placement">
        <div className="min-h-full flex flex-col p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="h-9 w-9 rounded-2xl bg-brand text-white grid place-items-center font-heading font-extrabold text-lg">L</div>
            <div className="leading-none"><b className="font-heading text-ink">LIVO</b><div className="text-[10px] tracking-widest text-ink-mute">AI ANGOLTANÁR</div></div>
          </div>
          <PlacementTest
            onBack={() => setPlacementOpen(false)}
            onComplete={(result) => finish(result.cefr, result, 'adaptive_placement')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[60] bg-background overflow-y-auto livo-scroll" data-testid="onboarding">
      <div className="min-h-full flex flex-col p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-2xl bg-brand text-white grid place-items-center font-heading font-extrabold text-lg">L</div>
          <div className="leading-none"><b className="font-heading text-ink">LIVO</b><div className="text-[10px] tracking-widest text-ink-mute">AI ANGOLTANÁR</div></div>
        </div>

        {step === 0 && (
          <div className="flex-1 flex flex-col">
            <span className="text-[11px] tracking-[0.2em] font-bold text-brand">1 / 3 · VÁLASSZ STÍLUST</span>
            <h1 className="font-heading font-extrabold text-3xl text-ink mt-2 leading-tight text-balance">Milyen tanárral mersz tényleg beszélni?</h1>
            <p className="text-sm text-ink-mute mt-2">A személyiséget és a hangot később a Profilban is bármikor megváltoztathatod.</p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {TEACHER_IDS.map(id => {
                const t = TEACHERS[id]; const sel = teacher === id;
                return (
                  <div role="button" tabIndex={0} key={id} data-testid={`onb-teacher-${id}`} onClick={() => setTeacher(id)} className={`relative text-left rounded-2xl p-3 transition-all cursor-pointer ${sel ? 'ring-2 ring-brand bg-brand-soft' : 'ring-1 ring-slate-200 bg-white'}`}>
                    {sel && <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand text-white grid place-items-center"><Check size={12} /></span>}
                    <img alt={t.name} src={t.img} className="h-16 w-16 rounded-2xl object-cover bg-slate-100" />
                    <div className="mt-2 font-heading font-bold text-ink flex items-center gap-1.5">{t.name}<span className="text-[9px] font-bold text-brand bg-brand-soft rounded-full px-1.5 py-0.5">{t.badge}</span></div>
                    <p className="text-[11px] text-ink-mute leading-tight mt-0.5">{t.desc}</p>
                    <blockquote className="text-[11px] italic text-ink-soft mt-1.5">{t.quote}</blockquote>
                    <button onClick={(e) => { e.stopPropagation(); previewTeacher(id); }} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><Play size={11} /> Hangminta</button>
                  </div>
                );
              })}
            </div>
            <button data-testid="onb-next" onClick={() => setStep(1)} className="mt-6 w-full rounded-full bg-brand text-white font-semibold py-3.5 inline-flex items-center justify-center gap-2 active:scale-95 transition-transform">Tovább <ArrowRight size={16} /></button>
          </div>
        )}

        {step === 1 && (
          <div className="flex-1 flex flex-col">
            <button onClick={() => setStep(0)} className="inline-flex items-center gap-1 text-sm text-ink-mute mb-3"><ArrowLeft size={14} /> Tanár módosítása</button>
            <span className="text-[11px] tracking-[0.2em] font-bold text-brand">2 / 3 · HOGYAN TANULNÁL?</span>
            <h1 className="font-heading font-extrabold text-3xl text-ink mt-2 leading-tight text-balance">Te választod a tanulás útját.</h1>
            <div className="space-y-3 mt-5">
              {[
                { id: 'conversation', tag: 'SZABADABB', title: 'Beszélgetve tanulok', desc: 'Arról beszélsz, ami épp érdekel. A LIVO közben javít, szavakat ment és a hibáidból épít gyakorlatot.' },
                { id: 'guided', tag: 'STRUKTURÁLT', title: 'Vigyél végig az angolon', desc: 'A LIVO a megadott vagy felmért szintedből indul, majd lépésről lépésre halad veled.' },
              ].map(o => {
                const sel = path === o.id;
                return (
                  <button key={o.id} data-testid={`onb-path-${o.id}`} onClick={() => setPath(o.id)} className={`relative w-full text-left rounded-2xl p-4 transition-all ${sel ? 'ring-2 ring-brand bg-brand-soft' : 'ring-1 ring-slate-200 bg-white'}`}>
                    {sel && <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-brand text-white grid place-items-center"><Check size={12} /></span>}
                    <span className="text-[10px] tracking-widest font-bold text-ink-mute">{o.tag}</span>
                    <h3 className="font-heading font-bold text-lg text-ink">{o.title}</h3>
                    <p className="text-sm text-ink-mute mt-1">{o.desc}</p>
                  </button>
                );
              })}
            </div>
            <button data-testid="onb-path-next" onClick={() => setStep(2)} className="mt-6 w-full rounded-full bg-brand text-white font-semibold py-3.5 inline-flex items-center justify-center gap-2 active:scale-95 transition-transform">Tovább <ArrowRight size={16} /></button>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-ink-mute mb-3"><ArrowLeft size={14} /> Tanulási út módosítása</button>
            <span className="text-[11px] tracking-[0.2em] font-bold text-brand">3 / 3 · ANGOLODSZINT</span>
            <h1 className="font-heading font-extrabold text-3xl text-ink mt-2 leading-tight text-balance">Tudod, körülbelül milyen szinten vagy?</h1>
            <p className="text-sm text-ink-mute mt-2">Ha nem vagy biztos benne, a LIVO 10–14 adaptív kérdésből készít egy CEFR-alapú szintbecslést.</p>

            <div className="grid grid-cols-3 gap-2 mt-5">
              {LEVELS.map(l => (
                <button key={l} data-testid={`onb-level-${l}`} onClick={() => setLevel(l)} className={`rounded-2xl py-3.5 font-heading font-extrabold text-lg transition-all ${level === l ? 'bg-brand text-white ring-2 ring-brand' : 'bg-white text-ink ring-1 ring-slate-200'}`}>
                  {l}
                </button>
              ))}
            </div>

            <button data-testid="onb-placement" onClick={() => setPlacementOpen(true)} className="mt-4 w-full rounded-2xl bg-task-bg text-task-text p-4 text-left ring-1 ring-task-accent/30">
              <span className="text-[10px] tracking-widest font-bold text-task-accent">NEM TUDOM</span>
              <b className="block font-heading text-lg mt-0.5">Mérd fel a szintemet</b>
              <span className="block text-xs text-slate-300 mt-1">Adaptív nyelvtan · szókincs · olvasás · hallásértés</span>
            </button>

            <button data-testid="onb-finish" disabled={!level} onClick={() => finish(level)} className="mt-auto w-full rounded-full bg-brand text-white font-semibold py-3.5 inline-flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-40">
              Kezdjük <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
