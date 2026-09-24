import React, { useState } from 'react';
import { useStore } from '@/lib/store';
import { TEACHERS, TEACHER_IDS } from '@/lib/livo';
import { X, Play, Check } from 'lucide-react';
import { toast } from 'sonner';

export function TeacherSheet({ engine, liveOpen, onClose }) {
  const { data, saveProfile, previewTeacher } = useStore();
  const [draft, setDraft] = useState(data.profile.teacher || 'maya');
  const confirm = async () => {
    onClose();
    if (liveOpen && engine?.connected) { engine.setTeacher(draft); }
    await saveProfile({ profile: { teacher: draft } });
    toast.success(`${TEACHERS[draft].name} lett a tanárod.`);
  };
  return (
    <div className="absolute inset-0 z-50 flex items-end" data-testid="teacher-sheet">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full bg-background rounded-t-[2rem] p-5 pb-8 max-h-[88%] overflow-y-auto livo-scroll animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-300 mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-[10px] tracking-[0.2em] font-bold text-ink-mute">VÁLASSZ TANÁRT</span>
            <h2 className="font-heading font-bold text-xl text-ink">Melyik hanggal érzed jól magad?</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full bg-slate-100 text-ink-mute"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {TEACHER_IDS.map(id => {
            const t = TEACHERS[id]; const sel = draft === id;
            return (
              <div role="button" tabIndex={0} key={id} data-testid={`teacher-pick-${id}`} onClick={() => setDraft(id)} className={`relative text-left rounded-2xl p-3 transition-all cursor-pointer ${sel ? 'ring-2 ring-brand bg-brand-soft' : 'ring-1 ring-slate-200 bg-white'}`}>
                {sel && <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-brand text-white grid place-items-center"><Check size={12} /></span>}
                <img alt={t.name} src={t.img} className="h-14 w-14 rounded-2xl object-cover bg-slate-100" />
                <div className="mt-2 font-heading font-bold text-ink">{t.name}</div>
                <div className="text-[11px] text-ink-mute leading-tight">{t.accent} · {t.desc}</div>
                <button onClick={(e) => { e.stopPropagation(); previewTeacher(id); }} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand"><Play size={11} /> Hangminta</button>
              </div>
            );
          })}
        </div>
        <button data-testid="teacher-confirm" onClick={confirm} className="mt-4 w-full rounded-full bg-brand text-white font-semibold py-3.5 active:scale-95 transition-transform">Ezt a tanárt választom</button>
        <p className="text-center text-[11px] text-ink-faint mt-2">Az AI hangok nem valós személyek hangjai.</p>
      </div>
    </div>
  );
}
