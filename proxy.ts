import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  sectionForPath,
  canAccessSection,
  memberAccessFromRow,
  type MemberAccessRow,
} from '@/lib/sections'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const authRoutes = ['/login', '/signup']
  const isAuthRoute = authRoutes.some((r) => pathname.startsWith(r))

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Section guard for temporary members: keep them out of sections they were
  // not granted (or any section once their access has expired). The dashboard
  // and settings always stay reachable so they have a landing page and can
  // sign out. This backs the RLS at the page level.
  if (user && !isAuthRoute) {
    const section = sectionForPath(pathname)
    if (section && section !== 'dashboard') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', user.id)
        .single()
      if (profile?.household_id) {
        const { data: member } = await supabase
          .from('household_members')
          .select('member_type, allowed_sections, access_starts_at, access_expires_at')
          .eq('household_id', profile.household_id)
          .eq('user_id', user.id)
          .single()
        const access = memberAccessFromRow(member as MemberAccessRow | null)
        if (access.memberType === 'temporary' && !canAccessSection(access, section)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
