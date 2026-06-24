'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import Sidebar from '@/app/components/ui/Sidebar';
import TopNav from '@/app/components/ui/TopNav';
import { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)' }}>
        <div className="orb-text-state">INITIALIZING...</div>
      </div>
    );
  }
  // if (!session) redirect('/sign-in'); // Disabled temporarily so you can view the UI

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <TopNav />
        {children}
      </main>
      {/* Background glows */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>
    </div>
  );
}
