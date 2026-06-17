"""
Centralised configuration — model IDs, device selection, and shared helpers.

Every value is overridable via environment variable so docker-compose /
Kubernetes manifests can swap models without touching code.
"""

import os
import torch

# ------------------------------------------------------------
# Model identifiers
# ------------------------------------------------------------
WHISPER_MODEL_ID = os.environ.get("WHISPER_MODEL_ID", "large-v3-turbo")

WAV2VEC_EMOTION_MODEL_ID = os.environ.get(
    "WAV2VEC_EMOTION_MODEL_ID",
    # Dpngtm uses the standard AutoModelForAudioClassification head and
    # loads cleanly on all transformers >= 4.35.  The previous default
    # (ehcalabres) silently drops its trained classifier weights.
    "Dpngtm/wav2vec2-emotion-recognition",
)

SENTIMENT_MODEL_ID = os.environ.get(
    "SENTIMENT_MODEL_ID",
    "distilbert-base-uncased-finetuned-sst-2-english",
)

# ------------------------------------------------------------
# Runtime settings
# ------------------------------------------------------------
PRELOAD_MODELS = os.environ.get("PRELOAD_MODELS", "1") == "1"
DEVICE = 0 if torch.cuda.is_available() else -1
DEVICE_LABEL = "cuda" if torch.cuda.is_available() else "cpu"

# Baseline F0 for the acoustic-stress heuristic (Hz).
# 190 Hz is a midpoint between typical male (~130 Hz) and female (~220 Hz)
# fundamental frequencies.  Override via env var for specific speakers.
NEUTRAL_PITCH_HZ = float(os.environ.get("NEUTRAL_PITCH_HZ", "190.0"))


# ------------------------------------------------------------
# Shared helpers
# ------------------------------------------------------------
def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    """Constrain *value* to [low, high]."""
    return min(high, max(low, value))