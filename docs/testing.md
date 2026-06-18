# Testing

## Overview

The current validation workflow combines frontend checks, build checks, API smoke tests, and manual browser tests for microphone capture and transcription.

## Frontend Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## API Smoke Tests

Start the Python API, then run:

```bash
curl http://localhost:8010/api/health
curl http://localhost:8010/api/ready
```

## Text Analysis Test

```bash
curl -X POST http://localhost:8010/api/analyze-sentiment   -H "Content-Type: application/json"   -d '{"text":"I need urgent help and I am panicking"}'
```

Expected outcome:

- HTTP 200.
- `stressScore` present.
- `cognitiveLoad` present.
- `keywords` present.
- `processedOnPremises` true.

## Audio Upload Test

Use a local audio file with one of the supported extensions:

```bash
curl -X POST http://localhost:8010/api/transcribe   -F "file=@sample.webm"
```

Expected outcome:

- HTTP 200.
- `status` is `success`.
- response contains acoustic, linguistic, combined, and processor fields.

## No-Speech Test

Upload a near-silent audio clip. Expected outcome:

- HTTP 200.
- empty `text`.
- low combined stress score.
- processor indicates energy gate/no-speech path.

## Browser Manual Test Checklist

- [ ] App loads successfully.
- [ ] Settings panel opens and closes.
- [ ] API status changes from checking to ready/degraded/offline.
- [ ] Microphone prompt appears when starting mic capture.
- [ ] Simulation mode starts without microphone permission.
- [ ] Metric cards update while recording/simulating.
- [ ] D3 waveform/radar renders.
- [ ] Stress trend chart populates.
- [ ] Transcript feed receives analysed lines.
- [ ] Alerts trigger when threshold is exceeded.
- [ ] Mute chime setting suppresses audio alert.
- [ ] Browser print/PDF export opens print dialog.

## Regression Areas

Pay particular attention to:

- stale closure behaviour in recorder callbacks
- duplicate transcript lines
- recorder restart between chunks
- silence/noise hallucinations
- API proxy routing
- model readiness polling
- chart resizing
