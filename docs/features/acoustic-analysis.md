# Acoustic Analysis

## Purpose

Acoustic analysis estimates voice-related signal features that may correlate with tension, intensity, or strain.

## Frontend Metrics

The browser estimates:

- energy
- pitch
- spectral centroid
- jitter
- shimmer

These values are used for live UI telemetry.

## Backend Metrics

The backend extracts acoustic metrics from normalised WAV audio and returns:

- acoustic feature values
- vocal metrics
- acoustic stress score

## Important Distinction

Frontend acoustic analysis is approximate and optimised for live display. Backend acoustic analysis is performed on converted audio chunks and is used in the full combined score.

## Limitations

Acoustic features are sensitive to microphone quality, distance, background noise, room acoustics, and speaker characteristics.
