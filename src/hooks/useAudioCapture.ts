import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "../services/api";

interface AudioCaptureCallbacks {
  /** Called whenever the Python API returns a transcription result. */
  onTranscribeResult?: (result: Awaited<ReturnType<typeof transcribeAudio>>) => void;
}

/**
 * Manages microphone capture and MediaRecorder chunking for the Python API.
 *
 * All transcription is handled by Whisper on the self-hosted container.
 * The browser's Web Speech API is deliberately NOT used — in Chrome it
 * routes audio through Google's cloud, which violates the zero-egress
 * requirement. It also created duplicate transcript entries because both
 * it and the MediaRecorder path produced lines for the same speech.
 */
export function useAudioCapture(callbacks: AudioCaptureCallbacks = {}) {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Refs that callbacks can read without stale closures
  const recordingRef = useRef(false);
  const simulatedRef = useRef(false);
  const callbacksRef = useRef(callbacks);

  useEffect(() => { recordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { simulatedRef.current = isSimulated; }, [isSimulated]);
  useEffect(() => { callbacksRef.current = callbacks; });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadLockRef = useRef(false);

  // ---- Audio upload (always sends to the Python API container) ----
  const uploadBlob = useCallback(async (blob: Blob) => {
    if (uploadLockRef.current || blob.size === 0) return;
    uploadLockRef.current = true;
    setIsUploadingAudio(true);
    try {
      const result = await transcribeAudio(blob);
      if (result.text?.trim()) {
        callbacksRef.current.onTranscribeResult?.(result);
      }
    } catch (err) {
      console.error("Audio upload analysis failed:", err);
    } finally {
      uploadLockRef.current = false;
      setIsUploadingAudio(false);
    }
  }, []);

  // ---- MediaRecorder lifecycle ----
  const startRecorder = useCallback((stream: MediaStream) => {
    if (typeof MediaRecorder === "undefined") return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : undefined;

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];
      uploadBlob(blob);

      // Restart for the next chunk if the session is still active.
      if (recordingRef.current && !simulatedRef.current) {
        try { recorder.start(6000); } catch { /* stream may have ended */ }
      }
    };

    recorder.start(6000);
    mediaRecorderRef.current = recorder;
  }, [uploadBlob]);

  const stopRecorder = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    mediaRecorderRef.current = null;
  }, []);

  // ---- Public session controls ----
  const startMicSession = useCallback(async () => {
    setMicError(null);
    setIsSimulated(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(ana);

      setAudioContext(ctx);
      setAnalyser(ana);
      setMicStream(stream);
      setIsRecording(true);

      // Record 6-second chunks → Python API (Whisper handles transcription)
      startRecorder(stream);
    } catch (err: any) {
      console.error("Microphone access denied:", err);
      setMicError(
        err.message ||
        "Microphone permission was denied by browser settings or iframe sandbox restrictions.",
      );
    }
  }, [startRecorder]);

  const startSimulation = useCallback(() => {
    setMicError(null);
    setIsSimulated(true);
    setIsRecording(true);
  }, []);

  const stopSession = useCallback(() => {
    stopRecorder();

    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
    }
    if (audioContext) {
      audioContext.close().catch(() => {});
    }

    setIsRecording(false);
    setIsSimulated(false);
    setAudioContext(null);
    setAnalyser(null);
    setMicStream(null);
  }, [micStream, audioContext, stopRecorder]);

  return {
    audioContext,
    analyser,
    isRecording,
    isSimulated,
    micError,
    isUploadingAudio,
    setMicError,
    startMicSession,
    startSimulation,
    stopSession,
  };
}
