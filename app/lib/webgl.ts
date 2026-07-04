// app/lib/webgl.ts

// Loose typing for the global THREE library loaded via script tag.
// We don't import from 'three' so the npm types aren't required.
type ThreeGlobal = {
  Scene: new () => { add: (object: unknown) => void };
  PerspectiveCamera: new (fov: number, aspect: number, near: number, far: number) => {
    position: { z: number; x?: number; y?: number };
    aspect: number;
    updateProjectionMatrix: () => void;
  };
  WebGLRenderer: new (opts: { canvas: HTMLCanvasElement; antialias?: boolean; alpha?: boolean }) => {
    setPixelRatio: (ratio: number) => void;
    setSize: (w: number, h: number, updateStyle?: boolean) => void;
    render: (scene: unknown, camera: unknown) => void;
  };
  IcosahedronGeometry: new (radius: number, detail: number) => {
    attributes: { position: { array: ArrayLike<number> } };
  };
  MeshBasicMaterial: new (opts: { color: number; wireframe?: boolean; transparent?: boolean; opacity?: number }) => { color: { setHex: (h: number) => void } };
  Mesh: new (geometry: unknown, material: unknown) => { rotation: { y: number; x: number }; scale: { set: (x: number, y: number, z: number) => void } };
  BufferGeometry: new () => { setAttribute: (name: string, attr: unknown) => void };
  BufferAttribute: new (array: ArrayLike<number>, itemSize: number) => unknown;
  PointsMaterial: new (opts: { color: number; size: number; transparent?: boolean; opacity?: number }) => { color: { setHex: (h: number) => void } };
  Points: new (geometry: unknown, material: unknown) => { rotation: { y: number; x: number }; scale: { set: (x: number, y: number, z: number) => void } };
  AmbientLight: new (color: number, intensity: number) => unknown;
  PointLight: new (color: number, intensity: number, distance: number) => { position: { set: (x: number, y: number, z: number) => void } };
  Clock: new () => { getElapsedTime: () => number };
};

export function initVisualizer(canvas: HTMLCanvasElement) {
  if (typeof window === 'undefined') return;

  const THREE: ThreeGlobal | undefined = (window as unknown as { THREE?: ThreeGlobal }).THREE;
  if (!THREE) {
    console.error("Three.js library is not available in the global scope.");
    return;
  }

  // 1. Setup Scene, Camera, and Renderer
  const scene = new THREE.Scene();

  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 400;
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
  camera.position.z = 4.5;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  // 2. Create the outer wireframe holographic sphere
  const geometry = new THREE.IcosahedronGeometry(2, 4);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00f3ff,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const sphere = new THREE.Mesh(geometry, material);
  scene.add(sphere);

  // 3. Create the inner particle system sphere
  const particlesGeom = new THREE.IcosahedronGeometry(1.95, 3);
  const positions = particlesGeom.attributes.position.array;
  
  const pGeometry = new THREE.BufferGeometry();
  pGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const pMaterial = new THREE.PointsMaterial({
    color: 0x7000ff,
    size: 0.04,
    transparent: true,
    opacity: 0.6
  });
  const particleSystem = new THREE.Points(pGeometry, pMaterial);
  scene.add(particleSystem);

  // 4. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x00f3ff, 2, 30);
  pointLight.position.set(5, 5, 5);
  scene.add(pointLight);

  // 5. Mouse Follow Tilt
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;

  const handleMouseMove = (event: MouseEvent) => {
    mouseX = (event.clientX - window.innerWidth / 2) / 200;
    mouseY = (event.clientY - window.innerHeight / 2) / 200;
  };
  window.addEventListener('mousemove', handleMouseMove);

  // 6. Handle Window Resizing
  const handleResize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', handleResize);
  
  // Trigger initial resize sync
  setTimeout(handleResize, 150);

  // 7. Animation Loop
  let animationFrameId: number;
  const clock = new THREE.Clock();

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Rotate spheres at slightly different frequencies
    sphere.rotation.y = elapsedTime * 0.12;
    sphere.rotation.x = elapsedTime * 0.08;
    particleSystem.rotation.y = -elapsedTime * 0.08;
    particleSystem.rotation.x = -elapsedTime * 0.06;

    // Harmonic breathing pulse
    const pulse = 1.0 + Math.sin(elapsedTime * 1.5) * 0.04;
    sphere.scale.set(pulse, pulse, pulse);
    particleSystem.scale.set(pulse, pulse, pulse);

    // Eased mouse tilt
    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;
    sphere.rotation.y += targetX * 0.4;
    sphere.rotation.x += targetY * 0.4;
    particleSystem.rotation.y += targetX * 0.25;

    // Adapt colors dynamically based on active layout mode
    const classes = document.body.classList;
    if (classes.contains('mode-developer')) {
      material.color.setHex(0x39ff14); // neon green
      pMaterial.color.setHex(0x00ffff);
    } else if (classes.contains('mode-research')) {
      material.color.setHex(0xff007f); // neon pink
      pMaterial.color.setHex(0x7000ff);
    } else if (classes.contains('mode-professional')) {
      material.color.setHex(0xffaa00); // gold
      pMaterial.color.setHex(0x0088ff);
    } else {
      material.color.setHex(0x00f3ff); // casual blue
      pMaterial.color.setHex(0x7000ff);
    }

    renderer.render(scene, camera);
  };

  animate();

  // Cleanup function returned for useEffect
  return () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('resize', handleResize);
  };
}
