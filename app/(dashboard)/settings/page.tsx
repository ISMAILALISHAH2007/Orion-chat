'use client';
import { useState, useEffect } from 'react';

interface KeyConfig {
  id?: string;
  provider: string;
  key: string;
}

interface Profile {
  name: string;
  email: string;
  createdAt: string;
}

interface Subscription {
  tier: string;
  status: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [keys, setKeys] = useState<KeyConfig[]>([]);
  
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [inputKey, setInputKey] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setSubscription(data.subscription);
        setKeys(data.apiKeys || []);
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_key',
          provider: selectedProvider,
          key: inputKey,
        }),
      });

      if (res.ok) {
        setInputKey('');
        setMessage(`API Key saved for ${selectedProvider.toUpperCase()}`);
        fetchSettings();
      } else {
        setMessage('Failed to save API Key.');
      }
    } catch (err) {
      console.error(err);
      setMessage('Error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubscription = async (tier: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_subscription',
          tier,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
        alert(`System initialized to ${tier.toUpperCase()} tier!`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">SYSTEM CONFIGURATION</h1>
        <p className="subpage-description">Configure cognitive keys, matrix credentials, and active subscription nodes</p>
      </div>

      {loading ? (
        <div className="orb-text-state" style={{ marginTop: '4rem' }}>SCANNING CONFIG...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start' }}>
          
          {/* Left Column: API Keys & Sub */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* API Keys Configuration Card */}
            <div className="custom-card glass">
              <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                NEURAL INTEGRATION KEYS
              </h2>
              {message && (
                <div style={{ color: '#39ff14', fontSize: '0.85rem', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  {message}
                </div>
              )}
              
              <form onSubmit={handleSaveKey} className="auth-form" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Key Provider</label>
                  <select
                    className="form-input"
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    style={{ background: 'var(--input-bg)' }}
                  >
                    <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                    <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                    <option value="gemini">Google Gemini (Gemini 1.5 Pro)</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Key Passphrase</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="sk-proj-..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                
                <button type="submit" className="auth-button" disabled={submitting}>
                  {submitting ? 'COMMITTING KEY...' : 'COMMIT INTEGRATION KEY'}
                </button>
              </form>

              {/* Show active saved keys */}
              {keys.length > 0 && (
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span className="form-label" style={{ fontSize: '0.65rem' }}>ACTIVE DATABASE KEYS</span>
                  {keys.map((k) => (
                    <div key={k.provider} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-color)', textTransform: 'uppercase' }}>{k.provider}</span>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{k.key}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscription Node Card */}
            <div className="custom-card glass">
              <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                SUBSCRIPTION NODES
              </h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-color)' }}>
                    {subscription?.tier || 'free'} Matrix
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Node status: {subscription?.status || 'active'}
                  </div>
                </div>
                <div style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '12px' }}>
                  LEVEL: UP-TO-DATE
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                {['free', 'pro', 'ultra'].map((t) => (
                  <button
                    key={t}
                    onClick={() => handleUpdateSubscription(t)}
                    style={{
                      padding: '10px',
                      background: subscription?.tier === t ? 'var(--accent-color)' : 'rgba(0,0,0,0.2)',
                      color: subscription?.tier === t ? '#000' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      transition: 'var(--transition-fast)'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: User Profile & Diagnostics */}
          <div className="custom-card glass">
            <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '1px', fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              OPERATOR COMMAND DIAGNOSTICS
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="form-label">Operator Codename</span>
                <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{profile?.name}</div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="form-label">Signal Address (Email)</span>
                <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{profile?.email}</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span className="form-label">Establishment Time</span>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {profile ? new Date(profile.createdAt).toLocaleString() : ''}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                <span className="form-label">OPERATIONAL STATUS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <div className="status-dot"></div>
                  <span>NVIDIA INTEGRATION SYSTEM ONLINE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <div className="status-dot"></div>
                  <span>NEON POSTGRESQL STABLE</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                  <div className="status-dot"></div>
                  <span>VECTOR EMBEDDING INDEX STABLE (1536d)</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
