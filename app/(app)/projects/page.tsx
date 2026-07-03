'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { Project, ProjectStatus, Priority } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Tag, Wallet, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, SUBTITLE,
  ICON_BTN, ICON_BTN_DANGER, CHIP_GROUP, chipClass, SOLID_CHIP, PRIORITY_META, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

const STATUS_META: Record<ProjectStatus, { label: string; bar: string; chipBg: string; chipTx: string }> = {
  planned: { label: 'Planned', bar: '#9a7b52', chipBg: '#e7ddce', chipTx: '#7a6142' },
  in_progress: { label: 'In progress', bar: '#c1673f', chipBg: '#efd9cf', chipTx: '#a24e30' },
  completed: { label: 'Completed', bar: '#6d8a52', chipBg: '#e2e5cf', chipTx: '#556f38' },
  on_hold: { label: 'On hold', bar: '#b5843a', chipBg: '#eee0c7', chipTx: '#8f6a1f' },
}

function pctFor(p: Project): number {
  if (p.status === 'completed') return 100
  if (p.status === 'planned') return 0
  if (p.status === 'on_hold') return 25
  if (p.estimated_cost && p.actual_cost != null && p.estimated_cost > 0) {
    return Math.min(95, Math.round((p.actual_cost / p.estimated_cost) * 100))
  }
  return 50
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

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

  useOpenAddParam(openAdd, !loading)

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
        <div>
          <h1 className="text-[32px] font-black tracking-tight text-[#4b3a2f]">Projects</h1>
          <p className={SUBTITLE}>Home improvements, tracked from plan to done.</p>
        </div>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Project
        </button>
      </div>

      <div className={CHIP_GROUP}>
        {(['all', 'planned', 'in_progress', 'completed', 'on_hold'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)} className={chipClass(filter === s)}>
            {s === 'all' ? 'All' : STATUS_META[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-3.5">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold rounded-[22px] shadow-[inset_4px_4px_10px_#ccb5a5,inset_-4px_-4px_10px_#f7ebe1] bg-[#e6d6ca]">
          No projects here. Add one to get started!
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {filtered.map(p => {
            const meta = STATUS_META[p.status]
            const prio = PRIORITY_META[p.priority]
            const pct = pctFor(p)
            const hasBudget = p.estimated_cost != null || p.actual_cost != null
            const hasDates = p.start_date || p.end_date
            return (
              <div key={p.id} className={cn('flex items-stretch gap-[18px] p-5', CARD)}>
                <span className="w-1.5 rounded-full flex-none" style={{ backgroundColor: meta.bar }} />
                <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-[16.5px] font-black text-[#4b3a2f]">{p.title}</h3>
                    <span className={SOLID_CHIP} style={{ backgroundColor: meta.chipBg, color: meta.chipTx }}>
                      {meta.label}
                    </span>
                    <span className={SOLID_CHIP} style={{ backgroundColor: prio.bg, color: prio.tx }}>
                      {p.priority}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-[13.5px] font-semibold text-[#8a7462] leading-relaxed line-clamp-2">{p.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-[12.5px] font-bold text-[#a58b78] mt-0.5">
                    <span className="inline-flex items-center gap-1.5"><Tag className="h-[13px] w-[13px]" /> {p.category}</span>
                    {hasBudget && (
                      <span className="inline-flex items-center gap-1.5">
                        <Wallet className="h-[13px] w-[13px]" />
                        {fmt(Number(p.actual_cost ?? 0))} / {p.estimated_cost != null ? fmt(Number(p.estimated_cost)) : '—'}
                      </span>
                    )}
                    {hasDates && (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-[13px] w-[13px]" /> {p.start_date ?? '—'} – {p.end_date ?? '—'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-2.5 rounded-full bg-[#e6d6ca] shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.bar }} />
                    </div>
                    <span className="text-xs font-extrabold text-[#8a7462] min-w-[34px] text-right">{pct}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-none">
                  <button onClick={() => openEdit(p)} className={ICON_BTN}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(p.id)} className={ICON_BTN_DANGER}>
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
