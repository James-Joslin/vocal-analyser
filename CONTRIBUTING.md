# Contributing

## Overview

This project processes microphone audio and transcript text, so changes should be reviewed for correctness, privacy, safety, and operational impact.

## Development Expectations

Before opening a pull request or merging changes, run:

```bash
npm run typecheck
npm run lint
npm run build
```

If the Python API has changed, also smoke-test:

```bash
curl http://localhost:8010/api/health
curl http://localhost:8010/api/ready
```

## Branch Naming

Use clear branch names:

```text
feature/<short-description>
fix/<short-description>
docs/<short-description>
refactor/<short-description>
```

## Commit Guidance

Use direct commit messages:

```text
Add model pipeline documentation
Fix audio upload lock handling
Document self-hosted processing ADR
```

## Documentation Requirements

Update documentation when changing:

- API routes or response shapes
- environment variables
- Docker/Compose behaviour
- model IDs or scoring weights
- audio capture or upload behaviour
- storage/logging/retention behaviour
- privacy, safety, or deployment assumptions

## Safety and Privacy Review

Any change that affects audio, transcripts, reports, logs, model output, or persistence should be reviewed against:

- `docs/safety-and-privacy.md`
- `docs/security.md`
- `docs/model-card.md`

## Pull Request Checklist

- [ ] TypeScript checks pass.
- [ ] Lint passes.
- [ ] Frontend build passes.
- [ ] Python API health endpoint tested if backend changed.
- [ ] Python API readiness endpoint tested if model/config changed.
- [ ] Documentation updated where required.
- [ ] No secrets committed.
- [ ] No raw audio/test personal data committed.
- [ ] Safety/privacy implications considered.
