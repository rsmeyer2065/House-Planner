'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Pet, PetMedication } from '@/lib/types'
import {
  SPECIES_LABELS, SPECIES_EMOJI, SEX_LABELS, FOOD_TYPE_LABELS, ageLabel,
} from '@/lib/pets'
import { ArrowLeft, Printer, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CARD, BTN_GHOST, SOLID_CHIP, SEVERITY_META, qualitativeChip } from '@/lib/neu'

/**
 * Everything a pet or house sitter needs for one animal, on a single page that
 * prints cleanly (see the @media print rules in globals.css).
 */

const HEADING = 'text-[13px] font-extrabold uppercase tracking-wider text-[#a58b78] mb-3'

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#a58b78]">{label}</p>
      <p className="text-[15px] font-bold text-[#4b3a2f] whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function PhoneField({ label, name, phone }: { label: string; name: string | null; phone: string | null }) {
  if (!name && !phone) return null
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-[#a58b78]">{label}</p>
      {name && <p className="text-[15px] font-bold text-[#4b3a2f]">{name}</p>}
      {phone && (
        <a href={`tel:${phone}`} className="text-[15px] font-bold text-[#c1673f] no-underline inline-flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5" /> {phone}
        </a>
      )}
    </div>
  )
}

// A card is only worth printing when at least one of its fields has a value.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cn('p-5', CARD)}>
      <h2 className={HEADING}>{title}</h2>
      <div className="grid sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

export default function SitterSheetPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const supabase = createClient()

  const { data, isPending: loading } = useQuery({
    queryKey: ['pet', id],
    queryFn: async (): Promise<{ pet: Pet | null; meds: PetMedication[] }> => {
      const [petRes, medsRes] = await Promise.all([
        supabase.from('pets').select('*').eq('id', id).maybeSingle(),
        supabase.from('pet_medications').select('*').eq('pet_id', id).order('created_at'),
      ])
      if (petRes.error) throw petRes.error
      if (medsRes.error) throw medsRes.error
      return { pet: petRes.data, meds: medsRes.data ?? [] }
    },
  })

  const pet = data?.pet ?? null
  const meds = data?.meds ?? []

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
      </div>
    )
  }

  if (!pet) {
    return (
      <div className="flex flex-col gap-4 items-start">
        <p className="text-[#a58b78] font-semibold">That pet no longer exists.</p>
        <Link href="/pets" className={cn(BTN_GHOST, 'no-underline')}>
          <ArrowLeft className="h-4 w-4" /> Back to Pets
        </Link>
      </div>
    )
  }

  const age = ageLabel(pet.birthdate)
  const hasFeeding = !!(pet.food_type || pet.food_brand || pet.food_amount ||
    pet.feeding_schedule || pet.feeding_notes || pet.allergies)
  const hasWalks = pet.walk_required || !!pet.walk_schedule || !!pet.walk_notes
  const hasLitter = !!(pet.litter_box_location || pet.litter_cleaning_interval_days || pet.litter_notes)
  const hasContacts = !!(pet.vet_name || pet.vet_phone ||
    pet.emergency_contact_name || pet.emergency_contact_phone)
  const hasNotes = !!(pet.behavior_notes || pet.notes)

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href="/pets" className={cn(BTN_GHOST, 'no-underline')}>
          <ArrowLeft className="h-4 w-4" /> Back to Pets
        </Link>
        <button onClick={() => window.print()} className={cn(BTN_GHOST)}>
          <Printer className="h-4 w-4" /> Print
        </button>
      </div>

      <div className={cn('p-5 flex flex-col sm:flex-row gap-5', CARD)}>
        <div className="w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-[#dcc8ba] flex items-center justify-center">
          {pet.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl">{SPECIES_EMOJI[pet.species]}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#a58b78]">Sitter sheet</p>
          <h1 className="text-[32px] font-black tracking-tight text-[#4b3a2f] leading-tight">{pet.name}</h1>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span
              className={SOLID_CHIP}
              style={{
                backgroundColor: qualitativeChip(pet.species).bg,
                color: qualitativeChip(pet.species).tx,
              }}
            >
              {SPECIES_EMOJI[pet.species]} {SPECIES_LABELS[pet.species]}
            </span>
            {pet.breed && (
              <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.neutral.bg, color: SEVERITY_META.neutral.tx }}>
                {pet.breed}
              </span>
            )}
            {pet.sex && (
              <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.neutral.bg, color: SEVERITY_META.neutral.tx }}>
                {SEX_LABELS[pet.sex]}
              </span>
            )}
            {age && (
              <span className={SOLID_CHIP} style={{ backgroundColor: SEVERITY_META.neutral.bg, color: SEVERITY_META.neutral.tx }}>
                {age}
              </span>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <Field label="Weight" value={pet.weight} />
            <Field label="Color / Markings" value={pet.color_markings} />
            <Field label="Microchip ID" value={pet.microchip_id} />
          </div>
        </div>
      </div>

      {hasFeeding && (
        <Section title="Feeding">
          <Field label="Food" value={pet.food_type ? FOOD_TYPE_LABELS[pet.food_type] : null} />
          <Field label="Brand" value={pet.food_brand} />
          <Field label="Amount per meal" value={pet.food_amount} />
          <Field label="Schedule" value={pet.feeding_schedule} />
          <Field label="Allergies / avoid" value={pet.allergies} />
          <Field label="Notes" value={pet.feeding_notes} />
        </Section>
      )}

      {hasWalks && (
        <Section title="Walks">
          <Field label="Walks needed" value={pet.walk_required ? 'Yes' : 'No'} />
          <Field label="Schedule" value={pet.walk_schedule} />
          <Field label="Notes" value={pet.walk_notes} />
        </Section>
      )}

      {hasLitter && (
        <Section title="Litter Box">
          <Field label="Location" value={pet.litter_box_location} />
          <Field
            label="Clean every"
            value={
              pet.litter_cleaning_interval_days
                ? `${pet.litter_cleaning_interval_days} day${pet.litter_cleaning_interval_days === 1 ? '' : 's'}`
                : null
            }
          />
          <Field label="Notes" value={pet.litter_notes} />
        </Section>
      )}

      {meds.length > 0 && (
        <div className={cn('p-5', CARD)}>
          <h2 className={HEADING}>Medications</h2>
          <div className="flex flex-col gap-4">
            {meds.map(med => (
              <div key={med.id} className="border-l-4 border-[#c1673f] pl-3">
                <p className="text-[16px] font-black text-[#4b3a2f]">
                  {med.name}{med.dosage ? ` — ${med.dosage}` : ''}
                </p>
                {med.schedule && <p className="text-[15px] font-bold text-[#6a5647]">{med.schedule}</p>}
                {med.instructions && (
                  <p className="text-[14px] font-semibold text-[#a58b78] whitespace-pre-wrap">{med.instructions}</p>
                )}
                {(med.start_date || med.end_date) && (
                  <p className="text-[13px] font-semibold text-[#a58b78]">
                    {med.start_date ?? '—'} to {med.end_date ?? 'ongoing'}
                  </p>
                )}
                {med.notes && <p className="text-[13px] font-semibold text-[#a58b78]">{med.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasContacts && (
        <Section title="Vet & Emergency">
          <PhoneField label="Veterinarian" name={pet.vet_name} phone={pet.vet_phone} />
          <PhoneField
            label="Emergency contact"
            name={pet.emergency_contact_name}
            phone={pet.emergency_contact_phone}
          />
        </Section>
      )}

      {hasNotes && (
        <Section title="Notes">
          <Field label="Behavior & temperament" value={pet.behavior_notes} />
          <Field label="General notes" value={pet.notes} />
        </Section>
      )}
    </div>
  )
}
