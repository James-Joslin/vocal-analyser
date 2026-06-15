import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { AcousticFeatures } from "../types";

interface AcousticVisualizerProps {
  analyser: AnalyserNode | null;
  features: AcousticFeatures;
  isRecording: boolean;
  stressScore: number;
}

export default function AcousticVisualizer({
  analyser,
  features,
  isRecording,
  stressScore,
}: AcousticVisualizerProps) {
  const lineSvgRef = useRef<SVGSVGElement | null>(null);
  const circularSvgRef = useRef<SVGSVGElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Set up analyzer buffer
  useEffect(() => {
    if (analyser) {
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    } else {
      dataArrayRef.current = null;
    }
  }, [analyser]);

  // Main rendering loop containing D3-driven manipulations
  useEffect(() => {
    const width = 450;
    const height = 110;
    
    // Select the time-waveform SVG element
    const svgLine = d3.select(lineSvgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%");

    // Select the circular loading/stress radar SVG
    const svgCircular = d3.select(circularSvgRef.current)
      .attr("viewBox", "0 0 200 200")
      .attr("width", "100%")
      .attr("height", "100%");

    // Initialize circular elements once
    svgCircular.selectAll("*").remove();
    
    const radarGroup = svgCircular.append("g")
      .attr("transform", "translate(100, 100)");

    // Background concentric rings for visual rhythm
    const rings = [30, 60, 90];
    radarGroup.selectAll(".grid-ring")
      .data(rings)
      .enter()
      .append("circle")
      .attr("class", "grid-ring")
      .attr("r", d => d)
      .attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.08)") // frosted thin stroke
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4, 4");

    // Static radar axis lines
    const axes = [0, 45, 90, 135, 180, 225, 270, 315];
    radarGroup.selectAll(".grid-axis")
      .data(axes)
      .enter()
      .append("line")
      .attr("class", "grid-axis")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", d => 90 * Math.cos((d * Math.PI) / 180))
      .attr("y2", d => 90 * Math.sin((d * Math.PI) / 180))
      .attr("stroke", "rgba(255,255,255,0.08)")
      .attr("stroke-width", 0.5);

    // Glowing core pulsating stress indicator
    const stressPulseCircle = radarGroup.append("circle")
      .attr("class", "pulse-core")
      .attr("r", 25)
      .attr("fill", "url(#stress-gradient)")
      .attr("opacity", 0.5);

    // Set up gradients
    const defs = svgCircular.append("defs");
    
    const radialGrad = defs.append("radialGradient")
      .attr("id", "stress-gradient");
    
    radialGrad.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#ef4444"); // red-500
    
    radialGrad.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#8b5cf6"); // violet-500

    const radarLinePath = radarGroup.append("path")
      .attr("class", "radar-polygon")
      .attr("fill", "rgba(139, 92, 246, 0.2)") // violet tint
      .attr("stroke", "#8b5cf6")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0px 0px 4px rgba(139, 92, 246, 0.4))");

    // Time-waveform path initializer
    svgLine.selectAll("*").remove();
    const wavePath = svgLine.append("path")
      .attr("fill", "none")
      .attr("stroke", "#a78bfa") // violet-400
      .attr("stroke-width", 2);

    let phase = 0;

    const renderTick = () => {
      phase += 0.08;

      let frequencies: number[] = [];
      const isActuallyRunning = isRecording && dataArrayRef.current;

      if (isActuallyRunning && analyser && dataArrayRef.current) {
        // Real visual data fetch
        analyser.getByteFrequencyData(dataArrayRef.current);
        frequencies = Array.from(dataArrayRef.current);
      } else {
        // Simulated procedural values aligned to vocal stress metrics
        const numPoints = 128;
        const amplitude = isRecording ? Math.max(10, 15 + Math.sin(phase) * 8) : 2;
        const baseHz = features.pitch > 0 ? (features.pitch / 5) : 30;
        
        for (let i = 0; i < numPoints; i++) {
          // Generate a complex synthetic speech spectrum (formants, pitch peaks + noise)
          const multiplier = isRecording ? (1.5 + Math.sin(phase + i * 0.1) * 0.5) : 0.1;
          const noise = isRecording ? (Math.random() * 4) : 0;
          const value = 15 + Math.sin(i * 0.15 + phase) * amplitude * multiplier + 
                        Math.cos(i * 0.4 + phase * 1.5) * (amplitude * 0.4) + noise;
          frequencies.push(Math.max(0, value));
        }
      }

      // Convert frequency values to standard D3 time-domain wave generator
      const pointSpacing = width / (frequencies.length - 1);
      const waveData = frequencies.map((freq, i) => {
        const x = i * pointSpacing;
        const scaleVal = isRecording ? Math.min(1, Math.max(0.05, features.energy / 60)) : 0.02;
        const midpoint = height / 2;
        // Map frequency to high/low amplitude waves
        const offset = (freq - 40) * scaleVal * 0.7;
        const y = midpoint + offset * Math.sin(i * 0.2 + phase);
        return { x, y: Math.max(5, Math.min(height - 5, y)) };
      });

      // Simple line generator with curve smoothing
      const lineGen = d3.line<{ x: number; y: number }>()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveMonotoneX);

      // Mutate wave color depending on current active threat (stressScore)
      const colorScale = d3.scaleLinear<string>()
        .domain([20, 50, 80])
        .range(["#10b981", "#8b5cf6", "#ef4444"]); // green -> violet -> red

      const activeColor = isRecording ? colorScale(stressScore) : "#334155";
      
      wavePath
        .datum(waveData)
        .attr("d", lineGen)
        .attr("stroke", activeColor)
        .style("filter", `drop-shadow(0px 0px 6px ${activeColor}80)`);

      // 2. Animate Circular Stress Radar Group
      // Radar dimensions mapping features: 0=Energy, 1=Spectral Centroid, 2=Jitter, 3=Shimmer, 4=Pitch Tension, 5=Stress Intensity
      const radialMetrics = [
        features.energy * 1.2, // Energy volume
        features.spectralCentroid, // Brightness
        features.jitter * 1.8, // Vocal roughness
        features.shimmer * 1.8, // Volume amplitude instability
        Math.min(100, Math.max(10, (features.pitch - 80) / 2.5)), // Pitch strain
        stressScore // Sentiment combined indicator
      ];

      // Pad out array for smooth radial shape mapping
      const metricAngles = [0, 60, 120, 180, 240, 300];
      const radarPoints = metricAngles.map((angleDeg, index) => {
        const metricVal = isRecording ? radialMetrics[index] : 5;
        // Restrict within radar circles (radius 90 max)
        const radius = Math.min(95, 12 + (metricVal || 0) * 0.8) + Math.sin(phase + index) * (isRecording ? 1.5 : 0.2);
        const angleRad = (angleDeg * Math.PI) / 180;
        return {
          x: radius * Math.cos(angleRad),
          y: radius * Math.sin(angleRad)
        };
      });

      // Linear radial generator
      const radarLineGen = d3.line<{ x: number; y: number }>()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveLinearClosed);

      radarLinePath
        .datum(radarPoints)
        .attr("d", radarLineGen)
        .attr("stroke", activeColor)
        .attr("fill", `${activeColor}1e`)
        .style("filter", `drop-shadow(0px 0px 5px ${activeColor}50)`);

      // Dynamic core scaling pulse
      const corePulseScale = 20 + (isRecording ? (features.energy * 0.2 + (stressScore / 5)) : 2) + Math.sin(phase * 2) * 2;
      stressPulseCircle
        .attr("r", Math.max(10, corePulseScale))
        .attr("fill", activeColor)
        .attr("opacity", isRecording ? 0.25 + (stressScore / 300) : 0.08);

      animationRef.current = requestAnimationFrame(renderTick);
    };

    renderTick();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, analyser, features, stressScore]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
      {/* Time-Domain Wave trace */}
      <div className="lg:col-span-8 flex flex-col justify-between h-48 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden" id="d3-wave-container">
        <div className="flex justify-between items-center mb-2 z-10">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-indigo-400 animate-pulse" : "bg-zinc-700"}`} />
            <h3 className="text-xs font-mono font-medium text-zinc-300">D3 FFT TIME-WAVE OSCILLOSCOPE</h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">256 CHANNELS</span>
        </div>
        
        {/* WAVE FORM AREA */}
        <div className="flex-1 flex items-center justify-center">
          <svg ref={lineSvgRef} className="w-full h-full max-h-[140px] overflow-visible" id="d3-wave-svg" />
        </div>

        <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-2 border-t border-white/5 pt-2 z-10">
          <span>0.0 ms</span>
          <span>12.5 ms</span>
          <span>25.0 ms</span>
          <span>37.5 ms</span>
          <span>50.0 ms</span>
        </div>
      </div>

      {/* Radial Metric Radar */}
      <div className="lg:col-span-4 flex flex-col justify-between h-48 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl relative overflow-hidden" id="d3-stress-radar-container">
        <div className="flex justify-between items-center mb-1 z-10">
          <h3 className="text-xs font-mono font-medium text-zinc-300">STRESS MARKER AXIS</h3>
          <span className="text-[10px] font-mono text-zinc-500">RADIAL SPECTRAL</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-1">
          <svg ref={circularSvgRef} className="w-32 h-32 overflow-visible" id="d3-radar-svg" />
        </div>

        <div className="grid grid-cols-3 gap-1 text-[9px] font-mono text-center text-zinc-500 z-10">
          <span title="Acoustic Shimmer">SHIM</span>
          <span title="Spectral Centroid">CENT</span>
          <span title="Vocal Jitter">JITT</span>
        </div>
      </div>
    </div>
  );
}
