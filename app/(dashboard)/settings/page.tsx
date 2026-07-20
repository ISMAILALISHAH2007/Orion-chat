'use client';
import { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Sparkles, 
  User, 
  UserCheck, 
  Languages,
  Check,
  Zap,
  Globe,
  MessageSquare,
  Bell,
  Shield,
  ShieldCheck,
  Download,
  Trash2,
  CheckCircle2,
  Palette,
  Mic,
} from 'lucide-react';
import { useTheme } from '@/app/components/providers/ThemeProvider';
import { useTTS } from '@/app/components/providers/TTSProvider';

interface Profile { name: string; email: string; createdAt: string; }
interface Subscription { tier: string; status: string; }

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 2500);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="fixed bottom-8 right-8 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-accent text-accent-foreground shadow-xl animate-slide-up border border-accent/20">
      <CheckCircle2 size={16} />
      <span className="text-sm font-semibold">{message}</span>
    </div>
  );
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const { 
    selectedVoiceUri, 
    setSelectedVoiceUri, 
    voiceGender, 
    setVoiceGender, 
    voices 
  } = useTTS();

  // Chat preferences (saved to localStorage)
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [enterToSend, setEnterToSend] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [desktopNotif, setDesktopNotif] = useState(true);

  const dismissToast = useCallback(() => setToast(null), []);

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
    
    // Load saved preferences from localStorage
    const savedStream = localStorage.getItem('orion-stream-enabled');
    if (savedStream !== null) setStreamEnabled(savedStream === 'true');
    const savedScroll = localStorage.getItem('orion-auto-scroll');
    if (savedScroll !== null) setAutoScroll(savedScroll === 'true');
    const savedEnter = localStorage.getItem('orion-enter-send');
    if (savedEnter !== null) setEnterToSend(savedEnter === 'true');
    const savedSound = localStorage.getItem('orion-sound-enabled');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');
    const savedNotif = localStorage.getItem('orion-desktop-notif');
    if (savedNotif !== null) setDesktopNotif(savedNotif === 'true');
  }, []);

  const savePreference = useCallback((key: string, value: boolean) => {
    localStorage.setItem(`orion-${key}`, String(value));
    setToast(`${key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} updated`);
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
        setToast(`Switched to ${tier} plan`);
      }
    } catch {}
  };

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const handleClearConversations = () => {
    if (confirm('Are you sure you want to clear all local conversations? This cannot be undone.')) {
      localStorage.removeItem('orion-chat-sessions');
      setToast('Local conversations cleared');
    }
  };

  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200',
        enabled ? 'border-accent bg-accent' : 'border-border bg-surface-2'
      ].join(' ')}
    >
      <span className={[
        'inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200',
        enabled ? 'translate-x-4' : 'translate-x-0'
      ].join(' ')} />
    </button>
  );

  return (
    <div className="dashboard-subpage overflow-y-auto max-h-full pb-16 px-4 sm:px-8">
      {toast && <Toast message={toast} onClose={dismissToast} />}
      
      {/* Header */}
      <div className="subpage-header mb-8 animate-fade-in-down" style={{ animationDelay: '0ms' }}>
        <h1 className="subpage-title flex items-center gap-3 text-2xl font-bold tracking-tight">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <Settings className="text-accent relative" size={24} />
          </div>
          <span>Settings</span>
        </h1>
        <p className="subpage-description text-sm text-muted mt-1">
          Configure your experience — appearance, voice, chat, and account preferences.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-muted py-16 justify-center">
          <Sparkles size={20} className="animate-spin-slow text-accent" />
          <span className="text-sm font-medium">Loading your settings...</span>
        </div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          {/* ===== PROFILE HEADER ===== */}
          <div 
            className="gemini-card p-6 flex flex-col md:flex-row items-center gap-6 bg-gradient-to-br from-surface-2 to-surface border border-border/80 animate-fade-in-down"
            style={{ animationDelay: '50ms' }}
          >
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-accent to-purple-500 text-white font-bold text-2xl shadow-lg shrink-0">
              {getInitials(profile?.name)}
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                <User size={12} className="text-accent" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left space-y-1.5">
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <h2 className="text-xl font-bold text-foreground">{profile?.name || 'Operator'}</h2>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/20">
                  {subscription?.tier === 'ultra' ? 'Ultra' : (subscription?.tier === 'pro' ? 'Pro' : 'Free')}
                </span>
              </div>
              <p className="text-sm text-muted font-mono">{profile?.email}</p>
              {profile?.createdAt && (
                <p className="text-[11px] text-muted/70">
                  Joined {new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ===== VISUAL STYLE ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '100ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Palette size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Visual Style</h2>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'light' as const, label: 'Light', preview: 'bg-[#fafafa]', text: 'text-slate-800', accent: 'bg-slate-200', border: 'border-slate-200' },
                  { id: 'dark' as const, label: 'Cosmic', preview: 'bg-[#0f0f12]', text: 'text-zinc-300', accent: 'bg-zinc-800', border: 'border-zinc-800' },
                  { id: 'oled' as const, label: 'Nebula', preview: 'bg-black', text: 'text-fuchsia-400', accent: 'bg-zinc-900', border: 'border-zinc-900' },
                ].map(({ id, label, preview, text, accent, border }) => (
                  <button 
                    key={id}
                    onClick={() => setTheme(id)}
                    className={[
                      'group relative flex flex-col items-center p-3 rounded-xl border text-left transition-all duration-200 hover:scale-[1.03] active:scale-95',
                      theme === id 
                        ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm' 
                        : 'border-border hover:bg-surface-2'
                    ].join(' ')}
                  >
                    <div className={`w-full h-12 rounded-lg ${preview} ${border} border p-1.5 flex gap-1 mb-2.5 overflow-hidden`}>
                      <div className={`w-1.5 h-full rounded ${accent}`} />
                      <div className="flex-1 flex flex-col gap-0.5">
                        <div className={`h-2 w-full rounded ${accent}`} />
                        <div className={`h-2 w-3/4 rounded ${accent}`} />
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${text} flex items-center gap-1`}>
                      {theme === id && <Check size={10} className="text-accent" />}
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ===== VOICE ASSISTANT ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '150ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Mic size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Voice Assistant</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1.5 flex items-center gap-1.5">
                    <Languages size={12} className="text-accent" />
                    <span>TTS Voice</span>
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
                  <label className="text-xs text-muted block mb-2 flex items-center gap-1.5">
                    <UserCheck size={12} className="text-accent" />
                    <span>Gender</span>
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

            {/* ===== CHAT PREFERENCES ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '200ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <MessageSquare size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Chat Preferences</h2>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'stream-enabled', label: 'Stream responses', desc: 'Show AI responses in real-time as they\'re generated', value: streamEnabled, set: (v: boolean) => { setStreamEnabled(v); savePreference('stream-enabled', v); } },
                  { key: 'auto-scroll', label: 'Auto-scroll to new messages', desc: 'Automatically scroll to the latest message', value: autoScroll, set: (v: boolean) => { setAutoScroll(v); savePreference('auto-scroll', v); } },
                  { key: 'enter-send', label: 'Enter to send', desc: 'Press Enter to send, Shift+Enter for new line', value: enterToSend, set: (v: boolean) => { setEnterToSend(v); savePreference('enter-send', v); } },
                ].map(({ key, label, desc, value, set }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                    </div>
                    <Toggle enabled={value} onChange={set} />
                  </div>
                ))}
              </div>
            </div>

            {/* ===== NOTIFICATIONS ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '250ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Bell size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Notifications</h2>
              </div>
              <div className="space-y-4">
                {[
                  { key: 'sound-enabled', label: 'Message sounds', desc: 'Play a sound when receiving new messages', value: soundEnabled, set: (v: boolean) => { setSoundEnabled(v); savePreference('sound-enabled', v); } },
                  { key: 'desktop-notif', label: 'Desktop notifications', desc: 'Show browser notifications for new messages', value: desktopNotif, set: (v: boolean) => { setDesktopNotif(v); savePreference('desktop-notif', v); } },
                ].map(({ key, label, desc, value, set }) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[11px] text-muted mt-0.5">{desc}</p>
                    </div>
                    <Toggle enabled={value} onChange={set} />
                  </div>
                ))}
              </div>
            </div>

            {/* ===== DATA & PRIVACY ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '300ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Shield size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Data & Privacy</h2>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const data = localStorage.getItem('orion-chat-sessions');
                    if (data) {
                      const blob = new Blob([data], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `orion-chats-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      setToast('Conversations exported');
                    } else {
                      setToast('No conversations to export');
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3.5 text-left transition-all hover:bg-surface-2 hover:border-border-strong"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Download size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Export conversations</p>
                    <p className="text-[11px] text-muted">Download all chat history as JSON</p>
                  </div>
                </button>
                
                <button
                  onClick={handleClearConversations}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3.5 text-left transition-all hover:bg-danger/5 hover:border-danger/30"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
                    <Trash2 size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Clear local data</p>
                    <p className="text-[11px] text-muted">Remove all locally stored conversations</p>
                  </div>
                </button>
              </div>
            </div>

            {/* ===== SERVICES ===== */}
            <div 
              className="gemini-card p-6 animate-fade-in-down"
              style={{ animationDelay: '350ms' }}
            >
              <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
                <Zap size={16} className="text-accent" />
                <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Connected Services</h2>
              </div>
              <div className="space-y-3">
                {[
                  { name: 'Chat AI', key: 'OpenRouter / Gemini', note: 'Configured in .env' },
                  { name: 'Image Gen', key: 'Pollinations.ai', note: 'Free, no key needed' },
                  { name: 'Video Gen', key: 'Replicate', note: 'Free trial credits' },
                  { name: 'Voice TTS', key: 'Edge TTS', note: 'Built-in, no key needed' },
                  { name: 'Authentication', key: 'NextAuth', note: 'Credentials / Google' },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2/50 px-3.5 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30" />
                      <span className="text-sm font-medium text-foreground">{service.name}</span>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-[11px] text-muted font-mono truncate">{service.key}</p>
                      <p className="text-[9px] text-muted/60">{service.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ===== SUBSCRIPTION PLANS ===== */}
          <div 
            className="gemini-card p-6 animate-fade-in-down"
            style={{ animationDelay: '400ms' }}
          >
            <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-3">
              <ShieldCheck size={16} className="text-accent" />
              <h2 className="text-sm font-bold tracking-wider text-foreground uppercase">Subscription Plan</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { tier: 'free', label: 'Free Sandbox', badge: 'Standard Core', price: 'Free', desc: 'Access standard conversational models. Basic rate-limits apply.' },
                { tier: 'pro', label: 'Pro Compute', badge: 'Titan Workspace', price: '$15 / mo', desc: 'Access 70B models, web search automation, and larger history limits.' },
                { tier: 'ultra', label: 'Ultra Unlimited', badge: 'Reasoning Engine', price: '$30 / mo', desc: 'Access reasoning architectures and unlimited media creation tools.' },
              ].map(({ tier, label, badge, price, desc }) => (
                <div 
                  key={tier}
                  onClick={() => handleUpdateSubscription(tier)}
                  className={[
                    'flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
                    subscription?.tier === tier
                      ? 'border-accent bg-accent/5 ring-1 ring-accent/30 shadow-sm'
                      : 'border-border bg-surface-2 hover:bg-surface-hover'
                  ].join(' ')}
                >
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className={[
                        'text-xs font-bold uppercase tracking-widest flex items-center gap-1',
                        tier === 'ultra' ? 'text-purple-400' : tier === 'pro' ? 'text-accent' : 'text-muted'
                      ].join(' ')}>
                        {tier === 'ultra' && <Globe size={10} />}
                        {tier === 'pro' && <Zap size={10} />}
                        {label}
                      </span>
                      {subscription?.tier === tier && <Check size={14} className="text-accent" />}
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{badge}</h3>
                    <p className="text-xs text-muted/90 mt-2 leading-relaxed">{desc}</p>
                  </div>
                  <div className="mt-5 text-xs font-bold text-accent uppercase tracking-wider">{price}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-[11px] text-muted/50">
              Settings are saved locally. Account changes require refresh.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
