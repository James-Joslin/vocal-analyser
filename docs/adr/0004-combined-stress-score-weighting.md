# ADR-0004: Combined Stress Score Weighting

## Status

Accepted

## Context

The backend produces multiple stress-related signals: emotion-derived stress, acoustic stress, and linguistic stress. A single combined score is useful for UI thresholding and reporting.

## Decision

Use a weighted heuristic score: emotion stress 45%, acoustic stress 25%, and linguistic stress 30%, clamped to 0-100.

## Consequences

The score is transparent and easy to explain, but remains heuristic. Weighting changes should be documented in the model pipeline, stress scoring feature doc, model card, and changelog.
