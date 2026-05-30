import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { TOTAL_TOOL_COUNT } from '@/lib/registry';
import { SITE_URL, SITE_NAME, SITE_TAGLINE, HOME_OG_IMAGE, OG_WIDTH, OG_HEIGHT, X_HANDLE } from '@/lib/seo/site';
import './globals.css';

const HOME_DESCRIPTION = `A fast, privacy-first collection of ${TOTAL_TOOL_COUNT}+ developer & file utilities. Everything runs client-side — no data ever leaves your browser. Works fully offline.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TAGLINE,
    template: `%s — ${SITE_NAME}`,
  },
  description: HOME_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: SITE_NAME },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_US',
    url: `${SITE_URL}/`,
    title: SITE_TAGLINE,
    description: HOME_DESCRIPTION,
    images: [
      {
        url: HOME_OG_IMAGE,
        width: OG_WIDTH,
        height: OG_HEIGHT,
        type: 'image/png',
        alt: 'Open Utility Tools — privacy-first browser utilities',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: X_HANDLE,
    creator: X_HANDLE,
    title: SITE_TAGLINE,
    description: HOME_DESCRIPTION,
    images: [HOME_OG_IMAGE],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0f17' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
