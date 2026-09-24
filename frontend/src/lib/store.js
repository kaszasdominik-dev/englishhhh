import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { TEACHERS, normalizeSpeechText } from './livo';
import { toast } from 'sonner';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api('/bootstrap');
        setData(d);
      } catch (e) {
        setError('Nem sikerült betölteni a LIVO-t.');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const saveProfile = useCallback(async (patch = {}, onboarded = false) => {
    setData(prev => ({ ...prev, profile: { ...prev.profile, ...(patch.profile || {}) }, user: { ...prev.user, ...(patch.user || {}) } }));
    try {
      const r = await api('/profile', { method: 'POST', body: JSON.stringify({ profile: patch.profile, user: patch.user, onboarded }) });
      setData(r.state);
      return r.state;
    } catch { /* keep optimistic */ }
  }, []);

  const saveVocabulary = useCallback(async (payload, { quiet = false } = {}) => {
    const clean = { ...payload, term: normalizeSpeechText(payload.term || ''), meaning: normalizeSpeechText(payload.meaning || ''), example: normalizeSpeechText(payload.example || ''), saved: true };
    try {
      const r = await api('/vocabulary', { method: 'POST', body: JSON.stringify(clean) });
      setData(r.state);
      if (!quiet) toast.success(r.canonicalized ? 'Elmentve tiszta szótári alakban.' : 'Elmentve a Szavaimhoz.');
      return r.word;
    } catch (e) {
      if (e.code === 'INVALID_VOCAB' || e.code === 'VOCAB_VALIDATION_UNAVAILABLE' || e.status === 422) {
        if (!quiet) toast.error(e.message || 'Ez nem jó szóbank-bejegyzés.');
        return null;
      }
      if (!quiet) toast.error('Nem sikerült elmenteni a szót.');
      return null;
    }
  }, []);

  const deleteVocabulary = useCallback(async (id) => {
    try {
      const r = await api(`/vocabulary/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setData(r.state);
      toast.success('Szó törölve.');
    } catch { toast.error('Nem sikerült törölni a szót.'); }
  }, []);

  const toggleHomework = useCallback(async (id, done) => {
    setData(prev => ({ ...prev, homework: prev.homework.map(h => h.id === id ? { ...h, done } : h) }));
    try { const r = await api('/homework', { method: 'POST', body: JSON.stringify({ id, done }) }); setData(r.state); } catch { /* ignore */ }
  }, []);

  const resetLearning = useCallback(async () => {
    try { const r = await api('/privacy/reset', { method: 'DELETE' }); setData(r.state); toast.success('Tanulási adatok törölve.'); } catch { toast.error('Nem sikerült törölni.'); }
  }, []);

  const previewRef = useRef(null);
  const previewTeacher = useCallback(async (id) => {
    const t = TEACHERS[id]; if (!t) return;
    try {
      const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/voice-preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacher: id, text: t.preview }) });
      if (!r.ok) throw new Error('no api');
      const blob = await r.blob();
      if (previewRef.current) previewRef.current.pause();
      previewRef.current = new Audio(URL.createObjectURL(blob));
      await previewRef.current.play();
      toast(`${t.name} · AI-hangminta`);
    } catch {
      if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t.preview);
        u.lang = t.accent === 'Brit' ? 'en-GB' : 'en-US';
        u.rate = id === 'karen' ? 1.0 : id === 'vinnie' ? 0.91 : id === 'maya' ? 0.94 : 0.97;
        speechSynthesis.speak(u);
        toast('Böngészős hangminta · az élő órán az AI hangja szól');
      }
    }
  }, []);

  const value = { data, setData, ready, error, saveProfile, saveVocabulary, deleteVocabulary, toggleHomework, resetLearning, previewTeacher };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
