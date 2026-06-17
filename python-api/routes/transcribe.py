"""POST /api/transcribe — the main audio-analysis pipeline."""

import os
import uuid
import tempfile

import librosa
from fastapi import APIRouter, UploadFile, File, HTTPException

from config import clamp
from models import get_whisper_model
from audio import ensure_wav, has_speech_energy, extract_acoustic_metrics
from filters import is_bad_transcription
from analysis import classify_emotion, analyse_text_distress, cognitive_load_for_score, intervention_for_score

router = APIRouter()

ALLOWED_EXTENSIONS = (".wav", ".mp3", ".ogg", ".m4a", ".flac", ".webm")


@router.post("/api/transcribe")
async def transcribe_vocal_audio(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(ALLOWED_EXTENSIONS):
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

        # Convert to 16 kHz mono WAV for all downstream tools.
        wav_path = ensure_wav(temp_path)

        # ---- Energy gate ------------------------------------------------
        y_gate, _ = librosa.load(wav_path, sr=16000, mono=True)
        if not has_speech_energy(y_gate):
            return _empty_response()

        # ---- Transcription (faster-whisper) -----------------------------
        asr = get_whisper_model()
        transcribed_text = ""
        if asr is not None:
            segments, _info = asr.transcribe(
                wav_path,
                language="en",
                task="transcribe",
                beam_size=5,
                vad_filter=True,
                vad_parameters=dict(
                    min_speech_duration_ms=250,
                    min_silence_duration_ms=500,
                ),
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                log_prob_threshold=-1.0,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3,
            )
            candidate = " ".join(seg.text.strip() for seg in segments).strip()

            if is_bad_transcription(candidate):
                print(f"[INFO] Whisper bad output filtered: {candidate[:80]!r}{'…' if len(candidate) > 80 else ''}")
            else:
                transcribed_text = candidate

        # ---- Acoustic / emotion / linguistic analysis --------------------
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

        combined_distress = clamp(
            (emotion_stress * 0.45) + (acoustic_stress * 0.25) + (linguistic_stress * 0.30),
            0, 100,
        )

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
            "processor": "FasterWhisper-Wav2Vec2-DistilBERT-StressAdapter",
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


def _empty_response() -> dict:
    """Minimal response for chunks below the speech-energy threshold."""
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
