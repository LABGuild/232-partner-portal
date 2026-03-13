'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-blue flex flex-col items-center justify-center px-4">
      {/* Logo area */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-12 h-1 bg-brand-yellow" />
          <span className="text-brand-yellow font-heading font-bold text-xl tracking-widest uppercase">
            2-3-2
          </span>
          <div className="w-12 h-1 bg-brand-yellow" />
        </div>
        <h1 className="text-white font-heading font-bold text-2xl leading-tight">
          Cohesive Strategy Partnership
        </h1>
        <p className="text-white/70 font-body text-sm mt-1">
          Partner Portal
        </p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        {!submitted ? (
          <>
            <h2 className="font-heading font-semibold text-xl text-gray-900 mb-1">
              Sign in
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Enter your email and we&apos;ll send you a sign-in link — no password needed.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourorg.org"
                  required
                  className="input"
                />
              </div>

              {error && (
                <p className="text-brand-red text-sm">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="btn-primary w-full"
              >
                {loading ? 'Sending…' : 'Send sign-in link'}
              </button>
            </form>

            <p className="text-xs text-gray-400 mt-6 text-center">
              This portal is for 232 Partnership members only.
              <br />Contact Lily at Mountain Studies Institute for access.
            </p>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="font-heading font-semibold text-xl text-gray-900 mb-2">
              Check your email
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              We sent a sign-in link to <strong>{email}</strong>.
              Click it to access the portal.
            </p>
            <button
              onClick={() => { setSubmitted(false); setEmail('') }}
              className="text-brand-blue text-sm hover:underline"
            >
              Use a different email
            </button>
          </div>
        )}
      </div>

      <p className="text-white/40 text-xs mt-8">
        Two watersheds · Three rivers · Two states
      </p>
    </div>
  )
}
