import Link from 'next/link';

export default function Sidebar() {
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
      
      <div style={{ marginTop: 'auto', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          WORKSPACE
        </div>
        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', textAlign: 'center', cursor: 'pointer' }}>
          + New Project
        </div>
      </div>
    </aside>
  );
}
