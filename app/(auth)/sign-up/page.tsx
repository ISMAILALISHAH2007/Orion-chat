'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed.');
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/sign-in');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Background Glows */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <div className="auth-card glass">
        <div className="auth-header">
          <h1 className="logo">ULTRON</h1>
          <h2 className="auth-title">Register Profile</h2>
          <p className="auth-subtitle">Establish cognitive command</p>
        </div>

        {error && (
          <div style={{ color: '#ff4a4a', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255, 74, 74, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 74, 74, 0.2)' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ color: '#39ff14', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(57, 255, 20, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(57, 255, 20, 0.2)' }}>
            Profile Registered! Transferring to terminal...
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Operator Name</label>
            <input
              className="form-input"
              id="name"
              type="text"
              placeholder="Owais"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading || success}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              className="form-input"
              id="email"
              type="email"
              placeholder="operator@ultron.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading || success}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Passphrase</label>
            <input
              className="form-input"
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading || success}
            />
          </div>

          <button className="auth-button" type="submit" disabled={loading || success}>
            {loading ? 'ESTABLISHING...' : 'ESTABLISH'}
          </button>
        </form>

        <div className="auth-footer">
          Already registered?{' '}
          <Link className="auth-link" href="/sign-in">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
