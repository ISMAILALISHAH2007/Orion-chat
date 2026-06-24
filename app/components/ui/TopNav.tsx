'use client';
import { useMode } from '@/app/components/providers/ThemeProvider';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

export default function TopNav() {
  const { mode, setMode } = useMode();
  const [status, setStatus] = useState('SYSTEM STANDBY');

  const modes = ['casual', 'developer', 'research', 'professional'];

  return (
    <header className="top-nav glass">
      <div className="nav-left">
        <button
          id="toggle-sidebar"
          className="btn-icon"
          onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <div className="status-indicator">
          <span className="status-dot"></span>
          <span id="status-text">{status}</span>
        </div>
        <button
          onClick={() => signOut()}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
            padding: '4px 14px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            transition: 'var(--transition-fast)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-color)')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
        >
          Sign Out
        </button>
      </div>
      <div className="modes-bar">
        {modes.map((m) => (
          <button
            key={m}
            className={`mode-tab ${mode === m ? 'active' : ''}`}
            data-mode={m}
            onClick={() => setMode(m)}
          >
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>
    </header>
  );
}
