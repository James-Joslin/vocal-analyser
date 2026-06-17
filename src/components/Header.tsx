import { Activity, Mic, MicOff, RefreshCw, Settings } from "lucide-react";

interface HeaderProps {
  isRecording: boolean;
  isSimulated: boolean;
  showSettings: boolean;
  onStartMic: () => void;
  onStartSim: () => void;
  onStop: () => void;
  onToggleSettings: () => void;
}

export default function Header({
  isRecording,
  isSimulated,
  showSettings,
  onStartMic,
  onStartSim,
  onStop,
  onToggleSettings,
}: HeaderProps) {
  return (
    <header className="relative z-10 border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 px-6 py-4.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Activity className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-sans font-bold tracking-tight text-white uppercase">
                Acoustic Stress Monitor{" "}
                <span className="text-zinc-500 font-normal underline underline-offset-4 decoration-zinc-700">
                  v2.4
                </span>
              </h1>
              {isRecording && isSimulated && (
                <span className="text-[9px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse shrink-0">
                  Simulation Active
                </span>
              )}
            </div>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase tracking-wider">
              On-Device Vocal Health & Cognitive Strain Telemetry
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {!isRecording ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onStartMic}
                className="flex items-center justify-center gap-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5 text-zinc-950" />
                Initialise Mic
              </button>
              <button
                onClick={onStartSim}
                className="flex items-center justify-center gap-2 bg-zinc-900 border border-white/10 text-zinc-300 hover:bg-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                Simulate Demo
              </button>
            </div>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer animate-pulse"
            >
              <MicOff className="w-3.5 h-3.5 text-white" />
              {isSimulated ? "Stop Simulation" : "Disconnect Monitor"}
            </button>
          )}

          <button
            onClick={onToggleSettings}
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
  );
}
