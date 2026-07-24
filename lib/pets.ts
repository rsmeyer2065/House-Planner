import type { Pet, PetFoodType, PetSex, PetSpecies } from './types'

/**
 * Shared pet vocabulary — used by the pets list page and the per-pet sitter
 * sheet so both spell species, food types and feeding summaries the same way.
 */

export const SPECIES_LABELS: Record<PetSpecies, string> = {
  dog: 'Dog',
  cat: 'Cat',
  bird: 'Bird',
  fish: 'Fish',
  reptile: 'Reptile',
  small_mammal: 'Small mammal',
  other: 'Other',
}

export const SPECIES_EMOJI: Record<PetSpecies, string> = {
  dog: '🐕',
  cat: '🐈',
  bird: '🐦',
  fish: '🐠',
  reptile: '🦎',
  small_mammal: '🐹',
  other: '🐾',
}

export const SEX_LABELS: Record<PetSex, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
}

export const FOOD_TYPE_LABELS: Record<PetFoodType, string> = {
  dry: 'Dry food',
  wet: 'Wet food',
  both: 'Wet & dry',
  raw: 'Raw',
  prescription: 'Prescription',
  other: 'Other',
}

export const SPECIES_ORDER = Object.keys(SPECIES_LABELS) as PetSpecies[]

// A one-line "what this pet eats" summary for the card, e.g.
// "Wet & dry · Blue Buffalo · 1 cup". Empty string when nothing is recorded.
export function feedingSummary(pet: Pet): string {
  return [
    pet.food_type ? FOOD_TYPE_LABELS[pet.food_type] : null,
    pet.food_brand,
    pet.food_amount,
  ]
    .filter(Boolean)
    .join(' · ')
}

// Years old, or null when no birthdate is recorded. Under a year reads as
// months so a puppy/kitten doesn't show "0 years".
export function ageLabel(birthdate: string | null): string | null {
  if (!birthdate) return null
  const born = new Date(birthdate)
  if (Number.isNaN(born.getTime())) return null
  const now = new Date()
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth())
  if (now.getDate() < born.getDate()) months -= 1
  if (months < 0) return null
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} old`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} old`
}
