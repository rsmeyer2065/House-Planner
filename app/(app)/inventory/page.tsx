'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { InventoryItem } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Search, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  async function load() {
    const { data } = await supabase.from('inventory_items').select('*').order('name')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      await supabase.from('inventory_items').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    load()
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
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Item
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {usedCats.map(c => (
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
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No items found. Add one to track your household inventory!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(item => {
            const ws = warrantyStatus(item.warranty_expiry)
            return (
              <div key={item.id} className="p-4 rounded-xl border bg-card">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                        {item.category}
                      </span>
                      {ws === 'expired' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Warranty expired
                        </span>
                      )}
                      {ws === 'expiring' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Expiring soon
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => remove(item.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Item' : 'New Item'}</h2>
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
                    placeholder="e.g. Refrigerator"
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
                  <label className="text-sm font-medium mb-1 block">Brand</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.brand}
                    onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
                    placeholder="e.g. Samsung"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Model</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Serial Number</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.serial_number}
                  onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Kitchen, Garage"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Purchase Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.purchase_date}
                    onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Purchase Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Warranty Expiry</label>
                <input
                  type="date"
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.warranty_expiry}
                  onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))}
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
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={save} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
