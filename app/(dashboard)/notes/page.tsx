'use client';
import { useState, useEffect } from 'react';
import { NotebookPen, Sparkles, Trash2 } from 'lucide-react';

interface Memory { id: string; content: string; createdAt: string; }

export default function NotesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/memory');
        if (res.ok) { const data = await res.json(); setMemories(data.memories || []); }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true); setMessage('');
    try {
      const res = await fetch('/api/memory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setContent(''); setMessage('Memory saved!');
        const data = await res.json();
        if (data.memory) setMemories(prev => [data.memory, ...prev]);
      } else setMessage('Failed to save memory.');
    } catch {} finally { setSubmitting(false); }
  };

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memory?id=${id}`, { method: 'DELETE' });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch {}
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">Notes & Memory</h1>
        <p className="subpage-description">Save information ULTRON can reference across conversations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 max-w-5xl">
        {/* Save form */}
        <div className="gemini-card">
          <h2 className="gemini-card-title">Save a note</h2>
          {message && <div className={message.includes('failed') ? 'auth-error mb-3' : 'auth-success mb-3'}>{message}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Memory content</label>
              <textarea className="form-input" placeholder="Remember that I prefer concise answers..." value={content}
                onChange={(e) => setContent(e.target.value)} rows={5} required disabled={submitting} />
            </div>
            <button type="submit" className="auth-button" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save to memory'}
            </button>
          </form>
        </div>

        {/* Memories list */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Saved memories</h2>
          {loading ? (
            <div className="flex items-center gap-3 text-muted py-12 justify-center">
              <Sparkles size={18} className="animate-spin-slow text-accent" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : memories.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-lg">
              No memories saved yet. Add a note on the left.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {memories.map((mem) => (
                <div key={mem.id} className="gemini-card relative group" style={{ borderLeft: '3px solid var(--gemini-purple)' }}>
                  <p className="text-sm leading-relaxed pr-8">{mem.content}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-muted">{new Date(mem.createdAt).toLocaleDateString()}</span>
                    <button onClick={() => deleteMemory(mem.id)}
                      className="gemini-icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={13} className="text-danger" />
                    </button>
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
