import os
import re
import uuid
import tempfile
from contextlib import asynccontextmanager
from typing import List, Dict, Any, Optional

import torch
import numpy as np
import librosa
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import pipeline

# ------------------------------------------------------------
# MODEL CONFIG
# ------------------------------------------------------------
WHISPER_MODEL_ID = os.environ.get("WHISPER_MODEL_ID", "openai/whisper-tiny")
WAV2VEC_EMOTION_MODEL_ID = os.environ.get(
    "WAV2VEC_EMOTION_MODEL_ID",
    "ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
)
SENTIMENT_MODEL_ID = os.environ.get(
    "SENTIMENT_MODEL_ID",
    "distilbert-base-uncased-finetuned-sst-2-english",
)
PRELOAD_MODELS = os.environ.get("PRELOAD_MODELS", "1") == "1"
DEVICE = 0 if torch.cuda.is_available() else -1
DEVICE_LABEL = "cuda" if torch.cuda.is_available() else "cpu"

models_cache: Dict[str, Any] = {}
model_status: Dict[str, Dict[str, Any]] = {
    "whisper": {"loaded": False, "modelId": WHISPER_MODEL_ID, "error": None},
    "wav2vec": {"loaded": False, "modelId": WAV2VEC_EMOTION_MODEL_ID, "error": None},
    "sentiment": {"loaded": False, "modelId": SENTIMENT_MODEL_ID, "error": None},
}

# ------------------------------------------------------------
# STARTUP MODEL PRELOAD
# ------------------------------------------------------------
def get_whisper_pipeline():
    if "whisper" not in models_cache:
        print(f"[INFO] Loading Whisper ASR model: {WHISPER_MODEL_ID}")
        try:
            models_cache["whisper"] = pipeline(
                "automatic-speech-recognition",
                model=WHISPER_MODEL_ID,
                device=DEVICE,
            )
            model_status["whisper"].update({"loaded": True, "error": None})
        except Exception as exc:
            model_status["whisper"].update({"loaded": False, "error": str(exc)})
            models_cache["whisper"] = None
            print(f"[ERROR] Whisper load failed: {exc}")
    return models_cache["whisper"]


def get_wav2vec_emotion_classifier():
    if "wav2vec" not in models_cache:
        print(f"[INFO] Loading Wav2Vec2 emotion model: {WAV2VEC_EMOTION_MODEL_ID}")
        try:
            models_cache["wav2vec"] = pipeline(
                "audio-classification",
                model=WAV2VEC_EMOTION_MODEL_ID,
                device=DEVICE,
                top_k=None,
            )
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


def preload_models():
    if not PRELOAD_MODELS:
        print("[INFO] PRELOAD_MODELS=0, models will lazy-load on first request.")
        return

    print("[INFO] Preloading models before API accepts traffic...")
    get_whisper_pipeline()
    get_wav2vec_emotion_classifier()
    get_natural_language_analyzer()
    print(f"[INFO] Model preload complete: {model_status}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    preload_models()
    yield


app = FastAPI(
    title="Psychological Stress Analytics Engine",
    description="On-premises FastAPI using Whisper, Wav2Vec2 emotion classification, and DistilBERT sentiment analysis",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------
# SCHEMAS
# ------------------------------------------------------------
class SentimentRequest(BaseModel):
    text: str


class SentimentResponse(BaseModel):
    sentimentScore: float
    stressScore: int
    cognitiveLoad: str
    keywords: List[str]
    intervention: str
    modelClass: str
    processedOnPremises: bool


# ------------------------------------------------------------
# ANALYSIS HELPERS
# ------------------------------------------------------------
def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return min(high, max(low, value))


def normalize_label(label: str) -> str:
    return label.lower().strip().replace("label_", "")


def keyword_stress(text: str) -> tuple[int, List[str]]:
    lower = text.lower()
    distress_triggers = {
        "help": 22,
        "dying": 35,
        "fire": 30,
        "danger": 20,
        "scared": 25,
        "cannot breathe": 35,
        "hurry": 20,
        "police": 20,
        "gun": 30,
        "pain": 15,
        "anxious": 20,
        "stress": 15,
        "panicking": 25,
        "screaming": 25,
        "collapse": 20,
        "immediate": 16,
        "urgent": 16,
        "no": 8,
    }
    found = []
    total = 0
    for phrase, weight in distress_triggers.items():
        if phrase in lower:
            found.append(phrase)
            total += weight
    return total, found


def intervention_for_score(score: float) -> str:
    if score >= 80:
        return "High distress indicators detected. Slow the pace, use short reassurance prompts, and guide a structured breathing pause."
    if score >= 60:
        return "Elevated distress indicators detected. Reduce speaking speed, use grounding prompts, and allow longer pauses."
    if score >= 40:
        return "Moderate pressure detected. Maintain calm tone and check understanding before continuing."
    return "Stress indicators are low. Maintain conversational rapport."


def cognitive_load_for_score(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "moderate"
    return "low"


def analyse_text_distress(text: str) -> Dict[str, Any]:
    analyser = get_natural_language_analyzer()
    bonus, found_keywords = keyword_stress(text)

    sentiment_score = 0.0
    nlp_stress = 20.0
    model_name = "HeuristicLinguisticModel"

    if analyser is not None and text.strip():
        try:
            pred = analyser(text)[0]
            label = pred.get("label", "NEUTRAL").upper()
            confidence = float(pred.get("score", 0.0))
            model_name = "DistilBERT-SST-2-SentimentPipeline"

            if "NEG" in label:
                sentiment_score = -confidence
                nlp_stress = 45.0 + confidence * 45.0
            else:
                sentiment_score = confidence
                nlp_stress = 30.0 - confidence * 20.0
        except Exception as exc:
            print(f"[WARNING] Sentiment inference failed: {exc}")

    stress = clamp(nlp_stress + bonus * 0.4)

    return {
        "sentimentScore": round(float(sentiment_score), 2),
        "stressScore": int(round(stress)),
        "cognitiveLoad": cognitive_load_for_score(stress),
        "keywords": found_keywords[:8],
        "intervention": intervention_for_score(stress),
        "modelClass": model_name,
        "processedOnPremises": True,
    }


def extract_acoustic_metrics(audio_path: str) -> Dict[str, Any]:
    y, sr = librosa.load(audio_path, sr=16000, mono=True)

    rms = librosa.feature.rms(y=y)[0]
    rms_energy = float(np.mean(rms) * 1000.0) if len(rms) else 0.0

    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    active_pitches = pitches[pitches > 0]
    mean_pitch = float(np.mean(active_pitches)) if len(active_pitches) > 0 else 0.0

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    centroid_norm = float(clamp((np.mean(centroid) / 4000.0) * 100.0)) if len(centroid) else 0.0

    # Lightweight approximations suitable for UI telemetry, not clinical voice pathology.
    pitch_frames = active_pitches[active_pitches > 50]
    jitter = float(clamp((np.std(pitch_frames) / np.mean(pitch_frames)) * 100.0, 0, 25)) if len(pitch_frames) > 5 and np.mean(pitch_frames) > 0 else 0.0
    shimmer = float(clamp((np.std(rms) / np.mean(rms)) * 10.0, 0, 25)) if len(rms) > 5 and np.mean(rms) > 0 else 0.0

    acoustic_heuristic = clamp((rms_energy / 2.0) + (mean_pitch / 4.0) + (centroid_norm * 0.25) + (jitter * 1.2) + (shimmer * 1.2), 10, 100)

    return {
        "y": y,
        "sr": sr,
        "stress": acoustic_heuristic,
        "features": {
            "energy": round(float(clamp(rms_energy)), 2),
            "pitch": round(float(mean_pitch), 2),
            "spectralCentroid": round(float(centroid_norm), 2),
            "jitter": round(float(jitter), 2),
            "shimmer": round(float(shimmer), 2),
        },
        "vocalMetrics": {
            "fundamentalFrequencyHz": round(float(mean_pitch), 1),
            "rawEnergy": round(float(rms_energy), 2),
            "spectralCentroidPercent": round(float(centroid_norm), 2),
            "jitterPercent": round(float(jitter), 2),
            "shimmerPercent": round(float(shimmer), 2),
            "samplingRate": sr,
        },
    }


def classify_emotion(audio_path: str) -> Dict[str, Any]:
    classifier = get_wav2vec_emotion_classifier()
    if classifier is None:
        return {"used": False, "predictions": [], "stressComponent": 0.0}

    raw_predictions = classifier(audio_path)
    if raw_predictions and isinstance(raw_predictions[0], list):
        raw_predictions = raw_predictions[0]

    stress_weights = {
        "angry": 85.0,
        "anger": 85.0,
        "fearful": 95.0,
        "fear": 95.0,
        "sad": 55.0,
        "sadness": 55.0,
        "disgust": 60.0,
        "surprised": 45.0,
        "surprise": 45.0,
        "calm": 15.0,
        "neutral": 15.0,
        "happy": 10.0,
        "happiness": 10.0,
    }

    cleaned = []
    weighted_sum = 0.0
    score_sum = 0.0

    for pred in raw_predictions:
        label = normalize_label(str(pred.get("label", "unknown")))
        score = float(pred.get("score", 0.0))
        weight = 30.0
        for key, mapped_weight in stress_weights.items():
            if key in label:
                weight = mapped_weight
                break
        weighted_sum += score * weight
        score_sum += score
        cleaned.append({"label": label, "score": round(score, 4)})

    cleaned.sort(key=lambda item: item["score"], reverse=True)
    stress_component = weighted_sum / score_sum if score_sum > 0 else 0.0

    return {
        "used": True,
        "predictions": cleaned[:5],
        "topEmotion": cleaned[0]["label"] if cleaned else None,
        "topEmotionScore": cleaned[0]["score"] if cleaned else 0.0,
        "stressComponent": round(float(stress_component), 2),
    }


# ------------------------------------------------------------
# ENDPOINTS
# ------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "device": DEVICE_LABEL,
        "features": ["whisper-transcribe", "wav2vec2-emotion", "distilbert-sentiment"],
    }


@app.get("/api/ready")
def readiness_check():
    all_loaded = all(v["loaded"] for v in model_status.values())
    return {
        "ready": all_loaded,
        "device": DEVICE_LABEL,
        "models": model_status,
    }


@app.post("/api/analyze-sentiment", response_model=SentimentResponse)
async def analyze_sentiment(payload: SentimentRequest):
    result = analyse_text_distress(payload.text)
    return SentimentResponse(**result)


@app.post("/api/transcribe")
async def transcribe_vocal_audio(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith((".wav", ".mp3", ".ogg", ".m4a", ".flac", ".webm")):
        raise HTTPException(status_code=400, detail="Invalid audio file extension.")

    suffix = os.path.splitext(file.filename)[1].lower() or ".audio"
    temp_path = None

    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file was empty.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix=f"upload_{uuid.uuid4().hex}_") as tmp:
            tmp.write(audio_bytes)
            temp_path = tmp.name

        asr = get_whisper_pipeline()
        transcribed_text = ""
        if asr is not None:
            asr_result = asr(temp_path)
            transcribed_text = asr_result.get("text", "").strip()

        acoustic = extract_acoustic_metrics(temp_path)
        emotion = classify_emotion(temp_path)
        linguistic = analyse_text_distress(transcribed_text) if transcribed_text else {
            "sentimentScore": 0.0,
            "stressScore": 20,
            "cognitiveLoad": "low",
            "keywords": [],
            "intervention": "No transcript produced. Review audio quality or try a clearer sample.",
            "modelClass": "NoTranscriptFallback",
            "processedOnPremises": True,
        }

        acoustic_stress = acoustic["stress"]
        emotion_stress = emotion["stressComponent"] if emotion["used"] else acoustic_stress
        linguistic_stress = float(linguistic["stressScore"])

        # Distress blend: emotion/acoustic carries vocal cues; linguistic carries transcript cues.
        combined_distress = clamp((emotion_stress * 0.45) + (acoustic_stress * 0.25) + (linguistic_stress * 0.30), 0, 100)

        return {
            "text": transcribed_text,
            "acousticStressScore": round(float(acoustic_stress), 1),
            "linguisticStressScore": round(float(linguistic_stress), 1),
            "combinedStressScore": round(float(combined_distress), 1),
            "cognitiveLoad": cognitive_load_for_score(combined_distress),
            "intervention": intervention_for_score(combined_distress),
            "keywords": linguistic.get("keywords", []),
            "sentimentScore": linguistic.get("sentimentScore", 0.0),
            "acousticFeatures": acoustic["features"],
            "vocalMetrics": acoustic["vocalMetrics"],
            "wav2vecClassifierUsed": emotion["used"],
            "wav2vecPredictions": emotion["predictions"],
            "topEmotion": emotion.get("topEmotion"),
            "topEmotionScore": emotion.get("topEmotionScore", 0.0),
            "status": "success",
            "processor": "WhisperTiny-Wav2Vec2-DistilBERT-StressAdapter",
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcribe failure context: {str(exc)}")
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
