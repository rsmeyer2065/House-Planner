'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { InventoryItem } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, ICON_BTN_DANGER,
  CHIP_GROUP, chipClass, SOLID_CHIP, SEVERITY_META, qualitativeChip, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

type FormData = {
  name: string
  category: string
  brand: string
  model: string
  serial_number: string
  purchase_date: string
  purchase_price: string
  warranty_expiry: string
  location: string
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '', category: 'general', brand: '', model: '',
  serial_number: '', purchase_date: '', purchase_price: '',
  warranty_expiry: '', location: '', notes: '',
}

const CATEGORIES = ['general', 'appliance', 'electronics', 'furniture', 'tools', 'hvac', 'plumbing', 'electrical', 'outdoor', 'vehicle', 'other']

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: items = [], isPending: loading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async (): Promise<InventoryItem[]> => {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['inventory'] })

  useOpenAddParam(openAdd, !loading)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    setForm({
      name: item.name,
      category: item.category,
      brand: item.brand ?? '',
      model: item.model ?? '',
      serial_number: item.serial_number ?? '',
      purchase_date: item.purchase_date ?? '',
      purchase_price: item.purchase_price?.toString() ?? '',
      warranty_expiry: item.warranty_expiry ?? '',
      location: item.location ?? '',
      notes: item.notes ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    const payload = {
      name: form.name,
      category: form.category || 'general',
      brand: form.brand || null,
      model: form.model || null,
      serial_number: form.serial_number || null,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price ? Number(form.purchase_price) : null,
      warranty_expiry: form.warranty_expiry || null,
      location: form.location || null,
      notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('inventory_items').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
    }
    setShowModal(false)
    refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    refresh()
  }

  function warrantyStatus(expiry: string | null): 'expired' | 'expiring' | 'valid' | null {
    if (!expiry) return null
    const exp = new Date(expiry)
    const now = new Date()
    const in90 = new Date()
    in90.setDate(now.getDate() + 90)
    if (exp < now) return 'expired'
    if (exp < in90) return 'expiring'
    return 'valid'
  }

  const usedCats = ['all', ...Array.from(new Set(items.map(i => i.category)))]

  const filtered = items.filter(item => {
    const matchSearch = search === '' ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase()) ||
      item.location?.toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'all' || item.category === catFilter
    return matchSearch && matchCat
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Inventory</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Item
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b09a86]" />
          <input
            className={cn(INPUT, 'pl-10')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
          />
        </div>
        <div className={CHIP_GROUP}>
          {usedCats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={chipClass(catFilter === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No items found. Add one to track your household inventory!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const ws = warrantyStatus(item.warranty_expiry)
            return (
              <div key={item.id} className={cn('p-4', CARD)}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-extrabold text-[#4b3a2f] truncate">{item.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={SOLID_CHIP} style={{ backgroundColor: qualitativeChip(item.category).bg, color: qualitativeChip(item.category).tx }}>{item.category}</span>
                      {ws === 'expired' && (
                        <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.danger.bg, color: SEVERITY_META.danger.tx }}>
                          <AlertTriangle className="h-3 w-3" /> Warranty expired
                        </span>
                      )}
                      {ws === 'expiring' && (
                        <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.warning.bg, color: SEVERITY_META.warning.tx }}>
                          <AlertTriangle className="h-3 w-3" /> Expiring soon
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(item)} className={ICON_BTN}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(item.id)} className={ICON_BTN_DANGER}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs font-semibold text-[#a58b78]">
                  {(item.brand || item.model) && (
                    <p>{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
                  )}
                  {item.location && <p>Location: {item.location}</p>}
                  {item.purchase_date && <p>Purchased: {item.purchase_date}{item.purchase_price != null ? ` · $${Number(item.purchase_price).toFixed(2)}` : ''}</p>}
                  {item.warranty_expiry && <p>Warranty: {item.warranty_expiry}</p>}
                  {item.serial_number && <p>S/N: {item.serial_number}</p>}
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
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Item' : 'New Item'}</h2>
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
                    placeholder="e.g. Refrigerator"
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
                  <label className={LABEL}>Brand</label>
                  <input
                    className={INPUT}
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Samsung"
                  />
                </div>
                <div>
                  <label className={LABEL}>Model</label>
                  <input
                    className={INPUT}
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Serial Number</label>
                <input
                  className={INPUT}
                  value={form.serial_number}
                  onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                />
              </div>
              <div>
                <label className={LABEL}>Location</label>
                <input
                  className={INPUT}
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Kitchen, Garage"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Purchase Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Purchase Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={INPUT}
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Warranty Expiry</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.warranty_expiry}
                  onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))}
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
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
