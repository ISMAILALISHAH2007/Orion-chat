'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCcw } from 'lucide-react';

interface CameraModalProps {
  onCapture: (dataUri: string) => void;
  onClose: () => void;
}

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera access is only available on secure connections (HTTPS or localhost). Please use the paperclip to upload a photo instead.');
      onClose();
      return;
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 4096 }, height: { ideal: 2160 } }
      });
      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error('Camera access denied or unavailable', err);
      alert('Camera access is required to take a photo. Please check your browser permissions.');
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, startCamera]);

  const handleSnap = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.85); // compress slightly
      onCapture(dataUri);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in sm:p-4">
      <div className="relative h-full w-full overflow-hidden bg-black sm:max-h-[85vh] sm:max-w-md sm:rounded-[36px] sm:border sm:border-white/10 sm:shadow-2xl">
        {/* Header */}
        <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
          <button onClick={() => setFacingMode(m => m === 'user' ? 'environment' : 'user')} className="rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
            <RefreshCcw size={20} />
          </button>
          <button onClick={onClose} className="rounded-full bg-white/10 p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
            <X size={20} />
          </button>
        </div>

        {/* Video Feed */}
        <div className="relative h-full w-full bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center bg-gradient-to-t from-black/90 via-black/60 to-transparent p-8">
          <button
            onClick={handleSnap}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/20 text-white shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95 hover:bg-white/40"
          >
            <Camera size={32} />
          </button>
        </div>
      </div>
    </div>
  );
}
