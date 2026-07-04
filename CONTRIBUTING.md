# Contributing to LAM

## Prerequisites

- Node 22 (`.nvmrc`), Python 3.11+, Docker (for Postgres / the full stack)

## One-time setup

```bash
npm run setup            # installs server + app deps, creates the ai-service venv
cp server/.env.example server/.env
docker run -d --name lam-postgres -e POSTGRES_USER=lam -e POSTGRES_PASSWORD=lam \
  -e POSTGRES_DB=lam -p 5432:5432 postgres:16-alpine
npm run db:migrate       # applies Prisma migrations
```

## Day-to-day

| Command | What it does |
| --- | --- |
| `npm run dev:server` | API with hot reload on :4000 |
| `npm run dev:ai` | AI microservice with hot reload on :8000 |
| `npm run dev:app` | Expo dev server (press `w`/`i`/`a` for web/iOS/Android) |
| `npm test` | All three test suites (server, app, ai-service) |
| `npm run typecheck` | TypeScript across server + app |
| `npm run stack` | Web build + full docker compose stack on :8080 |

Auth in development is credential-free: the server runs with `DEV_AUTH_BYPASS=true`
and the app sends an `x-dev-user` header — any email signs you in.

## Repo map

| Path | Package |
| --- | --- |
| `server/` | Express + TypeScript API, Prisma schema & migrations, suggestion/preference/jury engines |
| `ai-service/` | FastAPI: background removal (rembg), YOLO classification, color extraction |
| `app/` | Expo universal client (iOS / Android / Web) |
| `nginx/`, `docker-compose.yml` | Local/production stack |

## Conventions

- Conventional commits: `feat(server): …`, `fix(app): …`, `docs: …`
- Wire types live in `server/src/types/api.ts` and are mirrored to
  `app/src/types/api.ts` — change both in the same commit.
- Pure logic (scoring, gesture classification, jury aggregation) stays in
  side-effect-free modules with unit tests; controllers stay thin.
- CI (`.github/workflows/ci.yml`) must be green: typecheck + tests for all
  three packages + an Expo web export build check.
