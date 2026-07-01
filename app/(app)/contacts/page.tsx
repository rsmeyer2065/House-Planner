'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Contact } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Phone, Mail, Globe, MapPin, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, ICON_BTN_DANGER,
  CHIP_GROUP, chipClass, SOLID_CHIP, qualitativeChip, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

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
      const { error } = await supabase.from('contacts').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('contacts').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Contacts</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Contact
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b09a86]" />
          <input
            className={cn(INPUT, 'pl-10')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts..."
          />
        </div>
        <div className={CHIP_GROUP}>
          {usedCategories.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={chipClass(catFilter === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No contacts found.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c.id} className={cn('p-4', CARD)}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-extrabold text-[#4b3a2f]">{c.name}</h3>
                  <span className={cn(SOLID_CHIP, 'mt-1')} style={{ backgroundColor: qualitativeChip(c.category).bg, color: qualitativeChip(c.category).tx }}>
                    {c.category}
                  </span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(c)} className={ICON_BTN}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c.id)} className={ICON_BTN_DANGER}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm font-semibold text-[#8a7462] hover:text-[#4b3a2f] transition-colors">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm font-semibold text-[#8a7462] hover:text-[#4b3a2f] transition-colors truncate">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                  </a>
                )}
                {c.website && (
                  <a href={c.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[#8a7462] hover:text-[#4b3a2f] transition-colors truncate">
                    <Globe className="h-3.5 w-3.5 shrink-0" /> {c.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {c.address && (
                  <p className="flex items-start gap-2 text-sm font-semibold text-[#8a7462]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {c.address}
                  </p>
                )}
                {c.last_service_date && (
                  <p className="text-xs font-bold text-[#b09a86] mt-2">Last service: {c.last_service_date}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-lg')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Contact' : 'New Contact'}</h2>
              <button onClick={() => setShowModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Name *</label>
                  <input
                    className={INPUT}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Full name or business"
                  />
                </div>
                <div>
                  <label className={LABEL}>Category</label>
                  <select
                    className={cn(INPUT, 'capitalize')}
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Phone</label>
                  <input
                    type="tel"
                    className={INPUT}
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Email</label>
                  <input
                    type="email"
                    className={INPUT}
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Website</label>
                <input
                  type="url"
                  className={INPUT}
                  value={form.website}
                  onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://"
                />
              </div>
              <div>
                <label className={LABEL}>Address</label>
                <input
                  className={INPUT}
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>Notes</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>Last Service Date</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.last_service_date}
                  onChange={e => setForm(f => ({ ...f, last_service_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
