'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);

    try {
      // Simulate API call for password reset
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage('If an account exists, a reset link has been sent to your email.');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <div className="auth-card glass">
        <div className="auth-header">
          <h1 className="logo">ULTRON</h1>
          <h2 className="auth-title">Reset Access</h2>
          <p className="auth-subtitle">Recover cognitive link</p>
        </div>

        {message && (
          <div style={{ color: '#39ff14', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(57, 255, 20, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(57, 255, 20, 0.2)' }}>
            {message}
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

          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? 'PROCESSING...' : 'SEND RESET LINK'}
          </button>
        </form>

        <div className="auth-footer">
          Remember your passphrase?{' '}
          <Link className="auth-link" href="/sign-in">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
