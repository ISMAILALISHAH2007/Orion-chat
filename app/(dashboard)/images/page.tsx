'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Sparkles, 
  Search, 
  Download, 
  Trash2, 
  X, 
  Clock,
  Check,
} from 'lucide-react';

interface GalleryImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

function groupByDate(images: GalleryImage[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 7 * 86400000;

  const groups: { label: string; items: GalleryImage[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const img of images) {
    const t = new Date(img.createdAt).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= startOfToday) groups[0].items.push(img);
    else if (t >= startOfYesterday) groups[1].items.push(img);
    else if (t >= startOf7Days) groups[2].items.push(img);
    else groups[3].items.push(img);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ImageGalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [fullScreenPrompt, setFullScreenPrompt] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [numColumns, setNumColumns] = useState(3);
  const isFirstRenderRef = useRef(true);

  // Responsive columns
  useEffect(() => {
    const updateColumns = () => {
      const w = window.innerWidth;
      if (w < 640) setNumColumns(1);
      else if (w < 900) setNumColumns(2);
      else if (w < 1200) setNumColumns(3);
      else setNumColumns(4);
    };
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const handleDownload = async (imageUrl: string, prompt: string) => {
    try {
      const res = await fetch(`/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(prompt.substring(0, 30))}.jpg`);
      const blob = await res.blob();
      
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0);
        const fontSize = Math.max(20, Math.floor(img.width * 0.03));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.textAlign = 'right';
        ctx.fillText('⚡ ORION AI', img.width - 20, img.height - 24);
        
        canvas.toBlob((watermarkedBlob) => {
          if (!watermarkedBlob) return;
          const downloadUrl = URL.createObjectURL(watermarkedBlob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `orion-${prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
          a.click();
          URL.revokeObjectURL(downloadUrl);
          URL.revokeObjectURL(objectUrl);
          showToast('Image downloaded!', 'success');
        }, 'image/jpeg', 0.95);
      };
      img.src = objectUrl;
    } catch {
      window.open(imageUrl, '_blank');
      showToast('Opened in new tab', 'success');
    }
  };

  const fetchImages = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search?.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/images?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();

    // Listen for new images being generated
    const handler = () => {
      fetchImages(searchQuery);
    };
    window.addEventListener('images-updated', handler);
    return () => window.removeEventListener('images-updated', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search — skip first render to avoid duplicate mount fetch
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      fetchImages(searchQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, fetchImages]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/images?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setImages(prev => prev.filter(img => img.id !== id));
        showToast('Image deleted', 'success');
      } else {
        showToast('Failed to delete', 'error');
      }
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  };

  // Filter images by search
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const q = searchQuery.toLowerCase();
    return images.filter(img => img.prompt.toLowerCase().includes(q));
  }, [images, searchQuery]);

  // Helper: distribute images into masonry columns
  const buildMasonryColumns = useCallback((items: GalleryImage[]) => {
    const cols: GalleryImage[][] = Array.from({ length: numColumns }, () => []);
    items.forEach((img, i) => {
      cols[i % numColumns].push(img);
    });
    return cols;
  }, [numColumns]);

  const groupedImages = useMemo(() => groupByDate(filteredImages), [filteredImages]);

  const totalImages = images.length;

  return (
    <div className="dashboard-subpage overflow-y-auto max-h-full pb-12">
      {/* Header */}
      <div className="subpage-header flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="subpage-title flex items-center gap-2">
            <ImageIcon className="text-accent" size={24} />
            <span>Image Gallery</span>
            {!loading && (
              <span className="ml-2 text-sm font-normal text-muted bg-surface-2 border border-border px-2.5 py-0.5 rounded-full">
                {totalImages} {totalImages === 1 ? 'image' : 'images'}
              </span>
            )}
          </h1>
          <p className="subpage-description">All your AI-generated images in one place.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input
          type="text"
          placeholder="Search by prompt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_2px_var(--accent-soft)]"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center gap-3 text-muted py-24">
            <Sparkles size={20} className="animate-spin-slow text-accent" />
            <span className="text-sm">Loading gallery...</span>
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
              <ImageIcon size={28} className="text-muted" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {searchQuery ? 'No images match your search' : 'No images yet'}
            </p>
            <p className="text-xs text-muted max-w-xs">
              {searchQuery 
                ? 'Try a different search term.' 
                : 'Generate an image using /img command in the chat or enable Image Mode.'}
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {groupedImages.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={14} className="text-muted" />
                  <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                  <span className="text-[11px] text-muted bg-surface-2 px-2 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                </div>

                {/* Masonry Grid — computed per group for proper alignment */}
                <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
                  {buildMasonryColumns(group.items).map((col, colIdx) => {
                    if (col.length === 0) return null;
                    
                    return (
                      <div key={colIdx} className="flex-1 flex flex-col gap-4 min-w-0">
                        {col.map((img) => (
                          <div
                            key={img.id}
                            className="group relative rounded-xl overflow-hidden border border-border bg-surface shadow-sm hover:shadow-lg hover:border-accent/30 transition-all duration-300"
                          >
                            {/* Image */}
                            <div
                              className="relative w-full cursor-pointer overflow-hidden bg-surface-2"
                              style={{ minHeight: '160px' }}
                              onClick={() => {
                                setFullScreenImage(img.imageUrl);
                                setFullScreenPrompt(img.prompt);
                              }}
                            >
                              <img
                                src={img.imageUrl}
                                alt={img.prompt}
                                className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<div class="flex items-center justify-center h-40 text-xs text-muted">Image unavailable</div>`;
                                  }
                                }}
                              />
                              
                              {/* Hover overlay with actions */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-3 gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownload(img.imageUrl, img.prompt);
                                  }}
                                  className="p-2 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all hover:scale-105 active:scale-95"
                                  title="Download"
                                >
                                  <Download size={14} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(img.id);
                                  }}
                                  disabled={deleting === img.id}
                                  className="p-2 rounded-lg bg-white/20 backdrop-blur-md text-white hover:bg-red-500/60 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deleting === img.id ? (
                                    <Sparkles size={14} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Card Footer */}
                            <div className="p-3 border-t border-border/50">
                              <p className="text-xs text-foreground leading-relaxed line-clamp-2 mb-2">
                                {img.prompt}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-muted">
                                  {new Date(img.createdAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                                <div className="flex items-center gap-1 md:hidden">
                                  <button
                                    onClick={() => handleDownload(img.imageUrl, img.prompt)}
                                    className="p-1.5 rounded-md text-muted hover:text-accent hover:bg-surface-2 transition"
                                    title="Download"
                                  >
                                    <Download size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(img.id)}
                                    disabled={deleting === img.id}
                                    className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition disabled:opacity-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Overlay */}
      {fullScreenImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-8 animate-fade-in"
          onClick={() => {
            setFullScreenImage(null);
            setFullScreenPrompt('');
          }}
        >
          <div className="relative max-h-full max-w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullScreenImage}
              alt={fullScreenPrompt}
              className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            {fullScreenPrompt && (
              <p className="text-sm text-white/70 text-center max-w-lg px-4 line-clamp-2">
                {fullScreenPrompt}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              setFullScreenImage(null);
              setFullScreenPrompt('');
            }}
            className="absolute top-4 sm:top-8 right-4 sm:right-8 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 p-2.5 sm:p-3 rounded-full transition border border-white/10"
          >
            <X size={20} />
          </button>

          {/* Download button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(fullScreenImage, fullScreenPrompt);
            }}
            className="absolute bottom-6 sm:bottom-10 right-6 sm:right-10 bg-accent text-accent-foreground font-bold px-5 py-3 rounded-full hover:bg-accent-hover hover:scale-105 active:scale-95 transition shadow-[0_0_30px_rgba(var(--accent),0.3)] flex items-center gap-2"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-fade-in-up">
          <div
            className={[
              'flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-md border',
              toast.type === 'success'
                ? 'bg-green-500/15 text-green-400 border-green-500/20'
                : 'bg-red-500/15 text-red-400 border-red-500/20',
            ].join(' ')}
          >
            {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
