import type { Metadata, Viewport } from 'next'
import './globals.css'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: '2-3-2 Partnership Database',
  description: 'Connecting forest and watershed restoration partners across the 2-3-2 landscape.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-64.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '232 Partners',
  },
}

export const viewport: Viewport = {
  themeColor: '#28657A',
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
      <body className="bg-brand-sand text-gray-900 min-h-screen font-body flex flex-col">
        <div className="flex-1">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  )
}
