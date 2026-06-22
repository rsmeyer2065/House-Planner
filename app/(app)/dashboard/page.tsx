'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Hammer,
  CheckSquare2,
  CalendarDays,
  Wallet,
  ShoppingCart,
  Phone,
  Package,
  StickyNote,
} from 'lucide-react'

type Stats = {
  projects: number
  tasks: number
  events: number
  monthExpenses: number
  shopping: number
  contacts: number
  inventory: number
  notes: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    projects: 0, tasks: 0, events: 0, monthExpenses: 0,
    shopping: 0, contacts: 0, inventory: 0, notes: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [projects, tasks, events, shopping, contacts, inventory, notes, transactions] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('start_time', new Date().toISOString()),
        supabase.from('shopping_lists').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
        supabase.from('transactions').select('amount, type, date'),
      ])

      let monthExpenses = 0
      if (transactions.data) {
        const month = new Date().toISOString().slice(0, 7)
        monthExpenses = transactions.data.reduce(
          (acc, t) =>
            t.type === 'expense' && t.date?.slice(0, 7) === month ? acc + Number(t.amount) : acc,
          0
        )
      }

      setStats({
        projects: projects.count ?? 0,
        tasks: tasks.count ?? 0,
        events: events.count ?? 0,
        monthExpenses,
        shopping: shopping.count ?? 0,
        contacts: contacts.count ?? 0,
        inventory: inventory.count ?? 0,
        notes: notes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { href: '/projects', label: 'Active Projects', value: stats.projects, icon: Hammer, bg: 'bg-blue-50', text: 'text-blue-600' },
    { href: '/tasks', label: 'Pending Tasks', value: stats.tasks, icon: CheckSquare2, bg: 'bg-orange-50', text: 'text-orange-600' },
    { href: '/calendar', label: 'Upcoming Events', value: stats.events, icon: CalendarDays, bg: 'bg-green-50', text: 'text-green-600' },
    { href: '/budget', label: "This Month's Expenses", value: `$${stats.monthExpenses.toFixed(2)}`, icon: Wallet, bg: 'bg-purple-50', text: 'text-purple-600' },
    { href: '/shopping', label: 'Shopping Lists', value: stats.shopping, icon: ShoppingCart, bg: 'bg-pink-50', text: 'text-pink-600' },
    { href: '/contacts', label: 'Contacts', value: stats.contacts, icon: Phone, bg: 'bg-teal-50', text: 'text-teal-600' },
    { href: '/inventory', label: 'Inventory Items', value: stats.inventory, icon: Package, bg: 'bg-amber-50', text: 'text-amber-600' },
    { href: '/notes', label: 'Notes', value: stats.notes, icon: StickyNote, bg: 'bg-yellow-50', text: 'text-yellow-600' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map(({ href, label, value, icon: Icon, bg, text }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
                <Icon className={`h-5 w-5 ${text}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
