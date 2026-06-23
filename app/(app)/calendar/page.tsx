'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import type { CalendarEvent, EventAttendee, RecurrenceType } from '@/lib/types'
import { Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight, MapPin, Clock, Check, Minus, X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const EVENT_COLORS = ['blue', 'green', 'red', 'purple', 'orange', 'pink', 'teal', 'yellow']

const COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  pink: 'bg-pink-100 text-pink-800 border-pink-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

const RSVP_STATUS_STYLE: Record<string, string> = {
  attending: 'bg-green-100 text-green-700 border-green-200',
  declined: 'bg-red-100 text-red-700 border-red-200',
  maybe: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}

const RSVP_DOT: Record<string, string> = {
  attending: 'bg-green-500',
  declined: 'bg-red-500',
  maybe: 'bg-yellow-500',
}

type FormData = {
  title: string
  description: string
  location: string
  start_time: string
  end_time: string
  all_day: boolean
  color: string
  recurrence: RecurrenceType
}

const EMPTY_FORM: FormData = {
  title: '', description: '', location: '',
  start_time: '', end_time: '', all_day: false,
  color: 'blue', recurrence: 'none',
}

function toLocalDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [attendees, setAttendees] = useState<Record<string, EventAttendee[]>>({})
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) setCurrentUserId(user.id)

    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .order('start_time', { ascending: true })
    setEvents(eventsData ?? [])

    if (eventsData && eventsData.length > 0) {
      const eventIds = eventsData.map(e => e.id)
      const { data: attendeesData } = await supabase
        .from('event_attendees')
        .select('*, profiles!user_id(full_name, avatar_url)')
        .in('event_id', eventIds)

      const grouped: Record<string, EventAttendee[]> = {}
      for (const a of attendeesData ?? []) {
        if (!grouped[a.event_id]) grouped[a.event_id] = []
        grouped[a.event_id].push(a as EventAttendee)
      }
      setAttendees(grouped)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)) }

  function eventsForDate(dateStr: string) {
    return events.filter(e => e.start_time.slice(0, 10) === dateStr)
  }

  function openAdd() {
    setEditing(null)
    const localNow = new Date()
    localNow.setMinutes(0, 0, 0)
    const endTime = new Date(localNow)
    endTime.setHours(endTime.getHours() + 1)
    setForm({
      ...EMPTY_FORM,
      start_time: selectedDate + 'T' + localNow.toTimeString().slice(0, 5),
      end_time: selectedDate + 'T' + endTime.toTimeString().slice(0, 5),
    })
    setShowModal(true)
  }

  function openEdit(e: CalendarEvent) {
    setEditing(e)
    setForm({
      title: e.title,
      description: e.description ?? '',
      location: e.location ?? '',
      start_time: e.start_time.slice(0, 16),
      end_time: e.end_time?.slice(0, 16) ?? '',
      all_day: e.all_day,
      color: e.color,
      recurrence: e.recurrence,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.title.trim() || !form.start_time) return
    const payload = {
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      all_day: form.all_day,
      color: form.color,
      recurrence: form.recurrence,
    }
    if (editing) {
      const { error } = await supabase.from('events').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { data, error } = await supabase.from('events')
        .insert({ ...payload, household_id })
        .select()
        .single()
      if (error) { toast.error(error.message); return }
      if (data && currentUserId) {
        await Promise.all([
          supabase.from('event_attendees').insert({
            event_id: data.id,
            user_id: currentUserId,
            household_id,
            status: 'attending',
          }),
          supabase.from('activity_log').insert({
            household_id,
            user_id: currentUserId,
            action_type: 'event_created',
            entity_id: data.id,
            entity_title: data.title,
          }),
        ])
      }
    }
    setShowModal(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    load()
  }

  async function setRsvp(eventId: string, status: 'attending' | 'declined' | 'maybe') {
    if (!currentUserId) return
    const household_id = await getHouseholdId(supabase)
    if (!household_id) return

    const { error } = await supabase.from('event_attendees').upsert(
      { event_id: eventId, user_id: currentUserId, household_id, status },
      { onConflict: 'event_id,user_id' }
    )
    if (error) { toast.error(error.message); return }

    setAttendees(prev => {
      const current = prev[eventId] ?? []
      const existing = current.find(a => a.user_id === currentUserId)
      if (existing) {
        return { ...prev, [eventId]: current.map(a => a.user_id === currentUserId ? { ...a, status } : a) }
      }
      const newEntry: EventAttendee = {
        id: crypto.randomUUID(),
        event_id: eventId,
        user_id: currentUserId,
        household_id,
        status,
        created_at: new Date().toISOString(),
      }
      return { ...prev, [eventId]: [...current, newEntry] }
    })
  }

  const selectedEvents = eventsForDate(selectedDate)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Add Event
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-6">
        {/* Calendar grid */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-semibold">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const isToday = dateStr === toLocalDateString(today)
              const isSelected = dateStr === selectedDate
              const dayEvents = eventsForDate(dateStr)
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'relative flex flex-col items-center py-1.5 rounded-lg text-sm transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : isToday ? 'bg-muted font-semibold' : 'hover:bg-muted/60'
                  )}
                >
                  {day}
                  {dayEvents.length > 0 && (
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-0.5', isSelected ? 'bg-primary-foreground' : 'bg-primary')} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Events for selected day */}
        <div className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold mb-3 text-sm text-muted-foreground">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
            </div>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map(e => {
                const eventAttendees = attendees[e.id] ?? []
                const myRsvp = eventAttendees.find(a => a.user_id === currentUserId)
                const othersRsvp = eventAttendees.filter(a => a.user_id !== currentUserId)
                return (
                  <div key={e.id} className={cn('p-3 rounded-lg border text-sm', COLOR_CLASSES[e.color] ?? COLOR_CLASSES.blue)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{e.title}</p>
                        {!e.all_day && (
                          <p className="flex items-center gap-1 text-xs mt-0.5 opacity-80">
                            <Clock className="h-3 w-3" />
                            {new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {e.end_time && ` – ${new Date(e.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                          </p>
                        )}
                        {e.location && (
                          <p className="flex items-center gap-1 text-xs mt-0.5 opacity-80">
                            <MapPin className="h-3 w-3" /> {e.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(e)} className="p-1 rounded hover:bg-black/10 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(e.id)} className="p-1 rounded hover:bg-black/10 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* RSVP section */}
                    <div className="mt-2.5 pt-2.5 border-t border-current/10">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1">
                          {(['attending', 'maybe', 'declined'] as const).map(status => (
                            <button
                              key={status}
                              onClick={() => setRsvp(e.id, status)}
                              title={status.charAt(0).toUpperCase() + status.slice(1)}
                              className={cn(
                                'p-1 rounded-md border transition-colors',
                                myRsvp?.status === status
                                  ? RSVP_STATUS_STYLE[status]
                                  : 'bg-white/40 border-current/20 hover:bg-white/60'
                              )}
                            >
                              {status === 'attending' && <Check className="h-3 w-3" />}
                              {status === 'maybe' && <Minus className="h-3 w-3" />}
                              {status === 'declined' && <XIcon className="h-3 w-3" />}
                            </button>
                          ))}
                          {!myRsvp && (
                            <span className="text-xs opacity-60 self-center ml-1">Your RSVP</span>
                          )}
                        </div>
                        {othersRsvp.length > 0 && (
                          <div className="flex items-center gap-1">
                            {othersRsvp.map(a => (
                              <div key={a.id} className="flex items-center gap-1" title={`${a.profiles?.full_name ?? 'Partner'}: ${a.status}`}>
                                <div className="w-5 h-5 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-xs font-bold">
                                  {initials(a.profiles?.full_name)}
                                </div>
                                <span className={cn('w-2 h-2 rounded-full', RSVP_DOT[a.status])} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Title *</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="all_day"
                  checked={form.all_day}
                  onChange={e => setForm(f => ({ ...f, all_day: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="all_day" className="text-sm font-medium">All day</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start</label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.all_day ? form.start_time.slice(0, 10) : form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End</label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.all_day ? form.end_time.slice(0, 10) : form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Optional location"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none h-16 focus:outline-none focus:ring-2 focus:ring-primary"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Color</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  >
                    {EVENT_COLORS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Recurrence</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.recurrence}
                    onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as RecurrenceType }))}
                  >
                    <option value="none">None</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {editing ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
