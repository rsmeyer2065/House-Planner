'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Household, HouseholdInvitation, HouseholdSection, MemberType } from '@/lib/types'
import { Copy, Check, LogOut, Users, Mail, X, Plus, LogIn, ArrowLeftRight, DoorOpen, Hourglass, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, BTN_DANGER_GHOST, RAISED_SM, INSET_SM } from '@/lib/neu'
import { TEMP_GRANTABLE_SECTIONS, SECTION_LABELS } from '@/lib/sections'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// A <input type="datetime-local"> value -> ISO string (or null when empty).
function localToIso(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// ISO string -> a value a <input type="datetime-local"> accepts (local time).
function isoToLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'no end date'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'no end date'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// A household the current user belongs to, shaped from the household_members join.
type Membership = {
  household_id: string
  role: string
  households: Household | null
}

// A member of the active household, shaped from the household_members join.
type Member = {
  user_id: string
  role: string
  member_type: MemberType
  allowed_sections: HouseholdSection[] | null
  access_starts_at: string | null
  access_expires_at: string | null
  profiles: Pick<Profile, 'full_name' | 'avatar_url'> | null
}

type SettingsData = {
  profile: Profile | null
  userEmail: string
  household: Household | null
  memberships: Membership[]
  members: Member[]
  outgoingInvites: HouseholdInvitation[]
  incomingInvites: HouseholdInvitation[]
}

export default function SettingsPage() {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteTemp, setInviteTemp] = useState(false)
  const [inviteSections, setInviteSections] = useState<HouseholdSection[]>([])
  const [inviteStart, setInviteStart] = useState('')
  const [inviteEnd, setInviteEnd] = useState('')
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editSections, setEditSections] = useState<HouseholdSection[]>([])
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const householdNameRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data, isPending: loading } = useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<SettingsData> => {
      const empty: SettingsData = {
        profile: null, userEmail: '', household: null,
        memberships: [], members: [], outgoingInvites: [], incomingInvites: [],
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return empty

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

      // All households this user belongs to.
      const { data: memsRaw } = await supabase
        .from('household_members')
        .select('household_id, role, households(*)')
        .eq('user_id', user.id)
      const memberships = (memsRaw as unknown as Membership[]) ?? []

      const activeId = profile?.household_id ?? null
      let household: Household | null = null
      let members: Member[] = []
      let outgoingInvites: HouseholdInvitation[] = []
      if (activeId) {
        household = memberships.find(m => m.household_id === activeId)?.households
          ?? (await supabase.from('households').select('*').eq('id', activeId).single()).data

        const { data: mbrs } = await supabase
          .from('household_members')
          .select('user_id, role, member_type, allowed_sections, access_starts_at, access_expires_at, profiles(full_name, avatar_url)')
          .eq('household_id', activeId)
        members = (mbrs as unknown as Member[]) ?? []

        const { data: outg } = await supabase
          .from('household_invitations')
          .select('*')
          .eq('household_id', activeId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        outgoingInvites = outg ?? []
      }

      // Invitations addressed to me.
      let incomingInvites: HouseholdInvitation[] = []
      if (user.email) {
        const { data: inc } = await supabase
          .from('household_invitations')
          .select('*, households(name)')
          .ilike('email', user.email)
          .eq('status', 'pending')
        incomingInvites = (inc as unknown as HouseholdInvitation[]) ?? []
      }

      return { profile, userEmail: user.email ?? '', household, memberships, members, outgoingInvites, incomingInvites }
    },
  })

  const reload = () => queryClient.invalidateQueries({ queryKey: ['settings'] })

  const profile = data?.profile ?? null
  const household = data?.household ?? null
  const memberships = data?.memberships ?? []
  const members = data?.members ?? []
  const outgoingInvites = data?.outgoingInvites ?? []
  const incomingInvites = data?.incomingInvites ?? []
  const inviteCode = household?.invite_code ?? ''

  // The current user's membership in the active household drives whether they
  // see the full management UI (permanent) or the trimmed self-view (temporary).
  const myMember = members.find(m => m.user_id === profile?.id) ?? null
  const isTempMember = myMember?.member_type === 'temporary'

  function toggleFrom(list: HouseholdSection[], s: HouseholdSection): HouseholdSection[] {
    return list.includes(s) ? list.filter(x => x !== s) : [...list, s]
  }

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: nameRef.current?.value ?? '' }).eq('id', profile.id)
    setSaving(false)
    reload()
    router.refresh()
  }

  async function saveHousehold() {
    if (!household) return
    setSaving(true)
    await supabase.from('households').update({ name: householdNameRef.current?.value ?? '' }).eq('id', household.id)
    setSaving(false)
    reload()
    router.refresh()
  }

  async function createHousehold() {
    if (!profile) return
    setSaving(true)
    const { data: hh } = await supabase
      .from('households')
      .insert({ name: newHouseholdName.trim() || 'Our Home' })
      .select()
      .single()
    if (hh) {
      await supabase.from('household_members').insert({ household_id: hh.id, user_id: profile.id })
      await supabase.from('profiles').update({ household_id: hh.id }).eq('id', profile.id)
      setNewHouseholdName('')
      reload()
      router.refresh()
    }
    setSaving(false)
  }

  async function joinHousehold() {
    setJoinError('')
    if (!profile) return
    // A definer RPC validates the code and creates the (permanent) membership;
    // direct self-insert into an existing household is no longer permitted.
    const { error } = await supabase.rpc('join_household_by_code', { p_code: joinCode })
    if (error) {
      setJoinError('Invalid invite code.')
      return
    }
    setJoinCode('')
    reload()
    router.refresh()
  }

  async function switchHousehold(id: string) {
    if (!profile || id === profile.household_id) return
    await supabase.from('profiles').update({ household_id: id }).eq('id', profile.id)
    reload()
    router.refresh()
  }

  async function leaveHousehold(id: string) {
    if (!profile) return
    const name = memberships.find(m => m.household_id === id)?.households?.name ?? 'this household'
    if (!confirm(`Leave "${name}"? You'll lose access to its data unless you're invited back.`)) return

    // If leaving the active household, move the active pointer to another
    // membership (or null) first -- otherwise the pointer would keep granting
    // access to a household you're no longer a member of.
    if (id === profile.household_id) {
      const next = memberships.find(m => m.household_id !== id)?.household_id ?? null
      await supabase.from('profiles').update({ household_id: next }).eq('id', profile.id)
    }
    await supabase.from('household_members').delete().eq('household_id', id).eq('user_id', profile.id)
    reload()
    router.refresh()
  }

  async function sendInvite() {
    setInviteMsg('')
    if (!household || !profile) return
    const email = inviteEmail.trim().toLowerCase()
    if (!email) return
    if (inviteTemp && inviteSections.length === 0) {
      setInviteMsg('Choose at least one section for temporary access.')
      return
    }
    const payload: {
      household_id: string
      email: string
      invited_by: string
      member_type?: MemberType
      allowed_sections?: HouseholdSection[]
      access_starts_at?: string | null
      access_expires_at?: string | null
    } = { household_id: household.id, email, invited_by: profile.id }
    if (inviteTemp) {
      payload.member_type = 'temporary'
      payload.allowed_sections = inviteSections
      payload.access_starts_at = localToIso(inviteStart)
      payload.access_expires_at = localToIso(inviteEnd)
    }
    const { error } = await supabase.from('household_invitations').insert(payload)
    if (error) {
      setInviteMsg(error.message)
      return
    }
    setInviteEmail('')
    setInviteTemp(false)
    setInviteSections([])
    setInviteStart('')
    setInviteEnd('')
    setInviteMsg(`Invitation sent to ${email}.`)
    reload()
  }

  async function revokeInvite(id: string) {
    await supabase.from('household_invitations').delete().eq('id', id)
    reload()
  }

  async function acceptInvite(inv: HouseholdInvitation) {
    if (!profile) return
    // A security-definer RPC creates the membership from the invitation's own
    // grant, so a temporary invitee can't forge permanent/all-sections access.
    const { error } = await supabase.rpc('accept_invitation', { p_invite_id: inv.id })
    if (error) {
      setInviteMsg(error.message)
      return
    }
    reload()
    router.refresh()
  }

  function startEditMember(m: Member) {
    setEditingUserId(m.user_id)
    setEditSections(m.allowed_sections ?? [])
    setEditStart(isoToLocal(m.access_starts_at))
    setEditEnd(isoToLocal(m.access_expires_at))
  }

  async function saveTemporaryAccess(userId: string) {
    if (!household) return
    if (editSections.length === 0) return
    setSaving(true)
    await supabase.rpc('set_temporary_access', {
      p_household_id: household.id,
      p_user_id: userId,
      p_allowed_sections: editSections,
      p_starts_at: localToIso(editStart),
      p_expires_at: localToIso(editEnd),
    })
    setSaving(false)
    setEditingUserId(null)
    reload()
  }

  async function removeMember(m: Member) {
    if (!household) return
    const name = m.profiles?.full_name || 'this member'
    if (!confirm(`Remove ${name}'s temporary access to "${household.name}"?`)) return
    await supabase.rpc('remove_member', { p_household_id: household.id, p_user_id: m.user_id })
    reload()
  }

  async function declineInvite(inv: HouseholdInvitation) {
    await supabase.from('household_invitations').update({ status: 'declined' }).eq('id', inv.id)
    reload()
  }

  async function copyInviteCode() {
    await navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="h-8 w-32 bg-[#dcc8ba] rounded animate-pulse mb-6" />
        {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-lg flex flex-col gap-5">
      <h1 className="text-[28px] font-black tracking-tight text-[#4b3a2f]">Settings</h1>

      {/* Profile */}
      <div className={cn('p-5', CARD)}>
        <h2 className="font-extrabold text-[#4b3a2f] mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className={LABEL}>Display Name</label>
            <input
              key={profile?.id}
              ref={nameRef}
              className={INPUT}
              defaultValue={profile?.full_name ?? ''}
              placeholder="Your name"
            />
          </div>
          {data?.userEmail && (
            <div>
              <label className={LABEL}>Email</label>
              <div className={cn('rounded-2xl px-4 py-2.5 text-sm font-semibold text-[#8a7462] bg-[#e6d6ca]', INSET_SM)}>
                {data.userEmail}
              </div>
            </div>
          )}
          <button onClick={saveProfile} disabled={saving} className={BTN_PRIMARY}>
            Save Profile
          </button>
        </div>
      </div>

      {/* Invitations addressed to me */}
      {incomingInvites.length > 0 && (
        <div className={cn('p-5', CARD)}>
          <h2 className="font-extrabold text-[#4b3a2f] mb-1 flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#c1673f]" /> Invitations
          </h2>
          <p className="text-xs font-semibold text-[#a58b78] mb-4">You&apos;ve been invited to join these households.</p>
          <div className="space-y-3">
            {incomingInvites.map(inv => (
              <div key={inv.id} className={cn('rounded-2xl px-4 py-3 bg-[#e6d6ca]', RAISED_SM)}>
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-extrabold text-sm text-[#4b3a2f]">
                    {inv.households?.name ?? 'A household'}
                  </span>
                  <button onClick={() => acceptInvite(inv)} className={cn(BTN_PRIMARY, 'px-4 py-2')}>Accept</button>
                  <button onClick={() => declineInvite(inv)} className={cn(BTN_GHOST, 'px-4 py-2')}>Decline</button>
                </div>
                {inv.member_type === 'temporary' && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#c1673f] bg-[#efd9cf] px-2 py-0.5 rounded-full">
                      <Hourglass className="h-3 w-3" /> Temporary
                    </span>
                    {(inv.allowed_sections ?? []).map(s => (
                      <span key={s} className="text-[11px] font-bold text-[#7a6142] bg-[#e7ddce] px-2 py-0.5 rounded-full">
                        {SECTION_LABELS[s]}
                      </span>
                    ))}
                    <span className="text-[11px] font-semibold text-[#a58b78] w-full">
                      Access until {formatDateTime(inv.access_expires_at)}.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Temporary member self-view: a read-only summary of their access. */}
      {household && isTempMember && (
        <div className={cn('p-5', CARD)}>
          <h2 className="font-extrabold text-[#4b3a2f] mb-1 flex items-center gap-2">
            <Hourglass className="h-4 w-4 text-[#c1673f]" /> Your Access
          </h2>
          <p className="text-xs font-semibold text-[#a58b78] mb-4">
            You&apos;re a temporary member of {household.name}.
          </p>
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Sections you can use</label>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[11px] font-bold text-[#7a6142] bg-[#e7ddce] px-2.5 py-1 rounded-full">Dashboard</span>
                {(myMember?.allowed_sections ?? []).map(s => (
                  <span key={s} className="text-[11px] font-bold text-[#7a6142] bg-[#e7ddce] px-2.5 py-1 rounded-full">
                    {SECTION_LABELS[s]}
                  </span>
                ))}
              </div>
            </div>
            <div className="border-t border-[rgba(150,120,95,0.18)] pt-3">
              <label className={LABEL}>Access period</label>
              <p className="text-sm font-semibold text-[#8a7462]">
                {myMember?.access_starts_at ? `From ${formatDateTime(myMember.access_starts_at)} · ` : ''}
                Until {formatDateTime(myMember?.access_expires_at ?? null)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active household management (permanent members only). */}
      {household && !isTempMember && (
        <div className={cn('p-5', CARD)}>
          <h2 className="font-extrabold text-[#4b3a2f] mb-4">Current Household</h2>
          <div className="space-y-4">
            <div>
              <label className={LABEL}>Household Name</label>
              <div className="flex gap-2">
                <input
                  key={household.id}
                  ref={householdNameRef}
                  className={cn(INPUT, 'flex-1')}
                  defaultValue={household.name}
                />
                <button onClick={saveHousehold} disabled={saving} className={BTN_PRIMARY}>
                  Save
                </button>
              </div>
            </div>

            {/* Members */}
            <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5">
              <label className={cn(LABEL, 'flex items-center gap-1.5')}>
                <Users className="h-3.5 w-3.5" /> Members ({members.length})
              </label>
              <div className="space-y-2 mt-1">
                {members.map(m => {
                  const isTemp = m.member_type === 'temporary'
                  const editing = editingUserId === m.user_id
                  return (
                    <div key={m.user_id} className={cn('rounded-2xl', isTemp && cn('px-3 py-2.5 bg-[#e6d6ca]', RAISED_SM))}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-[38px] h-[38px] flex-none rounded-full bg-[#e6d6ca] flex items-center justify-center text-[13px] font-black text-[#c1673f]', RAISED_SM)}>
                          {initials(m.profiles?.full_name)}
                        </div>
                        <span className="font-bold text-sm text-[#4b3a2f]">
                          {m.profiles?.full_name || 'Unnamed member'}
                        </span>
                        {m.user_id === profile?.id && (
                          <span className={cn('text-[10px] font-extrabold uppercase tracking-wide text-[#c1673f] bg-[#e6d6ca] px-2 py-0.5 rounded-full', INSET_SM)}>
                            You
                          </span>
                        )}
                        {isTemp && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#c1673f] bg-[#efd9cf] px-2 py-0.5 rounded-full">
                            <Hourglass className="h-3 w-3" /> Temporary
                          </span>
                        )}
                        {isTemp && (
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={() => (editing ? setEditingUserId(null) : startEditMember(m))} className="text-[#8a7462] hover:text-[#5a4638]" aria-label="Edit access">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => removeMember(m)} className="text-[#b5574a] hover:text-[#9a4a3f]" aria-label="Remove member">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {isTemp && !editing && (
                        <div className="mt-1.5 ml-[50px] flex flex-wrap items-center gap-1.5">
                          {(m.allowed_sections ?? []).map(s => (
                            <span key={s} className="text-[11px] font-bold text-[#7a6142] bg-[#e7ddce] px-2 py-0.5 rounded-full">
                              {SECTION_LABELS[s]}
                            </span>
                          ))}
                          <span className="text-[11px] font-semibold text-[#a58b78] w-full">
                            Access until {formatDateTime(m.access_expires_at)}.
                          </span>
                        </div>
                      )}

                      {isTemp && editing && (
                        <div className="mt-2.5 ml-[50px] space-y-2.5">
                          <div>
                            <label className={LABEL}>Sections</label>
                            <div className="flex flex-wrap gap-1.5">
                              {TEMP_GRANTABLE_SECTIONS.map(s => {
                                const on = editSections.includes(s)
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => setEditSections(toggleFrom(editSections, s))}
                                    className={cn('text-[12px] font-bold px-3 py-1.5 rounded-full',
                                      on ? 'text-[#c1673f] bg-[#efd9cf]' : cn('text-[#8a7462] bg-[#e6d6ca]', INSET_SM))}
                                  >
                                    {SECTION_LABELS[s]}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex-1 min-w-[140px]">
                              <label className={LABEL}>Starts (optional)</label>
                              <input type="datetime-local" className={INPUT} value={editStart} onChange={e => setEditStart(e.target.value)} />
                            </div>
                            <div className="flex-1 min-w-[140px]">
                              <label className={LABEL}>Ends</label>
                              <input type="datetime-local" className={INPUT} value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveTemporaryAccess(m.user_id)} disabled={saving || editSections.length === 0} className={cn(BTN_PRIMARY, 'px-4 py-2')}>Save</button>
                            <button onClick={() => setEditingUserId(null)} className={cn(BTN_GHOST, 'px-4 py-2')}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Invite code */}
            <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5">
              <label className={LABEL}>Invite Code</label>
              <p className="text-xs font-semibold text-[#a58b78] mb-2">Share this code so others can join with it.</p>
              <div className="flex gap-2">
                <div className={cn('flex-1 rounded-2xl px-4 py-2.5 text-sm font-mono font-black tracking-widest text-[#4b3a2f] bg-[#e6d6ca]', RAISED_SM)}>
                  {inviteCode}
                </div>
                <button onClick={copyInviteCode} className={BTN_GHOST}>
                  {copied ? <Check className="h-4 w-4 text-[#7c9a6e]" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Invite a user by email */}
            <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5">
              <label className={cn(LABEL, 'flex items-center gap-1.5')}>
                <Mail className="h-3.5 w-3.5" /> Invite Someone
              </label>
              <p className="text-xs font-semibold text-[#a58b78] mb-2">Invite an existing user by email — they&apos;ll see it here to accept.</p>
              <div className="flex gap-2">
                <input
                  className={cn(INPUT, 'flex-1')}
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="person@example.com"
                />
                <button onClick={sendInvite} className={BTN_GHOST}>
                  Send
                </button>
              </div>

              {/* Temporary access options */}
              <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
                <input type="checkbox" checked={inviteTemp} onChange={e => setInviteTemp(e.target.checked)} className="accent-[#c1673f] h-4 w-4" />
                <span className="text-sm font-bold text-[#4b3a2f] flex items-center gap-1.5">
                  <Hourglass className="h-3.5 w-3.5 text-[#c1673f]" /> Temporary access (housesitter / petsitter)
                </span>
              </label>
              {inviteTemp && (
                <div className={cn('mt-2.5 p-3 rounded-2xl bg-[#e6d6ca] space-y-2.5', INSET_SM)}>
                  <p className="text-xs font-semibold text-[#a58b78]">
                    They&apos;ll get the dashboard plus the sections you pick, until the end date.
                  </p>
                  <div>
                    <label className={LABEL}>Sections</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMP_GRANTABLE_SECTIONS.map(s => {
                        const on = inviteSections.includes(s)
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setInviteSections(toggleFrom(inviteSections, s))}
                            className={cn('text-[12px] font-bold px-3 py-1.5 rounded-full',
                              on ? 'text-[#c1673f] bg-[#efd9cf]' : cn('text-[#8a7462] bg-[#e6d6ca]', RAISED_SM))}
                          >
                            {SECTION_LABELS[s]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex-1 min-w-[140px]">
                      <label className={LABEL}>Starts (optional)</label>
                      <input type="datetime-local" className={INPUT} value={inviteStart} onChange={e => setInviteStart(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <label className={LABEL}>Ends</label>
                      <input type="datetime-local" className={INPUT} value={inviteEnd} onChange={e => setInviteEnd(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {inviteMsg && <p className="text-sm font-semibold text-[#7c9a6e] mt-1">{inviteMsg}</p>}
              {outgoingInvites.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {outgoingInvites.map(inv => (
                    <div key={inv.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 font-semibold text-[#8a7462] truncate">{inv.email}</span>
                      {inv.member_type === 'temporary' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#c1673f] bg-[#efd9cf] px-2 py-0.5 rounded-full">
                          <Hourglass className="h-3 w-3" /> Temp
                        </span>
                      )}
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[#a58b78]">Pending</span>
                      <button onClick={() => revokeInvite(inv.id)} className="text-[#b5574a] hover:text-[#9a4a3f]" aria-label="Revoke invitation">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* My households: switch between and leave */}
      <div className={cn('p-5', CARD)}>
        <h2 className="font-extrabold text-[#4b3a2f] mb-4">My Households</h2>

        {memberships.length > 0 && (
          <div className="space-y-2 mb-4">
            {memberships.map(m => {
              const active = m.household_id === profile?.household_id
              return (
                <div key={m.household_id} className={cn('flex items-center gap-3 rounded-2xl px-4 py-3 bg-[#e6d6ca]', active ? INSET_SM : RAISED_SM)}>
                  <span className={cn('flex-1 font-extrabold text-sm', active ? 'text-[#c1673f]' : 'text-[#4b3a2f]')}>
                    {m.households?.name ?? 'Household'}
                  </span>
                  {active ? (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#c1673f]">Active</span>
                  ) : (
                    <button onClick={() => switchHousehold(m.household_id)} className={cn(BTN_GHOST, 'px-3 py-1.5 text-[13px]')}>
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Switch
                    </button>
                  )}
                  <button onClick={() => leaveHousehold(m.household_id)} className="text-[#b5574a] hover:text-[#9a4a3f]" aria-label="Leave household">
                    <DoorOpen className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Create a new household */}
        {!isTempMember && (
        <>
        <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5">
          <h3 className="text-sm font-extrabold text-[#4b3a2f] mb-2 flex items-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create a Household
          </h3>
          <div className="flex gap-2">
            <input
              className={cn(INPUT, 'flex-1')}
              value={newHouseholdName}
              onChange={e => setNewHouseholdName(e.target.value)}
              placeholder="Our Home"
            />
            <button onClick={createHousehold} disabled={saving} className={BTN_PRIMARY}>
              Create
            </button>
          </div>
        </div>

        {/* Join an existing household */}
        <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5 mt-3.5">
          <h3 className="text-sm font-extrabold text-[#4b3a2f] mb-2 flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" /> Join with a Code
          </h3>
          <div className="flex gap-2">
            <input
              className={cn(INPUT, 'flex-1 uppercase tracking-widest')}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="INVITE CODE"
              maxLength={8}
            />
            <button onClick={joinHousehold} className={BTN_GHOST}>
              Join
            </button>
          </div>
          {joinError && <p className="text-sm font-semibold text-[#b5574a] mt-1">{joinError}</p>}
        </div>
        </>
        )}
      </div>

      {/* Sign out */}
      <div className={cn('p-5', CARD)}>
        <h2 className="font-extrabold text-[#4b3a2f] mb-3">Account</h2>
        <button onClick={signOut} className={BTN_DANGER_GHOST}>
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
