'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { CalendarEvent, EventAttendee, RecurrenceType } from '@/lib/types'
import { Plus, X, Pencil, Trash2, ChevronLeft, ChevronRight, MapPin, Clock, Check, Minus, X as XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  RAISED_SM, CARD_LG, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, SUBTITLE, ICON_BTN,
  MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const EVENT_COLORS = ['terracotta', 'amber', 'olive', 'rose', 'taupe']

const EVENT_HEX: Record<string, string> = {
  terracotta: '#c1673f',
  amber: '#b5843a',
  olive: '#7d8a4e',
  rose: '#b56a5e',
  taupe: '#9a7b52',
}

function eventHexFor(color: string | null | undefined) {
  return (color && EVENT_HEX[color]) || EVENT_HEX.terracotta
}

const RSVP_HEX: Record<string, string> = {
  attending: '#6d8a52',
  declined: '#bb5a48',
  maybe: '#b5843a',
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
  color: 'terracotta', recurrence: 'none',
}

function toLocalDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

type CalendarData = {
  events: CalendarEvent[]
  attendees: Record<string, EventAttendee[]>
  currentUserId: string
}

export default function CalendarPage() {
  const [today] = useState(new Date())
  const [current, setCurrent] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data, isPending: loading } = useQuery({
    queryKey: ['calendar'],
    queryFn: async (): Promise<CalendarData> => {
      const [{ data: { user } }, eventsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('events').select('*').order('start_time', { ascending: true }),
      ])
      if (eventsRes.error) throw eventsRes.error
      const eventsData: CalendarEvent[] = eventsRes.data ?? []

      const grouped: Record<string, EventAttendee[]> = {}
      if (eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id)
        const { data: attendeesData, error } = await supabase
          .from('event_attendees')
          .select('*, profiles!user_id(full_name, avatar_url)')
          .in('event_id', eventIds)
        if (error) throw error

        for (const a of attendeesData ?? []) {
          if (!grouped[a.event_id]) grouped[a.event_id] = []
          grouped[a.event_id].push(a as EventAttendee)
        }
      }
      return { events: eventsData, attendees: grouped, currentUserId: user?.id ?? '' }
    },
  })

  const events = data?.events ?? []
  const attendees = data?.attendees ?? {}
  const currentUserId = data?.currentUserId ?? ''

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['calendar'] })

  useOpenAddParam(openAdd, !loading)

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
    refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this event?')) return
    await supabase.from('events').delete().eq('id', id)
    refresh()
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

    queryClient.setQueryData<CalendarData>(['calendar'], prev => {
      if (!prev) return prev
      const current = prev.attendees[eventId] ?? []
      const existing = current.find(a => a.user_id === currentUserId)
      let next: EventAttendee[]
      if (existing) {
        next = current.map(a => a.user_id === currentUserId ? { ...a, status } : a)
      } else {
        const newEntry: EventAttendee = {
          id: crypto.randomUUID(),
          event_id: eventId,
          user_id: currentUserId,
          household_id,
          status,
          created_at: new Date().toISOString(),
        }
        next = [...current, newEntry]
      }
      return { ...prev, attendees: { ...prev.attendees, [eventId]: next } }
    })
  }

  const selectedEvents = eventsForDate(selectedDate)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[32px] font-black tracking-tight text-[#4b3a2f]">Calendar</h1>
          <p className={SUBTITLE}>Shared household events, with a tap to RSVP.</p>
        </div>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Event
        </button>
      </div>

      <div className="grid md:grid-cols-[1fr_348px] gap-[22px] items-start">
        {/* Calendar grid */}
        <div className={cn('p-6', CARD_LG)}>
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="w-[42px] h-[42px] rounded-[13px] bg-[#e6d6ca] text-[#8a7462] flex items-center justify-center shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1] active:shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1]">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="font-black text-[19px] text-[#4b3a2f]">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="w-[42px] h-[42px] rounded-[13px] bg-[#e6d6ca] text-[#8a7462] flex items-center justify-center shadow-[4px_4px_9px_#ccb5a5,-4px_-4px_9px_#f7ebe1] active:shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1]">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2.5">
            {DAYS.map(d => (
              <div key={d} className="text-center text-xs font-extrabold uppercase tracking-wide text-[#a58b78] py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className="aspect-square" />)}
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
                    'aspect-square rounded-[14px] flex flex-col items-center justify-center gap-[3px] transition-shadow',
                    isSelected
                      ? 'bg-[#c1673f] shadow-[4px_4px_9px_#b07048,-3px_-3px_8px_#f7ebe1]'
                      : isToday
                        ? 'bg-[#e6d6ca] shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1]'
                        : 'hover:shadow-[inset_3px_3px_6px_#ccb5a5,inset_-3px_-3px_6px_#f7ebe1]'
                  )}
                >
                  <span className={cn('text-[14.5px]', isSelected || isToday ? 'font-black' : 'font-bold', isSelected ? 'text-[#faf1e9]' : 'text-[#4b3a2f]')}>
                    {day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className={cn('w-[5px] h-[5px] rounded-full', isSelected ? 'bg-[#faf1e9]' : 'bg-[#c1673f]')} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Events for selected day */}
        <div className={cn('p-6', CARD_LG)}>
          <h3 className="mb-[18px] text-[13px] font-extrabold uppercase tracking-wide text-[#a58b78]">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-[#dcc8ba] animate-pulse" />)}
            </div>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm font-semibold text-[#a58b78] text-center py-10">No events this day.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {selectedEvents.map(e => {
                const eventAttendees = attendees[e.id] ?? []
                const myRsvp = eventAttendees.find(a => a.user_id === currentUserId)
                const othersRsvp = eventAttendees.filter(a => a.user_id !== currentUserId)
                const hex = eventHexFor(e.color)
                return (
                  <div key={e.id} className={cn('rounded-[20px] p-4 bg-[#e6d6ca]', RAISED_SM)}>
                    <div className="flex items-start gap-2.5">
                      <span className="w-[5px] self-stretch min-h-[42px] rounded-full flex-none" style={{ backgroundColor: hex }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15.5px] font-extrabold text-[#4b3a2f]">{e.title}</p>
                        {!e.all_day && (
                          <p className="flex items-center gap-1.5 text-[12.5px] mt-1.5 font-bold text-[#8a7462]">
                            <Clock className="h-[13px] w-[13px]" />
                            {new Date(e.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {e.end_time && ` – ${new Date(e.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                          </p>
                        )}
                        {e.location && (
                          <p className="flex items-center gap-1.5 text-[12.5px] mt-1 font-bold text-[#8a7462]">
                            <MapPin className="h-[13px] w-[13px]" /> {e.location}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-none">
                        <button onClick={() => openEdit(e)} className="w-[30px] h-[30px] rounded-[10px] bg-[#e6d6ca] text-[#8a7462] flex items-center justify-center shadow-[3px_3px_6px_#ccb5a5,-3px_-3px_6px_#f7ebe1] active:shadow-[inset_2px_2px_4px_#ccb5a5,inset_-2px_-2px_4px_#f7ebe1]">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(e.id)} className="w-[30px] h-[30px] rounded-[10px] bg-[#e6d6ca] text-[#bb5a48] flex items-center justify-center shadow-[3px_3px_6px_#ccb5a5,-3px_-3px_6px_#f7ebe1] active:shadow-[inset_2px_2px_4px_#ccb5a5,inset_-2px_-2px_4px_#f7ebe1]">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* RSVP section */}
                    <div className="mt-3.5 pt-3.5 border-t border-[rgba(150,120,95,0.16)] flex items-center justify-between gap-2.5">
                      <div className="flex gap-1.5">
                        {(['attending', 'maybe', 'declined'] as const).map(status => (
                          <button
                            key={status}
                            onClick={() => setRsvp(e.id, status)}
                            title={status.charAt(0).toUpperCase() + status.slice(1)}
                            className={cn(
                              'w-8 h-8 rounded-[10px] flex items-center justify-center transition-shadow bg-[#e6d6ca]',
                              myRsvp?.status === status
                                ? 'shadow-[inset_2px_2px_5px_#ccb5a5,inset_-2px_-2px_5px_#f7ebe1]'
                                : 'shadow-[2px_2px_5px_#ccb5a5,-2px_-2px_5px_#f7ebe1]'
                            )}
                            style={{ color: myRsvp?.status === status ? RSVP_HEX[status] : '#a08a77' }}
                          >
                            {status === 'attending' && <Check className="h-3.5 w-3.5" />}
                            {status === 'maybe' && <Minus className="h-3.5 w-3.5" />}
                            {status === 'declined' && <XIcon className="h-3.5 w-3.5" />}
                          </button>
                        ))}
                      </div>
                      {othersRsvp.length > 0 && (
                        <div className="flex items-center gap-2">
                          {othersRsvp.map(a => (
                            <span key={a.id} className="inline-flex items-center gap-1" title={`${a.profiles?.full_name ?? 'Partner'}: ${a.status}`}>
                              <span className={cn('w-6 h-6 rounded-full bg-[#e6d6ca] flex items-center justify-center text-[9.5px] font-black text-[#c1673f]', RAISED_SM)}>
                                {initials(a.profiles?.full_name)}
                              </span>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RSVP_HEX[a.status] }} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-md')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Event' : 'New Event'}</h2>
              <button onClick={() => setShowModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Title *</label>
                <input
                  className={INPUT}
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
                  className="rounded accent-[#c1673f]"
                />
                <label htmlFor="all_day" className="text-sm font-bold text-[#4b3a2f]">All day</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Start</label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    className={INPUT}
                    value={form.all_day ? form.start_time.slice(0, 10) : form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>End</label>
                  <input
                    type={form.all_day ? 'date' : 'datetime-local'}
                    className={INPUT}
                    value={form.all_day ? form.end_time.slice(0, 10) : form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Location</label>
                <input
                  className={INPUT}
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Optional location"
                />
              </div>
              <div>
                <label className={LABEL}>Description</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Color</label>
                  <select
                    className={cn(INPUT, 'capitalize')}
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  >
                    {EVENT_COLORS.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Recurrence</label>
                  <select
                    className={INPUT}
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
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>
                Cancel
              </button>
              <button onClick={save} className={cn(BTN_PRIMARY, 'flex-1')}>
                {editing ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
