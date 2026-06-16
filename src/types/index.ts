// ---------------------------------------------------------------------------
// Acoustic & Linguistic Feature Shapes
// ---------------------------------------------------------------------------

export interface AcousticFeatures {
  energy: number;
  pitch: number;
  spectralCentroid: number;
  jitter: number;
  shimmer: number;
}

export const EMPTY_ACOUSTIC_FEATURES: AcousticFeatures = {
  energy: 0,
  pitch: 0,
  spectralCentroid: 0,
  jitter: 0,
  shimmer: 0,
};

export interface LinguisticFeatures {
  sentimentScore: number;
  stressScore: number;
  cognitiveLoad: "low" | "moderate" | "high";
  keywords: string[];
  intervention: string;
}

// ---------------------------------------------------------------------------
// Session Data Points
// ---------------------------------------------------------------------------

export interface StressDataPoint {
  timestamp: string;
  elapsedSeconds: number;
  acousticStress: number;
  linguisticStress: number;
  combinedStress: number;
  isAlert: boolean;
}

export interface TranscriptLine {
  id: string;
  sender: "speaker" | "responder" | "system";
  text: string;
  timestamp: string;
  acousticStressScore: number;
  linguisticStressScore?: number;
  combinedStressScore: number;
  isAnalyzed: boolean;
}

export interface InterventionAlert {
  id: string;
  timestamp: string;
  type: "breathing" | "pace" | "tone" | "critical";
  title: string;
  message: string;
  severity: "low" | "medium" | "high";
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type ApiStatus = "checking" | "ready" | "degraded" | "offline";

export interface SessionStats {
  avgStress: number;
  maxStress: number;
  activeTime: number;
  totalAlerts: number;
}

// ---------------------------------------------------------------------------
// API Response Shapes
// ---------------------------------------------------------------------------

export interface Wav2VecPrediction {
  label: string;
  score: number;
}

export interface ModelLoadStatus {
  loaded: boolean;
  modelId: string;
  error: string | null;
}

export interface ApiReadyResponse {
  ready: boolean;
  device: "cpu" | "cuda" | string;
  models: {
    whisper: ModelLoadStatus;
    wav2vec: ModelLoadStatus;
    sentiment: ModelLoadStatus;
  };
}

export interface TranscribeResponse {
  text: string;
  acousticStressScore: number;
  linguisticStressScore: number;
  combinedStressScore: number;
  cognitiveLoad: "low" | "moderate" | "high";
  intervention: string;
  keywords: string[];
  sentimentScore: number;
  acousticFeatures: AcousticFeatures;
  vocalMetrics: {
    fundamentalFrequencyHz: number;
    rawEnergy: number;
    spectralCentroidPercent: number;
    jitterPercent: number;
    shimmerPercent: number;
    samplingRate: number;
  };
  wav2vecClassifierUsed: boolean;
  wav2vecPredictions: Wav2VecPrediction[];
  topEmotion: string | null;
  topEmotionScore: number;
  status: "success" | string;
  processor: string;
}

export interface SentimentResult {
  sentimentScore: number;
  stressScore: number;
  cognitiveLoad: "low" | "moderate" | "high";
  keywords: string[];
  intervention: string;
  modelClass: string;
  processedOnPremises: boolean;
}
