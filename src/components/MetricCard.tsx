import { AcousticFeatures } from "../types";
import { Activity, Flame, Volume2, Waves, Zap } from "lucide-react";

interface MetricCardProps {
  features: AcousticFeatures;
  isRecording: boolean;
}

export default function MetricCard({ features, isRecording }: MetricCardProps) {
  // Helpers for styling & threshold mappings
  const getProgressColor = (value: number, type: 'jitter' | 'shimmer' | 'centroid' | 'energy' | 'pitch') => {
    if (!isRecording) return 'bg-white/10';
    if (type === 'jitter' || type === 'shimmer') {
      if (value > 15) return 'bg-rose-500';
      if (value > 8) return 'bg-amber-500';
      return 'bg-emerald-500';
    }
    if (type === 'centroid') {
      if (value > 75) return 'bg-rose-500';
      if (value > 45) return 'bg-indigo-500';
      return 'bg-emerald-500';
    }
    if (type === 'energy') {
      if (value > 65) return 'bg-amber-500';
      if (value > 40) return 'bg-indigo-500';
      return 'bg-emerald-500';
    }
    return 'bg-indigo-500'; // pitch
  };

  const getStatusText = (value: number, type: 'jitter' | 'shimmer' | 'centroid' | 'energy') => {
    if (!isRecording) return 'Idle';
    if (type === 'jitter' || type === 'shimmer') {
      if (value > 15) return 'Strained / High Threat';
      if (value > 8) return 'Elevated Strain';
      return 'Relaxed / Controlled';
    }
    if (type === 'centroid') {
      if (value > 75) return 'Sharp Tension';
      if (value > 45) return 'Expressive Cadence';
      return 'Soft / Muffled';
    }
    if (type === 'energy') {
      if (value > 65) return 'Loud / Peak';
      if (value > 30) return 'Moderate Dialogue';
      return 'Whisper / Quiet';
    }
    return 'Normal';
  };

  const METRICS = [
    {
      id: "metric-energy",
      name: "ENERGY (VOLUME RMS)",
      value: isRecording ? features.energy : 0,
      format: (v: number) => `${v.toFixed(1)} dB`,
      icon: Volume2,
      subText: getStatusText(features.energy, 'energy'),
      max: 100,
      color: getProgressColor(features.energy, 'energy'),
      desc: "Instantaneous signal strength indicating amplitude volume."
    },
    {
      id: "metric-pitch",
      name: "COGNITIVE PITCH REGISTER",
      value: isRecording ? features.pitch : 0,
      format: (v: number) => v > 0 ? `${Math.round(v)} Hz` : "0 Hz",
      icon: Activity,
      subText: isRecording ? (features.pitch > 240 ? "Elevated Pitch / Hyper" : features.pitch > 160 ? "Normal Balanced" : "Deep register") : "Idle",
      max: 400,
      color: getProgressColor(features.pitch, 'pitch'),
      desc: "Vocal tract oscillation showing fundamental tension markers."
    },
    {
      id: "metric-centroid",
      name: "SPECTRAL CENTROID",
      value: isRecording ? features.spectralCentroid : 0,
      format: (v: number) => `${v.toFixed(1)} %`,
      icon: Zap,
      subText: getStatusText(features.spectralCentroid, 'centroid'),
      max: 100,
      color: getProgressColor(features.spectralCentroid, 'centroid'),
      desc: "Spectral gravity center marking sharpness and physiological strain."
    },
    {
      id: "metric-jitter",
      name: "VOCAL CORD JITTER",
      value: isRecording ? features.jitter : 0,
      format: (v: number) => `${v.toFixed(2)} %`,
      icon: Waves,
      subText: getStatusText(features.jitter, 'jitter'),
      max: 25,
      color: getProgressColor(features.jitter, 'jitter'),
      desc: "Microscopic pitch frequency fluctuations stemming from cognitive distress."
    },
    {
      id: "metric-shimmer",
      name: "VOCAL SHIMMER",
      value: isRecording ? features.shimmer : 0,
      format: (v: number) => `${v.toFixed(2)} %`,
      icon: Flame,
      subText: getStatusText(features.shimmer, 'shimmer'),
      max: 25,
      color: getProgressColor(features.shimmer, 'shimmer'),
      desc: "Vocal wave amplitude inequalities reflecting adrenaline surges."
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {METRICS.map((m) => {
        const Icon = m.icon;
        const progressPercentage = Math.min(100, (m.value / m.max) * 100);

        return (
          <div
            id={m.id}
            key={m.id}
            className="flex flex-col justify-between bg-white/5 border border-white/10 rounded-2xl p-4.5 hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-xl relative overflow-hidden group"
          >
            {/* Top row */}
            <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] font-mono font-bold tracking-widest text-zinc-500">
                {m.name}
              </span>
              <Icon className={`w-4 h-4 ${isRecording ? "text-indigo-400" : "text-zinc-600"} transition-colors`} />
            </div>

            {/* Core metric value */}
            <div className="flex items-baseline gap-1 mt-1 mb-1">
              <span className="text-xl font-mono font-extrabold text-white tracking-tight">
                {m.format(m.value)}
              </span>
            </div>

            {/* Progress metric track */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mt-2 relative">
              <div
                className={`h-full ${m.color} rounded-full transition-all duration-300`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>

            {/* Bottom meta row */}
            <div className="flex justify-between items-center mt-2.5 text-[9px] font-mono text-zinc-400">
              <span className="font-semibold text-zinc-400 capitalize truncate max-w-[120px]">
                {m.subText}
              </span>
              <span className="text-zinc-600 text-right opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap cursor-help" title={m.desc}>
                Info
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
