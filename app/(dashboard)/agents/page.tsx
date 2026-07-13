'use client';
import { useState, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface Agent {
  id: string; name: string; description: string; systemPrompt: string;
  model: string; createdAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('meta/llama-3.3-70b-instruct');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;
    setSubmitting(true); setMessage('');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, systemPrompt, model }),
      });
      if (res.ok) {
        setName(''); setDescription(''); setSystemPrompt('');
        setMessage('Agent created!');
        const data = await res.json();
        if (data.agent) setAgents(prev => [...prev, data.agent]);
      } else setMessage('Failed to create agent.');
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">Gems</h1>
        <p className="subpage-description">Create and manage custom AI agents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 max-w-5xl">
        {/* Create form */}
        <div className="gemini-card">
          <h2 className="gemini-card-title">New Gem</h2>
          {message && <div className={message.includes('failed') ? 'auth-error mb-3' : 'auth-success mb-3'}>{message}</div>}
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-input" placeholder="My Agent" value={name}
                onChange={(e) => setName(e.target.value)} required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-input" placeholder="What this agent does" value={description}
                onChange={(e) => setDescription(e.target.value)} disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">System prompt</label>
              <textarea className="form-input" placeholder="You are an expert at..." value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)} rows={4} required disabled={submitting} />
            </div>
            <div className="form-group">
              <label className="form-label">Model</label>
              <select className="form-select" value={model} onChange={(e) => setModel(e.target.value)} disabled={submitting}>
                <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                <option value="nvidia/llama-3.1-nemotron-70b-instruct">Nemotron 70B</option>
                <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B</option>
              </select>
            </div>
            <button type="submit" className="auth-button" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Gem'}
            </button>
          </form>
        </div>

        {/* Agents list */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Your Gems</h2>
          {loading ? (
            <div className="flex items-center gap-3 text-muted py-12 justify-center">
              <Sparkles size={18} className="animate-spin-slow text-accent" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted border border-dashed border-border rounded-lg">
              No gems yet. Create your first one.
            </div>
          ) : (
            <div className="space-y-3">
              {agents.map((agent) => (
                <div key={agent.id} className="gemini-card" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
                      {agent.description && <p className="text-xs text-muted mt-0.5">{agent.description}</p>}
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent shrink-0">
                      {agent.model.split('/').pop()}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-muted bg-surface-2 rounded-lg p-2 max-h-16 overflow-y-auto font-mono">
                    {agent.systemPrompt}
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
