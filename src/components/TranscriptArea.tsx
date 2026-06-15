import { useEffect, useRef } from "react";
import { TranscriptLine } from "../types";
import { Check, ShieldAlert, Sparkles, Terminal } from "lucide-react";

interface TranscriptAreaProps {
  lines: TranscriptLine[];
  isRecording: boolean;
  threshold: number;
}

export default function TranscriptArea({
  lines,
  isRecording,
  threshold,
}: TranscriptAreaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new transcript additions
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const getBubbleColor = (score: number) => {
    if (score > threshold) return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    if (score > threshold - 25) return "border-indigo-500/30 bg-indigo-500/10 text-indigo-200";
    return "border-white/10 bg-white/5 text-zinc-300";
  };

  const getHeaderBadge = (score: number) => {
    if (score > threshold) return "bg-rose-500/20 text-rose-300 border-rose-500/20";
    if (score > threshold - 25) return "bg-indigo-500/20 text-indigo-300 border-indigo-500/20";
    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/20";
  };

  return (
    <div className="flex flex-col bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl relative overflow-hidden h-[460px] w-full" id="transcript-feed-container">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/5 z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-mono font-medium text-zinc-300 uppercase">REAL-TIME TRANSCRIPT DIALOGUE</h3>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono">
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Calm
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Tense
          </span>
          <span className="flex items-center gap-1 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Panic Alert
          </span>
        </div>
      </div>

      {/* FEED BODY */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-3.5 pr-1 font-mono text-[11px] leading-relaxed scrollbar-thin overflow-x-hidden mb-2"
        id="transcript-lines-scroll"
      >
        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center text-zinc-500">
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 mb-3 animate-pulse">
              <Terminal className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-[11px] font-bold text-zinc-400">STREAM REGISTER VACANT</p>
            <p className="text-[9px] text-zinc-650 mt-1 max-w-[320px]">
              Speak clearly into your microphone range to commence live acoustic sentiment analysis and linguistic transcription streaming.
            </p>
          </div>
        ) : (
          lines.map((ln) => {
            const borderTheme = getBubbleColor(ln.combinedStressScore);
            const badgeTheme = getHeaderBadge(ln.combinedStressScore);
            const senderLabel = ln.sender === "speaker" ? "SUBJECT / HIGH PRESSURE" : ln.sender === "responder" ? "COGNITIVE COUNSEL" : "SYSTEM BIOMETRIC";

            return (
              <div
                id={ln.id}
                key={ln.id}
                className={`border rounded-xl p-3.5 transition-all duration-300 ${borderTheme}`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase border border-white/5 ${badgeTheme}`}>
                      {senderLabel}
                    </span>
                    <span className="text-[9px] text-zinc-500">{ln.timestamp}</span>
                  </div>

                  <div className="flex gap-2 text-[9px]">
                    {ln.isAnalyzed ? (
                      <span className="flex items-center gap-1 text-zinc-400 bg-white/5 rounded px-1.5 py-0.2 border border-white/5">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                        COGNITIVE STRESS SCAN
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-500 bg-white/5 rounded px-1.5 py-0.2 border border-white/5 animate-pulse">
                        PROCESSING SENTIMENT...
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-white font-sans text-xs tracking-wide leading-relaxed">
                  {ln.text}
                </p>

                {/* Inline stress report */}
                {ln.isAnalyzed && (
                  <div className="mt-2.5 pt-2 border-t border-white/5 grid grid-cols-3 gap-2 text-[9px] font-mono text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Acoustic Tension:</span>{" "}
                      <span className="font-bold text-zinc-200">{Math.round(ln.acousticStressScore)}%</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Linguistic Stress:</span>{" "}
                      <span className="font-bold text-zinc-200">
                        {ln.linguisticStressScore !== undefined ? `${Math.round(ln.linguisticStressScore)}%` : "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500">Combined:</span>{" "}
                      <span className={`font-bold ${ln.combinedStressScore > threshold ? "text-rose-400" : ln.combinedStressScore > threshold - 25 ? "text-indigo-400" : "text-emerald-400"}`}>
                        {Math.round(ln.combinedStressScore)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Warning Alert Overlay for High Stress peaks */}
      {lines.length > 0 && lines[lines.length - 1].combinedStressScore > threshold && (
        <div className="absolute bottom-3 left-5 right-5 bg-rose-950/80 border border-rose-500/30 rounded-xl p-2.5 flex items-center gap-3 backdrop-blur-md shadow-lg z-20 animate-bounce">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
          <div className="flex-1">
            <span className="text-[9px] font-mono font-bold text-rose-300">ALERT: HIGH DISTRESS INDICATORS DETECTED</span>
            <p className="text-[10px] text-rose-200 leading-tight">
              Vocal or language indicators exceed the selected threshold ({threshold}%). Slow the interaction, allow a pause, and use grounding prompts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
