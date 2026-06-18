# ADR-0001: Self-Hosted Processing

## Status

Accepted

## Context

The application processes microphone audio and transcript text. These inputs may be sensitive and should not be sent to unmanaged external services by default.

## Decision

Route transcription, acoustic analysis, emotion classification, and text distress analysis through the self-hosted Python FastAPI service.

## Consequences

This supports a clearer privacy model and reduces external data egress. It also means the deployment must manage model runtime dependencies, compute capacity, cold starts, model caching, and service readiness.
