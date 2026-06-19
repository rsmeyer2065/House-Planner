'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ShoppingList, ShoppingItem } from '@/lib/types'
import { Plus, X, Trash2, CheckSquare2, Square, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ShoppingPage() {
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [items, setItems] = useState<Record<string, ShoppingItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedList, setSelectedList] = useState<string | null>(null)
  const [showListModal, setShowListModal] = useState(false)
  const [listName, setListName] = useState('')
  const [newItem, setNewItem] = useState({ name: '', quantity: '', category: '' })
  const [showItemForm, setShowItemForm] = useState(false)

  const supabase = createClient()

  async function load() {
    const { data: listsData } = await supabase
      .from('shopping_lists')
      .select('*')
      .order('created_at', { ascending: false })
    setLists(listsData ?? [])

    if (listsData && listsData.length > 0) {
      const ids = listsData.map(l => l.id)
      const { data: itemsData } = await supabase
        .from('shopping_items')
        .select('*')
        .in('list_id', ids)
        .order('created_at', { ascending: true })

      const grouped: Record<string, ShoppingItem[]> = {}
      for (const item of itemsData ?? []) {
        if (!grouped[item.list_id]) grouped[item.list_id] = []
        grouped[item.list_id].push(item)
      }
      setItems(grouped)

      if (!selectedList && listsData.length > 0) {
        setSelectedList(listsData[0].id)
      }
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function createList() {
    if (!listName.trim()) return
    const { data } = await supabase.from('shopping_lists').insert({ name: listName }).select().single()
    setListName('')
    setShowListModal(false)
    await load()
    if (data) setSelectedList(data.id)
  }

  async function deleteList(id: string) {
    if (!confirm('Delete this list and all its items?')) return
    await supabase.from('shopping_lists').delete().eq('id', id)
    if (selectedList === id) setSelectedList(null)
    load()
  }

  async function addItem() {
    if (!newItem.name.trim() || !selectedList) return
    await supabase.from('shopping_items').insert({
      list_id: selectedList,
      name: newItem.name,
      quantity: newItem.quantity || null,
      category: newItem.category || null,
      checked: false,
    })
    setNewItem({ name: '', quantity: '', category: '' })
    setShowItemForm(false)
    load()
  }

  async function toggleItem(item: ShoppingItem) {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)
    load()
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
    load()
  }

  async function clearChecked() {
    if (!selectedList) return
    const checked = (items[selectedList] ?? []).filter(i => i.checked).map(i => i.id)
    if (checked.length === 0) return
    await supabase.from('shopping_items').delete().in('id', checked)
    load()
  }

  const currentItems = selectedList ? (items[selectedList] ?? []) : []
  const checkedCount = currentItems.filter(i => i.checked).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Shopping</h1>
        <button
          onClick={() => setShowListModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> New List
        </button>
      </div>

      {loading ? (
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No shopping lists yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          {/* List sidebar */}
          <div className="flex flex-col gap-1">
            {lists.map(list => (
              <div key={list.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => setSelectedList(list.id)}
                  className={cn(
                    'flex-1 text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors truncate',
                    selectedList === list.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  {list.name}
                  <span className={cn('ml-2 text-xs', selectedList === list.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {(items[list.id] ?? []).length}
                  </span>
                </button>
                <button
                  onClick={() => deleteList(list.id)}
                  className="p-1.5 rounded-lg hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </button>
              </div>
            ))}
          </div>

          {/* Items panel */}
          {selectedList && (
            <div className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {checkedCount} of {currentItems.length} items checked
                </p>
                <div className="flex gap-2">
                  {checkedCount > 0 && (
                    <button
                      onClick={clearChecked}
                      className="text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors"
                    >
                      Clear checked
                    </button>
                  )}
                  <button
                    onClick={() => setShowItemForm(v => !v)}
                    className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                </div>
              </div>

              {showItemForm && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4 p-3 rounded-lg bg-muted/50 border">
                  <input
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newItem.name}
                    onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Item name *"
                    autoFocus
                  />
                  <input
                    className="w-24 border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newItem.quantity}
                    onChange={e => setNewItem(n => ({ ...n, quantity: e.target.value }))}
                    placeholder="Qty"
                  />
                  <input
                    className="w-28 border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newItem.category}
                    onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
                    placeholder="Category"
                  />
                  <button
                    onClick={addItem}
                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Add
                  </button>
                </div>
              )}

              {currentItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No items yet. Add one above!</p>
              ) : (
                <div className="space-y-1">
                  {/* Group by category */}
                  {Object.entries(
                    currentItems.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
                      const key = item.category ?? 'Other'
                      if (!acc[key]) acc[key] = []
                      acc[key].push(item)
                      return acc
                    }, {})
                  ).map(([cat, catItems]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1 px-1">{cat}</p>
                      {catItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-muted/50 group/item">
                          <button onClick={() => toggleItem(item)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                            {item.checked
                              ? <CheckSquare2 className="h-5 w-5 text-primary" />
                              : <Square className="h-5 w-5" />
                            }
                          </button>
                          <span className={cn('flex-1 text-sm', item.checked && 'line-through text-muted-foreground')}>
                            {item.name}
                            {item.quantity && <span className="text-muted-foreground ml-1">× {item.quantity}</span>}
                          </span>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1 rounded hover:bg-muted opacity-0 group-hover/item:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showListModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">New Shopping List</h2>
              <button onClick={() => setShowListModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary mb-4"
              value={listName}
              onChange={e => setListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()}
              placeholder="e.g. Weekly groceries"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowListModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={createList} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
