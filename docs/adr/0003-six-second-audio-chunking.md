# ADR-0003: Six-Second Audio Chunking

## Status

Accepted

## Context

The application needs near-real-time transcription without holding a single long recording until the session ends. Chunks must also be decodable cleanly by backend tools.

## Decision

Use MediaRecorder stop/start cycles every six seconds, producing complete WebM chunks for backend upload.

## Consequences

This keeps the UI responsive and produces independent audio files for processing. It introduces timing, restart, upload lock, and speech-gate logic that must be tested carefully.
