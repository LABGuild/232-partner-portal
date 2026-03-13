'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PlatformRole } from '@/lib/types'

interface NavProps {
  role: PlatformRole
}

export default function Nav({ role }: NavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/directory', label: 'Directory' },
    { href: '/profile',   label: 'My Profile' },
    ...(role === 'platform_admin' ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bg-brand-blue text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <Link href="/directory" className="flex items-center gap-2">
            <span className="font-heading font-bold text-brand-yellow tracking-widest text-base">
              2-3-2
            </span>
            <span className="text-white/80 font-heading text-sm hidden sm:inline">
              Partner Portal
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-lg font-heading text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="ml-3 text-white/60 hover:text-white text-sm font-heading transition-colors"
            >
              Sign out
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg hover:bg-white/10"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden pb-3 space-y-1">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-4 py-2 rounded-lg font-heading text-sm font-medium ${
                  pathname.startsWith(link.href)
                    ? 'bg-white/20 text-white'
                    : 'text-white/70'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-4 py-2 text-white/60 text-sm font-heading"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
