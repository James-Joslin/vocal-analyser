# Model Card

## System Name

Acoustic Stress Monitor model pipeline.

## Models and Components

The backend pipeline may use:

- faster-whisper for speech transcription.
- Wav2Vec2 audio classification for emotion-like signal classification.
- DistilBERT sentiment analysis for text sentiment.
- Keyword-based distress heuristics.
- Acoustic heuristics derived from pitch, energy, spectral centroid, jitter, and shimmer.

## Intended Use

The system is intended to estimate stress-related acoustic and linguistic indicators for demonstration, research, monitoring, or operator-support workflows.

## Out-of-Scope Use

Do not use this system as:

- a medical diagnostic tool
- a mental health risk classifier
- an emergency triage system
- an employment decisioning tool
- a disciplinary monitoring tool
- an automated safeguarding decision system
- the sole basis for any consequential decision

## Inputs

- Short microphone audio chunks.
- Optional text transcript input for text-only analysis.

## Outputs

- transcript text
- acoustic stress score
- linguistic stress score
- combined stress score
- cognitive load label
- keywords
- intervention recommendation
- acoustic feature values
- optional emotion classification metadata

## Scoring Summary

Backend combined scoring uses weighted components:

```text
combinedStress = emotionStress    * 0.45
               + acousticStress   * 0.25
               + linguisticStress * 0.30
```

Scores are heuristic and clamped to `0–100`.

## Known Limitations

The system can be affected by:

- transcription errors
- poor microphone quality
- background noise
- speaker differences
- non-English or mixed-language speech
- accent and dialect variation
- short audio windows
- model bias
- false keyword matches
- inability to understand context, sarcasm, or indirect language

## Failure Modes

Potential failure modes include:

- Whisper hallucinations on silence/noise.
- Repeated decoder-loop text.
- False high stress from isolated keywords.
- False low stress when distress is expressed indirectly.
- Over-weighting model emotion labels.
- Reduced accuracy for speakers outside model training distributions.

## Mitigations

- Client-side speech activity detection.
- Backend speech energy gate.
- Whisper hallucination and decoder-loop filtering.
- Clear safety disclaimers.
- Human review requirement.
- Transparent scoring documentation.

## Human Oversight

All outputs should be reviewed by a human. The system should support awareness and review, not replace judgement.

## Versioning

When changing model IDs, scoring weights, filters, or heuristics, update:

- this model card
- `docs/model-pipeline.md`
- `docs/features/stress-scoring.md`
- relevant ADRs if the design rationale changes
