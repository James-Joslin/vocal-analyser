"""Health and readiness probes."""

from fastapi import APIRouter

from config import DEVICE_LABEL
from models import model_status

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "device": DEVICE_LABEL,
        "features": ["whisper-transcribe", "wav2vec2-emotion", "distilbert-sentiment"],
    }


@router.get("/api/ready")
def readiness_check():
    all_loaded = all(v["loaded"] for v in model_status.values())
    return {
        "ready": all_loaded,
        "device": DEVICE_LABEL,
        "models": model_status,
    }
