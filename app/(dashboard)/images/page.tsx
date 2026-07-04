'use client';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ArrowUp, Sparkles, Download, Image as ImageIcon } from 'lucide-react';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

function ImageItem({ img, onDownload }: { img: GeneratedImage; onDownload: (url: string, prompt: string) => void }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="flex animate-fade-in-up flex-col items-center w-full">
      <div className="w-full text-center text-sm font-medium text-foreground mb-4">
        &ldquo;{img.prompt}&rdquo;
      </div>
      <div className="group relative overflow-hidden rounded-2xl border border-border shadow-sm transition-all hover:shadow-md max-w-[512px] w-full bg-surface-2 aspect-square flex items-center justify-center">
        
        {/* Loading Skeleton */}
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-2 gap-4">
            <span className="flex h-12 w-12 shrink-0 animate-pulse items-center justify-center rounded-full border border-border bg-surface shadow-sm">
              <Sparkles size={24} className="text-accent" />
            </span>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-widest text-muted animate-pulse">
                Synthesizing Visual Matrix
              </span>
              <span className="thinking-dots opacity-50" aria-label="Loading">
                <span></span><span></span><span></span>
              </span>
            </div>
          </div>
        )}

        {/* Actual Image */}
        <Image
          src={img.imageUrl}
          alt={img.prompt}
          width={512}
          height={512}
          className={`h-auto w-full object-cover transition-opacity duration-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          unoptimized
        />
        
        {/* Hover Overlay with Download */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onDownload(img.imageUrl, img.prompt)}
            className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-medium text-black shadow-xl transition-transform hover:scale-105 active:scale-95"
          >
            <Download size={18} />
            Save Image
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ImagesPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/images');
      if (res.ok) {
        const data = await res.json();
        setImages(Array.isArray(data) ? data.reverse() : []); // newest at bottom
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    fetchImages();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [images, generating]);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, [prompt]);

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;

    const currentPrompt = prompt.trim();
    setPrompt('');
    setGenerating(true);

    try {
      const seed = Math.floor(Math.random() * 1000000);
      const generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(currentPrompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

      // Save to DB
      const saveRes = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt, imageUrl: generatedUrl }),
      });

      if (saveRes.ok) {
        const data = await saveRes.json();
        setImages((prev) => [...prev, data]);
        window.dispatchEvent(new Event('images-updated'));
      }
    } catch (err) {
      console.error('Image generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const downloadImage = async (url: string, promptText: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ultron-image-${promptText.replace(/\s+/g, '-').slice(0, 30)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Failed to download image', error);
      // Fallback
      window.open(url, '_blank');
    }
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-background">
      {/* Scrollable Image Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-12">
          
          {loading ? (
            <div className="flex h-full items-center justify-center py-20 text-muted">
              Loading image archive...
            </div>
          ) : images.length === 0 && !generating ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
              <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-muted">
                <ImageIcon size={32} />
              </span>
              <h2 className="font-display text-xl font-semibold text-foreground">Imaging Laboratory</h2>
              <p className="mt-2 text-sm text-muted max-w-md">
                Describe any scene or concept, and ULTRON will synthesize a high-resolution visual projection.
              </p>
            </div>
          ) : (
            images.map((img) => (
              <ImageItem key={img.id} img={img} onDownload={downloadImage} />
            ))
          )}

          {/* Loading Indicator */}
          {generating && (
            <div className="flex animate-fade-in flex-col items-center gap-4 py-8">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Sparkles size={16} className="text-accent" />
                </span>
                <span className="thinking-dots" aria-label="Synthesizing image">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
              <p className="text-xs font-medium text-muted uppercase tracking-widest">Synthesizing visual matrix</p>
            </div>
          )}
          <div ref={scrollRef} className="h-4 w-full" />
        </div>
      </div>

      {/* Docked Input Box */}
      <div className="px-4 pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm transition-all focus-within:border-accent focus-within:ring-2 focus-within:ring-[var(--accent-soft)]">
            <textarea
              ref={textareaRef}
              value={prompt}
              rows={1}
              placeholder="Describe the image you want to create..."
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={generating}
              className="max-h-[200px] w-full resize-none bg-transparent px-3 py-2 text-base leading-relaxed text-foreground outline-none placeholder:text-muted disabled:opacity-60"
            />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-widest text-muted">
                <span className="px-2">Imaging Mode</span>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!prompt.trim() || generating}
                aria-label="Generate Image"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-muted">
            High-resolution visual synthesis powered by neural generation.
          </p>
        </div>
      </div>
    </section>
  );
}
