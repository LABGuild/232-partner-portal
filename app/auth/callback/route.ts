import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/directory'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if this person already has a profile
      const { data: person } = await supabase
        .from('people')
        .select('id, is_live')
        .eq('id', data.user.id)
        .single()

      // New user — send them to profile setup
      if (!person) {
        return NextResponse.redirect(`${origin}/profile?setup=true`)
      }

      // Returning user — send to where they were going
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  // Something went wrong
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
