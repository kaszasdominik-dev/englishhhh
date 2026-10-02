import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { api, BACKEND_URL, clientHeaders } from './api';
import { TEACHERS, normalizeSpeechText } from './livo';
import { toast } from 'sonner';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const DEFAULT_STATE = {
  user: { onboarded: false },
  profile: { cefr: '', teacher: 'james', weeklyMinutes: 120, correctionStyle: 'balanced', huHelp: 'on_request', goal: 'general', interests: [], focus: 'General English', learningPath: 'conversation' },
  subscription: { plan: 'Próba', includedMinutes: 60, usedMinutes: 0 },
  stats: { totalMinutes: 0, weekMinutes: 0 },
  vocabulary: [],
  grammar: [],
  sessions: [],
  homework: [],
  practiceFocus: [],
};

export function normalizeState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  return {
    ...DEFAULT_STATE,
    ...state,
    user: { ...DEFAULT_STATE.user, ...(state.user || {}) },
    profile: { ...DEFAULT_STATE.profile, ...(state.profile || {}) },
    subscription: { ...DEFAULT_STATE.subscription, ...(state.subscription || {}) },
    stats: { ...DEFAULT_STATE.stats, ...(state.stats || {}) },
    vocabulary: Array.isArray(state.vocabulary) ? state.vocabulary : [],
    grammar: Array.isArray(state.grammar) ? state.grammar : [],
    sessions: Array.isArray(state.sessions) ? state.sessions : [],
    homework: Array.isArray(state.homework) ? state.homework : [],
    practiceFocus: Array.isArray(state.practiceFocus) ? state.practiceFocus : [],
  };
}

export function StoreProvider({ children }) {
  const [data, setDataRaw] = useState(null);
  const setData = useCallback((next) => {
    setDataRaw(prev => normalizeState(typeof next === 'function' ? next(prev ? normalizeState(prev) : normalizeState({})) : next));
  }, []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const bootstrapState = useCallback(async () => {
    setReady(false);
    setError(null);
    try {
      const d = await api('/bootstrap', { timeoutMs: 12000 });
      setData(d);
      return true;
    } catch (e) {
      setError(e?.message || 'Nem sikerült betölteni a LIVO-t.');
      return false;
    } finally {
      setReady(true);
    }
  }, [setData]);

  useEffect(() => { bootstrapState(); }, [bootstrapState]);

  const saveProfile = useCallback(async (patch = {}, onboarded = false) => {
    let before = null;
    setData(prev => {
      before = prev;
      return { ...prev, profile: { ...prev.profile, ...(patch.profile || {}) }, user: { ...prev.user, ...(patch.user || {}) } };
    });
    try {
      const r = await api('/profile', { method: 'POST', body: JSON.stringify({ profile: patch.profile, user: patch.user, onboarded }) });
      setData(r.state);
      return r.state;
    } catch (e) {
      if (before) setData(before);
      toast.error(e?.message || 'Nem sikerült menteni a beállítást.');
      return null;
    }
  }, [setData]);

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
    let before = null;
    setData(prev => {
      before = prev;
      return { ...prev, homework: (prev.homework || []).map(h => h.id === id ? { ...h, done } : h) };
    });
    try {
      const r = await api('/homework', { method: 'POST', body: JSON.stringify({ id, done }) });
      setData(r.state);
    } catch (e) {
      if (before) setData(before);
      toast.error(e?.message || 'Nem sikerült menteni a házit.');
    }
  }, [setData]);

  const savePracticeFocus = useCallback(async (payload) => {
    try {
      const r = await api('/practice-focus', { method: 'POST', body: JSON.stringify(payload || {}) });
      setData(r.state);
      toast.success('Elmentve a gyakorlandók közé.');
      return r.item;
    } catch (e) {
      toast.error(e.message || 'Nem sikerült elmenteni a gyakorlási témát.');
      return null;
    }
  }, []);

  const deletePracticeFocus = useCallback(async (id) => {
    try {
      const r = await api(`/practice-focus/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setData(r.state);
      toast.success('Törölve a gyakorlandók közül.');
    } catch { toast.error('Nem sikerült törölni.'); }
  }, []);

  const resetLearning = useCallback(async () => {
    try { const r = await api('/privacy/reset', { method: 'DELETE' }); setData(r.state); toast.success('Tanulási adatok törölve.'); } catch { toast.error('Nem sikerült törölni.'); }
  }, []);

  const previewRef = useRef(null);
  const previewTeacher = useCallback(async (id) => {
    const t = TEACHERS[id]; if (!t) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/voice-preview`, { method: 'POST', credentials: 'include', headers: clientHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ teacher: id, text: t.preview }) });
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

  const value = { data, setData, ready, error, retryBootstrap: bootstrapState, saveProfile, saveVocabulary, deleteVocabulary, toggleHomework, savePracticeFocus, deletePracticeFocus, resetLearning, previewTeacher };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
