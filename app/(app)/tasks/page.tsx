'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Task, Priority, RecurrenceType, Profile } from '@/lib/types'
import { Plus, X, Pencil, Trash2, CheckSquare2, Square, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Task
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1.5">
          {(['all', 'pending', 'completed'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium border transition-colors capitalize',
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-foreground'
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {(currentUserId || hasPartner) && (
          <div className="flex gap-1.5 border-l pl-2">
            {([
              ['all', 'Everyone'],
              ['mine', 'Mine'],
              ...(hasPartner ? [['partners', "Partner's"], ['unassigned', 'Unassigned']] : []),
            ] as [AssignFilter, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setAssignFilter(val)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium border transition-colors',
                  assignFilter === val
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-background border-border text-muted-foreground hover:border-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No tasks here. Add one to get started!</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(t => {
            const assignee = t.assigned_to ? profileMap[t.assigned_to] : null
            return (
              <div key={t.id} className={cn('flex items-center gap-3 p-4 rounded-xl border bg-card', t.status === 'completed' && 'opacity-60')}>
                <button onClick={() => toggleComplete(t)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {t.status === 'completed'
                    ? <CheckSquare2 className="h-5 w-5 text-primary" />
                    : <Square className="h-5 w-5" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('text-sm font-medium', t.status === 'completed' && 'line-through text-muted-foreground')}>
                      {t.title}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', PRIORITY_COLORS[t.priority])}>
                      {t.priority}
                    </span>
                    {t.recurrence !== 'none' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {t.recurrence}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-muted-foreground">
                    {t.category !== 'general' && <span>{t.category}</span>}
                    {t.due_date && (
                      <span className={cn(isOverdue(t) && 'text-destructive font-medium')}>
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
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  <button onClick={() => remove(t.id)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Task' : 'New Task'}</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Priority</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Assign To</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <label className="text-sm font-medium mb-1 block">Recurrence</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Cleaning, Garden"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Due Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.due_date}
                  onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {editing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
