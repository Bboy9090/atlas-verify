'use client'

import { useState } from 'react'
import { signOut, useSession } from 'next-auth/react'
import { Trash2, ShieldAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function AccountPage() {
  const { data: session } = useSession()
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function deleteAccount() {
    if (confirmation !== 'DELETE') {
      toast.error('Type DELETE to confirm permanent account deletion')
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/account', { method: 'DELETE' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Account deletion failed')

      toast.success('Account and associated AtlasVerify data deleted')
      await signOut({ callbackUrl: '/' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Account deletion failed')
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Account</h1>
          <p className="mt-2 text-slate-400">Manage your AtlasVerify account and data.</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Signed in</CardTitle>
            <CardDescription className="text-slate-400">{session?.user?.email}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-red-950/20 border-red-800/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-300">
              <ShieldAlert className="h-5 w-5" />
              Delete account
            </CardTitle>
            <CardDescription className="text-red-200/70">
              Permanently deletes your account and all cases, subjects, enrichment results, evidence facts, and audit records associated with it. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation" className="text-slate-200">
                Type DELETE to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
            <Button
              onClick={deleteAccount}
              disabled={deleting || confirmation !== 'DELETE'}
              className="bg-red-700 hover:bg-red-600 text-white"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? 'Deleting account…' : 'Delete account permanently'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
