# Deployment

## Overview

Acoustic Stress Monitor can be deployed as a web application plus a Python FastAPI cognitive analysis service. The recommended production shape keeps the frontend/web process and Python API as separate services with explicit `/api/*` routing.

## Deployment Modes

### Docker Compose

Suitable for local development, demos, and simple hosted environments.

```bash
docker compose up -d --build
```

### Container Platform

Suitable for production-like environments. Run the web app and Python API as separate containers, with the web app configured to proxy or route API calls to the Python API.

## Required Services

```text
Web app service      -> React/Vite/Express
Python API service   -> FastAPI + model pipeline
Model cache/storage  -> persistent cache for model assets
```

## Ports

```text
Web app:    3001
Python API: 8000
Host API:   8010 -> 8000 in local Compose
```

## Production Build

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm start
```

## Python API Startup

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Health and Readiness

Use these endpoints for deployment checks:

```text
GET /api/health
GET /api/ready
```

`/api/health` confirms the service is running. `/api/ready` confirms model load state.

## Reverse Proxy Routing

The public web app should route API calls to the Python service:

```text
/api/* -> python-api:8000/api/*
```

Keep the browser-facing API paths stable so the frontend can call `/api/ready`, `/api/analyze-sentiment`, and `/api/transcribe` without environment-specific URLs.

## Model Cache

Use persistent storage for model caches to avoid repeated downloads and slow cold starts.

```text
HF_HOME=/app/.cache/huggingface
```

## CPU vs GPU

The API can run on CPU or CUDA depending on Torch availability. GPU deployments may improve model latency, but should be tested for memory usage, driver compatibility, and cold-start behaviour.

## Production CORS

The current permissive CORS settings are convenient for development. For production, restrict allowed origins to the expected web app hostnames.

## Logging

Avoid logging raw audio, full transcripts, or sensitive user information unless there is a documented operational reason, retention policy, and access control model.

## Deployment Checklist

- [ ] Environment variables configured.
- [ ] API target points to Python API service.
- [ ] Model cache mounted/persistent.
- [ ] `/api/health` returns healthy.
- [ ] `/api/ready` returns expected model states.
- [ ] CORS restricted for production.
- [ ] API not publicly exposed unless required.
- [ ] TLS configured at the ingress/reverse proxy layer.
- [ ] Safety/privacy documentation reviewed.
