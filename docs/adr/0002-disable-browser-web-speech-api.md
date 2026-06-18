# ADR-0002: Avoid Browser Web Speech API

## Status

Accepted

## Context

Some browser speech recognition implementations may route audio through external cloud services. Running this in parallel with MediaRecorder can also create duplicate transcript entries.

## Decision

Do not use the browser Web Speech API for production transcription. Use MediaRecorder chunks sent to the self-hosted Python API instead.

## Consequences

This better supports the self-hosted processing model and avoids duplicate transcription paths. It requires chunking, upload management, backend transcription, and robust handling of no-speech audio.
