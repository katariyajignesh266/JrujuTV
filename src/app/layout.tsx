import type { Metadata, Viewport } from 'next';
import React from 'react';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { PWAProvider } from '@/components/providers/PWAProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ChildSessionTracker } from '@/components/providers/ChildSessionTracker';
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
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Canonical mobile status bar theme-color (updated dynamically by useTheme & inline script) */}
        <meta name="theme-color" content="#0F0F0F" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        {/* Prevent FOWT: apply stored theme and sync theme-color before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = JSON.parse(localStorage.getItem('jruju-ui') || '{}');
                  var theme = stored?.state?.theme;
                  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var isDark = theme === 'dark' || (!theme && prefersDark);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  var color = isDark ? '#0F0F0F' : '#FFFFFF';
                  var metas = document.querySelectorAll('meta[name="theme-color"]');
                  if (metas.length > 0) {
                    metas.forEach(function(m) {
                      m.removeAttribute('media');
                      m.setAttribute('content', color);
                    });
                  } else {
                    var m = document.createElement('meta');
                    m.setAttribute('name', 'theme-color');
                    m.setAttribute('content', color);
                    document.head.appendChild(m);
                  }
                  var apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
                  if (apple) {
                    apple.setAttribute('content', isDark ? 'black-translucent' : 'default');
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

            {/* Child session tracker: fires parent notification on child app open (fire-and-forget) */}
            <ChildSessionTracker />

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

