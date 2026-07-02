'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { Task, ActivityLogEntry, Plant } from '@/lib/types'
import {
  Hammer, CheckSquare2, CalendarDays, Wallet,
  ShoppingCart, Phone, Package, StickyNote, Sprout,
  Activity, Clock, Plus, CircleAlert, Square, Droplet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, isToday, isTomorrow, isThisWeek, format } from 'date-fns'

type Stats = {
  projects: number
  tasks: number
  events: number
  monthExpenses: number
  shopping: number
  contacts: number
  inventory: number
  notes: number
  plants: number
}

function plantWateringStatus(plant: Plant): 'overdue' | 'due_soon' | 'ok' | null {
  if (!plant.watering_interval_days || !plant.last_watered_at) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(plant.last_watered_at)
  due.setDate(due.getDate() + plant.watering_interval_days)
  const tomorrow = new Date(startOfToday)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (due < startOfToday) return 'overdue'
  if (due <= tomorrow) return 'due_soon'
  return 'ok'
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

const AVATAR_COLORS = ['#bf6a48', '#a98a3a', '#bd9038', '#b56a5e', '#a07a52', '#bd6b6f', '#b5843a', '#c47a3d']

const RAISED_CARD = 'shadow-[8px_8px_18px_#ccb5a5,-8px_-8px_18px_#f7ebe1]'
const RAISED_CARD_HOVER = 'hover:bg-[#e9dacf] hover:shadow-[10px_10px_22px_#c7af9e,-10px_-10px_22px_#faf0e7]'
const INSET_SM = 'shadow-[inset_3px_3px_7px_#ccb5a5,inset_-3px_-3px_7px_#f7ebe1]'
const RAISED_SM = 'shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1]'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function colorFor(seed: string) {
  const idx = seed.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_COLORS.length
  return AVATAR_COLORS[idx]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDue(dueDate: string | null): { text: string; overdue: boolean } {
  if (!dueDate) return { text: 'No due date', overdue: false }
  const d = new Date(dueDate)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d < startOfToday) {
    return { text: `Overdue · ${formatDistanceToNow(d)} ago`, overdue: true }
  }
  if (isToday(d)) return { text: 'Due today', overdue: false }
  if (isTomorrow(d)) return { text: 'Due tomorrow', overdue: false }
  if (isThisWeek(d, { weekStartsOn: 1 })) return { text: `Due ${format(d, 'EEEE')}`, overdue: false }
  return { text: `Due ${format(d, 'MMM d')}`, overdue: false }
}

export default function DashboardPage() {
  const [firstName, setFirstName] = useState('')
  const [stats, setStats] = useState<Stats>({
    projects: 0, tasks: 0, events: 0, monthExpenses: 0,
    shopping: 0, contacts: 0, inventory: 0, notes: 0, plants: 0,
  })
  const [myTasks, setMyTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [plantsNeedingWater, setPlantsNeedingWater] = useState<Plant[]>([])
  const [loading, setLoading] = useState(true)
  const [sideLoading, setSideLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [projects, tasks, events, shopping, contacts, inventory, notes, plants, transactions] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('events').select('id', { count: 'exact', head: true }).gte('start_time', new Date().toISOString()),
        supabase.from('shopping_lists').select('id', { count: 'exact', head: true }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }),
        supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
        supabase.from('notes').select('id', { count: 'exact', head: true }),
        supabase.from('plants').select('id', { count: 'exact', head: true }),
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
        plants: plants.count ?? 0,
      })
      setLoading(false)
    }

    async function loadSide() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setSideLoading(false); return }

      const weekOut = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10)

      const [profileRes, myTasksRes, activityRes, plantsRes] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', user.id).single(),
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
        supabase.from('plants').select('*'),
      ])

      setFirstName(profileRes.data?.full_name?.split(' ')[0] ?? '')
      setMyTasks(myTasksRes.data ?? [])
      setActivity((activityRes.data ?? []) as ActivityLogEntry[])
      const needsWater = ((plantsRes.data ?? []) as Plant[])
        .filter(p => {
          const status = plantWateringStatus(p)
          return status === 'overdue' || status === 'due_soon'
        })
        .sort((a, b) => plantWateringStatus(a) === 'overdue' ? -1 : plantWateringStatus(b) === 'overdue' ? 1 : 0)
        .slice(0, 5)
      setPlantsNeedingWater(needsWater)
      setSideLoading(false)
    }

    load()
    loadSide()
  }, [])

  const cards = [
    { href: '/projects', label: 'Active Projects', value: stats.projects, icon: Hammer, color: '#bf6a48' },
    { href: '/tasks', label: 'Pending Tasks', value: stats.tasks, icon: CheckSquare2, color: '#c47a3d' },
    { href: '/calendar', label: 'Upcoming Events', value: stats.events, icon: CalendarDays, color: '#a98a3a' },
    { href: '/budget', label: "This Month's Expenses", value: `$${stats.monthExpenses.toFixed(2)}`, icon: Wallet, color: '#b56a5e' },
    { href: '/shopping', label: 'Shopping Lists', value: stats.shopping, icon: ShoppingCart, color: '#bd6b6f' },
    { href: '/contacts', label: 'Contacts', value: stats.contacts, icon: Phone, color: '#a07a52' },
    { href: '/inventory', label: 'Inventory Items', value: stats.inventory, icon: Package, color: '#b5843a' },
    { href: '/notes', label: 'Notes', value: stats.notes, icon: StickyNote, color: '#bd9038' },
    { href: '/plants', label: 'Plants', value: stats.plants, icon: Sprout, color: '#7c9a6e' },
  ]

  return (
    <div className="flex flex-col gap-[26px]">
      {/* header */}
      <header className="flex items-start justify-between gap-5 flex-wrap">
        <div>
          <h1 className="m-0 text-[32px] font-black tracking-tight text-[#4b3a2f]">Dashboard</h1>
          <p className="mt-1.5 text-[15px] font-semibold text-[#a58b78]">
            {greeting()}{firstName ? `, ${firstName}` : ''} — here&apos;s your household at a glance.
          </p>
        </div>
        <div className="flex items-center gap-3.5">
          <button
            className={cn(
              'flex items-center gap-2 border-0 cursor-pointer font-extrabold text-[14.5px] text-[#faf1e9] bg-[#c1673f] px-5 py-3.5 rounded-2xl',
              'shadow-[5px_5px_12px_#b07048,-4px_-4px_10px_#f7ebe1,inset_1px_1px_1px_rgba(255,255,255,0.25)]',
              'active:shadow-[inset_3px_3px_7px_#984e2c,inset_-2px_-2px_6px_#cf7550] active:bg-[#b25e38]'
            )}
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.25} />
            Quick add
          </button>
          <div className={cn('w-[52px] h-[52px] rounded-full bg-[#e6d6ca] flex items-center justify-center font-black text-[16px] text-[#c1673f]', RAISED_SM)}>
            {initials(firstName)}
          </div>
        </div>
      </header>

      {/* stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[22px]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[150px] rounded-[26px] bg-[#dcc8ba] animate-pulse" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-[22px]">
          {cards.map(({ href, label, value, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col gap-4 p-[22px] rounded-[26px] bg-[#e6d6ca] no-underline transition-shadow',
                RAISED_CARD, RAISED_CARD_HOVER
              )}
            >
              <div className={cn('w-[52px] h-[52px] rounded-2xl bg-[#e6d6ca] flex items-center justify-center', INSET_SM)} style={{ color }}>
                <Icon className="h-6 w-6" strokeWidth={2.25} />
              </div>
              <div>
                <p className="m-0 text-[30px] font-black tracking-tight leading-none text-[#4b3a2f]">{value}</p>
                <p className="mt-2 text-[13.5px] font-bold text-[#a58b78]">{label}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {/* lower panels */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-[22px]">
        {/* My Tasks */}
        <div className={cn('rounded-[28px] bg-[#e6d6ca] p-6 pb-3', RAISED_CARD)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="m-0 flex items-center gap-2.5 text-[18px] font-black text-[#4b3a2f]">
              <span className={cn('w-[38px] h-[38px] rounded-xl flex items-center justify-center bg-[#e6d6ca] text-[#c1673f]', RAISED_SM)}>
                <CheckSquare2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              My Tasks
            </h2>
            <Link href="/tasks" className="text-[13px] font-extrabold text-[#c1673f] no-underline">
              View all →
            </Link>
          </div>

          {sideLoading ? (
            <div className="space-y-2 pb-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : myTasks.length === 0 ? (
            <p className="text-sm font-semibold text-[#a58b78] text-center py-6">
              No tasks assigned to you this week.
            </p>
          ) : (
            <div className="flex flex-col">
              {myTasks.map(t => {
                const { text, overdue } = formatDue(t.due_date)
                const tickColor = overdue ? '#c1673f' : '#b09a86'
                const dueColor = overdue ? '#c1673f' : '#a58b78'
                return (
                  <div key={t.id} className="flex items-center gap-3.5 py-3.5 px-1.5 border-b border-[rgba(150,120,95,0.14)] last:border-b-0">
                    <span className={cn('w-[26px] h-[26px] flex-none rounded-[9px] bg-[#e6d6ca] flex items-center justify-center', INSET_SM)} style={{ color: tickColor }}>
                      {overdue ? <CircleAlert className="h-[15px] w-[15px]" strokeWidth={2.25} /> : <Square className="h-[15px] w-[15px]" strokeWidth={2.25} />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-[15px] font-bold text-[#4b3a2f] overflow-hidden text-ellipsis whitespace-nowrap">{t.title}</p>
                      <p className="mt-0.5 text-[12.5px] font-bold" style={{ color: dueColor }}>{text}</p>
                    </div>
                    <span className={cn('text-[11px] font-extrabold tracking-wide uppercase text-[#b09a86] bg-[#e6d6ca] px-2.5 py-1.5 rounded-full', INSET_SM)}>
                      {t.category}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Plants Needing Water */}
        <div className={cn('rounded-[28px] bg-[#e6d6ca] p-6 pb-3', RAISED_CARD)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="m-0 flex items-center gap-2.5 text-[18px] font-black text-[#4b3a2f]">
              <span className={cn('w-[38px] h-[38px] rounded-xl flex items-center justify-center bg-[#e6d6ca] text-[#c1673f]', RAISED_SM)}>
                <Droplet className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </span>
              Plants Needing Water
            </h2>
            <Link href="/plants" className="text-[13px] font-extrabold text-[#c1673f] no-underline">
              View all →
            </Link>
          </div>

          {sideLoading ? (
            <div className="space-y-2 pb-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-lg bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : plantsNeedingWater.length === 0 ? (
            <p className="text-sm font-semibold text-[#a58b78] text-center py-6">
              All your plants are watered. 🌿
            </p>
          ) : (
            <div className="flex flex-col">
              {plantsNeedingWater.map(p => {
                const overdue = plantWateringStatus(p) === 'overdue'
                return (
                  <Link
                    key={p.id}
                    href="/plants"
                    className="flex items-center gap-3.5 py-3.5 px-1.5 border-b border-[rgba(150,120,95,0.14)] last:border-b-0 no-underline"
                  >
                    <span className={cn('w-[26px] h-[26px] flex-none rounded-[9px] bg-[#e6d6ca] flex items-center justify-center', INSET_SM)} style={{ color: overdue ? '#c1673f' : '#b09a86' }}>
                      <Droplet className="h-[15px] w-[15px]" strokeWidth={2.25} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-[15px] font-bold text-[#4b3a2f] overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</p>
                      <p className="mt-0.5 text-[12.5px] font-bold" style={{ color: overdue ? '#c1673f' : '#a58b78' }}>
                        {overdue ? 'Overdue' : 'Due soon'}
                      </p>
                    </div>
                    {p.room && (
                      <span className={cn('text-[11px] font-extrabold tracking-wide uppercase text-[#b09a86] bg-[#e6d6ca] px-2.5 py-1.5 rounded-full', INSET_SM)}>
                        {p.room}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className={cn('rounded-[28px] bg-[#e6d6ca] p-6', RAISED_CARD)}>
          <h2 className="m-0 mb-[18px] flex items-center gap-2.5 text-[18px] font-black text-[#4b3a2f]">
            <span className={cn('w-[38px] h-[38px] rounded-xl flex items-center justify-center bg-[#e6d6ca] text-[#c1673f]', RAISED_SM)}>
              <Activity className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </span>
            Recent Activity
          </h2>

          {sideLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-8 rounded-lg bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-sm font-semibold text-[#a58b78] text-center py-6">
              No activity yet. Start adding tasks, events, or notes!
            </p>
          ) : (
            <div className="flex flex-col gap-[18px]">
              {activity.map(entry => {
                const name = entry.profiles?.full_name ?? 'Someone'
                const label = ACTION_LABELS[entry.action_type] ?? entry.action_type
                const timeAgo = formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })
                const color = colorFor(entry.user_id ?? name)
                return (
                  <div key={entry.id} className="flex items-start gap-3.5">
                    <div className={cn('w-[38px] h-[38px] flex-none rounded-full bg-[#e6d6ca] flex items-center justify-center text-[13px] font-black', RAISED_SM)} style={{ color }}>
                      {initials(name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="m-0 text-[14.5px] leading-snug text-[#6a5647]">
                        <strong className="text-[#4b3a2f] font-extrabold">{name}</strong> {label}{' '}
                        {entry.entity_title && <strong className="text-[#4b3a2f] font-extrabold">&quot;{entry.entity_title}&quot;</strong>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#b09a86]">
                        <Clock className="h-3 w-3" /> {timeAgo}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
