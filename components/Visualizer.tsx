import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  mode: 'SPECTRUM' | 'WAVEFORM';
  isPlaying: boolean;
  color?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ analyser, mode, isPlaying, color = '#111' }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !analyser) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Buffer length depends on FFT size
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Cleanup previous drawing
    svg.selectAll('*').remove();

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      if (mode === 'SPECTRUM') {
        analyser.getByteFrequencyData(dataArray);
      } else {
        analyser.getByteTimeDomainData(dataArray);
      }

      svg.selectAll('*').remove();

      if (mode === 'SPECTRUM') {
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        // Create bars using paths or rects. Using simple rects for Swiss brutalism.
        const bars = svg.selectAll('rect')
          .data(Array.from(dataArray))
          .enter()
          .append('rect')
          .attr('x', (d, i) => i * barWidth)
          .attr('y', d => height - (d / 255) * height)
          .attr('width', barWidth - 1)
          .attr('height', d => (d / 255) * height)
          .attr('fill', color);

      } else {
        // Waveform Line
        const line = d3.line<number>()
          .x((d, i) => (i / bufferLength) * width)
          .y(d => (d / 255) * height)
          .curve(d3.curveBasis); // Smooth curve

        svg.append('path')
          .datum(Array.from(dataArray))
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('d', line);
      }
    };

    if (isPlaying) {
      draw();
    } else {
      // Draw static line or empty state
      svg.append('line')
        .attr('x1', 0)
        .attr('y1', height / 2)
        .attr('x2', width)
        .attr('y2', height / 2)
        .attr('stroke', '#ccc')
        .attr('stroke-width', 1);
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying, mode, color]);

  return (
    <div className="w-full h-48 bg-white border-b-2 border-black overflow-hidden relative">
      <div className="absolute top-2 left-2 text-[10px] uppercase font-bold tracking-widest bg-black text-white px-2 py-0.5 z-10">
        {mode === 'SPECTRUM' ? 'FFT Analysis' : 'Waveform'}
      </div>
      <svg ref={svgRef} className="w-full h-full" />
      {/* Grid Overlay for technical feel */}
      <div className="absolute inset-0 grid grid-cols-12 pointer-events-none opacity-20">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="border-r border-black h-full"></div>
        ))}
      </div>
    </div>
  );
};