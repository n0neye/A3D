import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PostHogProvider } from './components/PostHogProvider'
import Script from 'next/script'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '3D-to-Image Generator',
  description: 'Create 3D scenes and generate images using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
        <title>Playground | NONTECH</title>
        <link rel="icon" href="/favicon.ico" />
        <meta name="description" content="3D Playground with AI Rendering" />
        {/* OG Image */}
        <meta property="og:image" content="/og.jpg" />

      </head>
      <body className={`${inter.className} bg-black text-gray-200`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
