# Did Sonnet 5 Drop?

A minimal service that checks once per minute if Claude "Sonnet 5" exists in Anthropic's model lineup.

## Architecture

- **Backend**: Hono on Google Cloud Run - checks Anthropic API + scrapes news pages every minute
- **Frontend**: React + Vite on Vercel - polls backend every 10 seconds

## Detection Logic

The service looks for Sonnet 5 specifically, excluding older versions:
- ✅ Matches: `sonnet-5`, `claude-5-sonnet`, `claude-sonnet-5`
- ❌ Excludes: `claude-3.5-sonnet`, `claude-4.5-sonnet`, `sonnet-4.5`

## Local Development

### Backend

```bash
cd backend
bun install
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY
bun run dev
```

### Frontend

```bash
cd frontend
bun install
cp .env.example .env.local
# Edit .env.local with VITE_BACKEND_URL=http://localhost:8080
bun run dev
```

## Live URLs

- **Frontend:** https://frontend-pcstyle.vercel.app
- **Backend:** https://sonnet5-checker-200644381221.europe-west1.run.app

## Deployment

### Backend (Cloud Run)

```bash
cd backend
gcloud run deploy sonnet5-checker \
  --source . \
  --region europe-west1 \
  --project central-point-477516-v8 \
  --allow-unauthenticated

# Then set the API key:
gcloud run services update sonnet5-checker \
  --region europe-west1 \
  --project central-point-477516-v8 \
  --set-env-vars ANTHROPIC_API_KEY=your-key
```

### Frontend (Vercel)

```bash
cd frontend
vercel --prod
```

## API Endpoints

- `GET /status` - Returns current check status
  ```json
  {
    "found": false,
    "model": null,
    "source": null,
    "checkedAt": "2025-02-04T12:00:00.000Z"
  }
  ```
- `GET /health` - Health check
- `POST /check` - Force immediate check

## Environment Variables

### Backend
- `ANTHROPIC_API_KEY` - Anthropic API key for model list access
- `PORT` - Server port (default: 8080)

### Frontend
- `VITE_BACKEND_URL` - Backend URL (Cloud Run URL)
