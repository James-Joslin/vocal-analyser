# Acoustic Stress Monitor

Acoustic Stress Monitor is a self-hosted vocal telemetry dashboard for analysing speech-related stress indicators in near real time. It combines a React/Vite frontend with a Python FastAPI analysis service for transcription, acoustic feature extraction, emotion classification, and text-based distress analysis.

> This project provides heuristic telemetry only. It is not a medical device, diagnostic system, employment decisioning system, or emergency response tool.

## Core Capabilities

- Browser microphone capture and simulation mode.
- Six-second MediaRecorder audio chunking.
- Client-side speech activity gate to reduce silence/noise uploads.
- Self-hosted `/api/transcribe` pipeline using faster-whisper, Wav2Vec2, and DistilBERT.
- Text-only `/api/analyze-sentiment` endpoint.
- Live acoustic telemetry: energy, pitch, spectral centroid, jitter, and shimmer.
- Combined stress scoring from acoustic, linguistic, and emotion-derived signals.
- D3 waveform, radial stress radar, and stress trend chart.
- Configurable stress threshold, alert chime, intervention prompts, transcript feed, and report export.

## Architecture Summary

```text
Browser UI
  -> React / Vite / Express web app
  -> /api/* proxy
  -> Python FastAPI cognitive API
  -> local model-backed transcription and analysis
```

## Quick Start

```bash
npm install
npm run typecheck
npm run dev
```

Run with Docker:

```bash
docker compose up --build
```

Default local URLs:

```text
Web app:    http://localhost:3001
Python API: http://localhost:8010
```

## API Endpoints

```text
GET  /api/health
GET  /api/ready
POST /api/analyze-sentiment
POST /api/transcribe
```

## Documentation Index

- `docs/architecture.md`
- `docs/data-flow.md`
- `docs/api-contract.md`
- `docs/configuration.md`
- `docs/local-development.md`
- `docs/docker.md`
- `docs/deployment.md`
- `docs/testing.md`
- `docs/security.md`
- `docs/frontend.md`
- `docs/python-api.md`
- `docs/model-pipeline.md`
- `docs/model-card.md`
- `docs/safety-and-privacy.md`
- `docs/troubleshooting.md`

Feature docs are in `docs/features/`. Architecture Decision Records are in `docs/adr/`.
