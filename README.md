# LAM — AI Personal Styling & Digital Wardrobe

An Echo Look–inspired smart stylist: capture your clothes hands-free, let AI
build your digital closet, and get daily outfit suggestions tuned to your
taste, body shape and the local weather.

## Features

- **Hands-free smart capture** — show the camera a ✌️ "V" gesture (MediaPipe
  hand tracking) and a 3-second countdown fires the shutter.
- **Auto-wardrobe & AI tagging** — every capture goes through background
  removal (rembg/u2net), clothing classification (YOLO) and dominant-color
  extraction, then lands pre-tagged in your closet.
- **Outfit calendar & decluttering** — each item tracks `wear_count` and
  `last_worn_date`; the calendar keeps your outfit history and the engine
  never suggests a look you wore in the last 2 weeks. Rarely-worn items
  surface as declutter candidates.
- **Preference engine & body profiling** — swipe right/left on suggested
  outfits and LAM learns your color-combination taste (pairwise weights).
  Suggestions also respect your body shape and today's forecast
  (Open-Meteo, no API key needed).
- **Style Jury** — a MiroFish/POSIM-inspired opinion simulation: 7 AI
  personas (fashion editor, best friend, coworker, first date, gen-z kid,
  grandma, minimalist stylist) rate your outfit, debate each other in an
  opinion-dynamics round, and deliver a 0-100 score + verdict on *what
  people will think*.

## Architecture

```
┌────────────────────────────┐
│  app/ — Expo universal     │  iOS · Android · Web (mobile-first)
│  React Native + TypeScript │  MediaPipe gesture capture, swipe rating
└──────────────┬─────────────┘
               │ REST (Firebase ID token / dev bypass)
┌──────────────▼─────────────┐      ┌──────────────────────────┐
│  server/ — Express + TS    │─────▶│  ai-service/ — FastAPI   │
│  Prisma → PostgreSQL       │      │  rembg · YOLO · colors   │
│  Firebase Auth + Storage   │      └──────────────────────────┘
│  suggestion & preference   │
│  engines · Open-Meteo      │
└────────────────────────────┘
        nginx reverse-proxies /api and serves the exported web app
```

## Quick start (no Firebase needed)

Requirements: Docker + Node 20+.

```bash
# 1. Build the web app bundle that nginx serves
cd app && npm install && npm run build:web && cd ..

# 2. Boot the stack: Postgres, API, AI service, nginx
docker compose up --build
```

Open **http://localhost:8080** — sign in with any email (dev-bypass mode),
allow the camera, and start capturing clothes.

> First AI request downloads the u2net weights if they weren't cached at
> image build time; CPU tagging takes a few seconds per item.

### Local development (hot reload)

```bash
# Postgres (Docker or local), then:
cd server && cp .env.example .env && npm install
npx prisma migrate dev && npm run dev            # API on :4000

cd ai-service && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload                     # AI on :8000

cd app && npm install
npx expo start                                    # web: press w · iOS: i · Android: a
```

The app talks to `http://localhost:4000` by default (Android emulator:
`10.0.2.2` handled automatically). Configure with `EXPO_PUBLIC_API_URL`.

### Tests

```bash
cd server && npm test        # 33 tests — API integration (needs Postgres) + engine units
cd app && npm test           # gesture classifier units
cd ai-service && pytest      # color/classify/API units (models mocked)
```

## Firebase setup (production auth & storage)

Dev-bypass mode is for local development only. For real deployments:

1. Create a Firebase project; enable **Authentication → Email/Password**
   and **Cloud Storage**.
2. **Server**: create a service account key (Project settings → Service
   accounts) and set either `FIREBASE_SERVICE_ACCOUNT_JSON` (paste the JSON,
   Railway-friendly) or `FIREBASE_SERVICE_ACCOUNT_PATH`, plus
   `FIREBASE_STORAGE_BUCKET`. Set `DEV_AUTH_BYPASS=false`.
3. **App**: copy the web app config (Project settings → Your apps) into
   `app/.env` as the `EXPO_PUBLIC_FIREBASE_*` vars (see `app/.env.example`).
   With those set, the app switches from dev-bypass to real Firebase auth
   automatically.

## Deploying to Railway

1. Push this repo to GitHub and create a Railway project from it.
2. Add a **PostgreSQL** plugin; Railway injects `DATABASE_URL`.
3. Create two services from the repo:
   - **server** — root `server/` (Dockerfile detected). Set env vars:
     `AI_SERVICE_URL` (internal URL of the ai-service), `AI_SERVICE_SECRET`,
     Firebase vars, `PUBLIC_BASE_URL` (the public server URL).
   - **ai-service** — root `ai-service/`. Set `AI_SERVICE_SECRET`.
4. Deploy the web app anywhere static (Railway static, Vercel, Netlify):
   `cd app && EXPO_PUBLIC_API_URL=https://<server-url> npm run build:web`
   and publish `app/dist`.

## Native builds & gesture detection

- **iOS/Android**: `cd app && npx expo prebuild && npx expo run:ios|android`
  (or EAS: `eas build`). Camera + self-timer capture, closet, swipe rating,
  calendar and profile all work out of the box.
- **Web** gets full hands-free gesture capture via MediaPipe's browser SDK.
- **Native gesture detection (upgrade path)**: the V-gesture classifier
  (`app/src/capture/gesture.ts`) is platform-agnostic and unit-tested. To go
  hands-free on device, add `react-native-vision-camera` +
  `react-native-fast-tflite` in a dev-client build, run MediaPipe's
  `hand_landmarker.task` in a frame processor and feed the landmarks to the
  same classifier — `CaptureCamera.tsx` documents the wiring point.

## Style Jury LLM backends (free or paid)

The jury speaks through **any OpenAI-compatible endpoint** — set these on
the server (see `server/.env.example`):

| Backend | `LLM_BASE_URL` | Example `LLM_MODEL` | Cost |
| --- | --- | --- | --- |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.2` | free |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | free tier |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.3-70b-instruct:free` | free models |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemini-2.0-flash` | free tier |
| OpenAI / others | provider URL | any chat model | paid |

Set `LLM_VISION=true` only for multimodal models — the jury then sees the
actual outfit photos instead of just the tags.

**No backend configured?** The feature still works: a deterministic
rule-based jury scores the outfit using the suggestion engine (color
harmony, learned preferences, body shape) with template persona comments,
labeled "offline jury" in the UI. The API also falls back to it
automatically whenever the LLM endpoint errors or times out.

How the simulation runs (`server/src/services/styleJuryService.ts`):
round 1 — each persona reacts independently; round 2 — personas read the
panel and may revise their score ±10 and reply (conformity/polarization,
the OASIS/POSIM touch); finally a report agent writes the two-sentence
verdict, and the mean becomes the 0-100 score.

## Better clothing recognition

The default YOLOv8n weights are COCO-trained (bags/ties only) and the
service falls back to a low-confidence shape heuristic for garments. For
production-grade tagging, train/download a DeepFashion2 YOLO checkpoint and
point the ai-service at it (`MODEL_PATH=/models/deepfashion2-yolov8.pt`) —
the DeepFashion2 class names are already mapped in
`ai-service/app/classify.py`.

## Repository layout

| Path            | What it is                                             |
| --------------- | ------------------------------------------------------ |
| `server/`       | Express + TypeScript API, Prisma schema & migrations   |
| `ai-service/`   | FastAPI microservice: rembg, YOLO, color extraction    |
| `app/`          | Expo universal client (iOS / Android / Web)            |
| `nginx/`        | Reverse proxy + static web hosting config              |
| `docker-compose.yml` | One-command local stack                           |
