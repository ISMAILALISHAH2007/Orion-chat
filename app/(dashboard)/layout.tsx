'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import Sidebar from '@/app/components/ui/Sidebar';
import TopNav from '@/app/components/ui/TopNav';
import { ChatProvider } from '@/app/components/providers/ChatProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Gemini-style swipe to open/close sidebar
  useEffect(() => {
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Minimum swipe distance of 100px and must be mostly horizontal (1.8x horizontal than vertical)
      if (Math.abs(diffX) > 100 && Math.abs(diffX) > Math.abs(diffY) * 1.8) {
        if (diffX > 0) {
          // Swipe right - Open from anywhere
          setMobileOpen(true);
        } else {
          // Swipe left - Close from anywhere
          setMobileOpen(false);
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

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
