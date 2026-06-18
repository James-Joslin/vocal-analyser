# Security

## Overview

This project processes microphone audio, generated transcripts, inferred stress scores, and intervention recommendations. Treat all runtime data as potentially sensitive.

## Key Security Principles

- Do not commit secrets.
- Do not commit raw audio, real transcripts, or personal data.
- Keep API endpoints behind appropriate network controls.
- Restrict CORS in production.
- Avoid logging sensitive user content.
- Prefer self-hosted processing unless the privacy model is explicitly changed.

## API Exposure

The Python API should normally be reachable only by the web app service or trusted internal networks. If exposed publicly, place it behind authentication, TLS, rate limiting, and request size controls.

## CORS

Development may use permissive CORS. Production should restrict origins to known frontend hostnames.

## Audio and Transcript Handling

Recommended defaults:

- Do not persist raw audio.
- Do not log full transcript text.
- Do not send audio or transcript text to third-party services.
- Delete temporary upload files after processing.
- Restrict report/transcript access if persistence is introduced.

## Browser Microphone Security

Microphone access is controlled by browser permissions. The app should only request microphone access when the user starts a microphone session.

## Dependency Security

Regularly review and update dependencies for:

- Node packages
- Python packages
- container base images
- model runtime libraries
- ffmpeg/system packages

Suggested checks:

```bash
npm audit
pip list --outdated
```

Use your organisation's preferred dependency scanning tools in CI/CD.

## Secrets Management

`.env.example` is safe to commit. Real `.env` files should not be committed.

Recommended `.gitignore` entries:

```gitignore
.env
.env.*
!.env.example
```

## Logging Guidance

Avoid logging:

- raw audio data
- complete transcripts
- personally identifying information
- sensitive operational details
- model cache credentials or private endpoints

Prefer structured operational logs that record status codes, timings, model readiness, and high-level error contexts.

## Production Hardening Checklist

- [ ] TLS configured at ingress.
- [ ] API not directly public unless required.
- [ ] CORS restricted.
- [ ] Request size limits configured.
- [ ] Container user permissions reviewed.
- [ ] Model cache permissions restricted.
- [ ] No secrets in source control.
- [ ] Logs reviewed for sensitive content.
- [ ] Privacy/safety documentation reviewed.
