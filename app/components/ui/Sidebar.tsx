'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo, useState, useEffect } from 'react';
import AccountSettingsModal from './AccountSettingsModal';
import {
  SquarePen,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  NotebookPen,
  Settings,
  X,
  Pin,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
} from 'lucide-react';
import { useChat, type ChatSessionItem } from '@/app/components/providers/ChatProvider';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: MessageSquare },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/settings', label: 'Settings', icon: Settings },
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
  const { 
    sessionsList, 
    startNewSession, 
    loadSession, 
    deleteSession, 
    renameSession, 
    togglePinSession, 
    moveSessionToFolder, 
    sessionId 
  } = useChat();
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  
  // Modals & Search
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  // Folder states
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Inline rename states
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');

  // Load folders on mount / when session changes
  const fetchFolders = async () => {
    try {
      const res = await fetch('/api/folders');
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (session?.user) {
      void fetchFolders();
    }
  }, [session]);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName }),
      });
      if (res.ok) {
        const data = await res.json();
        setFolders(prev => [...prev, data]);
        setNewFolderName('');
        setShowFolderInput(false);
      }
    } catch (e) {
      console.error('Failed to create folder:', e);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/folders?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFolders(prev => prev.filter(f => f.id !== id));
        // Reset folderId of any sessions that were in this folder
        sessionsList.forEach(s => {
          if (s.folderId === id) {
            moveSessionToFolder(s.id, null);
          }
        });
      }
    } catch (e) {
      console.error('Failed to delete folder:', e);
    }
  };

  const handleRenameSubmit = async (id: string) => {
    if (renamingTitle.trim()) {
      await renameSession(id, renamingTitle.trim());
    }
    setRenamingId(null);
  };

  // Grouping list values
  const unifiedList = useMemo(() => {
    const combined: UnifiedItem[] = [
      ...sessionsList.map(s => ({ ...s, type: 'chat' as const }))
    ];
    combined.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return combined;
  }, [sessionsList]);

  // Apply general text search filter
  const filteredList = useMemo(() => {
    if (!historySearch.trim()) return unifiedList;
    const q = historySearch.toLowerCase();
    return unifiedList.filter(item => item.title && item.title.toLowerCase().includes(q));
  }, [unifiedList, historySearch]);

  // Filter List subsets: Pinned, Folder-contained, and Uncategorized (Root)
  const pinnedList = useMemo(() => {
    return filteredList.filter(item => item.pinned);
  }, [filteredList]);

  const uncategorizedList = useMemo(() => {
    // Return sessions that are not pinned AND do not belong to any folder
    return filteredList.filter(item => !item.pinned && !item.folderId);
  }, [filteredList]);

  const groupedRoot = useMemo(() => groupSessions(uncategorizedList), [uncategorizedList]);

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const userName = session?.user?.name || 'Commander';
  const initial = (userName || 'U').charAt(0).toUpperCase();
  const widthClass = collapsed ? 'md:w-[76px]' : 'md:w-72';

  // Render a chat item component with drag functionality and hover options
  const renderChatItem = (item: UnifiedItem) => {
    const active = item.id === sessionId;
    const isEditing = item.id === renamingId;

    return (
      <div
        key={item.id}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', item.id);
        }}
        className={[
          'gemini-history-item group flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-medium cursor-pointer',
          active ? 'bg-accent/10 text-accent' : 'hover:bg-surface-2 text-muted hover:text-foreground',
        ].join(' ')}
      >
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {isEditing ? (
            <input
              type="text"
              value={renamingTitle}
              onChange={(e) => setRenamingTitle(e.target.value)}
              onBlur={() => handleRenameSubmit(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit(item.id);
                else if (e.key === 'Escape') setRenamingId(null);
              }}
              className="w-full bg-surface-3 border border-accent/40 rounded px-1.5 py-0.5 text-xs text-foreground outline-none"
              autoFocus
            />
          ) : (
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
          )}
        </div>

        {/* Action icons (show on hover) */}
        {!isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(item.id);
                setRenamingTitle(item.title || '');
              }}
              title="Rename Chat"
              className="p-1 rounded text-muted hover:bg-surface-3 hover:text-foreground transition-all"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePinSession(item.id);
              }}
              title={item.pinned ? 'Unpin Chat' : 'Pin Chat'}
              className={[
                'p-1 rounded transition-all',
                item.pinned 
                  ? 'text-accent hover:bg-accent/15' 
                  : 'text-muted hover:bg-surface-3 hover:text-foreground'
              ].join(' ')}
            >
              <Pin size={11} className={item.pinned ? 'fill-accent' : ''} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(item.id);
              }}
              title="Delete Chat"
              className="p-1 rounded text-muted hover:bg-danger/10 hover:text-danger transition-all"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
    );
  };

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
          'gemini-sidebar border-r border-border bg-surface-1 flex flex-col h-full',
          widthClass,
          mobileOpen ? 'mobile-open' : '',
        ].join(' ')}
      >
        {/* Header */}
        <div className="gemini-sidebar-header flex items-center justify-between p-4 border-b border-border">
          {!collapsed ? (
            <span className="gemini-sidebar-brand text-xl font-bold tracking-wider text-foreground">ORION</span>
          ) : (
            <span className="gemini-sidebar-brand text-lg font-bold mx-auto text-foreground">O</span>
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

        {/* New chat & Create folder */}
        <div className="px-3 py-3 flex gap-2">
          <button
            onClick={() => {
              startNewSession();
              onCloseMobile();
              if (pathname !== '/') router.push('/');
            }}
            className="gemini-new-chat-btn flex-1 flex items-center justify-center gap-2"
          >
            <SquarePen size={16} />
            {!collapsed && <span className="font-semibold text-xs">New Chat</span>}
          </button>

          {!collapsed && (
            <button
              onClick={() => setShowFolderInput(!showFolderInput)}
              title="Create Folder"
              className="px-3 border border-border rounded-xl flex items-center justify-center text-muted hover:bg-surface-2 hover:text-foreground transition-all"
            >
              <FolderPlus size={16} />
            </button>
          )}
        </div>

        {/* Folder Creator Input Box */}
        {showFolderInput && !collapsed && (
          <form onSubmit={handleCreateFolder} className="px-3 pb-3 flex items-center gap-1">
            <input
              type="text"
              placeholder="Folder Name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="flex-1 bg-surface-2 border border-border rounded-lg px-2.5 py-1 text-xs text-foreground outline-none focus:border-accent"
              required
            />
            <button
              type="submit"
              className="p-1.5 bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowFolderInput(false)}
              className="p-1.5 border border-border text-muted rounded-lg hover:bg-surface-2 transition-all"
            >
              <X size={12} />
            </button>
          </form>
        )}

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
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="Search history..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none transition-colors focus:border-accent"
            />
          </div>
        )}

        {/* History Scroll Area */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
          {!collapsed && (
            <>
              {/* 1. PINNED CHATS SECTION */}
              {pinnedList.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-3 mb-1 text-[10px] font-bold tracking-wider text-muted uppercase">
                    <Pin size={10} className="text-accent" />
                    <span>Pinned Chats</span>
                  </div>
                  <div className="space-y-0.5">
                    {pinnedList.map(item => renderChatItem(item))}
                  </div>
                </div>
              )}


              {/* 3. FOLDERS SECTION */}
              {folders.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-3 mb-1 text-[10px] font-bold tracking-wider text-muted uppercase">
                    <Folder size={10} />
                    <span>Folders</span>
                  </div>
                  <div className="space-y-1">
                    {folders.map(folder => {
                      const isExpanded = !!expandedFolders[folder.id];
                      const folderSessions = filteredList.filter(s => s.folderId === folder.id);
                      
                      return (
                        <div
                          key={folder.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const chatId = e.dataTransfer.getData('text/plain');
                            if (chatId) moveSessionToFolder(chatId, folder.id);
                          }}
                          className="border border-border/40 rounded-xl bg-surface-2/40 p-1 transition-all"
                        >
                          <div 
                            onClick={() => toggleFolderExpand(folder.id)}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-surface-2 cursor-pointer text-xs font-semibold text-foreground"
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              {isExpanded ? <ChevronDown size={12} className="text-muted" /> : <ChevronRight size={12} className="text-muted" />}
                              <Folder size={12} className="text-accent" />
                              <span className="truncate">{folder.name}</span>
                              <span className="text-[10px] text-muted font-normal">({folderSessions.length})</span>
                            </div>
                            <button
                              onClick={(e) => handleDeleteFolder(folder.id, e)}
                              title="Delete Folder"
                              className="p-1 rounded hover:bg-danger/10 hover:text-danger text-muted transition-all"
                            >
                              <X size={10} />
                            </button>
                          </div>

                          {/* Render folder contents if expanded */}
                          {isExpanded && (
                            <div className="pl-4 pr-1 py-1 space-y-0.5 border-t border-border/20 mt-1">
                              {folderSessions.length === 0 ? (
                                <p className="text-[10px] text-muted/70 italic px-2 py-1">Drag chats here to drop inside</p>
                              ) : (
                                folderSessions.map(item => renderChatItem(item))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. ROOT UNGROUPED / REGULAR CHATS SECTION */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const chatId = e.dataTransfer.getData('text/plain');
                  if (chatId) moveSessionToFolder(chatId, null);
                }}
                className="min-h-[100px]"
              >
                {groupedRoot.length === 0 && folders.length === 0 && pinnedList.length === 0 ? (
                  <p className="px-3 py-6 text-xs text-muted text-center">
                    {historySearch ? 'No matching conversations.' : 'No conversations yet.'}
                  </p>
                ) : (
                  groupedRoot.map((group) => (
                    <div key={group.label} className="mb-4">
                      <p className="gemini-history-group-label text-[10px] font-bold text-muted uppercase tracking-wider px-3 mb-1.5">{group.label}</p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => renderChatItem(item))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Profile / Account Settings */}
        <div className="border-t border-border p-3">
          <Link
            href="/settings"
            onClick={() => {
              onCloseMobile();
            }}
            title={collapsed ? 'Settings' : undefined}
            className={[
              'gemini-nav-item w-full flex items-center justify-between gap-2.5 p-2 rounded-xl transition-all',
              collapsed ? 'justify-center px-0' : 'hover:bg-surface-2',
            ].join(' ')}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-md shadow-accent/10">
                {initial}
              </span>
              {!collapsed && (
                <span className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-sm font-medium text-foreground">{userName}</span>
                </span>
              )}
            </div>
            {!collapsed && <Settings size={15} className="shrink-0 text-muted" />}
          </Link>
        </div>
      </aside>
    </>
  );
}
