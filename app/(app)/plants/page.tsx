'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { Plant, PlantPhoto, LightRequirement } from '@/lib/types'
import { Plus, X, Pencil, Trash2, Search, Droplet, Sun, PawPrint, Images, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { differenceInCalendarWeeks } from 'date-fns'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, ICON_BTN_DANGER,
  CHIP_GROUP, chipClass, SOLID_CHIP, SEVERITY_META, qualitativeChip, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

type FormData = {
  name: string
  species: string
  room: string
  light_requirement: LightRequirement | ''
  watering_interval_days: string
  last_watered_at: string
  acquired_date: string
  toxic_to_pets: boolean
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '', species: '', room: '', light_requirement: '',
  watering_interval_days: '', last_watered_at: '', acquired_date: '',
  toxic_to_pets: false, notes: '',
}

const LIGHT_LABELS: Record<LightRequirement, string> = {
  low: 'Low light',
  medium: 'Medium light',
  bright_indirect: 'Bright indirect',
  direct_sun: 'Direct sun',
}

type WateringStatus = 'overdue' | 'due_soon' | 'ok' | null

function wateringStatus(plant: Plant): WateringStatus {
  if (!plant.watering_interval_days || !plant.last_watered_at) return null
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const due = new Date(plant.last_watered_at)
  due.setDate(due.getDate() + plant.watering_interval_days)
  const tomorrow = new Date(startOfToday)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (due < startOfToday) return 'overdue'
  if (due <= tomorrow) return 'due_soon'
  return 'ok'
}

export default function PlantsPage() {
  const [plants, setPlants] = useState<Plant[]>([])
  const [latestPhotoByPlant, setLatestPhotoByPlant] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roomFilter, setRoomFilter] = useState('all')
  const [needsWaterOnly, setNeedsWaterOnly] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Plant | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  const [photosPlant, setPhotosPlant] = useState<Plant | null>(null)
  const [photos, setPhotos] = useState<PlantPhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploadTakenAt, setUploadTakenAt] = useState('')
  const [uploading, setUploading] = useState(false)

  const supabase = createClient()

  async function load() {
    const [plantsRes, photosRes] = await Promise.all([
      supabase.from('plants').select('*').order('name'),
      supabase.from('plant_photos').select('plant_id, photo_url, taken_at').order('taken_at', { ascending: false }),
    ])
    setPlants(plantsRes.data ?? [])
    const latest: Record<string, string> = {}
    for (const p of photosRes.data ?? []) {
      if (!latest[p.plant_id]) latest[p.plant_id] = p.photo_url
    }
    setLatestPhotoByPlant(latest)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useOpenAddParam(openAdd, !loading)

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(plant: Plant) {
    setEditing(plant)
    setForm({
      name: plant.name,
      species: plant.species ?? '',
      room: plant.room ?? '',
      light_requirement: plant.light_requirement ?? '',
      watering_interval_days: plant.watering_interval_days?.toString() ?? '',
      last_watered_at: plant.last_watered_at ?? '',
      acquired_date: plant.acquired_date ?? '',
      toxic_to_pets: plant.toxic_to_pets,
      notes: plant.notes ?? '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    const payload = {
      name: form.name,
      species: form.species || null,
      room: form.room || null,
      light_requirement: form.light_requirement || null,
      watering_interval_days: form.watering_interval_days ? Number(form.watering_interval_days) : null,
      last_watered_at: form.last_watered_at || null,
      acquired_date: form.acquired_date || null,
      toxic_to_pets: form.toxic_to_pets,
      notes: form.notes || null,
    }
    if (editing) {
      const { error } = await supabase.from('plants').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); return }
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) { toast.error('No household found — finish setup in Settings first.'); return }
      const { error } = await supabase.from('plants').insert({ ...payload, household_id })
      if (error) { toast.error(error.message); return }
    }
    setShowModal(false)
    load()
  }

  async function remove(plant: Plant) {
    if (!confirm('Delete this plant and all its growth photos?')) return
    const { data: rows } = await supabase.from('plant_photos').select('storage_path').eq('plant_id', plant.id)
    if (rows?.length) {
      await supabase.storage.from('plant-photos').remove(rows.map(r => r.storage_path))
    }
    await supabase.from('plants').delete().eq('id', plant.id)
    load()
  }

  async function waterNow(plant: Plant) {
    const { error } = await supabase
      .from('plants')
      .update({ last_watered_at: new Date().toISOString().slice(0, 10) })
      .eq('id', plant.id)
    if (error) { toast.error(error.message); return }
    load()
  }

  async function openPhotos(plant: Plant) {
    setPhotosPlant(plant)
    setUploadCaption('')
    setUploadTakenAt('')
    setPhotosLoading(true)
    const { data } = await supabase.from('plant_photos').select('*').eq('plant_id', plant.id).order('taken_at', { ascending: true })
    setPhotos(data ?? [])
    setPhotosLoading(false)
  }

  async function uploadPhoto(file: File) {
    if (!photosPlant) return
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `${photosPlant.household_id}/${photosPlant.id}/${crypto.randomUUID()}-${safeName}`
    const { error: upErr } = await supabase.storage.from('plant-photos').upload(path, file)
    if (upErr) { toast.error(upErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('plant-photos').getPublicUrl(path)
    const { error: insErr } = await supabase.from('plant_photos').insert({
      plant_id: photosPlant.id,
      household_id: photosPlant.household_id,
      photo_url: urlData.publicUrl,
      storage_path: path,
      taken_at: uploadTakenAt || new Date().toISOString().slice(0, 10),
      caption: uploadCaption || null,
    })
    if (insErr) { toast.error(insErr.message); setUploading(false); return }
    setUploadCaption('')
    setUploadTakenAt('')
    await openPhotos(photosPlant)
    load()
    setUploading(false)
  }

  async function deletePhoto(photo: PlantPhoto) {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('plant-photos').remove([photo.storage_path])
    await supabase.from('plant_photos').delete().eq('id', photo.id)
    if (photosPlant) await openPhotos(photosPlant)
    load()
  }

  const usedRooms = ['all', ...Array.from(new Set(plants.map(p => p.room).filter((r): r is string => !!r)))]

  const filtered = plants.filter(plant => {
    const matchSearch = search === '' ||
      plant.name.toLowerCase().includes(search.toLowerCase()) ||
      plant.species?.toLowerCase().includes(search.toLowerCase()) ||
      plant.room?.toLowerCase().includes(search.toLowerCase())
    const matchRoom = roomFilter === 'all' || plant.room === roomFilter
    const status = wateringStatus(plant)
    const matchWater = !needsWaterOnly || status === 'overdue' || status === 'due_soon'
    return matchSearch && matchRoom && matchWater
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Plants</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Plant
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b09a86]" />
          <input
            className={cn(INPUT, 'pl-10')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search plants..."
          />
        </div>
        <div className={CHIP_GROUP}>
          {usedRooms.map(r => (
            <button key={r} onClick={() => setRoomFilter(r)} className={chipClass(roomFilter === r)}>
              {r}
            </button>
          ))}
        </div>
        <div className={CHIP_GROUP}>
          <button onClick={() => setNeedsWaterOnly(v => !v)} className={chipClass(needsWaterOnly)}>
            Needs water
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-52 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">No plants found. Add one to start tracking your collection!</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(plant => {
            const ws = wateringStatus(plant)
            const thumb = latestPhotoByPlant[plant.id]
            return (
              <div key={plant.id} className={cn('p-4', CARD)}>
                <div className="flex gap-3 mb-3">
                  <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-[#dcc8ba] flex items-center justify-center">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={plant.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">🌱</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-[#4b3a2f] truncate">{plant.name}</h3>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => openEdit(plant)} className={ICON_BTN}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(plant)} className={ICON_BTN_DANGER}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {plant.species && <p className="text-xs font-semibold text-[#a58b78] truncate">{plant.species}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {plant.room && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: qualitativeChip(plant.room).bg, color: qualitativeChip(plant.room).tx }}>{plant.room}</span>
                  )}
                  {plant.light_requirement && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.info.bg, color: SEVERITY_META.info.tx }}>
                      <Sun className="h-3 w-3" /> {LIGHT_LABELS[plant.light_requirement]}
                    </span>
                  )}
                  {plant.toxic_to_pets && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.warning.bg, color: SEVERITY_META.warning.tx }}>
                      <PawPrint className="h-3 w-3" /> Toxic to pets
                    </span>
                  )}
                  {ws === 'overdue' && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.danger.bg, color: SEVERITY_META.danger.tx }}>
                      <Droplet className="h-3 w-3" /> Needs water
                    </span>
                  )}
                  {ws === 'due_soon' && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.warning.bg, color: SEVERITY_META.warning.tx }}>
                      <Droplet className="h-3 w-3" /> Water soon
                    </span>
                  )}
                  {ws === 'ok' && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.success.bg, color: SEVERITY_META.success.tx }}>
                      <Droplet className="h-3 w-3" /> Watered
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs font-semibold text-[#a58b78] mb-3">
                  {plant.last_watered_at && <p>Last watered: {plant.last_watered_at}</p>}
                  {plant.watering_interval_days && <p>Every {plant.watering_interval_days} day{plant.watering_interval_days === 1 ? '' : 's'}</p>}
                  {plant.acquired_date && <p>Acquired: {plant.acquired_date}</p>}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => waterNow(plant)} className={cn(BTN_GHOST, 'flex-1 !py-2 !text-[13px]')}>
                    <Droplet className="h-3.5 w-3.5" /> Water now
                  </button>
                  <button onClick={() => openPhotos(plant)} className={cn(BTN_GHOST, 'flex-1 !py-2 !text-[13px]')}>
                    <Images className="h-3.5 w-3.5" /> Growth photos
                  </button>
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
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Plant' : 'New Plant'}</h2>
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
                    placeholder="e.g. Fiddle Leaf Fig"
                  />
                </div>
                <div>
                  <label className={LABEL}>Species</label>
                  <input
                    className={INPUT}
                    value={form.species}
                    onChange={e => setForm(f => ({ ...f, species: e.target.value }))}
                    placeholder="e.g. Ficus lyrata"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Room</label>
                  <input
                    className={INPUT}
                    value={form.room}
                    onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                    placeholder="e.g. Living Room"
                  />
                </div>
                <div>
                  <label className={LABEL}>Light</label>
                  <select
                    className={INPUT}
                    value={form.light_requirement}
                    onChange={e => setForm(f => ({ ...f, light_requirement: e.target.value as LightRequirement | '' }))}
                  >
                    <option value="">Not set</option>
                    {(Object.keys(LIGHT_LABELS) as LightRequirement[]).map(l => (
                      <option key={l} value={l}>{LIGHT_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Watering Interval (days)</label>
                  <input
                    type="number"
                    min="1"
                    className={INPUT}
                    value={form.watering_interval_days}
                    onChange={e => setForm(f => ({ ...f, watering_interval_days: e.target.value }))}
                    placeholder="e.g. 7"
                  />
                </div>
                <div>
                  <label className={LABEL}>Last Watered</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.last_watered_at}
                    onChange={e => setForm(f => ({ ...f, last_watered_at: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Acquired Date</label>
                <input
                  type="date"
                  className={INPUT}
                  value={form.acquired_date}
                  onChange={e => setForm(f => ({ ...f, acquired_date: e.target.value }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-bold text-[#6a5647] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.toxic_to_pets}
                  onChange={e => setForm(f => ({ ...f, toxic_to_pets: e.target.checked }))}
                  className="h-4 w-4"
                />
                Toxic to pets
              </label>
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
                {editing ? 'Save Changes' : 'Add Plant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {photosPlant && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-lg')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{photosPlant.name} — Growth Photos</h2>
              <button onClick={() => setPhotosPlant(null)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>

            {photosLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-24 rounded-2xl bg-[#dcc8ba] animate-pulse" />)}
              </div>
            ) : photos.length === 0 ? (
              <p className="text-sm font-semibold text-[#a58b78] text-center py-6">No photos yet. Add one below to start the growth timeline.</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto pr-1">
                {photos.map(photo => {
                  const weeksSinceAcquired = photosPlant.acquired_date
                    ? differenceInCalendarWeeks(new Date(photo.taken_at), new Date(photosPlant.acquired_date))
                    : null
                  return (
                    <div key={photo.id} className="flex gap-3 items-start">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.photo_url} alt={photo.caption ?? photosPlant.name} className="w-20 h-20 rounded-xl object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#4b3a2f]">{photo.taken_at}</p>
                        {weeksSinceAcquired !== null && (
                          <p className="text-xs font-semibold text-[#a58b78]">
                            {weeksSinceAcquired <= 0 ? 'At acquisition' : `${weeksSinceAcquired} week${weeksSinceAcquired === 1 ? '' : 's'} since acquired`}
                          </p>
                        )}
                        {photo.caption && <p className="text-xs font-semibold text-[#a58b78] mt-0.5">{photo.caption}</p>}
                      </div>
                      <button onClick={() => deletePhoto(photo)} className={ICON_BTN_DANGER}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[rgba(150,120,95,0.14)] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Date Taken</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={uploadTakenAt}
                    onChange={e => setUploadTakenAt(e.target.value)}
                  />
                </div>
                <div>
                  <label className={LABEL}>Caption</label>
                  <input
                    className={INPUT}
                    value={uploadCaption}
                    onChange={e => setUploadCaption(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <label className={cn(BTN_PRIMARY, 'w-full cursor-pointer', uploading && 'opacity-50 pointer-events-none')}>
                <Upload className="h-4 w-4" strokeWidth={2.5} /> {uploading ? 'Uploading...' : 'Add Photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) uploadPhoto(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
