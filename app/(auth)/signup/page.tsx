'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [householdName, setHouseholdName] = useState('Our Home')
  const [inviteCode, setInviteCode] = useState('')
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Sign up failed')
      setLoading(false)
      return
    }

    const userId = authData.user.id

    if (tab === 'create') {
      const { data: household, error: hError } = await supabase
        .from('households')
        .insert({ name: householdName })
        .select()
        .single()

      if (hError || !household) {
        toast.error('Failed to create household')
        setLoading(false)
        return
      }

      await supabase
        .from('profiles')
        .update({ household_id: household.id, full_name: fullName })
        .eq('id', userId)
    } else {
      const { data: household, error: hError } = await supabase
        .from('households')
        .select()
        .eq('invite_code', inviteCode.trim().toUpperCase())
        .single()

      if (hError || !household) {
        toast.error('Invalid invite code — check with your partner')
        setLoading(false)
        return
      }

      await supabase
        .from('profiles')
        .update({ household_id: household.id, full_name: fullName })
        .eq('id', userId)
    }

    toast.success('Account created! Welcome.')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Set up your household or join your partner's
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSignup}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="8+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'create' | 'join')}>
            <TabsList className="w-full">
              <TabsTrigger value="create" className="flex-1">
                Create household
              </TabsTrigger>
              <TabsTrigger value="join" className="flex-1">
                Join household
              </TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="space-y-2 mt-3">
              <Label htmlFor="hname">Household name</Label>
              <Input
                id="hname"
                placeholder="Our Home"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                You'll get an invite code to share with your partner after signing up.
              </p>
            </TabsContent>
            <TabsContent value="join" className="space-y-2 mt-3">
              <Label htmlFor="code">Invite code</Label>
              <Input
                id="code"
                placeholder="ABCD1234"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="uppercase tracking-widest"
                required={tab === 'join'}
              />
              <p className="text-xs text-muted-foreground">
                Ask your partner for the 8-character code from their Settings page.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
