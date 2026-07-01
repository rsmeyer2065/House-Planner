'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Task, Priority, RecurrenceType, Profile } from '@/lib/types'
import { Plus, X, Pencil, Trash2, CheckSquare2, Square, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL,
  ICON_BTN, ICON_BTN_DANGER, pillClass, BADGE, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

const PRIORITY_HEX: Record<Priority, string> = {
  low: '#7c9a6e',
  medium: '#c47a3d',
  high: '#c1673f',
}

type AssignFilter = 'all' | 'mine' | 'partners' | 'unassigned'

type FormData = {
  title: string
  description: string
  priority: Priority
  category: string
  due_date: string
  recurrence: RecurrenceType
  assigned_to: string
}

const EMPTY_FORM: FormData = {
  title: '', description: '', priority: 'medium',
  category: 'general', due_date: '', recurrence: 'none', assigned_to: '',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [assignFilter, setAssignFilter] = useState<AssignFilter>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  const profileMap = Object.fromEntries(members.map(m => [m.id, m]))

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const [tasksRes, membersRes] = await Promise.all([
      supabase.from('tasks')
        .select('*')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ])
    setTasks(tasksRes.data ?? [])
    setMembers(membersRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function logActivity(householdId: string, userId: string, actionType: string, entityId: string, entityTitle: string) {
    await supabase.from('activity_log').insert({
      household_id: householdId,
      user_id: userId,
      action_type: actionType,
      entity_id: entityId,
      entity_title: entityTitle,
    })
  }

  async function toggleComplete(task: Task) {
    const completing = task.status === 'pending'
    const now = new Date().toISOString()
    await supabase.from('tasks').update({
      status: completing ? 'completed' : 'pending',
      completed_at: completing ? now : null,
    }).eq('id', task.id)

    if (completing && currentUserId) {
      const household_id = await getHouseholdId(supabase)
      if (household_id) {
        await logActivity(household_id, currentUserId, 'task_completed', task.id, task.title)
      }
    }
    load()
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, assigned_to: currentUserId })
    setShowModal(true)
  }

  function openEdit(t: Task) {
    setEditing(t)
    setForm({
      title: t.title,
      description: t.description ?? '',
      priority: t.priority,
      category: t.category,
      due_date: t.due_date ?? '',
      recurrence: t.recurrence,
      assigned_to: t.assigned_to ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim()) return
    const payload = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      category: form.category || 'general',
      due_date: form.due_date || null,
      recurrence: form.recurrence,
      assigned_to: form.assigned_to || null,
    }
    if (editing) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { data, error } = await supabase.from('tasks')
        .insert({ ...payload, status: 'pending', household_id })
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      if (data && currentUserId) {
        await logActivity(household_id, currentUserId, 'task_created', data.id, data.title)
      }
    }
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', id)
    load()
  }

  const filtered = tasks.filter(t => {
    if (statusFilter === 'pending' && t.status !== 'pending') return false
    if (statusFilter === 'completed' && t.status !== 'completed') return false
    if (assignFilter === 'mine' && t.assigned_to !== currentUserId) return false
    if (assignFilter === 'partners' && (t.assigned_to === currentUserId || !t.assigned_to)) return false
    if (assignFilter === 'unassigned' && t.assigned_to !== null) return false
    return true
  })

  const isOverdue = (t: Task) =>
    t.status === 'pending' && t.due_date && new Date(t.due_date) < new Date()

  const hasPartner = members.some(m => m.id !== currentUserId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Tasks</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Task
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5">
          {(['all', 'pending', 'completed'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={pillClass(statusFilter === s)}>
              {s}
            </button>
          ))}
        </div>

        {(currentUserId || hasPartner) && (
          <div className="flex gap-1.5 border-l border-[rgba(150,120,95,0.25)] pl-2.5">
            {([
              ['all', 'Everyone'],
              ['mine', 'Mine'],
              ...(hasPartner ? [['partners', "Partner's"], ['unassigned', 'Unassigned']] : []),
            ] as [AssignFilter, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setAssignFilter(val)} className={pillClass(assignFilter === val)}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No tasks here. Add one to get started!</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(t => {
            const assignee = t.assigned_to ? profileMap[t.assigned_to] : null
            return (
              <div key={t.id} className={cn('flex items-center gap-3 p-4', CARD, t.status === 'completed' && 'opacity-60')}>
                <button onClick={() => toggleComplete(t)} className="shrink-0 text-[#b09a86] hover:text-[#c1673f] transition-colors">
                  {t.status === 'completed'
                    ? <CheckSquare2 className="h-5 w-5 text-[#c1673f]" strokeWidth={2.25} />
                    : <Square className="h-5 w-5" strokeWidth={2.25} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm font-bold text-[#4b3a2f]', t.status === 'completed' && 'line-through text-[#a58b78]')}>
                      {t.title}
                    </span>
                    <span className={BADGE} style={{ color: PRIORITY_HEX[t.priority] }}>{t.priority}</span>
                    {t.recurrence !== 'none' && (
                      <span className={BADGE} style={{ color: '#7d93a0' }}>{t.recurrence}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1 text-xs font-bold text-[#a58b78]">
                    {t.category !== 'general' && <span>{t.category}</span>}
                    {t.due_date && (
                      <span className={cn(isOverdue(t) && 'text-[#c1673f]')}>
                        Due: {t.due_date}
                      </span>
                    )}
                    {assignee && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {assignee.id === currentUserId ? 'You' : (assignee.full_name ?? 'Partner')}
                      </span>
                    )}
                    {t.description && <span className="truncate max-w-xs">{t.description}</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(t)} className={ICON_BTN}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(t.id)} className={ICON_BTN_DANGER}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-md')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowModal(false)} className={ICON_BTN}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Title *</label>
                <input
                  className={INPUT}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Priority</label>
                  <select
                    className={INPUT}
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Assign To</label>
                  <select
                    className={INPUT}
                    value={form.assigned_to}
                    onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.id === currentUserId ? 'Me' : (m.full_name ?? 'Partner')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Recurrence</label>
                  <select
                    className={INPUT}
                    value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as RecurrenceType }))}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Category</label>
                  <input
                    className={INPUT}
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Cleaning, Garden"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Due Date</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>
                Cancel
              </button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
