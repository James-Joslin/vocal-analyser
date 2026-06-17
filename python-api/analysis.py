"""
Stress-analysis pipeline components.

- ``classify_emotion`` — wav2vec2 audio-emotion classification.
- ``analyse_text_distress`` — DistilBERT sentiment + keyword heuristic.
- ``cognitive_load_for_score`` / ``intervention_for_score`` — score→label mappings.
"""

from typing import Dict, Any, List

from config import clamp
from models import get_wav2vec_emotion_classifier, get_natural_language_analyzer


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
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
    found: List[str] = []
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


# ------------------------------------------------------------
# Emotion classification (wav2vec2)
# ------------------------------------------------------------
STRESS_WEIGHTS = {
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


def classify_emotion(audio_path: str) -> Dict[str, Any]:
    classifier = get_wav2vec_emotion_classifier()
    if classifier is None:
        return {"used": False, "predictions": [], "stressComponent": 0.0}

    raw_predictions = classifier(audio_path)
    if raw_predictions and isinstance(raw_predictions[0], list):
        raw_predictions = raw_predictions[0]

    cleaned = []
    weighted_sum = 0.0
    score_sum = 0.0

    for pred in raw_predictions:
        label = normalize_label(str(pred.get("label", "unknown")))
        score = float(pred.get("score", 0.0))
        weight = 30.0
        for key, mapped_weight in STRESS_WEIGHTS.items():
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
# Linguistic / text distress analysis (DistilBERT)
# ------------------------------------------------------------
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
