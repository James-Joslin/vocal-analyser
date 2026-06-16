import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AcousticFeatures,
  StressDataPoint,
  TranscriptLine,
  SessionStats,
} from "./types";
import { EMPTY_ACOUSTIC_FEATURES } from "./types";

// Hooks
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useApiHealth } from "./hooks/useApiHealth";
import { useBreathingGuide } from "./hooks/useBreathingGuide";
import { useStressAlerts } from "./hooks/useStressAlerts";

// Services & utilities
import { analyseSentiment } from "./services/api";
import {
  computeAcousticStress,
  sampleLiveAcoustics,
  sampleSimulatedAcoustics,
} from "./lib/acoustics";
import { uid, timestamp, SIMULATION_LINES } from "./lib/constants";

// Components
import Header from "./components/Header";
import SettingsPanel from "./components/SettingsPanel";
import MicrophoneError from "./components/MicrophoneError";
import AcousticVisualizer from "./components/AcousticVisualizer";
import MetricCard from "./components/MetricCard";
import StressTrendsChart from "./components/StressTrendsChart";
import InterventionPanel from "./components/InterventionPanel";
import TranscriptArea from "./components/TranscriptArea";
import ReportingExporter from "./components/ReportingExporter";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App() {
  // ---- Settings ----
  const [showSettings, setShowSettings] = useState(false);
  const [stressThreshold, setStressThreshold] = useState(70);

  // ---- Session data ----
  const [acousticFeatures, setAcousticFeatures] = useState<AcousticFeatures>(EMPTY_ACOUSTIC_FEATURES);
  const [stressPoints, setStressPoints] = useState<StressDataPoint[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // ---- Hooks ----
  const { apiStatus } = useApiHealth();
  const { phase: breathingPhase, secondsLeft: breathingSeconds } = useBreathingGuide();
  const alerts = useStressAlerts();

  // Stable refs for values read inside callbacks
  const featuresRef = useRef(acousticFeatures);
  const thresholdRef = useRef(stressThreshold);
  useEffect(() => { featuresRef.current = acousticFeatures; }, [acousticFeatures]);
  useEffect(() => { thresholdRef.current = stressThreshold; }, [stressThreshold]);

  // ---- Speech / transcript handling (always via Python API) ----
  const handleSpeechLineText = useCallback(
    async (text: string, sender: "speaker" | "responder") => {
      const lineId = uid("line");
      const ts = timestamp();

      const calculatedAcoustic =
        featuresRef.current.energy > 5
          ? Math.min(100, Math.max(10,
              featuresRef.current.jitter * 1.5 +
              featuresRef.current.shimmer * 1.5 +
              featuresRef.current.spectralCentroid * 0.3))
          : 15;

      // Optimistically add the line before analysis completes
      const initialLine: TranscriptLine = {
        id: lineId,
        sender,
        text,
        timestamp: ts,
        acousticStressScore: calculatedAcoustic,
        combinedStressScore: calculatedAcoustic,
        isAnalyzed: false,
      };
      setLines((prev) => [...prev, initialLine]);

      try {
        // Always route through the self-hosted Python API
        const linguisticResult = await analyseSentiment(text);

        const combined = Math.round(calculatedAcoustic * 0.45 + linguisticResult.stressScore * 0.55);

        setLines((prev) =>
          prev.map((ln) =>
            ln.id === lineId
              ? { ...ln, linguisticStressScore: linguisticResult.stressScore, combinedStressScore: combined, isAnalyzed: true }
              : ln,
          ),
        );

        // Patch the most recent stress point with linguistic data
        setStressPoints((prev) => {
          if (prev.length === 0) return prev;
          const last = { ...prev[prev.length - 1] };
          last.linguisticStress = linguisticResult.stressScore;
          last.combinedStress = combined;
          last.isAlert = combined > thresholdRef.current;
          return [...prev.slice(0, -1), last];
        });

        if (combined > thresholdRef.current) {
          alerts.triggerAlert(combined, "linguistic");
        }
      } catch (err) {
        console.error("Python API sentiment analysis failed:", err);
      }
    },
    [alerts],
  );

  // ---- Audio capture ----
  const audio = useAudioCapture({
    onTranscribeResult(result) {
      setAcousticFeatures(result.acousticFeatures);
      const lineId = uid("line");
      const ts = timestamp();

      setLines((prev) => [
        ...prev,
        {
          id: lineId,
          sender: "speaker",
          text: result.text,
          timestamp: ts,
          acousticStressScore: result.acousticStressScore,
          linguisticStressScore: result.linguisticStressScore,
          combinedStressScore: result.combinedStressScore,
          isAnalyzed: true,
        },
      ]);

      setStressPoints((prev) => [
        ...prev,
        {
          timestamp: ts,
          elapsedSeconds: secondsElapsed,
          acousticStress: result.acousticStressScore,
          linguisticStress: result.linguisticStressScore,
          combinedStress: result.combinedStressScore,
          isAlert: result.combinedStressScore > thresholdRef.current,
        },
      ]);

      if (result.combinedStressScore > thresholdRef.current) {
        alerts.triggerAlert(result.combinedStressScore, "linguistic");
      }
    },
  });

  // ---- Acoustic sampling loop (1 Hz while recording) ----
  useEffect(() => {
    if (!audio.isRecording) return;
    if (!audio.isSimulated && !audio.analyser) return;

    let prevPitch = 150;

    const handle = setInterval(() => {
      let features: AcousticFeatures;

      if (audio.isSimulated) {
        features = sampleSimulatedAcoustics(secondsElapsed + 1);
      } else if (audio.analyser && audio.audioContext) {
        const sampled = sampleLiveAcoustics(audio.analyser, audio.audioContext.sampleRate, prevPitch);
        prevPitch = sampled.smoothedPitch;
        features = sampled;
      } else {
        return;
      }

      setAcousticFeatures(features);

      setSecondsElapsed((prev) => {
        const next = prev + 1;
        const acousticStress = computeAcousticStress(features);

        setStressPoints((old) => [
          ...old,
          {
            timestamp: timestamp(),
            elapsedSeconds: next,
            acousticStress,
            linguisticStress: 20,
            combinedStress: acousticStress,
            isAlert: acousticStress > thresholdRef.current,
          },
        ]);

        if (acousticStress > thresholdRef.current) {
          alerts.triggerAlert(acousticStress, "acoustic");
        }

        // Periodic transcript injection during simulation
        if (audio.isSimulated && next > 0 && next % 8 === 0) {
          const idx = Math.floor(next / 8 - 1) % SIMULATION_LINES.length;
          const line = SIMULATION_LINES[idx];
          handleSpeechLineText(line.text, line.sender);
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(handle);
  }, [audio.isRecording, audio.isSimulated, audio.analyser, audio.audioContext, alerts, handleSpeechLineText, secondsElapsed]);

  // ---- Session lifecycle helpers ----
  const resetSession = useCallback(() => {
    setStressPoints([]);
    setLines([]);
    setSecondsElapsed(0);
    alerts.resetAlerts();
  }, [alerts]);

  const handleStartMic = useCallback(() => {
    resetSession();
    audio.startMicSession();
  }, [resetSession, audio]);

  const handleStartSim = useCallback(() => {
    resetSession();
    audio.startSimulation();
  }, [resetSession, audio]);

  const sessionStats: SessionStats =
    stressPoints.length === 0
      ? { avgStress: 0, maxStress: 0, activeTime: 0, totalAlerts: 0 }
      : {
          avgStress: stressPoints.reduce((s, p) => s + p.combinedStress, 0) / stressPoints.length,
          maxStress: Math.max(...stressPoints.map((p) => p.combinedStress)),
          activeTime: secondsElapsed,
          totalAlerts: stressPoints.filter((p) => p.isAlert).length,
        };

  // ---- Render ----
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-indigo-900 selection:text-indigo-200 relative overflow-hidden font-sans">
      {alerts.visualFlashActive && (
        <div className="fixed inset-0 border-4 border-rose-500/40 pointer-events-none z-50 animate-pulse" />
      )}

      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-900/35 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/35 rounded-full blur-[120px]" />
      </div>

      <Header
        isRecording={audio.isRecording}
        isSimulated={audio.isSimulated}
        showSettings={showSettings}
        onStartMic={handleStartMic}
        onStartSim={handleStartSim}
        onStop={audio.stopSession}
        onToggleSettings={() => setShowSettings((v) => !v)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {audio.micError && (
          <MicrophoneError
            error={audio.micError}
            onSimulate={handleStartSim}
            onDismiss={() => audio.setMicError(null)}
          />
        )}

        {showSettings && (
          <SettingsPanel
            stressThreshold={stressThreshold}
            onSetStressThreshold={setStressThreshold}
            muteAudioAlerts={alerts.muteAudioAlerts}
            onSetMuteAudioAlerts={alerts.setMuteAudioAlerts}
            isSimulated={audio.isSimulated}
            hasMicStream={!!audio.analyser}
            apiStatus={apiStatus}
          />
        )}

        <AcousticVisualizer
          analyser={audio.analyser}
          features={acousticFeatures}
          isRecording={audio.isRecording}
          stressScore={stressPoints[stressPoints.length - 1]?.combinedStress ?? 15}
        />

        <MetricCard features={acousticFeatures} isRecording={audio.isRecording} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col h-full">
            <StressTrendsChart data={stressPoints} threshold={stressThreshold} />
          </div>
          <InterventionPanel
            interventions={alerts.interventions}
            breathingPhase={breathingPhase}
            breathingSecondsLeft={breathingSeconds}
            onDismiss={alerts.dismissAlert}
          />
        </div>

        <TranscriptArea lines={lines} isRecording={audio.isRecording} threshold={stressThreshold} />

        <ReportingExporter data={stressPoints} lines={lines} sessionStats={sessionStats} />
      </main>

      <footer className="relative z-10 px-8 py-6 border-t border-white/5 bg-black/40 text-[10px] text-zinc-600 font-mono select-none">
        <div className="max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
          <span className="uppercase tracking-widest">
            Acoustic Stress Monitor &bull; Private Beta v2.4.0
          </span>
          <div className="flex gap-4 text-zinc-400">
            <span>Processing: <span className="text-emerald-500">Self-Hosted Python API</span></span>
            <span>Zero Cloud Egress</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
