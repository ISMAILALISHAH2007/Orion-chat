import Link from 'next/link';
import { useChat } from '@/app/components/providers/ChatProvider';

export default function Sidebar() {
  const { sessionsList, startNewSession, loadSession, deleteSession, sessionId } = useChat();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="logo">ULTRON</h1>
        <span className="version">v2.0</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <Link href="/" style={{ color: 'var(--text-main)', textDecoration: 'none' }}>
          <div style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
            💬 Chat
          </div>
        </Link>
        <Link href="/agents" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          <div style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}>
            🤖 Custom Agents
          </div>
        </Link>
        <Link href="/notes" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          <div style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}>
            📝 Notes & Memory
          </div>
        </Link>
        <Link href="/images" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          <div style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}>
            🎨 Image Generation
          </div>
        </Link>
        <Link href="/settings" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
          <div style={{ padding: '0.8rem', borderRadius: 'var(--radius-sm)', transition: 'var(--transition-fast)' }}>
            ⚙️ Settings
          </div>
        </Link>
      </nav>
      
      <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          MEMORY BANKS
        </div>
        
        {sessionsList.map(sessionItem => (
          <div 
            key={sessionItem.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem',
              background: sessionItem.id === sessionId ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid transparent',
              borderColor: sessionItem.id === sessionId ? 'var(--accent-color)' : 'transparent',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
          >
            <div 
              onClick={() => loadSession(sessionItem.id)}
              style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}
            >
              {sessionItem.title || 'Conversation'}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); deleteSession(sessionItem.id); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
                opacity: 0.6
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              aria-label="Delete chat"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
            </button>
          </div>
        ))}

        <div 
          onClick={startNewSession}
          style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', textAlign: 'center', cursor: 'pointer' }}
        >
          + New Project
        </div>
      </div>
    </aside>
  );
}
