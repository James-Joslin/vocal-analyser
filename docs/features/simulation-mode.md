# Simulation Mode

## Purpose

Simulation mode lets users test the UI without microphone access or live speech.

## Behaviour

Simulation mode generates synthetic acoustic features and periodically injects pre-authored transcript lines.

## Use Cases

- demos
- local testing without microphone permissions
- browser/iframe environments where mic access is blocked
- visual regression checks

## Limitations

Simulation data is synthetic and should not be used to validate model accuracy.
