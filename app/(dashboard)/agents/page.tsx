'use client';
import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  createdAt: string;
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

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot data fetch on mount
    fetchAgents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, systemPrompt, model }),
      });

      if (res.ok) {
        setName('');
        setDescription('');
        setSystemPrompt('');
        setMessage('Agent compiled successfully!');
        fetchAgents();
      } else {
        setMessage('Failed to compile agent.');
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
        <h1 className="subpage-title">COGNITIVE AGENTS</h1>
        <p className="subpage-description">Design and compile customized neural matrices</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
        {/* Spawn Card Form */}
        <div className="custom-card glass">
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            SPAWN NEURAL AGENT
          </h2>
          {message && (
            <div style={{ color: message.includes('success') ? '#39ff14' : '#ff4a4a', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {message}
            </div>
          )}
          <form onSubmit={handleCreate} className="auth-form" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Agent Codename</label>
              <input
                type="text"
                className="form-input"
                placeholder="JARVIS"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Matrix Description</label>
              <input
                type="text"
                className="form-input"
                placeholder="Developer intelligence unit"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Core Prompt (System Directive)</label>
              <textarea
                className="form-input"
                placeholder="You are an expert coder. Focus on clean solutions..."
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={4}
                style={{ resize: 'none', borderRadius: 'var(--radius-sm)' }}
                required
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Base Cognitive Model</label>
              <select
                className="form-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={submitting}
                style={{ background: 'var(--input-bg)' }}
              >
                <option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B (High Intelligence)</option>
                <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B</option>
                <option value="meta/llama-3.1-8b-instruct">Llama 3.1 8B (Sub-nanosecond Latency)</option>
              </select>
            </div>
            <button type="submit" className="auth-button" disabled={submitting}>
              {submitting ? 'COMPILING AGENT...' : 'COMPILE MATRIX'}
            </button>
          </form>
        </div>

        {/* Existing Matrix Card List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem' }}>
            ACTIVE COGNITIVE CORES
          </h2>
          {loading ? (
            <div className="orb-text-state" style={{ marginTop: '2rem' }}>SCANNING CORES...</div>
          ) : agents.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              No custom neural matrices initialized.
            </div>
          ) : (
            agents.map((agent) => (
              <div key={agent.id} className="custom-card glass" style={{ borderLeft: '4px solid var(--accent-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{agent.name}</h3>
                  <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--accent-color)' }}>
                    {agent.model.split('/').pop()}
                  </span>
                </div>
                {agent.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{agent.description}</p>}
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                  {agent.systemPrompt}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
                  INITIALIZED: {new Date(agent.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
