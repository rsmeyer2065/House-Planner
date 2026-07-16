'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare2,
  CalendarDays,
  ShoppingCart,
  Sprout,
  StickyNote,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getMemberAccess } from '@/lib/household'
import { sectionForPath, canAccessSection, PERMANENT_ACCESS, type MemberAccess } from '@/lib/sections'

// Shown to permanent members (the default). Temporary members get a
// substitute set drawn from the sections they were granted (see below).
const primaryNav = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/settings', label: 'More', icon: Settings },
]

// Candidate items (in priority order) used to backfill the bar for a temporary
// member whose granted sections differ from the permanent default.
const TEMP_NAV_CANDIDATES = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { href: '/plants', label: 'Plants', icon: Sprout },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/settings', label: 'More', icon: Settings },
]

export function MobileNav() {
  const pathname = usePathname()
  const [access, setAccess] = useState<MemberAccess>(PERMANENT_ACCESS)

  useEffect(() => {
    async function load() {
      setAccess(await getMemberAccess(createClient()))
    }
    load()
  }, [])

  const allowed = (href: string) => {
    const section = sectionForPath(href)
    return !section || canAccessSection(access, section)
  }

  // Permanent members keep the fixed bar. Temporary members get their granted
  // sections (dashboard + settings always included), capped at five items.
  const nav =
    access.memberType === 'permanent'
      ? primaryNav
      : TEMP_NAV_CANDIDATES.filter((item) => allowed(item.href)).slice(0, 5)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#e6d6ca] shadow-[0_-4px_14px_rgba(150,120,95,0.18)]">
      <div className="flex items-center justify-around h-16 px-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold min-w-0',
                active ? 'text-[#c1673f]' : 'text-[#8a7462]'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
