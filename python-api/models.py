"""
Model registry — lazy-loading with caching, sanity checks, and optional
startup preload.

Each ``get_*`` function loads once on first call and returns the cached
instance on subsequent calls.  ``preload_models()`` eagerly warms all
three caches so the first HTTP request doesn't pay the load penalty.
"""

from typing import Dict, Any, Optional

import numpy as np
import torch
from transformers import pipeline
from faster_whisper import WhisperModel

from config import (
    WHISPER_MODEL_ID,
    WAV2VEC_EMOTION_MODEL_ID,
    SENTIMENT_MODEL_ID,
    PRELOAD_MODELS,
    DEVICE,
)

# ------------------------------------------------------------
# Internal state
# ------------------------------------------------------------
models_cache: Dict[str, Any] = {}
model_status: Dict[str, Dict[str, Any]] = {
    "whisper": {"loaded": False, "modelId": WHISPER_MODEL_ID, "error": None},
    "wav2vec": {"loaded": False, "modelId": WAV2VEC_EMOTION_MODEL_ID, "error": None},
    "sentiment": {"loaded": False, "modelId": SENTIMENT_MODEL_ID, "error": None},
}


# ------------------------------------------------------------
# Loaders
# ------------------------------------------------------------
def get_whisper_model() -> Optional[WhisperModel]:
    """Load faster-whisper.  CTranslate2 gives ~4× speedup over the HF
    transformers pipeline and native INT8 quantisation on CPU."""
    if "whisper" not in models_cache:
        print(f"[INFO] Loading faster-whisper model: {WHISPER_MODEL_ID}")
        try:
            compute_type = "float16" if torch.cuda.is_available() else "int8"
            device = "cuda" if torch.cuda.is_available() else "cpu"
            models_cache["whisper"] = WhisperModel(
                WHISPER_MODEL_ID,
                device=device,
                compute_type=compute_type,
            )
            model_status["whisper"].update({"loaded": True, "error": None})
        except Exception as exc:
            model_status["whisper"].update({"loaded": False, "error": str(exc)})
            models_cache["whisper"] = None
            print(f"[ERROR] faster-whisper load failed: {exc}")
    return models_cache["whisper"]


def get_wav2vec_emotion_classifier():
    if "wav2vec" not in models_cache:
        print(f"[INFO] Loading Wav2Vec2 emotion model: {WAV2VEC_EMOTION_MODEL_ID}")
        try:
            pipe = pipeline(
                "audio-classification",
                model=WAV2VEC_EMOTION_MODEL_ID,
                device=DEVICE,
                top_k=None,
            )

            # --- Sanity check -------------------------------------------
            # A 1-second silence probe: a trained classifier concentrates
            # probability on "neutral"; random weights produce ≈ uniform.
            silence = np.zeros(16000, dtype=np.float32)
            probe = pipe(silence, sampling_rate=16000)
            top_score = max(p["score"] for p in probe) if probe else 0

            if top_score < 0.20:
                print(
                    f"[WARNING] Wav2Vec2 emotion model sanity check failed: "
                    f"top prediction on silence was only {top_score:.3f} "
                    f"(expected > 0.20 for a trained classifier).  "
                    f"Emotion classification is DISABLED; acoustic + "
                    f"linguistic scoring will be used."
                )
                models_cache["wav2vec"] = None
                model_status["wav2vec"].update({
                    "loaded": False,
                    "error": f"Sanity check failed — top score on silence: {top_score:.3f}",
                })
                return models_cache["wav2vec"]

            models_cache["wav2vec"] = pipe
            model_status["wav2vec"].update({"loaded": True, "error": None})
        except Exception as exc:
            model_status["wav2vec"].update({"loaded": False, "error": str(exc)})
            models_cache["wav2vec"] = None
            print(f"[ERROR] Wav2Vec2 load failed: {exc}")
    return models_cache["wav2vec"]


def get_natural_language_analyzer():
    if "sentiment" not in models_cache:
        print(f"[INFO] Loading sentiment model: {SENTIMENT_MODEL_ID}")
        try:
            models_cache["sentiment"] = pipeline(
                "sentiment-analysis",
                model=SENTIMENT_MODEL_ID,
                device=DEVICE,
            )
            model_status["sentiment"].update({"loaded": True, "error": None})
        except Exception as exc:
            model_status["sentiment"].update({"loaded": False, "error": str(exc)})
            models_cache["sentiment"] = None
            print(f"[ERROR] Sentiment model load failed: {exc}")
    return models_cache["sentiment"]


# ------------------------------------------------------------
# Preload
# ------------------------------------------------------------
def preload_models():
    if not PRELOAD_MODELS:
        print("[INFO] PRELOAD_MODELS=0, models will lazy-load on first request.")
        return

    print("[INFO] Preloading models before API accepts traffic...")
    get_whisper_model()
    get_wav2vec_emotion_classifier()
    get_natural_language_analyzer()
    print(f"[INFO] Model preload complete: {model_status}")
