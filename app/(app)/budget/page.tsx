'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { Transaction, BudgetCategory } from '@/lib/types'
import { Plus, X, Pencil, Trash2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type FormData = {
  title: string
  amount: string
  type: 'income' | 'expense'
  category_id: string
  date: string
  notes: string
}

type CatFormData = {
  name: string
  type: 'income' | 'expense'
  monthly_budget: string
  color: string
}

const EMPTY_TXN: FormData = {
  title: '', amount: '', type: 'expense',
  category_id: '', date: new Date().toISOString().slice(0, 10), notes: '',
}

const EMPTY_CAT: CatFormData = {
  name: '', type: 'expense', monthly_budget: '', color: 'gray',
}

const COLORS = ['gray', 'blue', 'green', 'red', 'purple', 'orange', 'pink', 'teal', 'yellow']

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'transactions' | 'categories'>('transactions')
  const [showTxnModal, setShowTxnModal] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editingCat, setEditingCat] = useState<BudgetCategory | null>(null)
  const [txnForm, setTxnForm] = useState<FormData>(EMPTY_TXN)
  const [catForm, setCatForm] = useState<CatFormData>(EMPTY_CAT)
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')

  const supabase = createClient()

  async function load() {
    const [txns, cats] = await Promise.all([
      supabase.from('transactions').select('*, budget_categories(*)').order('date', { ascending: false }),
      supabase.from('budget_categories').select('*').order('name'),
    ])
    setTransactions(txns.data ?? [])
    setCategories(cats.data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  function openAddTxn() {
    setEditingTxn(null)
    setTxnForm(EMPTY_TXN)
    setShowTxnModal(true)
  }

  function openEditTxn(t: Transaction) {
    setEditingTxn(t)
    setTxnForm({
      title: t.title,
      amount: t.amount.toString(),
      type: t.type,
      category_id: t.category_id ?? '',
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
      type: txnForm.type,
      category_id: txnForm.category_id || null,
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
    }
    setShowTxnModal(false)
    load()
  }

  async function removeTxn(id: string) {
    if (!confirm('Delete this transaction?')) return
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
      type: c.type,
      monthly_budget: c.monthly_budget?.toString() ?? '',
      color: c.color,
    })
    setShowCatModal(true)
  }

  async function saveCat() {
    if (!catForm.name.trim()) return
    const payload = {
      name: catForm.name,
      type: catForm.type,
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

  const filteredTxns = typeFilter === 'all' ? transactions : transactions.filter(t => t.type === typeFilter)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Budget</h1>
        <button
          onClick={tab === 'transactions' ? openAddTxn : openAddCat}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> {tab === 'transactions' ? 'Add Transaction' : 'Add Category'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Income</span>
          </div>
          <p className="text-xl font-bold text-foreground">${totalIncome.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-medium">Expenses</span>
          </div>
          <p className="text-xl font-bold text-foreground">${totalExpense.toFixed(2)}</p>
        </div>
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium">Balance</span>
          </div>
          <p className={cn('text-xl font-bold', balance >= 0 ? 'text-green-600' : 'text-red-600')}>
            {balance >= 0 ? '+' : ''}${balance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        {(['transactions', 'categories'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <>
          <div className="flex gap-2 mb-4">
            {(['all', 'income', 'expense'] as const).map(s => (
              <button
                key={s}
                onClick={() => setTypeFilter(s)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm font-medium border transition-colors capitalize',
                  typeFilter === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border text-muted-foreground hover:border-foreground'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : filteredTxns.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No transactions yet.</div>
          ) : (
            <div className="grid gap-2">
              {filteredTxns.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <div className={cn('w-2 h-8 rounded-full shrink-0', t.type === 'income' ? 'bg-green-500' : 'bg-red-500')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.date}
                      {t.budget_categories && ` · ${t.budget_categories.name}`}
                    </p>
                  </div>
                  <span className={cn('font-semibold text-sm shrink-0', t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                    {t.type === 'income' ? '+' : '-'}${Number(t.amount).toFixed(2)}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditTxn(t)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => removeTxn(t.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'categories' && (
        <>
          {loading ? (
            <div className="grid gap-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">No categories yet. Create one to organize transactions!</div>
          ) : (
            <div className="grid gap-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <div className={`w-3 h-3 rounded-full bg-${c.color}-500 shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {c.type}{c.monthly_budget != null && ` · Budget: $${Number(c.monthly_budget).toFixed(2)}/mo`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditCat(c)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => removeCat(c.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Transaction modal */}
      {showTxnModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingTxn ? 'Edit Transaction' : 'New Transaction'}</h2>
              <button onClick={() => setShowTxnModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={txnForm.title}
                  onChange={e => setTxnForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Grocery run"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={txnForm.amount}
                    onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={txnForm.type}
                    onChange={e => setTxnForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={txnForm.category_id}
                    onChange={e => setTxnForm(f => ({ ...f, category_id: e.target.value }))}
                  >
                    <option value="">None</option>
                    {categories.filter(c => c.type === txnForm.type).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={txnForm.date}
                    onChange={e => setTxnForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={txnForm.notes}
                  onChange={e => setTxnForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowTxnModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={saveTxn} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editingTxn ? 'Save Changes' : 'Add Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editingCat ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowCatModal(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Name *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={catForm.name}
                  onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Groceries"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={catForm.type}
                    onChange={e => setCatForm(f => ({ ...f, type: e.target.value as 'income' | 'expense' }))}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Monthly Budget ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={catForm.monthly_budget}
                    onChange={e => setCatForm(f => ({ ...f, monthly_budget: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Color</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                  value={catForm.color}
                  onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))}
                >
                  {COLORS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCatModal(false)} className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={saveCat} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity">
                {editingCat ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
