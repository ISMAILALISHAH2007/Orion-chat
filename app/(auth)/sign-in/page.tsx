'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError(null);
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid email or password.');
      } else {
        router.push('/');
        router.refresh();
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
          <h2 className="auth-title">Welcome Back</h2>
          <p className="auth-subtitle">Initialize cognitive systems</p>
        </div>

        {error && (
          <div style={{ color: '#ff4a4a', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(255, 74, 74, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 74, 74, 0.2)' }}>
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? 'INITIALIZING...' : 'INITIALIZE'}
          </button>
        </form>

        <div className="auth-footer">
          <Link className="auth-link" href="/forgot-password" style={{ display: 'block', marginBottom: '10px' }}>
            Forgot Passphrase?
          </Link>
          <button 
            type="button" 
            className="auth-button" 
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)', marginBottom: '15px', width: '100%' }}
            onClick={() => signIn('google', { callbackUrl: '/' })}
          >
            Authenticate via Google
          </button>
          Don't have an operator profile?{' '}
          <Link className="auth-link" href="/sign-up">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
}
