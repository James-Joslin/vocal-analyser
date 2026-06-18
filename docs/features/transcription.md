# Transcription

## Purpose

The transcription feature converts uploaded audio chunks into text using the backend faster-whisper pipeline.

## Flow

```text
Audio chunk
  -> POST /api/transcribe
  -> temporary file
  -> WAV conversion
  -> speech energy gate
  -> faster-whisper transcription
  -> bad output filter
  -> transcript returned to frontend
```

## Supported Upload Types

```text
.wav
.mp3
.ogg
.m4a
.flac
.webm
```

## Filtering

The backend filters common non-speech outputs and decoder loops before treating text as a real transcript.

## Empty Transcript

If no speech is detected or transcript output is rejected, the API returns a successful response with empty text and low stress values.

## Operational Notes

- Ensure ffmpeg is available in the Python runtime.
- Keep model cache persistent to avoid slow cold starts.
- Watch logs for repeated hallucination phrases and update filters if needed.
