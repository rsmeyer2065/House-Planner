'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { getHouseholdId } from '@/lib/household'
import { useOpenAddParam } from '@/lib/use-open-add-param'
import type { Pet, PetFoodType, PetMedication, PetSex, PetSpecies } from '@/lib/types'
import {
  SPECIES_LABELS, SPECIES_EMOJI, SPECIES_ORDER, SEX_LABELS, FOOD_TYPE_LABELS,
  feedingSummary, ageLabel,
} from '@/lib/pets'
import {
  Plus, X, Pencil, Trash2, Search, Upload, Pill, Footprints, Utensils, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  CARD, BTN_PRIMARY, BTN_GHOST, INPUT, LABEL, ICON_BTN, ICON_BTN_DANGER,
  CHIP_GROUP, chipClass, SOLID_CHIP, SEVERITY_META, qualitativeChip, MODAL_OVERLAY, MODAL_PANEL,
} from '@/lib/neu'

type FormData = {
  name: string
  species: PetSpecies
  breed: string
  sex: PetSex | ''
  birthdate: string
  weight: string
  color_markings: string
  microchip_id: string
  food_type: PetFoodType | ''
  food_brand: string
  food_amount: string
  feeding_schedule: string
  feeding_notes: string
  allergies: string
  walk_required: boolean
  walk_schedule: string
  walk_notes: string
  litter_box_location: string
  litter_cleaning_interval_days: string
  litter_notes: string
  vet_name: string
  vet_phone: string
  emergency_contact_name: string
  emergency_contact_phone: string
  behavior_notes: string
  notes: string
}

const EMPTY_FORM: FormData = {
  name: '', species: 'dog', breed: '', sex: '', birthdate: '', weight: '',
  color_markings: '', microchip_id: '',
  food_type: '', food_brand: '', food_amount: '', feeding_schedule: '',
  feeding_notes: '', allergies: '',
  walk_required: false, walk_schedule: '', walk_notes: '',
  litter_box_location: '', litter_cleaning_interval_days: '', litter_notes: '',
  vet_name: '', vet_phone: '', emergency_contact_name: '', emergency_contact_phone: '',
  behavior_notes: '', notes: '',
}

type MedFormData = {
  name: string
  dosage: string
  schedule: string
  instructions: string
  start_date: string
  end_date: string
  notes: string
}

const EMPTY_MED_FORM: MedFormData = {
  name: '', dosage: '', schedule: '', instructions: '',
  start_date: '', end_date: '', notes: '',
}

const SECTION_HEADING = 'text-[11px] font-extrabold uppercase tracking-wider text-[#a58b78] pt-1'

export default function PetsPage() {
  const [search, setSearch] = useState('')
  const [speciesFilter, setSpeciesFilter] = useState<PetSpecies | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Pet | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Pending profile photo: the file picked in the form (uploaded on save, once
  // the pet has an id), a local preview URL, and whether an existing photo was
  // cleared.
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoCleared, setPhotoCleared] = useState(false)

  const [medsPet, setMedsPet] = useState<Pet | null>(null)
  const [meds, setMeds] = useState<PetMedication[]>([])
  const [medsLoading, setMedsLoading] = useState(false)
  const [medForm, setMedForm] = useState<MedFormData>(EMPTY_MED_FORM)
  const [editingMed, setEditingMed] = useState<PetMedication | null>(null)

  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data, isPending: loading } = useQuery({
    queryKey: ['pets'],
    queryFn: async (): Promise<{ pets: Pet[]; medCountByPet: Record<string, number> }> => {
      const [petsRes, medsRes] = await Promise.all([
        supabase.from('pets').select('*').order('name'),
        supabase.from('pet_medications').select('pet_id'),
      ])
      if (petsRes.error) throw petsRes.error
      if (medsRes.error) throw medsRes.error
      const counts: Record<string, number> = {}
      for (const m of medsRes.data ?? []) {
        counts[m.pet_id] = (counts[m.pet_id] ?? 0) + 1
      }
      return { pets: petsRes.data ?? [], medCountByPet: counts }
    },
  })

  const pets = data?.pets ?? []
  const medCountByPet = data?.medCountByPet ?? {}

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pets'] })

  useOpenAddParam(openAdd, !loading)

  // Release the object URL backing the photo preview when it is replaced.
  useEffect(() => {
    if (!photoPreview) return
    return () => URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  function resetPhotoState() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoCleared(false)
  }

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    resetPhotoState()
    setShowModal(true)
  }

  function openEdit(pet: Pet) {
    setEditing(pet)
    setForm({
      name: pet.name,
      species: pet.species,
      breed: pet.breed ?? '',
      sex: pet.sex ?? '',
      birthdate: pet.birthdate ?? '',
      weight: pet.weight ?? '',
      color_markings: pet.color_markings ?? '',
      microchip_id: pet.microchip_id ?? '',
      food_type: pet.food_type ?? '',
      food_brand: pet.food_brand ?? '',
      food_amount: pet.food_amount ?? '',
      feeding_schedule: pet.feeding_schedule ?? '',
      feeding_notes: pet.feeding_notes ?? '',
      allergies: pet.allergies ?? '',
      walk_required: pet.walk_required,
      walk_schedule: pet.walk_schedule ?? '',
      walk_notes: pet.walk_notes ?? '',
      litter_box_location: pet.litter_box_location ?? '',
      litter_cleaning_interval_days: pet.litter_cleaning_interval_days?.toString() ?? '',
      litter_notes: pet.litter_notes ?? '',
      vet_name: pet.vet_name ?? '',
      vet_phone: pet.vet_phone ?? '',
      emergency_contact_name: pet.emergency_contact_name ?? '',
      emergency_contact_phone: pet.emergency_contact_phone ?? '',
      behavior_notes: pet.behavior_notes ?? '',
      notes: pet.notes ?? '',
    })
    resetPhotoState()
    setShowModal(true)
  }

  function pickPhoto(file: File) {
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoCleared(false)
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoCleared(true)
  }

  // Upload the pending photo (if any) and point the pet row at it, then clean
  // up whatever object it replaced. Runs after the row exists so the storage
  // path can include the pet id.
  async function syncPhoto(petId: string, householdId: string, oldPath: string | null) {
    if (photoFile) {
      const safeName = photoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      const path = `${householdId}/${petId}/${crypto.randomUUID()}-${safeName}`
      const { error: upErr } = await supabase.storage.from('pet-photos').upload(path, photoFile)
      if (upErr) { toast.error(`Photo upload failed: ${upErr.message}`); return }
      const { data: urlData } = supabase.storage.from('pet-photos').getPublicUrl(path)
      const { error: rowErr } = await supabase
        .from('pets')
        .update({ photo_url: urlData.publicUrl, photo_storage_path: path })
        .eq('id', petId)
      if (rowErr) {
        await supabase.storage.from('pet-photos').remove([path])
        toast.error(`Photo upload failed: ${rowErr.message}`)
        return
      }
      if (oldPath) await supabase.storage.from('pet-photos').remove([oldPath])
      return
    }

    if (photoCleared && oldPath) {
      const { error } = await supabase
        .from('pets')
        .update({ photo_url: null, photo_storage_path: null })
        .eq('id', petId)
      if (error) { toast.error(error.message); return }
      await supabase.storage.from('pet-photos').remove([oldPath])
    }
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name,
      species: form.species,
      breed: form.breed || null,
      sex: form.sex || null,
      birthdate: form.birthdate || null,
      weight: form.weight || null,
      color_markings: form.color_markings || null,
      microchip_id: form.microchip_id || null,
      food_type: form.food_type || null,
      food_brand: form.food_brand || null,
      food_amount: form.food_amount || null,
      feeding_schedule: form.feeding_schedule || null,
      feeding_notes: form.feeding_notes || null,
      allergies: form.allergies || null,
      walk_required: form.walk_required,
      walk_schedule: form.walk_schedule || null,
      walk_notes: form.walk_notes || null,
      litter_box_location: form.litter_box_location || null,
      litter_cleaning_interval_days: form.litter_cleaning_interval_days
        ? Number(form.litter_cleaning_interval_days)
        : null,
      litter_notes: form.litter_notes || null,
      vet_name: form.vet_name || null,
      vet_phone: form.vet_phone || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
      behavior_notes: form.behavior_notes || null,
      notes: form.notes || null,
    }

    if (editing) {
      const { error } = await supabase.from('pets').update(payload).eq('id', editing.id)
      if (error) { toast.error(error.message); setSaving(false); return }
      await syncPhoto(editing.id, editing.household_id, editing.photo_storage_path)
    } else {
      const household_id = await getHouseholdId(supabase)
      if (!household_id) {
        toast.error('No household found — finish setup in Settings first.')
        setSaving(false)
        return
      }
      const { data: created, error } = await supabase
        .from('pets')
        .insert({ ...payload, household_id })
        .select()
        .single()
      if (error) { toast.error(error.message); setSaving(false); return }
      await syncPhoto(created.id, household_id, null)
    }

    setSaving(false)
    setShowModal(false)
    resetPhotoState()
    refresh()
  }

  async function remove(pet: Pet) {
    if (!confirm(`Delete ${pet.name} and all their medication records?`)) return
    if (pet.photo_storage_path) {
      await supabase.storage.from('pet-photos').remove([pet.photo_storage_path])
    }
    const { error } = await supabase.from('pets').delete().eq('id', pet.id)
    if (error) { toast.error(error.message); return }
    refresh()
  }

  async function openMeds(pet: Pet) {
    setMedsPet(pet)
    setEditingMed(null)
    setMedForm(EMPTY_MED_FORM)
    setMedsLoading(true)
    const { data } = await supabase
      .from('pet_medications')
      .select('*')
      .eq('pet_id', pet.id)
      .order('created_at')
    setMeds(data ?? [])
    setMedsLoading(false)
  }

  async function reloadMeds(pet: Pet) {
    const { data } = await supabase
      .from('pet_medications')
      .select('*')
      .eq('pet_id', pet.id)
      .order('created_at')
    setMeds(data ?? [])
  }

  async function saveMed() {
    if (!medsPet || !medForm.name.trim()) return
    const payload = {
      name: medForm.name,
      dosage: medForm.dosage || null,
      schedule: medForm.schedule || null,
      instructions: medForm.instructions || null,
      start_date: medForm.start_date || null,
      end_date: medForm.end_date || null,
      notes: medForm.notes || null,
    }
    if (editingMed) {
      const { error } = await supabase.from('pet_medications').update(payload).eq('id', editingMed.id)
      if (error) { toast.error(error.message); return }
    } else {
      const { error } = await supabase.from('pet_medications').insert({
        ...payload,
        pet_id: medsPet.id,
        household_id: medsPet.household_id,
      })
      if (error) { toast.error(error.message); return }
    }
    setEditingMed(null)
    setMedForm(EMPTY_MED_FORM)
    await reloadMeds(medsPet)
    refresh()
  }

  function editMed(med: PetMedication) {
    setEditingMed(med)
    setMedForm({
      name: med.name,
      dosage: med.dosage ?? '',
      schedule: med.schedule ?? '',
      instructions: med.instructions ?? '',
      start_date: med.start_date ?? '',
      end_date: med.end_date ?? '',
      notes: med.notes ?? '',
    })
  }

  async function removeMed(med: PetMedication) {
    if (!confirm(`Delete "${med.name}"?`)) return
    const { error } = await supabase.from('pet_medications').delete().eq('id', med.id)
    if (error) { toast.error(error.message); return }
    if (editingMed?.id === med.id) {
      setEditingMed(null)
      setMedForm(EMPTY_MED_FORM)
    }
    if (medsPet) await reloadMeds(medsPet)
    refresh()
  }

  const usedSpecies: (PetSpecies | 'all')[] = [
    'all',
    ...SPECIES_ORDER.filter(s => pets.some(p => p.species === s)),
  ]

  const filtered = pets.filter(pet => {
    const q = search.toLowerCase()
    const matchSearch = search === '' ||
      pet.name.toLowerCase().includes(q) ||
      pet.breed?.toLowerCase().includes(q) ||
      SPECIES_LABELS[pet.species].toLowerCase().includes(q)
    const matchSpecies = speciesFilter === 'all' || pet.species === speciesFilter
    return matchSearch && matchSpecies
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Pets</h1>
        <button onClick={openAdd} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add Pet
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b09a86]" />
          <input
            className={cn(INPUT, 'pl-10')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pets..."
          />
        </div>
        {usedSpecies.length > 1 && (
          <div className={CHIP_GROUP}>
            {usedSpecies.map(s => (
              <button key={s} onClick={() => setSpeciesFilter(s)} className={chipClass(speciesFilter === s)}>
                {s === 'all' ? 'all' : SPECIES_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-52 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[#a58b78] font-semibold">
          No pets yet. Add one so a sitter always knows how to care for them!
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pet => {
            const feeding = feedingSummary(pet)
            const age = ageLabel(pet.birthdate)
            const medCount = medCountByPet[pet.id] ?? 0
            return (
              <div key={pet.id} className={cn('p-4 flex flex-col', CARD)}>
                <div className="flex gap-3 mb-3">
                  <div className="w-16 h-16 shrink-0 rounded-2xl overflow-hidden bg-[#dcc8ba] flex items-center justify-center">
                    {pet.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">{SPECIES_EMOJI[pet.species]}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-extrabold text-[#4b3a2f] truncate">{pet.name}</h3>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => openEdit(pet)} className={ICON_BTN} aria-label={`Edit ${pet.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => remove(pet)} className={ICON_BTN_DANGER} aria-label={`Delete ${pet.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {pet.breed && <p className="text-xs font-semibold text-[#a58b78] truncate">{pet.breed}</p>}
                    {age && <p className="text-xs font-semibold text-[#a58b78]">{age}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span
                    className={SOLID_CHIP}
                    style={{
                      backgroundColor: qualitativeChip(pet.species).bg,
                      color: qualitativeChip(pet.species).tx,
                    }}
                  >
                    {SPECIES_EMOJI[pet.species]} {SPECIES_LABELS[pet.species]}
                  </span>
                  {pet.walk_required && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.info.bg, color: SEVERITY_META.info.tx }}>
                      <Footprints className="h-3 w-3" /> Needs walks
                    </span>
                  )}
                  {pet.litter_cleaning_interval_days && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.neutral.bg, color: SEVERITY_META.neutral.tx }}>
                      Litter every {pet.litter_cleaning_interval_days}d
                    </span>
                  )}
                  {medCount > 0 && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.warning.bg, color: SEVERITY_META.warning.tx }}>
                      <Pill className="h-3 w-3" /> {medCount} medication{medCount === 1 ? '' : 's'}
                    </span>
                  )}
                  {pet.allergies && (
                    <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.danger.bg, color: SEVERITY_META.danger.tx }}>
                      Allergies
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs font-semibold text-[#a58b78] mb-3">
                  {feeding && <p className="truncate"><Utensils className="inline h-3 w-3 mr-1" />{feeding}</p>}
                  {pet.feeding_schedule && <p className="truncate">Feed: {pet.feeding_schedule}</p>}
                  {pet.walk_required && pet.walk_schedule && <p className="truncate">Walks: {pet.walk_schedule}</p>}
                </div>

                <div className="flex gap-2 mt-auto">
                  <button onClick={() => openMeds(pet)} className={cn(BTN_GHOST, 'flex-1 !py-2 !text-[13px]')}>
                    <Pill className="h-3.5 w-3.5" /> Medications
                  </button>
                  <Link href={`/pets/${pet.id}`} className={cn(BTN_GHOST, 'flex-1 !py-2 !text-[13px] no-underline')}>
                    <ClipboardList className="h-3.5 w-3.5" /> Sitter sheet
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-2xl')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{editing ? 'Edit Pet' : 'New Pet'}</h2>
              <button onClick={() => setShowModal(false)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-3">
              <p className={SECTION_HEADING}>Photo</p>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 shrink-0 rounded-2xl overflow-hidden bg-[#dcc8ba] flex items-center justify-center">
                  {photoPreview || (!photoCleared && editing?.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview ?? editing?.photo_url ?? ''}
                      alt={form.name || 'Pet photo'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">{SPECIES_EMOJI[form.species]}</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className={cn(BTN_GHOST, 'cursor-pointer !py-2 !text-[13px]')}>
                    <Upload className="h-3.5 w-3.5" /> {photoFile ? 'Change photo' : 'Choose photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) pickPhoto(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {(photoFile || (!photoCleared && editing?.photo_url)) && (
                    <button onClick={clearPhoto} className={cn(BTN_GHOST, '!py-2 !text-[13px]')}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove photo
                    </button>
                  )}
                </div>
              </div>

              <p className={SECTION_HEADING}>Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Name *</label>
                  <input
                    className={INPUT}
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Biscuit"
                  />
                </div>
                <div>
                  <label className={LABEL}>Species</label>
                  <select
                    className={INPUT}
                    value={form.species}
                    onChange={e => setForm(f => ({ ...f, species: e.target.value as PetSpecies }))}
                  >
                    {SPECIES_ORDER.map(s => (
                      <option key={s} value={s}>{SPECIES_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Breed</label>
                  <input
                    className={INPUT}
                    value={form.breed}
                    onChange={e => setForm(f => ({ ...f, breed: e.target.value }))}
                    placeholder="e.g. Golden Retriever"
                  />
                </div>
                <div>
                  <label className={LABEL}>Sex</label>
                  <select
                    className={INPUT}
                    value={form.sex}
                    onChange={e => setForm(f => ({ ...f, sex: e.target.value as PetSex | '' }))}
                  >
                    <option value="">Not set</option>
                    {(Object.keys(SEX_LABELS) as PetSex[]).map(s => (
                      <option key={s} value={s}>{SEX_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Birthdate</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={form.birthdate}
                    onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Weight</label>
                  <input
                    className={INPUT}
                    value={form.weight}
                    onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                    placeholder="e.g. 62 lbs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Color / Markings</label>
                  <input
                    className={INPUT}
                    value={form.color_markings}
                    onChange={e => setForm(f => ({ ...f, color_markings: e.target.value }))}
                    placeholder="e.g. Cream, white chest patch"
                  />
                </div>
                <div>
                  <label className={LABEL}>Microchip ID</label>
                  <input
                    className={INPUT}
                    value={form.microchip_id}
                    onChange={e => setForm(f => ({ ...f, microchip_id: e.target.value }))}
                  />
                </div>
              </div>

              <p className={SECTION_HEADING}>Feeding</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Food Type</label>
                  <select
                    className={INPUT}
                    value={form.food_type}
                    onChange={e => setForm(f => ({ ...f, food_type: e.target.value as PetFoodType | '' }))}
                  >
                    <option value="">Not set</option>
                    {(Object.keys(FOOD_TYPE_LABELS) as PetFoodType[]).map(t => (
                      <option key={t} value={t}>{FOOD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Brand</label>
                  <input
                    className={INPUT}
                    value={form.food_brand}
                    onChange={e => setForm(f => ({ ...f, food_brand: e.target.value }))}
                    placeholder="e.g. Blue Buffalo Chicken"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Amount Per Meal</label>
                  <input
                    className={INPUT}
                    value={form.food_amount}
                    onChange={e => setForm(f => ({ ...f, food_amount: e.target.value }))}
                    placeholder="e.g. 1 cup dry + 1/2 can wet"
                  />
                </div>
                <div>
                  <label className={LABEL}>Feeding Schedule</label>
                  <input
                    className={INPUT}
                    value={form.feeding_schedule}
                    onChange={e => setForm(f => ({ ...f, feeding_schedule: e.target.value }))}
                    placeholder="e.g. 7am and 6pm"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Feeding Notes</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.feeding_notes}
                  onChange={e => setForm(f => ({ ...f, feeding_notes: e.target.value }))}
                  placeholder="Where food is kept, treats, fresh water, no table scraps..."
                />
              </div>
              <div>
                <label className={LABEL}>Allergies / Foods to Avoid</label>
                <input
                  className={INPUT}
                  value={form.allergies}
                  onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                  placeholder="e.g. Chicken, grain"
                />
              </div>

              {form.species === 'dog' && (
                <>
                  <p className={SECTION_HEADING}>Walks</p>
                  <label className="flex items-center gap-2 text-sm font-bold text-[#6a5647] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.walk_required}
                      onChange={e => setForm(f => ({ ...f, walk_required: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    Needs to be walked
                  </label>
                  {form.walk_required && (
                    <>
                      <div>
                        <label className={LABEL}>Walk Schedule</label>
                        <input
                          className={INPUT}
                          value={form.walk_schedule}
                          onChange={e => setForm(f => ({ ...f, walk_schedule: e.target.value }))}
                          placeholder="e.g. 7am, 12pm, 6pm — 20 min each"
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Walk Notes</label>
                        <textarea
                          className={cn(INPUT, 'resize-none h-16')}
                          value={form.walk_notes}
                          onChange={e => setForm(f => ({ ...f, walk_notes: e.target.value }))}
                          placeholder="Leash and harness location, usual route, behavior around other dogs..."
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {form.species === 'cat' && (
                <>
                  <p className={SECTION_HEADING}>Litter Box</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Litter Box Location</label>
                      <input
                        className={INPUT}
                        value={form.litter_box_location}
                        onChange={e => setForm(f => ({ ...f, litter_box_location: e.target.value }))}
                        placeholder="e.g. Laundry room"
                      />
                    </div>
                    <div>
                      <label className={LABEL}>Clean Every (days)</label>
                      <input
                        type="number"
                        min="1"
                        className={INPUT}
                        value={form.litter_cleaning_interval_days}
                        onChange={e => setForm(f => ({ ...f, litter_cleaning_interval_days: e.target.value }))}
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Litter Notes</label>
                    <textarea
                      className={cn(INPUT, 'resize-none h-16')}
                      value={form.litter_notes}
                      onChange={e => setForm(f => ({ ...f, litter_notes: e.target.value }))}
                      placeholder="Litter brand, where refills are kept, how to dispose..."
                    />
                  </div>
                </>
              )}

              <p className={SECTION_HEADING}>Vet &amp; Emergency</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Vet Name</label>
                  <input
                    className={INPUT}
                    value={form.vet_name}
                    onChange={e => setForm(f => ({ ...f, vet_name: e.target.value }))}
                    placeholder="e.g. Oak Street Animal Hospital"
                  />
                </div>
                <div>
                  <label className={LABEL}>Vet Phone</label>
                  <input
                    type="tel"
                    className={INPUT}
                    value={form.vet_phone}
                    onChange={e => setForm(f => ({ ...f, vet_phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Emergency Contact</label>
                  <input
                    className={INPUT}
                    value={form.emergency_contact_name}
                    onChange={e => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Emergency Phone</label>
                  <input
                    type="tel"
                    className={INPUT}
                    value={form.emergency_contact_phone}
                    onChange={e => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))}
                  />
                </div>
              </div>

              <p className={SECTION_HEADING}>Notes</p>
              <div>
                <label className={LABEL}>Behavior &amp; Temperament</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.behavior_notes}
                  onChange={e => setForm(f => ({ ...f, behavior_notes: e.target.value }))}
                  placeholder="Hides under the bed with strangers, afraid of thunder, loves belly rubs..."
                />
              </div>
              <div>
                <label className={LABEL}>General Notes</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything else a sitter should know"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className={cn(BTN_GHOST, 'flex-1')}>Cancel</button>
              <button onClick={save} disabled={saving} className={cn(BTN_PRIMARY, 'flex-1', saving && 'opacity-50 pointer-events-none')}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Add Pet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {medsPet && (
        <div className={MODAL_OVERLAY}>
          <div className={cn(MODAL_PANEL, 'max-w-lg')}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-[#4b3a2f]">{medsPet.name} — Medications</h2>
              <button onClick={() => setMedsPet(null)} className={ICON_BTN}><X className="h-4 w-4" /></button>
            </div>

            {medsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-[#dcc8ba] animate-pulse" />)}
              </div>
            ) : meds.length === 0 ? (
              <p className="text-sm font-semibold text-[#a58b78] text-center py-6">
                No medications recorded. Add one below.
              </p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-1">
                {meds.map(med => (
                  <div key={med.id} className="flex gap-3 items-start">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-[#4b3a2f]">
                        {med.name}{med.dosage ? ` — ${med.dosage}` : ''}
                      </p>
                      {med.schedule && <p className="text-xs font-semibold text-[#a58b78]">{med.schedule}</p>}
                      {med.instructions && <p className="text-xs font-semibold text-[#a58b78]">{med.instructions}</p>}
                      {(med.start_date || med.end_date) && (
                        <p className="text-xs font-semibold text-[#a58b78]">
                          {med.start_date ?? '—'} to {med.end_date ?? 'ongoing'}
                        </p>
                      )}
                      {med.notes && <p className="text-xs font-semibold text-[#a58b78]">{med.notes}</p>}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => editMed(med)} className={ICON_BTN} aria-label={`Edit ${med.name}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => removeMed(med)} className={ICON_BTN_DANGER} aria-label={`Delete ${med.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[rgba(150,120,95,0.14)] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Medication *</label>
                  <input
                    className={INPUT}
                    value={medForm.name}
                    onChange={e => setMedForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Apoquel"
                  />
                </div>
                <div>
                  <label className={LABEL}>Dosage</label>
                  <input
                    className={INPUT}
                    value={medForm.dosage}
                    onChange={e => setMedForm(f => ({ ...f, dosage: e.target.value }))}
                    placeholder="e.g. 16mg, 1 tablet"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Schedule</label>
                <input
                  className={INPUT}
                  value={medForm.schedule}
                  onChange={e => setMedForm(f => ({ ...f, schedule: e.target.value }))}
                  placeholder="e.g. Twice daily with meals"
                />
              </div>
              <div>
                <label className={LABEL}>How to Give It</label>
                <textarea
                  className={cn(INPUT, 'resize-none h-16')}
                  value={medForm.instructions}
                  onChange={e => setMedForm(f => ({ ...f, instructions: e.target.value }))}
                  placeholder="e.g. Hide in a pill pocket, kept in the fridge door"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Start Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={medForm.start_date}
                    onChange={e => setMedForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>End Date</label>
                  <input
                    type="date"
                    className={INPUT}
                    value={medForm.end_date}
                    onChange={e => setMedForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className={LABEL}>Notes</label>
                <input
                  className={INPUT}
                  value={medForm.notes}
                  onChange={e => setMedForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2">
                {editingMed && (
                  <button
                    onClick={() => { setEditingMed(null); setMedForm(EMPTY_MED_FORM) }}
                    className={cn(BTN_GHOST, 'flex-1')}
                  >
                    Cancel
                  </button>
                )}
                <button onClick={saveMed} className={cn(BTN_PRIMARY, 'flex-1')}>
                  {!editingMed && <Plus className="h-4 w-4" strokeWidth={2.5} />}
                  {editingMed ? 'Save Medication' : 'Add Medication'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
