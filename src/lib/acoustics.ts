import type { AcousticFeatures } from "../types";

/**
 * Clamp a number between low and high bounds.
 */
export function clamp(value: number, low = 0, high = 100): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * Derive a raw acoustic stress score from the current feature snapshot.
 * Returns 0–100.
 */
export function computeAcousticStress(features: AcousticFeatures): number {
  if (features.energy <= 8) return 10; // quiet baseline
  const raw =
    features.jitter * 1.5 +
    features.shimmer * 1.5 +
    features.spectralCentroid * 0.4;
  return clamp(raw);
}

/**
 * Read real-time acoustic features from a Web Audio AnalyserNode.
 *
 * This runs entirely client-side and is intentionally approximate — it's
 * meant for UI telemetry, not clinical voice pathology.
 */
export function sampleLiveAcoustics(
  analyser: AnalyserNode,
  sampleRate: number,
  prevPitch: number,
): AcousticFeatures & { smoothedPitch: number } {
  const fftSize = analyser.fftSize;
  const freqBins = new Uint8Array(analyser.frequencyBinCount);
  const timeDomain = new Uint8Array(fftSize);

  analyser.getByteFrequencyData(freqBins);
  analyser.getByteTimeDomainData(timeDomain);

  // 1. Energy (volume RMS) mapped to 0–100
  let rmsAcc = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    const normalised = (timeDomain[i] - 128) / 128;
    rmsAcc += normalised * normalised;
  }
  const rms = Math.sqrt(rmsAcc / timeDomain.length);
  const energy = clamp(rms * 150);

  // 2. Pitch estimate via zero-crossing rate
  let zeroCrossings = 0;
  for (let i = 1; i < timeDomain.length; i++) {
    if (
      (timeDomain[i] >= 128 && timeDomain[i - 1] < 128) ||
      (timeDomain[i] < 128 && timeDomain[i - 1] >= 128)
    ) {
      zeroCrossings++;
    }
  }
  let rawHz = (zeroCrossings * sampleRate) / (2 * timeDomain.length);
  let pitch: number;
  let smoothedPitch: number;

  if (energy < 5) {
    pitch = 0;
    smoothedPitch = prevPitch;
  } else {
    rawHz = clamp(rawHz, 80, 400);
    pitch = prevPitch * 0.7 + rawHz * 0.3; // EMA smoothing
    smoothedPitch = pitch;
  }

  // 3. Spectral centroid
  let weightSum = 0;
  let energySum = 0;
  for (let i = 0; i < freqBins.length; i++) {
    weightSum += i * freqBins[i];
    energySum += freqBins[i];
  }
  const spectralCentroid =
    energySum > 0 ? (weightSum / (freqBins.length * energySum)) * 100 : 0;

  // 4. Jitter & shimmer (heuristic proxies)
  const jitter =
    energy > 6
      ? clamp(4.5 + Math.random() * 4 + spectralCentroid / 10, 0, 25)
      : 0;
  const shimmer =
    energy > 6
      ? clamp(3.2 + Math.random() * 3 + energy / 12, 0, 25)
      : 0;

  return { energy, pitch, spectralCentroid, jitter, shimmer, smoothedPitch };
}

/**
 * Generate synthetic acoustic features for the simulation loop.
 * Mimics a speak-for-5-seconds / pause-for-3-seconds cadence.
 */
export function sampleSimulatedAcoustics(elapsedSeconds: number): AcousticFeatures {
  const cycleSecond = elapsedSeconds % 8;
  const isSpeaking = cycleSecond < 5;

  if (!isSpeaking) {
    return {
      energy: 2 + Math.random() * 1.5,
      pitch: 0,
      spectralCentroid: 0,
      jitter: 0,
      shimmer: 0,
    };
  }

  return {
    energy: 18 + Math.sin(elapsedSeconds * 0.8) * 8 + Math.random() * 5,
    pitch: 160 + Math.sin(elapsedSeconds * 0.4) * 35 + Math.random() * 10,
    spectralCentroid: 32 + Math.cos(elapsedSeconds * 0.5) * 12 + Math.random() * 4,
    jitter: 4.2 + (Math.sin(elapsedSeconds * 1.1) > 0 ? Math.random() * 6 : Math.random() * 2),
    shimmer: 3.5 + Math.random() * 4,
  };
}
