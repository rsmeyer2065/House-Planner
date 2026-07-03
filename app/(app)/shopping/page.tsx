'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { ShoppingList, ShoppingItem } from '@/lib/types'
import { Plus, X, Trash2, CheckSquare2, Square, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  RAISED_SM, CARD, BTN_PRIMARY, BTN_GHOST, BTN_DANGER_GHOST, INPUT, ICON_BTN, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

type ShoppingData = {
  lists: ShoppingList[]
  items: Record<string, ShoppingItem[]>
}

export default function ShoppingPage() {
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [showListModal, setShowListModal] = useState(false)
  const [listName, setListName] = useState('')
  const [newItem, setNewItem] = useState({ name: '', quantity: '', category: '' })
  const [showItemForm, setShowItemForm] = useState(false)
  const [isLive, setIsLive] = useState(false)

  const [supabase] = useState(() => createClient())
  const queryClient = useQueryClient()

  const { data, isPending: loading } = useQuery({
    queryKey: ['shopping'],
    queryFn: async (): Promise<ShoppingData> => {
      const { data: listsData, error: listsError } = await supabase
        .from('shopping_lists')
        .select('*')
        .order('created_at', { ascending: false })
      if (listsError) throw listsError
      const lists: ShoppingList[] = listsData ?? []

      const grouped: Record<string, ShoppingItem[]> = {}
      if (lists.length > 0) {
        const ids = lists.map(l => l.id)
        const { data: itemsData, error: itemsError } = await supabase
          .from('shopping_items')
          .select('*')
          .in('list_id', ids)
          .order('created_at', { ascending: true })
        if (itemsError) throw itemsError
        for (const item of itemsData ?? []) {
          if (!grouped[item.list_id]) grouped[item.list_id] = []
          grouped[item.list_id].push(item)
        }
      }
      return { lists, items: grouped }
    },
  })

  const lists = data?.lists ?? []
  const items = data?.items ?? {}
  // Fall back to the first list when nothing is selected (or the selected
  // list no longer exists, e.g. after it was deleted).
  const selectedList = selectedListId && lists.some(l => l.id === selectedListId)
    ? selectedListId
    : lists[0]?.id ?? null

  useOpenAddParam(() => setShowListModal(true), !loading)

  useEffect(() => {
    const channel = supabase.channel('shopping-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shopping_items' },
        (payload) => {
          queryClient.setQueryData<ShoppingData>(['shopping'], prev => {
            if (!prev) return prev
            const listId =
              (payload.new as ShoppingItem)?.list_id ??
              (payload.old as Partial<ShoppingItem>)?.list_id

            if (!listId || !prev.lists.find(l => l.id === listId)) return prev

            const current = prev.items[listId] ?? []
            let next: ShoppingItem[]
            if (payload.eventType === 'INSERT') {
              const newRow = payload.new as ShoppingItem
              if (current.find(i => i.id === newRow.id)) return prev
              next = [...current, newRow]
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as ShoppingItem
              next = current.map(i => i.id === updated.id ? updated : i)
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as Partial<ShoppingItem>
              next = current.filter(i => i.id !== deleted.id)
            } else {
              return prev
            }
            return { ...prev, items: { ...prev.items, [listId]: next } }
          })
        }
      )
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED')
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient])

  async function createList() {
    if (!listName.trim()) return
    const household_id = await getHouseholdId(supabase)
    if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
    const { data, error } = await supabase
      .from('shopping_lists')
      .insert({ name: listName, household_id })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    setListName('')
    setShowListModal(false)
    await queryClient.invalidateQueries({ queryKey: ['shopping'] })
    if (data) setSelectedListId(data.id)
  }

  async function deleteList(id: string) {
    if (!confirm('Delete this list and all its items?')) return
    await supabase.from('shopping_lists').delete().eq('id', id)
    if (selectedListId === id) setSelectedListId(null)
    queryClient.invalidateQueries({ queryKey: ['shopping'] })
  }

  async function addItem() {
    if (!newItem.name.trim() || !selectedList) return
    const { error } = await supabase.from('shopping_items').insert({
      list_id: selectedList,
      name: newItem.name,
      quantity: newItem.quantity || null,
      category: newItem.category || null,
      checked: false,
    })
    if (error) { toast.error(error.message); return }
    setNewItem({ name: '', quantity: '', category: '' })
    setShowItemForm(false)
  }

  async function toggleItem(item: ShoppingItem) {
    await supabase.from('shopping_items').update({ checked: !item.checked }).eq('id', item.id)

    if (!item.checked) {
      const { data: { user } } = await supabase.auth.getUser()
      const household_id = await getHouseholdId(supabase)
      if (user && household_id) {
        await supabase.from('activity_log').insert({
          household_id,
          user_id: user.id,
          action_type: 'shopping_checked',
          entity_title: item.name,
        })
      }
    }
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
  }

  async function clearChecked() {
    if (!selectedList) return
    const checked = (items[selectedList] ?? []).filter(i => i.checked).map(i => i.id)
    if (checked.length === 0) return
    await supabase.from('shopping_items').delete().in('id', checked)
  }

  const currentItems = selectedList ? (items[selectedList] ?? []) : []
  const checkedCount = currentItems.filter(i => i.checked).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Shopping</h1>
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#7c9a6e] bg-[#e6d6ca] shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7c9a6e] animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button onClick={() => setShowListModal(true)} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> New List
        </button>
      </div>

      {loading ? (
        <div className="h-48 rounded-[22px] bg-[#dcc8ba] animate-pulse" />
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">
          <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No shopping lists yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[220px_1fr] gap-5">
          {/* List sidebar */}
          <div className="flex flex-col gap-1.5">
            {lists.map(list => (
              <div key={list.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => setSelectedListId(list.id)}
                  className={cn(
                    'flex-1 text-left px-3.5 py-2.5 rounded-2xl text-sm font-bold transition-shadow truncate',
                    selectedList === list.id
                      ? 'bg-[#c1673f] text-[#faf1e9] shadow-[3px_3px_8px_#ccb5a5,-2px_-2px_6px_#f7ebe1]'
                      : 'text-[#6a5647] hover:shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1]'
                  )}
                >
                  {list.name}
                  <span className={cn('ml-2 text-xs', selectedList === list.id ? 'text-[#faf1e9]/70' : 'text-[#a58b78]')}>
                    {(items[list.id] ?? []).length}
                  </span>
                </button>
                <button
                  onClick={() => deleteList(list.id)}
                  className="p-1.5 rounded-xl text-[#b5574a] opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Items panel */}
          {selectedList && (
            <div className={cn('p-5', CARD)}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-sm font-bold text-[#a58b78]">
                  {checkedCount} of {currentItems.length} items checked
                </p>
                <div className="flex gap-2">
                  {checkedCount > 0 && (
                    <button onClick={clearChecked} className={cn(BTN_DANGER_GHOST, 'px-3.5 py-2 text-xs')}>
                      Clear checked
                    </button>
                  )}
                  <button onClick={() => setShowItemForm(v => !v)} className={cn(BTN_PRIMARY, 'px-3.5 py-2 text-xs')}>
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                </div>
              </div>

              {showItemForm && (
                <div className={cn('flex flex-col sm:flex-row gap-2 mb-4 p-3.5 rounded-2xl', RAISED_SM)}>
                  <input
                    className={cn(INPUT, 'flex-1')}
                    value={newItem.name}
                    onChange={e => setNewItem(n => ({ ...n, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addItem()}
                    placeholder="Item name *"
                    autoFocus
                  />
                  <input
                    className={cn(INPUT, 'sm:w-24')}
                    value={newItem.quantity}
                    onChange={e => setNewItem(n => ({ ...n, quantity: e.target.value }))}
                    placeholder="Qty"
                  />
                  <input
                    className={cn(INPUT, 'sm:w-28')}
                    value={newItem.category}
                    onChange={e => setNewItem(n => ({ ...n, category: e.target.value }))}
                    placeholder="Category"
                  />
                  <button onClick={addItem} className={BTN_PRIMARY}>
                    Add
                  </button>
                </div>
              )}

              {currentItems.length === 0 ? (
                <p className="text-center text-[#a58b78] font-semibold py-8 text-sm">No items yet. Add one above!</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(
                    currentItems.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
                      const key = item.category ?? 'Other'
                      if (!acc[key]) acc[key] = []
                      acc[key].push(item)
                      return acc
                    }, {})
                  ).map(([cat, catItems]) => (
                    <div key={cat}>
                      <p className="text-xs font-extrabold text-[#a58b78] uppercase tracking-wide mt-3 mb-1 px-1">{cat}</p>
                      {catItems.map(item => (
                        <div key={item.id} className="flex items-center gap-3 py-2.5 px-1.5 rounded-xl hover:shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1] group/item transition-shadow">
                          <button onClick={() => toggleItem(item)} className="shrink-0 text-[#b09a86] hover:text-[#c1673f] transition-colors">
                            {item.checked
                              ? <CheckSquare2 className="h-5 w-5 text-[#c1673f]" strokeWidth={2.25} />
                              : <Square className="h-5 w-5" strokeWidth={2.25} />
                            }
                          </button>
                          <span className={cn('flex-1 text-sm font-bold text-[#4b3a2f]', item.checked && 'line-through text-[#a58b78]')}>
                            {item.name}
                            {item.quantity && <span className="text-[#a58b78] ml-1 font-semibold">× {item.quantity}</span>}
                          </span>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="p-1 rounded text-[#b5574a] opacity-0 group-hover/item:opacity-100 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-sm')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">New Shopping List</h2>
              <button onClick={() => setShowListModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <input
              className={cn(INPUT, 'mb-4')}
              value={listName}
              onChange={e => setListName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createList()}
              placeholder="e.g. Weekly groceries"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setShowListModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={createList} className={cn(BTN_PRIMARY, 'flex-1')}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
