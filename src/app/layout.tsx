import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { PostHogProvider } from './components/PostHogProvider'

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
      <body className={`${inter.className} bg-black text-gray-200`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
