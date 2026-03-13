import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '232 Partnership — Partner Portal',
  description: 'Connecting forest and watershed restoration partners across the 2-3-2 landscape.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '232 Partners',
  },
}

export const viewport: Viewport = {
  themeColor: '#436578',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 min-h-screen font-body">
        {children}
      </body>
    </html>
  )
}
