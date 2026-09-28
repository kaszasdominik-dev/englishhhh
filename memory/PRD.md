# LIVO — AI angoltanár (folytatás)

## Eredeti feladat
A https://github.com/kaszasdominik-dev/englishhhh projekt folytatása. (1) Emergent-függetlenség ellenőrzése, (2) helyi telepítés, (3) 7 konkrét hiba javítása — új feature/dizájn nélkül.

## Emergent-függetlenség (ellenőrizve ✅)
- Nincs `emergentintegrations`, nincs `EMERGENT_LLM_KEY`, nincs private index, nincs proxy.
- Saját `OPENAI_API_KEY`-jel közvetlenül `api.openai.com`-ot hív.
- Modellek a felhasználó OpenAI fiókjában valósak: `gpt-live-1` (Live/Realtime WebRTC `/v1/live/sessions`), `gpt-5.6-luna` (`/v1/responses`), `gpt-4o-mini-tts`.

## Architektúra
- **Backend**: FastAPI (`/app/backend/server.py`), MongoDB (egyetlen `demo-user` state dokumentum). Nincs auth.
- **Frontend**: React (CRACO), egyetlen phone-frame UI. Fő fájlok: `App.js`, `views.jsx`, `lib/LiveEngine.js` (WebRTC élő motor), `lib/livo.js` (tiszta helperek), `components/LiveRoom.jsx`, `GameRoom.jsx`.
- Élő beszélgetés: OpenAI Realtime/Live WebRTC (SDP a `/api/live-session`-ön keresztül).

## Elvégzett javítások (2026-06)
1. **Task card** — tutor feladatnál külön kártya jelenik meg (`MONDD KI ANGOLUL` / `ISMÉTELD UTÁNAM` + célmondat + „🎙 Hallgatlak…"), a válaszig fent marad. Állapotok: correct / almost_correct / wrong / dont_know. Értékelés `/api/task-eval`-lal (jelentés-alapú, nem exact string).
2. **Nem tudom + Segítség** — „Nem tudom": felfedi + kimondatja a helyes választ, majd ismétlést kér. „Segítség": fokozatos (3 szintű) hint a tutortól, nem rögtön a teljes válasz.
3. **Kiejtés gomb** — task cardon és word popupban is; `/api/pronounce` (TTS) csak az angol targetet mondja ki natív kiejtéssel.
4. **Szókikérdezés / spaced repetition** — SR mezők (attempts, correct/wrong/dont_know_count, consecutive_correct, first_try_correct, last/next_review_at, interval_days, mastery, mastered). Prioritás: esedékes > gyenge > új > (ritkán) stabil, prioritáson belül randomizálva. Intervallumok: 1→3→7→14→30→60 nap. Mastered kiesik, hibánál visszatér. `select_quiz_words` + `apply_sr` a `server.py`-ban; a live-session ezt használja, a task-eredmények `/api/game/result`-tal íródnak vissza.
5. **Természetes magyar** — a tutor promptba „NATURAL HUNGARIAN LOCK" került, tiltott félkész/hibás minták példákkal.
6. **Transcript** — nyers streaming delta már nem íródik közvetlenül a hiteles timeline-ba; provisional buffer (userEcho) → a `*transcript* done/completed/final` esemény adja a hiteles szöveget (fallback: speechStopped-kor commit). Nincs fél-szó a mentett átiratban.

## Tesztelés
- Backend endpointok curl-lel: `/api/task-eval` (correct/wrong), `/api/pronounce` (mp3), `/api/game/result` (SR perzisztál).
- Pure logika unit-teszt: `extractPracticeInstruction` a kért mondatokra, `select_quiz_words` prioritás + `apply_sr` progresszió.
- UI (Playwright, `window.__livoEngine`-en át injektálva, mivel valós WebRTC+mikrofon nem automatizálható): task card pending/wrong/dont_know/correct + repeat(compliance), word popup Kiejtés — desktop (1920) és mobil (390px) nézetben is.

## Ismert korlát
- A teljes élő hangbeszélgetés (valós OpenAI Realtime WebRTC + mikrofon) csak manuálisan, valós böngészőben tesztelhető end-to-end; az automatizált tesztek a logikát, az endpointokat és az összes UI-állapotot fedik.

## Env
- `backend/.env`: `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS`, `OPENAI_API_KEY` (a felhasználó saját kulcsa). Opcionális: `PEXELS_API_KEY` (kép-játékhoz), `OPENAI_LIVE_MODEL`, `OPENAI_REASONING_MODEL`, `OPENAI_TTS_MODEL`.

## Backlog (nem kért, jövőbeli)
- P2: valós E2E automatizált live-hang teszt fake-audio device-szal.
- P2: SR-státusz vizualizáció a Szavaim listában (esedékes/mastered badge).
