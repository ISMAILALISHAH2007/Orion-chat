'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import AccountSettingsModal from './AccountSettingsModal';
import {
  SquarePen,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Bot,
  NotebookPen,
  Settings,
  X,
  Menu,
  Sparkles,
} from 'lucide-react';
import { useChat, type ChatSessionItem } from '@/app/components/providers/ChatProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Gems', icon: Bot },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
];

type UnifiedItem = ChatSessionItem & { type: 'chat' | 'image' };

function groupSessions(sessions: UnifiedItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 7 * 86400000;

  const groups: { label: string; items: UnifiedItem[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Previous 7 Days', items: [] },
    { label: 'Older', items: [] },
  ];

  for (const s of sessions) {
    const t = new Date(s.updatedAt).getTime();
    if (Number.isNaN(t) || t >= startOfToday) groups[0].items.push(s);
    else if (t >= startOfYesterday) groups[1].items.push(s);
    else if (t >= startOf7Days) groups[2].items.push(s);
    else groups[3].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { sessionsList, startNewSession, loadSession, deleteSession, sessionId } = useChat();
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const unifiedList = useMemo(() => {
    const combined: UnifiedItem[] = [
      ...sessionsList.map(s => ({ ...s, type: 'chat' as const }))
    ];
    combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return combined;
  }, [sessionsList]);

  const filteredList = useMemo(() => {
    if (!historySearch.trim()) return unifiedList;
    const q = historySearch.toLowerCase();
    return unifiedList.filter(item => item.title.toLowerCase().includes(q));
  }, [unifiedList, historySearch]);

  const grouped = useMemo(() => groupSessions(filteredList), [filteredList]);

  const userName = session?.user?.name || 'Commander';
  const userEmail = session?.user?.email || '';
  const initial = (userName || 'U').charAt(0).toUpperCase();

  return (
    <>
      {showAccountModal && <AccountSettingsModal onClose={() => setShowAccountModal(false)} />}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in md:hidden"
        />
      )}

      <aside
        className={[
          'gemini-sidebar',
          collapsed ? 'collapsed' : '',
          mobileOpen ? 'mobile-open' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="gemini-sidebar-header">
          {!collapsed && (
            <span className="gemini-sidebar-brand">ULTRON</span>
          )}
          {collapsed && (
            <span className="gemini-sidebar-brand text-lg mx-auto">U</span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <button
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-full text-muted hover:bg-surface-2 hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pb-3">
          <button
            onClick={() => {
              startNewSession();
              onCloseMobile();
              if (pathname !== '/') router.push('/');
            }}
            className="gemini-new-chat-btn"
          >
            <SquarePen size={16} />
            {!collapsed && <span>New chat</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 pb-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={[
                  'gemini-nav-item',
                  active ? 'active' : '',
                  collapsed ? 'justify-center px-0' : '',
                ].join(' ')}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* History search */}
        {!collapsed && (
          <div className="px-3 pb-1">
            <input
              type="text"
              placeholder="Search history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-full px-3 py-1.5 text-xs text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent"
            />
          </div>
        )}

        {/* History */}
        <div className="flex-1 overflow-y-auto px-3 py-1">
          {!collapsed &&
            (grouped.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted text-center">
                {historySearch ? 'No matching conversations.' : 'No conversations yet.'}
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="gemini-history-group-label">{group.label}</p>
                  {group.items.map((item) => {
                    const active = item.id === sessionId;
                    return (
                      <div
                        key={item.id}
                        className={[
                          'gemini-history-item group',
                          active ? 'active' : '',
                        ].join(' ')}
                      >
                        <button
                          onClick={() => {
                            onCloseMobile();
                            loadSession(item.id);
                            if (pathname !== '/') router.push('/');
                          }}
                          className="flex-1 truncate text-left"
                          title={item.title}
                        >
                          <span className="truncate">{item.title || 'New conversation'}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(item.id);
                          }}
                          aria-label="Delete item"
                          className="shrink-0 rounded-full p-1 text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            ))}
        </div>

        {/* Profile */}
        <div className="border-t border-border p-3">
          <button
            onClick={() => {
              onCloseMobile();
              setShowAccountModal(true);
            }}
            title={collapsed ? 'Settings' : undefined}
            className={[
              'gemini-nav-item w-full',
              collapsed ? 'justify-center px-0' : '',
            ].join(' ')}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initial}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-foreground">{userName}</span>
              </span>
            )}
            {!collapsed && <Settings size={15} className="shrink-0 text-muted" />}
          </button>
        </div>
      </aside>
    </>
  );
}
