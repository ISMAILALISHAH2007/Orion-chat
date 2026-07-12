'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError(null); setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Registration failed.');
      else { setSuccess(true); setTimeout(() => router.push('/sign-in'), 1500); }
    } catch { setError('An unexpected error occurred.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo flex items-center justify-center gap-2">
            <Sparkles size={22} className="text-accent" /> ULTRON
          </div>
          <h2 className="auth-title">Create account</h2>
          <p className="auth-subtitle">Get started with ULTRON</p>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">Account created! Redirecting to sign in...</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Name</label>
            <input className="form-input" id="name" type="text" placeholder="Your name" value={name}
              onChange={(e) => setName(e.target.value)} disabled={loading || success} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input className="form-input" id="email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={loading || success} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input className="form-input" id="password" type={showPassword ? 'text' : 'password'}
                placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                required disabled={loading || success} style={{ paddingRight: '60px' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px' }}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button className="auth-button" type="submit" disabled={loading || success}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link className="auth-link" href="/sign-in">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
