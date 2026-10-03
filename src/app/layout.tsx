import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PWAProvider } from '@/components/providers/PWAProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { DesktopHeader } from '@/components/layout/DesktopHeader';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavBar } from '@/components/layout/BottomNavBar';
import { SidebarDrawer } from '@/components/layout/SidebarDrawer';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { AuthModal } from '@/components/auth/AuthModal';
import { KeepAlive } from '@/components/providers/KeepAlive';

export const metadata: Metadata = {
  title: 'JruJu TV — Kids\' Content Platform',
  description: 'Curated, parent-controlled video platform for children\'s content',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JruJu TV',
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // theme-color drives the browser chrome / Android status bar color
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E53935' },
    { media: '(prefers-color-scheme: dark)',  color: '#E53935' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent FOWT: apply stored theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = JSON.parse(localStorage.getItem('jruju-ui') || '{}');
                  var theme = stored?.state?.theme;
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {/* Auth: initializes session from localStorage/cookies on every page load */}
          <AuthProvider>
            {/* PWA: SW registration + install prompt capture (client-only, renders nothing) */}
            <PWAProvider />

            {/* Skip to main content (a11y) */}
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-primary focus:text-white focus:font-medium"
            >
              Skip to main content
            </a>

            {/* Headers (each self-hides at wrong breakpoint) */}
            <MobileHeader />
            <DesktopHeader />

            {/* Sidebar (desktop only) */}
            <SidebarDrawer />

            {/* Reset scroll on route change */}
            <ScrollToTop />

            {/* Page content */}
            {children}

            {/* Mobile bottom nav */}
            <BottomNavBar />

            {/* Auth modal (global) */}
            <AuthModal />

            {/* Keep Render.com server awake — pings /api/health every 10 min */}
            <KeepAlive />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

