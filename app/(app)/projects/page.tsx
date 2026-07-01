'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Project, ProjectStatus, Priority } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Hammer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  RAISED_SM, CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL,
  ICON_BTN, ICON_BTN_DANGER, pillClass, BADGE, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

const STATUS_HEX: Record<ProjectStatus, string> = {
  planned: '#a58b78',
  in_progress: '#c47a3d',
  completed: '#7c9a6e',
  on_hold: '#bd6b6f',
}

const PRIORITY_HEX: Record<Priority, string> = {
  low: '#7c9a6e',
  medium: '#c47a3d',
  high: '#c1673f',
}

type FormData = {
  title: string
  description: string
  status: ProjectStatus
  category: string
  priority: Priority
  estimated_cost: string
  actual_cost: string
  start_date: string
  end_date: string
}

const EMPTY_FORM: FormData = {
  title: '', description: '', status: 'planned', category: 'general',
  priority: 'medium', estimated_cost: '', actual_cost: '', start_date: '', end_date: '',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p: Project) {
    setEditing(p)
    setForm({
      title: p.title,
      description: p.description ?? '',
      status: p.status,
      category: p.category,
      priority: p.priority,
      estimated_cost: p.estimated_cost?.toString() ?? '',
      actual_cost: p.actual_cost?.toString() ?? '',
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim()) return
    const payload = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      category: form.category || 'general',
      priority: form.priority,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      actual_cost: form.actual_cost ? Number(form.actual_cost) : null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    if (editing) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('projects').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
    }
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    load()
  }

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Projects</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Project
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'planned', 'in_progress', 'completed', 'on_hold'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={pillClass(filter === s)}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No projects found. Add one to get started!</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(p => (
            <div key={p.id} className={cn('flex items-start gap-4 p-5', CARD)}>
              <div className={cn('w-11 h-11 rounded-2xl shrink-0 bg-[#e6d6ca] flex items-center justify-center text-[#bf6a48]', RAISED_SM)}>
                <Hammer className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h3 className="font-extrabold text-[#4b3a2f]">{p.title}</h3>
                  <span className={BADGE} style={{ color: STATUS_HEX[p.status] }}>{p.status.replace('_', ' ')}</span>
                  <span className={BADGE} style={{ color: PRIORITY_HEX[p.priority] }}>{p.priority}</span>
                </div>
                {p.description && (
                  <p className="text-sm font-medium text-[#6a5647] mb-2 line-clamp-2">{p.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-[#a58b78]">
                  <span>Category: {p.category}</span>
                  {p.estimated_cost != null && <span>Budget: ${Number(p.estimated_cost).toFixed(2)}</span>}
                  {p.actual_cost != null && <span>Actual: ${Number(p.actual_cost).toFixed(2)}</span>}
                  {p.start_date && <span>Start: {p.start_date}</span>}
                  {p.end_date && <span>End: {p.end_date}</span>}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(p)} className={ICON_BTN}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(p.id)} className={ICON_BTN_DANGER}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-lg')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Project' : 'New Project'}</h2>
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
                  placeholder="Project title"
                />
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-20')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Status</label>
                  <select
                    className={INPUT}
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
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
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <input
                  className={INPUT}
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Kitchen, Bathroom, Garden"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Est. Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={INPUT}
                    value={form.estimated_cost}
                    onChange={e => setForm(f => ({ ...f, estimated_cost: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Actual Cost ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={INPUT}
                    value={form.actual_cost}
                    onChange={e => setForm(f => ({ ...f, actual_cost: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Start Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>End Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>
                Cancel
              </button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
