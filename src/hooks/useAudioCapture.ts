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
  const chunkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uploadLockRef = useRef(false);

  // ---- Client-side voice-activity detection ----
  // Polls the AnalyserNode 5×/sec and flips a flag when energy exceeds a
  // speech threshold.  The flag is checked before uploading each chunk —
  // if nobody spoke during the window, the chunk is silently discarded
  // instead of being sent to Whisper (which would hallucinate on the
  // background noise).
  const speechDetectedRef = useRef(false);

  useEffect(() => {
    if (!isRecording || isSimulated || !analyser) return;

    const buf = new Uint8Array(analyser.fftSize);
    const SPEECH_RMS_THRESHOLD = 0.015;

    const handle = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let acc = 0;
      for (let i = 0; i < buf.length; i++) {
        const norm = (buf[i] - 128) / 128;
        acc += norm * norm;
      }
      if (Math.sqrt(acc / buf.length) > SPEECH_RMS_THRESHOLD) {
        speechDetectedRef.current = true;
      }
    }, 200);

    return () => clearInterval(handle);
  }, [isRecording, isSimulated, analyser]);

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
      const hadSpeech = speechDetectedRef.current;
      speechDetectedRef.current = false; // reset for next chunk window

      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      chunksRef.current = [];

      // Only send to Whisper if speech was detected during this window.
      // Background-noise-only chunks would just produce hallucinations
      // ("thank you for watching", "I'm sorry", etc.).
      if (hadSpeech) {
        uploadBlob(blob);
      }

      // Restart for the next chunk if the session is still active.
      if (recordingRef.current && !simulatedRef.current) {
        try { recorder.start(); } catch { /* stream may have ended */ }
      }
    };

    // Start without a timeslice — we manage chunking ourselves via the
    // interval below.  Each stop/start cycle produces an independent,
    // fully-headed webm file that ffmpeg & librosa can decode cleanly.
    recorder.start();
    mediaRecorderRef.current = recorder;

    // Periodically stop the recorder to trigger the onstop→upload→restart
    // cycle.  This is what was missing: without it, ondataavailable accumulated
    // data forever and uploadBlob was never called until the session ended.
    chunkTimerRef.current = setInterval(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 6_000);
  }, [uploadBlob]);

  const stopRecorder = useCallback(() => {
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
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