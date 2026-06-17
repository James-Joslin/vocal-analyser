"""
Audio processing utilities.

- ``ensure_wav`` — ffmpeg conversion to 16 kHz mono WAV.
- ``has_speech_energy`` — quick RMS gate to skip near-silence.
- ``extract_acoustic_metrics`` — pitch, energy, jitter, shimmer, and the
  composite stress heuristic used for the "Acoustic Tension" score.
"""

import subprocess
from typing import Dict, Any

import numpy as np
import librosa

from config import clamp, NEUTRAL_PITCH_HZ


def ensure_wav(input_path: str) -> str:
    """Convert any audio file to 16 kHz mono WAV via ffmpeg.

    Eliminates the PySoundFile → audioread deprecation chain and gives
    every downstream tool (Whisper, librosa, wav2vec2) clean PCM input.
    """
    wav_path = input_path.rsplit(".", 1)[0] + ".wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", input_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
        capture_output=True,
        check=True,
        timeout=30,
    )
    return wav_path


def has_speech_energy(audio: np.ndarray, threshold: float = 0.008) -> bool:
    """Quick RMS energy gate — returns False for near-silence."""
    return float(np.sqrt(np.mean(audio ** 2))) > threshold


def extract_acoustic_metrics(audio_path: str) -> Dict[str, Any]:
    """Extract vocal metrics and compute the acoustic stress heuristic."""
    y, sr = librosa.load(audio_path, sr=16000, mono=True)

    rms = librosa.feature.rms(y=y)[0]
    rms_energy = float(np.mean(rms) * 1000.0) if len(rms) else 0.0

    # --- Pitch estimation (fundamental frequency only) -------------------
    # librosa.piptrack returns ALL spectral peaks (fundamentals + harmonics).
    # Filter to the human F0 band (80–400 Hz) before averaging.
    pitches, _magnitudes = librosa.piptrack(y=y, sr=sr)
    f0_mask = (pitches > 80) & (pitches < 400)
    f0_pitches = pitches[f0_mask]
    mean_pitch = float(np.mean(f0_pitches)) if len(f0_pitches) > 0 else 0.0

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    centroid_norm = float(clamp((np.mean(centroid) / 4000.0) * 100.0)) if len(centroid) else 0.0

    # Jitter/shimmer — lightweight approximations (not clinical-grade).
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
    # Jitter is excluded from scoring — the frame-level CV of F0 across a
    # 6-second chunk measures prosodic intonation (voice rising and falling
    # in a sentence), NOT cycle-to-cycle vocal cord perturbation.  It hits
    # 25% on every chunk regardless of actual stress.  The raw value is
    # still returned in features/vocalMetrics for display.
    #
    # Each remaining component subtracts a conversational baseline so that
    # normal speech contributes near-zero; only the excess drives the score.
    energy_component = clamp((rms_energy - 20) * 0.25, 0, 20)
    pitch_component = clamp((abs(mean_pitch - NEUTRAL_PITCH_HZ) - 50) * 0.2, 0, 20) if mean_pitch > 0 else 0.0
    centroid_component = clamp((centroid_norm - 40) * 0.2, 0, 15)
    shimmer_component = clamp((shimmer - 8) * 1.5, 0, 15)

    acoustic_heuristic = clamp(
        15 + energy_component + pitch_component + centroid_component + shimmer_component,
        10, 100,
    )

    print(
        f"[ACOUSTIC] energy={rms_energy:.1f}→{energy_component:.1f}  "
        f"pitch={mean_pitch:.0f}Hz→{pitch_component:.1f}  "
        f"centroid={centroid_norm:.1f}%→{centroid_component:.1f}  "
        f"jitter={jitter:.1f}%(excluded)  "
        f"shimmer={shimmer:.1f}%→{shimmer_component:.1f}  "
        f"TOTAL={acoustic_heuristic:.0f}%"
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