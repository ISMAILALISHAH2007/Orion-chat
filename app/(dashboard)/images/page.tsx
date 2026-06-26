'use client';
import { useState, useEffect } from 'react';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
}

export default function ImagesPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await fetch('/api/images');
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch (err) {
      console.error('Failed to fetch images:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setGenerating(true);
    setMessage('');
    setCurrentImage(null);

    try {
      // Create a unique seed to avoid browser caching of Pollinations AI image
      const seed = Math.floor(Math.random() * 1000000);
      const generatedUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}`;

      // Preload image in background
      const img = new Image();
      img.src = generatedUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      setCurrentImage(generatedUrl);

      // Save to database
      const saveRes = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageUrl: generatedUrl }),
      });

      if (saveRes.ok) {
        setMessage('Image generated and saved to neural archive.');
        fetchImages();
      }
    } catch (err) {
      console.error(err);
      setMessage('Failed to render holographic matrix.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">IMAGING LABORATORY</h1>
        <p className="subpage-description">Generate visual projections from textual directives</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
        {/* Left Side: Generator & Active Image */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="custom-card glass">
            <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              VISUALIZER MATRIX
            </h2>
            {message && (
              <div style={{ color: '#39ff14', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                {message}
              </div>
            )}
            <form onSubmit={handleGenerate} className="auth-form" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Image Directive Prompt</label>
                <textarea
                  className="form-input"
                  placeholder="A futuristic holographic workspace in cyberpunk styling, glowing blue and purple arrays, photorealistic..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  style={{ resize: 'none', borderRadius: 'var(--radius-sm)' }}
                  required
                  disabled={generating}
                />
              </div>
              <button type="submit" className="auth-button" disabled={generating}>
                {generating ? 'PROJECTIONS RENDERING...' : 'RENDER IMAGING'}
              </button>
            </form>
          </div>

          {/* Active Image Display */}
          {(generating || currentImage) && (
            <div className="custom-card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', position: 'relative', overflow: 'hidden' }}>
              {generating ? (
                <div style={{ textAlign: 'center' }}>
                  <div className="status-dot" style={{ margin: '0 auto 1rem', width: '12px', height: '12px' }}></div>
                  <div className="orb-text-state">ASSEMBLING RASTER ARRAY...</div>
                </div>
              ) : (
                currentImage && (
                  <img
                    src={currentImage}
                    alt="Active neural projection"
                    style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Right Side: Archive Gallery */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem' }}>
            PROJECTED GALLERY ARCHIVES
          </h2>
          {loading ? (
            <div className="orb-text-state" style={{ marginTop: '2rem' }}>SYNCHRONIZING ARCHIVES...</div>
          ) : images.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              Neural image gallery is empty. Generate an image on the left.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {images.map((img) => (
                <div key={img.id} className="custom-card glass" style={{ padding: '0.5rem', gap: '0.5rem', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={img.imageUrl}
                    alt={img.prompt}
                    style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-sm)', objectFit: 'cover' }}
                  />
                  <div style={{ padding: '0.5rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-main)', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {img.prompt}
                    </p>
                    <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      {new Date(img.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
