// @ts-nocheck
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function OrionOrb() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 4.5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particle Orb Geometry
    const geometry = new THREE.BufferGeometry();
    const particleCount = 2500;
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const initialPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.6 + Math.random() * 0.3; // Orb shell thickness

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Keep record of initial position to apply wave formula later
      initialPositions[i * 3] = x;
      initialPositions[i * 3 + 1] = y;
      initialPositions[i * 3 + 2] = z;

      // Premium neon gradient (cyan-purple-magenta blend)
      const colorRatio = Math.random();
      if (colorRatio < 0.4) {
        // Neon Cyan
        colors[i * 3] = 0.1;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 0.9;
      } else if (colorRatio < 0.7) {
        // Bright Purple
        colors[i * 3] = 0.6;
        colors[i * 3 + 1] = 0.2;
        colors[i * 3 + 2] = 0.9;
      } else {
        // Soft Magenta
        colors[i * 3] = 0.9;
        colors[i * 3 + 1] = 0.1;
        colors[i * 3 + 2] = 0.6;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Custom Round Particles
    // Create a round particle dot using Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
    }
    const texture = new THREE.CanvasTexture(canvas);

    // Material
    const material = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: texture,
    });

    // Points
    const orb = new THREE.Points(geometry, material);
    scene.add(orb);

    // Animation variables
    let clock = new THREE.Clock();
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    // Mouse movement listener for interactive parallax rotation
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      targetX = x * 0.0035;
      targetY = y * 0.0035;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth camera drag (Lerp)
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      camera.position.x = mouseX;
      camera.position.y = -mouseY;
      camera.lookAt(scene.position);

      // Slow idle rotations
      orb.rotation.y = elapsedTime * 0.12;
      orb.rotation.x = elapsedTime * 0.05;

      // Displace vertices inside a small wave pattern
      const positionAttr = geometry.attributes.position;
      const arr = positionAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        const ix = i * 3;
        const iy = i * 3 + 1;
        const iz = i * 3 + 2;

        const x = initialPositions[ix];
        const y = initialPositions[iy];
        const z = initialPositions[iz];

        // Apply a multi-frequency sine wave displacement
        const offset = Math.sin(elapsedTime * 1.5 + (x * y * z) * 0.5) * 0.08;
        
        arr[ix] = x + (x / 1.6) * offset;
        arr[iy] = y + (y / 1.6) * offset;
        arr[iz] = z + (z / 1.6) * offset;
      }
      
      positionAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-[280px] sm:h-[360px] flex items-center justify-center relative cursor-grab active:cursor-grabbing select-none"
    />
  );
}
