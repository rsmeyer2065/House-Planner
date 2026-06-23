import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') ?? 'reminders@yourdomain.com'

type ReminderItem = {
  type: 'task' | 'event' | 'warranty'
  title: string
  detail: string
}

async function sendEmail(to: string, name: string, items: ReminderItem[]) {
  if (!RESEND_API_KEY || items.length === 0) return

  const taskItems = items.filter(i => i.type === 'task')
  const eventItems = items.filter(i => i.type === 'event')
  const warrantyItems = items.filter(i => i.type === 'warranty')

  const section = (heading: string, list: ReminderItem[]) =>
    list.length === 0 ? '' : `
      <h3 style="margin:16px 0 6px;color:#374151;">${heading}</h3>
      <ul style="margin:0;padding-left:18px;">
        ${list.map(i => `<li style="margin-bottom:4px;">${i.title}<br/><small style="color:#6b7280;">${i.detail}</small></li>`).join('')}
      </ul>`

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111827;">
      <h2 style="margin-bottom:4px;">Hi ${name},</h2>
      <p style="color:#6b7280;margin-top:0;">Here's your daily household reminder from House Planner.</p>
      ${section('Tasks due tomorrow', taskItems)}
      ${section('Events tomorrow', eventItems)}
      ${section('Warranties expiring soon', warrantyItems)}
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb;"/>
      <p style="font-size:12px;color:#9ca3af;">You're receiving this because you're a member of a House Planner household.</p>
    </div>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject: 'House Planner — Daily Reminder',
      html,
    }),
  })
}

Deno.serve(async (_req) => {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  const thirtyDaysOut = new Date(now)
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30)
  const thirtyDaysStr = thirtyDaysOut.toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  // Load all data we need in parallel
  const [tasksRes, eventsRes, warrantiesRes, profilesRes] = await Promise.all([
    supabase.from('tasks')
      .select('id, title, due_date, assigned_to, household_id')
      .eq('status', 'pending')
      .eq('due_date', tomorrowStr),
    supabase.from('events')
      .select('id, title, start_time, location, household_id, created_by')
      .gte('start_time', `${tomorrowStr}T00:00:00Z`)
      .lt('start_time', `${tomorrowStr}T23:59:59Z`),
    supabase.from('inventory_items')
      .select('id, name, warranty_expiry, household_id')
      .lte('warranty_expiry', thirtyDaysStr)
      .gte('warranty_expiry', todayStr),
    supabase.from('profiles')
      .select('id, full_name, household_id'),
  ])

  // Look up user emails from auth admin API
  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const u of usersData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email
  }

  const profiles = profilesRes.data ?? []
  const tasks = tasksRes.data ?? []
  const events = eventsRes.data ?? []
  const warranties = warrantiesRes.data ?? []

  // Build per-user reminder map
  const userReminders: Record<string, ReminderItem[]> = {}

  const ensure = (uid: string) => {
    if (!userReminders[uid]) userReminders[uid] = []
  }

  for (const task of tasks) {
    const uid = task.assigned_to
    if (!uid) continue
    ensure(uid)
    userReminders[uid].push({ type: 'task', title: task.title, detail: `Due: ${task.due_date}` })
  }

  for (const event of events) {
    // Notify all household members
    const members = profiles.filter(p => p.household_id === event.household_id)
    const time = new Date(event.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    for (const m of members) {
      ensure(m.id)
      userReminders[m.id].push({ type: 'event', title: event.title, detail: `Tomorrow at ${time}${event.location ? ` · ${event.location}` : ''}` })
    }
  }

  for (const item of warranties) {
    const members = profiles.filter(p => p.household_id === item.household_id)
    const daysLeft = Math.ceil((new Date(item.warranty_expiry).getTime() - now.getTime()) / 864e5)
    for (const m of members) {
      ensure(m.id)
      userReminders[m.id].push({ type: 'warranty', title: item.name, detail: `Warranty expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` })
    }
  }

  // Send emails
  const sends = Object.entries(userReminders).map(async ([uid, items]) => {
    if (items.length === 0) return
    const email = emailMap[uid]
    if (!email) return
    const profile = profiles.find(p => p.id === uid)
    const name = profile?.full_name ?? 'there'
    await sendEmail(email, name, items)
  })

  await Promise.all(sends)

  return new Response(
    JSON.stringify({ sent: Object.keys(userReminders).length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
