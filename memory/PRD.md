# LIVO — AI angoltanuló webapp (PRD)

## Original problem statement
A user was unhappy with a previous (ChatGPT-built) version of LIVO: ugly, confusing UX and illogical placement of features. They asked for a fully redesigned, premium, mobile-app-like, production-ready experience in the React/FastAPI/MongoDB stack, **without breaking any working feature**. Hungarian UI, English learning content. Live voice conversation with an AI teacher, real-time transcript, prominent translation/repetition task cards, grammar correction + pronunciation feedback, AI topic-based vocabulary generation, word save/delete + games, end-of-lesson result + progress tracking.

## Architecture
- **Frontend**: React 19 (CRA/craco), TailwindCSS, Framer Motion, lucide-react, sonner. Premium mobile-first UI in a `max-w-md` phone frame. Manrope (headings) + Figtree (body). Indigo (#4F46E5) + emerald accents, dark task cards.
- **Backend**: FastAPI, all routes under `/api`, MongoDB (`livo_state` single guest doc, `pexels_cache`). httpx to OpenAI + Pexels.
- **AI**: OpenAI **Realtime/Live voice** (`gpt-live-1`, WebRTC SDP proxied by `/api/live-session`) for the live teacher; `gpt-5.6-luna` (Responses API + strict JSON schema) for word-help, turn-check, pronunciation, vocab generation/validation, session analysis; `gpt-4o-mini-tts` for voice previews. Pexels for image-game photos. Requires a real `OPENAI_API_KEY` (Realtime-enabled) — Universal key does NOT support Realtime.
- **LiveEngine** (`src/lib/LiveEngine.js`): faithful port of the original vanilla-JS live logic as a React external store (WebRTC, karaoke transcript, task-card extraction, corrections, pronunciation, idle nudge, auto-pause, hard-stop timer, summary).

## User persona
"Dominik" — Hungarian intermediate (B1) learner focused on business English. Guest-based, no login.

## Implemented (2026-06)
- Onboarding entry flow (teacher + learning path) with voice preview.
- Home (weekly goal ring, focus cards, homework), Practice (8 lesson modes), Teacher sheet (4 personalities: Maya/James/Karen/Vinnie + AI voice preview).
- **Live room**: animated teacher orb, karaoke transcript with tap-to-translate + save, **prominent TASK CARD** ("MONDD KI" / "FORDÍTSD ANGOLRA"), inline correction chip, visual pronunciation card, session duration picker, timer + hard stop, auto-pause on silence, end-of-lesson summary (instant + AI analysis).
- **Learn**: word bank (search/filter/add/delete with server-side validation), Word Lab (AI topic vocabulary generation), 5 games (Swipe, Image→word, Quick, Match, Memory).
- **Progress** (stats, weekly chart, recurring patterns), **Profile** (teaching style, learning path, subscription, data reset).
- All backend endpoints verified via curl; frontend E2E verified by testing agent (100%, zero console errors).

## Backlog / next
- P1: Live transcript side panel (drag-select phrase lookup) inside the mobile live room.
- P1: Split `views.jsx` and `LiveEngine.js` into smaller modules.
- P2: Payments (subscription plans are UI-only), guided learning-path step engine.
- P2: Persist per-day speaking minutes for a real weekly chart (currently sample values).

## Notes
- Live realtime VOICE requires a microphone; automated headless tests validate the UI up to session-setup and graceful error handling only.
