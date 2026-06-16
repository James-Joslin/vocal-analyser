import { Settings } from "lucide-react";
import type { ApiStatus } from "../types";

interface SettingsPanelProps {
  stressThreshold: number;
  onSetStressThreshold: (value: number) => void;
  muteAudioAlerts: boolean;
  onSetMuteAudioAlerts: (muted: boolean) => void;
  isSimulated: boolean;
  hasMicStream: boolean;
  apiStatus: ApiStatus;
}

export default function SettingsPanel({
  stressThreshold,
  onSetStressThreshold,
  muteAudioAlerts,
  onSetMuteAudioAlerts,
  isSimulated,
  hasMicStream,
  apiStatus,
}: SettingsPanelProps) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 relative z-30 transition-all">
      <div className="flex justify-between items-center border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-mono font-bold text-zinc-200 uppercase">
            Diagnostic Settings
          </h2>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">Self-Hosted Pipeline</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Threshold & alert controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-mono font-bold text-zinc-400 block uppercase">
                Alert Detection Threshold
              </label>
              <span className="text-xs font-bold font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {stressThreshold}%
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="35"
                max="90"
                value={stressThreshold}
                onChange={(e) => onSetStressThreshold(Number(e.target.value))}
                className="flex-1 accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 select-none cursor-pointer uppercase shrink-0">
                <input
                  type="checkbox"
                  checked={muteAudioAlerts}
                  onChange={(e) => onSetMuteAudioAlerts(e.target.checked)}
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

        {/* Hardware & API diagnostics */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-[10px] font-mono text-zinc-400 space-y-2">
          <span className="text-zinc-300 block font-bold">Hardware & API Status</span>
          <div className="flex justify-between">
            <span>Microphone Interface:</span>
            <span
              className={
                isSimulated
                  ? "text-amber-400 font-bold"
                  : hasMicStream
                    ? "text-emerald-400 font-bold"
                    : "text-zinc-500"
              }
            >
              {isSimulated
                ? "Simulated Vocal Stream"
                : hasMicStream
                  ? "Online (PCM 16K)"
                  : "Unconnected / Idle"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Python Analysis API:</span>
            <span
              className={
                apiStatus === "ready"
                  ? "text-emerald-400 font-bold"
                  : apiStatus === "degraded"
                    ? "text-amber-400 font-bold"
                    : "text-rose-400 font-bold"
              }
            >
              {apiStatus === "ready"
                ? "Ready (Whisper + Wav2Vec2 + DistilBERT)"
                : apiStatus === "degraded"
                  ? "Degraded (Partial Model Load)"
                  : apiStatus === "checking"
                    ? "Checking…"
                    : "Offline"}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-white/5">
            <span>Processing Mode:</span>
            <span className="text-emerald-400 font-bold">Self-Hosted Container Only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
