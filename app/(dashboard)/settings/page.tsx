'use client';
import { useState, useEffect } from 'react';
import { Settings, Sparkles } from 'lucide-react';

interface Profile { name: string; email: string; createdAt: string; }
interface Subscription { tier: string; status: string; }

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setSubscription(data.subscription);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleUpdateSubscription = async (tier: string) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_subscription', tier }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch {}
  };

  return (
    <div className="dashboard-subpage">
      <div className="subpage-header">
        <h1 className="subpage-title">Settings</h1>
        <p className="subpage-description">Manage your account and subscription</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted py-12 justify-center">
          <Sparkles size={18} className="animate-spin-slow text-accent" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : (
        <div className="gemini-grid" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: '800px' }}>
          {/* Profile */}
          <div className="gemini-card">
            <h2 className="gemini-card-title">Profile</h2>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-muted block mb-1">Name</span>
                <span className="text-sm font-medium">{profile?.name}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-1">Email</span>
                <span className="text-sm">{profile?.email}</span>
              </div>
              {profile?.createdAt && (
                <div>
                  <span className="text-xs text-muted block mb-1">Member since</span>
                  <span className="text-sm text-muted">{new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Subscription */}
          <div className="gemini-card">
            <h2 className="gemini-card-title">Subscription</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{subscription?.tier || 'Free'} plan</span>
                <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent capitalize">{subscription?.status || 'active'}</span>
              </div>
              <div className="flex gap-2">
                {['free', 'pro', 'ultra'].map((t) => (
                  <button key={t}
                    onClick={() => handleUpdateSubscription(t)}
                    className={[
                      'flex-1 px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all border',
                      subscription?.tier === t
                        ? 'bg-accent text-accent-foreground border-accent'
                        : 'bg-transparent text-muted border-border hover:bg-surface-2 hover:text-foreground',
                    ].join(' ')}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
