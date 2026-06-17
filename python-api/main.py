import os
import re
import uuid
import tempfile
import subprocess
from collections import Counter
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
WHISPER_MODEL_ID = os.environ.get("WHISPER_MODEL_ID", "openai/whisper-base")
WAV2VEC_EMOTION_MODEL_ID = os.environ.get(
    "WAV2VEC_EMOTION_MODEL_ID",
    # Previous default (ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition)
    # has a classifier-head architecture mismatch with transformers >= 4.35:
    # its trained dense/output weights are silently dropped and replaced with
    # random projector/classifier weights, producing garbage predictions.
    #
    # Dpngtm/wav2vec2-emotion-recognition uses the standard
    # AutoModelForAudioClassification head, loads cleanly, and covers the
    # same emotion labels our stress_weights mapping expects.
    "Dpngtm/wav2vec2-emotion-recognition",
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
            pipe = pipeline(
                "audio-classification",
                model=WAV2VEC_EMOTION_MODEL_ID,
                device=DEVICE,
                top_k=None,
            )

            # --- Sanity check -------------------------------------------
            # Run a 1-second silence probe through the classifier.  A
            # properly-trained model concentrates probability on "neutral"
            # or "calm"; a model with mismatched / random weights produces
            # a near-uniform distribution (max score ≈ 1/num_classes).
            # This catches the ehcalabres weight-mismatch problem *and*
            # any future model whose checkpoint doesn't load cleanly.
            silence = np.zeros(16000, dtype=np.float32)
            probe = pipe(silence, sampling_rate=16000)
            top_score = max(p["score"] for p in probe) if probe else 0

            if top_score < 0.20:
                print(
                    f"[WARNING] Wav2Vec2 emotion model sanity check failed: "
                    f"top prediction on silence was only {top_score:.3f} "
                    f"(expected > 0.20 for a trained classifier).  "
                    f"This usually means the checkpoint weights don't match "
                    f"the model architecture.  Emotion classification is "
                    f"DISABLED; acoustic + linguistic scoring will be used."
                )
                models_cache["wav2vec"] = None
                model_status["wav2vec"].update({
                    "loaded": False,
                    "error": f"Sanity check failed — top score on silence: {top_score:.3f}",
                })
                return models_cache["wav2vec"]
            # ------------------------------------------------------------

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


def ensure_wav(input_path: str) -> str:
    """
    Convert any audio file to 16 kHz mono WAV via ffmpeg.

    This eliminates two problems at once:
    - PySoundFile cannot decode webm containers, forcing librosa to fall back
      to the deprecated ``audioread`` loader (removed in librosa 1.0).
    - Starting from a clean PCM WAV removes format-related edge cases for
      Whisper, wav2vec2, and librosa's feature extractors.
    """
    wav_path = input_path.rsplit(".", 1)[0] + ".wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
        capture_output=True,
        check=True,
        timeout=30,
    )
    return wav_path


# Phrases Whisper hallucinates when fed non-speech audio (background noise,
# birdsong, hum, silence).  Whisper-tiny is especially prone to this.
# Checked after transcription; matches are discarded before they reach
# the sentiment pipeline.
WHISPER_HALLUCINATIONS = frozenset(s.lower() for s in (
    "Thank you for watching",
    "Thanks for watching",
    "Thank you for listening",
    "Thanks for listening",
    "Please subscribe",
    "Subscribe to my channel",
    "Like and subscribe",
    "See you next time",
    "See you in the next video",
    "I'm sorry",
    "Goodbye",
    "Bye",
    "Bye bye",
    "Bye-bye",
    "You",
    "...",
    "MBC 뉴스 이덕영입니다",
    "Sous-titrage ST' 501",
    "ご視聴ありがとうございました",
))


def is_whisper_hallucination(text: str) -> bool:
    """Return True if the text is a known Whisper noise-hallucination."""
    cleaned = text.strip().lower().rstrip(".!,")
    if len(cleaned) < 3:
        return True
    return cleaned in WHISPER_HALLUCINATIONS


def is_decoder_loop(text: str) -> bool:
    """
    Detect Whisper decoder loops where a word or short phrase repeats
    endlessly (e.g. "yeah, yeah, yeah, ..." × 200).

    Returns True if any single token makes up more than half the words
    and the output is long enough for that to be meaningful (≥ 8 words).
    """
    # Normalise: lowercase, strip punctuation noise
    words = re.findall(r"[a-zA-Z]+", text.lower())
    if len(words) < 8:
        return False

    counts = Counter(words)
    most_common_word, most_common_count = counts.most_common(1)[0]
    return most_common_count > len(words) * 0.5


def is_bad_transcription(text: str) -> bool:
    """Combined filter: static hallucinations + decoder loops."""
    return is_whisper_hallucination(text) or is_decoder_loop(text)


def has_speech_energy(audio: np.ndarray, threshold: float = 0.008) -> bool:
    """Quick RMS energy gate — returns False for near-silence."""
    return float(np.sqrt(np.mean(audio ** 2))) > threshold


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

    # --- Pitch estimation (fundamental frequency only) -------------------
    # librosa.piptrack returns ALL spectral peaks — fundamentals, harmonics,
    # and noise.  Averaging the lot produces values like 1700 Hz for normal
    # speech, which poisons every downstream metric.  Filter to the human
    # fundamental-frequency band (80–400 Hz) before averaging.
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    f0_mask = (pitches > 80) & (pitches < 400)
    f0_pitches = pitches[f0_mask]
    mean_pitch = float(np.mean(f0_pitches)) if len(f0_pitches) > 0 else 0.0

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    centroid_norm = float(clamp((np.mean(centroid) / 4000.0) * 100.0)) if len(centroid) else 0.0

    # Lightweight approximations suitable for UI telemetry, not clinical
    # voice pathology.  Jitter is now computed from the filtered F0 frames
    # so harmonic contamination doesn't inflate the coefficient-of-variation.
    jitter = (
        float(clamp((np.std(f0_pitches) / np.mean(f0_pitches)) * 100.0, 0, 25))
        if len(f0_pitches) > 5 and np.mean(f0_pitches) > 0
        else 0.0
    )
    shimmer = (
        float(clamp((np.std(rms) / np.mean(rms)) * 10.0, 0, 25))
        if len(rms) > 5 and np.mean(rms) > 0
        else 0.0
    )

    # --- Stress heuristic ------------------------------------------------
    # Use pitch *deviation* from a neutral baseline (150 Hz) instead of raw
    # Hz.  Raw pitch dominated the sum — e.g. 200 Hz / 4 = 50 even for calm
    # speech — leaving no headroom for the other metrics.  Deviation rewards
    # the *change* from normal, which is what correlates with vocal stress.
    NEUTRAL_PITCH_HZ = 150.0
    pitch_deviation = clamp(abs(mean_pitch - NEUTRAL_PITCH_HZ) * 0.25, 0, 30) if mean_pitch > 0 else 0.0
    energy_component = clamp(rms_energy * 0.35, 0, 30)

    acoustic_heuristic = clamp(
        energy_component + pitch_deviation + (centroid_norm * 0.25) + (jitter * 1.2) + (shimmer * 1.2),
        10, 100,
    )

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
    wav_path = None

    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file was empty.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix=f"upload_{uuid.uuid4().hex}_") as tmp:
            tmp.write(audio_bytes)
            temp_path = tmp.name

        # Convert to 16 kHz mono WAV up-front so every downstream tool
        # (Whisper, librosa, wav2vec2) gets clean PCM input.  This also
        # eliminates the PySoundFile → audioread deprecation chain.
        wav_path = ensure_wav(temp_path)

        # ---- Energy gate ------------------------------------------------
        # Quick pre-check: if the chunk is near-silence, skip the full model
        # pipeline entirely.  Saves GPU/CPU time and prevents Whisper from
        # hallucinating on ambient room noise.
        y_gate, _ = librosa.load(wav_path, sr=16000, mono=True)
        if not has_speech_energy(y_gate):
            return {
                "text": "",
                "acousticStressScore": 10.0,
                "linguisticStressScore": 0.0,
                "combinedStressScore": 10.0,
                "cognitiveLoad": "low",
                "intervention": "No speech detected in this segment.",
                "keywords": [],
                "sentimentScore": 0.0,
                "acousticFeatures": {"energy": 0, "pitch": 0, "spectralCentroid": 0, "jitter": 0, "shimmer": 0},
                "vocalMetrics": {},
                "wav2vecClassifierUsed": False,
                "wav2vecPredictions": [],
                "topEmotion": None,
                "topEmotionScore": 0.0,
                "status": "success",
                "processor": "EnergyGate-BelowThreshold",
            }

        # ---- Transcription (Whisper) ------------------------------------
        asr = get_whisper_pipeline()
        transcribed_text = ""
        if asr is not None:
            # Pin to English transcription to reduce hallucination on
            # non-speech audio (Whisper's multilingual mode is far more
            # prone to generating stock phrases on background noise).
            asr_result = asr(wav_path, generate_kwargs={"language": "en", "task": "transcribe"})
            candidate = asr_result.get("text", "").strip()

            if is_bad_transcription(candidate):
                print(f"[INFO] Whisper bad output filtered: {candidate[:80]!r}{'…' if len(candidate) > 80 else ''}")
            else:
                transcribed_text = candidate

        acoustic = extract_acoustic_metrics(wav_path)
        emotion = classify_emotion(wav_path)
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
        # When wav2vec emotion is unavailable, emotion_stress == acoustic_stress,
        # giving an effective 70/30 acoustic/linguistic split.
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
        for path in (temp_path, wav_path):
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)