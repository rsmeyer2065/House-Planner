import type { HouseholdSection, MemberType } from './types'

/**
 * Single source of truth for how the app's sections map to routes and how a
 * member's access is evaluated. Kept free of React/icon imports so it can be
 * used from the edge middleware (proxy.ts) as well as client components.
 */

// Data sections a temporary member can be granted. `dashboard` is always
// implicitly granted (their landing page) and so is not listed here.
export const TEMP_GRANTABLE_SECTIONS: HouseholdSection[] = [
  'tasks',
  'plants',
  'pets',
  'notes',
  'contacts',
  'inventory',
]

export const SECTION_LABELS: Record<HouseholdSection, string> = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  plants: 'Plants',
  pets: 'Pets',
  notes: 'Notes',
  contacts: 'Contacts',
  inventory: 'Inventory',
  projects: 'Projects',
  calendar: 'Calendar',
  budget: 'Budget',
  shopping: 'Shopping',
}

// Route prefix -> section, used to classify a request path.
const ROUTE_SECTIONS: { prefix: string; section: HouseholdSection }[] = [
  { prefix: '/dashboard', section: 'dashboard' },
  { prefix: '/tasks', section: 'tasks' },
  { prefix: '/plants', section: 'plants' },
  { prefix: '/pets', section: 'pets' },
  { prefix: '/notes', section: 'notes' },
  { prefix: '/contacts', section: 'contacts' },
  { prefix: '/inventory', section: 'inventory' },
  { prefix: '/projects', section: 'projects' },
  { prefix: '/calendar', section: 'calendar' },
  { prefix: '/budget', section: 'budget' },
  { prefix: '/shopping', section: 'shopping' },
]

// The section a path belongs to, or null for paths not tied to a section
// (e.g. /settings, which every member may reach).
export function sectionForPath(pathname: string): HouseholdSection | null {
  const match = ROUTE_SECTIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/')
  )
  return match?.section ?? null
}

// A member's access, computed from their household_members row.
export type MemberAccess = {
  memberType: MemberType
  allowedSections: HouseholdSection[] | null // null => all (permanent)
  accessExpiresAt: string | null
  isExpired: boolean
}

// Full access, used for permanent members and any unresolved membership.
export const PERMANENT_ACCESS: MemberAccess = {
  memberType: 'permanent',
  allowedSections: null,
  accessExpiresAt: null,
  isExpired: false,
}

// The raw shape of a household_members row (only the access-relevant columns).
export type MemberAccessRow = {
  member_type: MemberType
  allowed_sections: HouseholdSection[] | null
  access_starts_at: string | null
  access_expires_at: string | null
}

// Compute a MemberAccess from a household_members row. A missing row or a
// permanent row yields full access; a temporary row is evaluated against its
// access window.
export function memberAccessFromRow(row: MemberAccessRow | null): MemberAccess {
  if (!row || row.member_type !== 'temporary') return PERMANENT_ACCESS

  const now = Date.now()
  const startsAt = row.access_starts_at ? new Date(row.access_starts_at).getTime() : null
  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at).getTime() : null
  const isExpired =
    (startsAt !== null && startsAt > now) || (expiresAt !== null && expiresAt <= now)

  return {
    memberType: 'temporary',
    allowedSections: row.allowed_sections ?? [],
    accessExpiresAt: row.access_expires_at ?? null,
    isExpired,
  }
}

// Mirrors the has_section_access() SQL function: permanent members can reach
// everything; temporary members can reach dashboard plus their granted
// sections while their access window is open.
export function canAccessSection(
  access: MemberAccess,
  section: HouseholdSection
): boolean {
  if (access.memberType === 'permanent') return true
  if (access.isExpired) return false
  if (section === 'dashboard') return true
  return (access.allowedSections ?? []).includes(section)
}
