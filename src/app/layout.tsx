import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PostHogProvider } from './components/PostHogProvider'
import Script from 'next/script'
import { initAnalytics } from '@/app/engine/utils/analytics'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PLAYMUD',
  description: '3D Playground with AI Rendering',
  icons: {
    icon: '/img/favicon.ico',
  },
  // og
  openGraph: {
    images: '/img/og2.jpg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize analytics on client side
  if (typeof window !== 'undefined') {
    initAnalytics();
  }

  return (
    <html lang="en" className="dark">
      <head>
        {/* Script to disable console.log in production */}
        <Script id="disable-console-in-production" strategy="beforeInteractive">
          {`
            if (process.env.NODE_ENV === 'production') {
              // Save the original console methods
              const originalConsole = {
                log: console.log,
                warn: console.warn,
                error: console.error,
                info: console.info,
                debug: console.debug
              };
              
              // Only keep error and warn in production
              console.log = function() {};
              console.info = function() {};
              console.debug = function() {};
              
              // Optionally keep a reference to the original methods on window
              window._originalConsole = originalConsole;
            }
          `}
        </Script>
      </head>
      <body className={`${inter.className} bg-black text-gray-200`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
