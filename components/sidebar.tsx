'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Hammer,
  CheckSquare2,
  CalendarDays,
  Wallet,
  ShoppingCart,
  Phone,
  Package,
  StickyNote,
  Sprout,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Hammer },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/budget', label: 'Budget', icon: Wallet },
  { href: '/shopping', label: 'Shopping', icon: ShoppingCart },
  { href: '/contacts', label: 'Contacts', icon: Phone },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/notes', label: 'Notes', icon: StickyNote },
  { href: '/plants', label: 'Plants', icon: Sprout },
]

const RAISED = 'shadow-[3px_3px_8px_#ccb5a5,-3px_-3px_8px_#f7ebe1]'
const RAISED_HOVER = 'hover:shadow-[3px_3px_8px_#ccb5a5,-3px_-3px_8px_#f7ebe1]'
const INSET = 'shadow-[inset_4px_4px_9px_#ccb5a5,inset_-4px_-4px_9px_#f7ebe1]'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [householdName, setHouseholdName] = useState('')

  useEffect(() => {
    async function loadHousehold() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
      if (!prof?.household_id) return
      const { data: hh } = await supabase.from('households').select('name').eq('id', prof.household_id).single()
      if (hh?.name) setHouseholdName(hh.name)
    }
    loadHousehold()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-[250px] shrink-0 bg-[#e6d6ca] p-[26px] px-5 gap-[26px]">
      <div className="flex items-center gap-[13px] px-1.5 py-1">
        <div className={cn('w-[46px] h-[46px] rounded-2xl bg-[#e6d6ca] flex items-center justify-center text-xl', RAISED)}>
          🏡
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-black text-[18px] tracking-tight text-[#4b3a2f]">Home Planner</span>
          <span className="font-bold text-[11px] text-[#a58b78] tracking-wider uppercase">{householdName || ' '}</span>
        </div>
      </div>

      <nav className="flex flex-col gap-[7px]">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-[13px] px-[15px] py-3 rounded-2xl font-bold text-[14.5px] no-underline transition-shadow',
                active
                  ? cn('text-[#c1673f] font-extrabold', INSET)
                  : cn('text-[#8a7462] hover:text-[#5a4638]', RAISED_HOVER)
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
              {label}
              {active && (
                <span className="ml-auto w-[7px] h-[7px] rounded-full bg-[#c1673f] shadow-[0_0_0_3px_rgba(193,103,63,0.18)]" />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-[7px]">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-[13px] px-[15px] py-3 rounded-2xl font-bold text-[14.5px] text-[#8a7462] no-underline transition-shadow hover:text-[#5a4638]',
            RAISED_HOVER
          )}
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={2.25} />
          Settings
        </Link>
        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-[13px] px-[15px] py-3 rounded-2xl font-bold text-[14.5px] text-[#8a7462] no-underline transition-shadow hover:text-[#5a4638]',
            RAISED_HOVER
          )}
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={2.25} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
