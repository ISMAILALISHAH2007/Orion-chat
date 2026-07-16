import type { Metadata, Viewport } from 'next';
import { Outfit, Inter, JetBrains_Mono } from 'next/font/google';
import '@/app/styles/globals.css';
import { AuthProvider } from '@/app/components/providers/AuthProvider';
import { ThemeProvider } from '@/app/components/providers/ThemeProvider';
import { TTSProvider } from '@/app/components/providers/TTSProvider';
import InstallPrompt from '@/app/components/ui/InstallPrompt';
import { SpeedInsights } from '@vercel/speed-insights/next';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'ORION — AI Assistant',
  description: 'A premium conversational AI workspace with memory, agents, and voice.',
  keywords: ['AI', 'assistant', 'chatbot', 'ORION', 'conversation', 'productivity'],
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9fafb' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f19' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground font-sans antialiased">
        <AuthProvider>
          <ThemeProvider>
            <TTSProvider>
              <InstallPrompt />
              {children}
              <SpeedInsights />
            </TTSProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
