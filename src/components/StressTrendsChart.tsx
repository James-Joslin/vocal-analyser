import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { StressDataPoint } from "../types";

interface StressTrendsChartProps {
  data: StressDataPoint[];
  threshold: number;
}

export default function StressTrendsChart({ data, threshold }: StressTrendsChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<StressDataPoint | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 180 });

  // Handle responsive resize via ResizeObserver as requested
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Cap minimum width for readability and set height proportionally
      setDimensions({
        width: Math.max(300, width),
        height: 180
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Set up D3 Render Effect on dataset or dimension mutation
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 15, right: 20, bottom: 25, left: 35 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const mainGroup = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define X & Y Domains
    const xScale = d3.scaleLinear()
      .domain([0, Math.max(10, d3.max(data, d => d.elapsedSeconds) || 10)])
      .range([0, chartWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight, 0]);

    // Build grid-lines for aesthetic premium tech-feel
    mainGroup.append("g")
      .attr("class", "grid")
      .attr("color", "rgba(255,255,255,0.06)") // thin white grid indicators
      .attr("stroke-opacity", 0.3)
      .call(d3.axisLeft(yScale)
        .tickValues([25, 50, 75, 100])
        .tickSize(-chartWidth)
        .tickFormat(() => "")
      );

    // Build elegant Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(data.length, 10))
      .tickFormat(d => `${d}s`);

    const yAxis = d3.axisLeft(yScale)
      .tickValues([0, 25, 50, 75, 100])
      .tickFormat(d => `${d}%`);

    const xAxisGroup = mainGroup.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);

    const yAxisGroup = mainGroup.append("g")
      .call(yAxis);

    // Style Axes text
    xAxisGroup.selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, ui-monospace, monospace");
    xAxisGroup.select(".domain").attr("stroke", "rgba(255,255,255,0.15)");
    xAxisGroup.selectAll("line").attr("stroke", "rgba(255,255,255,0.15)");

    yAxisGroup.selectAll("text")
      .attr("fill", "#a1a1aa")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, ui-monospace, monospace");
    yAxisGroup.select(".domain").attr("stroke", "rgba(255,255,255,0.15)");
    yAxisGroup.selectAll("line").attr("stroke", "rgba(255,255,255,0.15)");

    // Create Stress Threshold Areas for context mapping
    // Low / Moderate / Alert Areas
    mainGroup.append("rect")
      .attr("x", 0)
      .attr("y", yScale(100))
      .attr("width", chartWidth)
      .attr("height", yScale(threshold) - yScale(100))
      .attr("fill", "rgba(239, 68, 68, 0.02)"); // red alert

    mainGroup.append("rect")
      .attr("x", 0)
      .attr("y", yScale(threshold))
      .attr("width", chartWidth)
      .attr("height", yScale(threshold - 25) - yScale(threshold))
      .attr("fill", "rgba(139, 92, 246, 0.01)"); // moderate violet

    // Gradient Setup for Stress Curve fill space
    const defs = svg.append("defs");
    const stressGrad = defs.append("linearGradient")
      .attr("id", "stress-curve-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    stressGrad.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#8b5cf6") // violet-500
      .attr("stop-opacity", 0.25);
    
    stressGrad.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#8b5cf6")
      .attr("stop-opacity", 0.0);

    // Dynamic line stroke markers using gradients
    const strokeGrad = defs.append("linearGradient")
      .attr("id", "stroke-grad")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "100%")
      .attr("y2", "0%");

    data.forEach((d, i) => {
      const percentage = (i / (data.length - 1 || 1)) * 100;
      const color = d.combinedStress > threshold ? "#ef4444" : d.combinedStress > (threshold - 25) ? "#8b5cf6" : "#10b981";
      strokeGrad.append("stop")
        .attr("offset", `${percentage}%`)
        .attr("stop-color", color);
    });

    // Area Generator
    const areaGen = d3.area<StressDataPoint>()
      .x(d => xScale(d.elapsedSeconds))
      .y0(chartHeight)
      .y1(d => yScale(d.combinedStress))
      .curve(d3.curveMonotoneX);

    // Line Generator
    const lineGen = d3.line<StressDataPoint>()
      .x(d => xScale(d.elapsedSeconds))
      .y(d => yScale(d.combinedStress))
      .curve(d3.curveMonotoneX);

    // Acoustic Line Generator (Subtle baseline helper)
    const acousticLineGen = d3.line<StressDataPoint>()
      .x(d => xScale(d.elapsedSeconds))
      .y(d => yScale(d.acousticStress))
      .curve(d3.curveMonotoneX);

    // Background Area Chart Fill
    mainGroup.append("path")
      .datum(data)
      .attr("class", "area-path")
      .attr("d", areaGen)
      .attr("fill", "url(#stress-curve-grad)");

    // Subtle Acoustic Stress line
    mainGroup.append("path")
      .datum(data)
      .attr("class", "acoustic-trend-line")
      .attr("d", acousticLineGen)
      .attr("fill", "none")
      .attr("stroke", "#334155")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3, 3");

    // Main Combined Stress Curve Line
    mainGroup.append("path")
      .datum(data)
      .attr("class", "stress-trend-line")
      .attr("d", lineGen)
      .attr("fill", "none")
      .attr("stroke", data.length > 1 ? "url(#stroke-grad)" : "#8b5cf6")
      .attr("stroke-width", 2.5)
      .style("filter", "drop-shadow(0px 2px 4px rgba(139, 92, 246, 0.2))");

    // Interactive node tracking circles
    const nodeGroup = mainGroup.append("g").attr("class", "nodes");
    
    nodeGroup.selectAll(".node-circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("class", "node-circle")
      .attr("cx", d => xScale(d.elapsedSeconds))
      .attr("cy", d => yScale(d.combinedStress))
      .attr("r", d => d.isAlert ? 5 : 3.5)
      .attr("fill", d => d.isAlert ? "#ef4444" : "#1e1b4b")
      .attr("stroke", d => d.isAlert ? "#fecaca" : d.combinedStress > 45 ? "#c084fc" : "#34d399")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        setHoveredPoint(d);
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", d.isAlert ? 7 : 6)
          .attr("stroke-width", 2.5);
      })
      .on("mouseout", (event, d) => {
        setHoveredPoint(null);
        d3.select(event.currentTarget)
          .transition()
          .duration(150)
          .attr("r", d.isAlert ? 5 : 3.5)
          .attr("stroke-width", 1.5);
      });

  }, [data, dimensions, threshold]);

  return (
    <div className="flex flex-col bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-xl relative" ref={containerRef}>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-mono font-medium text-zinc-300">D3 STRESS INTERACTIVE HISTOGRAM</h3>
          <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 px-1.5 py-0.2 rounded border border-white/10">TREND ANALYSIS</span>
        </div>
        <div className="flex gap-4 text-[9px] font-mono text-zinc-400">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            Combined Stress
          </span>
          <span className="flex items-center gap-1 text-zinc-500">
            <span className="w-1.5 h-1.5 border-t border-zinc-500 border-dashed" />
            Acoustic Tension
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            Critical Alert
          </span>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 flex min-h-[140px] items-center justify-center">
        {data.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-xs text-zinc-500 font-mono">NO ACTIVE SESSION DATA DEPLOYED</p>
            <p className="text-[10px] text-zinc-600 mt-1">Activate the microphone or trigger a preloaded scenario to populate trends.</p>
          </div>
        ) : (
          <svg ref={svgRef} className="w-full h-[180px] overflow-visible" />
        )}

        {/* Dynamic Absolute Hover Card */}
        {hoveredPoint && (
          <div 
            className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-zinc-950/90 border border-white/10 rounded-xl py-1.5 px-3 shadow-xl backdrop-blur-md z-20"
          >
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500">ELAPSED TIME</span>
              <span className="text-xs font-mono text-zinc-200">{hoveredPoint.elapsedSeconds}s</span>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500">ACOUSTIC STRESS</span>
              <span className="text-xs font-mono text-emerald-400">{Math.round(hoveredPoint.acousticStress)}%</span>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500">SENTIMENT STRESS</span>
              <span className="text-xs font-mono text-indigo-400">{Math.round(hoveredPoint.linguisticStress)}%</span>
            </div>
            <div className="h-6 w-[1px] bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-zinc-500">HYBRID SCORE</span>
              <span className={`text-xs font-mono font-bold ${hoveredPoint.combinedStress > threshold ? 'text-rose-400' : 'text-indigo-400'}`}>
                {Math.round(hoveredPoint.combinedStress)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
