# Emotion Classification

## Purpose

The backend can use Wav2Vec2 audio classification to estimate emotion-like categories from speech audio.

## Flow

```text
WAV audio
  -> Wav2Vec2 classifier
  -> label probabilities
  -> stress component mapping
```

## Stress Weighting

Emotion labels are mapped to stress components. Labels associated with fear or anger typically contribute more stress than neutral or calm labels.

## Output Fields

The transcription response may include:

- `wav2vecClassifierUsed`
- `wav2vecPredictions`
- `topEmotion`
- `topEmotionScore`

## Limitations

Emotion classification from voice is uncertain and context-sensitive. It should not be interpreted as definitive proof of emotion, intent, or mental state.
