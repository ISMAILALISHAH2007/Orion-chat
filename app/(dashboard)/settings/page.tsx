'use client';
import { useState, useEffect } from 'react';
import { 
  Settings, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Volume2, 
  UserCheck, 
  Languages,
  Check,
  Zap,
  Globe
} from 'lucide-react';
import { useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';

interface Profile { name: string; email: string; createdAt: string; }
interface Subscription { tier: string; status: string; }

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const { theme, setTheme } = useTheme();
  const { 
    selectedVoiceUri, 
    setSelectedVoiceUri, 
    voiceGender, 
    setVoiceGender, 
    voices 
  } = useTTS();

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
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_subscription', tier }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubscription(data.subscription);
      }
    } catch {}
  };

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="dashboard-subpage overflow-y-auto max-h-full pb-12 px-4 sm:px-6">
      <div className="subpage-header mb-8">
        <h1 className="subpage-title flex items-center gap-2.5 text-2xl font-bold tracking-tight">
          <Settings className="text-accent animate-spin-slow" size={24} />
          <span>Settings</span>
        </h1>
        <p className="subpage-description text-sm text-muted">
          Customize your appearance, control assistant voice preferences, and manage compute subscription tiers.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted py-12 justify-center">
          <Sparkles size={20} className="animate-spin-slow text-accent" />
          <span className="text-sm font-medium">Initializing Config Core...</span>
        </div>
      ) : (
        <div className="space-y-8 max-w-5xl">
          {/* Account Profile Header Section */}
          <div className="gemini-card p-6 flex flex-col md:flex-row items-center gap-6 bg-gradient-to-r from-surface-2 to-surface border border-border/80">
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-tr from-accent to-purple-500 text-white font-bold text-2xl shadow-inner shrink-0 animate-pulse">
              {getInitials(profile?.name)}
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#0a0a0a] border border-border">
                <User size={12} className="text-accent" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left space-y-1">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">{profile?.name || 'Operator'}</h2>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                  {subscription?.tier === 'ultra' ? 'Enterprise Titan' : (subscription?.tier === 'pro' ? 'Pro Access' : 'Free Operator')}
                </span>
              </div>
              <p className="text-xs text-muted font-mono">{profile?.email}</p>
              {profile?.createdAt && (
                <p className="text-[10px] text-muted/80">
                  Core registered on {new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Visual Appearance & Theme Config */}
            <div className="gemini-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                  <Sun className="text-muted" size={18} />
                  <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Visual Style</h2>
                </div>
                <p className="text-xs text-muted mb-6">Select your interface appearance theme card below.</p>
                
                {/* 3 Visual Mini-Theme Mock Cards */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Light Card */}
                  <button 
                    onClick={() => setTheme('light')}
                    className={[
                      'group relative flex flex-col items-center p-3 rounded-xl border text-left transition-all hover:scale-105 active:scale-95 duration-200',
                      theme === 'light' ? 'border-accent bg-accent/5 ring-1 ring-accent/30' : 'border-border bg-[#fafafa] hover:bg-slate-100'
                    ].join(' ')}
                  >
                    <div className="w-full h-12 rounded-lg bg-white border border-slate-200 p-1 flex gap-1 mb-2.5 overflow-hidden">
                      <div className="w-1.5 h-full rounded bg-slate-100 border border-slate-200" />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="h-2 w-full rounded bg-slate-100" />
                        <div className="h-2 w-3/4 rounded bg-slate-150" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1">
                      {theme === 'light' && <Check size={10} className="text-accent" />}
                      <span>Light</span>
                    </span>
                  </button>

                  {/* Dark Card */}
                  <button 
                    onClick={() => setTheme('dark')}
                    className={[
                      'group relative flex flex-col items-center p-3 rounded-xl border text-left transition-all hover:scale-105 active:scale-95 duration-200',
                      theme === 'dark' ? 'border-accent bg-accent/5 ring-1 ring-accent/30' : 'border-border bg-[#18181b] hover:bg-[#202024]'
                    ].join(' ')}
                  >
                    <div className="w-full h-12 rounded-lg bg-[#0f0f12] border border-zinc-800 p-1 flex gap-1 mb-2.5 overflow-hidden">
                      <div className="w-1.5 h-full rounded bg-zinc-800" />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="h-2 w-full rounded bg-zinc-800" />
                        <div className="h-2 w-3/4 rounded bg-zinc-800" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                      {theme === 'dark' && <Check size={10} className="text-accent" />}
                      <span>Cosmic</span>
                    </span>
                  </button>

                  {/* OLED Card */}
                  <button 
                    onClick={() => setTheme('oled')}
                    className={[
                      'group relative flex flex-col items-center p-3 rounded-xl border text-left transition-all hover:scale-105 active:scale-95 duration-200',
                      theme === 'oled' ? 'border-accent bg-accent/5 ring-1 ring-accent/30' : 'border-border bg-[#000000] hover:bg-[#070708]'
                    ].join(' ')}
                  >
                    <div className="w-full h-12 rounded-lg bg-black border border-zinc-900 p-1 flex gap-1 mb-2.5 overflow-hidden">
                      <div className="w-1.5 h-full rounded bg-zinc-900" />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className="h-2 w-full rounded bg-zinc-900" />
                        <div className="h-2 w-3/4 rounded bg-zinc-900" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-400 flex items-center gap-1">
                      {theme === 'oled' && <Check size={10} className="text-accent" />}
                      <span>Nebula</span>
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Voice Preferences Card */}
            <div className="gemini-card p-6">
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Volume2 className="text-muted" size={18} />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Voice Assistant</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1.5 flex items-center gap-1">
                    <Languages size={12} className="text-accent" />
                    <span>Synthesized Voice Language</span>
                  </label>
                  <select
                    value={selectedVoiceUri}
                    onChange={(e) => setSelectedVoiceUri(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent transition-colors cursor-pointer"
                  >
                    {voices.map((voice) => (
                      <option key={voice.uri} value={voice.uri}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted block mb-2 flex items-center gap-1">
                    <UserCheck size={12} className="text-accent" />
                    <span>Assistant Speaker Gender</span>
                  </label>
                  <div className="flex gap-2">
                    {(['female', 'male'] as const).map((gender) => (
                      <button
                        key={gender}
                        onClick={() => setVoiceGender(gender)}
                        className={[
                          'flex-1 py-2.5 px-3 border rounded-xl text-xs font-semibold capitalize transition-all duration-200',
                          voiceGender === gender
                            ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                            : 'bg-transparent text-muted border-border hover:bg-surface-2 hover:text-foreground'
                        ].join(' ')}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Compute Subscription & Billing Section */}
          <div className="gemini-card p-6">
            <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
              <ShieldCheck className="text-muted" size={18} />
              <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Compute Allotment</h2>
            </div>
            <p className="text-xs text-muted mb-6">Choose your compute allotment. Higher tiers allow advanced reasoning models and unlimited speed.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Free Plan Card */}
              <div 
                onClick={() => handleUpdateSubscription('free')}
                className={[
                  'flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer',
                  subscription?.tier === 'free'
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                    : 'border-border bg-surface-2 hover:bg-surface-hover'
                ].join(' ')}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">Free Sandbox</span>
                    {subscription?.tier === 'free' && <Check size={14} className="text-accent" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Standard Core</h3>
                  <p className="text-[10px] text-muted/90 mt-2 leading-relaxed">Access standard 8B/Flash conversational models. Basic rate-limits apply.</p>
                </div>
                <div className="mt-5 text-[10px] font-bold text-accent uppercase tracking-wider">Free</div>
              </div>

              {/* Pro Plan Card */}
              <div 
                onClick={() => handleUpdateSubscription('pro')}
                className={[
                  'flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer',
                  subscription?.tier === 'pro'
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                    : 'border-border bg-surface-2 hover:bg-surface-hover'
                ].join(' ')}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-accent flex items-center gap-1">
                      <Zap size={10} />
                      <span>Pro Compute</span>
                    </span>
                    {subscription?.tier === 'pro' && <Check size={14} className="text-accent" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Titan Workspace</h3>
                  <p className="text-[10px] text-muted/90 mt-2 leading-relaxed">Access 70B models, web search automation, and larger history retention length limits.</p>
                </div>
                <div className="mt-5 text-[10px] font-bold text-accent uppercase tracking-wider">$15 / month</div>
              </div>

              {/* Ultra Plan Card */}
              <div 
                onClick={() => handleUpdateSubscription('ultra')}
                className={[
                  'flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer',
                  subscription?.tier === 'ultra'
                    ? 'border-accent bg-accent/5 ring-1 ring-accent/30'
                    : 'border-border bg-surface-2 hover:bg-surface-hover'
                ].join(' ')}
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1">
                      <Globe size={10} />
                      <span>Ultra Unlimited</span>
                    </span>
                    {subscription?.tier === 'ultra' && <Check size={14} className="text-accent" />}
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Reasoning Engine</h3>
                  <p className="text-[10px] text-muted/90 mt-2 leading-relaxed">Access reasoning architectures (DeepSeek R1/Gemini Pro) and unlimited media creation tools.</p>
                </div>
                <div className="mt-5 text-[10px] font-bold text-accent uppercase tracking-wider">$30 / month</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
