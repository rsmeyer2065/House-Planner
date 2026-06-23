'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Task, ActivityLogEntry } from '@/lib/types'
import {
  Hammer, CheckSquare2, CalendarDays, Wallet,
  ShoppingCart, Phone, Package, StickyNote,
  Activity, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

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

const ACTION_LABELS: Record<string, string> = {
  task_completed: 'completed task',
  task_created: 'added task',
  transaction_added: 'logged expense',
  shopping_checked: 'checked off',
  note_created: 'added a note',
  project_created: 'started project',
  event_created: 'scheduled',
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    projects: 0, tasks: 0, events: 0, monthExpenses: 0,
    shopping: 0, contacts: 0, inventory: 0, notes: 0,
  })
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [sideLoading, setSideLoading] = useState(true)

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

    async function loadSide() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSideLoading(false); return }

      const today = new Date().toISOString().slice(0, 10)
      const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)

      const [myTasksRes, activityRes] = await Promise.all([
        supabase.from('tasks')
          .select('*')
          .eq('assigned_to', user.id)
          .eq('status', 'pending')
          .or(`due_date.lte.${weekOut},due_date.is.null`)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(5),
        supabase.from('activity_log')
          .select('*, profiles!user_id(full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(15),
      ])

      setMyTasks(myTasksRes.data ?? [])
      setActivity((activityRes.data ?? []) as ActivityLogEntry[])
      setSideLoading(false)
    }

    load()
    loadSide()
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

      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* My Tasks */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <CheckSquare2 className="h-4 w-4 text-orange-500" />
              My Tasks
            </h2>
            <Link href="/tasks" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              View all →
            </Link>
          </div>

          {sideLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No tasks assigned to you this week.
            </p>
          ) : (
            <div className="space-y-1">
              {myTasks.map(t => {
                const overdue = t.due_date && new Date(t.due_date) < new Date()
                return (
                  <div key={t.id} className="flex items-center gap-2 py-2 px-1 rounded-lg hover:bg-muted/50">
                    <CheckSquare2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      {t.due_date && (
                        <p className={cn('text-xs', overdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                          {overdue ? 'Overdue · ' : 'Due '}{t.due_date}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-primary" />
            Recent Activity
          </h2>

          {sideLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No activity yet. Start adding tasks, events, or notes!
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map(entry => {
                const name = entry.profiles?.full_name ?? 'Someone'
                const label = ACTION_LABELS[entry.action_type] ?? entry.action_type
                const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
                return (
                  <div key={entry.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{name}</span>{' '}
                        <span className="text-muted-foreground">{label}</span>
                        {entry.entity_title && (
                          <> <span className="font-medium">"{entry.entity_title}"</span></>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> {timeAgo}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
