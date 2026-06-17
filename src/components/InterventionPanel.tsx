import { Heart, HeartPulse } from "lucide-react";
import type { InterventionAlert } from "../types";

interface InterventionPanelProps {
  interventions: InterventionAlert[];
  breathingPhase: string;
  breathingSecondsLeft: number;
  onDismiss: (id: string) => void;
}

export default function InterventionPanel({
  interventions,
  breathingPhase,
  breathingSecondsLeft,
  onDismiss,
}: InterventionPanelProps) {
  const active = interventions.filter((a) => !a.acknowledged);

  return (
    <div className="lg:col-span-4 flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 overflow-y-auto max-h-[230px] h-full">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-emerald-400 animate-pulse" />
          <h3 className="text-xs font-mono font-medium text-zinc-300 uppercase">
            Cognitive Interventions
          </h3>
        </div>
        <span className="text-[9px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 rounded font-bold uppercase">
          Coach Active
        </span>
      </div>

      {/* Breathing guide */}
      <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 mb-3 flex items-center justify-between border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] font-mono text-zinc-500 block uppercase">
              Breathing Companion (4-7-8)
            </span>
            <span className="text-xs font-bold text-zinc-200 uppercase">{breathingPhase}…</span>
          </div>
        </div>
        <div className="flex items-baseline gap-1 font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded">
          <span className="text-lg font-bold">{breathingSecondsLeft}</span>
          <span className="text-[8.5px]">s</span>
        </div>
      </div>

      {/* Alert feed */}
      <div className="space-y-2 flex-1 scrollbar-thin overflow-y-auto">
        {active.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-[10px] text-zinc-500 font-mono">Cognitive Status Report Steady</p>
            <p className="text-[9.5px] text-zinc-600 mt-0.5">
              Vocal parameters and sentiment indicators are balanced.
            </p>
          </div>
        ) : (
          active.map((alert) => (
            <div
              key={alert.id}
              className={`p-2.5 rounded-xl border text-[10px] font-mono flex flex-col justify-between ${
                alert.severity === "high"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                  : "bg-white/5 border-white/10 text-zinc-300"
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`font-bold ${
                    alert.severity === "high" ? "text-rose-400" : "text-indigo-400"
                  }`}
                >
                  {alert.title}
                </span>
                <button
                  onClick={() => onDismiss(alert.id)}
                  className="text-[9px] text-zinc-400 hover:text-white font-bold border border-white/10 bg-white/5 px-2 py-0.5 rounded-lg"
                >
                  Dismiss
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
  );
}
