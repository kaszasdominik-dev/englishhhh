import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Volume2 } from 'lucide-react';
import {
  PLACEMENT_MAX_QUESTIONS,
  answerPlacementQuestion,
  buildPlacementResult,
  initialPlacementState,
  selectNextQuestion,
  shouldFinishPlacement,
} from '@/lib/placement';

const SKILL_LABELS = {
  grammar: 'Nyelvtan',
  vocabulary: 'Szókincs',
  reading: 'Olvasás',
  listening: 'Hallásértés',
};

function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  u.voice = voices.find(v => v.lang === 'en-US' && /Google|Microsoft/i.test(v.name))
    || voices.find(v => v.lang === 'en-US')
    || voices.find(v => v.lang?.startsWith('en'))
    || null;
  window.speechSynthesis.speak(u);
}

export function PlacementTest({ onComplete, onBack }) {
  const [state, setState] = useState(() => initialPlacementState());
  const [result, setResult] = useState(null);
  const question = useMemo(() => result ? null : selectNextQuestion(state), [state, result]);

  const answer = (choice) => {
    if (!question) return;
    const next = answerPlacementQuestion(state, question, choice);
    setState(next);
    if (shouldFinishPlacement(next) || !selectNextQuestion(next)) {
      setResult(buildPlacementResult(next));
    }
  };

  if (result) {
    return (
      <div className="flex-1 flex flex-col" data-testid="placement-result">
        <span className="text-[11px] tracking-[0.2em] font-bold text-brand">SZINTBECSLÉS KÉSZ</span>
        <h1 className="font-heading font-extrabold text-3xl text-ink mt-2">Becsült szinted: <span className="text-brand">{result.cefr}</span></h1>
        <p className="text-sm text-ink-mute mt-2">Ez LIVO CEFR-alapú szintbecslés, nem hivatalos nyelvvizsga.</p>

        <div className="grid grid-cols-2 gap-2 mt-5">
          {Object.entries(result.skills).map(([skill, level]) => (
            <div key={skill} className="rounded-2xl bg-white p-4 ring-1 ring-slate-100 shadow-soft">
              <div className="text-[10px] tracking-widest text-ink-faint">{SKILL_LABELS[skill] || skill}</div>
              <div className="font-heading font-extrabold text-xl text-ink mt-1">{level}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-brand-soft p-4 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-mute">Pontosság</span>
            <b className="text-brand">{result.accuracy}%</b>
          </div>
          <div className="flex items-center justify-between text-sm mt-1">
            <span className="text-ink-mute">Kérdések</span>
            <b className="text-ink">{result.questionCount}</b>
          </div>
        </div>

        <button data-testid="placement-complete" onClick={() => onComplete?.(result)} className="mt-auto w-full rounded-full bg-brand text-white font-semibold py-3.5 inline-flex items-center justify-center gap-2 active:scale-95 transition-transform">
          Ezzel a szinttel indulok <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (!question) return null;

  const progress = Math.min(100, Math.round(((state.history.length + 1) / PLACEMENT_MAX_QUESTIONS) * 100));

  return (
    <div className="flex-1 flex flex-col" data-testid="placement-test">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-ink-mute"><ArrowLeft size={14} /> Vissza</button>
        <span className="text-[11px] tracking-[0.18em] font-bold text-brand">SZINTFELMÉRŐ</span>
      </div>

      <div className="mt-4 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-[10px] tracking-widest font-bold text-ink-faint">{SKILL_LABELS[question.skill] || question.skill}</span>
        <span className="text-[10px] font-bold text-ink-faint">kb. 10–14 kérdés</span>
      </div>

      <section className="rounded-[1.5rem] bg-white p-5 ring-1 ring-slate-100 shadow-soft mt-2">
        <h2 className="font-heading font-bold text-xl text-ink leading-snug">{question.prompt}</h2>

        {question.audioText && (
          <button data-testid="placement-listen" onClick={() => speak(question.audioText)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft text-brand px-4 py-2.5 text-sm font-semibold">
            <Volume2 size={16} /> Meghallgatom
          </button>
        )}

        <div className="grid grid-cols-1 gap-2 mt-5">
          {question.options.map((option, i) => (
            <button
              key={option}
              data-testid={`placement-option-${i}`}
              onClick={() => answer(option)}
              className="w-full rounded-2xl bg-slate-50 hover:bg-brand-soft ring-1 ring-slate-100 px-4 py-3.5 text-left text-sm font-semibold text-ink active:scale-[.99] transition-all"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200 text-[11px] text-ink-mute mr-2">{String.fromCharCode(65 + i)}</span>
              {option}
            </button>
          ))}
        </div>

        <button onClick={() => answer('__dont_know__')} className="mt-4 w-full rounded-xl py-2.5 text-sm text-ink-mute font-semibold">
          Nem tudom
        </button>
      </section>

      <p className="text-[11px] text-ink-faint mt-4 text-center">Általános, hétköznapi angolt mérünk — nem a profilodból vagy korábbi témáidból választunk. A nehézség csak a válaszaid alapján változik.</p>
    </div>
  );
}
