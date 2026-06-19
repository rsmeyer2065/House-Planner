export type Profile = {
  id: string
  household_id: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Household = {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export type Priority = 'low' | 'medium' | 'high'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ProjectStatus = 'planned' | 'in_progress' | 'completed' | 'on_hold'

export type Project = {
  id: string
  household_id: string
  title: string
  description: string | null
  status: ProjectStatus
  category: string
  priority: Priority
  estimated_cost: number | null
  actual_cost: number | null
  start_date: string | null
  end_date: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  household_id: string
  title: string
  description: string | null
  status: 'pending' | 'completed'
  priority: Priority
  recurrence: RecurrenceType
  due_date: string | null
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  category: string
  created_at: string
  updated_at: string
}

export type CalendarEvent = {
  id: string
  household_id: string
  title: string
  description: string | null
  location: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  color: string
  recurrence: RecurrenceType
  created_by: string | null
  created_at: string
  updated_at: string
}

export type BudgetCategory = {
  id: string
  household_id: string
  name: string
  type: 'income' | 'expense'
  monthly_budget: number | null
  color: string
  icon: string | null
  created_at: string
}

export type Transaction = {
  id: string
  household_id: string
  category_id: string | null
  title: string
  amount: number
  type: 'income' | 'expense'
  date: string
  notes: string | null
  created_by: string | null
  created_at: string
  budget_categories?: BudgetCategory | null
}

export type ShoppingList = {
  id: string
  household_id: string
  name: string
  created_at: string
}

export type ShoppingItem = {
  id: string
  list_id: string
  name: string
  quantity: string | null
  checked: boolean
  category: string | null
  added_by: string | null
  created_at: string
}

export type Contact = {
  id: string
  household_id: string
  name: string
  category: string
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  notes: string | null
  last_service_date: string | null
  created_at: string
  updated_at: string
}

export type InventoryItem = {
  id: string
  household_id: string
  name: string
  category: string
  brand: string | null
  model: string | null
  serial_number: string | null
  purchase_date: string | null
  purchase_price: number | null
  warranty_expiry: string | null
  location: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Note = {
  id: string
  household_id: string
  title: string | null
  content: string
  color: string
  pinned: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
