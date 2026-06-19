'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Phone, Mail, Globe, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = ['plumber', 'electrician', 'contractor', 'cleaner', 'landscaper', 'hvac', 'doctor', 'dentist', 'vet', 'neighbor', 'family', 'friend', 'other']

type FormData = {
  name: string
  category: string
  phone: string
  email: string
  website: string
  address: string
  notes: string
  last_service_date: string
}

const EMPTY_FORM: FormData = {
  name: '', category: 'other', phone: '', email: '',
  website: '', address: '', notes: '', last_service_date: '',
}

const CATEGORY_COLORS: Record<string, string> = {
  plumber: 'bg-blue-100 text-blue-700',
  electrician: 'bg-yellow-100 text-yellow-700',
  contractor: 'bg-orange-100 text-orange-700',
  cleaner: 'bg-green-100 text-green-700',
  landscaper: 'bg-emerald-100 text-emerald-700',
  hvac: 'bg-cyan-100 text-cyan-700',
  doctor: 'bg-red-100 text-red-700',
  dentist: 'bg-pink-100 text-pink-700',
  vet: 'bg-purple-100 text-purple-700',
  neighbor: 'bg-indigo-100 text-indigo-700',
  family: 'bg-rose-100 text-rose-700',
  friend: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(c: Contact) {
    setEditing(c)
    setForm({
      name: c.name,
      category: c.category,
      phone: c.phone ?? '',
      email: c.email ?? '',
      website: c.website ?? '',
      address: c.address ?? '',
      notes: c.notes ?? '',
      last_service_date: c.last_service_date ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    const payload = {
      name: form.name,
      category: form.category,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      address: form.address || null,
      notes: form.notes || null,
      last_service_date: form.last_service_date || null,
    }
    if (editing) {
      await supabase.from('contacts').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('contacts').insert(payload)
    }
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this contact?')) return
    await supabase.from('contacts').delete().eq('id', id)
    load()
  }

  const filtered = contacts.filter(c => {
    const matchSearch = search === '' || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || c.category === catFilter
    return matchSearch && matchCat
  })

  const usedCategories = ['all', ...Array.from(new Set(contacts.map(c => c.category)))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {usedCategories.map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize',
                catFilter === c
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border text-muted-foreground hover:border-foreground'
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No contacts found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className="p-4 rounded-xl border bg-card">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-semibold text-foreground">{c.name}</h3>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS.other)}>
                    {c.category}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => remove(c.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                  </a>
                )}
                {c.website && (
                  <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors truncate">
                    <Globe className="h-3.5 w-3.5 shrink-0" /> {c.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {c.address && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {c.address}
                  </p>
                )}
                {c.last_service_date && (
                  <p className="text-xs text-muted-foreground mt-2">Last service: {c.last_service_date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Contact' : 'New Contact'}</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name *</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name or business"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone</label>
                  <input
                    type="tel"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <input
                    type="email"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Website</label>
                <input
                  type="url"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Address</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Last Service Date</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.last_service_date}
                  onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editing ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
