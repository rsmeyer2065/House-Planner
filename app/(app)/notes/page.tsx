'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { Note } from '@/lib/types'
import { Plus, X, Trash2, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { RAISED_SM, RAISED_LG_HOVER, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, MODAL_OVERLAY, MODAL_PANEL, hexFor } from '@/lib/neu'

const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'teal', 'red']

type FormData = {
  title: string
  content: string
  color: string
}

const EMPTY_FORM: FormData = { title: '', content: '', color: 'yellow' }

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  async function load() {
    const { data } = await supabase
      .from('notes')
      .select('*')
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    setNotes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useOpenAddParam(openAdd, !loading)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(note: Note) {
    setEditing(note)
    setForm({
      title: note.title ?? '',
      content: note.content,
      color: note.color,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.content.trim()) return
    const payload = {
      title: form.title || null,
      content: form.content,
      color: form.color,
    }
    if (editing) {
      const { error } = await supabase.from('notes').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('notes').insert({ ...payload, pinned: false, household_id })
      if (error) { toast.error(error.message); return }
      if (user) {
        await supabase.from('activity_log').insert({
          household_id,
          user_id: user.id,
          action_type: 'note_created',
          entity_title: payload.title ?? payload.content.slice(0, 60),
        })
      }
    }
    setShowModal(false)
    load()
  }

  async function togglePin(note: Note) {
    await supabase.from('notes').update({ pinned: !note.pinned }).eq('id', note.id)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this note?')) return
    await supabase.from('notes').delete().eq('id', id)
    load()
  }

  const pinned = notes.filter(n => n.pinned)
  const unpinned = notes.filter(n => !n.pinned)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Notes</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> New Note
        </button>
      </div>

      {loading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="break-inside-avoid mb-4 h-32 rounded-[22px] bg-[#dcc8ba] animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No notes yet. Create one to get started!</div>
      ) : (
        <div>
          {pinned.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-extrabold text-[#a58b78] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Pin className="h-3.5 w-3.5" /> Pinned
              </p>
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                {pinned.map(note => (
                  <NoteCard key={note.id} note={note} onEdit={openEdit} onPin={togglePin} onDelete={remove} />
                ))}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <p className="text-xs font-extrabold text-[#a58b78] uppercase tracking-wide mb-3">Other</p>
              )}
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                {unpinned.map(note => (
                  <NoteCard key={note.id} note={note} onEdit={openEdit} onPin={togglePin} onDelete={remove} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-md')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Note' : 'New Note'}</h2>
              <button onClick={() => setShowModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Title</label>
                <input
                  className={INPUT}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Optional title"
                />
              </div>
              <div>
                <label className={LABEL}>Content *</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-32')}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your note here..."
                  autoFocus
                />
              </div>
              <div>
                <label className={LABEL}>Color</label>
                <div className="flex gap-2 flex-wrap">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all',
                        form.color === c ? 'border-[#4b3a2f] scale-110' : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: hexFor(c) }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Create Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoteCard({
  note,
  onEdit,
  onPin,
  onDelete,
}: {
  note: Note
  onEdit: (n: Note) => void
  onPin: (n: Note) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={cn('break-inside-avoid mb-4 p-4 rounded-[22px] bg-[#e6d6ca] cursor-pointer group transition-shadow', RAISED_SM, RAISED_LG_HOVER)}
      onClick={() => onEdit(note)}
    >
      <div className="w-8 h-1.5 rounded-full mb-2.5" style={{ backgroundColor: hexFor(note.color) }} />
      {note.title && (
        <h3 className="font-extrabold text-[#4b3a2f] text-sm mb-1.5 line-clamp-2">{note.title}</h3>
      )}
      <p className="text-sm font-medium text-[#6a5647] whitespace-pre-wrap line-clamp-6">{note.content}</p>
      <div
        className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs font-bold text-[#b09a86]">
          {new Date(note.updated_at).toLocaleDateString()}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => onPin(note)}
            className="p-1 rounded text-[#8a7462] hover:text-[#4b3a2f] transition-colors"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 rounded text-[#b5574a] hover:text-[#9a4a3f] transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
