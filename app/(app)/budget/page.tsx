'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { Transaction, BudgetCategory, Profile } from '@/lib/types'
import { Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, ICON_BTN_DANGER,
  CHIP_GROUP, chipClass, MODAL_OVERLAY, MODAL_PANEL, hexFor,
} from '@/lib/neu'

type FormData = {
  title: string
  amount: string
  category_id: string
  paid_by: string
  date: string
  notes: string
}

type CatFormData = {
  name: string
  monthly_budget: string
  color: string
}

const currentMonth = () => new Date().toISOString().slice(0, 10)

const EMPTY_TXN: FormData = {
  title: '', amount: '', category_id: '', paid_by: '',
  date: currentMonth(), notes: '',
}

const EMPTY_CAT: CatFormData = {
  name: '', monthly_budget: '', color: 'gray',
}

const COLORS = ['gray', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'teal', 'yellow']

const UNCATEGORIZED = 'uncategorized'
const UNKNOWN_PAYER = 'unknown'

const fmt = (n: number) => `$${n.toFixed(2)}`
const memberName = (p: Pick<Profile, 'full_name'> | undefined) =>
  p?.full_name?.trim() || 'Unnamed'

type MatrixResult = {
  rowIds: string[]
  rowLabels: Record<string, string>
  colIds: string[]
  colLabels: Record<string, string>
  cells: Record<string, Record<string, number>>
  rowTotals: Record<string, number>
  colTotals: Record<string, number>
  grand: number
}

function buildMatrix(
  txns: Transaction[],
  categories: BudgetCategory[],
  members: Profile[]
): MatrixResult {
  const catName = new Map(categories.map(c => [c.id, c.name]))
  const memberLabel = new Map(members.map(m => [m.id, memberName(m)]))

  const cells: Record<string, Record<string, number>> = {}
  const rowTotals: Record<string, number> = {}
  const colTotals: Record<string, number> = {}
  const rowLabels: Record<string, string> = {}
  const colLabels: Record<string, string> = {}
  const rowOrder: string[] = []
  const colOrder: string[] = []
  let grand = 0

  for (const t of txns) {
    const rowId = t.category_id ?? UNCATEGORIZED
    const colId = t.created_by ?? UNKNOWN_PAYER
    const amount = Number(t.amount)

    if (!(rowId in rowLabels)) {
      rowLabels[rowId] =
        rowId === UNCATEGORIZED ? 'Uncategorized' : catName.get(rowId) ?? 'Uncategorized'
      rowOrder.push(rowId)
    }
    if (!(colId in colLabels)) {
      colLabels[colId] =
        colId === UNKNOWN_PAYER ? 'Unknown' : memberLabel.get(colId) ?? 'Unknown'
      colOrder.push(colId)
    }

    cells[rowId] ??= {}
    cells[rowId][colId] = (cells[rowId][colId] ?? 0) + amount
    rowTotals[rowId] = (rowTotals[rowId] ?? 0) + amount
    colTotals[colId] = (colTotals[colId] ?? 0) + amount
    grand += amount
  }

  // Stable ordering: categories alphabetically, members alphabetically,
  // with the catch-all buckets last.
  const sortIds = (ids: string[], labels: Record<string, string>, last: string) =>
    [...ids].sort((a, b) => {
      if (a === last) return 1
      if (b === last) return -1
      return labels[a].localeCompare(labels[b])
    })

  return {
    rowIds: sortIds(rowOrder, rowLabels, UNCATEGORIZED),
    rowLabels,
    colIds: sortIds(colOrder, colLabels, UNKNOWN_PAYER),
    colLabels,
    cells,
    rowTotals,
    colTotals,
    grand,
  }
}

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [members, setMembers] = useState<Profile[]>([])
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'categories'>('overview')
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null)
  const [txnForm, setTxnForm] = useState<FormData>(EMPTY_TXN)
  const [catForm, setCatForm] = useState<CatFormData>(EMPTY_CAT)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)
    const [txns, cats, profs] = await Promise.all([
      supabase.from('transactions').select('*, budget_categories(*)').order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('name'),
      supabase.from('profiles').select('id, household_id, full_name, avatar_url, created_at, updated_at'),
    ])
    setTransactions(txns.data ?? [])
    setCategories(cats.data ?? [])
    setMembers(profs.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useOpenAddParam(openAddTxn, !loading)

  const monthTxns = transactions.filter(t => t.date.slice(0, 7) === selectedMonth)
  const monthTotal = monthTxns.reduce((a, t) => a + Number(t.amount), 0)
  const matrix = buildMatrix(monthTxns, categories, members)

  const monthLabel = new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function openAddTxn() {
    setEditingTxn(null)
    // Default the date to today when viewing the current month, otherwise the
    // first of the month being viewed so the new expense lands in this view.
    const date = currentMonth().slice(0, 7) === selectedMonth ? currentMonth() : `${selectedMonth}-01`
    setTxnForm({ ...EMPTY_TXN, paid_by: currentUserId, date })
    setShowTxnModal(true)
  }

  function openEditTxn(t: Transaction) {
    setEditingTxn(t)
    setTxnForm({
      title: t.title,
      amount: t.amount.toString(),
      category_id: t.category_id ?? '',
      paid_by: t.created_by ?? '',
      date: t.date,
      notes: t.notes ?? '',
    })
    setShowTxnModal(true)
  }

  async function saveTxn() {
    if (!txnForm.title.trim() || !txnForm.amount) return
    const payload = {
      title: txnForm.title,
      amount: Number(txnForm.amount),
      type: 'expense' as const,
      category_id: txnForm.category_id || null,
      created_by: txnForm.paid_by || null,
      date: txnForm.date,
      notes: txnForm.notes || null,
    }
    if (editingTxn) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingTxn.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('transactions').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
      const logUserId = payload.created_by || currentUserId
      if (logUserId) {
        await supabase.from('activity_log').insert({
          household_id,
          user_id: logUserId,
          action_type: 'transaction_added',
          entity_title: `${payload.title} ($${Number(payload.amount).toFixed(2)})`,
        })
      }
    }
    setShowTxnModal(false)
    load()
  }

  async function removeTxn(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('transactions').delete().eq('id', id)
    load()
  }

  function openAddCat() {
    setEditingCat(null)
    setCatForm(EMPTY_CAT)
    setShowCatModal(true)
  }

  function openEditCat(c: BudgetCategory) {
    setEditingCat(c)
    setCatForm({
      name: c.name,
      monthly_budget: c.monthly_budget?.toString() ?? '',
      color: c.color,
    })
    setShowCatModal(true)
  }

  async function saveCat() {
    if (!catForm.name.trim()) return
    const payload = {
      name: catForm.name,
      type: 'expense' as const,
      monthly_budget: catForm.monthly_budget ? Number(catForm.monthly_budget) : null,
      color: catForm.color,
    }
    if (editingCat) {
      const { error } = await supabase.from('budget_categories').update(payload).eq('id', editingCat.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('budget_categories').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
    }
    setShowCatModal(false)
    load()
  }

  async function removeCat(id: string) {
    if (!confirm('Delete this category?')) return
    await supabase.from('budget_categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Budget</h1>
        <button onClick={tab === 'overview' ? openAddTxn : openAddCat} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> {tab === 'overview' ? 'Add Expense' : 'Add Category'}
        </button>
      </div>

      {/* Tabs */}
      <div className={CHIP_GROUP}>
        {(['overview', 'categories'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={chipClass(tab === t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {/* Month selector */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => shiftMonth(-1)} className={ICON_BTN} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className={cn(INPUT, 'w-auto')}
              />
              <button onClick={() => shiftMonth(1)} className={ICON_BTN} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-[#a58b78]">Total expenses</p>
              <p className="text-xl font-black text-[#4b3a2f]">{fmt(monthTotal)}</p>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : monthTxns.length === 0 ? (
            <div className="text-center py-16 text-[#a58b78] font-semibold">No expenses for {monthLabel}.</div>
          ) : (
            <>
              {/* Person × Category matrix */}
              <div className={cn('overflow-x-auto p-5', CARD)}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[rgba(150,120,95,0.16)]">
                      <th className="text-left font-extrabold text-[#a58b78] px-3 py-2">Category</th>
                      {matrix.colIds.map(colId => (
                        <th key={colId} className="text-right font-extrabold text-[#a58b78] px-3 py-2 whitespace-nowrap">
                          {matrix.colLabels[colId]}
                        </th>
                      ))}
                      <th className="text-right font-black text-[#4b3a2f] px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rowIds.map(rowId => (
                      <tr key={rowId} className="border-b border-[rgba(150,120,95,0.1)] last:border-0">
                        <td className="text-left font-bold text-[#4b3a2f] px-3 py-2 whitespace-nowrap">
                          {matrix.rowLabels[rowId]}
                        </td>
                        {matrix.colIds.map(colId => {
                          const v = matrix.cells[rowId]?.[colId]
                          return (
                            <td key={colId} className="text-right px-3 py-2 font-semibold text-[#a58b78]">
                              {v ? fmt(v) : '—'}
                            </td>
                          )
                        })}
                        <td className="text-right font-extrabold text-[#4b3a2f] px-3 py-2">
                          {fmt(matrix.rowTotals[rowId] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-[rgba(150,120,95,0.2)]">
                      <td className="text-left font-black text-[#4b3a2f] px-3 py-2">Total</td>
                      {matrix.colIds.map(colId => (
                        <td key={colId} className="text-right font-extrabold text-[#4b3a2f] px-3 py-2">
                          {fmt(matrix.colTotals[colId] ?? 0)}
                        </td>
                      ))}
                      <td className="text-right font-black text-[#c1673f] px-3 py-2">{fmt(matrix.grand)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Detailed list */}
              <h2 className="text-sm font-extrabold text-[#a58b78] uppercase tracking-wide">All expenses</h2>
              <div className="grid gap-2">
                {monthTxns.map(t => {
                  const payer = members.find(m => m.id === t.created_by)
                  return (
                    <div key={t.id} className={cn('flex items-center gap-3 p-3.5', CARD)}>
                      <div className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: hexFor(t.budget_categories?.color) }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#4b3a2f]">{t.title}</p>
                        <p className="text-xs font-semibold text-[#a58b78]">
                          {t.date}
                          {t.budget_categories && ` · ${t.budget_categories.name}`}
                          {t.created_by && ` · ${memberName(payer)}`}
                        </p>
                      </div>
                      <span className="font-extrabold text-sm shrink-0 text-[#4b3a2f]">
                        {fmt(Number(t.amount))}
                      </span>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => openEditTxn(t)} className={ICON_BTN}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeTxn(t.id)} className={ICON_BTN_DANGER}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'categories' && (
        <>
          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-2xl bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-[#a58b78] font-semibold">No categories yet. Create one to organize expenses!</div>
          ) : (
            <div className="grid gap-2">
              {categories.map(c => (
                <div key={c.id} className={cn('flex items-center gap-3 p-3.5', CARD)}>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: hexFor(c.color) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#4b3a2f]">{c.name}</p>
                    {c.monthly_budget != null && (
                      <p className="text-xs font-semibold text-[#a58b78]">Budget: {fmt(Number(c.monthly_budget))}/mo</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditCat(c)} className={ICON_BTN}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeCat(c.id)} className={ICON_BTN_DANGER}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Expense modal */}
      {showTxnModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-md')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editingTxn ? 'Edit Expense' : 'New Expense'}</h2>
              <button onClick={() => setShowTxnModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Title *</label>
                <input
                  className={INPUT}
                  value={txnForm.title}
                  onChange={e => setTxnForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Grocery run"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={INPUT}
                    value={txnForm.amount}
                    onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Paid by</label>
                  <select
                    className={INPUT}
                    value={txnForm.paid_by}
                    onChange={e => setTxnForm(f => ({ ...f, paid_by: e.target.value }))}
                  >
                    <option value="">Unknown</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{memberName(m)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Category</label>
                  <select
                    className={INPUT}
                    value={txnForm.category_id}
                    onChange={e => setTxnForm(f => ({ ...f, category_id: e.target.value }))}
                  >
                    <option value="">None</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={txnForm.date}
                    onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Notes</label>
                <input
                  className={INPUT}
                  value={txnForm.notes}
                  onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowTxnModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={saveTxn} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editingTxn ? 'Save Changes' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-sm')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editingCat ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowCatModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Name *</label>
                <input
                  className={INPUT}
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Groceries"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Monthly Budget ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={INPUT}
                    value={catForm.monthly_budget}
                    onChange={e => setCatForm(f => ({ ...f, monthly_budget: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Color</label>
                  <select
                    className={cn(INPUT, 'capitalize')}
                    value={catForm.color}
                    onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                  >
                    {COLORS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCatModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={saveCat} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editingCat ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
