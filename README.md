# LIVO

## Helyi fejlesztői környezet

A backendhez MongoDB és Python, a frontendhez Node.js szükséges. A projekt UTF-8 forrásfájlokat használ.

Windows alatt a legegyszerűbb indítás a repo gyökeréből:

```powershell
.\start-local.cmd
```

Ez külön terminálban indítja a backendet és a frontendet.

### Backend .env

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=livo
OPENAI_API_KEY=your_key_here
CORS_ORIGINS=http://localhost:3000
OPENAI_LIVE_MODEL=gpt-live-1
OPENAI_REASONING_MODEL=gpt-5.6-luna
OPENAI_TTS_MODEL=gpt-4o-mini-tts
```

### Backend indítása

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

## Zero-token angol–magyar szótár

A Word Lab és az Ajánlott szógyakorlás helyi MongoDB-s szótárból működik, LLM-hívás nélkül.

Az első használat előtt, a backend virtuális környezetében:

```powershell
python scripts/import_freedict_dictionary.py
```

A parancs:
1. letölti a FreeDict English–Hungarian TEI adatbázist,
2. helyben gyakorisági pontszámot számol,
3. hozzávetőleges A1–C2 gyakorlási sávot rendel,
4. témacímkéket képez,
5. betölti a MongoDB `dictionary` collectionbe.

Állapot:

```
http://localhost:8000/api/dictionary/status
```

A CEFR-sáv gyakorisági becslés, nem hivatalos CEFR-minősítés.

### Frontend

Helyi fejlesztéskor a frontend `.env` nélkül is a `http://localhost:8000` backendet használja. Ha külön backend címet szeretnél, hozd létre a `frontend/.env` fájlt:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Telepítés és indítás Yarnnal:

```powershell
cd frontend
yarn.cmd install
yarn.cmd start
```

Vagy npm-mel:

```powershell
cd frontend
npm.cmd install
npm.cmd start
```

A `.cmd` forma PowerShellben akkor is működik, ha a helyi execution policy blokkolja az `npm.ps1` / `yarn.ps1` fájlokat.

Éles, egy domainen futó telepítésnél a frontend automatikusan a saját origin `/api` végpontját használja. Külön frontend/backend domaineknél állítsd be a `REACT_APP_BACKEND_URL` és a backend `CORS_ORIGINS` értékét.

A szógyakorló modern böngészőn alapból a készülék/Web Speech angol hangját használja, ezért a normál szógyakorlás hangja sem igényel OpenAI API-hívást.

## Adatforrások és licencek

Lásd: `THIRD_PARTY_NOTICES.md`.
