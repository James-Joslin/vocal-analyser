# Transcript Feed

## Purpose

The transcript feed displays analysed lines with per-line acoustic, linguistic, and combined stress information.

## Line Shape

A transcript line contains:

- ID
- sender
- text
- timestamp
- acoustic stress score
- optional linguistic stress score
- combined stress score
- analysis state

## UI Behaviour

- New lines are appended to the feed.
- The feed auto-scrolls as new content arrives.
- Line styling changes based on score relative to the threshold.
- Lines can show processing state before sentiment or full analysis completes.

## Warning Overlay

If the latest transcript line exceeds the selected threshold, the UI displays a high-distress indicator warning.
