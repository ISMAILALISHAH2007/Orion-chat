'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setMessage('If an account exists, a reset link has been sent.');
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo flex items-center justify-center gap-2">
            <Sparkles size={22} className="text-accent" /> ORION
          </div>
          <h2 className="auth-title">Reset password</h2>
          <p className="auth-subtitle">Enter your email to receive a reset link</p>
        </div>

        {message && <div className="auth-success">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input className="form-input" id="email" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required disabled={loading} />
          </div>
          <button className="auth-button" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-footer">
          Remember your password? <Link className="auth-link" href="/sign-in">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
