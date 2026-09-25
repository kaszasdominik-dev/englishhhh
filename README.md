# LIVO — AI angoltanuló webapp

Standalone React + FastAPI + MongoDB application. The app uses your own OpenAI API credentials; no Emergent account, Emergent key, private package index, or Emergent runtime service is required.

## Stack

- Frontend: React 19 + CRACO
- Backend: FastAPI
- Database: MongoDB
- AI/voice: OpenAI APIs
- Optional image search for the image vocabulary game: Pexels

## Requirements

- Python 3.11
- Node.js 20 LTS
- Yarn 1.x (the repo declares Yarn 1.22.22)
- MongoDB, either local/Docker or managed
- OpenAI API key with access to the models configured below
- Optional: Pexels API key if you want the image vocabulary game to fetch new photos

## Environment setup

Create the local environment files from the committed examples:

### Backend

Copy `backend/.env.example` to `backend/.env` and set at least:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=englishhhh
CORS_ORIGINS=http://localhost:3000
OPENAI_API_KEY=sk-your-key-here
```

Optional model overrides are already listed in the example file.

For the image vocabulary game, set `PEXELS_API_KEY`. Without it, the rest of the application can run, but uncached image search returns `NO_PEXELS_KEY`.

### Frontend

Copy `frontend/.env.example` to `frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Never commit real API keys. The repository ignores local `.env` files while explicitly allowing the `.env.example` templates.

## Local development — Windows 11

### 1. MongoDB with Docker

```powershell
docker run -d -p 27017:27017 --name mongo mongo:7
```

If the container already exists:

```powershell
docker start mongo
```

### 2. Backend

```powershell
cd backend
Copy-Item .env.example .env
py -3.11 -m venv .venv
Set-ExecutionPolicy -Scope Process RemoteSigned -Force
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Health check:

```text
http://localhost:8000/api/health
```

### 3. Frontend

Open a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env
corepack enable
yarn install
yarn start
```

The app opens at `http://localhost:3000`.

## Clean-clone acceptance test

A release is only considered ready after this works from a fresh clone:

```text
git clone
→ copy .env.example files to .env
→ add real backend credentials
→ pip install -r backend/requirements.txt
→ yarn install
→ start MongoDB
→ start backend
→ start frontend
→ verify all features
```

Verify at minimum:

1. `GET /api/health` and `GET /api/bootstrap`
2. text/reasoning correction flow
3. TTS voice preview
4. live voice session: microphone → tutor audio → learner/tutor transcript → mute/unmute → timer → session result
5. vocabulary generation/save/delete
6. games, including photo game when `PEXELS_API_KEY` is configured
7. profile, homework and privacy reset
8. no OpenAI secret appears in the browser bundle or browser network payloads
9. the app runs with no Emergent credentials, packages, private index or runtime service

## Production

- Serve the frontend over HTTPS. Browser microphone/WebRTC requires a secure context in production.
- Set `REACT_APP_BACKEND_URL` at frontend build time to the deployed backend origin.
- Set `CORS_ORIGINS` on the backend to the exact deployed frontend origin(s), comma-separated and without trailing slashes.
- Keep `OPENAI_API_KEY` and optional `PEXELS_API_KEY` only in backend environment variables/secrets.
- Use an authenticated managed MongoDB instance or a secured MongoDB deployment.
- Run the FastAPI app behind TLS termination/reverse proxy or a platform that provides HTTPS.
- Do not expose MongoDB directly to the public internet.

## Important

The application intentionally keeps its existing live/session UI and teaching behavior. This cleanup removes Emergent-specific build/runtime scaffolding only; it does not redesign or refactor the learning features.
