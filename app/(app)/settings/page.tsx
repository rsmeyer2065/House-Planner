'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Household } from '@/lib/types'
import { Copy, Check, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
        <div className="h-8 w-32 bg-muted rounded animate-pulse mb-6" />
        {[1, 2].map(i => <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Profile */}
      <div className="rounded-xl border bg-card p-5 mb-4">
        <h2 className="font-semibold mb-4">Profile</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Display Name</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Save Profile
          </button>
        </div>
      </div>

      {/* Household */}
      <div className="rounded-xl border bg-card p-5 mb-4">
        <h2 className="font-semibold mb-4">Household</h2>
        {household ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Household Name</label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                value={householdName}
                onChange={e => setHouseholdName(e.target.value)}
              />
            </div>
            <button
              onClick={saveHousehold}
              disabled={saving}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save
            </button>
            <div className="border-t pt-3">
              <label className="text-sm font-medium mb-2 block">Invite Code</label>
              <p className="text-xs text-muted-foreground mb-2">Share this code to let others join your household.</p>
              <div className="flex gap-2">
                <div className="flex-1 border rounded-lg px-3 py-2 text-sm bg-muted font-mono font-bold tracking-widest">
                  {inviteCode}
                </div>
                <button
                  onClick={copyInviteCode}
                  className="flex items-center gap-1.5 border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Create a New Household</h3>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  value={householdName}
                  onChange={e => setHouseholdName(e.target.value)}
                  placeholder="Our Home"
                />
                <button
                  onClick={createHousehold}
                  disabled={saving}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
                >
                  Create
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
              <div className="relative flex justify-center"><span className="px-2 bg-card text-xs text-muted-foreground">or</span></div>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">Join an Existing Household</h3>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-widest"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="INVITE CODE"
                  maxLength={8}
                />
                <button
                  onClick={joinHousehold}
                  className="border px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted transition-colors whitespace-nowrap"
                >
                  Join
                </button>
              </div>
              {joinError && <p className="text-sm text-destructive mt-1">{joinError}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold mb-3">Account</h2>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-destructive border border-destructive/30 rounded-lg px-4 py-2 text-sm font-medium hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
