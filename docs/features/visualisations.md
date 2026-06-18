# Visualisations

## Purpose

The frontend uses D3 visualisations to make live and session-level signals easier to inspect.

## Waveform

The waveform panel renders an FFT-style time-wave display from analyser data or simulated values.

## Radial Stress Radar

The radial radar maps acoustic and stress values into a circular display. It provides a compact view of current session intensity.

## Stress Trend Chart

The trend chart displays session stress data over time, including:

- combined stress
- acoustic tension
- threshold bands
- alert markers
- hover details

## Responsive Behaviour

The chart uses resize observation so it can adapt to the available container width.

## Interpretation

Visualisations are intended as operator feedback and debugging aids. They should not be treated as clinical measurement displays.
