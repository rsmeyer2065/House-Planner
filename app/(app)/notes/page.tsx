'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Note } from '@/lib/types'
import { Plus, X, Trash2, Pin, PinOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const NOTE_COLORS = ['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'teal', 'red']

const COLOR_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-50 border-yellow-200',
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  pink: 'bg-pink-50 border-pink-200',
  purple: 'bg-purple-50 border-purple-200',
  orange: 'bg-orange-50 border-orange-200',
  teal: 'bg-teal-50 border-teal-200',
  red: 'bg-red-50 border-red-200',
}

const DOT_CLASSES: Record<string, string> = {
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  pink: 'bg-pink-400',
  purple: 'bg-purple-400',
  orange: 'bg-orange-400',
  teal: 'bg-teal-400',
  red: 'bg-red-400',
}

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
      const { error } = await supabase.from('notes').insert({ ...payload, pinned: false, household_id })
      if (error) { toast.error(error.message); return }
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> New Note
        </button>
      </div>

      {loading ? (
        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="break-inside-avoid mb-4 h-32 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No notes yet. Create one to get started!</div>
      ) : (
        <div>
          {pinned.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
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
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Other</p>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Note' : 'New Note'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Optional title"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Content *</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none h-32 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Write your note here..."
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 transition-all',
                        DOT_CLASSES[c],
                        form.color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
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
      className={cn(
        'break-inside-avoid mb-4 p-4 rounded-xl border cursor-pointer group transition-shadow hover:shadow-md',
        COLOR_CLASSES[note.color] ?? COLOR_CLASSES.yellow
      )}
      onClick={() => onEdit(note)}
    >
      {note.title && (
        <h3 className="font-semibold text-foreground text-sm mb-1.5 line-clamp-2">{note.title}</h3>
      )}
      <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">{note.content}</p>
      <div
        className="flex items-center justify-between mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-xs text-foreground/50">
          {new Date(note.updated_at).toLocaleDateString()}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => onPin(note)}
            className="p-1 rounded hover:bg-black/10 transition-colors"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 rounded hover:bg-black/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
