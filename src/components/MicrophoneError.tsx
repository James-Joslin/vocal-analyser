import { RefreshCw, ShieldAlert } from "lucide-react";

interface MicrophoneErrorProps {
  error: string;
  onSimulate: () => void;
  onDismiss: () => void;
}

export default function MicrophoneError({ error, onSimulate, onDismiss }: MicrophoneErrorProps) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all duration-300">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-amber-500/15 rounded-xl text-amber-400 shrink-0 mt-0.5 border border-amber-500/20">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-sans font-bold text-amber-200 uppercase tracking-wide">
            Microphone Permission Denied or Blocked
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed max-w-2xl font-sans text-left">
            The application could not access your vocal stream due to browser privacy restrictions or
            iframe constraints ({error}).
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-zinc-500 pt-1.5 uppercase">
            <span>&bull; Enable microphone permission in browser settings</span>
            <span>
              &bull; Click{" "}
              <strong className="text-zinc-400 font-bold">&quot;Open in a new window&quot;</strong>{" "}
              at the top right to bypass iframe environments
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 w-full md:w-auto mt-2 md:mt-0">
        <button
          onClick={onSimulate}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl px-4.5 py-2.5 text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Simulate Voice Loop
        </button>
        <button
          onClick={onDismiss}
          className="p-2.5 rounded-xl border border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-white/5 text-xs font-sans"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
