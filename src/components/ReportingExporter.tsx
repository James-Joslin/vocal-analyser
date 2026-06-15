import { StressDataPoint, TranscriptLine } from "../types";
import { Download, FileDown, FileText, Share2 } from "lucide-react";

interface ReportingExporterProps {
  data: StressDataPoint[];
  lines: TranscriptLine[];
  sessionStats: {
    avgStress: number;
    maxStress: number;
    activeTime: number;
    totalAlerts: number;
  };
}

export default function ReportingExporter({
  data,
  lines,
  sessionStats,
}: ReportingExporterProps) {
  
  // Format seconds to readable length
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  // 1. Generate downloadable CSV Blob
  const handleExportCSV = () => {
    if (data.length === 0) return;

    // Headers
    const rows = [
      ["Timestamp", "Elapsed (Seconds)", "Acoustic Stress (%)", "Sentiment Stress (%)", "Combined Hybrid Stress (%)", "Crisis Alert Triggered"]
    ];

    // Data points row injection
    data.forEach(pt => {
      rows.push([
        pt.timestamp,
        pt.elapsedSeconds.toString(),
        pt.acousticStress.toFixed(1),
        pt.linguisticStress.toFixed(1),
        pt.combinedStress.toFixed(1),
        pt.isAlert ? "YES" : "NO"
      ]);
    });

    // Transcript append
    if (lines.length > 0) {
      rows.push([]);
      rows.push(["--- SESSION TRANSCRIPT LOGS ---"]);
      rows.push(["Timestamp", "Sender", "Transcript Dialogue Text", "Acoustic Stress (%)", "Linguistic Stress (%)", "Combined Stress Score (%)"]);
      lines.forEach(ln => {
        rows.push([
          ln.timestamp,
          ln.sender,
          ln.text.replace(/"/g, '""'),
          ln.acousticStressScore.toFixed(1),
          (ln.linguisticStressScore ?? 0).toFixed(1),
          ln.combinedStressScore.toFixed(1)
        ]);
      });
    }

    // Convert CSV array to secure Blob
    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileTimestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.setAttribute("download", `VocalStress_Report_${fileTimestamp}.csv`);
    document.body.appendChild(link); // Required for FF
    
    link.click();
    document.body.removeChild(link);
  };

  // 2. High-Polished Browser Print/PDF activation
  const handleExportPDF = () => {
    window.print();
  };

  const isDataEmpty = data.length === 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl relative" id="exporter-card">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-mono font-medium text-zinc-300 uppercase">SESSION REPORTING CORE</h3>
          </div>
          <p className="text-[10px] text-zinc-500 font-mono leading-relaxed">
            Generate and export structured summaries of cognitive fatigue, phonetic stress indices, and dialog scripts for mental healthcare records.
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto shrink-0 justify-end" id="exporter-buttons-row">
          {/* CSV Download */}
          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            disabled={isDataEmpty}
            className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 text-zinc-300 disabled:opacity-30 disabled:pointer-events-none rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-wide transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            CSV Data Log
          </button>

          {/* Trigger Print / Save PDF */}
          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            disabled={isDataEmpty}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 disabled:pointer-events-none rounded-xl px-4 py-2 text-xs font-mono uppercase tracking-wide transition-colors shadow-lg cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            Save PDF Report
          </button>
        </div>
      </div>

      {/* Summary report grid shown preview style, also optimized for window.print() CSS styles */}
      {!isDataEmpty && (
        <div id="print-dashboard-report" className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-black/10 border border-white/5 rounded-xl p-3">
            <span className="text-[8.5px] font-mono text-zinc-500 block mb-1">MEAN SESSION STRESS</span>
            <span className={`text-lg font-mono font-bold ${sessionStats.avgStress > 70 ? "text-rose-400" : sessionStats.avgStress > 40 ? "text-indigo-400" : "text-emerald-400"}`}>
              {Math.round(sessionStats.avgStress)}%
            </span>
            <span className="text-[8px] font-mono text-zinc-500 block mt-1">Average threat rating</span>
          </div>
          
          <div className="bg-black/10 border border-white/5 rounded-xl p-3">
            <span className="text-[8.5px] font-mono text-zinc-500 block mb-1">PEAK SIGNAL INTENSITY</span>
            <span className="text-lg font-mono font-bold text-rose-400">
              {Math.round(sessionStats.maxStress)}%
            </span>
            <span className="text-[8px] font-mono text-zinc-500 block mt-1">Highest combined peak</span>
          </div>

          <div className="bg-black/10 border border-white/5 rounded-xl p-3">
            <span className="text-[8.5px] font-mono text-zinc-500 block mb-1 font-semibold">CUMULATIVE ALERTS</span>
            <span className={`text-lg font-mono font-bold ${sessionStats.totalAlerts > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {sessionStats.totalAlerts}
            </span>
            <span className="text-[8px] font-mono text-zinc-500 block mt-1">Anomalous triggers identified</span>
          </div>

          <div className="bg-black/10 border border-white/5 rounded-xl p-3">
            <span className="text-[8.5px] font-mono text-zinc-500 block mb-1">MONITORING PERIOD</span>
            <span className="text-lg font-mono font-bold text-white">
              {formatTime(sessionStats.activeTime)}
            </span>
            <span className="text-[8px] font-mono text-zinc-500 block mt-1">Session recording volume</span>
          </div>
        </div>
      )}
    </div>
  );
}
