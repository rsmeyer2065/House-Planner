'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Household } from '@/lib/types'
import { Copy, Check, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CARD, INPUT, LABEL, BTN_PRIMARY, BTN_GHOST, BTN_DANGER_GHOST, RAISED_SM } from '@/lib/neu'

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      setFullName(prof?.full_name ?? '')

      if (prof?.household_id) {
        const { data: hh } = await supabase.from('households').select('*').eq('id', prof.household_id).single()
        setHousehold(hh)
        setHouseholdName(hh?.name ?? '')
        setInviteCode(hh?.invite_code ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    setSaving(false)
  }

  async function saveHousehold() {
    if (!household) return
    setSaving(true)
    await supabase.from('households').update({ name: householdName }).eq('id', household.id)
    setSaving(false)
  }

  async function createHousehold() {
    if (!profile) return
    setSaving(true)
    const { data: hh } = await supabase
      .from('households')
      .insert({ name: householdName || 'Our Home' })
      .select()
      .single()
    if (hh) {
      await supabase.from('profiles').update({ household_id: hh.id }).eq('id', profile.id)
      setHousehold(hh)
      setInviteCode(hh.invite_code)
    }
    setSaving(false)
  }

  async function joinHousehold() {
    setJoinError('')
    const { data: hh } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', joinCode.trim().toUpperCase())
      .single()
    if (!hh) {
      setJoinError('Invalid invite code.')
      return
    }
    if (!profile) return
    await supabase.from('profiles').update({ household_id: hh.id }).eq('id', profile.id)
    setHousehold(hh)
    setHouseholdName(hh.name)
    setInviteCode(hh.invite_code)
    setJoinCode('')
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
        {[1, 2].map(i => <div key={i} className="h-36 rounded-[22px] bg-[#dcc8ba] animate-pulse" />)}
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
              className={INPUT}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <button onClick={saveProfile} disabled={saving} className={BTN_PRIMARY}>
            Save Profile
          </button>
        </div>
      </div>

      {/* Household */}
      <div className={cn('p-5', CARD)}>
        <h2 className="font-extrabold text-[#4b3a2f] mb-4">Household</h2>
        {household ? (
          <div className="space-y-3">
            <div>
              <label className={LABEL}>Household Name</label>
              <input
                className={INPUT}
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
              />
            </div>
            <button onClick={saveHousehold} disabled={saving} className={BTN_PRIMARY}>
              Save
            </button>
            <div className="border-t border-[rgba(150,120,95,0.18)] pt-3.5">
              <label className={LABEL}>Invite Code</label>
              <p className="text-xs font-semibold text-[#a58b78] mb-2">Share this code to let others join your household.</p>
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
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#4b3a2f] mb-2">Create a New Household</h3>
              <div className="flex gap-2">
                <input
                  className={cn(INPUT, 'flex-1')}
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  placeholder="Our Home"
                />
                <button onClick={createHousehold} disabled={saving} className={BTN_PRIMARY}>
                  Create
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(150,120,95,0.18)]" /></div>
              <div className="relative flex justify-center"><span className="px-2 bg-[#e6d6ca] text-xs font-bold text-[#a58b78]">or</span></div>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#4b3a2f] mb-2">Join an Existing Household</h3>
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
          </div>
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
