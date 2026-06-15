export interface AcousticFeatures {
  energy: number;          // Amplitude/RMS volume (0 - 100)
  pitch: number;           // Estimated fundamental frequency (Hz)
  spectralCentroid: number; // Brightness/tension of voice (0 - 100)
  jitter: number;          // Vocal pitch micro-instability (0 - 100)
  shimmer: number;         // Vocal amplitude micro-instability (0 - 100)
}

export interface LinguisticFeatures {
  sentimentScore: number;  // -1 (very negative) to +1 (very positive)
  stressScore: number;     // 0 (calm) to 100 (panic)
  cognitiveLoad: 'low' | 'moderate' | 'high';
  keywords: string[];
  intervention: string;
}

export interface StressDataPoint {
  timestamp: string;      // HH:MM:ss
  elapsedSeconds: number; // Seconds since session start
  acousticStress: number;  // Metric derived on client (0 - 100)
  linguisticStress: number; // Metric derived from Self-Hosted NLP Model (0 - 100)
  combinedStress: number;   // Hybrid score (0 - 100)
  isAlert: boolean;
}

export interface TranscriptLine {
  id: string;
  sender: 'speaker' | 'responder' | 'system';
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
  type: 'breathing' | 'pace' | 'tone' | 'critical';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
}

export interface ExporterConfig {
  format: 'csv' | 'json';
  includeTranscripts: boolean;
  includeAcoustics: boolean;
}

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
  device: 'cpu' | 'cuda' | string;
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
  cognitiveLoad: 'low' | 'moderate' | 'high';
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
  status: 'success' | string;
  processor: string;
}
