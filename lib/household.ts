import type { SupabaseClient } from '@supabase/supabase-js'

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
