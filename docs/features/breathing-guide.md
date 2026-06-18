# Breathing Guide

## Purpose

The breathing guide provides a continuous 4-7-8 style pacing prompt for calming and grounding.

## Cycle

```text
Inhale  -> 4 seconds
Hold    -> 7 seconds
Exhale  -> 8 seconds
Pause   -> 4 seconds
```

## UI Integration

The current phase and seconds remaining are rendered in the intervention panel.

## Implementation Note

The hook derives the next phase and its duration together to avoid stale React state timing issues.
