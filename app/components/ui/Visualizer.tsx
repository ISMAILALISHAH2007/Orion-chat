'use client';
import { useEffect, useRef } from 'react';
import { initVisualizer } from '@/app/lib/webgl';

export default function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      initVisualizer(canvasRef.current);
    }
  }, []);

  return (
    <div className="visualizer-container">
      <canvas id="webgl-canvas" ref={canvasRef}></canvas>
      <div className="orb-overlay">
        <div className="orb-text-state">ULTRON ONLINE</div>
      </div>
    </div>
  );
}
