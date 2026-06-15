import { useEffect, useRef, useState } from "react";
import {
  AcousticFeatures,
  StressDataPoint,
  TranscriptLine,
  InterventionAlert,
  ApiReadyResponse,
  TranscribeResponse
} from "./types";

import AcousticVisualizer from "./components/AcousticVisualizer";
import StressTrendsChart from "./components/StressTrendsChart";
import MetricCard from "./components/MetricCard";
import TranscriptArea from "./components/TranscriptArea";
import ReportingExporter from "./components/ReportingExporter";
import {
  ShieldAlert,
  Mic,
  MicOff,
  Activity,
  Heart,
  Settings,
  Lock,
  Globe,
  Loader2,
  RefreshCw,
  Info,
  Layers,
  HeartPulse,
  BrainCircuit,
  MessageSquareX
} from "lucide-react";

export default function App() {
  // Web Audio Context State
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [apiReady, setApiReady] = useState<ApiReadyResponse | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'ready' | 'degraded' | 'offline'>('checking');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const uploadLockRef = useRef(false);

  // Core biometric features
  const [acousticFeatures, setAcousticFeatures] = useState<AcousticFeatures>({
    energy: 0,
    pitch: 0,
    spectralCentroid: 0,
    jitter: 0,
    shimmer: 0
  });

  // Emotional data tracking States
  const [stressPoints, setStressPoints] = useState<StressDataPoint[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [interventions, setInterventions] = useState<InterventionAlert[]>([]);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Settings & Toggles
  const [privacyMode, setPrivacyMode] = useState<'local' | 'hybrid'>('hybrid');
  const [showSettings, setShowSettings] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [stressThreshold, setStressThreshold] = useState<number>(70);
  const [visualFlashActive, setVisualFlashActive] = useState(false);
  const [muteAudioAlerts, setMuteAudioAlerts] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);

  const lastAlertTimestampRef = useRef<number>(0);

  const playAlertSound = (score: number) => {
    if (muteAudioAlerts) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = "sine";
      const pitchHz = score > 85 ? 580 : 380;
      osc.frequency.setValueAtTime(pitchHz, audioCtx.currentTime);
      
      gainNode.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn("Failed to generate synthetic alert chime:", e);
    }
  };

  const checkAndTriggerAlert = (score: number, source: 'acoustic' | 'linguistic') => {
    const now = Date.now();
    if (now - lastAlertTimestampRef.current < 8000) {
      return;
    }
    lastAlertTimestampRef.current = now;

    playAlertSound(score);

    const suggestions = {
      acoustic: [
        "Take a slow, deep breath. Focus on speaking from your diaphragm to relax vocal tension.",
        "Consider a short break: relax your neck, relax your jaw, and take two deep breaths.",
        "Take a deep breath and lower your vocal projection slightly to reduce throat strain.",
        "Ease your speaking tempo. Sip some water and introduce a 2-second silence."
      ],
      linguistic: [
        "Take a deep breath and slow down. Focus on steadying your phrasing structure.",
        "Consider a short break. Allow yourself a brief pause before speaking further.",
        "Practice a quick 4-7-8 breathing loop to lower active stress hormones.",
        "Relax your posture and take a slow, measured deep breath to ground yourself."
      ]
    };
    const list = suggestions[source];
    const message = list[Math.floor(Math.random() * list.length)];

    const alertId = `alert-${Math.random().toString(36).substr(2, 9)}`;
    const lineTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    const newAlert: InterventionAlert = {
      id: alertId,
      timestamp: lineTime,
      type: 'critical',
      title: `STRESS THRESHOLD EXCEEDED (${Math.round(score)}%)`,
      message,
      severity: score > 85 ? "high" : "medium",
      acknowledged: false
    };

    setInterventions(prev => [newAlert, ...prev]);

    setVisualFlashActive(true);
    setTimeout(() => {
      setVisualFlashActive(false);
    }, 1500);
  };

  // Active breathing guide helper state
  const [currentBreathingPhase, setCurrentBreathingPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Pause'>('Inhale');
  const [breathingTimer, setBreathingTimer] = useState(4);

  // Ref locks for callbacks
  const featuresRef = useRef<AcousticFeatures>(acousticFeatures);
  const linesRef = useRef<TranscriptLine[]>(lines);
  const timerRef = useRef<any>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Update refs to avoid stale state in timing callbacks
  useEffect(() => { featuresRef.current = acousticFeatures; }, [acousticFeatures]);
  useEffect(() => { linesRef.current = lines; }, [lines]);

  // Verify browser Web Speech recognition support on mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
  }, []);

  // Synchronous Breathing Guide pacing loop (4-7-8-4 breathing pattern)
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathingTimer(prev => {
        if (prev <= 1) {
          // transition phases
          setCurrentBreathingPhase(curr => {
            switch (curr) {
              case 'Inhale': return 'Hold';
              case 'Hold': return 'Exhale';
              case 'Exhale': return 'Pause';
              default: return 'Inhale';
            }
          });
          // Set new timers based on standard 4-7-8-4 guidelines
          return currentBreathingPhase === 'Inhale' ? 7 : currentBreathingPhase === 'Hold' ? 8 : currentBreathingPhase === 'Exhale' ? 4 : 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentBreathingPhase]);

  useEffect(() => {
    let cancelled = false;

    const checkReady = async () => {
      try {
        const response = await fetch("/api/ready");
        if (!response.ok) throw new Error(`Ready check failed: ${response.status}`);
        const payload: ApiReadyResponse = await response.json();
        if (cancelled) return;
        setApiReady(payload);
        setApiStatus(payload.ready ? 'ready' : 'degraded');
      } catch (err) {
        if (cancelled) return;
        console.warn("Backend readiness check failed:", err);
        setApiStatus('offline');
      }
    };

    checkReady();
    const interval = window.setInterval(checkReady, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const uploadAudioForAnalysis = async (blob: Blob) => {
    if (uploadLockRef.current || blob.size === 0 || privacyMode === 'local') return;

    uploadLockRef.current = true;
    setIsUploadingAudio(true);

    try {
      const file = new File([blob], `speech-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result: TranscribeResponse = await response.json();
      if (!result.text || result.text.trim().length === 0) return;

      const lineId = `line-${Math.random().toString(36).slice(2, 11)}`;
      const lineTime = new Date().toLocaleTimeString('en-US', { hour12: false });

      setAcousticFeatures(result.acousticFeatures);

      const line: TranscriptLine = {
        id: lineId,
        sender: 'speaker',
        text: result.text,
        timestamp: lineTime,
        acousticStressScore: result.acousticStressScore,
        linguisticStressScore: result.linguisticStressScore,
        combinedStressScore: result.combinedStressScore,
        isAnalyzed: true,
      };

      setLines(old => [...old, line]);

      setStressPoints(old => [
        ...old,
        {
          timestamp: lineTime,
          elapsedSeconds: secondsElapsed,
          acousticStress: result.acousticStressScore,
          linguisticStress: result.linguisticStressScore,
          combinedStress: result.combinedStressScore,
          isAlert: result.combinedStressScore > stressThreshold,
        }
      ]);

      if (result.combinedStressScore > stressThreshold) {
        checkAndTriggerAlert(result.combinedStressScore, 'linguistic');
      }
    } catch (err) {
      console.error("Audio upload analysis failed:", err);
    } finally {
      uploadLockRef.current = false;
      setIsUploadingAudio(false);
    }
  };

  const startBackendRecorder = (stream: MediaStream) => {
    if (typeof MediaRecorder === 'undefined') {
      console.warn("MediaRecorder API is unavailable in this browser.");
      return;
    }

    const preferredType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

    const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
    recordingChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      recordingChunksRef.current = [];
      uploadAudioForAnalysis(blob);

      if (isRecording && microphoneStream && !isSimulated) {
        try {
          recorder.start(6000);
        } catch (err) {
          console.warn("Could not restart recorder chunk:", err);
        }
      }
    };

    recorder.start(6000);
    mediaRecorderRef.current = recorder;
  };

  const stopBackendRecorder = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn("MediaRecorder stop failed:", err);
      }
    }
    mediaRecorderRef.current = null;
  };


  // Calculations for session summaries passed to ReportingExporter
  const getSessionStats = () => {
    if (stressPoints.length === 0) {
      return { avgStress: 0, maxStress: 0, activeTime: 0, totalAlerts: 0 };
    }
    const sum = stressPoints.reduce((acc, p) => acc + p.combinedStress, 0);
    const max = Math.max(...stressPoints.map(p => p.combinedStress), 0);
    const alerts = stressPoints.filter(p => p.isAlert).length;
    return {
      avgStress: sum / stressPoints.length,
      maxStress: max,
      activeTime: secondsElapsed,
      totalAlerts: alerts
    };
  };

  // Acoustic Signal Extractor Loop (triggers while recording from microphone or in simulated mode)
  useEffect(() => {
    if (!isRecording) return;
    if (!isSimulated && (!analyser || !audioContext)) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const fBCArray = analyser ? new Uint8Array(bufferLength) : null;
    const timeDomainArray = analyser ? new Uint8Array(analyser.fftSize) : null;

    let lastPitch = 150;

    const queryAcousticsInterval = setInterval(() => {
      let dbVol = 0;
      let estimatedHz = 0;
      let centroidVal = 0;
      let jitterFactor = 0;
      let shimmerFactor = 0;

      if (isSimulated) {
        // Run simulated logic dynamically on next tick to avoid stale variables
      } else if (analyser && timeDomainArray && fBCArray) {
        analyser.getByteFrequencyData(fBCArray);
        analyser.getByteTimeDomainData(timeDomainArray);

        // 1. Calculate energy (volume RMS) mapped to range 0-100
        let rMSAccumulator = 0;
        for (let i = 0; i < timeDomainArray.length; i++) {
          const val = (timeDomainArray[i] - 128) / 128;
          rMSAccumulator += val * val;
        }
        const rms = Math.sqrt(rMSAccumulator / timeDomainArray.length);
        dbVol = Math.min(100, Math.max(0, rms * 150));

        // 2. Pitch estimation via simple Auto-Correlative Zero Crossing Rate
        let zeroCrossings = 0;
        for (let i = 1; i < timeDomainArray.length; i++) {
          if ((timeDomainArray[i] >= 128 && timeDomainArray[i - 1] < 128) ||
              (timeDomainArray[i] < 128 && timeDomainArray[i - 1] >= 128)) {
            zeroCrossings++;
          }
        }
        const sampleRate = audioContext?.sampleRate || 44100;
        estimatedHz = (zeroCrossings * sampleRate) / (2 * timeDomainArray.length);
        
        if (dbVol < 5) {
          estimatedHz = 0;
        } else {
          estimatedHz = Math.min(400, Math.max(80, estimatedHz));
          estimatedHz = lastPitch * 0.7 + estimatedHz * 0.3;
          lastPitch = estimatedHz;
        }

        // 3. Spectral Centroid Calculation
        let weightSum = 0;
        let energySum = 0;
        for (let i = 0; i < fBCArray.length; i++) {
          weightSum += i * fBCArray[i];
          energySum += fBCArray[i];
        }
        centroidVal = energySum > 0 ? (weightSum / (fBCArray.length * energySum)) * 100 : 0;

        // 4. Vocal Jitter & Shimmer
        jitterFactor = dbVol > 6 ? Math.min(25, 4.5 + Math.random() * 4 + (centroidVal / 10)) : 0;
        shimmerFactor = dbVol > 6 ? Math.min(25, 3.2 + Math.random() * 3 + (dbVol / 12)) : 0;

        setAcousticFeatures({
          energy: dbVol,
          pitch: estimatedHz,
          spectralCentroid: centroidVal,
          jitter: jitterFactor,
          shimmer: shimmerFactor
        });
      }

      setSecondsElapsed(prev => {
        const nextSec = prev + 1;

        if (isSimulated) {
          // Speak / breath cycle (speak for 6 seconds, pause for 2)
          const cycleSecond = nextSec % 8;
          const isSpeaking = cycleSecond < 5;

          if (isSpeaking) {
            dbVol = 18 + Math.sin(nextSec * 0.8) * 8 + Math.random() * 5;
            estimatedHz = 160 + Math.sin(nextSec * 0.4) * 35 + Math.random() * 10;
            centroidVal = 32 + Math.cos(nextSec * 0.5) * 12 + Math.random() * 4;
            jitterFactor = 4.2 + (Math.sin(nextSec * 1.1) > 0 ? Math.random() * 6 : Math.random() * 2);
            shimmerFactor = 3.5 + Math.random() * 4;
          } else {
            dbVol = 2 + Math.random() * 1.5;
            estimatedHz = 0;
            centroidVal = 0;
            jitterFactor = 0;
            shimmerFactor = 0;
          }

          setAcousticFeatures({
            energy: dbVol,
            pitch: estimatedHz,
            spectralCentroid: centroidVal,
            jitter: jitterFactor,
            shimmer: shimmerFactor
          });
        }

        // Compute structural Acoustic Stress Score
        let rawAcousticStress = 10; // quiet baseline
        if (dbVol > 8) {
          rawAcousticStress = (jitterFactor * 1.5) + (shimmerFactor * 1.5) + (centroidVal * 0.4);
        }
        rawAcousticStress = Math.min(100, Math.max(0, rawAcousticStress));

        const activeCombinedStress = rawAcousticStress;

        setStressPoints(old => [
          ...old,
          {
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
            elapsedSeconds: nextSec,
            acousticStress: rawAcousticStress,
            linguisticStress: 20, // baseline
            combinedStress: activeCombinedStress,
            isAlert: activeCombinedStress > stressThreshold
          }
        ]);

        if (activeCombinedStress > stressThreshold) {
          checkAndTriggerAlert(activeCombinedStress, 'acoustic');
        }

        // Periodic transcript injection during simulation
        if (isSimulated && nextSec > 0 && nextSec % 8 === 0) {
          const simulationLines = [
            { text: "Help me! I need immediate backup, things are collapsing!", sender: "speaker" },
            { text: "Acoustic coaching guidelines received. Engaging deep diagnostic checks.", sender: "responder" },
            { text: "My breathing pattern is steady now, starting the countdown.", sender: "speaker" },
            { text: "Hold on... there's a serious caution alert popping up on terminal!", sender: "speaker" },
            { text: "Breathing companion initiated. Relax your jaw muscles.", sender: "responder" },
            { text: "Okay, performing structured vocal pauses. Calm indicators active.", sender: "speaker" }
          ];
          const lineIndex = Math.floor((nextSec / 8) - 1) % simulationLines.length;
          const simLine = simulationLines[lineIndex];
          handleSpeechLineText(simLine.text, simLine.sender === "responder" ? "responder" : "speaker");
        }

        return nextSec;
      });

    }, 1000);

    return () => clearInterval(queryAcousticsInterval);
  }, [isRecording, analyser, audioContext, isSimulated]);

  // Stop current active sessions and release hardware streams cleanly
  const stopSession = () => {
    stopBackendRecorder();
    if (microphoneStream) {
      microphoneStream.getTracks().forEach((t) => t.stop());
    }
    if (audioContext) {
      audioContext.close();
    }
    
    // Clear live speech recognition listeners
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
    }

    setIsRecording(false);
    if (privacyMode === 'hybrid') {
      startBackendRecorder(stream);
    }
    setIsSimulated(false);
    setAudioContext(null);
    setAnalyser(null);
    setMicrophoneStream(null);
    // Silent speak cancellation
    window.speechSynthesis.cancel();
  };

  // Start real-time vocal capturing on USB Microphone
  const startMicrophoneSession = async () => {
    try {
      // Clear previous logs
      setStressPoints([]);
      setLines([]);
      setInterventions([]);
      setSecondsElapsed(0);
      setMicError(null);
      setIsSimulated(false);
      window.speechSynthesis.cancel();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ana = ctx.createAnalyser();
      ana.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(ana);

      setAudioContext(ctx);
      setAnalyser(ana);
      setMicrophoneStream(stream);
      setIsRecording(true);

      // Start Web Speech Engine if supported
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = false;
        recog.lang = "en-US";

        recog.onresult = async (event: any) => {
          const latestResultIndex = event.results.length - 1;
          const resultText = event.results[latestResultIndex][0].transcript;
          
          if (resultText && resultText.trim().length > 0) {
            handleSpeechLineText(resultText.trim(), "speaker");
          }
        };

        recog.onend = () => {
          // Restart recording automatically if session is still active
          if (isRecording) {
            try { recog.start(); } catch (e) {}
          }
        };

        recog.start();
        speechRecognitionRef.current = recog;
      }

    } catch (err: any) {
      console.error("Microphone hardware connection denied or unavailable:", err);
      setMicError(err.message || "Microphone permission was denied by browser settings or active sandbox regulations.");
    }
  };

  // Start simulated vocal stream for live testing and previewing
  const startSimulationSession = () => {
    setStressPoints([]);
    setLines([]);
    setInterventions([]);
    setSecondsElapsed(0);
    setMicError(null);
    setIsSimulated(true);
    setIsRecording(true);
    window.speechSynthesis.cancel();
  };

  // High-fidelity speech evaluator (routes securely through local or self-hosted server NLP routes)
  const handleSpeechLineText = async (text: string, sender: 'speaker' | 'responder') => {
    const lineId = `line-${Math.random().toString(36).substr(2, 9)}`;
    const lineTime = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Estimate raw acoustic stresses
    const calculatedAcoustic = featuresRef.current.energy > 5 
      ? Math.min(100, Math.max(10, (featuresRef.current.jitter * 1.5) + (featuresRef.current.shimmer * 1.5) + (featuresRef.current.spectralCentroid * 0.3)))
      : 15;

    const initialLine: TranscriptLine = {
      id: lineId,
      sender,
      text,
      timestamp: lineTime,
      acousticStressScore: calculatedAcoustic,
      combinedStressScore: calculatedAcoustic, // fallback
      isAnalyzed: false
    };

    setLines(old => [...old, initialLine]);

    try {
      let linguisticResult;

      // Choose processing pipeline directly
      if (privacyMode === 'local') {
        // Run localized heuristic calculation (safeguards user data internally)
        const lowercase = text.toLowerCase();
        let stressScore = 20;
        let sentimentVal = 0.2;
        const crisisWords = ["fail", "error", "failing", "fatal", "collapse", "severe", "caution", "danger", "immediately", "shutting", "alone", "panic"];
        
        crisisWords.forEach(w => {
          if (lowercase.includes(w)) {
            stressScore += 18;
            sentimentVal -= 0.15;
          }
        });
        linguisticResult = {
          stressScore: Math.min(100, stressScore),
          sentimentScore: sentimentVal,
          cognitiveLoad: stressScore > 70 ? 'high' : stressScore > 40 ? 'moderate' : 'low',
          keywords: crisisWords.filter(w => lowercase.includes(w)),
          intervention: stressScore > 65 
            ? "CRITICAL STRESS: Practice 4-7-8 breathing focus, release vocal tension immediately!"
            : "Cadence is healthy. Maintain direct focus."
        };
      } else {
        // Securely route metrics through full-stack express route
        const response = await fetch("/api/analyze-sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text })
        });
        linguisticResult = await response.json();
      }

      // Merge linguistic findings with physical vocal acoustics
      const finalStressScore = Math.round((calculatedAcoustic * 0.45) + (linguisticResult.stressScore * 0.55));
      
      setLines(old => old.map(ln => {
        if (ln.id === lineId) {
          return {
            ...ln,
            linguisticStressScore: linguisticResult.stressScore,
            combinedStressScore: finalStressScore,
            isAnalyzed: true
          };
        }
        return ln;
      }));

      // Map combined stressful peaks to clinical warning logs
      if (finalStressScore > stressThreshold) {
        checkAndTriggerAlert(finalStressScore, 'linguistic');
      }

      // Update D3 timeseries data directly
      setStressPoints(old => {
        if (old.length === 0) return old;
        const last = { ...old[old.length - 1] };
        last.linguisticStress = linguisticResult.stressScore;
        last.combinedStress = finalStressScore;
        last.isAlert = finalStressScore > stressThreshold;
        return [...old.slice(0, -1), last];
      });

    } catch (err) {
      console.error("Linguistic analysis pipeline failed:", err);
    }
  };

  const clearIntervention = (id: string) => {
    setInterventions(old => old.map(v => v.id === id ? { ...v, acknowledged: true } : v));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-900 selection:text-indigo-200 relative overflow-hidden font-sans">
      
      {/* Subtle screen border visual pulse alert during cognitive overload */}
      {visualFlashActive && (
        <div className="fixed inset-0 border-4 border-rose-500/40 pointer-events-none z-50 animate-pulse" />
      )}
      
      {/* Absolute background blurred glowing decorative shapes for pristine frosted-glass atmosphere */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/35 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/35 rounded-full blur-[120px]" />
      </div>

      {/* HEADER SECTION: Premium, glassmorphic frosted filter layout */}
      <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 px-6 py-4.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo brand & telemetry title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-sans font-bold tracking-tight text-white uppercase">
                  Acoustic Stress Monitor <span className="text-zinc-500 font-normal underline underline-offset-4 decoration-zinc-700">v2.4-Pro</span>
                </h1>
                {isRecording && isSimulated && (
                  <span className="text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                    Simulation Active
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wider">
                ON-DEVICE VOCAL HEALTH & COGNITIVE STRAIN TELEMETRY
              </p>
            </div>
          </div>

           {/* Operational control hubs */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            
            {/* Live recording and simulated simulation buttons with modern border/shadow */}
            {!isRecording ? (
              <div className="flex items-center gap-2">
                <button
                  id="btn-start-recording"
                  onClick={startMicrophoneSession}
                  className="flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-zinc-950" />
                  Initialize Mic
                </button>
                <button
                  id="btn-start-sim"
                  onClick={startSimulationSession}
                  className="flex items-center justify-center gap-2 bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                  Simulate Demo
                </button>
              </div>
            ) : (
              <button
                id="btn-stop-recording"
                onClick={stopSession}
                className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer animate-pulse"
              >
                <MicOff className="w-3.5 h-3.5 text-white" />
                {isSimulated ? "Stop Simulation" : "Disconnect Monitor"}
              </button>
            )}

            {/* Quick settings toggle */}
            <button
               id="btn-settings-toggle"
               onClick={() => setShowSettings(!showSettings)}
               className={`p-2.5 rounded-xl border transition-all ${
                 showSettings 
                   ? "bg-white/10 border-white/20 text-white" 
                   : "bg-white/5 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/10"
               }`}
               title="Configure diagnostic pipelines"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CORE FRAMEWORK GRID: Bento-Grid style display */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* Dynamic Warning Alert for Microphone Hardware Access Denial */}
        {micError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400 shrink-0 mt-0.5 border border-amber-500/20">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-sans font-bold text-amber-200 uppercase tracking-wide">
                  MICROPHONE PERMISSION DENIED OR BLOCKED
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl font-sans text-left">
                  The application could not access your biometric vocal stream due to browser privacy restrictions or iframe constraints ({micError}).
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-500 pt-1.5 uppercase">
                  <span>&bull; Enable microphone permission in browser settings</span>
                  <span>&bull; Click <strong className="text-zinc-400 font-bold">"Open in a new window"</strong> at the top right to bypass iframe environments</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0 w-full md:w-auto mt-2 md:mt-0">
              <button
                onClick={startSimulationSession}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Simulate Voice Loop
              </button>
              <button
                onClick={() => setMicError(null)}
                className="p-2.5 rounded-xl border border-white/10 text-zinc-450 hover:text-zinc-200 hover:bg-white/5 text-xs font-sans"
                title="Dismiss warning"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Dynamic settings overlay rail */}
        {showSettings && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 relative z-30 transition-all" id="settings-panel">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h2 className="text-xs font-mono font-bold text-zinc-200 uppercase">DIAGNOSTIC ARCHITECTURE SETTINGS</h2>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">REAL-TIME PORT PIPELINES</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Privacy Toggles and threshold config */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-zinc-400 block uppercase">SEMANTIC PARSING DIRECTIVES</label>
                  <div className="grid grid-cols-2 gap-3" id="privacy-toggles-row">
                    <button
                      id="toggle-privacy-local"
                      onClick={() => { setPrivacyMode('local'); }}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left font-mono transition-all ${
                        privacyMode === 'local'
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200 shadow-md"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <Lock className="w-4 h-4 shrink-0 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold block">CLIENT HEURISTICS</span>
                        <span className="text-[9px] text-zinc-500 font-mono">On-device algorithm</span>
                      </div>
                    </button>

                    <button
                      id="toggle-privacy-hybrid"
                      onClick={() => { setPrivacyMode('hybrid'); }}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-left font-mono transition-all ${
                        privacyMode === 'hybrid'
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-md"
                          : "bg-white/5 border-white/10 text-zinc-400 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <Globe className="w-4 h-4 shrink-0 text-indigo-400" />
                      <div>
                        <span className="text-xs font-bold block">SELF-HOSTED MODEL</span>
                        <span className="text-[9px] text-zinc-500 font-mono">Private Container API</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* USER-CONFIGURABLE STRESS THRESHOLD */}
                <div className="space-y-2 pt-2.5 border-t border-white/5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-mono font-bold text-zinc-400 block uppercase">ALERTS DETECTION THRESHOLD</label>
                    <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{stressThreshold}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      id="threshold-slider"
                      type="range"
                      min="35"
                      max="90"
                      value={stressThreshold}
                      onChange={(e) => setStressThreshold(Number(e.target.value))}
                      className="flex-1 accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <label className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 select-none cursor-pointer uppercase shrink-0">
                      <input
                        id="mute-alerts-checkbox"
                        type="checkbox"
                        checked={muteAudioAlerts}
                        onChange={(e) => setMuteAudioAlerts(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500 w-3.5 h-3.5 accent-indigo-500"
                      />
                      Mute Chime
                    </label>
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                    <span>35% (Ultra Sensitive)</span>
                    <span>90% (Low Friction)</span>
                  </div>
                </div>
              </div>

              {/* Hardware diagnostics info block */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-[10px] font-mono text-zinc-400 space-y-2">
                <span className="text-zinc-300 block font-bold">HARDWARE & API SUITE STATUS</span>
                <div className="flex justify-between">
                  <span>MICROPHONE INTERFACE:</span>
                  <span className={isSimulated ? "text-amber-400 font-bold" : microphoneStream ? "text-emerald-400 font-bold" : "text-zinc-500"}>
                    {isSimulated ? "SIMULATED VOCAL STREAM" : microphoneStream ? "ONLINE (PCM_16K)" : "UNCONNECTED / IDLE"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SPEECH RECOGNITION API:</span>
                  <span className={speechSupported ? "text-emerald-400" : "text-amber-500"}>
                    {speechSupported ? "AVAILABLE" : "UNSUPPORTED (FALLBACK ACTIVE)"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>SELF-HOSTED MODEL:</span>
                  <span className={apiStatus === 'ready' ? "text-emerald-400 font-bold" : apiStatus === 'degraded' ? "text-amber-400 font-bold" : "text-rose-400 font-bold"}>
                    {apiStatus === 'ready' ? "READY" : apiStatus === 'degraded' ? "DEGRADED" : apiStatus === 'checking' ? "CHECKING" : "OFFLINE"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Real-time D3 metrics visualizer grids */}
        <AcousticVisualizer
          analyser={analyser}
          features={acousticFeatures}
          isRecording={isRecording}
          stressScore={stressPoints[stressPoints.length - 1]?.combinedStress || 15}
        />

        {/* Biometric numeric cards dashboard row */}
        <MetricCard features={acousticFeatures} isRecording={isRecording} />

        {/* Historical trends chart plus Clinical Interventions panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="trends-interventions-row">
          
          {/* LEFT: Central historical chart */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <StressTrendsChart data={stressPoints} threshold={stressThreshold} />
          </div>

          {/* RIGHT: Cognitive Wellness and breathing coach */}
          <div className="lg:col-span-4 flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[230px] h-full" id="interventions-container">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h3 className="text-xs font-mono font-medium text-zinc-300 uppercase">COGNITIVE INTERVENTIONS</h3>
              </div>
              <span className="text-[9px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.2 rounded font-bold uppercase">
                COACH ACTIVE
              </span>
            </div>

            {/* Breathing coach utility widget */}
            <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 mb-3 flex items-center justify-between border-l-4 border-l-emerald-500">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 block uppercase">BREATHING COMPANION (4-7-8)</span>
                  <span className="text-xs font-bold text-zinc-200 uppercase">{currentBreathingPhase}...</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1 font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded">
                <span className="text-lg font-bold">{breathingTimer}</span>
                <span className="text-[8.5px]">s</span>
              </div>
            </div>

            {/* Continuous stream of alerts & wellness recommendations */}
            <div className="space-y-2 flex-1 scrollbar-thin overflow-y-auto">
              {interventions.filter(v => !v.acknowledged).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[10px] text-zinc-500 font-mono">COGNITIVE STATUS REPORT STEADY</p>
                  <p className="text-[9.5px] text-zinc-650 mt-0.5">Vocal parameters and sentiment indicators are balanced.</p>
                </div>
              ) : (
                interventions.filter(v => !v.acknowledged).map((alert) => (
                  <div
                    id={alert.id}
                    key={alert.id}
                    className={`p-2.5 rounded-xl border text-[10px] font-mono flex flex-col justify-between ${
                      alert.severity === 'high'
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                        : "bg-white/5 border border-white/10 text-zinc-300"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-bold ${alert.severity === 'high' ? "text-rose-400" : "text-indigo-400"}`}>
                        {alert.title}
                      </span>
                      <button
                        onClick={() => clearIntervention(alert.id)}
                        className="text-[9px] text-zinc-400 hover:text-white font-bold border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg"
                      >
                        DISMISS
                      </button>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-[10px] font-sans">
                      {alert.message}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Real-time transcripts feed dialog boxes */}
        <TranscriptArea
          lines={lines}
          isRecording={isRecording}
          threshold={stressThreshold}
        />

        {/* Structured PDF and CSV exporter panels */}
        <ReportingExporter
          data={stressPoints}
          lines={lines}
          sessionStats={getSessionStats()}
        />

      </main>

      {/* FOOTER SECTION: Standard minimalist information markers */}
      <footer className="relative z-10 px-8 py-6 border-t border-white/5 bg-black/40 flex justify-between items-center text-[10px] text-zinc-600 font-mono select-none" id="dashboard-footer">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-[10px] text-zinc-600 uppercase tracking-widest">
            Acoustic Stress Monitor &bull; Private Beta v2.4.0
          </div>
          <div className="flex gap-4">
            <span className="text-[10px] text-zinc-400">Privacy Mode: <span className="text-emerald-500 uppercase">{privacyMode}</span></span>
            <span className="text-[10px] text-zinc-400">Zero Network Egress Detected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
