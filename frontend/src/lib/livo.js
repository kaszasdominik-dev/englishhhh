// LIVO shared constants + ported pure helpers (from the original working app.js)

export const TEACHERS = {
  maya: { id: 'maya', name: 'Maya', initial: 'M', voice: 'marin', accent: 'Brit', desc: 'Kedves, lelkes, nagyon bátorító', sub: 'Sokat dicsér · türelmes · magyarul is segít', badge: 'Bátorító', quote: '„Nyugi, végigvezetlek rajta.”',
    preview: "Hi, I'm Maya. I'll make speaking feel easy, celebrate the things you do well, and help you fix mistakes without pressure.",
    img: 'https://images.unsplash.com/photo-1562337404-3044c84ac061?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzN8MHwxfHNlYXJjaHwyfHx3YXJtJTIwZnJpZW5kbHklMjB5b3VuZyUyMHdvbWFuJTIwcG9ydHJhaXQlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MHx8fHwxNzkwMjM1NDU3fDA&ixlib=rb-4.1.0&q=85', tint: 'from-rose-400 to-orange-300' },
  james: { id: 'james', name: 'James', initial: 'J', voice: 'cedar', accent: 'Brit', desc: 'Kedves, jópofa, természetes', sub: 'Humoros · sok pozitív visszajelzés · laza', badge: 'Jópofa', quote: '„Haladjunk lazán, de legyen eredménye.”',
    preview: "Hi, I'm James. We'll keep things relaxed, useful, and fun. If you make a mistake, we fix it and move on.",
    img: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxmdW5ueSUyMHlvdW5nJTIwbWFuJTIwcG9ydHJhaXQlMjBzbWlsaW5nJTIwcG9ydHJhaXR8ZW58MHx8fHwxNzkwMjM1NDU3fDA&ixlib=rb-4.1.0&q=85', tint: 'from-indigo-500 to-sky-400' },
  karen: { id: 'karen', name: 'Karen', initial: 'K', voice: 'coral', accent: 'USA', desc: 'Direkt bunkó, csípős és könyörtelen', sub: 'Roast mód · beszól · azonnal javít', badge: 'Karen mód', quote: '„Jó. Nézzük, mit tudsz tényleg.”',
    preview: "Hi. I'm Karen. If your English is bad, I will tell you. Now let's see if you are actually in the right place.",
    img: 'https://images.unsplash.com/photo-1758600433053-235139a44265?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwzfHxzdHJpY3QlMjBjb25maWRlbnQlMjBtYXR1cmUlMjB3b21hbiUyMHBvcnRyYWl0fGVufDB8fHx8MTc5MDIzNTQ1N3ww&ixlib=rb-4.1.0&q=85', tint: 'from-fuchsia-600 to-rose-500' },
  vinnie: { id: 'vinnie', name: 'Vinnie', initial: 'V', voice: 'ash', accent: 'USA', desc: 'Mérges ex-gengszter angoltanár', sub: 'Káromkodós · utcai dumás · kemény, de tanít', badge: 'Ex-gengszter', quote: '„Na gyere, csináljuk meg rendesen.”',
    preview: "Na, gyere haver. Ha jó: ez kurvajó. Ha gatya: megmondom. Aztán addig rakjuk össze, amíg tényleg angol nem lesz belőle.",
    img: 'https://images.unsplash.com/photo-1533101585792-27f81a845550?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHx0b3VnaCUyMHN0cm9uZyUyMG1hdHVyZSUyMG1hbiUyMHBvcnRyYWl0JTIwY29uZmlkZW50fGVufDB8fHx8MTc5MDIzNTQ1N3ww&ixlib=rb-4.1.0&q=85', tint: 'from-slate-700 to-zinc-500' },
};
export const TEACHER_IDS = ['maya', 'james', 'karen', 'vinnie'];

export const MODES = {
  business: { id: 'business', name: 'Business English', icon: 'Briefcase', desc: 'Meeting, telefon, ügyfél, ajánlat és tárgyalás — a te munkádra szabva.', tag: 'AJÁNLOTT', meta: '10–60 perc' },
  free: { id: 'free', name: 'Szabad beszélgetés', icon: 'MessagesSquare', desc: 'Beszélgess arról, ami tényleg érdekel. Az AI közben természetesen javít.', meta: 'A2–C1' },
  vocabulary: { id: 'vocabulary', name: 'Szókikérdezés', icon: 'Sparkles', desc: 'A saját szóbankodból, random sorrendben, magyar ↔ angol irányban.', meta: 'Adaptív' },
  grammar: { id: 'grammar', name: 'Nyelvtan gyakorlat', icon: 'Wand2', desc: 'Nem tankönyvből: a saját visszatérő hibáidból generált spoken drill.', meta: 'Személyes' },
  interview: { id: 'interview', name: 'Állásinterjú', icon: 'UserRoundCheck', desc: 'Reális interjú, follow-up kérdések, utána konkrét feedback.', meta: 'B1–C1' },
  situation: { id: 'situation', name: 'Szituáció', icon: 'Clapperboard', desc: 'Hotel, reptér, ügyfélszolgálat vagy telefonhívás szerepjátékban.', meta: 'Gyakorlati' },
  pronunciation: { id: 'pronunciation', name: 'Kiejtés', icon: 'AudioLines', desc: 'Érthetőség, hangsúly és ritmus. Pontszám csak megbízható assessmenttel.', meta: 'Speech' },
  exam: { id: 'exam', name: 'Vizsga mód', icon: 'GraduationCap', desc: 'CEFR-jellegű szóbeli feladatok időzítve. Nem hivatalos minősítés.', meta: 'B1–C1' },
};
export const MODE_NAMES = Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.name]));

export function normalizeSpeechText(text = '') {
  return String(text)
    .replace(/\s+([,?.!:;])/g, '$1')
    .replace(/([“„])\s+/g, '$1')
    .replace(/\s+([”])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
export function cleanAssistantDisplayText(text = '') {
  return String(text).replace(/\[[^\]]{1,42}\]/g, '').replace(/[\t\r\n ]+/g, ' ');
}
export function practiceNorm(text = '') {
  return normalizeSpeechText(text).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
export function practiceNormAny(text = '') {
  return normalizeSpeechText(text).toLocaleLowerCase('hu-HU').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function likelyEnglishPracticePhrase(text = '') {
  const clean = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 18 || clean.length > 180) return false;
  const low = practiceNorm(clean); if (!low) return false;
  const huHits = (practiceNormAny(clean).match(/\b(hogy|akkor|most|mondd|mondjad|ismételd|igy|így|egyben|jobb|kell|lehet|gyorsan|mondat|angolul|szerintem|neked|nekem|projekt|áll|vagy|van|lesz|volt)\b/g) || []).length;
  const enHits = (low.match(/\b(i|you|we|they|he|she|it|the|a|an|to|for|with|of|in|on|at|if|can|could|would|should|will|do|does|did|have|has|had|is|are|was|were|make|move|give|get|take|want|need|price|quickly|forward|better|please|today|tomorrow|how|what|where|when|why|project|going)\b/g) || []).length;
  return enHits >= 1 && enHits >= huHits;
}
export function likelyHungarianPracticePhrase(text = '') {
  const clean = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 18 || clean.length > 180) return false;
  const low = practiceNormAny(clean);
  const huHits = (low.match(/\b(hogy|akkor|most|ezt|azt|áll|projekt|szeretnék|kérek|kérlek|mennyi|mikor|hol|miért|van|vagy|lesz|volt|ügyfél|ajánlat|meeting|megbeszélés|csúszunk|halad|haladunk|szerződés|ár|határidő)\b/g) || []).length;
  return huHits >= 1 || /[áéíóöőúüű]/i.test(clean);
}
export function isTranslateTarget(text = '') {
  const clean = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim();
  if (!clean || clean.length > 120) return false;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 10) return false;
  if (words.length === 1) return /^[\p{L}\p{N}'-]{2,}$/u.test(clean) && !/^(this|that|it|me|please|now|again|okay|ok)$/i.test(clean);
  return likelyHungarianPracticePhrase(clean) || !likelyEnglishPracticePhrase(clean);
}
export function stripTaskTail(text = '') {
  let t = normalizeSpeechText(text).replace(/^["“„]+|["”]+$/g, '').trim();
  // cut off trailing instruction/commentary clauses the tutor sometimes appends
  t = t.split(/\s+[–—-]\s+/)[0];
  t = t.replace(/[,;]?\s*(csak\s+egy\s+rövid\s+verzióban|röviden|egyszerűen|természetesen(?:ebben)?|most csak (?:ezt|ennyit)|egy\s+mondatban|ha\s+tudod|lassan|utánam)\b.*$/i, '');
  return t.replace(/[.!?,:;]+$/, '').trim();
}
export function looksEnglishWord(w = '') {
  const s = String(w).toLowerCase().trim();
  if (!/^[a-z][a-z'’-]{1,}$/.test(s)) return false;
  if (/[wxq]/.test(s)) return true;
  if (/(tion|sion|ment|able|ible|ance|ence|ing|ness|ship|ery|ory|ary|ity|ous|ive|ough|eous|ial|ier|ple|ply|dline| line|voice|plier)$/.test(s)) return true;
  if (/(th|wh|ck|ght|ph|sch)/.test(s)) return true;
  return false;
}
export function extractPracticeInstruction(text = '') {
  const clean = normalizeSpeechText(text); if (!clean) return null;
  const quotedAll = [...clean.matchAll(/["“„]([^"”]{1,180})["”]/g)].map(m => m[1].trim());
  const oneWordLatin = (t) => /^[a-z][a-z'’-]{1,}$/i.test(String(t || '').trim()) && !/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(String(t || ''));
  const shortLatinPhrase = (t) => {
    const v = stripTaskTail(String(t || '')).trim();
    const words = v.split(/\s+/).filter(Boolean);
    return words.length >= 1 && words.length <= 10 && words.every(w => /^[a-z][a-z'’-]*[.!?,;:]?$/i.test(w));
  };
  const cleanTarget = (value = '') => stripTaskTail(
    normalizeSpeechText(value)
      .replace(/^[\s:–—,.!?\-"'“„]+/, '')
      .replace(/[\s"'”]+$/g, '')
      .split(/[!?]/)[0]
  );
  const targetAfterColon = () => {
    const colon = clean.lastIndexOf(':');
    if (colon >= 0) return cleanTarget(clean.slice(colon + 1));
    const dash = Math.max(clean.lastIndexOf('–'), clean.lastIndexOf('—'));
    return dash >= 0 ? cleanTarget(clean.slice(dash + 1)) : '';
  };
  const quotedTarget = () => quotedAll.length ? cleanTarget(quotedAll[quotedAll.length - 1]) : '';

  // 1) Meaning/definition task. Examples:
  // "Mondd el, mit jelent: revenue", "Mit jelent a revenue?", "What does revenue mean?"
  const meaningCue = /(?:mondd\s+el[,]?\s*(?:hogy\s+)?mit\s+jelent|mit\s+jelent|mi\s+(?:a|az)\s+jelent[eé]se|magyarázd\s+el[,]?\s*(?:hogy\s+)?mit\s+jelent|what\s+does\b.*\bmean|tell\s+me\s+what\b.*\bmeans?)/i;
  if (meaningCue.test(clean)) {
    let target = quotedTarget() || targetAfterColon();

    if (!target) {
      const hu = clean.match(/(?:mit\s+jelent(?:\s+(?:a|az))?|mi\s+(?:a|az)\s+jelent[eé]se(?:\s+(?:a|az))?)\s+["“„]?([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,8})["”]?[?.!]*$/i);
      if (hu) target = cleanTarget(hu[1]);
    }
    if (!target) {
      const en = clean.match(/what\s+does\s+["“„]?([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,8})["”]?\s+mean\??$/i)
        || clean.match(/tell\s+me\s+what\s+["“„]?([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,8})["”]?\s+means?\??$/i);
      if (en) target = cleanTarget(en[1]);
    }

    target = target
      .replace(/\s+(?:magyarul|angolul)$/i, '')
      .replace(/^(?:a|az)\s+/i, '')
      .trim();

    if (target && shortLatinPhrase(target)) return { text: target, kind: 'meaning' };
  }

  // 2) Explicit pronunciation/repetition. "Mondd ki" is a pronunciation command even if
  // the sentence also contains "angolul"; do not try to guess whether a word like "revenue"
  // looks English from spelling alone.
  const pronounceCue = /(?:mondd\s+ki|mondjad\s+ki|ismételd|ismeteld|ejtsd\s+ki|ejtsed\s+ki|kiejt(?:eni|és)|say\b|repeat\b|try\s+saying|pronounce\b)/i;
  if (pronounceCue.test(clean)) {
    let target = quotedTarget() || targetAfterColon();

    if (!target) {
      const direct = clean.match(/(?:mondd\s+ki|mondjad\s+ki|ismételd(?:\s+utánam)?|ismeteld(?:\s+utanam)?|ejtsd\s+ki|ejtsed\s+ki|say|repeat|pronounce)\s+(?:ezt\s+)?(?:a\s+)?(?:szót\s+|szot\s+|kifejezést\s+|kifejezest\s+)?["“„]?([a-z][a-z'’-]*(?:\s+[a-z][a-z'’-]*){0,10})["”]?[.!?]*$/i);
      if (direct) target = cleanTarget(direct[1]);
    }

    if (target && (oneWordLatin(target) || shortLatinPhrase(target) || likelyEnglishPracticePhrase(target))) {
      return { text: target, kind: 'repeat' };
    }
  }

  // 3) Explicit HU -> EN translation cue.
  const angolulCue = /\bangolul\b/i.test(clean) && /(mondd|mondjad|fordítsd|forditsd|hogy(?:an)?\s+(?:van|mond)|mi\s+az|próbáld|probald)/i.test(clean);
  const angolraCue = /\bangolra\b/i.test(clean) && /(fordítsd|forditsd|mondd|mondjad|váltsd|valtsd|hogy)/i.test(clean);
  if (angolulCue || angolraCue) {
    let target = quotedTarget() || targetAfterColon();
    if (!target) {
      const m = clean.match(/\b(angolul|angolra)\b/i);
      target = m ? cleanTarget(clean.slice(m.index + m[0].length)) : '';
    }
    if (target && isTranslateTarget(target)) return { text: target, kind: 'translate' };
  }

  // 4) Fallback repeat cue for natural tutor variants.
  const cue = /(mondd|mondjad|ismételd|ismeteld|próbáld|probal|say|repeat|try saying|ejtsd|ejtsed|pronounce)/i;
  if (!cue.test(clean)) return null;
  const quotedEn = quotedAll.filter(likelyEnglishPracticePhrase);
  if (quotedEn.length) return { text: stripTaskTail(quotedEn[quotedEn.length - 1]), kind: 'repeat' };
  const quotedWord = quotedAll.map(q => q.trim()).reverse().find(q => oneWordLatin(q));
  if (quotedWord) return { text: stripTaskTail(quotedWord), kind: 'repeat' };

  const colonTarget = targetAfterColon();
  if (colonTarget && (likelyEnglishPracticePhrase(colonTarget) || oneWordLatin(colonTarget))) {
    return { text: colonTarget, kind: 'repeat' };
  }

  const afterRaw = (clean.match(/(?:mondd|mondjad|ismételd|ismeteld|próbáld|probal(?:d)?|say|repeat|try saying|ejtsd|ejtsed|pronounce)(?:\s+\S+){0,6}?\s*[:–—-]\s*(.{2,180})$/i) || [])[1] || '';
  const after = stripTaskTail(afterRaw);
  if (likelyEnglishPracticePhrase(after) || (after && oneWordLatin(after))) return { text: after, kind: 'repeat' };

  const parts = clean.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
  const candidates = parts.filter(x => !cue.test(x) && likelyEnglishPracticePhrase(x));
  if (candidates.length) return { text: stripTaskTail(candidates[candidates.length - 1].replace(/^[–—:-]\s*/, '')), kind: 'repeat' };
  return null;
}
export function practicePhraseSimilarity(a = '', b = '') {
  const aw = practiceNorm(a).split(' ').filter(Boolean), bw = practiceNorm(b).split(' ').filter(Boolean);
  if (!aw.length || !bw.length) return 0; let best = 0;
  for (let off = -aw.length; off <= bw.length; off++) { let hit = 0; for (let i = 0; i < aw.length; i++) { const j = i + off; if (j >= 0 && j < bw.length && aw[i] === bw[j]) hit++; } best = Math.max(best, hit / aw.length); }
  return best;
}
export function computeStreak(sessions = []) {
  const days = new Set((sessions || []).map(s => String(s.createdAt || '').slice(0, 10)).filter(Boolean));
  const key = (offset) => new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
  const practicedToday = days.has(key(0));
  let streak = 0;
  for (let i = practicedToday ? 0 : 1; days.has(key(i)); i++) streak++;
  const week = Array.from({ length: 7 }, (_, i) => ({ day: key(6 - i), done: days.has(key(6 - i)) }));
  return { streak, practicedToday, week };
}
export function formatClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}
export function pct(n) { return Math.max(0, Math.min(100, n)); }
export function shuffle(list) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function uniqueBy(list, keyFn) { const seen = new Set(); return list.filter(x => { const k = keyFn(x); if (!k || seen.has(k)) return false; seen.add(k); return true; }); }
