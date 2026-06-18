# Microphone Capture

## Purpose

Microphone capture allows the browser to record speech and provide live acoustic telemetry to the UI.

## User Flow

```text
User clicks Initialise Mic
  -> browser permission prompt
  -> microphone stream acquired
  -> AudioContext and AnalyserNode created
  -> MediaRecorder started
  -> live telemetry and upload loop begin
```

## Browser Permission

The app only requests microphone access when the user starts a microphone session. If access is denied or blocked by an iframe/browser policy, the UI displays recovery guidance and offers simulation mode.

## Web Audio Usage

The microphone stream is connected to an `AnalyserNode`. This is used for live telemetry and speech activity detection.

## Session Stop

Stopping the session should:

- stop the recorder timer
- stop active media tracks
- close the audio context
- clear analyser and stream state
- reset recording/simulation flags

## Failure Handling

Common failure causes:

- browser permission denied
- insecure origin outside localhost/HTTPS
- iframe restrictions
- microphone already in use
- unsupported browser APIs
