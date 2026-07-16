import type { SupabaseClient } from '@supabase/supabase-js'
import { memberAccessFromRow, PERMANENT_ACCESS, type MemberAccess, type MemberAccessRow } from './sections'

/**
 * Resolve the current signed-in user's household id from their profile.
 *
 * Every household-scoped table requires `household_id` to be set on insert
 * (it is NOT NULL and enforced by the RLS `with check` policy). The browser
 * client never populates it automatically, so callers must look it up and
 * include it on every insert.
 */
export async function getHouseholdId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  return data?.household_id ?? null
}

/**
 * Resolve the current user's access in their *active* household: whether they
 * are a permanent or temporary member, which sections they may reach, and
 * whether a temporary window has expired.
 *
 * Permanent members (and anyone with no membership row resolved) get full
 * access (`allowedSections: null`). This mirrors the `has_section_access()`
 * RLS function and is used by the sidebar, mobile nav, dashboard, and the
 * proxy.ts route guard to hide/redirect sections a temporary member can't use.
 */
export async function getMemberAccess(
  supabase: SupabaseClient
): Promise<MemberAccess> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return PERMANENT_ACCESS

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()
  const householdId = profile?.household_id ?? null
  if (!householdId) return PERMANENT_ACCESS

  const { data: member } = await supabase
    .from('household_members')
    .select('member_type, allowed_sections, access_starts_at, access_expires_at')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .single()

  return memberAccessFromRow(member as MemberAccessRow | null)
}
