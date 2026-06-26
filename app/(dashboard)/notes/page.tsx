'use client';
import { useState, useEffect } from 'react';

interface Memory {
  id: string;
  content: string;
  createdAt: string;
}

export default function NotesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchMemories();
  }, []);

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        setContent('');
        setMessage('Memory recorded successfully.');
        fetchMemories();
      } else {
        setMessage('Failed to record memory.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">MEMORY MATRIX</h1>
        <p className="subpage-description">Manage and index persistent cognitive context</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2.5rem', alignItems: 'start' }}>
        {/* Record Memory Form */}
        <div className="custom-card glass">
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            RECORD NEW FACT
          </h2>
          {message && (
            <div style={{ color: '#39ff14', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {message}
            </div>
          )}
          <form onSubmit={handleSubmit} className="auth-form" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Context Content</label>
              <textarea
                className="form-input"
                placeholder="Operator prefers TypeScript over Python for machine learning workflows. Address operator as Captain."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                style={{ resize: 'none', borderRadius: 'var(--radius-sm)' }}
                required
                disabled={submitting}
              />
            </div>
            <button type="submit" className="auth-button" disabled={submitting}>
              {submitting ? 'COMMITTING TO VECTOR DB...' : 'RECORD MEMORY'}
            </button>
          </form>
        </div>

        {/* Existing Memories List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem' }}>
            STORED MEMORIES
          </h2>
          {loading ? (
            <div className="orb-text-state" style={{ marginTop: '2rem' }}>INDEXING DATABASE...</div>
          ) : memories.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No memories recorded in the cognitive database. Add a fact on the left to test.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {memories.map((mem) => (
                <div key={mem.id} className="custom-card glass" style={{ borderLeft: '2px solid var(--accent-secondary)' }}>
                  <p style={{ fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>{mem.content}</p>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', alignSelf: 'flex-end', marginTop: '0.5rem' }}>
                    STORED: {new Date(mem.createdAt).toLocaleDateString()} {new Date(mem.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
