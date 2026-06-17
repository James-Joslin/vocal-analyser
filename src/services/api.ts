import type {
  ApiReadyResponse,
  SentimentResult,
  TranscribeResponse,
} from "../types";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

/**
 * Check whether the Python backend models are loaded and ready.
 */
export async function fetchApiReady(): Promise<ApiReadyResponse> {
  const res = await fetch("/api/ready");
  if (!res.ok) throw new Error(`Ready check failed: ${res.status}`);
  return res.json();
}

/**
 * Send a text transcript to the server-side sentiment analysis endpoint.
 */
export async function analyseSentiment(text: string): Promise<SentimentResult> {
  const res = await fetch("/api/analyze-sentiment", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Sentiment analysis failed: ${res.status}`);
  return res.json();
}

/**
 * Upload an audio blob for full-pipeline transcription + analysis.
 */
export async function transcribeAudio(blob: Blob): Promise<TranscribeResponse> {
  const file = new File([blob], `speech-${Date.now()}.webm`, {
    type: blob.type || "audio/webm",
  });
  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/transcribe", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
  return res.json();
}
