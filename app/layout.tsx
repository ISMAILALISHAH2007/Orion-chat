import type { Metadata } from 'next';
import { Outfit, Inter } from 'next/font/google';
import '@/app/styles/globals.css';
import { AuthProvider } from '@/app/components/providers/AuthProvider';
import { ThemeProvider } from '@/app/components/providers/ThemeProvider';
import Script from 'next/script';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'ULTRON // Cognitive Assistant',
  description: 'Next‑gen AI platform with memory, agents, and voice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${inter.variable}`}>
      <body className="mode-casual">
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" strategy="beforeInteractive" />
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
