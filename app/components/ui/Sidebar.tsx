'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useMemo } from 'react';
import {
  SquarePen,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Bot,
  NotebookPen,
  ImageIcon,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import { useChat, type ChatSessionItem } from '@/app/components/providers/ChatProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: MessageSquare },
  { href: '/agents', label: 'Custom Agents', icon: Bot },
  { href: '/notes', label: 'Notes & Memory', icon: NotebookPen },
  { href: '/images', label: 'Image Generation', icon: ImageIcon },
];

function groupSessions(sessions: ChatSessionItem[]) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86400000;
  const startOf7Days = startOfToday - 7 * 86400000;

  const groups: { label: string; items: ChatSessionItem[] }[] = [
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

  const grouped = useMemo(() => groupSessions(sessionsList), [sessionsList]);

  const userName = session?.user?.name || 'Commander';
  const userEmail = session?.user?.email || '';
  const initial = (userName || 'U').charAt(0).toUpperCase();

  const widthClass = collapsed ? 'md:w-[76px]' : 'md:w-72';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-surface',
          'transition-transform duration-300 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0 md:transition-[width] md:duration-300',
          widthClass,
        ].join(' ')}
      >
        {/* Header: brand + collapse / close */}
        <div className="flex h-14 items-center justify-between px-3">
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              ULTRON
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:inline-flex"
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <button
              onClick={onCloseMobile}
              aria-label="Close sidebar"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* New chat */}
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              startNewSession();
              onCloseMobile();
            }}
            className={[
              'flex w-full items-center rounded-lg border border-border bg-transparent py-2.5 text-sm font-medium text-foreground transition-all hover:bg-surface-2',
              collapsed ? 'md:justify-center md:px-0' : 'justify-between px-3',
            ].join(' ')}
          >
            <span className="flex items-center gap-2">
              <SquarePen size={18} className="shrink-0" />
              {!collapsed && <span>New chat</span>}
            </span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-3 py-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  collapsed ? 'md:justify-center md:px-0' : '',
                  active
                    ? 'bg-surface-2 font-medium text-foreground'
                    : 'text-muted hover:bg-surface-2 hover:text-foreground',
                ].join(' ')}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* History */}
        <div className="mt-1 flex-1 overflow-y-auto px-3 py-2">
          {!collapsed &&
            (grouped.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted">No conversations yet.</p>
            ) : (
              grouped.map((group) => (
                <div key={group.label} className="mb-4">
                  <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = item.id === sessionId;
                      return (
                        <div
                          key={item.id}
                          className={[
                            'group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors',
                            active
                              ? 'bg-surface-2 text-foreground'
                              : 'text-muted hover:bg-surface-2 hover:text-foreground',
                          ].join(' ')}
                        >
                          <button
                            onClick={() => {
                              loadSession(item.id);
                              onCloseMobile();
                            }}
                            className="flex-1 truncate text-left"
                          >
                            {item.title || 'New conversation'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSession(item.id);
                            }}
                            aria-label="Delete conversation"
                            className="shrink-0 rounded p-1 text-muted opacity-0 transition-all hover:text-danger group-hover:opacity-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ))}
        </div>

        {/* Profile + settings */}
        <div className="border-t border-border p-3">
          <Link
            href="/settings"
            onClick={onCloseMobile}
            title={collapsed ? 'Settings' : undefined}
            className={[
              'flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2',
              collapsed ? 'md:justify-center' : '',
            ].join(' ')}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
              {initial}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {userName}
                </span>
                <span className="block truncate text-xs text-muted">{userEmail}</span>
              </span>
            )}
            {!collapsed && <Settings size={16} className="shrink-0 text-muted" />}
          </Link>
          {!collapsed && (
            <button
              onClick={() => signOut()}
              className="mt-1 flex w-full items-center gap-3 rounded-lg p-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut size={16} className="shrink-0" />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
