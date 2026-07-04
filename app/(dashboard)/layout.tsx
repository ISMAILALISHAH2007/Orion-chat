'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState } from 'react';
import Sidebar from '@/app/components/ui/Sidebar';
import TopNav from '@/app/components/ui/TopNav';
import { ChatProvider } from '@/app/components/providers/ChatProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (status === 'loading') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted">
          <span className="thinking-dots" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span className="orb-text-state">Initializing</span>
        </div>
      </div>
    );
  }

  if (!session) redirect('/sign-in');

  return (
    <ChatProvider>
      <div className="flex h-[100dvh] w-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav onOpenSidebar={() => setMobileOpen(true)} />
          {children}
        </div>
      </div>
    </ChatProvider>
  );
}
